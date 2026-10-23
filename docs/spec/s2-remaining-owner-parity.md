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
table already answers for all 82 published owner-facing routes: 22 paired
with a registered tool, 50 listed with a reason and the spec that will pair
them, and 10 exempt with a reason. **This spec moves the listed ones to
paired, in the ranked order, and the gate refuses to pass while any remain
listed under it.**

## The scope, and where it came from

[SPEC-P0](p0-feature-audit.md) measured 83 owner-facing operations and
ranked the human-only ones. Its allocation is explicit:

> **SPEC-S2** — _Remaining owner-surface parity_, a spec to be written after
> SPEC-S1 lands. Its scope is this ranked list: the 45 rows from _Read one
> approval request_ down — 43 human-only rows and the two broken-windows.

So the scope is not a guess. It is the audit's ranked list, and the ranking
is the order.

## The batches

The rows are delivered in the audit's order, because the audit ordered them
by what the owner loses when an agent cannot do it.

**Batch 1 — the authority loop's own detail.** _Read one approval request_
(#3), _read the evidence a decision is taken against_ (#4), _close a turn
whose outcome cannot be confirmed_ (#8), _record an acceptance decision_
(#11), _assign a task to an agent_ (#12). These are the rows where the owner
is the only one who can finish what an agent started.

**Batch 2 — the broken windows.** _Publish a resource_ (#13) and _execute a
resource_ (#14) are **not** in this spec. They are the two broken-windows,
and the audit is explicit that a broken-window is not a parity row:

> anything the audit marks broken-window — those become their own named specs,
> not drive-by fixes.

They are [SPEC-RESOURCE-RUN](resource-publish-execute.md).

**Batch 3 — what the agent waits on and remembers.** _Read the waiting
queue_ (#15), _read an agent's own memories_ (#16), _re-probe an agent's
capabilities_ (#17).

**Batch 4 — the agent's own configuration.** _Update an agent connection_
(#18), _remove an agent connection_ (#19), _create an agent connection_ (#20),
_read the adapter preset catalogue_ (#21).

**Batch 5 — the room.** _Register or replace the bot in a room_ (#22),
_read a room's team_ (#23), _create a conversation_ (#24), _update a
conversation_ (#25), _remove a conversation_ (#26), _add a participant_ (#27),
_override a participant's persona_ (#28), _remove a participant_ (#29).

**Batch 6 — resources and workspaces.** _Validate a resource against its
spec_ (#30), _list resources_ (#31), _read a file's bytes_ (#32), _update a
workspace_ (#33), _create a workspace_ (#34), _read one workspace_ (#35).

**Batch 7 — the product's own reads.** _Read the product's two measures_
(#36), _list automations_ (#37), _update an automation_ (#38), _enable
scheduling_ (#39), _disable scheduling_ (#40), _remove an automation_ (#41).

**Batch 8 — the projections and the board.** _Answer an AG-UI run
interrupt_ (#42), _read the bot team_ (#43), _read the feature map_ (#44),
the goals rows (#45–#49), the task rows (#50–#51), _list conversations_
(#52).

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
  the feature map, the goals board — the tool either says so or is exempt
  with a reason. A second wire format for the same data is not a new
  capability.
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
- The 10 exempt routes keep their reasons, and each reason is still true.
- The gate runs in CI on the delivered revision and fails closed on a new
  human-only route.
- Each batch's tools are covered by tests: grant refusal, workspace scoping,
  and the refusal of a decide-or-act verb without the owner's grant.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- **The broken windows.** They are [SPEC-RESOURCE-RUN](resource-publish-execute.md).
- The agent-only operations — `resource.template.list` and
  `resource.template.get` have no owner-facing counterpart. The audit names
  them as the other side of the same complaint, and giving the owner a way to
  read the templates an agent is told to read is a **new owner capability**,
  not parity. It is worth a spec of its own, and it does not have one yet.
- Changing the grant model, the audit's measurements, or the parity gate's
  rules.
- The factory's goals and tasks rollup as a domain. The rows are about the
  agent being able to read the board, not about the board growing.
