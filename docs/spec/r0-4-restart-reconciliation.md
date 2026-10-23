# SPEC-R0-4 — After a restart, a surviving run is reconnected and the rest are named uncertain

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-R0-1 (one execution owner), SPEC-R0-3 (session references) · ADR 0005 (the event log is the stream)

## Outcome

When the worker comes back, it does not guess. A run whose runtime survived is
reconnected and reported as running; a run whose outcome cannot be confirmed
is reported as **uncertain**, with a way for the owner to resolve it; and a run
that is known to have finished is not run again.

Nothing is replayed on the strength of a lease having expired.

The roadmap names this as R0's fourth bounded slice:

> Test restart/reconciliation and unknown outcomes with side effects. Keep the
> current no-blind-replay guard; do not wait for a lease to expire and assume
> the previous executor stopped.

## The gap, measured

The engineering review recorded it precisely:

> `Queue.reapStaleJobs` currently requeues a stale running job unless the
> executor already recorded an unknown outcome. A process killed before that
> write can replay an external side effect.

The worker already has the vocabulary for this — `recordUnknownOutcome` and
`apps/worker/src/__tests__/unknown-outcome.test.ts` — but the guard depends
on the executor having reached a write, and a process killed **before** that
write leaves no record to guard with. The lease then expires, the job is
requeued, and an external side effect happens twice.

## Contract

- **No blind replay.** A job is requeued only when the product knows the
  previous executor did not run it. Otherwise the outcome is uncertain and
  the owner resolves it.
- **Lease fencing.** A stale executor cannot write after its lease has moved
  on. The transition from running to requeued or uncertain is atomic in the
  domain, and a job cannot be both.
- **Reconciliation where it is supported.** A run with a session reference
  (SPEC-R0-3) and a runtime that supports reconnecting is reconnected, and
  the transcript shows it running again — the same run, not a new one.
- **Uncertainty is a state the owner can act on.** "Unknown" is not a failure
  and not a success. It names what is uncertain, and the owner can mark the
  outcome without the product inventing it.
- **The prompt is the boundary.** Acceptance, message delivery, agent
  consumption, run completion, verification and owner acceptance are distinct
  facts, and a restart does not merge them.

## Gate

A worker-loss integration case: a fixture records an external side effect,
the worker is killed **before** it can record an outcome, it is restarted, and
the check proves that the side effect happened **once**, that the outcome is
visible as uncertain, and that the owner can resolve it.

A second case: the worker is killed **after** the runtime survives, and the
restart reconnects the same run rather than starting a second one.

Both cases fail if a stale lease is treated as permission to run again.

## Acceptance

- A side effect recorded before a kill is not repeated after a restart. The
  integration case proves it, not the reasoning about it.
- The uncertain outcome is visible to the owner, in the panel and through the
  MCP tools, with the reason it is uncertain.
- The owner can resolve an uncertain outcome, and the resolution is recorded.
- A surviving run is reconnected and appears as the same run, with the same
  session reference and the same correlation id.
- A stale executor cannot write to a job whose lease has moved on.
- The queue's requeue path and the domain's terminal transition are atomic:
  a job is never both running and requeued.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- A distributed queue, a lease service, or a scheduler rewrite. The current
  single-database queue and a supervised worker stay.
- Reconciling a runtime that offers no way to ask. The outcome is uncertain,
  and that is the honest answer.
- Automatic repair of an uncertain side effect. The product reports it; it
  does not perform it on its own.
