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
  /** The workspace the execution belongs to. The owner is its only reader. */
  workspaceId: string;
  /** The conclusion the owner reached. */
  outcome: ExecutionOutcome;
  /** The sentence the server produced about that conclusion. */
  detail: string;
}

export interface ExecutionsService {
  /**
   * Read one turn.
   *
   * A turn is an execution: its status, what it was for, and where it ran.
   */
  get(id: string): ExecutionDetail;
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
    outcome: ExecutionOutcome;
    /** The owner's own words, when they have any. */
    note?: string;
  }): ExecutionResolution;
}

/** A turn, as the owner reads it. */
export interface ExecutionDetail {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
  status: string;
  error: string | null;
  spendUnits: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/**
 * The sentence the server produced about the owner's conclusion.
 *
 * The client shows it as it is given: the account of what happened is the
 * server's, and a client that reworded it would be telling the owner
 * something the server knows better. The owner's own note goes with it,
 * because the note is theirs.
 */
export function resolutionSentence(outcome: ExecutionOutcome): string {
  return outcome === 'completed'
    ? 'You checked this turn: it did run, so the reply is recorded as complete.'
    : 'You checked this turn: it did not run, so the reply is recorded as failed.';
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
    get(id): ExecutionDetail {
      const row = db.select().from(executions).where(eq(executions.id, id)).get();
      if (!row) throw errors.notFound('Execution');
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        conversationId: row.conversationId,
        taskId: row.taskId,
        agentConnectionId: row.agentConnectionId,
        status: row.status,
        error: row.error,
        spendUnits: row.spendUnits,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        createdAt: row.createdAt,
      };
    },

    resolve({ executionId, outcome, note }): ExecutionResolution {
      const execution = db.select().from(executions).where(eq(executions.id, executionId)).get();
      if (!execution) {
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

      const detail = resolutionSentence(outcome);
      const now = new Date().toISOString();
      // The note is the owner's own words, and it is the reason. It goes in
      // the error column where there is an error, and in the audit entry
      // either way.
      const reason = note?.trim() ? note.trim() : null;

      db.update(executions)
        .set({
          status: outcome,
          // The error column carries a reason only where there is an error.
          // A turn that did run has none, and a turn that did not run has the
          // owner's own reason if they gave one.
          error: outcome === 'failed' ? reason : null,
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
          error: outcome === 'failed' ? reason : null,
        },
        workspaceId: execution.workspaceId,
        outcome,
        detail,
      };
    },
  };

  return service;
}
