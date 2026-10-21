import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { resourceAuthorSchema } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { auditLog } from '../db/schema.js';
import { authorOf } from '../lib/author.js';
import { createTestStack, type TestStack } from './helpers.js';

/**
 * Who made a change, and who did what.
 *
 * The two halves of the product's report on itself are the two questions the
 * substrate has to answer: which resources an agent made, and which
 * operations the trail records. Both are answered by the same thing — a write
 * that names the actor that made it — so the tests are written as data: a
 * resource that records an agent, a resource that records the owner, and an
 * audit entry that names the actor who asked for the change.
 */

/** The id form of an agent connection, as it appears in `createdBy`. */
const AGENT_ID = 'agt_2f9c1d4e5a6b7c8d9e0f1a2b3c4d5e6f';
/** The id form of the owner's user record. */
const OWNER_ID = 'usr_9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

describe('the author a write records', () => {
  it('names an agent by the connection it authenticated as', () => {
    expect(authorOf({ kind: 'agent', agentConnectionId: AGENT_ID })).toBe(AGENT_ID);
  });

  it('names the owner by the user id the request carried', () => {
    expect(authorOf({ kind: 'owner', userId: OWNER_ID })).toBe(OWNER_ID);
  });

  it('names the owner by the literal when the request carried no user id', () => {
    expect(authorOf({ kind: 'owner' })).toBe('owner');
  });

  it('names a write with no authenticated actor the system', () => {
    expect(authorOf({ kind: 'agent' })).toBe('system');
  });

  it('records the agent that made an automation, not a placeholder', () => {
    stack = createTestStack();
    const automation = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'automation',
      title: 'Nightly',
      data: {
        trigger: { type: 'schedule', everyMinutes: 5 },
        action: { type: 'agent.prompt', agentConnectionId: AGENT_ID },
      },
      author: { kind: 'agent', agentConnectionId: AGENT_ID },
    });

    expect(automation.createdBy).toBe(AGENT_ID);
    expect(automation.createdBy).not.toBe('system');
  });

  it('records the agent that made a task, not a placeholder', () => {
    stack = createTestStack();
    const task = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'task',
      title: 'Ship the thing',
      data: {},
      author: { kind: 'agent', agentConnectionId: AGENT_ID },
    });

    expect(task.createdBy).toBe(AGENT_ID);
    expect(task.createdBy).not.toBe('system');
  });

  it('records the owner that made a resource', () => {
    stack = createTestStack();
    const document = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner', userId: OWNER_ID },
    });

    expect(document.createdBy).toBe(OWNER_ID);
  });

  it('records an author the published schema accepts', () => {
    stack = createTestStack();
    const document = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner' },
    });

    expect(resourceAuthorSchema.safeParse(document.createdBy).success).toBe(true);
  });
});

describe('the author over HTTP and over MCP', () => {
  let app: FastifyInstance;
  let dataDir: string;
  let sessionCookie = '';
  let ownerId = '';
  let workspaceId = '';
  let agentToken = '';
  let agentConnectionId = '';

  beforeAll(async () => {
    // The throwaway database lives in a temporary directory, not in the
    // source tree.
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-authorship-'));
    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: dataDir,
      PERSONAL_OS_OWNER_TOKEN: 'authorship-owner-token',
      PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
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
    ownerId = setup.json().user.id as string;

    const workspaces = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: sessionCookie },
    });
    workspaceId = workspaces.json().workspaces[0].id as string;

    const agent = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        name: 'Author',
        adapterType: 'echo',
        config: { reply: 'hi' },
      },
    });
    agentConnectionId = agent.json().agent.id as string;

    const token = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentConnectionId}/tokens`,
      headers: { cookie: sessionCookie },
      payload: { label: 'test' },
    });
    agentToken = token.json().token as string;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** Call one MCP tool as the agent connection. */
  async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
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
        params: { name, arguments: args },
      },
    });
    expect(response.body, response.body).not.toContain('isError');
    return response.body;
  }

  it('records the owner that made an automation over HTTP', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/automations',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        title: 'Nightly',
        trigger: { type: 'schedule', everyMinutes: 5 },
        action: { type: 'agent.prompt', agentConnectionId },
      },
    });
    expect(response.statusCode).toBe(201);

    const created = await app.inject({
      method: 'GET',
      url: `/api/resources?workspaceId=${workspaceId}&type=automation`,
      headers: { cookie: sessionCookie },
    });
    const automation = created
      .json()
      .resources.find((resource: { title: string }) => resource.title === 'Nightly');
    expect(automation.createdBy).toBe(ownerId);
    expect(automation.createdBy).not.toBe('system');
  });

  it('records the owner that made a task over HTTP, and not an author the body asked for', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        title: 'Ship the thing',
        createdBy: AGENT_ID,
      },
    });
    expect(response.statusCode).toBe(201);

    const task = response.json().task as { id: string };
    const resource = await app.inject({
      method: 'GET',
      url: `/api/resources/${task.id}`,
      headers: { cookie: sessionCookie },
    });
    expect(resource.json().resource.createdBy).toBe(ownerId);
    expect(resource.json().resource.createdBy).not.toBe(AGENT_ID);
  });

  it('records the agent that made a task over the MCP surface', async () => {
    await callMcpTool('task.create', { workspaceId, title: 'Written by the agent' });

    const created = await app.inject({
      method: 'GET',
      url: `/api/resources?workspaceId=${workspaceId}&type=task`,
      headers: { cookie: sessionCookie },
    });
    const task = created
      .json()
      .resources.find((resource: { title: string }) => resource.title === 'Written by the agent');
    expect(task.createdBy).toBe(agentConnectionId);
    expect(task.createdBy).not.toBe('system');
  });

  it('records the agent that made an automation over the MCP surface', async () => {
    await callMcpTool('automation.create', {
      workspaceId,
      title: 'Scheduled by the agent',
      trigger: { type: 'schedule', everyMinutes: 5 },
      action: { type: 'agent.prompt', agentConnectionId },
    });

    const created = await app.inject({
      method: 'GET',
      url: `/api/resources?workspaceId=${workspaceId}&type=automation`,
      headers: { cookie: sessionCookie },
    });
    const automation = created
      .json()
      .resources.find((resource: { title: string }) => resource.title === 'Scheduled by the agent');
    expect(automation.createdBy).toBe(agentConnectionId);
    expect(automation.createdBy).not.toBe('system');
  });
});
