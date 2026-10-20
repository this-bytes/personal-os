import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { mcpToolNames } from '@personal-os/contracts';

/**
 * Per-connection MCP tool grants.
 *
 * An agent token must only see the tools its connection was granted. A tool
 * that was not granted is not registered, so it does not appear in the tool
 * list and cannot be called.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

async function mcp(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method, params },
  });
  return { statusCode: response.statusCode, body: response.body };
}

/** The tool names in a tools/list response. */
function listedTools(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(/"name"\s*:\s*"([a-z.]+)"/g)) {
    const name = match[1];
    if (name && mcpToolNames.includes(name as never)) names.push(name);
  }
  return names;
}

async function createAgent(
  name: string,
  toolGrants?: string[],
): Promise<{ id: string; token: string }> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
      ...(toolGrants ? { toolGrants } : {}),
    },
  });
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });

  return { id, token: token.json().token as string };
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-grants-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'grants-owner-token',
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

describe('MCP tool grants', () => {
  it('shows the owner every tool', async () => {
    const { body } = await mcp('grants-owner-token', 'tools/list', {});
    expect(listedTools(body).sort()).toEqual([...mcpToolNames].sort());
  });

  it('gives an agent the default tool set without workspace.list', async () => {
    const agent = await createAgent('Default');
    const { body } = await mcp(agent.token, 'tools/list', {});
    const tools = listedTools(body);

    expect(tools).toContain('conversation.post');
    expect(tools).toContain('task.create');
    expect(tools).not.toContain('workspace.list');
  });

  it('shows an agent only the tools its connection was granted', async () => {
    const agent = await createAgent('Narrow', ['conversation.read']);
    const { body } = await mcp(agent.token, 'tools/list', {});
    const tools = listedTools(body);

    expect(tools).toEqual(['conversation.read']);
  });

  it('refuses to call a tool that was not granted', async () => {
    const agent = await createAgent('NoTasks', ['conversation.read']);
    const { body } = await mcp(agent.token, 'tools/call', {
      name: 'task.create',
      arguments: { title: 'should not work' },
    });

    // The tool was never registered, so the MCP server cannot route it.
    expect(body).toContain('not found');
    expect(body).toContain('isError');
  });

  it('allows a call to a granted tool', async () => {
    const agent = await createAgent('Reader', ['workspace.list']);
    const { body } = await mcp(agent.token, 'tools/call', {
      name: 'workspace.list',
      arguments: {},
    });

    expect(body).not.toContain('isError');
    expect(body).toContain(workspaceId);
  });

  it('applies a grant change to the next connection', async () => {
    const agent = await createAgent('Changed', ['conversation.read']);

    await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrants: ['task.get'] },
    });

    const { body } = await mcp(agent.token, 'tools/list', {});
    expect(listedTools(body)).toEqual(['task.get']);
  });

  it('reports the effective grants on the agent detail', async () => {
    const agent = await createAgent('Reported', ['conversation.read', 'task.get']);
    const response = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.json().agent.toolGrants.sort()).toEqual(['conversation.read', 'task.get']);
  });

  it('rejects an unknown tool name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        name: 'Bad grants',
        adapterType: 'echo',
        config: {},
        toolGrants: ['conversation.deleteEverything'],
      },
    });

    expect(response.statusCode).toBe(422);
  });
});
