/**
 * The front page's identity sentence is held.
 *
 * WI-120 chose the sentence this product is named by and wrote it down in two
 * places: `README.md`'s third line, under the title, and `package.json`'s
 * `description`, which is what the package says it is. Nothing in this
 * repository reads either of them — no gate, no test, no script — so a later
 * commit can change the front page and the manifest and nothing notices. The
 * sentence is the product's name for itself, and it is held by nothing.
 *
 * So this file holds it in both places, and holds the two places to each
 * other. They are two renderings of one sentence: the README states it as a
 * whole line, in bold, with the sentence's first letter capitalised; the
 * manifest states it as the tail of a description that names the package
 * first, after an em dash, with the sentence in lower case because it is not
 * the first word there. That one letter is the only difference between the two
 * renderings, and the comparison forgives exactly that and nothing else.
 *
 * It holds itself to failing. The drifted copies below are the proof, and
 * they are copies: the repository is read and never written. A README whose
 * third line has drifted is caught by the name of the README; a manifest
 * whose description has drifted is caught by the name of the manifest; the
 * two that no longer agree are caught by the name of the disagreement. Each
 * drift leaves the finding that names the other place green, so a red suite
 * says which of the two moved.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * The sentence the product is named by, in the form the README states it.
 *
 * This is a product decision and not a derived value: the two places the
 * sentence is written down are the two places it can drift, and the whole
 * point of this file is that neither of them can drift.
 */
const README_LINE = "**The environment one person's agents operate and extend.**";

/**
 * The same sentence, in the form the manifest states it.
 *
 * The manifest names the package and then states the sentence, separated by an
 * em dash.
 */
const DESCRIPTION = "Personal OS — the environment one person's agents operate and extend.";

/**
 * The names the three things are caught by.
 *
 * A drift is reported under the name of the thing that drifted, so a red suite
 * says which of the three moved rather than that one of three moved.
 */
export const NAMES = {
  /** The README's third line. */
  readme: "README.md's third line",
  /** The manifest's description. */
  manifest: "package.json's description",
  /** The two places, carrying different sentences. */
  agree: 'the front page and the manifest no longer agree',
} as const;

/** One thing the check holds, and whether it holds. */
export interface Finding {
  /** The name this finding is caught by. */
  name: string;
  /** Whether the thing it names holds. */
  holds: boolean;
  /** What the tree carries. */
  found: string;
  /** What it has to carry. */
  expected: string;
}

/** What a tree's front page carries, and what it holds. */
export interface FrontPage {
  /** The README's third line. */
  readmeLine: string;
  /** The sentence the README's third line carries. */
  readmeSentence: string;
  /** The manifest's description. */
  description: string;
  /** The sentence the manifest's description carries. */
  manifestSentence: string;
  /** The three findings, in the order they are named. */
  findings: Finding[];
}

/**
 * The lines of a text.
 *
 * The line terminator is not part of the line. The repository checks out with
 * LF everywhere, but a copy made elsewhere may not, and a line ending is not
 * a change to what the line says.
 */
function linesOf(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * The sentence a line of the front page carries.
 *
 * The README's third line states the sentence in bold, and the wrapper is not
 * part of the sentence. A line that is not wrapped in bold carries no wrapper
 * to take off, and the line is what it says.
 */
function sentenceOfLine(line: string): string {
  const bold = /^\*\*(.+)\*\*$/.exec(line.trim());
  const inner = bold?.[1];
  return (inner ?? line).trim();
}

/**
 * The sentence the manifest's description carries.
 *
 * The description names the package and then states the sentence, separated by
 * an em dash. The name is not part of the sentence.
 */
function sentenceOfDescription(description: string): string {
  return description.replace(/^Personal OS\s*—\s*/, '').trim();
}

/**
 * Two renderings of one sentence.
 *
 * The README's rendering begins with a capital, because it is a sentence; the
 * manifest's does not, because the sentence follows the em dash and is not the
 * first word of the description. That one letter is the only difference the
 * two renderings are allowed to have, so it is the only difference the
 * comparison forgives.
 */
function sameSentence(one: string, other: string): boolean {
  const fold = (text: string): string => (text ? text[0]!.toLowerCase() + text.slice(1) : text);
  return fold(one) === fold(other);
}

/**
 * The front page of a tree, and what it holds.
 *
 * The tree is named rather than assumed, so the same check runs against the
 * repository and against a copy of it with something drifted.
 */
export function checkFrontPage(root: string): FrontPage {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    description?: string;
  };

  const readmeLine = linesOf(readme)[2] ?? '';
  const description = typeof manifest.description === 'string' ? manifest.description : '';
  const readmeSentence = sentenceOfLine(readmeLine);
  const manifestSentence = sentenceOfDescription(description);

  const findings: Finding[] = [
    {
      name: NAMES.readme,
      holds: readmeLine === README_LINE,
      found: readmeLine,
      expected: README_LINE,
    },
    {
      name: NAMES.manifest,
      holds: description === DESCRIPTION,
      found: description,
      expected: DESCRIPTION,
    },
    {
      name: NAMES.agree,
      holds: sameSentence(readmeSentence, manifestSentence),
      found: `README.md carries "${readmeSentence}" and the manifest carries "${manifestSentence}"`,
      expected: 'the same sentence in both',
    },
  ];

  return { readmeLine, readmeSentence, description, manifestSentence, findings };
}

