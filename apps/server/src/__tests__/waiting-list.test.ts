import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * The waiting list.
 *
 * The list is what the owner sees when they open the panel, so it has to
 * answer one question: what is waiting on me? It is assembled by the server
 * in one request, it holds the three things that wait on the owner, and it
 * holds nothing else.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let otherWorkspaceId = '';

interface WaitingItem {
  id: string;
  kind: 'approval' | 'task';
  title: string;
  detail: string;
  reason: 'pending' | 'review' | 'blocked';
  workspaceId: string;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
}

async function waiting(target = workspaceId): Promise<WaitingItem[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${target}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingItem[];
}

async function createTask(title: string, status?: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title, acceptanceCriteria: [] },
  });
  const id = created.json().task.id as string;

  if (status) {
    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: sessionCookie },
      payload: { status },
    });
    expect(moved.statusCode).toBe(200);
  }

  return id;
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-waiting-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'waiting-owner-token',
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
  const body = workspaces.json().workspaces as Array<{ id: string }>;
  workspaceId = body[0]?.id ?? '';

  // A second workspace, so the scoping of the list can be shown.
  const second = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name: 'Another instance' },
  });
  otherWorkspaceId = second.json().workspace.id as string;
});

afterAll(async () => {
  await app.close();
});

describe('the waiting list', () => {
  it('is empty when nothing is waiting', async () => {
    expect(await waiting()).toEqual([]);
  });

  it('lists a task that is waiting for an acceptance decision', async () => {
    const id = await createTask('Waiting for review', 'review');

    const items = await waiting();
    const item = items.find((entry) => entry.taskId === id);

    expect(item).toBeDefined();
    expect(item?.kind).toBe('task');
    expect(item?.reason).toBe('review');
    expect(item?.title).toBe('Waiting for review');
    expect(item?.id).toBe(`task:${id}`);
  });

  it('lists a task that is blocked', async () => {
    const id = await createTask('Stuck on something', 'blocked');

    const item = (await waiting()).find((entry) => entry.taskId === id);

    expect(item?.kind).toBe('task');
    expect(item?.reason).toBe('blocked');
  });

  it('leaves out a task that nobody is waiting on', async () => {
    const id = await createTask('Still in the queue', 'open');

    expect((await waiting()).find((entry) => entry.taskId === id)).toBeUndefined();
  });

  it('lists a pending approval, because an agent is stopped on it', async () => {
    app.services.approvals.request({
      workspaceId,
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_1',
      summary: 'Delete the production database',
    });

    const item = (await waiting()).find((entry) => entry.kind === 'approval');

    expect(item).toBeDefined();
    expect(item?.reason).toBe('pending');
    expect(item?.title).toBe('Delete the production database');
    expect(item?.conversationId).toBe('cnv_1');
  });

  it('drops an approval once it has been decided', async () => {
    const approval = app.services.approvals.list(workspaceId, 'pending')[0]!;
    app.services.approvals.decide(approval.id, {
      approved: true,
      reason: 'It is my own homelab',
      decidedBy: 'usr_1',
    });

    expect((await waiting()).find((entry) => entry.kind === 'approval')).toBeUndefined();
  });

  it('shows one thing once, when an approval on a task is already waiting', async () => {
    const id = await createTask('Approved and waiting', 'review');
    app.services.approvals.request({
      workspaceId,
      taskId: id,
      summary: 'Sign this off before it ships',
    });

    const entries = (await waiting()).filter((entry) => entry.taskId === id);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('approval');
  });

  it('puts the stopped agent first, then the work waiting for a decision', async () => {
    await createTask('Waiting for review', 'review');
    app.services.approvals.request({
      workspaceId,
      conversationId: 'cnv_2',
      summary: 'Run the destructive command',
    });

    const items = await waiting();

    expect(items[0]?.kind).toBe('approval');
    expect(items.some((entry) => entry.reason === 'review')).toBe(true);
  });

  it('does not show the items of another workspace', async () => {
    expect(otherWorkspaceId).not.toBe('');
    expect(await waiting(otherWorkspaceId)).toEqual([]);
  });

  it('is not readable without a session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/waiting?workspaceId=${workspaceId}`,
    });

    expect(response.statusCode).toBe(401);
  });
});
