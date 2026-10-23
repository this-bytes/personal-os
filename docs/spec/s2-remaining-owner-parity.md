# SPEC-S2 — The remaining owner capabilities become agent-operable, in the order the audit ranked them

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-S1 (its tools and the parity gate), SPEC-P0 (the ranking that allocates these rows) · ADR 0013 is the rule

## Outcome

Every capability the owner has that an agent should also have becomes
agent-operable, in the order the audit ranked them by what the owner loses.

SPEC-S1 made the **authority loop** agent-operable. This spec finishes the
**rest** of the owner surface: reading an approval's evidence, resolving a
turn whose outcome is unknown, accepting or assigning a task, the waiting
queue, an agent's own memory, the rooms, the workspaces, the schedules, and
the reads the panel does.

The parity gate (`npm run verify:mcp-parity`) is the measure. Its coverage
table already answers for all 82 published owner-facing routes: **25 paired
with a registered tool, 40 listed with a reason and the spec that will pair
them, and 17 exempt with a reason.** **This spec moves the listed ones to
paired, in the ranked order, and the gate refuses to pass while any remain
listed under it.**

**Batch 1 is delivered.** Three of the four rows in it are paired now —
`approval.evidence`, `execution.resolve` and `task.accept` — and the gate's
counts have moved from 22 paired and 43 listed to **25 paired and 40 listed**.
The fourth row, _assign a task to an agent_, stays listed, and the reason is
written down below.

## The scope, and where it came from

[SPEC-P0](p0-feature-audit.md) measured 83 owner-facing operations and
ranked the human-only ones. Its allocation is explicit:

> **SPEC-S2** — _Remaining owner-surface parity_, a spec to be written after
> SPEC-S1 lands. Its scope is this ranked list: the 43 rows the audit ranks.

So the scope is not a guess. It is the audit's ranked list, and the ranking
is the order. Eight rows left that list when SPEC-S1 landed, and two more
when they turned out to be exempt, so this is the audit's current ranking —
not the one the audit was first written with.

## The batches

The rows are delivered in the audit's order, because the audit ordered them
by what the owner loses when an agent cannot do it.

**The numbers below are the audit's numbers as this spec was written, before
batch 1 landed.** The audit's live ranked list renumbers as rows leave it, the
way it did when SPEC-S1 delivered eight. A row's number here is the number it
was given in the ranking this spec was written against; the audit's current
list is the live one.

