/**
 * The Personal OS iteration stack.
 *
 * It runs the three processes of the product from source and restarts the
 * ones a change affects:
 *
 *   - the API server, on `apps/server/src`,
 *   - the execution worker, on `apps/worker/src`,
 *   - the web client, on Vite, which reloads in place.
 *
 * Three properties make it safe to leave running while an agent works:
 *
 *   - **The shared packages resolve from source.** `tsconfig.dev.json`
 *     points the workspace packages at their TypeScript, so a change to a
 *     contract or an adapter reaches the running processes instead of
 *     waiting for a rebuild.
 *   - **The worker is never stopped mid-turn.** A turn that is killed
 *     leaves a job whose lease expires, and the queue runs that turn a
 *     second time. On a system with real signals the worker is asked to
 *     stop and finishes what it is running; where a child cannot be asked
 *     politely, it is only stopped while it is idle.
 *   - **The instance follows the checkout, not a worktree.** Agents write
 *     their work in worktrees beside the repository, so an unfinished
 *     branch cannot reach the running instance.
 *
 * This is an iteration tool. The deployment is the Compose stack in
 * `deploy/`, and it runs the compiled code.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

/** How often the watched paths are checked. Polling beats `fs.watch` on Windows and on a mounted drive. */
const POLL_INTERVAL_MS = 400;

/** How long the API server gets to close before it is killed. */
const SERVER_STOP_TIMEOUT_MS = 10_000;

/**
 * How long the worker gets to finish the turn it is running.
 *
 * A turn can take minutes, and killing it would let the queue run it again.
 */
const WORKER_STOP_TIMEOUT_MS = 30 * 60_000;

/** How long the worker is given to become idle before it is stopped anyway. */
const WORKER_IDLE_WAIT_MS = 30 * 60_000;

/** A child that stops this soon after starting crashed rather than exited. */
const CRASH_WINDOW_MS = 3_000;

/** How long the server is given to become healthy before the worker starts. */
const SERVER_READY_TIMEOUT_MS = 60_000;

const API_PORT = process.env['PERSONAL_OS_PORT'] ?? '4317';
const WEB_PORT = process.env['PERSONAL_OS_WEB_PORT'] ?? '5173';
const API_HOST = process.env['PERSONAL_OS_HOST'] ?? '127.0.0.1';

const DATA_DIR = path.resolve(process.env['PERSONAL_OS_DATA_DIR'] ?? path.join(root, 'data'));
const DB_PATH = path.join(DATA_DIR, 'personal-os.db');

const TSX_CLI = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const VITE_CLI = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const DEV_TSCONFIG = path.join(root, 'tsconfig.dev.json');

type ChildName = 'server' | 'worker' | 'web';

interface ChildSpec {
  cwd: string;
  args: string[];
  env: Record<string, string>;
}

const SPECS: Record<ChildName, ChildSpec> = {
  server: {
    cwd: path.join(root, 'apps', 'server'),
    args: [TSX_CLI, '--tsconfig', DEV_TSCONFIG, 'src/index.ts'],
    env: {
      PERSONAL_OS_HOST: API_HOST,
      PERSONAL_OS_PORT: API_PORT,
      // The iteration instance binds to the loopback address and has one
      // owner, so an agent is allowed to reach a service on the owner's own
      // machine. The deployment keeps the guard.
      PERSONAL_OS_ALLOW_PRIVATE_TARGETS: process.env['PERSONAL_OS_ALLOW_PRIVATE_TARGETS'] ?? 'true',
    },
  },
  worker: {
    cwd: path.join(root, 'apps', 'worker'),
    args: [TSX_CLI, '--tsconfig', DEV_TSCONFIG, 'src/index.ts'],
    env: {},
  },
  web: {
    cwd: path.join(root, 'apps', 'web'),
    args: [VITE_CLI, '--host', API_HOST, '--port', WEB_PORT, '--strictPort'],
    env: { PERSONAL_OS_API_TARGET: `http://${API_HOST}:${API_PORT}` },
  },
};

