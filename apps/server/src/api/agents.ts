import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import {
  adapterTypeSchema,
  buildAgentMemoryBrief,
  getAdapterPreset,
  listAdapterPresets,
  listAdapterPresetsFor,
  mcpToolNameSchema,
  parseAdapterConfig,
  personaSchema,
  toolGrantListSchema,
  type AdapterType,
  type Persona,
} from '@personal-os/contracts';
import { listAgentMemories } from '../modules/resources/agent-memory.js';
import { errors } from '../lib/errors.js';
import { audit, parseBody, parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({ workspaceId: z.string() });

const presetQuerySchema = z.object({
  /** The type to filter by. Omitted means every preset. */
  adapterType: adapterTypeSchema.optional(),
});

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
  /**
   * The preset this connection was started from.
   *
   * The preset supplies defaults: its configuration is the base the owner's
   * configuration is laid over, and its persona becomes the base persona when
   * the owner did not write one. It supplies no credential.
   */
  presetId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
  /** The MCP tools this connection may call. */
  toolGrants: toolGrantListSchema.optional(),
  /**
   * The owner's change to the grant.
   *
   * `enable` is what the owner turned on and `disable` is what they turned
   * off. The server applies the change to the grant as it is now, so a
   * widening another writer committed after the client read the grant is not
   * turned back by a save that never touched it.
   */
  toolGrantChange: z
    .object({
      enable: toolGrantListSchema.optional(),
      disable: toolGrantListSchema.optional(),
    })
    .optional(),
  /** The base persona. `null` clears it. */
  persona: personaSchema.nullable().optional(),
});

const widenGrantSchema = z.object({
  /** The one MCP tool the connection may call from now on. */
  tool: mcpToolNameSchema,
});

/** What a preset contributes to a new connection. */
interface PresetApplication {
  /** The configuration to store: the preset's, with the owner's over it. */
  config: Record<string, unknown>;
  /** The credential material, if any was supplied. */
  secrets: Record<string, string>;
  /** The base persona: the owner's, or the preset's. */
  persona: Persona | undefined;
}

/**
 * Lay a preset under the owner's configuration.
 *
 * The preset is a **base**, not a replacement: the owner's fields are laid
 * over it, so every field of the template stays editable, and the merged
 * result is validated with the same parser the stored configuration is
 * validated with. A preset therefore cannot create a connection the server
 * would refuse.
 *
 * A preset carries no credential. One supplied inside the configuration is
 * moved to the secrets, exactly as it is for a configuration sent without a
 * preset.
 */
function applyPreset(
  presetId: string,
  adapterType: AdapterType,
  config: Record<string, unknown>,
  secrets: Record<string, string> | undefined,
): PresetApplication {
  const preset = getAdapterPreset(presetId);
  if (!preset) throw errors.notFound('Adapter preset');
  if (preset.adapterType !== adapterType) {
    throw errors.validation('That preset does not belong to this adapter type.', {
      presetId: preset.id,
      presetAdapterType: preset.adapterType,
      adapterType,
    });
  }

  const merged: Record<string, unknown> = { ...preset.config, ...config };
  // The type the request declares wins: a configuration may not carry one.
  merged['adapterType'] = adapterType;

  const inline: Record<string, string> = { ...(secrets ?? {}) };
  for (const key of ['apiKey', 'authToken'] as const) {
    const value = merged[key];
    if (typeof value === 'string' && value.length > 0) {
      inline[key] = value;
      delete merged[key];
    }
  }

  let validated: Record<string, unknown>;
  try {
    validated = parseAdapterConfig(merged) as unknown as Record<string, unknown>;
  } catch (error) {
    throw errors.validation('The configuration is not valid for this adapter type.', {
      issues: error instanceof ZodError ? error.flatten() : String(error),
    });
  }

  // The stored record holds the configuration on its own; the type is stored
  // beside it.
  delete validated['adapterType'];

  return { config: validated, secrets: inline, persona: preset.persona };
}

export function registerAgentRoutes(app: FastifyInstance): void {
  app.get('/api/agents', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    return { agents: app.services.agents.list(workspaceId) };
  });

  /**
   * The preset catalogue.
   *
   * It is published data with no credential in it: the catalogue names the
   * credential a connection needs, and never a value.
   */
  app.get('/api/agent-presets', { preHandler: requireAuth }, async (request) => {
    const { adapterType } = parseQuery(presetQuerySchema, request.query);
    return {
      presets: adapterType ? listAdapterPresetsFor(adapterType) : listAdapterPresets(),
    };
  });

  app.post('/api/agents', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const applied = body.presetId
      ? applyPreset(body.presetId, body.adapterType, body.config, body.secrets)
      : undefined;
    // The owner's persona wins; the preset's is the base when there is none.
    const persona = body.persona ?? applied?.persona;
    const secrets = applied ? applied.secrets : body.secrets;

    const agent = app.services.agents.create({
      workspaceId: body.workspaceId,
      name: body.name,
      adapterType: body.adapterType,
      config: applied ? applied.config : body.config,
      ...(secrets && Object.keys(secrets).length > 0 ? { secrets } : {}),
      ...(body.toolGrants ? { toolGrants: body.toolGrants } : {}),
      ...(persona ? { persona } : {}),
    });
    audit(
      request,
      'agent.created',
      { type: 'agent', id: agent.id, workspaceId: body.workspaceId },
      {
        adapterType: body.adapterType,
        ...(body.presetId ? { presetId: body.presetId } : {}),
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

  app.post('/api/agents/:id/grants', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(widenGrantSchema, request.body);
    // The grant is widened and never narrowed. The owner takes one capability
    // out of the wait and the rest of the grant stays as it was, so the
    // action a blocked agent needs is one that cannot take anything away.
    //
    // The union is computed inside the transaction that writes the grant, and
    // that transaction takes the write lock before it reads. A read taken
    // here, outside the transaction, can be stale by the time the write lands:
    // another process's widening that committed in between would be
    // overwritten by a union computed from the old grant, and the owner's
    // other action would be silently lost.
    const agent = app.services.agents.update(id, { widenToolGrant: body.tool });
    audit(
      request,
      'agent.grant.widened',
      { type: 'agent', id, workspaceId: agent.workspaceId },
      {
        tool: body.tool,
      },
    );
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
    audit(request, 'agent.probed', { type: 'agent', id, workspaceId: agent.workspaceId });
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
      const { id, tokenId } = request.params as { id: string; tokenId: string };
      const agent = app.services.agents.get(id);
      app.services.agentTokens.revoke(tokenId);
      audit(request, 'agent.token.revoked', { type: 'agent', id, workspaceId: agent.workspaceId });
      return reply.send({ ok: true });
    },
  );

  app.get('/api/agents/:id/memories', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const agent = app.services.agents.get(id);
    const memories = listAgentMemories(app.services.runtime.db, agent.workspaceId, agent.id);
    const brief = buildAgentMemoryBrief(memories);
    const inBrief = new Set(brief.entries.map((entry) => entry.id));

    return {
      memories: memories.map((memory) => ({ ...memory, inBrief: inBrief.has(memory.id) })),
      budget: brief.budget,
      used: brief.used,
      dropped: brief.dropped,
    };
  });

  app.get('/api/secrets', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(listQuerySchema, request.query);
    // Only metadata is exposed. Secret values never leave the server.
    return { secrets: app.services.agents.listSecrets(workspaceId) };
  });
}
