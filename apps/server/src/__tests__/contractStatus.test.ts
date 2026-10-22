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
import { execFileSync, spawn } from 'node:child_process';
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

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

/** A repository of its own, so that nothing here reads this repository's history. */
function initRepository(root: string): void {
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'gate@example.com']);
  git(root, ['config', 'user.name', 'Contract status gate']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  git(root, ['config', 'core.autocrlf', 'false']);
}

/** Commit the files, and say which commit that was. */
function commit(root: string, files: Record<string, string>): string {
  for (const [relative, contents] of Object.entries(files)) {
    write(root, relative, contents);
  }
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'a change']);
  return git(root, ['rev-parse', 'HEAD']);
}

/** Whether this checkout can look up an old commit at all. */
function isShallowRepository(): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() === 'true'
    );
  } catch {
    return true;
  }
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

describe('a note that names a commit', () => {
  // WI-132's note said "the code implements it — as of `4d389c7`", and at that
  // commit the declaration was the loose `toolName?: string | null`: a third
  // wire shape the server never sends. The shape landed later, in a commit of
  // its own. A note that names a commit has to name one that carries the
  // shape, and the gate is where that is checked.
  it('fails when the code at that commit does not carry the shape', async () => {
    const root = scratch('contract-status-commit-shape-');
    initRepository(root);
    const first = commit(root, { 'src/thing.ts': 'export const theThing = 1;\n' });
    commit(root, { 'src/thing.ts': 'export const theThing = 2;\n' });

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        `**The code implements it — as of \`${first}\`.**`,
        '',
      ].join('\n'),
    );
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
              note: 'The code implements it',
              claim: 'implemented',
              expect: [{ kind: 'present-text', path: 'src/thing.ts', value: 'theThing = 2' }],
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
    expect(result.stdout).toContain(`as of ${first}`);
    expect(result.stdout).toContain('at that commit');
    expect(result.stdout).toContain('theThing = 2');
  }, 60_000);

  it('fails on this repository, on a note naming a commit without the shape', async () => {
    // The defect this check was written for. WI-132's note named `4d389c7`,
    // and at that commit the waiting item declared `toolName?: string | null`:
    // the field was optional, so a row could leave it out, and that is a
    // third wire shape the server never sends. The declaration was tightened
    // afterwards, in a commit of its own, and the note still named the old
    // one.
    //
    // The proof reads this repository's own history: the contract and the
    // table are scratch copies, and the code and the commits are the real
    // ones.
    if (isShallowRepository()) {
      // A shallow checkout holds one commit, so the old one cannot be looked
      // up in it. Say so, rather than report a commit the tree has as one it
      // does not.
      console.warn(
        '[contract-status] the commit check is skipped: this checkout is shallow, so an old commit cannot be looked up in it',
      );
      return;
    }

    const root = scratch('contract-status-real-commit-');
    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — The waiting shape',
        '',
        '**The code implements it — as of `4d389c7`.**',
        '',
      ].join('\n'),
    );
    write(
      root,
      'table.json',
      JSON.stringify({
        contract: 'CONTRACTS.md',
        claims: [
          {
            id: 'the-waiting-shape',
            section: 'Contract 1 — The waiting shape',
            note: 'The code implements it',
            claim: 'implemented',
            expect: [
              {
                kind: 'present-pattern',
                path: 'packages/contracts/src/waiting.ts',
                value: 'toolName: string \\| null;',
              },
            ],
          },
        ],
      }),
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
    expect(result.stdout).toContain('as of 4d389c7');
    expect(result.stdout).toContain('at that commit');
    expect(result.stdout).toContain('packages/contracts/src/waiting.ts');
  }, 60_000);

  it('fails when the commit it names is not in this tree', async () => {
    const root = scratch('contract-status-commit-absent-');
    initRepository(root);
    commit(root, { 'src/thing.ts': 'export const theThing = 1;\n' });

    // A commit that this repository has never heard of. The note points at
    // code nobody can read, which is not a claim about anything.
    const unknown = '0'.repeat(40);

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        `**The code implements it — as of \`${unknown}\`.**`,
        '',
      ].join('\n'),
    );
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
              note: 'The code implements it',
              claim: 'implemented',
              expect: [{ kind: 'present-text', path: 'src/thing.ts', value: 'theThing' }],
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
    expect(result.stdout).toContain(`as of ${unknown}`);
    expect(result.stdout).toContain('holds no commit by that name');
  }, 60_000);

  it('fails when the commit it names is on a branch this tree does not carry', async () => {
    const root = scratch('contract-status-commit-branch-');
    initRepository(root);
    commit(root, { 'src/thing.ts': 'export const theThing = 1;\n' });
    git(root, ['checkout', '--quiet', '-b', 'a-branch']);
    const onBranch = commit(root, { 'src/thing.ts': 'export const theThing = 2;\n' });
    git(root, ['checkout', '--quiet', '-']);

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        `**The code implements it — as of \`${onBranch}\`.**`,
        '',
      ].join('\n'),
    );
    write(
      root,
      'table.json',
      JSON.stringify({
        contract: 'CONTRACTS.md',
        claims: [
          {
            id: 'a-thing',
            section: 'Contract 1 — A thing',
            note: 'The code implements it',
            claim: 'implemented',
            expect: [{ kind: 'present-text', path: 'src/thing.ts', value: 'theThing' }],
          },
        ],
      }),
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
    expect(result.stdout).toContain(`as of ${onBranch}`);
    expect(result.stdout).toContain("not in this tree's history");
  }, 60_000);

  it('passes when the commit it names carries the shape', async () => {
    const root = scratch('contract-status-commit-holds-');
    initRepository(root);
    const first = commit(root, { 'src/thing.ts': 'export const theThing = 1;\n' });
    commit(root, { 'src/thing.ts': 'export const theThing = 2;\n' });

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — A thing',
        '',
        `**The code implements it — as of \`${first}\`.**`,
        '',
      ].join('\n'),
    );
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
              note: 'The code implements it',
              claim: 'implemented',
              expect: [{ kind: 'present-text', path: 'src/thing.ts', value: 'theThing' }],
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

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every claim in the table matches the tree.');
  }, 60_000);
});

