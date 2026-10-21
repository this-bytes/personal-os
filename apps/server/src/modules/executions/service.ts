import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { executions, messages } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';

/**
 * The owner's conclusion about an execution whose outcome could not be
 * confirmed.
 *
 * `completed` says it did run; `failed` says it did not. The product does not
 * know which of the two it was — the worker stopped and could not confirm how
 * the turn ended — and the owner does, because the owner went and looked.
 */
export type ExecutionOutcome = 'completed' | 'failed';

export interface ExecutionResolution {
  execution: { id: string; status: string; error: string | null };
  /** The conclusion the owner reached. */
  outcome: ExecutionOutcome;
  /** The sentence the server produced about that conclusion. */
  detail: string;
}

export interface ExecutionsService {
  /**
   * Record the owner's conclusion about an execution whose outcome could not
   * be confirmed.
   *
   * The execution takes the conclusion and its reply follows it. The audit
   * entry is written by the route, where the owner's own action is, and it
   * names the owner.
   */
  resolve(input: {
    executionId: string;
    workspaceId: string;
    outcome: ExecutionOutcome;
    /** The owner's own words, when they have any. */
    note?: string;
  }): ExecutionResolution;
}

/**
 * The sentence the server produced about the owner's conclusion.
 *
 * The client shows it as it is given: the account of what happened is the
 * server's, and a client that reworded it would be telling the owner
 * something the server knows better. The owner's own note goes with it,
 * because the note is theirs.
 */
export function resolutionSentence(outcome: ExecutionOutcome, note?: string): string {
  const sentence =
    outcome === 'completed'
      ? 'You checked this turn: it did run, so the reply is recorded as complete.'
      : 'You checked this turn: it did not run, so the reply is recorded as failed.';
  const trimmed = note?.trim();
  return trimmed ? `${sentence} Your note: ${trimmed}` : sentence;
}

/**
 * Executions whose outcome could not be confirmed.
 *
 * An execution is a run of an agent's turn. The worker records what it can
 * confirm, and when it cannot confirm how a turn ended it records `unknown`
 * rather than guessing. Closing that is the owner's decision and nobody
 * else's: the product does not know whether the work happened, and it must not
 * run it again to find out.
 */
export function createExecutionsService(options: { db: Database }): ExecutionsService {
  const { db } = options;

  const service: ExecutionsService = {
    resolve({ executionId, workspaceId, outcome, note }): ExecutionResolution {
      const execution = db.select().from(executions).where(eq(executions.id, executionId)).get();
      if (!execution || execution.workspaceId !== workspaceId) {
        throw errors.notFound('Execution');
      }

      // This route answers a question, and there is only a question while the
      // outcome could not be confirmed. An execution whose outcome is known is
      // not the owner's to rewrite, and rewriting it would destroy a record
      // the worker can stand behind.
      if (execution.status !== 'unknown') {
        throw errors.conflict('This execution is not waiting for a conclusion.', {
          status: execution.status,
        });
      }

      const detail = resolutionSentence(outcome, note);
      const now = new Date().toISOString();

      db.update(executions)
        .set({
          status: outcome,
          // The error column carries a reason only when there is one. A turn
          // that did run has no error, and the note is in the audit trail and
          // on the reply either way.
          error: outcome === 'failed' ? detail : null,
          finishedAt: now,
        })
        .where(eq(executions.id, executionId))
        .run();

      // The reply follows the execution. If the turn did run, the reply
      // completed; if it did not, the reply failed. The sentence goes with
      // it, so the owner reads what happened instead of a bare badge.
      db.update(messages)
        .set({ status: outcome === 'completed' ? 'complete' : 'failed', detail })
        .where(eq(messages.executionId, executionId))
        .run();

      return {
        execution: {
          id: execution.id,
          status: outcome,
          error: outcome === 'failed' ? detail : null,
        },
        outcome,
        detail,
      };
    },
  };

  return service;
}
