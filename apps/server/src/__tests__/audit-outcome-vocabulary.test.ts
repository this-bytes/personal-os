import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The audit outcome section and the code agree.
 *
 * WI-034 published `### The audit outcome`: the trail's `result` carries
 * `queued | succeeded | failed | unknown`, every mutating route writes an entry
 * recording what the action produced, and a migration note says what a client
 * written before the change may assume and what a record written before the
 * change means.
 *
 * **This file pins that agreement**, so that a change which breaks it turns a
 * test red instead of leaving the contract quietly untrue:
 *
 *  - the vocabulary the section publishes, read out of the section itself;
 *  - the outcome words the code can produce, read out of the code itself, and
 *    the mapping the migration note publishes between the old words and the
 *    new ones;
 *  - the writers: the section names the places where an outcome is written,
 *    and this file checks that each pointer still lands on the line that
 *    carries the claim;
 *  - the twelve: the section says the twelve routes that wrote no entry are
 *    the twelve the measures route publishes;
 *  - the neighbours: the route table's audit row, the measures route's own
 *    outcome set, and the anchors the section links to.
 *
 * **The section's citations drifted once already, and this file is the reason
 * it was caught rather than shipped.** Three of the pointers in the section
 * no longer landed on the line that carried the claim, and one of them
 * contradicted the measures route's citation of the same line. The contract
 * is Wren's, so this file did not fix it: the correction and this file's own
 * three numbers moved together, and what the file holds now is the agreement
 * itself — the section cites the line that carries the claim, and the line
 * that carries the claim is the line the section cites.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function contractsText(): string {
  return fs.readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8');
}

