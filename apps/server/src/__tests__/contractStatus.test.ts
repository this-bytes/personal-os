/**
 * The contract status gate.
 *
 * `scripts/verify-contract-status.ts` is a gate, and a gate that has never been
 * seen to fail is a gate that might never fail. This file is the proof that it
 * does: it points the gate at copies of the tree where a published note no
 * longer matches the code, and it holds the gate to failing.
 *
 * The drift it proves is the one this repository already has twice. The
 * template record's note said "the code does not implement this yet" for four
 * hours and fifteen minutes after WI-017 landed, and the resolve route's note
 * went false twenty-seven minutes after it was written. Both are the same
 * shape: a note that says a thing is absent, and a tree that has it.
 *
 * The script is spawned rather than imported, so what is exercised is the
 * gate as CI runs it — the arguments, the output and the exit code — and not
 * a function called in-process.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'verify-contract-status.ts');
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

describe('a note that no longer matches the tree', () => {
  it('fails, and names the note, the file, the line and the claim', async () => {
    // A scratch tree with one note and one file. The note says the thing is
    // not implemented; the file has it. That is the whole drift.
    const root = scratch('contract-status-drift-');
    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A gap',
        '',
        '### A gap',
        '',
        '**The code does not implement this yet.** Nothing in the tree carries it.',
        '',
      ].join('\n'),
    );
    write(root, 'src/thing.ts', 'export const theThing = 1;\n');
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'a-gap',
              section: 'A gap',
              note: 'The code does not implement this yet',
              claim: 'not-implemented',
              expect: [{ kind: 'absent-text', path: 'src/thing.ts', value: 'theThing' }],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await runGate([
      '--root',
      root,
      '--contract',
      'CONTRACTS.md',
      '--table',
      'table.json',
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('FAIL');
    expect(result.stdout).toContain('CONTRACTS.md:7');
    expect(result.stdout).toContain('not-implemented');
    expect(result.stdout).toContain('src/thing.ts');
    expect(result.stdout).toContain('theThing');
  }, 60_000);

  it('fails on this repository, on a note the tree contradicts', async () => {
    // The real drift, in the shape the gate catches: a note says the code
    // does not implement something, and the tree has it. WI-017 put
    // `resource.template.list` in the tree, so that is what the note claims
    // is absent.
    const root = scratch('contract-status-real-drift-');

    // The scratch copy is the real contract with one section added to it, and
    // the added section carries the false note. The section is added rather
    // than an existing note rewritten, so the proof does not depend on what
    // any one note in the contract happens to say today — the contract's own
    // notes are corrected from time to time, and a proof that broke when one
    // of them was corrected would be a proof that stopped proving.
    const contract = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
    write(
      root,
      'CONTRACTS.md',
      `${contract}\n## A drift, introduced for the proof\n\n**The code does not implement this yet.**\nNothing in the tree carries it.\n`,
    );
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'a-drift',
              section: 'A drift, introduced for the proof',
              note: 'The code does not implement this yet',
              claim: 'not-implemented',
              expect: [
                {
                  kind: 'absent-text',
                  path: 'packages/contracts/src/mcp.ts',
                  value: 'resource.template.list',
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await runGate([
      '--root',
      repoRoot,
      '--contract',
      path.join(root, 'CONTRACTS.md'),
      '--table',
      path.join(root, 'table.json'),
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('FAIL');
    expect(result.stdout).toContain('[a-drift]');
    expect(result.stdout).toContain('not-implemented');
    expect(result.stdout).toContain('packages/contracts/src/mcp.ts');
    expect(result.stdout).toContain('resource.template.list');
  }, 60_000);
});

describe('the claim table and the contract', () => {
  it('fails when the note and the table claim different things', async () => {
    // The note says the code implements it; the table says it does not. One of
    // the two is lying, and the gate says which pair of words does not match.
    const root = scratch('contract-status-disagreement-');
    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        'This entry is the contract for **WI-001**, and the code implements it.',
        '',
      ].join('\n'),
    );
    write(root, 'src/thing.ts', 'export const theThing = 1;\n');
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'a-thing',
              section: 'Contract 1 — A thing',
              note: 'WI-001, and the code implements it',
              claim: 'not-implemented',
              expect: [{ kind: 'absent-text', path: 'src/thing.ts', value: 'theThing' }],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await runGate([
      '--root',
      root,
      '--contract',
      'CONTRACTS.md',
      '--table',
      'table.json',
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'the note says implemented, and the claim table says not-implemented',
    );
  }, 60_000);

  it('fails when the note the table describes is no longer there', async () => {
    // The table is stale: the note was rewritten and the table was not
    // rewritten with it. A table that no longer describes the contract is a
    // gate that has stopped checking what it claims to check.
    const root = scratch('contract-status-stale-');
    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        'The code does not implement this yet.',
        '',
      ].join('\n'),
    );
    write(root, 'src/thing.ts', 'export const theThing = 1;\n');
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'a-thing',
              section: 'Contract 1 — A thing',
              note: 'The code does not implement this yet, and never will',
              claim: 'not-implemented',
              expect: [{ kind: 'absent-text', path: 'src/thing.ts', value: 'theThing' }],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await runGate([
      '--root',
      root,
      '--contract',
      'CONTRACTS.md',
      '--table',
      'table.json',
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no longer in');
  }, 60_000);
});

describe('a note the gate cannot read', () => {
  it('is reported as unchecked and does not fail the run', async () => {
    const root = scratch('contract-status-unchecked-');
    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        'This entry is published ahead of its implementation, and the work is',
        'still to come.',
        '',
      ].join('\n'),
    );
    write(root, 'src/thing.ts', 'export const theThing = 1;\n');
    write(root, 'table.json', JSON.stringify({ contract: 'CONTRACTS.md', claims: [] }, null, 2));

    const result = await runGate([
      '--root',
      root,
      '--contract',
      'CONTRACTS.md',
      '--table',
      'table.json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Unchecked (0)');
  }, 60_000);
});

describe('the tree as it stands', () => {
  it('passes, with every claim in the table checked', async () => {
    const result = await runGate([]);

    // The count is read from the table rather than written down here, so the
    // assertion keeps its meaning when a claim is added to the table — which
    // is what happens every time a note is given a claim.
    const table = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'scripts', 'contract-status.json'), 'utf8'),
    ) as { claims: unknown[] };

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every claim in the table matches the tree.');
    expect(result.stdout).toContain(`Checked (${table.claims.length})`);
    expect(result.stdout).toContain('Failures (0)');
  }, 60_000);

  it('says it could not run when the claim table is not there', async () => {
    const result = await runGate(['--table', 'scripts/no-such-table.json']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('could not run');
  }, 60_000);

  it('says it could not run when the claim table is malformed', async () => {
    const root = scratch('contract-status-malformed-');
    write(root, 'CONTRACTS.md', '# Contracts\n');
    write(root, 'table.json', '{ "contract": "CONTRACTS.md", "claims": [ { "id": "x" } ] }');

    const result = await runGate([
      '--root',
      root,
      '--contract',
      'CONTRACTS.md',
      '--table',
      'table.json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('could not run');
  }, 60_000);
});
