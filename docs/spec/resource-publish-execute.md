# SPEC-RESOURCE-RUN — Publishing and executing a resource stop claiming they happened

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-P0 (the audit named these two rows) · **Blocks:** SPEC-S2 batch 2

## Outcome

When the owner publishes a resource or executes one, the product says what
actually happened.

Today, for most resource kinds, it says it happened either way: the UI
reports a publish and a run, and the server performs neither. The audit
measured it and named it:

> _Publish a resource_ — broken-window — the UI says it published; for most
> kinds nothing was published.
>
> _Execute a resource_ — broken-window — the UI says it ran; for most kinds it
> did not.

A broken-window is worse than a human-only surface. A human-only surface
admits it is not there; a broken-window tells the owner it worked.

## Why it is its own spec

SPEC-S1 named the rule:

> anything the audit marks broken-window — those become their own named specs,
> not drive-by fixes.

This is the first of them. It is not parity work: the question is not "can an
agent do this" but "does the product tell the truth when the owner does".

## What the fix can be

There are three honest answers, and the slice decides which one applies per
resource kind:

1. **It works, and now it says so.** The operation is implemented for that
   kind, and the response carries the result.
2. **It does not work, and now it says so.** The operation is refused for
   that kind with a reason the owner can read, and the UI shows the refusal.
3. **It is not a capability of that kind, and the contract says so.** The
   route is published only for the kinds that support it.

What is not acceptable is the third path the code takes today: performing
nothing and reporting success.

## Contract

- **The response carries what happened.** A publish that published, an
  execute that ran, and a refusal that refused are three different, visible
  outcomes.
- **The UI believes the server.** The panel does not render a success the
  response did not claim.
- **The contract says which kinds support it.** If a kind cannot be
  published or executed, that is published in the contract rather than
  discovered by the owner.
- **The audit's row flips.** _Publish a resource_ and _execute a resource_
  move from broken-window to exposed-paired (if the owner path is fixed and
  an agent path exists), to human-only (if the owner path is fixed and no
  agent path exists yet), or to exempt with a reason.

## Gate

A shipped check that exercises publish and execute for **every** published
resource kind and asserts the response matches reality. A kind that claims a
publish without publishing one fails the gate.

The check is written against the resource kinds the contract publishes, so a
new kind cannot be added without answering the question.

## Acceptance

- Every published resource kind's publish and execute outcome is asserted by
  a test, and the response says what happened.
- The panel renders the outcome the response claimed. A refusal is visible
  as a refusal.
- The contract names the kinds that support each operation.
- The audit's two rows are re-measured and flip, and the parity gate's
  coverage table reflects the new truth.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- Adding resource kinds, or a publish pipeline for kinds that do not have
  one.
- The agent path for publish and execute. Whether an agent should be able to
  do these is SPEC-S2's question, and it is asked after the owner path tells
  the truth.
- The attachment upload, which the audit exempts: the bytes come from the
  browser, and there is no agent-side equivalent to a file picker.
