import { and, eq, notInArray } from 'drizzle-orm';
import type { AgentAdapter, AgentAdapterExtras, AgentReconciliation } from '@personal-os/contracts';
import {
  agentConnections,
  automations,
  automationRuns,
  executions,
  messages,
  tasks,
} from '@personal-os/server/db';
import type { QueueJob, Runtime } from '@personal-os/server/runtime';
import { loadAdapterConfig, publishTerminalEvent } from './execution-owner.js';

/**
 * The statuses that mean a run has ended.
 *
 * A run in one of them is not ended again. The list is the product's answer
 * to "has this turn already had its ending", and it is what keeps a turn
 * from ending twice when two workers settle the same dead job.
 */
const ENDED_EXECUTION_STATUSES = [
  'completed',
  'failed',
  'committed',
  'cancelled',
  'unknown',
] as const;

/**
 * The statuses that mean a task is over.
 *
 * A task that is over is not made uncertain afterwards: the owner has already
 * decided about it.
 */
const ENDED_TASK_STATUSES = ['done', 'cancelled'] as const;

/**
 * What a worker does with the jobs whose worker died.
 *
 * The rule itself is in the queue (`decideStaleJob`): it is stated in terms of
 * what the product knows, because the one thing that must not happen is a job
 * that had already run being run again.
 *
 * This module is the part that needs the worker: only the worker can ask the
 * runtime what became of a run, and only the worker can write the run's own
 * record.
 *
 * The two moments are the same moment. A worker that restarts finds the jobs
 * that were running when it died; a worker that is alive finds the jobs whose
 * worker stopped answering. Both are "a job is running and nobody is working
 * on it", and both are settled the same way.
 */

/**
 * Settle every job whose worker died.
 *
 * Returns how many jobs were settled. A job that was already settled by
 * somebody else — the owner resolved it, or another worker got there first —
 * is left alone: every write here is conditional on the job still being the
 * one that was looked at.
 */
export async function reconcileStaleJobs(runtime: Runtime, olderThanMs = 120_000): Promise<number> {
  const stale = runtime.queue.staleRunningJobs(olderThanMs);
  let handled = 0;

  for (const job of stale) {
    const decision = runtime.queue.decideFor(job);

    if (decision.kind === 'reconcile') {
      const answer = await witness(runtime, job);
      if (answer && answer.outcome !== 'unknown') {
        // The job is settled first, and the turn is ended only if that
        // settlement landed. Two workers can look at the same dead job, and
        // only one of them may end its turn: a turn ends once.
        const settled = runtime.queue.applyStaleDecision(job, {
          kind: 'complete',
          reason:
            'The runtime was asked what became of the run, and it said the run finished. The run was not run again.',
        });
        if (settled) {
          recordWitnessedOutcome(runtime, job, answer);
          handled += 1;
        }
        continue;
      }

      const reason =
        'The runtime could not say what became of this run, so the outcome is uncertain. It was not run again, and the owner decides what happens next.';
      if (runtime.queue.applyStaleDecision(job, { kind: 'hold', reason })) {
        markUncertain(runtime, job, reason);
        handled += 1;
      }
      continue;
    }

    if (decision.kind === 'hold') {
      if (runtime.queue.applyStaleDecision(job, decision)) {
        markUncertain(runtime, job, decision.reason);
        handled += 1;
      }
      continue;
    }

    if (runtime.queue.applyStaleDecision(job, decision)) {
      handled += 1;
    }
  }

  return handled;
}

/**
 * Ask the runtime what became of a run.
 *
 * A runtime that cannot be asked answers nothing, and that is the honest
 * answer: the outcome is uncertain, and the owner resolves it. An adapter
 * that can answer says what happened; one that cannot says `unknown` rather
 * than guessing, because a guess here is a side effect nobody agreed to.
 */
async function witness(runtime: Runtime, job: QueueJob): Promise<AgentReconciliation | null> {
  const payload = job.payload as { executionId?: string; agentConnectionId?: string };
  if (!payload.executionId || !payload.agentConnectionId) return null;

  const connection = runtime.db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, payload.agentConnectionId))
    .get();
  if (!connection) return null;

  let adapter;
  try {
    const config = await loadAdapterConfig(runtime, payload.agentConnectionId);
    adapter = runtime.registry.create(config, {
      resolveSecret: runtime.resolveSecret,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });
  } catch {
    // The configuration cannot be read, so the runtime cannot be reached. The
    // outcome stays uncertain.
    return null;
  }

  // The extras are the optional part of the adapter boundary: a runtime that
  // can be asked implements them, and one that cannot does not.
  const extras = adapter as AgentAdapter & Partial<AgentAdapterExtras>;

  if (!extras.reconcile) {
    await adapter.close?.();
    return null;
  }

  try {
    const execution = runtime.db
      .select()
      .from(executions)
      .where(eq(executions.id, payload.executionId))
      .get();
    return await extras.reconcile(
      {
        id: connection.id,
        name: connection.name,
        adapterType: connection.adapterType as never,
        configRef: connection.configRef,
        enabled: connection.enabled,
        persona: connection.persona ?? undefined,
      },
      {
        executionId: payload.executionId,
        ...(execution?.externalRef ? { externalSessionId: execution.externalRef } : {}),
      },
    );
  } catch {
    // A runtime that cannot answer is a runtime that cannot answer. The
    // outcome stays uncertain.
    return null;
  } finally {
    await adapter.close?.();
  }
}

/**
 * Write what the runtime said on the run's own record.
 *
 * It is the same run: the same execution, the same correlation id and the
 * same session reference. The run was not started again, so nothing about it
 * is new except how it ended.
 *
 * The write only lands on a run that has not ended yet. A turn ends once, and
 * a turn that some other worker already ended is not ended a second time.
 */
