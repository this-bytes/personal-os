# Strategy — what Personal OS is, and where it goes

**Status:** a direction for the owner to settle and the factory to iterate on. It is
not a decision, it changes no published contract, and it opens no work item.
**Written by:** the root session, at the owner's request — _"take inspiration from
other opensource projects and bring it all together in a single pane of glass."_
**Written against:** commit `cc973f3`, clean working tree.
**House owner:** Wren (`docs/**`). This is a draft for the factory to adopt; Probe
reviews it before Chief accepts it.

---

## The answer

> **Personal OS is an environment that one person's agents operate and extend.**
> — [PRODUCT.md](../PRODUCT.md)

The owner settled that on 2026-10-20, and everything decided since has been a
consequence of it. Four clauses carry the whole product:

1. **The human decides; agents do the rest.** The owner directs, approves and
   accepts. Agents operate, extend and repair. Connecting a new agent is a trust
   decision, not an evaluation.
2. **Native means typed and checked.** An agent-created feature is a typed,
   validated resource in our own contracts — never a surface invented for agents.
3. **Everyday productivity means tasks/work and documents.** Not email, not
   calendar; both excluded on purpose.
4. **The product reports on itself.** The share of features authored by agents
   in-instance, and the share of operations done without the owner touching code.
   Both shown in the panel.

**What it is not**, and these are boundaries rather than gaps: not a chat home, not
multi-user, not a workflow editor, not an inference engine, not a plugin
marketplace, and never a fork of someone else's protocol. An interface is
conformed to, never reimplemented.

**The one sentence that carries the rest of this document.** _Personal OS is the
place where one person's agents do the work, the owner's decisions are the only
authority in it, and the instance can be seen from the inside._

---

## The landscape — where each idea came from

The rule that governs this table is the owner's (Q5, 2026-10-20) and the factory's:
**borrow the idea, not the dependency.** Every row is a project we read and took an
approach from. None is vendored, and none is a runtime dependency.

The licence column was read from each repository on **2026-10-21**, not from a
directory listing. Two of them are not open source at all, and that is the point of
reading them.

