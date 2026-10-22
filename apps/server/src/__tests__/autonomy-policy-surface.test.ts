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
import type { AutonomyPolicyPatch } from '@personal-os/contracts';

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

/**
 * The tool result carried by an MCP response: whether it is an error, and the
 * text the tool answered with.
 *
 * The transport answers with the JSON-RPC payload on the `data:` line of the
 * event stream, and a tool that refused answers with its refusal as the text
 * of the result.
 */
function toolResult(body: string): { isError: boolean; text: string } {
  const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
  expect(dataLine, 'the MCP response carries no payload').toBeDefined();
  const payload = JSON.parse((dataLine ?? '').slice('data: '.length)) as {
    result?: { isError?: boolean; content?: { text?: string }[] };
  };
  const result = payload.result ?? {};
  return {
    isError: result.isError === true,
    text: result.content?.[0]?.text ?? '',
  };
}

/** An agent connection, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants?: string[],
  agentWorkspaceId: string = workspaceId,
): Promise<{ id: string; token: string }> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId: agentWorkspaceId,
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

/** A workspace of the owner's own. */
async function createWorkspace(name: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name },
  });
  expect(created.statusCode).toBe(201);
  return created.json().workspace.id as string;
}

/**
 * A workspace whose stored policy is the one named.
 */
async function createWorkspaceWithPolicy(
  name: string,
  autonomyPolicy: AutonomyPolicyPatch,
): Promise<string> {
  const id = await createWorkspace(name);
  app.services.workspaces.update(id, { autonomyPolicy });
  return id;
}

/**
 * A policy that allows one action only.
 *
 * `tool.call` is what every MCP tool other than `conversation.post` stands
 * for, so a policy that does not allow it refuses those calls.
 */
const RESTRICTED_POLICY: AutonomyPolicyPatch = {
  mode: 'manual',
  allowedActions: ['message.send'],
  approvalRequired: [],
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
  dailySpendUnits: 0,
};

/**
 * A policy that allows every action, and wants the owner to approve one of
 * them before an agent may take it.
 */
const APPROVAL_POLICY: AutonomyPolicyPatch = {
  mode: 'manual',
  allowedActions: ['message.send', 'tool.call', 'artifact.create'],
  approvalRequired: ['tool.call'],
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
  dailySpendUnits: 0,
};

/** The resources the owner can see in a workspace. */
async function listResources(workspace: string): Promise<unknown[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/resources?workspaceId=${encodeURIComponent(workspace)}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().resources as unknown[];
}

describe('the mode the owner sets', () => {
  it('is the mode that is in force, so the panel cannot show a mode that is not', async () => {
    const id = await createWorkspace('A workspace whose mode the owner sets');

    // The panel shows `workspace.autonomyMode`, and `PATCH
    // /api/workspaces/:id` is the only way an owner can set a mode. The
    // policy in force is resolved from `autonomyPolicy.mode`, so a patch that
    // set only the column would leave the panel showing a mode that is not in
    // force.
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/workspaces/${id}`,
      headers: { cookie: sessionCookie },
      payload: { autonomyMode: 'autonomous' },
    });
    expect(patched.statusCode, 'the owner could not set the workspace mode').toBe(200);

    const shown = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${id}`,
      headers: { cookie: sessionCookie },
    });
    const displayed = (shown.json() as { workspace?: { autonomyMode?: string } }).workspace
      ?.autonomyMode;
    expect(displayed).toBe('autonomous');

    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(id)}`,
      headers: { cookie: sessionCookie },
    });
    const policy = (response.json() as { policy?: { mode?: string } }).policy;

    expect(
      policy?.mode,
      `the panel shows "${displayed}" and the policy in force says "${policy?.mode}": the mode ` +
        'the owner can see and set has to be the mode that is in force',
    ).toBe(displayed);
  });

  it('follows the mode back down when the owner sets it again', async () => {
    const id = await createWorkspace('A workspace whose mode the owner changes');

    for (const mode of ['autonomous', 'assisted', 'manual'] as const) {
      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/workspaces/${id}`,
        headers: { cookie: sessionCookie },
        payload: { autonomyMode: mode },
      });
      expect(patched.statusCode).toBe(200);

      const response = await app.inject({
        method: 'GET',
        url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(id)}`,
        headers: { cookie: sessionCookie },
      });
      const policy = (response.json() as { policy?: { mode?: string } }).policy;
      expect(policy?.mode, `the policy in force did not follow the owner to "${mode}"`).toBe(mode);
    }
  });

  it('moves the panel when the policy is the thing that changes', async () => {
    const id = await createWorkspace('A workspace whose policy changes');

    // The other direction: a policy written through the service carries a
    // mode, and the panel has to show that mode rather than the one the
    // workspace was created with. The two are written together whichever way
    // round the change arrives.
    app.services.workspaces.update(id, {
      autonomyPolicy: { ...RESTRICTED_POLICY, mode: 'assisted' },
    });

    const shown = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${id}`,
      headers: { cookie: sessionCookie },
    });
    const displayed = (shown.json() as { workspace?: { autonomyMode?: string } }).workspace
      ?.autonomyMode;
    expect(displayed).toBe('assisted');
  });

  it('leaves the mode alone when the patch does not name one', async () => {
    const id = await createWorkspace('A workspace whose name changes');

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/workspaces/${id}`,
      headers: { cookie: sessionCookie },
      payload: { name: 'Renamed' },
    });
    expect(patched.statusCode).toBe(200);

    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${encodeURIComponent(id)}`,
      headers: { cookie: sessionCookie },
    });
    const policy = (response.json() as { policy?: { mode?: string } }).policy;
    expect(policy?.mode).toBe('manual');
  });
});

