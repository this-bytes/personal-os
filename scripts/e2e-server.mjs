/**
 * Start the API server and the worker for the end-to-end browser tests.
 *
 * The data directory is emptied first, so every run starts from a clean
 * instance: no owner, no workspaces, nothing carried over from a previous
 * run. The server then serves the built web client, so the browser tests
 * exercise the same bundle that ships.
 *
 * **The worker runs here too.** The API server never runs an agent — it writes
 * an execution and enqueues a job, and the worker is what picks the job up and
 * runs the adapter. A browser suite without a worker can prove the room around
 * a turn, and cannot prove the turn: no agent ever answers. The deployment
 * starts the two processes the same way, the worker after the server is
 * healthy, and this harness mirrors that.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const dataDir = process.env['PERSONAL_OS_DATA_DIR'];
if (dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`[e2e] cleared ${dataDir}`);
}

/**
 * Serve a private copy of the built client.
 *
 * The chunk names in `apps/web/dist` are hashed, and every build rewrites
 * that directory. A build that lands while a browser test is loading a page
 * renames the very chunks the page asked for, and the test fails with a
 * blank screen that has nothing to do with the code under test.
 *
 * Several agents can run this suite at the same time, so each run takes its
 * own copy and serves that. The copy is taken once, before the server
 * starts, so it cannot change under the browser mid-test.
 */
const port = process.env['PERSONAL_OS_PORT'] ?? '4319';
const builtClient = path.join(repoRoot, 'apps', 'web', 'dist');
const servedClient = path.join(repoRoot, 'data', `e2e-web-${port}`);

if (fs.existsSync(builtClient)) {
  fs.rmSync(servedClient, { recursive: true, force: true });
  fs.cpSync(builtClient, servedClient, { recursive: true });
  process.env['PERSONAL_OS_WEB_DIST'] = servedClient;
  console.log(`[e2e] serving the client from ${servedClient}`);
} else {
  console.error('[e2e] the web client is not built. Run "npm run build" first.');
  process.exit(1);
}

const entry = path.join(repoRoot, 'apps', 'server', 'dist', 'index.js');
if (!fs.existsSync(entry)) {
  console.error('[e2e] the server is not built. Run "npm run build" first.');
  process.exit(1);
}

const workerEntry = path.join(repoRoot, 'apps', 'worker', 'dist', 'index.js');
if (!fs.existsSync(workerEntry)) {
  console.error('[e2e] the worker is not built. Run "npm run build" first.');
  process.exit(1);
}

/**
 * The key that opens the encrypted configuration.
 *
 * The two processes share one database, and the key has to be the same for
 * both or the worker cannot read what the server wrote. It is made here rather
 * than in either process, so that neither of them can generate one and then
 * read the other's secrets with the wrong key.
 */
const env = {
  ...process.env,
  PERSONAL_OS_SECRET_KEY:
    process.env['PERSONAL_OS_SECRET_KEY'] ?? randomBytes(32).toString('base64'),
};

const server = spawn(process.execPath, [entry], {
  cwd: repoRoot,
  stdio: 'inherit',
  env,
});

/** The worker, once the server is answering. */
let worker = null;

function stop() {
  worker?.kill('SIGTERM');
  server.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

server.on('exit', (code, signal) => {
  stop();
  process.exit(code ?? (signal ? 1 : 0));
});

/**
 * Wait for the server to answer, and then start the worker.
 *
 * The order matters for the same reason it matters in the deployment: the
 * server owns the schema, and the worker opens the database the server has
 * already migrated.
 */
async function startWorker() {
  const health = `http://127.0.0.1:${port}/api/health`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(health);
      if (response.ok) break;
    } catch {
      // The server is not answering yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log('[e2e] starting the worker');
  worker = spawn(process.execPath, [workerEntry], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  });

  worker.on('exit', (code, signal) => {
    stop();
    process.exit(code ?? (signal ? 1 : 0));
  });
}

void startWorker();
