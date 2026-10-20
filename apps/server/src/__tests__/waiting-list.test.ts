import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import type { WaitingItem } from '../api/waiting.js';

/**
 * The waiting list.
 *
 * The list is what the owner sees when they open the panel, so it has to
 * answer one question: what is waiting on me? It is assembled by the server
 * in one request, it holds the three things that wait on the owner, and it
 * holds nothing else.
 *
 * The shape it returns is published in CONTRACTS.md, so the shape is checked
 * against the published document rather than against a copy of it: a list
 * that quietly grows a field, or loses one, is a contract that has changed
 * without anyone saying so.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let otherWorkspaceId = '';

async function waiting(target = workspaceId): Promise<WaitingItem[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${target}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingItem[];
}

/** The `WaitingItem` interface as CONTRACTS.md publishes it. */
function publishedWaitingItem(): Record<string, string> {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const block = /interface WaitingItem \{([\s\S]*?)\n\}/.exec(text);
  expect(block, 'CONTRACTS.md no longer publishes WaitingItem').not.toBeNull();
  if (!block) throw new Error('CONTRACTS.md no longer publishes WaitingItem');

  const fields: Record<string, string> = {};
  for (const line of block[1]!.split('\n')) {
    const field = /^\s*(\w+):\s*([A-Za-z0-9_| ]+);/.exec(line);
    if (field) fields[field[1]!] = field[2]!.trim();
  }
  expect(Object.keys(fields).length).toBeGreaterThan(0);
  return fields;
}

/** The kinds and reasons CONTRACTS.md publishes. */
function publishedEnums(): Record<string, string[]> {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const kinds = /type WaitingKind = ([^;]+);/.exec(text);
  const reasons = /type WaitingReason = ([^;]+);/.exec(text);
  expect(kinds, 'CONTRACTS.md no longer publishes WaitingKind').not.toBeNull();
  expect(reasons, 'CONTRACTS.md no longer publishes WaitingReason').not.toBeNull();
  const list = (match: RegExpExecArray): string[] =>
    match[1]!
      .split('|')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  return { WaitingKind: list(kinds!), WaitingReason: list(reasons!) };
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

describe('the shape of the list', () => {
  it('is the shape CONTRACTS.md publishes, field for field', async () => {
    await createTask('Published shape', 'review');
    app.services.approvals.request({ workspaceId, summary: 'A decision is wanted' });

    const items = await waiting();
    expect(items.length).toBeGreaterThan(0);

    const published = publishedWaitingItem();
    const enums = publishedEnums();

    for (const item of items) {
      // Exactly the published fields: no more, no fewer.
      expect(Object.keys(item).sort()).toEqual(Object.keys(published).sort());

      for (const [name, type] of Object.entries(published)) {
        const value = (item as unknown as Record<string, unknown>)[name];
        if (type === 'string') {
          expect(typeof value, `${name} should be a string`).toBe('string');
        } else if (type === 'string | null') {
          expect(
            value === null || typeof value === 'string',
            `${name} should be a string or null`,
          ).toBe(true);
        } else if (type === 'WaitingKind') {
          expect(enums['WaitingKind']).toContain(value);
        } else if (type === 'WaitingReason') {
          expect(enums['WaitingReason']).toContain(value);
        } else {
          throw new Error(`CONTRACTS.md publishes an unknown type for ${name}: ${type}`);
        }
      }
    }
  });

  it('never lists the same thing twice', async () => {
    await createTask('Listed once', 'review');
    await createTask('Listed once too', 'blocked');
    app.services.approvals.request({ workspaceId, summary: 'One decision' });
    app.services.approvals.request({ workspaceId, summary: 'Another decision' });

    const items = await waiting();
    const ids = items.map((item) => item.id);

    expect(new Set(ids).size, `the list has a duplicate: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('orders the list by urgency: stopped agents, then decisions, then stuck work', async () => {
    const blocked = await createTask('Stuck', 'blocked');
    const review = await createTask('Waiting', 'review');
    app.services.approvals.request({ workspaceId, summary: 'A decision is wanted' });

    const items = await waiting();
    const rank: Record<string, number> = { pending: 0, review: 1, blocked: 2 };
    const reasons = items.map((item) => item.reason);

    // The order is the urgency order, exactly.
    expect(reasons).toEqual([...reasons].sort((a, b) => rank[a]! - rank[b]!));
    expect(items[0]?.reason).toBe('pending');
    expect(items.findIndex((item) => item.taskId === review)).toBeLessThan(
      items.findIndex((item) => item.taskId === blocked),
    );
  });

  it('says which agent is waiting, and where the item came from', async () => {
    const id = await createTask('Waiting for an agent', 'review');
    await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: sessionCookie },
      payload: { assigneeId: 'agt_waiting' },
    });
    app.services.approvals.request({
      workspaceId,
      conversationId: 'cnv_agent',
      agentConnectionId: 'agt_stopped',
      summary: 'A stopped agent wants a decision',
    });

    const items = await waiting();

    const approval = items.find((item) => item.kind === 'approval');
    expect(approval?.agentConnectionId).toBe('agt_stopped');
    expect(approval?.conversationId).toBe('cnv_agent');

    const task = items.find((item) => item.taskId === id);
    expect(task?.agentConnectionId).toBe('agt_waiting');
  });
});

describe('the edges of the list', () => {
  it('lists an approval that belongs to no task, without hiding the task', async () => {
    // An approval with no task is an agent stopped on a decision, not a task
    // waiting. It is its own entry, and it hides nothing.
    const id = await createTask('A task that is its own thing', 'review');
    app.services.approvals.request({ workspaceId, summary: 'A decision with no task' });

    const items = await waiting();

    const approval = items.find((item) => item.kind === 'approval' && item.taskId === null);
    expect(approval).toBeDefined();
    expect(approval?.reason).toBe('pending');
    expect(items.some((item) => item.taskId === id)).toBe(true);
  });

  it('lists two approvals on one task as two decisions, and the task once', async () => {
    const id = await createTask('Two decisions on one task', 'review');
    app.services.approvals.request({ workspaceId, taskId: id, summary: 'The first decision' });
    app.services.approvals.request({ workspaceId, taskId: id, summary: 'The second decision' });

    const items = await waiting();
    const onThatTask = items.filter((item) => item.taskId === id);

    // Two pending decisions are two things the owner has to answer.
    expect(onThatTask).toHaveLength(2);
    expect(onThatTask.every((item) => item.kind === 'approval')).toBe(true);
    // And the task itself is not listed beside them.
    expect(items.filter((item) => item.kind === 'task' && item.taskId === id)).toHaveLength(0);
  });

  it('needs a workspace', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/waiting',
      headers: { cookie: sessionCookie },
    });

    // 422 is what every route answers a failed query schema with.
    expect(response.statusCode).toBe(422);
  });

  it('is empty for a workspace that does not exist', async () => {
    expect(await waiting('wsp_not_a_workspace')).toEqual([]);
  });

  it('is not readable with an agent token', async () => {
    // An agent's own token is scoped to its connection. The owner's inbox is
    // not something an agent may read.
    const response = await app.inject({
      method: 'GET',
      url: `/api/waiting?workspaceId=${workspaceId}`,
      headers: { authorization: 'Bearer not-an-owner-token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('is readable with the static owner token, because that is the owner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/waiting?workspaceId=${workspaceId}`,
      headers: { authorization: 'Bearer waiting-owner-token' },
    });

    expect(response.statusCode).toBe(200);
  });
});
