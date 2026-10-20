import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({
  workspaceId: z.string(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

/**
 * The audit trail.
 *
 * Read-only: entries are append-only and are written by the server as
 * actions happen.
 */
export function registerAuditRoutes(app: FastifyInstance): void {
  app.get('/api/audit', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, limit } = parseQuery(listQuerySchema, request.query);
    return { entries: app.services.audit.list(workspaceId, limit) };
  });
}
