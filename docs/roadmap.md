# The roadmap

**What this is.** Where Personal OS is going, and the order that gets it there.
It is written for two readers: the owner, who decides what gets built, and an
agent that arrives later with no memory of any of it.

**What this is not.** It is not a wish list, and it does not replace
`docs/strategy.md`, which records _why_ the product wants what it wants and
which landscape artefacts were read to decide that. It does not replace
`PRODUCT.md`, which owns the question of what the product is. It is the
sequence: what is built next, and why that order.

---

## The shape of the thing

Personal OS is a self-hosted, agent-native control panel and a personal
software factory. One product, two halves:

- **The control plane.** Goals, work, conversations, resources, automations,
  approvals, events. An owner sees what is in flight and what is waiting on
  them.
- **The factory.** The repository, the CI, the work items, the roles. Code work
  is recorded and checked here.

`ADR 0010` draws the line between them with seven boundaries. The short
version: **the instance never builds, merges, deploys or restarts itself, and
the repository remains the state.** Every item below is inside one of those
boundaries.

### The five domains

`ADR 0008` names five. They are the load-bearing structure — they are what
lets work be split across parallel lanes without two agents writing one file.

| Domain      | Owns                                                            |
| ----------- | --------------------------------------------------------------- |
| Interaction | conversations, messages, approvals, the waiting list, the panel |
| Work        | goals, tasks, executions, the factory loop                      |
| Resources   | resources of every kind, their templates, their history         |
| Runtime     | adapters, connections, the event log, automations               |
| Substrate   | auth, workspaces, capabilities, the database, the config        |

A module nobody classified, a table nobody claimed, or a crossing nobody
declared **fails the build** (`apps/server/src/domains.ts`, checked by
`apps/server/src/__tests__/domains.test.ts`). That is a mechanism, not a
convention, and it is what makes the lanes safe to run in parallel.

---

## The four horizons

Each horizon is a shape the product takes. A horizon is done when the shape
holds, not when a feature list is checked off.

### Horizon 1 — The panel is the product (mostly landed)

The owner opens one surface and sees what is happening and what needs them.
Three rooms — **Rooms, Work, and the Needs-you rail** — plus the material
that makes them coherent. This is the Forge direction, and the six briefs in
`prototypes/briefs/` are its pieces.

Landing order, from the briefs themselves: material first (everything else
draws on its tokens), rooms second (the rail, the trace, the dashboards and
the constellation all need a room to move into), constellation last (the
hardest piece, and it benefits from settled material).

**The gap this horizon closes:** the product is currently a set of parts that
do not yet read as one surface.

### Horizon 2 — The agent is a peer, not a guest (in flight)

The instance reaches any agent over MCP. The `mcp` adapter
(`packages/agent-adapters/src/mcp.ts`) makes any MCP server an agent
connection, so connecting a new agent is a trust decision rather than an
integration project. `ADR 0009` makes MiniMax Code a _specification_: the
patterns are borrowed, the dependency is not.

On top of the connection, the **interaction model** — one published contract
(`CONTRACTS.md`, Contract 7) that says what an agent can observe, when it is
asked for a decision, and what it may not do. `WI-055` implements it;
`WI-056` gives a turn a context budget and a tool eligibility chain.

**The gap this horizon closes:** agents are connected and supervised, but the
interaction between them and the panel is still ad hoc.

### Horizon 3 — The factory runs on the product (funded, partly built)

The instance knows what is wanted, what is in flight, what evidence exists and
what is waiting on the owner — and the repository and CI do the work. The
product's own ledger and the repository's work items refer to each other by
id, one link each way, in the direction each record owns (`B6`).

What makes this safe is that the instance **cannot** apply its own changes
(`B1`), migrations are owner-accepted and never agent-applied (`B3`), and the
roles keep their own host so an outage of every role still leaves the instance
able to say what it is waiting for (`B7`).

**The gap this horizon closes:** the factory's work and the product's work are
two ledgers that do not yet see each other.

### Horizon 4 — The product improves itself (bounded, and the refusal)

An agent inside the instance may propose a change to the instance. It may not
apply, merge, deploy or restart it. `ADR 0010` and
`docs/self-improvement.md` carry the procedure and the proof for each
boundary — including the one that is most likely to be forgotten: **rollback
is one command that works while the instance is down** (`B2`), and its proof is
a rollback actually executed with the instance stopped.

