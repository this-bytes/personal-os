import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { serverEventSchema, type Approval } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { agentConnections, executions } from '../db/schema.js';

/**
 * A decided approval is published.
 *
 * The waiting list has a way in and no way out of it: an approval is raised and
 * the owner answers it, but nothing was announced, so a client watching the
 * stream never learned that the answer had arrived. This is the announcement.
 *
 * The announcement has to hold on **every** branch of the decision, and it has
 * to hold in the right order. An approval is decided in more than one way and
 * the turn does more than one thing afterwards:
 *
 *   - the approval names no execution, so the turn is over — the **closed**
 *     branch, with nothing to continue;
 *   - the approval names a blocked execution whose connection reports
 *     `persistentSessions` and whose session can be re-entered, so the turn
 *     **continues** in the session it was in;
 *   - the answer comes through the AG-UI resume route rather than the panel's
 *     own, and an interrupt that was **abandoned** — expired, unanswered — is
 *     a refusal rather than a decision.
 *
 * The first four cases below drive the closed branch. The rest drive the
 * others, because a check that only drives one branch cannot fail when the
 * others break: the publish once sat where a decision with no execution
 * reached it, every case stayed green, and the waiting list quietly stopped
 * having a way out of a continued turn.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

/**
 * Where the log is now, so a test can read only what it published itself.
 *
 * The log is shared by every test in the file, and a test that counted the
 * whole log would be counting its neighbours' decisions too.
 */
function mark(): number {
  return app.services.events.recent(null, 1)[0]?.seq ?? 0;
}

/** The approval decisions published after the mark. */
function decisionsSince(cursor: number): unknown[] {
  return app.services.events
    .since(cursor, 200)
    .filter((event) => event.type === 'approval.decided')
    .map((event) => event.payload);
}

/** The waiting list, as the route answers it. */
async function waitingIds(): Promise<string[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  const body = response.json() as { items?: Array<{ id: string }> };
  return (body.items ?? []).map((item) => item.id);
}

async function decide(approvalId: string, approved: boolean): Promise<number> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/approvals/${approvalId}/decide`,
    headers: { cookie: sessionCookie },
    payload: { approved, reason: 'It is my own homelab' },
  });
  return response.statusCode;
}

/**
 * A connection that can re-enter its session, and an execution stopped on a
 * decision.
 *
 * The capability is the gate — the same gate the code reads — so the fixture
 * says what the adapter would have reported: `persistentSessions`. An execution
 * with an `externalRef` carries the session the turn would continue in; without
 * one, the turn cannot be continued and the execution is closed instead.
 *
 * Every case seeds its own rows under its own ids, so one case's fixture
 * cannot answer another's question and a mutation cannot cascade from one
 * case into the next.
 */
function seedExecution(options: {
  connectionId: string;
  executionId: string;
  persistentSessions: boolean;
  externalRef: string | null;
}): Approval {
  const db = app.services.runtime.db;
  const now = new Date().toISOString();

  db.insert(agentConnections)
    .values({
      id: options.connectionId,
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
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(executions)
    .values({
      id: options.executionId,
      workspaceId,
      conversationId: null,
      taskId: null,
      externalRef: options.externalRef,
      agentConnectionId: options.connectionId,
      executionOwner: 'personal-os',
      status: 'blocked',
      error: null,
      spendUnits: 0,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    })
    .run();

  return app.services.approvals.request({
    workspaceId,
    executionId: options.executionId,
    agentConnectionId: options.connectionId,
    summary: 'Delete the production database',
  });
}

/** The answer the AG-UI resume route carries for an interrupt. */
async function resumeInterrupt(
  runId: string,
  interruptId: string,
  status: 'resolved' | 'cancelled',
): Promise<number> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/agui/runs/${runId}/resume`,
    headers: { cookie: sessionCookie },
    payload: { resume: [{ interruptId, status }] },
  });
  return response.statusCode;
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-approval-event-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'approval-event-owner-token',
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

