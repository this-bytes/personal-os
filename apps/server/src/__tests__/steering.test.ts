import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { executions, messages } from '../db/schema.js';
import { planSteer } from '../modules/conversations/steer.js';

/**
 * Steering: a message the owner sends into the turn that is running.
 *
 * The rules are checked twice. As pure functions, because a rule that needs a
 * database to be wrong is a rule that is hard to reason about. And at the
 * boundary a real caller crosses, because a rule that is right and a product
 * that does not follow it are two different states of the world.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let agentId = '';
let conversationId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-steering-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'steering-owner-token',
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
  workspaceId = (workspaces.json().workspaces as Array<{ id: string }>)[0]?.id ?? '';

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, name: 'Wren', adapterType: 'echo', config: { reply: 'hi' } },
  });
  agentId = agent.json().agent.id as string;

  const conversation = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title: 'The room',
      routingMode: 'mentions',
      participantAgentConnectionIds: [agentId],
    },
  });
  conversationId = conversation.json().conversation.id as string;
});

afterAll(async () => {
  await app.close();
});

/** A room of its own, so one test's turn is not another test's turn. */
async function createConversation(title: string): Promise<string> {
  const conversation = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title,
      routingMode: 'mentions',
      participantAgentConnectionIds: [agentId],
    },
  });
  return conversation.json().conversation.id as string;
}

/** Write a turn the way the worker writes one: it is running. */
function writeRunningTurn(id: string, conversation: string = conversationId): void {
  const now = new Date().toISOString();
  app.services.runtime.db
    .insert(executions)
    .values({
      id,
      workspaceId,
      conversationId: conversation,
      taskId: null,
      externalRef: null,
      agentConnectionId: agentId,
      executionOwner: 'personal-os',
      status: 'running',
      error: null,
      spendUnits: 0,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    })
    .run();
}

/** Post a message, the way the composer does. */
async function post(
  content: Array<Record<string, unknown>>,
  delivery?: 'steer' | 'queue',
  conversation: string = conversationId,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversation}/messages`,
    headers: { cookie: sessionCookie },
    payload: { content, ...(delivery ? { delivery } : {}) },
  });
  return { status: response.statusCode, body: response.json() };
}

describe('the rules of a steer', () => {
  const participants = [
    { id: 'prt_owner', type: 'human' as const, displayName: 'Owner' },
    { id: 'prt_wren', type: 'agent' as const, displayName: 'Wren', agentConnectionId: 'agt_wren' },
    {
      id: 'prt_other',
      type: 'agent' as const,
      displayName: 'Other',
      agentConnectionId: 'agt_other',
    },
  ];

  it('goes into the turn that is running when the message names nobody', () => {
    const plan = planSteer({
      participants,
      text: 'do it differently',
      runningTurns: [{ executionId: 'exe_1', agentConnectionId: 'agt_wren' }],
      acceptsSteering: () => true,
    });

    expect(plan.deliverable).toBe(true);
    expect(plan.agentConnectionId).toBe('agt_wren');
    expect(plan.executionId).toBe('exe_1');
    expect(plan.participantId).toBe('prt_wren');
  });

  it('goes into the turn of the agent the message names', () => {
    const plan = planSteer({
      participants,
      text: '@Other do it differently',
      runningTurns: [
        { executionId: 'exe_1', agentConnectionId: 'agt_wren' },
        { executionId: 'exe_2', agentConnectionId: 'agt_other' },
      ],
      acceptsSteering: () => true,
    });

    expect(plan.deliverable).toBe(true);
    expect(plan.agentConnectionId).toBe('agt_other');
    expect(plan.executionId).toBe('exe_2');
  });

  it('is not a steer when no turn is running', () => {
    const plan = planSteer({
      participants,
      text: '@Wren do it differently',
      runningTurns: [],
      acceptsSteering: () => true,
    });

    expect(plan.deliverable).toBe(false);
    expect(plan.reason).toContain('No turn is running');
  });

  it('is not a steer when the connection cannot take input', () => {
    const plan = planSteer({
      participants,
      text: '@Wren do it differently',
      runningTurns: [{ executionId: 'exe_1', agentConnectionId: 'agt_wren' }],
      acceptsSteering: () => false,
    });

    expect(plan.deliverable).toBe(false);
    expect(plan.reason).toContain('cannot take input');
  });

  it('is not a steer when the message names more than one agent', () => {
    const plan = planSteer({
      participants,
      text: '@Wren @Other do it differently',
      runningTurns: [{ executionId: 'exe_1', agentConnectionId: 'agt_wren' }],
      acceptsSteering: () => true,
    });

    expect(plan.deliverable).toBe(false);
    expect(plan.reason).toContain('more than one agent');
  });

  it('is not a steer when two turns are running and the message names nobody', () => {
    const plan = planSteer({
      participants,
      text: 'do it differently',
      runningTurns: [
        { executionId: 'exe_1', agentConnectionId: 'agt_wren' },
        { executionId: 'exe_2', agentConnectionId: 'agt_other' },
      ],
      acceptsSteering: () => true,
    });

    expect(plan.deliverable).toBe(false);
    expect(plan.reason).toContain('More than one turn is running');
  });
});

describe('the route a steer crosses', () => {
  it('delivers the message into the turn that is running, and starts no turn', async () => {
    writeRunningTurn('exe_steer_1');

    const posted = await post([{ type: 'text', text: '@Wren do it differently' }], 'steer');

    expect(posted.status).toBe(201);
    expect(posted.body['steer']).toMatchObject({ delivered: true, agentConnectionId: agentId });

    const messageId = (posted.body['message'] as { id: string }).id;
    const row = app.services.runtime.db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    expect(row?.delivery).toBe('steer');
    // The message is for the agent the turn runs, and for nobody else.
    expect(row?.targetParticipantIds).toHaveLength(1);

    // No turn of its own: a steer goes into the turn that is running.
    const turns = app.services.runtime.db
      .select()
      .from(executions)
      .where(eq(executions.conversationId, conversationId))
      .all();
    expect(turns).toHaveLength(1);
  });

  it('queues the message and says why when no turn is running', async () => {
    const quiet = await createConversation('A quiet room');
    const posted = await post([{ type: 'text', text: '@Wren do it differently' }], 'steer', quiet);

    expect(posted.status).toBe(201);
    expect(posted.body['steer']).toMatchObject({ delivered: false });
    expect((posted.body['steer'] as { reason: string }).reason).toContain('No turn is running');

    const messageId = (posted.body['message'] as { id: string }).id;
    const row = app.services.runtime.db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    // A steer that cannot be delivered is a queued message, and it is queued.
    expect(row?.delivery).toBe('queue');
  });

  it('says a steer is available while the turn that can take one is running', async () => {
    const executionId = 'exe_steer_2';
    writeRunningTurn(executionId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}`,
      headers: { cookie: sessionCookie },
    });

    const run = response.json().run as {
      options: Array<{ operation: string; available: boolean; reason: string | null }>;
    };
    const steer = run.options.find((option) => option.operation === 'steer');

    expect(steer?.available).toBe(true);
  });
});
