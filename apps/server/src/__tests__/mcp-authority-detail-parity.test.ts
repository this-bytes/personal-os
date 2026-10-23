// @vitest-environment node
/**
 * The authority loop's own detail, over MCP.
 *
 * SPEC-S2 batch 1 pairs three owner capabilities with tools: the evidence a
 * decision is taken against (`approval.evidence`), the conclusion about a turn
 * whose outcome could not be confirmed (`execution.resolve`) and the acceptance
 * decision on a task (`task.accept`).
 *
 * This file is the proof of the three things that makes them safe:
 *
 *  1. **The grant model.** A read verb joins the default grant set; a verb that
 *     spends the owner's authority does not, and the owner grants it by name.
 *     `approval.evidence` is a read, so a connection with no explicit grants
 *     has it. `execution.resolve` and `task.accept` are not, so a connection
 *     that was not given them does not have them registered at all — the call
 *     is refused, and the refusal is recorded the way every other ungranted
 *     call is recorded, so the owner finds the agent on the waiting list.
 *
 *  2. **Workspace scoping.** An agent is bounded to the workspace it was
 *     granted, never to the whole tenant. Each of these three names an id, so
 *     each names an *object*: the object is checked against the caller's scope
 *     before anything of it is read, and a refusal leaks nothing of it.
 *
 *  3. **The same operation, the same objects, the same answer.** Each tool does
 *     what its route does, on the same object, and answers with the same shape.
 *     The trail names the agent that acted, and the owner's own route names the
 *     owner.
 *
 * The assertions are made against the MCP surface itself, so the code and the
 * rule it states cannot drift apart quietly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { blockedCapabilities, executions, tasks } from '../db/schema.js';
import { mcpToolNames } from '@personal-os/contracts';
import type { ExecutionStatus } from '@personal-os/contracts';

let app: FastifyInstance;
let sessionCookie = '';
/** The workspace the agents are granted. */
let ownId = '';
/** The workspace the agents must not reach. */
let otherId = '';
let dataDir = '';

/** The guard's own words. The rule is one sentence, and it is this one. */
const REFUSED = 'This agent has no access to that workspace.';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-authority-detail-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'authority-detail-owner-token',
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

