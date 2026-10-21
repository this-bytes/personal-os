/**
 * The borrow-rule gate.
 *
 * Every licence the installed tree declares must be one this project approved,
 * and the record of what was approved is `docs/dependency-licences.json` — the
 * ground truth. This script carries no second copy of it, and it does not read
 * the record's `summary`: every number it prints is counted here, because a
 * number copied out of a document is a number that is true until the tree
 * moves.
 *
 * Three exit codes, and the third is the one that matters:
 *
 *   0  the lockfile and the record agree
 *   1  a licence problem: a change, an unapproved licence, an arrival, a departure
 *   2  the gate could not run: the record or the lockfile is missing or unreadable
 *
 * A broken gate must never look like a clean one, and a gate that cannot read
 * its ground truth has proved nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The kinds of record entry, spelled as the record spells them. */
const KIND_LICENCE_FILE = 'licence-file';
const KIND_PACKAGE_JSON_FIELD = 'package-json-licence-field';
const KIND_PUBLISHED_IDENTIFIER = 'published-licence-identifier';

interface RecordEntry {
  name: string;
  version: string;
  lockPath: string;
  spdxId: string | null;
  source: { kind: string; file?: string; field?: string } | null;
  firstParty?: { workspace: string };
}

interface RecordFile {
  packages: RecordEntry[];
  approvedSet: { licences: Array<{ spdxId: string }> };
}

interface LockEntry {
  version?: string;
  license?: string;
  link?: boolean;
  resolved?: string;
  workspaces?: string[];
}

interface LockFile {
  packages: Record<string, LockEntry>;
}

type Failure =
  | { kind: 'unapproved'; name: string; version: string; declaration: string; member: string }
  | { kind: 'changed'; name: string; version: string; from: string; to: string }
  | { kind: 'stale'; name: string; from: string; to: string }
  | { kind: 'arrived'; name: string; version: string }
  | { kind: 'departed'; name: string; version: string };

