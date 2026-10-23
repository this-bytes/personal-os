import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { executions, messages } from '../db/schema.js';
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

/** What is waiting on the owner for one conversation. */
async function waitingIn(conversationId: string): Promise<WaitingItem[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}&conversationId=${conversationId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingItem[];
}

/** A conversation to ask about. */
async function createConversation(title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title, routingMode: 'mentions' },
  });
  expect(response.statusCode).toBe(200);
  return response.json().conversation.id as string;
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

/**
 * The urgency order, as CONTRACTS.md publishes it.
 *
 * The waiting list's entry publishes the order the code assembles the list in,
 * as four bands, and says that it is that order. This reads the bands out of
 * the published paragraph so the contract and the route are compared against
 * each other instead of the contract being read on its own: a change to the
 * code's order without a change to the contract fails the comparison below,
 * and so does a change to the contract that the route does not follow.
 */
const PUBLISHED_BANDS: { phrase: string; reason: string }[] = [
  { phrase: 'an agent that cannot continue', reason: 'pending' },
  { phrase: 'the work whose outcome could not be confirmed', reason: 'unknown' },
  { phrase: 'the work waiting for an acceptance decision', reason: 'review' },
  { phrase: 'the work that is stuck', reason: 'blocked' },
];

function publishedUrgencyOrder(): string[] {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');

  const start = text.indexOf('### The waiting list');
  expect(start, 'CONTRACTS.md no longer publishes the waiting list').toBeGreaterThan(-1);
  const end = text.indexOf('\n## ', start + 1);
  const section = text.slice(start, end === -1 ? undefined : end);

  const paragraph = section
    .split(/\n\s*\n/)
    .find((block) => block.includes('The order is the order of urgency'));
  expect(
    paragraph,
    'CONTRACTS.md no longer publishes the order of the waiting list',
  ).not.toBeUndefined();

  // The published paragraph is wrapped, so the phrases are matched on the
  // flattened text: what the contract says, not how the lines fall.
  const flat = paragraph!.replace(/\s+/g, ' ');
  const found = PUBLISHED_BANDS.map((band) => ({ band, at: flat.indexOf(band.phrase) }));
  for (const { band, at } of found) {
    expect(
      at,
      `CONTRACTS.md no longer says "${band.phrase}" in the waiting list's order`,
    ).toBeGreaterThan(-1);
  }
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.band.reason);
}

/**
 * The claim the entry makes about where a turn sorts.
 *
 * The waiting list's entry says the order of the list is over reasons, not
 * kinds, and that an unknown turn sorts where an unknown task sorts. This
 * reads that paragraph, so the claim is checked against the route and not
 * against a copy of it.
 */
function publishedOrderOverReasons(): string {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');

  const start = text.indexOf('### The waiting list');
  expect(start, 'CONTRACTS.md no longer publishes the waiting list').toBeGreaterThan(-1);
  const end = text.indexOf('\n## ', start + 1);
  const section = text.slice(start, end === -1 ? undefined : end);

  const paragraph = section
    .split(/\n\s*\n/)
    .find((block) => block.includes('The order of the list is over reasons, not kinds'));
  expect(
    paragraph,
    'CONTRACTS.md no longer says the order of the waiting list is over reasons, not kinds',
  ).not.toBeUndefined();

  return paragraph!.replace(/\s+/g, ' ');
}

/**
 * An agent turn whose outcome could not be confirmed.
 *
 * The turn is written the way the worker writes it: an execution recorded as
 * `unknown`, and the message that run produced. The owner's own routes cannot
 * produce one, which is the whole reason the kind was published.
 */
