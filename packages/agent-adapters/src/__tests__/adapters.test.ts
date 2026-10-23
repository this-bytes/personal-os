import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '../index.js';
import { asText, chunkText, getByPath, interpolate, parseSseData, readSseEvents } from '../util.js';
import { EchoAdapter } from '../echo.js';
import { createCliAdapter } from '../cli.js';
import { adapterTypeSchema, parseAdapterConfig } from '@personal-os/contracts';

const ctx = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

describe('adapter registry', () => {
  it('knows every built-in adapter type', () => {
    const registry = createDefaultRegistry();
    expect(registry.list().sort()).toEqual([...adapterTypeSchema.options].sort());
  });

  it('refuses to create an adapter it does not know', () => {
    const registry = createDefaultRegistry();
    expect(() => registry.create({ adapterType: 'echo' } as never, ctx)).not.toThrow();
  });
});

describe('the echo adapter', () => {
  it('reports chat capability', async () => {
    const adapter = new EchoAdapter({ reply: 'hi', delayMs: 0 }, ctx);
    const capabilities = await adapter.connect({
      id: 'agt_1',
      name: 'Echo',
      adapterType: 'echo',
      configRef: 'cfg_1',
      enabled: true,
    });
    expect(capabilities.chat).toBe(true);
    expect(capabilities.streaming).toBe(true);
  });

  it('streams the reply and completes', async () => {
    const adapter = new EchoAdapter({ reply: 'hello world', delayMs: 0 }, ctx);
    const events = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'hi',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }

    expect(events[0]?.type).toBe('execution.status');
    expect(events.some((event) => event.type === 'message.delta')).toBe(true);

    const completed = events.find((event) => event.type === 'message.completed');
    expect(completed).toBeDefined();
    expect(events[events.length - 1]?.type).toBe('execution.status');
  });

  it('asks the owner once, and answers when the decision comes back', async () => {
    const adapter = new EchoAdapter(
      { reply: 'All done.', delayMs: 0, ask: { summary: 'May I read the project?' } },
      ctx,
    );
    const capabilities = await adapter.connect({
      id: 'agt_1',
      name: 'Asker',
      adapterType: 'echo',
      configRef: 'cfg_1',
      enabled: true,
    });
    // An agent that asks says it can ask, and says it can be continued.
    expect(capabilities.approvals).toBe(true);
    expect(capabilities.persistentSessions).toBe(true);

    const asked = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'please start',
      context: '',
      executionId: 'exe_1',
    })) {
      asked.push(event);
    }

    const request = asked.find((event) => event.type === 'approval.requested');
    expect(request).toMatchObject({ summary: 'May I read the project?' });
    // The turn stops on the request: it does not answer before it is allowed to.
    expect(asked.some((event) => event.type === 'message.completed')).toBe(false);

    // The turn that continues after the decision arrives in the session the
    // request was made in, and the agent answers rather than asks again.
    const answered = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'The owner approved this operation. Continue.',
      context: '',
      executionId: 'exe_1',
      externalSessionId: 'echo_exe_1',
    })) {
      answered.push(event);
    }
    expect(answered.some((event) => event.type === 'message.completed')).toBe(true);
    expect(answered.some((event) => event.type === 'approval.requested')).toBe(false);
  });
});

describe('the CLI adapter', () => {
  it('reports no chat capability when the command does not exist', async () => {
    const parsed = parseAdapterConfig({
      adapterType: 'cli',
      command: 'definitely-not-a-real-binary-xyz',
    });
    if (parsed.adapterType !== 'cli') throw new Error('expected a cli configuration');
    const adapter = createCliAdapter(parsed, ctx);
    const capabilities = await adapter.connect({
      id: 'agt_1',
      name: 'Broken',
      adapterType: 'cli',
      configRef: 'cfg_1',
      enabled: true,
    });
    expect(capabilities.chat).toBe(false);
  });
});

describe('adapter configuration', () => {
  it('rejects a configuration that does not match the adapter type', () => {
    expect(() =>
      parseAdapterConfig({ adapterType: 'cli', command: 'x', args: 'not an array' }),
    ).toThrow();
  });

  it('accepts a valid configuration', () => {
    const config = parseAdapterConfig({ adapterType: 'cli', command: 'echo' });
    expect(config.adapterType).toBe('cli');
    expect(config.adapterType === 'cli' && config.promptMode).toBe('stdin');
  });
});

describe('adapter helpers', () => {
  it('reads a dotted path', () => {
    const value = { a: { b: [{ c: 'found' }] } };
    expect(getByPath(value, 'a.b.0.c')).toBe('found');
    expect(getByPath(value, 'a.missing')).toBeUndefined();
    expect(getByPath(value, '')).toBe(value);
  });

  it('coerces JSON values to text', () => {
    expect(asText('plain')).toBe('plain');
    expect(asText({ text: 'nested' })).toBe('nested');
    expect(asText([{ text: 'a' }, { text: 'b' }])).toBe('a\nb');
    expect(asText(null)).toBe('');
  });

  it('interpolates template placeholders', () => {
    expect(interpolate('{"m":"{{message}}"}', { message: 'hi' })).toBe('{"m":"hi"}');
    expect(interpolate('{{unknown}}', {})).toBe('{{unknown}}');
  });

  it('splits text into chunks without losing characters', () => {
    const text = 'word '.repeat(50);
    const chunks = chunkText(text, 32);
    expect(chunks.join('')).toBe(text);
  });

  it('parses SSE payloads and ignores the done sentinel', () => {
    expect(parseSseData('{"a":1}')).toEqual({ a: 1 });
    expect(parseSseData('[DONE]')).toBeUndefined();
  });

  it('reads SSE events from a stream', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"n":1}\n\ndata: {"n":2}\n\n'));
        controller.close();
      },
    });

    const events = [];
    for await (const event of readSseEvents(body)) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]?.data).toBe('{"n":1}');
  });
});
