import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { automationRuns, executions, queueJobs, tasks } from '../db/schema.js';
import { newId } from '../lib/ids.js';

export type JobType = 'chat.turn' | 'factory.execute' | 'automation.run' | 'resource.refresh';

export interface QueueJob {
  id: string;
  workspaceId: string;
  type: JobType;
  payload: Record<string, unknown>;
  /**
   * `unknown` means the work started and the outcome could not be confirmed.
   * Such a job is never run again: running it a second time could repeat a
   * side effect that already happened.
   */
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'unknown';
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueOptions {
  workspaceId: string;
  type: JobType;
  payload: Record<string, unknown>;
  priority?: number;
  runAt?: string;
  maxAttempts?: number;
}

/**
 * A SQLite-backed queue.
 *
 * The worker leases jobs with an atomic conditional update, so two workers
 * can never claim the same job. The database is the only coordination
 * mechanism — no broker, no extra infrastructure.
 */
export class Queue {
  constructor(private readonly db: Database) {}

  enqueue(options: EnqueueOptions): QueueJob {
    const now = new Date().toISOString();
    const job: typeof queueJobs.$inferInsert = {
      id: newId('job'),
      workspaceId: options.workspaceId,
      type: options.type,
      payload: options.payload,
      status: 'queued',
      priority: options.priority ?? 0,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      runAt: options.runAt ?? now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(queueJobs).values(job).run();
    return job as QueueJob;
  }

  /**
   * Atomically lease the next runnable job for a worker.
   * Returns null when the queue is empty.
   */
  claimNext(workerId: string): QueueJob | null {
    const now = new Date().toISOString();

    return this.db.transaction((tx) => {
      const candidate = tx
        .select()
        .from(queueJobs)
        .where(and(eq(queueJobs.status, 'queued'), lte(queueJobs.runAt, now)))
        .orderBy(desc(queueJobs.priority), asc(queueJobs.runAt))
        .limit(1)
        .get();

      if (!candidate) return null;

      const result = tx
        .update(queueJobs)
        .set({
          status: 'running',
          lockedAt: now,
          lockedBy: workerId,
          attempts: candidate.attempts + 1,
          updatedAt: now,
        })
        .where(and(eq(queueJobs.id, candidate.id), eq(queueJobs.status, 'queued')))
        .run();

      if (result.changes === 0) return null;

      return {
        ...candidate,
        status: 'running',
        lockedAt: now,
        lockedBy: workerId,
        attempts: candidate.attempts + 1,
      } as QueueJob;
    });
  }

  /**
   * Refresh the lease on a running job.
   *
   * A job may run for much longer than the stale-job window — an agent
   * turn can take minutes. Without a heartbeat the job would be reaped and
   * executed a second time while the first attempt is still running.
   */
  heartbeat(jobId: string, workerId: string): void {
    this.db
      .update(queueJobs)
      .set({ lockedAt: new Date().toISOString() })
      .where(
        and(
          eq(queueJobs.id, jobId),
          eq(queueJobs.status, 'running'),
          eq(queueJobs.lockedBy, workerId),
        ),
      )
      .run();
  }

  complete(jobId: string): void {
    this.db
      .update(queueJobs)
      .set({ status: 'done', lockedAt: null, lockedBy: null, updatedAt: new Date().toISOString() })
      .where(eq(queueJobs.id, jobId))
      .run();
  }

  /** Mark a job failed; retry it while attempts remain. */
  fail(jobId: string, error: string, retryInMs = 5_000): void {
    const now = new Date().toISOString();
    const job = this.db.select().from(queueJobs).where(eq(queueJobs.id, jobId)).get();
    if (!job) return;

    if (job.attempts < job.maxAttempts) {
      this.db
        .update(queueJobs)
        .set({
          status: 'queued',
          lastError: error,
          lockedAt: null,
          lockedBy: null,
          runAt: new Date(Date.now() + retryInMs).toISOString(),
          updatedAt: now,
        })
        .where(eq(queueJobs.id, jobId))
        .run();
      return;
    }

    this.db
      .update(queueJobs)
      .set({
        status: 'failed',
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(queueJobs.id, jobId))
      .run();
  }

  /**
   * Hold a job whose outcome could not be confirmed.
   *
   * The job is finished, but it is never requeued and never retried. The
   * work may already have had its side effect, so running it again is the one
   * thing that must not happen on its own. The owner decides what happens
   * next.
   */
  hold(jobId: string, error: string): void {
    this.db
      .update(queueJobs)
      .set({
        status: 'unknown',
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(queueJobs.id, jobId))
      .run();
  }

  /**
   * Release jobs whose worker died, so another worker can pick them up.
   *
   * A job whose work is already recorded as `unknown` is not released. The
   * work may already have had its side effect, and running it again is the
   * one thing that must not happen on its own. Such a job is held instead,
   * and the owner decides what happens next.
   */
  reapStaleJobs(olderThanMs = 120_000): number {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const stale = this.db
      .select()
      .from(queueJobs)
      .where(and(eq(queueJobs.status, 'running'), lte(queueJobs.lockedAt, cutoff)))
      .all();

    let handled = 0;
    for (const job of stale) {
      if (this.itemIsUnknown(job)) {
        this.hold(
          job.id,
          'The outcome of this job could not be confirmed, so it was not run again.',
        );
        handled += 1;
        continue;
      }

      this.db
        .update(queueJobs)
        .set({
          status: 'queued',
          lockedAt: null,
          lockedBy: null,
          lastError: 'Worker lease expired; job was requeued.',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(queueJobs.id, job.id))
        .run();
      handled += 1;
    }
    return handled;
  }

  /**
   * Has the work this job was doing already been recorded as unknown?
   *
   * The worker holds a job after the executor has returned, so a worker that
   * dies in between leaves the job running with the item already unknown.
   * The item is the record of what happened, and it is what the contract
   * says must not be run again.
   */
  private itemIsUnknown(job: { payload: unknown; lockedAt: string | null }): boolean {
    const payload = job.payload as {
      executionId?: string;
      taskId?: string;
      automationId?: string;
    };

    if (payload.executionId) {
      const execution = this.db
        .select()
        .from(executions)
        .where(eq(executions.id, payload.executionId))
        .get();
      if (execution?.status === 'unknown') return true;
    }

    if (payload.taskId) {
      const task = this.db.select().from(tasks).where(eq(tasks.id, payload.taskId)).get();
      if (task?.status === 'unknown') return true;
    }

    if (payload.automationId) {
      // An automation run has no id in the job, so the run that belongs to
      // this job is the one that started after the job was claimed.
      const run = this.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, payload.automationId))
        .all()
        .find((row) => row.status === 'unknown' && row.startedAt >= (job.lockedAt ?? ''));
      if (run) return true;
    }

    return false;
  }

  /** Cancel queued jobs for a conversation, used when a chat is paused. */
  cancelForConversation(conversationId: string): number {
    const result = this.db
      .update(queueJobs)
      .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(queueJobs.status, 'queued'),
          sql`json_extract(${queueJobs.payload}, '$.conversationId') = ${conversationId}`,
        ),
      )
      .run();
    return result.changes;
  }
}
