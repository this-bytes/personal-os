# Strategy — what Personal OS is, and where it goes

**Status:** a direction for the factory to iterate on. **The two decisions this
document raised are settled and recorded below**; the rest of it is not a decision,
it changes no published contract, and it opens no work item.
**Written by:** the root session, at the owner's request — _"take inspiration from
other opensource projects and bring it all together in a single pane of glass."_
**Written against:** the tree at `cc973f3` — the commit immediately before this
document was created by `287c55c`.
**House owner:** Wren (`docs/**`). **Probe reviewed this document on 2026-10-21**
and raised six defects and six observations; every one that was a real defect is
fixed in the commit that carries this line, and the observations are answered where
they belong in the text. The review was requested from this session, so it is not in
the ledger. **Chief's acceptance is still open.**

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
| [Backstage](https://backstage.spotify.com/discover/backstage-101)                      | Apache-2.0                                                | _"A single pane of glass for all your infrastructure"_ — a catalog of what exists, plus a scaffolder that turns a template into a real thing | The template record; the panel's orientation room                  |
| [Home Assistant](https://www.home-assistant.io)                                        | Apache-2.0                                                | The home as one surface; everything becomes an entity; an automation is trigger → condition → action                                         | The waiting list, the automations, the Needs-you rail              |
| [n8n](https://github.com/n8n-io/n8n)                                                   | **Sustainable Use — not OSI**                             | Validate-before-deploy, copy-before-edit, a version history per workflow                                                                     | The templates; the acceptance boundary                             |
| [Temporal](https://github.com/temporalio/temporal)                                     | MIT                                                       | A durable execution that survives the human's wait; the event history _is_ the record; a signal delivers the decision                        | The resume the contract already promises (C-01)                    |
| [NetBox](https://github.com/netbox-community/netbox)                                   | Apache-2.0                                                | A source of truth deliberately kept separate from the running system; every change logged                                                    | The ledger's revision and audit rules                              |
| [OpenHands](https://github.com/OpenHands/OpenHands)                                    | MIT                                                       | The event stream as Action/Observation; a sandbox the agent works inside; reusable, trigger-activated skills                                 | The event log (ADR 0005); the skill layer, not built               |
| [Langfuse](https://github.com/langfuse/langfuse)                                       | MIT, except `ee/`                                         | Traces → evaluations → datasets → a fix, one loop from a production signal                                                                   | Q6's two measures                                                  |
| [Dify](https://github.com/langgenius/dify)                                             | **Modified Apache-2.0 with additional conditions**        | One collaborative workspace where an agent builds the thing; observability embedded rather than bolted on                                    | The shape of the environment; the licence warning                  |
| [Windmill](https://github.com/windmill-labs/windmill)                                  | **Apache-2.0 + AGPLv3 + proprietary** enterprise features | Scripts are first-class, and a typed signature generates the form                                                                            | Windmill's AGPL is why it is an inspiration and never a dependency |
| [Letta](https://github.com/letta-ai/letta)                                             | Apache-2.0                                                | Agent memory the agent owns, kept in files, editable by the human                                                                            | The agent's own memory                                             |
| [LangGraph](https://github.com/langchain-ai/langgraph)                                 | MIT                                                       | A durable agent with checkpoints and interrupts, so a human can be put in the loop mid-run                                                   | The resume the contract already promises (C-01)                    |
| [MCP Apps (SEP-1865)](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) | A proposal, not a ratified standard                       | A server ships `ui://` templates the host reviews before execution, and the host's approval gate stays in front of any UI-initiated call     | PRODUCT.md §9                                                      |

**The last column names the subject, not the item number.** A work item's number
is a claim on a space that moves; the subject is what the idea becomes. Where a
stable anchor exists it is used instead — a candidate id, an ADR, a section of the
product record.

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
the product is.

**This repository's own licence is unsettled, and the record says so rather than
implying otherwise.** The root `LICENSE` file (MIT) was tracked since the initial
commit and was **removed** on 2026-10-21 — it granted a licence nobody had chosen,
and it had no owner in the ownership table, which `FACTORY.md` now fixes by naming
it. That removal rests on a reading the owner has been asked to confirm: _the
repository carries no licence file_, rather than _it is not adding one now_. The root
manifest's `"license": "MIT"` was removed earlier the same day, for the same reason.
The README says the licence is deliberately undecided and that the repository is
private for now — a correction that tells the truth rather than a licence that was
never chosen — and `CONTRIBUTING.md` still claims MIT, which WI-068 is correcting.
And the owner's answer at 08:54 was _"Private for now — push it, and decide
visibility later."_ None of that is settled, and a licence gate that reads the
dependency set cannot speak to any of it.

**The owner's hard case, and what can actually catch it.** Vendoring AGPL-3.0 code
into this repository's own tree changes this project's licence. **A gate over the
dependency set cannot catch that** — vendored source is not a dependency and is not
in the lockfile. It needs a separate check over this repository's own sources, which
is [WI-044](#w8--the-check-that-covers-this-repositorys-own-sources) — funded and
numbered, and not dispatched. The gate is worth having on its own terms, but naming
it as the answer to the vendoring question would be a claim the check cannot back.

---

## The four pillars

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
WI-030 (the published shape) — WI-030 **done** (`e682224`), WI-017 **verified** and
waiting on acceptance.

**What we did not have, and now do.** A template set. WI-017's last acceptance
criterion says the report states which template set ships; WI-030 says which kind
goes first is the owner's call. **The owner answered: all six kinds get a template
in the first set** (2026-10-21) — wider than the factory recommended, and the
recommendation was the owner's to reject; see decision 1.

**The set that ships, and the state it is in.** WI-017 has built one template per
kind, all six: `dashboard.metrics`, `document.brief`, `data-source.json`,
`automation.manual-prompt`, `task.deliverable`, `memory.decision-note` — against
WI-030's landed contract entry. **The item is built, verified, and not yet
accepted**: Probe's verification ran on 2026-10-21 and **all seven criteria hold**,
and the criterion no test met is now met by a test Probe wrote (`052f050`, eleven
cases), with two of the pins proved to bite and then restored. **What the
verification found is the contract's status paragraph, which is false in every
clause** — and that is a separate item, opened because WI-017's implementation
landed before the contract's statement about it did: the same drift the pipeline
caught in the published counts. **That item was opened as WI-063 and renumbered to
WI-065**, because the number was claimed twice at once. This pillar's gap is
closing, not closed, and this document should not be read as saying the template
half is finished.

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
the contract already promises). W4 was folded into WI-007, which is the same
subject; W3 became WI-035 and is **deferred behind Forge** on capacity, so this
gap is still open.

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
route reads something true) — now WI-033 and WI-034, with W2 first because the
contract leads. WI-030 already requires the published entry to state plainly what
the reading cannot cover; W1 and W2 are what remove the caveat.

### Pillar 4 — The decision shows the evidence it is taken on

**The borrowed pattern.** OpenHands' event stream and Langfuse's traces: an agent's
work is a sequence of actions and observations, not a claim about what it did.
NetBox's change log: a decision is made against evidence that is on the record.

**What we have.** The event log doubling as the stream (ADR 0005), and the Needs-you
rail that carries the decision controls (Forge).

**What we do not have.** The decision control does not show the evidence the decision
is taken on. The owner can approve, but not see what they approved.

**The items.** WI-039 — publish the evidence a decision is taken against — and
WI-040 — the decision control shows the evidence it decides on. Both were raised by
Vision's review of this strategy and numbered so they are not lost; the contract
leads, so WI-040 waits for WI-039, and Cog's lane already carries WI-017, WI-020
and WI-024.

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
across five files and an intake log of more than three thousand lines, and no reader
can hold it at once:

| Where it lives                                                                           | What it holds                        | What it does not hold                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| [PRODUCT.md](../PRODUCT.md)                                                              | what the product owns, who it serves | where it is going                                                         |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                                    | how it fits together                 | what it is for                                                            |
| [docs/decisions/0007-\*.md](decisions/0007-the-environment-agents-operate-and-extend.md) | the ground it stands on              | the shape of the panel                                                    |
| [prototypes/DIRECTION.md](../prototypes/DIRECTION.md)                                    | the panel's visual direction         | the OSS landscape — it was rewritten for Forge and the sweep went with it |
| [.factory/INTAKE.md](../.factory/INTAKE.md)                                              | every decision, in order             | anything a reader can hold at once                                        |

**The bridge.** The four pillars are the product's next four moves. Each pillar's
"what we have" is a work item that is already dispatched; each pillar's "what we do
not have" is a want below. This document is the line between them.

---

## The decisions

Two, both the owner's, **both answered on 2026-10-21**.

### 1. Which resource kinds get the first template set?

**The owner's answer: all six at once.** One template per resource kind —
dashboard, document, automation, data-source, task, memory — in the first set.

**This overrides the factory's recommendation**, which was document first, then
automation: documents are Q4's everyday output and the simplest spec to hold an
example of, and automation is the kind whose update path is wrong today — last
write wins, and no audit entry — so a reviewed example there is worth more than
one elsewhere. The recommendation was the owner's to reject, and it was rejected.
The reason to keep the recommendation on the record is the one this factory keeps
every recommendation on: the owner deserves the record of what was rejected on
their behalf, and WI-017's last criterion is now answered by the answer rather
than by the factory.

**What the answer costs, stated plainly.** Six templates is six reviewed examples
to write, and the two kinds nobody authors as a feature yet — task and memory —
are examples of a good thing whose writer has not been seen doing it. A template
for those two is a guess. That is the trade the owner made, and it is recorded
here rather than argued against.

**WI-017 needs this to close its last criterion and WI-030 defers it explicitly.
Both now have the answer.**

### 2. Is the borrow rule a claim, or a check?

**The owner's answer: make it a check.**

Today it is a claim, written in FACTORY.md and PRODUCT.md, and C-13 says nothing
verifies it.

So the borrow rule becomes a fact the build proves: each dependency's licence is
recorded read from its repository, and the build fails when a licence changes or an
unapproved one appears. That splits into two wants, because the record and the gate
are different files and different owners — W5 records it, W7 checks it.

**The record half is done and accepted; the gate is in flight.** WI-036 wrote the
record — 494 packages, one copy, in `docs/dependency-licences.json` — and it was
**accepted** on 2026-10-21: Probe re-derived the numbers its own way rather than
trusting the record, and **all five criteria hold**.
**WI-038 (W7) is the half that makes this a check rather than a record, and it has
started**: the CI step and the root manifest entry are written on
`wi/038-borrow-rule-gate`, and the gate script is **queued, not written** — its
first brief was cancelled because it stated one fact about the record wrongly, and
the corrected brief is waiting. **Until that script lands and the gate runs, the
borrow rule is a claim with a ground truth attached, and not a fact the build
proves.**

**What the check does not cover, said before anyone assumes that it does.** It reads
the **dependency set**. The owner's hard case — vendoring AGPL-3.0 code into this
repository's own tree — is not a dependency, is not in the lockfile, and is outside
what this gate can see; catching it needs a separate check over this repository's
own sources, which is [WI-044](#w8--the-check-that-covers-this-repositorys-own-sources)
— funded, numbered, and not dispatched. A gate is not a proof of the whole borrow
rule, and calling it one would be exactly the kind of claim this document exists to
stop.

---

## The wants this direction produces

Recorded as wants in the reduced form: a proposed title, an owner and acceptance
criteria. **That is not the full format `.factory/TASK.md` asks for** — that also
requires _Not in scope_ and _Gates_, and the wants below carry neither. They were
triage input; **each became a work item in the full format**, which is where the
scope and the gates live.
**The number space has one owner**, and the session that owns it opens and numbers
the items; this document does not take numbers and does not claim any.

**Eight wants.** Six came out of the gap analysis; **W7 came out of the owner's
answer** that the borrow rule becomes a check, and it is a separate want because
the record and the gate are different files with different owners; **W8 came out of
this document's own review**, because the gate as specified cannot see the owner's
hard case.

### Where the wants went

**Seven wants, triaged on 2026-10-21 09:25, and numbered.** The lead's verdict, its
titles, its owners and its criteria are recorded in `.factory/INTAKE.md` under _"The
seven wants, triaged"_, and each item below now carries the want it came from. W8
came out of this document's own review and was numbered later, as WI-044.

| Want | Verdict              | Item                                 | Owner | Note                                                                                                                                                                                                                          |
| ---- | -------------------- | ------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1   | accepted, resized    | [WI-033](../.factory/work/WI-033.md) | Cog   | The change behind the product's own report. Lands **after** W2 — the contract leads.                                                                                                                                          |
| W2   | accepted, rescoped   | [WI-034](../.factory/work/WI-034.md) | Wren  | The published shape for W1. Lands **before** W1. **Rescoped at 11:10** — it publishes the outcome vocabulary and the migration note, not the authorship definition, which WI-030 already published.                           |
| W3   | **deferred**         | [WI-035](../.factory/work/WI-035.md) | Cog   | The largest of the seven. Starts after Forge. **The deferral is capacity, not judgement** — Cog's lane is full — and it is numbered so it is not lost.                                                                        |
| W4   | **folded**           | [WI-007](../.factory/work/WI-007.md) | Cog   | The same subject under a different name. **The fold is recorded in `.factory/INTAKE.md`, not in WI-007's own file** — that item does not yet name the fold, which is a gap in the item, not in this record.                   |
| W5   | **accepted**         | [WI-036](../.factory/work/WI-036.md) | Wren  | The record the gate compares against. **Accepted** — Probe re-derived the numbers its own way rather than trusting the record: 494 packages, one copy, in `docs/dependency-licences.json`. Lands **before** W7.               |
| W6   | **accepted**         | [WI-037](../.factory/work/WI-037.md) | Wren  | The cheapest item in the set and the most overdue. **Accepted** — all four criteria hold and nothing else in the product record changed: the product record now says Forge.                                                   |
| W7   | accepted, in flight  | [WI-038](../.factory/work/WI-038.md) | Chief | The gate. Lands **after** W5 — a gate that compares against nothing catches nothing — and W5 has landed, so it can. The CI step and manifest entry are written; the gate script is **queued, not written**.                   |
| W8   | **funded, deferred** | [WI-044](../.factory/work/WI-044.md) | Chief | The check over this repository's own sources. Numbered so it is not lost, and **not dispatched** — the inventory is worth writing against a settled repository, and the repository's visibility is the owner's open decision. |

**Two of the lead's decisions are worth carrying here, because they are judgements
about this direction rather than about the code.** W4 was folded rather than
re-filed, because WI-007 is the same want under a different name and a second
item would be two workers on one subject. And W3 was deferred on capacity, not
judgement — which means the gap under Pillar 2 is real and still open, and this
document should not be read as saying the pillar is closed.

**The order is not a preference.** One implementer, one item at a time: W2 before
W1, W5 before W7, W6 on its own, W3 last.

### W1 — The audit trail records what happened, not that something happened

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Every mutating route writes an audit entry, and the entry carries the **outcome**
rather than an assumed success. Every resource kind records a real author, so no
kind reports `system` for an agent's work. The twelve routes that write no entry
write one.

**Acceptance:** each of the thirty-four mutating routes writes an entry; an entry
records whether the action succeeded, and `POST /api/resources/:id/execute` records
`queued` rather than `done`; automations and tasks carry the author who created
them. **Whose test is named, because "a test proves" is not checkable without it:**
Cog writes the implementation's test, and Probe owns the acceptance test — Cog's
implementation is not Probe's to accept, and Probe's tests are not Cog's to defend.

### W2 — Publish the outcome vocabulary, and the migration that W1 makes

**Owner:** Wren. **File:** `CONTRACTS.md`.

**What is already published, and what is not.** WI-030 has already published what
"authored by an agent" counts as — a resource is agent-authored when its `createdBy`
carries the `agt_` form — and the audit trail's outcome set, `success | failure |
unknown`. Both landed at 08:34 on 2026-10-21, before this want was triaged. **This
want does not re-publish them, and its dispatched form's claim that the contract
"does not say what 'authored by an agent' means" is false.**

What is left is the part WI-030 could not write, because the code did not write it:
the **new** outcome vocabulary W1's code will produce — `queued`, `succeeded`,
`failed`; the rule that an entry records the outcome rather than an assumed success;
and the migration note saying what a client written before the change must do, and
what a record written before the change means.

**Acceptance:** the published outcome set is exactly the vocabulary the code writes,
enumerated member for member so a reader can compare the two lists; the rule that
an entry carries the outcome rather than an assumed success is stated; the migration
note says what a client written before does and what a record written before the
change means; the authorship definition is left as WI-030 published it; nothing is
reclassified.

### W3 — Resources keep a history the owner can take back

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Each revision of a resource is retained rather than overwritten, and the owner can
restore a resource to an earlier revision through a published route. The restore is
itself an audited action. This is C-21, scoped to resources; tasks and automations
are named in the item's "not in scope" and are not this.

**What this does not discharge.** C-21 stays open for the other two kinds. **Take-back
for tasks and automations is not funded by this item, and no other item funds it
yet** — so the gap under Pillar 2 is narrower after WI-035 and no smaller than it
was. The one part this item removes is the "no undo at all" part.

**Acceptance:** a resource's revisions are retrievable; the restore route publishes
the revision it restored and is audited like any other change; Cog writes the
implementation's test and Probe owns the acceptance test, so the restore is proved
by both — the test shows a restore returns the resource to the earlier revision's
spec and that the audit trail says the restore happened.

### W4 — An approval resumes the turn the contract says it resumes — _folded into WI-007_

**Owner:** Cog. **Files:** `apps/server`, `packages/agent-adapters`.

**This want was folded into WI-007** — the same subject under a different name — so
it is written up here for the record and must not be built twice. **The fold is
recorded in `.factory/INTAKE.md`; WI-007's own file does not yet name it.**

CONTRACTS.md already promises that a decision resumes the turn when the adapter
reports `persistentSessions`. The code closes the execution instead. This item makes
the code keep the promise, for the adapters that can keep it; for the adapters that
cannot, the contract's wording is corrected rather than the behaviour faked.

**Acceptance:** for an adapter reporting `persistentSessions`, a decision re-enters
the adapter and the turn continues; for one that does not, the published wording
says so; Cog writes the implementation's test and Probe owns the acceptance test,
so the resume is proved for the first and the published exception for the second.

### W5 — The dependency licences, read from the repositories

**Owner:** Wren. **File:** `docs/strategy.md`, and a note in PRODUCT.md §10.

Each dependency in the lockfile has its licence read from the repository and
recorded — and the landscape table above is brought under the same rule, because a
comparator's licence is part of what it teaches. This is the **record** half of the
owner's answer that the borrow rule becomes a check; W7 is the gate.

**And the record is written.** WI-036 landed and was **accepted** on 2026-10-21 —
**494 packages, one entry each, every entry naming the file its licence was read
from** — 375 read in
place from the licence file the package itself ships, 16 from the `license` field of
a package's own `package.json` because it ships no licence file, 97 optional
packages for other platforms recorded by the identifier the project publishes for
that exact version, and the six `@personal-os/*` workspaces marked as this
repository's own. There is **one copy of the record** —
[`docs/dependency-licences.json`](dependency-licences.json) — and the section
[below](#the-dependency-licences) points at it rather than repeating it, because
two copies of the same licences are a record that can disagree with itself.

**It also produces the approved set**, because a check cannot decide what is
approved unless something says what is: the licences this project accepts, the
reason each is accepted, and where the record lives. A licence outside that set
fails the build.

**Acceptance:** every dependency in the lockfile has a licence recorded and
attributed to the file it was read from; the approved set is written down — the
licence, the reason, and where the record lives — so W7's check has something to
compare against; the AGPL question the owner raised is answered **in writing,
against the actual dependency set, naming the dependency and the licence**, so
"answered" is a place and not a mood; a note in this document says when the column
was read.

**The record is written.** It is
[`docs/dependency-licences.json`](dependency-licences.json), read on 2026-10-21,
and [The dependency licences](#the-dependency-licences) says what was read, from
where, and answers the owner's AGPL question against this set.

### W6 — The product record says Desk (B); the owner chose Forge

**Owner:** Wren. **File:** `PRODUCT.md`.

PRODUCT.md §11 said the direction that would fix the accent is "Desk (B), it is
recommended rather than decided, and the owner has one word to say about it". The
owner said their word on 2026-10-21: **D — Forge**. A product record that states
the opposite of the decision is the one thing it cannot carry.

**And it has been corrected** — WI-037 landed (`0024f88`, _"Make the product record
say Forge, with the date and the recommendation"_) and was **accepted** on
2026-10-21. §11 now names Forge, with the date and the fact that the factory
recommended B.

**What was accepted:** §11 names Forge, with the date and the fact that the factory
recommended B; the accent rule's statement matches ADR 0007; nothing else in the
product record is changed in the same item.

### W7 — The borrow rule becomes a check, not a claim

**Owner:** Chief. **Files:** `.github/workflows/`, `package.json` (root), and the
lockfile.

The owner's answer to the second decision. The build compares the dependency set's
licences against the recorded ones and **fails** when a licence changes or an
unapproved licence appears.

**What this gate covers, exactly.** The dependency set. **It does not cover source
vendored into this repository's own tree** — that is not a dependency and is not in
the lockfile — so the owner's hard case of vendoring AGPL-3.0 code sits outside it,
and [WI-044](#w8--the-check-that-covers-this-repositorys-own-sources) is the item
that would cover it. This gate is worth building on its own terms; it is not the
whole answer to the borrow rule, and it is not named here as one.

**Acceptance:** a licence change in the lockfile fails the build with the
dependency named and the licence it changed from and to; a licence outside the
approved set W5 records fails the build, and the set is the one the gate reads, so
the two agree; a check proves a deliberately changed licence fails, and Chief owns
it because the gate is his file; the gate's own output is shown in the run.

**Why this is Chief's and not Wren's.** The gate lives in the workflow and the
root manifest, which the ownership table gives to Chief — and one want with two
owners is two wants, so the record (W5) and the gate (W7) are separate items with
separate owners.

### W8 — The check that covers this repository's own sources

**Owner:** Chief. **Files:** `.github/workflows/`, and the repository's own sources.

**Raised by this document's review.** The owner's hard case is vendoring AGPL-3.0
code into this repository's tree, which changes this project's licence. W7 reads
the dependency set and cannot see that. This want is the one that can.

**Acceptance:** the check reads the licence header of the source this repository
carries and fails the build when a file carries a licence outside the approved set
W5 records, naming the file and the licence it carries; a check proves a file
carrying AGPL-3.0 fails; **if the repository carries no third-party source, the
check says so and passes, rather than passing silently**; the gate's output is
shown in the run.

**One owner, because the check is one file.** The set it compares against is W5's,
and W5 is Wren's; this item is the gate, and the gate is Chief's — the same split
as W5 and W7.

**It is funded, and numbered — as WI-044, and not dispatched.** The lead's reason
is recorded in `.factory/INTAKE.md`: _the inventory it needs is worth writing
against a settled repository, and the repository's visibility is the owner's open
decision._ So the want is neither lost nor pretended done.

---

## The dependency licences

**The record is [`docs/dependency-licences.json`](dependency-licences.json), and it
was read on 2026-10-21.** One entry for every one of the 494 packages in
`package-lock.json`, and every entry names the file its licence was read from.
**There is one copy of the record and it is that file**: this section points at it
and does not repeat it, because two copies of the same licences is a record that
can disagree with itself.

**What was read, and from where.** 375 entries were read in place, from the
licence file the package itself ships. 16 were read from the `license` field of
the package's own `package.json`, because those packages ship no licence file —
a published field is what the project publishes, and the entry says which field.
97 are optional packages for other platforms: they are in the lockfile but are not
installed on the machine that read them, so the identifier recorded is the one
the project publishes for that exact version, and the entry says that too. The
six `@personal-os/*` packages are this repository's own workspaces rather than
dependencies, and they are marked as such. **Every entry carries the first
identifying lines of the file it was read from**, so a later reader can tell a
licence from the name of a licence — which is the whole difference between a
directory listing and a reading.

**The set, as read on 2026-10-21.** This is a census of the reading, not a second
copy of the record: the licences themselves are in the JSON, each with what it
permits, what it requires and what it forbids, read from the licence text. If this
table ever disagrees with the JSON, the JSON is the record.

| Licence         | Packages |
| --------------- | -------- |
| `MIT`           | 423      |
| `ISC`           | 19       |
| `Apache-2.0`    | 12       |
| `MPL-2.0`       | 12       |
| `BSD-3-Clause`  | 8        |
| `BlueOak-1.0.0` | 6        |
| `BSD-2-Clause`  | 3        |
| `MIT-0`         | 2        |
| `CC-BY-4.0`     | 1        |
| `CC0-1.0`       | 1        |
| `0BSD`          | 1        |

Six more entries in the lockfile are this repository's own `@personal-os/*`
workspaces, which carry no licence of their own; see below.

**The owner's AGPL question, answered against this set.** _Is anything this
product depends on AGPL?_ **No.** Every dependency in the lockfile was read, and
**not one of them is licensed under the GNU Affero General Public License**; none
is under the GPL or LGPL either. The only copyleft in the set is **MPL-2.0**, and
it is one package: `lightningcss` and its eleven platform variants
(`lightningcss@1.32.0` and the `lightningcss-*` binaries), all read from the
package's own `LICENSE`. That is file-level copyleft, not network-level: it
obliges a modified MPL-covered file to be published under the MPL, and this
project does not modify them — `lightningcss` is a build-time dependency of
Tailwind's CSS pipeline.

Two things that answer should not be read as more than it is. **The six
`@personal-os/*` packages in the lockfile carry no licence at all**, because the
owner answered on 2026-10-21 that this repository is private for now with no
LICENSE yet; that is about this repository, not about what it depends on, and
"no AGPL in the dependency set" is not "everything here may be redistributed".
And **the one attribution obligation in the set rides on `caniuse-lite`**
(`CC-BY-4.0`), a browser-support data set used at build time: whether that data
reaches the built client is worth settling before the gate is written.

**The approved set is in the same file.** `approvedSet` names the licences this
project accepts and the reason each is accepted — it is what WI-038's gate
compares the lockfile against, so a licence outside the set, or a change inside
it, fails the build. The set as read on 2026-10-21 accepts all eleven licences
above; the owner may narrow it, and the record is one edit to change.

---

## What this document does not do

- It does not change a published contract. It records the owner's two answers, and
  settles nothing else.
- It does not replace PRODUCT.md, ARCHITECTURE.md or ADR 0007. It points at them.
- It does not re-scope WI-017, WI-020 or WI-030, which are dispatched. It answers
  the question WI-017 was waiting on.
- It does not open a work item, and it takes no number. The wants above are wants.
- It does not name a product the factory should not build. It names four pillars,
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
