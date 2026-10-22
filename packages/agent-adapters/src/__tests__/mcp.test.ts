import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AgentConnection, AgentEvent, AgentTurnInput } from '@personal-os/contracts';
import { createMcpAdapter } from '../mcp.js';
import type { AdapterContext } from '../types.js';

/**
 * The MCP adapter, driven against a real MCP server.
 *
 * The fixture is a separate process that speaks the published protocol, so
 * this proves the adapter is a client of MCP rather than a guess at it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'mcp-server.mjs');

function makeContext(): AdapterContext {
  return {
    resolveSecret: async () => undefined,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  };
}

const connection: AgentConnection = {
  id: 'conn-1',
  name: 'Fixture server',
  adapterType: 'mcp',
  configRef: 'secret-1',
  enabled: true,
};

function adapter(overrides: Partial<Parameters<typeof createMcpAdapter>[0]> = {}) {
  return createMcpAdapter(
    {
      adapterType: 'mcp',
      transport: 'stdio',
      command: process.execPath,
      args: [fixture],
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

async function collect(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

const turn: AgentTurnInput = {
  conversationId: 'conv-1',
  message: 'hello',
  context: '',
  executionId: 'exec-1',
};

describe('the MCP adapter', () => {
  it('connects to a server and reports what it can honestly do', async () => {
    const agent = adapter();
    const capabilities = await agent.connect(connection);

    expect(capabilities.chat).toBe(true);
    // A tool call is atomic: it cannot be interrupted, steered, or streamed.
    expect(capabilities.cancel).toBe(false);
    expect(capabilities.streaming).toBe(false);
    expect(capabilities.acceptsSteering).toBe(false);
  });

  it('calls the configured tool and answers with its text', async () => {
    const agent = adapter();
    await agent.connect(connection);

    const events = await collect(agent.send(turn));

    const started = events.find((event) => event.type === 'tool.started');
    expect(started).toBeDefined();
    if (started?.type === 'tool.started') {
      expect(started.toolName).toBe('echo');
      expect(started.input).toEqual({ message: 'hello' });
    }

    const completed = events.find((event) => event.type === 'message.completed');
    expect(completed).toBeDefined();
    if (completed?.type === 'message.completed') {
      expect(completed.text).toBe('echo: hello');
    }

    const status = events.at(-1);
    expect(status?.type).toBe('execution.status');
    if (status?.type === 'execution.status') {
      expect(status.status).toBe('completed');
    }
  });

  it('reports a tool that failed as a failed execution, not a reply', async () => {
    const agent = adapter({ toolName: 'broken' });
    await agent.connect(connection);

    const events = await collect(agent.send(turn));

    expect(events.some((event) => event.type === 'execution.error')).toBe(true);
    const status = events.at(-1);
    if (status?.type === 'execution.status') {
      expect(status.status).toBe('failed');
    }
  });

  it('does not offer chat when the server does not publish the tool', async () => {
    const agent = adapter({ toolName: 'not-published' });
    const capabilities = await agent.connect(connection);
    expect(capabilities.chat).toBe(false);
  });

  it('does not offer chat when the tool is outside the allow-list', async () => {
    const agent = adapter({ allowedTools: ['env'] });
    const capabilities = await agent.connect(connection);
    expect(capabilities.chat).toBe(false);
  });

  it('does not leak the server environment into the agent environment', async () => {
    process.env.PERSONAL_OS_SERVER_ONLY_SECRET = 'server-only-value';
    try {
      const agent = adapter({ toolName: 'env', env: { PERSONAL_OS_AGENT_VALUE: 'agent-value' } });
      await agent.connect(connection);

      const events = await collect(agent.send(turn));
      const completed = events.find((event) => event.type === 'message.completed');
      if (completed?.type !== 'message.completed' || !completed.text) {
        throw new Error('The fixture did not answer.');
      }

      const reported = JSON.parse(completed.text) as Record<string, string>;
      expect(reported.PERSONAL_OS_AGENT_VALUE).toBe('agent-value');
      expect(reported.PERSONAL_OS_SERVER_ONLY_SECRET).toBeUndefined();
    } finally {
      delete process.env.PERSONAL_OS_SERVER_ONLY_SECRET;
    }
  });

  it('fails cleanly when the server cannot be started', async () => {
    const agent = adapter({ command: 'a-command-that-does-not-exist' });
    const capabilities = await agent.connect(connection);
    expect(capabilities.chat).toBe(false);
  });
});
