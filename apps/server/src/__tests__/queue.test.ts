import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { queueJobs } from '../db/schema.js';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

describe('the SQLite queue', () => {
  it('claims a queued job exactly once', () => {
    stack = createTestStack();
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { conversationId: 'cnv_1' },
    });

    const first = stack.queue.claimNext('worker-a');
    const second = stack.queue.claimNext('worker-b');

    expect(first).not.toBeNull();
    expect(first?.status).toBe('running');
    expect(first?.lockedBy).toBe('worker-a');
    expect(second).toBeNull();
  });

  it('returns null when there is nothing to do', () => {
    stack = createTestStack();
    expect(stack.queue.claimNext('worker-a')).toBeNull();
  });

  it('does not claim a job before its run time', () => {
    stack = createTestStack();
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      runAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(stack.queue.claimNext('worker-a')).toBeNull();
  });

  it('requeues a failed job while attempts remain', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 3,
    });

    stack.queue.claimNext('worker-a');
    stack.queue.fail(job.id, 'boom', 0);

    const requeued = stack.queue.claimNext('worker-b');
    expect(requeued?.id).toBe(job.id);
    expect(requeued?.attempts).toBe(2);
  });

  it('backs off before retrying a failed job', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 3,
    });

    stack.queue.claimNext('worker-a');
    stack.queue.fail(job.id, 'boom');

    // The default retry delay keeps the job out of reach for now.
    expect(stack.queue.claimNext('worker-b')).toBeNull();
  });

  it('gives up after the last attempt', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 1,
    });

    stack.queue.claimNext('worker-a');
    stack.queue.fail(job.id, 'boom');

    expect(stack.queue.claimNext('worker-b')).toBeNull();
  });

  it('releases jobs whose worker died', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    stack.queue.claimNext('worker-a');

    // Age the lease so it looks as if the worker died holding it.
    stack.handle.db
      .update(queueJobs)
      .set({ lockedAt: new Date(Date.now() - 10 * 60_000).toISOString() })
      .where(eq(queueJobs.status, 'running'))
      .run();

    const reclaimed = stack.queue.reapStaleJobs();
    expect(reclaimed).toBe(1);

    const next = stack.queue.claimNext('worker-b');
    expect(next).not.toBeNull();
    expect(next?.lockedBy).toBe('worker-b');
  });

  it('keeps a job whose lease is still fresh', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    stack.queue.claimNext('worker-a');

    expect(stack.queue.reapStaleJobs()).toBe(0);
  });

  it('refreshes the lease on a running job', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');

    stack.handle.db
      .update(queueJobs)
      .set({ lockedAt: new Date(Date.now() - 10 * 60_000).toISOString() })
      .where(eq(queueJobs.id, job!.id))
      .run();

    stack.queue.heartbeat(job!.id, 'worker-a');

    // A refreshed lease is not stale, so the job is not reaped.
    expect(stack.queue.reapStaleJobs()).toBe(0);
  });
});
