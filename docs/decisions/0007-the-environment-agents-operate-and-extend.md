# 7. The product is an environment agents operate and extend

**Status:** accepted

**Written against:** commit `5f019b9` (2026-10-21), clean working tree. The decisions
this ADR records were made on 2026-10-20 and are kept in `.factory/INTAKE.md`; that
section is the source, and this ADR is the copy into the repository's own decision
record. The borrowing rule went into the doctrine at `c7ae5fa`; the owner's four
follow-up answers went into `INTAKE.md` at `b9f6181`.

**Open:** four questions from the same round are not answered yet. They are listed
under "What is still open", and this ADR does not close them.

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

Four questions went to the owner on 2026-10-20 at 23:55 and are not answered. Chief's
recommendations are recorded in `.factory/INTAKE.md`; they are recommendations, not
answers, and this ADR does not convert them.

1. **The extension mechanism.** MCP Apps (SEP-1865) and AG-UI are the recommended
   conformance targets for the agent-facing surface.
2. **The definition of "authored by an agent"** — what counts as a feature an agent
   made, for the first of the two measures. The data is already there
   (`resources.createdBy`); the definition is not settled. The work item for the
   measures states its reading in its report, so the owner can correct it.
3. **The protocol boundary.** The recommendation: the panel's agent-facing surface
   conforms to MCP and AG-UI; ACP and A2A are the agent-connection side, which we
   speak when we connect out to an agent. Our resources, tasks and goals stay ours,
   and no protocol is forked.
4. **Reversibility.** With one owner there is no second operator to absorb a bad
   action, so authority without reversibility is exposure. The recommendation: the
   owner's decisions are reversible as a product principle. The substrate exists —
   resources, tasks and automations carry `revision` with `expectedRevision` for
   optimistic concurrency, and the audit trail records who did what to what — but
   there is no undo, revert or rollback anywhere in the server or the web client
   today. The surface is missing; the data is not.

## The visual direction

The panel's visual direction is **Desk (B)**, recommended by Vision and **not yet
decided**. The owner has one word to say: confirm B, or name A, C or D. It is a
section of this ADR rather than a second one because the strategy session and the
direction are one session.

Desk was judged against the owner's own answers rather than against taste: the
panel's home screen is the list of what needs the owner's authority (Q2), one list in
one place, the conversation as a first-class surface, and the two measures visible
without a new screen (Q6). The three rejected directions were rejected for reasons
recorded in `prototypes/DIRECTION.md` — the event stream is a poor place to decide,
a constellation answers a question one owner does not have, and a direction that
needs a second decision is not one decision.

Two rules were harvested from the rejected directions and are now product rules:
**one accent with one meaning**, and **no ratio whose denominator is zero**.

The decision control — approving an approval from the landing page, where the list
is — is not blocked by the direction and does not wait on it.

## Consequences

- The product record opens with the owner's identity rather than with a description
  of the factory. [PRODUCT.md](../PRODUCT.md) now says what the owner decides, what
  the product is for every day, what an agent-authored artefact needs before it
  exists, and what the product reports about itself.
- The borrowing rule is one rule in two places: the doctrine keeps it in
  [FACTORY.md](../FACTORY.md), and the product record states the product-side
  consequence. Neither forks a protocol, and the boundary between them is the third
  open question.
- Two of the six answers are half-built, and they say so. The template third of
  Q3 is a work item waiting on the owner, because a template in the resource model
  is a published concept. The counting behind Q6 is a work item waiting on the
  owner, because a route that returns the numbers is a published contract.
- **The product does not report on itself yet.** Nothing counts the two measures and
  the panel does not show them.
- One licence question is the owner's and not the factory's, and it is recorded
  above rather than left in a candidate table.
- The open questions stay open. This ADR records a recommendation for each one and
  closes none of them.
