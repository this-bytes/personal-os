import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection } from '@personal-os/contracts';
import { AcpAdapter } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * The ACP adapter and sessions.
 *
 * A session outlives a turn when the agent can restore it. The adapter
 * creates the session, keeps it with the execution, and can re-enter it when
 * a decision asks the turn to continue.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPath = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

const connection: AgentConnection = {
  id: 'agt_1',
  name: 'The agent',
  adapterType: 'acp',
  configRef: 'cfg_1',
  enabled: true,
};

let storePath = '';

function createAdapter(env: Record<string, string> = {}): AcpAdapter {
  const config = parseAdapterConfig({
    adapterType: 'acp',
    command: process.execPath,
    args: [agentPath],
    cwd: here,
    env: { FAKE_ACP_SESSIONS: storePath, ...env },
    timeoutSeconds: 30,
  });
  return new AcpAdapter(config as never, ctx);
}

function store(): {
  sessions: string[];
  loaded: string[];
  opened: Array<{ cwd: string; mcpServers: unknown[] }>;
} {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
    sessions: string[];
    loaded: string[];
    opened: Array<{ cwd: string; mcpServers: unknown[] }>;
  };
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-')), 'sessions.json');
  fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [] }));
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('the ACP adapter', () => {
  it('opens the session with the working directory and the MCP servers', async () => {
    const adapter = createAdapter();

    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      void event;
    }

    // The protocol asks for both, and an agent that checks them refuses a
    // request that leaves them out.
    const opened = store().opened[0];
    expect(opened?.cwd).toBe(here);
    expect(opened?.mcpServers).toEqual([]);
  });

  it('carries the reason a runtime refused into the failure', async () => {
    // The agent refuses, the way a runtime refuses when it has no provider.
    const adapter = createAdapter({ FAKE_ACP_REFUSE_SESSION: '1' });

    const events = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }

    const failure = events.find((event) => event.type === 'execution.error');
    expect(failure).toBeDefined();
    // "Internal error" on its own says nothing the owner can act on.
    expect(failure?.type === 'execution.error' ? failure.message : '').toContain(
      'No LLM provider configured',
    );
  });

  it('creates a session and keeps it with the execution', async () => {
    const adapter = createAdapter();

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
    expect(store().sessions).toHaveLength(1);

    const status = await adapter.getStatus('exe_1');
    expect(status.externalRef).toBe(store().sessions[0]);
  });

  it('restores the session it was given', async () => {
    const adapter = createAdapter();

    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      void event;
    }

    const sessionId = store().sessions[0]!;
    const restored = await adapter.resumeSession(connection, sessionId);

    expect(restored).toBe(sessionId);
    expect(store().loaded).toContain(sessionId);
  });

  it('keeps the same session id when a turn is continued in it', async () => {
    const adapter = createAdapter();

    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      void event;
    }

    const sessionId = store().sessions[0]!;

    // The turn continues in the session it was in.
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'The owner approved this operation. Continue.',
      context: '',
      executionId: 'exe_2',
      externalSessionId: sessionId,
    })) {
      void event;
    }

    const status = await adapter.getStatus('exe_2');
    expect(status.externalRef).toBe(sessionId);
    expect(store().loaded).toContain(sessionId);
    // It was the same session, not a new one.
    expect(store().sessions).toHaveLength(1);
  });
});
