/**
 * The migration: prose state lines become header blocks.
 *
 * This is a one-off. It is not part of the tool and it does not stay in the
 * repository — it exists to convert the item files that are not held by an
 * open dispatch, and to print the mapping it applied so the mapping can be
 * recorded in the commit that does the conversion.
 *
 *   npx tsx scripts/migrate-work-items.ts --report
 *   npx tsx scripts/migrate-work-items.ts --write
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseItem, serialiseHeader, writeItem, type WorkItemHeader } from './work-item.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDir = path.join(repoRoot, '.factory', 'work');

/** The moment the migration happened. Every converted file says so. */
const AT = '2026-10-21T16:30';

/**
 * The worktrees that exist, by item number.
 *
 * The branch and the worktree are the item's claim, and the claim is a fact
 * about the machine the item was opened on. Recording it in the header is
 * what lets `claim` print the live claims without asking git again.
 */
function worktreesByNumber(): Map<string, { branch: string; path: string }> {
  const raw = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const map = new Map<string, { branch: string; path: string }>();
  let currentPath = '';
  let currentBranch = '';

  const flush = (): void => {
    const match = /^wi\/(\d+)-/.exec(currentBranch);
    if (match?.[1]) {
      map.set(match[1], { branch: currentBranch, path: currentPath });
    }
    currentPath = '';
    currentBranch = '';
  };

  for (const line of raw.split('\n')) {
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('worktree ')) currentPath = line.slice('worktree '.length);
    if (line.startsWith('branch ')) {
      currentBranch = line.slice('branch '.length).replace('refs/heads/', '');
    }
  }
  flush();

  return map;
}

const worktrees = worktreesByNumber();

/**
 * The files that are not converted.
 *
 * Each of these has an open dispatch on the live plugin board — a task that
 * is queued, running or waiting for a reply — so a session may be writing the
 * file right now. The rule the factory already has is "one file, one live
 * item", and a conversion is an edit.
 */
const HELD = new Set([
  'WI-001',
  'WI-005',
  'WI-006',
  'WI-007',
  'WI-008',
  'WI-010',
  'WI-021',
  'WI-022',
  'WI-024',
  'WI-027',
  'WI-028',
  'WI-031',
  'WI-034',
  'WI-036',
  'WI-037',
  'WI-038',
  'WI-041',
  'WI-042',
  'WI-043',
  'WI-045',
  'WI-062',
  'WI-065',
  'WI-066',
  'WI-067',
  'WI-068',
]);

/** The owner prose that has to become a sentence again. */
const OWNER_PROSE: Record<string, string> = {
  'WI-025': 'The implementation was Wren’s — see "The implementation" below.',
  'WI-026': 'The implementation was Wren’s — see "The implementation" below.',
  'WI-069': 'The code is Cog’s; the contract half is Wren’s.',
  'WI-071': 'The code is Cog’s; the documentation half is Wren’s.',
};

/** The verifier prose that has to become a sentence again. */
const VERIFIER_PROSE: Record<string, string> = {
  'WI-029':
    'Probe cannot verify its own fix, and the verification here is a gate run, not a review of a document.',
};

/** The dependencies the item's own record names. */
const BLOCKED_BY: Record<string, string[]> = {
  'WI-017': ['WI-030'],
  'WI-020': ['WI-030'],
  'WI-033': ['WI-034'],
  'WI-040': ['WI-020', 'WI-024', 'WI-031'],
  'WI-042': ['WI-037'],
};

/**
 * The states that are not the ones the repository publishes.
 *
 * `done` is not a state. WI-030's own record says it is "done and accepted"
 * (`.factory/INTAKE.md`), and its work landed, so it is accepted.
 */
const STATE_OVERRIDES: Record<string, string> = {
  'WI-030': 'accepted',
};

interface Labelled {
  label: string;
  text: string;
  lines: string[];
  start: number;
  end: number;
}

