import { eq } from 'drizzle-orm';
import type { AgentAdapter, AgentAdapterExtras, AgentReconciliation } from '@personal-os/contracts';
import { agentConnections, executions, messages } from '@personal-os/server/db';
import type { QueueJob, Runtime } from '@personal-os/server/runtime';
import { loadAdapterConfig, publishTerminalEvent } from './execution-owner.js';

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
        recordWitnessedOutcome(runtime, job, answer);
        runtime.queue.applyStaleDecision(job, {
          kind: 'complete',
          reason:
            'The runtime was asked what became of the run, and it said the run finished. The run was not run again.',
        });
        handled += 1;
        continue;
      }

      const reason =
        'The runtime could not say what became of this run, so the outcome is uncertain. It was not run again, and the owner decides what happens next.';
      if (runtime.queue.applyStaleDecision(job, { kind: 'hold', reason })) {
        markUncertain(runtime, job, reason);
      }
      handled += 1;
      continue;
    }

    if (decision.kind === 'hold') {
      if (runtime.queue.applyStaleDecision(job, decision)) {
        markUncertain(runtime, job, decision.reason);
      }
      handled += 1;
      continue;
    }

    runtime.queue.applyStaleDecision(job, decision);
    handled += 1;
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

  runtime.db
    .update(executions)
    .set({ status, error: status === 'failed' ? detail : null, finishedAt: now })
    .where(eq(executions.id, payload.executionId))
    .run();

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
 */
function markUncertain(runtime: Runtime, job: QueueJob, reason: string): void {
  const payload = job.payload as { executionId?: string };
  if (!payload.executionId) return;

  const execution = runtime.db
    .select()
    .from(executions)
    .where(eq(executions.id, payload.executionId))
    .get();
  if (!execution) return;

  runtime.db
    .update(executions)
    .set({ status: 'unknown', error: reason })
    .where(eq(executions.id, payload.executionId))
    .run();

  runtime.db
    .update(messages)
    .set({ status: 'unknown', detail: reason })
    .where(eq(messages.executionId, payload.executionId))
    .run();
}
