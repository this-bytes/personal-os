/**
 * The grant editor's save, measured.
 *
 * The grant editor shows the grant the page read, and the owner turns some of
 * it. The editor used to save the whole list it was given, so a widening
 * another writer committed after the page read was taken back by the save —
 * the owner's other action was gone, and the owner never chose to narrow it.
 *
 * This measures the three things the fix has to hold at once:
 *
 *   1. **a concurrent widening survives the editor's save**;
 *   2. **the owner's own narrowing still works** — unchecking a tool and
 *      saving removes it;
 *   3. **the list and the grant agree** afterwards.
 *
 * The editor's own rule is used, not a copy of it: the change this applies is
 * computed by the web's `grantChange`, so what is measured is what the editor
 * sends.
 *
 *   npx tsx scripts/probe-grant-editor-widening.ts
 *
 * The exit code is 0 when every check holds and 1 when one does not.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../apps/server/src/app.js';
import { loadConfig } from '../apps/server/src/config.js';
import { grantChange } from '../apps/web/src/lib/grantChange.js';
import type { McpToolName } from '@personal-os/contracts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;

/** Check one thing, and say what it saw. */
function check(what: string, holds: boolean, detail: string): void {
  if (holds) {
    console.log(`  ok   ${what} — ${detail}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${what} — ${detail}`);
}

async function main(): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-grant-editor-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'grant-editor-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  const app = await buildApp({ config });

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
  let cookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  cookie = cookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie },
  });
  const workspaceId = workspaces.json().workspaces[0].id as string;

  /** The database file the app is running on: the other process opens this one. */
  function dbFile(): string {
    return path.join(dataDir, 'personal-os.db');
  }

  /** An agent with the grant it was given, and a token to call with. */
  async function createAgent(
    name: string,
    toolGrants: McpToolName[],
  ): Promise<{ id: string; token: string }> {
    const agent = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { cookie },
      payload: {
        workspaceId,
        name,
        adapterType: 'echo',
        config: { reply: 'hi' },
        toolGrants,
      },
    });
    if (agent.statusCode !== 201) throw new Error(`the agent was not created: ${agent.body}`);
    const id = agent.json().agent.id as string;
    const token = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/tokens`,
      headers: { cookie },
      payload: { label: 'grant-editor' },
    });
    return { id, token: token.json().token as string };
  }

  /** The grant the editor's page shows: what the client read. */
  async function readGrant(agentId: string): Promise<McpToolName[]> {
    const detail = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}`,
      headers: { cookie },
    });
    return (detail.json().agent.toolGrants as McpToolName[]).slice().sort();
  }

  /** Another writer widens the grant: the action the owner's save must not undo. */
  async function widen(agentId: string, tool: string): Promise<void> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/grants`,
      headers: { cookie },
      payload: { tool },
    });
    if (response.statusCode !== 200) throw new Error(`the widening failed: ${response.body}`);
  }

  /** The editor's save: what the owner turned, computed by the editor's own rule. */
  async function editorSave(
    agentId: string,
    base: McpToolName[],
    selected: McpToolName[],
  ): Promise<number> {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      headers: { cookie },
      payload: { toolGrantChange: grantChange(base, selected) },
    });
    return response.statusCode;
  }

  /** The capability rows for one agent. */
  async function capabilityRows(agentId: string): Promise<string[]> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/waiting?workspaceId=${workspaceId}`,
      headers: { cookie },
    });
    const items = response.json().items as {
      kind: string;
      agentConnectionId: string | null;
      toolName: string | null;
    }[];
    return items
      .filter((row) => row.kind === 'capability' && row.agentConnectionId === agentId)
      .map((row) => row.toolName ?? '')
      .sort();
  }

  /** The agent calls a tool it is not granted, so a refusal is recorded. */
  async function refuse(token: string, tool: string): Promise<void> {
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
        params: { name: tool, arguments: { title: 'should not work' } },
      },
    });
  }

  /**
   * The list and the grant say the same thing about every refused capability:
   * a capability the agent holds is not waiting on the owner, and one it does
   * not hold is.
   */
  async function listAgrees(
    agentId: string,
    refused: McpToolName[],
  ): Promise<{ holds: boolean; detail: string }> {
    const grants = new Set(await readGrant(agentId));
    const rows = new Set(await capabilityRows(agentId));
    for (const tool of refused) {
      const onList = rows.has(tool);
      const held = grants.has(tool);
      // A capability the agent holds is not waiting on the owner, so it is not
      // on the list; a capability it does not hold is waiting, so it is.
      if (onList === !held) continue;
      return {
        holds: false,
        detail: `${tool} is ${held ? 'granted' : 'not granted'} and is ${onList ? 'on' : 'off'} the list`,
      };
    }
    return {
      holds: true,
      detail: `the list and the grant agree about ${refused.join(', ')}`,
    };
  }

  // ---------------------------------------------------------------------
  console.log('');
  console.log('1. a widening another writer committed survives the editor saving nothing');
  {
    const agent = await createAgent('Survivor', ['conversation.read']);
    await refuse(agent.token, 'task.get');

    const base = await readGrant(agent.id);
    await widen(agent.id, 'task.get');
    const before = await readGrant(agent.id);

    const status = await editorSave(agent.id, base, base);
    const after = await readGrant(agent.id);

    check('the save succeeds', status === 200, `status ${status}`);
    check(
      "the other writer's widening survives the save",
      after.join(',') === before.join(','),
      `the grant before the save was [${before.join(', ')}] and after it is [${after.join(', ')}]`,
    );
    const agreement = await listAgrees(agent.id, ['task.get']);
    check('the list and the grant agree', agreement.holds, agreement.detail);
  }

  // ---------------------------------------------------------------------
  console.log('');
  console.log("2. the owner's own narrowing still works, and the widening survives it");
  {
    const agent = await createAgent('Narrower', ['conversation.read', 'task.get']);
    await refuse(agent.token, 'task.create');

    const base = await readGrant(agent.id);
    await widen(agent.id, 'task.create');
    const before = await readGrant(agent.id);

    // The owner unchecks `task.get` and saves.
    const selected = base.filter((tool) => tool !== 'task.get');
    const status = await editorSave(agent.id, base, selected);
    const after = await readGrant(agent.id);

    check('the save succeeds', status === 200, `status ${status}`);
    check(
      'the tool the owner turned off is gone',
      !after.includes('task.get'),
      `the grant after the save is [${after.join(', ')}]`,
    );
    check(
      "the other writer's widening survives the narrowing",
      after.includes('task.create'),
      `the grant before the save was [${before.join(', ')}] and after it is [${after.join(', ')}]`,
    );
    const agreement = await listAgrees(agent.id, ['task.create']);
    check('the list and the grant agree', agreement.holds, agreement.detail);
  }

  // ---------------------------------------------------------------------
  console.log('');
  console.log("3. the save that runs into another process keeps that process's widening");
  {
    const agent = await createAgent('Racer', ['conversation.read']);
    await refuse(agent.token, 'task.get');

    const base = await readGrant(agent.id);
    const other = spawnOtherWriter(dbFile(), agent.id, 'task.get', 600);
    await other.locked;

    const started = Date.now();
    const status = await editorSave(agent.id, base, base);
    const elapsed = Date.now() - started;
    await other.done;

    const after = await readGrant(agent.id);
    check('the save succeeds', status === 200, `status ${status}`);
    check(
      'the save waited for the other process to let go of the lock',
      elapsed >= 200,
      `the save took ${elapsed}ms while the other process held the write lock`,
    );
    check(
      "the other process's widening survives the save",
      after.join(',') === 'conversation.read,task.get',
      `the grant after the save is [${after.join(', ')}]`,
    );
    const agreement = await listAgrees(agent.id, ['task.get']);
    check('the list and the grant agree', agreement.holds, agreement.detail);
  }

  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log('');
  if (failures > 0) {
    console.log(`${failures} check(s) did not hold.`);
    process.exitCode = 1;
    return;
  }
  console.log('Every check held.');
}

/**
 * Another process, widening the grant.
 *
 * It opens the same database file, takes the write lock, widens the grant the
 * way the service does, and holds the lock long enough for the editor's save
 * to run into it.
 *
 * It prints `locked` the moment it holds the lock and `committed` when it lets
 * go. The lock is held for a fixed time rather than until the probe says so,
 * because the save blocks the event loop while it waits for the lock: a
 * holder that waited for a signal from this process would deadlock.
 */
function spawnOtherWriter(
  dbPath: string,
  agentId: string,
  toolName: string,
  holdMs: number,
): { locked: Promise<void>; done: Promise<void>; output: () => string } {
  const script = path.join(os.tmpdir(), `pos-grant-editor-writer-${process.pid}.mjs`);
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
    [script, repoRoot, dbPath, agentId, toolName, String(holdMs)],
    { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
