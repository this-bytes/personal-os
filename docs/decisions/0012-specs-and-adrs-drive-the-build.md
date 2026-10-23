# 12. The build is driven by specs and ADRs, not by process records

**Status:** accepted — owner direction, 2026-10-23.

## Context

The out-of-band development workflow produced a second product: work-item
files, intake ledgers, allocation notes and review records. On the day this
decision was taken, 1,130 commits had landed since 2026-10-20 and 46 of the
most recent 100 changed nothing but Markdown and factory records. The owner's
measurement of the result: _the repo is shit and nowhere near ready to use in
place of Paperclip_ — features half-implemented, functionality not exposed,
and the coordination layer outrunning the thing it coordinates.

The owner also decided the end state: development coordination belongs
**inside the product** — Personal OS runs its own factory the way it runs its
own conversations and resources. An out-of-band ceremony that mirrors the
product's factory feature is scaffolding we tear down, not an interface we
maintain. Its highest-value lifetime use is as test data for the real one.

## Decision

The unit of work is a **spec**, and only two document kinds are first-class:

1. **Specs** (`docs/spec/`) — a bounded user-visible outcome, the contract
   change it makes, the evidence that proves it works on a real path, and what
   is explicitly not in it. Specs are the work queue; nobody opens a work item
   that a spec does not carry.
2. **ADRs** (`docs/decisions/`) — the few decisions that are hard to reverse.
   One decision per file; accepted decisions are superseded by a new ADR,
   never edited into agreement.

Everything already in `.factory/` becomes **read-only history**. No new work
items, no intake ledger, no allocation bookkeeping. Review and acceptance
happen in the PR (contract diff, evidence block, verdict), and the durable
project record is Paperclip AAR-717 until the product's own factory replaces
it.

## Consequences

- Coordination prose can only land attached to the spec or implementation it
  serves. A pull request that adds process files without product change is
  refused on review by definition, not by argument.
- The feature-completeness audit (`docs/spec/p0-feature-audit.md`) replaces the
  item ledger as the answer to "where do we actually stand".
- When the in-product factory matures, these specs and its own records use the
  same task and acceptance objects, so migration is a query, not a rewrites.
