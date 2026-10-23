import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  approvals,
  auditLog,
  automations,
  automationRuns,
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
import {
  isActionAllowed,
  resolveAutonomyPolicy,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentExecutionStatus,
  type AgentTurnInput,
  type AutonomyPolicy,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The autonomy policy that is actually enforced.
 *
 * Two things are pinned down here: the resolver that decides what is in
 * force, and the worker that holds a turn to it. The resolver is pure, so
 * its rules are read straight off the function; the worker is driven through
 * a real execution, because a policy that is not enforced is a policy that
 * is only written down.
 */

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: true,
  backgroundTasks: false,
  cancel: true,
  approvals: true,
  artifacts: false,
};

const NOW = '2026-01-01T00:00:00.000Z';

/** A policy with everything spelled out, so a test changes one thing at a time. */
function policy(overrides: Partial<AutonomyPolicy> = {}): AutonomyPolicy {
  return {
    mode: 'manual',
    allowedActions: [],
    approvalRequired: [],
    maxTurns: 8,
    maxDurationSeconds: 900,
    maxSpendUnits: 0,
    dailySpendUnits: 0,
    ...overrides,
  };
}

/** An agent that answers, and may do something else on the way. */
class ScriptedAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  readonly turns: AgentTurnInput[] = [];
  /** What the agent does on this turn. */
  script: AgentEvent[] = [];
  /** Whether the agent never finishes, so the deadline ends the turn. */
  hang = false;

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.turns.push(input);
    if (this.hang) {
      await new Promise<void>((resolve) => {
        input.signal?.addEventListener('abort', () => resolve());
      });
      return;
    }
    for (const event of this.script) {
      yield { ...event, executionId: input.executionId } as AgentEvent;
    }
  }

  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return { executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: ScriptedAdapter;

/** The policy the workspace carries for the next test. */
let workspacePolicy: AutonomyPolicy;

/** The agent's script for the next test. */
let script: AgentEvent[];

function job(
  payload: Record<string, unknown>,
  type: Parameters<typeof executeJob>[1]['type'] = 'chat.turn',
): Parameters<typeof executeJob>[1] {
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
  };
}

function seed(): void {
  handle.db
    .insert(workspaces)
    .values({
      id: 'wsp_1',
      name: 'The workspace',
      slug: 'the-workspace',
      description: '',
      autonomyMode: 'manual',
      autonomyPolicy: workspacePolicy,
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
      id: 'p_1',
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

  handle.db
    .insert(messages)
    .values({
      id: 'msg_parent',
      conversationId: 'cnv_1',
      senderId: 'p_1',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: 'Do the thing' }],
      status: 'complete',
      correlationId: 'cor_1',
      origin: null,
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

/** Add an agent turn to the chain, so the next turn is the second one. */
function addAgentTurn(count: number): void {
  for (let index = 0; index < count; index += 1) {
    handle.db
      .insert(messages)
      .values({
        id: `msg_agent_${index}`,
        conversationId: 'cnv_1',
        senderId: 'p_1',
        targetParticipantIds: [],
        replyToId: null,
        kind: 'text',
        content: [{ type: 'text', text: 'Working on it' }],
        status: 'complete',
        correlationId: 'cor_1',
        origin: { kind: 'agent', actorId: 'p_1', agentConnectionId: 'agt_1', depth: 1 },
        executionId: null,
        createdAt: '2026-01-01T00:00:01.000Z',
      })
      .run();
  }
}

/** Change the policy the workspace carries, the way the owner would. */
function setWorkspacePolicy(next: AutonomyPolicy): void {
  workspacePolicy = next;
  handle.db
    .update(workspaces)
    .set({ autonomyPolicy: next })
    .where(eq(workspaces.id, 'wsp_1'))
    .run();
}

/** How many spend rows this test has written. */
let spendRows = 0;

/**
 * Record spend against a workspace, the way the executions the product keeps
 * record it.
 *
 * The spend is a query over those rows, so a test that wants the cap to bite
 * writes the rows the product would have written.
 */
function addSpend(options: {
  amount: number;
  workspaceId?: string;
  conversationId?: string | null;
  createdAt?: string;
}): void {
  spendRows += 1;
  handle.db
    .insert(executions)
    .values({
      id: `exe_spend_${spendRows}`,
      workspaceId: options.workspaceId ?? 'wsp_1',
      conversationId: options.conversationId ?? 'cnv_1',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'completed',
      error: null,
      spendUnits: options.amount,
      startedAt: null,
      finishedAt: null,
      createdAt: options.createdAt ?? new Date().toISOString(),
    })
    .run();
}

/** The start of the current UTC day, and of the day before it. */
function utcDays(now: Date): { startOfToday: string; yesterday: string } {
  return {
    startOfToday: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
    ).toISOString(),
    yesterday: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 12, 0, 0, 0),
    ).toISOString(),
  };
}

