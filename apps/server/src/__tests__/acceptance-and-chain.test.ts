import { afterEach, describe, expect, it } from 'vitest';
import { deriveChainState } from '../modules/conversations/routing.js';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

describe('the chain state', () => {
  const base = Date.parse('2026-01-01T00:00:00.000Z');

  it('counts the agent turns that follow the last human message', () => {
    const messages = [
      { origin: { kind: 'human' }, createdAt: new Date(base).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 60_000).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 120_000).toISOString() },
    ];

    const state = deriveChainState(messages, base + 180_000);
    expect(state.turnCount).toBe(2);
    expect(state.elapsedMs).toBe(180_000);
  });

  it('gives the same answer whatever order the messages arrive in', () => {
    const messages = [
      { origin: { kind: 'human' }, createdAt: new Date(base).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 60_000).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 120_000).toISOString() },
    ];

    const ascending = deriveChainState(messages, base + 180_000);
    const descending = deriveChainState([...messages].reverse(), base + 180_000);

    expect(descending.turnCount).toBe(ascending.turnCount);
    expect(descending.elapsedMs).toBe(ascending.elapsedMs);
  });

  it('anchors on the most recent human message, not the oldest', () => {
    const messages = [
      { origin: { kind: 'human' }, createdAt: new Date(base).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 60_000).toISOString() },
      { origin: { kind: 'human' }, createdAt: new Date(base + 120_000).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 180_000).toISOString() },
    ];

    const state = deriveChainState([...messages].reverse(), base + 180_000);
    // The chain starts at the second human message.
    expect(state.turnCount).toBe(1);
    expect(state.elapsedMs).toBe(60_000);
  });

  it('measures the spend limit in agent turns', () => {
    const messages = [
      { origin: { kind: 'human' }, createdAt: new Date(base).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 60_000).toISOString() },
      { origin: { kind: 'agent' }, createdAt: new Date(base + 120_000).toISOString() },
    ];

    expect(deriveChainState(messages, base + 180_000).spendUnits).toBe(2);
  });
});

describe('the task acceptance boundary', () => {
  it('refuses to close a task through an ordinary update', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({
      workspaceId: 'wsp_1',
      title: 'Do the thing',
      acceptanceCriteria: ['The thing was done'],
    });

    expect(() => stack!.factory.updateTask(task.id, { status: 'done' })).toThrow(
      /acceptance decision/i,
    );
  });

  it('still allows the ordinary statuses', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    expect(stack.factory.updateTask(task.id, { status: 'review' }).status).toBe('review');
    expect(stack.factory.updateTask(task.id, { status: 'blocked' }).status).toBe('blocked');
  });

  it('closes a task through an acceptance decision', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({
      workspaceId: 'wsp_1',
      title: 'Do the thing',
      acceptanceCriteria: ['The thing was done'],
    });

    const accepted = stack.factory.acceptTask(task.id, {
      satisfied: true,
      reason: 'Checked',
      acceptedBy: 'usr_1',
    });
    expect(accepted.status).toBe('done');
  });

  it('rejects an acceptance that was not satisfied', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    const rejected = stack.factory.acceptTask(task.id, {
      satisfied: false,
      reason: 'Not enough evidence',
      acceptedBy: 'usr_1',
    });
    expect(rejected.status).toBe('open');
  });

  it('bumps the revision so a concurrent writer is detected', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });
    expect(task.revision).toBe(1);

    const updated = stack.factory.updateTask(task.id, { status: 'active' });
    expect(updated.revision).toBe(2);
  });

  it('rejects an update that presents a stale revision', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    const updated = stack.factory.updateTask(task.id, { status: 'active' });
    expect(updated.revision).toBe(2);

    expect(() =>
      stack!.factory.updateTask(task.id, { status: 'blocked', expectedRevision: 1 }),
    ).toThrow(/changed since it was read/i);
  });

  it('accepts an update that presents the current revision', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    const updated = stack.factory.updateTask(task.id, {
      status: 'active',
      expectedRevision: task.revision,
    });
    expect(updated.status).toBe('active');
  });
});

describe('task resources', () => {
  it('reports the real revision', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    const resource = stack.resources.get(task.id);
    expect(resource.revision).toBe(task.revision);
  });

  it('rejects an update based on a stale revision', () => {
    stack = createTestStack();
    const task = stack.factory.createTask({ workspaceId: 'wsp_1', title: 'Do the thing' });

    stack.resources.update(task.id, { expectedRevision: task.revision, title: 'First write' });

    expect(() =>
      stack!.resources.update(task.id, {
        expectedRevision: task.revision,
        title: 'Second write',
      }),
    ).toThrow(/changed since it was read/i);
  });
});