/** One section of the contract, from its heading to the next heading. */
function contractsSection(heading: string): string {
  const text = contractsText();
  const start = text.indexOf(heading);
  expect(start, `CONTRACTS.md no longer publishes ${heading}`).toBeGreaterThan(-1);
  const rest = text.slice(start + heading.length);
  const next = rest.search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The line a citation points at, read out of the file it names. */
function citedLine(citation: string): string {
  const match = citation.match(/^(.+):(\d+)$/);
  expect(match, `${citation} is not a citation this file can read`).not.toBeNull();
  const file = path.join(repoRoot, match![1]!.replace(/\//g, path.sep));
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  return lines[Number(match![2]) - 1] ?? '';
}

/** Every file under a directory, recursively. */
function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('the audit outcome section', () => {
  it('publishes exactly the four outcomes it claims', () => {
    const section = contractsSection('### The audit outcome');
    const block = section.match(
      /result:\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'/,
    );

    expect(block, 'the audit outcome no longer publishes a four-word vocabulary').not.toBeNull();
    expect(
      [...block!.slice(1)].sort(),
      'the published vocabulary is not the four outcomes the section names',
    ).toEqual(['failed', 'queued', 'succeeded', 'unknown']);
  });

  it('maps every outcome the code can produce onto a published word', () => {
    const section = contractsSection('### The audit outcome');
    const service = fs.readFileSync(
      path.join(repoRoot, 'apps', 'server', 'src', 'modules', 'audit', 'service.ts'),
      'utf8',
    );
    const union = service.match(/result:\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'/);

    expect(union, "the trail's own result union is no longer a three-word set").not.toBeNull();
    const codeWords = union!.slice(1);

    const mapping = [...section.matchAll(/`(\w+)` is `(\w+)`/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]);

    for (const word of codeWords) {
      const published =
        mapping.find(([from]) => from === word)?.[1] ??
        (word === 'unknown' ? 'unknown' : undefined);
      expect(
        published,
        `the section does not say what "${word}" becomes, and the code produces it: an outcome ` +
          'the trail carries and the vocabulary cannot express is not expressible',
      ).toBeDefined();
    }
  });

  it('names the twelve the measures route publishes', () => {
    const section = contractsSection('### The audit outcome');
    const measures = contractsSection('### The measures route');
    const rows = [...measures.matchAll(/^\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`/gm)];

    expect(
      section,
      'the section no longer says the twelve are the ones the measures route publishes',
    ).toContain('[the measures route](#the-measures-route)');
    expect(
      rows.length,
      'the measures route no longer publishes the twelve routes that write no entry',
    ).toBe(12);
  });

  it('does not contradict the neighbours', () => {
    const text = contractsText();

    expect(text, 'the route table no longer points at the audit outcome entry').toContain(
      '[the entry](#the-audit-outcome)',
    );
    expect(
      text,
      'the audit outcome entry no longer exists, so the route table points at nothing',
    ).toContain('### The audit outcome');

    const measures = contractsSection('### The measures route');
    expect(
      measures,
      'the measures route no longer publishes the outcome set the trail carries today',
    ).toContain('`success | failure | unknown`');

    for (const anchor of ['#the-measures-route', '#the-unknown-outcome']) {
      const heading = anchor.slice(1).replace(/-/g, ' ');
      expect(
        text.toLowerCase().includes(heading),
        `the section links to ${anchor}, and no heading answers it`,
      ).toBe(true);
    }
  });
});

describe('the code, as the section describes it', () => {
  it('still points at the lines that carry its claims', () => {
    const section = contractsSection('### The audit outcome');
    const claims: { citation: string; pattern: RegExp; what: string }[] = [
      {
        citation: 'apps/server/src/api/helpers.ts:62',
        pattern: /result:\s*'success'/,
        what: 'the route helper writes success',
      },
      {
        citation: 'apps/worker/src/executor.ts:104',
        pattern: /result:\s*'unknown'/,
        what: 'the worker writes unknown',
      },
      {
        citation: 'apps/server/src/modules/conversations/dispatch.ts:247',
        pattern: /result:\s*'unknown'/,
        what: 'the dispatch writes unknown',
      },
      {
        citation: 'apps/server/src/modules/audit/service.ts:79',
        pattern: /result:\s*input\.result\s*\?\?\s*'success'/,
        what: 'the audit service defaults to success',
      },
      {
        citation: 'apps/server/src/app.ts:190',
        pattern: /setErrorHandler/,
        what: 'the error handler that writes nothing',
      },
      {
        citation: 'apps/server/src/modules/resources/service.ts:525',
        pattern: /queue\.enqueue\(/,
        what: 'the enqueue of an automation run',
      },
    ];

    for (const claim of claims) {
      expect
        .soft(section, `the section no longer cites ${claim.citation}`)
        .toContain(claim.citation);
      const line = citedLine(claim.citation);
      expect
        .soft(line, `${claim.citation} no longer carries ${claim.what}: it reads "${line}"`)
        .toMatch(claim.pattern);
    }
  });

  it('writes no outcome the section says the code does not write yet', () => {
    // The section says the code does not implement the vocabulary yet, and
    // names the words it will write when it does. This is the pin that
    // WI-033's implementation has to break: when the code starts writing
    // them, the section has to say so.
    const written = new Set<string>();
    for (const file of walk(path.join(repoRoot, 'apps'))) {
      if (!file.endsWith('.ts')) continue;
      if (file.includes(`${path.sep}dist${path.sep}`)) continue;
      if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bresult:\s*'([a-z]+)'/g)) {
        written.add(match[1]!);
      }
    }

    for (const word of ['queued', 'succeeded', 'failed']) {
      expect
        .soft(
          written.has(word),
          `the code now writes "${word}", and the section says it does not yet: the section has ` +
            'to be corrected, because it is no longer true of the code',
        )
        .toBe(false);
    }

    const service = fs.readFileSync(
      path.join(repoRoot, 'apps', 'server', 'src', 'modules', 'audit', 'service.ts'),
      'utf8',
    );
    const union = service.match(/result:\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'/);
    expect(union, "the trail's own result union is no longer a three-word set").not.toBeNull();

    for (const word of written) {
      expect
        .soft(
          union!.slice(1),
          `the product writes "${word}", and the trail's own result union does not carry it`,
        )
        .toContain(word);
    }
  });
});