function findLabelled(lines: string[]): Labelled[] {
  const found: Labelled[] = [];
  let i = 0;
  while (i < lines.length) {
    const match = /^\*\*([A-Za-z][A-Za-z ]*):\*\*\s*(.*)$/.exec(lines[i] ?? '');
    if (!match) {
      i += 1;
      continue;
    }
    const block: string[] = [lines[i] ?? ''];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j] ?? '';
      if (next.trim() === '') break;
      if (/^\*\*[A-Za-z][A-Za-z ]*:\*\*/.test(next)) break;
      if (/^#{1,6}\s/.test(next)) break;
      if (/^[>|]/.test(next)) break;
      if (/^[-*+]\s/.test(next)) break;
      if (/^\d+\.\s/.test(next)) break;
      if (/^```/.test(next)) break;
      block.push(next);
      j += 1;
    }
    found.push({
      label: (match[1] ?? '').trim(),
      text: block
        .map((line) => line.replace(/^\*\*[A-Za-z][A-Za-z ]*:\*\*\s*/, ''))
        .join(' ')
        .trim(),
      lines: block,
      start: i,
      end: j,
    });
    i = j;
  }
  return found;
}

const ROLE = /Chief|Cog|Probe|Wren|Vision/;

function firstRole(text: string): string | null {
  const match = ROLE.exec(text);
  return match ? match[0] : null;
}

function firstDate(text: string): { date: string; rest: string } {
  const match = /^(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\s*(.*)$/.exec(text);
  if (!match) return { date: '', rest: text };
  return { date: match[1] ?? '', rest: (match[2] ?? '').trim() };
}

/**
 * Turn the explanation that followed a date into a sentence again.
 *
 * The value moves into the header; the sentence that explains it stays in
 * the prose, because a header field has nowhere to put a reason.
 */
function dateProse(label: string, rest: string): string | null {
  if (rest === '') return null;
  const trimmed = rest.replace(/^[,;:]\s*/, '');
  if (trimmed.startsWith('—') || trimmed.startsWith('–')) return `${label} ${trimmed}`;
  if (/^by\s/.test(trimmed)) return `${label} ${trimmed}`;
  return `${label}: ${trimmed}`;
}

interface Migration {
  id: string;
  file: string;
  title: string;
  oldState: string;
  newState: string;
  oldOwner: string;
  newOwner: string | null;
  oldVerifier: string;
  newVerifier: string | null;
  header: WorkItemHeader;
  body: string;
  notes: string[];
}

function migrate(id: string): Migration | null {
  const file = path.join(workDir, `${id}.md`);
  if (!fs.existsSync(file)) return null;

  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split('\n');
  const notes: string[] = [];

  // A file that already carries a header is already migrated. The script has to
  // survive that: the tree is migrated a few files at a time, and a migration
  // that cannot be run over its own output can only ever be run once. Reading
  // the header back is also the only way to keep the state a file was given
  // after it was migrated — the prose state line is gone by then, so there is
  // nothing else to read it from.
  const parsed = parseItem(original);
  if (parsed.header) {
    const header = parsed.header;
    notes.push('already migrated');
    return {
      id,
      file,
      title: header.title,
      oldState: header.state,
      newState: header.state,
      oldOwner: header.owner ?? '',
      newOwner: header.owner,
      oldVerifier: header.verifier ?? '',
      newVerifier: header.verifier,
      header,
      body: parsed.body,
      notes,
    };
  }

  const heading = /^(#{1,2})\s+(WI-\d+)\s+—\s+(.+)$/m.exec(original);
  if (!heading) {
    notes.push('no heading');
    return null;
  }
  const title = (heading[3] ?? '').trim();

  const labelled = findLabelled(lines);
  const byLabel = new Map<string, Labelled>();
  for (const entry of labelled) {
    if (byLabel.has(entry.label)) notes.push(`the ${entry.label} line appears twice`);
    else byLabel.set(entry.label, entry);
  }

  const stateLine = byLabel.get('State');
  if (!stateLine) {
    notes.push('no state line');
    return null;
  }

  const oldState = (/^\*{0,2}([a-z-]+)/.exec(stateLine.text)?.[1] ?? '').trim();
  const newState = STATE_OVERRIDES[id] ?? oldState;

  const ownerLine = byLabel.get('Owner');
  const oldOwner = ownerLine?.text ?? '';
  const newOwner = ownerLine ? firstRole(oldOwner) : null;

  const verifierLine = byLabel.get('Verifier');
  const oldVerifier = verifierLine?.text ?? '';
  const newVerifier = verifierLine ? firstRole(oldVerifier) : null;

  // The state reason is everything the state line said after the state word.
  const reason = stateLine.text
    .replace(/^\*{0,2}[a-z-]+\*{0,2}\s*/, '')
    .replace(/^[—–,-]\s*/, '')
    .trim();

  const opened = byLabel.get('Opened');
  const numbered = byLabel.get('Numbered');
  const dispatched = byLabel.get('Dispatched');
  const landed = byLabel.get('Landed');
  const implemented = byLabel.get('Implemented');

  // The dispatch id is the last request the record names: a re-dispatch gets a
  // new id, and the old one is spent.
  const requestIds = dispatched ? [...dispatched.text.matchAll(/request(?: id)? `([^`]+)`/g)] : [];
  const dispatchId =
    requestIds.length > 0 ? (requestIds[requestIds.length - 1]?.[1] ?? null) : null;

  // The landed sha is the commit the item's own record names as the work
  // that landed — the implementation, when the record names exactly one.
  const commitsIn = (text: string): string[] =>
    [...text.matchAll(/commits? `([0-9a-f]{7,40})`/g)].map((match) => match[1] ?? '');
  const implementationCommits = implemented ? commitsIn(implemented.text) : [];
  const stateCommits = commitsIn(stateLine.text);
  const landedSha =
    implementationCommits.length === 1
      ? (implementationCommits[0] ?? null)
      : stateCommits.length === 1
        ? (stateCommits[0] ?? null)
        : null;
  const landedSource = implemented ?? stateLine;
  const landedDate = landedSha ? (/\d{4}-\d{2}-\d{2}/.exec(landedSource.text)?.[0] ?? null) : null;

  const header: WorkItemHeader = {
    id,
    title,
    state: newState,
    stateReason: reason === '' ? null : reason,
    owner: newOwner,
    verifier: newVerifier,
    opened: opened ? firstDate(opened.text).date || null : null,
    numbered: numbered ? firstDate(numbered.text).date || null : null,
    dispatched: dispatched ? firstDate(dispatched.text).date || null : null,
    dispatchId,
    landed: landed ? firstDate(landed.text).date || null : landedDate,
    landedSha,
    branch: worktrees.get(id.replace(/^WI-/i, ''))?.branch ?? null,
    worktree: worktrees.get(id.replace(/^WI-/i, ''))?.path ?? null,
    blockedBy: BLOCKED_BY[id] ?? [],
    files: [],
    history: [
      {
        at: AT,
        from: oldState,
        to: newState,
        by: 'Chief',
        note: 'migrated from the prose state line',
      },
    ],
  };

  // The body is the file with the converted lines taken out and the
  // explanations put back as prose.
  const replaced = new Map<number, string[]>();
  const removed = new Set<number>();

  const stateIndex = stateLine.start;
  removed.add(stateIndex);
  for (let i = stateLine.start + 1; i < stateLine.end; i += 1) removed.add(i);

  if (ownerLine) {
    for (let i = ownerLine.start; i < ownerLine.end; i += 1) removed.add(i);
    const prose = OWNER_PROSE[id];
    if (prose) replaced.set(ownerLine.start, [prose]);
    else if (oldOwner !== newOwner) {
      notes.push(`the owner line carries an explanation: ${oldOwner}`);
      replaced.set(ownerLine.start, [oldOwner]);
    }
  }

  if (verifierLine) {
    for (let i = verifierLine.start; i < verifierLine.end; i += 1) removed.add(i);
    const prose = VERIFIER_PROSE[id];
    if (prose) replaced.set(verifierLine.start, [prose]);
    else if (oldVerifier !== newVerifier) {
      notes.push(`the verifier line carries an explanation: ${oldVerifier}`);
      replaced.set(verifierLine.start, [oldVerifier]);
    }
  }

  for (const [label, entry] of [
    ['Opened', opened],
    ['Numbered', numbered],
    ['Dispatched', dispatched],
    ['Landed', landed],
  ] as const) {
    if (!entry) continue;
    // The first line of the block carries the date; the lines under it are
    // the rest of the sentence, and they keep their own wrapping.
    const first = (entry.lines[0] ?? '').replace(/^\*\*[A-Za-z][A-Za-z ]*:\*\*\s*/, '');
    const { rest } = firstDate(first);
    const prose = dateProse(label, rest);
    removed.add(entry.start);
    if (prose) replaced.set(entry.start, [prose]);
  }

  const bodyLines: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (removed.has(i)) {
      const replacement = replaced.get(i);
      if (replacement) bodyLines.push(...replacement);
      continue;
    }
    bodyLines.push(lines[i] ?? '');
  }

  // The front matter goes above the prose, and the prose keeps a blank line
  // under it — which is what the formatter wants between the two. The blank
  // lines left behind by the lines that were taken out are collapsed, because
  // the formatter collapses them too.
  let body = bodyLines.join('\n');
  body = `\n${body.replace(/^\n+/, '')}`.replace(/\n{3,}/g, '\n\n');

  return {
    id,
    file,
    title,
    oldState,
    newState,
    oldOwner,
    newOwner,
    oldVerifier,
    newVerifier,
    header,
    body,
    notes,
  };
}

const write = process.argv.includes('--write');
const report = process.argv.includes('--report');
if (!write && !report) {
  process.stderr.write('Usage: npx tsx scripts/migrate-work-items.ts --report | --write\n');
  process.exit(1);
}

const ids = fs
  .readdirSync(workDir)
  .filter((name) => /^WI-\d+\.md$/.test(name))
  .map((name) => name.replace(/\.md$/, ''))
  .sort();

const results: Migration[] = [];
const held: string[] = [];
const unreadable: string[] = [];

for (const id of ids) {
  if (HELD.has(id)) {
    held.push(id);
    continue;
  }
  const migration = migrate(id);
  if (!migration) {
    // A file the migration cannot read is reported, not fatal. The tree is
    // migrated a few files at a time and the newer item files do not all
    // carry the prose lines this script reads, so stopping at the first one
    // would hide every file after it — and a migration that reports only the
    // first thing it could not do is a worse record than one that lists them
    // all.
    unreadable.push(id);
    continue;
  }
  results.push(migration);
}

process.stdout.write(`Converted: ${results.length}. Held by an open dispatch: ${held.length}.\n`);
process.stdout.write(`Held: ${held.join(', ')}\n\n`);

if (unreadable.length > 0) {
  process.stdout.write(
    `Not read (${unreadable.length}): ${unreadable.join(', ')} — these files carry no prose state line, so the state has to come from somewhere else.\n\n`,
  );
}

process.stdout.write(
  '| item | old state | new state | old owner | new owner | old verifier | new verifier |\n',
);
process.stdout.write('| --- | --- | --- | --- | --- | --- | --- |\n');
for (const migration of results) {
  process.stdout.write(
    `| ${migration.id} | ${migration.oldState} | ${migration.newState} | ${migration.oldOwner} | ${migration.newOwner ?? 'null'} | ${migration.oldVerifier || '—'} | ${migration.newVerifier ?? 'null'} |\n`,
  );
}

const withNotes = results.filter((migration) => migration.notes.length > 0);
if (withNotes.length > 0) {
  process.stdout.write('\nNotes:\n');
  for (const migration of withNotes) {
    for (const note of migration.notes) process.stdout.write(`  ${migration.id}: ${note}\n`);
  }
}

if (write) {
  for (const migration of results) {
    fs.writeFileSync(migration.file, writeItem(migration.header, migration.body), 'utf8');
  }
  process.stdout.write(`\nWrote ${results.length} item files.\n`);
}
