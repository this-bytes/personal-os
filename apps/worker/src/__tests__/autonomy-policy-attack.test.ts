import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  automations,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  runMigrations,
  tasks,
  workspaces,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  EventsService,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import * as contracts from '@personal-os/contracts';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The independent attack on the autonomy policy.
 *
 * This file is written against the DECISIONS in WI-082
 * (`.factory/work/WI-082.md`), not against whatever the implementation happens
 * to be. Where the implementation and the decisions disagree, **the difference
 * is the finding**: this file does not soften an assertion to match the code,
 * and it never weakens a gate to make a suite green.
 *
 * HOW THIS FILE BINDS TO WI-082'S IMPLEMENTATION
 * -----------------------------------------------
 * The decisions require ONE pure resolver in `packages/contracts/src/` and
 * publish neither its name nor its calling convention. So this file does not
 * hard-code a name and call a guess: it looks for the resolver among the
 * contracts package's exports and calls it with the shape the decisions imply,
 * trying the conventions a pure resolver could have.
 *
 * **This file is liberal in the binding and strict in the behaviour.** The name
 * and the convention are not what the decisions are about, and a test that
 * failed over an unpublished detail would be testing the detail rather than
 * the decision. Every failure below prints the convention that was used, so
 * the lead can tell a disagreement from a guess.
 *
 * Until WI-082 publishes the resolver, every case that needs it fails with
 * "the resolver is not published yet". **That is this file WAITING on the
 * implementation, not a finding against it** — and each such failure says so
 * in as many words.
 *
 * ONE FINDING IS ALREADY REAL AND DOES NOT NEED THE IMPLEMENTATION: decision 3
 * denies an action outside "the known vocabulary", and **no vocabulary is
 * published anywhere in the repository**. `allowedActions` and
 * `approvalRequired` are `z.array(z.string())`
 * (`packages/contracts/src/common.ts:48-49`), so any string at all is
 * accepted and there is nothing for "the known vocabulary" to mean. That case
 * fails on its own terms and keeps failing until the vocabulary is published.
 *
 * TWO MORE GAPS ARE IN THE DECISIONS THEMSELVES, and are recorded as findings
 * in the report rather than as assertions here, because asserting them would
 * be inventing a requirement the decisions do not state:
 *
 *  - The decisions say `allowedActions` is the intersection, but **the
 *    conversation carries no action list** (`conversations` has `max_turns`,
 *    `max_duration_seconds` and `max_spend_units`, and no policy column). An
 *    implementation that intersects an absent list with an empty one denies
 *    everything, which decision 4 forbids.
 *  - The decisions say `manual` means the agent may not BEGIN work on its own
 *    initiative, but **the resolver's inputs are workspace, goal and
 *    conversation** — none of which says who started the work. Nothing in the
 *    published decisions says how "on its own initiative" is represented.
 */

/** A policy, as the decisions describe it. */
interface Policy {
  mode: string;
  allowedActions: string[];
  approvalRequired: string[];
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  dailySpendUnits: number;
}

/**
 * The conversation's own safeguards.
 *
 * These are limits, not a policy: the conversation table has no action list
 * and no mode, so this fixture deliberately carries none.
 */
interface ConversationSafeguards {
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  paused: boolean;
}

const contractsExports = contracts as unknown as Record<string, unknown>;

/**
 * The exports that could be the resolver the decisions describe.
 *
 * The name is matched loosely on purpose: the decisions do not publish one, and
 * a wrong guess would turn every case in this file into a false red.
 */
function resolverCandidates(): { name: string; fn: (...args: unknown[]) => unknown }[] {
  const functions = Object.entries(contractsExports).filter(
    (entry): entry is [string, (...args: unknown[]) => unknown] => typeof entry[1] === 'function',
  );
  const named = functions.filter(([name]) => /polic/i.test(name) && /resolv|effectiv/i.test(name));
  const chosen = named.length > 0 ? named : functions.filter(([name]) => /polic/i.test(name));
  return chosen.map(([name, fn]) => ({ name, fn }));
}

