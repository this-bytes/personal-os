/**
 * The gate that notices when an owner capability stops being an agent capability.
 *
 * ADR 0013 says surface parity is a requirement with a check, not a direction with
 * hope: every operation the owner can perform has to exist as an MCP tool over
 * the same contract, or carry an explicit exemption with a written reason. This
 * is that check, and it is the gate ADR 0013 names — `npm run verify:mcp-parity`.
 *
 * It reads two published things and one tree:
 *
 *   1. `CONTRACTS.md` — the HTTP surface table, which is the published list of
 *      owner-facing routes.
 *   2. `packages/contracts/src/mcp.ts` — the published tool names.
 *   3. `apps/server/src` — the routes the server actually registers and the
 *      tools the MCP server actually registers.
 *
 * And it reads one table of judgements: `scripts/mcp-parity.json`, beside this
 * script. Every route is in that table once, and every entry says which of
 * three things it is — `paired` with a named tool, `listed` with a reason and the
 * spec that will pair it, or `exempt` with a reason.
 *
 * **The gate fails closed.** A route that the contract publishes and the table
 * does not answer for is a failure, not a warning: that is the exact shape of the
 * defect the gate exists to catch, and a human-only route added later cannot be
 * added quietly. A route the *code* registers and the *contract* does not
 * publish is a failure too, because a route that is not published cannot be
 * paired and is therefore a human-only route by another name.
 *
 * **A gate that passes vacuously is a failed gate.** So the gate refuses to
 * pass when it found no routes at all, or when no route is paired with a tool —
 * a table that exempts everything would satisfy every other check and would
 * prove nothing.
 *
 *   npx tsx scripts/verify-mcp-parity.ts
 *
 * The exit codes:
 *
 *   0 — every published route is paired, listed or exempt, and every claim the
 *       table makes holds.
 *   1 — a route is uncovered, a claim is false, or the gate proved nothing.
 *   2 — the gate could not run: a published file is missing or unreadable.
 *
 * The script never edits the contract or the table. Deciding what pairs a route
 * is a human decision, and both files are read by several items at once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A route as the contract publishes it. */
export interface Route {
  /** The method, upper case. `ANY` covers every method. */
  method: string;
  /** The path, as published. */
  path: string;
  /** The line of the contract the route is published on. */
  contractLine: number;
}

/** One entry of the coverage table. */
export type Coverage =
  /** A registered tool performs the same operation on the same objects. */
  | { kind: 'paired'; tool: string }
  /** Not agent-operable yet, with the reason and the spec that will pair it. */
  | { kind: 'listed'; reason: string; spec: string }
  /** Not an owner capability an agent should have, with the reason. */
  | { kind: 'exempt'; reason: string };

/** The coverage table as it is read from disk. */
interface CoverageFile {
  contract?: string;
  about?: string;
  routes: Array<{
    route: string;
    kind?: string;
    tool?: string;
    reason?: string;
    spec?: string;
  }>;
}

/** A thing the gate found wrong. */
export interface Finding {
  /** What the finding is about. */
  subject: string;
  /** Why it is wrong. */
  reason: string;
}

export interface GateResult {
  exitCode: 0 | 1 | 2;
  output: string;
  routes: Route[];
  findings: Finding[];
  warnings: string[];
}

/** The gate could not run: a published file is missing or unreadable. */
export class GateError extends Error {}

/** The spec that pairs a listed route is named, so a row cannot be forgotten. */
const SPEC = /^SPEC-S\d+\+?$/;

/** The key a route is known by: the method and the path. */
const routeKey = (method: string, routePath: string): string => `${method} ${routePath}`;

/**
 * The routes the contract publishes.
 *
 * The table is the source of truth and it is read as it is written: a row may
 * name several methods (`GET/POST`), and a row may name several paths. The
 * contract writes the second path of a row relative to the first — `:id/enable`
 * · `/disable` — and a relative path is read as the sibling it names, because
 * that is what it means.
 */
