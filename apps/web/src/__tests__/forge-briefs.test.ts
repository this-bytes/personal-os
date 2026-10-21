/**
 * The Forge briefs are WI-024's deliverable, and this file is the pin that
 * holds them to it.
 *
 * WI-024 (`.factory/work/WI-024.md`) delivers six briefs under
 * `prototypes/briefs/`. The code they describe is a later item, so the only
 * thing a test can hold today is the briefs themselves: that they exist, that
 * the index indexes them, that each one says what it changes, what it
 * preserves, who owns it and when it lands, that the rule they quote is the
 * rule in `prototypes/DIRECTION.md`, and that the palette numbers they publish
 * are the tree's numbers rather than the direction document's.
 *
 * Probe owns the test files (the `*.test.ts` ones). This is not a test of the
 * panel. It is
 * the test that would have caught the briefs going missing, drifting apart, or
 * quoting a rule the direction document no longer holds — and the last of
 * those has already happened once, which is why the boundary rule is compared
 * against the document rather than against a copy of itself.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const briefsDir = path.join(repoRoot, 'prototypes', 'briefs');
const directionPath = path.join(repoRoot, 'prototypes', 'DIRECTION.md');

const BRIEF_FILES = [
  '01-rooms-and-surfaces.md',
  '02-material.md',
  '03-execution-trace.md',
  '04-dashboards.md',
  '05-needs-you-rail.md',
  '06-constellation-and-hues.md',
] as const;

type BriefFile = (typeof BRIEF_FILES)[number];

/** The order the briefs land in, in words, because the briefs say it in words. */
const LANDING_ORDER: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  last: 6,
};

const read = (file: string): string => readFileSync(file, 'utf8');
const readBrief = (file: BriefFile): string => read(path.join(briefsDir, file));

/** A sentence that spans lines is one sentence: whitespace is not a difference. */
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * A git command that reports instead of throwing. `git grep` exits non-zero
 * when a token is absent, and an absent token is a number in the briefs'
 * table — zero — not a failure. Any other non-zero exit (a commit the
 * checkout does not have, which is every CI clone, since CI checks out with
 * the default depth of one) is reported so the caller can skip rather than
 * fail on a shallow clone.
 */
function gitOutput(args: string[]): { ok: boolean; text: string } {
  try {
    const text = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, text };
  } catch (error) {
    const status = (error as { status?: number }).status;
    return { ok: status === 1, text: '' };
  }
}

/** True when the checkout has the commit. CI's shallow clone does not. */
function hasCommit(ref: string): boolean {
  return gitOutput(['rev-parse', '--verify', `${ref}^{commit}`]).ok;
}

interface PaletteCounts {
  lines: number;
  files: number;
  occurrences: number;
}

/**
 * The briefs' own method, reproduced: `git grep -c` for the lines and the
 * files, `git grep -o` for the occurrences. Lines and occurrences are different
 * numbers, and the direction document's own headline figure conflated them.
 */
function paletteAt(ref: string, token: string): PaletteCounts | null {
  const counted = gitOutput([
    'grep',
    '-c',
    '-F',
    token,
    ref,
    '--',
    'apps/web/src',
    'packages/ui/src',
  ]);
  if (!counted.ok) return null;

  let lines = 0;
  let files = 0;
  for (const row of counted.text.split('\n')) {
    const match = /:(\d+)$/.exec(row);
    if (!match) continue;
    lines += Number(match[1]);
    files += 1;
  }

  const each = gitOutput(['grep', '-o', '-F', token, ref, '--', 'apps/web/src', 'packages/ui/src']);
  if (!each.ok) return null;

  const occurrences = each.text.split('\n').filter((row) => row.length > 0).length;
  return { lines, files, occurrences };
}

/** The amber usages in the tree at a commit: how many, in how many files. */
function amberAt(ref: string): { total: number; files: number } | null {
  const out = gitOutput([
    'grep',
    '-n',
    '-F',
    'amber-',
    ref,
    '--',
    'apps/web/src',
    'packages/ui/src',
  ]);
  if (!out.ok) return null;
  // `git grep <ref>` prefixes every row with the ref it searched.
  const rows = out.text
    .split('\n')
    .filter((row) => row.length > 0)
    .map((row) => (row.startsWith(`${ref}:`) ? row.slice(ref.length + 1) : row));
  const files = new Set(rows.map((row) => row.split(':')[0] ?? ''));
  return { total: rows.length, files: files.size };
}

