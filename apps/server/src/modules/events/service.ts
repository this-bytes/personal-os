import { EventEmitter } from 'node:events';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { ServerEvent } from '@personal-os/contracts';
import { eventSequence, executionEvents } from '../../db/schema.js';
import type { Database } from '../../db/client.js';

export interface StoredEvent {
  seq: number;
  workspaceId: string | null;
  conversationId: string | null;
  executionId: string | null;
  type: string;
  payload: ServerEvent;
  /**
   * Chain depth. Events produced by an event-triggered automation carry a
   * deeper value, which bounds how far an automation chain can run.
   */
  depth: number;
  createdAt: string;
}

/**
 * The event log doubles as the server-to-client stream source and as the
 * cross-process channel between the worker and the API server.
 *
 * Every event gets a monotonic sequence number so a client can resume
 * exactly where it left off after a reconnect.
 */
export class EventsService {
  private readonly emitter = new EventEmitter();
  private pollers = 0;

  constructor(private readonly db: Database) {
    this.emitter.setMaxListeners(0);
  }

  /** Persist an event and wake local subscribers. */
  publish(
    event: ServerEvent,
    context: {
      workspaceId?: string | null;
      conversationId?: string | null;
      depth?: number;
    } = {},
  ): StoredEvent {
    const createdAt = new Date().toISOString();
    const depth = context.depth ?? 0;

    const stored = this.db.transaction((tx) => {
      // The counter row is upserted rather than updated: a fresh database
      // has no counter row yet, and the sequence must never repeat.
      const rows = tx
        .insert(eventSequence)
        .values({ id: 1, value: 1 })
        .onConflictDoUpdate({
          target: eventSequence.id,
          set: { value: sql`${eventSequence.value} + 1` },
        })
        .returning({ value: eventSequence.value })
        .all();
      const seq = rows[0]?.value ?? 1;

      const executionId =
        'executionId' in event && typeof event.executionId === 'string' ? event.executionId : null;
      const conversationId =
        'conversationId' in event && typeof event.conversationId === 'string'
          ? event.conversationId
          : (context.conversationId ?? null);

      const record: StoredEvent = {
        seq,
        workspaceId: context.workspaceId ?? null,
        conversationId,
        executionId,
        type: event.type,
        payload: event,
        depth,
        createdAt,
      };

      tx.insert(executionEvents)
        .values({
          id: `evt_${seq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          seq,
          workspaceId: record.workspaceId ?? '',
          conversationId: record.conversationId,
          executionId: record.executionId ?? '',
          type: event.type,
          payload: event,
          depth,
          createdAt,
        })
        .run();

      return record;
    });

    this.emitter.emit('event', stored);
    this.emitter.emit('wake');
    return stored;
  }

  /** Events with a sequence number greater than `seq`. */
  since(seq: number, limit = 500): StoredEvent[] {
    const rows = this.db
      .select()
      .from(executionEvents)
      .where(gt(executionEvents.seq, seq))
      .limit(limit)
      .all();
    return rows.map(toStoredEvent);
  }

  /** The most recent events, used to prime a freshly connected client. */
  recent(workspaceId: string | null, limit = 200): StoredEvent[] {
    const rows = this.db
      .select()
      .from(executionEvents)
      .where(workspaceId ? and(sql`${executionEvents.workspaceId} = ${workspaceId}`) : undefined)
      .orderBy(sql`${executionEvents.seq} DESC`)
      .limit(limit)
      .all();
    return rows.map(toStoredEvent).reverse();
  }

  /** Subscribe to locally published events. Returns an unsubscribe function. */
  subscribe(listener: (event: StoredEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  /** Wake pollers immediately instead of waiting for the next tick. */
  wake(): void {
    this.emitter.emit('wake');
  }

  /** Register a poller that is notified when new events may exist. */
  onWake(listener: () => void): () => void {
    this.emitter.on('wake', listener);
    this.pollers += 1;
    return () => {
      this.emitter.off('wake', listener);
      this.pollers -= 1;
    };
  }
}

function toStoredEvent(row: typeof executionEvents.$inferSelect): StoredEvent {
  return {
    seq: row.seq,
    workspaceId: row.workspaceId || null,
    conversationId: row.conversationId,
    executionId: row.executionId || null,
    type: row.type,
    payload: row.payload as ServerEvent,
    depth: row.depth,
    createdAt: row.createdAt,
  };
}
