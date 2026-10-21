/**
 * Give a work item its own branch and its own worktree — and read the queue.
 *
 * FACTORY.md says "one worktree per work item" and "one file, one live item",
 * because two agents in one checkout overwrite each other. It also says
 * "never open a work item twice" — posting it to the group and dispatching it
 * directly puts two workers in one tree, and the symptom is two agents each
 * reporting that "something else is modifying this repository".
 *
 * The rule was written down; it was not enforceable, because setting a
 * worktree up by hand is six git commands and a path convention that two
 * agents will not agree on. So every agent invented its own layout, and the
 * separation the factory depends on quietly stopped existing.
 *
 * This script is the one command that sets it up:
 *
 *   npx tsx scripts/work-item.ts new WI-017 forge-panel
 *   npx tsx scripts/work-item.ts list
 *   npx tsx scripts/work-item.ts remove WI-017
 *
 * `new` creates the branch `wi/017-forge-panel` and a worktree for it beside
 * the repository — beside it, not inside it, so a worktree can never be swept
 * into a commit by `git add -A` from the main checkout — then installs the
 * dependencies and builds the packages the gates need. It also writes the
 * item's own file, with the number in it, so the number and the file are born
 * together.
 *
 * `remove` takes the worktree away and deletes the branch, but only when the
 * branch is merged. An unmerged branch is somebody's work that has not landed
 * yet, and a script that deletes it is a script that loses work.
 *
 * The queue is a file a program can read.
 *
 * Every item file carries one YAML header block, and the prose below it stays
 * prose. The `**State:**` line is gone: two representations of the state is
 * the drift itself. `.factory/queue.json` is generated from those headers, it
 * is never hand-edited, and CI fails when it is out of date.
 *
 *   npx tsx scripts/work-item.ts queue --write
 *   npx tsx scripts/work-item.ts set WI-017 state verify --by Chief
 *   npx tsx scripts/work-item.ts check
 *   npx tsx scripts/work-item.ts claim
 *
 * `set` is the only writer of state. It refuses a transition the table does
 * not allow and it appends to the item's own history. `check` is the
 * validator: two live items claiming one file, one role owning two live items
 * that claim the same file, one number on two item files. `claim` prints the
 * live claims, from git's own worktree list and from the item headers.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where the worktrees live.
 *
 * A sibling of the repository rather than a directory inside it. A directory
 * inside the checkout is untracked by git, and every `git add -A` in the main
 * checkout would then try to stage another agent's entire working tree.
 */
function worktreeRoot(root = repoRoot): string {
  const parent = path.dirname(root);
  const name = path.basename(root);
  return path.join(parent, `${name}-worktrees`);
}

/** The branch name a work item gets: `wi/017-forge-panel`. */
function branchFor(id: string, slug: string): string {
  const number = id.replace(/^WI-/i, '');
  return `wi/${number}-${slug}`;
}

/** The directory a work item's worktree is created in. */
function pathFor(id: string, slug: string, root = repoRoot): string {
  return path.join(worktreeRoot(root), `${id.replace(/^WI-/i, '')}-${slug}`);
}

