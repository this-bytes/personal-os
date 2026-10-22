/**
 * A capability an agent was refused reaches the owner.
 *
 * WI-121 made a refusal visible. An agent that calls a tool it was not granted
 * is stopped at the MCP surface by an answer it cannot appeal and cannot show
 * the owner, and the owner was never told. The refusal is now recorded, the
 * waiting list carries it as its own kind, and the owner can widen that one
 * grant from the list.
 *
 * This file holds three things, and they are the three cases the item names:
 *
 *  1. **the refusal reaches the list** — naming which agent wanted it and
 *     which tool it needed;
 *  2. **one row per agent and capability**, not one per attempt;
 *  3. **the row leaves the moment the grant is widened.**
 *
 * The assertions are made against the routes the owner and the agent actually
 * use — the MCP surface the agent calls and `GET /api/waiting` the owner reads
 * — so the contract and the code cannot drift apart quietly. Each case has an
 * agent of its own, so a case cannot pass or fail on what another case left
 * behind. Nothing here edits the implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { schema } from '../db/client.js';
import { recordRefusal } from '../modules/agents/blocked.js';

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-blocked-capability-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'blocked-capability-owner-token',
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
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** One thing on the waiting list, as the owner reads it. */
interface WaitingRow {
  id: string;
  kind: string;
  title: string;
  reason: string;
  agentConnectionId: string | null;
  toolName: string | null;
}

/** An agent connection with the grant it was given, and a token to call with. */
async function createAgent(
  name: string,
  toolGrants: string[],
): Promise<{ id: string; token: string }> {
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
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'blocked-capability' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** The agent calls a tool on the MCP surface. The answer is the agent's. */
async function callTool(token: string, name: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: { title: 'should not work' } },
    },
  });
  return response.body;
}

/** What is waiting on the owner. */
async function waiting(): Promise<WaitingRow[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/waiting?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().items as WaitingRow[];
}

/** The capability rows for one agent. */
function capabilityRows(rows: WaitingRow[], agentConnectionId: string): WaitingRow[] {
  return rows.filter(
    (row) => row.kind === 'capability' && row.agentConnectionId === agentConnectionId,
  );
}

describe('a capability an agent was refused', () => {
  it('reaches the list, naming the agent and the tool', async () => {
    const agent = await createAgent('Narrow', ['conversation.read']);

    // The agent calls a tool it was not granted. The answer is the agent's,
    // and it is the same answer it has always got.
    const body = await callTool(agent.token, 'task.create');
    expect(body).toContain('not found');
    expect(body).toContain('isError');

    // And the owner finds out: the waiting list carries the refusal as its own
    // kind, naming the agent that wanted it and the tool it needed.
    const rows = capabilityRows(await waiting(), agent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('capability');
    expect(rows[0]?.agentConnectionId).toBe(agent.id);
    expect(rows[0]?.toolName).toBe('task.create');
  });

  it('is one row per agent and capability, not one per attempt', async () => {
    const agent = await createAgent('Repetitive', ['conversation.read']);

    await callTool(agent.token, 'task.create');
    await callTool(agent.token, 'task.create');
    await callTool(agent.token, 'task.create');

    // Three refusals of one capability are one thing waiting on the owner.
    const rows = capabilityRows(await waiting(), agent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.toolName).toBe('task.create');

    // A second capability is a second thing waiting.
    await callTool(agent.token, 'task.get');
    const both = capabilityRows(await waiting(), agent.id);
    expect(both).toHaveLength(2);
    expect(both.map((row) => row.toolName).sort()).toEqual(['task.create', 'task.get']);
  });

  it('leaves the list when the grant is widened', async () => {
    const agent = await createAgent('Widened', ['conversation.read']);
    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    // The owner takes the action the row carries.
    const widened = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.create' },
    });
    expect(widened.statusCode).toBe(200);

    // The row leaves: a capability the agent holds is not waiting on the owner.
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(0);

    // And the grant was widened, never narrowed: what the agent already had is
    // still there.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
    });
    const grants = (detail.json().agent.toolGrants as string[]).sort();
    expect(grants).toEqual(['conversation.read', 'task.create']);
  });
});

