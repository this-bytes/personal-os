/**
 * The MCP parity gate.
 *
 * `scripts/verify-mcp-parity.ts` is a gate, and a gate that has never been seen
 * to fail is a gate that might never fail. This file is the proof that it does:
 * it points the gate at copies of the tree where an owner-facing route is not
 * agent-operable, and it holds the gate to failing.
 *
 * The drift it proves is the one ADR 0013 is about: an owner operation that
 * exists only for a human, on a surface where an agent cannot reach it. The
 * gate has to catch that in both directions — a route the contract publishes
 * and the table does not answer for, and a route the code registers and the
 * contract does not publish — because a route nobody wrote down can never be
 * paired and is therefore a human-only route by another name.
 *
 * It also holds the gate to not passing vacuously. A table that exempts
 * everything, or a contract with no routes in it, satisfies every other check
 * and proves nothing; the gate has to refuse both.
 *
 * The script is spawned rather than imported, so what is exercised is the gate
 * as CI runs it — the arguments, the output and the exit code — and not a
 * function called in-process.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'verify-mcp-parity.ts');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runGate(args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, scriptPath, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ status: code, stdout, stderr }));
  });
}

/** A directory of its own, so that nothing here writes into the repository. */
const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // A directory that could not be removed is a fact about the machine and
      // not a failure of the gate: the assertions above have already run.
    }
  }
});

