import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { automationActionSchema, automationTriggerSchema } from '@personal-os/contracts';
import { audit, parseBody, parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({ workspaceId: z.string() });

const createSchema = z.object({
  workspaceId: z.string(),
  title: z.string().min(1).max(300),
  trigger: automationTriggerSchema,
  action: automationActionSchema,
});

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  trigger: automationTriggerSchema.optional(),
  action: automationActionSchema.optional(),
});

export function registerAutomationRoutes(app: FastifyInstance): void {
  app.get('/api/automations', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    return { automations: app.services.automations.list(workspaceId) };
  });

  app.post('/api/automations', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const automation = app.services.automations.create(body);
    audit(request, 'automation.created', {
      type: 'automation',
      id: automation.id,
      workspaceId: body.workspaceId,
    });
    return reply.code(201).send({ automation });
  });

  app.get('/api/automations/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return {
      automation: app.services.automations.get(id),
      runs: app.services.automations.listRuns(id),
    };
  });

  app.patch('/api/automations/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSchema, request.body);
    return { automation: app.services.automations.update(id, body) };
  });

  app.post('/api/automations/:id/enable', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const automation = app.services.automations.enable(id);
    audit(request, 'automation.enabled', {
      type: 'automation',
      id,
      workspaceId: automation.workspaceId,
    });
    return { automation };
  });

  app.post('/api/automations/:id/disable', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const automation = app.services.automations.disable(id);
    audit(request, 'automation.disabled', {
      type: 'automation',
      id,
      workspaceId: automation.workspaceId,
    });
    return { automation };
  });

  app.delete('/api/automations/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    app.services.automations.remove(id);
    return reply.send({ ok: true });
  });
}
