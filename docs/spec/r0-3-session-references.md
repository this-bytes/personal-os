# SPEC-R0-3 — A conversation points at the runtime session behind it

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-R0-1 (one execution owner) · **Blocks:** SPEC-R1-1, SPEC-R1-2 (the demonstrations need history that survives)

## Outcome

A conversation holds a durable reference to the runtime session behind it, so
a turn that continues a conversation continues the **same** native session
rather than starting a fresh one, and the transcript can say which session a
turn ran in.

The roadmap names this as R0's third bounded slice:

> Introduce session references, correlation/idempotency and terminal-event
> rules sufficient for the first real integrations. Document native capability
> limits.

This is the most load-bearing slice of R0. R1's acceptance asks for a
conversation that survives a browser restart with its tool and result
references intact, and for a worker restart that reconciles rather than
replays — and neither can be demonstrated honestly while the reference from a
conversation to a runtime session does not exist.

## Why it is sequenced before R0-2

R0-2 (authorised dispatch) is blocked by the grant editor's defect, and the
R1 demonstration does not need it. R0-3 has no predecessor and unblocks the
demonstration, so it goes first.

## The shape today

The worker already carries a session id through the chat path — the payload
has `correlationId`, and a turn suspended on an approval resumes with the
`externalSessionId` it was suspended in:

```ts
  resume?: {
    decision: string;
    externalSessionId: string;
  };
```

What is missing is the durable, published side of it: the conversation's own
record of which session it is in, the rule for when a session may be reused,
and the terminal-event rules that say what "finished" means to a reader.

`SPEC-P0`'s audit found a second thing in this area: **`committedRevision`
is never populated anywhere in the tree** (its evidence item E13). A
conversation that records a revision it never commits is a conversation whose
history cannot be checked for a concurrent change.

## Contract

- **A durable session reference.** The conversation records the runtime
  session behind it, and the reference is published in the contract so a
  client can read it.
- **Session continuity, honestly.** Where a runtime supports resuming a
  native session, the next turn in that conversation resumes it. Where it
  does not, the product says so and the capability row records the limit —
  the transcript does not claim a continuity that does not exist.
- **Correlation and idempotency.** A turn carries a correlation id that ties
  it to the execution, the events and the terminal state, and a dispatch that
  repeats with the same key does not start a second run.
- **Terminal-event rules.** "Finished" is defined once: which event ends a
  turn, what the reader may rely on afterwards, and what an interrupted turn
  looks like in the log. One definition, read by every reader.
- **`committedRevision` is populated** wherever the contract promises it, and
  the check that holds the contract's own claim about it runs in CI.
- **Native capability limits are documented.** The adapter matrix records what
  each runtime supports, and the panel shows the limit rather than a control
  that silently does nothing.

## Gate

A shipped check that every published session reference resolves: a reference
that points at a session the product cannot name, or a `committedRevision`
the product never wrote, fails the gate.

The gate runs in CI on the delivered revision.

## Acceptance

- A second turn in the same conversation continues the same native session on
  a runtime that supports it, and the transcript names the session.
- On a runtime that does not support resuming, the capability row says so,
  and the product does not claim continuity.
- A duplicated dispatch with the same idempotency key yields one run and one
  set of events.
- The terminal state of a turn is unambiguous: exactly one event ends it,
  and every reader — the panel, the MCP tools, the audit trail — agrees.
- `committedRevision` is populated on the records the contract names, and the
  check that holds that claim passes.
- The capability limits of every supported runtime are recorded in the
  adapter matrix, with the version each was verified against.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- Authorised dispatch — SPEC-R0-2.
- Restart reconciliation and the unknown outcome — SPEC-R0-4.
- A general session store, a workflow engine, or a plugin framework.
- Inventing a session concept for a runtime that has none. A runtime without
  native sessions gets a recorded capability limit, not an invented layer.
