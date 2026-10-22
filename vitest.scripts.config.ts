import { defineConfig } from 'vitest/config';

/**
 * The tests for the factory's own tooling.
 *
 * The workspaces have their own suites and their own configuration; this one
 * covers the scripts at the root of the repository — the work-item tool, the
 * queue index and the validator — which are not part of any workspace.
 *
 * The include is narrow on purpose: a root-level run that picked up the
 * workspaces' suites would run them twice, under two different sets of
 * settings.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
    // The queue index reads every ref that could carry an item file, and a ref
    // scan is a git subprocess per ref. The tests that build the index are
    // therefore legitimately slower than vitest's five-second default, and a
    // timeout here would report a slow tool as a broken one.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
