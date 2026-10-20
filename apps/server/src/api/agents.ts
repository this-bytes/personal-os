import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adapterTypeSchema, personaSchema, toolGrantListSchema } from '@personal-os/contracts';
import { audit, parseBody, parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({ workspaceId: z.string() });

const createSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1).max(200),
  adapterType: adapterTypeSchema,
  config: z.record(z.unknown()).default({}),
  secrets: z.record(z.string()).optional(),
  /** The MCP tools this connection may call. Omitted means the default set. */
  toolGrants: toolGrantListSchema.optional(),
  /** The base persona: the role and the standing instructions of this agent. */
  persona: personaSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
  /** The MCP tools this connection may call. */
  toolGrants: toolGrantListSchema.optional(),
  /** The base persona. `null` clears it. */
  persona: personaSchema.nullable().optional(),
});

export function registerAgentRoutes(app: FastifyInstance): void {
  app.get('/api/agents', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    return { agents: app.services.agents.list(workspaceId) };
  });

  app.post('/api/agents', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const agent = app.services.agents.create(body);
    audit(
      request,
      'agent.created',
      { type: 'agent', id: agent.id, workspaceId: body.workspaceId },
      {
        adapterType: body.adapterType,
      },
    );
    // Probe immediately so the client sees real capabilities, not guesses.
    const probed = await app.services.agents.probe(agent.id);
    app.services.events.publish({
      type: 'agent.status',
      connectionId: probed.id,
      status: probed.status,
      capabilities: probed.capabilities,
      lastError: probed.lastError,
    });
    return reply.code(201).send({ agent: probed });
  });

  app.get('/api/agents/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { agent: app.services.agents.get(id) };
  });

  app.patch('/api/agents/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSchema, request.body);
    const agent = app.services.agents.update(id, body);
    audit(request, 'agent.updated', { type: 'agent', id, workspaceId: agent.workspaceId });
    return { agent };
  });

  app.delete('/api/agents/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = app.services.agents.get(id);
    app.services.agents.remove(id);
    audit(request, 'agent.removed', { type: 'agent', id, workspaceId: agent.workspaceId });
    return reply.send({ ok: true });
  });

  app.post('/api/agents/:id/probe', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const agent = await app.services.agents.probe(id);
    app.services.events.publish({
      type: 'agent.status',
      connectionId: agent.id,
      status: agent.status,
      capabilities: agent.capabilities,
      lastError: agent.lastError,
    });
    return { agent };
  });

  app.get('/api/agents/:id/tokens', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { tokens: app.services.agentTokens.list(id) };
  });

  app.post('/api/agents/:id/tokens', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(
      z.object({ label: z.string().max(200).default('') }),
      request.body ?? {},
    );
    const issued = app.services.agentTokens.issue(id, body.label);
    audit(request, 'agent.token.issued', { type: 'agent', id });
    // The plaintext token is shown exactly once.
    return reply.code(201).send({ id: issued.id, token: issued.token });
  });

  app.delete(
    '/api/agents/:id/tokens/:tokenId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tokenId } = request.params as { tokenId: string };
      app.services.agentTokens.revoke(tokenId);
      return reply.send({ ok: true });
    },
  );

  app.get('/api/secrets', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    // Only metadata is exposed. Secret values never leave the server.
    return { secrets: app.services.agents.listSecrets(workspaceId) };
  });
}
