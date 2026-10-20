import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * An agent's memory of its own.
 *
 * The memory belongs to the agent connection: it follows the agent into
 * every conversation it takes part in and reaches no other agent's turns.
 * The other three scopes keep their meaning exactly, and nothing is
 * reclassified — the `agent` scope applies only to what is written after
 * this.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-agent-memory-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'memory-owner-token',
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

/** An agent connection, with an MCP token for it. */
async function createAgent(name: string): Promise<{ id: string; token: string }> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });

  return { id, token: token.json().token as string };
}

/** Write a memory resource. */
async function writeMemory(
  title: string,
  data: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, type: 'memory', title, data },
  });
  return { statusCode: response.statusCode, body: response.body };
}

/** The memories the panel shows for one agent. */
async function memoriesOf(agentId: string): Promise<{
  memories: Array<{
    id: string;
    key: string;
    value: unknown;
    updatedAt: string;
    pinned: boolean;
    inBrief: boolean;
  }>;
  budget: number;
  used: number;
  dropped: number;
}> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/agents/${agentId}/memories`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

/** Call an MCP tool with an agent's token. */
async function mcp(token: string, name: string, args: Record<string, unknown>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  return response.body;
}

describe("an agent's own memory", () => {
  it('shows what the agent remembers, and when it was written', async () => {
    const agent = await createAgent('Rememberer');
    const written = await writeMemory('The owner prefers sources', {
      scope: 'agent',
      agentConnectionId: agent.id,
      key: 'prefers',
      value: 'answer with sources',
      tags: [],
    });
    expect(written.statusCode).toBe(201);

    const response = await memoriesOf(agent.id);

    expect(response.memories).toHaveLength(1);
    expect(response.memories[0]?.key).toBe('prefers');
    expect(response.memories[0]?.value).toBe('answer with sources');
    expect(response.memories[0]?.updatedAt).toBeTruthy();
    expect(response.memories[0]?.inBrief).toBe(true);
    expect(response.budget).toBe(6_000);
  });

  it('keeps another agent’s memory out of it', async () => {
    const first = await createAgent('First');
    const second = await createAgent('Second');

    await writeMemory('The first agent knows this', {
      scope: 'agent',
      agentConnectionId: first.id,
      key: 'secret',
      value: 'the first agent only',
      tags: [],
    });

    const response = await memoriesOf(second.id);

    expect(response.memories).toHaveLength(0);
  });

  it('leaves the memories of the other scopes alone', async () => {
    const agent = await createAgent('Unscoped');

    await writeMemory('A workspace memory', {
      scope: 'workspace',
      key: 'shared',
      value: 'not this agent’s',
      tags: [],
    });

    const response = await memoriesOf(agent.id);

    expect(response.memories).toHaveLength(0);
  });

  it('refuses a memory scoped to an agent that names nobody', async () => {
    const written = await writeMemory('Nobody’s memory', {
      scope: 'agent',
      key: 'orphan',
      value: 'belongs to nobody',
      tags: [],
    });

    expect(written.statusCode).toBe(422);
  });

  it('lets the owner write into any agent’s memory', async () => {
    const agent = await createAgent('Owned');

    const written = await writeMemory('The owner says so', {
      scope: 'agent',
      agentConnectionId: agent.id,
      key: 'from-the-owner',
      value: 'written by the owner',
      tags: ['pinned'],
    });

    expect(written.statusCode).toBe(201);
    const response = await memoriesOf(agent.id);
    expect(response.memories[0]?.pinned).toBe(true);
  });

  it('does not let an agent write into another agent’s memory', async () => {
    const writer = await createAgent('Writer');
    const other = await createAgent('Other');

    const body = await mcp(writer.token, 'resource.create', {
      type: 'memory',
      title: 'Not mine',
      data: { scope: 'agent', agentConnectionId: other.id, key: 'injected', value: 'words' },
    });

    expect(body).toContain('isError');
    expect(body).toContain('its own memory');

    const response = await memoriesOf(other.id);
    expect(response.memories).toHaveLength(0);
  });

  it('lets an agent write into its own memory', async () => {
    const agent = await createAgent('Self');

    const body = await mcp(agent.token, 'resource.create', {
      type: 'memory',
      title: 'Mine',
      data: { scope: 'agent', agentConnectionId: agent.id, key: 'own', value: 'my own memory' },
    });

    expect(body).not.toContain('isError');
    const response = await memoriesOf(agent.id);
    expect(response.memories).toHaveLength(1);
    expect(response.memories[0]?.key).toBe('own');
  });
});
