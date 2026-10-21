/**
 * The approval evidence note's pointers carry their claims.
 *
 * `CONTRACTS.md` cites the code by line number, and the contract pointer gate
 * holds those citations to pointing at *code* — a line that is not blank and
 * not a comment. It cannot tell a citation that points at the wrong code from
 * one that points at the right code. `apps/server/src/app.ts:225` holds code
 * whether it is the registration or a line three lines away from it, and the
 * gate is content with either.
 *
 * That gap is the one WI-086's note stands in. The note names the route, the
 * registration and the published shape, and each of the three line numbers has
 * to point at the line that carries that claim. Nothing in the tree checks it,
 * so a line that moves under a citation leaves the note making a claim about
 * code nobody is looking at, and the contract still says it is implemented.
 *
 * The pin holds each of the three to its claim, and it holds itself to
 * failing: the second test points the check at a copy of the tree whose
 * citation has drifted, and holds the check to catching it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The three citations the note makes, and what each cited line has to carry. */
const CLAIMS = [
  { path: 'apps/server/src/api/approvals.ts', carries: '/api/approvals/:id/evidence' },
  { path: 'apps/server/src/app.ts', carries: 'registerApprovalRoutes(app)' },
  { path: 'packages/contracts/src/approvals.ts', carries: 'export const approvalEvidenceSchema' },
];

/** A citation of a TypeScript file: a path, and a line. */
const CITATION = /([^\s`]+?\.tsx?):(\d+)/g;

/** One citation of the note, and whether the line it names carries its claim. */
export interface Carrier {
  /** The path the note cites. */
  path: string;
  /** The line the note cites. */
  cited: number;
  /** What the cited line has to carry. */
  carries: string;
  /** What the cited line holds. */
  found: string | null;
  /** Whether the cited line carries the claim. */
  ok: boolean;
}

/** The line of a file, or null when the file is not there or the line is not. */
function readLine(root: string, relative: string, line: number): string | null {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  return lines[line - 1] ?? null;
}

/**
 * Every claim of the note, and whether the line it cites carries it.
 *
 * The note is found by the citation of the route, and the note is the
 * paragraph that citation sits in. The whole contract is not searched: the
 * contract cites `apps/server/src/app.ts` elsewhere, for other claims, and
 * those citations carry other things.
 */
export function checkNote(root: string, contract: string): Carrier[] {
  const lines = contract.split('\n');
  const anchor = lines.findIndex((line) => line.includes('apps/server/src/api/approvals.ts:'));
  if (anchor < 0) return [];

  let first = anchor;
  while (first > 0 && lines[first - 1]!.trim() !== '') first -= 1;
  let last = anchor;
  while (last < lines.length - 1 && lines[last + 1]!.trim() !== '') last += 1;

  const cited = new Map<string, number>();
  for (let index = first; index <= last; index += 1) {
    for (const match of lines[index]!.matchAll(CITATION)) {
      const citedPath = match[1];
      const citedLine = Number.parseInt(match[2] ?? '', 10);
      if (citedPath !== undefined && !cited.has(citedPath)) {
        cited.set(citedPath, citedLine);
      }
    }
  }

  return CLAIMS.map((claim) => {
    const citedLine = cited.get(claim.path) ?? 0;
    const found = citedLine > 0 ? readLine(root, claim.path, citedLine) : null;
    return {
      path: claim.path,
      cited: citedLine,
      carries: claim.carries,
      found,
      ok: found !== null && found.includes(claim.carries),
    };
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
      // not a failure of the pin: the assertions above have already run.
    }
  }
});

/** A copy of a file of this repository, in a tree of its own. */
function copyInto(root: string, relative: string): void {
  const to = path.join(root, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, relative), to);
}

describe('the approval evidence note', () => {
  it('cites three lines, and each of them carries the claim it names', () => {
    const contract = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');

    const carriers = checkNote(repoRoot, contract);

    expect(carriers.map((carrier) => carrier.path)).toEqual(CLAIMS.map((claim) => claim.path));
    for (const carrier of carriers) {
      expect(
        carrier.ok,
        `${carrier.path}:${carrier.cited} holds "${carrier.found ?? 'nothing'}" and not "${carrier.carries}"`,
      ).toBe(true);
    }
  });

  it('catches a citation that has drifted off the claim it names', () => {
    // The route is cited one line lower than it is. The cited line still holds
    // code, so the contract pointer gate is content with it, and the note has
    // stopped naming the route.
    const root = scratch('approval-evidence-note-');
    for (const claim of CLAIMS) copyInto(root, claim.path);
    const contract = fs
      .readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8')
      .replace('apps/server/src/api/approvals.ts:37', 'apps/server/src/api/approvals.ts:38');

    const carriers = checkNote(root, contract);

    const route = carriers.find((carrier) => carrier.path === 'apps/server/src/api/approvals.ts');
    expect(route?.cited).toBe(38);
    expect(route?.ok).toBe(false);
    // The other two citations still carry their claims: the drift is the one
    // the note made, and nothing else moved.
    expect(carriers.filter((carrier) => carrier.ok)).toHaveLength(2);
  });

  it('catches a note that drops one of its citations', () => {
    // The note stops naming the published shape. The claim is still in the
    // contract and the shape is still in the tree, but the note no longer
    // says where the shape lives.
    const root = scratch('approval-evidence-note-missing-');
    for (const claim of CLAIMS) copyInto(root, claim.path);
    const contract = fs
      .readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8')
      .replace('packages/contracts/src/approvals.ts:55', 'packages/contracts/src/approvals.ts');

    const carriers = checkNote(root, contract);

    const shape = carriers.find(
      (carrier) => carrier.path === 'packages/contracts/src/approvals.ts',
    );
    expect(shape?.ok).toBe(false);
  });
});
