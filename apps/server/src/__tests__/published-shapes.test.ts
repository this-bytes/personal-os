import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourceTypeSchema } from '@personal-os/contracts';

/**
 * The published shapes, and the claims the contract makes about the code.
 *
 * The claims in those entries are claims about the code, and a claim about the
 * code is a contract only while the code still says it:
 *
 *  - the template record publishes the six kinds a template may start, and
 *    the code's own kind enum has to be those six;
 *  - the measures route publishes which mutating routes write no audit entry,
 *    out of the thirty-six it counts, and the code has to be writing one on
 *    exactly the others;
 *  - the closing-an-unknown-outcome entry publishes the owner's note as capped,
 *    and the code's own schema has to cap it at that same number.
 *
 * All three are checked against CONTRACTS.md and against the code, rather than
 * against a copy of either, so the two cannot drift apart quietly. A change
 * to one that the other does not follow fails here: a route that stops
 * auditing, and the entry that names the routes that write none, have to
 * change together.
 *
 * **And the fourth claim is the one that was missing.** An entry that says the
 * code does not implement what it publishes is a claim about the code too, and
 * the template record's said the code did not implement it for four hours after
 * the implementation landed (WI-017, at `8b1fd01`), and nothing watched it.
 *
 * It is watched now, in the house form the corrected entries already use —
 * _"the code implements it — as of `<commit>`"_ — and the commit it names has
 * to be one the tree has. The general form watches the rest of the contract:
 * every claim the contract makes about the code names either a commit or a
 * work item that is still open.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function contractsSection(heading: string): string {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const start = text.indexOf(heading);
  expect(start, `CONTRACTS.md no longer publishes ${heading}`).toBeGreaterThan(-1);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

/** The kinds the template record publishes for a template. */
function publishedTemplateKinds(): string[] {
  const section = contractsSection('### The template record');
  const sentence = section
    .split(/\n\s*\n/)
    .find((block) => block.includes('is the published kind enum'));
  expect(sentence, 'the template record no longer publishes the kind enum').not.toBeUndefined();

  const groups = [...sentence!.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
  const list = groups.find((group) => group.includes(' | '));
  expect(list, 'the template record no longer publishes the list of kinds').toBeDefined();
  return list!.split('|').map((kind) => kind.trim());
}

/**
 * The mutating routes the measures entry says write no audit entry.
 *
 * The entry publishes that claim in one of two forms, and this reads whichever
 * is published:
 *
 *  - the table form: a table of the routes that write no audit entry. It may
 *    have no rows at all — the claim that there are none is published by an
 *    empty table, and a table with a header and no rows is still a published
 *    table;
 *  - the prose form: a sentence saying that every mutating route writes an
 *    audit entry. The published set is then empty.
 *
 * The table is read first, because it is the specific set of routes and the
 * prose form publishes an empty one. A claim published in neither form is a
 * claim that has been dropped, and that fails here rather than passing on an
 * empty set.
 */
function publishedUnauditedRoutes(): string[] {
  const section = contractsSection('### The measures route');

  const table = publishedUnauditedTable(section);
  if (table !== null) return table;

  expect(
    publishesEveryRouteAudits(section),
    'the measures route publishes neither the table of the routes that write no audit entry ' +
      'nor a sentence saying that every mutating route writes an audit entry',
  ).toBe(true);

  return [];
}

/**
 * The table of the routes that write no audit entry, if the entry publishes
 * one.
 *
 * The table is found by its header and not by its rows, because the table may
 * legitimately have no rows at all: the claim that there are no exceptions is
 * published by an empty table, and a header on its own is a published table.
 */
function publishedUnauditedTable(section: string): string[] | null {
  const lines = section.split('\n');
  const header = lines.findIndex((line) => isUnauditedTableHeader(line));
  if (header < 0) return null;

  const routes: string[] = [];
  for (let index = header + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !line.startsWith('|')) break;
    // The separator under a markdown header is not a row.
    if (/^\|\s*[-: ]+\|/.test(line)) continue;
    const row = /^\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|/.exec(line);
    if (row) routes.push(`${row[1]!} ${row[2]!}`);
  }
  return routes;
}

/**
 * The header of the table that publishes the routes which write no audit
 * entry.
 *
 * The columns are named in the header, so the header is what identifies the
 * table — the rows cannot, because the table may have none. The table has two
 * columns, a method and a path; a wider table with a third column beside the
 * path is a table of something else, such as the route table in the HTTP
 * surface.
 */
