# SPEC-R0-3 — A conversation points at the runtime session behind it

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
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

## Evidence

**Revision.** Delivered on `feature/r0-3-session-references`. The code is in
`2c00452`; the commit after it is the contract's claim for it and this
evidence. `origin/main` at `ece75fd` is merged in.

### What landed

| The promise                         | Where it is kept                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The session reference is durable    | `conversation_sessions` (`apps/server/src/db/schema.ts:343`), written by `recordSessionReference` (`apps/server/src/modules/conversations/session-refs.ts`)               |
| It is published                     | `ConversationDetail.sessionRefs` (`apps/server/src/modules/conversations/service.ts:46`), read by `GET /api/conversations/:id`                                            |
| The transcript names the session    | `MessageOrigin.sessionId` (`packages/contracts/src/conversation.ts:100`), written by the commit (`apps/worker/src/executor.ts:519`)                                       |
| Continuity is a fact, not a hope    | `continuityForCapabilities` (`packages/contracts/src/session.ts`), from the connection's own capability set                                                               |
| A second turn continues the session | `apps/worker/src/executor.ts:306` reads the reference and restores the session                                                                                            |
| A dispatch has an identity          | `dispatchIdempotencyKey` (`packages/contracts/src/session.ts`), checked in `planAndDispatch` (`apps/server/src/modules/conversations/dispatch.ts:191`)                    |
| A turn carries a correlation id     | `executions.correlationId`, published on the turn view (`apps/server/src/modules/executions/service.ts:242`)                                                              |
| "Finished" is defined once          | `TERMINAL_TURN_STATUSES` and `turnEventFor` (`packages/contracts/src/session.ts`), read by the server's derivation (`apps/server/src/modules/executions/activity.ts:287`) |
| Exactly one event ends a turn       | `publishTerminalEvent` (`apps/worker/src/execution-owner.ts`), after the turn's own conclusion is recorded                                                                |
| The revision is written             | The commit hook (`apps/worker/src/executor.ts:568`), read back and hashed by `computeHistoryRevision` (`apps/server/src/modules/conversations/history-revision.ts`)       |
| The revision is published           | `committedRevision` on the turn view (`apps/server/src/modules/executions/service.ts`)                                                                                    |
| The limits are recorded             | `docs/adapters.md`, one row per adapter type, with the version each claim was verified against                                                                            |

### The commands that were run, and what they said

```
$ npm run build
  contracts, agent-adapters, server, worker and the web client all build.

$ npm run typecheck
  contracts, agent-adapters, server, worker, web, ui and the scripts all typecheck.

$ npm run format:check
  All matched files use Prettier code style!

$ npx tsx scripts/verify-session-references.ts
  The session reference gate passed.

$ npm run verify:contracts
  The contract status gate: 30 claims in the table, 30 checked, 0 unchecked, 0 failures.

$ npx tsx scripts/verify-contract-pointers.ts
  The contract pointer gate: 195 pointers checked, 0 failures.

$ npm run verify:mcp-parity
  The MCP parity gate: 82 published routes and 82 registered, 23 tools,
  22 paired, 50 listed, 10 exempt, 0 failures.

$ npx tsx scripts/smoke.ts
  All smoke checks passed.
```

Measured on this machine, one package at a time, because
`npm run test --workspaces` hangs here with runaway vitest workers: contracts 48
passed (6 files), agent-adapters 50 (5), worker 113 (12), server 760 (74), web
210 (27). `@personal-os/ui` has no test script.

`npm run verify:dependencies` exits 1 on this machine and is **not measurable
here**: the worktree is installed with `npm ci --ignore-scripts`, and npm
reports `invalid: esbuild@0.25.12`. It says nothing about this slice.

### The tests that fail without the implementation

The gate is the evidence. Five mutations were made to the tree, each one
rebuilt where the built code carries it and each one run against
`npx tsx scripts/verify-session-references.ts`. Each fails the gate and names
what it found. The file was restored from a byte-for-byte backup after each
one, and the gate passes again on the restored tree.

| The mutation                                                | What the gate said                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| the dispatch stops recognising the run it started last time | `UNIQUE constraint failed: executions.idempotency_key`                                                             |
| the recorded session reference names no session             | `A session reference names no session.`                                                                            |
| the owner publishes the ending twice                        | `A turn (exe_…) ended more than once: committed, committed.` and `A turn ended 2 times; it must end once.`         |
| the turn stores a revision nobody wrote                     | `A committed turn (exe_…) carries a revision that is not the revision of the history it committed to.`             |
| the server defines its own terminal-event rule              | `apps/server/src/modules/executions/activity.ts defines its own terminal-event rule; it must read the shared one.` |

The unit tests beside the gate are
`apps/server/src/__tests__/session-references.test.ts` (the reference is
durable, published on the conversation's read model and per agent connection;
a repeated dispatch finds the run it started last time) and
`apps/worker/src/__tests__/session-continuity.test.ts` (the next turn continues
the session when the runtime said it could and does not when it did not; the
committed revision is the revision of the history the turn committed to).

### What is not covered

- **The commit protocol's later steps are not implemented.** The contract's
  commit is five steps, and this slice implements the durable part of it: the
  write, the read-back, the revision and the acknowledgement. The
  `HistoryCommitted` projection wait and the compaction lifecycle are not
  implemented, and the contract says so where it says it.
- **An interrupted turn is unsettled, not reconciled.** A turn the deadline
  stops has an admission and no terminal event; settling it is SPEC-R0-4.
- **The session reference is per conversation and agent connection.** A
  conversation with one agent has one reference. Two agents in one room have
  two, and neither is the other's.
- **Continuity is read from the capability set that was pinned at admission.**
  A connection nobody has probed keeps no session to continue, so the product
  claims none. A runtime that keeps sessions but has never been probed is
  therefore recorded as `fresh` until it is probed.
- **The adapter matrix records the limits the tree knows.** The versions in
  `docs/adapters.md` were read off the runtimes on this machine
  (`codex-cli 0.163.0`, `Hermes 0.21.0`, `MCP SDK 1.32.1`); the rows for the
  adapters with no external runtime name the adapter package's own version.
  A row whose runtime version moves is a row whose claim has to be checked
  again.
