import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { automationRuns, executions, queueJobs, tasks } from '../db/schema.js';
import { newId } from '../lib/ids.js';
import { decideStaleJob, type StaleJobDecision, type StaleJobItem } from './reconciliation.js';

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

  /**
   * Finish a job.
   *
   * The write is fenced on the lease: a worker whose lease moved on cannot
   * write, because the job it was working on belongs to somebody else now. It
   * says so by returning false, and the caller treats that as "the job is not
   * mine to finish".
   */
  complete(jobId: string, workerId: string): boolean {
    const result = this.db
      .update(queueJobs)
      .set({
        status: 'done',
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(queueJobs.id, jobId),
          eq(queueJobs.status, 'running'),
          eq(queueJobs.lockedBy, workerId),
        ),
      )
      .run();
    return result.changes > 0;
  }

  /**
   * Mark a job failed; retry it while attempts remain.
   *
   * Fenced on the lease, like every other write to a running job.
   */
  fail(jobId: string, workerId: string, error: string, retryInMs = 5_000): boolean {
    const now = new Date().toISOString();
    const job = this.db.select().from(queueJobs).where(eq(queueJobs.id, jobId)).get();
    if (!job) return false;

    if (job.attempts < job.maxAttempts) {
      const result = this.db
        .update(queueJobs)
        .set({
          status: 'queued',
          lastError: error,
          lockedAt: null,
          lockedBy: null,
          runAt: new Date(Date.now() + retryInMs).toISOString(),
          updatedAt: now,
        })
        .where(
          and(
            eq(queueJobs.id, jobId),
            eq(queueJobs.status, 'running'),
            eq(queueJobs.lockedBy, workerId),
          ),
        )
        .run();
      return result.changes > 0;
    }

    const result = this.db
      .update(queueJobs)
      .set({
        status: 'failed',
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(queueJobs.id, jobId),
          eq(queueJobs.status, 'running'),
          eq(queueJobs.lockedBy, workerId),
        ),
      )
      .run();
    return result.changes > 0;
  }

  /**
   * Hold a job whose outcome could not be confirmed.
   *
   * The job is finished, but it is never requeued and never retried. The
   * work may already have had its side effect, so running it again is the one
   * thing that must not happen on its own. The owner decides what happens
   * next.
   *
   * Fenced on the lease, like every other write to a running job.
   */
  hold(jobId: string, workerId: string, error: string): boolean {
    const result = this.db
      .update(queueJobs)
      .set({
        status: 'unknown',
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(queueJobs.id, jobId),
          eq(queueJobs.status, 'running'),
          eq(queueJobs.lockedBy, workerId),
        ),
      )
      .run();
    return result.changes > 0;
  }

  /**
   * The jobs whose worker died.
   *
   * A job is stale when it is still marked running and its lease has not been
   * refreshed for longer than the window. That is the whole of what a lease
   * says: the worker that held it is not answering.
   */
  staleRunningJobs(olderThanMs = 120_000): QueueJob[] {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    return this.db
      .select()
      .from(queueJobs)
      .where(and(eq(queueJobs.status, 'running'), lte(queueJobs.lockedAt, cutoff)))
      .all() as QueueJob[];
  }

  /**
   * What the product knows about the item a job was working on.
   *
   * This is the fact the stale-job rule turns on: whether the work had
   * started at all. A job whose item never started is safe to run again, and
   * one whose item started may already have had its side effect.
   */
  itemStateFor(job: QueueJob): StaleJobItem {
    const payload = job.payload as {
      executionId?: string;
      taskId?: string;
      automationId?: string;
      /** The id of the run an automation job is going to make. */
      runId?: string;
    };

    if (payload.executionId) {
      const execution = this.db
        .select()
        .from(executions)
        .where(eq(executions.id, payload.executionId))
        .get();
      if (!execution) return { kind: 'none' };
      return executionItemState(execution.status, execution.startedAt);
    }

    if (payload.taskId) {
      const task = this.db.select().from(tasks).where(eq(tasks.id, payload.taskId)).get();
      if (!task) return { kind: 'none' };
      if (task.status === 'unknown') return { kind: 'unknown' };
      if (task.status === 'done' || task.status === 'cancelled') return { kind: 'settled' };
      if (task.status !== 'open') return { kind: 'started' };

      // A task stays open for the whole of its agent turn, so the task's own
      // status cannot say whether the work had started. The execution can: it
      // is written before the adapter runs, and it is what says the turn began.
      const execution = this.db
        .select()
        .from(executions)
        .where(eq(executions.taskId, payload.taskId))
        .get();
      if (!execution) return { kind: 'not-started' };
      return executionItemState(execution.status, execution.startedAt);
    }

    if (payload.automationId) {
      // The job carries the id of the run it is going to make, so the run is
      // found rather than guessed at. A run is written when it starts, so a
      // run that is missing never began; a run that is `running` began and
      // nothing recorded how it ended; a run that finished is finished.
      if (!payload.runId) return { kind: 'none' };
      const run = this.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.id, payload.runId))
        .get();
      if (!run) return { kind: 'not-started' };
      if (run.status === 'unknown') return { kind: 'unknown' };
      if (run.status === 'running') return { kind: 'started' };
      return { kind: 'settled' };
    }

    return { kind: 'none' };
  }

  /**
   * Apply the stale-job rule to one job and carry the decision out.
   *
   * The decision is the rule's, in `reconciliation.ts`. This is the part that
   * touches the row, and every write it makes is conditional on the job still
   * being the one we looked at: the job cannot be running and requeued at the
   * same time, because the second write only lands while the first has not.
   */
  applyStaleDecision(job: QueueJob, decision: StaleJobDecision): boolean {
    const now = new Date().toISOString();
    const guard = and(
      eq(queueJobs.id, job.id),
      eq(queueJobs.status, 'running'),
      eq(queueJobs.lockedBy, job.lockedBy ?? ''),
    );

    if (decision.kind === 'requeue') {
      const result = this.db
        .update(queueJobs)
        .set({
          status: 'queued',
          lockedAt: null,
          lockedBy: null,
          lastError: decision.reason,
          updatedAt: now,
        })
        .where(guard)
        .run();
      return result.changes > 0;
    }

    if (decision.kind === 'complete') {
      const result = this.db
        .update(queueJobs)
        .set({
          status: 'done',
          lockedAt: null,
          lockedBy: null,
          lastError: decision.reason,
          updatedAt: now,
        })
        .where(guard)
        .run();
      return result.changes > 0;
    }

    const result = this.db
      .update(queueJobs)
      .set({
        status: 'unknown',
        lockedAt: null,
        lockedBy: null,
        lastError: decision.reason,
        updatedAt: now,
      })
      .where(guard)
      .run();
    return result.changes > 0;
  }

  /**
   * Settle a job that was held for an outcome the owner has now settled.
   *
   * The job was held because its outcome could not be confirmed. The owner has
   * confirmed it, so the job is finished: it is not failed, because nothing
   * failed, and it is not run again, because the work is accounted for.
   */
  settleHeldJob(executionId: string, reason: string): boolean {
    const now = new Date().toISOString();
    const held = this.db
      .select()
      .from(queueJobs)
      .where(
        and(
          eq(queueJobs.status, 'unknown'),
          sql`json_extract(${queueJobs.payload}, '$.executionId') = ${executionId}`,
        ),
      )
      .all();
    let settled = 0;
    for (const job of held) {
      const result = this.db
        .update(queueJobs)
        .set({ status: 'done', lastError: reason, updatedAt: now })
        .where(and(eq(queueJobs.id, job.id), eq(queueJobs.status, 'unknown')))
        .run();
      settled += result.changes;
    }
    return settled > 0;
  }

  /**
   * The decision the stale-job rule makes about a job.
   *
   * Exposed so that the caller can ask about a job without carrying the rule
   * itself, and so that the rule is applied in one place.
   */
  decideFor(job: QueueJob): StaleJobDecision {
    return decideStaleJob(this.itemStateFor(job));
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

/**
 * What an execution's status says about whether the work had started.
 *
 * `startedAt` is the record that the run began, and the status is the record
 * of where it got to. A run that was admitted and never began is safe to run
 * again; a run that began and never said how it ended may already have had
 * its side effect.
 */
function executionItemState(status: string, startedAt: string | null): StaleJobItem {
  if (status === 'unknown') return { kind: 'unknown' };
  if (status === 'completed' || status === 'committed' || status === 'failed') {
    return { kind: 'settled' };
  }
  if (status === 'cancelled') return { kind: 'settled' };
  if (startedAt === null && status === 'queued') return { kind: 'not-started' };
  return { kind: 'started' };
}
