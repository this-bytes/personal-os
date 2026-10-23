import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig } from '@personal-os/contracts';
import { spawnExecutable } from '../util.js';
import { AcpAdapter } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * Starting a runtime that is only on PATH.
 *
 * **This is the shape of every runtime the product ships a preset for.**
 * `codex`, `opencode` and the others are installed by npm, so on Windows they
 * are `.cmd` shims, and a child process may not start one on its own: the
 * command interpreter is what runs it. So the command is resolved first, and
 * a shim is started through `ComSpec` with its arguments quoted.
 *
 * The owner types a bare name. That is the whole contract of this file: the
 * name the owner typed has to reach a runtime, and an argument with a space in
 * it has to arrive as one argument.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const acpFixture = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

let tempDir = '';
let originalPath = '';

/** Put a directory at the front of PATH, the way an npm install would. */
function usePath(dir: string): void {
  process.env['PATH'] = `${dir}${path.delimiter}${originalPath}`;
}

/**
 * A shim that prints its first two arguments.
 *
 * On Windows the shim is a `.cmd`, because that is what npm writes. It prints
 * `%1` and `%2` separately, so an argument that was split in two shows up as a
 * second parameter instead of a space inside the first.
 */
function writeArgumentShim(dir: string, name: string): void {
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, `${name}.cmd`), '@echo off\r\necho [%~1][%~2]\r\n');
    return;
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, '#!/bin/sh\nprintf "[%s][%s]" "$1" "$2"\n');
  fs.chmodSync(file, 0o755);
}

/** A shim that starts the ACP fixture, so a whole turn runs through PATH. */
function writeAcpShim(dir: string, name: string): void {
  if (process.platform === 'win32') {
    const script = path.join(dir, 'fixture-acp-agent.mjs');
    fs.copyFileSync(acpFixture, script);
    fs.writeFileSync(
      path.join(dir, `${name}.cmd`),
      `@echo off\r\n"${process.execPath}" "%~dp0fixture-acp-agent.mjs" %*\r\n`,
    );
    return;
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${acpFixture}" "$@"\n`);
  fs.chmodSync(file, 0o755);
}

function collectOutput(child: ReturnType<typeof spawnExecutable>): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out += chunk;
    });
    child.on('error', reject);
    child.on('close', () => resolve(out.trim()));
  });
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-path-'));
  originalPath = process.env['PATH'] ?? '';
});

afterEach(() => {
  process.env['PATH'] = originalPath;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('a runtime that is only on PATH', () => {
  it('starts when the owner typed its bare name', async () => {
    writeArgumentShim(tempDir, 'pos-shim-agent');
    usePath(tempDir);

    const child = spawnExecutable('pos-shim-agent', ['one argument'], {
      env: process.env,
    });
    const output = await collectOutput(child);

    expect(output).toBe('[one argument][]');
  });

  it('keeps an argument with a space in it as one argument', async () => {
    writeArgumentShim(tempDir, 'pos-shim-agent');
    usePath(tempDir);

    const child = spawnExecutable('pos-shim-agent', ['one argument', 'second'], {
      env: process.env,
    });
    const output = await collectOutput(child);

    // The first argument stayed whole, and the second one is still the second.
    expect(output).toBe('[one argument][second]');
  });

  it('runs a whole ACP turn through a runtime found by its bare name', async () => {
    writeAcpShim(tempDir, 'pos-acp-agent');
    usePath(tempDir);

    const storePath = path.join(tempDir, 'sessions.json');
    fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [] }));

    const config = parseAdapterConfig({
      adapterType: 'acp',
      command: 'pos-acp-agent',
      args: [],
      cwd: tempDir,
      env: { FAKE_ACP_SESSIONS: storePath },
      timeoutSeconds: 30,
    });
    const adapter = new AcpAdapter(config as never, ctx);

    const events = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'message.completed')).toBe(true);
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8')) as { sessions: string[] };
    expect(store.sessions).toHaveLength(1);
  });
});
