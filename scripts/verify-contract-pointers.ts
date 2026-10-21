/**
 * The gate that notices when the contract's pointers stop pointing.
 *
 * `CONTRACTS.md` cites the code by line number all over its prose —
 * `apps/server/src/api/helpers.ts:76`, `apps/server/src/modules/resources/service.ts:525`
 * and so on. Those citations go stale every time a nearby line changes, and
 * nothing notices until somebody reads one and finds the wrong code there.
 * Three work items have been spent correcting them by hand (WI-034, WI-103 and
 * the publication that is landing now), which makes it a class of defect and
 * not three coincidences.
 *
 * This gate is the mechanical version of "a claim that nothing verifies is a
 * weakness". It reads the contract, finds every citation of a TypeScript file
 * in it, and asks the tree three questions:
 *
 *   1. Is the file there? A citation of a file that is not in the tree points
 *      at nothing.
 *   2. Is the line in range? A citation past the end of the file points at
 *      nothing either.
 *   3. Does the line hold code? A blank line, a comment and a closing brace
 *      are all places a citation can point that are not code, and a citation
 *      that points at one of them is a citation that says nothing.
 *
 * It is the same shape as `scripts/verify-contract-status.ts`, which checks
 * the contract's implementation-status notes against the tree. That gate
 * reports the notes it has no claim for as *unchecked* rather than failing,
 * because a note it cannot read is not a false note. This gate has no such
 * judgement to make: a citation is a path and a line, and either it points at
 * code or it does not.
 *
 *   npx tsx scripts/verify-contract-pointers.ts
 *
 * The exit codes:
 *
 *   0 — every citation in the contract points at code.
 *   1 — a citation does not point at code.
 *   2 — the gate could not run: the contract is missing or unreadable.
 *
 * The script never edits the contract. Correcting a stale citation is a human
 * decision, and the contract is one file that several items hold at once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A citation in the contract: a path, and a line or a range of lines. */
export interface Pointer {
  /** The line of the contract the citation is written on. */
  contractLine: number;
  /** The path, exactly as the contract writes it. */
  path: string;
  /** The first cited line. */
  from: number;
  /** The last cited line. A citation of one line has `to === from`. */
  to: number;
  /** The citation as it is written, for the report. */
  text: string;
}

/** A citation that does not point at code. */
export interface Finding {
  /** The line of the contract the citation is written on. */
  contractLine: number;
  /** The citation as it is written. */
  pointer: string;
  /** Why the citation does not point at code. */
  reason: string;
}

export interface GateResult {
  exitCode: 0 | 1 | 2;
  output: string;
  pointers: Pointer[];
  findings: Finding[];
}

/** The gate could not run: the contract is missing or unreadable. */
export class GateError extends Error {}

/**
 * A citation inside a code span.
 *
 * The path may not be a bare file name — `waiting.ts:95` is a defect in the
 * contract, not a citation — so the path is captured as it is written and
 * judged afterwards.
 */
