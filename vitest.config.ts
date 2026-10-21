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
  },
});
