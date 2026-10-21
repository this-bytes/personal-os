import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  approvals,
  auditLog,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  runMigrations,
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

function job(payload: Record<string, unknown>): Parameters<typeof executeJob>[1] {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type: 'chat.turn',
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

function runTurn(): ReturnType<typeof executeJob> {
  return executeJob(
    context,
    job({
      conversationId: 'cnv_1',
      parentMessageId: 'msg_parent',
      agentConnectionId: 'agt_1',
      executionId: 'exe_1',
      correlationId: 'cor_1',
      depth: 1,
    }),
  );
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

    expect(outcome.status).toBe('completed');
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
