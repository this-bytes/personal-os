import { and, eq, lte } from 'drizzle-orm';
import { automations } from '@personal-os/server/db';
import { computeNextRun, newId } from '@personal-os/server/runtime';
import type { Runtime } from '@personal-os/server/runtime';

/**
 * The automation scheduler.
 *
 * Automations are due when their next run time has passed. The scheduler
 * only enqueues work; the queue decides when it actually runs, so a burst
 * of due automations is processed with the same backpressure as any other
 * job.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly runtime: Runtime,
    private readonly intervalMs = 30_000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Enqueue every automation whose next run is due. */
  async tick(now: Date = new Date()): Promise<number> {
    const { db, queue } = this.runtime;
    const due = db
      .select()
      .from(automations)
      .where(and(eq(automations.enabled, true), lte(automations.nextRunAt, now.toISOString())))
      .all();

    for (const automation of due) {
      const nextRunAt = computeNextRun(automation.trigger, now);
      // Move the schedule forward immediately so a slow run cannot cause
      // the same automation to be queued twice.
      db.update(automations)
        .set({ nextRunAt, updatedAt: now.toISOString() })
        .where(eq(automations.id, automation.id))
        .run();

      queue.enqueue({
        workspaceId: automation.workspaceId,
        type: 'automation.run',
        // The run's id is minted here, before the job is queued, so the job
        // carries the identity of the run it is going to make. Without it the
        // product could only guess which run belonged to the job, and a guess
        // is how a run that had started gets run a second time.
        payload: { automationId: automation.id, runId: newId('run') },
      });
    }

    return due.length;
  }
}
