import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../config.js';
import {
  agentConnections,
  conversations,
  executions,
  messages,
  participants,
  queueJobs,
} from '../../db/schema.js';
import type { AgUiEvent } from '../agui-protocol.js';

/**
 * The AG-UI surface, at the HTTP boundary.
 *
 * The panel's own stream stays exactly as it was — that is the first thing
 * this file checks — and the AG-UI route sits beside it, carrying the same
 * events in a published protocol's vocabulary. The approval round trip is
 * the part that has to work end to end: an interrupt that names the
 * approval, and a resume that resolves the approval it names.
 */

let app: FastifyInstance;
let baseUrl = '';
let sessionCookie = '';
let workspaceId = '';
const NOW = '2026-01-01T00:00:00.000Z';

/** Read the frames of a stream until enough of them have arrived. */
async function readFrames(url: string, until: (frames: string[]) => boolean): Promise<string[]> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: { cookie: sessionCookie },
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const frames: string[] = [];
  let buffer = '';
  const deadline = Date.now() + 5_000;

  try {
    while (!until(frames) && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n\n');
      while (index >= 0) {
        frames.push(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        index = buffer.indexOf('\n\n');
      }
    }
  } finally {
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }

  return frames;
}

/** The AG-UI events a stream carried. */
function agUiEvents(frames: string[]): AgUiEvent[] {
  return frames
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => JSON.parse(frame.slice(6)) as AgUiEvent);
}

/** Seed a turn that is waiting for the owner's decision. */
function seedBlockedTurn(): { approvalId: string; executionId: string } {
  const db = app.services.runtime.db;

  db.insert(conversations)
    .values({
      id: 'cnv_1',
      workspaceId,
      title: 'A conversation',
      routingMode: 'mentions',
      coordinatorId: null,
      paused: false,
      maxTurns: 8,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(participants)
    .values({
      id: 'p_1',
      conversationId: 'cnv_1',
      type: 'agent',
      agentConnectionId: 'agt_1',
      displayName: 'The agent',
      joinedAt: NOW,
    })
    .run();

  db.insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId,
      name: 'The agent',
      adapterType: 'echo',
      configRef: 'cfg_1',
      toolGrants: null,
      enabled: true,
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: true,
        approvals: true,
        artifacts: false,
      },
      status: 'unknown',
      lastError: null,
      lastConnectedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(executions)
    .values({
      id: 'exe_1',
      workspaceId,
      conversationId: 'cnv_1',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'blocked',
      error: null,
      spendUnits: 0,
      startedAt: NOW,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();

  const approval = app.services.approvals.request({
    workspaceId,
    executionId: 'exe_1',
    conversationId: 'cnv_1',
    agentConnectionId: 'agt_1',
    summary: 'Delete the production database',
  });

  return { approvalId: approval.id, executionId: 'exe_1' };
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-agui-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'agui-owner-token',
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

  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  const db = app.services.runtime.db;
  db.delete(queueJobs).run();
  db.delete(messages).run();
  db.delete(executions).run();
  db.delete(participants).run();
  db.delete(conversations).run();
  db.delete(agentConnections).run();
});

describe('the panel’s own stream', () => {
  it('still answers with the same event names, the same priming and the same framing', async () => {
    const events = app.services.events;
    const published = events.publish({ type: 'heartbeat', at: NOW });
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: { type: 'execution.status', executionId: 'exe_1', status: 'queued' },
    });

    const frames = await readFrames(`${baseUrl}/api/events`, (read) =>
      read.some((frame) => frame.includes('execution.event')),
    );

    // The framing is the panel’s own: an id, an event name and a payload.
    const heartbeat = frames.find((frame) => frame.includes('event: heartbeat'));
    expect(heartbeat).toBe(
      `id: ${published.seq}\nevent: heartbeat\ndata: {"type":"heartbeat","at":"${NOW}"}`,
    );
    const execution = frames.find((frame) => frame.includes('event: execution.event'));
    expect(execution).toContain('"type":"execution.status"');
  });
});

