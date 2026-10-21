import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourceTypeSchema } from '@personal-os/contracts';

/**
 * The two published shapes.
 *
 * Two of the claims in those entries are claims about the code, and a claim
 * about the code is a contract only while the code still says it:
 *
 *  - the template record publishes the six kinds a template may start, and
 *    the code's own kind enum has to be those six;
 *  - the measures route publishes the twelve mutating routes that write no
 *    audit entry, out of the thirty-five it counts, and the code has to be
 *    writing one on exactly the others.
 *
 * Both are checked against CONTRACTS.md and against the code, rather than
 * against a copy of either, so the two cannot drift apart quietly. A change
 * to one that the other does not follow fails here: WI-033 adds the missing
 * audit entries, and the entry that names the twelve has to change with them.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function contractsSection(heading: string): string {
  const text = fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
  const start = text.indexOf(heading);
  expect(start, `CONTRACTS.md no longer publishes ${heading}`).toBeGreaterThan(-1);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

/** The kinds the template record publishes for a template. */
function publishedTemplateKinds(): string[] {
  const section = contractsSection('### The template record');
  const sentence = section
    .split(/\n\s*\n/)
    .find((block) => block.includes('is the published kind enum'));
  expect(sentence, 'the template record no longer publishes the kind enum').not.toBeUndefined();

  const groups = [...sentence!.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
  const list = groups.find((group) => group.includes(' | '));
  expect(list, 'the template record no longer publishes the list of kinds').toBeDefined();
  return list!.split('|').map((kind) => kind.trim());
}

/** The mutating routes the measures entry says write no audit entry. */
function publishedUnauditedRoutes(): string[] {
  const section = contractsSection('### The measures route');
  const rows = [...section.matchAll(/^\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|/gm)];
  expect(rows.length, 'the measures route no longer publishes the table of routes').toBeGreaterThan(
    0,
  );
  return rows.map((row) => `${row[1]} ${row[2]}`).sort();
}

/**
 * The mutating routes the code registers, and whether each writes an audit
 * entry in its own handler.
 *
 * The handlers are read from the source, because the claim is about the
 * source: "twelve of the thirty-five mutating routes write no audit entry at
 * all" is a statement about what the handlers do, and a client can only be
 * told the truth about it from the handlers.
 */
function codeMutatingRoutes(): { route: string; audited: boolean }[] {
  const dir = path.join(repoRoot, 'apps', 'server', 'src', 'api');
  const found: { route: string; audited: boolean }[] = [];

  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const matches = [...text.matchAll(/\bapp\.(post|patch|put|delete)\(\s*'([^']+)'/g)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]!;
      const end = index + 1 < matches.length ? matches[index + 1]!.index : text.length;
      const handler = text.slice(match.index, end);
      found.push({
        route: `${match[1]!.toUpperCase()} ${match[2]!}`,
        audited: /\baudit\(/.test(handler),
      });
    }
  }
  return found;
}

describe('the two published shapes', () => {
  it('publishes the template record over the kinds the code has', () => {
    // The owner settled that all six kinds get a template in the first set.
    // The entry publishes the six, and the code's kind enum is the six.
    expect(publishedTemplateKinds()).toEqual(resourceTypeSchema.options);
  });

  it('names the routes that write no audit entry, and the code writes none on exactly those', () => {
    const routes = codeMutatingRoutes();

    // Two of the mutating routes write their audit entry from the service
    // layer rather than the route; the entry names them.
    const fromTheServiceLayer = new Set([
      'POST /api/approvals/:id/decide',
      'POST /api/agui/runs/:runId/resume',
      'PATCH /api/tasks/:id',
    ]);
    const unaudited = routes
      .filter((entry) => !entry.audited && !fromTheServiceLayer.has(entry.route))
      .map((entry) => entry.route)
      .sort();

    expect(publishedUnauditedRoutes()).toEqual(unaudited);
  });

  it('publishes the counts of routes and audit entries the code has', () => {
    const section = contractsSection('### The measures route');
    const routes = codeMutatingRoutes();

    const total = section.match(/Of the\s+(\d+)\s+mutating routes/);
    const atRouteLevel = section.match(/(\d+)\s+write an audit entry at the\s+route level/);
    expect(total, 'the measures route no longer publishes the number of mutating routes').not.toBe(
      null,
    );
    expect(
      atRouteLevel,
      'the measures route no longer publishes the number of routes that audit',
    ).not.toBe(null);

    expect(routes.length).toBe(Number(total![1]));
    expect(routes.filter((entry) => entry.audited).length).toBe(Number(atRouteLevel![1]));
  });
});
