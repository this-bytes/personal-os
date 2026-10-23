import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config.js';
import { buildApp } from '../app.js';
import { executions, queueJobs } from '../db/schema.js';
import { createTestDataDir } from './helpers.js';

/**
 * The turn, its activity, and the stop request.
 *
 * The trace the panel draws is derived from the event log, so it is still
 * there when the owner comes back to the room — and the stop request is a
 * request, not a cancellation, and the route says which of the two happened.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  const dataDir = createTestDataDir('pos-turn-activity-');
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'turn-activity-owner-token',
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
  workspaceId = (workspaces.json().workspaces as Array<{ id: string }>)[0]?.id ?? '';
});

afterAll(async () => {
  await app.close();
});

/** Write a turn the way the worker writes one. */
function writeTurn(id: string, status: string): void {
  const now = new Date().toISOString();
  app.services.runtime.db
    .insert(executions)
    .values({
      id,
      workspaceId,
      conversationId: 'cnv_turn',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: status as never,
      error: null,
      spendUnits: 8,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    })
    .run();
}

/** Publish an adapter event onto the log, the way the worker does. */
function publish(executionId: string, event: Record<string, unknown>): void {
  app.services.events.publish(
    {
      type: 'execution.event',
      executionId,
      event: event as never,
    },
    { workspaceId, conversationId: 'cnv_turn' },
  );
}

describe('the turn and its activity', () => {
  it('answers with the turn, what it did, and what the owner may do', async () => {
    const executionId = 'exe_activity_1';
    writeTurn(executionId, 'running');
    publish(executionId, {
      type: 'tool.started',
      executionId,
      toolName: 'read_resource',
      input: { id: 'res_1' },
    });
    publish(executionId, {
      type: 'tool.completed',
      executionId,
      toolName: 'read_resource',
      output: { revision: 2 },
    });
    publish(executionId, { type: 'message.delta', executionId, text: 'Hello ' });
    publish(executionId, { type: 'message.delta', executionId, text: 'there' });
    publish(executionId, { type: 'message.completed', executionId, text: 'Hello there' });
    publish(executionId, {
      type: 'artifact.created',
      executionId,
      title: 'Runbook',
      resourceId: 'res_2',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.turn.id).toBe(executionId);
    expect(body.turn.status).toBe('running');
    expect(body.turn.spendUnits).toBe(8);
    // A turn recorded before the capability view existed has none, and an
    // absent view is reported as absent rather than as empty.
    expect(body.turn.capabilityView).toBeNull();
    expect(body.turn.delegatedTasks).toBeNull();

    const events = body.activities as Array<{
      event: string | null;
      toolName?: string;
      status: string;
      count?: number;
      summary?: string;
    }>;
    const tool = events.find((entry) => entry.event === 'tool.started');
    expect(tool?.toolName).toBe('read_resource');
    expect(tool?.status).toBe('done');

    const reply = events.find((entry) => entry.event === 'message.delta');
    expect(reply?.count).toBe(2);

    const artifact = events.find((entry) => entry.event === 'artifact.created');
    expect(artifact?.summary).toBe('Runbook');

    // The stop is available for a running turn, and the steer is not: this
    // turn captured no capability that says it can be steered.
    const stop = (
      body.run.options as Array<{ operation: string; available: boolean; reason: string | null }>
    ).find((option) => option.operation === 'stop');
    expect(stop?.available).toBe(true);

    const steer = (
      body.run.options as Array<{ operation: string; available: boolean; reason: string | null }>
    ).find((option) => option.operation === 'steer');
    expect(steer?.available).toBe(false);
    expect(steer?.reason).toContain('cannot be steered');
  });

  it('is not readable without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/executions/exe_activity_1' });

    expect(response.statusCode).toBe(401);
  });

  it('says so when there is no such turn', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/executions/exe_missing',
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});

describe('the stop request', () => {
  it('asks a running turn to stop, and says that it may still finish', async () => {
    const executionId = 'exe_stop_running';
    writeTurn(executionId, 'running');

    const response = await app.inject({
      method: 'POST',
      url: `/api/executions/${executionId}/stop`,
      headers: { cookie: sessionCookie },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.outcome).toBe('requested');
    expect(body.detail).toContain('may finish the current turn');
    expect(body.run.state).toBe('stopping');
  });

  it('cancels a turn that had not started, and says so truthfully', async () => {
    const executionId = 'exe_stop_queued';
    writeTurn(executionId, 'queued');
    const now = new Date().toISOString();
    app.services.runtime.db
      .insert(queueJobs)
      .values({
        id: 'job_queued_1',
        workspaceId,
        type: 'agent.turn',
        payload: { executionId },
        status: 'queued',
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        runAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const response = await app.inject({
      method: 'POST',
      url: `/api/executions/${executionId}/stop`,
      headers: { cookie: sessionCookie },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.outcome).toBe('cancelled');
    expect(body.detail).toContain('will not run');

    const turn = app.services.runtime.db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .get();
    expect(turn?.status).toBe('cancelled');
  });

  it('says there is nothing to stop when the turn has already finished', async () => {
    const executionId = 'exe_stop_done';
    writeTurn(executionId, 'completed');

    const response = await app.inject({
      method: 'POST',
      url: `/api/executions/${executionId}/stop`,
      headers: { cookie: sessionCookie },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.outcome).toBe('not_running');
    expect(body.detail).toContain('already finished');
  });

  it('is not reachable without a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/executions/exe_stop_running/stop',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });
});