function runTurn(executionId = 'exe_1'): ReturnType<typeof executeJob> {
  return executeJob(
    context,
    job({
      conversationId: 'cnv_1',
      parentMessageId: 'msg_parent',
      agentConnectionId: 'agt_1',
      executionId,
      correlationId: 'cor_1',
      depth: 1,
    }),
  );
}

/**
 * Add an execution for the workspace, the way the server adds one for a turn.
 *
 * The row is created now, because that is when the server creates it and the
 * daily cap is measured from the start of the UTC day.
 */
function addExecution(
  id: string,
  options: { taskId?: string | null; conversationId?: string | null } = {},
): void {
  handle.db
    .insert(executions)
    .values({
      id,
      workspaceId: 'wsp_1',
      conversationId: options.taskId ? null : (options.conversationId ?? 'cnv_1'),
      taskId: options.taskId ?? null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** A task for the factory path, with the acceptance criteria a task carries. */
function seedTask(): void {
  handle.db
    .insert(tasks)
    .values({
      id: 'tsk_1',
      workspaceId: 'wsp_1',
      goalId: null,
      title: 'Do the thing',
      description: '',
      assigneeId: null,
      executionOwner: 'personal-os',
      status: 'open',
      revision: 1,
      acceptanceCriteria: ['It is done.'],
      evidenceResourceIds: [],
      externalRef: null,
      createdBy: 'system',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** An automation whose action is a prompt to the agent. */
function seedAutomation(): void {
  handle.db
    .insert(automations)
    .values({
      id: 'aut_1',
      workspaceId: 'wsp_1',
      title: 'The automation',
      trigger: { type: 'manual' },
      action: {
        type: 'agent.prompt',
        agentConnectionId: 'agt_1',
        prompt: 'Do the thing',
        method: 'GET',
      },
      revision: 1,
      enabled: true,
      lastRunAt: null,
      nextRunAt: null,
      createdBy: 'system',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** Run a factory task's turn, the way the queue runs it. */
function runTask(): ReturnType<typeof executeJob> {
  return executeJob(
    context,
    job(
      { taskId: 'tsk_1', executionId: 'exe_task', agentConnectionId: 'agt_1' },
      'factory.execute',
    ),
  );
}

/** Run an automation, the way the scheduler runs it. */
function runAutomation(): ReturnType<typeof executeJob> {
  return executeJob(context, job({ automationId: 'aut_1' }, 'automation.run'));
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

  workspacePolicy = policy();
  spendRows = 0;
  script = [{ type: 'message.delta', executionId: 'exe_1', text: 'Here you go.' }];
  adapter = new ScriptedAdapter();
  adapter.script = script;

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    registry: {
      create: () => adapter,
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

describe('the effective autonomy policy', () => {
  it('takes the strictest of the limits', () => {
    const effective = resolveAutonomyPolicy({
      workspace: policy({ maxTurns: 10, maxDurationSeconds: 600 }),
      goal: policy({ maxTurns: 4, maxDurationSeconds: 900 }),
      conversation: { maxTurns: 6, maxDurationSeconds: 300, maxSpendUnits: 0 },
    });

    expect(effective.maxTurns).toBe(4);
    expect(effective.maxDurationSeconds).toBe(300);
    expect(effective.sources.maxTurns).toBe('goal');
    expect(effective.sources.maxDurationSeconds).toBe('conversation');
  });

  it('lets a goal tighten its workspace and never loosen it', () => {
    const effective = resolveAutonomyPolicy({
      workspace: policy({ maxTurns: 4 }),
      goal: policy({ maxTurns: 10 }),
    });

    expect(effective.maxTurns).toBe(4);
    expect(effective.sources.maxTurns).toBe('workspace');
  });

  it('treats a spend bound of zero as no bound at all', () => {
    expect(
      resolveAutonomyPolicy({
        workspace: policy({ maxSpendUnits: 0 }),
        goal: policy({ maxSpendUnits: 5 }),
      }).maxSpendUnits,
    ).toBe(5);
    expect(
      resolveAutonomyPolicy({
        workspace: policy({ maxSpendUnits: 3 }),
        goal: policy({ maxSpendUnits: 0 }),
      }).maxSpendUnits,
    ).toBe(3);
    expect(resolveAutonomyPolicy({ workspace: policy({ maxSpendUnits: 0 }) }).maxSpendUnits).toBe(
      0,
    );
  });

  it('intersects the allowed actions and unions the approvals', () => {
    const effective = resolveAutonomyPolicy({
      workspace: policy({
        allowedActions: ['message.send', 'tool.call'],
        approvalRequired: ['tool.call'],
      }),
      goal: policy({
        allowedActions: ['tool.call', 'artifact.create'],
        approvalRequired: ['artifact.create'],
      }),
    });

    expect(effective.allowedActions).toEqual(['tool.call']);
    expect(effective.approvalRequired).toEqual(['tool.call', 'artifact.create']);
  });

  it('takes the least autonomous mode', () => {
    expect(
      resolveAutonomyPolicy({
        workspace: policy({ mode: 'autonomous' }),
        goal: policy({ mode: 'assisted' }),
      }).mode,
    ).toBe('assisted');
    expect(
      resolveAutonomyPolicy({
        workspace: policy({ mode: 'autonomous' }),
        goal: policy({ mode: 'manual' }),
      }).mode,
    ).toBe('manual');
    expect(resolveAutonomyPolicy({ workspace: policy({ mode: 'autonomous' }) }).mode).toBe(
      'autonomous',
    );
  });

  it('denies an action the vocabulary does not know', () => {
    const effective = resolveAutonomyPolicy({
      workspace: policy({ allowedActions: ['tool.launch'] }),
    });

    // A policy that names nothing the system knows allows nothing.
    expect(effective.allowedActions).toEqual([]);
    expect(isActionAllowed(effective, 'tool.launch')).toBe(false);
    expect(isActionAllowed(effective, 'tool.call')).toBe(false);
  });

  it('leaves the actions alone when a policy names none', () => {
    const effective = resolveAutonomyPolicy({ workspace: policy() });

    expect(effective.allowedActions).toEqual(['message.send', 'tool.call', 'artifact.create']);
    expect(isActionAllowed(effective, 'tool.call')).toBe(true);
  });
});

describe('a turn held to the effective policy', () => {
  it('runs when the policy allows it', async () => {
    const outcome = await runTurn();

    // A chat turn's output is written into the conversation's canonical
    // history, so the turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');
  });

  it('does not start when the chain has used the turn budget', async () => {
    setWorkspacePolicy(policy({ maxTurns: 1 }));
    addAgentTurn(1);

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('turn limit of 1');
    expect(outcome.error).toContain("the workspace's policy");

    // The turn did not happen, and the outcome says so rather than leaving a
    // turn that quietly did nothing.
    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('failed');
    expect(execution?.error).toContain('turn limit of 1');

    const refusal = handle.db
      .select()
      .from(auditLog)
      .all()
      .find((entry) => entry.action === 'policy.turn.refused');
    expect(refusal?.result).toBe('failure');
  });

  it('holds a turn to the workspace policy even when the conversation is laxer', async () => {
    // The conversation allows eight turns; the workspace allows one.
    setWorkspacePolicy(policy({ maxTurns: 1 }));
    addAgentTurn(1);

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('turn limit of 1');
  });

  it('does not start when the chain has used the spend budget', async () => {
    setWorkspacePolicy(policy({ maxSpendUnits: 2 }));
    addAgentTurn(2);

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('spend limit of 2');
  });

  it('stops a turn that runs past the policy duration', async () => {
    setWorkspacePolicy(policy({ maxDurationSeconds: 1 }));
    adapter.hang = true;

    const outcome = await runTurn();

    // The deadline stopped work that had already started, so the honest
    // answer is that we do not know how it ended.
    expect(outcome.status).toBe('unknown');
    expect(outcome.error).toContain("The autonomy policy's limit of 1s is the deadline.");
  });

  it('refuses an action the policy does not allow', async () => {
    setWorkspacePolicy(policy({ allowedActions: ['artifact.create'] }));

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('"message.send"');
    expect(outcome.error).toContain("the workspace's policy");

    // The refusal is on the reply as well, because the reply is what the
    // owner reads.
    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status).toBe('failed');
    expect(reply?.detail).toContain('"message.send"');

    const refusal = handle.db
      .select()
      .from(auditLog)
      .all()
      .find((entry) => entry.action === 'policy.action.refused');
    expect(refusal?.result).toBe('failure');
  });

  it('waits for the owner when the policy wants a decision', async () => {
    setWorkspacePolicy(policy({ approvalRequired: ['message.send'] }));

    const outcome = await runTurn();

    expect(outcome.status).toBe('blocked');

    // The request is the same shape as the one an agent raises for itself.
    const request = handle.db.select().from(approvals).all();
    expect(request).toHaveLength(1);
    expect(request[0]?.status).toBe('pending');
    expect(request[0]?.executionId).toBe('exe_1');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('blocked');
    expect(execution?.finishedAt).toBeNull();
  });
});

describe('a turn held to the daily spend cap', () => {
  it('does not start when the workspace has reached its daily spend limit', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    addSpend({ amount: 10 });

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('daily spend limit of 10');
    expect(outcome.error).toContain('00:00 UTC');
    // The refusal names the policy that set the cap, so the owner knows
    // whether to change the workspace, the goal or the conversation.
    expect(outcome.error).toContain("the workspace's policy");

    // The turn did not happen, and the outcome says so rather than leaving a
    // turn that quietly did nothing.
    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('failed');
    expect(execution?.error).toContain('daily spend limit of 10');

    const refusal = handle.db
      .select()
      .from(auditLog)
      .all()
      .find((entry) => entry.action === 'policy.turn.refused');
    expect(refusal?.result).toBe('failure');
    expect((refusal?.metadata as { reason?: string })?.reason).toContain('daily spend limit of 10');
  });

  it('runs while the workspace is under its daily spend limit', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    addSpend({ amount: 9 });

    const outcome = await runTurn();

    // A chat turn's output is written into the conversation's canonical
    // history, so the turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');
  });

  it('imposes no limit when the daily spend limit is zero', async () => {
    // Zero is how a policy says "no limit", the same as the chain's spend
    // limit and the same as the resolver reads it.
    setWorkspacePolicy(policy({ dailySpendUnits: 0 }));
    addSpend({ amount: 1_000 });

    const outcome = await runTurn();

    // A chat turn's output is written into the conversation's canonical
    // history, so the turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');
  });

  it('counts the spend of every conversation in the workspace', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    handle.db
      .insert(conversations)
      .values({
        id: 'cnv_2',
        workspaceId: 'wsp_1',
        title: 'Another conversation',
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
    // Six units in one conversation and four in another: a daily cap is a cap
    // on the workspace and not on one chain.
    addSpend({ amount: 6, conversationId: 'cnv_2' });
    addSpend({ amount: 4, conversationId: 'cnv_1' });

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('daily spend limit of 10');
  });

  it('does not count the spend of another workspace', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    handle.db
      .insert(workspaces)
      .values({
        id: 'wsp_2',
        name: 'Another workspace',
        slug: 'another-workspace',
        description: '',
        autonomyMode: 'manual',
        autonomyPolicy: policy(),
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();
    addSpend({ amount: 100, workspaceId: 'wsp_2' });

    const outcome = await runTurn();

    // A chat turn's output is written into the conversation's canonical
    // history, so the turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');
  });

  it('counts the spend recorded at the first minute of the UTC day', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    const { startOfToday } = utcDays(new Date());
    addSpend({ amount: 10, createdAt: startOfToday });

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('daily spend limit of 10');
  });

  it('does not count the spend of yesterday', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 10 }));
    const { yesterday } = utcDays(new Date());
    addSpend({ amount: 100, createdAt: yesterday });

    const outcome = await runTurn();

    // Yesterday's spend is not today's spend, so the turn runs.
    expect(outcome.status).toBe('committed');
  });
});

describe('the spend a turn records', () => {
  it('records the cost of a conversation turn on its own execution', async () => {
    const outcome = await runTurn();

    // A chat turn's output is written into the conversation's canonical
    // history, so the turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.spendUnits).toBe(1);
  });

  it('records nothing for a turn that never ran', async () => {
    // The chain has used its turn budget, so the turn is refused before it
    // starts. A turn that did not run cost nothing.
    addAgentTurn(8);

    const outcome = await runTurn();

    expect(outcome.status).toBe('failed');
    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.spendUnits).toBe(0);
  });

  it('records the cost of a turn that waits for the owner', async () => {
    // The turn ran and then asked the owner for a decision. It cost what a
    // turn costs, and it is written even if the owner never comes back.
    setWorkspacePolicy(policy({ approvalRequired: ['message.send'] }));

    const outcome = await runTurn();

    expect(outcome.status).toBe('blocked');
    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('blocked');
    expect(execution?.spendUnits).toBe(1);
  });

  it('makes the daily cap bite after the workspace has spent its budget', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 1 }));
    addExecution('exe_2');
    addExecution('exe_3');

    const first = await runTurn('exe_2');
    expect(first.status).toBe('committed');

    // The turn wrote its own cost, and the next turn is refused because of
    // it. No spend is written by hand anywhere in this case.
    const recorded = handle.db.select().from(executions).where(eq(executions.id, 'exe_2')).get();
    expect(recorded?.spendUnits).toBe(1);

    const second = await runTurn('exe_3');
    expect(second.status).toBe('failed');
    expect(second.error).toContain('daily spend limit of 1');
  });

  it('records the cost of a factory task turn', async () => {
    seedTask();
    addExecution('exe_task', { taskId: 'tsk_1' });

    const outcome = await runTask();

    expect(outcome.status).toBe('completed');

    // The task's turn cost one unit, and it is recorded on the task's own
    // execution and nowhere else.
    const taskExecution = handle.db
      .select()
      .from(executions)
      .where(eq(executions.id, 'exe_task'))
      .get();
    expect(taskExecution?.spendUnits).toBe(1);
    expect(taskExecution?.status).toBe('completed');
    expect(taskExecution?.taskId).toBe('tsk_1');

    const conversationExecution = handle.db
      .select()
      .from(executions)
      .where(eq(executions.id, 'exe_1'))
      .get();
    expect(conversationExecution?.spendUnits).toBe(0);
  });

  it('records the cost of an automation run on an execution of its own', async () => {
    seedAutomation();

    const outcome = await runAutomation();

    expect(outcome.status).toBe('completed');

    // The run's agent turn is an execution like any other: it belongs to no
    // conversation and to no task, and it carries what the turn cost.
    const rows = handle.db.select().from(executions).all();
    const run = rows.find((row) => row.conversationId === null && row.taskId === null);
    expect(run?.spendUnits).toBe(1);
    expect(run?.status).toBe('completed');
    expect(run?.agentConnectionId).toBe('agt_1');

    const runs = handle.db.select().from(automationRuns).all();
    expect(runs[0]?.status).toBe('completed');
  });

  it('counts an automation run against the workspace daily cap', async () => {
    setWorkspacePolicy(policy({ dailySpendUnits: 1 }));
    seedAutomation();

    const run = await runAutomation();
    expect(run.status).toBe('completed');

    // The run spent the workspace's budget, so the next turn is refused
    // because of what the automation did.
    addExecution('exe_2');
    const turn = await runTurn('exe_2');
    expect(turn.status).toBe('failed');
    expect(turn.error).toContain('daily spend limit of 1');
  });
});
