import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody, parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({
  workspaceId: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const decideSchema = z.object({
  approved: z.boolean(),
  reason: z.string().max(2_000).default(''),
});

/**
 * Approvals for sensitive agent operations.
 *
 * An agent that needs permission raises a request; the owner decides.
 * Nothing is decided automatically.
 */
export function registerApprovalRoutes(app: FastifyInstance): void {
  app.get('/api/approvals', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, status } = parseQuery(listQuerySchema, request.query);
    return { approvals: app.services.approvals.list(workspaceId, status) };
  });

  app.get('/api/approvals/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { approval: app.services.approvals.get(id) };
  });

  app.post('/api/approvals/:id/decide', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(decideSchema, request.body);
    const approval = app.services.approvals.decide(id, {
      approved: body.approved,
      reason: body.reason,
      decidedBy: request.user?.id ?? 'owner',
    });

    // The decision has to change the outcome of the operation that asked
    // for it. An approval that changes nothing is not an approval.
    if (approval.executionId) {
      app.services.approvals.resolveExecution(
        approval.executionId,
        body.approved ? 'completed' : 'failed',
        body.approved
          ? 'The operation was authorised by the owner.'
          : `The operation was rejected by the owner${body.reason ? `: ${body.reason}` : '.'}`,
      );
    }

    app.services.audit.record({
      workspaceId: approval.workspaceId,
      actorType: request.actorType ?? 'human',
      actorId: request.user?.id ?? 'owner',
      action: body.approved ? 'approval.granted' : 'approval.rejected',
      targetType: 'approval',
      targetId: approval.id,
      metadata: { executionId: approval.executionId, reason: body.reason },
    });

    return { approval };
  });
}
