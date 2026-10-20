import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { executions, queueJobs } from '../db/schema.js';
import type { WaitingItem } from '../api/waiting.js';

/**
 * "Outcome unknown" is a state the owner can see.
 *
 * A turn, execution or task whose outcome cannot be confirmed used to be
 * recorded as `failed`, and `failed` reads as "safe to retry" — so a side
 * effect that may already have happened could run twice.
 *
 * These tests hold the rule: an unknown outcome is its own state, it is never
 * retried on its own, it reaches the owner as something to check, and every
 * transition into and out of it is written to the audit trail.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

async function waiting(): Promise<WaitingItem[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingItem[];
}

async function createTask(title: string, status?: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title, acceptanceCriteria: [] },
  });
  const id = created.json().task.id as string;

  if (status) {
    // Only the worker puts a task into the unknown state, so the test does
    // it through the service rather than through the owner's route.
    app.services.factory.updateTask(id, { status: status as never });
  }

  return id;
}

function executionStatus(executionId: string): string | null {
  const row = app.services.runtime.db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .get();
  return row?.status ?? null;
}

function jobStatus(jobId: string): string | null {
  const row = app.services.runtime.db.select().from(queueJobs).where(eq(queueJobs.id, jobId)).get();
  return row?.status ?? null;
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-unknown-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'unknown-owner-token',
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
  const body = workspaces.json().workspaces as Array<{ id: string }>;
  workspaceId = body[0]?.id ?? '';
});

afterAll(async () => {
  await app.close();
});

describe('an outcome that could not be confirmed', () => {
  it('is a state of its own, not a failure', async () => {
    const id = await createTask('The turn we cannot confirm', 'unknown');
    const task = app.services.factory.getTask(id);

    expect(task.status).toBe('unknown');
    expect(task.status).not.toBe('failed');
  });

  it('reaches the owner as something to check, not something to fix', async () => {
    const id = await createTask('Check this one', 'unknown');

    const items = await waiting();
    const item = items.find((entry) => entry.taskId === id);

    expect(item).toBeDefined();
    expect(item?.reason).toBe('unknown');
    expect(item?.detail).toMatch(/cannot confirm/i);
    // It must not read as a failure that may simply be repeated.
    expect(item?.detail).not.toMatch(/blocked|unblock/i);
  });

  it('is never automatically retried', () => {
    const queue = app.services.queue;
    const job = queue.enqueue({
      workspaceId,
      type: 'chat.turn',
      payload: { conversationId: 'cnv_1' },
    });

    const claimed = queue.claimNext('worker_1');
    expect(claimed?.id).toBe(job.id);

    // The turn started and its outcome could not be confirmed. The job is
    // held, not requeued.
    queue.hold(job.id, 'The outcome could not be confirmed.');

    const after = queue.claimNext('worker_1');
    expect(after).toBeNull();
    expect(jobStatus(job.id)).toBe('unknown');
  });

  it('leaves the audit trail when the owner resolves it', async () => {
    const id = await createTask('Resolve me', 'unknown');

    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: sessionCookie },
      payload: { status: 'open' },
    });
    expect(moved.statusCode).toBe(200);

    const entries = app.services.audit.list(workspaceId, 200);
    const resolved = entries.find((entry) => entry.targetId === id);

    expect(resolved).toBeDefined();
    expect(resolved?.action).toBe('task.outcome.resolved');
    expect(resolved?.result).toBe('success');
  });

  it('records a rejected approval as cancelled, because the work was stopped', async () => {
    const now = new Date().toISOString();
    app.services.runtime.db
      .insert(executions)
      .values({
        id: 'exe_rejected',
        workspaceId,
        conversationId: null,
        taskId: null,
        externalRef: null,
        agentConnectionId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'blocked',
        error: null,
        spendUnits: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
      })
      .run();

    const approval = app.services.approvals.request({
      workspaceId,
      executionId: 'exe_rejected',
      summary: 'Send the message',
      requestedBy: 'agt_1',
    });

    const decided = await app.inject({
      method: 'POST',
      url: `/api/approvals/${approval.id}/decide`,
      headers: { cookie: sessionCookie },
      payload: { approved: false, reason: 'Not this time' },
    });
    expect(decided.statusCode).toBe(200);

    // The work did not run, and that is known. It is not a failure and it is
    // not an unknown.
    expect(executionStatus('exe_rejected')).toBe('cancelled');
  });
});
