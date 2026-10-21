import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from './helpers.js';

const measuresQuerySchema = z.object({
  workspaceId: z.string(),
});

/**
 * The product's two measures of itself.
 *
 * Read-only, one workspace, and the same authentication as every other route:
 * a session cookie or the owner token, and never an agent token. The body is
 * the published shape — the workspace, and the two measures.
 */
export function registerMeasuresRoutes(app: FastifyInstance): void {
  app.get('/api/measures', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(measuresQuerySchema, request.query);
    return app.services.measures.measures(workspaceId);
  });
}