function isUnauditedTableHeader(line: string): boolean {
  if (!line.startsWith('|')) return false;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 2) return false;
  return /method/i.test(cells[0] ?? '') && /path/i.test(cells[1] ?? '');
}

/**
 * The prose form: a sentence saying that every mutating route writes an audit
 * entry.
 *
 * What is matched is the sentence's shape and not its wording, which is the
 * contract's to change: the sentence's subject is the whole set of mutating
 * routes, and it is about their auditing. A sentence whose subject is a part
 * of the set — that some of them write none — and a sentence that denies the
 * claim are not this claim, and are not read as one.
 */
function publishesEveryRouteAudits(section: string): boolean {
  return sentences(section).some(isEveryRouteAudited);
}

/**
 * The shape of that sentence.
 *
 * Two parts, and both are needed. The subject is the whole set of the
 * mutating routes — every one of them, all of them, each of them — and the
 * sentence is about their auditing.
 */
const CLAIMS_THE_WHOLE_SET = /^\W*(?:every|all|each)\s+(?:\w+\s+){0,4}mutating\s+routes?\b/i;
const ABOUT_THEIR_AUDITING = /\baudit/i;

function isEveryRouteAudited(sentence: string): boolean {
  return CLAIMS_THE_WHOLE_SET.test(sentence) && ABOUT_THEIR_AUDITING.test(sentence);
}

/**
 * The section's sentences.
 *
 * The emphasis markers come off first, so that a sentence whose last words are
 * emphasised still ends at its full stop, and a sentence ends where a full
 * stop is followed by white space.
 */
