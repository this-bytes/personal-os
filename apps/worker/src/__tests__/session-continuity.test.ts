import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  conversationSessions,
  conversations,
  createDatabase,
  executionEvents,
  executions,
  messages,
  participants,
  runMigrations,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  computeHistoryRevision,
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
  AgentExecutionStatus,
  AgentTurnInput,
  ContentPart,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * Session continuity, from the worker's side.
 *
 * A conversation holds a durable reference to the runtime session behind it.
 * A runtime that keeps sessions continues the same one on the next turn, and
 * the transcript names the session the answer came out of. A runtime that
 * keeps none says so, and the product does not claim a continuity that does
 * not exist.
 */

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: true,
  backgroundTasks: false,
  cancel: true,
  approvals: false,
  artifacts: false,
  acceptsSteering: false,
};

const NOW = '2026-01-01T00:00:00.000Z';

/**
 * A runtime that keeps a session.
 *
 * It reports the session it is in, and it can be put back into one — which is
 * what "the next turn continues the same session" means from the outside.
 */
class SessionAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  /** The session each execution ran in. */
  readonly sessions = new Map<string, string>();
  /** The sessions this adapter was put back into. */
  readonly resumed: string[] = [];
  /** The external session id each turn was given. */
  readonly offered: Array<string | undefined> = [];
  /** Whether the turn fails. */
  fails = false;
  private counter = 0;

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    const sessionId = this.sessions.get(executionId);
    return {
      executionId,
      status: 'completed',
      ...(sessionId ? { externalRef: sessionId } : {}),
    };
  }

  /** The session is restored by being named. */
  async resumeSession(_connection: AgentConnection, sessionId: string): Promise<string> {
    this.resumed.push(sessionId);
    return sessionId;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.offered.push(input.externalSessionId);
    const sessionId = input.externalSessionId ?? `sess_${++this.counter}`;
    this.sessions.set(input.executionId, sessionId);
    if (this.fails) {
      yield {
        type: 'execution.error',
        executionId: input.executionId,
        code: 'runtime_failed',
        message: 'The runtime gave up.',
      };
      yield { type: 'execution.status', executionId: input.executionId, status: 'failed' };
      return;
    }
    yield { type: 'message.delta', executionId: input.executionId, text: 'Done.' };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: SessionAdapter;

/** Seed a room with one agent whose capabilities say what it can do. */
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
      capabilitiesRevision: 3,
      status: 'connected',
      lastError: null,
      lastConnectedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** The owner's message that asks for a turn. */
function ownerMessage(id: string, text: string, createdAt: string): void {
  handle.db
    .insert(messages)
    .values({
      id,
      conversationId: 'cnv_1',
      senderId: 'p_owner',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text }],
      status: 'complete',
      correlationId: `corr_${id}`,
      origin: { kind: 'human', actorId: 'p_owner', depth: 0 },
      executionId: null,
      delivery: 'queue',
      consumedAt: null,
      createdAt,
    })
    .run();
}

/** The execution row a turn runs against. */
function executionRow(id: string, createdAt: string): void {
  handle.db
    .insert(executions)
    .values({
      id,
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      committedRevision: null,
      idempotencyKey: `dsp:cnv_1:msg_${id}:agt_1`,
      correlationId: `corr_msg_${id}`,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt,
    })
    .run();
}

/** The turn, as the worker picks it up. */
function theTurn(executionId: string, parentMessageId: string): QueueJob {
  return {
    id: `job_${executionId}`,
    workspaceId: 'wsp_1',
    type: 'chat.turn',
    payload: {
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_1',
      executionId,
      parentMessageId,
      correlationId: `corr_${parentMessageId}`,
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

/** The reply the agent left in the room. */
function agentReplies(): { id: string; content: ContentPart[]; origin: unknown }[] {
  return handle.db
    .select({
      id: messages.id,
      content: messages.content,
      origin: messages.origin,
    })
    .from(messages)
    .where(eq(messages.senderId, 'p_agent'))
    .all()
    .map((row) => ({ ...row, content: row.content as ContentPart[] }));
}

/** The terminal events the log holds for a turn. */
function terminalEvents(executionId: string): string[] {
  return handle.db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.executionId, executionId))
    .all()
    .map((row) => row.payload as { event?: { type: string; status?: string } })
    .filter((payload) => payload.event?.type === 'execution.status')
    .map((payload) => payload.event?.status ?? '');
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

  adapter = new SessionAdapter();
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
  ownerMessage('msg_1', 'Do the work.', NOW);
  executionRow('exe_1', NOW);
});

afterEach(() => {
  handle.close();
});

