import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end browser tests.
 *
 * The server serves the built web client, so these tests run against the
 * same bundle that ships — not the Vite dev server. The data directory is
 * emptied before the server starts, so every run begins with an instance
 * that has no owner.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const port = 4319;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    cwd: repoRoot,
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PERSONAL_OS_HOST: '127.0.0.1',
      PERSONAL_OS_PORT: String(port),
      PERSONAL_OS_DATA_DIR: path.join(repoRoot, 'data', 'e2e'),
      PERSONAL_OS_OWNER_TOKEN: 'e2e-owner-token',
      LOG_LEVEL: 'warn',
    },
  },
});
