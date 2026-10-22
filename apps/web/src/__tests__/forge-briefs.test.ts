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
 *
 * One pin in here has been re-stated, and it is worth saying why.
 *
 * Brief 02's amber table published ten lines across six files and said
 * "Measured at `d343300`". That is a true record and the brief is not
 * edited. But the pin over it asserted that the **live tree** still held
 * amber at each cited line, and the rule brief 02 itself prescribed — its
 * own "Under Forge" column — has since been carried out: WI-071's accent
 * work took the amber off eight of the ten sites and split the ninth.
 * `docs/panel-accent.md` is the inventory that replaced the table.
 *
 * So the pin now holds the rule that is in force. The ten sites brief 02
 * names are the sites the accent rule claims, none of them holds amber
 * again, the split the brief prescribed is still a split, and the two
 * notices the brief called failures wear the error colour.
 *
 * The accent guard (`apps/web/src/__tests__/accentGuard.test.tsx`) is the
 * other half of this. It scans every component and every shared primitive
 * and fails if amber appears anywhere outside the token layer. A blanket
 * scan cannot say *which* sites the rule claims, cannot say that the
 * accent has to be *somewhere*, and cannot say what a caution became.
 * Those are the things this file holds.
 *
 * Two pins in here have been re-stated, and they are worth saying why.
 *
 * **The amber pin.** Brief 02's amber table published ten lines across six
 * files and said "Measured at `d343300`". That is a true record and the brief
 * is not edited. But the pin over it asserted that the **live tree** still
 * held amber at each cited line, and the rule brief 02 itself prescribed —
 * its own "Under Forge" column — has since been carried out: WI-071's
 * accent work took the amber off eight of the ten sites and split the
 * ninth. `docs/panel-accent.md` is the inventory that replaced the table.
 *
 * So the pin now holds the rule that is in force. The ten sites brief 02
 * names are the sites the accent rule claims, none of them holds amber
 * again, the split the brief prescribed is still a split, and the two
 * notices the brief called failures wear the error colour.
 *
 * **The boundary-rule pin.** The rule's exception clause used to be written
 * out here, as the phrase "one declared exception, the Needs-you rail". The
 * phrase was a proxy for the clause itself, and the proxy is what went
 * stale when the lead amended the rule and gave it a second crossing. The
 * clause is read out of `prototypes/DIRECTION.md` now — read once, and
 * never written down here — and the document, briefs 01 and 05, the index
 * and the strategy record are all held to it. A copy of a rule with no keeper
 * goes stale the way every other copy has, so every copy is held to the
 * document's.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const webRoot = path.resolve(here, '..', '..');
const briefsDir = path.join(repoRoot, 'prototypes', 'briefs');
const directionPath = path.join(repoRoot, 'prototypes', 'DIRECTION.md');

/**
 * The inventory that replaced brief 02's amber table.
 *
 * WI-071's accent work carried out the "Under Forge" column of that table,
 * and `docs/panel-accent.md` is where the rule now lives. The brief is the
 * direction's record of what the tree held at `d343300`; this file is where
 * the rule that replaced it is kept.
 */
const ACCENT_INVENTORY = path.join(repoRoot, 'docs', 'panel-accent.md');

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
 * A containment check that fails readably.
 *
 * Vitest prints the whole received value when a `toContain` fails, and the
 * direction document is fifteen thousand characters long. A failure nobody
 * can read is a failure nobody acts on, so the check asks a question whose
 * answer is one word, and the message says which copy and which words.
 */
function carries(where: string, body: string, needle: string): void {
  expect(body.includes(needle), `${where} does not carry ${JSON.stringify(needle)}`).toBe(true);
}

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

/** A site an amber table names: a file, and the lines in it. */
interface AmberSite {
  /** The site as the record writes it, e.g. `TaskBoard.tsx:293-294`. */
  cited: string;
  /** The file that holds it, resolved against the tree. */
  file: string;
  /** The lines the record cites, 1-based. */
  lines: number[];
}

