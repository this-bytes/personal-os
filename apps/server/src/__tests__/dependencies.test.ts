import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

interface FixtureOptions {
  dependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
  /** Extra lockfile entries, by their lockfile path. */
  packages?: Record<string, Record<string, unknown>>;
}

function fixture(options: FixtureOptions = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-dependencies-'));
  directories.push(dir);
  for (const child of ['scripts', 'apps', 'packages']) fs.mkdirSync(path.join(dir, child));
  fs.copyFileSync(
    path.join(root, 'scripts/verify-dependencies.ts'),
    path.join(dir, 'scripts/verify-dependencies.ts'),
  );
  const manifest = {
    name: 'dependency-fixture',
    version: '1.0.0',
    type: 'module',
    dependencies: options.dependencies ?? {},
    ...(options.overrides ? { overrides: options.overrides } : {}),
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(dir, 'package-lock.json'),
    JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      lockfileVersion: 3,
      packages: { '': manifest, ...(options.packages ?? {}) },
    }),
  );
  const run = (args: string[] = []) =>
    spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(dir, 'scripts/verify-dependencies.ts'),
        ...args,
      ],
      { cwd: dir, encoding: 'utf8' },
    );

  /**
   * The tree npm would report, written where the gate can be pointed at it.
   *
   * The gate reads what npm writes down, so the tree a test wants to talk
   * about is a file in npm's own shape. The real npm's `invalid` marker needs
   * a tree only a full install can produce, and this repository's own tree
   * needs a real install to have at all; neither belongs in a test that must
   * run without the network.
   */
  const tree = (problems: string[]) => {
    const file = path.join(dir, 'tree.json');
    fs.writeFileSync(file, JSON.stringify({ name: 'fixture', problems }));
    return ['--tree', file];
  };

  return { dir, run, tree };
}

describe('dependency gate', { timeout: 30_000 }, () => {
  it('accepts a complete empty dependency tree', () => {
    const f = fixture();
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
  });
  it('rejects a declared dependency missing from disk without downloading it', () => {
    const f = fixture({ dependencies: { 'personal-os-missing-fixture': '1.0.0' } });
    const result = f.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('missing');
    expect(fs.existsSync(path.join(f.dir, 'node_modules'))).toBe(false);
  });
  it('rejects a workspace manifest change without a lockfile update', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.dir, 'packages/ui'));
    fs.writeFileSync(
      path.join(f.dir, 'packages/ui/package.json'),
      JSON.stringify({ name: 'fixture-ui', dependencies: { 'fixture-radix': '1.0.0' } }),
    );
    const result = f.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'packages/ui/package.json dependencies differs from package-lock.json',
    );
  });

  /**
   * npm 11 does not apply the manifest's `overrides` when it decides whether
   * an installed package is valid, so a package the manifest deliberately
   * overrode reads as invalid. The gate must not tell the operator to run
   * `npm ci` for a tree that is already exactly what the lockfile records.
   */
  it('accepts an invalid package that the manifest overrode and the lockfile records', () => {
    const installed = 'node_modules/owner-fixture/node_modules/dep-fixture';
    const f = fixture({
      overrides: { 'owner-fixture': { 'dep-fixture': '^2.0.0' } },
      packages: { [installed]: { version: '2.0.1' } },
    });
    const result = f.run(f.tree([`invalid: dep-fixture@2.0.1 ${path.join(f.dir, installed)}`]));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('the lockfile explains');
  });

  it('rejects an invalid package the lockfile does not record', () => {
    const installed = 'node_modules/owner-fixture/node_modules/dep-fixture';
    const f = fixture({
      overrides: { 'owner-fixture': { 'dep-fixture': '^2.0.0' } },
      packages: { [installed]: { version: '2.0.1' } },
    });
    const result = f.run(f.tree([`invalid: dep-fixture@2.0.9 ${path.join(f.dir, installed)}`]));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not match the lockfile');
  });

  it('rejects an invalid package the manifest does not override', () => {
    const installed = 'node_modules/owner-fixture/node_modules/dep-fixture';
    const f = fixture({ packages: { [installed]: { version: '2.0.1' } } });
    const result = f.run(f.tree([`invalid: dep-fixture@2.0.1 ${path.join(f.dir, installed)}`]));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not match the lockfile');
  });

  it('rejects a missing package however npm words it', () => {
    const f = fixture();
    const result = f.run(
      f.tree(['missing: dep-fixture@1.0.0, required by dependency-fixture@1.0.0']),
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('missing');
  });

  it('rejects an extraneous package the lockfile does not record', () => {
    const f = fixture();
    const result = f.run(
      f.tree([`extraneous: dep-fixture@1.0.0 ${path.join(f.dir, 'node_modules')}`]),
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not match the lockfile');
  });
});
