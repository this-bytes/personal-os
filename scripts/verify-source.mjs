/** Exercise the actual source launcher with disposable data and free ports. */
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const repository = path.resolve(import.meta.dirname, '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-source-'));
const root = path.join(sandbox, 'checkout');
const data = path.join(sandbox, 'data');
fs.mkdirSync(root);
// Copy tracked working files, including local edits, without ignored secrets or
// borrowed node_modules. Reload tests must never restart a hosted checkout.
const files = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (const file of files) {
  const source = path.join(repository, file);
  if (!fs.existsSync(source)) continue;
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
execFileSync(
  'git',
  [
    '-c',
    'user.name=Source test',
    '-c',
    'user.email=source@example.test',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'Source test snapshot',
  ],
  { cwd: root },
);
execFileSync(process.execPath, ['scripts/verify-update.mjs'], { cwd: root, stdio: 'inherit' });
async function port() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
const api = await port();
const web = await port();
const base = `http://127.0.0.1:${web}`;
const env = {
  ...process.env,
  PERSONAL_OS_ENV_FILE: path.join(data, 'absent.env'),
  PERSONAL_OS_DATA_DIR: data,
  PERSONAL_OS_SECRET_KEY: randomBytes(32).toString('base64'),
  PERSONAL_OS_HOST: '127.0.0.1',
  PERSONAL_OS_PORT: String(api),
  PERSONAL_OS_WEB_PORT: String(web),
  PERSONAL_OS_OWNER_TOKEN: randomBytes(24).toString('hex'),
};
let child;
let output = '';
async function waitFor(check, description) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`stack exited: ${output}`);
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out: ${description}\n${output}`);
}
async function start() {
  output = '';
  child = spawn('bash', ['deploy/source-stack.sh'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  await waitFor(async () => {
    try {
      return (
        (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).ok &&
        output.includes('Personal OS worker started')
      );
    } catch {
      return false;
    }
  }, 'source stack readiness');
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
async function verify() {
  const result = spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/verify-stack.ts', base],
    { cwd: root, env, stdio: 'inherit' },
  );
  const [code] = await once(result, 'exit');
  assert.equal(code, 0, 'worker executes a turn through the source-hosted API');
}
try {
  await start();
  assert.match(await (await fetch(base)).text(), /<div id="root">/);
  await verify();
  const before = await (await fetch(`${base}/api/auth/status`)).json();
  const watched = path.join(root, 'apps/server/src/index.ts');
  const stat = fs.statSync(watched);
  try {
    fs.utimesSync(watched, new Date(), new Date());
    await waitFor(() => output.includes('restarting server'), 'server reload');
    await waitFor(async () => {
      try {
        return (await fetch(`${base}/api/health`)).ok;
      } catch {
        return false;
      }
    }, 'API after reload');
  } finally {
    fs.utimesSync(watched, stat.atime, stat.mtime);
  }
  await stop();
  await start();
  assert.deepEqual(
    await (await fetch(`${base}/api/auth/status`)).json(),
    before,
    'owner survives restart',
  );
  await verify();
  // A manifest pull must drain cleanly; the launcher then installs and comes back.
  const manifest = path.join(root, 'packages/ui/package.json');
  const original = fs.readFileSync(manifest);
  try {
    const exited = once(child, 'exit');
    fs.appendFileSync(manifest, '\n');
    const [code] = await exited;
    assert.equal(code, 0, 'dependency change drains cleanly');
    await start();
    await verify();
  } finally {
    await stop();
    fs.writeFileSync(manifest, original);
  }
  console.log('Source hosting, reload, restart persistence and worker execution passed.');
} finally {
  await stop();
  fs.rmSync(sandbox, { recursive: true, force: true });
}
