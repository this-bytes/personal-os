import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { serverEventSchema, type Approval } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * A decided approval is published.
 *
 * The waiting list has a way in and no way out of it: an approval is raised and
 * the owner answers it, but nothing was announced, so a client watching the
 * stream never learned that the answer had arrived. This is the announcement.
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

async function decide(approvalId: string, approved: boolean): Promise<number> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/approvals/${approvalId}/decide`,
    headers: { cookie: sessionCookie },
    payload: { approved, reason: 'It is my own homelab' },
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
