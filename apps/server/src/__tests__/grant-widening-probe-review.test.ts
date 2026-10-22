/**
 * Probe's review of WI-146, from outside the item's own check.
 *
 * WI-146 closed one lost update: the widening route read the grant outside
 * the transaction that wrote it, so a widening another process committed in
 * between was overwritten by a union computed from the old grant. The route
 * now asks the service to widen, the service computes the union inside the
 * transaction, and the transaction takes the write lock before it reads.
 *
 * This file asks three questions the item's own check does not ask.
 *
 * **One: is the hold real?** The item's check starts another process, waits
 * for it to say it holds the write lock, and then widens the grant. If that
 * hold did not actually block the server's write, the case could pass for a
 * reason that has nothing to do with the fix. So this file measures how long
 * the server's own widening takes while the lock is held: it has to wait.
 *
 * **Two: could the capability reach the grant by another path?** The item's
 * first case ends with a grant that holds three capabilities, one of which
 * only the other process ever added. If the server's own widening could put
 * that capability in the grant by some other route, the case would prove
 * nothing about the other process. So this file runs the same shape with the
 * other process holding the lock and committing *without* widening, and the
 * grant must not gain the capability that nobody widened.
 *
 * **Three: is the grant still safe on the other surface?** The agent's own
 * page reads the grant, lets the owner switch tools on and off, and saves the
 * whole list it read (`apps/web/src/components/ToolGrantPanel.tsx:43,48`).
 * The server writes that list as it stands (`service.ts:326-327`), so a
 * widening committed between the page's read and its save is taken back by
 * the save — the same defect, on the other surface, and it does not need a
 * second operating system process to happen.
 *
 * Nothing here edits the implementation. The file is the tester's, and it is
 * named so that it is not mistaken for the item's own check.
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
  // The database lives in a temporary directory: another process has to be
  // able to open the same file, so it cannot be in memory.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-grant-probe-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'grant-probe-owner-token',
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
    payload: { label: 'grant-probe' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** The agent calls a tool on the MCP surface. The answer is the agent's. */