function git(args: string[], cwd = repoRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function gitOrNull(args: string[], cwd = repoRoot): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

/**
 * Whether a git command succeeds.
 *
 * `git merge-base --is-ancestor` reports its answer through its exit code
 * and prints nothing, so the output cannot be tested for emptiness — an empty
 * string is the successful answer, and it is falsey. The exit code is the
 * only thing that carries the answer.
 */
function gitSucceeds(args: string[], cwd = repoRoot): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * Run a command with its output going to the terminal.
 *
 * Nothing goes through a shell: the arguments are passed to the program
 * itself, so a path with a space in it is a path with a space in it.
 */
function run(command: string, args: string[], cwd = repoRoot): void {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

/**
 * How to run npm on this machine.
 *
 * `npm` is a batch file on Windows, and Node refuses to spawn a batch file
 * without a shell — and spawning it *with* a shell is deprecated, because
 * the arguments are concatenated rather than escaped. npm ships a JavaScript
 * entry point, so npm is run as `node npm-cli.js …` and no shell interprets
 * anything.
 *
 * The fallback is for a layout where npm is not installed beside node: the
 * shell is used, and Node prints a deprecation warning about it.
 */
function npmCommand(): { command: string; prefix: string[] } {
  const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (fs.existsSync(cli)) {
    return { command: process.execPath, prefix: [cli] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', prefix: [] };
}

// ─── The state machine ───────────────────────────────────────────────────────

/**
 * The states a work item can be in.
 *
 * Six steps and two terminal states. `done` is not one of them: an item is
 * either accepted by Chief or cancelled, and a half-measure between the two
 * is what let `done` into the files in the first place.
 */
export const WORK_STATES = [
  'intake',
  'triage',
  'implement',
  'verify',
  'review',
  'accepted',
  'cancelled',
  'superseded',
] as const;

export type WorkState = (typeof WORK_STATES)[number];

/** The states an item never comes back from. */
export const TERMINAL_STATES: readonly WorkState[] = ['accepted', 'cancelled', 'superseded'];

/**
 * The role tokens an owner or a verifier can be.
 *
 * One token, never a sentence. "Cog (the code), with the contract half for
 * Wren" is two owners wearing one hat, and FACTORY.md says a work item with
 * two owners is two work items.
 */
export const ROLE_TOKENS = ['Chief', 'Cog', 'Probe', 'Wren', 'Vision'] as const;

export type RoleToken = (typeof ROLE_TOKENS)[number];

export interface TransitionRule {
  /** The state the item is in, or `*` for any state. */
  from: WorkState | '*';
  to: WorkState;
  /** Who may make this transition. */
  who: RoleToken;
  /**
   * Whether the tool may make this transition on the strength of evidence
   * alone. Exactly one transition is automatic, and it is the one that only
   * moves the item to the next gate.
   */
  automatic: boolean;
  /** What has to be true for the transition to be allowed. */
  evidence: string;
}

/**
 * The transitions, and who may make them.
 *
 * The load-bearing row is `implement → verify`: it is the only transition the
 * tool makes on the strength of evidence, and its evidence is machine-checked
 * — the landed sha and CI green on that sha. `review → accepted` is Chief's
 * alone and is never automatic, because the evidence for it is a review, and a
 * review is a human artefact the tool cannot check.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: '*',
    to: 'intake',
    who: 'Chief',
    automatic: false,
    evidence: 'the want in .factory/INTAKE.md',
  },
  {
    from: 'intake',
    to: 'triage',
    who: 'Chief',
    automatic: false,
    evidence: 'the owner set to exactly one role token',
  },
  {
    from: 'triage',
    to: 'implement',
    who: 'Chief',
    automatic: false,
    evidence: 'a dispatch id, a branch and a worktree recorded',
  },
  {
    from: 'implement',
    to: 'verify',
    who: 'Chief',
    automatic: true,
    evidence: 'the landed sha, and CI green on that sha',
  },
  {
    from: 'verify',
    to: 'review',
    who: 'Probe',
    automatic: false,
    evidence: "Probe's report against the criteria",
  },
  {
    from: 'review',
    to: 'accepted',
    who: 'Chief',
    automatic: false,
    evidence: 'every gate green on the landed sha',
  },
  {
    from: 'review',
    to: 'implement',
    who: 'Chief',
    automatic: false,
    evidence: 'the findings attached',
  },
  {
    from: '*',
    to: 'cancelled',
    who: 'Chief',
    automatic: false,
    evidence: 'a reason; the dispatch is released and its id becomes reserved',
  },
  {
    from: '*',
    to: 'superseded',
    who: 'Chief',
    automatic: false,
    evidence: 'the item it supersedes, named',
  },
];

/** The rule that allows a transition, or null when the table does not have one. */
export function transitionFor(from: string, to: string): TransitionRule | null {
  return (
    TRANSITIONS.find((rule) => (rule.from === '*' || rule.from === from) && rule.to === to) ?? null
  );
}

/** Whether a state is one the repository publishes. */
export function isKnownState(state: string): boolean {
  return (WORK_STATES as readonly string[]).includes(state);
}

/** Whether an item in this state is still in the factory. */
export function isLive(state: string): boolean {
  return !TERMINAL_STATES.includes(state as WorkState);
}

// ─── The header block ────────────────────────────────────────────────────────

export interface CiCheck {
  name: string;
  status: string;
  conclusion: string | null;
  url: string | null;
}

export interface CiEvidence {
  sha: string;
  conclusion: string;
  checks: CiCheck[];
  fetchedAt: string;
}

export interface HistoryEntry {
  at: string;
  from: string | null;
  to: string;
  by: string;
  note?: string;
  ci?: CiEvidence;
}

export interface WorkItemHeader {
  id: string;
  title: string;
  state: string;
  stateReason: string | null;
  owner: string | null;
  verifier: string | null;
  opened: string | null;
  numbered: string | null;
  dispatched: string | null;
  dispatchId: string | null;
  landed: string | null;
  landedSha: string | null;
  branch: string | null;
  worktree: string | null;
  blockedBy: string[];
  files: string[];
  history: HistoryEntry[];
}

/**
 * The fields of the header, in the order they are written.
 *
 * The order is fixed because the file is a record a person reads as well as a
 * record a program reads, and a stable order is what makes a diff of two
 * headers a diff of the two items rather than of the writer's mood.
 */
const HEADER_FIELDS = [
  'id',
  'title',
  'state',
  'stateReason',
  'owner',
  'verifier',
  'opened',
  'numbered',
  'dispatched',
  'dispatchId',
  'landed',
  'landedSha',
  'branch',
  'worktree',
  'blockedBy',
  'files',
  'history',
] as const;

/**
 * The header of an empty item.
 *
 * `new` writes this, and the owner fills it in. The state is `intake` because
 * that is where an item starts: the want is recorded, and nobody owns it yet.
 */
export function emptyHeader(id: string, title: string): WorkItemHeader {
  return {
    id,
    title,
    state: 'intake',
    stateReason: null,
    owner: null,
    verifier: null,
    opened: null,
    numbered: null,
    dispatched: null,
    dispatchId: null,
    landed: null,
    landedSha: null,
    branch: null,
    worktree: null,
    blockedBy: [],
    files: [],
    history: [],
  };
}

type YamlNode = string | null | YamlNode[] | { [key: string]: YamlNode };

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Split a flow collection's body on the commas that separate its items.
 *
 * A comma inside a quoted string is not a separator, so the split walks the
 * text rather than using `split(',')`.
 */
function splitFlow(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;

  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ',') {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

function parseYamlInline(text: string): YamlNode {
  if (text === 'null' || text === '~') return null;
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map((part) => parseYamlInline(part));
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    const inner = text.slice(1, -1).trim();
    const map: Record<string, YamlNode> = {};
    if (inner === '') return map;
    for (const part of splitFlow(inner)) {
      const colon = part.indexOf(':');
      if (colon === -1) throw new Error(`"${part}" is not a field of the flow mapping`);
      map[part.slice(0, colon).trim()] = parseYamlInline(part.slice(colon + 1).trim());
    }
    return map;
  }
  if (text.startsWith('"')) return JSON.parse(text) as string;
  if (text.startsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  return text;
}

function parseYamlMapping(
  lines: string[],
  index: number,
  indent: number,
): [Record<string, YamlNode>, number] {
  const map: Record<string, YamlNode> = {};
  let i = index;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const currentIndent = indentOf(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new Error(`the header block is indented unevenly at "${line.trim()}"`);
    }

    const trimmed = line.trim();
    const match = /^([^:]+):(.*)$/.exec(trimmed);
    if (!match) throw new Error(`"${trimmed}" is not a field of the header block`);

    const key = (match[1] ?? '').trim();
    const rest = (match[2] ?? '').trim();

    if (rest !== '') {
      map[key] = parseYamlInline(rest);
      i += 1;
      continue;
    }

    const next = lines[i + 1];
    if (next !== undefined && indentOf(next) > indent) {
      const [value, consumed] = parseYamlNode(lines, i + 1, indentOf(next));
      map[key] = value;
      i = consumed;
      continue;
    }

    map[key] = null;
    i += 1;
  }

  return [map, i];
}

function parseYamlSequence(lines: string[], index: number, indent: number): [YamlNode[], number] {
  const items: YamlNode[] = [];
  let i = index;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (indentOf(line) !== indent) break;
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) break;

    const inline = trimmed.slice(2).trim();

    if (inline === '') {
      const next = lines[i + 1];
      if (next !== undefined && indentOf(next) > indent) {
        const [value, consumed] = parseYamlNode(lines, i + 1, indentOf(next));
        items.push(value);
        i = consumed;
        continue;
      }
      items.push(null);
      i += 1;
      continue;
    }

    if (/^[^:]+:(\s|$)/.test(inline)) {
      // The item is a mapping. The dash stands where its first key's
      // indentation starts, so the keys line up under it.
      const next = lines[i + 1];
      const contentIndent =
        next !== undefined && indentOf(next) > indent ? indentOf(next) : indent + 2;
      const rewritten = [...lines];
      rewritten[i] = ' '.repeat(contentIndent) + inline;
      const [value, consumed] = parseYamlMapping(rewritten, i, contentIndent);
      items.push(value);
      i = consumed;
      continue;
    }

    items.push(parseYamlInline(inline));
    i += 1;
  }

  return [items, i];
}

function parseYamlNode(lines: string[], index: number, indent: number): [YamlNode, number] {
  const first = lines[index] ?? '';
  if (indentOf(first) !== indent) {
    throw new Error(`the header block is indented unevenly at "${first.trim()}"`);
  }
  if (first.trim().startsWith('- ')) {
    const [items, next] = parseYamlSequence(lines, index, indent);
    return [items, next];
  }
  const [map, next] = parseYamlMapping(lines, index, indent);
  return [map, next];
}

/**
 * Read a YAML header block.
 *
 * This is a parser for one fixed shape — a mapping of scalars, lists and
 * mappings — and not for YAML in general. The shape is fixed because the
 * header is written by this script and read by this script, and a dependency
 * on a YAML library for a dozen lines of structure would be a dependency the
 * repository does not need.
 */
export function parseYamlBlock(text: string): Record<string, YamlNode> {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return {};
  const [node] = parseYamlNode(lines, 0, indentOf(lines[0] ?? ''));
  if (node === null || Array.isArray(node) || typeof node !== 'object') {
    throw new Error('the header block is not a mapping');
  }
  return node;
}

/** Whether a value can be written as a plain YAML scalar. */
function isPlainScalar(value: string): boolean {
  if (value === '') return false;
  if (value !== value.trim()) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return false;
  if (value.includes(': ')) return false;
  if (value.includes(' #')) return false;
  if (value.endsWith(':')) return false;
  if (/[\n\r\t]/.test(value)) return false;
  if (['null', 'true', 'false', '~'].includes(value)) return false;
  return true;
}

/**
 * Write a value as a YAML scalar.
 *
 * The quoting follows the formatter's own preference, because the header is
 * rewritten by `set` and the file has to stay formatted: a plain scalar when
 * it can be one, and otherwise single quotes. The double quotes are used only
 * when the value carries a single quote and no double quote of its own,
 * because then the double quotes are the cheaper escape.
 */
export function yamlScalar(value: string | null): string {
  if (value === null) return 'null';
  if (value === '') return "''";
  if (isPlainScalar(value)) return value;
  if (/[\n\r\t]/.test(value)) return JSON.stringify(value);
  if (value.includes("'") && !value.includes('"')) return JSON.stringify(value);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Write a list of values.
 *
 * A flow list is one line and reads well; a block list is what a long list
 * becomes. Prettier draws the line at the same width, so the choice here is
 * the choice the formatter would make anyway.
 */
function yamlList(key: string, values: string[]): string[] {
  if (values.length === 0) return [`${key}: []`];
  const flow = `${key}: [${values.map((value) => yamlScalar(value)).join(', ')}]`;
  if (flow.length <= 100) return [flow];
  return [`${key}:`, ...values.map((value) => `  - ${yamlScalar(value)}`)];
}

function serialiseHistory(entry: HistoryEntry): string[] {
  const lines = [`  - at: ${yamlScalar(entry.at)}`];
  lines.push(`    from: ${yamlScalar(entry.from)}`);
  lines.push(`    to: ${yamlScalar(entry.to)}`);
  lines.push(`    by: ${yamlScalar(entry.by)}`);
  if (entry.note !== undefined) lines.push(`    note: ${yamlScalar(entry.note)}`);
  if (entry.ci) {
    lines.push('    ci:');
    lines.push(`      sha: ${yamlScalar(entry.ci.sha)}`);
    lines.push(`      conclusion: ${yamlScalar(entry.ci.conclusion)}`);
    lines.push(`      fetchedAt: ${yamlScalar(entry.ci.fetchedAt)}`);
    if (entry.ci.checks.length === 0) {
      lines.push('      checks: []');
    } else {
      lines.push('      checks:');
      for (const check of entry.ci.checks) {
        lines.push(`        - name: ${yamlScalar(check.name)}`);
        lines.push(`          status: ${yamlScalar(check.status)}`);
        lines.push(`          conclusion: ${yamlScalar(check.conclusion)}`);
        lines.push(`          url: ${yamlScalar(check.url)}`);
      }
    }
  }
  return lines;
}

/** Write the header block, in the one shape every item file uses. */
export function serialiseHeader(header: WorkItemHeader): string {
  const lines: string[] = ['---'];
  for (const field of HEADER_FIELDS) {
    const value = header[field];
    if (field === 'blockedBy' || field === 'files') {
      lines.push(...yamlList(field, value as string[]));
      continue;
    }
    if (field === 'history') {
      const history = value as HistoryEntry[];
      if (history.length === 0) {
        lines.push('history: []');
        continue;
      }
      lines.push('history:');
      for (const entry of history) lines.push(...serialiseHistory(entry));
      continue;
    }
    lines.push(`${field}: ${yamlScalar(value as string | null)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function asString(value: YamlNode | undefined): string | null {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return null;
  throw new Error('a header field that should hold text holds something else');
}

function asStringList(value: YamlNode | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((item) => asString(item) ?? '');
  throw new Error('a header field that should hold a list holds something else');
}

function asHistory(value: YamlNode | undefined): HistoryEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('the history field is not a list');
  return value.map((item) => {
    if (item === null || Array.isArray(item) || typeof item !== 'object') {
      throw new Error('a history entry is not a mapping');
    }
    const entry: HistoryEntry = {
      at: asString(item['at']) ?? '',
      from: asString(item['from']),
      to: asString(item['to']) ?? '',
      by: asString(item['by']) ?? '',
    };
    const note = asString(item['note']);
    if (note !== null) entry.note = note;
    const ci = item['ci'];
    if (ci && typeof ci === 'object' && !Array.isArray(ci)) {
      const checks = ci['checks'];
      entry.ci = {
        sha: asString(ci['sha']) ?? '',
        conclusion: asString(ci['conclusion']) ?? '',
        fetchedAt: asString(ci['fetchedAt']) ?? '',
        checks: Array.isArray(checks)
          ? checks.map((check) => {
              if (check === null || Array.isArray(check) || typeof check !== 'object') {
                throw new Error('a CI check is not a mapping');
              }
              return {
                name: asString(check['name']) ?? '',
                status: asString(check['status']) ?? '',
                conclusion: asString(check['conclusion']),
                url: asString(check['url']),
              };
            })
          : [],
      };
    }
    return entry;
  });
}

function headerFromMap(map: Record<string, YamlNode>): WorkItemHeader {
  return {
    id: asString(map['id']) ?? '',
    title: asString(map['title']) ?? '',
    state: asString(map['state']) ?? '',
    stateReason: asString(map['stateReason']),
    owner: asString(map['owner']),
    verifier: asString(map['verifier']),
    opened: asString(map['opened']),
    numbered: asString(map['numbered']),
    dispatched: asString(map['dispatched']),
    dispatchId: asString(map['dispatchId']),
    landed: asString(map['landed']),
    landedSha: asString(map['landedSha']),
    branch: asString(map['branch']),
    worktree: asString(map['worktree']),
    blockedBy: asStringList(map['blockedBy']),
    files: asStringList(map['files']),
    history: asHistory(map['history']),
  };
}

export interface ParsedItem {
  /** The header, or null when the file does not carry one. */
  header: WorkItemHeader | null;
  /** Everything after the header block. */
  body: string;
}

/**
 * Split an item file into its header and its prose.
 *
 * A file without a header block is not an error here: it is an item that has
 * not been migrated yet, and the index says so rather than pretending the
 * file said nothing.
 */
export function parseItem(content: string): ParsedItem {
  if (!content.startsWith('---\n')) return { header: null, body: content };

  const close = content.indexOf('\n---\n', 3);
  if (close === -1) return { header: null, body: content };

  const block = content.slice(4, close);
  const body = content.slice(close + 5);
  return { header: headerFromMap(parseYamlBlock(block)), body };
}

/** An item file, written back out. */
export function writeItem(header: WorkItemHeader, body: string): string {
  return `${serialiseHeader(header)}\n${body}`;
}

// ─── The index ───────────────────────────────────────────────────────────────

export interface QueueEntry {
  id: string;
  title: string | null;
  /** The item's file, relative to the repository root. */
  file: string;
  state: string | null;
  stateReason: string | null;
  owner: string | null;
  verifier: string | null;
  openedAt: string | null;
  numberedAt: string | null;
  dispatchedAt: string | null;
  dispatchId: string | null;
  landedAt: string | null;
  landedSha: string | null;
  branch: string | null;
  worktree: string | null;
  blockedBy: string[];
  files: string[];
  ci: CiEvidence | null;
  history: HistoryEntry[];
  /**
   * Why this entry is not the full record, when it is not.
   *
   * An item whose file has not been migrated, or whose file is not in this
   * checkout, still appears — with the reason it is incomplete. An item that
   * is missing from the index is an item nobody can see, and that is the
   * failure this index exists to stop.
   */
  blockedReason: string | null;
  /** The refs this item's file was found on. */
  sourceRefs: string[];
}

const ITEM_FILE_PATTERN = /^(?:WI-\d+)\.md$/;

/** The item id a file name carries. */
export function idFromFileName(name: string): string {
  return name.replace(/\.md$/, '');
}

/**
 * The item files in a checkout.
 *
 * A file that is not named after an item is not an item, and reading it as
 * one would put a row in the index that no item can be found by.
 */
export function listLocalItemFiles(root: string): Map<string, string> {
  const dir = path.join(root, '.factory', 'work');
  const files = new Map<string, string>();
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!ITEM_FILE_PATTERN.test(name)) continue;
    // The path in the index is written with forward slashes, because the
    // index is committed and CI regenerates it on a machine whose path
    // separator is the other one.
    files.set(idFromFileName(name), `.factory/work/${name}`);
  }
  return files;
}

/**
 * The refs this repository knows about.
 *
 * Every branch is a ref, and a branch is where an item's file may live when
 * it has not landed yet. An item that is only on a branch is still in the
 * queue, and the index says which branch it is on.
 */
export function listRefs(root: string): string[] {
  const raw =
    gitOrNull(
      ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'],
      root,
    ) ?? '';
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line !== 'origin' && !line.endsWith('/HEAD'))
    .sort();
}

/** The item files a ref carries. */
export function listItemFilesOnRef(root: string, ref: string): string[] {
  const raw = gitOrNull(['ls-tree', '-r', '--name-only', ref, '--', '.factory/work'], root);
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => ITEM_FILE_PATTERN.test(path.basename(line)))
    .sort();
}

/**
 * The item files every ref carries, remembered for the life of the process.
 *
 * The scan is one git call per ref, and the tool makes it twice in a single
 * command — once for the index and once for the number space — and a test
 * makes it several times. The answer does not change while the process runs:
 * the refs do not move under it.
 */
const refItemFiles = new Map<string, Map<string, string[]>>();

/** The item files every ref carries. */
export function itemFilesByRef(root: string): Map<string, string[]> {
  const cached = refItemFiles.get(root);
  if (cached) return cached;

  const map = new Map<string, string[]>();
  for (const ref of listRefs(root)) {
    map.set(ref, listItemFilesOnRef(root, ref));
  }
  refItemFiles.set(root, map);
  return map;
}

/**
 * Read many files out of the repository in one go.
 *
 * `git cat-file --batch` reads a list of objects from one process. The
 * alternative — a `git show` per file — is a process per file, and the check
 * that looks for a number on two item files reads every item file on every
 * ref.
 */
export function gitCatFileBatch(root: string, specs: string[]): Map<string, string> {
  const contents = new Map<string, string>();
  if (specs.length === 0) return contents;

  const raw = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: `${specs.join('\n')}\n`,
    maxBuffer: 256 * 1024 * 1024,
  }) as unknown as Buffer;

  let offset = 0;
  for (const spec of specs) {
    const newline = raw.indexOf(0x0a, offset);
    if (newline === -1) break;
    const header = raw.subarray(offset, newline).toString('utf8');
    offset = newline + 1;

    const size = Number(header.split(' ')[2]);
    if (!Number.isFinite(size)) {
      contents.set(spec, '');
      continue;
    }
    contents.set(spec, raw.subarray(offset, offset + size).toString('utf8'));
    offset += size + 1;
  }

  return contents;
}

function entryFromContent(
  id: string,
  file: string,
  content: string,
  blockedReason: string | null,
): QueueEntry {
  const parsed = parseItem(content);
  const header = parsed.header;

  if (!header) {
    return {
      id,
      title: null,
      file,
      state: null,
      stateReason: null,
      owner: null,
      verifier: null,
      openedAt: null,
      numberedAt: null,
      dispatchedAt: null,
      dispatchId: null,
      landedAt: null,
      landedSha: null,
      branch: null,
      worktree: null,
      blockedBy: [],
      files: [],
      ci: null,
      history: [],
      blockedReason: blockedReason ?? 'the file carries no header block yet',
      sourceRefs: [],
    };
  }

  const ci = [...header.history].reverse().find((entry) => entry.ci)?.ci ?? null;

  return {
    id: header.id || id,
    title: header.title || null,
    file,
    state: header.state || null,
    stateReason: header.stateReason,
    owner: header.owner,
    verifier: header.verifier,
    openedAt: header.opened,
    numberedAt: header.numbered,
    dispatchedAt: header.dispatched,
    dispatchId: header.dispatchId,
    landedAt: header.landed,
    landedSha: header.landedSha,
    branch: header.branch,
    worktree: header.worktree,
    blockedBy: header.blockedBy,
    files: header.files,
    ci,
    history: header.history,
    blockedReason,
    sourceRefs: [],
  };
}

/**
 * The index, read from the item files.
 *
 * The index is a pure function of the repository: the same tree always
 * produces the same bytes. That is what lets CI regenerate it and fail when
 * the tree is dirty, and it is why nothing in here asks the network whether
 * CI is green — a verdict that changes every minute would make the index
 * churn and the gate meaningless.
 */
export function buildQueue(root: string): QueueEntry[] {
  const entries = new Map<string, QueueEntry>();
  const local = listLocalItemFiles(root);

  for (const [id, file] of local) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    entries.set(id, entryFromContent(id, file, content, null));
  }

  const refs = listRefs(root);
  const specs: string[] = [];
  const refFiles = new Map<string, string[]>();
  for (const ref of refs) {
    const files = itemFilesByRef(root).get(ref) ?? [];
    refFiles.set(ref, files);
    for (const file of files) {
      const id = idFromFileName(path.basename(file));
      if (!local.has(id)) specs.push(`${ref}:${file}`);
    }
  }

  const contents = gitCatFileBatch(root, specs);
  for (const ref of refs) {
    for (const file of refFiles.get(ref) ?? []) {
      const id = idFromFileName(path.basename(file));
      if (entries.has(id)) continue;
      const content = contents.get(`${ref}:${file}`) ?? '';
      const entry = entryFromContent(
        id,
        file,
        content,
        'the item file is not in this checkout; it is on a branch that has not landed',
      );
      entry.sourceRefs.push(ref);
      entries.set(id, entry);
    }
  }

  return [...entries.values()].sort((left, right) => {
    const leftNumber = Number(left.id.replace(/^WI-/i, ''));
    const rightNumber = Number(right.id.replace(/^WI-/i, ''));
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return left.id.localeCompare(right.id);
  });
}

/**
 * The width the formatter prints to.
 *
 * The index is committed and the formatter runs over it, so the generator
 * has to write the layout the formatter would write: a group on one line
 * when it fits in the width, expanded when it does not. A generator with its
 * own layout would leave the tree dirty every time the two disagreed.
 */
const PRINT_WIDTH = 100;

/** The flat form of a value, as the formatter would print it. */
function jsonInline(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonInline(item)).join(', ')}]`;
  }
  const parts = Object.entries(value as Record<string, unknown>).map(
    ([key, item]) => `${JSON.stringify(key)}: ${jsonInline(item)}`,
  );
  return `{ ${parts.join(', ')} }`;
}

/** A value, on one line when it fits in the width and expanded when it does not. */
function jsonValue(value: unknown, indent: number, prefix: string): string {
  const inline = jsonInline(value);
  if (prefix.length + inline.length <= PRINT_WIDTH) return inline;

  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    const itemPad = ' '.repeat(indent + 2);
    const items = value.map((item) => `${itemPad}${jsonValue(item, indent + 2, itemPad)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  const memberPad = ' '.repeat(indent + 2);
  const members = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    const keyText = `${JSON.stringify(key)}: `;
    return `${memberPad}${keyText}${jsonValue(item, indent + 2, memberPad + keyText)}`;
  });
  return `{\n${members.join(',\n')}\n${pad}}`;
}

/** The index as the bytes that go into `.factory/queue.json`. */
export function renderQueue(entries: QueueEntry[]): string {
  return `${jsonValue(entries, 0, '')}\n`;
}

// ─── The worktrees ───────────────────────────────────────────────────────────

interface Worktree {
  path: string;
  head: string;
  branch: string | null;
}

/**
 * Every worktree git knows about.
 *
 * Read from `git worktree list --porcelain` rather than from the filesystem:
 * the porcelain form is the one git guarantees, and a directory that looks
 * like a worktree but is not registered is not one.
 */
function listWorktrees(root: string): Worktree[] {
  const raw = git(['worktree', 'list', '--porcelain'], root);
  const worktrees: Worktree[] = [];
  let current: Partial<Worktree> = {};

  const flush = (): void => {
    if (current.path) {
      worktrees.push({
        path: current.path,
        head: current.head ?? '',
        branch: current.branch ?? null,
      });
    }
    current = {};
  };

  for (const line of raw.split('\n')) {
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('worktree ')) {
      current.path = line.slice('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    }
  }
  flush();

  return worktrees;
}

/**
 * The work items that already have a worktree, by work item number.
 *
 * The number is what a `.factory/work/WI-0xx.md` file carries, so this is how
 * a worktree is matched back to the item it belongs to.
 */
function worktreesByNumber(root: string): Map<string, Worktree> {
  const map = new Map<string, Worktree>();
  for (const worktree of listWorktrees(root)) {
    if (!worktree.branch) continue;
    const match = /^wi\/(\d+)-/.exec(worktree.branch);
    const number = match?.[1];
    if (number) {
      map.set(number, worktree);
    }
  }
  return map;
}

/**
 * The commit a new work item branches from.
 *
 * The integration branch is `main`, and whichever of `main` and
 * `origin/main` is ahead of the other is the newer of the two — so that is
 * the base. This matters more than it looks: the local `main` is often
 * ahead of the remote, because work lands on `main` before it is pushed,
 * and a work item that started from `origin/main` would begin without the
 * last few commits. A work item that does not have the current code is a
 * work item whose every gate runs against the wrong tree.
 *
 * When the two have diverged — somebody pushed `main` from another clone —
 * the local `main` is the base, and the pre-push hook catches the
 * divergence when the branch is pushed and says what to do about it.
 */
function baseRef(root: string): string {
  const hasMain = gitSucceeds(['rev-parse', '--verify', 'main'], root);
  const hasOrigin = gitSucceeds(['rev-parse', '--verify', 'origin/main'], root);

  if (!hasMain) return 'origin/main';
  if (!hasOrigin) return 'main';
  if (gitSucceeds(['merge-base', '--is-ancestor', 'origin/main', 'main'], root)) return 'main';
  if (gitSucceeds(['merge-base', '--is-ancestor', 'main', 'origin/main'], root))
    return 'origin/main';
  return 'main';
}

/**
 * The next free work item number.
 *
 * The maximum number on `main` and on every open `wi/*` branch, plus one. The
 * branches count because a branch is an allocated number even when the work
 * on it has not landed: the number space is the set of numbers that have been
 * taken, and a number taken on a branch is taken.
 */
export function nextItemNumber(root: string): number {
  let highest = 0;
  const refs = ['main', 'origin/main', ...listRefs(root).filter((ref) => /(^|\/)wi\//.test(ref))];

  for (const ref of refs) {
    for (const file of itemFilesByRef(root).get(ref) ?? []) {
      const number = Number(idFromFileName(path.basename(file)).replace(/^WI-/i, ''));
      if (Number.isFinite(number) && number > highest) highest = number;
    }
  }

  return highest + 1;
}

/**
 * Whether a number is unused on every ref.
 *
 * A number that is used anywhere is spent: numbers are never recycled and
 * never renamed, so a cancelled item keeps its number and its file.
 */
export function isNumberUnused(root: string, number: number): boolean {
  const wanted = `WI-${String(number).padStart(3, '0')}`;
  const refs = ['main', 'origin/main', ...listRefs(root)];

  for (const ref of refs) {
    const files = itemFilesByRef(root).get(ref) ?? [];
    for (const file of files) {
      if (idFromFileName(path.basename(file)) === wanted) return false;
    }
  }

  return true;
}

// ─── The commands ────────────────────────────────────────────────────────────

function cmdNew(args: string[]): void {
  const install = !args.includes('--no-install');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const override = args.find((arg) => arg.startsWith('--number='));

  const explicitId = positional.find((value) => /^WI-\d+$/i.test(value));
  const slug = positional.find((value) => value !== explicitId);

  if (!slug) {
    fail(
      'Usage: npx tsx scripts/work-item.ts new [WI-nnn] <slug> [--number n] [--no-install]\n\n' +
        '  The number is computed when it is not given: the next free number above\n' +
        '  main and every open wi/* branch.\n',
    );
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fail(`"${slug}" is not a slug. Use lower case and hyphens: forge-panel.`);
  }

  let number: number;
  if (explicitId) {
    number = Number(explicitId.replace(/^WI-/i, ''));
  } else if (override) {
    const requested = Number(override.slice('--number='.length));
    if (!Number.isFinite(requested)) {
      fail(`"${override}" is not a number. The override looks like --number=74.`);
    }
    number = requested;
  } else {
    number = nextItemNumber(repoRoot);
  }

  const id = `WI-${String(number).padStart(3, '0')}`;

  if (!isNumberUnused(repoRoot, number)) {
    fail(
      `The number ${id} is already used on a ref in this repository.\n` +
        'Numbers are never recycled and never renamed. Run "new" without a number to\n' +
        'take the next free one.',
    );
  }

  const branch = branchFor(id, slug);
  const target = pathFor(id, slug);
  const exists = gitSucceeds(['rev-parse', '--verify', `refs/heads/${branch}`]);

  if (exists) {
    fail(
      `The branch "${branch}" already exists.\n` +
        'Use a different slug, or work in the worktree that already has it.',
    );
  }
  if (fs.existsSync(target)) {
    // A directory left behind by a worktree that git removed but could not
    // delete, because the installed `node_modules` is untracked and git
    // leaves untracked files alone. The path is derived from the work item,
    // so it belongs to the work item, and this script is what clears it.
    //
    // A directory that still holds a `.git` file is a live worktree, and
    // that is not this script's to delete.
    if (fs.existsSync(path.join(target, '.git'))) {
      fail(
        `${target} already exists and is a live worktree.\n` +
          'Work in it, or remove it first: npx tsx scripts/work-item.ts remove ' +
          id,
      );
    }
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(worktreeRoot(), { recursive: true });

  // Fetch first, so the base is chosen against the current remote rather
  // than against a stale copy of it. A fetch only moves the remote-tracking
  // refs; it does not touch the working tree or the local branches.
  const fetched = gitOrNull(['fetch', 'origin']);
  if (fetched === null) {
    process.stdout.write('Note: the fetch failed, so the base was chosen without it.\n');
  }

  const base = baseRef(repoRoot);
  process.stdout.write(`Creating ${branch} from ${base} at ${target}\n`);
  run('git', ['worktree', 'add', '-b', branch, target, base]);

  // The number and the file are born together. The file carries the header
  // block, so the queue can read this item from the moment it exists.
  const header = emptyHeader(id, slug.replace(/-/g, ' '));
  header.branch = branch;
  header.worktree = target;
  header.opened = new Date().toISOString().slice(0, 10);
  header.numbered = header.opened;
  const itemFile = path.join(target, '.factory', 'work', `${id}.md`);
  fs.mkdirSync(path.dirname(itemFile), { recursive: true });
  fs.writeFileSync(
    itemFile,
    writeItem(
      header,
      `\n# ${id} — ${header.title}\n\n### Problem\n\nWhat is wrong or missing, in one paragraph.\n`,
    ),
    'utf8',
  );

  if (!install) {
    process.stdout.write(
      '\nDone. The dependencies are not installed, so run "npm ci --ignore-scripts" ' +
        'in the worktree before the gates will pass.\n',
    );
    return;
  }

  process.stdout.write('\nInstalling the dependencies (npm ci --ignore-scripts)…\n');
  const npm = npmCommand();
  run(npm.command, [...npm.prefix, 'ci', '--ignore-scripts'], target);
  process.stdout.write('\nBuilding the packages the gates need (npm run build:deps)…\n');
  run(npm.command, [...npm.prefix, 'run', 'build:deps'], target);

  process.stdout.write(
    `\nReady. Work in ${target} on ${branch}.\n` +
      'Push it with "git push -u origin HEAD" — the branch is yours to push.\n',
  );
}

function cmdList(): void {
  const worktrees = listWorktrees(repoRoot);
  const byNumber = worktreesByNumber(repoRoot);
  const entries = buildQueue(repoRoot);

  process.stdout.write('Worktrees:\n');
  for (const worktree of worktrees) {
    const branch = worktree.branch ?? '(detached)';
    const marker = worktree.path === repoRoot ? ' <- main checkout' : '';
    process.stdout.write(`  ${branch.padEnd(32)} ${worktree.path}${marker}\n`);
  }

  process.stdout.write('\nWork items:\n');
  if (entries.length === 0) {
    process.stdout.write('  none\n');
    return;
  }

  // The table is read from the index, so the table and the index cannot
  // disagree: there is one source and two views of it.
  for (const entry of entries) {
    const state = entry.state ?? 'not-migrated';
    const reason = entry.blockedReason ? ` (${entry.blockedReason})` : '';
    process.stdout.write(
      `  ${entry.id.padEnd(8)} ${state.padEnd(12)} ${(entry.owner ?? 'unowned').padEnd(8)} ${entry.title ?? ''}${reason}\n`,
    );
  }

  const withWorktree = entries.filter((entry) => byNumber.has(entry.id.replace(/^WI-/i, '')));
  if (withWorktree.length > 0) {
    process.stdout.write('\nWork items with a worktree:\n');
    for (const entry of withWorktree) {
      const worktree = byNumber.get(entry.id.replace(/^WI-/i, ''));
      process.stdout.write(
        `  ${entry.id.padEnd(8)} ${entry.state ?? 'not migrated'} ${worktree?.path}\n`,
      );
    }
  }
}

function cmdQueue(args: string[]): void {
  const entries = buildQueue(repoRoot);
  const json = renderQueue(entries);

  if (args.includes('--write')) {
    const target = path.join(repoRoot, '.factory', 'queue.json');
    fs.writeFileSync(target, json, 'utf8');
    process.stdout.write(`Wrote ${path.relative(repoRoot, target)} — ${entries.length} items.\n`);
    return;
  }

  process.stdout.write(json);
}

/**
 * The fields `set` understands.
 *
 * `state` is the one that matters; the rest are the facts the header holds
 * and the header is where they live.
 */
const SETTABLE_FIELDS = [
  'state',
  'stateReason',
  'owner',
  'verifier',
  'opened',
  'numbered',
  'dispatched',
  'dispatchId',
  'landed',
  'landedSha',
  'branch',
  'worktree',
  'blockedBy',
  'files',
  'title',
] as const;

type SettableField = (typeof SETTABLE_FIELDS)[number];

function itemFilePath(root: string, id: string): string {
  return path.join(root, '.factory', 'work', `${id.toUpperCase()}.md`);
}

/**
 * Split a value that may hold several paths.
 *
 * A list field is written as a comma-separated list, so that one command can
 * set it without a second syntax to learn.
 */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function cmdSet(args: string[]): void {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const by = args.find((arg) => arg.startsWith('--by='))?.slice('--by='.length);

  const [rawId, rawField, value] = positional;
  if (!rawId || !rawField || value === undefined) {
    fail(
      'Usage: npx tsx scripts/work-item.ts set <WI-nnn> <field> <value> [--by <role>]\n\n' +
        `  Fields: ${SETTABLE_FIELDS.join(', ')}\n`,
    );
  }

  const id = rawId.toUpperCase();
  if (!/^WI-\d+$/.test(id)) {
    fail(`"${rawId}" is not a work item number. The id looks like WI-017.`);
  }
  if (!(SETTABLE_FIELDS as readonly string[]).includes(rawField)) {
    fail(
      `"${rawField}" is not a field of the header. The fields are: ${SETTABLE_FIELDS.join(', ')}`,
    );
  }
  const field = rawField as SettableField;

  const file = itemFilePath(repoRoot, id);
  if (!fs.existsSync(file)) {
    fail(`${id} has no item file in this checkout.`);
  }

  const content = fs.readFileSync(file, 'utf8');
  const parsed = parseItem(content);
  if (!parsed.header) {
    fail(
      `${id} carries no header block, so there is nothing to set.\n` +
        'The file has to be migrated to the header block first.',
    );
  }

  const header = parsed.header;

  if (field === 'state') {
    applyStateChange(header, value, by);
  } else if (field === 'blockedBy' || field === 'files') {
    header[field] = splitList(value);
  } else if (field === 'owner' || field === 'verifier') {
    const role = value.trim();
    if (!(ROLE_TOKENS as readonly string[]).includes(role)) {
      fail(
        `"${role}" is not a role token. An owner is one of: ${ROLE_TOKENS.join(', ')}.\n` +
          'Two owners is two work items.',
      );
    }
    header[field] = role;
  } else {
    header[field] = value;
  }

  fs.writeFileSync(file, writeItem(header, parsed.body), 'utf8');
  process.stdout.write(`${id} — ${field} is now "${String(header[field])}".\n`);
}

/**
 * The reason a transition is refused, or null when the table allows it.
 *
 * The refusal is a value and not an exit, so that the rule can be tested
 * without catching a process that ran away.
 */
export function checkStateChange(
  header: WorkItemHeader,
  to: string,
  by: string | undefined,
): string | null {
  const rule = transitionFor(header.state, to);
  if (!rule) {
    return `${header.id} cannot go from "${header.state}" to "${to}".\n${describeTransitions()}`;
  }

  const actor = by ?? header.owner ?? rule.who;
  if (actor !== rule.who) {
    return (
      `${header.id}: only ${rule.who} may move an item from "${header.state}" to "${to}".\n` +
      `The transition was claimed by "${actor}".`
    );
  }

  if (to === 'verify' && !header.landedSha) {
    return (
      `${header.id} has no landed sha, so there is nothing to check CI on.\n` +
      `Set it first: npx tsx scripts/work-item.ts set ${header.id} landedSha <sha>`
    );
  }

  if (to === 'accepted' && !header.history.some((entry) => entry.to === 'review')) {
    return (
      `${header.id} has no review to accept.\n` +
      'An item goes verify → review before it can be accepted.'
    );
  }

  return null;
}

/**
 * Apply a state transition, if the table allows it.
 *
 * The table is the whole of the rule. A transition the table does not have
 * is refused, and the refusal says which transition was asked for and which
 * ones exist — a rule that only says "no" is a rule nobody can follow.
 */
export function applyStateChange(header: WorkItemHeader, to: string, by: string | undefined): void {
  const reason = checkStateChange(header, to, by);
  if (reason) fail(reason);

  const rule = transitionFor(header.state, to);
  if (!rule) fail(`${header.id} cannot go from "${header.state}" to "${to}".`);

  const actor = by ?? header.owner ?? rule.who;
  header.history.push({
    at: new Date().toISOString().slice(0, 16),
    from: header.state,
    to,
    by: actor,
  });
  header.state = to;
}

/** The transition table, as the command prints it when it refuses. */
export function describeTransitions(): string {
  return TRANSITIONS.map(
    (rule) => `  ${rule.from} → ${rule.to}  (${rule.who}${rule.automatic ? ', automatic' : ''})`,
  ).join('\n');
}

export interface CheckFinding {
  kind: 'file-claim' | 'owner-claim' | 'number-space' | 'header';
  message: string;
  items: string[];
}

/**
 * Whether two declared paths are the same claim.
 *
 * A path inside a directory the other item declares is the same claim: two
 * items cannot both own `apps/server/src` when one of them owns
 * `apps/server/src/app.ts`.
 */
export function pathsOverlap(left: string, right: string): boolean {
  const normalise = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const a = normalise(left);
  const b = normalise(right);
  if (a === b) return true;
  return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/**
 * The validator.
 *
 * It fails on the three failures the factory keeps hitting: two live items
 * claiming one file, one role owning two live items that claim the same
 * file, and one number on two item files. It deliberately does not fail on a
 * queue that is merely long, or on an item that is old — the queue is
 * supposed to hold work that has not been accepted yet.
 */
export function checkQueue(root: string): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const entries = buildQueue(root);

  const live = entries.filter((entry) => entry.state !== null && isLive(entry.state));

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const left = live[i]!;
      const right = live[j]!;
      const shared = left.files.filter((file) =>
        right.files.some((other) => pathsOverlap(file, other)),
      );
      if (shared.length === 0) continue;

      findings.push({
        kind: 'file-claim',
        message: `${left.id} and ${right.id} both claim ${shared.join(', ')}.`,
        items: [left.id, right.id],
      });

      if (left.owner !== null && left.owner === right.owner) {
        findings.push({
          kind: 'owner-claim',
          message: `${left.owner} owns ${left.id} and ${right.id}, and both claim ${shared.join(', ')}.`,
          items: [left.id, right.id],
        });
      }
    }
  }

  findings.push(...checkNumberSpace(root, entries));

  for (const entry of entries) {
    if (entry.state !== null && !isKnownState(entry.state)) {
      findings.push({
        kind: 'header',
        message: `${entry.id} is in "${entry.state}", which is not a state the repository publishes.`,
        items: [entry.id],
      });
    }
    if (entry.owner !== null && !(ROLE_TOKENS as readonly string[]).includes(entry.owner)) {
      findings.push({
        kind: 'header',
        message: `${entry.id} names "${entry.owner}" as its owner, which is not one role token.`,
        items: [entry.id],
      });
    }
  }

  return findings;
}

/**
 * The number space.
 *
 * One number, one item. The check reads every item file on every ref, because
 * a number can be taken twice in two places at once — once on a branch that
 * has not landed, and once on `main` — and neither checkout can see the
 * other's copy.
 */
function checkNumberSpace(root: string, entries: QueueEntry[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const refs = listRefs(root);

  const specs: string[] = [];
  const refFiles = new Map<string, string[]>();
  for (const ref of refs) {
    const files = itemFilesByRef(root).get(ref) ?? [];
    refFiles.set(ref, files);
    for (const file of files) specs.push(`${ref}:${file}`);
  }

  const contents = gitCatFileBatch(root, specs);

  // The id each item file declares, and the title it carries.
  const declared = new Map<string, Map<string, string>>();
  for (const ref of refs) {
    for (const file of refFiles.get(ref) ?? []) {
      const fileName = path.basename(file);
      const content = contents.get(`${ref}:${file}`) ?? '';
      const parsed = parseItem(content);
      const id = parsed.header?.id || idFromFileName(fileName);
      const title = parsed.header?.title ?? readProseTitle(content) ?? '';
      const byId = declared.get(id) ?? new Map<string, string>();
      if (!byId.has(fileName)) byId.set(fileName, title);
      declared.set(id, byId);
    }
  }

  for (const [id, byPath] of declared) {
    if (byPath.size > 1) {
      findings.push({
        kind: 'number-space',
        message: `The number ${id} is on ${byPath.size} item files: ${[...byPath.keys()].join(', ')}.`,
        items: [id],
      });
    }
  }

  // The same item filed under two numbers is the other half of the same
  // failure: the number was taken, and then taken again. A retired number
  // and its live replacement are not a conflict — the repository records
  // those renumberings, and the old one is closed — so only two live items
  // under one title are a failure.
  const byTitle = new Map<string, Set<string>>();
  for (const [id, byPath] of declared) {
    for (const title of byPath.values()) {
      if (title === '') continue;
      const ids = byTitle.get(title) ?? new Set<string>();
      ids.add(id);
      byTitle.set(title, ids);
    }
  }

  const liveIds = new Set(
    entries.filter((entry) => entry.state !== null && isLive(entry.state)).map((entry) => entry.id),
  );

  for (const [title, ids] of byTitle) {
    if (ids.size < 2) continue;
    const liveOnes = [...ids].filter((id) => liveIds.has(id));
    if (liveOnes.length < 2) continue;
    findings.push({
      kind: 'number-space',
      message: `One item is filed under ${[...ids].sort().join(' and ')}: "${title}".`,
      items: [...ids].sort(),
    });
  }

  return findings;
}

/** The title in a file that has no header block. */
function readProseTitle(content: string): string | null {
  const match = /^#{1,2}\s+(WI-\d+)\s+—\s+(.+)$/m.exec(content);
  return match?.[2]?.trim() ?? null;
}

function cmdCheck(): void {
  const findings = checkQueue(repoRoot);
  if (findings.length === 0) {
    process.stdout.write('The queue is clean: no claim overlaps and no number is taken twice.\n');
    return;
  }

  for (const finding of findings) {
    process.stdout.write(`${finding.kind}: ${finding.message}\n`);
  }
  process.exit(1);
}

function cmdClaim(): void {
  const entries = buildQueue(repoRoot);
  const worktrees = listWorktrees(repoRoot);

  process.stdout.write('Item claims — the branch and the worktree:\n');
  const claimed = entries.filter((entry) => entry.branch !== null || entry.worktree !== null);
  if (claimed.length === 0) {
    process.stdout.write('  none\n');
  }
  for (const entry of claimed) {
    process.stdout.write(
      `  ${entry.id.padEnd(8)} ${(entry.branch ?? 'no branch').padEnd(38)} ${entry.worktree ?? ''}\n`,
    );
  }

  process.stdout.write('\nWorktrees git knows about:\n');
  for (const worktree of worktrees) {
    const branch = worktree.branch ?? '(detached)';
    const marker = worktree.path === repoRoot ? ' <- main checkout' : '';
    process.stdout.write(`  ${branch.padEnd(38)} ${worktree.path}${marker}\n`);
  }

  process.stdout.write('\nFile claims — the paths each item declares:\n');
  const withFiles = entries.filter((entry) => entry.files.length > 0);
  if (withFiles.length === 0) {
    process.stdout.write('  none\n');
  }
  for (const entry of withFiles) {
    process.stdout.write(`  ${entry.id.padEnd(8)} ${entry.files.join(', ')}\n`);
  }

  process.stdout.write('\nOwner claims — one role on one live item:\n');
  const byOwner = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.owner === null || entry.state === null || !isLive(entry.state)) continue;
    const ids = byOwner.get(entry.owner) ?? [];
    ids.push(entry.id);
    byOwner.set(entry.owner, ids);
  }
  if (byOwner.size === 0) {
    process.stdout.write('  none\n');
  }
  for (const [owner, ids] of [...byOwner.entries()].sort()) {
    process.stdout.write(`  ${owner.padEnd(8)} ${ids.join(', ')}\n`);
  }
}

function cmdRemove(args: string[]): void {
  const force = args.includes('--force');
  const [id] = args.filter((arg) => !arg.startsWith('--'));

  if (!id) {
    fail('Usage: npx tsx scripts/work-item.ts remove <WI-nnn> [--force]');
  }

  const number = id.replace(/^WI-/i, '');
  const worktree = worktreesByNumber(repoRoot).get(number);
  if (!worktree) {
    fail(`WI-${number} has no worktree.`);
  }

  const status = gitOrNull(['status', '--porcelain'], worktree.path);
  if (status) {
    fail(
      `${worktree.path} has uncommitted changes:\n${status}\n\n` +
        'Commit them, or move them elsewhere, before the worktree is removed.',
    );
  }

  const branch = worktree.branch ?? '';
  const merged = branch !== '' && gitSucceeds(['merge-base', '--is-ancestor', branch, 'main']);

  run('git', ['worktree', 'remove', worktree.path]);

  // `git worktree remove` leaves the directory behind when it holds
  // untracked files, and the installed `node_modules` is exactly that: it is
  // gitignored, so git leaves it. The worktree is not gone until the
  // directory is, and a directory that is still there makes the next
  // `new` refuse.
  if (fs.existsSync(worktree.path)) {
    fs.rmSync(worktree.path, { recursive: true, force: true });
  }

  if (branch) {
    if (merged || force) {
      run('git', ['branch', force ? '-D' : '-d', branch]);
    } else {
      process.stdout.write(
        `Kept the branch "${branch}" — it is not merged into main yet.\n` +
          'Delete it yourself once it has landed, or pass --force.\n',
      );
    }
  }

  process.stdout.write(`Removed ${worktree.path}\n`);
}

// ─── The entry point ─────────────────────────────────────────────────────────

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'new':
      cmdNew(args);
      break;
    case 'list':
      cmdList();
      break;
    case 'queue':
      cmdQueue(args);
      break;
    case 'set':
      cmdSet(args);
      break;
    case 'check':
      cmdCheck();
      break;
    case 'claim':
      cmdClaim();
      break;
    case 'remove':
      cmdRemove(args);
      break;
    default:
      fail(
        'Usage: npx tsx scripts/work-item.ts <new|list|queue|set|check|claim|remove> …\n\n' +
          '  new WI-017 forge-panel   create the branch, the worktree and the item file\n' +
          '  list                     show the worktrees and the queue\n' +
          '  queue [--write]          print the index, or write .factory/queue.json\n' +
          '  set WI-017 state verify  the only writer of state\n' +
          '  check                    validate the claims and the number space\n' +
          '  claim                    print the live claims\n' +
          '  remove WI-017            take the worktree away\n',
      );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main();
}