interface PaletteRow {
  token: string;
  lines: number;
  files: number;
  occurrences: number;
}

/** The palette table, as the briefs publish it. */
function parsePalette(markdown: string): Map<string, PaletteRow> {
  const rows = new Map<string, PaletteRow>();
  const pattern = /^\|\s*`([a-z]+-)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm;
  let match = pattern.exec(markdown);
  while (match !== null) {
    const token = match[1];
    if (token !== undefined) {
      rows.set(token, {
        token,
        lines: Number(match[2]),
        files: Number(match[3]),
        occurrences: Number(match[4]),
      });
    }
    match = pattern.exec(markdown);
  }
  return rows;
}

/** The rows of the table whose header row contains the given cell. */
function tableUnder(markdown: string, headerNeedle: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith('|') && line.includes(headerNeedle));
  if (start < 0) return [];
  const rows: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !line.startsWith('|')) break;
    // The separator row under a markdown table header is not a row.
    if (/^\|\s*-{2,}/.test(line)) continue;
    rows.push(line);
  }
  return rows;
}

/** The file a brief's short name stands for, found in the tree rather than assumed. */
function resolveSource(basename: string): string | null {
  const roots = [
    path.join(repoRoot, 'apps', 'web', 'src'),
    path.join(repoRoot, 'packages', 'ui', 'src'),
  ];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (path.basename(full) === basename) {
        found.push(full);
      }
    }
  };
  for (const root of roots) walk(root);
  return found.length === 1 ? (found[0] ?? null) : null;
}

const index = read(path.join(briefsDir, 'README.md'));
const direction = read(directionPath);
const briefs = new Map<BriefFile, string>(BRIEF_FILES.map((file) => [file, readBrief(file)]));

/** The commit the index says the numbers were measured at. */
const measuredAt = /\*\*Written against:\*\* commit `([0-9a-f]{7,40})`/.exec(index)?.[1] ?? null;
const measuredCommitReachable = measuredAt !== null && hasCommit(measuredAt);

describe('the six Forge briefs', () => {
  it('exist, and each one says what it changes, what it preserves, who owns it and when it lands', () => {
    for (const file of BRIEF_FILES) {
      const body = briefs.get(file) ?? '';
      expect(body.length, `${file} is empty`).toBeGreaterThan(0);
      expect(body, `${file} does not say what it changes`).toContain('## What it changes');
      expect(body, `${file} does not say what it preserves`).toContain('## What it preserves');
      expect(body, `${file} has no owner`).toMatch(/\*\*Owner:\*\*\s*\S/);
      expect(body, `${file} does not say when it lands`).toMatch(
        /\*\*Lands (first|second|third|fourth|fifth|last)\.?\*\*/,
      );
      expect(body, `${file} has no acceptance criteria`).toContain('## Acceptance criteria');
      expect(body, `${file} has no gates`).toContain('## Gates');
    }
  });

  it('are all indexed, and the index agrees with each brief about piece, order and owner', () => {
    for (const file of BRIEF_FILES) {
      const body = briefs.get(file) ?? '';
      const link = `[${file.slice(0, 2)}`; // the index links each brief by number
      const row = index.split('\n').find((line) => line.includes(`](${file})`));
      expect(row, `the index does not index ${file}`).toBeDefined();

      const lands = /\*\*Lands (first|second|third|fourth|fifth|last)\.?\*\*/.exec(body)?.[1];
      const owner = /\*\*Owner:\*\*\s*([^\s.]+)/.exec(body)?.[1];
      const piece = /item's pieces? (\d+)/.exec(body)?.[1];
      expect(lands, `${file} does not name its landing order`).toBeDefined();
      expect(owner, `${file} does not name its owner`).toBeDefined();
      expect(piece, `${file} does not name its piece`).toBeDefined();

      const rowLands = /\|\s*(\d+)\s*\|\s*([A-Za-z ]+)\s*\|/.exec(row ?? '')?.[1];
      const rowOwner = /\|\s*([A-Za-z ]+)\s*\|\s*$/.exec(row ?? '')?.[1]?.trim();
      expect(Number(rowLands), `${file}'s landing order disagrees with the index`).toBe(
        LANDING_ORDER[lands ?? ''],
      );
      expect(rowOwner, `${file}'s owner disagrees with the index`).toBe(owner);
      expect(index.indexOf(link), `the index does not number ${file}`).toBeGreaterThan(-1);
    }
  });

  it('name the piece each one is, and no two briefs claim the same piece', () => {
    const pieces = BRIEF_FILES.map((file) => {
      const piece = /item's pieces? (\d+)/.exec(briefs.get(file) ?? '')?.[1];
      expect(piece, `${file} does not name its piece`).toBeDefined();
      return Number(piece);
    });
    expect(new Set(pieces).size).toBe(BRIEF_FILES.length);
  });
});

