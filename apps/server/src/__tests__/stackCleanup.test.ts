/**
 * Pins for the stack test's own cleanup.
 *
 * **What these pins are for.** WI-074 is about a teardown that was the
 * reason a suite whose every assertion had passed was reported as failed.
 * The failure was `EBUSY` from a removal that could not retry, thrown out of
 * an `afterAll` hook, and it happened three times in one evening.
 *
 * A pin that cannot fail is not a pin, so each of these provokes the failure
 * it guards rather than waiting for the machine to produce it:
 *
 * - a removal that throws is reported, not thrown, and the other directories
 *   are still cleaned;
 * - a removal that never finishes is given up on, inside the budget;
 * - a directory that is still there is reported even when its removal did
 *   not fail — the report is a fact, not a promise;
 * - a child that refuses to stop is reported, not thrown;
 * - the whole cleanup is bounded even when every part of it hangs;
 * - the removal retries, which is the lever the measurement named;
 * - the teardown's budget is bigger than the worst case it guards;
 * - and the stack test still tears itself down through this cleanup, still
 *   has its twelve cases, and no longer removes a directory by hand.
 */
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLEANUP_BUDGET_MS,
  REMOVAL_MAX_RETRIES,
  REMOVAL_RETRY_DELAY_MS,
  STOP_TIMEOUT_MS,
  TEARDOWN_TIMEOUT_MS,
  makeRemoveDir,
  runCleanup,
  type CleanupOptions,
} from './support/cleanup.js';

/** A child that is never stopped, for the tests that only need one. */
const aChild = {} as unknown as ChildProcess;

/** The options of a cleanup that has nothing to do, and nothing left behind. */
function idle(overrides: Partial<CleanupOptions> = {}): CleanupOptions {
  return {
    children: [],
    dataDirs: [],
    stop: async () => undefined,
    removeDir: async () => undefined,
    exists: () => false,
    stopTimeoutMs: 50,
    cleanupBudgetMs: 150,
    ...overrides,
  };
}

describe('the cleanup of the stack test', () => {
  it('removes every directory it is given', async () => {
    const removed: string[] = [];

    const report = await runCleanup(
      idle({
        dataDirs: ['/tmp/one', '/tmp/two'],
        removeDir: async (dir) => {
          removed.push(dir);
        },
      }),
    );

    expect(removed).toEqual(['/tmp/one', '/tmp/two']);
    expect(report.removed).toBe(2);
    expect(report.leftover).toEqual([]);
    expect(report.problems).toEqual([]);
  });

  it('reports a directory it cannot remove, and still removes the others', async () => {
    // The failure of WI-074: the removal of a tree a just-killed child still
    // holds open fails with `EBUSY`, and the throw used to escape the hook
    // and fail a suite whose every assertion had passed.
    const attempted: string[] = [];

    const report = await runCleanup(
      idle({
        dataDirs: ['/tmp/held-open', '/tmp/free'],
        removeDir: async (dir) => {
          attempted.push(dir);
          if (dir === '/tmp/held-open') {
            throw Object.assign(new Error('resource busy or locked'), { code: 'EBUSY' });
          }
        },
        exists: (dir) => dir === '/tmp/held-open',
      }),
    );

    expect(attempted).toEqual(['/tmp/held-open', '/tmp/free']);
    expect(report.removed, 'one held directory stopped the others being cleaned').toBe(1);
    expect(report.leftover).toEqual(['/tmp/held-open']);
    expect(report.problems.join('\n')).toContain('/tmp/held-open');
    expect(report.problems.join('\n')).toContain('EBUSY');
  });

  it('reports a directory that is still there, even when its removal did not fail', async () => {
    // The report is a fact, not a promise: a removal that is still retrying
    // has not settled, and one that settled without throwing may still have
    // left the directory behind.
    const report = await runCleanup(
      idle({
        dataDirs: ['/tmp/still-there'],
        removeDir: async () => undefined,
        exists: () => true,
      }),
    );

    expect(report.removed).toBe(0);
    expect(report.leftover).toEqual(['/tmp/still-there']);
    expect(report.problems.join('\n')).toContain('/tmp/still-there');
  });

  it('gives up on a removal that never finishes, inside its budget', async () => {
    const started = Date.now();

    const report = await runCleanup(
      idle({
        dataDirs: ['/tmp/never-ends'],
        removeDir: () => new Promise<void>(() => undefined),
        exists: () => true,
        cleanupBudgetMs: 150,
      }),
    );
    const elapsed = Date.now() - started;

    expect(elapsed, 'the cleanup waited for a removal that never finished').toBeLessThan(2_000);
    expect(report.leftover).toEqual(['/tmp/never-ends']);
    expect(report.problems.join('\n')).toContain('not all removed');
  });

  it('reports a child it cannot stop, and does not throw', async () => {
    const report = await runCleanup(
      idle({
        children: [aChild],
        stop: async () => {
          throw new Error('the child would not stop');
        },
      }),
    );

    expect(report.stopped).toBe(0);
    expect(report.problems.join('\n')).toContain('the child would not stop');
  });

  it('is bounded even when every part of it hangs', async () => {
    const started = Date.now();

    const report = await runCleanup(
      idle({
        children: [aChild],
        dataDirs: ['/tmp/never-ends'],
        stop: () => new Promise<void>(() => undefined),
        removeDir: () => new Promise<void>(() => undefined),
        exists: () => true,
        stopTimeoutMs: 100,
        cleanupBudgetMs: 100,
      }),
    );
    const elapsed = Date.now() - started;

    expect(elapsed, 'the teardown overran the budget it guards').toBeLessThan(2_000);
    expect(report.problems.join('\n')).toContain('not all stopped');
    expect(report.problems.join('\n')).toContain('not all removed');
    expect(report.leftover).toEqual(['/tmp/never-ends']);
  });
});

