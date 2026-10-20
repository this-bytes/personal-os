/**
 * Verify the emitted web client bundle.
 *
 * WI-001's acceptance criterion is "no emitted JavaScript chunk exceeds
 * 300 kB". `chunkSizeWarningLimit` in the vite config does not enforce it:
 * the build prints a warning and still exits zero, so a change that quietly
 * re-bundles the panel into one file passes every gate in CI.
 *
 * This script is the gate. It reads the built client and fails when a chunk
 * is over the limit, and it reports the numbers a reviewer needs to quote:
 * the largest chunk, and the set of chunks the browser downloads for its
 * first paint.
 *
 *   npx tsx scripts/verify-bundle-size.ts
 *
 * `--assets <dir>` and `--config <file>` override where the built chunks and
 * the vite config are read from. They exist so the failure paths can be
 * exercised against a fixture rather than against the real build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(repoRoot, 'apps', 'web');

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const distDir = path.join(webDir, 'dist');
const assetsDir = path.resolve(option('--assets') ?? path.join(distDir, 'assets'));
const viteConfigPath = path.resolve(option('--config') ?? path.join(webDir, 'vite.config.ts'));

/**
 * The limit the build configures. Kept in step with
 * `CHUNK_SIZE_LIMIT_KB` in `apps/web/vite.config.ts`.
 *
 * Kilobytes here are 1000 bytes, the same measure vite uses, so the numbers
 * this script prints line up with the build output they are checked against.
 */
const CHUNK_SIZE_LIMIT_KB = 300;

/**
 * The size of the first paint before the routes were split.
 *
 * Commit `d4ee699` shipped the whole panel as one chunk. The split has to
 * stay under this number, so the work cannot be undone silently.
 */
const BASELINE_FIRST_PAINT_KB = 584.55;

/** The chunk names the pages behind the login screen are emitted under. */
const PAGE_CHUNK =
  /^(Conversations|ConversationDetail|Agents|Factory|Resources|Automations|Settings)-[\w-]+\.js$/;

interface Chunk {
  name: string;
  bytes: number;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function kib(bytes: number): string {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

function readChunks(): Chunk[] {
  if (!fs.existsSync(assetsDir)) {
    fail(`The client has not been built. Expected ${assetsDir}.\n` + 'Run "npm run build" first.');
  }

  return fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({
      name,
      bytes: fs.statSync(path.join(assetsDir, name)).size,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/**
 * The chunk names the vite config declares.
 *
 * Read from the config source rather than duplicated here, so the check
 * follows the map when it changes instead of quietly checking a stale copy.
 */
function declaredVendorChunks(): string[] {
  const source = fs.readFileSync(viteConfigPath, 'utf8');
  const names = [...source.matchAll(/\['([a-z0-9-]+)',\s*\//g)].map((match) => match[1]);
  return [...new Set(names)];
}

/**
 * The chunks the browser downloads for the first paint.
 *
 * The built HTML is what tells the browser to fetch them: the entry script
 * and the module preloads beside it. A page chunk in this set means the
 * split is not doing anything for a visitor who has not asked for that page.
 */
function firstPaintChunks(): string[] {
  const htmlPath = path.join(path.dirname(assetsDir), 'index.html');
  if (!fs.existsSync(htmlPath)) {
    fail(`The built client has no index.html at ${htmlPath}.`);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const names = new Set<string>();

  for (const match of html.matchAll(/<script[^>]*src="\/assets\/([^"]+\.js)"/g)) {
    names.add(match[1]);
  }
  for (const match of html.matchAll(
    /<link[^>]*rel="modulepreload"[^>]*href="\/assets\/([^"]+\.js)"/g,
  )) {
    names.add(match[1]);
  }

  return [...names];
}

function main(): void {
  const chunks = readChunks();

  if (chunks.length === 0) {
    fail('The build emitted no JavaScript chunks.');
  }

  const limitBytes = CHUNK_SIZE_LIMIT_KB * 1000;
  const oversized = chunks.filter((chunk) => chunk.bytes > limitBytes);

  const firstPaint = firstPaintChunks();
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const firstPaintBytes = firstPaint.reduce(
    (total, name) => total + (byName.get(name)?.bytes ?? 0),
    0,
  );
  const firstPaintPageChunks = firstPaint.filter((name) => PAGE_CHUNK.test(name));

  const declared = declaredVendorChunks();
  const emittedVendorChunks = chunks
    .map((chunk) => chunk.name)
    .filter((name) => name.startsWith('vendor-'));
  const unusedDeclarations = declared.filter(
    (name) => !emittedVendorChunks.some((file) => file.startsWith(`${name}-`)),
  );

  const largest = chunks[0];

  process.stdout.write(`JavaScript chunks emitted: ${chunks.length}\n`);
  process.stdout.write(`Largest chunk:            ${largest.name} ${kib(largest.bytes)}\n`);
  process.stdout.write(
    `First paint downloads:     ${firstPaint.length} chunks, ${kib(firstPaintBytes)} ` +
      `(baseline ${BASELINE_FIRST_PAINT_KB} kB)\n`,
  );
  for (const name of firstPaint) {
    const chunk = byName.get(name);
    process.stdout.write(`  ${name}${chunk ? ` ${kib(chunk.bytes)}` : ' (not found)'}\n`);
  }
  process.stdout.write(`Vendor chunks emitted:     ${emittedVendorChunks.length}\n`);
  process.stdout.write(`Vendor chunks declared:    ${declared.length}\n`);

  const problems: string[] = [];

  if (oversized.length > 0) {
    for (const chunk of oversized) {
      problems.push(
        `${chunk.name} is ${kib(chunk.bytes)}, over the ${CHUNK_SIZE_LIMIT_KB} kB limit.`,
      );
    }
  }

  if (unusedDeclarations.length > 0) {
    problems.push(
      `these vendor chunks are declared but never emitted: ${unusedDeclarations.join(', ')}. ` +
        'A declared chunk that matches no module is a silent lie about the bundle.',
    );
  }

  if (firstPaintPageChunks.length > 0) {
    problems.push(
      `these page chunks are part of the first paint: ${firstPaintPageChunks.join(', ')}. ` +
        'The pages behind the login screen should not be downloaded before they are asked for.',
    );
  }

  if (firstPaintBytes / 1000 >= BASELINE_FIRST_PAINT_KB) {
    problems.push(
      `the first paint is ${kib(firstPaintBytes)}, which is not smaller than the ` +
        `${BASELINE_FIRST_PAINT_KB} kB single-bundle baseline.`,
    );
  }

  if (problems.length > 0) {
    process.stderr.write('\nThe web client bundle does not meet the bundle rules:\n');
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `\nEvery chunk is within ${CHUNK_SIZE_LIMIT_KB} kB and the first paint carries no page chunk.\n`,
  );
}

main();