interface WatchTarget {
  label: string;
  paths: string[];
  restarts: ChildName[];
}

/**
 * What is watched, and what a change to it restarts.
 *
 * The web client is not in this list: Vite reloads it in place, so a change
 * to the client, to the UI package or to the contracts is picked up without
 * restarting anything.
 */
const WATCH_TARGETS: WatchTarget[] = [
  {
    label: 'server',
    paths: [path.join(root, 'apps', 'server', 'src')],
    restarts: ['server'],
  },
  {
    label: 'worker',
    paths: [path.join(root, 'apps', 'worker', 'src')],
    restarts: ['worker'],
  },
  {
    label: 'contracts',
    paths: [path.join(root, 'packages', 'contracts', 'src')],
    restarts: ['server', 'worker'],
  },
  {
    label: 'adapters',
    paths: [path.join(root, 'packages', 'agent-adapters', 'src')],
    restarts: ['server', 'worker'],
  },
  {
    label: 'dev tsconfig',
    paths: [DEV_TSCONFIG],
    restarts: ['server', 'worker'],
  },
  {
    label: 'vite config',
    paths: [path.join(root, 'apps', 'web', 'vite.config.ts')],
    restarts: ['web'],
  },
];

interface Child {
  name: ChildName;
  proc: ChildProcess | null;
  stopping: boolean;
  startedAt: number;
}

const children: Record<ChildName, Child> = {
  server: { name: 'server', proc: null, stopping: false, startedAt: 0 },
  worker: { name: 'worker', proc: null, stopping: false, startedAt: 0 },
  web: { name: 'web', proc: null, stopping: false, startedAt: 0 },
};

const pending = new Set<ChildName>();
let shuttingDown = false;

function log(message: string): void {
  process.stdout.write(`[${new Date().toISOString()}] [stack] ${message}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Is the worker running a turn right now?
 *
 * The queue is the record of what the worker is doing. It is read only, and
 * only where a child cannot be asked to stop politely: on Windows a
 * `kill` terminates the process outright, so the worker is only stopped
 * while it has nothing in flight.
 */
function workerIsBusy(): boolean {
  let database: Database.Database | undefined;
  try {
    database = new Database(DB_PATH, { fileMustExist: true });
    const row = database
      .prepare("SELECT count(*) AS busy FROM queue_jobs WHERE status = 'running'")
      .get() as { busy: number } | undefined;
    return (row?.busy ?? 0) > 0;
  } catch {
    // No readable queue: there is nothing to wait for.
    return false;
  } finally {
    database?.close();
  }
}

async function waitForWorkerIdle(): Promise<void> {
  if (process.platform !== 'win32') {
    // A real signal reaches the worker, and the worker finishes the turn it
    // is running before it exits.
    return;
  }
  const deadline = Date.now() + WORKER_IDLE_WAIT_MS;
  while (Date.now() < deadline && workerIsBusy()) {
    log('the worker is running a turn; waiting for it to finish before restarting it');
    await sleep(1_000);
  }
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, API_HOST);
  });
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${API_HOST}:${API_PORT}/api/health`);
      if (response.ok) return true;
    } catch {
      // The server is not answering yet.
    }
    await sleep(300);
  }
  return false;
}

function startChild(name: ChildName): void {
  const spec = SPECS[name];
  const child = children[name];
  child.stopping = false;
  child.startedAt = Date.now();

  const proc = spawn(process.execPath, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdio: 'inherit',
  });
  child.proc = proc;

  proc.on('exit', (code, signal) => {
    if (child.proc === proc) child.proc = null;
    if (shuttingDown || child.stopping) return;

    const how = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    if (Date.now() - child.startedAt < CRASH_WINDOW_MS) {
      log(`${name} stopped (${how}) straight after starting; it waits for a change now`);
      return;
    }
    log(`${name} stopped (${how}); starting it again`);
    setTimeout(() => {
      if (!shuttingDown) startChild(name);
    }, 500);
  });
}