export function readContractRoutes(lines: string[]): Route[] {
  const start = lines.findIndex((line) => line.startsWith('## The HTTP surface'));
  if (start === -1) throw new GateError('The contract has no "The HTTP surface" section.');

  const routes: Route[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    if (index > start && line.startsWith('## ')) break;

    const row = /^\|\s*`([A-Z/]+)`\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (!row) continue;

    const methods = row[1]!.split('/').map((method) => (method === 'ALL' ? 'ANY' : method));
    const written = row[2]!
      .split('·')
      .map((part) => part.trim().replace(/^`|`$/g, ''))
      .filter((part) => part.length > 0);

    for (const part of written) {
      const routePath = isAbsolutePath(part)
        ? part
        : `${written[written.indexOf(part) - 1]?.replace(/\/[^/]*$/, '') ?? ''}${part}`;
      for (const method of methods) {
        routes.push({ method, path: routePath, contractLine: index + 1 });
      }
    }
  }
  return routes;
}

/**
 * Whether a published path names its whole path.
 *
 * The contract writes a row's second path as the sibling it names — `:id/enable`
 * · `/disable` — and a path that does not start at the root is read as the
 * sibling of the path before it.
 */
function isAbsolutePath(routePath: string): boolean {
  return routePath === '/mcp' || routePath === '/api' || routePath.startsWith('/api/');
}

/**
 * The tool names the contracts publish.
 *
 * The array is read from the source rather than the build, so the gate does not
 * depend on a build having run, and comments inside it are stripped before the
 * names are taken out of it.
 */
export function readPublishedTools(source: string): string[] {
  const start = source.indexOf('export const mcpToolNames');
  if (start === -1) throw new GateError('The contracts publish no mcpToolNames.');
  const end = source.indexOf('as const;', start);
  if (end === -1) throw new GateError('The mcpToolNames array is not closed.');

  const array = source
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const names = new Set<string>();
  for (const match of array.matchAll(/'([a-z][a-z0-9.]*)'/g)) names.add(match[1]!);
  return [...names];
}

/**
 * The tools the MCP server registers.
 *
 * The implementation is the other half of the contract: a tool the contract
 * publishes and the server does not register is a tool that does not exist, and
 * a tool the server registers and the contract does not publish is a capability
 * nobody wrote down.
 */
export function readImplementedTools(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/registerTool\(\s*'([a-z][a-z0-9.]*)'/g))
    names.add(match[1]!);
  return [...names];
}

/**
 * The routes the server registers.
 *
 * Only the server's own sources are read. A test file mentions routes it
 * builds in a scratch tree, and a mention of a route is not a registration of
 * it — reading those would make the gate report the tree's own fixtures as
 * unpublished routes.
 */
export function readCodeRoutes(root: string): Route[] {
  const base = path.join(root, 'apps', 'server', 'src');
  const routes: Route[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const source = fs.readFileSync(full, 'utf8');
        for (const match of source.matchAll(
          /app\.(get|post|put|patch|delete|all)\(\s*'([^']+)'/g,
        )) {
          const method = match[1]!.toUpperCase();
          routes.push({
            method: method === 'ALL' ? 'ANY' : method,
            path: match[2]!,
            contractLine: 0,
          });
        }
      }
    }
  };
  walk(base);
  return routes;
}

export interface GateOptions {
  root: string;
  contract?: string;
  coverage?: string;
}

/**
 * The gate, over a tree.
 *
 * The options name the tree, so a test can point the gate at a copy of the
 * repository and watch it refuse a route nobody answered for.
 */
