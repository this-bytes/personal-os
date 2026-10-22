import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createAuthService, type AuthService } from '../modules/auth/service.js';

/**
 * Recovering a forgotten owner password.
 *
 * The recovery path is a command-line mode of the server binary, not an HTTP
 * route: it is the way back in for an owner who cannot authenticate, so
 * exposing it over HTTP would be a way for anyone to take the instance over.
 *
 * These tests pin down three things:
 *
 *  1. No HTTP route can replace the owner's password — not an anonymous
 *     caller, not the owner with a session, not the static owner token.
 *  2. A reset changes the credential and nothing else. Every conversation,
 *     resource, task, goal and event survives.
 *  3. The sessions the old credential produced stop working.
 */

const OLD_PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a brand new password';
const OWNER_TOKEN = 'recovery-owner-token';

let app: FastifyInstance;
let dataDir: string;
let dbPath: string;
let auth: AuthService;
let sessionCookie = '';
let workspaceId = '';

/** Every row of every table, keyed by table name. */
function snapshot(): Record<string, Record<string, unknown>[]> {
  const sqlite = new BetterSqlite3(dbPath, { readonly: true });
  try {
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
      .all() as { name: string }[];

    const out: Record<string, Record<string, unknown>[]> = {};
    for (const table of tables) {
      out[table.name] = sqlite.prepare(`select * from "${table.name}"`).all() as Record<
        string,
        unknown
      >[];
    }
    return out;
  } finally {
    sqlite.close();
  }
}

async function setup(): Promise<void> {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-recovery-'));
  dbPath = path.join(dataDir, 'personal-os.db');
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
    PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });
  auth = createAuthService(app.services.runtime.db);
}

/** Create the state a real instance has: a workspace, an agent, a conversation. */
async function createState(): Promise<void> {
  const setupResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: { email: 'owner@example.com', password: OLD_PASSWORD, displayName: 'Owner' },
  });
  const setCookie = setupResponse.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

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
      name: 'Echo',
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  const agentId = agent.json().agent.id as string;

  await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title: 'A conversation worth keeping',
      routingMode: 'mentions',
      participantAgentConnectionIds: [agentId],
    },
  });

  await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      type: 'document',
      title: 'A resource worth keeping',
      data: { format: 'markdown', content: '# Keep me' },
    },
  });

  await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title: 'A task worth keeping', acceptanceCriteria: ['done'] },
  });
}

