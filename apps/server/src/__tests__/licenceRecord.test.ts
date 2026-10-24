/**
 * The licence record's four corrected sentences.
 *
 * WI-106 turned four sentences true, and nothing held them there. Measured on
 * the published tip, `git grep -ln 'dependency-licences'` over the test trees
 * returned nothing — no test file in the repository read the record at all. So
 * the sentences could drift back and the tree would stay green, and the one
 * the acceptance depended on would drift back unnoticed.
 *
 * This file holds them. It reads the record, PRODUCT.md and the lockfile as
 * they are, and it holds the four sentences, the counts that go with them, and
 * the shape of the entries they describe.
 *
 * **A check that only ever passes is not a check.** The tests below point the
 * check at copies of the record whose sentences have drifted back, and hold it
 * to catching each drift by name.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The opening the evidence sentence has to carry. */
const EVIDENCE_OPENS =
  'Each third-party entry records the file its licence was read from and the evidence that reading rests on';

/** The phrase that was false of 119 entries, and may not come back. */
const EVERY_ENTRY = /every entry/i;

/** The loose sentence that was false of 119 entries, and may not come back. */
const LOOSE = 'the lines of that file that identify the licence';

/** The counts the record holds. */
const COUNTS = {
  entries: 531,
  thirdParty: 525,
  firstParty: 6,
  licenceFile: 386,
  packageJsonField: 17,
  publishedIdentifier: 122,
  distinctLicences: 11,
  lockfileNonRoot: 537,
  lockfileInstalled: 531,
};

/**
 * How many checks the check below runs.
 *
 * The count is asserted by the test, so a check that quietly stops running
 * fails the suite instead of passing it.
 */
export const CHECK_COUNT = 24;

/** Where an entry's licence was read from. */
interface Source {
  kind?: string;
  file?: string;
  evidence?: string;
  readOn?: string;
}

/** One entry of the record. */
interface Entry {
  lockPath?: string;
  name?: string;
  version?: string;
  spdxId?: string | null;
  source?: Source | null;
  readOn?: string;
  firstParty?: Record<string, unknown>;
}

/** One entry whose licence was read, and what it was read from. */
type ThirdParty = Entry & { source: Source };

/** The record as it is read. */
interface LicenceRecord {
  reads?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  agpl?: Record<string, unknown>;
  packages?: Entry[];
}

/** A check that failed. */
export interface Finding {
  /** Which check failed. */
  id: string;
  /** Why it failed. */
  because: string;
}

/** What the check ran, and what it found. */
export interface CheckResult {
  /** Every check that ran, whether it failed or not. */
  ran: string[];
  /** The checks that failed. */
  findings: Finding[];
}

/**
 * Everything the record has to hold.
 *
 * The check is a pure function of the three files it reads, so a copy of the
 * tree with a drifted record can be put in front of it and held to failing.
 */