describe('the session reference a conversation holds', () => {
  it('names the session the turn ran in, and the transcript names it too', async () => {
    await executeJob(context, theTurn('exe_1', 'msg_1'));

    const reference = handle.db.select().from(conversationSessions).all();
    expect(reference).toHaveLength(1);
    expect(reference[0]?.sessionId).toBe('sess_1');
    expect(reference[0]?.conversationId).toBe('cnv_1');
    expect(reference[0]?.agentConnectionId).toBe('agt_1');
    // The runtime said it keeps sessions, so the reference says the next turn
    // may continue this one.
    expect(reference[0]?.continuity).toBe('resumable');

    // The transcript names the session: a reply that came out of session
    // sess_1 says so.
    const replies = agentReplies();
    expect(replies).toHaveLength(1);
    expect((replies[0]?.origin as { sessionId?: string } | null)?.sessionId).toBe('sess_1');
  });

  it('continues the same session on the next turn in the conversation', async () => {
    await executeJob(context, theTurn('exe_1', 'msg_1'));

    ownerMessage('msg_2', 'More, please.', '2026-01-01T00:01:00.000Z');
    executionRow('exe_2', '2026-01-01T00:01:00.000Z');

    await executeJob(context, theTurn('exe_2', 'msg_2'));

    // The second turn was put back into the session the first one used.
    expect(adapter.resumed).toEqual(['sess_1']);
    expect(adapter.offered[1]).toBe('sess_1');
    // And the reference still names one session, not two.
    const reference = handle.db.select().from(conversationSessions).all();
    expect(reference).toHaveLength(1);
    expect(reference[0]?.sessionId).toBe('sess_1');
  });

  it('says so, and claims nothing, on a runtime that keeps no session', async () => {
    // The runtime reported that it does not keep sessions. The capability row
    // records the limit, and the reference follows it.
    handle.db
      .update(agentConnections)
      .set({ capabilities: { ...CAPABILITIES, persistentSessions: false } })
      .where(eq(agentConnections.id, 'agt_1'))
      .run();

    await executeJob(context, theTurn('exe_1', 'msg_1'));

    const reference = handle.db.select().from(conversationSessions).all();
    expect(reference).toHaveLength(1);
    expect(reference[0]?.continuity).toBe('fresh');

    ownerMessage('msg_2', 'More, please.', '2026-01-01T00:01:00.000Z');
    executionRow('exe_2', '2026-01-01T00:01:00.000Z');

    await executeJob(context, theTurn('exe_2', 'msg_2'));

    // The second turn was not put back into anything, and nothing claimed it
    // was.
    expect(adapter.resumed).toEqual([]);
    expect(adapter.offered[1]).toBeUndefined();
  });

  it('claims no continuity on a runtime nobody has probed', async () => {
    // A connection that was never probed has no capabilities to read, so the
    // product does not claim a session it cannot see.
    handle.db
      .update(agentConnections)
      .set({ capabilities: null })
      .where(eq(agentConnections.id, 'agt_1'))
      .run();

    await executeJob(context, theTurn('exe_1', 'msg_1'));

    const reference = handle.db.select().from(conversationSessions).all();
    expect(reference).toHaveLength(1);
    expect(reference[0]?.continuity).toBe('fresh');
  });
});

describe('the commit a chat turn makes', () => {
  it('writes the revision of the history it committed to', async () => {
    await executeJob(context, theTurn('exe_1', 'msg_1'));

    const row = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();

    // The output is in canonical history, so the turn is committed and the
    // revision is the one the commit produced.
    expect(row?.status).toBe('committed');
    expect(row?.committedRevision).toBeTruthy();

    // The revision is the one the product would compute by reading the
    // history back — a revision the product never wrote would not match.
    const history = handle.db
      .select({
        id: messages.id,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        status: messages.status,
        correlationId: messages.correlationId,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.conversationId, 'cnv_1'))
      .all()
      .map((entry) => ({ ...entry, content: entry.content as ContentPart[] }));

    const reply = agentReplies()[0];
    expect(reply).toBeDefined();
    expect(computeHistoryRevision(history, reply!.id)).toBe(row?.committedRevision);
  });

  it('ends the turn with exactly one event', async () => {
    await executeJob(context, theTurn('exe_1', 'msg_1'));

    // The adapter said the turn completed, and the owner published the turn's
    // own ending. One turn, one ending: a log with two endings is a log a
    // reader cannot settle.
    expect(terminalEvents('exe_1')).toEqual(['committed']);
  });

  it('records no revision on a turn whose output is not canonical', async () => {
    // A turn that failed produced no output to commit, so the product claims
    // no revision for it: a revision nobody wrote would be a lie.
    adapter.fails = true;

    await executeJob(context, theTurn('exe_1', 'msg_1'));

    const row = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(row?.status).toBe('failed');
    expect(row?.committedRevision).toBeNull();
  });
});