The honest ceiling: `docs/self-improvement.md` names what is proved and what
is still open (`WI-061`). A runbook describing a rollback nobody has run is a
claim, not a procedure.

**The gap this horizon closes:** today the product cannot propose changes to
itself without the risk that a bad change destroys the thing that would
repair it.

---

## The order, and why it is this order

The horizons are not independent, and the order is forced by three facts.

**The panel lands before the interaction model.** The interaction model
describes what an agent does in a conversation and what the owner sees when
an agent needs a decision. If the panel is not yet a surface, there is nowhere
for that to appear. Horizon 1 before Horizon 2.

**The interaction model lands before the factory runs on the product.** The
product's factory loop needs to tell an agent what it may do — that is the
interaction model. Horizon 2 before Horizon 3.

**The factory runs on the product before the product improves itself.** The
last horizon is the one that can destroy the thing that would repair it. It
needs the two planes from `ADR 0010` already standing, and it needs the
recovery path proven rather than described. Horizon 3 before Horizon 4.

The one thing that does not wait: **the pipeline.** It is not a horizon, and
it is not the product. It is the thing that makes everything else land — the
queue a program can read, the dispatcher that records its own failures, the
one number space, a CI verdict that can be read. It is
`docs/free-period-plan.md`, and it is Day 1.

---

## What is funded, and what is not

The record of what is actually wanted lives in `docs/strategy.md`, in the
wants table. This is the shape of it, for the agent deciding what to pick up.

| Want | Item   | State                                             |
| ---- | ------ | ------------------------------------------------- |
| W1   | WI-033 | accepted, resized — lands after W2                |
| W2   | WI-034 | accepted, rescoped — lands before W1              |
| W3   | WI-035 | deferred — the largest; the deferral was capacity |
| W4   | WI-007 | folded — the same subject under another name      |
| W5   | WI-036 | accepted — lands before W7                        |
| W6   | WI-037 | accepted — the cheapest and most overdue          |
| W7   | WI-038 | accepted — the gate                               |
| W8   | WI-044 | funded, deferred — the licence check              |

**W3's deferral should be re-examined.** It was deferred because one
implementer meant one item at a time. That reason is a fact about the factory,
not about the work, and it stops being true the moment the lanes run in
parallel. A deferral for capacity should be revisited when the capacity
changes — otherwise it becomes a decision nobody made.

**A want with no work item behind it is a wish.** Two of the owner's settled
decisions had no work item at all when the queue was last reviewed against
them. When the owner settles something, it gets an item, an owner and a slot
in the order.

---

## The rules that hold across every horizon

These are not preferences. Each one exists because the alternative was tried
and it cost something.

- **An agent's "done" is a proposal.** Everywhere. The factory's work items
  and the product's tasks obey the same rule.
- **The revision number is the concurrency guard.** Every resource update
  carries the revision it was based on. Do not optimise the check away.
- **A gate that fails is a finding, not an obstacle to route around.** No
  deleting a test to make a suite pass, no widening a lint rule, no disabling
  a CI job that fails.
- **A contract change is a product decision.** It needs a migration plan, a
  `CONTRACTS.md` update, and usually an ADR.
- **Credentials are never returned.** A client that wants to change a
  credential sends the new value; the server replaces the record.
- **One file, one live item.** Ownership exists to stop two agents writing
  the same file at the same time.
- **The repository is the state.** An instance task and a repository work item
  refer to each other by id; neither is reconstructed from the other.
- **Borrow the idea, not the dependency.** Read it, take the approach, build
  our own.

---

## For an agent arriving with no memory

1. `AGENTS.md` — the contract. Short, and it is binding.
2. `FACTORY.md` — how the factory works, and who owns what.
3. `.factory/queue.json` — the machine-readable state of every work item.
4. `docs/domains.md` — the five domains, and the rule that a module nobody
   classified fails the build.
5. `docs/self-improvement.md` — the runbook, with what is proved and what is
   still open.
6. `docs/free-period-plan.md` — what the current window is for.
7. `.factory/work/WI-*.md` — the item you are about to do.

Pick an item from the queue that is in `triage`, in your lane, with no
`blockedBy`. Ask Chief for a number. Work in a worktree. Prove it with the
gates. Push your branch. Report with the actual output.

The point of this document is that an agent which has never spoken to the
owner can still do the right thing, and the owner can still see why.
