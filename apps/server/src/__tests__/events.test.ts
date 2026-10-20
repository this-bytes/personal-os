import { afterEach, describe, expect, it } from 'vitest';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

describe('the event log', () => {
  it('assigns a strictly increasing sequence number', () => {
    stack = createTestStack();
    const first = stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    const second = stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });

    expect(second.seq).toBe(first.seq + 1);
  });

  it('starts the sequence at one on a fresh database', () => {
    stack = createTestStack();
    const event = stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    expect(event.seq).toBe(1);
  });

  it('returns only events after a given sequence number', () => {
    stack = createTestStack();
    stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    const second = stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });

    const after = stack.events.since(second.seq);
    expect(after).toHaveLength(1);
    expect(after[0]?.seq).toBe(second.seq + 1);
  });

  it('notifies subscribers about published events', () => {
    stack = createTestStack();
    const seen: number[] = [];
    const unsubscribe = stack.events.subscribe((event) => seen.push(event.seq));

    stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    unsubscribe();
    stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });

    expect(seen).toHaveLength(1);
  });

  it('replays recent events for a reconnecting client', () => {
    stack = createTestStack();
    for (let index = 0; index < 3; index += 1) {
      stack.events.publish({ type: 'heartbeat', at: new Date().toISOString() });
    }

    const recent = stack.events.recent(null, 10);
    expect(recent).toHaveLength(3);
    expect(recent.map((event) => event.seq)).toEqual([1, 2, 3]);
  });
});