describe('the AG-UI stream', () => {
  it('carries the same events as AG-UI, one event per frame', async () => {
    const events = app.services.events;
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_2',
      executionId: 'exe_agui',
      event: { type: 'execution.status', executionId: 'exe_agui', status: 'queued' },
    });
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_2',
      executionId: 'exe_agui',
      event: { type: 'message.delta', executionId: 'exe_agui', text: 'Hello.' },
    });
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_2',
      executionId: 'exe_agui',
      event: { type: 'message.completed', executionId: 'exe_agui', text: 'Hello.' },
    });
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_2',
      executionId: 'exe_agui',
      event: { type: 'execution.status', executionId: 'exe_agui', status: 'completed' },
    });

    const frames = await readFrames(`${baseUrl}/api/agui/events`, (read) =>
      agUiEvents(read).some((event) => event.type === 'RUN_FINISHED' && event.runId === 'exe_agui'),
    );
    const carried = agUiEvents(frames);
    // Only the lifecycle events carry the run id, so the run is the span
    // between its start and its close.
    const start = carried.findIndex(
      (event) => event.type === 'RUN_STARTED' && (event as { runId?: string }).runId === 'exe_agui',
    );
    const end = carried.findIndex(
      (event) =>
        event.type === 'RUN_FINISHED' && (event as { runId?: string }).runId === 'exe_agui',
    );
    const run = carried.slice(start, end + 1);

    // The AG-UI binding frames one protocol event per frame, and the
    // panel’s own framing — an event name and an id — is not carried.
    expect(frames.filter((frame) => frame.startsWith('data: ')).length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.startsWith('data: ') || frame.startsWith(':'))).toBe(true);
    expect(run.map((event) => event.type)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
  });

  it('carries one conversation when the caller names one', async () => {
    const events = app.services.events;
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_scoped',
      executionId: 'exe_scoped',
      event: { type: 'execution.status', executionId: 'exe_scoped', status: 'queued' },
    });
    events.publish({
      type: 'execution.event',
      conversationId: 'cnv_other',
      executionId: 'exe_other_2',
      event: { type: 'execution.status', executionId: 'exe_other_2', status: 'queued' },
    });

    const frames = await readFrames(
      `${baseUrl}/api/agui/events?conversationId=cnv_scoped`,
      (read) => read.some((frame) => frame.includes('exe_scoped')),
    );
    const carried = agUiEvents(frames);

    expect(carried.some((event) => (event as { runId?: string }).runId === 'exe_scoped')).toBe(
      true,
    );
    expect(carried.some((event) => (event as { runId?: string }).runId === 'exe_other_2')).toBe(
      false,
    );
  });

  it('carries an approval as an interrupt that names the approval', async () => {
    const { approvalId } = seedBlockedTurn();

    app.services.events.publish({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: {
        type: 'approval.requested',
        executionId: 'exe_1',
        approvalId,
        summary: 'Delete the production database',
      },
    });

    const frames = await readFrames(`${baseUrl}/api/agui/events`, (read) =>
      read.some((frame) => frame.includes('"interrupt"')),
    );
    const carried = agUiEvents(frames);
    const finished = carried.find(
      (event) =>
        event.type === 'RUN_FINISHED' &&
        (event as { outcome?: { type: string } }).outcome?.type === 'interrupt',
    );

    expect(finished).toBeDefined();
    const outcome = (finished as { outcome?: { type: string; interrupts?: unknown[] } }).outcome;
    expect(outcome?.type).toBe('interrupt');
    const interrupt = outcome?.interrupts?.[0] as { id: string; reason: string };
    expect(interrupt.id).toBe(approvalId);
    expect(interrupt.reason).toBe('confirmation');
  });

  it('resolves the approval a resume names', async () => {
    const { approvalId } = seedBlockedTurn();

    const response = await app.inject({
      method: 'POST',
      url: '/api/agui/runs/exe_1/resume',
      headers: { cookie: sessionCookie },
      payload: {
        resume: [
          {
            interruptId: approvalId,
            status: 'resolved',
            payload: { approved: true, reason: 'It is my own homelab' },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      runId: string;
      resumed: Array<{ interruptId: string; approval: { id: string; status: string } }>;
    };
    expect(body.runId).toBe('exe_1');
    expect(body.resumed[0]?.interruptId).toBe(approvalId);
    expect(body.resumed[0]?.approval.status).toBe('approved');
    expect(app.services.approvals.get(approvalId).status).toBe('approved');
  });

  it('refuses a resume that names an interrupt of another run', async () => {
    const { approvalId } = seedBlockedTurn();

    const response = await app.inject({
      method: 'POST',
      url: '/api/agui/runs/exe_other/resume',
      headers: { cookie: sessionCookie },
      payload: {
        resume: [{ interruptId: approvalId, status: 'resolved', payload: { approved: true } }],
      },
    });

    expect(response.statusCode).toBe(409);
    expect(app.services.approvals.get(approvalId).status).toBe('pending');
  });

  it('refuses an answer that does not match the shape the interrupt published', async () => {
    const { approvalId } = seedBlockedTurn();

    const response = await app.inject({
      method: 'POST',
      url: '/api/agui/runs/exe_1/resume',
      headers: { cookie: sessionCookie },
      payload: {
        resume: [{ interruptId: approvalId, status: 'resolved', payload: { approved: 'yes' } }],
      },
    });

    expect(response.statusCode).toBe(422);
    expect(app.services.approvals.get(approvalId).status).toBe('pending');
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await fetch(`${baseUrl}/api/agui/events`);
    expect(response.status).toBe(401);
  });
});
