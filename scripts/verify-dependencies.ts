/** Validate the declared lockfile and npm's installed tree without installing anything. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, Record<string, unknown>>;
};
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
for (const directory of [
  '',
  ...['apps', 'packages'].flatMap((parent) =>
    fs
      .readdirSync(path.join(root, parent))
      .filter((name) => fs.existsSync(path.join(root, parent, name, 'package.json')))
      .map((name) => `${parent}/${name}`),
  ),
]) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  for (const section of sections) {
    const canonical = (value: unknown) =>
      JSON.stringify(Object.entries((value ?? {}) as Record<string, unknown>).sort());
    if (canonical(manifest[section]) !== canonical(lock.packages[directory]?.[section])) {
      throw new Error(
        `${directory || '.'}/package.json ${section} differs from package-lock.json. Update the owning workspace and commit both files.`,
      );
    }
  }
}

/**
 * The package that owns an installed path.
 *
 * `node_modules/@scope/owner/node_modules/dep` is owned by `@scope/owner`, and
 * `node_modules/dep` is owned by whoever depends on it - the root, for the
 * tree's own top level.
 */
function ownerOf(lockPath: string): { owner: string | undefined; dependency: string } {
  const segments = lockPath.split('/');
  const dependency = segments[segments.length - 1] ?? '';
  const marker = segments.lastIndexOf('node_modules');
  if (marker < 1) return { owner: undefined, dependency };
  // The owner is the package directory that holds the nested node_modules, so
  // a scoped owner keeps both of its segments.
  const ownerDirectory = segments.slice(0, marker).join('/');
  return { owner: ownerDirectory.replace(/^node_modules\//, ''), dependency };
}

/**
 * Does the root manifest override this package on purpose?
 *
 * An override names the package that owns the override and the dependency it
 * replaces, so `{ "@scope/owner": { "dep": "^2.0.0" } }` covers `dep` inside
 * `@scope/owner`. A bare `"dep": "^2.0.0"` covers it everywhere.
 */
function isOverridden(overrides: unknown, owner: string | undefined, dependency: string): boolean {
  if (typeof overrides !== 'object' || overrides === null) return false;
  const declared = overrides as Record<string, unknown>;
  const scoped = owner === undefined ? undefined : declared[owner];
  if (typeof scoped === 'object' && scoped !== null && dependency in scoped) return true;
  return typeof declared[dependency] === 'string';
}

/**
 * Is this problem one the lockfile explains?
 *
 * npm reports a package as `invalid` when the installed version does not
 * satisfy the range its parent declares. npm 11 does not apply the root
 * manifest's `overrides` when it makes that comparison, so a package the
 * manifest deliberately overrode reads as invalid even when it is exactly the
 * version the lockfile records - and the gate then tells the operator to run
 * `npm ci`, which changes nothing.
 *
 * The lockfile is npm's own record of what it resolved. An invalid package
 * whose path and version the lockfile records, in a place the manifest
 * overrides, is therefore an override and not a broken tree. Everything else
 * still fails: a missing package, an extraneous one, an invalid version the
 * lockfile does not record, and any problem of a kind this does not read.
 */
function isExplained(problem: string, overrides: unknown): boolean {
  const match = /^invalid: (.+)@(\S+)\s+(.+)$/.exec(problem);
  if (!match) return false;
  const version = match[2];
  const installed = match[3];
  if (version === undefined || installed === undefined) return false;
  const relative = path.relative(root, installed);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  const lockPath = relative.split(path.sep).join('/');
  const entry = lock.packages[lockPath];
  if (!entry || entry['version'] !== version) return false;
  const { owner, dependency } = ownerOf(lockPath);
  return isOverridden(overrides, owner, dependency);
}

const rootManifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as Record<
  string,
  unknown
>;
const npmCli = process.env['npm_execpath'];

/**
 * The tree to judge, and npm's own verdict on it.
 *
 * `--tree <file>` reads a tree npm already wrote down, in npm's own shape.
 * The gate normally asks npm itself, and the argument exists so that what the
 * gate does with each kind of problem can be said without a full install -
 * the real npm's `invalid` marker needs a tree only an install can produce.
 */
function readTree(): { stdout: string; status: number; stderr: string } {
  const at = process.argv.indexOf('--tree');
  if (at !== -1) {
    const file = process.argv[at + 1];
    if (!file) {
      process.stderr.write('Usage: verify-dependencies.ts [--tree <file>]\n');
      process.exit(2);
    }
    return { stdout: fs.readFileSync(file, 'utf8'), status: 0, stderr: '' };
  }
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, 'ls', '--all', '--json'], {
        cwd: root,
        encoding: 'utf8',
      })
    : spawnSync('npm', ['ls', '--all', '--json'], {
        cwd: root,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      });
  if (result.error) {
    process.stderr.write(result.error.message);
    process.exit(1);
  }
  return { stdout: result.stdout ?? '', status: result.status ?? 0, stderr: result.stderr ?? '' };
}

const result = readTree();

/**
 * The problems npm reported, split into the ones the lockfile explains and
 * the ones it does not.
 *
 * npm's own exit code is not the answer: it is zero for some problems and
 * one for others, and it says nothing about which. The tree is judged by what
 * npm wrote down.
 */
function splitProblems(stdout: string): { explained: string[]; unexplained: string[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const reported = (parsed as { problems?: unknown }).problems;
  if (reported === undefined) return { explained: [], unexplained: [] };
  if (!Array.isArray(reported)) return null;
  const explained: string[] = [];
  const unexplained: string[] = [];
  for (const problem of reported) {
    if (typeof problem !== 'string') continue;
    (isExplained(problem, rootManifest['overrides']) ? explained : unexplained).push(problem);
  }
  return { explained, unexplained };
}

const verdict = splitProblems(result.stdout);

if (verdict === null) {
  // npm did not produce a tree this gate can read, so its own verdict is all
  // there is.
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'npm could not validate the installed tree.\n');
    process.stderr.write(
      'Stop this checkout’s dev stack, run npm ci in this checkout, then restart. Never share node_modules between worktrees or operating systems.\n',
    );
    process.exit(1);
  }
} else {
  const { explained, unexplained } = verdict;
  const failedForAnotherReason = result.status !== 0 && explained.length === 0;
  if (unexplained.length > 0 || failedForAnotherReason) {
    process.stderr.write(result.stderr || '');
    if (unexplained.length > 0) {
      process.stderr.write('\nThe installed tree does not match the lockfile:\n');
      for (const problem of unexplained) process.stderr.write(`  ${problem}\n`);
    }
    process.stderr.write(
      'Stop this checkout’s dev stack, run npm ci in this checkout, then restart. Never share node_modules between worktrees or operating systems.\n',
    );
    process.exit(1);
  }
  if (explained.length > 0) {
    console.log(
      `npm reported ${explained.length} problem${explained.length === 1 ? '' : 's'} that the lockfile explains: the manifest overrides the package, and the lockfile records the version that is installed.`,
    );
  }
}
console.log(
  'Workspace manifests match the lockfile; npm reports a complete installed dependency tree.',
);
