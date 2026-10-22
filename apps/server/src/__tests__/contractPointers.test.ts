/**
 * The contract pointer gate.
 *
 * `scripts/verify-contract-pointers.ts` is a gate, and a gate that has never
 * been seen to fail is a gate that might never fail. This file is the proof
 * that it does: it points the gate at copies of the tree where a citation does
 * not point at code, and it holds the gate to failing.
 *
 * The drift it proves is the one this repository has three times already.
 * `CONTRACTS.md` cites the code by line number, and a citation goes stale
 * every time a nearby line changes: WI-034, WI-103 and the publication that
 * is landing now have each spent an item correcting citations by hand. A
 * citation that points at a blank line or a comment says nothing about the
 * code, and a citation of a file that is not in the tree says nothing at all.
 *
 * **A closing brace is code.** The gate once asked a line for a letter and
 * called `}` a line with nothing on it, so a citation of a whole function was
 * reported as pointing at nothing and a function could not be cited by its
 * closing brace. The rule here is the corrected one, and the cases below hold
 * it to the corrected rule: a brace passes, a range passes when it starts and
 * ends on code even if there is a blank line inside it, and a range that
 * starts on a comment or ends on a blank line fails.
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
const scriptPath = path.join(repoRoot, 'scripts', 'verify-contract-pointers.ts');
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

/**
 * A tree with one contract and one file, and a contract that cites the file.
 *
 * The cited file is four lines: a comment, a line of code, a blank line and a
 * closing brace. Every way a citation can miss is one of those lines.
 */
function treeWith(contract: string): string {
  const root = scratch('contract-pointers-');
  write(root, 'CONTRACTS.md', contract);
  write(
    root,
    'src/thing.ts',
    ['// a comment about the thing', 'export const theThing = 1;', '', '}', ''].join('\n'),
  );
  return root;
}

describe('a citation that points at code', () => {
  it('passes', async () => {
    const root = treeWith(['# Contracts', '', 'The thing is at `src/thing.ts:2`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('The contract pointer gate');
    expect(result.stdout).toContain('Every one of the 1 pointers points at code.');
  }, 60_000);

  it('passes on a range that starts and ends on code', async () => {
    // The range covers a line of code, a blank line and a closing brace. The
    // blank line in the middle is not a fault: the range names a block, and
    // the block starts on code and ends on code.
    const root = scratch('contract-pointers-range-');
    write(
      root,
      'CONTRACTS.md',
      ['# Contracts', '', 'The thing is at `src/thing.ts:2-4`.', ''].join('\n'),
    );
    write(
      root,
      'src/thing.ts',
      ['// a comment about the thing', 'export const theThing = 1;', '', '}', ''].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every one of the 1 pointers points at code.');
  }, 60_000);

  it('passes on a citation of a closing brace, because a brace is code', async () => {
    // The line is `}`. It carries no letter, and it is code.
    const root = treeWith(['# Contracts', '', 'The thing is at `src/thing.ts:4`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(0);
  }, 60_000);

  it('leaves a citation of a file that is not TypeScript alone', async () => {
    // The contract cites its own markdown and its JSON tables too, and the
    // gate knows what code looks like. A prose line is not code, and the gate
    // does not judge prose.
    const root = treeWith(
      [
        '# Contracts',
        '',
        'The note is at `docs/notes.md:3` and the table at `table.json:2`.',
        '',
      ].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every one of the 0 pointers points at code.');
  }, 60_000);
});

describe('a citation that points at nothing', () => {
  it('fails on a line past the end of the file, and names the pointer', async () => {
    const root = treeWith(['# Contracts', '', 'The thing is at `src/thing.ts:99`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('CONTRACTS.md:3');
    expect(result.stdout).toContain('[src/thing.ts:99]');
    expect(result.stdout).toContain('the cited line is past the end of the file');
  }, 60_000);

  it('fails on a citation of a comment', async () => {
    const root = treeWith(['# Contracts', '', 'The thing is at `src/thing.ts:1`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[src/thing.ts:1]');
    expect(result.stdout).toContain('the cited line holds no code (it is a comment)');
  }, 60_000);

  it('fails on a citation of a blank line', async () => {
    const root = treeWith(['# Contracts', '', 'The thing is at `src/thing.ts:3`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[src/thing.ts:3]');
    expect(result.stdout).toContain('the cited line holds no code (it is empty)');
  }, 60_000);

  it('fails on a range that starts on a comment', async () => {
    // The range opens on the comment above the thing, so it names a block
    // that begins in prose.
    const root = treeWith(
      ['# Contracts', '', 'The thing is at `src/thing.ts:1-4`.', ''].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[src/thing.ts:1-4]');
    expect(result.stdout).toContain('the cited range starts on a line that holds no code');
  }, 60_000);

  it('fails on a range that ends on a blank line', async () => {
    // The range covers a line of code and the blank line under it, so the
    // range ends somewhere that holds nothing.
    const root = treeWith(
      ['# Contracts', '', 'The thing is at `src/thing.ts:2-3`.', ''].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[src/thing.ts:2-3]');
    expect(result.stdout).toContain(
      'the cited range ends on a line that holds no code (line 3 is empty)',
    );
  }, 60_000);

  it('fails on a citation that names no path', async () => {
    // A bare file name is not a path from the root, so nobody reading the
    // contract can follow it.
    const root = treeWith(['# Contracts', '', 'The thing is at `thing.ts:2`.', ''].join('\n'));

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[thing.ts:2]');
    expect(result.stdout).toContain('the pointer names no path');
  }, 60_000);

  it('fails on a citation of a file that is not in the tree', async () => {
    const root = treeWith(
      ['# Contracts', '', 'The thing is at `src/missing.ts:2`.', ''].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[src/missing.ts:2]');
    expect(result.stdout).toContain('the file is not in the tree');
  }, 60_000);

  it('counts the failures and closes with what a human has to decide', async () => {
    const root = treeWith(
      [
        '# Contracts',
        '',
        'The thing is at `src/thing.ts:99`.',
        '',
        'The other thing is at `src/thing.ts:1`.',
        '',
      ].join('\n'),
    );

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Failures (2):');
    expect(result.stdout).toContain('2 of the 2 pointers no longer point at code.');
    expect(result.stdout).toContain('The contract is not edited by this script');
  }, 60_000);

  it('cannot run against a contract that is not there, and says so', async () => {
    const root = scratch('contract-pointers-missing-');

    const result = await runGate(['--root', root, '--contract', 'CONTRACTS.md']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('The contract pointer gate could not run.');
    expect(result.stdout).toContain('CONTRACTS.md');
  }, 60_000);
});

describe('this repository', () => {
  it('passes against the real contract, because the gate lands with the corrections', async () => {
    // The gate is a CI job, so it has to be green on the contract this tree
    // ships. **A gate that passes because nobody looked is not a gate.** The
    // number of pointers moves with the contract; what does not move is that
    // every one of them points at code.
    const result = await runGate(['--root', repoRoot, '--contract', 'CONTRACTS.md']);

    expect(result.stdout).toContain('The contract pointer gate');
    expect(result.stdout).toContain('Every one of the');
    expect(result.stdout).toContain('pointers points at code.');
    expect(result.status).toBe(0);
  }, 60_000);
});
