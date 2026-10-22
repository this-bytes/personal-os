import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-pre-push-'));
  directories.push(dir);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Hook test');
  git('config', 'user.email', 'hook@example.invalid');
  git('commit', '--allow-empty', '-m', 'fixture');
  const main = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', main);
  const remove = (branch: string, sha: string, prefix = 'refs/heads/') =>
    spawnSync('sh', [path.join(root, '.githooks/pre-push'), 'origin', 'unused'], {
      cwd: dir,
      encoding: 'utf8',
      input: `(delete) ${'0'.repeat(40)} ${prefix}${branch} ${sha}\n`,
    });
  return { git, main, remove };
}

describe('pre-push deletion safety', () => {
  it('allows removal of a topic branch reachable from remote main', () => {
    const f = fixture();
    expect(f.remove('wi/901-completed', f.main).status).toBe(0);
  });
  it('refuses removal of unmerged topic commits', () => {
    const f = fixture();
    f.git('commit', '--allow-empty', '-m', 'unmerged');
    expect(f.remove('wi/901-unmerged', f.git('rev-parse', 'HEAD')).status).not.toBe(0);
  });
  it('refuses removal of main even if its commit is reachable', () => {
    const f = fixture();
    expect(f.remove('main', f.main).status).not.toBe(0);
  });
  it('does not treat release tags as merged topic branches', () => {
    const f = fixture();
    expect(f.remove('v1', f.main, 'refs/tags/').status).not.toBe(0);
  });
});
