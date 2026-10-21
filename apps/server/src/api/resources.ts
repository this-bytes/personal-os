import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resourceTypeSchema } from '@personal-os/contracts';
import { audit, parseBody, parseQuery, requestAuthor, requireAuth } from './helpers.js';

const listQuerySchema = z.object({
  workspaceId: z.string(),
  type: resourceTypeSchema.optional(),
});

const createSchema = z.object({
  workspaceId: z.string(),
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  data: z.unknown().default({}),
});

const updateSchema = z.object({
  expectedRevision: z.number().int().min(1),
  title: z.string().min(1).max(300).optional(),
  data: z.unknown().optional(),
});

export function registerResourceRoutes(app: FastifyInstance): void {
  app.get('/api/resources', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, type } = parseQuery(listQuerySchema, request.query);
    return { resources: app.services.resources.list(workspaceId, type) };
  });

  app.post('/api/resources', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const resource = app.services.resources.create({
      workspaceId: body.workspaceId,
      type: body.type,
      title: body.title,
      data: body.data ?? {},
      author: requestAuthor(request),
    });
    audit(
      request,
      'resource.created',
      { type: 'resource', id: resource.id, workspaceId: body.workspaceId },
      {
        resourceType: body.type,
      },
    );
    return reply.code(201).send({ resource });
  });

  app.get('/api/resources/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { resource: app.services.resources.get(id) };
  });

  app.patch('/api/resources/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSchema, request.body);
    const resource = app.services.resources.update(id, body);
    audit(
      request,
      'resource.updated',
      { type: 'resource', id, workspaceId: resource.workspaceId },
      {
        expectedRevision: body.expectedRevision,
      },
    );
    return { resource };
  });

  app.post('/api/resources/:id/publish', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const resource = app.services.resources.publish(id);
    audit(request, 'resource.published', {
      type: 'resource',
      id,
      workspaceId: resource.workspaceId,
    });
    return { resource };
  });

  app.post('/api/resources/:id/execute', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const resource = app.services.resources.get(id);
    const result = await app.services.resources.execute(id);
    audit(request, 'resource.executed', {
      type: 'resource',
      id,
      workspaceId: resource.workspaceId,
    });
    return { result };
  });

  app.get('/api/resources/:id/inspect', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.resources.inspect(id);
  });
}
