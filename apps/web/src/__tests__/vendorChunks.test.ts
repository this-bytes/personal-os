// @vitest-environment node
//
// The vite config pulls in esbuild, which refuses to run under jsdom: jsdom's
// TextEncoder produces a Uint8Array from another realm, and esbuild checks
// for that invariant at import time. The config is a Node-side concern, so
// this file runs in the Node environment.
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

/**
 * The vendor chunk map decides what the browser downloads before it can paint.
 *
 * Two things about it are easy to break by accident and hard to notice:
 *
 * 1. A declared chunk that never matches a module is a silent lie. The build
 *    succeeds, the name never appears in the output, and the map claims a
 *    separation that does not exist.
 * 2. The patterns match a module id, and a module id on Windows is a path with
 *    backslashes. A pattern written for POSIX separators matches nothing on a
 *    Windows checkout, which quietly drops every dependency back into the
 *    entry chunk.
 *
 * These are unit tests over the real function the build uses, so a change to
 * `apps/web/vite.config.ts` that breaks either property fails here rather than
 * in a bundle size that nobody reads.
 */

type ManualChunks = (id: string) => string | undefined;

function resolveManualChunks(): ManualChunks {
  const output = viteConfig.build?.rollupOptions?.output;
  const candidate = output && !Array.isArray(output) ? output.manualChunks : undefined;

  if (typeof candidate !== 'function') {
    throw new Error('apps/web/vite.config.ts must configure a manualChunks function.');
  }

  // Rollup types the callback with a second argument it passes to every
  // chunk function. The config in this app does not use it, so the tests
  // call the function with the module id alone.
  return candidate as unknown as ManualChunks;
}

const manualChunks = resolveManualChunks();

/** The names the map is expected to produce, in the order they are declared. */
const DECLARED_VENDOR_CHUNKS = [
  'vendor-react',
  'vendor-router',
  'vendor-query',
  'vendor-schema',
  'vendor-utils',
] as const;

/** A representative module id for each declared chunk, on a Windows checkout. */
const WINDOWS_PATHS: Record<(typeof DECLARED_VENDOR_CHUNKS)[number], string> = {
  'vendor-react':
    'G:\\code\\personal-os\\node_modules\\react-dom\\cjs\\react-dom.production.min.js',
  'vendor-router': 'G:\\code\\personal-os\\node_modules\\react-router-dom\\dist\\index.js',
  'vendor-query': 'G:\\code\\personal-os\\node_modules\\@tanstack\\react-query\\build\\index.js',
  'vendor-schema': 'G:\\code\\personal-os\\node_modules\\zod\\v4\\classic\\external.js',
  'vendor-utils': 'G:\\code\\personal-os\\node_modules\\tailwind-merge\\dist\\bundle-mjs.mjs',
};

describe('the vendor chunk map', () => {
  it('routes a Windows module id to its vendor chunk', () => {
    for (const [name, id] of Object.entries(WINDOWS_PATHS)) {
      expect(manualChunks(id), `expected ${id} to land in ${name}`).toBe(name);
    }
  });

  it('routes the same module to the same chunk on a POSIX checkout', () => {
    for (const [name, id] of Object.entries(WINDOWS_PATHS)) {
      const posix = id.replace(/\\/g, '/');
      expect(manualChunks(posix), `expected ${posix} to land in ${name}`).toBe(name);
    }
  });

  it('matches the same set of modules whatever the path separator is', () => {
    const modules = [
      'node_modules/react/index.js',
      'node_modules/react-dom/client.js',
      'node_modules/scheduler/index.js',
      'node_modules/react-router/dist/index.js',
      'node_modules/react-router-dom/dist/index.js',
      'node_modules/@tanstack/react-query/build/index.js',
      'node_modules/zod/index.js',
      'node_modules/clsx/dist/clsx.mjs',
      'node_modules/tailwind-merge/dist/bundle-mjs.mjs',
      'node_modules/class-variance-authority/dist/index.js',
    ];

    for (const modulePath of modules) {
      const windows = `G:\\code\\personal-os\\${modulePath.replace(/\//g, '\\')}`;
      expect(manualChunks(windows)).toBe(manualChunks(`G:/code/personal-os/${modulePath}`));
    }
  });

  it('does not let react-router fall into the react chunk', () => {
    // "react" is a prefix of "react-router". A pattern that matched the prefix
    // instead of the whole package directory would put the router in the
    // React chunk and break the separation the map promises.
    expect(manualChunks('G:\\code\\personal-os\\node_modules\\react-router\\dist\\index.js')).toBe(
      'vendor-router',
    );
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules\\react-router-dom\\dist\\index.js'),
    ).toBe('vendor-router');
  });

  it('does not let a scoped package fall into the react chunk', () => {
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules\\@radix-ui\\react-slot\\dist\\index.mjs'),
    ).toBeUndefined();
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules\\@tanstack\\react-query\\build\\index.js'),
    ).toBe('vendor-query');
  });

  it('produces every chunk the map declares', () => {
    const produced = new Set(
      Object.values(WINDOWS_PATHS)
        .map((id) => manualChunks(id))
        .filter((n): n is string => !!n),
    );

    for (const name of DECLARED_VENDOR_CHUNKS) {
      expect(produced.has(name), `declared chunk ${name} is never produced`).toBe(true);
    }
  });

  it('leaves the icon and dialog libraries to the pages that use them', () => {
    // Radix and Lucide are deliberately absent from the map: the pages that
    // use them are lazy, so their code should ride along with those pages
    // instead of joining the first paint.
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules\\lucide-react\\dist\\esm\\lucide-react.js'),
    ).toBeUndefined();
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules\\@radix-ui\\react-dialog\\dist\\index.mjs'),
    ).toBeUndefined();
  });

  it('leaves the application source to the default chunking', () => {
    expect(manualChunks('G:\\code\\personal-os\\apps\\web\\src\\App.tsx')).toBeUndefined();
    expect(manualChunks('G:\\code\\personal-os\\packages\\ui\\src\\index.ts')).toBeUndefined();
  });

  it('does not match a directory that merely contains "node_modules"', () => {
    expect(
      manualChunks('G:\\code\\personal-os\\node_modules_backup\\react\\index.js'),
    ).toBeUndefined();
  });
});
