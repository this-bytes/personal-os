# SPEC-R0-1 — One execution owner serves chat, tasks and automations

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
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

## Evidence

Delivered on `feature/r0-1-execution-owner` at `7c2e4e1`, with `origin/main` at
`58dacf8` merged in.

**The owner.** `apps/worker/src/execution-owner.ts` holds the lifecycle the
three callers share: it resolves the connection, admits the turn against the
capability set it runs against, builds and connects the adapter, holds the
deadline, publishes the events and records the terminal state. The executor
keeps three callers and their own semantics, and holds none of it.

**The gate.** `apps/worker/src/__tests__/execution-owner.test.ts` drives all
three job types against the real MCP fixture over stdio — an actual server
process speaking the published protocol — and asserts, for each, that the run
was admitted against a capability set, the runtime was connected before it was
sent to, a terminal state was recorded, and the events are the published
vocabulary. The fixture now records the methods it receives, so the order the
runtime was reached in is the server's own record and not the client's
account.

Three more cases drive **every** path, because the acceptance named every path
and one case had been claiming it while driving one: a connection that is
switched off is refused; a server that refuses the handshake blocks submission
and records an actionable failure — the fixture can refuse a handshake for
real — and a configuration that cannot be read fails the run. Each of them
asserts the terminal state, the reason and the end of the run, on the chat
turn, the task turn and the automation's run.

The gate's last case reads the executor's own source and fails when it still
holds any part of the lifecycle, which is what "a caller can be made to skip
the shared owner and still work" means in a test. It also fails when the
executor connects or releases a runtime through the published API, or writes
the state of an execution row: the bypass it looks for is not one spelling of
it.

**The review.** An independent reviewer replayed thirteen scenarios against
the pre-slice executor — the same scenarios through the real MCP fixture over
stdio — and compared what each side wrote. It found one confirmed regression,
one ordering defect and three gaps in the gate, and all four are addressed:

- **The regression.** The adapter configuration was read outside the turn's own
  failure handling. A configuration that could not be read therefore left an
  automation's execution row saying `running`, with no error and no end, where
  the pre-slice code wrote `failed` with the reason. The read is inside the
  turn now, and the row is failed with the reason on every path. The gate
  covers it.
- **The ordering.** The owner's steers were let go after the adapter had been
  asked for its external reference, so a steer taken in that window was
  recorded as taken and read by nobody. The turn ends before the adapter is
  asked for anything else now.
- **The gate's gaps.** The switched-off case drove one path and called itself
  "every path"; no case covered a failed handshake at all, and the
  source-level check did not look for a caller that re-implements the
  lifecycle through the published API. All three are covered now.

The reviewer also confirmed the chat path is byte-for-byte identical to the
base apart from the capability view, that the terminal states, the spend
units, the approval flow and the unknown outcome are unchanged on all three
paths, and that the contract's line references are accurate.

**What changed, and what did not.**

- A task turn and an automation's run publish `execution.event` now, so the
  server's stream needs no case per caller.
- A task turn and an automation's run are held to the policy the chat path
  was held to. An action the policy refuses does not happen on any path.
- A connection that has been switched off stops a task turn and an
  automation's run, as it already stopped a chat turn.
- An automation's run is admitted against a capability set like every other
  turn, and its execution row carries the view it was admitted with.
- **A turn may only wait for the owner where it can continue.** A chat turn
  suspends and continues in a new turn; a task turn and an automation's run
  refuse the action instead. The owner cannot continue them, and a turn that
  waits for a decision that cannot come never ends.
- The steer channel is asked the turn's own capability view rather than the
  live connection, which is what the view is for.

**The commands, on the delivered revision.** `npm run typecheck`, `npm run
test`, `npm run format:check`, `npm run build`, `npx tsx scripts/smoke.ts`,
`npm run verify:contracts`, `npx tsx scripts/verify-contract-pointers.ts` and
`npm run verify:mcp-parity`.

Measured on this machine, one package at a time: worker 106, server 717, web
193, agent-adapters 50, contracts 48. The contract gate checks 28 claims and
reports no failure; the pointer gate checks 190 pointers and reports none
stale; the parity gate reports 82 published routes and 82 registered, 23
tools, 22 paired, 50 listed and 10 exempt, with no failure.

One measurement needs a word about how it was taken. `contractStatus.test.ts`
runs the contract gate as a subprocess with a 60-second limit, and that gate
takes long enough to exceed it when the machine is busy: two runs of the
server suite under load timed out on that one case and nothing else, and the
same suite with the machine idle passes every case. It is a property of the
host, not of the slice, and it is the same case on `main`.

**The limits.** The owner covers the three callers that exist; a fourth
caller is the thing that has to change. The grant decision taken at admission
and enforced at execution is SPEC-R0-2, the session reference is SPEC-R0-3,
and the restart reconciliation is SPEC-R0-4.

**A limit worth stating plainly.** A task turn's report is the task's
deliverable, and the policy gates the agent's text as `message.send`. A
workspace whose policy allows `tool.call` but not `message.send` therefore
gets a refusal instead of a report from every factory task: the task is
blocked, and the evidence summary is the refusal. That follows from the rule
this slice states — an action the policy refuses does not happen on any path —
and the way back is the factory's own, which re-runs a task when the owner
reassigns it. Whether the report of a delegated task is a message is a
question about what the policy means, and it belongs with SPEC-R0-2, which
owns the decision taken at admission.

**A defect the gate found.** A message with a newline in it made the MCP
tool's arguments invalid JSON, and the HTTP adapter's body the same: both
templates are JSON documents, and the values went into them raw. The values
are escaped for them now — where the placeholder lands in a string, the value
is text and is escaped, and where it lands anywhere else it is part of the
document's shape and is left alone.

## Not in scope

- Authorised dispatch — the grant decision taken at admission and enforced at
  execution is SPEC-R0-2.
- Session references, correlation and idempotency — SPEC-R0-3.
- Restart reconciliation and the unknown outcome — SPEC-R0-4.
- A general workflow engine, a plugin marketplace, a queue redesign, or new
  dashboards. None of them is a prerequisite for this.
- The factory's goals and tasks rollup. It consumes the owner; it does not
  change it.
