import { and, desc, eq } from 'drizzle-orm';
import type { Approval, ApprovalEvidence, ApprovalStatus } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { approvals, executions } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { EventsService } from '../events/service.js';
import { publishTurnEnd } from '../events/turn-end.js';
import { readApprovalEvidence } from './evidence.js';

/**
 * The shape of an approval is published, because an approval crosses the
 * server-to-client boundary when it is decided. The types here are the
 * published ones, not copies of them, so the two cannot drift.
 */
export type { Approval, ApprovalStatus };

export interface ApprovalsService {
  list(workspaceId: string, status?: ApprovalStatus): Approval[];
  get(id: string): Approval;
  /**
   * The evidence a decision is taken against.
   *
   * The execution the approval was raised against, and that execution's own
   * record: what the agent did, what it produced and what it cost. An
   * approval that names no execution, or names one that is gone, answers with
   * no execution.
   */
  evidence(id: string): ApprovalEvidence;
  request(input: {
    workspaceId: string;
    executionId?: string;
    conversationId?: string;
    taskId?: string;
    agentConnectionId?: string;
    summary: string;
    details?: unknown;
    requestedBy?: string;
  }): Approval;
  decide(id: string, input: { approved: boolean; reason?: string; decidedBy: string }): Approval;
  /**
   * Close the execution that was waiting for the decision.
   *
   * A rejected operation was stopped, so it is `cancelled` — the outcome is
   * known, because the work did not run. It is not a failure of the work and
   * it is not an unknown.
   */
  resolveExecution(
    executionId: string,
    status: 'completed' | 'failed' | 'cancelled' | 'unknown',
    detail: string,
  ): void;
}

/**
 * Approvals for sensitive agent operations.
 *
 * An agent that asks for approval produces a pending request. The owner
 * decides, and the decision is recorded. An approval that is never decided
 * stays pending — the system never resolves it silently.
 */
export function createApprovalsService(db: Database, events: EventsService): ApprovalsService {
  const toApproval = (row: typeof approvals.$inferSelect): Approval => ({
    id: row.id,
    workspaceId: row.workspaceId,
    executionId: row.executionId,
    conversationId: row.conversationId,
    taskId: row.taskId,
    agentConnectionId: row.agentConnectionId,
    summary: row.summary,
    details: row.details,
    status: row.status as ApprovalStatus,
    reason: row.reason,
    requestedBy: row.requestedBy,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  });

  const service: ApprovalsService = {
    list(workspaceId, status): Approval[] {
      return db
        .select()
        .from(approvals)
        .where(
          status
            ? and(eq(approvals.workspaceId, workspaceId), eq(approvals.status, status))
            : eq(approvals.workspaceId, workspaceId),
        )
        .orderBy(desc(approvals.createdAt))
        .all()
        .map(toApproval);
    },

    get(id): Approval {
      const row = db.select().from(approvals).where(eq(approvals.id, id)).get();
      if (!row) throw errors.notFound('Approval');
      return toApproval(row);
    },

    evidence(id): ApprovalEvidence {
      return readApprovalEvidence(db, id);
    },

    request(input): Approval {
      const id = newId('apr');
      const createdAt = new Date().toISOString();
      db.insert(approvals)
        .values({
          id,
          workspaceId: input.workspaceId,
          executionId: input.executionId ?? null,
          conversationId: input.conversationId ?? null,
          taskId: input.taskId ?? null,
          agentConnectionId: input.agentConnectionId ?? null,
          summary: input.summary,
          details: input.details ?? null,
          status: 'pending',
          reason: null,
          requestedBy: input.requestedBy ?? null,
          decidedBy: null,
          createdAt,
          decidedAt: null,
        })
        .run();
      return service.get(id);
    },

    decide(id, input): Approval {
      const current = service.get(id);
      if (current.status !== 'pending') {
        throw errors.conflict(`This approval has already been ${current.status}.`);
      }

      // A decision changes the outcome of the operation that asked for it. An
      // execution that is not waiting for one cannot take it.
      if (current.executionId) {
        const execution = db
          .select()
          .from(executions)
          .where(eq(executions.id, current.executionId))
          .get();
        if (!execution) {
          throw errors.conflict('The operation this approval refers to no longer exists.');
        }
        if (execution.status !== 'blocked') {
          throw errors.conflict(
            `This operation is ${execution.status}. It is not waiting for a decision.`,
          );
        }
      }

      db.update(approvals)
        .set({
          status: input.approved ? 'approved' : 'rejected',
          reason: input.reason ?? null,
          decidedBy: input.decidedBy,
          decidedAt: new Date().toISOString(),
        })
        .where(eq(approvals.id, id))
        .run();
      return service.get(id);
    },

    resolveExecution(executionId, status, detail): void {
      db.update(executions)
        .set({
          status,
          // The error column carries the reason only when there is an error.
          // A cancellation is a decision, and an unknown carries its own
          // explanation of what could not be confirmed.
          error: status === 'failed' || status === 'unknown' ? detail : null,
          finishedAt: new Date().toISOString(),
        })
        .where(eq(executions.id, executionId))
        .run();

      // A turn that ended here ends in the log too. `unknown` is a question,
      // not an ending, so it publishes nothing: the owner closes that turn, and
      // the close publishes the one event that ends it.
      const turn = db.select().from(executions).where(eq(executions.id, executionId)).get();
      if (turn) {
        publishTurnEnd(events, turn, status);
      }
    },
  };

  return service;
}
