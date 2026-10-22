import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { auditLog } from '../db/schema.js';

/**
 * Every mutating route leaves a record of who asked for the change.
 *
 * The product reports on itself, and one of the two numbers it reports is the
 * share of its operations an agent performed. That number is counted from the
 * audit trail, so a route that changes something without writing an entry is
 * a hole in the count. These are the twelve routes that were holes.
 */

let app: FastifyInstance;
let dataDir: string;
let sessionCookie = '';
let ownerId = '';
let workspaceId = '';
let agentConnectionId = '';

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-audit-coverage-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'audit-coverage-owner-token',
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
  ownerId = setup.json().user.id as string;

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  workspaceId = workspaces.json().workspaces[0].id as string;

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name: 'Probed',
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  agentConnectionId = agent.json().agent.id as string;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** The audit entries the trail holds for one action. */
function entries(action: string): { actorId: string; targetId: string | null }[] {
  return app.services.runtime.db
    .select({ actorId: auditLog.actorId, targetId: auditLog.targetId })
    .from(auditLog)
    .where(eq(auditLog.action, action))
    .all();
}

/** The one entry the trail holds for an action, naming the actor who asked. */
function entryFor(action: string): { actorId: string; targetId: string | null } {
  const found = entries(action);
  expect(found, `no audit entry was written for ${action}`).toHaveLength(1);
  expect(found[0]?.actorId).toBe(ownerId);
  return found[0]!;
}

describe('every mutating route writes an audit entry', () => {
  it('records the probe of an agent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentConnectionId}/probe`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('agent.probed').targetId).toBe(agentConnectionId);
  });

  it('records the revocation of an agent token', async () => {
    const issued = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentConnectionId}/tokens`,
      headers: { cookie: sessionCookie },
      payload: { label: 'revoked' },
    });
    const tokenId = issued.json().id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/agents/${agentConnectionId}/tokens/${tokenId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('agent.token.revoked').targetId).toBe(agentConnectionId);
  });

  it('records the issue of the owner token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/owner-token',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('auth.owner_token.issued').targetId).toBe(ownerId);
  });

  it('records the update of an automation', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/automations',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        title: 'Nightly',
        trigger: { type: 'schedule', everyMinutes: 5 },
        action: { type: 'agent.prompt', agentConnectionId },
      },
    });
    const automationId = created.json().automation.id as string;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/automations/${automationId}`,
      headers: { cookie: sessionCookie },
      payload: { title: 'Nightly, renamed' },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('automation.updated').targetId).toBe(automationId);
  });

  it('records the removal of an automation', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/automations',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        title: 'Doomed',
        trigger: { type: 'schedule', everyMinutes: 5 },
        action: { type: 'agent.prompt', agentConnectionId },
      },
    });
    const automationId = created.json().automation.id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/automations/${automationId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('automation.removed').targetId).toBe(automationId);
  });

  it('records the removal of a conversation', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: { workspaceId, title: 'Doomed' },
    });
    const conversationId = created.json().conversation.id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${conversationId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('conversation.removed').targetId).toBe(conversationId);
  });

  it('records the addition of a participant', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: { workspaceId, title: 'With a guest' },
    });
    const conversationId = created.json().conversation.id as string;

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/participants`,
      headers: { cookie: sessionCookie },
      payload: { type: 'agent', agentConnectionId, displayName: 'Probed' },
    });
    expect(response.statusCode).toBe(201);

    expect(entryFor('conversation.participant.added').targetId).toBe(conversationId);
  });

  it('records the removal of a participant', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        title: 'With a guest',
        participantAgentConnectionIds: [agentConnectionId],
      },
    });
    const conversation = created.json().conversation as {
      id: string;
      participants: { id: string; type: string }[];
    };
    const participant = conversation.participants.find((entry) => entry.type === 'agent');
    expect(participant).toBeDefined();

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${conversation.id}/participants/${participant!.id}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('conversation.participant.removed').targetId).toBe(conversation.id);
  });

  it('records the creation of a goal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/goals',
      headers: { cookie: sessionCookie },
      payload: { workspaceId, title: 'Ship the thing' },
    });
    expect(response.statusCode).toBe(201);

    expect(entryFor('goal.created').targetId).toBe(response.json().goal.id as string);
  });

  it('records the creation of a workspace', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: sessionCookie },
      payload: { name: 'Another' },
    });
    expect(response.statusCode).toBe(201);

    expect(entryFor('workspace.created').targetId).toBe(response.json().workspace.id as string);
  });

  it('records the update of a workspace', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/workspaces/${workspaceId}`,
      headers: { cookie: sessionCookie },
      payload: { name: 'Renamed' },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('workspace.updated').targetId).toBe(workspaceId);
  });

  it('records the logout', async () => {
    // Last, because it ends the session the other calls use.
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    expect(entryFor('auth.logged_out').targetId).toBe(ownerId);
  });
});