async function createUnknownTurn(title: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title },
  });
  expect(created.statusCode).toBe(201);
  const conversationId = created.json().conversation.id as string;
  const executionId = `exe_unknown_${conversationId}`;

  const now = new Date().toISOString();
  app.services.runtime.db
    .insert(executions)
    .values({
      id: executionId,
      workspaceId,
      conversationId,
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'unknown',
      error: 'The agent did not finish within 900s.',
      spendUnits: 0,
      startedAt: now,
      finishedAt: now,
      createdAt: now,
    })
    .run();
  app.services.runtime.db
    .insert(messages)
    .values({
      id: `msg_unknown_${conversationId}`,
      conversationId,
      senderId: 'p_1',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: 'The agent started and then stopped.' }],
      status: 'unknown',
      correlationId: null,
      origin: null,
      executionId,
      createdAt: now,
    })
    .run();

  return conversationId;
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
    if (status === 'unknown') {
      // Only the worker puts a task into the unknown state — the owner's route
      // refuses it — so the service is used, the way unknown-outcome.test.ts
      // does it.
      app.services.factory.updateTask(id, { status: status as never });
    } else {
      const moved = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${id}`,
        headers: { cookie: sessionCookie },
        payload: { status },
      });
      expect(moved.statusCode).toBe(200);
    }
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

  it('can be asked about one conversation, and holds only what belongs to it', async () => {
    // Two rooms, two requests. The owner asks one of them what it is waiting
    // on, and that room's own request is what comes back.
    const first = await createConversation('The first room');
    const second = await createConversation('The second room');
    app.services.approvals.request({
      workspaceId,
      conversationId: first,
      summary: 'A decision in the first room',
    });
    app.services.approvals.request({
      workspaceId,
      conversationId: second,
      summary: 'A decision in the second room',
    });

    const items = await waitingIn(first);
    expect(items.map((item) => item.title)).toEqual(['A decision in the first room']);
  });

  it('does not put a task in a conversation, because a task is decided on the board', async () => {
    await createTask('Waiting for review', 'review');
    const conversation = await createConversation('A room with no request');

    const items = await waitingIn(conversation);
    expect(items).toEqual([]);
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

  it('orders the list by urgency: stopped agents, then the work to check, then decisions, then stuck work', async () => {
    const blocked = await createTask('Stuck', 'blocked');
    const review = await createTask('Waiting', 'review');
    app.services.approvals.request({ workspaceId, summary: 'A decision is wanted' });

    const items = await waiting();
    // The four bands the contract publishes, in the order it publishes them.
    // `unknown` is in here: a band that is not in the map would rank as
    // undefined and the comparison would be meaningless rather than failing.
    const rank: Record<string, number> = { pending: 0, unknown: 1, review: 2, blocked: 3 };
    const reasons = items.map((item) => item.reason);

    // The order is the urgency order, exactly.
    expect(reasons).toEqual([...reasons].sort((a, b) => rank[a]! - rank[b]!));
    expect(items[0]?.reason).toBe('pending');
    expect(items.findIndex((item) => item.taskId === review)).toBeLessThan(
      items.findIndex((item) => item.taskId === blocked),
    );
  });

  it('orders the list the way CONTRACTS.md publishes the urgency order', async () => {
    // The contract publishes the order and says the code assembles the list in
    // that order. The two are compared here, so neither can move alone.
    const unknown = await createTask('Cannot confirm this one', 'unknown');
    const review = await createTask('Waiting for a decision', 'review');
    const blocked = await createTask('Stuck on something', 'blocked');
    app.services.approvals.request({ workspaceId, summary: 'A decision is wanted' });

    const published = publishedUrgencyOrder();
    expect(published, 'the published order must name the four bands').toEqual([
      'pending',
      'unknown',
      'review',
      'blocked',
    ]);

    const items = await waiting();
    const reasons = items.map((item) => item.reason);
    // The bands the route returned, in the order it returned them first.
    const distinct: string[] = reasons.filter((reason, index) => reasons.indexOf(reason) === index);

    expect(distinct, 'the route returned bands the contract does not publish').toEqual(
      published.filter((reason) => distinct.includes(reason)),
    );
    // The band that could not be confirmed comes before the decision, and the
    // decision before the work that is stuck.
    expect(items.findIndex((item) => item.taskId === unknown)).toBeLessThan(
      items.findIndex((item) => item.taskId === review),
    );
    expect(items.findIndex((item) => item.taskId === review)).toBeLessThan(
      items.findIndex((item) => item.taskId === blocked),
    );
  });

  it('sorts an unknown turn where an unknown task sorts, because the order is over reasons', async () => {
    // The entry says the order of the list is over reasons, not kinds: a turn
    // carries the reason its outcome earned, so an unknown turn sorts where an
    // unknown task sorts. The claim is checked against the contract and
    // against the route, so neither can move alone.
    const published = publishedOrderOverReasons();
    expect(
      published,
      'the contract no longer says a turn sorts where an unknown task sorts',
    ).toMatch(/turn .*sorts where an unknown task sorts/i);

    const unknownTask = await createTask('Cannot confirm this task', 'unknown');
    const conversationId = await createUnknownTurn('A turn we cannot confirm');
    const review = await createTask('Waiting for a decision', 'review');
    const blocked = await createTask('Stuck on something', 'blocked');
    app.services.approvals.request({ workspaceId, summary: 'A decision is wanted' });

    const items = await waiting();

    const turn = items.find((entry) => entry.conversationId === conversationId);
    expect(turn, 'the turn is not on the waiting list at all').toBeDefined();
    expect(turn?.kind).toBe('turn');
    expect(turn?.reason).toBe('unknown');

    // The turn and the unknown task are in the same band: both come before the
    // work waiting for a decision, and both before the work that is stuck.
    const firstReview = items.findIndex((item) => item.reason === 'review');
    const firstBlocked = items.findIndex((item) => item.reason === 'blocked');
    expect(items.findIndex((item) => item.taskId === unknownTask)).toBeLessThan(firstReview);
    expect(items.findIndex((item) => item.conversationId === conversationId)).toBeLessThan(
      firstReview,
    );
    expect(items.findIndex((item) => item.conversationId === conversationId)).toBeLessThan(
      firstBlocked,
    );
    expect(items.findIndex((item) => item.taskId === review)).toBeLessThan(firstBlocked);
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
