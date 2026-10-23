import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  conversations,
  createDatabase,
  delegatedTasks,
  executions,
  messages,
  participants,
  queueJobs,
  runMigrations,
  tasks,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  createBotsService,
  createConversationsService,
  createFactoryService,
  EventsService,
  loadConfig,
  Queue,
  type QueueJob,
  type Runtime,
} from '@personal-os/server/runtime';
import { defaultAgentToolGrants } from '@personal-os/contracts';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The delegated work, end to end.
 *
 * A coordinator hands a piece of work to another agent. The worker runs it.
 * The answer comes back to the room that asked for it, addressed to the
 * coordinator alone, and the handoff is closed with what came back.
 */

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: false,
  backgroundTasks: false,
  cancel: true,
  approvals: false,
  artifacts: false,
};

const NOW = '2026-01-01T00:00:00.000Z';

/** An agent that answers the question it was asked. */
class AnsweringAdapter implements AgentAdapter {
  readonly type = 'echo' as const;

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const answer = input.message.includes('Find the answer')
      ? 'The answer is 42.'
      : 'The coordinator has the answer.';
    yield { type: 'message.delta', executionId: input.executionId, text: answer };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;

function seed(): void {
  const db = handle.db;

  db.insert(conversations)
    .values({
      id: 'cnv_parent',
      workspaceId: 'wsp_1',
      title: 'A team room',
      routingMode: 'coordinator',
      coordinatorId: 'p_cto',
      paused: false,
      maxTurns: 8,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(participants)
    .values([
      {
        id: 'p_owner',
        conversationId: 'cnv_parent',
        type: 'human',
        agentConnectionId: null,
        displayName: 'Owner',
        personaOverride: null,
        joinedAt: NOW,
      },
      {
        id: 'p_cto',
        conversationId: 'cnv_parent',
        type: 'agent',
        agentConnectionId: 'agt_coordinator',
        displayName: 'Hermes CTO',
        personaOverride: null,
        joinedAt: NOW,
      },
      {
        id: 'p_worker',
        conversationId: 'cnv_parent',
        type: 'agent',
        agentConnectionId: 'agt_worker',
        displayName: 'Scout',
        personaOverride: null,
        joinedAt: NOW,
      },
    ])
    .run();

  db.insert(agentConnections)
    .values([
      {
        id: 'agt_coordinator',
        workspaceId: 'wsp_1',
        name: 'Hermes CTO',
        adapterType: 'echo',
        configRef: 'cfg_1',
        toolGrants: null,
        persona: null,
        enabled: true,
        capabilities: CAPABILITIES,
        status: 'unknown',
        lastError: null,
        lastConnectedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'agt_worker',
        workspaceId: 'wsp_1',
        name: 'Scout',
        adapterType: 'echo',
        configRef: 'cfg_2',
        toolGrants: null,
        persona: null,
        enabled: true,
        capabilities: CAPABILITIES,
        status: 'unknown',
        lastError: null,
        lastConnectedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
    .run();
}

/** The payload of a queued job, read out of its JSON column. */
function payloadOf(job: { payload: unknown }): Record<string, unknown> {
  return (job.payload ?? {}) as Record<string, unknown>;
}

/** The queued turn for one execution, as the worker would pick it up. */
function queuedTurn(executionId: string): QueueJob | undefined {
  const row = handle.db
    .select()
    .from(queueJobs)
    .where(eq(queueJobs.type, 'chat.turn'))
    .all()
    .find((job) => payloadOf(job)['executionId'] === executionId);
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as QueueJob['type'],
    payload: payloadOf(row),
    status: 'running',
    attempts: 1,
    maxAttempts: 3,
    priority: row.priority,
    runAt: row.runAt,
    lockedAt: NOW,
    lockedBy: 'worker_1',
    lastError: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
      JSON.stringify({ adapterType: 'echo', config: { reply: 'Understood.' } }),
    close: () => handle.close(),
  };
  context = { runtime };
  seed();
});

afterEach(() => {
  handle.close();
});

describe('a delegated turn', () => {
  it('runs, and its answer comes back to the room that asked', async () => {
    const db = handle.db;
    const events = runtime.events;
    const queue = runtime.queue;
    const audit = runtime.audit;

    const conversations = createConversationsService({ db, events, queue, audit });
    const factory = createFactoryService({ db, events, queue, audit });
    const connection = (id: string) =>
      db.select().from(agentConnections).where(eq(agentConnections.id, id)).get();
    const bots = createBotsService({
      db,
      events,
      queue,
      audit,
      factory,
      conversations,
      agentToolGrants: (id) => connection(id)?.toolGrants ?? defaultAgentToolGrants,
      agentConnection: (id) => {
        const row = connection(id);
        return row ? { id: row.id, workspaceId: row.workspaceId, enabled: row.enabled } : undefined;
      },
      agentDisplayName: (id) => connection(id)?.name ?? id,
    });

    // The team: a coordinator that may hand work to one agent, and that agent.
    bots.register({
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_coordinator',
      role: 'coordinator',
      scope: { mayDispatch: true, dispatchableAgentConnectionIds: ['agt_worker'] },
    });
    bots.register({
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_worker',
      role: 'worker',
    });

    // The owner speaks, so the coordinator has a turn to delegate from.
    await conversations.postMessage('cnv_parent', {
      content: [{ type: 'text', text: 'Please sort this out.' }],
    });

    const handed = bots.dispatch({
      coordinatorAgentConnectionId: 'agt_coordinator',
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_worker',
      instruction: 'Find the answer to the question.',
    });

    // The work runs in its own room, and that room is not the parent's room.
    expect(handed.delegatedTask.childConversationId).not.toBe('cnv_parent');
    expect(handed.delegatedTask.status).toBe('queued');
    expect(handed.delegatedTask.deliveredAt).toBeUndefined();

    // The delegated turn is queued like any other turn.
    const childTurn = queuedTurn(handed.childTurnId!);
    expect(childTurn).toBeDefined();

    const outcome = await executeJob(context, childTurn!);
    // The delegated answer went into the room's canonical history, so the
    // turn is committed rather than merely completed.
    expect(outcome.status).toBe('committed');

    // The answer came back to the room that asked, addressed to the
    // coordinator alone.
    const delivered = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, 'cnv_parent'))
      .all()
      .filter((message) => message.origin?.kind === 'agent');

    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.content).toEqual([{ type: 'text', text: 'The answer is 42.' }]);
    expect(delivered[0]?.senderId).toBe('p_worker');
    expect(delivered[0]?.targetParticipantIds).toEqual(['p_cto']);

    // The handoff is closed with what came back, and it has been delivered —
    // but not consumed: nothing has read it yet.
    const closed = db
      .select()
      .from(delegatedTasks)
      .where(eq(delegatedTasks.id, handed.delegatedTask.id))
      .get();
    expect(closed?.status).toBe('succeeded');
    expect(closed?.result).toBe('The answer is 42.');
    expect(closed?.deliveredAt).toBeTruthy();
    expect(closed?.consumedAt).toBeNull();

    // The work is tracked, and it waits for the owner: an agent reporting
    // completion is not acceptance.
    const task = db.select().from(tasks).where(eq(tasks.id, handed.taskId!)).get();
    expect(task?.status).toBe('review');

    // The coordinator was woken, and only the coordinator.
    const deliveryMessageId = delivered[0]!.id;
    const wokenJob = db
      .select()
      .from(queueJobs)
      .where(eq(queueJobs.type, 'chat.turn'))
      .all()
      .find((job) => payloadOf(job)['parentMessageId'] === deliveryMessageId);
    expect(payloadOf(wokenJob!)['agentConnectionId']).toBe('agt_coordinator');

    const woken = queuedTurn(payloadOf(wokenJob!)['executionId'] as string);
    expect(woken).toBeDefined();

    await executeJob(context, woken!);

    // The coordinator reads the answer and its turn ends completed: now the
    // result is consumed.
    const consumed = db
      .select()
      .from(delegatedTasks)
      .where(eq(delegatedTasks.id, handed.delegatedTask.id))
      .get();
    expect(consumed?.consumedAt).toBeTruthy();
  });

  it('leaves a result unconsumed when the turn that read it failed', async () => {
    const db = handle.db;
    const events = runtime.events;
    const queue = runtime.queue;
    const audit = runtime.audit;

    const conversations = createConversationsService({ db, events, queue, audit });
    const factory = createFactoryService({ db, events, queue, audit });
    const bots = createBotsService({
      db,
      events,
      queue,
      audit,
      factory,
      conversations,
      agentToolGrants: () => defaultAgentToolGrants,
      agentConnection: (id) => ({ id, workspaceId: 'wsp_1', enabled: true }),
      agentDisplayName: (id) => id,
    });

    bots.register({
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_coordinator',
      role: 'coordinator',
      scope: { mayDispatch: true, dispatchableAgentConnectionIds: ['agt_worker'] },
    });
    bots.register({
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_worker',
      role: 'worker',
    });

    await conversations.postMessage('cnv_parent', {
      content: [{ type: 'text', text: 'Please sort this out.' }],
    });

    const handed = bots.dispatch({
      coordinatorAgentConnectionId: 'agt_coordinator',
      conversationId: 'cnv_parent',
      agentConnectionId: 'agt_worker',
      instruction: 'Find the answer to the question.',
    });

    // The worker's turn ends without an answer.
    const childTurn = queuedTurn(handed.childTurnId!);
    expect(childTurn).toBeDefined();

    await executeJob(context, childTurn!);

    const settled = db
      .select()
      .from(delegatedTasks)
      .where(eq(delegatedTasks.id, handed.delegatedTask.id))
      .get();

    // The delivery happened. The consumption did not: nothing read it.
    expect(settled?.deliveredAt).toBeTruthy();
    expect(settled?.consumedAt).toBeNull();
  });
});
