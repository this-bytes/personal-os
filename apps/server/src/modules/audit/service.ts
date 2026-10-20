import { desc, eq, sql } from 'drizzle-orm';
import type { ActorType } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';
import { newId } from '../../lib/ids.js';

export interface AuditEntry {
  id: string;
  workspaceId: string | null;
  actorType: ActorType;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  /**
   * What the action produced. `unknown` means the work started and the
   * outcome could not be confirmed — neither a success nor a failure.
   */
  result: 'success' | 'failure' | 'unknown';
  metadata: unknown;
  createdAt: string;
}

export interface AuditService {
  record(input: {
    workspaceId?: string | null;
    actorType: ActorType;
    actorId: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    result?: 'success' | 'failure' | 'unknown';
    metadata?: unknown;
  }): AuditEntry;
  list(workspaceId: string, limit?: number): AuditEntry[];
}

/**
 * The audit trail.
 *
 * Every entry answers three questions: who requested an action, which agent
 * performed it, and what the result was. Entries are append-only.
 */
export function createAuditService(db: Database): AuditService {
  const toEntry = (row: typeof auditLog.$inferSelect): AuditEntry => ({
    id: row.id,
    workspaceId: row.workspaceId,
    actorType: row.actorType as ActorType,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    result: row.result as 'success' | 'failure' | 'unknown',
    metadata: row.metadata,
    createdAt: row.createdAt,
  });

  return {
    record(input): AuditEntry {
      const id = newId('aud');
      const createdAt = new Date().toISOString();
      db.insert(auditLog)
        .values({
          id,
          workspaceId: input.workspaceId ?? null,
          actorType: input.actorType,
          actorId: input.actorId,
          action: input.action,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          result: input.result ?? 'success',
          metadata: input.metadata ?? null,
          createdAt,
        })
        .run();
      return {
        id,
        workspaceId: input.workspaceId ?? null,
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        result: input.result ?? 'success',
        metadata: input.metadata ?? null,
        createdAt,
      };
    },

    list(workspaceId, limit = 200): AuditEntry[] {
      return (
        db
          .select()
          .from(auditLog)
          .where(eq(auditLog.workspaceId, workspaceId))
          // The rowid breaks ties when two entries share a timestamp.
          .orderBy(desc(auditLog.createdAt), desc(sql`rowid`))
          .limit(limit)
          .all()
          .map(toEntry)
      );
    },
  };
}
