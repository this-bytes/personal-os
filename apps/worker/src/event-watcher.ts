import { and, eq, gt, sql } from 'drizzle-orm';
import { automations, executionEvents, type Database } from '@personal-os/server/db';
import { isTriggerableEventType } from '@personal-os/contracts';
import type { Queue } from '@personal-os/server/runtime';

/**
 * Event-triggered automations.
 *
 * The worker tails the persisted event log — the same log that feeds the
 * browser's SSE stream — and enqueues any automation whose trigger names
 * the event that just happened. Polling the log rather than subscribing in
 * process means an event published by the API server reaches an automation
 * exactly like an event published by the worker itself.
 *
 * Two guards keep an automation chain from running forever:
 *
 *  - only allowlisted events can be triggers at all (see `contracts`), and
 *  - every event carries the chain depth it was produced at, and an event
 *    at the maximum depth does not trigger anything.
 */

/** How many automation hops may follow one another. */
export const MAX_CHAIN_DEPTH = 3;

/** The part of the runtime the watcher needs. */
export interface EventWatcherRuntime {
  db: Database;
  queue: Queue;
}

export interface EventWatcherOptions {
  /** How often the log is checked. */
  intervalMs?: number;
}

export class EventWatcher {
  private timer: NodeJS.Timeout | null = null;
  private lastSeq = 0;
  private running = false;

  constructor(
    private readonly runtime: EventWatcherRuntime,
    private readonly options: EventWatcherOptions = {},
  ) {}

  start(): void {
    if (this.timer) return;

    // Start from the current end of the log. Replaying history on boot
    // would fire every event-triggered automation at once.
    this.lastSeq = this.currentMaxSeq();

    const intervalMs = this.options.intervalMs ?? 500;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** The highest sequence number currently in the log. */
  private currentMaxSeq(): number {
    const row = this.runtime.db
      .select({ seq: sql<number>`max(${executionEvents.seq})` })
      .from(executionEvents)
      .get();
    return row?.seq ?? 0;
  }

  /**
   * Enqueue the automations that the events since the last tick trigger.
   * Returns the number of automations that were enqueued.
   */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return this.dispatch();
    } finally {
      this.running = false;
    }
  }

  private dispatch(): number {
    const { db, queue } = this.runtime;

    const pending = db
      .select()
      .from(executionEvents)
      .where(gt(executionEvents.seq, this.lastSeq))
      .all();

    if (pending.length === 0) return 0;

    let enqueued = 0;

    for (const event of pending) {
      // Advance the cursor even for events we do not act on, so the watcher
      // never looks at the same row twice.
      this.lastSeq = Math.max(this.lastSeq, event.seq);

      if (!isTriggerableEventType(event.type)) continue;
      if (event.depth >= MAX_CHAIN_DEPTH) continue;

      const workspaceId = event.workspaceId || null;
      if (!workspaceId) continue;

      const matching = db
        .select()
        .from(automations)
        .where(and(eq(automations.enabled, true), eq(automations.workspaceId, workspaceId)))
        .all()
        .filter((automation) => {
          const trigger = automation.trigger as {
            type?: string;
            event?: string;
          };
          return trigger.type === 'event' && trigger.event === event.type;
        });

      for (const automation of matching) {
        queue.enqueue({
          workspaceId: automation.workspaceId,
          type: 'automation.run',
          payload: {
            automationId: automation.id,
            trigger: {
              kind: 'event',
              seq: event.seq,
              eventType: event.type,
              depth: event.depth + 1,
              payload: event.payload,
            },
          },
        });
        enqueued += 1;
      }
    }

    return enqueued;
  }
}