/** The arguments the gate takes. The defaults are the repository's own. */
interface Options {
  record: string;
  lockfile: string;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    record: path.join(repoRoot, 'docs', 'dependency-licences.json'),
    lockfile: path.join(repoRoot, 'package-lock.json'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === '--record' && value !== undefined) {
      options.record = path.resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--lockfile' && value !== undefined) {
      options.lockfile = path.resolve(process.cwd(), value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument ?? ''}`);
    }
  }
  return options;
}

function readJson(file: string, what: string): unknown {
  if (!fs.existsSync(file)) {
    throw new Error(`The ${what} is missing: ${file}`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `The ${what} could not be read: ${file}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * The members of an SPDX declaration. A declaration that is an expression
 * passes only if every member of it is approved, so the expression has to be
 * taken apart rather than compared whole.
 */
function licenceMembers(declaration: string): string[] {
  const parts = declaration
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length > 0);
  const members: string[] = [];
  let afterWith = false;
  for (const part of parts) {
    if (part === 'OR' || part === 'AND') continue;
    if (part === 'WITH') {
      afterWith = true;
      continue;
    }
    if (afterWith) {
      // The exception qualifies the licence before it. It is not a licence of
      // its own, and an approved licence with an exception is still that
      // licence.
      afterWith = false;
      continue;
    }
    members.push(part.endsWith('+') ? part.slice(0, -1) : part);
  }
  return members;
}

/** The licence a package declares, read from the package itself. */
function declaredLicence(lockPath: string): string | null {
  const manifest = path.join(repoRoot, lockPath, 'package.json');
  if (!fs.existsSync(manifest)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { license?: unknown };
    return typeof parsed.license === 'string' ? parsed.license : null;
  } catch {
    return null;
  }
}

/** A workspace glob such as `apps/*`, matched against a lockfile path. */
function globMatches(glob: string, candidate: string): boolean {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(candidate);
}

/**
 * The first-party workspaces are this repository's own packages. The lockfile
 * carries them twice: as the workspace roots, which the record does not have
 * by design, and as the aliases under `node_modules/@personal-os/`, which the
 * record does have. Only the workspace roots are skipped here, and they are
 * skipped by name or by the lockfile's own workspace globs — never by
 * `link: true`, because the aliases are real entries the record covers.
 */
function isWorkspaceRoot(lockPath: string, workspaces: Set<string>, globs: string[]): boolean {
  if (workspaces.has(lockPath)) return true;
  return globs.some((glob) => globMatches(glob, lockPath));
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));

  const record = readJson(options.record, 'record') as RecordFile;
  const lockfile = readJson(options.lockfile, 'lockfile') as LockFile;
  if (!Array.isArray(record.packages) || !Array.isArray(record.approvedSet?.licences)) {
    throw new Error(`The record is not shaped like a record: ${options.record}`);
  }
  if (typeof lockfile.packages !== 'object' || lockfile.packages === null) {
    throw new Error(`The lockfile has no packages map: ${options.lockfile}`);
  }

  const approved = new Map<string, string>();
  for (const licence of record.approvedSet.licences) {
    approved.set(licence.spdxId.toLowerCase(), licence.spdxId);
  }

  const recordByPath = new Map<string, RecordEntry>();
  const workspaces = new Set<string>();
  for (const entry of record.packages) {
    recordByPath.set(entry.lockPath, entry);
    if (entry.firstParty?.workspace) workspaces.add(entry.firstParty.workspace);
  }

  const lockRoot = lockfile.packages[''] ?? {};
  const globs = Array.isArray(lockRoot.workspaces) ? (lockRoot.workspaces as string[]) : [];

  const failures: Failure[] = [];
  const kinds = new Map<string, number>();
  const declared = new Set<string>();
  let compared = 0;
  let skippedWorkspaces = 0;
  let firstPartyEntries = 0;

  const checkApproved = (name: string, version: string, declaration: string): void => {
    for (const member of licenceMembers(declaration)) {
      declared.add(member);
      if (!approved.has(member.toLowerCase())) {
        failures.push({
          kind: 'unapproved',
          name,
          version,
          declaration,
          member,
        });
      }
    }
  };

  for (const [lockPath, lockEntry] of Object.entries(lockfile.packages)) {
    if (lockPath === '') continue;

    if (isWorkspaceRoot(lockPath, workspaces, globs)) {
      // One of this repository's own workspaces. The record does not carry
      // these by design, and a first-party package is not a borrowed one.
      skippedWorkspaces += 1;
      continue;
    }

    const entry = recordByPath.get(lockPath);
    if (!entry) {
      failures.push({
        kind: 'arrived',
        name: lockPath,
        version: lockEntry.version ?? '(no version)',
      });
      continue;
    }

    const kind = entry.source?.kind ?? (entry.firstParty ? 'first-party' : 'unknown');
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);

    // The set: what the installed tree declares, and what the record holds,
    // both have to be licences this project approved.
    const installed = lockEntry.license ?? null;
    if (installed !== null) checkApproved(entry.name, entry.version, installed);
    if (entry.spdxId !== null) checkApproved(entry.name, entry.version, entry.spdxId);

    if (entry.firstParty) {
      // This repository's own package, reached through its alias. There is no
      // borrowed licence to compare, and the lockfile carries no version for
      // a link.
      firstPartyEntries += 1;
      continue;
    }

    compared += 1;

    if (kind === KIND_PACKAGE_JSON_FIELD) {
      // The record read the licence out of the package's own manifest, so the
      // installed declaration is directly comparable. The lockfile's own
      // field is the same declaration as npm recorded it, so a difference
      // between the two is a licence that changed in the lockfile.
      const installed = declaredLicence(entry.lockPath);
      const locked = lockEntry.license ?? null;
      if (installed !== null && locked !== null && installed !== locked) {
        failures.push({
          kind: 'changed',
          name: entry.name,
          version: entry.version,
          from: installed,
          to: locked,
        });
      }
      const declaration = installed ?? locked;
      if (declaration === null) {
        failures.push({
          kind: 'unapproved',
          name: entry.name,
          version: entry.version,
          declaration: '(no readable licence declaration)',
          member: '(none)',
        });
        continue;
      }
      if (declaration !== entry.spdxId) {
        failures.push({
          kind: 'changed',
          name: entry.name,
          version: entry.version,
          from: entry.spdxId ?? '(none recorded)',
          to: declaration,
        });
      }
      continue;
    }

    if (kind === KIND_LICENCE_FILE || kind === KIND_PUBLISHED_IDENTIFIER) {
      // The record read the licence out of a licence file or out of a
      // registry, and a gate cannot re-read what a licence file means. So the
      // version is what is compared: if the package moved, the recorded
      // licence may be stale and the record has to be re-read.
      if (lockEntry.version === undefined) continue;
      if (lockEntry.version !== entry.version) {
        failures.push({
          kind: 'stale',
          name: entry.name,
          from: entry.version,
          to: lockEntry.version,
        });
      }
      continue;
    }

    if (entry.spdxId !== null && installed !== null && installed !== entry.spdxId) {
      failures.push({
        kind: 'changed',
        name: entry.name,
        version: entry.version,
        from: entry.spdxId,
        to: installed,
      });
    }
  }

  // The other direction: something the record holds that the lockfile no
  // longer has.
  const lockPaths = new Set(Object.keys(lockfile.packages).filter((key) => key !== ''));
  for (const entry of record.packages) {
    if (lockPaths.has(entry.lockPath)) continue;
    if (isWorkspaceRoot(entry.lockPath, workspaces, globs)) continue;
    failures.push({
      kind: 'departed',
      name: entry.name,
      version: entry.version,
    });
  }

  const out = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };

  out('The borrow-rule gate: the lockfile against the record.');
  out(`  record:      ${path.relative(repoRoot, options.record) || options.record}`);
  out(`  lockfile:    ${path.relative(repoRoot, options.lockfile) || options.lockfile}`);
  out(`  lockfile package entries (excluding the root): ${lockPaths.size}`);
  out(`  first-party workspaces skipped: ${skippedWorkspaces}`);
  out(`  first-party entries in the record (aliases, nothing borrowed): ${firstPartyEntries}`);
  out(`  packages compared: ${compared}`);
  out(`  licences read from a licence file: ${kinds.get(KIND_LICENCE_FILE) ?? 0}`);
  out(`  licences read from a package.json field: ${kinds.get(KIND_PACKAGE_JSON_FIELD) ?? 0}`);
  out(`  licences read from a published identifier: ${kinds.get(KIND_PUBLISHED_IDENTIFIER) ?? 0}`);
  out(`  distinct licences declared: ${declared.size}`);
  out(`  approved set (${approved.size}): ${[...approved.values()].sort().join(', ')}`);

  if (failures.length === 0) {
    out('The lockfile and the record agree. Every licence is one we approved.');
    process.exit(0);
  }

  out('');
  out(`${failures.length} problem(s) found:`);
  for (const failure of failures) {
    if (failure.kind === 'unapproved') {
      out(
        `  ${failure.name}@${failure.version} carries ${failure.declaration}, and ${failure.member} is not in the approved set.`,
      );
    } else if (failure.kind === 'changed') {
      out(
        `  ${failure.name}@${failure.version} changed licence: from ${failure.from} to ${failure.to} (the record and the installed package disagree).`,
      );
    } else if (failure.kind === 'stale') {
      out(
        `  ${failure.name} moved from version ${failure.from} to ${failure.to}; the recorded licence may be stale and the record has to be re-read.`,
      );
    } else if (failure.kind === 'arrived') {
      out(
        `  ${failure.name}@${failure.version} is in the lockfile and not in the record: a dependency has arrived and the record has not been re-read.`,
      );
    } else {
      out(
        `  ${failure.name}@${failure.version} is in the record and not in the lockfile: a dependency has departed and the record has not been re-read.`,
      );
    }
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
