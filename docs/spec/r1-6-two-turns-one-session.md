# SPEC-R1-6 — A turn's work is the turn's own

**State:** delivered — the rule holds on the App Server route, the room shows two
turns in one session, and the second turn continues the runtime's own thread ·
**Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-R1-4 (the rule was settled on the ACP route) ·
**Blocks:** nothing yet
**Evidence:** [the gate](../../scripts/verify-two-turns.ts), [the browser
test](../../apps/web/e2e/two-turns.spec.ts), [the
demonstration](../demonstration-two-turns-2026-10-25.md)

## The gap

**The rule was settled on one route and left open on the other.** SPEC-R1-4
established the rule for the ACP route — _a turn's work is what arrives after
the prompt_ — because the ACP runtime replays the session it loads, and a route
that treated the replay as the turn's work put the session's earlier answer and
the session's earlier calls into the turn that resumed it.

The App Server route had no such rule. Its session is a thread, and a thread
that is resumed is the runtime's own history; the route read every notification
the runtime sent and put it in the turn. The installed App Server 0.163.0
replays nothing, so the room looked right — but the route was right by
accident, and only on that version.

**And the room itself had never shown two turns in one session.** SPEC-R1-4's
outstanding evidence was the room, with two turns in one session: the
installed OpenCode's free allowance was spent before the second turn could be
asked. The review's own follow-up said the same thing in another words —
_"ordinary follow-ups are not proven to restore native context."_

## What the runtime actually does

Measured against the installed Codex 0.163.0, not read out of a document. A
probe drove the App Server through two turns in one thread and recorded every
notification, in order.

**The resume replays nothing.** Between the resume and the second turn's own
answer, the runtime sent no delta at all, and the second turn's answer was its
own:

```
first turn:  "FIRST-TURN-OK"
resume:      0 deltas
second turn: "SECOND-TURN-OK"
```

**The runtime says so itself.** At the resume the App Server sent:

> Full-history hydration is deprecated for paginated threads; use
> `excludeTurns: true`, then page with `thread/turns/list` and
> `thread/items/list`.

So the history is _available_ to a client that asks for it, and the runtime is
moving the way to ask for it. A client — or a runtime — that hydrates the
thread's history has everything it needs to put that history into the turn.

**The second turn keeps the runtime's own memory.** A second probe asked the
thread, with no history in the prompt at all, for the word it had been told to
remember:

```
first turn:  "Remember this word exactly: FIRST-TURN-OK"
second turn: "Reply with exactly the word I asked you to remember in my previous message"
answer:      "FIRST-TURN-OK"
```

The answer cannot have come from the prompt — the prompt held only the question.
It came from the thread the runtime kept. **A follow-up restores the runtime's
native context**, and the product does not have to carry it.

**The runtime names its turns.** The App Server's own notifications say which
turn they belong to:

```
turn/started              :: turn.id = 01a16ec7-15a4-…
item/started              :: turnId = 01a16ec7-15a4-…
item/completed            :: turnId = 01a16ec7-15a4-…
item/agentMessage/delta   :: turnId = 01a16ec7-15a4-…
turn/completed            :: turn.id = 01a16ec7-15a4-…
```

The id is the same one the answer to `turn/start` named, and the runtime
announces the turn before its items. The protocol's pinned schema agrees:
`item/started`, `item/completed` and `item/agentMessage/delta` all carry a
`turnId`.

## The shape

**The contract does not change.** This is the adapter deciding what a turn's
events are, on the route that had not decided it.

The rule is the same rule, and on this route it has two boundaries, because
this route's protocol gives two:

| The runtime sent                                      | The route says       |
| ----------------------------------------------------- | -------------------- |
| anything, before the turn's prompt was written        | not this turn's work |
| a notification that names another turn                | not this turn's work |
| a notification that names this turn, after the prompt | this turn's work     |

**The prompt is the boundary for a history that names no turn.** A runtime that
replays a session's history sends it while the session is being loaded, before
it answers the load, and the history does not name a turn — the ACP route's
runtime does exactly this. The turn id cannot tell that replay from the turn's
own work, so the prompt does: what arrived before the prompt was written is the
history.

**The turn is the boundary for a history that names its turns.** The App
Server's own items name the turn they belong to, so a thread hydrated with the
turn that follows is told apart from the turn's own work by the turn id alone.
The runtime announces the turn before its items, so a notification that names a
turn before this execution knows its turn is not this turn's work either.

The two rules are not one rule in two clothes. Each is load-bearing, and each
was measured without the other:

| What was taken out | What the product then showed                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| the turn id rule   | the answer was `APP-SERVER-OK turn 1APP-SERVER-OK turn 2`, and the room was told about 2 calls where the turn made 1 |
| the prompt rule    | the same: the earlier answer was in the turn's answer, and the earlier call was in the turn's rows                   |

## The gate

