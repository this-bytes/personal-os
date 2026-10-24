/**
 * The constitution's own gate.
 *
 * [ADR 0017](../../../docs/decisions/0017-the-constitution-is-a-checked-document.md)
 * says that a rule in `ARCHITECTURE.md` which names a check is enforced by that
 * check, and that a rule which names none is marked *prose only* and kept by
 * review instead. This script is what makes that sentence true rather than
 * aspirational.
 *
 * It reads the constitution and fails when:
 *
 * 1. a rule names a check that does not exist;
 * 2. an enforced rule's check is not reachable from CI;
 * 3. a rule marked prose only names a check anyway — a rule cannot be quietly
 *    downgraded by editing its status and leaving the identifier behind;
 * 4. a pillar is missing from the roadmap, or a roadmap stage names no pillar;
 * 5. a pillar names a domain the domain map does not publish;
 * 6. the glossary does not define a pillar, or defines the same term twice;
 * 7. one of the promoted invariants is broken: a zod import that is not from
 *    `zod/v3`, a provider named in a domain module, a worker that reaches the
 *    server's HTTP surface rather than its database, or a preset that claims a
 *    demonstration without naming the runtime it demonstrated.
 *
 * The gate is cheap on purpose. It reads files and imports two source modules.
 * It opens no database and builds nothing, so it can run on every push.
 *
 *   npx tsx scripts/verify-standards.ts
 *
 * The exit codes:
 *
 *   0 — every check passed.
 *   1 — a check failed. Each failure names the rule and what is wrong with it.
 *   2 — the script could not run: a file it reads is missing or malformed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** One thing that is wrong, and where. */
interface Failure {
  /** The check that failed. */
  check: string;
  /** What is wrong, said so that it can be fixed without reading the source. */
  detail: string;
}

const failures: Failure[] = [];

function fail(check: string, detail: string): void {
  failures.push({ check, detail });
}

/** Read a file in the repository. */
function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

/** Whether a path in the repository exists. */
function exists(relative: string): boolean {
  return fs.existsSync(path.join(repoRoot, relative));
}

/** The directories a source sweep never descends into. */
const SKIPPED = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'data',
  'test-results',
  '.factory',
  'playwright-report',
]);

/** Every file under a directory, relative to the repository root. */
function walk(relativeRoot: string): string[] {
  const out: string[] = [];
  const root = path.join(repoRoot, relativeRoot);
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path.relative(repoRoot, full)));
    } else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) {
      out.push(path.relative(repoRoot, full));
    }
  }
  return out;
}

/**
 * The cells of the first markdown table under a heading.
 *
 * The heading is matched exactly, so a renamed section is a missing table rather
 * than a table that quietly becomes something else. The header row and the
 * separator row are not returned; the caller gets the rows.
 */
function tableUnder(markdown: string, heading: string): string[][] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];

  const rows: string[][] = [];
  let seenTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line.startsWith('|')) {
      if (seenTable) break;
      continue;
    }
    seenTable = true;
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  // The first row of a table is its header.
  return rows.slice(1);
}

/** The identifiers in a cell: the backticked words. */
function identifiersIn(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');
}

/** The bold name in a cell: `**Chat**`. */
function boldNameIn(cell: string): string | undefined {
  const match = /^\*\*(.+)\*\*$/.exec(cell);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// The files the gate reads.
// ---------------------------------------------------------------------------

const REQUIRED_FILES = ['ARCHITECTURE.md', 'glossary.md', 'docs/roadmap.md', 'package.json'];

for (const file of REQUIRED_FILES) {
  if (!exists(file)) {
    console.error(`the gate could not run: ${file} is missing`);
    process.exit(2);
  }
}

const architecture = read('ARCHITECTURE.md');
const glossary = read('glossary.md');
const roadmap = read('docs/roadmap.md');
const rootPackage = JSON.parse(read('package.json')) as {
  scripts?: Record<string, string>;
};
const gatesJson = read('scripts/gates.json');
const ciWorkflow = exists('.github/workflows/ci.yml') ? read('.github/workflows/ci.yml') : '';

/** The root package's scripts, or an empty map. */
const rootScripts: Record<string, string> = rootPackage.scripts ?? {};

/**
 * Where a script runs: the gate list and the CI workflow.
 *
 * A check that only runs on the machine that wrote it is not a gate, it is a
 * habit — ADR 0013 records that lesson about `verify:mcp-parity` being written
 * into the registry without the workflow that would have run it. So a named
 * check has to be somewhere CI reaches it.
 */
const reachability = `${gatesJson}\n${ciWorkflow}`;

// ---------------------------------------------------------------------------
// 1-3. The non-negotiable table.
// ---------------------------------------------------------------------------

const STATUSES = ['Enforced', 'Partly enforced', 'Prose only'];

/** The rows of the constitution's non-negotiable table. */
const ruleRows = tableUnder(architecture, '## 3. The non-negotiables');

if (ruleRows.length === 0) {
  fail(
    'the non-negotiable table',
    'ARCHITECTURE.md has no table under "## 3. The non-negotiables"',
  );
}

/** The workspaces whose sources carry a test suite. */
const workspaces = fs
  .readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `apps/${entry.name}`)
  .concat(
    fs
      .readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `packages/${entry.name}`),
  );

