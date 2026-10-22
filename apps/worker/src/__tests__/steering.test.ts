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
  type QueueJob,
  type Runtime,
} from '@personal-os/server/runtime';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * Steering, from the worker's side.
 *
 * A steer is a message the owner sends while a turn is running, and it
 * arrives in the middle of that turn. The worker is the only thing that can
 * put it there, so the turn has to read it, take it, and say that it took it.
 */

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: false,
  backgroundTasks: false,
  cancel: true,
  approvals: false,
  artifacts: false,
  acceptsSteering: true,
};

const NOW = '2026-01-01T00:00:00.000Z';

/**
 * An agent that waits for the owner's steer.
 *
 * It reports what it was given: whether there was a channel at all, and what
 * came down it.
 */
class SteerableAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  /** Whether the turn was given a channel to read steers from. */
  hadChannel: boolean | null = null;
  /** What came down the channel. */
  readonly seen: string[] = [];

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.hadChannel = input.steer !== undefined;

    if (input.steer) {
      const iterator = input.steer[Symbol.asyncIterator]();
      const next = await Promise.race([
        iterator.next(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
      ]);
      if (next && !next.done) this.seen.push(next.value);
    }

    yield { type: 'message.delta', executionId: input.executionId, text: 'The work is done.' };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: SteerableAdapter;

/** Seed a room with one agent and a turn waiting to run. */
function seed(capabilities: AgentCapabilities | null = CAPABILITIES): void {
  const db = handle.db;

  db.insert(conversations)
    .values({
      id: 'cnv_1',
      workspaceId: 'wsp_1',
      title: 'A room',
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

  db.insert(participants)
    .values([
      {
        id: 'p_owner',
        conversationId: 'cnv_1',
        type: 'human',
        agentConnectionId: null,
        displayName: 'Owner',
        personaOverride: null,
        joinedAt: NOW,
      },
      {
        id: 'p_agent',
        conversationId: 'cnv_1',
        type: 'agent',
        agentConnectionId: 'agt_1',
        displayName: 'Wren',
        personaOverride: null,
        joinedAt: NOW,
      },
    ])
    .run();

  db.insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'Wren',
      adapterType: 'echo',
      configRef: 'cfg_1',
      toolGrants: null,
      persona: null,
      enabled: true,
      capabilities,
      status: 'connected',
      lastError: null,
      lastConnectedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(messages)
    .values({
      id: 'msg_parent',
      conversationId: 'cnv_1',
      senderId: 'p_owner',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: 'Do the work.' }],
      status: 'complete',
      correlationId: 'corr_1',
      origin: { kind: 'human', actorId: 'p_owner', depth: 0 },
      executionId: null,
      delivery: 'queue',
      consumedAt: null,
      createdAt: NOW,
    })
    .run();

  db.insert(executions)
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

/** The turn, as the worker picks it up. */
function theTurn(): QueueJob {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type: 'chat.turn',
    payload: {
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_1',
      executionId: 'exe_1',
      parentMessageId: 'msg_parent',
      correlationId: 'corr_1',
      depth: 0,
    },
    status: 'running',
    attempts: 1,
    maxAttempts: 3,
    priority: 0,
    runAt: NOW,
    lockedAt: NOW,
    lockedBy: 'worker_1',
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** The owner sends a steer into the room. */
function writeSteer(id: string, createdAt: string): void {
  handle.db
    .insert(messages)
    .values({
      id,
      conversationId: 'cnv_1',
      senderId: 'p_owner',
      targetParticipantIds: ['p_agent'],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: 'Do it differently.' }],
      status: 'complete',
      correlationId: 'corr_1',
      origin: { kind: 'human', actorId: 'p_owner', depth: 0 },
      executionId: null,
      delivery: 'steer',
      consumedAt: null,
      createdAt,
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

  adapter = new SteerableAdapter();
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
      JSON.stringify({ adapterType: 'echo', config: { reply: 'Understood.' } }),
    close: () => handle.close(),
  };
  context = { runtime };
  seed();
});

afterEach(() => {
  handle.close();
});

describe('a steer, from the worker', () => {
  it('reaches the turn that is running, and the turn says it took it', async () => {
    const running = executeJob(context, theTurn());

    // The owner steers while the turn is running.
    await new Promise((resolve) => setTimeout(resolve, 50));
    writeSteer('msg_steer', new Date().toISOString());

    const outcome = await running;
    expect(outcome.status).toBe('completed');

    // The turn read the steer.
    expect(adapter.hadChannel).toBe(true);
    expect(adapter.seen).toEqual(['Do it differently.']);

    // And the message says the turn took it, so nobody waits for a steer
    // that has already been used.
    const row = handle.db.select().from(messages).where(eq(messages.id, 'msg_steer')).get();
    expect(row?.consumedAt).not.toBeNull();
    expect(row?.detail).toContain('took this steer');
  });

  it('is delivered late when the turn that was running never took it', async () => {
    // A steer that arrived before this turn, and that no turn took.
    writeSteer('msg_late', NOW);

    const outcome = await executeJob(context, theTurn());
    expect(outcome.status).toBe('completed');

    const row = handle.db.select().from(messages).where(eq(messages.id, 'msg_late')).get();
    expect(row?.consumedAt).not.toBeNull();
    expect(row?.detail).toContain('Delivered late');
  });

  it('is not offered to a connection that cannot take input', async () => {
    handle.db
      .update(agentConnections)
      .set({ capabilities: { ...CAPABILITIES, acceptsSteering: false } })
      .where(eq(agentConnections.id, 'agt_1'))
      .run();

    const running = executeJob(context, theTurn());
    await new Promise((resolve) => setTimeout(resolve, 50));
    writeSteer('msg_steer', new Date().toISOString());

    await running;

    // No channel: a connection that does not report the capability is never
    // sent one.
    expect(adapter.hadChannel).toBe(false);
    expect(adapter.seen).toEqual([]);
  });
});
