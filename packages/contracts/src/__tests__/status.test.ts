import { describe, expect, it } from 'vitest';
import { executionStatusSchema, messageStatusSchema, taskStatusSchema } from '../index.js';

/**
 * The status vocabulary.
 *
 * A message, an execution and a task each carry a status, and the statuses
 * are the state machine of the work. `unknown` is one of its states: the work
 * started and we cannot confirm how it ended. It is not `failed`, because
 * `failed` reads as "safe to retry" and a side effect that may already have
 * happened cannot simply be run again.
 */
describe('the status vocabulary', () => {
  it('unknown is a state a message can be in', () => {
    expect(messageStatusSchema.parse('unknown')).toBe('unknown');
  });

  it('unknown is a state an execution can be in', () => {
    expect(executionStatusSchema.parse('unknown')).toBe('unknown');
  });

  it('unknown is a state a task can be in', () => {
    expect(taskStatusSchema.parse('unknown')).toBe('unknown');
  });

  it('unknown is not the same state as failed', () => {
    // `failed` means the work did not do anything and may be tried again.
    // `unknown` means it may already have done something, and must not be.
    expect(messageStatusSchema.options).toContain('failed');
    expect(messageStatusSchema.options).toContain('unknown');
    expect(executionStatusSchema.options).toContain('failed');
    expect(executionStatusSchema.options).toContain('unknown');
    // A task that failed is blocked; a task that may have succeeded is
    // unknown, and the owner has to look at it.
    expect(taskStatusSchema.options).toContain('blocked');
    expect(taskStatusSchema.options).toContain('unknown');
  });

  it('does not accept a state nobody defined', () => {
    expect(messageStatusSchema.safeParse('retry-me').success).toBe(false);
    expect(executionStatusSchema.safeParse('retry-me').success).toBe(false);
    expect(taskStatusSchema.safeParse('retry-me').success).toBe(false);
  });
});
