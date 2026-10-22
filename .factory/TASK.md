# Development work item

Use one item for one verifiable outcome in the active roadmap. This is an
out-of-band development record, not an in-product task or runtime dispatch.

```markdown
# WI-nnn — User outcome

**Owner:** one implementing agent/session
**Verifier:** independent reviewer
**State:** implement
**Branch:** wi/nnn-slug
**Base:** commit SHA

## Problem

Observable trigger, current behavior and expected user outcome.
Link the relevant roadmap stage and published contracts.

## Scope and compatibility

Owned paths, module boundaries, old/new contract behavior, data migration plan.
The implementer owns code, tests and documentation for the slice.

## Acceptance criteria

- [ ] The user outcome is demonstrated through the actual application path.
- [ ] Relevant failure/recovery cases are covered.
- [ ] Applicable gates pass on the delivered revision.
- [ ] Independent review findings are resolved.

## Not in scope

Explicit exclusions that keep this slice bounded.

## Evidence

Revision, actual commands/results, runtime versions, inspectable output,
limitations and reviewer verdict. Never substitute dispatch for execution.
```

Use intake → triage → implement → verify → review → accepted to describe progress.
Cancelled and superseded items retain their identifiers and reasons. A state label
is a report, not proof of running work. Accepted means the applicable gates and
independent review are complete under FACTORY.md and AGENTS.md's landing rules.
Product task acceptance remains the owner's separate decision.
