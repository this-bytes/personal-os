# SPEC-R0-4 — After a restart, a surviving run is reconnected and the rest are named uncertain

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
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

## Evidence

**Revision.** Delivered on `feature/r0-4-restart-reconciliation`. The code is in
`c0a3f80`; the commit after it is the contract's claim for it and this
evidence. `origin/main` at `ad75915` is merged in.

### What landed

| The promise                         | Where it is kept                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| No blind replay                     | the stale-job rule (`apps/server/src/queue/reconciliation.ts`), applied by the queue (`apps/server/src/queue/client.ts`)      |
| The lease is the fence              | `complete`, `fail` and `hold` are conditional on the lease (`apps/server/src/queue/client.ts`)                                |
| The transition is atomic            | every stale-job write is conditional on the job still being the one that was looked at (`apps/server/src/queue/client.ts`)    |
| The owner can see the uncertain run | the run is published as uncertain and the waiting list carries it (`apps/server/src/api/waiting.ts`)                          |
| The owner can settle it             | the owner's conclusion settles the run and the held job (`apps/server/src/modules/executions/service.ts`)                     |
| The runtime may be asked            | `reconcile` on the adapter's extras (`packages/contracts/src/agent.ts`), asked by the worker (`apps/worker/src/reconcile.ts`) |
| A reconnected run is the same run   | the same execution, correlation id and session reference (`apps/worker/src/reconcile.ts`)                                     |
| The matrix records the limit        | `docs/adapters.md`, one row per adapter type, with the column "After a restart"                                               |

### The commands that were run, and what they said

```
$ npm run build
  contracts, agent-adapters, server, worker and the web client all build.

$ npm run typecheck
  contracts, agent-adapters, server, worker, web, ui and the scripts all typecheck.

$ npm run format:check
  All matched files use Prettier code style!

$ npx tsx scripts/verify-restart-reconciliation.ts
  The restart reconciliation gate passed.

$ npx tsx scripts/verify-session-references.ts
  The session reference gate passed.

$ npm run verify:contracts
  The contract status gate: 31 claims in the table, 31 checked, 0 unchecked, 0 failures.

$ npx tsx scripts/verify-contract-pointers.ts
  The contract pointer gate: 207 pointers checked, 0 failures.

$ npm run verify:mcp-parity
  The MCP parity gate: 82 published routes and 82 registered, 28 tools,
  27 paired, 38 listed, 17 exempt, 0 failures.

$ npx tsx scripts/smoke.ts
  All smoke checks passed.
```

Measured on this machine, one package at a time, because
`npm run test --workspaces` hangs here with runaway vitest workers: contracts
48 passed (6 files), agent-adapters 50 (5), worker 113 (12), server 810 (76),
web 210 (27). `@personal-os/ui` has no test script.

`npm run verify:dependencies` exits 1 on this machine and is **not measurable
here**: the worktree is installed with `npm ci --ignore-scripts`, and npm
reports `invalid: esbuild@0.25.12`. It says nothing about this slice.

### The tests that fail without the implementation

The gate is the evidence. The tree was mutated, the package that carries the
mutation was rebuilt, and the gate was run again. Each mutation fails the gate
and names what it found, and the tree was restored from a byte-for-byte backup
after each one.

| The mutation                           | What the gate said                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the rule replays work that had started | `The job of a run that had started was offered to another worker.` and `A run whose outcome could not be confirmed is published as "running", and it should be published as uncertain.` |
| a write is not fenced on the lease     | `A stale executor finished a job whose lease had moved on.`                                                                                                                             |

The first mutation is the one that mattered: a rule that replayed work which
had already started broke every promise the slice makes, and the gate said so
in its own words rather than in the words of the reasoning.

The unit tests beside the gate are `apps/server/src/__tests__/queue.test.ts`
(the rule on its own, the lease fence on each write, the item-state probe, the
atomic transition, and the held job settled by the owner) and
`apps/worker/src/__tests__/unknown-outcome.test.ts` (a job whose outcome was
unknown is held and never offered again).

### What is not covered

- **No runtime the product ships today can be asked.** The question exists at
  the adapter boundary (`packages/contracts/src/agent.ts`), the gate proves it
  with a fixture that answers, and the adapter matrix records that every
  shipped adapter cannot. So in the product as it stands, every uncertain run
  waits for the owner; the reconnected case is proven by the fixture, not by a
  real runtime.
- **The reconciliation is the worker's, not the server's.** A worker that dies
  while the server is up is settled by the next worker, or by the worker that
  is already running when the lease goes stale. A queue with no worker alive
  settles nothing until one comes back.
- **A task's run and an automation's run are settled by the same rule.** The
  gate drives a chat turn; a task turn and an automation's run go through the
  same queue and the same rule, and their items are probed the same way, but
  the gate does not drive them.
- **The side effect is a file.** The gate writes a file to count the effect,
  because the point is that the effect is outside the product. A side effect
  inside the database would be counted by the product and could not prove
  anything about the product.
- **The commit protocol's later steps are not implemented.** They were not
  implemented by SPEC-R0-3 either, and the contract says so where it says it.
- **The prompt is still the boundary.** Acceptance, message delivery, agent
  consumption, run completion, verification and owner acceptance are distinct
  facts, and this slice did not merge them: a restart settles the _outcome_ of
  a run and nothing else.
