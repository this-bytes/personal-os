# 14. The contract's schemas stay on zod's v3 API

**Status:** accepted

## Context

On 2026-10-23 npm widened the advisory GHSA-mrhx-c7xc-m3w5 to `zod < 4.6.6`.
The advisory is "Zod can exhaust memory while validating oversized constrained
collections". Upstream fixed it in zod 4.6.6 with `fix(v4): check array, set and
map size bounds before parsing elements` — the guard is installed on the v4
array, set and map types, and it caps the input before the elements are parsed.

The range is a package version range, so it names every zod 3.x release as well,
even though the 3.x line is a different code path. The repository pinned
`zod@3.25.76` and imported the API from the package's main export, which in a
3.x release is the v3 API. The `Dependency audit` job in CI failed on every
branch, `main` included, and `main`'s branch protection requires that job.

Two ways out were available: keep a version npm calls vulnerable and allowlist
the advisory, or install a version whose vulnerable code is fixed.

## Decision

The repository installs `zod@4.6.7` and imports the v3 API from the `zod/v3`
subpath. Every import of zod in this repository is `from 'zod/v3'`.

zod 4.x still ships the v3 API under that subpath, so the schemas are the same
v3 schemas they were. The v3 type declarations differ between 3.25.76 and 4.6.7
in two places — a `private` field became visible, and the keys of the
`ZodIssueCode` constant changed order — and neither changes the type of any
shape the contracts publish. The v3 runtime differences are upstream's own v3
patches: prototype-pollution guards in `ZodError` and `mergeValues`, and a
null-prototype `flatten()`.

The package's main export is zod v4 and is not used here. A v4 schema has no
`.flatten()`, which is what `parseBody` and `parseQuery` call when a payload
does not validate, so an import that is not `zod/v3` fails at runtime rather
than at compile time.

The advisory's precondition is a constrained collection — an array, set or map
with a declared size bound. No schema in this repository declares a size bound
on a collection: every `.min()` and `.max()` is on a string or a number, and the
one array in the contracts (`adapter-presets.ts`'s `requires`) bounds its
elements rather than its length.

The two APIs differ in what they do with such a bound. The v3 API compares the
input's length with the declared one before it parses the elements and reports
an over-long collection as an issue, but it parses the elements anyway. The v4
API had no such comparison, which is what upstream fixed: since 4.6.6 it caps
the input and stops before the elements are touched.

## Consequences

- The audit job passes for the right reason: the tree holds a zod whose v4
  code carries the upstream fix, and the v3 API this repository uses is
  unchanged.
- The published contract does not change. The schemas are the same schemas.
- Every future import of zod must be `from 'zod/v3'`. A v4 schema passed to
  `parseBody` or `parseQuery` is a type error the typechecker finds; a v4
  schema used on its own is not, which is why the rule is written down here.
- `packages/agent-adapters` declares zod and does not import it. The
  declaration stays until the dependency slice that
  `docs/engineering-review-2026-10-23.md` names removes it.