describe('the MCP surface under a policy that refuses an action', () => {
  it('allows an action the policy allows, so the refusal below means something', async () => {
    const { token } = await createAgent('agent-under-the-default-policy');
    const before = await listResources(workspaceId);

    const response = await mcp(token, 'tools/call', {
      name: 'resource.create',
      arguments: {
        workspaceId,
        type: 'document',
        title: 'Allowed by the policy',
        data: { format: 'markdown', content: 'x' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(toolResult(response.body).isError).toBe(false);
    expect((await listResources(workspaceId)).length).toBe(before.length + 1);
  });

  it('refuses an action the policy does not allow, and does not pass it', async () => {
    const restrictedId = await createWorkspaceWithPolicy(
      'Restricted for the refusal',
      RESTRICTED_POLICY,
    );
    const { token } = await createAgent(
      'agent-under-a-restrictive-policy',
      undefined,
      restrictedId,
    );
    const before = await listResources(restrictedId);

    const response = await mcp(token, 'tools/call', {
      name: 'resource.create',
      arguments: {
        workspaceId: restrictedId,
        type: 'document',
        title: 'Refused by the policy',
        data: { format: 'markdown', content: 'x' },
      },
    });

    expect(response.statusCode).toBe(200);
    const result = toolResult(response.body);

    // The refusal is reported as an error and is not handed back as a result.
    expect(result.isError).toBe(true);

    // `forbidden` is the code the contract publishes for a refusal
    // (`CONTRACTS.md:1621-1622`), and the refusal names the action it
    // refused. The vocabulary is closed and published
    // (`CONTRACTS.md:895-897`, `:1375`).
    const refusal = JSON.parse(result.text) as { code?: string; message?: string };
    expect(refusal.code).toBe('forbidden');
    expect(refusal.message).toContain('tool.call');

    // The action was refused rather than passed (`CONTRACTS.md:895-897`):
    // nothing was created.
    expect((await listResources(restrictedId)).length).toBe(before.length);
  });

  it('refuses an action the policy wants the owner to approve, until the owner decides', async () => {
    const pendingId = await createWorkspaceWithPolicy('Waiting for the owner', APPROVAL_POLICY);
    const { token } = await createAgent('agent-waiting-for-the-owner', undefined, pendingId);
    const before = await listResources(pendingId);

    const response = await mcp(token, 'tools/call', {
      name: 'resource.create',
      arguments: {
        workspaceId: pendingId,
        type: 'document',
        title: 'Waiting for the owner',
        data: { format: 'markdown', content: 'x' },
      },
    });

    // The action is allowed by the policy, and the policy wants the owner to
    // approve it, so it is refused until the owner has decided
    // (`CONTRACTS.md:902-903`).
    expect(response.statusCode).toBe(200);
    const result = toolResult(response.body);
    expect(result.isError).toBe(true);

    const refusal = JSON.parse(result.text) as { code?: string; message?: string };
    expect(refusal.code).toBe('forbidden');
    expect(refusal.message).toContain('tool.call');

    // Nothing was created while the decision was outstanding.
    expect((await listResources(pendingId)).length).toBe(before.length);
  });

  it('answers with the policy even when the policy refuses that agent its other actions', async () => {
    const restrictedId = await createWorkspaceWithPolicy(
      'Restricted for the reading',
      RESTRICTED_POLICY,
    );
    const { token } = await createAgent(
      'agent-reading-a-restrictive-policy',
      undefined,
      restrictedId,
    );

    const response = await mcp(token, 'tools/call', {
      name: 'autonomy.read',
      arguments: { workspaceId: restrictedId },
    });

    // Reading the policy is not one of the actions the policy governs, so the
    // tool answers even when the policy refuses that agent its other actions
    // (`CONTRACTS.md:795-798`).
    expect(response.statusCode).toBe(200);
    const result = toolResult(response.body);
    expect(result.isError).toBe(false);

    const policy = JSON.parse(result.text) as Record<string, unknown>;
    expect(Object.keys(policy).sort()).toEqual([...PUBLISHED_POLICY_MEMBERS].sort());
    expect(policy['allowedActions']).toEqual(['message.send']);
  });

  it('refuses a workspace the caller may not reach', async () => {
    const otherId = await createWorkspace('Elsewhere');
    const { token } = await createAgent('agent-reaching-too-far');

    const response = await mcp(token, 'tools/call', {
      name: 'autonomy.read',
      arguments: { workspaceId: otherId },
    });

    // An agent reads only the policy of a workspace it was granted
    // (`CONTRACTS.md:791-793`).
    expect(response.statusCode).toBe(200);
    const result = toolResult(response.body);
    expect(result.isError).toBe(true);

    const refusal = JSON.parse(result.text) as { code?: string };
    expect(refusal.code).toBe('forbidden');
  });

  it('answers with its own workspace policy when the caller names no workspace', async () => {
    const { token } = await createAgent('agent-naming-no-workspace');

    const response = await mcp(token, 'tools/call', {
      name: 'autonomy.read',
      arguments: {},
    });

    // A connection that names no workspace gets its own
    // (`CONTRACTS.md:791-793`).
    expect(response.statusCode).toBe(200);
    const result = toolResult(response.body);
    expect(result.isError).toBe(false);

    const policy = JSON.parse(result.text) as Record<string, unknown>;
    expect(policy['allowedActions']).toEqual([...PUBLISHED_DEFAULT_POLICY.allowedActions]);
  });
});
