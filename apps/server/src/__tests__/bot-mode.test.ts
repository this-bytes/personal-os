import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * The bot mode, from the owner's side and from the coordinator's.
 *
 * The owner registers a team, the coordinator hands a piece of work to one of
 * its members, and the work is tracked. The rules that keep it honest — the
 * scope of the coordinator, the grant the connection needs, the authority the
 * delegated work may carry — are checked here, at the boundary a real caller
 * crosses.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let conversationId = '';
let coordinatorId = '';
let workerId = '';
let coordinatorToken = '';
let workerToken = '';

async function createAgent(name: string): Promise<{ id: string; token: string }> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, name, adapterType: 'echo', config: { reply: 'hi' } },
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

async function mcp(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<string> {
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
  return response.body;
}

/** The text of an MCP tool result, out of the JSON-RPC envelope. */
function toolText(body: string): string {
  const data = /data:\s*(\{.*\})/s.exec(body)?.[1];
  if (!data) throw new Error(`no tool result in the response:\n${body}`);
  const envelope = JSON.parse(data) as {
    result?: { content?: { type: string; text?: string }[] };
    error?: { message?: string };
  };
  if (envelope.error) return `error: ${envelope.error.message ?? 'unknown'}`;
  return envelope.result?.content?.[0]?.text ?? '{}';
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-bots-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'bots-owner-token',
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

  const coordinator = await createAgent('Hermes CTO');
  const worker = await createAgent('Scout');
  coordinatorId = coordinator.id;
  workerId = worker.id;
  coordinatorToken = coordinator.token;
  workerToken = worker.token;

  // The coordinator is the one that may delegate, so its connection is the
  // one that is granted the dispatch tool.
  await app.inject({
    method: 'POST',
    url: `/api/agents/${coordinatorId}/grants`,
    headers: { cookie: sessionCookie },
    payload: { tool: 'bot.dispatch' },
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title: 'A team room',
      routingMode: 'coordinator',
      participantAgentConnectionIds: [coordinatorId, workerId],
    },
  });
  conversationId = created.json().conversation.id as string;

  const conversation = await app.inject({
    method: 'GET',
    url: `/api/conversations/${conversationId}`,
    headers: { cookie: sessionCookie },
  });
  const coordinatorParticipant = conversation
    .json()
    .conversation.participants.find(
      (p: { agentConnectionId?: string }) => p.agentConnectionId === coordinatorId,
    );

  await app.inject({
    method: 'PATCH',
    url: `/api/conversations/${conversationId}`,
    headers: { cookie: sessionCookie },
    payload: { coordinatorId: coordinatorParticipant.id },
  });

  // The team: a coordinator that may hand work to one agent, and that agent.
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/bots`,
    headers: { cookie: sessionCookie },
    payload: {
      agentConnectionId: coordinatorId,
      role: 'coordinator',
      scope: { mayDispatch: true, dispatchableAgentConnectionIds: [workerId] },
    },
  });
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/bots`,
    headers: { cookie: sessionCookie },
    payload: { agentConnectionId: workerId, role: 'worker' },
  });

  // The owner speaks, so the coordinator has a turn to delegate from.
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/messages`,
    headers: { cookie: sessionCookie },
    payload: { content: [{ type: 'text', text: 'Please get this done.' }] },
  });
});

afterAll(async () => {
  await app.close();
});

describe('the team of a room', () => {
  it('lists who is in it and what each one may hand over', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversationId}/bots`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      bots: Array<{ agentConnectionId: string; role: string; scope: { mayDispatch: boolean } }>;
      delegatedTasks: unknown[];
    };

    expect(body.bots).toHaveLength(2);
    const coordinator = body.bots.find((bot) => bot.agentConnectionId === coordinatorId);
    expect(coordinator?.role).toBe('coordinator');
    expect(coordinator?.scope.mayDispatch).toBe(true);
    expect(body.delegatedTasks).toEqual([]);
  });

  it('asks for a session, like every other route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversationId}/bots`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('is also readable through the feature’s own route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/features/bots/team?conversationId=${conversationId}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { bots: unknown[]; delegatedTasks: unknown[] };
    expect(body.bots).toHaveLength(2);
  });
});

