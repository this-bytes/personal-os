/**
 * WI-156: the contract publishes that the change, the widening and the list
 * all go through **the one write** that changes a grant
 * (`apps/server/src/modules/agents/service.ts:472`), and that the row that
 * leaves the waiting list and the grant that changes are written in one
 * transaction (`apps/server/src/modules/agents/service.ts:353`).
 *
 * Those are promises about the **number** of writes, and nothing counted them.
 * Every check that touched this code asserted what the row says or what the
 * grant holds — never how many times the row was written. Measured on the
 * landed tree: with the grant written twice instead of once, all four shipped
 * grant checks (`grant-change-precedence`, `grant-widening-lost-update`,
 * `grant-editor-verdict`, `grant-widening-probe-review`) were green —
 * 4 files, 16 tests passed. The promise rested on nothing.
 *
 * So this file counts the writes. A trigger on the connection table records
 * every UPDATE the server issues that **mentions the grant column**, and each
 * of the three paths the contract names is asked how many writes it took:
 *
 *  - **the editor's change** — `PATCH /api/agents/:id` with `toolGrantChange`;
 *  - **the widening** — `POST /api/agents/:id/grants` with one tool;
 *  - **the list** — `PATCH /api/agents/:id` with `toolGrants`.
 *
 * Two things about the count:
 *
 *  - It counts the **statements**, not the rows that changed. A second write
 *    of the same values is still a second write, and it is still invisible in
 *    the outcome — which is exactly why nothing noticed it before.
 *  - It counts the writes that **change a grant**, because that is what the
 *    sentence promises. The agent's own creation writes its connection row
 *    once more, when the server probes the new agent to learn what it can do
 *    (`apps/server/src/api/agents.ts:191`); that write leaves the grant
 *    alone, so it is not a write that changes a grant and is not counted.
 *
 * Nothing here edits the implementation. The file is the tester's, and it is
 * named so that it is not mistaken for the item's own check.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let dataDir = '';

/** The database the server is using. */
const dbFile = (): string => path.join(dataDir, 'personal-os.db');

beforeAll(async () => {
  // The database lives in a temporary directory: the counter opens the same
  // file from this process, so it cannot be in memory.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-one-write-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'one-write-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  // The counter is installed before any agent exists, so it sees every write
  // the server makes from here on. It records the writes that mention the
  // grant column, whether or not the value they set is different — a second
  // write of the same values is still a second write.
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(dbFile());
  db.pragma('busy_timeout = 10000');
  db.exec('CREATE TABLE IF NOT EXISTS probe_grant_writes (agent_id TEXT)');
  db.exec(
    'CREATE TRIGGER IF NOT EXISTS probe_grant_writes_count AFTER UPDATE OF tool_grants ON agent_connections BEGIN INSERT INTO probe_grant_writes (agent_id) VALUES (NEW.id); END',
  );
  db.close();

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
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** How many times the server wrote this agent's grant. */
async function grantWrites(agentId: string): Promise<number> {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(dbFile());
  db.pragma('busy_timeout = 10000');
  const rows = db
    .prepare('SELECT agent_id FROM probe_grant_writes WHERE agent_id = ?')
    .all(agentId) as unknown[];
  db.close();
  return rows.length;
}

/** An agent connection with the grant it was given. */
async function createAgent(name: string, toolGrants: string[]): Promise<string> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
      toolGrants,
    },
  });
  expect(agent.statusCode).toBe(201);
  return agent.json().agent.id as string;
}

describe('the grant is written once', () => {
  it("the editor's change is one write", async () => {
    const agentId = await createAgent('One write, change', ['conversation.read']);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrantChange: { enable: ['task.create'] } },
    });
    expect(response.statusCode).toBe(200);

    expect(
      await grantWrites(agentId),
      "the editor's change wrote the grant more than once: the contract says the change goes through the one write that changes a grant",
    ).toBe(1);
  });

  it('the widening is one write', async () => {
    const agentId = await createAgent('One write, widening', ['conversation.read']);

    const response = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.get' },
    });
    expect(response.statusCode).toBe(200);

    expect(
      await grantWrites(agentId),
      'the widening wrote the grant more than once: the contract says the widening goes through the one write that changes a grant',
    ).toBe(1);
  });

  it('the list is one write', async () => {
    const agentId = await createAgent('One write, list', ['conversation.read']);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrants: ['conversation.read', 'task.create'] },
    });
    expect(response.statusCode).toBe(200);

    expect(
      await grantWrites(agentId),
      'the list wrote the grant more than once: the contract says the list goes through the one write that changes a grant',
    ).toBe(1);
  });
});
