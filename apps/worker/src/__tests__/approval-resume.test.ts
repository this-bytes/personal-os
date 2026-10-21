import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  runMigrations,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  EventsService,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentExecutionStatus,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * Deciding an approval resumes the turn when the adapter can.
 *
 * A turn that raises an approval is not over: it is suspended. The execution
 * stays blocked, the reply stays unfinished, and the session the agent was in
 * is kept so the decision can continue it.
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

/** An agent that asks for permission, and can be continued afterwards. */
class ApprovingAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  readonly turns: AgentTurnInput[] = [];

  constructor(private readonly sessionId: string | undefined) {}

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.turns.push(input);

    if (input.externalSessionId) {
      yield {
        type: 'message.delta',
        executionId: input.executionId,
        text: ' And the work is done.',
      };
      yield {
        type: 'message.completed',
        executionId: input.executionId,
        text: 'The work is done.',
      };
      yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
      return;
    }

    // The agent answers, and then it needs the owner's decision. The turn
    // stops here.
    yield {
      type: 'message.delta',
      executionId: input.executionId,
      text: 'May I delete the production database?',
    };
    yield {
      type: 'approval.requested',
      executionId: input.executionId,
      approvalId: 'apr_1',
      summary: 'Delete the production database',
    };
  }

  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return {
      executionId,
      status: 'blocked',
      ...(this.sessionId ? { externalRef: this.sessionId } : {}),
    };
  }

  async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
    return externalSessionId;
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: ApprovingAdapter;

const NOW = '2026-01-01T00:00:00.000Z';

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

beforeEach(() => {
  handle = createDatabase(':memory:');
  runMigrations(handle.db);

  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: '.',
    PERSONAL_OS_OWNER_TOKEN: 'worker-test-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);

  adapter = new ApprovingAdapter('sess_1');

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    resolveSecret: async () =>
      JSON.stringify({ adapterType: 'echo', config: { timeoutSeconds: 30 } }),
    close: () => handle.close(),
  };

  context = {
    runtime,
    registry: { create: () => adapter } as unknown as ExecutorContext['registry'],
  };
  seed();
});

afterEach(() => {
  handle.close();
});

describe('a turn that is waiting for a decision', () => {
  it('is suspended, not finished', async () => {
    const outcome = await executeJob(
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

    expect(outcome.status).toBe('blocked');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();

    // It is not finished: the execution is still waiting, and the reply is
    // still unfinished.
    expect(execution?.status).toBe('blocked');
    expect(execution?.finishedAt).toBeNull();

    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status).toBe('streaming');
  });

  it('keeps the session it was in, so a decision can continue it', async () => {
    await executeJob(
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

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();

    expect(execution?.externalRef).toBe('sess_1');
  });

  it('continues in the same session, with the decision as the next input', async () => {
    await executeJob(
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

    const outcome = await executeJob(
      context,
      job({
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
        resume: {
          decision: 'The owner approved this operation. Continue.',
          externalSessionId: 'sess_1',
        },
      }),
    );

    expect(outcome.status).toBe('completed');

    const resumed = adapter.turns[1];
    expect(resumed?.externalSessionId).toBe('sess_1');
    expect(resumed?.message).toContain('The owner approved this operation');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('completed');
    expect(execution?.finishedAt).not.toBeNull();

    // The reply is the same reply: one turn, one message, and what came
    // before the decision is still in it.
    const replies = handle.db
      .select()
      .from(messages)
      .where(eq(messages.executionId, 'exe_1'))
      .all();
    expect(replies).toHaveLength(1);
    expect(replies[0]?.status).toBe('complete');
    const content = (replies[0]?.content as Array<{ text?: string }> | undefined) ?? [];
    const text = content.map((part) => part.text ?? '').join('');
    expect(text).toContain('May I delete the production database?');
    expect(text).toContain('And the work is done.');
  });
});
