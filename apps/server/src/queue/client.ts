import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { queueJobs } from '../db/schema.js';
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

  /** Release jobs whose worker died, so another worker can pick them up. */
  reapStaleJobs(olderThanMs = 120_000): number {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const result = this.db
      .update(queueJobs)
      .set({
        status: 'queued',
        lockedAt: null,
        lockedBy: null,
        lastError: 'Worker lease expired; job was requeued.',
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(queueJobs.status, 'running'), lte(queueJobs.lockedAt, cutoff)))
      .run();
    return result.changes;
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