export function runGate(options: GateOptions): GateResult {
  const root = path.resolve(options.root);
  const contractPath = path.resolve(root, options.contract ?? 'CONTRACTS.md');
  const coveragePath = path.resolve(root, options.coverage ?? 'scripts/mcp-parity.json');
  const contractsPath = path.join(root, 'packages', 'contracts', 'src', 'mcp.ts');
  const mcpServerPath = path.join(root, 'apps', 'server', 'src', 'modules', 'mcp', 'server.ts');

  for (const required of [contractPath, coveragePath, contractsPath, mcpServerPath]) {
    if (!fs.existsSync(required)) {
      throw new GateError(`${path.relative(root, required)} is not in the tree.`);
    }
  }

  const findings: Finding[] = [];
  const warnings: string[] = [];

  const contractLines = fs.readFileSync(contractPath, 'utf8').split('\n');
  const routes = readContractRoutes(contractLines);
  const publishedTools = readPublishedTools(fs.readFileSync(contractsPath, 'utf8'));
  const implementedTools = readImplementedTools(fs.readFileSync(mcpServerPath, 'utf8'));
  const codeRoutes = readCodeRoutes(root);

  let coverageFile: CoverageFile;
  try {
    coverageFile = JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as CoverageFile;
  } catch (error) {
    throw new GateError(`The coverage table is not readable JSON: ${(error as Error).message}`);
  }

  // The table is read entry by entry, and every entry has to say which of the
  // three things it is. An entry the gate cannot read is an entry the gate
  // cannot check, and it is a failure rather than a skip.
  const coverage = new Map<string, Coverage>();
  for (const entry of coverageFile.routes ?? []) {
    const key = entry.route;
    if (coverage.has(key)) {
      findings.push({ subject: key, reason: 'the coverage table lists this route twice' });
      continue;
    }
    if (entry.kind === 'paired') {
      if (!entry.tool) {
        findings.push({ subject: key, reason: 'paired, but no tool is named' });
        continue;
      }
      coverage.set(key, { kind: 'paired', tool: entry.tool });
      continue;
    }
    if (entry.kind === 'listed') {
      if (!entry.reason) {
        findings.push({ subject: key, reason: 'listed, but no reason is written' });
        continue;
      }
      if (!entry.spec || !SPEC.test(entry.spec)) {
        findings.push({
          subject: key,
          reason: 'listed, but no spec that will pair it is named',
        });
        continue;
      }
      coverage.set(key, { kind: 'listed', reason: entry.reason, spec: entry.spec });
      continue;
    }
    if (entry.kind === 'exempt') {
      if (!entry.reason) {
        findings.push({ subject: key, reason: 'exempt, but no reason is written' });
        continue;
      }
      coverage.set(key, { kind: 'exempt', reason: entry.reason });
      continue;
    }
    findings.push({
      subject: key,
      reason: `the coverage table says "${entry.kind ?? 'nothing'}", which is not one of paired, listed or exempt`,
    });
  }

  // Every published route is answered for, and every answer is checked.
  const published = new Set<string>();
  let paired = 0;
  for (const route of routes) {
    const key = routeKey(route.method, route.path);
    published.add(key);

    const entry = coverage.get(key);
    if (!entry) {
      findings.push({
        subject: key,
        reason: `the contract publishes this route and the coverage table does not answer for it (contract line ${route.contractLine})`,
      });
      continue;
    }
    if (entry.kind === 'paired') {
      paired += 1;
      if (!publishedTools.includes(entry.tool)) {
        findings.push({
          subject: key,
          reason: `it is paired with "${entry.tool}", which the contracts do not publish`,
        });
      }
      if (!implementedTools.includes(entry.tool)) {
        findings.push({
          subject: key,
          reason: `it is paired with "${entry.tool}", which the MCP server does not register`,
        });
      }
    }
  }

  // A route the table answers for that the contract does not publish is a
  // stale table, and a stale table is a table that has stopped being checked.
  for (const key of coverage.keys()) {
    if (!published.has(key)) {
      findings.push({
        subject: key,
        reason: 'the coverage table answers for a route the contract does not publish',
      });
    }
  }

  // A route the code registers and the contract does not publish is a
  // human-only route that cannot be paired, because nobody wrote it down.
  for (const route of codeRoutes) {
    const key = routeKey(route.method, route.path);
    if (!published.has(key)) {
      findings.push({
        subject: key,
        reason:
          'the server registers this route and the contract does not publish it, so it can never be paired',
      });
    }
  }

  // A route the contract publishes and the code does not register is the
  // contract-first case: the contract may lead the code. It is reported, and
  // it is not a failure, because the contract is allowed to be ahead.
  for (const key of published) {
    if (!codeRoutes.some((route) => routeKey(route.method, route.path) === key)) {
      warnings.push(`${key} is published but the server does not register it`);
    }
  }

  // The published tools and the implemented tools are the same set. A tool the
  // contract publishes and the server does not register does not exist, and a
  // tool the server registers and the contract does not publish is a
  // capability nobody wrote down.
  for (const tool of publishedTools) {
    if (!implementedTools.includes(tool)) {
      findings.push({
        subject: tool,
        reason: 'the contracts publish this tool and the MCP server does not register it',
      });
    }
  }
  for (const tool of implementedTools) {
    if (!publishedTools.includes(tool)) {
      findings.push({
        subject: tool,
        reason: 'the MCP server registers this tool and the contracts do not publish it',
      });
    }
  }

  // A gate that checks nothing has not passed.
  if (routes.length === 0) {
    findings.push({
      subject: 'the contract',
      reason: 'the HTTP surface table holds no routes, so the gate checked nothing',
    });
  }
  if (paired === 0 && routes.length > 0) {
    findings.push({
      subject: 'the coverage table',
      reason: 'no route is paired with a tool, so the gate proved nothing',
    });
  }

  const exitCode: 0 | 1 = findings.length > 0 ? 1 : 0;
  return {
    exitCode,
    output: report({
      contractPath,
      coveragePath,
      routes,
      codeRoutes: codeRoutes.length,
      tools: publishedTools.length,
      paired,
      coverage,
      findings,
      warnings,
    }),
    routes,
    findings,
    warnings,
  };
}