function isPolicyShaped(value: unknown): value is Policy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    'allowedActions' in value &&
    'approvalRequired' in value
  );
}

/**
 * Call the resolver, and say how it was called.
 *
 * The convention that answered is carried back with the result, so every
 * failure in this file names it.
 */
function resolvePolicy(input: {
  workspacePolicy: Policy;
  goalPolicy?: Policy;
  conversation: ConversationSafeguards;
}): { policy: Policy; how: string } {
  const candidates = resolverCandidates();

  if (candidates.length === 0) {
    throw new Error(
      'WI-082 has not published the effective-policy resolver yet: @personal-os/contracts ' +
        'exports no function that looks like a policy resolver. This case is WAITING on the ' +
        'implementation, not failing for a real reason.',
    );
  }

  const { name, fn } = candidates[0]!;
  const attempts: { how: string; call: () => unknown }[] = [
    {
      how: `${name}({ workspacePolicy, goalPolicy, conversation })`,
      call: () => fn({ ...input }),
    },
    {
      how: `${name}(workspacePolicy, goalPolicy, conversation)`,
      call: () => fn(input.workspacePolicy, input.goalPolicy, input.conversation),
    },
  ];

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = attempt.call();
      if (isPolicyShaped(result)) {
        return { policy: result, how: attempt.how };
      }
      if (
        typeof result === 'object' &&
        result !== null &&
        'policy' in result &&
        isPolicyShaped((result as { policy: unknown }).policy)
      ) {
        return {
          policy: (result as { policy: Policy }).policy,
          how: `${attempt.how} -> .policy`,
        };
      }
      failures.push(`${attempt.how} returned ${JSON.stringify(result)}`);
    } catch (error) {
      failures.push(`${attempt.how} threw ${(error as Error).message}`);
    }
  }

  throw new Error(
    `The resolver ${name} did not answer the documented input shape: ${failures.join('; ')}. ` +
      'WI-082 publishes no calling convention, so this case is WAITING on the implementation to ' +
      'publish one, not failing for a real reason.',
  );
}

/**
 * The action names a policy may hold.
 *
 * The vocabulary is not published, so these are names of the shape a future
 * vocabulary would have. **No case in this file asserts on these names being
 * right** — the cases assert on the RULE (intersect, union, deny), so a
 * vocabulary with other names does not make them false.
 */
const READ = 'read_resource';
const WRITE = 'write_resource';
const COMMAND = 'run_command';
const UNKNOWN = 'not-a-real-action';

const WORKSPACE: Policy = {
  mode: 'autonomous',
  allowedActions: [READ, WRITE, COMMAND],
  approvalRequired: [COMMAND],
  maxTurns: 10,
  maxDurationSeconds: 600,
  maxSpendUnits: 100,
  dailySpendUnits: 500,
};

const GOAL: Policy = {
  mode: 'assisted',
  allowedActions: [READ, WRITE],
  approvalRequired: [WRITE],
  maxTurns: 4,
  maxDurationSeconds: 900,
  maxSpendUnits: 50,
  dailySpendUnits: 200,
};

const CONVERSATION: ConversationSafeguards = {
  maxTurns: 7,
  maxDurationSeconds: 300,
  maxSpendUnits: 80,
  paused: false,
};

/**
 * The policy every workspace is created with today.
 *
 * Copied from `apps/server/src/modules/workspaces/service.ts:58-66` — the
 * shipped default, not a guess, because the regression half of decision 4 is
 * about exactly this object.
 */
const DEFAULT_WORKSPACE_POLICY: Policy = {
  mode: 'manual',
  allowedActions: [],
  approvalRequired: [],
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
  dailySpendUnits: 0,
};

