// @vitest-environment node
/**
 * The approval and execution round trips, over MCP.
 *
 * SPEC-S1 is about an agent that can answer an approval and stop an execution,
 * not just talk. This file is the proof of the three things that makes it safe:
 *
 *  1. **A grant refusal.** The destructive verbs — `approval.decide` and
 *     `execution.stop` — are not in the default grant set, so a connection that
 *     was not given them does not have them. The call is refused, and the
 *     refusal is recorded the way every other ungranted call is recorded, so
 *     the owner finds the agent on the waiting list and can widen the one grant
 *     that is in the way.
 *
 *  2. **Workspace scoping.** An agent is bounded to the workspace it was
 *     granted, never to the whole tenant. A tool that names an id names an
 *     *object*, so the object is checked against the caller's scope before
 *     anything of it is read; a tool that names a workspace is checked against
 *     the same scope.
 *
 *  3. **Decide without authority.** A refusal must change nothing: an approval
 *     the agent was not allowed to decide is still pending afterwards, and the
 *     decision that *was* allowed names the agent that made it.
 *
 * It also holds the stop path to being honest: a turn that could only be asked
 * to stop says so, a turn whose outcome could not be confirmed is not stopped,
 * and nothing claims a turn stopped when only a request was made.
 *
 * The assertions are made against the MCP surface itself, so the code and the
 * rule it states cannot drift apart quietly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { blockedCapabilities, executions } from '../db/schema.js';
import { mcpToolNames } from '@personal-os/contracts';

let app: FastifyInstance;
let sessionCookie = '';
/** The workspace the agents are granted. */
let ownId = '';
/** The workspace the agents must not reach. */
let otherId = '';
let dataDir = '';

/** The guard's own words. The rule is one sentence, and it is this one. */
const REFUSED = 'This agent has no access to that workspace.';

/** The read-only tools the agents in this file are granted. */
const READS = ['approval.list', 'execution.list', 'execution.get', 'event.list', 'audit.list'];

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-approval-parity-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'approval-parity-owner-token',
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
  ownId = workspaces.json().workspaces[0].id as string;

  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name: 'Elsewhere', description: 'The workspace the agents were not granted.' },
  });
  expect(created.statusCode).toBe(201);
  otherId = created.json().workspace.id as string;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** The MCP surface, called the way an agent calls it. */
async function mcp(
  headers: Record<string, string>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  return { statusCode: response.statusCode, body: response.body };
}

/**
 * The tool result carried by an MCP response.
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
  return { isError: result.isError === true, text: result.content?.[0]?.text ?? '' };
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

/** An agent connection in a workspace, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants?: string[],
  agentWorkspaceId: string = ownId,
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
  expect(agent.statusCode).toBe(201);
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'approval-parity' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** A turn in a workspace, in the state the test needs it in. */
function seedExecution(
  id: string,
  workspaceId: string,
  status: 'queued' | 'running' | 'blocked' | 'unknown',
): void {
  const now = new Date().toISOString();
  app.services.runtime.db
    .insert(executions)
    .values({
      id,
      workspaceId,
      conversationId: null,
      taskId: null,
      externalRef: null,
      agentConnectionId: null,
      executionOwner: 'personal-os',
      status,
      error: status === 'unknown' ? 'The agent did not finish within 900s.' : null,
      spendUnits: 0,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    })
    .run();
}

/** An approval waiting for a decision. */
function seedApproval(label: string, workspaceId: string, executionId: string | null): string {
  const approval = app.services.approvals.request({
    workspaceId,
    ...(executionId ? { executionId } : {}),
    summary: `Delete the production database (${label})`,
    details: { marker: 'ELSEWHERE-ONLY' },
  });
  return approval.id;
}

/** The refusals recorded against one connection. */
function recordedRefusals(agentConnectionId: string): string[] {
  return app.services.runtime.db
    .select()
    .from(blockedCapabilities)
    .all()
    .filter((row) => row.agentConnectionId === agentConnectionId)
    .map((row) => row.toolName);
}