function report(input: {
  contractPath: string;
  coveragePath: string;
  routes: Route[];
  codeRoutes: number;
  tools: number;
  paired: number;
  coverage: Map<string, Coverage>;
  findings: Finding[];
  warnings: string[];
}): string {
  const listed = [...input.coverage.values()].filter((entry) => entry.kind === 'listed').length;
  const exempt = [...input.coverage.values()].filter((entry) => entry.kind === 'exempt').length;
  const out: string[] = [];

  out.push('The MCP parity gate');
  out.push(`  contract  ${path.basename(input.contractPath)}`);
  out.push(`  coverage  ${path.basename(input.coveragePath)}`);
  out.push(`  routes    ${input.routes.length} published, ${input.codeRoutes} registered`);
  out.push(`  tools     ${input.tools} published`);
  out.push(`  paired    ${input.paired}, listed ${listed}, exempt ${exempt}`);
  out.push('');

  out.push(`Failures (${input.findings.length}):`);
  if (input.findings.length === 0) out.push('  none');
  for (const finding of input.findings) {
    out.push(`  FAIL  ${finding.subject}  ${finding.reason}`);
  }
  out.push('');

  if (input.warnings.length > 0) {
    out.push(`Warnings (${input.warnings.length}):`);
    for (const warning of input.warnings) out.push(`  WARN  ${warning}`);
    out.push('');
  }

  if (input.findings.length > 0) {
    out.push(
      'An owner-facing route is not agent-operable, or a claim in the coverage table is false.',
    );
  } else {
    out.push(
      `Every one of the ${input.routes.length} published owner-facing routes is paired with a registered tool, listed with a reason and the spec that will pair it, or exempt with a reason.`,
    );
  }
  out.push(
    'The contract and the coverage table are not edited by this script — deciding what pairs a route is a human decision.',
  );

  return `${out.join('\n')}\n`;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const root = path.resolve(option(args, '--root') ?? repoRoot);
  const contract = option(args, '--contract') ?? 'CONTRACTS.md';
  const coverage = option(args, '--coverage') ?? 'scripts/mcp-parity.json';

  try {
    const result = runGate({ root, contract, coverage });
    process.stdout.write(result.output);
    process.exitCode = result.exitCode;
  } catch (error) {
    if (error instanceof GateError) {
      process.stdout.write(`The MCP parity gate could not run: ${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

// The module exports `runGate`, so an import that ran the command line would
// run the gate against the repository instead of the tree the caller named.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
