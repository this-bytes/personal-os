import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the API lives.
 *
 * The iteration stack sets this so the client can run beside a deployment
 * that already holds the default port.
 */
const API_TARGET = process.env['PERSONAL_OS_API_TARGET'] ?? 'http://127.0.0.1:4317';

/**
 * The largest JavaScript chunk the client is allowed to emit.
 *
 * The build warns above this limit, so a change that quietly re-bundles the
 * panel into one file shows up in the build output instead of in a user's
 * first paint.
 */
const CHUNK_SIZE_LIMIT_KB = 300;

/**
 * Groups the heavy dependencies into their own chunks.
 *
 * Every page is loaded on demand, but React, the router, the query client and
 * the schema library are needed by the shell itself, so they stay in the first
 * paint. Splitting them out keeps each chunk under the limit and lets the
 * browser cache them across deploys.
 *
 * Radix and Lucide are deliberately absent: they stay under Rollup's control,
 * so the dialogs and icons that only the lazy pages use stay in those pages'
 * chunks instead of joining the first paint.
 */
const VENDOR_CHUNKS: ReadonlyArray<readonly [string, RegExp]> = [
  ['vendor-react', /\/node_modules\/(react-dom|react|scheduler)\//],
  ['vendor-router', /\/node_modules\/react-router(-dom)?\//],
  ['vendor-query', /\/node_modules\/@tanstack\//],
  ['vendor-schema', /\/node_modules\/zod\//],
  ['vendor-utils', /\/node_modules\/(tailwind-merge|clsx|class-variance-authority)\//],
];

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  const normalised = id.replace(/\\/g, '/');
  for (const [name, pattern] of VENDOR_CHUNKS) {
    if (pattern.test(normalised)) return name;
  }
  return undefined;
}

export default defineConfig(({ command }) => {
  // The development server resolves the shared contracts from their
  // TypeScript, so a change to a schema or a label reaches the running
  // client without a rebuild. The published build keeps the compiled
  // package, because that is what ships.
  const contractsAlias: Record<string, string> =
    command === 'serve'
      ? {
          '@personal-os/contracts': path.resolve(here, '../../packages/contracts/src/index.ts'),
        }
      : {};

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // The UI package ships as source so this app owns the Tailwind pipeline.
        '@personal-os/ui': path.resolve(here, '../../packages/ui/src/index.ts'),
        ...contractsAlias,
      },
    },
    server: {
      port: Number(process.env['PERSONAL_OS_WEB_PORT'] ?? 5173),
      strictPort: false,
      proxy: {
        '/api': { target: API_TARGET, changeOrigin: false },
        '/mcp': { target: API_TARGET, changeOrigin: false },
      },
    },
    test: {
      // The browser tests in `e2e/` are run by Playwright, not by Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: CHUNK_SIZE_LIMIT_KB,
      rollupOptions: {
        output: {
          manualChunks: vendorChunk,
        },
      },
    },
  };
});