/** The npm scripts the CI workflow runs, by name. */
function ciRunsScript(name: string): boolean {
  return ciWorkflow.includes(`npm run ${name}`) || gatesJson.includes(`"${name}"`);
}

/**
 * Whether a named test file is actually run.
 *
 * A test file that no suite collects is a file, not a check, so the file has to
 * live in a workspace whose `test` script runs vitest, and `npm run test` has
 * to be somewhere CI reaches it.
 */
function testFileRuns(identifier: string): boolean {
  const holder = workspaces.find((workspace) => {
    const source = path.join(repoRoot, workspace, 'src');
    if (!fs.existsSync(source)) return false;
    return walk(workspace).some((file) => path.basename(file) === identifier);
  });
  if (!holder) return false;

  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, holder, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  const test = manifest.scripts?.test ?? '';
  if (!test.includes('vitest')) return false;

  const gatesRunTests = /"run",\s*"test"/.test(gatesJson);
  const ciRunsTests = ciWorkflow.includes('npm run test');
  return gatesRunTests && ciRunsTests;
}

/** Whether a named check exists at all. */
function checkExists(identifier: string): boolean {
  if (identifier.startsWith('verify:')) {
    return Object.prototype.hasOwnProperty.call(rootScripts, identifier);
  }
  if (identifier.includes('/')) {
    return exists(identifier);
  }
  // A bare file name: find it anywhere the tree keeps source.
  return [...workspaces, 'scripts'].some((root) =>
    walk(root).some((file) => path.basename(file) === identifier),
  );
}

/** Whether a named check is somewhere CI reaches it. */
function checkIsReachable(identifier: string): boolean {
  if (/\.test\.tsx?$/.test(identifier)) return testFileRuns(identifier);
  return reachability.includes(identifier);
}

