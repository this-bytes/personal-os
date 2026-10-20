import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { approvals, executions } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  workspaceId: string;
  executionId: string | null;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
  summary: string;
  details: unknown;
  status: ApprovalStatus;
  reason: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface ApprovalsService {
  list(workspaceId: string, status?: ApprovalStatus): Approval[];
  get(id: string): Approval;
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
export function createApprovalsService(db: Database): ApprovalsService {
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
    },
  };

  return service;
}
