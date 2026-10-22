import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADAPTER_NOT_CONNECTED_CODE,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
} from '@personal-os/contracts';
import { createAcpAdapter, createCliAdapter, createMcpAdapter } from '../index.js';
import type { AdapterContext } from '../types.js';

/**
 * The adapter lifecycle: connect, send, close.
 *
 * The fixtures are real servers speaking real protocols, so these tests are
 * about what actually happens: a tool that runs, a process that is gone
 * afterwards, and a refusal that says what to do about it.
 *
 * The process checks are written for every platform. Windows has no signal
 * that only asks, so the process table is asked instead — a check that only
 * works on one platform proves nothing on the other.
 */

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const mcpFixture = path.join(here, 'fixtures', 'mcp-server.mjs');
const refusingFixture = path.join(here, 'fixtures', 'mcp-refusing-server.mjs');
const acpFixture = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

function makeContext(): AdapterContext {
  return {
    resolveSecret: async () => undefined,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  };
}

const connection: AgentConnection = {
  id: 'conn-1',
  name: 'Fixture',
  adapterType: 'mcp',
  configRef: 'cfg-1',
  enabled: true,
};

const turn: AgentTurnInput = {
  conversationId: 'conv-1',
  message: 'hello',
  context: '',
  executionId: 'exec-1',
};

function mcpAdapter(overrides: Partial<Parameters<typeof createMcpAdapter>[0]> = {}) {
  return createMcpAdapter(
    {
      adapterType: 'mcp',
      transport: 'stdio',
      command: process.execPath,
      args: [mcpFixture],
      cwd: undefined,
      env: {},
      url: undefined,
      authTokenRef: undefined,
      protocolVersion: '2025-06-18',
      toolName: 'echo',
      argumentTemplate: '{"message":"{{message}}"}',
      allowedTools: [],
      timeoutSeconds: 30,
      ...overrides,
    },
    makeContext(),
  );
}

function cliAdapter(overrides: Partial<Parameters<typeof createCliAdapter>[0]> = {}) {
  return createCliAdapter(
    {
      adapterType: 'cli',
      command: process.execPath,
      args: [],
      cwd: undefined,
      env: {},
      promptMode: 'stdin',
      promptArg: '--prompt',
      timeoutSeconds: 30,
      allowedPaths: [],
      ...overrides,
    },
    makeContext(),
  );
}

function acpAdapter(overrides: Partial<Parameters<typeof createAcpAdapter>[0]> = {}) {
  return createAcpAdapter(
    {
      adapterType: 'acp',
      command: process.execPath,
      args: [acpFixture],
      cwd: undefined,
      env: {},
      timeoutSeconds: 30,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      ...overrides,
    },
    makeContext(),
  );
}

async function collect(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Is the process still running? */
async function isRunning(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('tasklist.exe', [
      '/FI',
      `PID eq ${pid}`,
      '/NH',
      '/FO',
      'CSV',
    ]);
    return stdout.includes(`"${pid}"`);
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Wait for the process to be gone, and say whether it went. */
async function waitUntilGone(pid: number, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (!(await isRunning(pid))) return true;
    if (Date.now() > deadline) return false;
    await delay(100);
  }
}

/** Read the process id a fixture reported, waiting for it to be written. */
async function readPid(pidFile: string, timeoutMs = 15_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const pid = Number((await readFile(pidFile, 'utf8')).trim());
      if (Number.isInteger(pid) && pid > 0) return pid;
    } catch {
      // Not written yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`The fixture did not report a process id (${pidFile}).`);
    }
    await delay(50);
  }
}

/** The process id a command printed, once it has printed it. */
async function waitForPid(events: AgentEvent[], timeoutMs = 15_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const event of events) {
      if (event.type !== 'message.delta') continue;
      const pid = Number(event.text.trim());
      if (Number.isInteger(pid) && pid > 0) return pid;
    }
    if (Date.now() > deadline) throw new Error('The command did not report a process id.');
    await delay(50);
  }
}