/** The tool list a token sees. */
async function toolList(token: string): Promise<string[]> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });
  return listedTools(response.body);
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
    payload: { label: 'authority-detail' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** A turn in a workspace, in the state the test needs it in. */
function seedExecution(id: string, workspaceId: string, status: ExecutionStatus): void {
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
function seedApproval(label: string, workspaceId: string, executionId?: string): string {
  const approval = app.services.approvals.request({
    workspaceId,
    executionId,
    summary: `Delete the production database (${label})`,
    details: { marker: 'ELSEWHERE-ONLY' },
  });
  return approval.id;
}

/** A task the owner made in a workspace. */
async function createTask(workspaceId: string, title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json().task.id as string;
}

/**
 * A task whose outcome could not be confirmed.
 *
 * The worker is the one that writes this state, when a turn ends without
 * saying how it went, so the row is written here the way the worker writes it:
 * the status is `unknown` and the owner is the one who has to say what
 * happened.
 */
function markTaskUnknown(taskId: string): void {
  app.services.runtime.db
    .update(tasks)
    .set({ status: 'unknown' })
    .where(eq(tasks.id, taskId))
    .run();
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

/** The audit entries of a workspace. */
async function auditEntries(
  workspaceId: string,
): Promise<
  { action: string; targetId: string; actorType: string; actorId: string; metadata: unknown }[]
> {
  const audit = await app.inject({
    method: 'GET',
    url: `/api/audit?workspaceId=${workspaceId}&limit=100`,
    headers: { cookie: sessionCookie },
  });
  return audit.json().entries;
}

describe('the grant model, on the three new tools', () => {
  it('gives the default set the read and withholds the two that spend the owner’s authority', async () => {
    const agent = await createAgent('Default grants');
    const tools = await toolList(agent.token);

    // `approval.evidence` is a read. It decides nothing and changes nothing, so
    // it is in the default grant set beside `approval.list`: an agent whose
    // turn is blocked on a decision has to be able to see what it is blocked on.
    expect(tools).toContain('approval.evidence');
    expect(tools).toContain('approval.list');

    // The two that spend the owner's authority are not. A connection that may
    // close an unknown turn, or may accept a task, is a connection the owner
    // has said may do that.
    expect(tools).not.toContain('execution.resolve');
    expect(tools).not.toContain('task.accept');
  });

  it('registers a verb the owner granted by name', async () => {
    const agent = await createAgent('Granted by name', [
      'approval.evidence',
      'execution.resolve',
      'task.accept',
    ]);
    const tools = await toolList(agent.token);

    expect(tools).toContain('approval.evidence');
    expect(tools).toContain('execution.resolve');
    expect(tools).toContain('task.accept');

    // A grant narrows to the list the owner wrote. The default reads are not
    // added back by a grant that did not name them.
    expect(tools).not.toContain('approval.list');
  });

  it('refuses a resolution the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No resolution');
    seedExecution('exe_ungranted_resolve', ownId, 'unknown');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'execution.resolve', {
      executionId: 'exe_ungranted_resolve',
      outcome: 'completed',
    });

    // The tool was never registered, so the MCP server cannot route it.
    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');

    // The refusal is recorded, the way every other ungranted call is recorded,
    // so the owner finds the agent on the waiting list.
    expect(recordedRefusals(agent.id)).toContain('execution.resolve');

    // And a refusal changed nothing: the turn is still waiting for a
    // conclusion.
    const turn = await app.inject({
      method: 'GET',
      url: '/api/executions/exe_ungranted_resolve',
      headers: { cookie: sessionCookie },
    });
    expect(turn.json().turn.status).toBe('unknown');
  });

  it('refuses an acceptance the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No acceptance');
    const taskId = await createTask(ownId, 'A task nobody may accept');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'task.accept', {
      taskId,
      satisfied: true,
    });

    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');
    expect(recordedRefusals(agent.id)).toContain('task.accept');

    // The task is untouched: an acceptance is what closes a task, and nothing
    // happened.
    const task = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskId}`,
      headers: { cookie: sessionCookie },
    });
    expect(task.json().task.status).not.toBe('done');
  });

  it('gives the owner every tool, the new ones included', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer authority-detail-owner-token',
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
  let elsewhereApproval = '';
  let ownApproval = '';

  beforeAll(async () => {
    const agent = await createAgent('Reaching too far', [
      'approval.evidence',
      'execution.resolve',
      'task.accept',
    ]);
    token = agent.token;

    elsewhereApproval = seedApproval('apr_elsewhere', otherId);
    ownApproval = seedApproval('apr_own', ownId);
    seedExecution('exe_elsewhere_unknown', otherId, 'unknown');
  });

  it('refuses the evidence of an approval in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'approval.evidence', {
      approvalId: elsewhereApproval,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);

    // A refusal that leaks is a refusal that does not work.
    expect(result.text).not.toContain('ELSEWHERE-ONLY');
  });

  it('refuses to close a turn in a workspace it was not granted, and changes nothing', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'execution.resolve', {
      executionId: 'exe_elsewhere_unknown',
      outcome: 'completed',
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);

    const turn = await app.inject({
      method: 'GET',
      url: '/api/executions/exe_elsewhere_unknown',
      headers: { cookie: sessionCookie },
    });
    expect(turn.json().turn.status).toBe('unknown');
  });

  it('refuses to accept a task in a workspace it was not granted, and changes nothing', async () => {
    const taskId = await createTask(otherId, 'A task elsewhere');

    const response = await mcp({ authorization: `Bearer ${token}` }, 'task.accept', {
      taskId,
      satisfied: true,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);

    const task = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskId}`,
      headers: { cookie: sessionCookie },
    });
    expect(task.json().task.status).not.toBe('done');
  });

  it('is not refused inside its own workspace', async () => {
    const evidence = await mcp({ authorization: `Bearer ${token}` }, 'approval.evidence', {
      approvalId: ownApproval,
    });
    expect(toolResult(evidence.body).isError).toBe(false);

    seedExecution('exe_own_unknown', ownId, 'unknown');
    const resolution = await mcp({ authorization: `Bearer ${token}` }, 'execution.resolve', {
      executionId: 'exe_own_unknown',
      outcome: 'completed',
    });
    expect(toolResult(resolution.body).isError).toBe(false);

    const taskId = await createTask(ownId, 'A task of its own');
    const acceptance = await mcp({ authorization: `Bearer ${token}` }, 'task.accept', {
      taskId,
      satisfied: true,
    });
    expect(toolResult(acceptance.body).isError).toBe(false);
  });
});

