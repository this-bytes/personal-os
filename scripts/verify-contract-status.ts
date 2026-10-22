/**
 * The gate that notices when a published contract goes false.
 *
 * `CONTRACTS.md` publishes implementation-status notes — "the code does not
 * implement this yet" — and a note that goes stale is an invitation to build
 * something that already exists. Two of them were false on 2026-10-21: the
 * template record's note, four hours and fifteen minutes after WI-017 landed,
 * and the resolve route's note, twenty-seven minutes after it was written. A
 * published count was caught by the pipeline; a stale status is not a count,
 * and nothing else in the repository can fail on it.
 *
 * A status note is prose, and there is no general way to check prose against
 * code, so this gate does not try. It reads a table of claims — the file
 * beside this script — in which each claim names the contract section the note
 * lives in, the fragment of that note which carries the claim, the claim
 * itself, and what the tree must contain for the claim to be true. It checks
 * exactly those, and it checks nothing else.
 *
 *   npx tsx scripts/verify-contract-status.ts
 *
 * The exit codes:
 *
 *   0 — every claim in the table holds.
 *   1 — a note is false, or the table no longer describes the contract.
 *   2 — the gate could not run: the contract or the table is missing,
 *       unreadable, or malformed.
 *
 * The script never edits the contract. Correcting a false note is a human
 * decision, and a contract change needs the owner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** What a note claims about the code. The set is closed. */
export type Claim = 'not-implemented' | 'partial' | 'implemented';

/**
 * What the tree must contain for a claim to hold.
 *
 * `present-*` assertions hold when the tree contains the thing; `absent-*`
 * assertions hold when it does not. A path may be a file or a directory, and a
 * directory is searched file by file.
 */
export type AssertionKind = 'present-text' | 'absent-text' | 'present-pattern' | 'absent-pattern';

export interface Assertion {
  kind: AssertionKind;
  path: string;
  value: string;
}

export interface ClaimEntry {
  /** A stable name for the claim, used in the gate's output. */
  id: string;
  /** The heading of the contract section the note lives in. */
  section: string;
  /** The fragment of the note that carries the claim. */
  note: string;
  claim: Claim;
  /** Why this claim is worth checking, in one sentence. */
  why?: string;
  expect: Assertion[];
}

export interface ClaimTable {
  contract: string;
  claims: ClaimEntry[];
}

/**
 * The phrases a note uses to carry a claim.
 *
 * This is a closed vocabulary on purpose. The gate does not read prose in
 * general — it reads the fragment the table points at and asks which of three
 * claims that fragment carries. A fragment that says none of them, or says
 * two of them, is reported as unchecked and never failed: a gate that guesses
 * at prose blocks on prose it cannot read.
 */
const CLAIM_PHRASES: ReadonlyArray<{ claim: Claim; phrases: readonly string[] }> = [
  { claim: 'not-implemented', phrases: ['does not implement', 'no implementation'] },
  { claim: 'implemented', phrases: ['the code implements'] },
  // "partially" on its own is not a claim about an implementation — a
  // contract that says a status renders a "partially streamed answer" is
  // talking about a stream, not about the code being half-written.
  { claim: 'partial', phrases: ['implements part', 'partly implemented', 'partially implemented'] },
];

const CLAIMS: readonly Claim[] = ['not-implemented', 'partial', 'implemented'];

const ASSERTION_KINDS: readonly AssertionKind[] = [
  'present-text',
  'absent-text',
  'present-pattern',
  'absent-pattern',
];

/** Directories a directory search never descends into. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'playwright-report',
]);

/** The gate could not run: the contract or the table is missing or malformed. */
export class GateError extends Error {}

interface Section {
  title: string;
  startLine: number;
  endLine: number;
}

interface Paragraph {
  startLine: number;
  endLine: number;
  text: string;
}

interface NormalisedDocument {
  text: string;
  /** The source line each character of `text` came from. */
  lineOfChar: number[];
}

export interface CheckedClaim {
  id: string;
  line: number;
  claim: Claim;
  /** The claim the note's own prose carries, when it carried exactly one. */
  said: Claim | null;
  why: string | undefined;
  paths: string[];
}

export interface UncheckedNote {
  line: number;
  section: string;
  note: string;
  claim: Claim | null;
  reason: string;
}

export interface Failure {
  id: string;
  line: number;
  kind: 'false-note' | 'stale-table' | 'disagreement';
  message: string;
}

