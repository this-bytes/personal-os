// @vitest-environment node
//
// The bundle budget is a gate: `npm run build` only warns when a chunk grows
// past the limit, so `scripts/verify-bundle-size.ts` is what actually stops a
// change that quietly re-bundles the panel into one file.
//
// A gate nobody exercises is a gate that might never fail. These tests run the
// real script against a fixture, so the failure paths are proven rather than
// assumed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const scriptPath = path.join(repoRoot, 'scripts', 'verify-bundle-size.ts');

/**
 * The runner for the script.
 *
 * `tsx` is how the repository runs its root scripts (`npm run smoke` uses it),
 * so the gate is exercised the same way it runs in a pipeline. Node cannot
 * run a `.ts` file on every supported version, so the runner is not optional.
 */
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

// Recovered from WI-092: process startup on busy mounted checkouts can exceed
// Vitest's five-second default. Bound the child itself as synchronous work
// cannot be interrupted by Vitest's timer.
const CHILD_TIMEOUT_MS = 30_000;
const CASE_TIMEOUT_MS = 60_000;

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

interface Fixture {
  /** The root of the throwaway build. */
  root: string;
  /** A chunk file of a given size, in bytes. */
  chunk(name: string, bytes: number): void;
  /** An asset directory with no chunk in it. */
  emptyAssets(): void;
  /** The HTML the browser is served, with these scripts in the first paint. */
  html(scripts: string[]): void;
  /** The vite config the script reads the declared chunk names from. */
  config(declared: string[]): void;
  run(): { status: number | null; stdout: string; stderr: string };
}

/**
 * A throwaway build.
 *
 * The script only reads file names and sizes, so the chunks are filler bytes
 * rather than real JavaScript.
 */
function fixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-bundle-'));
  fixtures.push(root);

  const assetsDir = path.join(root, 'assets');

  const write = (name: string, bytes: number): void => {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, name), Buffer.alloc(bytes, 'a'));
  };

  return {
    root,
    chunk: write,
    emptyAssets() {
      fs.mkdirSync(assetsDir, { recursive: true });
    },
    html(scripts) {
      const links = scripts
        .map((name) => `  <link rel="modulepreload" crossorigin href="/assets/${name}">`)
        .join('\n');
      const entry = scripts.map(
        (name) => `  <script type="module" src="/assets/${name}"></script>`,
      );
      fs.writeFileSync(
        path.join(root, 'index.html'),
        `<!doctype html>\n<html>\n  <head>\n${entry.join('\n')}\n${links}\n  </head>\n  <body></body>\n</html>\n`,
      );
    },
    config(declared) {
      const entries = declared
        .map((name) => `  ['${name}', /\\/node_modules\\/${name}\\//],`)
        .join('\n');
      fs.writeFileSync(
        path.join(root, 'vite.config.ts'),
        `const VENDOR_CHUNKS = [\n${entries}\n];\n`,
      );
    },
    run() {
      const result = spawnSync(
        process.execPath,
        [tsxCli, scriptPath, '--assets', assetsDir, '--config', path.join(root, 'vite.config.ts')],
        { encoding: 'utf8', timeout: CHILD_TIMEOUT_MS, killSignal: 'SIGKILL' },
      );
      if (result.error) throw result.error;
      return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    },
  };
}

describe('the bundle budget gate', { timeout: CASE_TIMEOUT_MS }, () => {
  it('passes a bundle that is within the budget', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 150_000);
    build.chunk('vendor-react-abcdefgh.js', 180_000);
    build.chunk('Agents-abcdefgh.js', 20_000);
    build.html(['index-abcdefgh.js', 'vendor-react-abcdefgh.js']);
    build.config(['vendor-react']);

    const result = build.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every chunk is within 300 kB');
  });

  it('fails when a chunk is over the limit', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 400_000);
    build.chunk('vendor-react-abcdefgh.js', 10_000);
    build.html(['index-abcdefgh.js']);
    // A vendor chunk that is declared and emitted, so the vendor rule is
    // satisfied and the limit is the only thing left to fail.
    build.config(['vendor-react']);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('over the 300 kB limit');
  });

  it('fails when a page chunk is part of the first paint', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 10_000);
    build.chunk('vendor-react-abcdefgh.js', 10_000);
    build.chunk('Agents-abcdefgh.js', 20_000);
    build.html(['index-abcdefgh.js', 'Agents-abcdefgh.js']);
    build.config(['vendor-react']);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('part of the first paint');
  });

  it('fails when the vendor chunks are declared in a shape the gate cannot read', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 150_000);
    build.html(['index-abcdefgh.js']);
    // The declaration changed shape. The gate cannot see the vendor chunks
    // any more, so it has to say so rather than quietly check nothing.
    fs.writeFileSync(
      path.join(build.root, 'vite.config.ts'),
      `const VENDOR_CHUNKS = [{ name: 'vendor-react', pattern: /react/ }];\n`,
    );

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no vendor chunks could be read');
  });

  it('fails when no vendor chunk can be read from the config', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 150_000);
    build.html(['index-abcdefgh.js']);
    // The config declares nothing the script can read: either the vendor
    // split was undone or the declaration changed shape. The rule that
    // catches this must fail rather than pass without checking anything.
    build.config([]);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no vendor chunks could be read');
  });

  it('fails when a declared vendor chunk is never emitted', () => {
    const build = fixture();
    build.chunk('index-abcdefgh.js', 10_000);
    build.html(['index-abcdefgh.js']);
    // The config declares a chunk that matches no module.
    build.config(['vendor-ghost']);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('vendor-ghost');
    expect(result.stderr).toContain('never emitted');
  });

  it('fails when the first paint is not smaller than the pre-split bundle', () => {
    const build = fixture();
    // Six chunks of 100 kB: every one of them is within the per-chunk limit,
    // but together they are heavier than the single bundle the split replaced.
    for (let index = 0; index < 6; index += 1) {
      build.chunk(`vendor-part${index}-abcdefgh.js`, 100_000);
    }
    build.html([
      'vendor-part0-abcdefgh.js',
      'vendor-part1-abcdefgh.js',
      'vendor-part2-abcdefgh.js',
      'vendor-part3-abcdefgh.js',
      'vendor-part4-abcdefgh.js',
      'vendor-part5-abcdefgh.js',
    ]);
    build.config(['vendor-part0']);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not smaller than');
  });

  it('fails when the client was never built', () => {
    const build = fixture();
    build.config([]);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has not been built');
  });

  it('fails when the build emitted no JavaScript at all', () => {
    const build = fixture();
    build.emptyAssets();
    build.config([]);

    const result = build.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no JavaScript chunks');
  });
});