describe('the removal the stack test uses', () => {
  it('retries a file that is still held open', async () => {
    // The lever the measurement named: Node's `rm` retries `EBUSY` and
    // `EPERM` on Windows only when `maxRetries` is above its default of zero.
    const calls: Array<{ path: string; options: fs.RmOptions }> = [];
    const removeDir = makeRemoveDir(async (dir, options) => {
      calls.push({ path: dir, options });
    });

    await removeDir('/tmp/a-directory');

    expect(calls.length).toBe(1);
    expect(calls[0]?.options.maxRetries).toBe(REMOVAL_MAX_RETRIES);
    expect(calls[0]?.options.retryDelay).toBe(REMOVAL_RETRY_DELAY_MS);
    expect(calls[0]?.options.recursive).toBe(true);
    expect(calls[0]?.options.force).toBe(true);
    expect(
      REMOVAL_MAX_RETRIES,
      'a removal that does not retry cannot survive EBUSY',
    ).toBeGreaterThan(0);
  });

  it('removes a directory tree, and a directory that is not there', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-cleanup-'));
    fs.writeFileSync(path.join(dir, 'a-file.txt'), 'held');
    const removeDir = makeRemoveDir();

    await removeDir(dir);
    await removeDir(dir);

    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe('the budgets', () => {
  it('gives the teardown a budget bigger than the worst case it guards', () => {
    // The bound is the point of WI-074: a budget that was raised once and
    // overrun again is not a budget that can be raised twice.
    expect(STOP_TIMEOUT_MS + CLEANUP_BUDGET_MS).toBeLessThan(TEARDOWN_TIMEOUT_MS);
  });
});

describe('the stack test itself', () => {
  const source = fs.readFileSync(new URL('./verifyStack.test.ts', import.meta.url), 'utf8');

  it('tears itself down through the bounded cleanup', () => {
    expect(source).toContain('runCleanup(');
    expect(source).toContain('}, TEARDOWN_TIMEOUT_MS);');
    expect(source, 'the stop timeout has to be the one the budget is measured against').toContain(
      '}, STOP_TIMEOUT_MS);',
    );
    expect(source, 'the hand-written removal is what failed; it must be gone').not.toContain(
      'rmSync(',
    );
  });

  it('reports the leftovers where the report can be seen', () => {
    // Vitest drops `console` output from a top-level `afterAll` — it was
    // measured, and a report that goes nowhere is not a report.
    expect(source).toContain('process.stderr.write');
    expect(source).not.toContain('console.warn');
  });

  it('still has its twelve cases', () => {
    const cases = source.match(/^\s*it\(/gm) ?? [];

    expect(cases.length).toBe(12);
  });
});
