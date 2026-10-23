/**
 * Give a work item its own branch and its own worktree.
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
 *   npx tsx scripts/work-item.ts remove --path ../personal-os-worktrees/157-codex-runtime
 *
 * `new` creates the branch `wi/017-forge-panel` and a worktree for it beside
 * the repository — beside it, not inside it, so a worktree can never be swept
 * into a commit by `git add -A` from the main checkout — then installs the
 * dependencies and builds the packages the gates need.
 *
 * `remove` takes the worktree away and deletes the branch, but only when the
 * branch's work has landed. An unlanded branch is somebody's work, and a script
 * that deletes it is a script that loses work.
 *
 * "Has landed" is proved, not assumed. A branch merged or fast-forwarded into
 * the base has its commits there; a branch landed as a squash, a cherry-pick or
 * a rebase has its *content* there but not its commits, and the tool says so
 * and keeps those commits under a ref of its own before the branch goes. A
 * branch that holds a merge the base does not have is never released: a merge's
 * resolution is not a patch anybody can compare, and it exists nowhere else
 * until it is landed.
 *
 * The main checkout is never removed, the remote integration branch is never
 * deleted, and every check runs before anything is taken away — including the
 * move of uncommitted files to `--preserve-to`, which happens only once the
 * tool knows the tree is going.
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
function worktreeRoot(): string {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const primary = path.dirname(common);
  const parent = path.dirname(primary);
  const name = path.basename(primary);
  return path.join(parent, `${name}-worktrees`);
}

/** The branch name a work item gets: `wi/017-forge-panel`. */
function branchFor(id: string, slug: string): string {
  const number = id.replace(/^WI-/i, '');
  return `wi/${number}-${slug}`;
}

