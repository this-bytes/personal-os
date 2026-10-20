/**
 * The deployment verification gate.
 *
 * `scripts/verify-stack.ts` does two things worth being sure about. It is the
 * only check that proves the worker of a running deployment executes an
 * agent's turn, and its `--allow-remote` guard is the only thing between it
 * and somebody else's instance.
 *
 * Both are exercised here, because a gate that has never been shown to fail
 * is a gate that might never fail. The guard is checked by watching what the
 * script contacts: a refusal has to happen before the first request, not
 * after it. The worker check is checked both ways: it has to pass when a
 * worker is running and fail when the server answers but nothing executes the
 * turn.
 *
 * The script is spawned rather than run in-process, and it is spawned
 * asynchronously: a synchronous spawn would block the event loop this file's
 * fake server runs on, and the script would wait forever for an answer that
 * could not be given.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'verify-stack.ts');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runScript(
  url: string,
  extraArgs: string[] = [],
  env: NodeJS.ProcessEnv = {},
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, scriptPath, url, ...extraArgs], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ status: code, stdout, stderr }));
  });
}

describe('the remote guard', () => {
  let seen: string[] = [];
  let listener: http.Server;
  let port = 0;

  beforeAll(async () => {
    // Bound to every interface, so the same listener answers on 127.0.0.1 and
    // on 0.0.0.0. That makes the cases below differ only in the name the
    // script is given.
    listener = http.createServer((req, res) => {
      seen.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => listener.listen(0, resolve));
    port = (listener.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  });

  it('refuses an address that is not the loopback interface, before it contacts it', async () => {
    seen = [];

    // 0.0.0.0 is not the loopback interface, but a request to it lands on
    // this machine, so the request would arrive if the script did not refuse
    // first.
    const result = await runScript(`http://0.0.0.0:${port}`);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--allow-remote');
    expect(seen).toEqual([]);
  });

  it('contacts that same address once the guard is waived', async () => {
    seen = [];

    const result = await runScript(`http://0.0.0.0:${port}`, ['--allow-remote']);

    // The refusal above was the guard, not an address that cannot be reached.
    expect(result.status).not.toBe(2);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('accepts the loopback names and contacts them', async () => {
    for (const host of ['127.0.0.1', 'localhost']) {
      seen = [];

      const result = await runScript(`http://${host}:${port}`);

      expect(result.status, `${host} was refused`).not.toBe(2);
      expect(seen.length, `${host} was not contacted`).toBeGreaterThan(0);
    }
  });

  it('refuses a URL whose real host sits behind a userinfo section', async () => {
    // The host of this URL is stack-check.invalid. The part before the @ is
    // only userinfo, so a check that reads the string instead of parsing the
    // URL would take it for the loopback interface.
    const result = await runScript('http://127.0.0.1:4317@stack-check.invalid');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--allow-remote');
  });

  it('refuses the rest of the loopback range rather than assuming it', async () => {
    // 127.0.0.2 is a loopback address too, but the script does not have to
    // know that: refusing it is the safe direction, because the guard exists
    // to keep the script off other people's machines.
    const result = await runScript('http://127.0.0.2:4317');

    expect(result.status).toBe(2);
  });
});

describe('the worker check', () => {
  const children: ChildProcess[] = [];
  const port = 4500 + Math.floor(Math.random() * 400);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-stack-test-'));

  function start(entry: string): ChildProcess {
    const child = spawn(process.execPath, [tsxCli, entry], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PERSONAL_OS_HOST: '127.0.0.1',
        PERSONAL_OS_PORT: String(port),
        PERSONAL_OS_DATA_DIR: dataDir,
        PERSONAL_OS_OWNER_TOKEN: 'test-owner-token',
        LOG_LEVEL: 'warn',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', () => undefined);
    children.push(child);
    return child;
  }

  async function waitForServer(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) return;
      } catch {
        // not up yet
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('the server did not become healthy');
  }

  async function stop(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 4_000);
      child.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }

  beforeAll(async () => {
    start(path.join(repoRoot, 'apps', 'server', 'src', 'index.ts'));
    await waitForServer();
  });

  afterAll(async () => {
    await Promise.all(children.map((child) => stop(child)));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('passes when a worker executes the turn', async () => {
    const worker = start(path.join(repoRoot, 'apps', 'worker', 'src', 'index.ts'));

    try {
      const result = await runScript(`http://127.0.0.1:${port}`, [], {
        PERSONAL_OS_VERIFY_STACK_TIMEOUT_MS: '20000',
      });

      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    } finally {
      await stop(worker);
    }
  }, 90_000);

  it('fails when the server answers but nothing executes the turn', async () => {
    // No worker is running now. The server still creates the owner, the
    // agent and the conversation, and still accepts the message, so every
    // step before the reply succeeds. Only the reply is missing, and only
    // the worker could have produced it.
    const result = await runScript(`http://127.0.0.1:${port}`, [], {
      PERSONAL_OS_VERIFY_STACK_TIMEOUT_MS: '3000',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('worker');
  }, 90_000);
});
