# 7. The product is an environment agents operate and extend

**Status:** accepted historically; partially superseded on 2026-10-22.

The owner-approved [chat-first recovery](../recovery.md) supersedes the map-first
UX/build priorities and stale open-question list below. The broader environment
identity, single-owner scope and independent-harness boundary remain. Rich chat is
now the primary work surface. Historical answers are retained for provenance; use
the recovery decision table and active roadmap for current requirements.

**Written against:** commit `a186c42` (2026-10-21), clean working tree. The decisions
this ADR records were made on 2026-10-20 and are kept in `.factory/INTAKE.md`; that
section is the source, and this ADR is the copy into the repository's own decision
record. The borrowing rule went into the doctrine at `c7ae5fa`; the owner's four
follow-up answers went into `INTAKE.md` at `b9f6181`.

**Open:** of the six questions that went to the owner on 2026-10-20 at 23:55,
**three have since been answered — the direction, the measures route and the
template concept, all on 2026-10-21 at 06:01** — and the rest are open, with
two more that were never put to the owner at that round. They are listed under
"What is still open", and this ADR closes none of them.

## Context

The product had a factory and no identity. `PRODUCT.md` opened with "an agent-native
control panel and personal software factory", which described the half of the
product that builds the other half and was silent on what the product is _for_.

On 2026-10-20 the owner was grilled through the product's identity, with Matt
Pocock's `grill-me` protocol: the whole frontier of settled questions at once, every
question carrying a recommended answer, facts looked up rather than asked for, and
the decisions belonging to the owner. Six questions were answered. A research sweep
of twelve comparators — with licences read from the repositories themselves — ran
against the same frontier, and three of its findings changed what had to be written
down.

The sweep's findings are findings. The owner has not ratified them, and this ADR
does not turn them into decisions.

## Decision

Six questions, answered by the owner on 2026-10-20.

| #   | Question                                             | The owner's answer                                                                                                                              | What it unblocks                                                                                                                                |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Which ground the product is built on                 | An environment agents operate and extend — not a chat home; the factory is a part of it, not the whole of it                                    | The product record. The factory stops being the product, and [PRODUCT.md](../PRODUCT.md) opens with the identity instead                        |
| Q2  | Does the human ever operate software, or only decide | Only decide: direct, approve, accept. Agents do everything else. Connecting a new agent is a trust decision                                     | The landing page becomes an inbox of things needing authority, and the visual direction is judged against that rather than taste                |
| Q3  | What "native" means for an agent-created feature     | A typed, validated resource in our own contracts, authored through templates                                                                    | The shared resource API is the extension surface. Two thirds of it exist; the template third is the work item for it                            |
| Q4  | Which two things "everyday productivity" means       | Tasks/work and documents. Not email, not calendar                                                                                               | The scope of what the product is for                                                                                                            |
| Q5  | What "borrow without depending" means in practice    | _"i want to use these as inspriation and then implement into our codebase against our spec"_                                                    | The doctrine rule **Borrow the idea, not the dependency**, and the boundary that rides on it: an interface is conformed to, never reimplemented |
| Q6  | What number proves "sustainable and agent-developed" | The share of features authored by agents in-instance, and the share of operations done without the owner touching code; both shown in the panel | The product's report on itself                                                                                                                  |

Q5 is the owner's correction, and it is quoted above as it was said. The doctrine
carries the rule it produced; the product record carries the product-side
consequence of it.

## The three findings that sharpened the decisions

These are findings from the 2026-10-20 sweep, with their sources. None of them is a
decision.

1. **A forming standard carries our authority model.** The MCP Apps extension
   ([SEP-1865](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/),
   proposed 2025-11-21) lets a server ship UI to a host: pre-declared `ui://`
   templates the host can review before execution, communication over plain MCP
   JSON-RPC so it stays auditable, and hosts able to require explicit approval for
   UI-initiated tool calls. It is a proposal, not a ratified standard, and it
   requires a text-only fallback. The host's approval gate is the part that matters
   here: it is the same shape as "the human decides", and it is the same shape as
   our ledger.
