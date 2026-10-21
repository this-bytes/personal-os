import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  capabilityApiModule,
  declaredCrossings,
  domainNames,
  isAllowedImport,
  moduleDomains,
  sharedTableWrites,
  tableDomains,
} from '../domains.js';

/**
 * The domain boundary, checked.
 *
 * A map that only exists in a document decays within a sprint, and this
 * repository has already decided that a rule nothing verifies is a claim
 * rather than a rule. So the map is checked here, against the modules and the
 * schema as they are on disk:
 *
 * - every module under `src/modules` is classified into exactly one domain;
 * - every table in `db/schema.ts` is claimed by exactly one domain;
 * - no module reaches into another domain's module, except through Substrate,
 *   through the shared capability API, or through a crossing that is declared
 *   with a reason and a work item;
 * - a declared crossing that no longer exists fails the build, so the list
 *   cannot outlive the debt it describes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..');
const modulesDir = path.join(srcDir, 'modules');
const schemaFile = path.join(srcDir, 'db', 'schema.ts');

/** Every module folder on disk. */
function moduleFolders(): string[] {
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Every TypeScript file under a directory, recursively. */
function tsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...tsFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

/** The module a path belongs to, or null when it is outside `src/modules`. */
function moduleOf(filePath: string): string | null {
  const relative = path.relative(modulesDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const [first] = relative.split(path.sep);
  return first ?? null;
}

interface FoundImport {
  /** The file the import is written in, relative to `src`. */
  fromFile: string;
  fromModule: string;
  toModule: string;
  specifier: string;
}

/** Every import from one module folder into another. */
function crossModuleImports(): FoundImport[] {
  const found: FoundImport[] = [];
  const pattern = /(?:from|import)\s+'(\.[^']*)'/g;

  for (const file of tsFiles(modulesDir)) {
    const source = readFileSync(file, 'utf8');
    const fromModule = moduleOf(file);
    if (!fromModule) continue;

    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier) continue;
      // `.js` specifiers point at the TypeScript source in this repository.
      const resolved = path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts'));
      const toModule = moduleOf(resolved);
      if (!toModule || toModule === fromModule) continue;
      found.push({
        fromFile: path.relative(srcDir, file).split(path.sep).join('/'),
        fromModule,
        toModule,
        specifier,
      });
    }
  }

  return found;
}

/** Every table declared in the schema. */
function schemaTables(): string[] {
  const source = readFileSync(schemaFile, 'utf8');
  const pattern = /export const \w+ = sqliteTable\(\s*'([\w]+)'/g;
  const tables: string[] = [];
  for (const match of source.matchAll(pattern)) {
    if (match[1]) tables.push(match[1]);
  }
  return tables.sort();
}

describe('the domain map', () => {
  it('classifies every module into exactly one domain', () => {
    const onDisk = moduleFolders();
    const unclassified = onDisk.filter((name) => !(name in moduleDomains));
    expect(unclassified).toEqual([]);

    const stale = Object.keys(moduleDomains).filter((name) => !onDisk.includes(name));
    expect(stale).toEqual([]);
  });

  it('claims every table for exactly one domain', () => {
    const tables = schemaTables();
    const unclaimed = tables.filter((name) => !(name in tableDomains));
    expect(unclaimed).toEqual([]);

    const stale = Object.keys(tableDomains).filter((name) => !tables.includes(name));
    expect(stale).toEqual([]);
  });

  it('uses only the five domains', () => {
    const used = new Set([
      ...Object.values(moduleDomains),
      ...Object.values(tableDomains),
      ...declaredCrossings.flatMap((crossing) => [crossing.from, crossing.to]),
    ]);
    for (const name of used) {
      expect(domainNames).toContain(name);
    }
  });

  it('lets no module reach into another domain', () => {
    const violations: string[] = [];

    for (const found of crossModuleImports()) {
      const declared = declaredCrossings.some(
        (crossing) =>
          crossing.from === moduleDomains[found.fromModule] &&
          crossing.to === moduleDomains[found.toModule] &&
          crossing.file === found.fromFile,
      );
      if (!isAllowedImport(found.fromModule, found.toModule, declared)) {
        violations.push(
          `${found.fromFile} imports "${found.specifier}" from the ${found.toModule} domain`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('lets the shared capability API read across, and nothing else', () => {
    // The capability API is the sanctioned crossing.
    expect(isAllowedImport('capabilities', 'factory', false)).toBe(true);
    expect(isAllowedImport('capabilities', 'conversations', false)).toBe(true);

    // Substrate is available to every domain.
    expect(isAllowedImport('conversations', 'events', false)).toBe(true);
    expect(isAllowedImport('factory', 'audit', false)).toBe(true);

    // A domain reaching into another domain is refused unless the crossing
    // is declared.
    expect(isAllowedImport('resources', 'factory', false)).toBe(false);
    expect(isAllowedImport('factory', 'conversations', false)).toBe(false);
    expect(isAllowedImport('resources', 'factory', true)).toBe(true);

    // An unknown module is never allowed.
    expect(isAllowedImport('nowhere', 'factory', false)).toBe(false);
    expect(isAllowedImport('resources', 'nowhere', true)).toBe(false);

    expect(capabilityApiModule in moduleDomains).toBe(true);
    expect(moduleDomains[capabilityApiModule]).toBe('substrate');
  });

  it('does not keep a declared crossing that no longer exists', () => {
    const live = crossModuleImports();
    const stale = declaredCrossings.filter(
      (crossing) =>
        !live.some(
          (found) =>
            found.fromFile === crossing.file &&
            moduleDomains[found.fromModule] === crossing.from &&
            moduleDomains[found.toModule] === crossing.to,
        ),
    );
    expect(stale.map((crossing) => `${crossing.file} (${crossing.workItem})`)).toEqual([]);
  });

  it('names a real table and a real owner for every shared table write', () => {
    const tables = schemaTables();
    for (const write of sharedTableWrites) {
      expect(tables).toContain(write.table);
      expect(tableDomains[write.table]).toBe(write.owner);
      expect(moduleDomains[write.module]).toBeDefined();
      expect(write.workItem).toMatch(/^WI-\d+$/);
    }
  });
});
