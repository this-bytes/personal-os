// @vitest-environment node
/**
 * The conclusion about an automation's run whose outcome could not be
 * confirmed.
 *
 * SPEC-R0-4 holds a job when the worker that was running it stopped without
 * saying how it ended. For a chat turn the owner answers with
 * `POST /api/executions/:id/resolve`; an automation's run has no conversation
 * and no turn of its own, so the owner needs a way to answer for it too.
 *
 * This file proves four things about that way:
 *
 *  1. **The owner's route answers.** The run leaves the unknown state, the
 *     job that was held for it is settled with it, and the trail names the
 *     owner who reached the conclusion.
 *  2. **It answers only once.** A run that has already ended is refused, a run
 *     that does not exist is not found, and a run that belongs to another
 *     automation is not this automation's run.
 *  3. **The agent's tool is the same path.** `automation.run.resolve` closes
 *     the same run and writes the same trail, and it is not in the default
 *     grant set: a connection that may close a question the worker could not
 *     answer is a connection the owner has said may close one.
 *  4. **The agent's tool is bounded.** An agent granted the tool in one
 *     workspace cannot close a run in another.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { mcpToolNames } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { automationRuns, queueJobs } from '../db/schema.js';

let app: FastifyInstance;
let sessionCookie = '';
/** The workspace the owner and the granted agent work in. */
let ownId = '';
/** The workspace an agent may not reach. */
let otherId = '';
let dataDir = '';
/** The automation whose runs the owner answers for. */
let automationId = '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-automation-run-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'automation-run-owner-token',
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
  ownId = (workspaces.json().workspaces as Array<{ id: string }>)[0]?.id ?? '';

  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name: 'Elsewhere', description: 'The workspace the agent may not reach.' },
  });
  otherId = created.json().workspace.id as string;

  const automation = await app.inject({
    method: 'POST',
    url: '/api/automations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId: ownId,
      title: 'The gate automation',
      trigger: { type: 'schedule', everyMinutes: 60 },
      action: { type: 'resource.refresh', resourceId: 'res_gate', method: 'GET' },
    },
  });
  expect(automation.statusCode).toBe(201);
  automationId = automation.json().automation.id as string;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/**
 * A run whose outcome could not be confirmed, and the job held for it.
 *
 * This is the state a worker leaves behind when it stops: the job is held,
 * and the run says that nobody knows how it ended.
 */
function seedUncertainRun(runId: string, runAutomationId: string = automationId): void {
  const now = new Date().toISOString();
  const db = app.services.runtime.db;
  db.insert(automationRuns)
    .values({
      id: runId,
      automationId: runAutomationId,
      status: 'unknown',
      startedAt: now,
      finishedAt: null,
      output: null,
      error: 'The worker stopped before it recorded how the run ended.',
    })
    .run();
  db.insert(queueJobs)
    .values({
      id: `job_${runId}`,
      workspaceId: ownId,
      type: 'automation.run',
      payload: { automationId: runAutomationId, runId },
      status: 'unknown',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: 'The worker stopped before it recorded how the run ended.',
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/** The run's row, as it stands now. */
function runOf(runId: string): { status: string; error: string | null } | undefined {
  return app.services.runtime.db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.id, runId))
    .get();
}

/** The job's row, as it stands now. */
function jobOf(jobId: string): { status: string } | undefined {
  return app.services.runtime.db.select().from(queueJobs).where(eq(queueJobs.id, jobId)).get();
}

/** An agent connection in a workspace, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants: string[],
  agentWorkspaceId: string = ownId,
): Promise<string> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId: agentWorkspaceId,
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
    payload: { label: 'automation-run' },
  });
  expect(token.statusCode).toBe(201);
  return token.json().token as string;
}

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

/** The tools a connection can see. */
async function toolsOf(token: string): Promise<string[]> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });
  return listedTools(response.body);
}