describe('the tool answers what the route answers', () => {
  it('reads the same evidence the owner’s route reads', async () => {
    const agent = await createAgent('Reader', ['approval.evidence']);
    // The approval names the turn behind it, so the evidence has something to
    // answer about. A tool that stopped reading the turn would answer null, and
    // the comparison below would compare two empty answers and still pass.
    seedExecution('exe_evidence', ownId, 'unknown');
    const approvalId = seedApproval('apr_evidence', ownId, 'exe_evidence');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'approval.evidence', {
      approvalId,
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the evidence was refused: ${toolText.text}`).toBe(false);

    const viaRoute = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}/evidence`,
      headers: { cookie: sessionCookie },
    });
    expect(viaRoute.statusCode).toBe(200);

    // The evidence is about the turn the approval names.
    const evidence = JSON.parse(toolText.text) as { execution: { id: string } | null };
    expect(evidence.execution?.id).toBe('exe_evidence');

    // The same evidence, member for member. The route and the tool are thin
    // adapters over one capability, so there is one answer.
    expect(evidence).toEqual(viaRoute.json());
  });

  it('closes a turn the way the owner’s route closes it', async () => {
    const agent = await createAgent('Resolver', ['execution.resolve']);

    seedExecution('exe_tool_resolve', ownId, 'unknown');
    seedExecution('exe_route_resolve', ownId, 'unknown');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'execution.resolve', {
      executionId: 'exe_tool_resolve',
      outcome: 'completed',
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the resolution was refused: ${toolText.text}`).toBe(false);

    const viaRoute = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_route_resolve/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });
    expect(viaRoute.statusCode).toBe(200);

    // The same shape, and the same conclusion.
    const toolPayload = JSON.parse(toolText.text) as {
      execution: { id: string; status: string };
      outcome: string;
      detail: string;
    };
    const routePayload = viaRoute.json() as {
      execution: { id: string; status: string };
      outcome: string;
      detail: string;
    };

    expect(Object.keys(toolPayload).sort()).toEqual(Object.keys(routePayload).sort());
    expect(toolPayload.outcome).toBe(routePayload.outcome);
    expect(toolPayload.detail).toBe(routePayload.detail);
    expect(toolPayload.execution.status).toBe(routePayload.execution.status);
  });

  it('refuses to close a turn whose outcome is already known', async () => {
    const agent = await createAgent('Resolver', ['execution.resolve']);
    seedExecution('exe_already_known', ownId, 'completed');

    const result = await mcp({ authorization: `Bearer ${agent.token}` }, 'execution.resolve', {
      executionId: 'exe_already_known',
      outcome: 'failed',
    });
    const text = toolResult(result.body);
    expect(text.isError, 'a known outcome was overwritten').toBe(true);

    // The turn did not move. A conclusion about a turn that already ended
    // would rewrite what the log says happened, and the owner's conclusion is
    // about work nobody can say how it went.
    const rows = app.services.runtime.db
      .select()
      .from(executions)
      .where(eq(executions.id, 'exe_already_known'))
      .all();
    expect(rows[0]?.status).toBe('completed');
  });

  it('accepts a task the way the owner’s route accepts it', async () => {
    const agent = await createAgent('Accepter', ['task.accept']);

    const toolTaskId = await createTask(ownId, 'Accepted by the agent');
    const routeTaskId = await createTask(ownId, 'Accepted by the owner');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'task.accept', {
      taskId: toolTaskId,
      satisfied: true,
      reason: 'the work is done and checked',
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the acceptance was refused: ${toolText.text}`).toBe(false);

    const viaRoute = await app.inject({
      method: 'POST',
      url: `/api/tasks/${routeTaskId}/accept`,
      headers: { cookie: sessionCookie },
      payload: { satisfied: true, reason: 'the work is done and checked' },
    });
    expect(viaRoute.statusCode).toBe(200);

    // The same shape, and the same judgement.
    const toolPayload = JSON.parse(toolText.text) as { task: { status: string; title: string } };
    const routePayload = viaRoute.json() as { task: { status: string; title: string } };

    expect(Object.keys(toolPayload).sort()).toEqual(Object.keys(routePayload).sort());
    expect(toolPayload.task.status).toBe(routePayload.task.status);
    expect(toolPayload.task.status).toBe('done');
  });
});

