import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import {
  agentConnections,
  conversations,
  executions,
  messages,
  participants,
  queueJobs,
} from '../db/schema.js';

/**
 * Deciding an approval resumes the turn when the adapter can.
 *
 * The answer is recorded first, so it is never lost. Then the turn either
 * continues in the session it was in, or it is closed — and the owner is
 * told which.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
const NOW = '2026-01-01T00:00:00.000Z';

interface SeedOptions {
  executionStatus: 'blocked' | 'running';
  externalRef: string | null;
  persistentSessions: boolean;
}

function seed(options: SeedOptions): { approvalId: string; executionId: string } {
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
        persistentSessions: options.persistentSessions,
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
      externalRef: options.externalRef,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: options.executionStatus,
      error: null,
      spendUnits: 0,
      startedAt: NOW,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();

  db.insert(messages)
    .values({
      id: 'msg_reply',
      conversationId: 'cnv_1',
      senderId: 'p_1',
      targetParticipantIds: [],
      replyToId: 'msg_parent',
      kind: 'text',
      content: [{ type: 'text', text: 'May I delete the production database?' }],
      status: 'streaming',
      correlationId: 'cor_1',
      origin: null,
      executionId: 'exe_1',
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

async function decide(
  approvalId: string,
  approved: boolean,
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/approvals/${approvalId}/decide`,
    headers: { cookie: sessionCookie },
    payload: { approved, reason: 'It is my own homelab' },
  });
  return { statusCode: response.statusCode, body: response.json() as Record<string, unknown> };
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-approval-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'approval-owner-token',
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

beforeEach(() => {
  const db = app.services.runtime.db;
  db.delete(queueJobs).run();
  db.delete(messages).run();
  db.delete(executions).run();
  db.delete(participants).run();
  db.delete(conversations).run();
  db.delete(agentConnections).run();
});

describe('deciding an approval', () => {
  it('is refused when the operation is not waiting for a decision, and says why', async () => {
    const { approvalId } = seed({
      executionStatus: 'running',
      externalRef: null,
      persistentSessions: false,
    });

    const { statusCode, body } = await decide(approvalId, true);

    expect(statusCode).toBe(409);
    const envelope = body.error as { code: string; message: string };
    expect(envelope.code).toBe('conflict');
    expect(envelope.message).toMatch(/not waiting for a decision/i);
  });

  it('is refused when the outcome of the operation is unknown', async () => {
    const { approvalId } = seed({
      executionStatus: 'unknown' as 'blocked',
      externalRef: null,
      persistentSessions: false,
    });

    const { statusCode } = await decide(approvalId, true);

    expect(statusCode).toBe(409);
  });

  it('is recorded before the turn is continued', async () => {
    const { approvalId, executionId } = seed({
      executionStatus: 'blocked',
      externalRef: 'sess_1',
      persistentSessions: true,
    });

    const { statusCode, body } = await decide(approvalId, true);
    expect(statusCode).toBe(200);

    // The answer is on record.
    const approval = app.services.approvals.get(approvalId);
    expect(approval.status).toBe('approved');
    expect(approval.decidedBy).not.toBeNull();

    const entries = app.services.audit.list(workspaceId, 200);
    expect(entries.some((entry) => entry.action === 'approval.granted')).toBe(true);

    // And the turn continues.
    expect(body.outcome).toBe('resumed');
    const execution = app.services.runtime.db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .get();
    expect(execution?.status).toBe('blocked');
  });

  it('continues the turn in the session it was in', async () => {
    const { approvalId } = seed({
      executionStatus: 'blocked',
      externalRef: 'sess_1',
      persistentSessions: true,
    });

    await decide(approvalId, true);

    const jobs = app.services.runtime.db.select().from(queueJobs).all();
    const job = jobs.find((entry) => entry.type === 'chat.turn');
    expect(job).toBeDefined();

    const payload = job?.payload as {
      executionId: string;
      resume?: { decision: string; externalSessionId: string };
    };
    expect(payload.executionId).toBe('exe_1');
    expect(payload.resume?.externalSessionId).toBe('sess_1');
    expect(payload.resume?.decision).toMatch(/approved/i);
  });

  it('closes the turn rather than continuing it when the agent cannot re-enter a session', async () => {
    const { approvalId, executionId } = seed({
      executionStatus: 'blocked',
      externalRef: 'sess_1',
      persistentSessions: false,
    });

    const { statusCode, body } = await decide(approvalId, true);
    expect(statusCode).toBe(200);

    // The owner is told the truth: the turn was closed, not continued.
    expect(body.outcome).toBe('closed');
    expect(String(body.detail)).toMatch(/closed rather than continued/i);

    const execution = app.services.runtime.db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .get();
    expect(execution?.status).toBe('completed');
    expect(execution?.finishedAt).not.toBeNull();

    // The reply is finished, and it says the turn did not finish.
    const reply = app.services.runtime.db
      .select()
      .from(messages)
      .where(eq(messages.executionId, executionId))
      .get();
    expect(reply?.status).toBe('failed');

    // Nothing is re-dispatched.
    const jobs = app.services.runtime.db.select().from(queueJobs).all();
    expect(jobs).toHaveLength(0);
  });
});