function recordWitnessedOutcome(
  runtime: Runtime,
  job: QueueJob,
  answer: AgentReconciliation,
): void {
  const payload = job.payload as { executionId?: string; conversationId?: string };
  if (!payload.executionId) return;

  const execution = runtime.db
    .select()
    .from(executions)
    .where(eq(executions.id, payload.executionId))
    .get();
  if (!execution) return;

  const status = answer.outcome === 'failed' ? 'failed' : 'completed';
  const detail =
    answer.detail ?? 'The runtime was asked what became of this run, and it said the run finished.';
  const now = new Date().toISOString();

  const written = runtime.db
    .update(executions)
    .set({ status, error: status === 'failed' ? detail : null, finishedAt: now })
    .where(
      and(
        eq(executions.id, payload.executionId),
        notInArray(executions.status, [...ENDED_EXECUTION_STATUSES]),
      ),
    )
    .run();
  if (written.changes === 0) return;

  runtime.db
    .update(messages)
    .set({ status: status === 'failed' ? 'failed' : 'complete', detail })
    .where(eq(messages.executionId, payload.executionId))
    .run();

  publishTerminalEvent(runtime, {
    workspaceId: execution.workspaceId,
    ...(execution.conversationId ? { conversationId: execution.conversationId } : {}),
    executionId: execution.id,
    status,
  });
}

/**
 * Mark a run as uncertain, so the owner can see it and settle it.
 *
 * An uncertain run is not a failure and not a success: it is a question the
 * owner closes. The execution carries the question, the reply says so, and the
 * owner's own conclusion is what settles it.
 *
 * There are three kinds of run, and each is published where the owner looks
 * for it. A chat turn is published on the execution and on its reply. A task's
 * turn is published on the execution, on its reply **and on the task** — a
 * task that stays `open` is a task the owner never hears about, because the
 * waiting list only shows a task that has reached `review`, `blocked` or
 * `unknown`. An automation's run has no execution and no reply: it is
 * published on the run itself, where the owner sees the automation's other
 * runs.
 */
function markUncertain(runtime: Runtime, job: QueueJob, reason: string): void {
  const payload = job.payload as { executionId?: string; runId?: string };

  // An automation's run. It carries no execution, so the run is the only
  // record of it, and the run is what the owner reads.
  if (payload.runId) {
    markTheAutomationRunUncertain(runtime, payload.runId, reason);
    return;
  }

  if (!payload.executionId) return;

  const execution = runtime.db
    .select()
    .from(executions)
    .where(eq(executions.id, payload.executionId))
    .get();
  if (!execution) return;

  const written = runtime.db
    .update(executions)
    .set({ status: 'unknown', error: reason })
    .where(
      and(
        eq(executions.id, payload.executionId),
        notInArray(executions.status, [...ENDED_EXECUTION_STATUSES]),
      ),
    )
    .run();
  if (written.changes === 0) return;

  runtime.db
    .update(messages)
    .set({ status: 'unknown', detail: reason })
    .where(eq(messages.executionId, payload.executionId))
    .run();

  // A task's turn. The task is the thing the owner works with, so the
  // uncertainty has to reach the task as well as the run.
  if (execution.taskId) {
    markTheTaskUncertain(runtime, execution.taskId, reason);
  }
}

/**
 * Mark a task uncertain, and say so.
 *
 * The task moves to `unknown`, which is the status the waiting list shows,
 * and the owner decides what happens next.
 */
function markTheTaskUncertain(runtime: Runtime, taskId: string, reason: string): void {
  const now = new Date().toISOString();
  const written = runtime.db
    .update(tasks)
    .set({ status: 'unknown', updatedAt: now })
    .where(and(eq(tasks.id, taskId), notInArray(tasks.status, [...ENDED_TASK_STATUSES])))
    .run();
  if (written.changes === 0) return;

  const task = runtime.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task) return;

  runtime.events.publish(
    {
      type: 'task.updated',
      task: {
        id: task.id,
        workspaceId: task.workspaceId,
        goalId: task.goalId ?? undefined,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId ?? undefined,
        executionOwner: task.executionOwner as never,
        status: task.status as never,
        acceptanceCriteria: task.acceptanceCriteria,
        evidenceResourceIds: task.evidenceResourceIds,
        revision: task.revision,
        externalRef: task.externalRef ?? undefined,
      },
    },
    { workspaceId: task.workspaceId },
  );
  void reason;
}

/**
 * Mark an automation's run uncertain, and say so.
 *
 * The run row is the only record of an automation's run, so an uncertain run
 * that is not marked is an automation that says `running` for ever.
 */
function markTheAutomationRunUncertain(runtime: Runtime, runId: string, reason: string): void {
  const now = new Date().toISOString();
  const written = runtime.db
    .update(automationRuns)
    .set({ status: 'unknown', error: reason, finishedAt: now })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.status, 'running')))
    .run();
  if (written.changes === 0) return;

  const run = runtime.db.select().from(automationRuns).where(eq(automationRuns.id, runId)).get();
  if (!run) return;

  const automation = runtime.db
    .select()
    .from(automations)
    .where(eq(automations.id, run.automationId))
    .get();
  if (!automation) return;

  runtime.events.publish(
    {
      type: 'automation.run',
      run: {
        id: run.id,
        automationId: run.automationId,
        status: 'unknown',
        startedAt: run.startedAt,
        finishedAt: now,
        output: null,
        error: reason,
      },
    },
    { workspaceId: automation.workspaceId },
  );
}