describe('the boundary rule', () => {
  it('is the rule in DIRECTION.md, exception included, and the briefs quote it with the exception', () => {
    // The load-bearing phrase. The flat rule — the one without this clause —
    // is what two of the briefs quoted before the lead settled the landing
    // page's premise, and it is the one thing a document quoting itself
    // cannot catch.
    const exception = 'one declared exception, the Needs-you rail';
    expect(flat(direction)).toContain(exception);

    for (const file of ['01-rooms-and-surfaces.md', '05-needs-you-rail.md'] as const) {
      const body = flat(briefs.get(file) ?? '');
      expect(body, `${file} does not carry the rule's declared exception`).toContain(exception);
      expect(body, `${file} does not carry the rule's first half`).toContain(
        'picture of the system',
      );
      expect(body, `${file} does not carry the rule's second half`).toContain(
        'inspected or decided',
      );
    }
  });

  it('carries the reason the exception exists, in the brief that states the rule in full', () => {
    expect(flat(direction)).toContain(
      'which carries decisions in the orientation room because a decision is taken where the list is',
    );
    expect(flat(briefs.get('05-needs-you-rail.md') ?? '')).toContain(
      'which carries decisions in the orientation room because a decision is taken where the list is',
    );
  });

  it('puts every surface in the room the direction document puts it in', () => {
    // The document's own table, and the brief's table, must agree on the
    // surfaces the document names.
    const rooms: ReadonlyArray<readonly [string, string]> = [
      ['The constellation (the map)', 'Orientation'],
      ['The agent list', 'Orientation'],
      ['The factory board', 'Execution'],
      ['The automation runs', 'Execution'],
      ['The dashboards', 'Orientation'],
    ];
    const briefBody = briefs.get('01-rooms-and-surfaces.md') ?? '';
    for (const [surface, room] of rooms) {
      expect(flat(direction)).toContain(`${surface} | ${room}`);
      const row = briefBody.split('\n').find((line) => line.startsWith(`| ${surface}`));
      expect(row, `brief 01 does not place "${surface}"`).toBeDefined();
      expect(row, `brief 01 puts "${surface}" in the wrong room`).toContain(`| ${room} |`);
    }
  });
});

describe('the two rules that travel with the direction', () => {
  it('travels: one accent with one meaning', () => {
    expect(flat(direction)).toContain('amber always means live or waiting on you');
    expect(flat(briefs.get('02-material.md') ?? '')).toContain(
      'amber always means live or waiting on you',
    );
  });

  it('travels: no ratio whose denominator is zero', () => {
    expect(flat(direction)).toContain('No ratio whose denominator is zero');
    const brief01 = flat(briefs.get('01-rooms-and-surfaces.md') ?? '');
    expect(brief01).toContain('no ratio whose denominator is zero');
    expect(brief01).toContain('N features, M operations');
    expect(flat(briefs.get('02-material.md') ?? '')).toContain(
      'a ratio only where there is a denominator to divide by',
    );
  });
});

