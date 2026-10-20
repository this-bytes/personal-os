import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { resolvePersona } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * The persona of an agent.
 *
 * A connection carries the base persona, a conversation may override it for
 * one agent participant, and the panel shows which one is in force. Nothing
 * is reclassified: a connection written before the persona existed stays
 * valid and resolves to the runtime's own default.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-persona-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'persona-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const setup = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setup.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  workspaceId = workspaces.json().workspaces[0].id as string;
});

afterAll(async () => {
  await app.close();
});

/** Create an agent connection, optionally with a base persona. */
async function createAgent(
  name: string,
  persona?: { role?: string; instructions?: string },
): Promise<{ id: string; persona?: { role?: string; instructions?: string } }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
      ...(persona ? { persona } : {}),
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().agent;
}

/** Create a conversation, with the given agent connections participating. */
async function createConversation(agentConnectionIds: string[] = []): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title: 'A conversation',
      routingMode: 'mentions',
      participantAgentConnectionIds: agentConnectionIds,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().conversation.id as string;
}

/** The participants of a conversation, as the API returns them. */
async function participantsOf(
  conversationId: string,
): Promise<Array<{ id: string; agentConnectionId?: string; personaOverride?: unknown }>> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/conversations/${conversationId}`,
    headers: { cookie: sessionCookie },
  });

  expect(response.statusCode).toBe(200);
  return response.json().conversation.participants;
}

describe('the persona of an agent connection', () => {
  it('carries a role and standing instructions', async () => {
    const created = await createAgent('Researcher', {
      role: 'Research assistant',
      instructions: 'Answer with sources.',
    });

    expect(created.persona).toEqual({
      role: 'Research assistant',
      instructions: 'Answer with sources.',
    });
  });

  it('is returned by GET /api/agents/:id', async () => {
    const created = await createAgent('Reader', {
      role: 'Reader',
      instructions: 'Read the whole document first.',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/agents/${created.id}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().agent.persona).toEqual({
      role: 'Reader',
      instructions: 'Read the whole document first.',
    });
  });

  it('can be changed and cleared', async () => {
    const created = await createAgent('Editor', { role: 'Editor' });

    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${created.id}`,
      headers: { cookie: sessionCookie },
      payload: { persona: { role: 'Copy editor', instructions: 'Cut the adjectives.' } },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().agent.persona).toEqual({
      role: 'Copy editor',
      instructions: 'Cut the adjectives.',
    });

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${created.id}`,
      headers: { cookie: sessionCookie },
      payload: { persona: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().agent.persona).toBeUndefined();
  });

  it('leaves a connection written before the persona existed on the default', async () => {
    const created = await createAgent('Plain');

    const resolved = resolvePersona({ base: created.persona });
    expect(resolved.source).toBe('default');
    expect(resolved.persona).toBeUndefined();
  });
});

describe('the persona of a conversation', () => {
  it('can override the persona of a named agent participant', async () => {
    const agent = await createAgent('Base agent', {
      role: 'Connection role',
      instructions: 'Connection instructions',
    });
    const conversationId = await createConversation();

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/participants`,
      headers: { cookie: sessionCookie },
      payload: {
        type: 'agent',
        agentConnectionId: agent.id,
        displayName: 'Base agent',
        personaOverride: { role: 'Conversation role' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().participant.personaOverride).toEqual({ role: 'Conversation role' });
  });

  it('is read back with the conversation, and resolves to the override', async () => {
    const agent = await createAgent('Overridden', {
      role: 'Connection role',
      instructions: 'Connection instructions',
    });
    const conversationId = await createConversation([agent.id]);

    const before = await participantsOf(conversationId);
    const participant = before.find((entry) => entry.agentConnectionId === agent.id);
    expect(participant).toBeTruthy();

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversationId}/participants/${participant?.id}`,
      headers: { cookie: sessionCookie },
      payload: { personaOverride: { role: 'Conversation role' } },
    });
    expect(updated.statusCode).toBe(200);

    const after = await participantsOf(conversationId);
    const read = after.find((entry) => entry.agentConnectionId === agent.id);
    expect(read?.personaOverride).toEqual({ role: 'Conversation role' });

    const resolved = resolvePersona({
      override: read?.personaOverride as { role?: string } | undefined,
      base: agent.persona,
    });
    expect(resolved.source).toBe('conversation');
    expect(resolved.persona?.role).toBe('Conversation role');
  });

  it('replaces the base of an existing participant when it is overridden', async () => {
    const agent = await createAgent('Second', {
      role: 'Connection role',
      instructions: 'Connection instructions',
    });
    const conversationId = await createConversation([agent.id]);

    const before = await participantsOf(conversationId);
    const participant = before.find((entry) => entry.agentConnectionId === agent.id);
    expect(participant).toBeTruthy();

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversationId}/participants/${participant?.id}`,
      headers: { cookie: sessionCookie },
      payload: { personaOverride: { role: 'Conversation role' } },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().participant.personaOverride).toEqual({ role: 'Conversation role' });

    const resolved = resolvePersona({
      override: updated.json().participant.personaOverride,
      base: agent.persona,
    });
    expect(resolved.source).toBe('conversation');
    // The base is replaced, not merged: the connection's instructions do
    // not survive the override.
    expect(resolved.persona?.instructions).toBeUndefined();
  });

  it('clears the override, so the base of the connection is in force again', async () => {
    const agent = await createAgent('Third', { role: 'Connection role' });
    const conversationId = await createConversation([agent.id]);

    const before = await participantsOf(conversationId);
    const participant = before.find((entry) => entry.agentConnectionId === agent.id);
    expect(participant).toBeTruthy();

    const overridden = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversationId}/participants/${participant?.id}`,
      headers: { cookie: sessionCookie },
      payload: { personaOverride: { role: 'Conversation role' } },
    });
    expect(overridden.statusCode).toBe(200);

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversationId}/participants/${participant?.id}`,
      headers: { cookie: sessionCookie },
      payload: { personaOverride: null },
    });

    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().participant.personaOverride).toBeUndefined();

    const resolved = resolvePersona({
      override: cleared.json().participant.personaOverride,
      base: agent.persona,
    });
    expect(resolved.source).toBe('connection');
  });
});
