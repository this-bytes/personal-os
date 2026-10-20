/**
 * Verify that the compiled server boots and answers requests.
 * Used to check the production build path, not just the source path.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-prod-'));
const port = 4460 + Math.floor(Math.random() * 200);

const child = spawn(process.execPath, ['apps/server/dist/index.js'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_PORT: String(port),
    PERSONAL_OS_HOST: '127.0.0.1',
    LOG_LEVEL: 'warn',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString();
});
child.stdout.on('data', () => undefined);

async function main(): Promise<void> {
  const deadline = Date.now() + 20_000;
  let healthy = false;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        const body = (await response.json()) as { ok: boolean; setupRequired: boolean };
        process.stdout.write(`health: ${JSON.stringify(body)}\n`);
        healthy = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  if (!healthy) {
    throw new Error(`The compiled server did not become healthy.\n${stderr}`);
  }

  process.stdout.write('The compiled server boots and serves requests.\n');
}

main()
  .then(() => {
    child.kill('SIGTERM');
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    child.kill('SIGKILL');
    process.exit(1);
  });
