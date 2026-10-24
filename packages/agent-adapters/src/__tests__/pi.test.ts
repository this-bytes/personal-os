import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection, type AgentEvent } from '@personal-os/contracts';
import { PiAdapter, buildPiPrompt, mapPiEvent, piArgs, textOf } from '../pi.js';
import type { AdapterContext } from '../types.js';

/**
 * The Pi route.
 *
 * Pi speaks a protocol of its own: commands go in, responses and session
 * events come out, and the events carry more than an answer — the streaming
 * text, the tools it ran, whether it has settled, and the session it is in.
 *
 * These tests drive the adapter against a double that speaks the protocol, and
 * they check the things that matter: that Pi's own vocabulary becomes the
 * product's, that the session continues, that a steer reaches the run that is
 * going, and that a picture crosses as bytes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'fake-pi.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

const connection: AgentConnection = {
  id: 'agt_1',
  name: 'The agent',
  adapterType: 'pi',
  configRef: 'cfg_1',
  enabled: true,
};

let storePath = '';

interface Store {
  prompts: Array<{ message: string; images: Array<{ data: string; mimeType: string }> }>;
  steers: Array<{ message: string }>;
  aborts: Array<{ id?: string }>;
  switched: Array<{ sessionPath: string }>;
  commands: string[];
}

function store(): Store {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
}

function createAdapter(env: Record<string, string> = {}): PiAdapter {
  const config = parseAdapterConfig({
    adapterType: 'pi',
    command: process.execPath,
    args: [fixturePath],
    cwd: here,
    env: { FAKE_PI_STORE: storePath, ...env },
    ephemeral: false,
    timeoutSeconds: 30,
  });
  return new PiAdapter(config as never, ctx);
}

/** A channel the owner's steers arrive on. */
class SteerChannel {
  private readonly messages: string[] = [];
  private readonly waiters: Array<(value: IteratorResult<string>) => void> = [];

  push(message: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: message, done: false });
      return;
    }
    this.messages.push(message);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    for (;;) {
      const message = this.messages.shift();
      if (message !== undefined) {
        yield message;
        continue;
      }
      const next = await new Promise<IteratorResult<string>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The events of one turn. */
async function collect(
  adapter: PiAdapter,
  options: {
    message?: string;
    parts?: Parameters<typeof buildPiPrompt>[0]['parts'];
    steer?: AsyncIterable<string>;
    externalSessionId?: string;
  } = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: options.message ?? 'What does the file say?',
    context: '',
    executionId: 'exe_1',
    ...(options.parts ? { parts: options.parts } : {}),
    ...(options.steer ? { steer: options.steer } : {}),
    ...(options.externalSessionId !== undefined
      ? { externalSessionId: options.externalSessionId }
      : {}),
  })) {
    events.push(event);
  }
  return events;
}