/**
 * The vocabulary of action names, if the repository publishes one.
 *
 * Decision 3 denies an action outside "the known vocabulary", so the
 * vocabulary has to exist and be published. This looks for it among the
 * contracts package's exports: a published array of names, or a published
 * enumeration of them.
 */
function publishedVocabulary(): string[] | undefined {
  for (const [name, value] of Object.entries(contractsExports)) {
    if (!/action/i.test(name)) continue;

    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((entry) => typeof entry === 'string')
    ) {
      return value as string[];
    }

    const options =
      (value as { options?: unknown }).options ??
      (value as { _def?: { values?: unknown } })._def?.values;
    if (
      Array.isArray(options) &&
      options.length > 0 &&
      options.every((entry) => typeof entry === 'string')
    ) {
      return options as string[];
    }
  }
  return undefined;
}

describe('the resolver the decisions describe', () => {
  it('is one pure function, and it lives in the contracts package', () => {
    const first = resolvePolicy({
      workspacePolicy: WORKSPACE,
      goalPolicy: GOAL,
      conversation: CONVERSATION,
    });

    const candidates = resolverCandidates();
    expect(
      candidates.length,
      'the decisions require exactly ONE resolver, and every enforcement point consumes that ' +
        `one result; the contracts package exports ${candidates.length} candidates ` +
        `(${candidates.map((candidate) => candidate.name).join(', ') || 'none'})`,
    ).toBe(1);

    const second = resolvePolicy({
      workspacePolicy: WORKSPACE,
      goalPolicy: GOAL,
      conversation: CONVERSATION,
    });
    expect(
      second.policy,
      `the resolver is not pure: the same input gave two different answers (${first.how})`,
    ).toEqual(first.policy);
  });
});

describe('strictest wins', () => {
  it('takes the minimum of the workspace limit and the goal limit', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: { ...WORKSPACE, maxTurns: 10 },
      goalPolicy: { ...GOAL, maxTurns: 4 },
      conversation: CONVERSATION,
    });

    expect(
      policy.maxTurns,
      `the effective turn limit is not the strictest of the two (${how})`,
    ).toBe(4);
  });

  it("takes the minimum with the conversation's own safeguards", () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: { ...WORKSPACE, maxTurns: 10 },
      goalPolicy: { ...GOAL, maxTurns: 8 },
      conversation: { ...CONVERSATION, maxTurns: 3 },
    });

    expect(
      policy.maxTurns,
      "the conversation's own turn limit was not part of the minimum. Either it is not read, or " +
        `the conversation input shape is not what the resolver expects — WI-082 publishes neither (${how})`,
    ).toBe(3);
  });

  it('intersects allowedActions, and never unions them', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: WORKSPACE,
      goalPolicy: GOAL,
      conversation: CONVERSATION,
    });

    expect(
      policy.allowedActions,
      `the effective allowed actions are not the intersection: "${COMMAND}" is allowed by the ` +
        `workspace alone, so an intersection drops it (${how})`,
    ).not.toContain(COMMAND);
    expect(
      policy.allowedActions,
      `the effective allowed actions do not include "${READ}", which the workspace and the goal ` +
        `both allow (${how})`,
    ).toContain(READ);
  });

  it('unions approvalRequired, and never intersects them', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: WORKSPACE,
      goalPolicy: GOAL,
      conversation: CONVERSATION,
    });

    expect(
      policy.approvalRequired,
      `the effective approval list is not the union: "${COMMAND}" is required by the workspace ` +
        `alone, so a union keeps it (${how})`,
    ).toContain(COMMAND);
    expect(
      policy.approvalRequired,
      `the effective approval list does not include "${WRITE}", which the goal requires (${how})`,
    ).toContain(WRITE);
  });

  it('takes the least autonomous mode of the three', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: { ...WORKSPACE, mode: 'autonomous' },
      goalPolicy: { ...GOAL, mode: 'assisted' },
      conversation: CONVERSATION,
    });

    expect(
      policy.mode,
      `the effective mode is not the least autonomous of the three (${how})`,
    ).toBe('assisted');
  });

  it('lets a goal tighten its workspace', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: { ...WORKSPACE, mode: 'autonomous', maxTurns: 10 },
      goalPolicy: { ...GOAL, mode: 'assisted', maxTurns: 4 },
      conversation: CONVERSATION,
    });

    expect(policy.maxTurns, `a goal did not tighten the workspace's turn limit (${how})`).toBe(4);
    expect(policy.mode, `a goal did not tighten the workspace's mode (${how})`).toBe('assisted');
  });

  it('refuses a goal that tries to loosen its workspace', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: {
        ...WORKSPACE,
        mode: 'manual',
        maxTurns: 2,
        allowedActions: [READ],
      },
      goalPolicy: {
        ...GOAL,
        mode: 'autonomous',
        maxTurns: 10,
        allowedActions: [READ, WRITE],
      },
      conversation: CONVERSATION,
    });

    expect(
      policy.maxTurns,
      `a goal loosened the workspace's turn limit from 2 to ${policy.maxTurns} (${how})`,
    ).toBe(2);
    expect(
      policy.mode,
      `a goal loosened the workspace's mode from manual to ${policy.mode} (${how})`,
    ).toBe('manual');
    expect(
      policy.allowedActions,
      `a goal widened the workspace's allowed actions to ${JSON.stringify(policy.allowedActions)} (${how})`,
    ).not.toContain(WRITE);
  });
});