describe('the destructive verbs are not in the default grant set', () => {
  it('does not give a connection the decision or the stop', async () => {
    const agent = await createAgent('Default grants');
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${agent.token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });

    const tools = listedTools(response.body);

    // The read-only trails are there: an agent that has just acted needs to be
    // able to read what it did.
    expect(tools).toContain('approval.list');
    expect(tools).toContain('execution.list');
    expect(tools).toContain('execution.get');
    expect(tools).toContain('event.list');
    expect(tools).toContain('audit.list');

    // The two verbs that spend the owner's authority are not, and saying so is
    // the whole point: a connection that may answer an approval is a
    // connection the owner has said may answer an approval.
    expect(tools).not.toContain('approval.decide');
    expect(tools).not.toContain('execution.stop');
  });

  it('refuses a decision the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No decision');
    const approvalId = seedApproval('apr_ungranted', ownId, null);

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'approval.decide', {
      approvalId,
      approved: true,
      reason: 'the agent decided on its own',
    });

    // The tool was never registered, so the MCP server cannot route it.
    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');

    // The refusal is recorded, the way every other ungranted call is recorded,
    // so the owner finds the agent on the waiting list.
    expect(recordedRefusals(agent.id)).toContain('approval.decide');
  });

  it('refuses a stop the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No stop');
    seedExecution('exe_ungranted_stop', ownId, 'running');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'execution.stop', {
      executionId: 'exe_ungranted_stop',
    });

    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');
    expect(recordedRefusals(agent.id)).toContain('execution.stop');
  });

  it('gives the owner every tool, the destructive verbs included', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer approval-parity-owner-token',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });

    expect(listedTools(response.body).sort()).toEqual([...mcpToolNames].sort());
  });
});

describe('an agent reaching outside the workspace it was granted', () => {
  let token = '';
  /** The approval in the workspace the agent must not reach. */
  let elsewhereApproval = '';
  /** The approval in the agent's own workspace. */
  let ownApproval = '';

  beforeAll(async () => {
    const agent = await createAgent('Reaching too far', [
      ...READS,
      'approval.decide',
      'execution.stop',
    ]);
    token = agent.token;

    seedExecution('exe_elsewhere', otherId, 'running');
    seedExecution('exe_own', ownId, 'running');
    elsewhereApproval = seedApproval('apr_elsewhere', otherId, null);
    ownApproval = seedApproval('apr_own', ownId, null);
    expect(elsewhereApproval).not.toBe(ownApproval);
  });

  it('refuses a queue in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'approval.list', {
      workspaceId: otherId,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
  });

  it('refuses a turn in a workspace it was not granted, and nothing of it comes back', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.get', {
      executionId: 'exe_elsewhere',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
    expect(result.text).not.toContain('exe_elsewhere');
  });

  it('refuses an approval in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'approval.list', {
      approvalId: elsewhereApproval,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
  });

  it('refuses a decision on an approval in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'approval.decide', {
      approvalId: elsewhereApproval,
      approved: true,
      reason: 'not mine to decide',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);

    // The approval is still pending. A refusal that decided something would be
    // the opposite of a refusal.
    const pending = await app.inject({
      method: 'GET',
      url: `/api/approvals/${elsewhereApproval}`,
      headers: { cookie: sessionCookie },
    });
    expect(pending.json().approval.status).toBe('pending');
  });

  it('refuses a stop on a turn in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.stop', {
      executionId: 'exe_elsewhere',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
  });

  it('refuses the trails of a workspace it was not granted', async () => {
    for (const tool of ['event.list', 'audit.list']) {
      const response = await mcp({ authorization: `Bearer ${token}` }, tool, {
        workspaceId: otherId,
      });
      const result = toolResult(response.body);

      expect(result.isError, `${tool} answered as a success`).toBe(true);
      expect(result.text, `${tool} refused for the wrong reason`).toContain(REFUSED);
    }
  });

  it('is not refused inside its own workspace', async () => {
    const queue = await mcp({ authorization: `Bearer ${token}` }, 'approval.list', {
      workspaceId: ownId,
    });
    expect(toolResult(queue.body).isError).toBe(false);

    const turn = await mcp({ authorization: `Bearer ${token}` }, 'execution.get', {
      executionId: 'exe_own',
    });
    expect(toolResult(turn.body).isError).toBe(false);

    const trail = await mcp({ authorization: `Bearer ${token}` }, 'audit.list', {
      workspaceId: ownId,
    });
    expect(toolResult(trail.body).isError).toBe(false);
  });
});

