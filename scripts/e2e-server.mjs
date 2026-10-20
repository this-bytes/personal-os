/**
 * Start the API server for the end-to-end browser tests.
 *
 * The data directory is emptied first, so every run starts from a clean
 * instance: no owner, no workspaces, nothing carried over from a previous
 * run. The server then serves the built web client from `apps/web/dist`,
 * which means the browser tests exercise the same bundle that ships.
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
