/**
 * Independent review of the cleanup helper's new surface.
 *
 * These cases come from an adversarial review of `chore/worktree-cleanup`
 * (scripts/work-item.ts and .githooks/pre-push). They are written against the
 * behaviour the helper PROMISES, not against what it currently does, so a case
 * that fails today is a defect the implementer has to fix — not a broken test.
 *
 * Each case builds a throwaway repository with a real origin, creates a
 * worktree in it and runs the helper as a child process, exactly like
 * workItem.test.ts does.
 *
 * Nothing here touches a real checkout.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-work-item-safety-'));
  scratch.push(directory);
  const repo = path.join(directory, 'repo');
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/work-item.ts'), path.join(repo, 'scripts/work-item.ts'));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(
    path.join(repo, '.gitignore'),
    '.env\nnode_modules/\ndata/\n*.db\nsecret.key\ntest-results/\nplaywright-report/\n',
  );
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  /**
   * A command that is allowed to fail.
   *
   * The merge in the scenario below is meant to conflict: the resolution is
   * what the branch owns and main does not, and `git merge` reports a
   * conflict with a non-zero exit. The scenario resolves it by hand
   * afterwards, the way a person would.
   */
  const gitAllowingFailure = (...args: string[]) =>
    spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const write = (relative: string, content: string) => {
    const target = path.join(repo, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Safety test');
  git('config', 'user.email', 'safety@example.invalid');
  write('f.txt', 'base');
  git('add', '.');
  git('commit', '-m', 'fixture');
  // The repository is its own origin, so origin/main is main.
  git('remote', 'add', 'origin', repo);
  git('fetch', 'origin');
  const run = (args: string[], from = repo) =>
    spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(from, 'scripts/work-item.ts'),
        ...args,
      ],
      { cwd: from, encoding: 'utf8' },
    );
  const target = path.join(directory, 'repo-worktrees', '901-test');
  const create = (branch = 'wi/901-test') => {
    const result = run(['new', 'WI-901', 'test', '--no-install']);
    expect(result.status, result.stderr).toBe(0);
    return branch;
  };
  return { repo, target, git, gitAllowingFailure, write, run, create, directory };
}

/**
 * A repository with a real bare origin.
 *
 * The repository in `fixture` is its own origin, so every branch it has ever
 * had is also a remote-tracking ref. A branch that was never pushed is held
 * by nothing but itself, and that is the shape the separate-evidence rule is
 * about.
 */
function remoteFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-work-item-remote-'));
  scratch.push(directory);
  const origin = path.join(directory, 'origin.git');
  const repo = path.join(directory, 'repo');
  fs.mkdirSync(origin);
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/work-item.ts'), path.join(repo, 'scripts/work-item.ts'));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(
    path.join(repo, '.gitignore'),
    '.env\nnode_modules/\ndata/\n*.db\nsecret.key\ntest-results/\nplaywright-report/\n',
  );
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  execFileSync('git', ['init', '--bare', '-b', 'main', origin], { encoding: 'utf8' });
  execFileSync('git', ['init', '-b', 'main', repo], { encoding: 'utf8' });
  git('config', 'user.name', 'Remote test');
  git('config', 'user.email', 'remote@example.invalid');
  fs.writeFileSync(path.join(repo, 'f.txt'), 'base');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('remote', 'add', 'origin', origin);
  git('push', '-u', 'origin', 'main');
  const run = (args: string[], from = repo) =>
    spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(from, 'scripts/work-item.ts'),
        ...args,
      ],
      { cwd: from, encoding: 'utf8' },
    );
  return { directory, origin, repo, git, run };
}

/**
 * A branch whose only commit that main does not have is a MERGE, and whose
 * merge resolution exists nowhere in main.
 *
 * `git cherry` never reports merge commits, so the merge is invisible to the
 * patch-equivalence proof: every patch it can see is already applied. The
 * branch's own content is not in main.
 */
function branchWithHiddenMergeResolution(f: ReturnType<typeof fixture>): string {
  const base = f.git('rev-parse', 'HEAD');
  // main: base -> topic -> side
  f.write('f.txt', 'topic');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'P topic change');
  f.write('f.txt', 'side');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'P2 side change');
  // side branch: the same two patches, from the base
  f.git('checkout', '-b', 'side-branch', base);
  f.write('f.txt', 'topic');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'X prime topic change');
  f.write('f.txt', 'side');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'S prime side change');
  // topic branch: one patch, then a merge whose resolution is its own
  f.git('checkout', '-b', 'wi/901-test', base);
  f.write('f.txt', 'topic');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'X topic change');
  f.gitAllowingFailure('merge', '--no-ff', 'side-branch', '-m', 'M merge with a resolution');
  f.write('f.txt', 'resolved-only-here');
  f.git('add', 'f.txt');
  f.git('commit', '-m', 'M merge with a resolution');
  f.git('checkout', 'main');
  return 'wi/901-test';
}