for (const row of ruleRows) {
  const number = row[0] ?? '';
  const rule = row[1] ?? '';
  const provedBy = row[2] ?? '';
  const status = row[3] ?? '';

  if (!/^\d+$/.test(number)) {
    fail('the non-negotiable table', `a row is not numbered: "${rule}"`);
    continue;
  }
  if (rule.length === 0) {
    fail('the non-negotiable table', `rule ${number} has no text`);
  }
  if (!STATUSES.includes(status)) {
    fail(
      'the non-negotiable table',
      `rule ${number} has the status "${status}"; the statuses are ${STATUSES.join(', ')}`,
    );
    continue;
  }

  const identifiers = identifiersIn(provedBy);

  if (status === 'Prose only') {
    // `review` is the word for "nothing checks this", not a check.
    const others = identifiers.filter((identifier) => identifier !== 'review');
    if (others.length > 0) {
      fail(
        'the non-negotiable table',
        `rule ${number} is marked "Prose only" but names ${others.join(', ')} — ` +
          'a rule cannot be quietly downgraded by editing its status and leaving the identifier behind',
      );
    }
    if (identifiers.length === 0) {
      fail(
        'the non-negotiable table',
        `rule ${number} is marked "Prose only" and must say "review" in the "Proved by" column`,
      );
    }
    continue;
  }

  if (identifiers.length === 0) {
    fail(
      'the non-negotiable table',
      `rule ${number} is marked "${status}" but names no check — a checkable rule names the check that proves it`,
    );
    continue;
  }

  for (const identifier of identifiers) {
    if (!checkExists(identifier)) {
      fail(
        'the named checks exist',
        `rule ${number} names "${identifier}", which is not in this tree`,
      );
      continue;
    }
    if (!checkIsReachable(identifier)) {
      fail(
        'the named checks are reachable',
        `rule ${number} names "${identifier}", which nothing in CI runs — ` +
          'a check that only runs on the machine that wrote it is not a gate',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4-5. The pillars, the roadmap and the domain map.
// ---------------------------------------------------------------------------

const pillarRows = tableUnder(architecture, '## 4. The pillars');
const constitutionPillars = pillarRows
  .map((row) => boldNameIn(row[0] ?? ''))
  .filter((name): name is string => Boolean(name));

if (constitutionPillars.length === 0) {
  fail('the pillar map', 'ARCHITECTURE.md has no table under "## 4. The pillars"');
}

const stageRows = tableUnder(roadmap, '## Order and release criteria');
const standingRows = tableUnder(roadmap, '### The standing pillars');

const roadmapPillars = new Set<string>();
for (const row of stageRows) {
  const pillar = (row[1] ?? '').trim();
  if (pillar.length > 0) roadmapPillars.add(pillar);
}
for (const row of standingRows) {
  const name = boldNameIn(row[0] ?? '');
  if (name) roadmapPillars.add(name);
}

for (const pillar of constitutionPillars) {
  if (!roadmapPillars.has(pillar)) {
    fail(
      'the pillars reach the roadmap',
      `"${pillar}" is a pillar in ARCHITECTURE.md but no roadmap stage names it`,
    );
  }
}

for (const pillar of roadmapPillars) {
  if (!constitutionPillars.includes(pillar)) {
    fail(
      'the roadmap reaches the pillars',
      `"${pillar}" is named in the roadmap but is not a pillar in ARCHITECTURE.md`,
    );
  }
}

// The domain names the machine-readable map publishes.
const { domainNames } = (await import('../apps/server/src/domains.js')) as {
  domainNames: readonly string[];
};

/** The domain names the pillar map says it touches, capitalised as it writes them. */
const touchedDomains = new Set<string>();
for (const row of pillarRows) {
  const touches = row[2] ?? '';
  for (const name of touches.split(',')) {
    const trimmed = name.trim();
    if (trimmed.length === 0) continue;
    touchedDomains.add(trimmed);
  }
}

/** The domain names, as the pillar map writes them. */
const domainLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

for (const name of touchedDomains) {
  if (!domainNames.includes(name.toLowerCase())) {
    fail(
      'the pillar map names real domains',
      `"${name}" is not one of the domains the domain map publishes (${domainNames.join(', ')})`,
    );
  }
}

for (const name of domainNames) {
  if (!touchedDomains.has(domainLabel(name))) {
    fail(
      'the pillar map covers every domain',
      `the domain "${domainLabel(name)}" is published by the domain map and no pillar names it`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. The glossary.
// ---------------------------------------------------------------------------

interface GlossaryEntry {
  term: string;
  definition: string;
  avoids: string[];
}

const glossaryEntries: GlossaryEntry[] = [];
{
  const lines = glossary.split('\n');
  let current: GlossaryEntry | undefined;
  let body: string[] = [];
  const flush = (): void => {
    if (current) {
      current.definition = body
        .filter((line) => !/^\s*_Avoid_:/i.test(line))
        .join(' ')
        .trim();
      glossaryEntries.push(current);
    }
    current = undefined;
    body = [];
  };
  for (const line of lines) {
    const header = /^\*\*([^*]+)\*\*:\s*$/.exec(line);
    if (header) {
      flush();
      current = { term: (header[1] ?? '').trim(), definition: '', avoids: [] };
      continue;
    }
    const avoid = /^\s*_Avoid_:\s*(.+)$/i.exec(line);
    if (avoid && current) {
      current.avoids.push(...(avoid[1] ?? '').split(',').map((word) => word.trim()));
      continue;
    }
    if (current) body.push(line.trim());
  }
  flush();
}

const seenTerms = new Set<string>();
for (const entry of glossaryEntries) {
  if (seenTerms.has(entry.term)) {
    fail('the glossary defines each term once', `"${entry.term}" is defined twice`);
  }
  seenTerms.add(entry.term);

  if (entry.definition.length === 0) {
    fail('the glossary defines each term', `"${entry.term}" has no definition`);
  }
  if (entry.avoids.length === 0) {
    fail(
      'the glossary names what each term is confused with',
      `"${entry.term}" has no "_Avoid_" line`,
    );
  }
}

for (const pillar of constitutionPillars) {
  if (!seenTerms.has(pillar)) {
    fail(
      'the glossary names every pillar',
      `"${pillar}" is a pillar and is not defined in glossary.md`,
    );
  }
}

// ---------------------------------------------------------------------------
// 7. The promoted invariants.
// ---------------------------------------------------------------------------

/** The source roots a zod sweep covers. */
const zodRoots = [...workspaces.map((workspace) => `${workspace}/src`), 'scripts'];

for (const root of zodRoots) {
  for (const file of walk(root)) {
    const text = read(file);
    for (const match of text.matchAll(/from\s+['"](zod[^'"]*)['"]/g)) {
      const specifier = match[1] ?? '';
      if (specifier !== 'zod/v3') {
        fail(
          'every zod import is from zod/v3',
          `${file} imports "${specifier}" — ADR 0014 says every import of zod is from 'zod/v3'`,
        );
      }
    }
  }
}

/** The providers the domain must not name. */
const PROVIDERS = ['codex', 'opencode', 'hermes', 'openclaw'];

/** A source file with its comments removed, so only code is searched. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

for (const file of walk('apps/server/src/modules')) {
  if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
  const text = withoutComments(read(file));
  for (const provider of PROVIDERS) {
    const pattern = new RegExp(`\\b${provider}\\b`, 'i');
    if (pattern.test(text)) {
      fail(
        'the core domain never names a provider',
        `${file} names "${provider}" — the domain must not know that any of these exist`,
      );
    }
  }
}

/**
 * The worker's only channel to the server is the database.
 *
 * The server package publishes three entry points: the HTTP application, the
 * database, and the runtime. The worker reaches the last two and must never
 * reach the first.
 */
const ALLOWED_SERVER_IMPORTS = new Set(['db', 'runtime']);

for (const file of walk('apps/worker/src')) {
  // A worker test may boot the server to drive it — that is the test driving
  // the product, not the worker reaching for it. The rule is about the
  // worker's own runtime path.
  if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
  const text = read(file);
  for (const match of text.matchAll(/from\s+['"]@personal-os\/server([^'"]*)['"]/g)) {
    const subpath = (match[1] ?? '').replace(/^\//, '');
    if (!ALLOWED_SERVER_IMPORTS.has(subpath)) {
      fail(
        'the worker reaches the server only through the database',
        `${file} imports "@personal-os/server${match[1] ?? ''}" — the worker may use ` +
          `only ${[...ALLOWED_SERVER_IMPORTS].map((name) => `@personal-os/server/${name}`).join(' and ')}`,
      );
    }
  }
}

// A preset that claims a demonstration names the runtime it demonstrated.
{
  const { listAdapterPresets, ADAPTER_PRESET_RUNTIMES } = (await import(
    '../packages/contracts/src/adapter-presets.js'
  )) as {
    listAdapterPresets: () => {
      id: string;
      verified: boolean;
      runtime?: string;
      evidence?: { runtime: string };
    }[];
    ADAPTER_PRESET_RUNTIMES: readonly string[];
  };

  for (const preset of listAdapterPresets()) {
    if (!preset.verified) continue;
    const evidenceRuntime = preset.evidence?.runtime;
    if (!evidenceRuntime) {
      fail(
        'a preset that claims a demonstration names the runtime it demonstrated',
        `the preset "${preset.id}" is verified but names no runtime`,
      );
      continue;
    }
    if (preset.runtime) {
      if (evidenceRuntime !== preset.runtime) {
        fail(
          'a preset that claims a demonstration names the runtime it demonstrated',
          `the preset "${preset.id}" targets "${preset.runtime}" but its evidence names "${evidenceRuntime}"`,
        );
      }
      continue;
    }
    if ((ADAPTER_PRESET_RUNTIMES as readonly string[]).includes(evidenceRuntime)) {
      fail(
        'a preset that claims a demonstration names the runtime it demonstrated',
        `the preset "${preset.id}" names no approved runtime but its evidence claims "${evidenceRuntime}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The verdict.
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\nThe constitution is not honoured. ${failures.length} failure(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.check}`);
    console.error(`    ${failure.detail}\n`);
  }
  process.exit(1);
}

console.log('The constitution is honoured.');
console.log(
  `  ${ruleRows.length} non-negotiables, each naming a check that exists and is reachable.`,
);
console.log(
  `  ${constitutionPillars.length} pillars, each named by the roadmap and each naming real domains.`,
);
console.log(
  `  ${glossaryEntries.length} terms defined, each with a definition and an "_Avoid_" line.`,
);
console.log('  Every zod import is from zod/v3, no domain module names a provider,');
console.log('  the worker reaches the server only through the database, and every');
console.log('  verified preset names the runtime it demonstrated.');
process.exit(0);