/** The finding of a name. */
function findingOf(page: FrontPage, name: string): Finding | undefined {
  return page.findings.find((finding) => finding.name === name);
}

/** A directory of its own, so that nothing here writes into the repository. */
const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // A directory that could not be removed is a fact about the machine and
      // not a failure of the pin: the assertions above have already run.
    }
  }
});

/**
 * The README as it is meant to be: the real file, with its third line set to
 * the sentence it is meant to carry.
 *
 * The drifted copies below start from this, not from the tree as it is. A copy
 * that started from a drifted tree would carry two drifts instead of one, and
 * a test that fails for two reasons at once is a test that cannot be read. The
 * tree as it is is watched by the tests above, which read the real files.
 */
function baselineReadme(): string[] {
  const readme = linesOf(fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8'));
  readme[2] = README_LINE;
  return readme;
}

/**
 * The manifest as it is meant to be: the real file, with its description set
 * to the sentence it is meant to carry.
 */
function baselineManifest(): Record<string, unknown> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  manifest.description = DESCRIPTION;
  return manifest;
}

/**
 * A copy of the repository's front page, as it is meant to be.
 *
 * The starting point of every drift below: the real files, with the two
 * places under test carrying the sentence they are meant to carry.
 */
function copyBaseline(): string {
  const root = scratch('front-page-baseline-');
  fs.writeFileSync(path.join(root, 'README.md'), baselineReadme().join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify(baselineManifest(), null, 2)}\n`,
    'utf8',
  );
  return root;
}

/**
 * A copy of the repository's front page, with the README's third line changed.
 *
 * The manifest is copied as it is meant to be, so that the only thing that
 * moved is the line under test.
 */
function copyWithReadmeThirdLine(line: string): string {
  const root = scratch('front-page-readme-');
  const readme = baselineReadme();
  readme[2] = line;
  fs.writeFileSync(path.join(root, 'README.md'), readme.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify(baselineManifest(), null, 2)}\n`,
    'utf8',
  );
  return root;
}

/**
 * A copy of the repository's front page, with the manifest's description
 * changed.
 *
 * The README is copied as it is meant to be, so that the only thing that moved
 * is the description under test.
 */
function copyWithDescription(description: string): string {
  const root = scratch('front-page-manifest-');
  fs.writeFileSync(path.join(root, 'README.md'), baselineReadme().join('\n'), 'utf8');
  const manifest = baselineManifest();
  manifest.description = description;
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return root;
}

/**
 * A copy of the repository's front page, with both places changed.
 *
 * Each to a different sentence, so that the two no longer carry the same one.
 */
function copyWithFrontPage(readmeLine: string, description: string): string {
  const root = scratch('front-page-both-');
  const readme = baselineReadme();
  readme[2] = readmeLine;
  fs.writeFileSync(path.join(root, 'README.md'), readme.join('\n'), 'utf8');
  const manifest = baselineManifest();
  manifest.description = description;
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return root;
}