/** The directory a work item's worktree is created in. */
function pathFor(id: string, slug: string): string {
  return path.join(worktreeRoot(), `${id.replace(/^WI-/i, '')}-${slug}`);
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
 * The same, without Git's complaint on the terminal.
 *
 * A question whose answer is "no" is a normal answer, and Git says so loudly.
 * `rev-parse --verify` on a ref that is not there prints a `fatal:` that has
 * nothing to do with anything the caller did.
 */
function gitOrNullQuiet(args: string[], cwd = repoRoot): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
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
function listWorktrees(): Worktree[] {
  const raw = git(['worktree', 'list', '--porcelain']);
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
 * The main checkout of this repository.
 *
 * The helper is documented to be run from another checkout, so "the directory
 * this script lives in" is the wrong answer to "which tree is the main one":
 * the script is copied around, and the main checkout is wherever the common
 * Git directory is. Every linked worktree points back at it, which is why it
 * is the one tree a removal must never take.
 */
function mainCheckoutPath(): string {
  const common = path.resolve(git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
  return path.basename(common) === '.git' ? path.dirname(common) : common;
}

/** The branches a cleanup may never delete: the ones the base is built on. */
const INTEGRATION_BRANCHES = new Set(['main', 'master']);

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
 * Divergence requires integration before selecting a new base. A feature
 * branch push cannot prove that its base contains the current remote main.
 */
function baseRef(): string {
  const hasMain = gitSucceeds(['rev-parse', '--verify', 'main']);
  const hasOrigin = gitSucceeds(['rev-parse', '--verify', 'origin/main']);

  if (!hasMain) return 'origin/main';
  if (!hasOrigin) return 'main';
  if (gitSucceeds(['merge-base', '--is-ancestor', 'origin/main', 'main'])) return 'main';
  if (gitSucceeds(['merge-base', '--is-ancestor', 'main', 'origin/main'])) return 'origin/main';
  fail(
    'main and origin/main have diverged. Integrate and verify them before creating another item.',
  );
}

/**
 * The work items that already have a worktree, by work item number.
 *
 * The number is what a `.factory/work/WI-0xx.md` file carries, so this is how
 * a worktree is matched back to the item it belongs to.
 */
function worktreesByNumber(): Map<string, Worktree[]> {
  const map = new Map<string, Worktree[]>();
  for (const worktree of listWorktrees()) {
    if (!worktree.branch) continue;
    const match = /^wi\/(\d+)-/.exec(worktree.branch);
    const number = match?.[1];
    if (number) {
      map.set(number, [...(map.get(number) ?? []), worktree]);
    }
  }
  return map;
}

function cmdNew(args: string[]): void {
  const install = !args.includes('--no-install');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const [id, slug] = positional;

  if (!id || !slug) {
    fail('Usage: npx tsx scripts/work-item.ts new <WI-nnn> <slug> [--no-install]');
  }
  if (!/^WI-\d+$/i.test(id)) {
    fail(`"${id}" is not a work item number. The id looks like WI-017.`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fail(`"${slug}" is not a slug. Use lower case and hyphens: forge-panel.`);
  }

  const branch = branchFor(id, slug);
  const target = pathFor(id, slug);
  const number = id.replace(/^WI-/i, '');
  const occupied = listWorktrees().filter((tree) => tree.branch?.startsWith(`wi/${number}-`));
  if (occupied.length)
    fail(`${id} already has a worktree: ${occupied.map((tree) => tree.path).join(', ')}`);
  const exists = gitSucceeds(['rev-parse', '--verify', `refs/heads/${branch}`]);

  if (exists) {
    fail(
      `The branch "${branch}" already exists.\n` +
        'Use a different slug, or work in the worktree that already has it.',
    );
  }
  if (fs.existsSync(target)) {
    fail(
      `${target} already exists. Inspect and preserve its contents; creation never deletes directories.`,
    );
  }

  fs.mkdirSync(worktreeRoot(), { recursive: true });

  // Fetch first, so the base is chosen against the current remote rather
  // than against a stale copy of it. A fetch only moves the remote-tracking
  // refs; it does not touch the working tree or the local branches.
  const fetched = gitOrNull(['fetch', 'origin']);
  if (fetched === null) {
    fail('Fetch failed. Restore remote access before creating work from a potentially stale base.');
  }

  const base = baseRef();
  process.stdout.write(`Creating ${branch} from ${base} at ${target}\n`);
  run('git', ['worktree', 'add', '-b', branch, target, base]);

  if (!install) {
    process.stdout.write(
      '\nDone. The dependencies are not installed, so run "npm ci" ' +
        'in the worktree before the gates will pass.\n',
    );
    return;
  }

  process.stdout.write('\nInstalling the dependencies (npm ci)…\n');
  const npm = npmCommand();
  run(npm.command, [...npm.prefix, 'ci'], target);
  process.stdout.write('\nBuilding the packages the gates need (npm run build:deps)…\n');
  run(npm.command, [...npm.prefix, 'run', 'build:deps'], target);

  process.stdout.write(
    `\nReady. Work in ${target} on ${branch}.\n` +
      'Push it with "git push -u origin HEAD" — the branch is yours to push.\n',
  );
}

function cmdList(): void {
  const worktrees = listWorktrees();
  const byNumber = worktreesByNumber();

  process.stdout.write('Worktrees:\n');
  for (const worktree of worktrees) {
    const branch = worktree.branch ?? '(detached)';
    const marker = worktree.path === repoRoot ? ' <- main checkout' : '';
    process.stdout.write(`  ${branch.padEnd(32)} ${worktree.path}${marker}\n`);
  }

  process.stdout.write('\nWork items with a worktree:\n');
  if (byNumber.size === 0) {
    process.stdout.write('  none\n');
    return;
  }
  for (const [number, trees] of [...byNumber.entries()].sort()) {
    const itemFile = path.join(repoRoot, '.factory', 'work', `WI-${number}.md`);
    const state = fs.existsSync(itemFile) ? readState(itemFile) : 'no work item file';
    for (const worktree of trees) {
      process.stdout.write(
        `  WI-${number}  ${state.padEnd(14)} ${worktree.path}${trees.length > 1 ? ' (ambiguous item number)' : ''}\n`,
      );
    }
  }
}

/**
 * The `**State:**` line of a work item file, shortened to its first word.
 *
 * The state line carries a sentence after the word — a date and a reason — and
 * the sentence is what matters when a reader is reading the list. This is the
 * summary for the list, not the record: the file holds the truth.
 */
function readState(itemFile: string): string {
  const match = /^\*\*State:\*\*\s*([a-z-]+)/m.exec(fs.readFileSync(itemFile, 'utf8'));
  return match?.[1] ?? 'unknown';
}

/** Windows Git can traverse npm workspace junctions during recursive removal.
 * A shared install may point into another checkout; never let removal reach it.
 * Inspect links without descending through them, including ignored install roots.
 *
 * With `detach`, a link that reaches outside is unlinked rather than refused.
 * Unlinking a junction removes the reparse point and leaves its target exactly
 * where it was, so the shared install survives and only the tree's link to it
 * goes. That is the step FACTORY.md describes: detach the shared install
 * without following its links, then inspect again.
 */
function inspectLinks(directory: string, boundary: string, detach: boolean): void {
  const entry = fs.lstatSync(directory);
  if (entry.isSymbolicLink()) {
    // A link that cannot be resolved points at nothing that can be checked.
    // It is treated as reaching outside, because that is the answer that keeps
    // the tree rather than the thing it might have pointed at.
    let outside = true;
    try {
      const target = fs.realpathSync(directory);
      const relative = path.relative(boundary, target);
      outside =
        relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    } catch {
      outside = true;
    }
    if (outside) {
      if (!detach) {
        fail(`Preserve ${directory}: a symbolic link/junction reaches outside this worktree.`);
      }
      fs.unlinkSync(directory);
      process.stdout.write(
        `Detached ${directory}: it pointed outside this worktree, and the link is gone.\n`,
      );
      return;
    }
    return;
  }
  if (!entry.isDirectory()) return;
  for (const name of fs.readdirSync(directory)) {
    inspectLinks(path.join(directory, name), boundary, detach);
  }
}

/**
 * What the tool can prove about a branch and the base it should have landed in.
 */
interface IntegrationProof {
  /** The branch's work is in the base: deleting the branch loses no work. */
  integrated: boolean;
  /** The commits the branch holds that the base does not. */
  unique: string[];
  /** Why the branch is not integrated, in the operator's words. */
  reason: string;
}

/**
 * The commits in a range, or null when the range cannot be listed.
 *
 * A range that cannot be listed is not an empty range. `git cherry` on a
 * branch whose only unique commit is a merge prints nothing at all, and an
 * empty answer read as "integrated" is how a merge resolution came to be
 * deleted with its branch.
 */
function revList(args: string[]): string[] | null {
  const out = gitOrNullQuiet(['rev-list', ...args]);
  if (out === null) return null;
  return out.split('\n').filter(Boolean);
}

/**
 * The branch's patches that the base does not have.
 *
 * `git cherry` compares the two by patch identity: a '-' means the patch is
 * already applied, a '+' means it is not. A cherry-picked or rebased branch
 * has no '+'. Merge commits are not reported at all, which is why a merge is
 * refused before this question is asked.
 */
function unappliedPatches(base: string, subject: string): string[] | null {
  const out = gitOrNullQuiet(['cherry', '-v', base, subject]);
  if (out === null) return null;
  const unapplied: string[] = [];
  for (const line of out.split('\n')) {
    if (!line.startsWith('+')) continue;
    const sha = line.slice(1).trim().split(' ')[0];
    if (sha) unapplied.push(sha);
  }
  return unapplied;
}

/**
 * Whether the branch's tip leaves behind a tree the base already has.
 *
 * A squash merge lands the branch's whole content as one commit, so none of
 * the branch's patches matches and the patch proof cannot see the landing.
 * The tree can: the squashed commit's tree is exactly the tree the branch
 * left behind.
 *
 * Only the commits the base gained after the two diverged are compared. A
 * tree that matches a commit from before the fork is a state the branch
 * returned to rather than work the base has absorbed, and treating that as a
 * landing would release a branch that undoes the base.
 */
function treeIsInBase(subject: string, base: string): boolean {
  const tipTree = gitOrNullQuiet(['rev-parse', '--verify', `${subject}^{tree}`]);
  if (!tipTree) return false;
  const fork = gitOrNullQuiet(['merge-base', base, subject]);
  if (!fork) return false;
  const trees = gitOrNullQuiet(['log', '--format=%T', `${fork}..${base}`]);
  if (trees === null) return false;
  return trees.split('\n').includes(tipTree);
}

/**
 * Whether a commit's work is already in a base branch.
 *
 * Ancestry is the ordinary proof: a branch that was merged or fast-forwarded
 * has its commits in the base, and deleting the branch preserves them.
 *
 * A slice is often landed as a squash, a cherry-pick or a rebase, and then its
 * commits are not ancestors of the base even though every line of their work is
 * there. Two further proofs cover that: patch equivalence (`git cherry`), and
 * tree equivalence for a squash, whose one squashed commit carries every
 * change and matches no patch of its own.
 *
 * Neither of those can see a merge. `git cherry` skips merge commits
 * entirely, and a merge's resolution is not a patch anybody can compare: it
 * is whatever the person who resolved the conflict decided, and it exists in
 * no other commit until it is landed. A branch that holds a merge the base
 * does not have is therefore never released on the strength of a patch or a
 * tree: the tool cannot show that the resolution is anywhere else, and a
 * branch whose only unique commit is a merge has nothing but that resolution
 * to lose.
 */
function proveIntegration(subject: string, base: string): IntegrationProof {
  const unique = revList([`${base}..${subject}`]);
  if (unique === null) {
    return {
      integrated: false,
      unique: [],
      reason: `the commits between ${base} and ${subject} could not be listed`,
    };
  }
  if (gitSucceeds(['merge-base', '--is-ancestor', subject, base])) {
    return { integrated: true, unique, reason: '' };
  }
  const merges = revList(['--merges', `${base}..${subject}`]);
  if (merges === null) {
    return {
      integrated: false,
      unique,
      reason: `the merges between ${base} and ${subject} could not be listed`,
    };
  }
  if (merges.length > 0) {
    return {
      integrated: false,
      unique,
      reason:
        `it holds ${merges.length} merge commit(s) that ${base} does not have, and a merge's ` +
        'resolution is not a patch that can be compared: it is lost with the branch unless ' +
        'the merge itself is landed',
    };
  }
  const unapplied = unappliedPatches(base, subject);
  if (unapplied === null) {
    return {
      integrated: false,
      unique,
      reason: `its patches could not be compared with ${base}`,
    };
  }
  if (unapplied.length === 0) return { integrated: true, unique, reason: '' };
  if (treeIsInBase(subject, base)) return { integrated: true, unique, reason: '' };
  return {
    integrated: false,
    unique,
    reason: `${unapplied.length} of its patches are not in ${base}`,
  };
}

/**
 * The ref that keeps a branch's own commits alive after the branch is gone.
 *
 * `refs/keep/` is neither a branch nor a tag: `git branch` does not list it,
 * `git push` does not send it, and `git gc` does not prune it while it is
 * there. The short commit is in the name so that a branch name reused later
 * does not overwrite the commits of the last use.
 */
function keepRefName(name: string, sha: string): string {
  return `refs/keep/${name}@${sha.slice(0, 7)}`;
}

/**
 * A ref other than the branch itself that still holds the branch's commits.
 *
 * A branch that was pushed is held by its remote-tracking ref; a branch that
 * was tagged is held by the tag. Either is the separate evidence FACTORY.md
 * asks for before a squash-landed branch may be deleted. A ref the removal is
 * about to delete is not evidence: the remote-tracking ref of a branch whose
 * remote branch is about to go holds the commits for a few seconds longer.
 */
function preservingRef(unique: string[], branch: string, remoteWillGo: boolean): string | null {
  for (const sha of unique) {
    const refs = gitOrNullQuiet(['for-each-ref', '--contains', sha, '--format=%(refname)']);
    if (refs === null) continue;
    for (const ref of refs.split('\n').filter(Boolean)) {
      if (ref === `refs/heads/${branch}`) continue;
      if (remoteWillGo && ref === `refs/remotes/origin/${branch}`) continue;
      return ref;
    }
  }
  return null;
}

/**
 * The tree a removal is about.
 *
 * A work item number is the usual way in, but a number is not always enough:
 * two trees can carry the same item, and most of the trees in a busy checkout
 * were never given a work item at all — they are a review tree, a lead tree or
 * a scratch tree. `--path` names the exact tree, and it is the only selection
 * that cannot be ambiguous.
 */
function selectWorktreeForRemoval(
  id: string | undefined,
  requestedPath: string | undefined,
): Worktree {
  const worktrees = listWorktrees();

  if (requestedPath !== undefined) {
    const wanted = path.resolve(requestedPath);
    const matches = worktrees.filter(
      (tree) => path.resolve(tree.path).toLowerCase() === wanted.toLowerCase(),
    );
    const match = matches[0];
    if (!match) fail(`${requestedPath} is not a worktree of this repository.`);
    return match;
  }

  if (!id) {
    fail(
      'Usage: npx tsx scripts/work-item.ts remove <WI-nnn> | --path <worktree-path>\n' +
        REMOVE_OPTIONS.map((option) => `  ${option}\n`),
    );
  }

  const number = id.replace(/^WI-/i, '');
  const matches = worktrees.filter((tree) => tree.branch?.startsWith(`wi/${number}-`));
  if (matches.length > 1)
    fail(
      `WI-${number} has multiple worktrees. Select and inspect the exact path with git worktree; no implicit selection is safe.`,
    );
  const worktree = matches[0];
  if (!worktree) {
    fail(`WI-${number} has no worktree.`);
  }
  return worktree;
}

/**
 * Whether an ignored file is runtime data the worktree rebuilds for itself.
 *
 * `secret.key` is written with fresh random bytes by apps/server/src/config.ts
 * whenever it is missing, so the copy inside a worktree belongs to that
 * worktree's own database and goes with it — it is not the owner's key, which
 * lives in the main checkout's data directory. `test-results/` and
 * `playwright-report/` are test output.
 *
 * The data directory is the one that needs judgement: it can hold real
 * records. It is disposable only when everything inside it is a key the
 * server writes for itself, which is what `holdsOnlyOnDemandKeys` decides.
 */
function isRegenerableRuntimeData(entry: string, worktreePath: string): boolean {
  const normalized = entry.replace(/\\/g, '/');
  const isDirectory = normalized.endsWith('/');
  const trimmed = isDirectory ? normalized.slice(0, -1) : normalized;
  const base = trimmed.slice(trimmed.lastIndexOf('/') + 1);

  if (!isDirectory && base === 'secret.key') return true;
  if (isDirectory && (base === 'test-results' || base === 'playwright-report')) return true;
  if (isDirectory && base === 'data') {
    return holdsOnlyOnDemandKeys(path.join(worktreePath, trimmed));
  }
  return false;
}

/**
 * Whether a data directory holds nothing but the keys the server writes.
 *
 * `apps/server/src/config.ts` writes `secret.key` into the data directory
 * with fresh random bytes whenever it is missing, so a data directory that
 * holds nothing else can go with the tree that made it. Anything else inside
 * it is somebody's: a database, a note, a file. The question is asked of every
 * file rather than of the databases alone, because a directory that holds a
 * key and a database holds both.
 */
function holdsOnlyOnDemandKeys(directory: string): boolean {
  for (const file of filesUnder(directory)) {
    if (path.basename(file) !== 'secret.key') return false;
  }
  return true;
}

/**
 * Every file under a directory, without following a link out of it.
 */
function filesUnder(directory: string): string[] {
  const found: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      found.push(...filesUnder(full));
      continue;
    }
    found.push(full);
  }
  return found;
}

/** The options a removal accepts. Anything else is a mistake, not a no-op. */
const REMOVE_OPTIONS = [
  '--path <worktree-path>',
  '--preserve-to <directory>',
  '--allow-runtime-data',
  '--delete-remote',
  '--detach-shared-install',
];

/**
 * Move uncommitted files out of a tree that is about to go.
 *
 * The copy comes first and the removal second: a copy that fails leaves the
 * tree exactly as it was, and a tree that is going to be kept is never
 * touched at all. A directory is copied as a directory, because Git reports
 * an untracked directory as one entry and a file copy of it fails.
 */
function preserveUncommittedFiles(
  worktreePath: string,
  destination: string,
  files: string[],
): void {
  for (const relative of files) {
    const from = path.join(worktreePath, relative);
    const to = path.join(destination, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try {
      fs.cpSync(from, to, { recursive: true, force: true, dereference: true });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(
        `Kept ${worktreePath}: ${relative} could not be copied to ${destination} (${detail}). ` +
          'Nothing was removed from the worktree.',
      );
    }
  }
  for (const relative of files) {
    fs.rmSync(path.join(worktreePath, relative), { recursive: true, force: true });
  }
}

/**
 * The files an ignored entry stands for.
 *
 * `git ls-files --directory` collapses an ignored directory into a single
 * entry, so the tool is told about `data/` and the operator has to move
 * `data/personal-os.db`. The names are what the operator needs.
 */
function ignoredEntryFiles(entry: string, worktreePath: string): string[] {
  const normalized = entry.replace(/\\/g, '/');
  if (!normalized.endsWith('/')) return [normalized];
  const directory = path.join(worktreePath, normalized.slice(0, -1));
  const files = filesUnder(directory).map((file) =>
    path.relative(worktreePath, file).split(path.sep).join('/'),
  );
  return files.length > 0 ? files : [normalized];
}

/**
 * Whether the remote branch's commits survive the deletion of the remote branch.
 *
 * They survive if the base has them, or if the local branch has them: a local
 * branch whose commits are not in the base is kept under a ref of its own, so
 * its history is still there after the remote ref is gone.
 */
function remoteCommitsAreSafe(remoteHead: string, localTip: string): boolean {
  if (gitSucceeds(['merge-base', '--is-ancestor', remoteHead, 'origin/main'])) return true;
  return gitSucceeds(['merge-base', '--is-ancestor', remoteHead, localTip]);
}

function cmdRemove(args: string[]): void {
  if (args.includes('--force')) fail('Force removal is not supported. Preserve unmerged work.');

  const positional: string[] = [];
  let requestedPath: string | undefined;
  let preserveTo: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === '--preserve-to') {
      index += 1;
      preserveTo = args[index];
      if (!preserveTo || preserveTo.startsWith('--')) {
        fail('Usage: npx tsx scripts/work-item.ts remove --preserve-to <directory>');
      }
      continue;
    }
    if (arg === '--path') {
      index += 1;
      requestedPath = args[index];
      if (!requestedPath || requestedPath.startsWith('--')) {
        fail('Usage: npx tsx scripts/work-item.ts remove --path <worktree-path>');
      }
      continue;
    }
    if (arg === '--allow-runtime-data' || arg === '--delete-remote') {
      continue;
    }
    if (arg === '--detach-shared-install') {
      continue;
    }
    if (arg.startsWith('--')) {
      fail(
        `Unknown option ${arg}. A removal accepts:\n` +
          REMOVE_OPTIONS.map((option) => `  ${option}`).join('\n'),
      );
    }
    positional.push(arg);
  }
  const allowRuntimeData = args.includes('--allow-runtime-data');
  const deleteRemote = args.includes('--delete-remote');
  const detachSharedInstall = args.includes('--detach-shared-install');

  const worktree = selectWorktreeForRemoval(positional[0], requestedPath);

  // The main checkout is not a worktree, and it is the one tree whose removal
  // takes the repository with it. The helper is documented to be run from
  // another checkout, so the checkout it runs from is not the answer: the
  // main checkout is the one the common Git directory belongs to.
  const mainCheckout = mainCheckoutPath();
  if (path.resolve(worktree.path).toLowerCase() === mainCheckout.toLowerCase())
    fail(
      `Kept ${worktree.path}: this is the main checkout, not a worktree, and the main ` +
        'checkout is never removed. Run the removal for the tree you mean, from another checkout.',
    );

  // The integration branch is the base everything else is built on. It is
  // never removed here, and never deleted on the remote: a hook may be
  // installed in one clone and absent in the next, and the tool cannot
  // depend on a hook to keep the base safe.
  const branch = worktree.branch ?? '';
  if (INTEGRATION_BRANCHES.has(branch)) {
    fail(
      `Kept ${worktree.path}: ${branch} is the integration branch, and this helper never ` +
        'removes it or deletes it on the remote.',
    );
  }

  const status = gitOrNull(['status', '--porcelain'], worktree.path);
  if (status === null)
    fail(
      `Cannot inspect ${worktree.path}. Use the Git/platform that owns this worktree; do not prune it.`,
    );
  const untracked: string[] = [];
  if (status) {
    const lines = status.split('\n').filter(Boolean);
    const tracked = lines.filter((line) => !line.startsWith('??'));
    const untrackedFiles = lines
      .filter((line) => line.startsWith('?? '))
      .map((line) => line.slice(3).trim());

    if (tracked.length) {
      fail(
        `${worktree.path} has uncommitted changes:\n${tracked.join('\n')}\n\n` +
          'Commit them, or move them elsewhere, before the worktree is removed.',
      );
    }
    if (untrackedFiles.length) {
      if (!preserveTo) {
        fail(
          `${worktree.path} has uncommitted files:\n${untrackedFiles.join('\n')}\n\n` +
            'Commit them, move them elsewhere, or pass --preserve-to <directory> to keep ' +
            'them somewhere else before the worktree is removed.',
        );
      }
      // The files are only moved once every check below has passed. A tree
      // that is going to be kept must still hold them.
      untracked.push(...untrackedFiles);
    }
  }
  for (const operation of [
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'rebase-merge',
    'rebase-apply',
    'sequencer',
    'BISECT_LOG',
  ]) {
    const state = git(
      ['rev-parse', '--path-format=absolute', '--git-path', operation],
      worktree.path,
    );
    if (fs.existsSync(state))
      fail(`Preserve ${worktree.path}: ${operation} indicates an unfinished Git operation.`);
  }

  if (gitOrNull(['fetch', 'origin']) === null)
    fail('Fetch failed; cleanup requires current remote integration evidence.');

  // A detached tree has no branch to merge. What it holds is a commit, and the
  // question is the same one: has that work already landed? Asking about the
  // branch instead would refuse every detached tree, and a refused tree is a
  // tree that stays forever.
  //
  // origin/main is the reference, because the local main goes stale the moment
  // somebody else lands, and a stale ref refuses work that has in fact
  // landed. The local main is still asked, because a repository that has no
  // remote at all is a repository whose only record of what landed is local.
  const subject = branch || worktree.head;
  const proof = proveIntegration(subject, 'origin/main');
  const localProof = proof.integrated ? null : proveIntegration(subject, 'main');
  if (!proof.integrated && !localProof?.integrated) {
    fail(
      `Kept ${worktree.path}: ${subject} is not integrated into origin/main (${proof.reason}). ` +
        'Fetch and verify integration first.',
    );
  }
  const accepted = proof.integrated ? proof : localProof;

  // Git also removes ignored files. Only disposable build/install output may
  // be discarded automatically; local data, credentials and notes must survive.
  const ignored = git(
    ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
    worktree.path,
  )
    .split('\0')
    .filter(Boolean);
  const disposable = ignored.filter(
    (file) =>
      /^(?:(?:apps\/(?:server|web|worker)|packages\/(?:contracts|ui|agent-adapters))\/)?(?:node_modules|dist|coverage|\.vite)\//.test(
        file,
      ) ||
      /^(?:(?:apps\/(?:server|web|worker)|packages\/(?:contracts|ui|agent-adapters))\/)?[^/]+\.tsbuildinfo$/.test(
        file,
      ),
  );
  const candidates = ignored.filter((file) => !disposable.includes(file));
  const regenerable = candidates.filter((file) => isRegenerableRuntimeData(file, worktree.path));
  const mustSurvive = candidates.filter((file) => !regenerable.includes(file));

  if (mustSurvive.length) {
    const names = mustSurvive.flatMap((file) => ignoredEntryFiles(file, worktree.path));
    fail(
      `Preserve ignored files before cleanup:\n${names.join('\n')}\n\n` +
        'These are ignored files the worktree does not regenerate: a database, a note, a ' +
        'credential. Move them out of the worktree before the cleanup.',
    );
  }
  if (regenerable.length) {
    const names = regenerable.flatMap((file) => ignoredEntryFiles(file, worktree.path));
    if (!allowRuntimeData) {
      fail(
        `Preserve ignored files before cleanup:\n${names.join('\n')}\n\n` +
          'These are the runtime data the worktree regenerates for itself: a key the server ' +
          'writes on demand (data/secret.key), and test output. Re-run with ' +
          '--allow-runtime-data to discard them, or move them out of the worktree first.',
      );
    }
    process.stdout.write(
      'Discarding the runtime data this worktree regenerates for itself:\n' +
        names.map((file) => `  ${file}`).join('\n') +
        '\n',
    );
  }

  if (fs.lstatSync(worktree.path).isSymbolicLink())
    fail(`Preserve ${worktree.path}: the worktree root is a symbolic link/junction.`);
  inspectLinks(worktree.path, fs.realpathSync(worktree.path), detachSharedInstall);

  // Every check runs before anything is taken away. A removal that discovers
  // a problem half way through has already destroyed the thing it was
  // supposed to preserve, and the message it leaves behind describes a
  // failure that did not happen.
  if (untracked.length) {
    const destination = path.join(preserveTo as string, path.basename(worktree.path));
    preserveUncommittedFiles(worktree.path, destination, untracked);
    process.stdout.write(`Preserved ${untracked.length} uncommitted file(s) in ${destination}\n`);
  }

  // FACTORY.md asks for separate evidence that the original commits of a
  // squash-landed branch are preserved before the branch is deleted. The
  // evidence is a ref that still holds them: a tag, another branch, the
  // remote-tracking ref of a pushed branch, or the keep-ref written here.
  const tipSha = gitOrNullQuiet(['rev-parse', '--verify', `${subject}^{commit}`]);
  if (accepted?.unique.length && tipSha) {
    const holder = preservingRef([tipSha], branch, deleteRemote);
    if (holder) {
      process.stdout.write(`The branch's own commits are preserved by ${holder}.\n`);
    } else {
      const ref = keepRefName(branch || `detached-${tipSha.slice(0, 7)}`, tipSha);
      if (gitOrNullQuiet(['update-ref', ref, tipSha]) === null) {
        fail(
          `Kept ${worktree.path}: the commits of ${subject} are in no other ref, and ${ref} ` +
            'could not be written. Tag the branch, or keep another ref that holds its ' +
            'commits, and remove the worktree again.',
        );
      }
      process.stdout.write(
        `Kept the branch's own commits at ${ref}: they are not in origin/main, and deleting ` +
          'the branch would have destroyed them.\n',
      );
    }
  }

  if (deleteRemote && branch) {
    if (INTEGRATION_BRANCHES.has(branch)) {
      fail(
        `Kept the remote branch ${branch}: it is the integration branch, and deleting it would ` +
          'take the base with it.',
      );
    }
    // The local branch is about to go, so the reachability question is asked of
    // the remote ref itself rather than of a name that no longer resolves.
    const remoteHead = gitOrNullQuiet(['rev-parse', '--verify', `refs/remotes/origin/${branch}`]);
    if (!remoteHead) {
      process.stdout.write(`${branch} has no remote branch to delete.\n`);
    } else if (!remoteCommitsAreSafe(remoteHead, subject)) {
      fail(
        `Kept the remote branch ${branch}: it holds commits that are in neither origin/main nor ` +
          'the local branch, and deleting it would destroy them.',
      );
    } else {
      try {
        run('git', ['push', 'origin', '--delete', branch]);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(`Kept the remote branch ${branch}: the deletion was refused. ${detail}`);
      }
    }
  }

  try {
    run('git', ['worktree', 'remove', worktree.path]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      `The worktree ${worktree.path} was not removed: ${detail}\n` +
        'Recheck the registration (git worktree list) and the disk state before trying again.',
    );
  }

  if (branch) {
    if (INTEGRATION_BRANCHES.has(branch)) {
      fail(`Kept the branch ${branch}: it is the integration branch.`);
    }
    // The integration check above already proved this branch's work is in
    // origin/main, so the strict form of the delete is allowed to fail on a
    // branch that landed as a squash or a cherry-pick: git compares the
    // branch's own commits, and those are not the commits that landed. The
    // keep-ref written above is what keeps them alive.
    try {
      run('git', ['branch', '-d', branch]);
    } catch {
      try {
        run('git', ['branch', '-D', branch]);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(`The worktree is gone, but the branch ${branch} was not deleted: ${detail}`);
      }
    }
  }

  process.stdout.write(`Removed ${worktree.path}\n`);
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'new':
      cmdNew(args);
      break;
    case 'list':
      cmdList();
      break;
    case 'remove':
      cmdRemove(args);
      break;
    default:
      fail(
        'Usage: npx tsx scripts/work-item.ts <new|list|remove> …\n\n' +
          '  new WI-017 forge-panel   create the branch and the worktree\n' +
          '  list                    show the worktrees and their work items\n' +
          '  remove WI-017           take the worktree away\n' +
          '  remove --path <dir>     take a named worktree away\n' +
          REMOVE_OPTIONS.map((option) => `    ${option}\n`),
      );
  }
}

try {
  main();
} catch (error) {
  // A Git command that fails is an answer, not a crash. FACTORY.md asks for a
  // recheck of the registration and the disk state in that case, not for a
  // stack trace that says nothing about the state of anything.
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `The cleanup stopped: ${detail}\n` +
      'Recheck what is registered (git worktree list) and what is on disk, then run the ' +
      'command again.\n',
  );
  process.exit(1);
}