function write(root: string, relative: string, contents: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

/** The contract of a scratch tree, with the routes it publishes. */
function contract(routes: string[]): string {
  return [
    '# Contracts',
    '',
    '## The HTTP surface',
    '',
    '| method | path | what |',
    '| --- | --- | --- |',
    ...routes.map((route) => `| \`GET\` | \`${route}\` | The thing. |`),
    '',
  ].join('\n');
}

/** The coverage table of a scratch tree. */
function coverage(entries: unknown[]): string {
  return JSON.stringify({ contract: 'CONTRACTS.md', routes: entries }, null, 2);
}

/**
 * A tree with two routes, two tools and a table that answers for both.
 *
 * It is the smallest tree the gate will accept: the gate refuses to pass when
 * it found no routes, or when no route is paired, so a tree with less than this
 * would fail for the wrong reason.
 */
function treeWith(options: {
  routes?: string[];
  entries?: unknown[];
  contracts?: string;
  server?: string;
  code?: string;
}): string {
  const root = scratch('mcp-parity-');
  write(root, 'CONTRACTS.md', contract(options.routes ?? ['/api/thing', '/api/other']));
  write(
    root,
    'scripts/mcp-parity.json',
    coverage(
      options.entries ?? [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/other', kind: 'listed', reason: 'Not yet.', spec: 'SPEC-S2' },
      ],
    ),
  );
  write(
    root,
    'packages/contracts/src/mcp.ts',
    options.contracts ??
      ["export const mcpToolNames = ['thing.read', 'other.read'] as const;", ''].join('\n'),
  );
  write(
    root,
    'apps/server/src/modules/mcp/server.ts',
    options.server ??
      ["server.registerTool('thing.read', {});", "server.registerTool('other.read', {});", ''].join(
        '\n',
      ),
  );
  write(
    root,
    'apps/server/src/api/thing.ts',
    options.code ?? ["app.get('/api/thing');", "app.get('/api/other');", ''].join('\n'),
  );
  return root;
}

describe('a tree where every owner-facing route is answered for', () => {
  it('passes', async () => {
    const root = treeWith({});

    const result = await runGate(['--root', root]);

    expect(result.stdout).toContain('The MCP parity gate');
    expect(result.status).toBe(0);
  }, 60_000);

  it('passes against the real tree, because the gate lands with the work', async () => {
    // The gate is a CI job, so it has to be green on the tree this repository
    // ships. **A gate that passes because nobody looked is not a gate.**
    const result = await runGate(['--root', repoRoot]);

    expect(result.stdout).toContain('The MCP parity gate');
    expect(result.status).toBe(0);
  }, 60_000);
});

describe('a route nobody answered for', () => {
  it('fails when the contract publishes a route the table does not answer for', async () => {
    // This is the drift the gate exists to catch: a human-only route added to
    // the contract, with nothing on the agent's side.
    const root = treeWith({
      routes: ['/api/thing', '/api/other', '/api/new-human-only-route'],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('GET /api/new-human-only-route');
    expect(result.stdout).toContain('the coverage table does not answer for it');
  }, 60_000);

  it('fails when the server registers a route the contract does not publish', async () => {
    // A route that is not published cannot be paired, so it is a human-only
    // route by another name.
    const root = treeWith({
      code: [
        "app.get('/api/thing');",
        "app.get('/api/other');",
        "app.get('/api/undocumented');",
        '',
      ].join('\n'),
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('GET /api/undocumented');
    expect(result.stdout).toContain('the contract does not publish it');
  }, 60_000);

  it('fails when the table answers for a route the contract does not publish', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/gone', kind: 'paired', tool: 'thing.read' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('GET /api/gone');
    expect(result.stdout).toContain('the contract does not publish');
  }, 60_000);

  it('fails when the table lists the same route twice', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('lists this route twice');
  }, 60_000);
});

describe('a claim in the table that is false', () => {
  it('fails when a paired route names a tool the contracts do not publish', async () => {
    const root = treeWith({
      entries: [{ route: 'GET /api/thing', kind: 'paired', tool: 'thing.teleported' }],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('thing.teleported');
    expect(result.stdout).toContain('the contracts do not publish');
  }, 60_000);

  it('fails when a paired route names a tool the MCP server does not register', async () => {
    const root = treeWith({
      entries: [{ route: 'GET /api/thing', kind: 'paired', tool: 'other.read' }],
      server: ["server.registerTool('thing.read', {});", ''].join('\n'),
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the MCP server does not register it');
  }, 60_000);

  it('fails when the contracts publish a tool the MCP server does not register', async () => {
    const root = treeWith({
      server: ["server.registerTool('thing.read', {});", ''].join('\n'),
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('other.read');
    expect(result.stdout).toContain('the MCP server does not register it');
  }, 60_000);

  it('fails when the MCP server registers a tool the contracts do not publish', async () => {
    const root = treeWith({
      server: [
        "server.registerTool('thing.read', {});",
        "server.registerTool('other.read', {});",
        "server.registerTool('thing.sneaked', {});",
        '',
      ].join('\n'),
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('thing.sneaked');
    expect(result.stdout).toContain('the contracts do not publish it');
  }, 60_000);

  it('fails when a listed route carries no reason', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/other', kind: 'listed', spec: 'SPEC-S2' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no reason is written');
  }, 60_000);

  it('fails when a listed route names no spec that will pair it', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/other', kind: 'listed', reason: 'Not yet.' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no spec that will pair it is named');
  }, 60_000);

  it('fails when an exempt route carries no reason', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/other', kind: 'exempt' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no reason is written');
  }, 60_000);

  it('fails when an entry says something the gate cannot read', async () => {
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'paired', tool: 'thing.read' },
        { route: 'GET /api/other', kind: 'later' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('which is not one of paired, listed or exempt');
  }, 60_000);
});

describe('a gate that would prove nothing', () => {
  it('fails when no route is paired with a tool', async () => {
    // Every route exempted would satisfy every other check. A gate that passes
    // like that is not a gate.
    const root = treeWith({
      entries: [
        { route: 'GET /api/thing', kind: 'exempt', reason: 'Because.' },
        { route: 'GET /api/other', kind: 'exempt', reason: 'Because.' },
      ],
    });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the gate proved nothing');
  }, 60_000);

  it('fails when the contract publishes no routes at all', async () => {
    const root = treeWith({ routes: [] });

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the gate checked nothing');
  }, 60_000);
});

describe('a gate that cannot run', () => {
  it('says so when the contract is not there', async () => {
    const root = scratch('mcp-parity-missing-');

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('The MCP parity gate could not run');
    expect(result.stdout).toContain('CONTRACTS.md');
  }, 60_000);

  it('says so when the coverage table is not readable JSON', async () => {
    const root = treeWith({});
    write(root, 'scripts/mcp-parity.json', 'not json at all');

    const result = await runGate(['--root', root]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('could not run');
  }, 60_000);
});
