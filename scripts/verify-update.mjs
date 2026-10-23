/** Prove the updater preserves local work and stops before moving main. */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-update-'));
const upstream = path.join(temp, 'upstream');
const hosted = path.join(temp, 'hosted');
const bin = path.join(temp, 'bin');
function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function identity(cwd) {
  git(cwd, 'config', 'user.name', 'Update test');
  git(cwd, 'config', 'user.email', 'update@example.test');
}
function commit(cwd, text) {
  fs.writeFileSync(path.join(cwd, 'version'), text);
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', text);
}
try {
  fs.mkdirSync(upstream);
  fs.mkdirSync(bin);
  git(upstream, 'init', '-b', 'main');
  identity(upstream);
  fs.mkdirSync(path.join(upstream, 'deploy'));
  fs.copyFileSync(path.join(root, 'deploy/update.sh'), path.join(upstream, 'deploy/update.sh'));
  commit(upstream, 'one');
  git(temp, 'clone', upstream, hosted);
  identity(hosted);
  const log = path.join(temp, 'service.log');
  fs.writeFileSync(
    path.join(bin, 'systemctl'),
    '#!/bin/bash\nprintf "%s %s\\n" "$*" "$(git rev-parse HEAD)" >> "$UPDATE_TEST_LOG"\n',
    { mode: 0o755 },
  );
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPDATE_TEST_LOG: log };
  const run = () => spawnSync('bash', ['deploy/update.sh'], { cwd: hosted, env, encoding: 'utf8' });
  const before = git(hosted, 'rev-parse', 'HEAD');
  commit(upstream, 'two');
  assert.equal(run().status, 0);
  const after = git(hosted, 'rev-parse', 'HEAD');
  assert.notEqual(after, before);
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(calls[0], `--user stop personal-os-stack.service ${before}`);
  assert.equal(calls[1], `--user start personal-os-stack.service ${after}`);
  fs.writeFileSync(path.join(hosted, 'local-work'), 'keep me');
  commit(upstream, 'three');
  assert.notEqual(run().status, 0);
  assert.equal(git(hosted, 'rev-parse', 'HEAD'), after);
  assert.equal(fs.readFileSync(path.join(hosted, 'local-work'), 'utf8'), 'keep me');
  fs.unlinkSync(path.join(hosted, 'local-work'));
  commit(hosted, 'local commit');
  const diverged = git(hosted, 'rev-parse', 'HEAD');
  assert.notEqual(run().status, 0);
  assert.equal(git(hosted, 'rev-parse', 'HEAD'), diverged);
  assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2);
  const config = path.join(temp, 'config');
  const installerEnv = { ...env, XDG_CONFIG_HOME: config };
  execFileSync('bash', ['deploy/install-service.sh'], { cwd: root, env: installerEnv });
  const unitDir = path.join(config, 'systemd/user');
  execFileSync(
    'systemd-analyze',
    ['verify', ...fs.readdirSync(unitDir).map((name) => path.join(unitDir, name))],
    { stdio: 'inherit' },
  );
  console.log('Updater safeguards and generated systemd units passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