describe('the Pi adapter', () => {
  beforeEach(() => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-pi-'));
    storePath = path.join(directory, 'store.json');
    fs.writeFileSync(
      storePath,
      JSON.stringify({ prompts: [], steers: [], aborts: [], switched: [], commands: [] }),
    );
  });

  afterEach(() => {
    fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
  });

  it('carries the answer, the tools and the end of the turn', async () => {
    const adapter = createAdapter();
    const capabilities = await adapter.connect(connection);
    const events = await collect(adapter);
    await adapter.close?.();

    expect(capabilities.chat).toBe(true);
    expect(capabilities.streaming).toBe(true);
    expect(capabilities.persistentSessions).toBe(true);
    expect(capabilities.acceptsSteering).toBe(true);
    expect(capabilities.acceptsImages).toBe(true);

    // The text streamed.
    const delta = events.find((event) => event.type === 'message.delta');
    expect(delta?.type === 'message.delta' ? delta.text : '').toBe('PI-OK turn 1');

    // The answer completed, with the text the runtime's own message held.
    const completed = events.find((event) => event.type === 'message.completed');
    expect(completed?.type === 'message.completed' ? completed.text : '').toBe('PI-OK turn 1');

    // The tool it ran became one call, and the call finished.
    const started = events.filter((event) => event.type === 'tool.started');
    const finished = events.filter((event) => event.type === 'tool.completed');
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(1);
    expect(started[0]?.type === 'tool.started' ? started[0].toolName : '').toBe('bash');

    // The turn ended because Pi settled.
    const statuses = events.filter((event) => event.type === 'execution.status');
    const last = statuses[statuses.length - 1];
    expect(last?.type === 'execution.status' ? last.status : '').toBe('completed');
  });

  it('ends the turn at once when Pi handled the prompt itself', async () => {
    const adapter = createAdapter();
    await adapter.connect(connection);

    // A prompt Pi handles itself starts no run, so there is no `agent_settled`
    // to wait for. A route that waits for one hangs here instead of finishing.
    const events = await collect(adapter, { message: '/handled do this yourself' });
    await adapter.close?.();

    const statuses = events.filter((event) => event.type === 'execution.status');
    const last = statuses[statuses.length - 1];
    expect(last?.type === 'execution.status' ? last.status : '').toBe('completed');

    // No run started, so nothing streamed and no tool ran.
    expect(events.filter((event) => event.type === 'message.delta')).toHaveLength(0);
    expect(events.filter((event) => event.type === 'tool.started')).toHaveLength(0);
  });

  it('publishes the session, and the next turn resumes it', async () => {
    const first = createAdapter();
    await first.connect(connection);
    await collect(first);
    const session = await first.getStatus('exe_1');
    await first.close?.();

    // The session is the file Pi keeps, because that is what it can be
    // re-entered with.
    expect(session.externalRef).toBe('/tmp/pi-session-1.jsonl');

    const second = createAdapter();
    await second.connect(connection);
    await second.resumeSession(connection, session.externalRef ?? '');
    await collect(second, { externalSessionId: session.externalRef });
    await second.close?.();

    expect(store().switched).toHaveLength(1);
    expect(store().switched[0]?.sessionPath).toBe('/tmp/pi-session-1.jsonl');
  });

  it('puts a steer into the run that is going', async () => {
    const adapter = createAdapter({ FAKE_PI_TURN_DELAY_MS: '1500' });
    await adapter.connect(connection);

    const steers = new SteerChannel();
    const events = collect(adapter, { steer: steers });
    await delay(300);
    steers.push('Stop and do this instead');

    const collected = await events;
    await adapter.close?.();

    expect(store().steers).toHaveLength(1);
    expect(store().steers[0]?.message).toBe('Stop and do this instead');
    expect(collected.some((event) => event.type === 'execution.status')).toBe(true);
  });

  it('carries a picture as bytes and a file as text', async () => {
    const adapter = createAdapter();
    await adapter.connect(connection);
    await collect(adapter, {
      parts: [
        {
          type: 'image',
          resourceId: 'res_1',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: 'QUJD',
        },
        {
          type: 'file',
          resourceId: 'res_2',
          filename: 'notes.md',
          mimeType: 'text/markdown',
          text: 'the file says hello',
        },
      ],
    });
    await adapter.close?.();

    const prompt = store().prompts[0];
    // The picture's bytes crossed, and they crossed as bytes.
    expect(prompt?.images[0]?.data).toBe('QUJD');
    expect(prompt?.images[0]?.mimeType).toBe('image/png');
    // The file's text crossed in the prompt, because a prompt is what Pi takes.
    expect(prompt?.message).toContain('the file says hello');
  });

  it('refuses arguments that would start a different surface', () => {
    expect(() => piArgs({ args: ['--mode', 'json'], ephemeral: false })).toThrow(/--mode/);
    expect(() => piArgs({ args: ['--no-session'], ephemeral: false })).toThrow(/--no-session/);
    expect(piArgs({ args: [], ephemeral: false })).toEqual(['--mode', 'rpc']);
    expect(piArgs({ args: [], ephemeral: true })).toEqual(['--mode', 'rpc', '--no-session']);
  });

  it('maps Pi’s records to the product’s events', () => {
    const context = { executionId: 'exe_1', finalText: 'PI-OK turn 1' };

    // The streaming text.
    expect(
      mapPiEvent(
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'PI-OK' },
        },
        context,
      ),
    ).toEqual([{ type: 'message.delta', executionId: 'exe_1', text: 'PI-OK' }]);

    // The authoritative message.
    expect(
      mapPiEvent(
        {
          type: 'message_end',
          message: { role: 'assistant', content: [{ type: 'text', text: 'PI-OK turn 1' }] },
        },
        context,
      ),
    ).toEqual([{ type: 'message.completed', executionId: 'exe_1', text: 'PI-OK turn 1' }]);

    // A tool that ran.
    expect(
      mapPiEvent(
        {
          type: 'tool_execution_start',
          toolCallId: 'call_1',
          toolName: 'bash',
          args: { command: 'ls' },
        },
        context,
      ),
    ).toEqual([
      { type: 'tool.started', executionId: 'exe_1', toolName: 'bash', input: { command: 'ls' } },
    ]);

    // A record the product has no event for is not an event.
    expect(mapPiEvent({ type: 'queue_update', steering: [], followUp: [] }, context)).toEqual([]);
  });

  it('reads the text of a message’s blocks', () => {
    expect(
      textOf([
        { type: 'text', text: 'one ' },
        { type: 'text', text: 'two' },
      ]),
    ).toBe('one two');
    expect(textOf([{ type: 'toolCall', id: 'call_1', name: 'bash' }])).toBe('');
    expect(textOf('plain')).toBe('plain');
  });
});