describe('the connect decision', () => {
  it('has a home: the brief says which way it goes, and why', () => {
    const brief06 = flat(briefs.get('06-constellation-and-hues.md') ?? '');
    expect(brief06).toContain('the constellation carries the connect decision in place');
    expect(brief06, 'the rejected alternative is not on the record').toContain('was rejected');
    expect(brief06).toContain('a decision is taken where the list is');
  });
});

describe('the palette numbers', () => {
  it('are published in one table, and the index and brief 02 agree on it', () => {
    const fromIndex = parsePalette(index);
    const fromBrief = parsePalette(briefs.get('02-material.md') ?? '');
    expect(fromIndex.size).toBeGreaterThan(0);
    expect([...fromIndex.keys()].sort()).toEqual([...fromBrief.keys()].sort());
    for (const [token, row] of fromIndex) {
      expect(fromBrief.get(token), `${token} differs between the index and brief 02`).toEqual(row);
    }
  });

  it.skipIf(!measuredCommitReachable)(
    "are the tree's numbers at the commit they were measured at, not the document's",
    () => {
      const published = parsePalette(index);
      expect(published.size).toBeGreaterThan(0);
      for (const [token, row] of published) {
        const measured = paletteAt(measuredAt as string, token);
        expect(measured, `${token} could not be measured at ${measuredAt ?? ''}`).not.toBeNull();
        const counts = measured as PaletteCounts;
        expect(counts.lines, `${token} lines`).toBe(row.lines);
        expect(counts.files, `${token} files`).toBe(row.files);
        expect(counts.occurrences, `${token} occurrences`).toBe(row.occurrences);
      }
    },
  );
});

describe('the amber collision', () => {
  it('names ten usages across six files, and every one of them still holds amber', () => {
    const rows = tableUnder(briefs.get('02-material.md') ?? '', 'What it says today');
    expect(rows.length).toBeGreaterThan(0);

    let lines = 0;
    const files = new Set<string>();
    for (const row of rows) {
      const site = /^\|\s*`([^`]+)`\s*\|/.exec(row)?.[1];
      expect(site, `brief 02 has a site this test cannot read: ${row}`).toBeDefined();
      const split = (site as string).split(':');
      // Brief 02 names its sites by file name, and the shared package by its
      // path: resolve them against the tree either way.
      const raw = split[0] ?? '';
      const basename = raw.split('/').pop() ?? raw;
      const range = split[1] ?? '';
      const source = resolveSource(basename);
      expect(source, `the tree has no ${basename}`).not.toBeNull();
      files.add(basename);

      const sourceLines = read(source as string).split('\n');
      const numbers = range.includes('-')
        ? range.split('-').map((part) => Number(part))
        : [Number(range)];
      for (const number of numbers) {
        lines += 1;
        const line = sourceLines[number - 1] ?? '';
        expect(line, `${basename}:${number} no longer holds amber`).toContain('amber-');
      }
    }

    expect(lines, 'brief 02 names ten amber lines').toBe(10);
    expect(files.size, 'the amber collision is across six files').toBe(6);
  });

  it.skipIf(!measuredCommitReachable)(
    'is the whole collision: the tree had ten amber lines across six files when it was measured',
    () => {
      const measured = amberAt(measuredAt as string);
      expect(measured, `the tree could not be measured at ${measuredAt ?? ''}`).not.toBeNull();
      const counts = measured as { total: number; files: number };
      expect(counts.total).toBe(10);
      expect(counts.files).toBe(6);
    },
  );
});

describe('what WI-024 changed', () => {
  it.skipIf(!hasCommit('93ef99b') || !hasCommit('a5042aa'))(
    'touched nothing outside the briefs',
    () => {
      for (const commit of ['93ef99b', 'a5042aa']) {
        const out = gitOutput(['show', '--name-only', '--format=', commit]);
        expect(out.ok, `the checkout does not have ${commit}`).toBe(true);
        const files = out.text.split('\n').filter((line) => line.length > 0);
        expect(files.length, `${commit} changed nothing`).toBeGreaterThan(0);
        for (const file of files) {
          expect(file, `${commit} changed ${file}, which is outside the briefs`).toMatch(
            /^prototypes\/briefs\//,
          );
        }
      }
    },
  );
});