async function stopChild(name: ChildName): Promise<void> {
  const child = children[name];
  const proc = child.proc;
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) {
    child.proc = null;
    return;
  }

  if (name === 'worker') await waitForWorkerIdle();

  const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  proc.kill('SIGTERM');

  const timeout =
    name === 'worker' && process.platform !== 'win32'
      ? WORKER_STOP_TIMEOUT_MS
      : SERVER_STOP_TIMEOUT_MS;

  const timedOut = await Promise.race([exited.then(() => false), sleep(timeout).then(() => true)]);

  if (timedOut) {
    log(`${name} did not stop within ${Math.round(timeout / 1000)}s; killing it`);
    proc.kill('SIGKILL');
    await exited;
  }
  child.proc = null;
}

function requestRestart(name: ChildName): void {
  const child = children[name];
  if (child.stopping) {
    pending.add(name);
    return;
  }
  pending.delete(name);
  child.stopping = true;

  void (async () => {
    log(`restarting ${name}`);
    await stopChild(name);
    child.stopping = false;
    if (shuttingDown) return;
    if (name === 'worker') {
      // The worker applies migrations at boot, and so does the server. The
      // server goes first, the same order the Compose stack uses.
      const healthy = await waitForHealth(SERVER_READY_TIMEOUT_MS);
      if (!healthy) log('the server is not healthy; starting the worker anyway');
    }
    startChild(name);
  })();
}

function walk(paths: string[]): string[] {
  const files: string[] = [];
  const stack = [...paths];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (current.endsWith('__tests__') || current.endsWith('node_modules')) continue;
      let entries: string[];
      try {
        entries = fs.readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) stack.push(path.join(current, entry));
      continue;
    }
    files.push(current);
  }
  return files;
}

function signature(target: WatchTarget): string {
  const parts: string[] = [];
  for (const file of walk(target.paths)) {
    try {
      const stat = fs.statSync(file);
      parts.push(`${file}|${stat.mtimeMs}|${stat.size}`);
    } catch {
      // The file went away between the walk and the stat.
    }
  }
  return parts.sort().join('\n');
}

async function watch(): Promise<void> {
  const snapshots = new Map<string, string>();
  for (const target of WATCH_TARGETS) snapshots.set(target.label, signature(target));

  while (!shuttingDown) {
    await sleep(POLL_INTERVAL_MS);

    for (const target of WATCH_TARGETS) {
      const next = signature(target);
      if (next === snapshots.get(target.label)) continue;
      snapshots.set(target.label, next);
      log(`${target.label} changed`);
      for (const name of target.restarts) pending.add(name);
    }

    for (const name of [...pending]) {
      if (children[name].stopping) continue;
      requestRestart(name);
    }
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log('stopping the stack');
  await Promise.all([stopChild('server'), stopChild('worker'), stopChild('web')]);
  process.exit(0);
}

async function main(): Promise<void> {
  const apiPort = Number(API_PORT);
  if (!(await isPortFree(apiPort))) {
    process.stderr.write(
      `[stack] port ${apiPort} is already in use.\n` +
        `[stack] Stop the other instance, or run the stack on another port:\n` +
        `[stack]   PERSONAL_OS_PORT=4318 PERSONAL_OS_WEB_PORT=5174 npm run dev:stack\n`,
    );
    process.exit(1);
  }

  log(`api on http://${API_HOST}:${API_PORT}, client on http://${API_HOST}:${WEB_PORT}`);
  log(`data in ${DATA_DIR}`);

  startChild('web');
  startChild('server');

  const healthy = await waitForHealth(SERVER_READY_TIMEOUT_MS);
  if (!healthy) log('the server did not become healthy; starting the worker anyway');
  startChild('worker');

  await watch();
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