/**
 * A site, read out of one row of an amber table.
 *
 * Brief 02's table and `docs/panel-accent.md`'s inventory name a site the
 * same way — a file and a line, or a line range — and the two records spell
 * the file differently. The file is resolved against the tree rather than
 * assumed, so a site naming a file the tree does not have fails here
 * instead of passing on a name.
 */
function amberSite(row: string, label: string): AmberSite {
  const cited = /^\|\s*`([^`]+)`\s*\|/.exec(row)?.[1];
  expect(cited, `${label} has a site this test cannot read: ${row}`).toBeDefined();
  const [raw = '', range = ''] = (cited as string).split(':');
  const lines = range.includes('-')
    ? range.split('-').map((part) => Number(part))
    : [Number(range)];
  const basename = raw.split('/').pop() ?? raw;
  const file = resolveSource(basename);
  expect(file, `the tree has no ${basename}`).not.toBeNull();
  return { cited: cited as string, file: file as string, lines };
}

/**
 * The identity of a site, so two records that spell it differently can be
 * compared: the file's name and the lines, however each of them writes the
 * path.
 */
function siteIdentity(site: AmberSite): string {
  return site.cited.split('/').pop() ?? site.cited;
}

/** The body of one `###` section of a markdown file. */
function section(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('### '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** The text between two markers, or null when the first one is not there. */
function between(source: string, start: string, end: string): string | null {
  const from = source.indexOf(start);
  if (from < 0) return null;
  const to = source.indexOf(end, from + start.length);
  if (to < 0) return null;
  return source.slice(from, to);
}

/** The first line after a marker that carries something. */
function nextLine(source: string, marker: string): string | null {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const row = source
    .slice(at + marker.length)
    .split('\n')
    .find((line) => line.trim().length > 0);
  return row ?? null;
}

/** The badge variant on the element that carries a label. */
function badgeVariant(source: string, label: string): string | null {
  const at = source.indexOf(label);
  if (at < 0) return null;
  const before = [...source.slice(0, at).matchAll(/<Badge variant="([^"]+)"/g)];
  return before.length > 0 ? (before[before.length - 1]?.[1] ?? null) : null;
}

const index = read(path.join(briefsDir, 'README.md'));
const direction = read(directionPath);
const briefs = new Map<BriefFile, string>(BRIEF_FILES.map((file) => [file, readBrief(file)]));

/**
 * The strategy record's copy of the rule.
 *
 * `docs/strategy.md` is the product record, and it carries the rule as the
 * direction document states it. It is read whole and flattened, and its copy
 * is found by its content — the record is the peer session's live file, so a
 * check that named a line range would turn red when another item's edit moved
 * the copy, and a check that breaks on an unrelated edit is a check that gets
 * deleted.
 */
const strategyRecord = flat(read(path.join(repoRoot, 'docs', 'strategy.md')));

/** The commit the index says the numbers were measured at. */
const measuredAt = /\*\*Written against:\*\* commit `([0-9a-f]{7,40})`/.exec(index)?.[1] ?? null;
const measuredCommitReachable = measuredAt !== null && hasCommit(measuredAt);

describe('the six Forge briefs', () => {
  it('exist, and each one says what it changes, what it preserves, who owns it and when it lands', () => {
    for (const file of BRIEF_FILES) {
      const body = briefs.get(file) ?? '';
      expect(body.length, `${file} is empty`).toBeGreaterThan(0);
      carries(file, body, '## What it changes');
      carries(file, body, '## What it preserves');
      expect(/\*\*Owner:\*\*\s*\S/.test(body), `${file} has no owner`).toBe(true);
      expect(
        /\*\*Lands (first|second|third|fourth|fifth|last)\.?\*\*/.test(body),
        `${file} does not say when it lands`,
      ).toBe(true);
      carries(file, body, '## Acceptance criteria');
      carries(file, body, '## Gates');
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

/**
 * The boundary rule, as the direction document publishes it.
 *
 * The document publishes the rule as one sentence: two halves and a clause
 * that names the crossings. The pin used to hold a phrase — "one declared
 * exception, the Needs-you rail" — as a proxy for "the clause that names
 * the crossings", and the proxy is what went stale when the rule gained a
 * second crossing.
 *
 * So the clause is read out of the document and the briefs are held to
 * that: what the rule says now, not what it once said. What is written
 * down here is the rule's *shape* — it declares exceptions, and the reason
 * is a relative clause on them — and not its wording, which is the
 * document's to change.
 */
interface PublishedRule {
  /** The whole rule, as the document publishes it. */
  text: string;
  /** The clause naming the crossings, or null when the document has none. */
  clause: string | null;
  /** The reason the crossings exist, or null when the document has none. */
  reason: string | null;
}

/**
 * The shape of the rule's clause: the count, the crossings it names, and
 * the reason that follows them.
 *
 * The count is a word, not a number, because the document writes it as one.
 * The lookbehind keeps a possessive out of it — "the direction's declared
 * exception" is prose about the rule, not a copy of it.
 */
const CLAUSE_SHAPE = /(?<![\w'])(\w+\s+declared\s+exceptions?,.+?),\s+(which\b.*?)[.!?]/g;

/**
 * Every exception clause a copy of the rule carries, in its own words.
 *
 * A brief can carry the clause more than once — the rule quoted in prose,
 * and the criterion that names it — and each of those is a copy that can go
 * stale on its own. So the copies are not counted and hoped for; they are
 * read, one by one.
 */
function exceptionClauses(text: string): string[] {
  return [...text.matchAll(CLAUSE_SHAPE)].map((match) => match[1] ?? '');
}

/** The reason that follows each clause a copy of the rule carries. */
function reasonsAfterClauses(text: string): (string | null)[] {
  return [...text.matchAll(CLAUSE_SHAPE)].map((match) => match[2] ?? null);
}

function publishedRule(): PublishedRule {
  const emphasised = /\*\*The rule\.\*\*\s*_([\s\S]*?)_/.exec(direction);
  const text = flat(emphasised?.[1] ?? '');
  return {
    text,
    clause: exceptionClauses(text)[0] ?? null,
    reason: reasonsAfterClauses(text)[0] ?? null,
  };
}

/**
 * The rule, read out of the document once.
 *
 * Every copy of the rule is held to this one. A second copy of the clause
 * written into the pin would be the defect the pin exists to catch.
 */
const rule = publishedRule();

/**
 * The copies of the rule that live outside the direction document.
 *
 * Brief 01 and brief 05 quote the rule, the index quotes it too, and the
 * strategy record carries it as the direction document states it. Each one is
 * a copy that can go stale on its own, and each one is held to the clause the
 * document publishes.
 */
const RULE_COPIES: ReadonlyArray<readonly [string, string]> = [
  ['01-rooms-and-surfaces.md', flat(briefs.get('01-rooms-and-surfaces.md') ?? '')],
  ['05-needs-you-rail.md', flat(briefs.get('05-needs-you-rail.md') ?? '')],
  ['README.md', flat(index)],
  ['docs/strategy.md', strategyRecord],
];

/**
 * The pin's holding of one copy of the rule.
 *
 * Every copy the pin holds goes through this one function, so that the drift
 * test below puts these assertions in front of a drifted copy of a document
 * rather than a second version of them.
 */
function expectCopyHeldToRule(name: string, body: string): void {
  // Every clause the copy carries, and every one of them has to be the
  // document's clause — a brief that quotes the rule twice and repairs
  // one of the quotes is still a brief with a stale copy in it.
  const clauses = exceptionClauses(body);
  expect(clauses.length, `${name} carries no clause naming the rule's crossings`).toBeGreaterThan(
    0,
  );
  for (const clause of clauses) {
    expect(clause, `${name} carries a clause of its own, and it is not the rule's clause`).toBe(
      rule.clause,
    );
  }
  carries(name, body, 'picture of the system');
  carries(name, body, 'inspected or decided');
}

/**
 * The pin's holding of the reason a copy of the rule carries.
 *
 * The reason is read out of the document, and every copy that states the rule
 * in full is held to it — for the same reason as the clause: a copy that
 * carries its own reason is a copy that has drifted.
 */
function expectReasonHeldToRule(name: string, body: string): void {
  const reasons = reasonsAfterClauses(body);
  expect(reasons.length, `${name} carries no reason for the crossings`).toBeGreaterThan(0);
  for (const reason of reasons) {
    expect(reason, `${name} carries a reason of its own, and it is not the rule's reason`).toBe(
      rule.reason,
    );
  }
}

describe('the boundary rule', () => {
  it('is the rule in DIRECTION.md, exceptions included, and every copy of it quotes them', () => {
    // The load-bearing clause. The flat rule — the one without this clause —
    // is what two of the briefs quoted before the lead settled the landing
    // page's premise, and it is the one thing a document quoting itself
    // cannot catch.
    //
    // The clause used to be written out here, as the phrase "one declared
    // exception, the Needs-you rail". The phrase was a proxy for the clause
    // itself, and the proxy is what broke when the rule gained a second
    // crossing. The clause is read out of the document now, and every copy
    // of the rule is held to that.
    expect(rule.text.length, 'the direction document no longer publishes the rule').toBeGreaterThan(
      0,
    );
    expect(
      rule.clause,
      "the direction document publishes no clause naming the rule's crossings",
    ).not.toBeNull();
    // The rule has two crossings, and a rule that quietly loses one is the
    // same defect this pin exists to catch.
    expect(
      rule.clause,
      'the rule names no Needs-you rail, and the rail is one of the two crossings',
    ).toContain('the Needs-you rail');
    expect(
      rule.clause,
      'the rule names no constellation, and the constellation is the other crossing',
    ).toContain('the constellation');

    for (const [name, body] of RULE_COPIES) {
      expectCopyHeldToRule(name, body);
    }
  });

  it('carries the reason the exceptions exist, in the copies that state the rule in full', () => {
    // The reason, as the document publishes it. It used to be a sentence
    // that one crossing happened to use, and the rule now carries it for
    // both of them — so the pin reads it rather than writing it out.
    expect(
      rule.reason,
      'the direction document publishes no reason for the crossings',
    ).not.toBeNull();
    for (const [name, body] of RULE_COPIES) {
      expectReasonHeldToRule(name, body);
    }
  });

  it("is red when the strategy record's copy drifts", () => {
    // A copy of the record with the rule's copy drifted: the clause now names
    // one crossing instead of two. The pin's own holding of a copy is put in
    // front of it, so the failure shown here is the failure the tree would
    // give — not an assertion that a failure would happen.
    const driftedClause = strategyRecord.replace(
      'two declared exceptions, the Needs-you rail and the constellation',
      'one declared exception, the Needs-you rail',
    );
    expect(driftedClause, 'the drift changed nothing in the copy').not.toBe(strategyRecord);
    expect(() => expectCopyHeldToRule('docs/strategy.md', driftedClause)).toThrow();

    // And the reason, drifted on its own: a copy that keeps the crossings and
    // changes why they exist is still a copy that has drifted.
    const driftedReason = strategyRecord.replace(
      'which carry decisions in the orientation room because a decision is taken where the list is',
      'which carry decisions wherever they happen to sit',
    );
    expect(driftedReason, 'the second drift changed nothing in the copy').not.toBe(strategyRecord);
    expect(() => expectReasonHeldToRule('docs/strategy.md', driftedReason)).toThrow();
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
      // The cells, not the row's text. A table is padded so its columns line
      // up, and the padding is not what the rule is about — the room the
      // surface is in is the cell beside the surface. And the cell, not the
      // document: a surface and a room named together somewhere else in the
      // document is not the document's table placing them.
      const docRow = direction.split('\n').find((line) => line.startsWith(`| ${surface}`));
      expect(docRow, `the direction document does not place "${surface}"`).toBeDefined();
      const docCells = (docRow ?? '').split('|').map((cell) => cell.trim());
      const docAt = docCells.indexOf(surface);
      expect(
        docAt,
        `the direction document does not place "${surface}" in a row of its own`,
      ).toBeGreaterThan(-1);
      expect(
        docCells[docAt + 1],
        `the direction document puts "${surface}" in the wrong room`,
      ).toBe(room);

      const row = briefBody.split('\n').find((line) => line.startsWith(`| ${surface}`));
      expect(row, `brief 01 does not place "${surface}"`).toBeDefined();
      const cells = (row ?? '').split('|').map((cell) => cell.trim());
      const at = cells.indexOf(surface);
      expect(at, `brief 01 does not place "${surface}" in a row of its own`).toBeGreaterThan(-1);
      expect(cells[at + 1], `brief 01 puts "${surface}" in the wrong room`).toBe(room);
    }
  });
});

describe('the two rules that travel with the direction', () => {
  it('travels: one accent with one meaning', () => {
    carries('the direction document', flat(direction), 'amber always means live or waiting on you');
    carries(
      '02-material.md',
      flat(briefs.get('02-material.md') ?? ''),
      'amber always means live or waiting on you',
    );
  });

  it('travels: no ratio whose denominator is zero', () => {
    carries('the direction document', flat(direction), 'No ratio whose denominator is zero');
    const brief01 = flat(briefs.get('01-rooms-and-surfaces.md') ?? '');
    carries('01-rooms-and-surfaces.md', brief01, 'no ratio whose denominator is zero');
    carries('01-rooms-and-surfaces.md', brief01, 'N features, M operations');
    carries(
      '02-material.md',
      flat(briefs.get('02-material.md') ?? ''),
      'a ratio only where there is a denominator to divide by',
    );
  });
});

describe('the connect decision', () => {
  it('has a home: the brief says which way it goes, and why', () => {
    const brief06 = flat(briefs.get('06-constellation-and-hues.md') ?? '');
    carries(
      '06-constellation-and-hues.md',
      brief06,
      'the constellation carries the connect decision in place',
    );
    carries('06-constellation-and-hues.md', brief06, 'was rejected');
    carries('06-constellation-and-hues.md', brief06, 'a decision is taken where the list is');
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

describe('the amber collision, and the rule that resolved it', () => {
  it('is still ten usages across six files, and the accent inventory claims the same ten', () => {
    const rows = tableUnder(briefs.get('02-material.md') ?? '', 'What it says today');
    expect(rows.length).toBeGreaterThan(0);
    const sites = rows.map((row) => amberSite(row, 'brief 02'));

    expect(sites.length, 'brief 02 names eight amber elements').toBe(8);
    expect(sites.flatMap((site) => site.lines).length, 'brief 02 names ten amber lines').toBe(10);
    expect(
      new Set(sites.map((site) => path.basename(site.file))).size,
      'the amber collision is across six files',
    ).toBe(6);

    // The inventory is the successor of the brief's table, and the two have
    // to agree about which sites they are talking about. Nothing else
    // checks this: the accent guard reads the code, not the records.
    expect(
      existsSync(ACCENT_INVENTORY),
      'docs/panel-accent.md is the inventory the accent rule replaced the brief table with',
    ).toBe(true);
    const claimed = tableUnder(
      section(read(ACCENT_INVENTORY), '### The eight elements that named amber'),
      'Colour today',
    ).map((row) => amberSite(row, 'the accent inventory'));

    expect(claimed.length, 'the accent inventory names eight elements').toBe(8);
    expect(
      claimed.flatMap((site) => site.lines).length,
      'the accent inventory claims ten amber lines',
    ).toBe(10);
    expect(
      claimed.map(siteIdentity).sort(),
      'the accent inventory does not claim the sites brief 02 names',
    ).toEqual(sites.map(siteIdentity).sort());
  });

  it('holds no amber at any of the ten, in the live tree', () => {
    const rows = tableUnder(briefs.get('02-material.md') ?? '', 'What it says today');
    for (const row of rows) {
      const site = amberSite(row, 'brief 02');
      const source = read(site.file);
      const sourceLines = source.split('\n');
      for (const number of site.lines) {
        const line = sourceLines[number - 1] ?? '';
        expect(
          line,
          `${site.cited} holds amber again. The accent rule took the amber off this site, ` +
            'and the rule is that amber means live or waiting on you and nothing else.',
        ).not.toContain('amber-');
      }
      // Where, not the whole file: a failure that dumps five thousand
      // characters of component is a failure nobody reads.
      const amberAt = sourceLines.findIndex((line) => line.includes('amber-')) + 1;
      expect(
        amberAt,
        `${path.basename(site.file)} holds amber again at line ${amberAt}, and it is the file that carries ${site.cited}.`,
      ).toBe(0);
    }
  });

  it('splits the one site that carried two meanings, and the accent stays on the review side', () => {
    const board = read(path.join(webRoot, 'src', 'components', 'TaskBoard.tsx'));

    // The badges. A task in review is waiting on the owner, so it wears the
    // accent; a task whose outcome is unknown is a caution, so it does not.
    expect(badgeVariant(board, 'awaiting acceptance'), 'the badge a task in review wears').toBe(
      'accent',
    );
    expect(
      badgeVariant(board, 'outcome unknown'),
      'the badge a task with an unknown outcome wears',
    ).not.toBe('accent');

    // The block both statuses share, and the split inside it. The accent has
    // to be somewhere: a rule that forbids a colour and never says where it
    // goes is a rule that erodes from the other side.
    const block = between(
      board,
      "{task.status === 'review' || task.status === 'unknown' ? (",
      ') : null}',
    );
    expect(block, 'the acceptance block brief 02 names is gone').not.toBeNull();
    const split = /task\.status === 'review'\s*\?\s*'([^']*)'\s*:\s*'([^']*)'/.exec(block ?? '');
    expect(split, 'the acceptance block no longer splits on the review status').not.toBeNull();
    expect(
      split?.[1],
      'a task in review is waiting on the owner, so its half of the block wears the accent',
    ).toMatch(/accent-/);
    expect(
      split?.[2],
      'a task whose outcome is unknown is a caution, so its half of the block does not',
    ).not.toMatch(/accent-/);
  });

  it('sends the two failures it named to the error colour', () => {
    // The routing-blocked notice: the message was not delivered. It failed.
    const detail = read(path.join(webRoot, 'src', 'pages', 'ConversationDetail.tsx'));
    const blocked = nextLine(detail, 'routingNotice.routing.blocked');
    expect(blocked, 'the routing-blocked notice is gone').not.toBeNull();
    expect(blocked, 'the routing-blocked notice wears the error colour').toMatch(/\berr\b/);
    expect(blocked, 'the routing-blocked notice does not wear the accent').not.toMatch(/accent-/);

    // The revision conflict: the save cannot land. It failed.
    const editor = read(path.join(webRoot, 'src', 'components', 'ResourceEditor.tsx'));
    const conflict = between(editor, '{conflict ? (', ') : null}');
    expect(conflict, 'the revision-conflict notice is gone').not.toBeNull();
    expect(conflict, 'the revision conflict wears the error colour').toMatch(/\berr\b/);
    expect(conflict, 'the revision conflict does not wear the accent').not.toMatch(/accent-/);
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