2. **Both working precedents of agent self-extension succeed for one reason: a
   mandatory check before the artefact counts.** Anthropic's skill-creator authors
   skills under a typed contract with evals
   ([SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md));
   n8n's MCP server creates real workflows under validate-before-deploy and
   copy-before-edit
   ([n8n-mcp](https://github.com/czlonkowski/n8n-mcp)). Our ledger — goal → task →
   execution → evidence → acceptance — is that shape already.
3. **The licence reality is why Q5 is right.** n8n is Sustainable Use, and its
   licence file says it is "not licensed under any of the main open source
   licenses"; Dify is a modified Apache 2.0 with additional conditions. Both were
   read from the repositories themselves, in the licence sweep of 2026-10-20
   recorded in `.factory/INTAKE.md`. A licence can change what the product is,
   which is exactly what the owner's Q5 answer refuses.

**One hard case is the owner's, and it is not the factory's: vendoring AGPL-3.0 code
into this repository changes this project's licence.** It is recorded here so that
nobody discovers it in a diff.

## What is still open

Six questions went to the owner on 2026-10-20 at 23:55, and **three of them have
since been answered — the direction (D — Forge, in the section above), the
measures route, and the template concept, all on 2026-10-21 at 06:01.** Chief's
recommendations are recorded in `.factory/INTAKE.md`; they are recommendations,
not answers, and this ADR does not convert them. The direction has its own
section above, the measures route is sized as
[WI-020](../../.factory/work/WI-020.md), and the rest are these, with the answer
marked where one has come:

1. **The template concept. Answered — 2026-10-21 at 06:01.** Q3's third half —
   "authored through templates" — had no template concept for a resource
   anywhere in the product, and a template in the resource model is a published
   concept, so it needed the owner's nod before it could be built. The owner
   gave it, and it is in build as
   [WI-017](../../.factory/work/WI-017.md), with its published shape in
   [WI-030](../../.factory/work/WI-030.md).
2. **The protocol boundary.** Which side of the product each protocol belongs to.
   The recommendation: the panel's agent-facing surface conforms to MCP and AG-UI,
   ACP and A2A are the agent-connection side, which we speak when we connect out
   to an agent. Our resources, tasks and goals stay ours, and no protocol is
   forked.
3. **Reversibility.** With one owner there is no second operator to absorb a bad
   action, so authority without reversibility is exposure. The recommendation: the
   owner's decisions are reversible as a product principle. Part of the substrate
   exists — resources and tasks carry `revision` with `expectedRevision` for
   optimistic concurrency, and the audit trail records who did what to what — but
   an automation carries a revision counter that nothing compares against, so its
   update is last-write-wins, and the audit trail does not cover every action.
   There is no undo, revert or rollback anywhere in the server or the web client
   today. The surface is missing, and part of the substrate with it.
4. **Whether a conversation can wait on the owner's reply.** The published
   `WaitingKind` is now `approval | task | turn` — `turn` was added by the
   owner's answer of 2026-10-21 at 07:07 so that an agent turn whose outcome
   could not be confirmed reaches the owner, which is a different thing from
   this question. No contract still carries a state for a conversation waiting
   on a person, so the clause in WI-004's criterion that says "an entry that
   needs a reply opens the conversation it belongs to" cannot be true yet. An
   answer would be a fourth kind of entry, and a published kind is the owner's.

Two more are open, and neither was put to the owner at that round. One is a
recommendation with no question behind it; the other is a definition the owner has
not given:

5. **The extension mechanism.** Which standard a server shipping its own UI to a
   host should conform to. The recommendation: MCP Apps (SEP-1865) for
   agent-created UI and AG-UI for the agent-to-UI event stream. Neither is
   ratified, and MCP Apps requires a text-only fallback.
6. **The definition of "authored by an agent"** — what counts as a feature an agent
   made, for the first of the two measures. The data is already there
   (`resources.createdBy`); the definition is not settled. The work item for the
   measures states its reading in its report, so the owner can correct it.

## The visual direction

The panel's visual direction is **D — Forge**, chosen by the owner on
**2026-10-21**, against the factory's recommendation of **B — Desk**. The
recommendation was the owner's to reject, and rejecting it is a decision rather
than a mistake: Desk was the cheapest of the four and the closest to the
existing stack, and the owner took the one that costs more and changes more.
The factory concurred with the recommendation and the owner chose anyway; that
is the owner's call and this record is its consequence, not an argument.

It is a section of this ADR rather than a second one because the strategy
session and the direction were one session. The direction itself, with its
reasoning and its numbers, is
[`prototypes/DIRECTION.md`](../../prototypes/DIRECTION.md). This section
carries the decision, the boundary, what it rejects, and what it costs in kind;
it does not restate the cost model.

**The boundary is a rule, not a layout.**

> If it is a picture of the system, it is in the orientation room. If it is a
> place where work is inspected or decided, it is in the execution room — with
> two declared exceptions, the Needs-you rail and the constellation, which
> carry decisions in the orientation room because a decision is taken where
> the list is.

_Quoted as it stands in
[`prototypes/DIRECTION.md`](../../prototypes/DIRECTION.md) at `:53-57` as read
at `95e5165`, after the D1–D6 repair (`e560165`) and the second repair
(`d3ef0d2`). The first made the rule state the crossing the paragraph below
already described; the second gave the rule a second declared exception, the
constellation, so **the decision did not change** and nothing else in this
section was touched. The lead re-synced this quote on 2026-10-21 at 15:00, and
it was re-synced again on 2026-10-22 after the second repair: it had drifted
from the document each time, and a rule quoted without its load-bearing
exception is what put the landing page in the wrong room in WI-024 and WI-040.
Probe verifies it as it verifies any lead's edit._

Under that rule: the constellation and the agent list are in the **orientation
room** — the constellation _is_ the agent list, spatialised, and building it
twice would build the same information twice; the factory board and the
automation runs are in the **execution room**; and the dashboards are in the
**orientation room**. There are two deliberate crossings, and they are
load-bearing: the Map's **Needs you** rail carries the decision controls, and
the constellation carries the connect decision, because the owner's answer on
Q2 makes connecting an agent a trust decision, and the constellation _is_ the
agent list, spatialised. The reason is one reason, given once: **a decision is
taken where the list is.**

**What was rejected, and why it was rejected.** A decision that does not say
what it rejected is not a decision, so the record of what was rejected on the
owner's behalf is kept.

- **B — Desk. Rejected.** Warm paper, light, Today-first: a single vertical
  scroll answering what needs me, what is running, what exists, and a
  reading-width conversation column. It was recommended because it is the only
  direction whose home screen _is_ the decision list — the owner's top want and
  Q2 in the same screen — and it is the cheapest of the four and the closest to
  the existing stack. Against it: a warm-paper rebuild of a dark panel, a serif
  added to a product that has no serif, and a palette rewrite to buy a
  three-band scroll. It buys the least structure of the four. The size of that
  rewrite is in the cost model in
  [`prototypes/DIRECTION.md`](../../prototypes/DIRECTION.md).
- **A — Deck. Absorbed rather than rejected.** A's trace gutter is now part of
  Forge's execution room, and A's dense instrumented language is the execution
  room's language. A alone was rejected: it promotes the event stream from an
  implementation detail to the primary navigation surface, so the panel answers
  _"what just happened"_ — a fine place to watch and a poor place to decide.
- **C — Orbit. Absorbed rather than rejected.** C's constellation is now the
  orientation room. C alone was rejected: a constellation answers _"who is
  working"_, not _"what needs you"_, and it is the hardest of the four to keep
  legible as agents and threads grow. That difficulty is Forge's now, and it is
  priced in the cost model rather than argued away.

**Two rules travel with the direction.** **One accent with one meaning** — and
amber is the one collision that breaks it, because in Forge amber always means
_live or waiting on you_ and never caution, so a caution block has to become
neutral or use the error colour. And **no ratio whose denominator is zero**:
the product's first report on itself must not be a lie by omission, so the
counts are shown and a ratio appears only when there is a denominator to divide
by.

**What the direction does not change.** No server, no contract, no database, no
CI, no dependency. Nothing in it changes behaviour, so nothing in it needs a
contract change. It is a material and a structure, and the structure lives in
the web client.

**The decision control is not blocked by the direction, and does not wait on
it.** The inbox is already a component, and the control is already built — the
landing page's list of what needs the owner's authority, decided where the list
is. What the adoption re-lays-out is the _layout_ of the list, not the control
inside it, and the finished control is what Forge's Needs-you rail wraps. The
owner's top want does not wait on a palette.

**The one consequence the direction left open, and the answer.** The agent
list is a picture in the orientation room, and by that room's own rule nothing
is decided there — but connecting an agent is a trust decision (Q2). The
connect decision had to live somewhere in place, and the direction now says
where: **the constellation carries it**, because the constellation _is_ the
agent list, spatialised, so a map that could list an agent and not connect one
would fail the criterion WI-004 was returned for. That was a build decision
inside the direction rather than an owner decision, because the owner chose
the direction and this is inside it, and
[WI-024](../../.factory/work/WI-024.md) carries it.

**What it costs** is in `prototypes/DIRECTION.md`: a new component (the
constellation), a third surface (the dashboards), a room switch, and a material
that re-hues rather than replaces. Stated in kind, that is the price of D, and
the numbers are in that document.

## Consequences

- The product record opens with the owner's identity rather than with a description
  of the factory. [PRODUCT.md](../PRODUCT.md) now says what the owner decides, what
  the product is for every day, what an agent-authored artefact needs before it
  exists, and what the product reports about itself.
- The borrowing rule is one rule in two places: the doctrine keeps it in
  [FACTORY.md](../FACTORY.md), and the product record states the product-side
  consequence. Neither forks a protocol, and the boundary between them is the second
  open question.
- Two of the six answers were half-built, and they said so. The template third of
  Q3 and the counting behind Q6 are both published shapes, so both needed the
  owner's nod, and the owner gave both on 2026-10-21 at 06:01. They were built as
  [WI-017](../../.factory/work/WI-017.md) and
  [WI-020](../../.factory/work/WI-020.md), with their published entries in
  [WI-030](../../.factory/work/WI-030.md) — the templates at `8b1fd01` and the
  measures at `c2853ac`, both in the tree.
- **The product reports on itself.** The two measures are counted from the data the
  product already keeps, and the panel shows them in a band of their own.
- One licence question is the owner's and not the factory's, and it is recorded
  above rather than left in a candidate table.
- The open questions stay open, and this ADR does not close them: it records a
  recommendation for each one. The three that have since been answered carry
  the owner's answer above, and the rest stay open with theirs.