const POINTER = /([^\s`]+?\.tsx?):(\d+)(?:-(\d+))?/g;

/** The code spans in a line of markdown. */
const CODE_SPAN = /`([^`\n]+)`/g;

/** The markers a comment starts with, longest first so `/*` wins over `/`. */
const COMMENT_MARKERS = ['//', '/*', '*/', '*'];

/**
 * Every citation of a TypeScript file in the contract.
 *
 * A citation into a file that is not TypeScript — the contract cites its own
 * markdown and its JSON tables too — is left alone: this gate knows what code
 * looks like, and a line of prose is not code.
 */
export function readPointers(lines: string[]): Pointer[] {
  const pointers: Pointer[] = [];

  lines.forEach((line, index) => {
    for (const span of line.matchAll(CODE_SPAN)) {
      const text = span[1];
      if (text === undefined) continue;

      for (const match of text.matchAll(POINTER)) {
        const cited = match[0];
        const citedPath = match[1];
        const from = Number.parseInt(match[2] ?? '', 10);
        const to = match[3] === undefined ? from : Number.parseInt(match[3], 10);
        if (citedPath === undefined) continue;
        pointers.push({
          contractLine: index + 1,
          path: citedPath,
          from,
          to,
          text: cited,
        });
      }
    }
  });

  return pointers;
}

/**
 * Why a line of code is not worth citing, or null when it is.
 *
 * A line holds code when it is not blank and not a comment. **A closing brace
 * is code.** The earlier test asked a line for a letter, and `}` and `]);`
 * have none — so a citation of a whole function was reported as pointing at
 * nothing, and a function cannot be cited by its closing brace alone. A
 * bracket is code, and so is a line that carries only one.
 *
 * The phrase is written so that it reads after both "it" and "line 465": "is
 * empty", "is a comment".
 */
function codeFault(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return 'is empty';
  if (COMMENT_MARKERS.some((marker) => trimmed.startsWith(marker))) return 'is a comment';
  return null;
}

/**
 * Why a citation does not point at code, or null when it does.
 *
 * The path is resolved from the repository root, because a citation is a path
 * from the root. A bare file name is not one, and a citation that names one
 * cannot be followed by anybody reading the contract.
 */
export function checkPointer(root: string, pointer: Pointer): string | null {
  const relative = pointer.path.replace(/\\/g, '/').replace(/^\.\//, '');

  if (!relative.includes('/')) {
    return 'the pointer names no path (a bare file name is not a path from the root)';
  }

  const absolute = path.resolve(root, relative);
  const insideRoot = absolute === root || absolute.startsWith(`${root}${path.sep}`);
  if (!insideRoot || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return 'the file is not in the tree';
  }

  const lines = fs.readFileSync(absolute, 'utf8').split('\n');
  // A file that ends with a newline splits into a last empty line, which is
  // not a line of the file.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  if (pointer.from < 1) {
    return 'the cited line is not a line of the file (lines start at 1)';
  }
  if (pointer.to < pointer.from) {
    return `the range runs backwards (${pointer.from}-${pointer.to})`;
  }
  if (pointer.from > lines.length) {
    return `the cited line is past the end of the file (the file has ${lines.length} lines)`;
  }
  if (pointer.to > lines.length) {
    return `the cited range runs past the end of the file (the file has ${lines.length} lines)`;
  }

  // A citation that names one line must name a line of code. A citation that
  // names a range must name a block of code: its first line and its last line
  // both hold code, so the range starts and ends on code and cannot be a
  // comment that happens to sit between two lines.
  //
  // The earlier rule asked every line in the range to hold code. **That rule
  // was wrong twice over.** It called a closing brace a line with no code, so
  // a citation of a whole function failed for ending in `}`; and it made a
  // long block uncitable, because a block of code always contains a blank
  // line or a brace somewhere in the middle — thirty-seven lines of template
  // guides could never be cited as a block again.
  const first = codeFault(lines[pointer.from - 1] ?? '');
  if (first !== null) {
    return pointer.from === pointer.to
      ? `the cited line holds no code (it ${first})`
      : `the cited range starts on a line that holds no code (line ${pointer.from} ${first})`;
  }

  const last = codeFault(lines[pointer.to - 1] ?? '');
  if (last !== null) {
    return `the cited range ends on a line that holds no code (line ${pointer.to} ${last})`;
  }

  return null;
}

export interface GateOptions {
  /** The repository root the tree is read from. */
  root: string;
  /** The contract, relative to the root. */
  contract?: string;
}

/**
 * Run the gate.
 *
 * The function is pure with respect to the tree: it reads the contract and the
 * files it cites, and it writes neither. That is what lets the test point it
 * at a scratch copy and watch it fail.
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
        output: `The contract pointer gate could not run.\n  ${error.message}\n`,
        pointers: [],
        findings: [],
      };
    }
    throw error;
  }
}

function checkTheTree(options: GateOptions): GateResult {
  const root = path.resolve(options.root);
  const contractPath = options.contract ?? 'CONTRACTS.md';

  const contractFile = path.resolve(root, contractPath);
  if (!fs.existsSync(contractFile)) {
    throw new GateError(`The contract ${contractPath} is not in the tree.`);
  }

  const lines = fs.readFileSync(contractFile, 'utf8').split('\n');
  const pointers = readPointers(lines);

  const findings: Finding[] = [];
  for (const pointer of pointers) {
    const reason = checkPointer(root, pointer);
    if (reason === null) continue;
    findings.push({
      contractLine: pointer.contractLine,
      pointer: pointer.text,
      reason,
    });
  }

  return {
    exitCode: findings.length > 0 ? 1 : 0,
    output: report(contractPath, pointers.length, findings),
    pointers,
    findings,
  };
}

function report(contractPath: string, checked: number, findings: Finding[]): string {
  const out: string[] = [];
  out.push('The contract pointer gate');
  out.push(`  contract  ${contractPath}`);
  out.push(`  pointers  ${checked} checked`);
  out.push('');

  out.push(`Failures (${findings.length}):`);
  if (findings.length === 0) out.push('  none');
  for (const finding of findings) {
    out.push(
      `  FAIL  ${contractPath}:${finding.contractLine}  [${finding.pointer}]  ${finding.reason}`,
    );
  }
  out.push('');

  if (findings.length > 0) {
    out.push(
      `${findings.length} of the ${checked} pointer${checked === 1 ? '' : 's'} no longer point${findings.length === 1 ? 's' : ''} at code.`,
    );
  } else {
    out.push(`Every one of the ${checked} pointers points at code.`);
  }
  out.push(
    'The contract is not edited by this script — a stale pointer is a human decision, and the line numbers here are pointers for a human: they move with the contract.',
  );

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

  const result = runGate({ root, contract });

  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}

// The module exports `runGate`, so an import that ran the command line would
// run the gate against the repository instead of the tree the caller named.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
