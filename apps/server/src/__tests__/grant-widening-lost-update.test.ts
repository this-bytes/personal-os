/**
 * A widening that is lost across processes narrows the grant.
 *
 * WI-146. The owner widens a grant from the waiting list, and the agent's own
 * page widens the same grant. Those are two processes on one database file.
 *
 * The route read the grant, computed the union and wrote the union back — and
 * the read was outside the transaction that wrote it. So a widening that
 * committed in between was overwritten by a union computed from the old grant:
 * the other process's capability was gone, the owner's other action was lost,
 * and the list went on showing the capability as waiting. Nothing said so.
 *
 * This file holds the case that reproduces it, measured the way the defect was
 * measured. **The other process is a separate OS process on the same database
 * file**, holding the write lock while the server's widening runs into it. A
 * holder in this process would prove nothing: the busy handler blocks the
 * event loop that would have let the holder let go.
 *
 * The assertions are made against the route the owner uses, and against the
 * list the owner reads, so the contract and the code cannot drift apart
 * quietly. Nothing here edits the implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree. A second process has to be able to open the same file, so it cannot
  // be an in-memory database.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-grant-widening-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'grant-widening-owner-token',
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
    payload: { label: 'grant-widening' },
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

/** The grant an agent holds, as the owner reads it. */
async function grants(agentId: string): Promise<string[]> {
  const detail = await app.inject({
    method: 'GET',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
  });
  expect(detail.statusCode).toBe(200);
  return (detail.json().agent.toolGrants as string[]).sort();
}

/**
 * The repository root, for the other process to resolve the database driver
 * from.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The database file this app is running on. */
function dbFile(): string {
  return path.join(dataDir, 'personal-os.db');
}

/**
 * Another process, widening the same grant.
 *
 * It opens the same database file, takes the write lock, widens the grant the
 * way the service does — the grant is written and the capability's row leaves
 * the waiting list — and holds the lock long enough for the server's own
 * widening to run into it.
 *
 * It prints `locked` the moment it holds the lock, so the test can start the
 * server's widening while the lock is held, and `committed` when it lets go.
 * The lock is held for a fixed time rather than until the test says so,
 * because the server's widening blocks the event loop while it waits for the
 * lock: a holder that waited for a signal from this process would deadlock.
 */
function spawnConcurrentWidening(options: { agentId: string; toolName: string; holdMs: number }): {
  locked: Promise<void>;
  done: Promise<void>;
  output: () => string;
} {
  const script = path.join(dataDir, 'concurrent-widening.mjs');
  fs.writeFileSync(
    script,
    [
      "import { createRequire } from 'node:module';",
      "import path from 'node:path';",
      "const require = createRequire(path.join(process.argv[2], 'apps', 'server', 'package.json'));",
      "const BetterSqlite3 = require('better-sqlite3');",
      'const [dbPath, agentId, toolName, holdMs] = process.argv.slice(3);',
      'const db = new BetterSqlite3(dbPath);',
      "db.pragma('busy_timeout = 10000');",
      "db.exec('BEGIN IMMEDIATE');",
      "const row = db.prepare('SELECT tool_grants FROM agent_connections WHERE id = ?').get(agentId);",
      'const granted = row && row.tool_grants ? JSON.parse(row.tool_grants) : [];',
      'const widened = granted.includes(toolName) ? granted : [...granted, toolName];',
      "db.prepare('UPDATE agent_connections SET tool_grants = ?, updated_at = ? WHERE id = ?')",
      '  .run(JSON.stringify(widened), new Date().toISOString(), agentId);',
      "db.prepare('DELETE FROM blocked_capabilities WHERE agent_connection_id = ? AND tool_name = ?')",
      '  .run(agentId, toolName);',
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
    [script, repoRoot, dbFile(), options.agentId, options.toolName, String(options.holdMs)],
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
  // A process that died must not leave the case waiting for ever.
  child.on('exit', () => {
    resolveLocked();
    resolveDone();
  });

  return { locked, done, output: () => output };
}

/** How long the other process holds the write lock. */
const HOLD_MS = 600;

describe('a widening that runs while another process widens the same grant', () => {
  it('keeps the widening the other process committed while it was waiting', async () => {
    const agent = await createAgent('Concurrent', ['conversation.read']);

    // Another process widens the same grant, and the server's own widening
    // runs into the lock it holds.
    const other = spawnConcurrentWidening({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: HOLD_MS,
    });
    await other.locked;

    // The owner widens the same grant from the list. This is the write that
    // used to lose the other process's widening: the union it wrote was
    // computed from the grant as it was before the other process committed.
    const widened = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.create' },
    });
    expect(widened.statusCode).toBe(200);
    await other.done;

    // Both widenings survived. The grant holds what the owner added AND what
    // the other process added, and a grant is only ever widened, so the
    // owner's other action was not lost.
    expect(await grants(agent.id)).toEqual(['conversation.read', 'task.create', 'task.get']);
  });

  it('leaves the list agreeing with the grant', async () => {
    const agent = await createAgent('Concurrent list', ['conversation.read']);

    // The agent is refused two tools, so the list carries a row for each.
    await callTool(agent.token, 'task.create');
    await callTool(agent.token, 'task.get');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(2);

    const other = spawnConcurrentWidening({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: HOLD_MS,
    });
    await other.locked;

    const widened = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.create' },
    });
    expect(widened.statusCode).toBe(200);
    await other.done;

    // The list and the grant say the same thing about every capability the
    // agent was refused: a capability the agent holds is not waiting on the
    // owner, and a capability the agent does not hold is. When the widening is
    // lost, the grant does not hold the capability the other process added
    // and the row that would have said so is gone with it — the list
    // under-reports a block that is still there.
    const held = new Set(await grants(agent.id));
    const rows = capabilityRows(await waiting(), agent.id);
    for (const tool of ['task.create', 'task.get']) {
      const onTheList = rows.some((row) => row.toolName === tool);
      expect(onTheList).toBe(!held.has(tool));
    }
  });
});
