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

function fixture(dependencies: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-dependencies-'));
  directories.push(dir);
  for (const child of ['scripts', 'apps', 'packages']) fs.mkdirSync(path.join(dir, child));
  fs.copyFileSync(
    path.join(root, 'scripts/verify-dependencies.ts'),
    path.join(dir, 'scripts/verify-dependencies.ts'),
  );
  const manifest = { name: 'dependency-fixture', version: '1.0.0', type: 'module', dependencies };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(dir, 'package-lock.json'),
    JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      lockfileVersion: 3,
      packages: { '': manifest },
    }),
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(dir, 'scripts/verify-dependencies.ts'),
      ],
      { cwd: dir, encoding: 'utf8' },
    );
  return { dir, run };
}

describe('dependency gate', { timeout: 30_000 }, () => {
  it('accepts a complete empty dependency tree', () => {
    const f = fixture();
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
  });
  it('rejects a declared dependency missing from disk without downloading it', () => {
    const f = fixture({ 'personal-os-missing-fixture': '1.0.0' });
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
});
