import { and, eq } from 'drizzle-orm';
import {
  continuityForCapabilities,
  type SessionContinuity,
  type SessionReference,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { conversationSessions } from '../../db/schema.js';
import { newId } from '../../lib/ids.js';

/**
 * A conversation's durable reference to the runtime session behind it.
 *
 * The reference answers two questions the room asks: which session is this
 * conversation talking to, and can the next turn go back into it. The second
 * question has an honest answer for every runtime: `resumable` when the
 * runtime keeps a session to continue, `fresh` when it does not.
 *
 * The reference is per conversation and agent connection, because two agents
 * in one room keep two sessions and neither of them is the other's.
 */
export interface SessionReferenceInput {
  workspaceId: string;
  conversationId: string;
  agentConnectionId: string;
  /** The runtime's own name for the session. */
  sessionId: string;
  /**
   * What the runtime reported about itself when the session was established.
   *
   * Null when the connection had never been probed. A connection nobody
   * probed keeps no session to continue, so the reference says `fresh`.
   */
  capabilities?: { persistentSessions: boolean } | null;
  /** The revision of the connection's capability set, when it is known. */
  capabilitiesRevision?: number | null;
}

/**
 * Read one conversation's reference to an agent's session.
 */
export function readSessionReference(
  db: Database,
  input: { conversationId: string; agentConnectionId: string },
): SessionReference | null {
  const row = db
    .select()
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.conversationId, input.conversationId),
        eq(conversationSessions.agentConnectionId, input.agentConnectionId),
      ),
    )
    .get();
  return row ? toReference(row) : null;
}

/**
 * Read every session reference a conversation holds.
 */
export function listSessionReferences(db: Database, conversationId: string): SessionReference[] {
  return db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .all()
    .map(toReference);
}

/**
 * Record the session a turn ran in.
 *
 * A reference that already exists is updated rather than replaced: the session
 * id may be the same, and the continuity may have been learned since — a
 * runtime that was probed after the first turn turns out to keep sessions,
 * and the next turn may continue one.
 */
export function recordSessionReference(
  db: Database,
  input: SessionReferenceInput,
): SessionReference {
  const now = new Date().toISOString();
  const continuity: SessionContinuity = continuityForCapabilities(input.capabilities ?? null);
  const existing = readSessionReference(db, {
    conversationId: input.conversationId,
    agentConnectionId: input.agentConnectionId,
  });

  if (existing) {
    db.update(conversationSessions)
      .set({
        sessionId: input.sessionId,
        continuity,
        capabilitiesRevision: input.capabilitiesRevision ?? existing.capabilitiesRevision,
        updatedAt: now,
      })
      .where(eq(conversationSessions.id, existing.id))
      .run();
    return readSessionReference(db, {
      conversationId: input.conversationId,
      agentConnectionId: input.agentConnectionId,
    })!;
  }

  const id = newId('ses');
  db.insert(conversationSessions)
    .values({
      id,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      agentConnectionId: input.agentConnectionId,
      sessionId: input.sessionId,
      continuity,
      capabilitiesRevision: input.capabilitiesRevision ?? null,
      establishedAt: now,
      updatedAt: now,
    })
    .run();

  return {
    id,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    agentConnectionId: input.agentConnectionId,
    sessionId: input.sessionId,
    continuity,
    capabilitiesRevision: input.capabilitiesRevision ?? null,
    establishedAt: now,
    updatedAt: now,
  };
}

function toReference(row: typeof conversationSessions.$inferSelect): SessionReference {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    agentConnectionId: row.agentConnectionId,
    sessionId: row.sessionId,
    continuity: row.continuity,
    capabilitiesRevision: row.capabilitiesRevision,
    establishedAt: row.establishedAt,
    updatedAt: row.updatedAt,
  };
}
