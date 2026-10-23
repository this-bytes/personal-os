import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  agentConnections,
  conversations,
  conversationSessions,
  executionEvents,
  executions,
  messages,
  participants,
} from '../db/schema.js';
import type { DatabaseHandle } from '../db/client.js';
import { createConversationsService } from '../modules/conversations/service.js';
import { planAndDispatch } from '../modules/conversations/dispatch.js';
import { recordSessionReference } from '../modules/conversations/session-refs.js';
import { createAuditService } from '../modules/audit/service.js';
import { EventsService } from '../modules/events/service.js';
import { Queue } from '../queue/client.js';
import { createTestDatabase } from './helpers.js';
import type { Message, Participant } from '@personal-os/contracts';
import { dispatchIdempotencyKey } from '@personal-os/contracts';

/**
 * Session references, correlation and idempotency, from the server's side.
 *
 * A dispatch has an identity: the message, the conversation and the agent it
 * went to. A dispatch that repeats with the same identity is the same
 * dispatch, so it does not start a second run — one run, one set of events.
 *
 * The conversation publishes the session references it holds, so a client can
 * read which runtime session it is talking to.
 */

const NOW = new Date().toISOString();

let handle: DatabaseHandle;
let db: DatabaseHandle['db'];
let events: EventsService;
let queue: Queue;
let audit: ReturnType<typeof createAuditService>;

const PARTICIPANTS: Participant[] = [
  { id: 'p_human', conversationId: 'cnv_1', type: 'human', displayName: 'Owner' },
  {
    id: 'p_codex',
    conversationId: 'cnv_1',
    type: 'agent',
    agentConnectionId: 'agt_codex',
    displayName: 'Codex',
  },
];

const MESSAGE: Message = {
  id: 'msg_1',
  conversationId: 'cnv_1',
  senderId: 'p_human',
  targetParticipantIds: [],
  kind: 'text',
  content: [{ type: 'text', text: '@Codex do the work' }],
  status: 'complete',
  correlationId: 'corr_1',
  origin: { kind: 'human', actorId: 'p_human', depth: 0 },
  createdAt: NOW,
};

beforeEach(() => {
  handle = createTestDatabase();
  db = handle.db;
  events = new EventsService(db);
  queue = new Queue(db);
  audit = createAuditService(db);

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
    .values(
      PARTICIPANTS.map((participant) => ({
        id: participant.id,
        conversationId: 'cnv_1',
        type: participant.type,
        agentConnectionId: participant.agentConnectionId ?? null,
        displayName: participant.displayName,
        personaOverride: null,
        joinedAt: NOW,
      })),
    )
    .run();

  db.insert(agentConnections)
    .values({
      id: 'agt_codex',
      workspaceId: 'wsp_1',
      name: 'Codex',
      adapterType: 'echo',
      configRef: 'cfg_1',
      toolGrants: null,
      persona: null,
      enabled: true,
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: true,
        backgroundTasks: false,
        cancel: true,
        approvals: false,
        artifacts: false,
      },
      capabilitiesRevision: 4,
      status: 'connected',
      lastError: null,
      lastConnectedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(messages)
    .values({
      id: 'msg_1',
      conversationId: 'cnv_1',
      senderId: 'p_human',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: '@Codex do the work' }],
      status: 'complete',
      correlationId: 'corr_1',
      origin: { kind: 'human', actorId: 'p_human', depth: 0 },
      executionId: null,
      delivery: 'queue',
      consumedAt: null,
      createdAt: NOW,
    })
    .run();
});

afterEach(() => {
  handle.close();
});

function dispatch(): ReturnType<typeof planAndDispatch> {
  return planAndDispatch({
    db,
    events,
    queue,
    audit,
    conversationId: 'cnv_1',
    message: MESSAGE,
    participants: PARTICIPANTS,
    correlationId: 'corr_1',
    depth: 0,
  });
}