function sentences(section: string): string[] {
  return section
    .replace(/\*\*/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * The cap the contract publishes for the owner's note.
 *
 * Read out of the published shape's own trailing comment, so that the number in
 * the contract and the number in the code are two numbers, and not one number
 * written down twice.
 */
function publishedNoteBound(): number {
  const section = contractsSection('### Closing an unknown outcome');
  const shape = section.match(/interface ResolveExecutionInput \{[^}]*\}/);
  expect(shape, 'the contract no longer publishes the ResolveExecutionInput shape').not.toBeNull();

  const note = shape![0]!.split('\n').find((line) => line.trim().startsWith('note?:'));
  expect(note, 'the contract no longer publishes the note field').not.toBeUndefined();

  const bound = note!.match(/up to\s+([\d,]+)\s+characters/);
  expect(bound, 'the published note no longer says what it is capped at').not.toBeNull();

  return Number(bound![1]!.replace(/,/g, ''));
}

/**
 * The mutating routes the code registers, and whether each writes an audit
 * entry in its own handler.
 *
 * The handlers are read from the source, because the claim is about the
 * source: "every mutating route writes an audit entry" is a statement about
 * what the handlers do, and a client can only be told the truth about it from
 * the handlers.
 */
function codeMutatingRoutes(): { route: string; audited: boolean }[] {
  const dir = path.join(repoRoot, 'apps', 'server', 'src', 'api');
  const found: { route: string; audited: boolean }[] = [];

  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const matches = [...text.matchAll(/\bapp\.(post|patch|put|delete)\(\s*'([^']+)'/g)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]!;
      const end = index + 1 < matches.length ? matches[index + 1]!.index : text.length;
      const handler = text.slice(match.index, end);
      found.push({
        route: `${match[1]!.toUpperCase()} ${match[2]!}`,
        audited: /\baudit\(/.test(handler),
      });
    }
  }
  return found;
}

/**
 * The cap the code enforces for the owner's note.
 *
 * Read out of the schema's own `.max()`, which is the cap the request is
 * refused against — a note over it is refused, not shortened.
 */
function enforcedNoteBound(): number {
  const source = fs.readFileSync(
    path.join(repoRoot, 'apps', 'server', 'src', 'api', 'executions.ts'),
    'utf8',
  );
  const bound = source.match(/note\s*:\s*z\.string\(\)\.max\(\s*([\d_]+)\s*\)/);
  expect(bound, 'the code no longer caps the note with z.string().max()').not.toBeNull();

  return Number(bound![1]!.replace(/_/g, ''));
}

describe('the published shapes', () => {
  it('publishes the template record over the kinds the code has', () => {
    // The owner settled that all six kinds get a template in the first set.
    // The entry publishes the six, and the code's kind enum is the six.
    expect(publishedTemplateKinds()).toEqual(resourceTypeSchema.options);
  });

  it('names the routes that write no audit entry, and the code writes none on exactly those', () => {
    const routes = codeMutatingRoutes();

    // Eight of the mutating routes write their audit entry from the service
    // layer rather than the route; the entry names them.
    const fromTheServiceLayer = new Set([
      'POST /api/approvals/:id/decide',
      'POST /api/agui/runs/:runId/resume',
      'PATCH /api/tasks/:id',
      'POST /api/executions/:id/stop',
      'POST /api/executions/:id/resolve',
      'POST /api/tasks/:id/accept',
      'POST /api/resources/:id/publish',
      'POST /api/resources/:id/execute',
    ]);
    const unaudited = routes
      .filter((entry) => !entry.audited && !fromTheServiceLayer.has(entry.route))
      .map((entry) => entry.route)
      .sort();

    expect(publishedUnauditedRoutes()).toEqual(unaudited);
  });

  it('publishes the counts of routes and audit entries the code has', () => {
    const section = contractsSection('### The measures route');
    const routes = codeMutatingRoutes();

    const total = section.match(/Of the\s+(\d+)\s+mutating routes/);
    const atRouteLevel = section.match(/(\d+)\s+write an audit entry at the\s+route level/);
    expect(total, 'the measures route no longer publishes the number of mutating routes').not.toBe(
      null,
    );
    expect(
      atRouteLevel,
      'the measures route no longer publishes the number of routes that audit',
    ).not.toBe(null);

    expect(routes.length).toBe(Number(total![1]));
    expect(routes.filter((entry) => entry.audited).length).toBe(Number(atRouteLevel![1]));
  });

  it('publishes the cap on the note, and the code caps it at the same number', () => {
    // The entry publishes the cap on the owner's note, and the schema refuses
    // a longer one. The two numbers are read out of the contract and out of
    // the code, so one of them moving without the other fails here.
    const published = publishedNoteBound();
    const enforced = enforcedNoteBound();

    expect(
      published,
      `the contract publishes ${published} characters for the note, and the code caps it at ${enforced}`,
    ).toBe(enforced);
  });
});

/* ------------------------------------------------------------------------ *
 * The claims the contract makes about the code.
 *
 * A claim about the code has two shapes, and both are watched here:
 *
 *  - **an unimplemented-status sentence** — the entry says the code does not
 *    implement what the entry publishes; and
 *  - **the house form** — the entry says the code implements it, and names the
 *    commit that does.
 *
 * The house form is the one the corrected entries already use, so the check
 * is a shape the contract already keeps: _"This entry is the contract for
 * **WI-008**, and the code implements it — as of `9ad4f98`."_
 * ------------------------------------------------------------------------ */

/** The house form: the code implements it, and here is the commit that does. */
const HOUSE_FORM = /the code implements (?:it|this|that) — as of `([0-9a-f]{7,40})`/gi;

/** A sentence that claims the code does not implement what the entry publishes. */
const UNIMPLEMENTED_STATUS = /the code does not implement|is not implemented|not yet implemented/i;

/** A sentence that makes any claim about what the code does. */
const STATUS_CLAIM = /the code (?:does not implement|implements)/i;

/**
 * The sentences of a block.
 *
 * The contract is prose wrapped across lines, so a sentence is found by the
 * punctuation that ends one. The split keeps a markdown close, an
 * abbreviation and a hash intact: a full stop only ends a sentence when what
 * follows starts a new one.
 */
function statusSentences(block: string): string[] {
  return block
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?][*_'"`)\]]*)\s+(?=[A-Z*_`"'(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** A claim the contract makes about the code, and where it makes it. */
interface StatusClaim {
  /** The heading the claim sits under. */
  readonly heading: string;
  /** The sentence that makes the claim. */
  readonly sentence: string;
  /** The commits the claim's own paragraph names. */
  readonly commits: readonly string[];
  /** The work items the claim's own paragraph names. */
  readonly items: readonly string[];
}

/**
 * Every claim the contract makes about the code.
 *
 * The unit is the paragraph, because a claim and the item it is about are
 * often in the same paragraph and not in the same sentence; the sentence is
 * what is reported, because a failure has to name the sentence that is
 * wrong.
 */
function statusClaimsInTheContract(): StatusClaim[] {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const claims: StatusClaim[] = [];
  let heading = '';
  let block: string[] = [];

  const flush = (): void => {
    if (block.length === 0) return;
    const paragraph = block.join('\n');
    block = [];

    const making = statusSentences(paragraph).filter((sentence) => STATUS_CLAIM.test(sentence));
    if (making.length === 0) return;

    const commits = [...new Set([...paragraph.matchAll(/`([0-9a-f]{7,40})`/g)].map((m) => m[1]!))];
    const items = [...new Set([...paragraph.matchAll(/WI-\d{3}/g)].map((m) => m[0]))];

    for (const sentence of making) {
      claims.push({ heading, sentence, commits, items });
    }
  };

  for (const line of text.split('\n')) {
    const headingMatch = /^#{2,3}\s+(.+)$/.exec(line);
    if (headingMatch) {
      flush();
      heading = headingMatch[1]!.trim();
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    block.push(line);
  }
  flush();

  return claims;
}

/**
 * Whether a work item is still open.
 *
 * The lead's definition, used as given: an item is open when its file's state
 * line does not begin with `accepted`. Markdown emphasis is stripped first,
 * so `**accepted**` is the same word as `accepted`. **An item with no file is
 * not open** — there is nothing there to be open, and a claim that names it
 * has to name a commit instead.
 */
function itemIsOpen(item: string): boolean {
  const file = path.join(repoRoot, '.factory', 'work', `${item}.md`);
  if (!fs.existsSync(file)) return false;
  const state = fs.readFileSync(file, 'utf8').match(/^\*\*State:\*\*\s*(.*)$/m);
  if (!state) return false;
  return !state[1]!
    .trim()
    .replace(/^[*_`\s]+/, '')
    .startsWith('accepted');
}

/** Whether this checkout can look up an old commit at all. */
function isShallowRepository(): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() === 'true'
    );
  } catch {
    return true;
  }
}

/** Whether the tree has a commit by that name. */
function commitIsInTheTree(commit: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

describe('the claims the contract makes about the code', () => {
  const templateRecord = '### The template record';

  it('publishes no unimplemented-status sentence about the template record', () => {
    // The sentence this check exists for. The template record's
    // implementation landed at 8b1fd01, and the entry said the code did not
    // implement it for four hours afterwards.
    const claiming = statusClaimsInTheContract().filter(
      (claim) =>
        claim.heading === 'The template record' && UNIMPLEMENTED_STATUS.test(claim.sentence),
    );

    expect(
      claiming.map((claim) => claim.sentence),
      `the template record still says the code does not implement it: ${claiming
        .map((claim) => claim.sentence)
        .join(' / ')}`,
    ).toEqual([]);
  });

  it('names the commit that implements the template record, in the house form', () => {
    const named = statusClaimsInTheContract()
      .filter((claim) => claim.heading === 'The template record')
      .flatMap((claim) => [...claim.sentence.matchAll(HOUSE_FORM)].map((match) => match[1]!));

    expect(
      named.length,
      `the template record does not name the commit that implements it, in the house form ("the code implements it — as of \`<commit>\`")`,
    ).toBeGreaterThan(0);
  });

  it('names a commit the tree has', () => {
    const named = statusClaimsInTheContract()
      .filter((claim) => claim.heading === 'The template record')
      .flatMap((claim) => [...claim.sentence.matchAll(HOUSE_FORM)].map((match) => match[1]!));

    if (isShallowRepository()) {
      // A shallow checkout has one commit in it, so an older commit cannot
      // be looked up here — and the CI checkout is shallow. Say so, rather
      // than report a commit the tree has as one it does not.
      console.warn(
        '[published-shapes] the commit check is skipped: this checkout is shallow, so an old commit cannot be looked up in it',
      );
      return;
    }

    for (const commit of named) {
      expect(
        commitIsInTheTree(commit),
        `the template record names ${commit}, which this tree does not have`,
      ).toBe(true);
    }
  });

  it('gives every status claim a commit or an open item', () => {
    // The general rule: a claim about the code either names the commit that
    // carries it, or names a work item that is still open. A claim that
    // names neither is a claim nobody is watching.
    const unsatisfied = statusClaimsInTheContract().filter((claim) => {
      if (claim.commits.length > 0) return false;
      return !claim.items.some((item) => itemIsOpen(item));
    });

    expect(
      unsatisfied.map((claim) => `${claim.heading}: ${claim.sentence}`),
      `these claims about the code name neither a commit nor an open item: ${unsatisfied
        .map((claim) => `${claim.heading}: ${claim.sentence}`)
        .join(' / ')}`,
    ).toEqual([]);
  });
});
