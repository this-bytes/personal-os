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
  const parent = path.dirname(repoRoot);
  const name = path.basename(repoRoot);
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
 * `origin/main` when it is known, because a work item that starts from a
 * stale `main` will need a rebase before it can land — and the agent that
 * started it will not be around to resolve it. `main` is the fallback for a
 * checkout with no remote.
 */
function baseRef(): string {
  const hasOrigin = gitSucceeds(['rev-parse', '--verify', 'origin/main']);
  return hasOrigin ? 'origin/main' : 'main';
}

/**
 * The work items that already have a worktree, by work item number.
 *
 * The number is what a `.factory/work/WI-0xx.md` file carries, so this is how
 * a worktree is matched back to the item it belongs to.
 */
function worktreesByNumber(): Map<string, Worktree> {
  const map = new Map<string, Worktree>();
  for (const worktree of listWorktrees()) {
    if (!worktree.branch) continue;
    const match = /^wi\/(\d+)-/.exec(worktree.branch);
    const number = match?.[1];
    if (number) {
      map.set(number, worktree);
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
  const exists = gitSucceeds(['rev-parse', '--verify', `refs/heads/${branch}`]);

  if (exists) {
    fail(
      `The branch "${branch}" already exists.\n` +
        'Use a different slug, or work in the worktree that already has it.',
    );
  }
  if (fs.existsSync(target)) {
    fail(
      `${target} already exists.\n` +
        'Remove it first, or use "npx tsx scripts/work-item.ts remove ' +
        id +
        '" if it is a work item worktree.',
    );
  }

  fs.mkdirSync(worktreeRoot(), { recursive: true });

  const base = baseRef();
  process.stdout.write(`Creating ${branch} from ${base} at ${target}\n`);
  run('git', ['worktree', 'add', '-b', branch, target, base]);

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
  for (const [number, worktree] of [...byNumber.entries()].sort()) {
    const itemFile = path.join(repoRoot, '.factory', 'work', `WI-${number}.md`);
    const state = fs.existsSync(itemFile) ? readState(itemFile) : 'no work item file';
    process.stdout.write(`  WI-${number}  ${state.padEnd(14)} ${worktree.path}\n`);
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

function cmdRemove(args: string[]): void {
  const force = args.includes('--force');
  const [id] = args.filter((arg) => !arg.startsWith('--'));

  if (!id) {
    fail('Usage: npx tsx scripts/work-item.ts remove <WI-nnn> [--force]');
  }

  const number = id.replace(/^WI-/i, '');
  const worktree = worktreesByNumber().get(number);
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
          '  remove WI-017           take the worktree away\n',
      );
  }
}

main();
