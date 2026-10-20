import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * Who may hand the turn over in coordinator mode.
 *
 * The rule is published, not invented: `CONTRACTS.md` lists "Only one owner is
 * responsible for coordinating a particular delegation" as a mandatory routing
 * safeguard, and the coordinator mode promises that a designated agent
 * delegates. So in coordinator mode a message from a participant that is not
 * the coordinator must not wake anybody.
 *
 * There are two ways a message can name a participant, and both have to be
 * closed:
 *
 *  1. By mentioning them, in the text. That path is closed.
 *  2. By naming them in `targetParticipantIds`, which the MCP tool exposes to
 *     an agent and which the routing engine treats as explicit targets.
 *
 * This file drives the second path all the way through, because a rule that
 * only holds on one of the two ways a participant can be named is not the rule
 * the contract publishes.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let conversationId = '';
let coordinatorConnectionId = '';
let otherConnectionId = '';
let coordinatorParticipantId = '';
let otherParticipantId = '';
let coordinatorToken = '';
let otherToken = '';

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

/** The result of a tool call, out of the JSON-RPC envelope. */
function toolResult(body: string): {
  dispatches: unknown[];
  routing: { reason: string; blocked?: string };
} {
  const data = /data:\s*(\{.*\})/s.exec(body)?.[1];
  if (!data) throw new Error(`no tool result in the response:\n${body}`);
  const envelope = JSON.parse(data) as {
    result?: { content?: { type: string; text?: string }[] };
  };
  const text = envelope.result?.content?.[0]?.text ?? '{}';
  return JSON.parse(text) as {
    dispatches: unknown[];
    routing: { reason: string; blocked?: string };
  };
}

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

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-coordinator-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'coordinator-owner-token',
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
  const other = await createAgent('Codex');
  coordinatorConnectionId = coordinator.id;
  otherConnectionId = other.id;
  coordinatorToken = coordinator.token;
  otherToken = other.token;

  const created = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title: 'A coordinator conversation',
      routingMode: 'coordinator',
      participantAgentConnectionIds: [coordinator.id, other.id],
    },
  });
  conversationId = created.json().conversation.id as string;

  // The coordinator is a participant, and a participant id is only known
  // after the conversation exists.
  const conversation = await app.inject({
    method: 'GET',
    url: `/api/conversations/${conversationId}`,
    headers: { cookie: sessionCookie },
  });
  const coordinatorParticipant = conversation
    .json()
    .conversation.participants.find(
      (p: { agentConnectionId?: string }) => p.agentConnectionId === coordinator.id,
    );
  const otherParticipant = conversation
    .json()
    .conversation.participants.find(
      (p: { agentConnectionId?: string }) => p.agentConnectionId === other.id,
    );
  coordinatorParticipantId = coordinatorParticipant.id as string;
  otherParticipantId = otherParticipant.id as string;

  await app.inject({
    method: 'PATCH',
    url: `/api/conversations/${conversationId}`,
    headers: { cookie: sessionCookie },
    payload: { coordinatorId: coordinatorParticipant.id },
  });
});

afterAll(async () => {
  await app.close();
});

describe('coordinator mode, from the agent side', () => {
  it('lets the coordinator delegate by mentioning a participant', async () => {
    const body = await mcp(coordinatorToken, 'tools/call', {
      name: 'conversation.post',
      arguments: { conversationId, text: '@Codex please take this' },
    });
    const result = toolResult(body);

    expect(result.dispatches.length).toBeGreaterThan(0);
    expect(result.routing.reason).toBe('Delegated by the coordinator.');
  });

  it('does not let a non-coordinator delegate by mentioning a participant', async () => {
    const body = await mcp(otherToken, 'tools/call', {
      name: 'conversation.post',
      arguments: { conversationId, text: '@Hermes CTO please take this' },
    });
    const result = toolResult(body);

    expect(result.dispatches).toEqual([]);
    expect(result.routing.reason).not.toContain('Delegated by the coordinator');
  });

  it('does not let a non-coordinator delegate by naming an explicit target', async () => {
    // The same delegation, expressed the other way: the target is named
    // instead of mentioned. The rule is about who delegates, not about how
    // the delegate is spelled.
    const body = await mcp(otherToken, 'tools/call', {
      name: 'conversation.post',
      arguments: {
        conversationId,
        text: 'take this',
        targetParticipantIds: [coordinatorConnectionId],
      },
    });
    const result = toolResult(body);

    expect(
      result.dispatches,
      `a non-coordinator routed a turn anyway: ${result.routing.reason}`,
    ).toEqual([]);
    expect(result.routing.reason).not.toContain('Delegated by the coordinator');
  });
});