async function callTool(token: string, name: string): Promise<void> {
  await app.inject({
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

/** The repository root, for the other process to resolve the database driver from. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The database file this app is running on. */
function dbFile(): string {
  return path.join(dataDir, 'personal-os.db');
}

/**
 * Another process, on the same database file, holding the write lock.
 *
 * It widens the grant when `widen` is set, and commits either way. The lock
 * is held for a fixed time rather than until the test says so: the server's
 * widening blocks its own event loop while it waits for the lock, so a holder
 * that waited for a signal from this process would deadlock.
 */
function spawnLockHolder(options: {
  agentId: string;
  toolName: string;
  holdMs: number;
  widen: boolean;
}): { locked: Promise<void>; done: Promise<void>; output: () => string } {
  const script = path.join(dataDir, 'probe-lock-holder.mjs');
  fs.writeFileSync(
    script,
    [
      "import { createRequire } from 'node:module';",
      "import path from 'node:path';",
      "const require = createRequire(path.join(process.argv[2], 'apps', 'server', 'package.json'));",
      "const BetterSqlite3 = require('better-sqlite3');",
      'const [dbPath, agentId, toolName, holdMs, widen] = process.argv.slice(3);',
      'const db = new BetterSqlite3(dbPath);',
      "db.pragma('busy_timeout = 10000');",
      "db.exec('BEGIN IMMEDIATE');",
      "const row = db.prepare('SELECT tool_grants FROM agent_connections WHERE id = ?').get(agentId);",
      'const granted = row && row.tool_grants ? JSON.parse(row.tool_grants) : [];',
      "if (widen === 'yes') {",
      '  const widened = granted.includes(toolName) ? granted : [...granted, toolName];',
      "  db.prepare('UPDATE agent_connections SET tool_grants = ?, updated_at = ? WHERE id = ?')",
      '    .run(JSON.stringify(widened), new Date().toISOString(), agentId);',
      "  db.prepare('DELETE FROM blocked_capabilities WHERE agent_connection_id = ? AND tool_name = ?')",
      '    .run(agentId, toolName);',
      '}',
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
      options.toolName,
      String(options.holdMs),
      options.widen ? 'yes' : 'no',
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
  child.on('exit', () => {
    resolveLocked();
    resolveDone();
  });

  return { locked, done, output: () => output };
}

/** The owner widens the grant from the waiting list. */
async function widenFromTheList(agentId: string, tool: string): Promise<number> {
  const startedAt = Date.now();
  const response = await app.inject({
    method: 'POST',
    url: `/api/agents/${agentId}/grants`,
    headers: { cookie: sessionCookie },
    payload: { tool },
  });
  const elapsed = Date.now() - startedAt;
  expect(response.statusCode).toBe(200);
  return elapsed;
}

/** The agent's own page saves the grant as it read it. */
async function saveGrantsAsRead(agentId: string, toolGrants: string[]): Promise<void> {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
    payload: { toolGrants },
  });
  expect(response.statusCode).toBe(200);
}

describe('what WI-146 fixed, and what it left alone', () => {
  it('waits for the lock the other process holds', async () => {
    // The hold is 1200 ms and the server's own widening has to wait for it.
    // If the widening did not wait, the hold was not holding anything and the
    // item's case would have been measuring nothing at all.
    const agent = await createAgent('Waited', ['conversation.read']);

    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 1200,
      widen: true,
    });
    await other.locked;

    const elapsed = await widenFromTheList(agent.id, 'task.create');
    await other.done;

    expect(
      elapsed,
      `the server's widening took ${elapsed} ms while another process held the write lock for 1200 ms: it did not wait for the lock, so the item's case cannot have been measuring the lock at all`,
    ).toBeGreaterThanOrEqual(1000);
  });

  it('does not put a capability in the grant that nobody widened', async () => {
    // The control for the item's first case. The other process holds the lock
    // and commits without widening anything, so the only capability that can
    // reach the grant is the one the owner widened. If the grant held the
    // capability the other process never widened, the item's case would be
    // passing for a reason that has nothing to do with the other process.
    const agent = await createAgent('Control', ['conversation.read']);

    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 600,
      widen: false,
    });
    await other.locked;

    await widenFromTheList(agent.id, 'task.create');
    await other.done;

    expect(await grants(agent.id)).toEqual(['conversation.read', 'task.create']);
  });

  it("does not take back a widening the agent's own page committed over", async () => {
    // The agent's own page reads the grant, lets the owner switch tools on and
    // off, and saves the whole list it read
    // (`apps/web/src/components/ToolGrantPanel.tsx:43,48`). The server writes
    // that list as it stands. So a widening that committed between the page's
    // read and its save is taken back by the save: the owner's other action is
    // gone, and the grant is narrower than it was.
    const agent = await createAgent('Editor', ['conversation.read']);

    // What the page read.
    const asRead = await grants(agent.id);

    // Another writer widens the grant and commits.
    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 200,
      widen: true,
    });
    await other.locked;
    await other.done;
    expect(await grants(agent.id)).toEqual(['conversation.read', 'task.get']);

    // The page saves what it read.
    await saveGrantsAsRead(agent.id, asRead);

    expect(
      await grants(agent.id),
      'the grant editor took back a widening another writer had committed: the grant is narrower than it was, and the owner never chose to narrow it',
    ).toEqual(['conversation.read', 'task.get']);
  });

  it('leaves the list and the grant agreeing after the editor saves', async () => {
    // The same save, with the list in view. The agent is refused a tool, so
    // the list carries a row for it; another writer widens the grant, and the
    // row leaves with the widening. A save that takes the widening back leaves
    // the agent blocked on a capability the list no longer shows: the list
    // under-reports a block that is still there.
    const agent = await createAgent('Editor list', ['conversation.read']);

    await callTool(agent.token, 'task.get');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    const asRead = await grants(agent.id);

    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 200,
      widen: true,
    });
    await other.locked;
    await other.done;

    await saveGrantsAsRead(agent.id, asRead);

    const held = new Set(await grants(agent.id));
    const rows = capabilityRows(await waiting(), agent.id);
    for (const tool of ['task.get']) {
      const onTheList = rows.some((row) => row.toolName === tool);
      expect(
        onTheList,
        `the list says ${tool} is ${onTheList ? '' : 'not '}waiting on the owner, and the grant ${held.has(tool) ? 'holds' : 'does not hold'} it: the list and the grant do not agree`,
      ).toBe(!held.has(tool));
    }
  });
});
