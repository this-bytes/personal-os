import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type { AgentEvent, ExecutionStatus } from '@personal-os/contracts';
import { approvalEvidenceSchema } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { executions } from '../db/schema.js';

/**
 * The evidence a decision is taken against.
 *
 * The owner decides on two buttons and a title, and this is what the buttons
 * are about. The proof is written as data: an execution with the events it
 * really produced, an approval that names it, and an approval that names
 * nothing. A number nobody can reproduce from real rows is a claim, not
 * evidence.
 *
 * The shape is checked against CONTRACTS.md and against the code, rather than
 * against a copy of either, so the two cannot drift apart quietly.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const NOW = '2026-10-21T00:00:00.000Z';

let app: FastifyInstance;
let sessionCookie = '';
let agentToken = '';
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-approval-evidence-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'approval-evidence-owner-token',
    PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
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

  // An agent, with a token of its own: the evidence is the owner's to read,
  // and an agent token is not the owner's.
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name: 'Reader',
      adapterType: 'echo',
      config: { reply: 'hi' },
      toolGrants: [],
    },
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
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** An execution row, with the parts the evidence reads. */
function seedExecution(options: {
  id: string;
  status?: ExecutionStatus;
  error?: string | null;
  spendUnits?: number;
}): void {
  app.services.runtime.db
    .insert(executions)
    .values({
      id: options.id,
      workspaceId,
      conversationId: null,
      taskId: null,
      externalRef: null,
      agentConnectionId: null,
      executionOwner: 'personal-os',
      status: options.status ?? 'blocked',
      error: options.error ?? null,
      spendUnits: options.spendUnits ?? 0,
      startedAt: NOW,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();
}

/** An agent event, as the event log keeps it. */
function publishAgentEvent(event: AgentEvent): void {
  app.services.events.publish(
    { type: 'execution.event', executionId: event.executionId, event },
    { workspaceId },
  );
}

/** An approval the owner has to decide about. */
function requestApproval(executionId?: string): string {
  return app.services.approvals.request({
    workspaceId,
    ...(executionId ? { executionId } : {}),
    summary: 'Delete the production database',
  }).id;
}

/** The evidence the route publishes for one approval. */
async function evidence(approvalId: string): Promise<Record<string, any>> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/approvals/${approvalId}/evidence`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

/** The fields an interface publishes, with the types it publishes them as. */
function publishedFields(name: string): Record<string, string> {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const block = new RegExp(`interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(text);
  expect(block, `CONTRACTS.md no longer publishes ${name}`).not.toBeNull();
  if (!block) throw new Error(`CONTRACTS.md no longer publishes ${name}`);

  const fields: Record<string, string> = {};
  for (const line of block[1]!.split('\n')) {
    const field = /^\s*(\w+):\s*([A-Za-z0-9_|'\[\] ]+);/.exec(line);
    if (field) fields[field[1]!] = field[2]!.trim();
  }
  expect(Object.keys(fields).length).toBeGreaterThan(0);
  return fields;
}

/** The execution statuses the contract publishes. */
function publishedStatuses(): string[] {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const block = /type ExecutionStatus =([\s\S]*?);/.exec(text);
  expect(block, 'CONTRACTS.md no longer publishes ExecutionStatus').not.toBeNull();
  if (!block) throw new Error('CONTRACTS.md no longer publishes ExecutionStatus');
  return [...block[1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
}

/**
 * The value has the shape the contract publishes, member for member.
 *
 * The contract leads the code, so the reading of the contract is the reading
 * here: a field the contract publishes is present, a field it does not publish
 * is absent, and a type it does not publish fails the test rather than being
 * quietly accepted.
 */
function expectPublishedShape(name: string, value: Record<string, unknown>): void {
  const published = publishedFields(name);
  expect(Object.keys(value).sort()).toEqual(Object.keys(published).sort());

  for (const [field, type] of Object.entries(published)) {
    const actual = value[field];
    if (type === 'string') {
      expect(typeof actual, `${name}.${field} should be a string`).toBe('string');
    } else if (type === 'string | null') {
      expect(
        actual === null || typeof actual === 'string',
        `${name}.${field} is not a string`,
      ).toBe(true);
    } else if (type === 'number') {
      expect(typeof actual, `${name}.${field} should be a number`).toBe('number');
    } else if (type === 'ExecutionStatus') {
      expect(publishedStatuses()).toContain(actual);
    } else if (type === "'completed' | 'unfinished'") {
      expect(['completed', 'unfinished']).toContain(actual);
    } else if (type === 'ExecutionEvidence | null') {
      if (actual === null) continue;
      expectPublishedShape('ExecutionEvidence', actual as Record<string, unknown>);
    } else if (type.endsWith('[]')) {
      expect(Array.isArray(actual), `${name}.${field} should be a list`).toBe(true);
      const inner = type.slice(0, -2);
      for (const entry of actual as Record<string, unknown>[]) {
        expectPublishedShape(inner, entry);
      }
    } else {
      throw new Error(`CONTRACTS.md publishes an unknown type for ${name}.${field}: ${type}`);
    }
  }
}

describe('the approval evidence', () => {
  it('answers no execution for an approval that names none', async () => {
    const approvalId = requestApproval();

    const published = await evidence(approvalId);

    // There was nothing to show, not an empty run: no execution, and with it
    // no tool calls, no artifacts and no cost. It is not an error either.
    expect(published.execution).toBeNull();
    expect(published.approvalId).toBe(approvalId);
    expect(published.workspaceId).toBe(workspaceId);
  });

  it('answers no execution for an approval whose execution is gone', async () => {
    const approvalId = requestApproval('exe_never_ran');

    const published = await evidence(approvalId);

    expect(published.execution).toBeNull();
  });

  it('answers a call that was answered, and a call that was not', async () => {
    seedExecution({ id: 'exe_calls' });
    const approvalId = requestApproval('exe_calls');

    publishAgentEvent({ type: 'tool.started', executionId: 'exe_calls', toolName: 'search' });
    publishAgentEvent({ type: 'tool.completed', executionId: 'exe_calls', toolName: 'search' });
    publishAgentEvent({ type: 'tool.started', executionId: 'exe_calls', toolName: 'write' });

    const published = await evidence(approvalId);
    const calls = published.execution.toolCalls as Record<string, unknown>[];

    expect(calls.length).toBe(2);

    // The call that was answered says so, and says when it was answered.
    expect(calls[0]!.toolName).toBe('search');
    expect(calls[0]!.outcome).toBe('completed');
    expect(typeof calls[0]!.completedAt).toBe('string');

    // The call that was not is unfinished, and the evidence does not say why:
    // the published vocabulary has no failure event for a tool call.
    expect(calls[1]!.toolName).toBe('write');
    expect(calls[1]!.outcome).toBe('unfinished');
    expect(calls[1]!.completedAt).toBeNull();
  });

  it('answers a completion to the call it belongs to, and leaves the other call unanswered', async () => {
    // The events name the tool and not the call, so where two calls of one
    // tool are open at once, a completion has to be matched to one of them.
    // It answers the most recent one, which is the rule the AG-UI stream uses
    // for the same events; the earlier call is left unanswered, and the
    // evidence does not say why.
    seedExecution({ id: 'exe_overlapping' });
    const approvalId = requestApproval('exe_overlapping');

    publishAgentEvent({ type: 'tool.started', executionId: 'exe_overlapping', toolName: 'search' });
    publishAgentEvent({ type: 'tool.started', executionId: 'exe_overlapping', toolName: 'search' });
    publishAgentEvent({
      type: 'tool.completed',
      executionId: 'exe_overlapping',
      toolName: 'search',
    });

    const published = await evidence(approvalId);
    const calls = published.execution.toolCalls as Record<string, unknown>[];

    expect(calls.length).toBe(2);
    expect(calls[0]!.outcome).toBe('unfinished');
    expect(calls[0]!.completedAt).toBeNull();
    expect(calls[1]!.outcome).toBe('completed');
    expect(typeof calls[1]!.completedAt).toBe('string');
  });

  it('does not invent a call for a completion that answers none', async () => {
    seedExecution({ id: 'exe_orphan' });
    const approvalId = requestApproval('exe_orphan');

    publishAgentEvent({ type: 'tool.completed', executionId: 'exe_orphan', toolName: 'search' });

    const published = await evidence(approvalId);

    expect(published.execution.toolCalls).toEqual([]);
  });

  it('answers the artifacts with the title and the resource they were given', async () => {
    seedExecution({ id: 'exe_artifacts' });
    const approvalId = requestApproval('exe_artifacts');

    publishAgentEvent({
      type: 'artifact.created',
      executionId: 'exe_artifacts',
      title: 'The report',
      resourceId: 'res_1',
    });
    publishAgentEvent({ type: 'artifact.created', executionId: 'exe_artifacts' });

    const published = await evidence(approvalId);
    const artifacts = published.execution.artifacts as Record<string, unknown>[];

    expect(artifacts.length).toBe(2);
    expect(artifacts[0]!.title).toBe('The report');
    expect(artifacts[0]!.resourceId).toBe('res_1');
    expect(typeof artifacts[0]!.createdAt).toBe('string');

    // An artifact that was given neither carries neither, rather than an
    // invented title.
    expect(artifacts[1]!.title).toBeNull();
    expect(artifacts[1]!.resourceId).toBeNull();
  });

  it('answers the cost and the status as they are recorded', async () => {
    seedExecution({
      id: 'exe_failed',
      status: 'failed',
      error: 'The adapter refused the call.',
      spendUnits: 3,
    });
    const approvalId = requestApproval('exe_failed');

    const published = await evidence(approvalId);

    expect(published.execution.status).toBe('failed');
    expect(published.execution.error).toBe('The adapter refused the call.');
    // The spend units are the column as it is recorded, not a spend this read
    // worked out for itself.
    expect(published.execution.spendUnits).toBe(3);
    expect(published.execution.startedAt).toBe(NOW);
  });

  it('answers a cancellation with no error, because a cancellation is a decision', async () => {
    seedExecution({ id: 'exe_cancelled', status: 'cancelled', error: null });
    const approvalId = requestApproval('exe_cancelled');

    const published = await evidence(approvalId);

    expect(published.execution.status).toBe('cancelled');
    expect(published.execution.error).toBeNull();
  });

  it('answers for one approval only', async () => {
    seedExecution({ id: 'exe_mine' });
    seedExecution({ id: 'exe_other' });
    const approvalId = requestApproval('exe_mine');

    publishAgentEvent({ type: 'tool.started', executionId: 'exe_other', toolName: 'other-tool' });
    publishAgentEvent({ type: 'tool.started', executionId: 'exe_mine', toolName: 'my-tool' });

    const published = await evidence(approvalId);
    const calls = published.execution.toolCalls as Record<string, unknown>[];

    expect(calls.length).toBe(1);
    expect(calls[0]!.toolName).toBe('my-tool');
  });
});

describe('the evidence route', () => {
  it('answers the shape CONTRACTS.md publishes, member for member', async () => {
    seedExecution({ id: 'exe_shape' });
    const approvalId = requestApproval('exe_shape');
    publishAgentEvent({ type: 'tool.started', executionId: 'exe_shape', toolName: 'search' });
    publishAgentEvent({
      type: 'artifact.created',
      executionId: 'exe_shape',
      title: 'A note',
      resourceId: 'res_2',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}/evidence`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();

    // The schema the contracts publish is the schema the route answers.
    const parsed = approvalEvidenceSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    expectPublishedShape('ApprovalEvidence', body);
    expectPublishedShape('ExecutionEvidence', body.execution);
    expectPublishedShape('ToolCallEvidence', body.execution.toolCalls[0]);
    expectPublishedShape('ArtifactEvidence', body.execution.artifacts[0]);
  });

  it('refuses a caller with no session', async () => {
    const approvalId = requestApproval();

    const response = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}/evidence`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses an agent token', async () => {
    const approvalId = requestApproval();

    const response = await app.inject({
      method: 'GET',
      url: `/api/approvals/${approvalId}/evidence`,
      headers: { authorization: `Bearer ${agentToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses an approval that does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/approvals/apr_nothing/evidence',
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(404);
  });
});
