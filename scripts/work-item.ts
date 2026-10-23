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
 * branch is merged. An unmerged branch is somebody's work that has not landed
 * yet, and a script that deletes it is a script that loses work.
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
    let target: string;
    try {
      target = fs.realpathSync(directory);
    } catch {
      target = path.resolve(directory, '..', 'unresolvable');
    }
    const relative = path.relative(boundary, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
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
 * Whether a commit's work is already in a base branch.
 *
 * Ancestry is the ordinary answer, but it is not the only one. A slice is
 * often landed as a squash, a cherry-pick or a rebase, and then its commits
 * are not ancestors of main even though every line of their work is there.
 * `git cherry` measures exactly that: a '-' means the patch is already
 * applied, a '+' means it is not.
 *
 * A tree is only released when nothing is left behind — no unmerged commit,
 * no unapplied patch.
 */
function isIntegrated(subject: string, base: string): boolean {
  if (gitSucceeds(['merge-base', '--is-ancestor', subject, base])) return true;
  const patches = gitOrNull(['cherry', '-v', base, subject]);
  if (patches === null) return false;
  const commits = patches.split('\n').filter(Boolean);
  if (commits.length === 0) return true;
  return !commits.some((line) => line.startsWith('+'));
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
        '  --allow-runtime-data   discard the runtime data a worktree regenerates\n' +
        '  --delete-remote        delete the remote branch once it is merged\n' +
        '  --detach-shared-install unlink a shared install instead of refusing it\n' +
        '  --preserve-to <dir>    keep uncommitted files in <dir> before removal\n',
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
 * records. It is disposable only when every database inside it belongs to a
 * throwaway run, which is what `hasOnlyThrowawayDatabases` decides.
 */
function isRegenerableRuntimeData(entry: string, worktreePath: string): boolean {
  const normalized = entry.replace(/\\/g, '/');
  const isDirectory = normalized.endsWith('/');
  const trimmed = isDirectory ? normalized.slice(0, -1) : normalized;
  const base = trimmed.slice(trimmed.lastIndexOf('/') + 1);

  if (!isDirectory && base === 'secret.key') return true;
  if (isDirectory && (base === 'test-results' || base === 'playwright-report')) return true;
  if (isDirectory && base === 'data') {
    return hasOnlyThrowawayDatabases(path.join(worktreePath, trimmed));
  }
  return false;
}

/**
 * Whether a data directory holds only databases from throwaway runs.
 *
 * A database outside a folder named `e2e-*` is a real record, and a real
 * record is not disposable however the worktree came to be finished.
 */
function hasOnlyThrowawayDatabases(directory: string): boolean {
  for (const file of filesUnder(directory)) {
    if (!/\.(?:db|db-wal|db-shm)$/.test(file)) continue;
    const relative = path.relative(directory, file);
    const top = relative.split(path.sep)[0] ?? '';
    if (!top.startsWith('e2e-')) return false;
  }
  return true;
}

/** Every file under a directory, without following a link out of it. */
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
    if (arg.startsWith('--')) continue;
    positional.push(arg);
  }
  const allowRuntimeData = args.includes('--allow-runtime-data');
  const deleteRemote = args.includes('--delete-remote');
  const detachSharedInstall = args.includes('--detach-shared-install');

  const worktree = selectWorktreeForRemoval(positional[0], requestedPath);
  if (path.resolve(worktree.path) === repoRoot)
    fail('Run removal from another checkout, after the worktree owner has finished.');

  const status = gitOrNull(['status', '--porcelain'], worktree.path);
  if (status === null)
    fail(
      `Cannot inspect ${worktree.path}. Use the Git/platform that owns this worktree; do not prune it.`,
    );
  if (status) {
    const lines = status.split('\n').filter(Boolean);
    const tracked = lines.filter((line) => !line.startsWith('??'));
    const untracked = lines
      .filter((line) => line.startsWith('?? '))
      .map((line) => line.slice(3).trim());

    if (tracked.length) {
      fail(
        `${worktree.path} has uncommitted changes:\n${tracked.join('\n')}\n\n` +
          'Commit them, or move them elsewhere, before the worktree is removed.',
      );
    }
    if (untracked.length) {
      if (!preserveTo) {
        fail(
          `${worktree.path} has uncommitted files:\n${untracked.join('\n')}\n\n` +
            'Commit them, move them elsewhere, or pass --preserve-to <directory> to keep ' +
            'them somewhere else before the worktree is removed.',
        );
      }
      const destination = path.join(preserveTo, path.basename(worktree.path));
      for (const relative of untracked) {
        const from = path.join(worktree.path, relative);
        const to = path.join(destination, relative);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        try {
          fs.renameSync(from, to);
        } catch {
          fs.copyFileSync(from, to);
          fs.unlinkSync(from);
        }
      }
      process.stdout.write(`Preserved ${untracked.length} uncommitted file(s) in ${destination}\n`);
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

  const branch = worktree.branch ?? '';
  if (gitOrNull(['fetch', 'origin']) === null)
    fail('Fetch failed; cleanup requires current remote integration evidence.');

  // A detached tree has no branch to merge. What it holds is a commit, and the
  // question is the same one: has that work already landed? Asking about the
  // branch instead would refuse every detached tree, and a refused tree is a
  // tree that stays forever.
  //
  // The reference is origin/main rather than the local main, because the local
  // ref goes stale the moment somebody else lands, and a stale ref refuses
  // work that has in fact landed. The fetch above makes origin/main current.
  const subject = branch || worktree.head;
  if (!isIntegrated(subject, 'origin/main')) {
    fail(
      `Kept ${worktree.path}: ${subject} is not integrated into origin/main. Fetch and verify integration first.`,
    );
  }

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

  if (mustSurvive.length) fail(`Preserve ignored files before cleanup:\n${mustSurvive.join('\n')}`);
  if (regenerable.length) {
    if (!allowRuntimeData) {
      fail(
        `Preserve ignored files before cleanup:\n${regenerable.join('\n')}\n\n` +
          'These are the runtime data the worktree regenerates for itself — a key it ' +
          'writes on demand, a throwaway test database, test output. Re-run with ' +
          '--allow-runtime-data to discard them, or move them out of the worktree first.',
      );
    }
    process.stdout.write(
      'Discarding the runtime data this worktree regenerates for itself:\n' +
        regenerable.map((file) => `  ${file}`).join('\n') +
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
  if (deleteRemote && branch) {
    // The local branch is about to go, so the reachability question is asked of
    // the remote ref itself rather than of a name that no longer resolves.
    const remoteHead = gitOrNull(['rev-parse', '--verify', `refs/remotes/origin/${branch}`]);
    if (!remoteHead) {
      process.stdout.write(`${branch} has no remote branch to delete.\n`);
    } else if (!isIntegrated(remoteHead, 'origin/main')) {
      fail(`Kept the remote branch ${branch}: it is not integrated into origin/main.`);
    } else {
      run('git', ['push', 'origin', '--delete', branch]);
    }
  }

  run('git', ['worktree', 'remove', worktree.path]);

  if (branch) {
    // The integration check above already proved this branch's work is in
    // origin/main, so the strict form of the delete is allowed to fail on a
    // branch that landed as a squash or a cherry-pick: git compares the
    // branch's own commits, and those are not the commits that landed.
    try {
      run('git', ['branch', '-d', branch]);
    } catch {
      run('git', ['branch', '-D', branch]);
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
          '    --allow-runtime-data  also discard the runtime data it regenerates\n' +
          '    --delete-remote       also delete the merged remote branch\n' +
          '    --detach-shared-install  unlink a shared install instead of refusing it\n' +
          '    --preserve-to <dir>   keep uncommitted files in <dir> before removal\n',
      );
  }
}

main();