describe('cleanup helper: the integration proof', { timeout: 120_000 }, () => {
  it('keeps a branch whose merge resolution is not in main', () => {
    const f = fixture();
    const branch = branchWithHiddenMergeResolution(f);
    const target = path.join(f.directory, 'repo-worktrees', '901-test');
    f.git('worktree', 'add', target, branch);

    // The repository is its own origin, and origin/main was fetched before
    // main moved on. The helper fetches for itself before it proves
    // anything, so the proof is taken against the same remote state.
    f.git('fetch', 'origin');

    // The proof cannot see the merge: every patch it reports is applied.
    expect(f.git('cherry', 'origin/main', branch)).not.toContain('+');
    // And the branch's content is genuinely not in main.
    expect(f.git('show', 'origin/main:f.txt')).toBe('side');
    expect(f.git('show', `${branch}:f.txt`)).toBe('resolved-only-here');

    const result = f.run(['remove', '--path', target]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(fs.existsSync(target)).toBe(true);
    expect(f.git('branch', '--list', branch)).not.toBe('');
  });

  it('keeps a branch whose only difference from main is a merge commit', () => {
    const f = fixture();
    const base = f.git('rev-parse', 'HEAD');
    // A branch that is already in main...
    f.git('checkout', '-b', 'already-in-main');
    f.write('g.txt', 'in main');
    f.git('add', 'g.txt');
    f.git('commit', '-m', 'G in main');
    f.git('checkout', 'main');
    f.git('merge', '--no-ff', 'already-in-main', '-m', 'G merged into main');
    // A branch whose only unique commit is a merge of it.
    f.git('checkout', '-b', 'wi/901-test', base);
    f.git('merge', '--no-ff', 'already-in-main', '-m', 'M merge only');
    f.git('checkout', 'main');
    const target = path.join(f.directory, 'repo-worktrees', '901-test');
    f.git('worktree', 'add', target, 'wi/901-test');

    // The repository is its own origin, and origin/main was fetched before
    // main moved on. The helper fetches for itself before it proves
    // anything, so the proof is taken against the same remote state.
    f.git('fetch', 'origin');

    // One commit is not in main, but `git cherry` reports nothing at all.
    expect(f.git('rev-list', 'origin/main...wi/901-test')).not.toBe('');
    expect(f.git('cherry', 'origin/main', 'wi/901-test')).toBe('');

    const result = f.run(['remove', '--path', target]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(fs.existsSync(target)).toBe(true);
  });

  it('removes a branch that landed as a squash or a cherry-pick', () => {
    const f = fixture();
    const base = f.git('rev-parse', 'HEAD');
    f.git('checkout', '-b', 'wi/901-test', base);
    f.write('h.txt', 'squashed work');
    f.git('add', 'h.txt');
    f.git('commit', '-m', 'H work');
    f.git('checkout', 'main');
    f.git('cherry-pick', '-x', 'wi/901-test');
    const target = path.join(f.directory, 'repo-worktrees', '901-test');
    f.git('worktree', 'add', target, 'wi/901-test');

    const result = f.run(['remove', '--path', target]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(target)).toBe(false);
    expect(f.git('branch', '--list', 'wi/901-test')).toBe('');
  });

  it('keeps a branch that is not in main, whatever the flags say', () => {
    const f = fixture();
    f.create();
    f.git('-C', f.target, 'commit', '--allow-empty', '-m', 'unmerged');
    const preserved = path.join(f.directory, 'preserved');
    const result = f.run([
      'remove',
      '--path',
      f.target,
      '--allow-runtime-data',
      '--delete-remote',
      '--detach-shared-install',
      '--preserve-to',
      preserved,
    ]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(fs.existsSync(f.target)).toBe(true);
    expect(f.git('branch', '--list', 'wi/901-test')).not.toBe('');
  });
});

describe('cleanup helper: checks run before mutations', { timeout: 120_000 }, () => {
  it('does not move uncommitted files out of a tree it is going to keep', () => {
    const f = fixture();
    f.create();
    f.git('-C', f.target, 'commit', '--allow-empty', '-m', 'unmerged');
    fs.writeFileSync(path.join(f.target, 'notes.txt'), 'keep me');
    const preserved = path.join(f.directory, 'preserved');

    const result = f.run(['remove', '--path', f.target, '--preserve-to', preserved]);
    expect(result.status, result.stderr).not.toBe(0);
    // The tree is kept, so its uncommitted files must still be in it.
    expect(fs.existsSync(path.join(f.target, 'notes.txt'))).toBe(true);
    expect(fs.existsSync(path.join(preserved, '901-test', 'notes.txt'))).toBe(false);
  });

  it('does not move uncommitted files out of a tree with ignored data it refuses', () => {
    const f = fixture();
    f.create();
    fs.writeFileSync(path.join(f.target, 'notes.txt'), 'keep me');
    fs.mkdirSync(path.join(f.target, 'data'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'data', 'personal-os.db'), 'REAL DATABASE');
    const preserved = path.join(f.directory, 'preserved');

    const result = f.run(['remove', '--path', f.target, '--preserve-to', preserved]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(fs.existsSync(path.join(f.target, 'notes.txt'))).toBe(true);
  });
});

describe('cleanup helper: runtime data', { timeout: 120_000 }, () => {
  it('never discards a real database', () => {
    const f = fixture();
    f.create();
    fs.mkdirSync(path.join(f.target, 'data'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'data', 'personal-os.db'), 'REAL DATABASE');
    fs.writeFileSync(path.join(f.target, 'data', 'secret.key'), 'THE KEY');

    const result = f.run(['remove', '--path', f.target, '--allow-runtime-data']);
    expect(result.status, result.stderr).not.toBe(0);
    expect(fs.existsSync(path.join(f.target, 'data', 'personal-os.db'))).toBe(true);
    expect(fs.readFileSync(path.join(f.target, 'data', 'personal-os.db'), 'utf8')).toBe(
      'REAL DATABASE',
    );
    expect(fs.readFileSync(path.join(f.target, 'data', 'secret.key'), 'utf8')).toBe('THE KEY');
  });

  it('discards the key the server writes for itself', () => {
    // apps/server/src/config.ts writes <repoRoot>/data/secret.key with fresh
    // random bytes whenever it is missing, so it belongs to the tree that has
    // it. The helper promises to discard it with --allow-runtime-data.
    const f = fixture();
    f.create();
    fs.mkdirSync(path.join(f.target, 'data'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'data', 'secret.key'), 'THE KEY');

    const result = f.run(['remove', '--path', f.target, '--allow-runtime-data']);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(f.target)).toBe(false);
  });

  it('does not discard a database that happens to sit under an e2e- folder', () => {
    // The e2e-* convention was a guess about a harness that no longer writes
    // into the worktree: scripts/e2e-server.mjs makes its throwaway database
    // in the temporary directory. Nothing under an e2e- folder is disposable
    // because of its name.
    const f = fixture();
    f.create();
    fs.mkdirSync(path.join(f.target, 'data', 'e2e-backup'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'data', 'e2e-backup', 'personal-os.db'), 'REAL DATABASE');

    const result = f.run(['remove', '--path', f.target, '--allow-runtime-data']);
    expect(result.status, result.stderr).not.toBe(0);
    expect(
      fs.readFileSync(path.join(f.target, 'data', 'e2e-backup', 'personal-os.db'), 'utf8'),
    ).toBe('REAL DATABASE');
  });
});

describe('cleanup helper: what the cleanup may never take', { timeout: 120_000 }, () => {
  it('never removes the main checkout', () => {
    const f = fixture();
    f.create();

    const result = f.run(['remove', '--path', f.repo, '--delete-remote']);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('main checkout');
    // The refusal is an answer, not a crash.
    expect(result.stderr).not.toContain('    at ');
    expect(fs.existsSync(path.join(f.repo, '.git'))).toBe(true);
    expect(f.git('branch', '--list', 'main')).not.toBe('');
    expect(f.git('rev-parse', '--verify', 'origin/main')).not.toBe('');
  });

  it('never deletes the integration branch', () => {
    const f = fixture();
    f.create();
    const mainTree = path.join(f.directory, 'main-tree');
    f.git('worktree', 'add', '--force', mainTree, 'main');

    const result = f.run(['remove', '--path', mainTree, '--delete-remote']);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('integration branch');
    expect(f.git('branch', '--list', 'main')).not.toBe('');
  });

  it('refuses an option it does not know instead of ignoring it', () => {
    const f = fixture();
    f.create();

    const result = f.run(['remove', '--path', f.target, '--delete-remotes']);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('--delete-remotes');
    expect(fs.existsSync(f.target)).toBe(true);
  });

  it('reports a Git failure as an answer rather than a crash', () => {
    const f = fixture();
    f.create();
    // The tree is gone from disk, and Git still has it registered.
    fs.rmSync(f.target, { recursive: true, force: true });

    const result = f.run(['remove', '--path', f.target]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).not.toContain('    at ');
  });

  it('refuses a dangling junction inside the worktree', () => {
    const f = fixture();
    f.create();
    const link = path.join(f.target, 'node_modules', 'notes-link');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(path.join(f.directory, 'nowhere'), link, 'junction');

    const result = f.run(['remove', '--path', f.target]);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('outside this worktree');
    expect(fs.existsSync(f.target)).toBe(true);
  });
});

describe('cleanup helper: preserving uncommitted files', { timeout: 120_000 }, () => {
  it('preserves an untracked directory as a directory', () => {
    const f = fixture();
    f.create();
    fs.mkdirSync(path.join(f.target, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'notes', 'today.md'), 'keep me');
    const preserved = path.join(f.directory, 'preserved');

    const result = f.run(['remove', '--path', f.target, '--preserve-to', preserved]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(preserved, '901-test', 'notes', 'today.md'))).toBe(true);
    expect(fs.existsSync(path.join(f.target, 'notes', 'today.md'))).toBe(false);
  });
});

describe(
  'cleanup helper: the commits of a branch that landed as content',
  { timeout: 120_000 },
  () => {
    it('keeps the commits of a branch that landed as a squash', () => {
      const f = remoteFixture();
      f.git('checkout', '-b', 'wi/901-test');
      // Two commits, so that the squash carries content no single patch of
      // the branch matches: that is the shape a squash merge really has.
      fs.writeFileSync(path.join(f.repo, 'h.txt'), 'one');
      f.git('add', '.');
      f.git('commit', '-m', 'H one');
      fs.writeFileSync(path.join(f.repo, 'i.txt'), 'two');
      f.git('add', '.');
      f.git('commit', '-m', 'H two');
      const sha = f.git('rev-parse', 'wi/901-test');
      f.git('checkout', 'main');
      f.git('merge', '--squash', 'wi/901-test');
      f.git('commit', '-m', 'H squashed work');
      f.git('push', 'origin', 'main');
      // The branch was never pushed, so nothing but the branch itself holds
      // its commits.
      const target = path.join(f.directory, 'repo-worktrees', '901-test');
      f.git('worktree', 'add', target, 'wi/901-test');

      const result = f.run(['remove', '--path', target]);
      expect(result.status, result.stderr).toBe(0);
      expect(fs.existsSync(target)).toBe(false);
      expect(f.git('branch', '--list', 'wi/901-test')).toBe('');
      // The branch is gone, but the commits it held are not: they are still
      // reachable through a ref of their own.
      const refs = f.git('for-each-ref', '--contains', sha, '--format=%(refname)');
      expect(refs).toContain('refs/keep/wi/901-test');
    });

    it('keeps the commits of a branch that landed as a cherry-pick', () => {
      const f = remoteFixture();
      f.git('checkout', '-b', 'wi/901-test');
      fs.writeFileSync(path.join(f.repo, 'h.txt'), 'cherry-picked work');
      f.git('add', '.');
      f.git('commit', '-m', 'H work');
      const sha = f.git('rev-parse', 'wi/901-test');
      f.git('checkout', 'main');
      f.git('cherry-pick', '-x', 'wi/901-test');
      f.git('push', 'origin', 'main');
      const target = path.join(f.directory, 'repo-worktrees', '901-test');
      f.git('worktree', 'add', target, 'wi/901-test');

      const result = f.run(['remove', '--path', target]);
      expect(result.status, result.stderr).toBe(0);
      expect(fs.existsSync(target)).toBe(false);
      expect(f.git('branch', '--list', 'wi/901-test')).toBe('');
      const refs = f.git('for-each-ref', '--contains', sha, '--format=%(refname)');
      expect(refs).toContain('refs/keep/wi/901-test');
    });

    it('does not destroy the commits when it deletes the remote branch too', () => {
      const f = remoteFixture();
      f.git('checkout', '-b', 'wi/901-test');
      fs.writeFileSync(path.join(f.repo, 'h.txt'), 'pushed work');
      f.git('add', '.');
      f.git('commit', '-m', 'H work');
      const sha = f.git('rev-parse', 'wi/901-test');
      f.git('push', 'origin', 'wi/901-test');
      f.git('checkout', 'main');
      f.git('cherry-pick', '-x', 'wi/901-test');
      f.git('push', 'origin', 'main');
      const target = path.join(f.directory, 'repo-worktrees', '901-test');
      f.git('worktree', 'add', target, 'wi/901-test');

      const result = f.run(['remove', '--path', target, '--delete-remote']);
      expect(result.status, result.stderr).toBe(0);
      // The remote branch is gone, and so is the local one. The commits they
      // held are not: a ref of their own still holds them.
      const refs = f.git('for-each-ref', '--contains', sha, '--format=%(refname)');
      expect(refs).toContain('refs/keep/wi/901-test');
    });
  },
);

/**
 * A repository with a real bare origin and the repository's own push gate.
 *
 * The gate is installed the way it is installed in practice: `core.hooksPath`
 * is local configuration, so a clone has to set it for itself.
 */
function hookFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-hook-'));
  scratch.push(directory);
  const origin = path.join(directory, 'origin.git');
  const repo = path.join(directory, 'repo');
  fs.mkdirSync(origin);
  fs.mkdirSync(repo);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  execFileSync('git', ['init', '--bare', '-b', 'main', origin], { encoding: 'utf8' });
  execFileSync('git', ['init', '-b', 'main', repo], { encoding: 'utf8' });
  git('config', 'user.name', 'Hook test');
  git('config', 'user.email', 'hook@example.invalid');
  fs.writeFileSync(path.join(repo, 'f.txt'), 'base');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('remote', 'add', 'origin', origin);
  git('push', '-u', 'origin', 'main');
  fs.mkdirSync(path.join(repo, '.githooks'), { recursive: true });
  fs.copyFileSync(
    path.join(root, '.githooks', 'pre-push'),
    path.join(repo, '.githooks', 'pre-push'),
  );
  git('config', 'core.hooksPath', '.githooks');
  const push = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  return { directory, origin, repo, git, push };
}

describe('cleanup helper: the push gate', { timeout: 120_000 }, () => {
  it('keeps a branch that holds a merge the base does not have', () => {
    const h = hookFixture();
    const base = h.git('rev-parse', 'HEAD');
    h.git('checkout', '-b', 'already-in-main');
    fs.writeFileSync(path.join(h.repo, 'g.txt'), 'in main');
    h.git('add', '.');
    h.git('commit', '-m', 'G in main');
    h.git('checkout', 'main');
    h.git('merge', '--no-ff', 'already-in-main', '-m', 'G merged into main');
    h.git('push', 'origin', 'main');
    // A branch whose only unique commit is a merge of what main already has.
    h.git('checkout', '-b', 'topic', base);
    h.git('merge', '--no-ff', 'already-in-main', '-m', 'M merge only');
    h.git('push', 'origin', 'topic');
    h.git('fetch', 'origin');

    const result = h.push('push', 'origin', '--delete', 'topic');
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status, output).not.toBe(0);
    expect(output).toContain('holds a merge');
    expect(output).not.toContain('already in');
  });

  it('says what it checked when it allows a deletion', () => {
    const h = hookFixture();
    // A branch landed as a squash: its content is in main, its commits are
    // not. Two commits, so that the squash carries content that no single
    // patch of the branch matches.
    h.git('checkout', '-b', 'topic');
    fs.writeFileSync(path.join(h.repo, 'h.txt'), 'one');
    h.git('add', '.');
    h.git('commit', '-m', 'H one');
    fs.writeFileSync(path.join(h.repo, 'i.txt'), 'two');
    h.git('add', '.');
    h.git('commit', '-m', 'H two');
    h.git('checkout', 'main');
    h.git('merge', '--squash', 'topic');
    h.git('commit', '-m', 'H squashed work');
    h.git('push', 'origin', 'main');
    h.git('push', 'origin', 'topic');
    h.git('fetch', 'origin');

    const result = h.push('push', 'origin', '--delete', 'topic');
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status, output).toBe(0);
    // The message states what the gate established, not a claim it did not.
    expect(output).toContain('its content is in');
  });
});
