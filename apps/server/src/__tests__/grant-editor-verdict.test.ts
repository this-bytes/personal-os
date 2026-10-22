/**
 * Probe's verdict on WI-146's editor fix.
 *
 * The fix that came with the item changed the grant editor from "send the
 * list the page read" to "send what the owner turned". The landed probe
 * (`grant-widening-probe-review.test.ts`) measures the widening half of that:
 * a widening another writer committed is not taken back by a save that never
 * touched it. This file measures the other half, which nothing measures:
 *
 * **The narrowing.** The editor now sends an enable list and a disable list.
 * A change that only ever adds is not a change: the owner's own act of taking
 * a tool away has to still take it away. So the first case here turns a tool
 * off and asks whether the grant lost it.
 *
 * **The narrowing against another writer.** The promise is not only that a
 * save does not take back what it never touched. It is also that the owner's
 * own narrowing lands: the tool they turned off is gone, and the tool another
 * writer added while the page was stale is still there. A fix that kept the
 * whole list would pass the first case and fail this one, and a fix that
 * applied the change to the page's list instead of the grant as it is now
 * would fail this one too.
 *
 * **The hold under the editor's own save.** The item's guarantee rests on the
 * transaction taking the write lock before it reads, so a second process
 * cannot slip a widening in between. That guarantee has to hold for the
 * editor's save and not only for the widening route, because the editor's
 * save is a write to the same grant. So the third case holds the write lock
 * in another process, makes the editor's save run into it, and asks two
 * things: did the save wait, and did it wait instead of overwriting what the
 * other process committed.
 *
 * **The list after a narrowing.** The list and the grant have to agree. A
 * grant that no longer holds a tool is a grant the agent will be refused, and
 * a refusal that the list does not report is a list that under-reports what
 * is waiting on the owner. So the last case turns a tool off, lets the agent
 * ask for it again, and asks whether the list says so.
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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-editor-verdict-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'editor-verdict-owner-token',
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
    payload: { label: 'editor-verdict' },
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
 * write blocks its own event loop while it waits for the lock, so a holder
 * that waited for a signal from this process would deadlock.
 */
function spawnLockHolder(options: {
  agentId: string;
  toolName: string;
  holdMs: number;
  widen: boolean;
}): { locked: Promise<void>; done: Promise<void> } {
  const script = path.join(dataDir, 'verdict-lock-holder.mjs');
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

  return { locked, done };
}

/**
 * The agent's own page saves what the owner turned.
 *
 * The editor sends the change -- what the owner enabled and what they
 * disabled -- and not the whole list it read.
 */
async function saveGrantChange(
  agentId: string,
  change: { enable?: string[]; disable?: string[] },
): Promise<number> {
  const startedAt = Date.now();
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
    payload: { toolGrantChange: change },
  });
  const elapsed = Date.now() - startedAt;
  expect(response.statusCode).toBe(200);
  return elapsed;
}

describe("WI-146's editor fix, measured from outside the item", () => {
  it('takes the tool away when the owner turns it off', async () => {
    // The editor sends what the owner turned. If what it sent were only ever
    // "turn this on", the tool the owner turned off would still be granted
    // after the save, and the owner would be told their change was applied.
    const agent = await createAgent('Narrowing', ['conversation.read', 'task.create']);

    await saveGrantChange(agent.id, { disable: ['task.create'] });

    expect(
      await grants(agent.id),
      'the owner turned a tool off and the grant still holds it: the change was applied as an addition and nothing was ever taken away',
    ).toEqual(['conversation.read']);
  });

  it('takes the owner’s tool away and keeps the widening another writer made', async () => {
    // The promise has both halves at once: the tool the owner turned off is
    // gone, and the tool another writer added while the page was stale is
    // still there. A save that wrote the list the page read would fail this
    // in the other direction; a save that only ever added would fail it in
    // this one.
    const agent = await createAgent('Narrowing and widening', ['conversation.read']);

    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 200,
      widen: true,
    });
    await other.locked;
    await other.done;
    expect(await grants(agent.id)).toEqual(['conversation.read', 'task.get']);

    await saveGrantChange(agent.id, { disable: ['conversation.read'] });

    expect(
      await grants(agent.id),
      'the owner turned conversation.read off and the grant still holds it',
    ).toEqual(['task.get']);
  });

  it('waits for another process’s hold instead of overwriting it', async () => {
    // The item's guarantee rests on the transaction taking the write lock
    // before it reads. The editor's save is a write to the same grant, so
    // the guarantee has to hold for it too. If the save did not wait, the
    // hold was not holding anything and the case would be measuring nothing.
    const agent = await createAgent('Held', ['conversation.read']);

    const other = spawnLockHolder({
      agentId: agent.id,
      toolName: 'task.get',
      holdMs: 1200,
      widen: true,
    });
    await other.locked;

    const elapsed = await saveGrantChange(agent.id, { enable: ['task.create'] });
    await other.done;

    expect(
      elapsed,
      `the editor's save took ${elapsed} ms while another process held the write lock for 1200 ms: it did not wait for the lock`,
    ).toBeGreaterThanOrEqual(1000);

    expect(
      (await grants(agent.id)).sort(),
      "the editor's save overwrote what the other process committed: the widening it never touched was taken back",
    ).toEqual(['conversation.read', 'task.create', 'task.get']);
  });

  it('reports the tool again once the owner has taken it away', async () => {
    // The list and the grant have to agree after a narrowing. The agent is
    // refused a tool, so the list carries a row for it; the owner turns that
    // tool on and the row leaves; the owner turns it off again and the agent
    // asks for it once more, and the row has to come back. A list that does
    // not report a refusal that is really there is a list that under-reports
    // what is waiting on the owner.
    const agent = await createAgent('Narrowed list', ['conversation.read']);

    await callTool(agent.token, 'task.create');
    expect(capabilityRows(await waiting(), agent.id)).toHaveLength(1);

    await saveGrantChange(agent.id, { enable: ['task.create'] });
    expect(
      capabilityRows(await waiting(), agent.id),
      'the list still carries the row for a capability the grant now holds',
    ).toHaveLength(0);

    await saveGrantChange(agent.id, { disable: ['task.create'] });
    expect(await grants(agent.id)).toEqual(['conversation.read']);

    await callTool(agent.token, 'task.create');
    expect(
      capabilityRows(await waiting(), agent.id),
      'the grant no longer holds the tool and the agent was refused it, but the list does not report it: the list under-reports a block that is still there',
    ).toHaveLength(1);
  });
});