**Batch 1 — the authority loop's own detail.** _read the evidence a
decision is taken against_ (#1), _close a turn whose outcome cannot be
confirmed_ (#2), _record an acceptance decision_ (#3), _assign a task to an
agent_ (#4). These are the rows where the owner is the only one who can
finish what an agent started. **Delivered, three of the four:** `approval.evidence`,
`execution.resolve` and `task.accept`. The grant rule split them — `approval.evidence`
is a read and joins the default grant set; `execution.resolve` and `task.accept`
spend the owner's authority and are granted by name.

_Assign a task to an agent_ (#4) is **deferred**. Handing work from one agent
to another is the autonomous-team direction the owner has not asked for, and
a tool that does it would be the first step onto it. The row stays on the
list, with the reason written down here, until the owner asks for it.

**Batch 2 — the resources, now that the owner path tells the truth.**
_Publish a resource_ (#5) and _execute a resource_ (#6). SPEC-RESOURCE-RUN
made the owner path honest: the route refuses a kind that has no such act
and says so, and the panel offers only the actions that can succeed. What is
left is the agent path — a tool that publishes the kinds that have a publish
act and refuses the rest, the way the route does.

**Batch 3 — what the agent waits on and remembers.** _Read the waiting
queue_ (#7), _read an agent's own memories_ (#8), _re-probe an agent's
capabilities_ (#9).

**Batch 4 — the agent's own configuration.** _read one agent connection_
(#10), _update an agent connection_ (#11), _remove an agent connection_ (#12),
_create an agent connection_ (#13), _read the adapter preset catalogue_ (#14).

**Batch 5 — the room.** _Register or replace the bot in a room_ (#15),
_read a room's team_ (#16), _create a conversation_ (#17), _update a
conversation_ (#18), _remove a conversation_ (#19), _add a participant_ (#20),
_override a participant's persona_ (#21), _remove a participant_ (#22).

**Batch 6 — resources and workspaces.** _Validate a resource against its
spec_ (#23), _list resources_ (#24), _read a file's bytes_ (#25), _update a
workspace_ (#26), _create a workspace_ (#27), _read one workspace_ (#28).

**Batch 7 — the product's own reads.** _Read the product's two measures_
(#29), _list automations_ (#30), _update an automation_ (#31), _enable
scheduling_ (#32), _disable scheduling_ (#33), _remove an automation_ (#34).

**Batch 8 — the projections and the board.** _Answer an AG-UI run
interrupt_ (#35), the goals rows (#36–#40), the task rows (#41–#42), _list
conversations_ (#43).

A batch is a delivery, not a document. Each one lands with its own tools,
its own contract publication, its own tests and its own gate result.

## Contract

- **The same grant model, exposed.** No new authority kinds. A read verb joins
  the default grant set; a verb that spends the owner's authority does not,
  and the owner grants it by name — the same rule SPEC-S1 established for
  `bot.dispatch`, `approval.decide` and `execution.stop`.
- **The same scoping.** A tool is bounded to the caller's workspace, exactly
  as the resource tools already are. A tool that names an id names an object,
  not a workspace.
- **The same refusal.** An ungranted call is refused and recorded, the way
  every ungranted call is recorded.
- **The same honesty.** Where a surface is a projection of another surface —
  the goals board — the tool either says so or is exempt with a reason. A
  second wire format for the same data is not a new capability. The feature
  map and the bot team are exempt on that ground already.
- **No provider branches.** Conversation storage and task-provider logic do
  not change when a tool is added.

## Gate

The parity gate, which already exists and already fails closed:

- a published route the coverage table does not answer for is a **failure**;
- a route the server registers and the contract does not publish is a
  **failure**;
- a tool the contracts publish and the server does not register is a
  **failure**, and the reverse is a **failure**;
- a gate that pairs nothing is a **failure** — it has proved nothing.

Each batch reduces the `listed` count. The gate's own report prints the
counts, so the movement is visible rather than asserted.

## Acceptance

- Every route the coverage table lists under `SPEC-S2` is paired with a
  registered tool, in the audit's ranked order, and the `listed` count for
  this spec reaches zero.
- The 17 exempt routes keep their reasons, and each reason is still true.
- The gate runs in CI on the delivered revision and fails closed on a new
  human-only route.
- Each batch's tools are covered by tests: grant refusal, workspace scoping,
  and the refusal of a decide-or-act verb without the owner's grant.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- **The owner path of the resources.** [SPEC-RESOURCE-RUN](resource-publish-execute.md)
  owns it: the routes refuse a kind that has no publish act or no run, and the
  panel offers only the actions that can succeed. What this spec adds is the
  **agent** path for the same two operations — the tool refuses the same kinds
  the route refuses.
- The agent-only operations — `resource.template.list` and
  `resource.template.get` have no owner-facing counterpart. The audit names
  them as the other side of the same complaint, and giving the owner a way to
  read the templates an agent is told to read is a **new owner capability**,
  not parity. It is worth a spec of its own, and it does not have one yet.
- Changing the grant model, the audit's measurements, or the parity gate's
  rules.
- The factory's goals and tasks rollup as a domain. The rows are about the
  agent being able to read the board, not about the board growing.

## Evidence

**Batch 1, delivered in PR #16 on `feature/s2-batch-1`.** Three of the four rows
in batch 1 are paired: `approval.evidence`, `execution.resolve` and
`task.accept`. The fourth, _assign a task to an agent_, stays `listed` with its
reason, and the gate reads it as one of the 40.

**The gate's own report, on the delivered tree.** `npm run verify:mcp-parity`
reads 82 published routes and 82 registered, 26 published tools, **25 paired,
40 listed, 17 exempt, 0 failures**. Before this batch it read 22 paired, 43
listed and 17 exempt.

**The grant rule, held in two halves.** `approval.evidence` is a read, so it is
in the default grant set: a connection with no explicit grants has it, and
`tools/list` says so. `execution.resolve` and `task.accept` spend the owner's
authority, so they are not in the default set, and a connection that was not
given them by name does not have them registered at all — the call is refused
with the MCP server's own "not found", and the refusal is recorded in
`blocked_capabilities` so the owner finds the agent on the waiting list. A
connection granted them by name has them registered and can call them.

**The scope rule, held on all three.** Each of the three names an id, so each
names an object: the object's own row is read to find its workspace, and a
workspace the caller was not granted is refused with the guard's own sentence —
"This agent has no access to that workspace." A refusal leaks nothing: no
summary, no title, and no marker's text. Inside the agent's own workspace the
same three calls still work.

**The same operation, the same objects, the same answer.** The route and the
tool are thin adapters over one shared capability, and the tests compare them
member for member: `approval.evidence` answers with the same
`ApprovalEvidence` the route answers with, `execution.resolve` answers with the
same `{ execution, outcome, detail }` and the same conclusion sentence, and
`task.accept` answers with the same `{ task }`.

**The record names who acted.** `execution.resolve` writes
`execution.outcome.resolved` and `task.accept` writes `task.accepted` (or
`task.rejected`), each with the caller's `actorType` — `human` for the owner's
own route, `agent` for the agent's tool — and the caller's id. The authority
behind an agent's call is the owner's grant of that one verb.

**The policy still governs.** `execution.resolve` and `task.accept` are subject
to the autonomy policy's allowed-actions list and to its approval gate, exactly
as `execution.stop` is. Only `approval.decide` is exempt from the approval
gate, because asking for an approval in order to answer one is a deadlock the
owner cannot break. Nothing in this batch changes the guard.

**The test that holds it.** `apps/server/src/__tests__/mcp-authority-detail-parity.test.ts`
drives the MCP surface itself — 15 cases over the three tools — so the code and
the rule it states cannot drift apart quietly.

**The gates, on the delivered tree.** `npm run typecheck`, `npm run build`,
`npm run format:check`, `npm run verify:contracts` (28 claims),
`npx tsx scripts/verify-contract-pointers.ts` (198 pointers),
`npm run verify:mcp-parity` and `npx tsx scripts/smoke.ts` all pass. The suites
pass one package at a time: contracts 48, agent-adapters 50, server 770,
worker 106, web 207.

**The teeth, shown.** Each of the six rules was broken on purpose, one at a
time, and the named case failed; every break was reverted before the tree was
committed. Dropping `approval.evidence` from the default grant set failed
"gives the default set the read and withholds the two that spend the owner's
authority". Adding `execution.resolve` to it failed that case **and** "refuses a
resolution the connection was not granted" — the ungranted agent closed the
turn. Adding `task.accept` to it failed "refuses an acceptance the connection
was not granted". Removing the scope assertion from `approval.evidence` failed
"refuses the evidence of an approval in a workspace it was not granted";
removing it from `execution.resolve` failed "refuses to close a turn in a
workspace it was not granted, and changes nothing"; removing it from
`task.accept` failed "refuses to accept a task in a workspace it was not
granted, and changes nothing".

**What is not in this batch.** The owner-facing panel does not change: the
grant editor lists the tools it reads from the contracts package, so the three
new verbs are in the owner's grant list the moment they are published, and the
owner's own decision to widen a grant is the same decision it always was. The
web client needed no change, so no bundle or browser gate was run for it.
