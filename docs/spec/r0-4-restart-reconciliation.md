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

**Revision.** Delivered on `feature/r0-4-restart-reconciliation`. The code is
in `4f0715d`; the commit after it is the contract's claim for it and this
evidence. `origin/main` at `ad75915` is merged in.

### What landed

| The promise                         | Where it is kept                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No blind replay                     | the stale-job rule (`apps/server/src/queue/reconciliation.ts`), applied by the queue (`apps/server/src/queue/client.ts`)                                                                                                                                                                                                                        |
| The lease is the fence              | `complete`, `fail` and `hold` are conditional on the lease (`apps/server/src/queue/client.ts`)                                                                                                                                                                                                                                                  |
| The transition is atomic            | every stale-job write is conditional on the job still being the one that was looked at (`apps/server/src/queue/client.ts`)                                                                                                                                                                                                                      |
| A turn ends once                    | the terminal write follows the fenced job write (`apps/worker/src/reconcile.ts`)                                                                                                                                                                                                                                                                |
| Every kind of job is probed         | a chat turn by its execution, a task turn by its execution, an automation's run by the run's own id (`apps/server/src/queue/client.ts`)                                                                                                                                                                                                         |
| A run is recorded as it starts      | the automation's run row is written when the run starts, and the scheduler mints the run's id (`apps/worker/src/executor.ts`, `apps/worker/src/scheduler.ts`)                                                                                                                                                                                   |
| The owner can see the uncertain run | a chat turn and a task's turn are published as uncertain and the waiting list carries them, with the reason; an automation's run has no conversation and no turn of its own, so it is published on the run itself, where the owner reads it with the automation's other runs (`apps/server/src/api/waiting.ts`, `apps/worker/src/reconcile.ts`) |
| The owner can settle it             | the owner's conclusion settles the run and the held job — a chat turn by `POST /api/executions/:id/resolve`, a task's turn by the task's own acceptance, an automation's run by `POST /api/automations/:id/runs/:runId/resolve` (`apps/server/src/modules/executions/service.ts`, `apps/server/src/modules/automations/service.ts`)             |
| The runtime may be asked            | `reconcile` on the adapter's extras (`packages/contracts/src/agent.ts`), asked by the worker (`apps/worker/src/reconcile.ts`)                                                                                                                                                                                                                   |
| A reconnected run is the same run   | the same execution, correlation id and session reference (`apps/worker/src/reconcile.ts`)                                                                                                                                                                                                                                                       |
| The matrix records the limit        | `docs/adapters.md`, one row per adapter type, with the column "After a restart"                                                                                                                                                                                                                                                                 |

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
  The contract pointer gate: 208 pointers checked, 0 failures.

$ npm run verify:mcp-parity
  The MCP parity gate: 83 published routes and 83 registered, 29 tools,
  28 paired, 38 listed, 17 exempt, 0 failures.

$ npx tsx scripts/smoke.ts
  All smoke checks passed.