`npm run verify:two-turns` drives the **built** adapter against the
repository's own App Server double, in the two shapes a replay takes, and
checks:

1. The build the gate exercises is the build of this tree.
2. The second turn answers with its own words.
3. The second turn shows the calls it made — one call is one row.
4. The second turn continues the same thread: one thread, and the second turn
   resumed it through the runtime.
5. The matrix agrees with the code.

The double replays the thread's history on purpose. The installed runtime does
not, so a gate that ran against a runtime that does not replay would pass
without proving anything.

The gate runs in the CI fast lane, because a gate that only runs on the machine
that wrote it is a habit. It says which check failed: the "ok" line is printed
only when the check added no failure.

**The browser test is the room's half.** `apps/web/e2e/two-turns.spec.ts` opens
a room, asks two questions, and reads the room: two answers, the second one
without the first in it, one call in the trace, and one thread in the runtime's
own record.

## Acceptance

1. A turn that continues a session answers with its own words. — **met**, on the
   ACP route by `verify:acp-tool-activity` and on the App Server route by
   `verify:two-turns`.
2. A turn that continues a session shows only the calls it made. — **met**, by
   the same two gates and by the browser test.
3. The App Server route holds the rule against a runtime that hands the
   thread's history back. — **met**, by the gate, with both rules measured
   without the other.
4. A follow-up restores the runtime's native context. — **met**, measured
   against the installed App Server 0.163.0: the second turn answered with the
   word the first turn gave it, with no history in the prompt.
5. The room shows two turns in one session. — **met**, by the browser test and
   by the demonstration.
6. `npm run verify:two-turns` passes, the adapter's tests pass, and the whole
   suite passes. — **met**.

## Evidence

### What landed

| What                                                                 | What it does                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/codex-app-server.ts`                    | The route reads the runtime's notifications only after the prompt, and only those that name the turn it started. |
| `packages/agent-adapters/src/__tests__/codex-app-server.test.ts`     | The two shapes a replay takes, and the turn that keeps only its own work.                                        |
| `packages/agent-adapters/src/__tests__/fixtures/fake-app-server.mjs` | The double can replay a thread's history, in either shape, and numbers its turns from its own record.            |
| `scripts/verify-two-turns.ts`                                        | The gate, in the fast lane.                                                                                      |
| `apps/web/e2e/two-turns.spec.ts`                                     | The room, in a browser, with two turns in one session.                                                           |
| `docs/demonstration-two-turns-2026-10-25.md`                         | The transcript: the room, the installed runtime, two turns.                                                      |

### The tests that fail without the implementation

**Measured, not assumed.** The guard was taken out of the adapter, the package
was rebuilt, and the tests and the gate were left in place.

| Check                                                            | What it said without the guard                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/__tests__/codex-app-server.test.ts` | **2 of the 17 tests failed**: the turn that continued the thread answered `APP-SERVER-OK turn 1APP-SERVER-OK turn 2`, and the room was told about 2 calls where the turn made 1. |
| `scripts/verify-two-turns.ts`                                    | failed, with every reason named (below)                                                                                                                                          |
| `apps/web/e2e/two-turns.spec.ts`                                 | failed on the room's own text: the second answer read `APP-SERVER-OK turn 1APP-SERVER-OK turn 2`                                                                                 |

The gate's own report without the implementation:

```
The gate for a turn's work.
  ok   the build the gate exercises is the build of this tree
  ok   the second turn continues the same thread
  ok   the matrix agrees with the code

The gate failed:
  - the turn that continued the thread answered "APP-SERVER-OK turn 1APP-SERVER-OK turn 2", and the thread's earlier answer is not this turn's work.
  - the turn made one call and the room was told about 2 of them, so the thread's earlier calls were shown as this turn's work.
  - the turn finished one call and the room was told about 2 of them, so the thread's earlier calls were shown as this turn's work.
```

### The demonstration

The gate proves the product's half against a double. The runtime's half was
measured against the installed Codex 0.163.0, and the room was run against it:
two questions, one conversation, one thread, and the second answer about the
second question. `docs/demonstration-two-turns-2026-10-25.md` is the
transcript.

## What is not covered

- **A replay that arrives after the prompt and names no turn.** The prompt
  boundary catches a history that is replayed while the session is loaded; the
  turn boundary catches a history that names its turns. A runtime that replayed
  a history _after_ the prompt was written, without naming a turn, would put it
  in the turn, and nothing in this protocol says it may not. The ACP route has
  the same limit, and it is the limit the runtime's own ordering avoids.
- **The ACP route's room, with two turns in one session.** The rule is proved
  on that route by the gate and by the route's own tests; the room itself is
  still to be run, because the installed OpenCode's free allowance was spent
  before the second turn could be asked.
- **A runtime that keeps no sessions.** A connection whose capability row says
  it does not keep sessions starts a new session for every turn, and the room's
  history is then the product's only memory. That is the route's own row, and
  it says so.