describe('two claims about one item', () => {
  // WI-132 has two claims: the shape it publishes and the panel's row. Each
  // was checked at the commit it named, and each passed on its own — the
  // panel's expectations held at the commit that published the loose
  // declaration, so the panel claim stayed green there while the item's shape
  // had already moved. A claim about the tree says nothing about the commit
  // beside it, and two claims about one item have to name one commit.
  it('fails when they name two commits', async () => {
    const root = scratch('contract-status-item-commit-');
    initRepository(root);
    const first = commit(root, {
      'src/shape.ts': "export const shape = 'loose';\n",
      'src/panel.ts': 'export const panel = 1;\n',
    });
    const second = commit(root, {
      'src/shape.ts': "export const shape = 'tight';\n",
      'src/panel.ts': 'export const panel = 1;\n',
    });

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — The shape',
        '',
        `**The shape is the contract, and the code implements it — as of \`${second}\`.**`,
        '',
        '## Contract 2 — The panel',
        '',
        `**The panel is the contract, and the code implements it — as of \`${first}\`.**`,
        '',
      ].join('\n'),
    );
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'the-shape',
              section: 'Contract 1 — The shape',
              note: 'The shape is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-132',
              expect: [{ kind: 'present-text', path: 'src/shape.ts', value: "shape = 'tight'" }],
            },
            {
              id: 'the-panel',
              section: 'Contract 2 — The panel',
              note: 'The panel is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-132',
              expect: [{ kind: 'present-text', path: 'src/panel.ts', value: 'panel = 1' }],
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

    // Each claim holds where it stands: the shape at the tight commit, the
    // panel at the first one. What does not hold is the item, whose two
    // claims point at two different trees.
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the claims about WI-132 name 2 commits');
    expect(result.stdout).toContain(first.slice(0, 7));
    expect(result.stdout).toContain(second.slice(0, 7));
    expect(result.stdout).toContain('Two claims about one item must name one commit.');
  }, 60_000);

  it('passes when they name the same commit', async () => {
    const root = scratch('contract-status-item-one-commit-');
    initRepository(root);
    const only = commit(root, {
      'src/shape.ts': "export const shape = 'tight';\n",
      'src/panel.ts': 'export const panel = 1;\n',
    });

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — The shape',
        '',
        `**The shape is the contract, and the code implements it — as of \`${only}\`.**`,
        '',
        '## Contract 2 — The panel',
        '',
        `**The panel is the contract, and the code implements it — as of \`${only}\`.**`,
        '',
      ].join('\n'),
    );
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'the-shape',
              section: 'Contract 1 — The shape',
              note: 'The shape is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-132',
              expect: [{ kind: 'present-text', path: 'src/shape.ts', value: "shape = 'tight'" }],
            },
            {
              id: 'the-panel',
              section: 'Contract 2 — The panel',
              note: 'The panel is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-132',
              expect: [{ kind: 'present-text', path: 'src/panel.ts', value: 'panel = 1' }],
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

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every claim in the table matches the tree.');
  }, 60_000);

  it('passes when two claims in one section are about different items', async () => {
    // The rule reads the item, not the section. Two claims in one section can
    // be about different items — WI-142's catalogue and WI-153's evidence are
    // both in "The adapter presets" — and naming different commits is then
    // right, not a disagreement.
    const root = scratch('contract-status-two-items-');
    initRepository(root);
    const first = commit(root, {
      'src/one.ts': 'export const one = 1;\n',
      'src/two.ts': 'export const two = 2;\n',
    });
    const second = commit(root, {
      'src/one.ts': 'export const one = 1;\n',
      'src/two.ts': 'export const two = 3;\n',
    });

    write(
      root,
      'CONTRACTS.md',
      [
        '# Contracts',
        '',
        '## Contract 1 — Two things',
        '',
        `**The first thing is the contract, and the code implements it — as of \`${first}\`.**`,
        '',
        `**The second thing is the contract, and the code implements it — as of \`${second}\`.**`,
        '',
      ].join('\n'),
    );
    write(
      root,
      'table.json',
      JSON.stringify(
        {
          contract: 'CONTRACTS.md',
          claims: [
            {
              id: 'the-first',
              section: 'Contract 1 — Two things',
              note: 'The first thing is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-142',
              expect: [{ kind: 'present-text', path: 'src/one.ts', value: 'one = 1' }],
            },
            {
              id: 'the-second',
              section: 'Contract 1 — Two things',
              note: 'The second thing is the contract, and the code implements it',
              claim: 'implemented',
              item: 'WI-153',
              expect: [{ kind: 'present-text', path: 'src/two.ts', value: 'two = 3' }],
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

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every claim in the table matches the tree.');
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
