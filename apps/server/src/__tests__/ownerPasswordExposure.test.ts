/**
 * What the recovery path costs.
 *
 * `ownerPasswordRecovery.test.ts` proves that the owner's password can only
 * be replaced from the command line of the server binary, and that the reset
 * itself is well behaved. This file pins the other half of that bargain: the
 * password is handed to the process on its command line, and a command line
 * is not private to the user who started the process.
 *
 * The implementation chose to keep the recovery path and to say plainly what
 * it costs. That is a reasonable choice, but a statement that is not written
 * down is not a statement: the owner reading the documentation has to be told
 * that the new password is readable by every other user on the host for as
 * long as the command runs.
 *
 * So this file asserts two things:
 *
 *  1. The exposure is real. The password is visible in the command line of
 *     the reset process, as the operating system reports it to another
 *     process.
 *  2. The documentation says so, in both places the command is documented.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import { createAuthService } from '../modules/auth/service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** A password that is impossible to confuse with anything else in the output. */
const NEW_PASSWORD = 'exposure-canary-7Q4x2Zp9';
const OLD_PASSWORD = 'correct horse battery';
const OWNER_TOKEN = 'exposure-owner-token';

/**
 * The command line of a running process, as the operating system shows it.
 *
 * On Linux this is /proc/<pid>/cmdline, which every user on the machine can
 * read. On Windows it is the command line the Win32_Process class reports.
 *
 * Returns null when the platform does not expose command lines at all.
 */
function readCommandLine(pid: number): string | null {
  const linux = path.join('/proc', String(pid), 'cmdline');
  if (fs.existsSync(linux)) {
    return fs.readFileSync(linux, 'utf8').split('\0').filter(Boolean).join(' ');
  }

  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ],
      { encoding: 'utf8' },
    );
    const text = (result.stdout ?? '').trim();
    return text.length > 0 ? text : null;
  }

  return null;
}

/** Whether this platform lets one process read the command line of another. */
function canReadCommandLines(): boolean {
  if (fs.existsSync(path.join('/proc', String(process.pid), 'cmdline'))) return true;
  if (process.platform !== 'win32') return false;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${process.pid}").CommandLine`,
    ],
    { encoding: 'utf8' },
  );
  return (result.stdout ?? '').trim().length > 0;
}

/** Wait until the command line of a process contains a given string. */
async function waitForCommandLine(
  pid: number,
  needle: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const commandLine = readCommandLine(pid);
    if (commandLine && commandLine.includes(needle)) return commandLine;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

let dataDir = '';
let dbPath = '';

/** The reset process, and the lock that keeps it alive long enough to read. */
let resetProcess: ChildProcess | undefined;
let lock: BetterSqlite3.Database | undefined;
let commandLine: string | null = null;
let resetExit: number | null = null;
let resetExited = false;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-exposure-'));
  dbPath = path.join(dataDir, 'personal-os.db');

  // An instance with an owner, so the reset has something to do.
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  const app = await buildApp({ config });
  await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: { email: 'owner@example.com', password: OLD_PASSWORD, displayName: 'Owner' },
  });
  await app.close();

  // The reset is held on a database lock, so the process stays alive long
  // enough to be read from the outside.
  lock = new BetterSqlite3(dbPath);
  lock.pragma('busy_timeout = 10000');
  lock.exec('BEGIN EXCLUSIVE');

  resetProcess = spawn(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(repoRoot, 'apps', 'server', 'src', 'index.ts'),
      '--reset-password',
      NEW_PASSWORD,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PERSONAL_OS_DATA_DIR: dataDir,
        PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
        LOG_LEVEL: 'silent',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  resetProcess.stdout?.on('data', () => undefined);
  resetProcess.stderr?.on('data', () => undefined);
  resetProcess.on('exit', (code) => {
    resetExit = code;
    resetExited = true;
  });

  if (resetProcess.pid !== undefined) {
    commandLine = await waitForCommandLine(resetProcess.pid, NEW_PASSWORD);
  }

  // The lock is released the moment the command line has been read: the reset
  // is waiting on it, and its busy timeout is not long.
  lock.exec('COMMIT');
  lock.close();
  lock = undefined;

  // And the reset is given the time it needs to finish, so that the
  // credential can be checked once it has.
  const deadline = Date.now() + 30_000;
  while (!resetExited && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}, 90_000);

afterAll(async () => {
  if (lock) {
    try {
      lock.exec('COMMIT');
      lock.close();
    } catch {
      // the lock is already gone
    }
  }
  if (resetProcess && resetProcess.exitCode === null) {
    resetProcess.kill('SIGKILL');
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('the command line of the recovery path', () => {
  it.skipIf(!canReadCommandLines())(
    'shows the new password to any other process on the host',
    () => {
      // The password was passed as an argument, and the argument is readable.
      // This is the cost of keeping the recovery path: it is not a property
      // of this test, it is a property of every process list on the host.
      expect(
        commandLine,
        'the reset process did not run, or its command line was not readable',
      ).not.toBeNull();
      expect(commandLine).toContain(NEW_PASSWORD);
    },
  );

  it('still replaces the credential, so the exposure buys a working recovery path', async () => {
    expect(resetExit, 'the reset process did not finish').toBe(0);

    const handle = createDatabase(dbPath);
    try {
      const auth = createAuthService(handle.db);
      await expect(
        auth.login({ email: 'owner@example.com', password: OLD_PASSWORD }),
      ).rejects.toThrow(/invalid email or password/i);
      await expect(
        auth.login({ email: 'owner@example.com', password: NEW_PASSWORD }),
      ).resolves.toBeTruthy();
    } finally {
      handle.close();
    }
  }, 30_000);
});

describe('what the documentation says about it', () => {
  const documents = [{ name: 'CONTRACTS.md' }, { name: 'README.md' }];

  it.each(documents)('$name says the password is visible in the process list', ({ name }) => {
    const text = fs.readFileSync(path.join(repoRoot, name), 'utf8');

    // The section that documents the command.
    const match = /--reset-password|reset-owner-password/.exec(text);
    expect(match, `${name} does not document the recovery command at all`).not.toBeNull();
    const section = text.slice(Math.max(0, match!.index - 600), match!.index + 1500);

    expect(section, `${name} does not mention the password near the recovery command`).toMatch(
      /password/i,
    );
    expect(
      section,
      `${name} does not say that the password is visible in the process list of the host`,
    ).toMatch(/process (list|table)|command line|\bps\b/i);
    expect(section, `${name} does not say that another user on the host can read it`).toMatch(
      /other user|another user|any user|anyone|every user|all users|readable|visible|other people|another process/i,
    );
  });
});
