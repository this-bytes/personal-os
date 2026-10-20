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
import type { AgentAdapter, AgentEvent, AgentTurnInput } from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * A turn whose outcome could not be confirmed.
 *
 * The worker aborts a turn when the adapter's deadline passes. The agent may
 * already have had its side effect by then, so the turn is recorded as
 * `unknown` — not as `failed`, which reads as "safe to retry".
 */

/** An adapter that never answers, so the deadline is what ends the turn. */
class HangingAdapter implements AgentAdapter {
  readonly type = 'http' as const;

  async connect(): Promise<never> {
    throw new Error('not used');
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    // The turn is stopped by the deadline, and the adapter notices the
    // abort the way a real one would.
    await new Promise<void>((resolve) => {
      input.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    yield {
      type: 'execution.error',
      executionId: input.executionId,
      code: 'cancelled',
      message: 'The turn was stopped.',
    };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;

const NOW = '2026-01-01T00:00:00.000Z';

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
      adapterType: 'http',
      configRef: 'cfg_1',
      toolGrants: null,
      enabled: true,
      capabilities: null,
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
      correlationId: null,
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

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    registry: {
      create: () => new HangingAdapter(),
    } as unknown as Runtime['registry'],
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    // The adapter's deadline is one second, so the turn is stopped quickly.
    resolveSecret: async () =>
      JSON.stringify({
        adapterType: 'http',
        config: { baseUrl: 'https://example.invalid', timeoutSeconds: 1 },
      }),
    close: () => handle.close(),
  };

  context = { runtime };
  seed();
});

afterEach(() => {
  handle.close();
});

describe('a turn that ran out of time', () => {
  it('is recorded as unknown, not as failed', async () => {
    const outcome = await executeJob(context, {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
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
    });

    expect(outcome.status).toBe('unknown');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('unknown');
    expect(execution?.error).toMatch(/may already have had its side effect/i);

    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status).toBe('unknown');
  });

  it('is written to the audit trail', async () => {
    await executeJob(context, {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
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
    });

    const entries = runtime.audit.list('wsp_1', 50);
    const entry = entries.find((item) => item.targetId === 'exe_1');

    expect(entry).toBeDefined();
    expect(entry?.action).toBe('execution.outcome.unknown');
    expect(entry?.result).toBe('unknown');
  });

  it('is a failure when nothing started at all', async () => {
    // No agent connection: the turn never began, so the outcome is known.
    handle.db.delete(agentConnections).where(eq(agentConnections.id, 'agt_1')).run();

    const outcome = await executeJob(context, {
      id: 'job_2',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
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
    });

    expect(outcome.status).toBe('failed');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('failed');
  });
});
