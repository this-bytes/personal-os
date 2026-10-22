import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end browser tests.
 *
 * The server serves the built web client, so these tests run against the
 * same bundle that ships — not the Vite dev server. A new temporary data directory
 * is created before the server starts, so every run begins with an instance
 * that has no owner.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

/**
 * The port the test server listens on.
 *
 * It is configurable because several agents can run this suite at the same
 * time, and two Playwright sessions on one port fight over the same data
 * directory: the second one empties the database the first one is serving.
 * The symptom is a client that waits forever for the login screen, which
 * reads as a missing page rather than as a collision.
 */
const port = Number(process.env['PERSONAL_OS_E2E_PORT'] ?? 4319);

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
      // The harness creates a fresh temporary data directory for every run.
      PERSONAL_OS_OWNER_TOKEN: 'e2e-owner-token',
      LOG_LEVEL: 'warn',
    },
  },
});