/**
 * Naming a target, in the units the published API asks for.
 *
 * `CONTRACTS.md` publishes `targetParticipantIds: ID[]` beside `senderId: ID`,
 * and the worker's `senderId` is a participant id. So a participant id is what
 * a target is, at every surface an agent can reach: the MCP tool's parameter
 * is called `targetParticipantIds`, and the message column is called the same.
 *
 * The routing engine compares the names it is given against the agent
 * *connection* ids. If the two are not the same thing, then the path that
 * names a target does not fire for the ids the API asks for, and the rule
 * that was put on it never runs.
 */
describe('coordinator mode, naming a target the way the API asks', () => {
  it('lets the coordinator delegate by naming a participant', async () => {
    const body = await mcp(coordinatorToken, 'tools/call', {
      name: 'conversation.post',
      arguments: {
        conversationId,
        text: 'take this',
        targetParticipantIds: [otherParticipantId],
      },
    });
    const result = toolResult(body);

    expect(
      result.dispatches.length,
      `the coordinator named a target and nobody was woken: ${result.routing.reason}`,
    ).toBeGreaterThan(0);
  });

  it('refuses a non-coordinator that names a target, and says which rule refused it', async () => {
    const body = await mcp(otherToken, 'tools/call', {
      name: 'conversation.post',
      arguments: {
        conversationId,
        text: 'take this',
        targetParticipantIds: [coordinatorParticipantId],
      },
    });
    const result = toolResult(body);

    expect(result.dispatches).toEqual([]);
    expect(
      result.routing.blocked,
      `the refusal did not say that a non-coordinator tried to delegate: ${result.routing.reason}`,
    ).toBe('not_coordinator');
  });
});

/**
 * The owner path, end to end.
 *
 * The unit suite in `modules/conversations/__tests__/routing.test.ts` pins the
 * rule inside the routing engine: in coordinator mode the owner's own message
 * reaches the coordinator even when it names a participant.
 *
 * This one pins the same behaviour across the boundary the owner actually
 * crosses, because that is where the shape changes. The published API names a
 * target by its *participant* id, and the routing engine names an agent by its
 * *connection* id. If the named participant is dropped in the crossing, the
 * coordinator is still reached — the owner would never know — but the reason
 * string quietly stops saying that the agent they named was not woken. That
 * sentence is the only place the owner is told what happened to the agent they
 * addressed, so it is worth a test of its own.
 */
describe('coordinator mode, from the owner side', () => {
  it('reaches the coordinator when the owner names a participant, and says the named agent was not woken', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: {
        content: [{ type: 'text', text: 'take this' }],
        targetParticipantIds: [otherParticipantId],
      },
    });

    expect(response.statusCode).toBe(201);
    const result = response.json() as {
      dispatches: Array<{ agentConnectionId: string }>;
      routing: { targets: string[]; reason: string };
    };

    // The coordinator is the one that acts, and the agent the owner named is
    // not woken.
    expect(result.routing.targets).toEqual([coordinatorConnectionId]);
    expect(result.dispatches.map((dispatch) => dispatch.agentConnectionId)).toEqual([
      coordinatorConnectionId,
    ]);

    // And the owner is told what happened to the agent they named. This is the
    // sentence that only survives if the named participant made it across the
    // boundary in the shape the routing engine reads.
    expect(result.routing.reason).toContain('not woken directly');
  });
});
