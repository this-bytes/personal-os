import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { executions, messages } from '../db/schema.js';
import type { WaitingItem } from '../api/waiting.js';

/**
 * The owner closes a turn they were told to check.
 *
 * The contract promises that an unknown outcome is a question for the owner and
 * only for the owner: "There is no reaper, no redispatch and no reconciliation
 * pass. An unknown outcome is a question for the owner, and only the owner can
 * close it. Every transition into and out of `unknown` is written to the audit
 * trail."
 *
 * For a task that promise was kept through `PATCH /api/tasks/:id`. For a turn
 * there is `POST /api/executions/:id/resolve` — the route that carries the
 * owner's own conclusion, because the product does not know whether the work
 * happened and the owner does.
 *
 * These tests say the whole sentence: an unknown turn reaches the owner, the
 * owner closes it, and the audit trail says so. The last one is the point —
 * a turn that left the unknown state without being written down would be a
 * rewrite of the record rather than a decision.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let ownerId = '';
let conversationId = '';
let agentToken = '';

async function waiting(): Promise<WaitingItem[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingItem[];
}

/**
 * An execution whose outcome could not be confirmed, and the reply that
 * carries it.
 *
 * Only the worker puts an execution into the unknown state, so the test does
 * it through the database rather than through a route that does not exist.
 */
function unknownTurn(executionId: string): void {
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
      id: `msg_${executionId}`,
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
}

function executionRow(executionId: string): { status: string; error: string | null } | undefined {
  return app.services.runtime.db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .get();
}

function messageRow(messageId: string): { status: string; detail: string | null } | undefined {
  return app.services.runtime.db.select().from(messages).where(eq(messages.id, messageId)).get();
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-close-turn-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'close-turn-owner-token',
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
  workspaceId = (workspaces.json().workspaces as Array<{ id: string }>)[0]?.id ?? '';

  const conversation = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title: 'A turn we cannot confirm' },
  });
  conversationId = conversation.json().conversation.id as string;

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, name: 'Turn runner', adapterType: 'echo', config: { reply: 'hi' } },
  });
  const agentId = agent.json().agent.id as string;
  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${agentId}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });
  agentToken = token.json().token as string;
});

afterAll(async () => {
  await app.close();
});

describe('the owner closes a turn they were told to check', () => {
  it('an unknown turn reaches the owner as something to check', async () => {
    unknownTurn('exe_reaches_owner');

    const items = await waiting();
    const item = items.find((entry) => entry.id === 'turn:exe_reaches_owner');

    expect(item, 'the owner is never told about a turn they were told to check').toBeDefined();
    expect(item?.kind).toBe('turn');
    expect(item?.reason).toBe('unknown');
    expect(item?.detail).toMatch(/cannot confirm/i);
  });

  it('the owner closes it, and the turn leaves the waiting list', async () => {
    unknownTurn('exe_owner_closes');

    const closed = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_owner_closes/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });

    expect(closed.statusCode, 'the owner cannot close a turn they were told to check').toBe(200);
    const body = closed.json() as {
      execution: { id: string; status: string };
      outcome: string;
      detail: string;
    };
    expect(body.execution.id).toBe('exe_owner_closes');
    expect(body.execution.status).toBe('completed');
    expect(body.outcome).toBe('completed');

    expect(executionRow('exe_owner_closes')?.status).toBe('completed');

    // The turn was on the list because its outcome could not be confirmed, so
    // an execution that is no longer unknown is no longer waiting on the owner.
    const items = await waiting();
    expect(items.some((entry) => entry.id === 'turn:exe_owner_closes')).toBe(false);
  });

  it('the audit trail says so, and names the owner', async () => {
    unknownTurn('exe_audited');

    const closed = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_audited/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed', note: 'I watched it run.' },
    });
    expect(closed.statusCode).toBe(200);

    const entries = app.services.audit.list(workspaceId, 200);
    const resolved = entries.find(
      (entry) => entry.action === 'execution.outcome.resolved' && entry.targetId === 'exe_audited',
    );

    expect(
      resolved,
      'the turn left the unknown state without being written to the audit trail',
    ).toBeDefined();
    expect(resolved?.actorType).toBe('human');
    expect(resolved?.actorId).toBe(ownerId);
    expect(resolved?.metadata).toMatchObject({ from: 'unknown', to: 'completed' });
    expect((resolved?.metadata as { note?: string })?.note).toBe('I watched it run.');
  });

  it('the reply follows the execution, and carries the sentence the server produced', async () => {
    unknownTurn('exe_reply_follows');

    const closed = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_reply_follows/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });
    expect(closed.statusCode).toBe(200);
    const detail = (closed.json() as { detail: string }).detail;

    // The message status is not the execution status: it carries `complete`
    // where the execution carries `completed`.
    const message = messageRow('msg_exe_reply_follows');
    expect(message?.status).toBe('complete');

    // The sentence is the server's, and it is on the message, so the panel has
    // something to show that is not a bare badge.
    expect(detail).toContain('it did run');
    expect(message?.detail).toBe(detail);
  });

  it('the owner’s own conclusion is recorded, not assumed', async () => {
    unknownTurn('exe_did_not_run');

    const closed = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_did_not_run/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'failed', note: 'It never reached the tool.' },
    });
    expect(closed.statusCode).toBe(200);

    const body = closed.json() as { outcome: string; detail: string };
    expect(body.outcome).toBe('failed');
    expect(body.detail).toContain('it did not run');

    const execution = executionRow('exe_did_not_run');
    expect(execution?.status).toBe('failed');
    // The note is the owner's own words, and it is the reason.
    expect(execution?.error).toBe('It never reached the tool.');
    expect(messageRow('msg_exe_did_not_run')?.status).toBe('failed');
  });

  it('an execution that is not waiting for a conclusion is not settled twice', async () => {
    unknownTurn('exe_settled_once');

    const first = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_settled_once/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_settled_once/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'failed' },
    });
    expect(second.statusCode).toBe(409);
    expect(executionRow('exe_settled_once')?.status).toBe('completed');
  });

  it('the route is the owner’s, and it takes the owner’s conclusion', async () => {
    unknownTurn('exe_owner_only');

    // An agent token is MCP-only: the route is owner-facing, like every other
    // route the owner is the reader of.
    const byAgent = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_owner_only/resolve',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { outcome: 'completed' },
    });
    expect(byAgent.statusCode).toBe(401);

    // The conclusion is the owner's, so the route does not pick one.
    const noConclusion = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_owner_only/resolve',
      headers: { cookie: sessionCookie },
      payload: {},
    });
    expect(noConclusion.statusCode).toBe(422);
    expect(executionRow('exe_owner_only')?.status).toBe('unknown');
  });
});
