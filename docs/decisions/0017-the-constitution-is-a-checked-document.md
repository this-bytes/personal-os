# 17. The constitution is a checked document

**Status:** accepted — owner direction, 2026-10-24.

## Context

This repository has said for a long time that _a rule nothing verifies is a
claim_. [ADR 0008](0008-five-domains.md) said it of a domain map, and
[ADR 0012](0012-specs-and-adrs-drive-the-build.md) said it of process records.

The rules that actually governed the work were mostly not checked. Ten of them
were gates — the adapter boundary, the domain map, the published shapes, the
contract's pointers, the agent surface, the revision guard, the credential
guard, the acceptance boundary. Nine were prose: kept alive by discipline, by
review, and by whoever happened to remember them. Discipline is exactly what a
parallel agent working alone in a worktree at two in the morning does not have,
and it is the reason two of those nine had quietly drifted — the tree's zod
imports and its provider names were both correct by luck and by nothing else.

There was also a second problem, and it was the bigger one: the direction of the
product was written down in four places, and none of them said what could not
change. A new agent could read all of it and still not know whether the thing
it was about to build was allowed.

## Decision

**[ARCHITECTURE.md](../../ARCHITECTURE.md) is the constitution, and every
non-negotiable in it names the check that proves it.**

A rule that names a check is enforced by that check. A rule that does not is
marked **prose only**, and the marking is deliberate rather than a euphemism.

`npm run verify:standards` reads the constitution and fails when:

- a rule names a check that does not exist;
- an enforced rule's check is not reachable from CI;
- a rule marked prose only names a check anyway — a rule cannot be quietly
  downgraded by editing its status and leaving the identifier behind;
- a pillar is missing from the roadmap, or a roadmap stage names no pillar;
- a zod import is not from `zod/v3`;
- a server domain module names a provider;
- the worker reaches the server's HTTP surface rather than its database;
- a preset claims a demonstration without naming the runtime it demonstrated.

The gate lives in the CI fast lane, beside `verify:mcp-parity`. **A gate that
only runs on the machine that wrote it is not a gate, it is a habit** — the
lesson ADR 0013 already records about `verify:mcp-parity` being written into the
registry without the workflow that would have run it.

## Consequences

- **The constitution cannot drift into being a claim.** The table is the rule,
  and the gate is what checks the table.
- **The gate is a meta-check plus four real checks.** It does not enforce
  everything, and the rows it cannot enforce say so. Prose rules stay prose
  rules, marked, rather than pretending otherwise.
- **Adding a rule costs a check.** A rule with no check is added as prose only,
  and the author accepts that it will be kept by review.
- **The vocabulary is checked too.** Every canonical term the constitution uses
  is defined in [glossary.md](../../glossary.md), and no term is canonical in one
  entry and avoided in another. A glossary that drifts from the documents it
  names is a second source of truth.
- **The check is cheap on purpose.** It reads files and imports one source
  module; it opens no database and builds nothing, so it can run on every push.
