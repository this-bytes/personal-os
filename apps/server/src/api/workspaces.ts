import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody, requireAuth } from './helpers.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).default(''),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2_000).optional(),
  autonomyMode: z.enum(['manual', 'assisted', 'autonomous']).optional(),
});

export function registerWorkspaceRoutes(app: FastifyInstance): void {
  app.get('/api/workspaces', { preHandler: requireAuth }, async () => ({
    workspaces: app.services.workspaces.list(),
  }));

  app.post('/api/workspaces', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createWorkspaceSchema, request.body);
    return reply.code(201).send({ workspace: app.services.workspaces.create(body) });
  });

  app.get('/api/workspaces/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { workspace: app.services.workspaces.get(id) };
  });

  app.patch('/api/workspaces/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateWorkspaceSchema, request.body);
    return { workspace: app.services.workspaces.update(id, body) };
  });
}