/**
 * The repository root, for the worker's own process to resolve the database
 * driver from.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The database file this app is running on. */
function dbFile(): string {
  return path.join(dataDir, 'personal-os.db');
}

/**
 * The worker, as a second process on the same database file.
 *
 * The worker is a second process, and a transaction is the thing that holds
 * across processes — so the worker cannot be the same connection as the
 * server's, or the measurement would be of nothing. This opens the file in a
 * child process, takes the write lock, records the refusal the way the
 * worker's own recorder does, holds the lock long enough for the server's
 * widening to run into it, and lets go.
 *
 * It prints `locked` the moment it holds the lock, so the test can start the
 * widening while the lock is held.
 */
function spawnWorker(options: { agentId: string; toolName: string; holdMs: number }): {
  locked: Promise<void>;
  done: Promise<void>;
  output: () => string;
} {
  const script = path.join(dataDir, 'worker-refusal.mjs');
  fs.writeFileSync(
    script,
    [
      "import { createRequire } from 'node:module';",
      "import path from 'node:path';",
      "const require = createRequire(path.join(process.argv[2], 'apps', 'server', 'package.json'));",
      "const BetterSqlite3 = require('better-sqlite3');",
      'const [dbPath, agentId, workspaceId, toolName, holdMs] = process.argv.slice(3);',
      'const db = new BetterSqlite3(dbPath);',
      "db.pragma('busy_timeout = 10000');",
      "db.exec('BEGIN IMMEDIATE');",
      'const now = new Date().toISOString();',
      'const sql =',
      "  'INSERT INTO blocked_capabilities (id, workspace_id, agent_connection_id, tool_name, first_refused_at, last_refused_at, refusal_count) ' +",
      "  'VALUES (?, ?, ?, ?, ?, ?, 1) ' +",
      "  'ON CONFLICT(agent_connection_id, tool_name) DO UPDATE SET ' +",
      "  'last_refused_at = excluded.last_refused_at, refusal_count = refusal_count + 1';",
      "db.prepare(sql).run('cap_worker', workspaceId, agentId, toolName, now, now);",
      "process.stdout.write('locked\\n');",
      'setTimeout(() => {',
      "  db.exec('COMMIT');",
      '  db.close();',
      "  process.stdout.write('committed\\n');",
      '  process.exit(0);',
      '}, Number(holdMs));',
    ].join('\n'),
    'utf8',
  );

  const child = spawn(
    process.execPath,
    [
      script,
      repoRoot,
      dbFile(),
      options.agentId,
      workspaceId,
      options.toolName,
      String(options.holdMs),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let output = '';
  let resolveLocked = (): void => {};
  let resolveDone = (): void => {};
  const locked = new Promise<void>((resolve) => {
    resolveLocked = resolve;
  });
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    if (output.includes('locked')) resolveLocked();
    if (output.includes('committed')) resolveDone();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  // A worker that died must not leave the case waiting for ever.
  child.on('exit', () => {
    resolveLocked();
    resolveDone();
  });

  return { locked, done, output: () => output };
}

/**
 * WI-131 — the widening write is one transaction.
 *
 * WI-121's verification found three things, and this item is their fix: the
 * row that leaves the waiting list and the grant that is written are one
 * change, the contract publishes that guarantee in both directions, and the
 * window is closed for the worker as well as for the API.
 *
 * The three cases are the ones the item names:
 *
 *  1. **a grant write that fails leaves the blocked row on the list**;
 *  2. **a successful widening leaves the row gone and the grant set**;
 *  3. **a refusal arriving between the two leaves no stale row**, measured
 *     across two processes on one database file.
 */
describe('the widening write is one transaction (WI-131)', () => {
  it('leaves the blocked row on the list when the grant write fails', async () => {
    const agent = await createAgent('Dangling', ['conversation.read']);
    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    // The configuration the agent points at is gone. This is written from a
    // second connection to the same database file, which is what a record
    // that was deleted under the agent looks like from outside.
    const outside = new BetterSqlite3(dbFile());
    try {
      outside
        .prepare('UPDATE agent_connections SET config_ref = ? WHERE id = ?')
        .run('cfg_gone', agent.id);

      // The write carries the grant and the configuration together, and the
      // configuration it merges into is not there, so the write is refused.
      const refused = await app.inject({
        method: 'PATCH',
        url: `/api/agents/${agent.id}`,
        headers: { cookie: sessionCookie },
        payload: {
          toolGrants: ['conversation.read', 'task.create'],
          config: { reply: 'hi' },
        },
      });
      expect(refused.statusCode).toBe(404);
      expect(refused.json().error.code).toBe('not_found');

      // The blocked row is STILL on the list, naming the capability. The row
      // leaves the list exactly when the grant includes it, and the grant did
      // not change: the two writes are one change, so a refused write leaves
      // both of them as they were.
      const rows = capabilityRows(await waiting(), agent.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.toolName).toBe('task.create');

      // And the grant is what it was: the write was refused, so nothing was
      // widened.
      const detail = await app.inject({
        method: 'GET',
        url: `/api/agents/${agent.id}`,
        headers: { cookie: sessionCookie },
      });
      expect((detail.json().agent.toolGrants as string[]).sort()).toEqual(['conversation.read']);
    } finally {
      outside.close();
    }
  });

  it('leaves the row gone and the grant set when the widening succeeds', async () => {
    const agent = await createAgent('Widened', ['conversation.read']);
    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    // The same write as the case above, with a configuration that is there.
    const widened = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
      payload: {
        toolGrants: ['conversation.read', 'task.create'],
        config: { reply: 'hello' },
      },
    });
    expect(widened.statusCode).toBe(200);

    // The row is gone: a capability the agent holds is not waiting on the
    // owner any more.
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(0);

    // And the grant carries the capability that was asked for, with what the
    // agent already had left as it was: the widening takes nothing away.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
    });
    expect((detail.json().agent.toolGrants as string[]).sort()).toEqual([
      'conversation.read',
      'task.create',
    ]);
  });

  it('leaves no stale row when a refusal arrives between the two', async () => {
    const agent = await createAgent('Raced', ['conversation.read']);
    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    // --- the refusal lands while the widening is in flight ---------------
    // The worker's own process takes the write lock and records the refusal.
    // The grant is still the old one, so it is a real refusal and the row is
    // written.
    const worker = spawnWorker({ agentId: agent.id, toolName: 'task.create', holdMs: 500 });
    await worker.locked;

    const started = Date.now();
    const answered = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrants: ['conversation.read', 'task.create'] },
    });
    const elapsed = Date.now() - started;
    await worker.done;

    expect(answered.statusCode, `the widening failed: ${worker.output()}`).toBe(200);
    // The server waited for the worker's write. A change on another process
    // cannot land inside the widening's change, so it waits for the lock and
    // lands after it.
    expect(
      elapsed,
      `the widening did not wait for the other process at all; the worker said: ${worker.output()}`,
    ).toBeGreaterThanOrEqual(200);

    // The refusal the worker recorded while the widening was in flight left
    // no stale row: the grant now includes the capability, so the row is not
    // waiting on the owner any more.
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(0);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}`,
      headers: { cookie: sessionCookie },
    });
    expect((detail.json().agent.toolGrants as string[]).sort()).toEqual([
      'conversation.read',
      'task.create',
    ]);

    // --- the refusal lands after the widening committed -------------------
    // The worker's own recorder, on the worker's own connection. The agent
    // holds the capability now, so the recorder reads the grant and skips it:
    // a refusal that was overtaken is not a block, and a list that carries it
    // is a list that lies about what is waiting.
    const outside = new BetterSqlite3(dbFile());
    try {
      recordRefusal(drizzle(outside, { schema }), {
        agentConnectionId: agent.id,
        toolName: 'task.create',
      });
    } finally {
      outside.close();
    }
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(0);
  });
});
