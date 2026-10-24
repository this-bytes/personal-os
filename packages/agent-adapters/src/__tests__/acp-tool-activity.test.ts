import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection, type AgentEvent } from '@personal-os/contracts';
import { acpToolCall, acpToolOutput, AcpAdapter } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * The ACP route and the runtime's tool activity.
 *
 * The protocol reports what the agent is doing as `session/update`
 * notifications, and the adapter used to read one kind of them and drop the
 * rest — so the room's activity timeline was empty on this route while the
 * Codex route showed the same work.
 *
 * The sequence in the fixture is the one the installed runtime sends, and the
 * shapes in the first tests are the shapes it sent.
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

async function runTurn(
  adapter: AcpAdapter,
  env: Record<string, string> = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: 'What does the file say?',
    context: '',
    executionId: 'exe_1',
    ...env,
  })) {
    events.push(event);
  }
  return events;
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-tools-')), 'sessions.json');
  fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [] }));
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('a tool call, read out of the protocol', () => {
  it("is named in the product's words, not the runtime's", () => {
    const call = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      title: 'read',
      kind: 'read',
      status: 'pending',
      rawInput: { filePath: 'notes.txt' },
    });

    expect(call?.name).toBe('read');
    expect(call?.input).toEqual({ filePath: 'notes.txt' });
    expect(call?.finished).toBe(false);
  });

  it('calls a command a command, the way the other route does', () => {
    const call = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'ls' },
    });

    expect(call?.name).toBe('command');
  });

  it('calls a file change a file change', () => {
    const call = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      kind: 'edit',
      status: 'pending',
    });

    expect(call?.name).toBe('file_change');
  });

  it('keeps the name when the update drops the kind', () => {
    // The runtime sends the kind with the first update and drops it from the
    // later ones. A route that read every update on its own would name the
    // finished call 'tool'.
    const first = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      kind: 'read',
      status: 'pending',
    });
    const later = acpToolCall(
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call_1',
        status: 'completed',
      },
      first ?? undefined,
    );

    expect(later?.name).toBe('read');
  });

  it('is finished only when the runtime says so', () => {
    const running = acpToolCall({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_1',
      kind: 'read',
      status: 'in_progress',
    });
    const done = acpToolCall({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_1',
      kind: 'read',
      status: 'completed',
    });
    const failed = acpToolCall({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_1',
      kind: 'read',
      status: 'failed',
    });

    expect(running?.finished).toBe(false);
    expect(done?.finished).toBe(true);
    expect(failed?.finished).toBe(true);
  });

  it('is not an action when the runtime is talking about itself', () => {
    const thought = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      kind: 'think',
      status: 'pending',
    });
    const mode = acpToolCall({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      kind: 'switch_mode',
      status: 'pending',
    });

    expect(thought).toBeNull();
    expect(mode).toBeNull();
  });

  it('is not a call when the protocol sent something else', () => {
    expect(
      acpToolCall({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } }),
    ).toBeNull();
    expect(acpToolCall({ sessionUpdate: 'tool_call' })).toBeNull();
  });

  it('carries what the tool said, and what the runtime reported', () => {
    const call = acpToolCall({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_1',
      kind: 'read',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'The file says hello.' } }],
      rawOutput: { output: '<path>notes.txt</path>' },
    });

    const output = acpToolOutput(call!);
    expect(output?.status).toBe('completed');
    expect(output?.output).toBe('The file says hello.');
    expect(output?.raw).toEqual({ output: '<path>notes.txt</path>' });
  });
});

describe('the turn, with a runtime that uses a tool', () => {
  it('carries the tool call into the room', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    const events = await runTurn(adapter);

    const started = events.find((event) => event.type === 'tool.started');
    expect(started).toBeDefined();
    expect(started?.type === 'tool.started' ? started.toolName : null).toBe('read');
    expect(started?.type === 'tool.started' ? started.input : null).toEqual({
      filePath: 'notes.txt',
    });

    const completed = events.find((event) => event.type === 'tool.completed');
    expect(completed).toBeDefined();
    expect(completed?.type === 'tool.completed' ? completed.toolName : null).toBe('read');
  });

  it('shows the call once, however much the runtime streamed', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    const events = await runTurn(adapter);

    // The runtime announces the call, updates it twice while the work runs, and
    // finishes it. The room shows one row, not one row per update.
    expect(events.filter((event) => event.type === 'tool.started')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'tool.completed')).toHaveLength(1);
  });

  it('shows the call before the answer', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    const events = await runTurn(adapter);

    const startedAt = events.findIndex((event) => event.type === 'tool.started');
    const answeredAt = events.findIndex((event) => event.type === 'message.completed');
    expect(startedAt).toBeGreaterThanOrEqual(0);
    expect(answeredAt).toBeGreaterThan(startedAt);
  });

  it('still answers', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    const events = await runTurn(adapter);

    const completed = events.find((event) => event.type === 'message.completed');
    expect(completed?.type === 'message.completed' ? completed.text : '').toContain(
      'PROBE-MARKER-41C',
    );
  });

  it('carries a command as a command', async () => {
    const adapter = createAdapter({
      FAKE_ACP_TOOL_CALL: '1',
      FAKE_ACP_TOOL_KIND: 'execute',
      FAKE_ACP_TOOL_TITLE: 'Get-ChildItem',
      FAKE_ACP_TOOL_COMMAND: 'Get-ChildItem -Force',
    });

    const events = await runTurn(adapter);

    const started = events.find((event) => event.type === 'tool.started');
    expect(started?.type === 'tool.started' ? started.toolName : null).toBe('command');
    expect(started?.type === 'tool.started' ? started.input : null).toEqual({
      command: 'Get-ChildItem -Force',
      cwd: '.',
    });
  });

  it('shows a call the runtime never said more about', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1', FAKE_ACP_TOOL_SILENT: '1' });

    const events = await runTurn(adapter);

    // A call that started and never finished is still a call: the room shows
    // it, and the product's own vocabulary has an outcome for it.
    const started = events.find((event) => event.type === 'tool.started');
    expect(started).toBeDefined();
    expect(started?.type === 'tool.started' ? started.toolName : null).toBe('read');
    expect(events.filter((event) => event.type === 'tool.completed')).toHaveLength(0);
  });

  it('carries a failed call as a finished call, not a failed turn', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1', FAKE_ACP_TOOL_STATUS: 'failed' });

    const events = await runTurn(adapter);

    const completed = events.find((event) => event.type === 'tool.completed');
    expect(completed).toBeDefined();
    const output = completed?.type === 'tool.completed' ? completed.output : undefined;
    expect((output as { status?: string } | undefined)?.status).toBe('failed');
    // The turn carried on: a tool that failed is not a turn that failed.
    expect(events.some((event) => event.type === 'execution.error')).toBe(false);
    expect(
      events.some((event) => event.type === 'execution.status' && event.status === 'completed'),
    ).toBe(true);
  });
});
