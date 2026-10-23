import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentEvent } from '@personal-os/contracts';
import { CodexAdapter, mapCodexEvent, parseCodexEnvelope } from '../codex.js';
import type { AdapterContext } from '../types.js';

/**
 * The Codex adapter.
 *
 * Two things are proved here: that the mapping from Codex's event stream to
 * the product's vocabulary is right, and that the adapter reads a real stream
 * from a real process. The first is a pure function and says so; the second
 * runs the fixture, which speaks the same stream as `codex exec --json`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'fake-codex-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

function createAdapter(overrides: Record<string, unknown> = {}): CodexAdapter {
  const config = parseAdapterConfig({
    adapterType: 'codex',
    command: process.execPath,
    args: [fixturePath],
    ...overrides,
  });
  if (config.adapterType !== 'codex') throw new Error('expected a codex configuration');
  return new CodexAdapter(config, ctx);
}

async function collect(adapter: CodexAdapter, message: string): Promise<AgentEvent[]> {
  await adapter.connect({
    id: 'agt_1',
    name: 'The agent',
    adapterType: 'codex',
    configRef: 'cfg_1',
    enabled: true,
  });
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    executionId: 'exe_1',
    message,
    context: '',
  })) {
    events.push(event);
  }
  return events;
}

describe('reading Codex’s event stream', () => {
  it('ignores a line that is not an event', () => {
    expect(parseCodexEnvelope('not json at all')).toBeNull();
    expect(parseCodexEnvelope('')).toBeNull();
    expect(parseCodexEnvelope('{"type":"turn.started"}')).toEqual({ type: 'turn.started' });
  });

  it('says a message in the product’s words', () => {
    const events = mapCodexEvent(
      { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'Hello.' } },
      'exe_1',
      'Hello.',
    );
    expect(events).toEqual([{ type: 'message.delta', executionId: 'exe_1', text: 'Hello.' }]);
  });

  it('says a command the agent ran as a tool', () => {
    const started = mapCodexEvent(
      {
        type: 'item.started',
        item: { id: 'item_1', type: 'command_execution', command: 'node --version' },
      },
      'exe_1',
      '',
    );
    const completed = mapCodexEvent(
      {
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'command_execution',
          command: 'node --version',
          aggregated_output: 'v22.0.0\n',
          exit_code: 0,
          status: 'completed',
        },
      },
      'exe_1',
      '',
    );
    // The two rows must carry the same name, or the trace shows two
    // unrelated tools instead of one tool that ran.
    expect(started[0]).toMatchObject({ type: 'tool.started', toolName: 'command' });
    expect(completed[0]).toMatchObject({ type: 'tool.completed', toolName: 'command' });
  });

  it('says nothing about an item it has no word for', () => {
    const events = mapCodexEvent(
      { type: 'item.completed', item: { id: 'item_9', type: 'reasoning', text: 'thinking' } },
      'exe_1',
      '',
    );
    expect(events).toEqual([]);
  });

  it('believes the turn’s own report of how it ended', () => {
    const completed = mapCodexEvent({ type: 'turn.completed' }, 'exe_1', 'The answer.');
    expect(completed).toEqual([
      { type: 'message.completed', executionId: 'exe_1', text: 'The answer.' },
      { type: 'execution.status', executionId: 'exe_1', status: 'completed' },
    ]);

    const failed = mapCodexEvent(
      { type: 'turn.failed', error: { code: 'runtime_failed', message: 'It broke.' } },
      'exe_1',
      '',
    );
    expect(failed).toEqual([
      {
        type: 'execution.error',
        executionId: 'exe_1',
        code: 'runtime_failed',
        message: 'It broke.',
      },
      { type: 'execution.status', executionId: 'exe_1', status: 'failed' },
    ]);
  });
});

describe('the Codex adapter', () => {
  it('reports no chat capability when the command does not exist', async () => {
    const config = parseAdapterConfig({
      adapterType: 'codex',
      command: 'definitely-not-a-real-binary-xyz',
    });
    if (config.adapterType !== 'codex') throw new Error('expected a codex configuration');
    const adapter = new CodexAdapter(config, ctx);
    const capabilities = await adapter.connect({
      id: 'agt_1',
      name: 'Broken',
      adapterType: 'codex',
      configRef: 'cfg_1',
      enabled: true,
    });
    expect(capabilities.chat).toBe(false);
  });

  it('reads a turn out of a real process', async () => {
    const adapter = createAdapter();
    const events = await collect(adapter, 'What can you do?');

    const deltas = events.filter((event) => event.type === 'message.delta');
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.map((event) => event.text).join('')).toContain('What can you do?');

    const started = events.find((event) => event.type === 'tool.started');
    const completed = events.find((event) => event.type === 'tool.completed');
    expect(started).toMatchObject({ type: 'tool.started', toolName: 'command' });
    expect(completed).toMatchObject({ type: 'tool.completed', toolName: 'command' });

    const last = events[events.length - 1];
    expect(last).toEqual({ type: 'execution.status', executionId: 'exe_1', status: 'completed' });
    await adapter.close();
  });

  it('reports a failed turn as failed', async () => {
    const adapter = createAdapter();
    const events = await collect(adapter, 'please fail-the-turn now');

    const failure = events.find((event) => event.type === 'execution.error');
    expect(failure).toMatchObject({ code: 'runtime_failed' });
    expect(events[events.length - 1]).toMatchObject({ type: 'execution.status', status: 'failed' });
    await adapter.close();
  });
});