describe('deny by default', () => {
  it('denies an action outside the vocabulary', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: { ...WORKSPACE, allowedActions: [READ, UNKNOWN] },
      goalPolicy: { ...GOAL, allowedActions: [READ, UNKNOWN] },
      conversation: CONVERSATION,
    });

    expect(
      policy.allowedActions,
      `"${UNKNOWN}" is not a known action, and decision 3 denies an action outside the ` +
        `vocabulary — it survived the resolution (${how})`,
    ).not.toContain(UNKNOWN);
  });

  it('has a published vocabulary to deny against', () => {
    const vocabulary = publishedVocabulary();

    expect(
      vocabulary,
      'decision 3 denies an action outside "the known vocabulary", and no vocabulary is ' +
        'published anywhere: @personal-os/contracts exports no set or enumeration of action ' +
        'names, and autonomyPolicySchema takes any string at all ' +
        '(packages/contracts/src/common.ts:48-49). There is nothing to deny against.',
    ).toBeDefined();
  });
});

describe('the effective policy is readable', () => {
  it('carries every limit, every mode and both action lists', () => {
    const { policy, how } = resolvePolicy({
      workspacePolicy: WORKSPACE,
      goalPolicy: GOAL,
      conversation: CONVERSATION,
    });

    expect(typeof policy.mode, `the effective policy does not carry a mode (${how})`).toBe(
      'string',
    );
    expect(
      Array.isArray(policy.allowedActions),
      `the effective policy does not carry its allowed actions (${how})`,
    ).toBe(true);
    expect(
      Array.isArray(policy.approvalRequired),
      `the effective policy does not carry its approval list (${how})`,
    ).toBe(true);
    for (const limit of [
      'maxTurns',
      'maxDurationSeconds',
      'maxSpendUnits',
      'dailySpendUnits',
    ] as const) {
      expect(
        typeof policy[limit],
        `the effective policy does not carry ${limit}, so a client cannot tell what the agent ` +
          `is permitted to do (${how})`,
      ).toBe('number');
    }
  });
});

/**
 * The regression half: with every workspace on its default `manual`, the three
 * ways work happens still work.
 *
 * These cases drive the worker's own paths against a workspace seeded with the
 * shipped default policy — `mode: 'manual'`, `allowedActions: []`. **They pass
 * today, because nothing reads the policy yet**, and they are here to catch the
 * implementation that makes them stop.
 */
