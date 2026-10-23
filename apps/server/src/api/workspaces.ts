import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import { autonomyModeSchema, autonomyPolicyPatchSchema } from '@personal-os/contracts';
import { audit, parseBody, requireAuth } from './helpers.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).default(''),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2_000).optional(),
  autonomyMode: autonomyModeSchema.optional(),
  autonomyPolicy: autonomyPolicyPatchSchema.optional(),
});

export function registerWorkspaceRoutes(app: FastifyInstance): void {
  app.get('/api/workspaces', { preHandler: requireAuth }, async () => ({
    workspaces: app.services.workspaces.list(),
  }));

  app.post('/api/workspaces', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createWorkspaceSchema, request.body);
    const workspace = app.services.workspaces.create(body);
    // The workspace does not exist until this call returns, so the entry is
    // an instance-level one, like the auth events, and it is not scoped to a
    // workspace's trail.
    audit(request, 'workspace.created', { type: 'workspace', id: workspace.id });
    return reply.code(201).send({ workspace });
  });

  app.get('/api/workspaces/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { workspace: app.services.workspaces.get(id) };
  });

  app.patch('/api/workspaces/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateWorkspaceSchema, request.body);
    const workspace = app.services.workspaces.update(id, body);
    audit(
      request,
      'workspace.updated',
      {
        type: 'workspace',
        id,
        workspaceId: workspace.id,
      },
      body.autonomyPolicy !== undefined ? { autonomyPolicy: body.autonomyPolicy } : undefined,
    );
    return { workspace };
  });
}