describe('handing work over', () => {
  it('creates the delegated work, its task and its turn', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/bots/dispatch`,
      headers: { cookie: sessionCookie },
      payload: {
        coordinatorAgentConnectionId: coordinatorId,
        agentConnectionId: workerId,
        instruction: 'Find the answer to the question.',
        title: 'Find the answer',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      delegatedTask: {
        id: string;
        status: string;
        agentConnectionId: string;
        parentAgentConnectionId: string;
        taskId: string;
        childTurnId: string;
        conversationId: string;
        childConversationId: string;
        instruction: string;
        deliveredAt?: string;
        consumedAt?: string;
      };
      taskId: string;
      childTurnId: string;
    };

    expect(body.delegatedTask.status).toBe('queued');
    expect(body.delegatedTask.agentConnectionId).toBe(workerId);
    expect(body.delegatedTask.parentAgentConnectionId).toBe(coordinatorId);
    expect(body.delegatedTask.instruction).toBe('Find the answer to the question.');
    // The work runs in its own room, and the parent's room is not that room.
    expect(body.delegatedTask.childConversationId).not.toBe(body.delegatedTask.conversationId);
    expect(body.delegatedTask.conversationId).toBe(conversationId);
    // It has not been delivered yet, and it has not been consumed.
    expect(body.delegatedTask.deliveredAt).toBeUndefined();
    expect(body.delegatedTask.consumedAt).toBeUndefined();

    // The work is tracked as a task, and the task is not done: an agent
    // reporting completion is not acceptance.
    const task = await app.inject({
      method: 'GET',
      url: `/api/tasks/${body.taskId}`,
      headers: { cookie: sessionCookie },
    });
    expect(task.statusCode).toBe(200);
    const taskBody = task.json() as { task: { status: string; assigneeId: string; title: string } };
    expect(taskBody.task.status).toBe('active');
    expect(taskBody.task.assigneeId).toBe(workerId);
    expect(taskBody.task.title).toBe('Find the answer');
  });

  it('shows the delegation on the turn that handed it over', async () => {
    const team = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversationId}/bots`,
      headers: { cookie: sessionCookie },
    });
    const body = team.json() as { delegatedTasks: Array<{ id: string; childTurnId: string }> };
    const delegation = body.delegatedTasks[0];
    expect(delegation).toBeDefined();
    const childTurnId = delegation!.childTurnId;

    const turn = await app.inject({
      method: 'GET',
      url: `/api/executions/${childTurnId}`,
      headers: { cookie: sessionCookie },
    });

    expect(turn.statusCode).toBe(200);
    const turnBody = turn.json() as {
      execution: { id: string };
      delegationTree: { parent?: { id: string }; children: unknown[] };
    };
    expect(turnBody.execution.id).toBe(childTurnId);
    // The turn that did the work hangs from the turn that handed it over.
    expect(turnBody.delegationTree.parent?.id).toBe(delegation!.id);
    expect(turnBody.delegationTree.children).toEqual([]);
  });

  it('refuses an agent the coordinator’s scope does not name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/bots/dispatch`,
      headers: { cookie: sessionCookie },
      payload: {
        coordinatorAgentConnectionId: coordinatorId,
        agentConnectionId: 'agt_somebody_else',
        instruction: 'Do something nobody asked for.',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('forbidden');
    expect(body.error.message).toContain('not in this room');
  });

  it('refuses a bot whose scope does not let it delegate', async () => {
    // The worker is in the team, but a worker does not hand work over.
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/bots/dispatch`,
      headers: { cookie: sessionCookie },
      payload: {
        coordinatorAgentConnectionId: workerId,
        agentConnectionId: workerId,
        instruction: 'Hand work to yourself.',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json() as { error: { message: string } };
    expect(body.error.message).toContain('may not delegate');
  });

  it('refuses a caller that is not a bot of the room', async () => {
    const outsider = await createAgent('Outsider');
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/bots/dispatch`,
      headers: { cookie: sessionCookie },
      payload: {
        coordinatorAgentConnectionId: outsider.id,
        agentConnectionId: workerId,
        instruction: 'Hand work to somebody.',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json() as { error: { message: string } };
    expect(body.error.message).toContain('Only a bot registered in this room');
  });
});

describe('the dispatch tool', () => {
  it('hands work over for a connection that was granted it', async () => {
    const body = await mcp(coordinatorToken, 'tools/call', {
      name: 'bot.dispatch',
      arguments: {
        conversationId,
        agentConnectionId: workerId,
        instruction: 'Check the logs and report back.',
      },
    });

    const result = JSON.parse(toolText(body)) as {
      delegatedTask: { id: string; status: string; agentConnectionId: string };
      childTurnId: string;
    };

    expect(result.delegatedTask.status).toBe('queued');
    expect(result.delegatedTask.agentConnectionId).toBe(workerId);
    expect(result.childTurnId).toBeTruthy();
  });

  it('is not available to a connection that was not granted it', async () => {
    // The worker was never granted the dispatch tool, so the tool is not
    // registered for it at all — it does not even appear in the list.
    const body = await mcp(workerToken, 'tools/call', {
      name: 'bot.dispatch',
      arguments: {
        conversationId,
        agentConnectionId: workerId,
        instruction: 'Hand work to yourself.',
      },
    });

    expect(toolText(body)).toContain('error');
  });

  it('does not appear in the tool list of a connection that was not granted it', async () => {
    const body = await mcp(workerToken, 'tools/list', {});
    const data = /data:\s*(\{.*\})/s.exec(body)?.[1];
    expect(data).toBeTruthy();

    const envelope = JSON.parse(data!) as { result?: { tools?: Array<{ name: string }> } };
    const names = (envelope.result?.tools ?? []).map((tool) => tool.name);

    expect(names).not.toContain('bot.dispatch');
    expect(names).toContain('conversation.post');
  });
});