```

Measured on this machine, one package at a time, because
`npm run test --workspaces` hangs here with runaway vitest workers: contracts
48 passed (6 files), agent-adapters 50 (5), worker 115 (12), server 825 (77),
web 210 (27). `@personal-os/ui` has no test script.

This slice is a wide change — the server, the worker, the contracts and the
published contract — so the whole proof is what it earns, and it is the whole
proof that was run. `npm run gates` runs it all in one command, in the order
the pipeline runs them.

`npm run verify:dependencies` exits 1 on this machine and is **not measurable
here**: the worktree is installed with `npm ci --ignore-scripts`, and npm
reports `invalid: esbuild@0.25.12`. It says nothing about this slice.

### The tests that fail without the implementation

The gate is the evidence. The tree was mutated, the package that carries the
mutation was rebuilt, and the gate was run again. Each mutation fails the gate
and names what it found, and the tree was restored from a byte-for-byte backup
after each one. Both packages were rebuilt from the restored sources before
each mutation, so no mutation was measured against a build left over from the
one before it.

| The mutation                                        | What the gate said                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the rule replays work that had started              | `The stale-job rule answered "requeue" for a run that is "started", and it should answer "reconcile".` and `The job of a run that had started was offered to another worker.`                                       |
| two workers can end the same turn twice             | `Two workers looking at the same dead job ended its turn 2 times (completed, completed), and a turn ends once.`                                                                                                     |
| the automation's run is not recorded as started     | `The automation's run was not recorded as started before it did anything: while the run was in flight the product said "nothing".`                                                                                  |
| a write is not fenced on the lease                  | `A stale executor finished a job whose lease had moved on.`                                                                                                                                                         |
| the build is not the build of this tree             | `server's built queue\client.js is not what this tree builds, so the gate would be exercising a different product than the tree. Run "npm run build".`                                                              |
| the tree's uncertainty does not reach the task      | `The task whose turn could not be confirmed is "active", and it should be published as uncertain.` and `The task whose turn could not be confirmed is not on the owner's waiting list, so the owner cannot see it.` |
| a task's turn is never published as uncertain       | `A task's turn whose outcome could not be confirmed is published as "running", and it should be published as uncertain.`                                                                                            |
| an automation's run is not published as uncertain   | `An automation's run whose outcome could not be confirmed is "running", and it should be published as uncertain.`                                                                                                   |
| the owner's conclusion does not settle the run      | `The owner's conclusion did not settle the automation's run: the run is "unknown", and it still says its outcome could not be confirmed.`                                                                           |
| the owner's conclusion does not settle the held job | `The owner's conclusion did not settle the job that was held for the run: the job is "unknown", and it still says the outcome was never confirmed.`                                                                 |

The first mutation is the one that mattered: a rule that replayed work which
had already started broke every promise the slice makes, and the gate said so
in its own words rather than in the words of the reasoning.

The fifth is the one that keeps the other four honest. The gate drives the
built product, so a build that is not the build of this tree would make it
check something else. The gate rebuilds the tree into a scratch directory and
compares the two builds byte for byte, so it catches a build that was changed
after it was made and a tree that was changed after its build was made — the
two ways a build stops being the build of the tree. A modification time cannot
do this: it says when a file was written, not what it says.

**The gate proves the conjunction of the two protections against ending a turn
twice, not each of them alone.** The turn's outcome is written only after the
fenced job write landed, and the write on the turn refuses a turn that has
already ended. Either protection on its own is enough to end a turn once, so
removing one of them changes nothing the gate can see, and removing both is
what the gate catches. This is said here so that nobody later removes one of
them "because the gate passes".

The unit tests beside the gate are `apps/server/src/__tests__/queue.test.ts`
(the rule on its own, the lease fence on each write, the item-state probe for a
chat turn, a task turn and an automation's run, the atomic transition, and the
held job settled by the owner) and
`apps/worker/src/__tests__/unknown-outcome.test.ts` (a job whose outcome was
unknown is held and never offered again; an automation's run is recorded as
started before it does anything; two workers looking at the same dead job end
its turn once) and
`apps/server/src/__tests__/automation-run-resolve.test.ts` (the owner's route
closes an automation's run and settles the job that was held for it; a run that
has already ended is refused; a run that does not exist is not found; a run
that belongs to another automation is not this automation's run; the agent's
tool is the same path, is not in the default grant set, and cannot reach a run
in a workspace it was not granted).

### What the independent review found, and what changed

An independent reviewer read the slice against the tree and ran it. It found
one Blocker, four Majors and four Minors, and its verdict was a failure. The
following is what changed in answer to it, and it is the reason the gate reads
the way it does now.

- **The automation's run was replayed.** A run's row was written when the run
  _ended_, so a run whose worker died mid-run left no row at all, and the
  product read that as "the work never started" and ran it again. The row is
  now written when the run starts, the scheduler mints the run's id and puts it
  on the job, and the job names the run it is going to make. The gate drives
  the run and reads the row from inside the turn.
- **Two workers could end the same turn.** The run's outcome was written before
  the job was settled, so two workers looking at the same dead job both wrote
  it. The fenced job write now comes first, and the write on the run is
  conditional on the run not having ended already. The gate drives two
  reconciliations at once.
- **The gate failed on the delivered tree.** The tree that was delivered had a
  mutated build in it, so the documented command failed. The gate now refuses a
  build that is older than the tree, so a stale build is a loud failure rather
  than a quiet one.