describe('the front page', () => {
  it("holds README.md's third line to the identity sentence", () => {
    const page = checkFrontPage(repoRoot);
    const finding = findingOf(page, NAMES.readme);

    expect(
      finding?.holds,
      `${NAMES.readme} is "${finding?.found ?? 'nothing'}" and not "${README_LINE}"`,
    ).toBe(true);
  });

  it("holds package.json's description to the identity sentence", () => {
    const page = checkFrontPage(repoRoot);
    const finding = findingOf(page, NAMES.manifest);

    expect(
      finding?.holds,
      `${NAMES.manifest} is "${finding?.found ?? 'nothing'}" and not "${DESCRIPTION}"`,
    ).toBe(true);
  });

  it('holds the front page and the manifest to the same sentence', () => {
    const page = checkFrontPage(repoRoot);
    const finding = findingOf(page, NAMES.agree);

    expect(finding?.holds, `${NAMES.agree}: ${finding?.found ?? 'nothing'}`).toBe(true);
  });

  it('names all three, so a check that stops running is a failure', () => {
    const page = checkFrontPage(repoRoot);

    expect(page.findings.map((finding) => finding.name)).toEqual([
      NAMES.readme,
      NAMES.manifest,
      NAMES.agree,
    ]);
    expect(page.findings.filter((finding) => !finding.holds)).toEqual([]);
  });
});

describe('the front page, drifted', () => {
  it('copies the front page as it is meant to be, and that copy is green', () => {
    // The starting point of every drift below. It is green, so that a red
    // copy afterwards is the drift and nothing else.
    const page = checkFrontPage(copyBaseline());

    expect(page.findings.filter((finding) => !finding.holds)).toEqual([]);
  });

  it('catches a README whose third line has drifted', () => {
    // The README now says a different sentence. The manifest is as it is meant
    // to be, so the finding that names the manifest stays green and the fault
    // is attributed to the README.
    const root = copyWithReadmeThirdLine("**The control panel where one person's agents work.**");
    const page = checkFrontPage(root);

    expect(findingOf(page, NAMES.readme)?.holds).toBe(false);
    expect(findingOf(page, NAMES.manifest)?.holds).toBe(true);
    // The two now carry different sentences, and that is said by name too.
    expect(findingOf(page, NAMES.agree)?.holds).toBe(false);
  });

  it('catches a manifest whose description has drifted', () => {
    // The manifest now says a different sentence. The README is as it is meant
    // to be, so the finding that names the README stays green and the fault
    // is attributed to the manifest.
    const root = copyWithDescription(
      'Personal OS — the factory where agents build what is needed.',
    );
    const page = checkFrontPage(root);

    expect(findingOf(page, NAMES.manifest)?.holds).toBe(false);
    expect(findingOf(page, NAMES.readme)?.holds).toBe(true);
    expect(findingOf(page, NAMES.agree)?.holds).toBe(false);
  });

  it('catches the front page and the manifest that no longer agree', () => {
    // Both have moved, each to a different sentence, so neither is the
    // sentence the other is carrying. The disagreement is caught by its own
    // name, and the finding says which sentence each side carries.
    const root = copyWithFrontPage(
      "**The environment one person's agents operate and extend, and grow.**",
      'Personal OS — a personal software factory.',
    );
    const page = checkFrontPage(root);
    const disagreement = findingOf(page, NAMES.agree);

    expect(disagreement?.holds).toBe(false);
    expect(findingOf(page, NAMES.readme)?.holds).toBe(false);
    expect(findingOf(page, NAMES.manifest)?.holds).toBe(false);
    expect(page.readmeSentence).not.toBe(page.manifestSentence);
    expect(disagreement?.found).toContain(page.readmeSentence);
    expect(disagreement?.found).toContain(page.manifestSentence);
  });

  it('catches a README that keeps the sentence but loses its form', () => {
    // The bold has gone and the sentence is the one it was. The README is
    // caught by name, and the two places still carry the same sentence, so
    // the disagreement stays green: the three findings are not the same check
    // three times over.
    const root = copyWithReadmeThirdLine("The environment one person's agents operate and extend.");
    const page = checkFrontPage(root);

    expect(findingOf(page, NAMES.readme)?.holds).toBe(false);
    expect(findingOf(page, NAMES.agree)?.holds).toBe(true);
    expect(findingOf(page, NAMES.manifest)?.holds).toBe(true);
  });
});