describe('manual does not regress today', () => {
  const CAPABILITIES: AgentCapabilities = {
    chat: true,
    streaming: true,
    persistentSessions: true,
    backgroundTasks: false,
    cancel: true,
    approvals: true,
    artifacts: false,
  };

  /** An agent that answers, and finishes. */
  class AnsweringAdapter implements AgentAdapter {
    readonly type = 'echo' as const;

    async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
      return CAPABILITIES;
    }

    async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
      yield { type: 'message.delta', executionId: input.executionId, text: 'The work is done.' };
      yield {
        type: 'message.completed',
        executionId: input.executionId,
        text: 'The work is done.',
      };
      yield {
        type: 'execution.status',
        executionId: input.executionId,
        status: 'completed',
      };
    }

    async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
      return externalSessionId;
    }
  }

  const NOW = '2026-01-01T00:00:00.000Z';

  let handle: DatabaseHandle;
  let runtime: Runtime;
  let context: ExecutorContext;

  function job(type: string, payload: Record<string, unknown>): Parameters<typeof executeJob>[1] {
    return {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type,
      payload,
      status: 'running',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: NOW,
      lockedAt: null,
      lockedBy: 'worker_1',
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    } as unknown as Parameters<typeof executeJob>[1];
  }

  function seed(): void {
    handle.db
      .insert(workspaces)
      .values({
        id: 'wsp_1',
        name: 'A workspace',
        slug: 'a-workspace',
        description: '',
        autonomyMode: 'manual',
        autonomyPolicy: DEFAULT_WORKSPACE_POLICY,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    handle.db
      .insert(conversations)
      .values({
        id: 'cnv_1',
        workspaceId: 'wsp_1',
        title: 'A conversation',
        routingMode: 'mentions',
        coordinatorId: null,
        paused: false,
        maxTurns: 8,
        maxDurationSeconds: 900,
        maxSpendUnits: 0,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    handle.db
      .insert(participants)
      .values({
        id: 'p_owner',
        conversationId: 'cnv_1',
        type: 'human',
        agentConnectionId: null,
        displayName: 'The owner',
        joinedAt: NOW,
      })
      .run();

    handle.db
      .insert(participants)
      .values({
        id: 'p_agent',
        conversationId: 'cnv_1',
        type: 'agent',
        agentConnectionId: 'agt_1',
        displayName: 'The agent',
        joinedAt: NOW,
      })
      .run();

    handle.db
      .insert(agentConnections)
      .values({
        id: 'agt_1',
        workspaceId: 'wsp_1',
        name: 'The agent',
        adapterType: 'echo',
        configRef: 'cfg_1',
        toolGrants: null,
        enabled: true,
        capabilities: CAPABILITIES,
        status: 'unknown',
        lastError: null,
        lastConnectedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    // The owner's own message: the turn below is owner-directed.
    handle.db
      .insert(messages)
      .values({
        id: 'msg_owner',
        conversationId: 'cnv_1',
        senderId: 'p_owner',
        targetParticipantIds: [],
        replyToId: null,
        kind: 'text',
        content: [{ type: 'text', text: 'Do the thing' }],
        status: 'complete',
        correlationId: 'cor_1',
        origin: { kind: 'human', actorId: 'p_owner', depth: 0 },
        executionId: null,
        createdAt: NOW,
      })
      .run();

    handle.db
      .insert(executions)
      .values({
        id: 'exe_1',
        workspaceId: 'wsp_1',
        conversationId: 'cnv_1',
        taskId: null,
        externalRef: null,
        agentConnectionId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'queued',
        error: null,
        spendUnits: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: NOW,
      })
      .run();
  }

  beforeEach(() => {
    handle = createDatabase(':memory:');
    runMigrations(handle.db);

    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: '.',
      PERSONAL_OS_OWNER_TOKEN: 'worker-test-token',
      LOG_LEVEL: 'silent',
    } as NodeJS.ProcessEnv);

    runtime = {
      config,
      db: handle.db,
      sqlite: handle.sqlite,
      registry: {
        create: () => new AnsweringAdapter(),
      } as unknown as Runtime['registry'],
      events: new EventsService(handle.db),
      queue: new Queue(handle.db),
      audit: createAuditService(handle.db),
      resolveSecret: async () =>
        JSON.stringify({ adapterType: 'echo', config: { timeoutSeconds: 30 } }),
      close: () => handle.close(),
    };

    context = { runtime };
    seed();
  });

  afterEach(() => {
    handle.close();
  });

  it('still runs an owner-directed chat turn', async () => {
    const outcome = await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_owner',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      }),
    );

    expect(
      outcome.status,
      'the owner-directed turn did not run under the default manual policy: manual means the ' +
        'agent may not BEGIN work on its own initiative, not that the agent is switched off',
    ).toBe('completed');

    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status, 'the reply was not finished').toBe('complete');
  });

  it('still runs a factory task', async () => {
    handle.db
      .insert(tasks)
      .values({
        id: 'tsk_1',
        workspaceId: 'wsp_1',
        goalId: null,
        title: 'A task the owner asked for',
        description: 'Do the thing',
        assigneeId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'active',
        revision: 1,
        acceptanceCriteria: [],
        evidenceResourceIds: [],
        externalRef: null,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    handle.db
      .insert(executions)
      .values({
        id: 'exe_task',
        workspaceId: 'wsp_1',
        conversationId: null,
        taskId: 'tsk_1',
        externalRef: null,
        agentConnectionId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'queued',
        error: null,
        spendUnits: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: NOW,
      })
      .run();

    const outcome = await executeJob(
      context,
      job('factory.execute', {
        taskId: 'tsk_1',
        executionId: 'exe_task',
        agentConnectionId: 'agt_1',
      }),
    );

    expect(
      outcome.status,
      'the factory task did not run under the default manual policy: a task the owner asked for ' +
        'is owner-directed work',
    ).toBe('completed');
  });

  it('still runs a triggered automation', async () => {
    handle.db
      .insert(automations)
      .values({
        id: 'aut_1',
        workspaceId: 'wsp_1',
        title: 'An automation that fires',
        trigger: { type: 'event', event: 'task.updated' },
        action: {
          type: 'agent.prompt',
          agentConnectionId: 'agt_1',
          prompt: 'do the thing',
          method: 'GET',
        },
        revision: 1,
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const outcome = await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

    expect(
      outcome.status,
      'the triggered automation did not run under the default manual policy: an automation the ' +
        'owner set up and enabled is owner-directed work',
    ).toBe('completed');
  });

  it('stops a turn that exceeds the effective limit, and records the stop', async () => {
    // A workspace whose policy allows a single turn, and a conversation that
    // has already had one agent turn.
    handle.db
      .update(workspaces)
      .set({ autonomyPolicy: { ...DEFAULT_WORKSPACE_POLICY, maxTurns: 1 } })
      .where(eq(workspaces.id, 'wsp_1'))
      .run();

    handle.db
      .insert(executions)
      .values({
        id: 'exe_prior',
        workspaceId: 'wsp_1',
        conversationId: 'cnv_1',
        taskId: null,
        externalRef: null,
        agentConnectionId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'completed',
        error: null,
        spendUnits: 0,
        startedAt: NOW,
        finishedAt: NOW,
        createdAt: NOW,
      })
      .run();

    const outcome = await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_owner',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      }),
    );

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();

    expect(
      outcome.status,
      'the turn completed although the effective turn limit was already reached: a turn that ' +
        'exceeds a limit stops, and it does not run to the end and get truncated',
    ).not.toBe('completed');
    expect(
      execution?.status,
      'the stop was not recorded on the execution: the outcome has to be recorded, not dropped',
    ).not.toBe('completed');
    expect(
      execution?.error ?? execution?.status,
      'the stop was recorded without any reason, so nothing says which limit stopped the turn',
    ).toBeTruthy();
  });
});
