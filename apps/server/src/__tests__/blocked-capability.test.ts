/**
 * A capability an agent was refused reaches the owner.
 *
 * WI-121 made a refusal visible. An agent that calls a tool it was not granted
 * is stopped at the MCP surface by an answer it cannot appeal and cannot show
 * the owner, and the owner was never told. The refusal is now recorded, the
 * waiting list carries it as its own kind, and the owner can widen that one
 * grant from the list.
 *
 * This file holds three things, and they are the three cases the item names:
 *
 *  1. **the refusal reaches the list** — naming which agent wanted it and
 *     which tool it needed;
 *  2. **one row per agent and capability**, not one per attempt;
 *  3. **the row leaves the moment the grant is widened.**
 *
 * The assertions are made against the routes the owner and the agent actually
 * use — the MCP surface the agent calls and `GET /api/waiting` the owner reads
 * — so the contract and the code cannot drift apart quietly. Each case has an
 * agent of its own, so a case cannot pass or fail on what another case left
 * behind. Nothing here edits the implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-blocked-capability-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'blocked-capability-owner-token',
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
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** One thing on the waiting list, as the owner reads it. */
interface WaitingRow {
  id: string;
  kind: string;
  title: string;
  reason: string;
  agentConnectionId: string | null;
  toolName: string | null;
}

/** An agent connection with the grant it was given, and a token to call with. */
async function createAgent(
  name: string,
  toolGrants: string[],
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
      toolGrants,
    },
  });
  expect(agent.statusCode).toBe(201);
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'blocked-capability' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** The agent calls a tool on the MCP surface. The answer is the agent's. */
async function callTool(token: string, name: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: { title: 'should not work' } },
    },
  });
  return response.body;
}

/** What is waiting on the owner. */
async function waiting(): Promise<WaitingRow[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingRow[];
}

/** The capability rows for one agent. */
function capabilityRows(rows: WaitingRow[], agentConnectionId: string): WaitingRow[] {
  return rows.filter(
    (row) => row.kind === 'capability' && row.agentConnectionId === agentConnectionId,
  );
}

describe('a capability an agent was refused', () => {
  it('reaches the list, naming the agent and the tool', async () => {
    const agent = await createAgent('Narrow', ['conversation.read']);

    // The agent calls a tool it was not granted. The answer is the agent's,
    // and it is the same answer it has always got.
    const body = await callTool(agent.token, 'task.create');
    expect(body).toContain('not found');
    expect(body).toContain('isError');

    // And the owner finds out: the waiting list carries the refusal as its own
    // kind, naming the agent that wanted it and the tool it needed.
    const rows = capabilityRows(await waiting(), agent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('capability');
    expect(rows[0]?.agentConnectionId).toBe(agent.id);
    expect(rows[0]?.toolName).toBe('task.create');
  });

  it('is one row per agent and capability, not one per attempt', async () => {
    const agent = await createAgent('Repetitive', ['conversation.read']);

    await callTool(agent.token, 'task.create');
    await callTool(agent.token, 'task.create');
    await callTool(agent.token, 'task.create');

    // Three refusals of one capability are one thing waiting on the owner.
    const rows = capabilityRows(await waiting(), agent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.toolName).toBe('task.create');

    // A second capability is a second thing waiting.
    await callTool(agent.token, 'task.get');
    const both = capabilityRows(await waiting(), agent.id);
    expect(both).toHaveLength(2);
    expect(both.map((row) => row.toolName).sort()).toEqual(['task.create', 'task.get']);
  });

  it('leaves the list when the grant is widened', async () => {
    const agent = await createAgent('Widened', ['conversation.read']);
    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    // The owner takes the action the row carries.
    const widened = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.create' },
    });
    expect(widened.statusCode).toBe(200);

    // The row leaves: a capability the agent holds is not waiting on the owner.
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(0);

    // And the grant was widened, never narrowed: what the agent already had is
    // still there.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
    });
    const grants = (detail.json().agent.toolGrants as string[]).sort();
    expect(grants).toEqual(['conversation.read', 'task.create']);
  });
});
