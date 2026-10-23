import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { automationActionSchema, automationTriggerSchema } from '@personal-os/contracts';
import { audit, parseBody, parseQuery, requestAuthor, requireAuth } from './helpers.js';

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

/**
 * The owner's own conclusion about a run whose outcome could not be confirmed.
 *
 * `completed` says the work happened; `failed` says it did not, or that it
 * failed. Either way the run is over and the job that was held for it is
 * settled.
 */
const resolveRunSchema = z.object({
  outcome: z.enum(['completed', 'failed']),
  note: z.string().max(2_000).optional(),
});

export function registerAutomationRoutes(app: FastifyInstance): void {
  app.get('/api/automations', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    return { automations: app.services.automations.list(workspaceId) };
  });

  app.post('/api/automations', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const automation = app.services.automations.create({
      ...body,
      author: requestAuthor(request),
    });
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
    const automation = app.services.automations.update(id, body);
    audit(request, 'automation.updated', {
      type: 'automation',
      id,
      workspaceId: automation.workspaceId,
    });
    return { automation };
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
    const automation = app.services.automations.get(id);
    app.services.automations.remove(id);
    audit(request, 'automation.removed', {
      type: 'automation',
      id,
      workspaceId: automation.workspaceId,
    });
    return reply.send({ ok: true });
  });

  // The owner's own conclusion about a run whose outcome could not be
  // confirmed. An automation's run has no conversation and no execution, so
  // this is the only way the owner closes the question about it.
  app.post(
    '/api/automations/:id/runs/:runId/resolve',
    { preHandler: requireAuth },
    async (request) => {
      const { id, runId } = request.params as { id: string; runId: string };
      const body = parseBody(resolveRunSchema, request.body);

      // It is the shared capability API that closes the run, so the owner's
      // conclusion here and the agent's `automation.run.resolve` are the same
      // path: one place where the run leaves the unknown state, the job that
      // was held for it is settled, and the trail is written.
      const run = app.services.capabilities.automationRunResolve({
        runId,
        automationId: id,
        outcome: body.outcome,
        note: body.note,
        actorType: request.actorType ?? 'human',
        actorId: request.user?.id ?? 'owner',
      });
      return { run };
    },
  );
}
