/**
 * The command that runs every gate.
 *
 * On 2026-10-22 a local run said green and CI was red: the server package's
 * tests had failed, and the local run had piped the output through
 * `Select-Object -Last 12`, which dropped that package's result off the end
 * and left the pipeline's exit code as the last command's. Nothing in the
 * repository was wrong. **The way the command was written was.**
 *
 * So this file holds `scripts/verify-gates.ts` to the one job that matters:
 * **a gate that fails has to make the script fail**, and the gates after it
 * must not run. A runner that keeps going after a failure reports a green
 * build for a tree that is not green, and the second failure is read while
 * the first is still on the screen.
 *
 * The script is spawned rather than imported, so what is exercised is the
 * gate as a developer runs it — the arguments, the output and the exit code.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'verify-gates.ts');
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
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-gates-'));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/**
 * A gate that passes, and a gate that fails, written as scripts so that the
 * command works the same on every platform.
 */
function writeGateScripts(): { passing: string; failing: string; marker: string } {
  const passing = path.join(scratch, 'passing.js');
  const failing = path.join(scratch, 'failing.js');
  const marker = path.join(scratch, 'the-gate-after-the-failure-ran');
  fs.writeFileSync(passing, 'process.exit(0);\n');
  fs.writeFileSync(failing, 'process.exit(3);\n');
  fs.writeFileSync(marker, '');
  return { passing, failing, marker };
}

/** A gate list in the shape the script reads. */
function writeGateList(gates: { name: string; script: string }[]): string {
  const file = path.join(scratch, `gates-${gates.map((g) => g.name).join('-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      gates: gates.map((gate) => ({
        name: gate.name,
        command: process.execPath,
        args: [gate.script],
        about: `the ${gate.name} gate`,
      })),
    }),
  );
  return file;
}

describe('the gate runner', () => {
  it('passes when every gate passes, and says so', async () => {
    const { passing } = writeGateScripts();
    const list = writeGateList([
      { name: 'first', script: passing },
      { name: 'second', script: passing },
    ]);

    const result = await runGate(['--gates', list]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every gate passed');
    expect(result.stdout).toContain('first');
    expect(result.stdout).toContain('second');
  }, 60_000);

  it('fails when a gate fails, and names the gate that failed', async () => {
    const { passing, failing } = writeGateScripts();
    const list = writeGateList([
      { name: 'first', script: passing },
      { name: 'the-failing-one', script: failing },
    ]);

    const result = await runGate(['--gates', list]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the-failing-one failed');
    expect(result.stdout).toContain('The tree is not green');
  }, 60_000);

  it('does not run the gates after a failure', async () => {
    const { passing, failing, marker } = writeGateScripts();
    // The gate after the failure writes the marker. If it runs, the file
    // appears, and the runner is reporting a green build for a tree that is
    // not green.
    const after = path.join(scratch, 'after.js');
    fs.writeFileSync(after, `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`);
    fs.rmSync(marker, { force: true });

    const list = writeGateList([
      { name: 'the-failing-one', script: failing },
      { name: 'after', script: after },
    ]);

    const result = await runGate(['--gates', list]);

    expect(result.status).toBe(1);
    expect(fs.existsSync(marker)).toBe(false);
  }, 60_000);

  it('cannot run when the gate list is malformed, and says so', async () => {
    const file = path.join(scratch, 'malformed.json');
    fs.writeFileSync(file, JSON.stringify({ gates: [{ name: 'no command here' }] }));

    const result = await runGate(['--gates', file]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('has no command');
  }, 60_000);

  it('cannot run when the gate list is missing', async () => {
    const result = await runGate(['--gates', path.join(scratch, 'not-here.json')]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('could not be read');
  }, 60_000);

  it('runs the gate list the repository ships, and it is not empty', async () => {
    const list = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'scripts', 'gates.json'), 'utf8'),
    ) as { gates: { name: string; command: string; args: string[] }[] };

    expect(list.gates.length).toBeGreaterThan(0);
    const names = list.gates.map((gate) => gate.name);
    // The gates the tree can be wrong about, and the two that read the
    // published contract.
    for (const name of [
      'typecheck',
      'test',
      'build',
      'format',
      'contract-status',
      'contract-pointers',
    ]) {
      expect(names).toContain(name);
    }
  });
});
