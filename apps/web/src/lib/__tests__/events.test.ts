import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventStream, type StreamStatus } from '../events';

/**
 * The event stream is the one piece of the client that has to survive a
 * misbehaving server: it replays recent events on every connect, it can
 * receive a frame that does not match the contract, and it reconnects on its
 * own. These tests pin that behaviour down.
 */

type Listener = (event: MessageEvent<string>) => void;

/** A minimal stand-in for the browser's EventSource. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  static instances: FakeEventSource[] = [];

  readyState: number = FakeEventSource.CONNECTING;
  closed = false;
  readonly url: string;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** Deliver a frame to the listeners registered for `type`. */
  emit(type: string, data?: unknown, lastEventId = ''): void {
    this.emitRaw(type, JSON.stringify(data), lastEventId);
  }

  /** Deliver a frame whose body is exactly `raw`, valid JSON or not. */
  emitRaw(type: string, raw: string, lastEventId = ''): void {
    const event = { data: raw, lastEventId } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const HEARTBEAT = { type: 'heartbeat', at: '2026-01-01T00:00:00.000Z' };

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastSource(): FakeEventSource {
  const source = FakeEventSource.instances[FakeEventSource.instances.length - 1];
  if (!source) throw new Error('The stream did not open a connection.');
  return source;
}

describe('EventStream', () => {
  it('delivers a parsed event', () => {
    const events: unknown[] = [];
    const stream = new EventStream({ onEvent: (event) => events.push(event) });

    stream.start();
    lastSource().emit('heartbeat', HEARTBEAT);

    expect(events).toEqual([HEARTBEAT]);
    stream.stop();
  });

  it('ignores a payload that does not match the contract', () => {
    const events: unknown[] = [];
    const stream = new EventStream({ onEvent: (event) => events.push(event) });

    stream.start();
    lastSource().emit('heartbeat', { type: 'heartbeat', at: 'not-a-date' });

    expect(events).toEqual([]);
    stream.stop();
  });

  it('ignores a frame whose data is not JSON', () => {
    const events: unknown[] = [];
    const stream = new EventStream({ onEvent: (event) => events.push(event) });

    stream.start();
    lastSource().emitRaw('heartbeat', 'not json');

    expect(events).toEqual([]);
    stream.stop();
  });

  it('ignores an event the server replays', () => {
    const events: unknown[] = [];
    const stream = new EventStream({ onEvent: (event) => events.push(event) });

    stream.start();
    const source = lastSource();
    source.emit('heartbeat', HEARTBEAT, 'evt-1');
    source.emit('heartbeat', HEARTBEAT, 'evt-1');

    expect(events).toHaveLength(1);
    stream.stop();
  });

  it('delivers events that carry different ids', () => {
    const events: unknown[] = [];
    const stream = new EventStream({ onEvent: (event) => events.push(event) });

    stream.start();
    const source = lastSource();
    source.emit('heartbeat', HEARTBEAT, 'evt-1');
    source.emit('heartbeat', HEARTBEAT, 'evt-2');

    expect(events).toHaveLength(2);
    stream.stop();
  });

  it('reports the connection status', () => {
    const statuses: StreamStatus[] = [];
    const stream = new EventStream({
      onEvent: () => undefined,
      onStatus: (status) => statuses.push(status),
    });

    stream.start();
    lastSource().emit('open');

    expect(statuses).toEqual(['connecting', 'open']);

    stream.stop();
    expect(statuses).toEqual(['connecting', 'open', 'idle']);
  });

  it('closes the connection and goes idle when it is stopped', () => {
    const stream = new EventStream({ onEvent: () => undefined });

    stream.start();
    const source = lastSource();
    stream.stop();

    expect(source.closed).toBe(true);
    expect(stream.getStatus()).toBe('idle');
  });

  it('does not reconnect after it was stopped', () => {
    const stream = new EventStream({ onEvent: () => undefined });

    stream.start();
    const source = lastSource();
    stream.stop();
    stream.start();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(source.closed).toBe(true);
  });
});