beforeAll(async () => {
  await setup();
  await createState();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('the recovery path over HTTP', () => {
  /** Every way a caller might reasonably try to change the password. */
  const attempts = [
    { method: 'POST', url: '/api/auth/reset-password' },
    { method: 'POST', url: '/api/auth/reset' },
    { method: 'POST', url: '/api/auth/password' },
    { method: 'POST', url: '/api/auth/owner/password' },
    { method: 'POST', url: '/api/auth/recover' },
    { method: 'PATCH', url: '/api/auth/owner' },
    { method: 'PATCH', url: '/api/auth/me' },
    { method: 'POST', url: '/api/owner/password' },
    { method: 'POST', url: '/api/auth/setup' },
  ] as const;

  const payload = {
    password: NEW_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentPassword: OLD_PASSWORD,
    email: 'owner@example.com',
    displayName: 'Owner',
  };

  it('is not in the route table', () => {
    const routes = app.printRoutes({ commonPrefix: false }).toLowerCase();
    expect(routes).not.toContain('password');
    // A reset route is a path of its own: "reset", "/reset-password",
    // "/auth/reset". A word that merely ends in those letters — the preset
    // catalogue at "/api/agent-presets" — is not a way back in for an owner
    // who has forgotten their password.
    expect(routes).not.toMatch(/(^|[/\-_])reset($|[/\-_a-z])/);
  });

  it('cannot be reached by an anonymous caller', async () => {
    for (const attempt of attempts) {
      const response = await app.inject({
        method: attempt.method,
        url: attempt.url,
        payload,
      });
      expect(response.statusCode, `${attempt.method} ${attempt.url}`).toBeGreaterThanOrEqual(400);
    }

    await expect(
      auth.login({ email: 'owner@example.com', password: OLD_PASSWORD }),
    ).resolves.toBeTruthy();
    await expect(
      auth.login({ email: 'owner@example.com', password: NEW_PASSWORD }),
    ).rejects.toThrow(/invalid email or password/i);
  });

  it('cannot be reached by the signed-in owner', async () => {
    for (const attempt of attempts) {
      const response = await app.inject({
        method: attempt.method,
        url: attempt.url,
        headers: { cookie: sessionCookie },
        payload,
      });
      expect(response.statusCode, `${attempt.method} ${attempt.url}`).toBeGreaterThanOrEqual(400);
    }

    await expect(
      auth.login({ email: 'owner@example.com', password: OLD_PASSWORD }),
    ).resolves.toBeTruthy();
    await expect(
      auth.login({ email: 'owner@example.com', password: NEW_PASSWORD }),
    ).rejects.toThrow(/invalid email or password/i);
  });

  it('cannot be reached with the static owner token', async () => {
    for (const attempt of attempts) {
      const response = await app.inject({
        method: attempt.method,
        url: attempt.url,
        headers: { authorization: `Bearer ${OWNER_TOKEN}` },
        payload,
      });
      expect(response.statusCode, `${attempt.method} ${attempt.url}`).toBeGreaterThanOrEqual(400);
    }

    await expect(
      auth.login({ email: 'owner@example.com', password: OLD_PASSWORD }),
    ).resolves.toBeTruthy();
    await expect(
      auth.login({ email: 'owner@example.com', password: NEW_PASSWORD }),
    ).rejects.toThrow(/invalid email or password/i);
  });

  it('leaves the owner identity alone', () => {
    const owner = auth.owner();
    expect(owner?.email).toBe('owner@example.com');
    expect(owner?.displayName).toBe('Owner');
  });
});

describe('a reset of the credential', () => {
  it('changes the credential and nothing else', async () => {
    const before = snapshot();
    expect(Object.keys(before).length).toBeGreaterThan(10);

    await auth.resetOwnerPassword(NEW_PASSWORD);

    const after = snapshot();

    // Every table that is not the credential is byte-identical.
    for (const table of Object.keys(before)) {
      if (table === 'users' || table === 'sessions') continue;
      expect(after[table], `the table "${table}" changed`).toEqual(before[table]);
    }

    // The owner row keeps its identity and only the credential moved.
    const beforeUser = before['users']?.[0] as Record<string, unknown>;
    const afterUser = after['users']?.[0] as Record<string, unknown>;
    expect(afterUser?.['id']).toBe(beforeUser?.['id']);
    expect(afterUser?.['email']).toBe(beforeUser?.['email']);
    expect(afterUser?.['display_name']).toBe(beforeUser?.['display_name']);
    expect(afterUser?.['created_at']).toBe(beforeUser?.['created_at']);
    expect(afterUser?.['password_hash']).not.toBe(beforeUser?.['password_hash']);
    expect(afterUser?.['password_salt']).not.toBe(beforeUser?.['password_salt']);
    expect(after['users']).toHaveLength(before['users']?.length ?? 0);

    // The sessions the old credential produced are gone, and only those.
    expect(before['sessions']?.length ?? 0).toBeGreaterThan(0);
    expect(after['sessions']).toEqual([]);
  });

  it('signs the old credential out and signs the new one in', async () => {
    await expect(
      auth.login({ email: 'owner@example.com', password: OLD_PASSWORD }),
    ).rejects.toThrow(/invalid email or password/i);
    await expect(
      auth.login({ email: 'owner@example.com', password: NEW_PASSWORD }),
    ).resolves.toBeTruthy();
  });

  it('leaves the headless owner token working', async () => {
    // The owner token is a configured secret, not a session. A password
    // reset must not lock a headless deployment out of its own instance.
    const response = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('keeps the data a reset was supposed to preserve', async () => {
    const conversations = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: { authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(conversations.statusCode).toBe(200);
    expect(conversations.json().conversations.length).toBeGreaterThan(0);
    expect(
      conversations
        .json()
        .conversations.some((c: { title: string }) => c.title === 'A conversation worth keeping'),
    ).toBe(true);

    const resources = await app.inject({
      method: 'GET',
      url: `/api/resources?workspaceId=${workspaceId}`,
      headers: { authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(resources.statusCode).toBe(200);
    expect(
      resources
        .json()
        .resources.some((r: { title: string }) => r.title === 'A resource worth keeping'),
    ).toBe(true);
  });
});