describe('a dispatch that repeats', () => {
  it('starts one run and one set of events', () => {
    const first = dispatch();
    expect(first.dispatches).toHaveLength(1);

    const second = dispatch();

    // The second dispatch found the run the first one started.
    expect(second.dispatches).toHaveLength(0);

    const runs = db.select().from(executions).all();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe(first.dispatches[0]?.executionId);
    // And the run carries the correlation id, so one turn can be followed
    // through the log.
    expect(runs[0]?.correlationId).toBe('corr_1');
    expect(runs[0]?.idempotencyKey).toBeTruthy();

    // One set of events: the admission was published once.
    const admission = db
      .select()
      .from(executionEvents)
      .where(eq(executionEvents.executionId, first.dispatches[0]!.executionId))
      .all();
    expect(admission).toHaveLength(1);
  });

  it('does not start a second run when another writer wins the race', () => {
    // Two dispatches of the same message can arrive together: both look for
    // the run, both find none, and both try to start one. The unique key on
    // the idempotency key is the arbiter, and the loser has to notice it
    // rather than fail the turn.
    //
    // A trigger stands in for the other writer: it puts the row in the table
    // between the lookup and the insert, which is exactly the window the race
    // lives in.
    const key = dispatchIdempotencyKey({
      conversationId: 'cnv_1',
      parentMessageId: 'msg_1',
      agentConnectionId: 'agt_codex',
    });
    // A trigger cannot take a bound variable, so the key is written into the
    // statement. It is a test constant that holds no quote.
    db.run(
      sql.raw(`CREATE TRIGGER racing_dispatch BEFORE INSERT ON executions
      WHEN NEW.idempotency_key = '${key}'
      BEGIN
        INSERT INTO executions
          (id, workspace_id, execution_owner, status, spend_units, created_at, idempotency_key)
        VALUES ('exe_racer', 'wsp_1', 'personal-os', 'queued', 0, '${NOW}', '${key}');
      END`),
    );

    const result = dispatch();

    // The dispatch did not throw and it did not start a run. Before the
    // loser was taught to notice, the unique key surfaced as an error and the
    // turn failed. The row the trigger wrote is rolled back with the insert
    // that lost, because both are one statement; a real race has the
    // winner's row in another transaction, committed already.
    expect(result.dispatches).toHaveLength(0);
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it('does not confuse two agents in one room', () => {
    const first = dispatch();
    expect(first.dispatches).toHaveLength(1);

    // The same message, the same conversation, another agent: another dispatch.
    const other = planAndDispatch({
      db,
      events,
      queue,
      audit,
      conversationId: 'cnv_1',
      message: MESSAGE,
      participants: [
        ...PARTICIPANTS,
        {
          id: 'p_hermes',
          conversationId: 'cnv_1',
          type: 'agent',
          agentConnectionId: 'agt_hermes',
          displayName: 'Hermes',
        },
      ],
      correlationId: 'corr_1',
      depth: 0,
      explicitTargets: ['agt_hermes'],
    });

    expect(other.dispatches).toHaveLength(1);
    expect(other.dispatches[0]?.executionId).not.toBe(first.dispatches[0]?.executionId);
  });
});

describe('the session references a conversation publishes', () => {
  it('publishes the session the conversation is in', () => {
    recordSessionReference(db, {
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_codex',
      sessionId: 'sess_7f3a',
      capabilities: { persistentSessions: true },
      capabilitiesRevision: 4,
    });

    const service = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (id) => id,
    });

    const conversation = service.get('cnv_1');
    expect(conversation.sessionRefs).toHaveLength(1);
    expect(conversation.sessionRefs[0]?.sessionId).toBe('sess_7f3a');
    expect(conversation.sessionRefs[0]?.continuity).toBe('resumable');
    expect(conversation.sessionRefs[0]?.agentConnectionId).toBe('agt_codex');
  });

  it('publishes a runtime that keeps no session as one that keeps none', () => {
    recordSessionReference(db, {
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_codex',
      sessionId: 'sess_7f3a',
      capabilities: { persistentSessions: false },
      capabilitiesRevision: 4,
    });

    const service = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (id) => id,
    });

    const conversation = service.get('cnv_1');
    expect(conversation.sessionRefs[0]?.continuity).toBe('fresh');
  });

  it('publishes none when the connection behind the session is gone', () => {
    recordSessionReference(db, {
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_codex',
      sessionId: 'sess_7f3a',
      capabilities: { persistentSessions: true },
      capabilitiesRevision: 4,
    });

    // The connection is removed. The reference names a session nobody can go
    // back into, so the room stops publishing it.
    db.delete(agentConnections).where(eq(agentConnections.id, 'agt_codex')).run();

    const service = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (id) => id,
    });

    expect(service.get('cnv_1').sessionRefs).toEqual([]);
    // The row is still there: the reference is history, and the read model
    // does not publish one that names nothing.
    expect(db.select().from(conversationSessions).all()).toHaveLength(1);
  });

  it('publishes none when the conversation holds none', () => {
    const service = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (id) => id,
    });

    expect(service.get('cnv_1').sessionRefs).toEqual([]);
    expect(db.select().from(conversationSessions).all()).toHaveLength(0);
  });
});
