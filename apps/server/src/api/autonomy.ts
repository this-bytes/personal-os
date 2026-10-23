import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import { parseQuery, requireAuth } from './helpers.js';

const policyQuerySchema = z.object({
  workspaceId: z.string(),
  goalId: z.string().optional(),
  conversationId: z.string().optional(),
});

/**
 * The autonomy policy in force.
 *
 * The strictest of the workspace's policy, the goal's policy and the
 * conversation's own safeguards — what an agent may do here, and what it may
 * not. A policy that cannot be read is a policy nobody can trust, so it is
 * readable over the API as well as in the MCP surface.
 */
export function registerAutonomyRoutes(app: FastifyInstance): void {
  app.get('/api/autonomy-policy', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, goalId, conversationId } = parseQuery(policyQuerySchema, request.query);
    return {
      policy: app.services.capabilities.effectiveAutonomyPolicy({
        workspaceId,
        ...(goalId ? { goalId } : {}),
        ...(conversationId ? { conversationId } : {}),
      }),
    };
  });
}
