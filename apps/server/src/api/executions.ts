import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit, parseBody, requireAuth } from './helpers.js';

const resolveSchema = z.object({
  /** The owner's own conclusion: it did run, or it did not. */
  outcome: z.enum(['completed', 'failed']),
  /** The owner's own words, when they have any. */
  note: z.string().max(2_000).optional(),
});

/**
 * Executions, and the one thing the owner can decide about them.
 *
 * A turn whose outcome could not be confirmed is a question for the owner and
 * only for the owner: the worker stopped and could not say how the turn
 * ended, and the product must not run it again to find out. This route is
 * where the owner's answer is recorded.
 */
export function registerExecutionRoutes(app: FastifyInstance): void {
  app.post('/api/executions/:id/resolve', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(resolveSchema, request.body);

    const resolution = app.services.executions.resolve({
      executionId: id,
      outcome: body.outcome,
      note: body.note,
    });

    // Leaving the unknown state is the owner's answer to the question the
    // worker could not answer, so it is written to the audit trail, beside
    // the task path's own answer. The entry names the owner, because it is
    // the owner's answer and nobody else's.
    audit(
      request,
      'execution.outcome.resolved',
      { type: 'execution', id, workspaceId: resolution.workspaceId },
      { from: 'unknown', to: body.outcome, ...(body.note?.trim() ? { note: body.note } : {}) },
    );

    // The sentence comes back with the answer, so the panel can say what the
    // decision did instead of leaving the owner to infer it.
    return {
      execution: resolution.execution,
      outcome: resolution.outcome,
      detail: resolution.detail,
    };
  });
}
