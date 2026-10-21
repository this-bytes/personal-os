import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The API server does not run agents.
 *
 * The rule is in AGENTS.md and in the worker's own reason for existing: a
 * failing or compromised agent CLI must never be able to take the API server
 * down. The ACP adapter starts the agent's process to answer a probe, so a
 * probe in the API server is an agent process inside the API server.
 *
 * The server package no longer depends on the adapters package, so an import
 * would not compile. This test is the belt to that pair of braces: it fails
 * on the import even if the dependency is put back.
 */

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * This file names the package it forbids, so it is not evidence of anything.
 * Every other file in the server is.
 */
const selfName = path.basename(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

describe('the API server boundary', () => {
  it('does not import the adapter package anywhere', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(serverRoot)) {
      if (path.basename(file) === selfName) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes('@personal-os/agent-adapters')) {
        offenders.push(path.relative(serverRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not depend on the adapter package', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(serverRoot, '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(manifest.dependencies?.['@personal-os/agent-adapters']).toBeUndefined();
  });
});
