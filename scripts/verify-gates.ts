/**
 * The command that runs every gate.
 *
 * The repository has a gate for each thing that has to be true: the typecheck,
 * the tests, the build, the format, the contract's status notes, the contract's
 * citations, the smoke test, the compiled build and the bundle budget. Each one
 * is a command, and each one is a way to say "the tree is green" — and each one
 * is also a way to say it wrongly.
 *
 * **That is not a hypothetical.** On 2026-10-22 the third landing was pushed on
 * the strength of a local run that said green, and CI was red: the server
 * package's tests had failed. The local run piped the test output through
 * `Select-Object -Last 12`, which dropped the server package's result off the
 * end, and the pipeline's exit code was the last command's rather than the
 * test's. The run reported success and the tree was broken. **Nothing in the
 * repository was wrong; the way the command was written was.**
 *
 * So this script exists to be the way the command is written. It runs the
 * gates one at a time, in the order CI runs them, and it stops at the first
 * one that fails. A gate's exit code is the script's exit code, and nothing is
 * piped away.
 *
 *   npx tsx scripts/verify-gates.ts
 *
 * The exit codes:
 *
 *   0 — every gate passed.
 *   1 — a gate failed. The failing gate is named, and its own output is on the
 *       screen already.
 *   2 — the script could not run: the gate list is missing, unreadable or
 *       malformed, or the gate's command could not be started.
 *
 * The gate list is the file beside this script. It is a table rather than code
 * so that it can be read, and so that a test can point the script at a list of
 * its own.
 *
 * The browser tests are not in the list: they need a browser installed and a
 * port of their own, and a gate that cannot run everywhere is not a gate. Run
 * them with `npm run test:e2e`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Gate {
  /** A stable name, used in the output and in the failure message. */
  name: string;
  /** The program to run. */
  command: string;
  /** Its arguments. */
  args: string[];
  /** What the gate proves, in a sentence. */
  about: string;
}

export interface GateList {
  gates: Gate[];
}

export interface GateResult {
  name: string;
  status: number | null;
  /** The milliseconds the gate took. */
  durationMs: number;
  /** Why it failed, when it did. */
  error?: string;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read the gate list.
 *
 * The list is read strictly: a gate without a name, a command or arguments is
 * a malformed list, and a malformed list is a script that cannot run.
 */
export function readGateList(file: string): GateList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`the gate list at ${file} could not be read: ${(error as Error).message}`);
  }

  const list = parsed as Partial<GateList>;
  if (!list || !Array.isArray(list.gates) || list.gates.length === 0) {
    throw new Error(`the gate list at ${file} names no gates`);
  }

  for (const gate of list.gates) {
    if (!gate || typeof gate.name !== 'string' || gate.name.length === 0) {
      throw new Error(`a gate in ${file} has no name`);
    }
    if (typeof gate.command !== 'string' || gate.command.length === 0) {
      throw new Error(`the gate "${gate.name}" has no command`);
    }
    if (!Array.isArray(gate.args) || gate.args.some((a) => typeof a !== 'string')) {
      throw new Error(`the gate "${gate.name}" has no arguments`);
    }
  }

  return list as GateList;
}

/**
 * Run one gate and report what happened.
 *
 * The child inherits the terminal, so a gate's own output is on the screen as
 * it runs and a failure is legible where it happened. The exit code is taken
 * from the child and nothing else decides whether the gate passed.
 */
export function runGate(gate: Gate, cwd: string): GateResult {
  const started = Date.now();
  const child = spawnSync(gate.command, gate.args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const durationMs = Date.now() - started;
  if (child.error) {
    return { name: gate.name, status: null, durationMs, error: child.error.message };
  }
  if (child.status === null) {
    return {
      name: gate.name,
      status: null,
      durationMs,
      error: `the gate was stopped by ${child.signal ?? 'a signal'}`,
    };
  }
  return { name: gate.name, status: child.status, durationMs };
}

/**
 * Run every gate, stopping at the first failure.
 *
 * Stopping is the point. A run that keeps going after a failure reports a
 * green build for a tree that is not green, and the second failure is read
 * while the first one is still on the screen.
 */
export function runGates(gates: Gate[], cwd: string): GateResult[] {
  const results: GateResult[] = [];
  for (const gate of gates) {
    console.log(`\n--- ${gate.name} ---`);
    console.log(`    ${gate.about}`);
    const result = runGate(gate, cwd);
    results.push(result);
    if (result.status !== 0) {
      console.log(`\n${gate.name} failed. The gates after it did not run.`);
      return results;
    }
  }
  return results;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function main(): number {
  const args = process.argv.slice(2);
  const listFile = option(args, '--gates') ?? path.join(repoRoot, 'scripts', 'gates.json');
  const only = option(args, '--only');

  let list: GateList;
  try {
    list = readGateList(listFile);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }

  const gates = only ? list.gates.filter((gate) => gate.name === only) : list.gates;
  if (gates.length === 0) {
    console.error(`no gate is named "${only}"`);
    return 2;
  }

  console.log(`The gates (${gates.length} of ${list.gates.length}), in the order CI runs them.`);
  const results = runGates(gates, repoRoot);

  console.log('\nThe gates');
  for (const result of results) {
    const verdict =
      result.status === 0 ? 'passed' : `FAILED (${result.error ?? `exit ${result.status}`})`;
    console.log(`  ${result.name.padEnd(18)} ${verdict.padEnd(40)} ${result.durationMs}ms`);
  }

  const failed = results.find((result) => result.status !== 0);
  if (failed) {
    console.log(`\n${failed.name} failed. The tree is not green.`);
    return 1;
  }

  console.log('\nEvery gate passed. The tree is green.');
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  process.exit(main());
}