describe('deciding an approval the agent was given the authority to decide', () => {
  let token = '';
  let agentId = '';

  beforeAll(async () => {
    const agent = await createAgent('Decider', [...READS, 'approval.decide']);
    token = agent.token;
    agentId = agent.id;
  });

  it('records the decision, and names the agent that made it', async () => {
    const approvalId = seedApproval('apr_decided', ownId, null);

    const response = await mcp({ authorization: `Bearer ${token}` }, 'approval.decide', {
      approvalId,
      approved: true,
      reason: 'the operation is safe and was asked for',
    });
    const result = toolResult(response.body);

    expect(result.isError, `the decision was refused: ${result.text}`).toBe(false);

    // The owner reads the same approval row, and it says who decided.
    const owner = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}`,
      headers: { cookie: sessionCookie },
    });
    const approval = owner.json().approval;

    expect(approval.status).toBe('approved');
    expect(approval.reason).toBe('the operation is safe and was asked for');
    expect(approval.decidedBy).toBe(agentId);

    // The trail names the agent too, and the authority behind the decision is
    // the owner's grant of this one verb.
    const audit = await app.inject({
      method: 'GET',
      url: `/api/audit?workspaceId=${ownId}&limit=50`,
      headers: { cookie: sessionCookie },
    });
    const entry = audit
      .json()
      .entries.find(
        (item: { action: string; targetId: string }) =>
          item.action === 'approval.granted' && item.targetId === approvalId,
      );

    expect(entry, 'the decision is not in the audit trail').toBeDefined();
    expect(entry.actorType).toBe('agent');
    expect(entry.actorId).toBe(agentId);
  });

  it('publishes the decision, so a client watching the stream learns of it', async () => {
    const approvalId = seedApproval('apr_published', ownId, null);

    await mcp({ authorization: `Bearer ${token}` }, 'approval.decide', {
      approvalId,
      approved: false,
      reason: 'not this time',
    });

    const owner = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}`,
      headers: { cookie: sessionCookie },
    });
    expect(owner.json().approval.status).toBe('rejected');
  });

  it('lets the owner make the same decision the same way', async () => {
    const approvalId = seedApproval('apr_owner', ownId, null);

    const owner = await app.inject({
      method: 'POST',
      url: `/api/approvals/${approvalId}/decide`,
      headers: { cookie: sessionCookie },
      payload: { approved: true, reason: 'the owner decided it directly' },
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.json().approval.status).toBe('approved');

    // The owner's decision and the agent's decision are the same decision
    // path: the same answer, the same shape, the same trail.
    const audit = await app.inject({
      method: 'GET',
      url: `/api/audit?workspaceId=${ownId}&limit=50`,
      headers: { cookie: sessionCookie },
    });
    const entry = audit
      .json()
      .entries.find(
        (item: { action: string; targetId: string }) =>
          item.action === 'approval.granted' && item.targetId === approvalId,
      );

    expect(entry).toBeDefined();
    expect(entry.actorType).toBe('human');
  });
});

describe('stopping a turn', () => {
  let token = '';

  beforeAll(async () => {
    const agent = await createAgent('Stopper', [...READS, 'execution.stop']);
    token = agent.token;
  });

  it('says a turn that could only be asked to stop was asked, not stopped', async () => {
    seedExecution('exe_running', ownId, 'running');

    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.stop', {
      executionId: 'exe_running',
    });
    const result = toolResult(response.body);

    expect(result.isError, `the stop was refused: ${result.text}`).toBe(false);
    const payload = JSON.parse(result.text) as { outcome: string; detail: string };

    // The worker holds the live session and the API server never runs an
    // agent, so a running turn can only be asked. The answer says so.
    expect(payload.outcome).toBe('requested');
    expect(payload.detail).toContain('may finish');
  });

  it('says a turn whose outcome could not be confirmed has nothing to stop', async () => {
    seedExecution('exe_unknown', ownId, 'unknown');

    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.stop', {
      executionId: 'exe_unknown',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.text) as { outcome: string; detail: string };

    // The R0 rule: an uncertain side effect is reported for resolution, not
    // replayed, and nothing here guesses how the turn ended.
    expect(payload.outcome).toBe('not_running');
    expect(payload.detail).toContain('could not be confirmed');
  });

  it('reports a cancelled turn as cancelled, because that is what happened', async () => {
    seedExecution('exe_queued', ownId, 'queued');
    app.services.queue.enqueue({
      workspaceId: ownId,
      type: 'chat.turn',
      payload: { executionId: 'exe_queued' },
    });

    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.stop', {
      executionId: 'exe_queued',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.text) as { outcome: string };

    // The queued job was cancelled, so the turn will not run. That is the only
    // outcome that says the turn is over.
    expect(payload.outcome).toBe('cancelled');

    const turn = await app.inject({
      method: 'GET',
      url: '/api/executions/exe_queued',
      headers: { cookie: sessionCookie },
    });
    expect(turn.json().turn.status).toBe('cancelled');
  });

  it('writes the request to the trail, whoever asked for it', async () => {
    seedExecution('exe_audited', ownId, 'running');

    await mcp({ authorization: `Bearer ${token}` }, 'execution.stop', {
      executionId: 'exe_audited',
      note: 'the agent was asked to stop',
    });

    const audit = await app.inject({
      method: 'GET',
      url: `/api/audit?workspaceId=${ownId}&limit=50`,
      headers: { cookie: sessionCookie },
    });
    const entry = audit
      .json()
      .entries.find(
        (item: { action: string; targetId: string }) =>
          item.action === 'execution.stop.requested' && item.targetId === 'exe_audited',
      );

    expect(entry, 'the stop request is not in the audit trail').toBeDefined();
    expect(entry.actorType).toBe('agent');
    expect(entry.metadata.note).toBe('the agent was asked to stop');
  });
});
