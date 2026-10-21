/**
 * The generator and the validator, tested where they are used.
 *
 * The tool is `scripts/work-item.ts`, and these tests reach into it rather
 * than around it: the index is generated from the item files, the validator
 * reads the same index, and the state machine refuses the transitions the
 * table does not have. A test that ran the tool from the outside would prove
 * the same things, but it would be slow and it would have to parse a table
 * meant for a person.
 *
 * The fixtures are built in a temporary directory, because the claims these
 * tests check for — two live items on one file, one number on two item files
 * — are exactly what the repository does not have yet. A validator that is
 * only ever run against a clean tree has never been run against a dirty one.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TRANSITIONS,
  applyStateChange,
  buildQueue,
  checkQueue,
  checkStateChange,
  emptyHeader,
  parseItem,
  renderQueue,
  transitionFor,
  writeItem,
  type WorkItemHeader,
} from '../work-item.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const temporaries: string[] = [];

afterEach(() => {
  while (temporaries.length > 0) {
    const dir = temporaries.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A temporary directory that is cleaned up after the test. */
function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-item-'));
  temporaries.push(dir);
  return dir;
}

function writeItemFile(root: string, id: string, header: WorkItemHeader): void {
  const dir = path.join(root, '.factory', 'work');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${id}.md`),
    writeItem(header, `\n# ${id} — ${header.title}\n`),
    'utf8',
  );
}

function headerFor(
  id: string,
  state: string,
  owner: string | null,
  files: string[] = [],
): WorkItemHeader {
  const header = emptyHeader(id, `Item ${id}`);
  header.state = state;
  header.owner = owner;
  header.files = files;
  return header;
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

describe('the queue index', () => {
  it("reads the state and the owner from the item file's own header", () => {
    const entries = buildQueue(repoRoot);
    const converted = entries.filter((entry) => entry.blockedReason === null);
    expect(converted.length).toBeGreaterThan(0);

    for (const entry of converted) {
      const parsed = parseItem(fs.readFileSync(path.join(repoRoot, entry.file), 'utf8'));
      expect(parsed.header).not.toBeNull();
      expect(entry.state).toBe(parsed.header?.state);
      expect(entry.owner).toBe(parsed.header?.owner);
      expect(entry.title).toBe(parsed.header?.title);
    }
  });

  it('reads WI-030 as accepted rather than as an unknown state', () => {
    const entry = buildQueue(repoRoot).find((item) => item.id === 'WI-030');
    expect(entry).toBeDefined();
    expect(entry?.state).toBe('accepted');
    expect(entry?.state).not.toBe('unknown');
  });

  it('regenerates the same bytes on a second run', () => {
    expect(renderQueue(buildQueue(repoRoot))).toBe(renderQueue(buildQueue(repoRoot)));
  });

  it('shows an item that has not been migrated with a reason rather than hiding it', () => {
    const unmigrated = buildQueue(repoRoot).filter((entry) => entry.blockedReason !== null);
    expect(unmigrated.length).toBeGreaterThan(0);

    for (const entry of unmigrated) {
      expect(entry.blockedReason).toBeTruthy();
      expect(entry.state).toBeNull();
    }
  });

  it('agrees with the list, for every item', () => {
    const listed = execFileSync(
      process.execPath,
      ['--import', 'tsx', path.join(repoRoot, 'scripts', 'work-item.ts'), 'list'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    const fromList = new Map<string, string>();
    for (const line of listed.split('\n')) {
      const match = /^\s+(WI-\d+)\s+(\S+)/.exec(line);
      if (match?.[1] && match[2]) fromList.set(match[1], match[2]);
    }

    const fromIndex = new Map<string, string>(
      buildQueue(repoRoot).map((entry) => [entry.id, entry.state ?? 'not-migrated']),
    );

    expect(fromList.size).toBe(fromIndex.size);
    for (const [id, state] of fromIndex) {
      expect(fromList.get(id)).toBe(state);
    }
  });
});

describe('the validator', () => {
  it('finds two live items that claim the same file', () => {
    const root = temporaryDirectory();
    writeItemFile(
      root,
      'WI-001',
      headerFor('WI-001', 'implement', 'Cog', ['apps/server/src/app.ts']),
    );
    writeItemFile(
      root,
      'WI-002',
      headerFor('WI-002', 'implement', 'Wren', ['apps/server/src/app.ts']),
    );

    expect(checkQueue(root).some((finding) => finding.kind === 'file-claim')).toBe(true);
  });

  it('finds one role owning two live items that claim the same file', () => {
    const root = temporaryDirectory();
    writeItemFile(
      root,
      'WI-001',
      headerFor('WI-001', 'implement', 'Cog', ['apps/server/src/app.ts']),
    );
    writeItemFile(
      root,
      'WI-002',
      headerFor('WI-002', 'implement', 'Cog', ['apps/server/src/app.ts']),
    );

    expect(checkQueue(root).some((finding) => finding.kind === 'owner-claim')).toBe(true);
  });

  it('does not find a claim between an item that is closed and one that is live', () => {
    const root = temporaryDirectory();
    writeItemFile(
      root,
      'WI-001',
      headerFor('WI-001', 'accepted', 'Cog', ['apps/server/src/app.ts']),
    );
    writeItemFile(
      root,
      'WI-002',
      headerFor('WI-002', 'implement', 'Wren', ['apps/server/src/app.ts']),
    );

    expect(checkQueue(root).some((finding) => finding.kind === 'file-claim')).toBe(false);
  });

  it('finds one number on two item files, on any ref', () => {
    const root = temporaryDirectory();
    git(root, ['init', '-b', 'main']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'user.name', 'Test']);

    writeItemFile(root, 'WI-001', headerFor('WI-001', 'implement', 'Cog'));
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'first']);

    // A second branch files a different item under a number that is taken.
    git(root, ['checkout', '-b', 'other']);
    const header = headerFor('WI-002', 'implement', 'Cog');
    header.id = 'WI-001';
    writeItemFile(root, 'WI-002', header);
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'second']);

    expect(checkQueue(root).some((finding) => finding.kind === 'number-space')).toBe(true);
  });
});

describe('the state machine', () => {
  it('refuses a transition the table does not have', () => {
    expect(transitionFor('implement', 'accepted')).toBeNull();
    expect(transitionFor('triage', 'review')).toBeNull();
    expect(transitionFor('implement', 'verify')).not.toBeNull();
  });

  it('makes implement to verify the only automatic transition', () => {
    const automatic = TRANSITIONS.filter((rule) => rule.automatic);
    expect(automatic).toHaveLength(1);
    expect(automatic[0]?.from).toBe('implement');
    expect(automatic[0]?.to).toBe('verify');
  });

  it('refuses an acceptance that has no review behind it', () => {
    const header = headerFor('WI-001', 'review', 'Chief');
    expect(checkStateChange(header, 'accepted', 'Chief')).toContain('review');
  });

  it('refuses a transition the wrong role claims', () => {
    const header = headerFor('WI-001', 'verify', 'Cog');
    expect(checkStateChange(header, 'review', 'Cog')).toContain('Probe');
  });

  it('appends a transition to the history', () => {
    const header = headerFor('WI-001', 'verify', 'Cog');
    applyStateChange(header, 'review', 'Probe');

    expect(header.state).toBe('review');
    expect(header.history).toHaveLength(1);
    expect(header.history[0]?.from).toBe('verify');
    expect(header.history[0]?.to).toBe('review');
  });
});