export interface GateResult {
  exitCode: 0 | 1 | 2;
  output: string;
  checked: CheckedClaim[];
  unchecked: UncheckedNote[];
  failures: Failure[];
}

/**
 * The document with its line wrapping collapsed and its emphasis markers
 * dropped, so a fragment in the table does not have to repeat the line breaks
 * or the bold that the contract happens to use around it.
 *
 * The line each character came from is kept, so a note is still reported at
 * the line a reader can open.
 */
function normaliseDocument(lines: string[]): NormalisedDocument {
  const chunks: string[] = [];
  const lineOfChar: number[] = [];

  lines.forEach((line, index) => {
    const collapsed = line.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (collapsed.length === 0) return;
    if (chunks.length > 0) {
      chunks.push(' ');
      lineOfChar.push(index + 1);
    }
    for (const character of collapsed) {
      chunks.push(character);
      lineOfChar.push(index + 1);
    }
  });

  return { text: chunks.join(''), lineOfChar };
}

function normaliseFragment(fragment: string): string {
  return fragment.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/** The contract's headings, each with the lines it covers. */
function readSections(lines: string[]): Section[] {
  const headings: { level: number; title: string; line: number }[] = [];

  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) return;
    headings.push({
      level: (match[1] ?? '').length,
      title: (match[2] ?? '').trim(),
      line: index + 1,
    });
  });

  return headings.map((heading, index) => {
    let endLine = lines.length;
    for (let next = index + 1; next < headings.length; next += 1) {
      const candidate = headings[next];
      if (!candidate) continue;
      if (candidate.level <= heading.level) {
        endLine = candidate.line - 1;
        break;
      }
    }
    return { title: heading.title, startLine: heading.line, endLine };
  });
}

/** The contract's paragraphs: the runs of lines a blank line separates. */
function readParagraphs(lines: string[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let start: number | null = null;
  let buffer: string[] = [];

  const flush = (endLine: number): void => {
    if (start === null) return;
    paragraphs.push({
      startLine: start,
      endLine,
      text: normaliseFragment(buffer.join(' ')),
    });
    start = null;
    buffer = [];
  };

  lines.forEach((line, index) => {
    if (line.trim().length === 0) {
      flush(index);
      return;
    }
    if (start === null) start = index + 1;
    buffer.push(line);
  });
  flush(lines.length);

  return paragraphs;
}

/** Which of the three claims a fragment carries. Empty when it carries none. */
function classify(text: string): Claim[] {
  const normalised = normaliseFragment(text).toLowerCase();
  return CLAIM_PHRASES.filter((entry) =>
    entry.phrases.some((phrase) => normalised.includes(phrase)),
  ).map((entry) => entry.claim);
}

/** Every offset at which `needle` appears in `haystack`. */
function offsetsOf(haystack: string, needle: string): number[] {
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    offsets.push(at);
    from = at + 1;
  }
  return offsets;
}