describe('the record names who acted', () => {
  it('names the agent that closed an unknown turn, and the owner on the route', async () => {
    const agent = await createAgent('Closer', ['execution.resolve']);
    seedExecution('exe_named_agent', ownId, 'unknown');

    await mcp({ authorization: `Bearer ${agent.token}` }, 'execution.resolve', {
      executionId: 'exe_named_agent',
      outcome: 'failed',
      note: 'the agent checked and it did not run',
    });

    const entries = await auditEntries(ownId);
    const byAgent = entries.find(
      (entry) =>
        entry.action === 'execution.outcome.resolved' && entry.targetId === 'exe_named_agent',
    );

    expect(byAgent, 'the conclusion is not in the audit trail').toBeDefined();
    expect(byAgent?.actorType).toBe('agent');
    expect(byAgent?.actorId).toBe(agent.id);
    expect(byAgent?.metadata).toMatchObject({ from: 'unknown', to: 'failed' });

    // The owner's own route writes the same entry and names the owner.
    seedExecution('exe_named_owner', ownId, 'unknown');
    await app.inject({
      method: 'POST',
      url: '/api/executions/exe_named_owner/resolve',
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });

    const after = await auditEntries(ownId);
    const byOwner = after.find(
      (entry) =>
        entry.action === 'execution.outcome.resolved' && entry.targetId === 'exe_named_owner',
    );

    expect(byOwner, 'the owner’s conclusion is not in the audit trail').toBeDefined();
    expect(byOwner?.actorType).toBe('human');
  });

  it('names the agent that accepted a task, and the owner on the route', async () => {
    const agent = await createAgent('Accepter', ['task.accept']);
    const toolTaskId = await createTask(ownId, 'Accepted by the agent');
    const routeTaskId = await createTask(ownId, 'Accepted by the owner');

    await mcp({ authorization: `Bearer ${agent.token}` }, 'task.accept', {
      taskId: toolTaskId,
      satisfied: true,
      reason: 'checked and accepted',
    });
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${routeTaskId}/accept`,
      headers: { cookie: sessionCookie },
      payload: { satisfied: true, reason: 'checked and accepted' },
    });

    const entries = await auditEntries(ownId);
    const byAgent = entries.find(
      (entry) => entry.action === 'task.accepted' && entry.targetId === toolTaskId,
    );
    const byOwner = entries.find(
      (entry) => entry.action === 'task.accepted' && entry.targetId === routeTaskId,
    );

    expect(byAgent, 'the acceptance is not in the audit trail').toBeDefined();
    expect(byAgent?.actorType).toBe('agent');
    expect(byAgent?.actorId).toBe(agent.id);

    expect(byOwner, 'the owner’s acceptance is not in the audit trail').toBeDefined();
    expect(byOwner?.actorType).toBe('human');
  });

  it('answers a task whose outcome could not be confirmed, and says so in the trail', async () => {
    const agent = await createAgent('Accepter', ['task.accept']);
    const taskId = await createTask(ownId, 'A task nobody confirmed');

    // The task's outcome could not be confirmed, so it waits for the owner to
    // say what happened.
    markTaskUnknown(taskId);

    await mcp({ authorization: `Bearer ${agent.token}` }, 'task.accept', {
      taskId,
      satisfied: true,
    });

    const entries = await auditEntries(ownId);
    const resolved = entries.find(
      (entry) => entry.action === 'task.outcome.resolved' && entry.targetId === taskId,
    );

    expect(resolved, 'the resolution is not in the audit trail').toBeDefined();
    expect(resolved?.actorType).toBe('agent');
    expect(resolved?.metadata).toMatchObject({ from: 'unknown', to: 'done' });
  });
});
