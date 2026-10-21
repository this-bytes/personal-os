// @vitest-environment node
/**
 * The two published surfaces of the autonomy policy.
 *
 * WI-096 published the shape of the effective policy and left the surfaces
 * that publish it without a test: `GET /api/autonomy-policy` and the
 * `autonomy.read` MCP tool. This file is that test.
 *
 * **The shape asserted here is the shape `CONTRACTS.md` publishes**, read on
 * the branch at `a439e2d` ("The autonomy-policy route", `CONTRACTS.md:1361`
 * and the example at `:1402-1421`) — not the shape the implementation happens
 * to answer with. A change that moves the published shape has to move this
 * file with it, and the contract with it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { defaultAgentToolGrants, mcpToolNames } from '@personal-os/contracts';

/**
 * The policy the contract publishes for a workspace whose stored policy is
 * the default, asked about on its own (`CONTRACTS.md:1399-1421`).
 *
 * Every value here is quoted from the contract's own JSON example, and every
 * `sources` entry says which policy decided it: `workspace` for the values
 * the workspace's own stored policy carries, `default` for the values no
 * policy bounded.
 */
const PUBLISHED_DEFAULT_POLICY = {
  mode: 'manual',
  allowedActions: ['message.send', 'tool.call', 'artifact.create'],
  approvalRequired: [],
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
  dailySpendUnits: 0,
  sources: {
    mode: 'workspace',
    allowedActions: 'default',
    approvalRequired: 'default',
    maxTurns: 'workspace',
    maxDurationSeconds: 'workspace',
    maxSpendUnits: 'default',
    dailySpendUnits: 'default',
  },
} as const;

/** The members `EffectiveAutonomyPolicy` publishes (`CONTRACTS.md:1378-1396`). */
const PUBLISHED_POLICY_MEMBERS = [
  'mode',
  'allowedActions',
  'approvalRequired',
  'maxTurns',
  'maxDurationSeconds',
  'maxSpendUnits',
  'dailySpendUnits',
  'sources',
] as const;

const PUBLISHED_SOURCE_MEMBERS = [
  'mode',
  'allowedActions',
  'approvalRequired',
  'maxTurns',
  'maxDurationSeconds',
  'maxSpendUnits',
  'dailySpendUnits',
] as const;

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

async function mcp(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
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
  return { statusCode: response.statusCode, body: response.body };
}

/** The tool names in a tools/list response. */
function listedTools(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(/"name"\s*:\s*"([a-z.]+)"/g)) {
    const name = match[1];
    if (name && mcpToolNames.includes(name as never)) names.push(name);
  }
  return names;
}

/** An agent connection, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants?: string[],
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
      ...(toolGrants ? { toolGrants } : {}),
    },
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-autonomy-surface-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'autonomy-surface-owner-token',
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
});

describe('the autonomy-policy route', () => {
  it('answers with the published policy, under a policy key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(workspaceId)}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // The route answers with the policy under a `policy` key
    // (`CONTRACTS.md:1399`), and the tool answers with the policy itself.
    expect(Object.keys(body)).toEqual(['policy']);

    const policy = body.policy as Record<string, unknown>;
    expect(Object.keys(policy).sort()).toEqual([...PUBLISHED_POLICY_MEMBERS].sort());

    // The values the contract publishes for a workspace whose stored policy
    // is the default, asked about on its own (`CONTRACTS.md:1402-1421`).
    expect(policy['mode']).toBe(PUBLISHED_DEFAULT_POLICY.mode);
    expect(policy['allowedActions']).toEqual([...PUBLISHED_DEFAULT_POLICY.allowedActions]);
    expect(policy['approvalRequired']).toEqual([...PUBLISHED_DEFAULT_POLICY.approvalRequired]);
    expect(policy['maxTurns']).toBe(PUBLISHED_DEFAULT_POLICY.maxTurns);
    expect(policy['maxDurationSeconds']).toBe(PUBLISHED_DEFAULT_POLICY.maxDurationSeconds);
    expect(policy['maxSpendUnits']).toBe(PUBLISHED_DEFAULT_POLICY.maxSpendUnits);
    expect(policy['dailySpendUnits']).toBe(PUBLISHED_DEFAULT_POLICY.dailySpendUnits);

    // `sources` says where each value came from, and it is part of the
    // answer (`CONTRACTS.md:1425-1428`).
    const sources = policy['sources'] as Record<string, unknown>;
    expect(Object.keys(sources).sort()).toEqual([...PUBLISHED_SOURCE_MEMBERS].sort());
    for (const member of PUBLISHED_SOURCE_MEMBERS) {
      expect(sources[member]).toBe(PUBLISHED_DEFAULT_POLICY.sources[member]);
    }
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(workspaceId)}`,
    });

    // The route follows the same rules as every other route: a session cookie
    // or the owner token, and never an agent token
    // (`CONTRACTS.md:1364-1367`).
    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('unauthorized');
  });

  it('refuses an agent token, which is MCP-only', async () => {
    const { token } = await createAgent('agent-token-on-the-route');
    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(workspaceId)}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('unauthorized');
  });

  it('names workspaceId as the field at fault when the query is wrong', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/autonomy-policy',
      headers: { cookie: sessionCookie },
    });

    // `workspaceId` is required; a request without it comes back
    // `422 validation_failed` in the shared error envelope, with
    // `workspaceId` named as the field at fault (`CONTRACTS.md:1369-1371`).
    expect(response.statusCode).toBe(422);
    expect(response.body).toContain('validation_failed');
    expect(response.body).toContain('workspaceId');
  });
});

describe('the autonomy.read MCP tool', () => {
  it('is in the default agent tool grants', () => {
    // The tool is published in the tool list (`packages/contracts/src/mcp.ts`)
    // and it is granted to an agent connection unless the owner narrows the
    // grants down.
    expect(mcpToolNames).toContain('autonomy.read');
    expect(defaultAgentToolGrants).toContain('autonomy.read');
  });

  it('is offered to an agent that was granted the default tools', async () => {
    const { token } = await createAgent('agent-with-default-grants');
    const response = await mcp(token, 'tools/list', {});

    expect(response.statusCode).toBe(200);
    expect(listedTools(response.body)).toContain('autonomy.read');
  });

  it('answers with the effective policy for a caller the policy allows', async () => {
    const { token } = await createAgent('agent-reading-the-policy');
    const response = await mcp(token, 'tools/call', {
      name: 'autonomy.read',
      arguments: { workspaceId },
    });

    expect(response.statusCode).toBe(200);
    // The tool answers with the policy itself, where the route answers with
    // it under a `policy` key (`CONTRACTS.md:789-790`).
    for (const member of PUBLISHED_POLICY_MEMBERS) {
      expect(response.body, `the tool's answer carries no ${member}`).toContain(member);
    }
    expect(response.body).toContain(PUBLISHED_DEFAULT_POLICY.mode);
  });

  it('is refused to a caller that was not granted it', async () => {
    const { token } = await createAgent('agent-without-the-grant', ['conversation.read']);

    const listed = await mcp(token, 'tools/list', {});
    expect(listedTools(listed.body)).not.toContain('autonomy.read');

    const response = await mcp(token, 'tools/call', {
      name: 'autonomy.read',
      arguments: { workspaceId },
    });

    // The tool is not registered for a caller that was not granted it, so the
    // call is refused and the server answers with a JSON-RPC error naming the
    // tool. The guard's own message is not what reaches the caller here.
    expect(response.body, 'the refusal names the tool').toContain('autonomy.read');
    expect(response.body, 'the refusal hands over no policy').not.toContain('maxDurationSeconds');
  });
});