let workdir = '';

beforeEach(async () => {
  workdir = await mkdtemp(path.join(tmpdir(), 'pos-lifecycle-'));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('the MCP adapter lifecycle', () => {
  it('reaches the server when the instance is connected first', async () => {
    const agent = mcpAdapter();
    await agent.connect(connection);

    const events = await collect(agent.send(turn));

    // The tool actually ran, and its result is what the turn reported.
    const tool = events.find((event) => event.type === 'tool.completed');
    expect(tool?.type).toBe('tool.completed');
    if (tool?.type !== 'tool.completed') throw new Error('the tool did not complete');
    expect(tool.output).toEqual([{ type: 'text', text: 'echo: hello' }]);

    const completed = events.find((event) => event.type === 'message.completed');
    if (completed?.type !== 'message.completed') throw new Error('the turn did not complete');
    expect(completed.text).toBe('echo: hello');

    const status = events.at(-1);
    expect(status?.type).toBe('execution.status');
    if (status?.type !== 'execution.status') throw new Error('the turn had no status');
    expect(status.status).toBe('completed');
  });

  it('refuses a turn on an instance that was never connected, and says what to do', async () => {
    const agent = mcpAdapter();

    const events = await collect(agent.send(turn));

    const error = events.find((event) => event.type === 'execution.error');
    if (error?.type !== 'execution.error') throw new Error('the turn was not refused');
    expect(error.code).toBe(ADAPTER_NOT_CONNECTED_CODE);
    expect(error.message).toBe('This MCP adapter was not connected. Call connect() before send().');

    const status = events.at(-1);
    if (status?.type !== 'execution.status') throw new Error('the turn had no status');
    expect(status.status).toBe('failed');
  });

  it('releases the server process when the adapter is closed', async () => {
    const pidFile = path.join(workdir, 'mcp.pid');
    const agent = mcpAdapter({ env: { MCP_FIXTURE_PID_FILE: pidFile } });
    await agent.connect(connection);

    const pid = await readPid(pidFile);
    expect(await isRunning(pid)).toBe(true);

    await agent.close?.();

    expect(await waitUntilGone(pid)).toBe(true);
  });

  it('leaves nothing behind when the server refuses the handshake', async () => {
    const pidFile = path.join(workdir, 'refusing.pid');
    const agent = mcpAdapter({
      args: [refusingFixture],
      env: { MCP_FIXTURE_PID_FILE: pidFile },
    });

    const capabilities = await agent.connect(connection);
    expect(capabilities.chat).toBe(false);

    const pid = await readPid(pidFile);
    expect(await waitUntilGone(pid)).toBe(true);
  });

  it('does not let one instance’s connection stand in for another', async () => {
    const probed = mcpAdapter();
    await probed.connect(connection);

    // A capability probe on one instance says nothing about a later one.
    const other = mcpAdapter();
    const events = await collect(other.send(turn));

    const error = events.find((event) => event.type === 'execution.error');
    if (error?.type !== 'execution.error') throw new Error('the turn was not refused');
    expect(error.code).toBe(ADAPTER_NOT_CONNECTED_CODE);
    expect(error.message).toBe('This MCP adapter was not connected. Call connect() before send().');

    await probed.close?.();
  });

  it('says why the connection failed when the handshake was refused', async () => {
    const agent = mcpAdapter({ args: [refusingFixture] });
    await agent.connect(connection);

    const events = await collect(agent.send(turn));

    const error = events.find((event) => event.type === 'execution.error');
    if (error?.type !== 'execution.error') throw new Error('the turn was not refused');
    expect(error.code).toBe(ADAPTER_NOT_CONNECTED_CODE);
    expect(error.message).toContain('This MCP adapter was not connected.');
    expect(error.message).toContain('Call connect() before send().');
    expect(error.message).toContain('refuses to initialise');
  });
});

describe('the CLI adapter lifecycle', () => {
  it('refuses a turn on an instance that was never connected, and says what to do', async () => {
    const agent = cliAdapter();

    const events = await collect(agent.send(turn));

    const error = events.find((event) => event.type === 'execution.error');
    if (error?.type !== 'execution.error') throw new Error('the turn was not refused');
    expect(error.code).toBe(ADAPTER_NOT_CONNECTED_CODE);
    expect(error.message).toBe('This CLI adapter was not connected. Call connect() before send().');
  });

  it('releases the command process when the turn ends', async () => {
    const agent = cliAdapter({ args: ['-e', 'console.log(process.pid)'] });
    await agent.connect(connection);

    const events = await collect(agent.send(turn));
    const pid = await waitForPid(events);

    expect(await waitUntilGone(pid)).toBe(true);
  });

  it('releases a command that is still running when the adapter is closed', async () => {
    const agent = cliAdapter({
      args: ['-e', 'console.log(process.pid); setInterval(() => {}, 1000)'],
    });
    await agent.connect(connection);

    const events: AgentEvent[] = [];
    const consuming = (async () => {
      for await (const event of agent.send(turn)) events.push(event);
    })();

    const pid = await waitForPid(events);
    expect(await isRunning(pid)).toBe(true);

    await agent.close?.();

    expect(await waitUntilGone(pid)).toBe(true);
    await consuming;
  });

  it('does not leak the server environment into the command', async () => {
    process.env.PERSONAL_OS_CLI_SERVER_ONLY = 'server-only-value';
    try {
      const agent = cliAdapter({
        args: ['-e', 'console.log(JSON.stringify(process.env))'],
        env: { PERSONAL_OS_CLI_AGENT_VALUE: 'agent-value' },
      });
      await agent.connect(connection);

      const events = await collect(agent.send(turn));
      const text = events
        .filter((event) => event.type === 'message.delta')
        .map((event) => (event.type === 'message.delta' ? event.text : ''))
        .join('');

      const reported = JSON.parse(text) as Record<string, string>;
      expect(reported.PERSONAL_OS_CLI_AGENT_VALUE).toBe('agent-value');
      expect(reported.PERSONAL_OS_CLI_SERVER_ONLY).toBeUndefined();
    } finally {
      delete process.env.PERSONAL_OS_CLI_SERVER_ONLY;
    }
  });
});

describe('the ACP adapter lifecycle', () => {
  it('releases the agent process when the turn ends', async () => {
    const pidFile = path.join(workdir, 'acp.pid');
    const sessions = path.join(workdir, 'sessions.json');
    await writeFile(sessions, JSON.stringify({ sessions: [], loaded: [] }), 'utf8');

    const agent = acpAdapter({ env: { FAKE_ACP_SESSIONS: sessions, FAKE_ACP_PID_FILE: pidFile } });
    const events = await collect(agent.send(turn));
    expect(events.some((event) => event.type === 'message.completed')).toBe(true);

    const pid = await readPid(pidFile);
    expect(await waitUntilGone(pid)).toBe(true);
  });

  it('releases the agent process when the adapter is closed', async () => {
    const pidFile = path.join(workdir, 'acp.pid');
    const sessions = path.join(workdir, 'sessions.json');
    await writeFile(sessions, JSON.stringify({ sessions: [], loaded: [] }), 'utf8');

    const agent = acpAdapter({
      env: {
        FAKE_ACP_SESSIONS: sessions,
        FAKE_ACP_PID_FILE: pidFile,
        FAKE_ACP_PROMPT_DELAY_MS: '30000',
      },
    });

    const events: AgentEvent[] = [];
    const consuming = (async () => {
      for await (const event of agent.send(turn)) events.push(event);
    })();

    const pid = await readPid(pidFile);
    expect(await isRunning(pid)).toBe(true);

    await agent.close?.();

    expect(await waitUntilGone(pid)).toBe(true);
    await consuming;
  });
});