function readTable(raw: string, tablePath: string): ClaimTable {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GateError(`${tablePath} is not valid JSON: ${(error as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new GateError(`${tablePath} must hold an object.`);
  }

  const table = parsed as Partial<ClaimTable>;
  if (typeof table.contract !== 'string' || table.contract.length === 0) {
    throw new GateError(`${tablePath} must name the contract it describes.`);
  }
  if (!Array.isArray(table.claims)) {
    throw new GateError(`${tablePath} must hold a "claims" array.`);
  }

  const seen = new Set<string>();
  const claims = table.claims.map((raw: unknown, index: number): ClaimEntry => {
    if (typeof raw !== 'object' || raw === null) {
      throw new GateError(`${tablePath}: claim ${index} must be an object.`);
    }
    const claim = raw as Partial<ClaimEntry>;

    for (const field of ['id', 'section', 'note', 'claim'] as const) {
      if (typeof claim[field] !== 'string' || (claim[field] as string).length === 0) {
        throw new GateError(`${tablePath}: claim ${index} must carry a "${field}".`);
      }
    }
    const id = claim.id as string;
    if (seen.has(id)) {
      throw new GateError(`${tablePath}: two claims are called "${id}".`);
    }
    seen.add(id);

    const kind = claim.claim as string;
    if (!CLAIMS.includes(kind as Claim)) {
      throw new GateError(
        `${tablePath}: claim "${id}" claims "${kind}", which is not one of ${CLAIMS.join(', ')}.`,
      );
    }

    if (!Array.isArray(claim.expect)) {
      throw new GateError(`${tablePath}: claim "${id}" must carry an "expect" array.`);
    }

    const expect = claim.expect.map((assertion: unknown, at: number): Assertion => {
      if (typeof assertion !== 'object' || assertion === null) {
        throw new GateError(`${tablePath}: claim "${id}" assertion ${at} must be an object.`);
      }
      const check = assertion as Partial<Assertion>;
      if (
        typeof check.kind !== 'string' ||
        !ASSERTION_KINDS.includes(check.kind as AssertionKind)
      ) {
        throw new GateError(
          `${tablePath}: claim "${id}" assertion ${at} must be one of ${ASSERTION_KINDS.join(', ')}.`,
        );
      }
      if (typeof check.path !== 'string' || check.path.length === 0) {
        throw new GateError(`${tablePath}: claim "${id}" assertion ${at} must carry a "path".`);
      }
      if (typeof check.value !== 'string' || check.value.length === 0) {
        throw new GateError(`${tablePath}: claim "${id}" assertion ${at} must carry a "value".`);
      }
      return {
        kind: check.kind as AssertionKind,
        path: check.path,
        value: check.value,
      };
    });

    // The claim says which way the tree has to lean, so an assertion that
    // leans the other way is a table that cannot mean what it says.
    const wantsPresence = kind === 'implemented';
    const wantsAbsence = kind === 'not-implemented';
    for (const assertion of expect) {
      const presence = assertion.kind.startsWith('present-');
      if (wantsPresence && !presence) {
        throw new GateError(
          `${tablePath}: claim "${id}" says implemented, so every check must be a "present-*" one.`,
        );
      }
      if (wantsAbsence && presence) {
        throw new GateError(
          `${tablePath}: claim "${id}" says not-implemented, so every check must be an "absent-*" one.`,
        );
      }
    }

    const entry: ClaimEntry = {
      id,
      section: claim.section as string,
      note: claim.note as string,
      claim: kind as Claim,
      expect,
    };
    if (typeof claim.why === 'string') entry.why = claim.why;
    return entry;
  });

  return { contract: table.contract, claims };
}

/** Every file under a path, or the one file it names. */
function readTree(root: string, relative: string): { files: { path: string; text: string }[] } {
  const absolute = path.resolve(root, relative);
  const inside = path.relative(root, absolute);
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new GateError(`"${relative}" is outside the repository.`);
  }

  if (!fs.existsSync(absolute)) return { files: [] };
  if (fs.statSync(absolute).isFile()) {
    return { files: [{ path: relative, text: fs.readFileSync(absolute, 'utf8') }] };
  }

  const files: { path: string; text: string }[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        walk(path.join(directory, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const file = path.join(directory, entry.name);
      files.push({
        path: path.relative(root, file).split(path.sep).join('/'),
        text: fs.readFileSync(file, 'utf8'),
      });
    }
  };
  walk(absolute);
  return { files };
}

/**
 * Whether one assertion holds, and what the tree said about it.
 *
 * An assertion over a path that does not exist holds when it is an absence —
 * the thing is certainly not there — and fails when it is a presence.
 */
function checkAssertion(root: string, assertion: Assertion): { holds: boolean; detail: string } {
  const { files } = readTree(root, assertion.path);

  if (assertion.kind === 'present-text') {
    const hit = files.find((file) => file.text.includes(assertion.value));
    return hit
      ? { holds: true, detail: `${hit.path} contains "${assertion.value}"` }
      : {
          holds: false,
          detail: `nothing under ${assertion.path} contains "${assertion.value}"`,
        };
  }

  if (assertion.kind === 'absent-text') {
    const hit = files.find((file) => file.text.includes(assertion.value));
    return hit
      ? {
          holds: false,
          detail: `${hit.path} contains "${assertion.value}"`,
        }
      : { holds: true, detail: `nothing under ${assertion.path} contains "${assertion.value}"` };
  }

  const expression = new RegExp(assertion.value);
  if (assertion.kind === 'present-pattern') {
    const hit = files.find((file) => expression.test(file.text));
    return hit
      ? { holds: true, detail: `${hit.path} matches /${assertion.value}/` }
      : {
          holds: false,
          detail: `nothing under ${assertion.path} matches /${assertion.value}/`,
        };
  }

  const hit = files.find((file) => expression.test(file.text));
  return hit
    ? { holds: false, detail: `${hit.path} matches /${assertion.value}/` }
    : { holds: true, detail: `nothing under ${assertion.path} matches /${assertion.value}/` };
}

export interface GateOptions {
  /** The repository root the tree is read from. */
  root: string;
  /** The contract, relative to the root. */
  contract?: string;
  /** The claim table, relative to the root. */
  table?: string;
}

/**
 * Run the gate.
 *
 * The function is pure with respect to the tree: it reads the contract and the
 * table, and it writes neither. That is what lets the drift test point it at
 * a scratch copy and watch it fail.
 *
 * Every way the gate can fail to run comes back as exit code 2, so a caller
 * that reads the result rather than the exit code cannot mistake a gate that
 * could not read its ground truth for a gate that found nothing wrong.
 */
export function runGate(options: GateOptions): GateResult {
  try {
    return checkTheTree(options);
  } catch (error) {
    if (error instanceof GateError) {
      return {
        exitCode: 2,
        output: `The contract status gate could not run.\n  ${error.message}\n`,
        checked: [],
        unchecked: [],
        failures: [],
      };
    }
    throw error;
  }
}

function checkTheTree(options: GateOptions): GateResult {
  const root = path.resolve(options.root);
  const contractPath = options.contract ?? 'CONTRACTS.md';
  const tablePath = options.table ?? 'scripts/contract-status.json';

  let lines: string[];
  let table: ClaimTable;
  const contractFile = path.resolve(root, contractPath);
  if (!fs.existsSync(contractFile)) {
    throw new GateError(`The contract ${contractPath} is not in the tree.`);
  }
  lines = fs.readFileSync(contractFile, 'utf8').split('\n');

  const tableFile = path.resolve(root, tablePath);
  if (!fs.existsSync(tableFile)) {
    throw new GateError(`The claim table ${tablePath} is not in the tree.`);
  }
  table = readTable(fs.readFileSync(tableFile, 'utf8'), tablePath);

  const document = normaliseDocument(lines);
  const sections = readSections(lines);
  const paragraphs = readParagraphs(lines);

  const failures: Failure[] = [];
  const checked: CheckedClaim[] = [];
  const unchecked: UncheckedNote[] = [];
  const coveredParagraphs = new Set<number>();

  for (const entry of table.claims) {
    const matching = sections.filter((section) => section.title === entry.section);
    if (matching.length === 0) {
      failures.push({
        id: entry.id,
        line: 0,
        kind: 'stale-table',
        message: `the contract has no section called "${entry.section}", so the note this claim describes cannot be found.`,
      });
      continue;
    }

    const fragment = normaliseFragment(entry.note);
    const hits: { line: number; section: Section }[] = [];
    for (const section of matching) {
      const from = document.lineOfChar.findIndex((line) => line >= section.startLine);
      const to = document.lineOfChar.findLastIndex((line) => line <= section.endLine);
      if (from === -1 || to === -1) continue;
      const window = document.text.slice(from, to + 1);
      for (const offset of offsetsOf(window, fragment)) {
        const absolute = from + offset;
        const line = document.lineOfChar[absolute] ?? section.startLine;
        hits.push({ line, section });
      }
    }

    if (hits.length === 0) {
      failures.push({
        id: entry.id,
        line: 0,
        kind: 'stale-table',
        message:
          `the note this claim describes is no longer in "${entry.section}": ` +
          `"${entry.note}" is not there. The note and the claim table change together.`,
      });
      continue;
    }

    if (hits.length > 1) {
      throw new GateError(
        `the claim table is ambiguous: "${entry.note}" appears ${hits.length} times in "${entry.section}".`,
      );
    }

    const hit = hits[0];
    if (!hit) continue;

    const paragraph = paragraphs.find(
      (candidate) => hit.line >= candidate.startLine && hit.line <= candidate.endLine,
    );
    if (paragraph) coveredParagraphs.add(paragraph.startLine);

    const said = classify(entry.note);
    if (said.length === 0) {
      unchecked.push({
        line: hit.line,
        section: entry.section,
        note: entry.note,
        claim: null,
        reason: `the note does not say which of ${CLAIMS.join(', ')} it claims, so the gate cannot read it.`,
      });
      continue;
    }
    if (said.length > 1) {
      unchecked.push({
        line: hit.line,
        section: entry.section,
        note: entry.note,
        claim: null,
        reason: `the note claims ${said.join(' and ')} at once, so the gate cannot read it.`,
      });
      continue;
    }

    const saidClaim = said[0] as Claim;
    if (saidClaim !== entry.claim) {
      failures.push({
        id: entry.id,
        line: hit.line,
        kind: 'disagreement',
        message:
          `the note says ${saidClaim}, and the claim table says ${entry.claim}. ` +
          'The note and the claim table change together.',
      });
      continue;
    }

    if (entry.expect.length === 0) {
      unchecked.push({
        line: hit.line,
        section: entry.section,
        note: entry.note,
        claim: entry.claim,
        reason: 'the claim table holds no check for this note, so the gate cannot check it.',
      });
      continue;
    }

    const broken = entry.expect
      .map((assertion) => ({ assertion, outcome: checkAssertion(root, assertion) }))
      .filter((result) => !result.outcome.holds);

    if (broken.length > 0) {
      const first = broken[0];
      if (!first) continue;
      failures.push({
        id: entry.id,
        line: hit.line,
        kind: 'false-note',
        message: `the note says ${entry.claim}, but ${first.outcome.detail}.`,
      });
      continue;
    }

    checked.push({
      id: entry.id,
      line: hit.line,
      claim: entry.claim,
      said: saidClaim,
      why: entry.why,
      paths: entry.expect.map((assertion) => assertion.path),
    });
  }

  // The notes the contract publishes that the table says nothing about. These
  // are not failures — the gate never blocks on a note it cannot read — but
  // they are the list of what to look at next.
  for (const paragraph of paragraphs) {
    if (coveredParagraphs.has(paragraph.startLine)) continue;
    const said = classify(paragraph.text);
    if (said.length === 0) continue;
    unchecked.push({
      line: paragraph.startLine,
      section: sectionAt(sections, paragraph.startLine),
      note: firstSentence(paragraph.text),
      claim: said.length === 1 ? (said[0] as Claim) : null,
      reason: 'no claim in the table checks this note.',
    });
  }

  unchecked.sort((left, right) => left.line - right.line);

  return {
    exitCode: failures.length > 0 ? 1 : 0,
    output: report(table, contractPath, tablePath, checked, unchecked, failures),
    checked,
    unchecked,
    failures,
  };
}

function sectionAt(sections: Section[], line: number): string {
  let title = '';
  for (const section of sections) {
    if (section.startLine <= line && line <= section.endLine) title = section.title;
  }
  return title;
}

function firstSentence(text: string): string {
  const end = text.indexOf('. ');
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  return sentence.length > 160 ? `${sentence.slice(0, 157)}...` : sentence;
}

function report(
  table: ClaimTable,
  contractPath: string,
  tablePath: string,
  checked: CheckedClaim[],
  unchecked: UncheckedNote[],
  failures: Failure[],
): string {
  const out: string[] = [];
  out.push('The contract status gate');
  out.push(`  contract     ${contractPath}`);
  out.push(`  claim table  ${tablePath}`);
  out.push(`  claims       ${table.claims.length} in the table`);
  out.push('');

  out.push(`Checked (${checked.length}):`);
  if (checked.length === 0) out.push('  none');
  for (const claim of checked) {
    out.push(`  ok    ${contractPath}:${claim.line}  [${claim.id}]  ${claim.claim}`);
    if (claim.why) out.push(`        ${claim.why}`);
    out.push(`        checked: ${claim.paths.join(', ')}`);
  }
  out.push('');

  out.push(`Unchecked (${unchecked.length}):`);
  if (unchecked.length === 0) out.push('  none');
  for (const note of unchecked) {
    out.push(`  ?     ${contractPath}:${note.line}  [${note.section}]`);
    out.push(`        ${note.note}`);
    out.push(`        ${note.reason}`);
  }
  out.push('');

  out.push(`Failures (${failures.length}):`);
  if (failures.length === 0) out.push('  none');
  for (const failure of failures) {
    const where = failure.line > 0 ? `${contractPath}:${failure.line}` : contractPath;
    out.push(`  FAIL  ${where}  [${failure.id}]`);
    out.push(`        ${failure.message}`);
  }
  out.push('');

  if (failures.length > 0) {
    out.push(
      `${failures.length} published claim${failures.length === 1 ? '' : 's'} no longer matches the tree.`,
    );
    out.push('The contract is not edited by this script — a false note is a human decision.');
  } else {
    out.push('Every claim in the table matches the tree.');
  }

  return `${out.join('\n')}\n`;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const root = path.resolve(option(args, '--root') ?? repoRoot);
  const contract = option(args, '--contract') ?? 'CONTRACTS.md';
  const table = option(args, '--table') ?? 'scripts/contract-status.json';

  const result = runGate({ root, contract, table });

  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}

// The module exports `runGate`, so an import that ran the command line would
// run the gate against the repository instead of the tree the caller named.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