| Project                                                                                | Licence, read from the repository                         | What we took                                                                                                                                 | Where it lands here                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Backstage](https://backstage.io)                                                      | Apache-2.0                                                | _"A single pane of glass for all your infrastructure"_ — a catalog of what exists, plus a scaffolder that turns a template into a real thing | The template record (WI-017); the panel's orientation room         |
| [Home Assistant](https://www.home-assistant.io)                                        | Apache-2.0                                                | The home as one surface; everything becomes an entity; an automation is trigger → condition → action                                         | The waiting list, the automations, the Needs-you rail              |
| [n8n](https://github.com/n8n-io/n8n)                                                   | **Sustainable Use — not OSI**                             | Validate-before-deploy, copy-before-edit, a version history per workflow                                                                     | WI-017's templates; the acceptance boundary                        |
| [Temporal](https://github.com/temporalio/temporal)                                     | MIT                                                       | A durable execution that survives the human's wait; the event history _is_ the record; a signal delivers the decision                        | The resume the contract already promises (C-01)                    |
| [NetBox](https://github.com/netbox-community/netbox)                                   | Apache-2.0                                                | A source of truth deliberately kept separate from the running system; every change logged                                                    | The ledger's revision and audit rules                              |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands)                                 | MIT                                                       | The event stream as Action/Observation; a sandbox the agent works inside; reusable, trigger-activated skills                                 | The event log (ADR 0005); the skill layer, not built               |
| [Langfuse](https://github.com/langfuse/langfuse)                                       | MIT, except `ee/`                                         | Traces → evaluations → datasets → a fix, one loop from a production signal                                                                   | Q6's two measures                                                  |
| [Dify](https://github.com/langgenius/dify)                                             | **Modified Apache-2.0 with additional conditions**        | One collaborative workspace where an agent builds the thing; observability embedded rather than bolted on                                    | The shape of the environment; the licence warning                  |
| [Windmill](https://github.com/windmill-labs/windmill)                                  | **Apache-2.0 + AGPLv3 + proprietary** enterprise features | Scripts are first-class, and a typed signature generates the form                                                                            | Windmill's AGPL is why it is an inspiration and never a dependency |
| [Letta](https://github.com/letta-ai/letta)                                             | Apache-2.0                                                | Agent memory the agent owns, kept in files, editable by the human                                                                            | WI-012's memory scope                                              |
| [LangGraph](https://github.com/langchain-ai/langgraph)                                 | MIT                                                       | A durable agent with checkpoints and interrupts, so a human can be put in the loop mid-run                                                   | The resume the contract already promises (C-01)                    |
| [MCP Apps (SEP-1865)](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) | A proposal, not a ratified standard                       | A server ships `ui://` templates the host reviews before execution, and the host's approval gate stays in front of any UI-initiated call     | PRODUCT.md §9                                                      |

**What the 2026-10-20 sweep lost.** That sweep read twelve comparators and three
findings survived into ADR 0007 and INTAKE.md. The list itself did not survive:
`prototypes/DIRECTION.md` was rewritten for Forge and the sweep went with it, and
[WI-011](../.factory/work/WI-011.md) still points at that file as its source. **This
table is the sweep, redone and made durable.** It is the answer to a question the
repository could no longer answer: _which projects is this built on, and what does
each licence permit?_

**The licence reality is the reason Q5 is right.** n8n's licence file says it is
"not licensed under any of the main open source licenses". Dify's says it is
"licensed under a modified version of the Apache License 2.0, with the following
additional conditions". Windmill's says its source is "variously licensed" across
Apache-2.0, AGPLv3 and a proprietary enterprise licence. A licence can change what
the product is — and one hard case is the owner's to decide: vendoring AGPL-3.0 code
into this repository changes this project's licence.

---

## The three pillars

Each pillar is a borrowed pattern, what the product already has, and what it does
not have. Where a pillar's gap is already funded, the work item is named. Where it
is not, the want is named. Every item named here is either dispatched or proposed
in [the wants](#the-wants-this-direction-produces) — none is invented twice.

### Pillar 1 — A checked example, not a schema

**The borrowed pattern.** Backstage's scaffolder: a template is not a schema, it is
an example that a human reviewed. Windmill: a typed signature generates the form,
so the shape of a good thing is given rather than guessed. OpenHands: skills are
reusable and trigger-activated.

**The rule we already hold.** _An agent-authored artefact does not exist until
something has checked it_ (PRODUCT.md §8). The ledger is where the product already
does this — goal → task → execution → evidence → acceptance.

**What we have.** WI-017 (the template record, the MCP surface, the validation) and
WI-030 (the published shape). Both dispatched 2026-10-21.

**What we do not have.** A template set. WI-017's last acceptance criterion says the
report states which template set ships; WI-030 says which kind goes first is the
owner's call. **The item waits on the owner's word** — see open decision 1.

### Pillar 2 — One truth, one history, and a way back

**The borrowed pattern.** NetBox: a source of truth kept deliberately separate from
the running system, with every change logged and validated before it lands.
Temporal: a durable execution that survives the human's wait, so a decision
_resumes_ the work rather than ending it. n8n: a version history per workflow,
because "AI makes a small edit — and something else breaks".

**What we have.** The ledger. The event log doubling as the stream (ADR 0005).
`revision` with `expectedRevision` on resources. `auditLog`.

**What we do not have — and the product says so rather than smoothing it over.**

- The revision handling is **not uniform**: a resource update compares
  `expectedRevision` and refuses on a mismatch, but an automation update increments
  its revision and never compares it, so the last write wins (PRODUCT.md §4).
- The worker's own `resource.refresh` updates the row with **no revision bump and
  no audit entry** (PRODUCT.md §4).
- There is **no history** to look back at and **no way to take something back**
  (C-21).
- An approval **closes** its execution rather than resuming the interrupted turn,
  while the published contract promises the resume — a drift the repository already
  records (ARCHITECTURE.md §9, C-01).

**The wants.** W3 (history and take-back, scoped to resources) and W4 (the resume
the contract already promises).

### Pillar 3 — The instance can see itself

**The borrowed pattern.** Langfuse: one loop from a production signal to a fix —
traces, evaluations, datasets, human annotation. Dify: observability embedded in
the workspace rather than bolted on beside it.

**What we have.** WI-020 (the read-only measures route and the band on the home)
and WI-030 (the published shape). Both dispatched 2026-10-21.

**What we do not have.** The data the measures read is **partly wrong**:

- Two of the six resource kinds record their author as `system`, so for
  automations and tasks the first measure is **wrong, not merely uncounted**
  (PRODUCT.md §7).
- Twelve of the thirty-four mutating routes write **no audit entry** at all
  (PRODUCT.md §7).
- Every audit entry written today records a **success whether the action succeeded
  or not** — `POST /api/resources/:id/execute` records one for a run that was
  merely queued (PRODUCT.md §7).

**The wants.** W1 (make the data true) and W2 (publish the rules, so the measures
route reads something true). WI-030 already requires the published entry to state
plainly what the reading cannot cover; W1 and W2 are what remove the caveat.

---

## The single pane of glass

There are two panes, and the bridge between them is this document.

**The product's pane of glass is the panel.** The owner chose **D — Forge** on
2026-10-21, against the factory's recommendation of B — Desk, and the
recommendation was the owner's to reject. Forge is an orientation room and an
execution room held together by one material, with a Needs-you rail that carries
the decision controls. The rule it settled: _if it is a picture of the system, it
is in the orientation room; if it is a place where work is inspected or decided, it
is in the execution room._

**This document is the factory's pane of glass.** The product's identity is spread
across six files and two thousand lines of intake, and no reader can hold it at
once:

| Where it lives                                                                           | What it holds                        | What it does not hold                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| [PRODUCT.md](../PRODUCT.md)                                                              | what the product owns, who it serves | where it is going                                                         |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                                    | how it fits together                 | what it is for                                                            |
| [docs/decisions/0007-\*.md](decisions/0007-the-environment-agents-operate-and-extend.md) | the ground it stands on              | the shape of the panel                                                    |
| [prototypes/DIRECTION.md](../prototypes/DIRECTION.md)                                    | the panel's visual direction         | the OSS landscape — it was rewritten for Forge and the sweep went with it |
| [.factory/INTAKE.md](../.factory/INTAKE.md)                                              | every decision, in order             | anything a reader can hold at once                                        |

**The bridge.** The three pillars are the product's next three moves. Each pillar's
"what we have" is a work item that is already dispatched; each pillar's "what we do
not have" is a want below. This document is the line between them.

---

## The open decisions

Two, and both are the owner's.

**1. Which resource kinds get the first template set?** WI-017 needs the answer to
close its last criterion and WI-030 defers it explicitly.

> **Recommendation: document first, then automation.** Documents are Q4's everyday
> output and the simplest spec to hold an example of. Automation is second because
> it is the kind whose update path is wrong today — last write wins, and no audit
> entry — so a reviewed example there is worth more than one elsewhere.

**2. Is the borrow rule a claim, or a check?** Today it is a claim, written in
FACTORY.md and PRODUCT.md, and C-13 says nothing verifies it. The owner's own hard
case — vendoring AGPL-3.0 code changes this project's licence — is exactly what a
check would catch.

> **Recommendation: make it a check.** Record each dependency's licence read from
> the repository, and let CI fail when a licence changes. That turns a doctrine
> rule into a fact the build can prove.

---

## The wants this direction produces

Recorded as wants, in the format `.factory/TASK.md` asks for: a proposed title, an
owner and acceptance criteria. **The number space has one owner**, and the session
that owns it opens and numbers the items; this document does not take numbers and
does not claim any.

### W1 — The audit trail records what happened, not that something happened

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Every mutating route writes an audit entry, and the entry carries the **outcome**
rather than an assumed success. Every resource kind records a real author, so no
kind reports `system` for an agent's work. The twelve routes that write no entry
write one.

**Acceptance:** each of the thirty-four mutating routes writes an entry; an entry
records whether the action succeeded, and `POST /api/resources/:id/execute` records
`queued` rather than `done`; automations and tasks carry the author who created
them; a test proves each of those three.

### W2 — Publish the authorship and audit rules that W1 implements

**Owner:** Wren. **File:** `CONTRACTS.md`.

The authorship column and the audit trail are read by WI-020's measures route, so
what they mean has to be published before the route is trusted: what "authored by an
agent" counts as, what an audit entry's outcome can be, and what a client written
before the change must do. A migration note, as always.

**Acceptance:** the entries land before the code ships; they match the code member
for member; the migration note says what a client written before does and what a
record written before the change means; nothing is reclassified.

### W3 — Resources keep a history the owner can take back

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Each revision of a resource is retained rather than overwritten, and the owner can
restore a resource to an earlier revision through a published route. The restore is
itself an audited action. This is C-21, scoped to resources; tasks and automations
are named in the item's "not in scope" and are not this.

**Acceptance:** a resource's revisions are retrievable; the restore route publishes
the revision it restored and is audited like any other change; a test proves a
restore returns the resource to the earlier revision's spec and that the audit
trail says the restore happened.

### W4 — An approval resumes the turn the contract says it resumes

**Owner:** Cog. **Files:** `apps/server`, `packages/agent-adapters`.

CONTRACTS.md already promises that a decision resumes the turn when the adapter
reports `persistentSessions`. The code closes the execution instead. This item makes
the code keep the promise, for the adapters that can keep it; for the adapters that
cannot, the contract's wording is corrected rather than the behaviour faked.

**Acceptance:** for an adapter reporting `persistentSessions`, a decision re-enters
the adapter and the turn continues; for one that does not, the published wording
says so; a test proves the resume for the first and the published exception for the
second.

### W5 — The dependency licences, read from the repositories

**Owner:** Wren. **File:** `docs/strategy.md`, and a note in PRODUCT.md §10.

Each dependency in the lockfile has its licence read from the repository and
recorded here, with what that licence permits and what it forbids — and the
landscape table above is brought under the same rule, because a comparator's
licence is part of what it teaches.

**Acceptance:** every dependency in the lockfile has a licence recorded and
attributed to the file it was read from; the AGPL question the owner raised is
answered against the actual dependency set; a note in this document says when the
column was read.

### W6 — The product record says Desk (B); the owner chose Forge

**Owner:** Wren. **File:** `PRODUCT.md`.

PRODUCT.md §11 still says the direction that would fix the accent is "Desk (B), it
is recommended rather than decided, and the owner has one word to say about it". The
owner said their word on 2026-10-21: **D — Forge**. A product record that states
the opposite of the decision is the one thing it cannot carry.

**Acceptance:** §11 names Forge, with the date and the fact that the factory
recommended B; the accent rule's statement matches ADR 0007; nothing else in the
product record is changed in the same item.

---

## What this document does not do

- It does not change a published contract, and it does not settle anything the owner
  has not settled.
- It does not replace PRODUCT.md, ARCHITECTURE.md or ADR 0007. It points at them.
- It does not re-scope WI-017, WI-020 or WI-030, which are dispatched.
- It does not open a work item, and it takes no number. The wants above are wants.
- It does not name a product the factory should not build. It names three pillars,
  the gap in each, and the item that closes it.

---

## How the factory iterates on this

- **The repository is the state.** A decision that changes this document is written
  here first, with the commit, and the work item behind it names this document.
- **A want is judged before it is built.** Chief decides whether each want above is
  worth doing, and a want that is declined keeps its reason.
- **When a pillar's "what we do not have" becomes "what we have", this document
  changes** — the same way ADR 0007 changed when the owner said Forge.
- **The landscape is re-read when a source changes behaviour**, not on a schedule.
  The licence column was read on 2026-10-21; a licence can change what the product
  is, which is why W5 keeps it honest rather than leaving it to a reader's memory.
