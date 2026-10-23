# SPEC-R0-1 — One execution owner serves chat, tasks and automations

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** ADR 0001 (modular monolith with a supervised worker), ADR 0005 (the event log is the stream) · **Blocks:** SPEC-R0-2, SPEC-R0-4

## Outcome

A dispatched turn reaches a correctly initialised runtime through **one** path.
The chat caller, the task caller and the automation caller ask the same owner
for an execution, and the owner gives them the same authorisation, the same
session behaviour and the same event vocabulary — so a turn started from a
conversation and a turn started from a scheduled automation are the same kind
of thing, recorded the same way.

Today three callers each decide for themselves what an execution is. The
roadmap names this as R0's next bounded slice:

> Establish shared execution ownership across chat, tasks and automations.
> Extract only the lifecycle needed by these callers, with compatible
> event/state mapping.

## The shape today

`apps/worker/src/executor.ts` dispatches by job type:

```ts
export async function executeJob(context: ExecutorContext, job: QueueJob): Promise<ExecutionOutcome> {
  switch (job.type) {
    case 'chat.turn':
      return executeChatTurn(context, job);
    case 'factory.execute':
      return executeFactoryTask(context, job);
    case 'automation.run':
      return executeAutomation(context, job);
```

Three paths, one file, one dispatcher. The dispatcher is the seam that already
exists; what is missing is a single owner _inside_ it. Each path decides for
itself how a connection is resolved, how an adapter is built and connected,
how the run is recorded and how it ends — so the same guarantees have to be
re-implemented three times, and they have not drifted equally.

## Contract

- **One owner, three callers.** The lifecycle the three callers share —
  resolve the connection, admit the turn against its capability set, build and
  connect the adapter, record the run, record the outcome — moves behind one
  owner. The callers keep their own semantics (a chat turn carries a
  conversation, a task carries a deliverable, an automation carries a
  schedule) and nothing else.
- **Extract only the lifecycle these callers need.** This is not a general
  workflow engine, and it is not a plugin framework. If a fourth caller
  appears later, the owner is the thing that has to change, not the three
  that exist.
- **The API server still never runs an agent.** It creates a row and enqueues
  a job; the worker runs it. The owner lives in the worker.
- **The worker still never talks to the browser.** It writes to the database;
  the server streams the event log.
- **Compatible event and state mapping.** The owner emits the event kinds the
  event log already publishes, and the terminal states are the ones the
  existing readers already understand. A turn started on the chat path must
  not need a second reader.

## Gate

A worker-level regression drives **all three** job types through the shared
owner and asserts that the same lifecycle happened for each: the run was
admitted against a capability set, the adapter was connected before it was
sent to, a terminal state was recorded, and the events are the ones the
existing event vocabulary publishes.

The gate fails if any one of the three callers still owns part of the
lifecycle — that is, if a caller can be made to skip the shared owner and
still work.

## Acceptance

- The three callers go through one owner, and the owner is the only place
  that resolves a connection, connects an adapter and records a terminal
  state.
- The regression drives a **real** runtime — the fixture MCP server over
  stdio that R0's first slice already established — and records its answer.
  The Echo adapter and a protocol replay are tests, not evidence.
- A failed handshake blocks submission and records an actionable failure on
  **every** path, not only the chat path.
- Cleanup and deadlines leak no child process and claim no confirmed
  cancellation that was not observed, on every path.
- The event log reads the same for a turn from any of the three callers. The
  server's stream needs no per-caller special case.
- Existing chat, task and automation behaviour stays compatible: the
  applicable repository gates pass on the delivered revision.

## Not in scope

- Authorised dispatch — the grant decision taken at admission and enforced at
  execution is SPEC-R0-2.
- Session references, correlation and idempotency — SPEC-R0-3.
- Restart reconciliation and the unknown outcome — SPEC-R0-4.
- A general workflow engine, a plugin marketplace, a queue redesign, or new
  dashboards. None of them is a prerequisite for this.
- The factory's goals and tasks rollup. It consumes the owner; it does not
  change it.
