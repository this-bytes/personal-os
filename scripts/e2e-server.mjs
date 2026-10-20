/**
 * Start the API server for the end-to-end browser tests.
 *
 * The data directory is emptied first, so every run starts from a clean
 * instance: no owner, no workspaces, nothing carried over from a previous
 * run. The server then serves the built web client, so the browser tests
 * exercise the same bundle that ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

const child = spawn(process.execPath, [entry], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

const stop = () => child.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
