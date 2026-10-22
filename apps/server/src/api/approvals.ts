import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody, parseQuery, requireAuth } from './helpers.js';
import { decideApproval } from '../modules/approvals/resume.js';

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

  // The evidence a decision is taken against: the owner decides on two buttons
  // and a title, and this is what the buttons are about. Read-only, one
  // approval, and the same authentication as every other route — a session
  // cookie or the owner token, and never an agent token.
  app.get('/api/approvals/:id/evidence', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.approvals.evidence(id);
  });

  app.post('/api/approvals/:id/decide', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(decideSchema, request.body);

    // The decision has to change the outcome of the operation that asked for
    // it. An approval that changes nothing is not an approval. The decision
    // is recorded first, and only then is the turn continued or closed.
    const decision = decideApproval({
      db: app.services.runtime.db,
      queue: app.services.queue,
      audit: app.services.audit,
      events: app.services.events,
      approvals: app.services.approvals,
      approvalId: id,
      approved: body.approved,
      reason: body.reason,
      decidedBy: request.user?.id ?? 'owner',
      actorType: request.actorType ?? 'human',
    });

    return {
      approval: decision.approval,
      execution: decision.execution,
      outcome: decision.outcome,
      detail: decision.detail,
    };
  });
}
