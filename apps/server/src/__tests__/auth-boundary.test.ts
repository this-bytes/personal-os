import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * End-to-end checks of the authorisation boundary.
 *
 * An agent token is scoped to one connection and to the MCP endpoint. It
 * must not be able to reach the owner's HTTP API, and it must not be able
 * to mint the owner token.
 */

let app: FastifyInstance;
let dataDir: string;
let agentToken: string;
/** The session cookie handed out by setup, carried through the test. */
let sessionCookie = '';

const OWNER_TOKEN = 'test-owner-token';

async function setup(): Promise<void> {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-auth-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
    PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });
}

async function setupOwnerAndAgent(): Promise<void> {
  const setupResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setupResponse.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  const workspaceId = workspaces.json().workspaces[0].id as string;

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name: 'Echo',
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  const agentId = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${agentId}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });
  agentToken = token.json().token as string;
}

beforeAll(async () => {
  await setup();
  await setupOwnerAndAgent();
});

afterAll(async () => {
  await app.close();
});

describe('the owner token', () => {
  it('reaches the owner API', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('an agent token', () => {
  it('cannot reach the owner HTTP API', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { authorization: `Bearer ${agentToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('cannot mint the owner token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/owner-token',
      headers: { authorization: `Bearer ${agentToken}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain(OWNER_TOKEN);
  });

  it('cannot read the audit trail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/audit?workspaceId=wsp_1',
      headers: { authorization: `Bearer ${agentToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('cannot list the secret metadata of a workspace', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/secrets?workspaceId=wsp_1',
      headers: { authorization: `Bearer ${agentToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('is accepted by the MCP endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('conversation.post');
  });

  it('cannot mint the owner token through MCP either', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'workspace.list', arguments: {} },
      },
    });
    // The tool is available to an agent, but it must not reveal a token.
    expect(response.body).not.toContain(OWNER_TOKEN);
  });
});

describe('an unauthenticated caller', () => {
  it('cannot reach the API', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workspaces' });
    expect(response.statusCode).toBe(401);
  });

  it('cannot reach MCP', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(response.statusCode).toBe(401);
  });
});