export function checkRecord(
  recordText: string,
  productText: string,
  lockfileText: string,
): CheckResult {
  const checks: { id: string; holds: boolean; because: string }[] = [];
  const check = (id: string, holds: boolean, because: string): void => {
    checks.push({ id, holds, because });
  };
  const result = (): CheckResult => ({
    ran: checks.map((entry) => entry.id),
    findings: checks
      .filter((entry) => !entry.holds)
      .map((entry) => ({ id: entry.id, because: entry.because })),
  });

  let record: LicenceRecord;
  try {
    record = JSON.parse(recordText) as LicenceRecord;
  } catch {
    check('the record parses', false, 'docs/dependency-licences.json is not JSON');
    return result();
  }
  check('the record parses', true, '');

  const reads = record.reads ?? {};
  const evidence = typeof reads.evidence === 'string' ? reads.evidence : '';
  const entries = Array.isArray(record.packages) ? record.packages : [];
  const thirdParty = entries.filter(
    (entry): entry is ThirdParty => typeof entry.source === 'object' && entry.source !== null,
  );
  const firstParty = entries.filter(
    (entry) => typeof entry.firstParty === 'object' && entry.firstParty !== null,
  );
  const noSource = entries.filter((entry) => entry.source === null);

  // One — the evidence sentence, and the phrase that was false of 119 entries.
  check(
    'reads.evidence opens with the sentence the acceptance turned true',
    evidence.startsWith(EVIDENCE_OPENS),
    `reads.evidence opens with "${evidence.slice(0, 60)}"`,
  );
  check(
    'the record says "every entry" nowhere',
    !EVERY_ENTRY.test(recordText),
    'the record still says "every entry"',
  );
  check(
    'reads.evidence names the three shapes with their counts',
    evidence.includes(`${COUNTS.licenceFile} entries carry the first identifying lines`) &&
      evidence.includes(`${COUNTS.packageJsonField} the \`license\` field`) &&
      evidence.includes(`${COUNTS.publishedIdentifier} the identifier the project publishes`),
    'reads.evidence disagrees with the audited evidence counts',
  );
  check(
    'reads.evidence names the six first-party workspaces as carrying no source',
    /The six first-party workspaces are this repository[’']s own packages and carry no source\./.test(
      evidence,
    ),
    'reads.evidence no longer names the six workspaces as carrying no source',
  );
  // The coverage sentence says how many packages the record covers. It went
  // stale when packages were added without it, so it is read here rather than
  // trusted: a record that says it covers 495 packages while holding 530 is
  // a record that cannot be relied on to say what it covers.
  const coverage = typeof reads.coverage === 'string' ? reads.coverage : '';
  check(
    'reads.coverage names the number of packages the record holds',
    coverage.includes(`one entry for each of ${COUNTS.entries} packages`) &&
      coverage.includes(`the ${COUNTS.thirdParty} third-party packages`),
    `reads.coverage reads ${coverage.slice(0, 80)}`,
  );

  // Two — what PRODUCT.md says about the record.
  check(
    'PRODUCT.md says one entry for every package in the lockfile',
    productText.includes('one entry for every package in the lockfile'),
    'PRODUCT.md no longer says "one entry for every package in the lockfile"',
  );
  check(
    'PRODUCT.md says the evidence that identifies it',
    productText.includes('the evidence that identifies it'),
    'PRODUCT.md no longer says "the evidence that identifies it"',
  );
  check(
    'PRODUCT.md does not carry the loose sentence',
    !productText.includes(LOOSE),
    'PRODUCT.md carries "the lines of that file that identify the licence" again',
  );
  check(
    'the record does not carry the loose sentence',
    !recordText.includes(LOOSE),
    'the record carries "the lines of that file that identify the licence" again',
  );

  // Three — what each entry carries.
  check(
    'every third-party entry carries a file, an evidence and a date',
    thirdParty.length === COUNTS.thirdParty &&
      thirdParty.every(
        (entry) =>
          typeof entry.source.file === 'string' &&
          entry.source.file.length > 0 &&
          typeof entry.source.evidence === 'string' &&
          entry.source.evidence.length > 0 &&
          typeof entry.source.readOn === 'string' &&
          entry.source.readOn.length > 0,
      ),
    'a third-party entry does not carry source.file, source.evidence and source.readOn',
  );
  check(
    'every third-party entry carries evidence that identifies it',
    thirdParty.every(
      (entry) => typeof entry.source.evidence === 'string' && entry.source.evidence.length > 0,
    ),
    'a third-party entry carries no evidence',
  );
  check(
    'every entry carries a top-level readOn',
    entries.every((entry) => typeof entry.readOn === 'string' && entry.readOn.length > 0),
    'an entry carries no top-level readOn',
  );
  check(
    'the six entries that carry no source are the first-party workspaces',
    noSource.length === COUNTS.firstParty &&
      firstParty.length === COUNTS.firstParty &&
      noSource.every(
        (entry) => typeof entry.firstParty === 'object' && entry.firstParty !== null,
      ) &&
      firstParty.every((entry) => entry.spdxId === null),
    'the entries that carry no source are not the first-party workspaces, or one of them carries a licence',
  );

  // Four — the three shapes, and the counts that go with them.
  const kinds = new Map<string, number>();
  for (const entry of thirdParty) {
    const kind = typeof entry.source.kind === 'string' ? entry.source.kind : '(none)';
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  check(
    'the three evidence shapes keep their counts',
    kinds.get('licence-file') === COUNTS.licenceFile &&
      kinds.get('package-json-licence-field') === COUNTS.packageJsonField &&
      kinds.get('published-licence-identifier') === COUNTS.publishedIdentifier,
    `the shapes read ${JSON.stringify(Object.fromEntries(kinds))}`,
  );

  const summary = record.summary ?? {};
  check(
    'the summary counts agree with the entries',
    summary.readFromLicenceFile === COUNTS.licenceFile &&
      summary.readFromPackageJsonField === COUNTS.packageJsonField &&
      summary.readFromPublishedIdentifier === COUNTS.publishedIdentifier &&
      summary.firstPartyWorkspaces === COUNTS.firstParty &&
      summary.lockfilePackageEntries === COUNTS.lockfileNonRoot &&
      summary.distinctLicences === COUNTS.distinctLicences,
    `the summary reads ${JSON.stringify(summary)}`,
  );
  check(
    'the record holds the audited number of entries',
    entries.length === COUNTS.entries,
    `the record holds ${entries.length} entries`,
  );
  const licences = new Set(
    entries
      .map((entry) => entry.spdxId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  check(
    'the record holds 11 distinct licences',
    licences.size === COUNTS.distinctLicences,
    `the record holds ${licences.size} distinct licences`,
  );

  const families = Array.isArray(record.agpl?.familiesRead)
    ? (record.agpl.familiesRead as { spdxId?: string; count?: number }[])
    : [];
  const familyTotal = families.reduce(
    (total, row) => total + (typeof row.count === 'number' ? row.count : 0),
    0,
  );
  check(
    'familiesRead holds the audited licence totals',
    families.length === COUNTS.distinctLicences && familyTotal === COUNTS.thirdParty,
    `familiesRead holds ${families.length} rows summing to ${familyTotal}`,
  );

  // And the record against the lockfile it says it covers.
  type LockPackage = { version?: string; license?: string; link?: boolean; resolved?: string };
  let lockPackages: Record<string, LockPackage> = {};
  try {
    const lock = JSON.parse(lockfileText) as { packages?: Record<string, LockPackage> };
    lockPackages = lock.packages ?? {};
  } catch {
    check('package-lock.json parses', false, 'package-lock.json is not JSON');
    return result();
  }
  check('package-lock.json parses', true, '');

  const lockKeys = Object.keys(lockPackages);
  const nonRoot = lockKeys.filter((key) => key !== '');
  const installed = nonRoot.filter((key) => key.startsWith('node_modules/'));
  check(
    'the lockfile holds the audited package totals',
    nonRoot.length === COUNTS.lockfileNonRoot && installed.length === COUNTS.lockfileInstalled,
    `the lockfile holds ${nonRoot.length} non-root entries, ${installed.length} installed`,
  );
  const recordPaths = new Set(
    entries
      .map((entry) => entry.lockPath)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const missing = installed.filter((lockPath) => !recordPaths.has(lockPath));
  const extra = [...recordPaths].filter((lockPath) => !installed.includes(lockPath));
  check(
    'the record covers exactly the installed packages of the lockfile',
    recordPaths.size === COUNTS.lockfileInstalled && missing.length === 0 && extra.length === 0,
    `${missing.length} of the lockfile's packages are missing from the record and ${extra.length} are in the record but not the lockfile`,
  );

  const lockedEntry = (entry: Entry): LockPackage | undefined => {
    const locked = lockPackages[entry.lockPath ?? ''];
    return locked?.link ? lockPackages[locked.resolved ?? ''] : locked;
  };
  check(
    'recorded package versions match the lockfile',
    entries.every((entry) => !!entry.version && entry.version === lockedEntry(entry)?.version),
    'licence evidence must be reviewed when a package version changes, even at the same path',
  );
  // Compare whole expressions, never reinterpret AND/OR/WITH as a flat list.
  check(
    'recorded third-party licence declarations match the lockfile',
    thirdParty.every((entry) => !!entry.spdxId && entry.spdxId === lockedEntry(entry)?.license),
    'a lockfile licence declaration changed without updated evidence',
  );

  return result();
}

/** A file of this repository, as text. */
function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

/** The three files the check reads. */
function files(): { record: string; product: string; lockfile: string } {
  return {
    record: read('docs/dependency-licences.json'),
    product: read('PRODUCT.md'),
    lockfile: read('package-lock.json'),
  };
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
      // not a failure of the check: the assertions above have already run.
    }
  }
});

describe('the licence record', () => {
  it.each(['licence-file', 'package-json-licence-field', 'published-licence-identifier'])(
    'rejects a same-path version change for %s evidence',
    (kind) => {
      const source = files();
      const record = JSON.parse(source.record) as LicenceRecord;
      const entry = record.packages!.find((candidate) => candidate.source?.kind === kind)!;
      entry.version = '999.0.0';
      expect(
        checkRecord(JSON.stringify(record), source.product, source.lockfile).findings,
      ).toContainEqual(
        expect.objectContaining({ id: 'recorded package versions match the lockfile' }),
      );
    },
  );

  it('rejects changed licence expressions without flattening their meaning', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    const entry = record.packages!.find((candidate) => candidate.source !== null)!;
    entry.spdxId = `${entry.spdxId} OR AGPL-3.0-only`;
    expect(
      checkRecord(JSON.stringify(record), source.product, source.lockfile).findings,
    ).toContainEqual(
      expect.objectContaining({
        id: 'recorded third-party licence declarations match the lockfile',
      }),
    );
  });

  it('holds the four sentences WI-106 turned true', () => {
    const source = files();
    const result = checkRecord(source.record, source.product, source.lockfile);

    expect(result.findings.map((finding) => `${finding.id}: ${finding.because}`)).toEqual([]);
    // Every check ran. A check that quietly stopped running fails the suite
    // rather than passing it.
    expect(result.ran.length).toBe(CHECK_COUNT);
    expect(new Set(result.ran).size).toBe(CHECK_COUNT);
  });

  it('catches the evidence sentence drifting back to "every entry"', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    record.reads!.evidence =
      'Every entry carries the file it was read from and the first identifying lines of that file.';

    const result = checkRecord(JSON.stringify(record), source.product, source.lockfile);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('reads.evidence opens with the sentence the acceptance turned true');
    expect(ids).toContain('the record says "every entry" nowhere');
  });

  it('catches the loose sentence coming back to PRODUCT.md', () => {
    const source = files();

    const result = checkRecord(
      source.record,
      `${source.product}\n\nThe record holds the lines of that file that identify the licence.\n`,
      source.lockfile,
    );

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('PRODUCT.md does not carry the loose sentence');
  });

  it('catches an entry that stops carrying its evidence', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    const entry = record.packages!.find(
      (candidate) => typeof candidate.source === 'object' && candidate.source !== null,
    )!;
    (entry.source as Source).evidence = '';

    const result = checkRecord(JSON.stringify(record), source.product, source.lockfile);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('every third-party entry carries a file, an evidence and a date');
    expect(ids).toContain('every third-party entry carries evidence that identifies it');
  });

  it('catches a count that drifts', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    record.packages = record.packages!.slice(1);

    const result = checkRecord(JSON.stringify(record), source.product, source.lockfile);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('the record holds the audited number of entries');
    expect(ids).toContain('the record covers exactly the installed packages of the lockfile');
  });

  it('catches a shape that loses its count', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    const entry = record.packages!.find((candidate) => candidate.source?.kind === 'licence-file')!;
    (entry.source as Source).kind = 'published-licence-identifier';

    const result = checkRecord(JSON.stringify(record), source.product, source.lockfile);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('the three evidence shapes keep their counts');
  });

  it('catches the coverage sentence drifting away from the record', () => {
    const source = files();
    const record = JSON.parse(source.record) as LicenceRecord;
    record.reads!.coverage =
      'This record has one entry for each of 495 packages: the 489 third-party packages in the lockfile, whether or not they are installed here, and this repository’s own six workspaces.';

    const result = checkRecord(JSON.stringify(record), source.product, source.lockfile);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain('reads.coverage names the number of packages the record holds');
  });

  it('writes nothing into the repository', () => {
    // The scratch directory is only used by the drifts above; nothing here
    // writes into the repository, and the record the check reads is the one
    // the tree holds.
    const dir = scratch('licence-record-');
    expect(fs.existsSync(path.join(repoRoot, 'docs/dependency-licences.json'))).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
