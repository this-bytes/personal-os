import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The adapter boundary.
 *
 * `AGENTS.md` says the domain must not depend on a particular agent provider,
 * and `docs/decisions/0004-adapter-registry.md` says the domain never mentions
 * a specific provider. **This is the check that holds that.**
 *
 * The rule is about the *edge*, not about the words: the domain may say
 * "Codex" in a test fixture, because that is configuration and ADR 0004 allows
 * it. What the domain may not do is reach into the package that holds the
 * adapters. So the check reads the source tree and looks for the dependency.
 */

/** The package that holds every concrete adapter. */
const ADAPTERS = '@personal-os/agent-adapters';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Every TypeScript file under a directory, recursively. */
function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** The source files that make up the domain, relative to the repository root. */
function domainFiles(): string[] {
  const roots = [path.join('apps', 'server', 'src', 'modules'), path.join('apps', 'worker', 'src')];
  const out: string[] = [];
  for (const root of roots) {
    for (const file of walk(path.join(repoRoot, root))) {
      const relative = path.relative(repoRoot, file);
      if (relative.includes(`${path.sep}__tests__${path.sep}`)) continue;
      out.push(relative);
    }
  }
  return out;
}

/**
 * Every shipped source file outside the tests, relative to the repository root.
 *
 * The browser client and the UI package are in here as well as the domain:
 * **the CLI adapter spawns a process**, so a client that reached the adapters
 * package would carry it into the bundle.
 */
function shippedFiles(): string[] {
  const roots = [
    path.join('apps', 'server', 'src'),
    path.join('apps', 'worker', 'src'),
    path.join('apps', 'web', 'src'),
    path.join('packages', 'ui', 'src'),
    path.join('packages', 'contracts', 'src'),
  ];
  const out: string[] = [];
  for (const root of roots) {
    for (const file of walk(path.join(repoRoot, root))) {
      const relative = path.relative(repoRoot, file);
      if (relative.includes(`${path.sep}__tests__${path.sep}`)) continue;
      out.push(relative);
    }
  }
  return out;
}

/** Whether a file names the adapters package. */
function names(file: string): boolean {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8').includes(ADAPTERS);
}

describe('the domain does not depend on the adapters package', () => {
  it('no domain module imports the package that holds the adapters', () => {
    const offenders = domainFiles().filter(names);

    expect(
      offenders,
      'the domain depends on the adapter interface, not on the package that holds the adapters: ' +
        'these files import @personal-os/agent-adapters, which is where every concrete adapter ' +
        'lives. The interface is published by @personal-os/contracts.',
    ).toEqual([]);
  });

  it('the worker does not declare a dependency it does not use', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'apps', 'worker', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(
      manifest.dependencies?.[ADAPTERS],
      'the worker reaches adapters through the server runtime, so it has no use for the package ' +
        'that holds them, and declaring it is an invitation to import it.',
    ).toBeUndefined();
  });

  it('the composition root is the only place that names the adapters package', () => {
    const importers = shippedFiles().filter(names);

    expect(
      importers,
      'one place builds the registry and nothing shipped knows about the package: these files ' +
        'name the package that holds the adapters, and the composition root is the only one ' +
        'that may. The browser client is in the sweep because the CLI adapter spawns a process.',
    ).toEqual([path.join('apps', 'server', 'src', 'runtime.ts')]);
  });
});
