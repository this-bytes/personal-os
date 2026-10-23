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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-work-item-'));
  scratch.push(directory);
  const repo = path.join(directory, 'repo');
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/work-item.ts'), path.join(repo, 'scripts/work-item.ts'));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.env\nnode_modules/\ndata/\n');
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Lifecycle test');
  git('config', 'user.email', 'lifecycle@example.invalid');
  git('add', '.');
  git('commit', '-m', 'fixture');
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
  const create = () => {
    const result = run(['new', 'WI-901', 'test', '--no-install']);
    expect(result.status, result.stderr).toBe(0);
  };
  return { repo, target, git, run, create, directory };
}

describe('work-item lifecycle preserves work', { timeout: 30_000 }, () => {
  it('never deletes an existing directory without Git metadata', () => {
    const f = fixture();
    fs.mkdirSync(f.target, { recursive: true });
    fs.writeFileSync(path.join(f.target, 'valuable.txt'), 'keep');
    expect(f.run(['new', 'WI-901', 'test', '--no-install']).status).not.toBe(0);
    expect(fs.readFileSync(path.join(f.target, 'valuable.txt'), 'utf8')).toBe('keep');
  });

  it('uses the primary repository location when called from a worktree', () => {
    const f = fixture();
    f.create();
    const result = f.run(['new', 'WI-902', 'second', '--no-install'], f.target);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(f.directory, 'repo-worktrees/902-second/.git'))).toBe(true);
  });

  it('rejects a second worktree for the same item', () => {
    const f = fixture();
    f.create();
    expect(f.run(['new', 'WI-901', 'duplicate', '--no-install']).status).not.toBe(0);
  });

  it('preserves unmerged commits and refuses force', () => {
    const f = fixture();
    f.create();
    f.git('-C', f.target, 'commit', '--allow-empty', '-m', 'unmerged');
    expect(f.run(['remove', 'WI-901']).status).not.toBe(0);
    expect(f.run(['remove', 'WI-901', '--force']).status).not.toBe(0);
    expect(fs.existsSync(path.join(f.target, '.git'))).toBe(true);
  });

  it('preserves dirty and ignored user files', () => {
    const f = fixture();
    f.create();
    fs.writeFileSync(path.join(f.target, 'notes.txt'), 'keep');
    expect(f.run(['remove', 'WI-901']).status).not.toBe(0);
    fs.unlinkSync(path.join(f.target, 'notes.txt'));
    fs.writeFileSync(path.join(f.target, '.env'), 'LOCAL_DATA=keep');
    expect(f.run(['remove', 'WI-901']).status).not.toBe(0);
    expect(fs.existsSync(path.join(f.target, '.env'))).toBe(true);
  });

  it('refuses ambiguous legacy item numbers', () => {
    const f = fixture();
    f.create();
    f.git('worktree', 'add', '-b', 'wi/901-other', path.join(f.directory, 'other'));
    expect(f.run(['remove', 'WI-901']).stderr).toContain('multiple worktrees');
    expect(fs.existsSync(path.join(f.target, '.git'))).toBe(true);
  });

  it('preserves ignored user data even beneath a directory named dist', () => {
    const f = fixture();
    f.create();
    fs.mkdirSync(path.join(f.target, 'data/dist'), { recursive: true });
    fs.writeFileSync(path.join(f.target, 'data/dist/notes.txt'), 'keep');
    expect(f.run(['remove', 'WI-901']).status).not.toBe(0);
    expect(fs.readFileSync(path.join(f.target, 'data/dist/notes.txt'), 'utf8')).toBe('keep');
  });

  it('preserves a pending merge even if its working tree is clean', () => {
    const f = fixture();
    f.create();
    f.git('checkout', '-b', 'other');
    f.git('commit', '--allow-empty', '-m', 'same tree');
    f.git('checkout', 'main');
    f.git('-C', f.target, 'merge', '--no-commit', '--no-ff', 'other');
    expect(f.git('-C', f.target, 'status', '--porcelain')).toBe('');
    const result = f.run(['remove', 'WI-901']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unfinished Git operation');
  });

  it('removes a clean integrated worktree and its branch', () => {
    const f = fixture();
    f.create();
    const result = f.run(['remove', 'WI-901']);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(f.target)).toBe(false);
    expect(f.git('branch', '--list', 'wi/901-test')).toBe('');
  });

  it('refuses a junction used as the worktree root', () => {
    const f = fixture();
    f.create();
    const actual = path.join(f.directory, 'actual');
    fs.renameSync(f.target, actual);
    fs.symlinkSync(actual, f.target, 'junction');
    const result = f.run(['remove', 'WI-901']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('worktree root is a symbolic link/junction');
    expect(fs.existsSync(path.join(actual, '.git'))).toBe(true);
  });

  it.each(['@personal-os/contracts', 'some-package/.git'])(
    'refuses external junctions at node_modules/%s before native Git can traverse them',
    (relative) => {
      const f = fixture();
      f.create();
      const outside = path.join(f.directory, 'other-checkout');
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, 'valuable.txt'), 'keep');
      const link = path.join(f.target, 'node_modules', relative);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(outside, link, 'junction');
      const result = f.run(['remove', 'WI-901']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('outside this worktree');
      expect(fs.readFileSync(path.join(outside, 'valuable.txt'), 'utf8')).toBe('keep');
      expect(fs.existsSync(path.join(f.target, '.git'))).toBe(true);
    },
  );
});