describe("the owner's conclusion about an automation's run", () => {
  it('closes the run, settles the job that was held for it, and writes the trail', async () => {
    seedUncertainRun('run_owner');

    const response = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_owner/resolve`,
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed', note: 'It did run.' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().run.status).toBe('completed');

    expect(runOf('run_owner')?.status).toBe('completed');
    expect(jobOf('job_run_owner')?.status).toBe('done');

    const entry = app.services.runtime.audit
      .list(ownId, 100)
      .find((candidate) => candidate.action === 'automation.run.outcome.resolved');
    expect(entry?.targetId).toBe('run_owner');
    expect(entry?.actorType).toBe('human');
  });

  it('refuses a run that has already ended', async () => {
    seedUncertainRun('run_ended');
    await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_ended/resolve`,
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });

    const second = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_ended/resolve`,
      headers: { cookie: sessionCookie },
      payload: { outcome: 'failed' },
    });
    expect(second.statusCode).toBe(409);
    expect(runOf('run_ended')?.status).toBe('completed');
  });

  it('does not find a run that does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_missing/resolve`,
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('does not close a run that belongs to another automation', async () => {
    const other = await app.inject({
      method: 'POST',
      url: '/api/automations',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId: ownId,
        title: 'Another automation',
        trigger: { type: 'schedule', everyMinutes: 30 },
        action: { type: 'resource.refresh', resourceId: 'res_other', method: 'GET' },
      },
    });
    const otherAutomationId = other.json().automation.id as string;
    seedUncertainRun('run_elsewhere', otherAutomationId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_elsewhere/resolve`,
      headers: { cookie: sessionCookie },
      payload: { outcome: 'completed' },
    });
    expect(response.statusCode).toBe(404);
    expect(runOf('run_elsewhere')?.status).toBe('unknown');
  });

  it('refuses a conclusion without a body that says what it is', async () => {
    seedUncertainRun('run_nobody');
    const response = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_nobody/resolve`,
      headers: { cookie: sessionCookie },
      payload: {},
    });
    expect(response.statusCode).toBe(422);
  });

  it("is the owner's route, and an agent token is refused", async () => {
    seedUncertainRun('run_agent_token');
    const token = await createAgent('The agent with a token', ['automation.run.resolve']);
    const response = await app.inject({
      method: 'POST',
      url: `/api/automations/${automationId}/runs/run_agent_token/resolve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { outcome: 'completed' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("the agent's conclusion about an automation's run", () => {
  it('is not in the default grant set', async () => {
    const token = await createAgent('The agent without the grant', []);

    // The tool is not offered at all, so there is nothing to call.
    expect(await toolsOf(token)).not.toContain('automation.run.resolve');

    // And a call for it closes nothing.
    seedUncertainRun('run_ungranted');
    await mcp({ authorization: `Bearer ${token}` }, 'automation.run.resolve', {
      runId: 'run_ungranted',
      outcome: 'completed',
    });
    expect(runOf('run_ungranted')?.status).toBe('unknown');
    expect(jobOf('job_run_ungranted')?.status).toBe('unknown');
  });

  it('closes the run through the same path, and names the agent in the trail', async () => {
    seedUncertainRun('run_agent');
    const token = await createAgent('The agent with the grant', ['automation.run.resolve']);

    const response = await mcp({ authorization: `Bearer ${token}` }, 'automation.run.resolve', {
      runId: 'run_agent',
      outcome: 'completed',
      note: 'It did run.',
    });
    const result = toolResult(response.body);
    expect(result.isError).toBe(false);
    expect(result.text).toContain('run_agent');

    expect(runOf('run_agent')?.status).toBe('completed');
    expect(jobOf('job_run_agent')?.status).toBe('done');

    const entry = app.services.runtime.audit
      .list(ownId, 100)
      .find((candidate) => candidate.action === 'automation.run.outcome.resolved');
    expect(entry?.actorType).toBe('agent');
    expect(entry?.targetId).toBe('run_agent');
  });

  it('cannot close a run in a workspace it was not granted', async () => {
    seedUncertainRun('run_out_of_scope');
    const token = await createAgent(
      'The agent from elsewhere',
      ['automation.run.resolve'],
      otherId,
    );

    const response = await mcp({ authorization: `Bearer ${token}` }, 'automation.run.resolve', {
      runId: 'run_out_of_scope',
      outcome: 'completed',
    });
    const result = toolResult(response.body);
    expect(result.isError).toBe(true);
    expect(result.text).toContain('no access to that workspace');
    expect(runOf('run_out_of_scope')?.status).toBe('unknown');
  });
});