describe('a decided approval is published', () => {
  it('publishes the decision, so a client can take the approval off its list', async () => {
    const cursor = mark();
    const approval = app.services.approvals.request({
      workspaceId,
      summary: 'Delete the production database',
    });

    const statusCode = await decide(approval.id, true);
    expect(statusCode).toBe(200);

    const publishedDecisions = decisionsSince(cursor);
    expect(
      publishedDecisions.length,
      'the decision was not published: the waiting list still has no way out of it',
    ).toBe(1);
  });

  it('carries the approval as the published shape says it does', async () => {
    const cursor = mark();
    const approval = app.services.approvals.request({
      workspaceId,
      summary: 'Delete the production database',
    });

    await decide(approval.id, true);

    const parsed = serverEventSchema.safeParse(decisionsSince(cursor)[0]);
    expect(
      parsed.success,
      'the published event does not parse against the published vocabulary',
    ).toBe(true);
    if (!parsed.success) return;

    const event = parsed.data as { type: 'approval.decided'; approval: Approval };
    expect(event.type).toBe('approval.decided');
    expect(event.approval.id).toBe(approval.id);
    expect(event.approval.summary).toBe('Delete the production database');
    expect(event.approval.status).toBe('approved');
    expect(event.approval.reason).toBe('It is my own homelab');
    expect(event.approval.decidedAt).not.toBeNull();
  });

  it('publishes a refusal too, because a refusal is also an answer', async () => {
    const cursor = mark();
    const approval = app.services.approvals.request({
      workspaceId,
      summary: 'Delete the production database',
    });

    const statusCode = await decide(approval.id, false);
    expect(statusCode).toBe(200);

    const parsed = serverEventSchema.safeParse(decisionsSince(cursor)[0]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const event = parsed.data as { type: 'approval.decided'; approval: Approval };
    expect(event.approval.status).toBe('rejected');
  });

  it('publishes nothing when nothing was decided', async () => {
    const cursor = mark();
    app.services.approvals.request({
      workspaceId,
      summary: 'Delete the production database',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/approvals?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(
      decisionsSince(cursor).length,
      'reading the approvals published a decision: an approval that was not decided is not an answer',
    ).toBe(0);
  });
});

describe('the decision is published on every branch, and in the right order', () => {
  it('publishes it when the turn continued, not only when it closed', async () => {
    // The turn continues when the connection reports the capability and the
    // execution carries the session to re-enter. The outcome of the turn does
    // not change the fact that the owner decided, so the event is published
    // here too — exactly once, and with the published shape.
    const approval = seedExecution({
      connectionId: 'agt_resumed',
      executionId: 'exe_resumed',
      persistentSessions: true,
      externalRef: 'session_resumed',
    });
    const rowId = `approval:${approval.id}`;
    const cursor = mark();

    const waitingBefore = await waitingIds();
    expect(waitingBefore, 'the approval was not on the waiting list before the decision').toContain(
      rowId,
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/approvals/${approval.id}/decide`,
      headers: { cookie: sessionCookie },
      payload: { approved: true, reason: 'It is my own homelab' },
    });
    expect(response.statusCode).toBe(200);
    // The turn continued. A check that only ever drives the closed branch
    // cannot tell this from the other one.
    expect(response.json().outcome).toBe('resumed');

    const publishedDecisions = decisionsSince(cursor);
    expect(
      publishedDecisions.length,
      'the decision was not published on the resumed branch: the waiting list still has no way out of a continued turn',
    ).toBe(1);

    const parsed = serverEventSchema.safeParse(publishedDecisions[0]);
    expect(
      parsed.success,
      'the published event does not parse against the published vocabulary',
    ).toBe(true);
    if (!parsed.success) return;

    const event = parsed.data as { type: 'approval.decided'; approval: Approval };
    expect(event.type).toBe('approval.decided');
    expect(event.approval.id).toBe(approval.id);
    expect(event.approval.status).toBe('approved');
    expect(event.approval.executionId).toBe('exe_resumed');

    const waitingAfter = await waitingIds();
    expect(waitingAfter, 'the decided approval is still on the waiting list').not.toContain(rowId);
  });

  it('publishes it after the decision is recorded, and after the audit entry', async () => {
    const approval = app.services.approvals.request({
      workspaceId,
      summary: 'Delete the production database',
    });

    // The events service publishes and wakes its subscribers synchronously, so
    // this listener runs inside the publish call itself and sees the tree as
    // it stood at that moment — which is the only way to ask whether the event
    // came after the decision or before it.
    const atPublish: { approvalStatus: string | null; auditRecorded: boolean | null } = {
      approvalStatus: null,
      auditRecorded: null,
    };
    const unsubscribe = app.services.events.subscribe((event) => {
      if (event.type !== 'approval.decided') return;
      // The published vocabulary is what says what the payload carries, so
      // the payload is read through it rather than through a private shape.
      const parsed = serverEventSchema.safeParse(event.payload);
      if (!parsed.success || parsed.data.type !== 'approval.decided') return;
      const id = parsed.data.approval.id;
      atPublish.approvalStatus = app.services.approvals.get(id).status;
      atPublish.auditRecorded = app.services.audit
        .list(workspaceId, 100)
        .some((entry) => entry.action === 'approval.granted' && entry.targetId === id);
    });

    const statusCode = await decide(approval.id, true);
    unsubscribe();

    expect(statusCode).toBe(200);
    expect(atPublish.approvalStatus, 'the decision was published before it was recorded').toBe(
      'approved',
    );
    expect(
      atPublish.auditRecorded,
      'the decision was published before the audit entry was written',
    ).toBe(true);
  });

  it('publishes an abandoned interrupt as a refusal, because an expiry is an answer', async () => {
    // An interrupt that was abandoned — expired, unanswered — is not a
    // decision the owner made, but it is still an answer: the operation was
    // not approved. The route turns it into a refusal, and the refusal is
    // published once.
    const approval = seedExecution({
      connectionId: 'agt_expired',
      executionId: 'exe_expired',
      persistentSessions: false,
      externalRef: null,
    });
    const cursor = mark();

    const statusCode = await resumeInterrupt('exe_expired', approval.id, 'cancelled');
    expect(statusCode).toBe(200);

    const publishedDecisions = decisionsSince(cursor);
    expect(
      publishedDecisions.length,
      'the abandoned interrupt published nothing: the waiting list still has no way out of it',
    ).toBe(1);

    const parsed = serverEventSchema.safeParse(publishedDecisions[0]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const event = parsed.data as { type: 'approval.decided'; approval: Approval };
    expect(event.approval.id).toBe(approval.id);
    expect(event.approval.status).toBe('rejected');
    expect(event.approval.reason).toMatch(/abandoned/i);
  });

  it('refuses a second decision, and publishes nothing for it', async () => {
    const approval = seedExecution({
      connectionId: 'agt_twice',
      executionId: 'exe_twice',
      persistentSessions: false,
      externalRef: null,
    });

    const first = await resumeInterrupt('exe_twice', approval.id, 'cancelled');
    expect(first).toBe(200);

    const cursor = mark();
    const second = await resumeInterrupt('exe_twice', approval.id, 'cancelled');
    expect(second).toBe(409);

    expect(
      decisionsSince(cursor).length,
      'a second decision on a decided approval published again',
    ).toBe(0);
  });
});