- **The published claim was stronger than the slice.** "A job is run again only
  when the product knows the previous executor did not run it" is true of the
  jobs whose worker died and false of the jobs whose worker reported a
  failure, which the queue has always retried. The contract now says both, and
  the spec's "What is not covered" says it too.
- **The task's probe was a trap.** A task stays open for the whole of its turn,
  so the task's own status could not say whether the turn had started. The
  probe now reads the task's execution.
- **The uncertain run's reason was not on the waiting list.** It is now.
- **The count of settled jobs over-reported.** A job that was settled by
  somebody else is no longer counted as settled.
- **The revision sentence named the wrong commit.** It names the commits now.
- **Three citations into `packages/contracts/src/agent.ts` were wrong on main
  already.** They named lines that hold code, so the pointer gate passed them,
  but they did not name the thing the contract said they named. They are
  repaired here, because a citation that holds code is not yet a citation that
  points at the right thing.

### What the second independent review found, and what changed

A second reviewer read the slice against the tree and ran it, and its verdict
was a failure again — one Blocker, two Majors and several Minors. The findings
that mattered were about the claim the contract makes, and about the gate that
was supposed to be the evidence for it.

- **"Uncertainty is a state the owner can act on" was false for two of the three
  kinds of run.** The contract said it unconditionally, and the reviewer
  measured it: a task's turn left the task `active`, so the task never reached
  the waiting list; an automation's run stayed `running` for ever; and a held
  automation's job could not be settled by anybody, because the settle path
  matched the job's execution id and an automation's job has none. Now the
  uncertainty reaches the task as well as the turn, an automation's run is
  published on the run itself, every automation job carries the id of the run
  it is going to make, and the owner closes an automation's run with
  `POST /api/automations/:id/runs/:runId/resolve` — which settles the job
  that was held for it. The agent closes it through the same path, with
  `automation.run.resolve`.
- **The gate did not exercise the product's real task path.** Its task
  scenario enqueued a payload the product never produces, so it proved a
  branch the product does not take, and a regression on the branch it does
  take passed the gate. The gate now sends the payload the factory service
  sends, and the task's turn is reached through the execution the product
  reaches it through.
- **The build check was a modification time.** It failed a tree that was clean
  and passed a build that had been changed after it was made, so it could not
  tell a stale build from a good one. The gate now rebuilds the tree into a
  scratch directory and compares the two builds byte for byte.
- **The contract listed four states where the rule has five.** The fifth is the
  one that governs the jobs that name nothing the product can read: they are
  held rather than run again. The contract lists it now.
- **The contract said there is no reconciliation pass.** There is one now. The
  sentence says what it means: an unknown item is still never retried
  automatically.
- **The two writes are not one transaction.** A worker that dies between
  settling the job and writing the turn's outcome leaves a turn that is never
  ended. The contract says a turn ends _at most_ once, and why.
- **Four more citations were wrong**, two of them on `main` already, and the
  Evidence counts were understated. They are repaired and corrected.

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
  gate drives all three: a chat turn, a task turn and an automation's run. The
  automation's run is recorded as started before it does anything, and the job
  carries the id of the run it is going to make, so the product finds the run
  rather than guessing at it.
- **A failed job is retried, and the rule does not govern that.** A job whose
  worker reported a failure is retried while it has attempts left. The product
  knows the work _failed_, not that it never ran, so a retry may repeat part of
  the work. This is the queue's long-standing behaviour; the stale-job rule
  governs the jobs whose worker died, and it does not govern this one. The
  contract says so where it publishes the rule.
- **The side effect is a file.** The gate writes a file to count the effect,
  because the point is that the effect is outside the product. A side effect
  inside the database would be counted by the product and could not prove
  anything about the product. The count is calibrated: on the path where
  running the work again is the right answer, the gate really does run it again
  and watches the count grow, so a count that stays put is a fact.
- **The commit protocol's later steps are not implemented.** They were not
  implemented by SPEC-R0-3 either, and the contract says so where it says it.
- **The prompt is still the boundary.** Acceptance, message delivery, agent
  consumption, run completion, verification and owner acceptance are distinct
  facts, and this slice did not merge them: a restart settles the _outcome_ of
  a run and nothing else.
