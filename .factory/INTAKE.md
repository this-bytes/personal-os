# Intake — wants, and how they become work

The factory loop in [FACTORY.md](../FACTORY.md) starts at intake. This file is
the intake queue: the wants that have been said out loud and have not yet
become work items.

Chat is where wants arrive. This file is where they are remembered. If a want
is not written here, the factory has not heard it — the same rule as
FACTORY.md: the repository is the state.

A **want** is a request in the owner's words. A **work item** is something one
owner can implement and someone else can verify. Most wants are not work
items. Some are already shipped. Some are three work items. Some are wrong.
Intake is where that is discovered, before anyone spends an hour on it.

## The queue

Empty until the owner says something. A want is written here in the owner's
own words, not a summary of them.

| #   | Want                                                                                                      | Said       | Verdict                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-1 | "I see everything waiting on me in one place"                                                             | 2026-10-20 | accepted — [WI-004](../work/WI-004.md)                                                                                                                                                                            |
| W-2 | Interaction — talking to agents is the job that should get genuinely better                               | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md), [WI-012](../work/WI-012.md); the bar for [WI-004](../work/WI-004.md) still applies |
| W-3 | "Run within a stated scope"                                                                               | 2026-10-20 | accepted — the scope is stated below                                                                                                                                                                              |
| W-4 | "Only me" — one person runs the instance                                                                  | 2026-10-20 | accepted — no permissions, sharing or onboarding work                                                                                                                                                             |
| W-5 | "dont rush to implement a feature when we havent discussed it" — and the product vision that came with it | 2026-10-20 | accepted — a strategy session, not a work item; the rule is recorded below                                                                                                                                        |
| W-6 | Move the MiniMax Bot plugin's conversation-layer guarantees onto Personal OS's factory-grade ledger       | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md); the rest is in Candidates                                                          |

Verdicts: `open` — not yet judged. `accepted` — became a work item, cited
here. `declined` — not doing it, with the reason kept. `folded` — already
covered by an existing work item.

## The stated scope

The owner answered "run within a stated scope" for how much the factory
decides on its own. The scope is this, until the owner says otherwise:

> Improve **interaction** — the owner talking to agents — and make the panel
> answer **"what needs me"** on the landing page. One owner. No permissions,
> no sharing, no onboarding, no migration work.
>
> Inside the scope the factory works continuously and stops only at a
> published boundary: a change to a contract in [CONTRACTS.md](../CONTRACTS.md),
> a change to the dependency set, the lockfile, CI or a release, and anything
> the owner must approve to be externally visible.

W-2 is the reason the scope names interaction rather than coordination. The
"what needs me" page is judged against that: it is the panel helping the owner
talk to agents, not the panel showing a project dashboard. Anything that
serves the coordination view for its own sake is out of scope.

## The strategy decisions, 2026-10-20

Grilled with the owner on 2026-10-20 using Matt Pocock's `grill-me` protocol.
The owner agreed with the recommended answers to Q1, Q2, Q3, Q4 and Q6, and
corrected Q5. This section is the source of truth for the decisions;
[WI-011](../work/WI-011.md) copies them into the product record.

| #   | Decision                                             | The answer                                                                                                                                      |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Which ground the product is built on                 | An environment agents operate and extend — not a chat home; the factory is a part of it, not the whole of it                                    |
| Q2  | Does the human ever operate software, or only decide | Only decide: direct, approve, accept. Agents do everything else. Connecting a new agent is a trust decision                                     |
| Q3  | What "native" means for an agent-created feature     | A typed, validated resource in our own contracts, authored through templates                                                                    |
| Q4  | Which two things "everyday productivity" means       | Tasks/work and documents. Not email, not calendar                                                                                               |
| Q5  | What "borrow without depending" means in practice    | **Corrected by the owner:** _"i want to use these as inspriation and then implement into our codebase against our spec"_                        |
| Q6  | What number proves "sustainable and agent-developed" | The share of features authored by agents in-instance, and the share of operations done without the owner touching code; both shown in the panel |

**Sharpened by the research sweep, 2026-10-20.** Twelve comparators, licences
read from the repositories themselves. Three findings change what has to be
written down, and none of them is a decision until the owner says so:

1. **A forming standard carries our authority model.** The MCP Apps extension
   (SEP-1865, proposed 2025-11-21 by MCP core maintainers at OpenAI and
   Anthropic with the MCP-UI creators) lets a server ship UI to a host:
   pre-declared `ui://` templates the host can review before execution,
   communication over plain MCP JSON-RPC so it stays auditable, and hosts able
   to require explicit approval for UI-initiated tool calls
   ([post](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/)).
   It is a proposal, not a ratified standard, and it requires a text-only
   fallback. The host's approval gate is the part that matters here: it is the
   same shape as "the human decides", and the same shape as our ledger. So
   "native" should mean typed in our contracts _and_ rendered through that
   mechanism — an agent-created dashboard is a first-class resource the host
   can review and gate, not a surface we invent.
2. **The rule behind both working precedents of agent self-extension:** an
   agent-authored artefact does not exist until something has checked it.
   Anthropic's skill-creator authors skills under a typed contract with evals
   ([skill](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md));
   n8n's MCP server creates real workflows under validate-before-deploy,
   copy-before-edit ([n8n-mcp](https://github.com/czlonkowski/n8n-mcp)). Our
   ledger — goal → task → execution → evidence → acceptance — is that shape
   already.
3. **The licence reality is why Q5 is right.** n8n is Sustainable Use, and its
   licence file says it is "not licensed under any of the main open source
   licenses"; Dify is a modified Apache 2.0 with additional conditions. Both
   verified in the repositories. A licence can change what the product is.
   One hard case is the owner's to decide, not the factory's: **vendoring
   AGPL-3.0 code into this repository changes this project's licence.**

The conformance targets these findings imply — MCP Apps for agent-created UI,
AG-UI for the agent-to-UI event stream — are the recommended answer to the
protocol-boundary question below. They are written down as a recommendation in
[WI-011](../work/WI-011.md), and the question is still open until the owner
answers it.

**Q5 in the doctrine.** The owner's answer is now a rule in
[FACTORY.md](../FACTORY.md): _Borrow the idea, not the dependency._ Another
project is inspiration — we read it, take the approach, and build the feature
inside this repository against our own contracts and data model. We do not
vendor a codebase in, and we do not add a runtime dependency to get a feature.

One boundary rides on it, and it is not settled yet: an **interface** is
conformed to, never reimplemented. Personal OS is a client of ACP, A2A, MCP
and the OpenAI-compatible API shape. "Our spec" means our domain model, not
our dialect of someone else's protocol. That reading is in the doctrine, and it
is being put to the owner in the next grilling round.

**What the decisions unblock.** The landing page becomes an inbox of things
needing authority rather than a directory of screens; the visual direction
([WI-010](../work/WI-010.md)) is judged against the human's role rather than
taste; agent-created features are native resources; and the product reports on
itself with the two measures.

**What two of these decisions still need, checked against the code.** The
identity the owner chose is an environment agents operate _and extend_, and a
product that reports on itself. Both have their data model already, and
neither has a work item.

- **Q3's "authored through templates" — the third half is not built.** Typed:
  six resource kinds in `resourceTypeSchema`. Validated: per-type specs
  (`dashboardSpecSchema`, `documentSpecSchema`, `dataSourceSpecSchema`,
  `memorySpecSchema`) checked by the owning provider's `validate(data)`.
  Templates: there is no template concept for a resource anywhere in the
  product — the only templates in the code are HTTP body templates and prompt
  templates. So an agent can create a resource, and nothing tells it what a
  good one looks like.
- **Q6's two measures — half the data is there, and half of the claim is
  wrong. Corrected 2026-10-21, on Probe's WI-011 review.**
  The claim was that `resources.createdBy` separates an agent's authorship
  from the owner's, and that `auditLog` records the actor of every action.
  The first half holds for four of the six resource kinds and is **false for
  the other two**: automations and tasks hardcode `createdBy: 'system'`
  (`apps/server/src/modules/resources/service.ts:170`, `:260`) and their
  tables have no `createdBy` column at all
  (`apps/server/src/db/schema.ts:385-401`, `:305-330`). The second half is
  false too: **twelve of the thirty-four mutating routes write no audit
  entry at all.** Chief counted them route by route — 34 mutating routes,
  20 with a route-level `audit()` call, two more writing from the service
  layer (`POST /api/approvals/:id/decide` and `PATCH /api/tasks/:id`), twelve
  with nothing. So an agent-created automation or task is recorded as
  created by `'system'`, and the audit trail does not cover every action.
  Nothing counts either measure, and the measures item
  ([WI-020](../work/WI-020.md)) inherited the false premise.

The queue behind these decisions is interaction and truthfulness work. None of
it makes the environment extendable or self-reporting, which is the substance
of the identity the owner chose. The measures are a read-only count and a
band; the template path is real work, and it is the one that makes "agents
extend it" true rather than merely possible.

## The owner's decisions, 2026-10-20 22:34

Chief put four questions to the owner; the owner answered all four. These
are decisions, and this section is where they are kept.

| #   | Question                                                                                                        | Answer                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Q1  | Which of the three contract changes do you approve now — the `unknown` state, the persona, the approval resume? | **All three.** Build them, each with its migration plan and its `CONTRACTS.md` entry                              |
| Q2  | The live stream — when?                                                                                         | **After the truthfulness work**: WI-009 first, then whichever contracts are approved. It stays a candidate (C-14) |
| Q3  | Should an agent have memory of its own?                                                                         | **Yes — an agent gets its own memory scope.** [WI-012](../work/WI-012.md)                                         |
| Q4  | Is the approval decision control part of WI-004?                                                                | **Yes.** The control is part of WI-004, not a separate item                                                       |

**What Q1 unblocked.** WI-006, WI-007 and WI-008 move from "stopped at a
published boundary" to approved. The remaining condition on each of them is
the same: `CONTRACTS.md` carries the entry with a migration note, which is
[WI-013](../work/WI-013.md) — Wren's file, so Wren's work.

**What Q2 settled.** The live stream is a candidate, not a work item, and it
sits after the truthfulness work. C-14 records that.

**What Q3 changed.** C-11 was a candidate with the owner's decision pending
against it. The owner has now decided, so C-11 becomes
[WI-012](../work/WI-012.md) — and it is a second published-contract change,
which is why it goes last in the order.

**What Q4 confirmed.** WI-004's criterion already said an approval is
"approved or rejected where the list is". The owner has now confirmed that
the decision control is part of WI-004, so the item cannot be accepted
without it and no separate item is opened for it.

**The brief is reconciled against the repository, 2026-10-20 22:45.** The
MiniMax Bot brief was updated at 21:58 and re-sent; Chief read that version
and reconciled it. Three places where the repository is ahead of the brief,
so nobody re-opens or re-proposes them:

1. **WI-006, WI-007, WI-008 and WI-009 are already open**, sized, assigned
   and dispatched. They are not "ready to open as they stand" — they are
   running.
2. **The brief's §3.1 and TR-5 are superseded by the owner's later
   answers.** §3.1 keeps per-agent memory as a candidate; the owner has
   since decided it is wanted, so it is [WI-012](../work/WI-012.md) — the
   second published-contract change, and last in the order. TR-5 is left to
   Chief; the owner has since decided it comes after the truthfulness work
   and stays candidate C-14.
3. **The brief's WI-004 is stale.** Its front end is not in `implement` — it
   landed at `45c2e54` and is in `verify` with Probe. The sequencing point
   still holds and is already honoured: WI-008 lands before that front end
   is finished.

One question the brief asked Chief is now answered from the published
contract rather than from the owner: **WI-009's "was coordinator mode ever
meant to let any participant hand over?"** `CONTRACTS.md:99-107` lists as a
mandatory routing safeguard that only one owner is responsible for
coordinating a particular delegation, so the code violates a published
contract and the item is dispatchable with no owner answer in the way.

## The owner's decisions, 2026-10-21 06:01

The owner answered the three questions Chief put to them. The first answer
overrides a recommendation the factory made, and that is the owner's call to
make.

| #   | Question                                                            | Answer                                           |
| --- | ------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Which visual direction does the panel take?                         | **D — Forge.** Not the recommended **B — Desk**. |
| 2   | Do you approve the three published shapes (WI-017, WI-020, WI-022)? | **Approve all three.**                           |
| 3   | Push the local commits to origin now, or hold?                      | **Hold the push until the reds are green.**      |

**The direction is Forge, and it is the owner's, not the factory's.** The
recommendation in `prototypes/DIRECTION.md` argued for Desk, and Chief
concurred with it: the owner's own Q2 answer is that the human decides, and
Desk is the only direction whose home screen is that decision list. The owner
chose the direction that recommendation rejected. Three things follow, and
they are recorded here so that nobody has to re-derive them:

- **Forge is coherent with Q2, and the boundary Forge settled is the rule-based
  one — not the conditional this entry used to quote.** The owner's Q2 answer
  is _"Only decide: direct, approve, accept. Agents do everything else.
  Connecting a new agent is a trust decision"_ (see "The strategy decisions"
  above). The Desk-era recommendation carried a conditional for the case where
  the owner said Forge: _"the factory board, the agent list and the automation
  runs do not go in the orientation room... The orientation room keeps the map
  and nothing else. That is the version of D that would be worth building, and
  it is not the version on the table."_ That was the factory's own preference,
  written while it was recommending Desk, and it said outright that it was not
  the version on the table.

  **What Forge actually settled** is the rule in
  [`prototypes/DIRECTION.md`](../prototypes/DIRECTION.md): _if it is a picture
  of the system, it is in the orientation room; if it is a place where work is
  inspected or decided, it is in the execution room._ Under that rule the
  constellation and the agent list are in the orientation room — the
  constellation **is** the agent list, spatialised, and building it twice
  would build the same information twice — the factory board and the
  automation runs are in the execution room, and the dashboards are in the
  orientation room.

  **The correction is recorded because this entry got it wrong the first
  time.** An earlier version quoted that conditional as "Q2 in its settled
  form" and put the agent list in the execution room. It is not the owner's
  answer, it was conditional, and it did not survive the owner choosing Forge.

  **One consequence is not answered yet, and it belongs to the build item.**
  Q2 says connecting a new agent is a trust decision, and the agent list is
  now a picture in the orientation room — a place where nothing is decided.
  The Needs-you rail answers it for the waiting list, and it is the same
  defect shape as WI-004's: the panel could list an approval and could not
  decide one. So the constellation has to carry the connect decision in place,
  or the agent list has to keep a decision surface in the execution room.
  That is a build decision, and it is in [WI-024](work/WI-024.md).

- **The cost objection survives, and answering it is the factory's job.**
  Forge is the most expensive of the four: two rooms, two densities, a new
  component and a dashboard screen, for the one implementer who already has
  items ahead of it. The cost model is now written, in
  [`prototypes/DIRECTION.md`](../prototypes/DIRECTION.md), and it is priced
  from the tree: 215 `slate-` lines survive a re-hue in place, 34 `indigo-`
  lines move, and amber's ten lines across six files hold the only semantic
  collision — four of them mean caution, not liveness.
- **The decision control is still not blocked by the direction.** That was true
  for Desk and it is true for Forge: the inbox is already a component, and a
  layout change re-lays-out the list's _layout_, not the control inside it.
  What changes with Forge is larger than Desk's three bands — the landing
  page is the decision list, and in Forge the decision list belongs in the
  execution room, so the front door moves out of the root into a room. That is
  the direction item's work, not the control's.

**The three published shapes are approved**, so WI-017 (a template concept in
the resource model), WI-020 (the read-only route publishing the product's two
measures of itself) and WI-022 (the published waiting-list shape) leave the
queue. WI-022 was the one red in the tree when this was written: `CONTRACTS.md`
publishes `WaitingReason` as `'pending' | 'review' | 'blocked'` while the code
emits `'unknown'`, and Probe's test pins the drift on purpose rather than let
it be forgotten. **It is no longer the only one** — the tree has seven
deliberate reds and they are listed in "The seven reds, measured" below.

**The push is held until the reds are green**, and the chain is now explicit
and short: the seven reds land → the tree is green → the push → CI runs on
GitHub for the first time → WI-023 (CI proving the owner-token path) can run.
No decision is owed by anybody else for any of it.

### The guard closed, and then cleared

Two of the dispatches below were refused by the runtime, not by the bots:

> This Bot is replying in multiple chats, so this tool call cannot be assigned
> safely. Retry when the other replies finish.

This is the third different refusal this factory has hit today — _"post_group
is only available in a private chat, not during a group turn"_, _"This tool
call cannot be assigned to an active reply"_, and this one. The pattern is
that the guard watches the **bot**, not the call: while the other Chief
session is replying, this session cannot assign work at all. It cleared twice
— WI-022 and WI-010 both went through — closed again when the other session
started its next turn, and cleared once more at 07:11.

Both request ids are idempotent, so a retry is safe and a retry is not a
second dispatch.

| Request id                                      | Item                                                               | To     | Task                | State, 2026-10-21 11:05, and this session's 10:03 +11:00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `wi-022-publish-waiting-reasons`                | WI-022 — the published waiting list's reasons                      | Wren   | `task_ed4c3132afe9` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry was cancelled at 07:29 and **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-010-verify-forge-rewrite`                   | WI-010 — the direction, verified                                   | Probe  | `task_4cc3a3b1160f` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry `task_5666d5ca0dc2` is **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-024-forge-adoption`                         | WI-024 — the panel takes Forge                                     | Cog    | `task_5354f76acca3` | **cancelled** at 07:49:25 — **and it has a successor**: Chief's retry under the same id made a fresh task, `task_5a09991ca5a1` (batch `batch_72271e402bc9`), queued — **that is the live dispatch on WI-024**                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-025-direction-adr`                          | WI-025 — the direction answer in ADR 0007                          | Wren   | `task_ce64c47ef3d9` | **cancelled** at 07:49:25 — **Chief implemented it** (`0d4ec09`); Probe's verdict is in and it is **not verified**, and the record pass is with Wren as `wi-025-adr-record-pass-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `wi-026-waiting-kind`                           | WI-026 — the waiting list's kind grows by one                      | Wren   | `task_fbb0e0528036` | **cancelled** at 07:29 — **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-027-unknown-turn`                           | WI-027 — an unknown turn reaches the waiting list                  | Cog    | `task_9425c9b2a237` | **cancelled** at 07:49:25 — the retry `task_18f3c6c43c9d` **ran 08:34–08:51 and landed `c9bb0bc`**; the item is now in verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-028-memory-read-privacy`                    | WI-028 — an agent's own memory is private to it                    | Cog    | `task_99c5c5eeb7aa` | **cancelled** at 07:49:25 — the code landed in `622812c`; the contract half was dispatched at 07:59 as `task_146247be56d5` (queued)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-029-exposure-race`                          | WI-029 — the exposure test does not race the reset                 | Probe  | `task_085e132ddaa1` | **cancelled** at 07:49:25 — the race is green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-030-publish-two-shapes`                     | WI-030 — publish the template record and the measures route        | Wren   | `task_f31d629a27b8` | **done** at 08:34:37 — the two entries landed in `e682224` (`CONTRACTS.md:434`, `:935`); **Probe's verification is dispatched** as `wi-030-verify-published-shapes-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-005-ci-review-2`                            | WI-005 — the two CI changes, re-reviewed                           | Probe  | `task_94125a893054` | **done** at 08:29:18 — its findings are being implemented in the tree now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-017-resource-templates`                     | WI-017 — a template tells an agent what a good resource looks like | Cog    | `task_d9352ee63330` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_0256a298ca60` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-017-template-record-successor-2026-10-21` / `task_4b5a7d412c11` (queued)                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-020-measures-route`                         | WI-020 — the product reports on itself                             | Cog    | `task_6c20e85110f9` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_d4813ecd34ee` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-020-measures-successor-2026-10-21` / `task_7fca497d2514` (queued)                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-022-verify-contract`                        | WI-022 — verify the published reasons                              | Probe  | `task_8e6fe1c54bfb` | **cancelled** at 08:33 — re-dispatched under `wi-022-verify-contract-r2` as `task_38cb5ecee977`, **done** at 10:37 — **all seven criteria met; WI-022 is accepted**, the item's own "Changed" line corrected, and the citation refresh dispatched as a successor                                                                                                                                                                                                                                                                                                                                                             |
| `wi-026-verify-contract`                        | WI-026 — verify the published kind                                 | Probe  | `task_3f565465dba3` | **cancelled** at 08:33 — re-dispatched under `wi-026-verify-contract-r2` as `task_25bf9ea7e2cb`, **done** at 10:52 — **all seven criteria met; WI-026 is accepted**, the criterion's citation corrected                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `wi-025-verify-adr`                             | WI-025 — verify the direction answer in ADR 0007                   | Probe  | `task_2b5c9020bf00` | **done** at 09:48 — **not verified**: three defects (a pointer, a figure the ADR should not carry, and the count of travelling rules). The record pass is with Wren; the re-verification is owed after it                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-012-verify-fixed-tree-2026-10-21`           | WI-012 — the memory guard, the fixed tree verified                 | Probe  | `task_d9cfcc0b665f` | **done** at 09:45 — **all eight criteria met; WI-012 is accepted**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `wi-010-return-d1-d5-2026-10-21`                | WI-010 — the direction document, returned for repair               | Vision | `task_900cda1c2202` | **cancelled** at 10:40 by Chief, before it started, so that one finding could be added — re-dispatched as `wi-010-return-d1-d6-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-010-return-d1-d6-2026-10-21`                | WI-010 — the same work, D1 to D6                                   | Vision | `task_9107d7d623d6` | **queued** — **the live dispatch on WI-010**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-008-close-reply-classification-2026-10-21`  | WI-008 — the classification of `closeReply`                        | Cog    | `task_1404e5875644` | **done** — the classification is in the table and criterion 2 is met                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `wi-031-contract-2026-10-21`                    | WI-031 — the contract half, the route that closes a turn           | Wren   | `task_8ef054ed68d0` | **queued**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-031-implementation-2026-10-21`              | WI-031 — the implementation, the same route                        | Cog    | `task_a22eeda307db` | **queued**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-007-verify-fixed-tree-2026-10-21`           | WI-007 — the fixed tree, verified                                  | Probe  | `task_2e431d7647e5` | **failed: `BUSY`** at 10:10:17 — **but the work is evidenced**: Probe's own session read the item, wrote and committed the end-to-end pin `d343300` ("Hold the note about a decision to the item it is about"), and ran the suite. **Not re-dispatched** — a second dispatch would be a second worker on one item. The item is carried by the report                                                                                                                                                                                                                                                                         |
| `wi-007-migration-note-2026-10-21`              | WI-007 — the migration note's missing sentence                     | Wren   | `task_e6fe9555ca74` | **queued** — one sentence of `CONTRACTS.md`, and the last thing between WI-007 and acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-027-verify-fixed-tree-2026-10-21`           | WI-027 — the turn on the waiting list, verified                    | Probe  | `task_6a9a1179734c` | **failed: `BUSY`** at 10:19:58, and it produced **no verification at all**. **Spent** — a re-dispatch needs a new id and a new title, and it has one: `wi-027-verify-fixed-tree-successor-2026-10-21`, `task_874e6fb66b9b`                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-021-verify-fixed-tree-2026-10-21`           | WI-021 — the refusal, verified                                     | Probe  | `task_479859728e18` | **failed: `BUSY`** at 10:20:27, and it produced **no verification at all**. **Spent** — the successor is `wi-021-verify-fixed-tree-successor-2026-10-21`, `task_d817d075a0ce`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-017-template-record-successor-2026-10-21`   | WI-017 — the template record, built against the published shape    | Cog    | `task_4b5a7d412c11` | **queued** — **the live dispatch on WI-017**; it merges the two cancelled briefs and adds the Chief's rulings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-020-measures-successor-2026-10-21`          | WI-020 — the two measures, built against the published route       | Cog    | `task_7fca497d2514` | **cancelled** at 10:03 +11:00 by Chief — still queued, so nothing was lost; its brief was merged into the third dispatch, which carries the band ruling. **The live dispatch on WI-020 is `wi-020-measures-route-r3-2026-10-21`**                                                                                                                                                                                                                                                                                                                                                                                            |
| `wi-025-adr-record-pass-2026-10-21`             | WI-025 — the ADR's record pass, with Wren                          | Wren   | `task_c3e1f0b6d558` | **queued** — a pointer, a figure, and one thing not to touch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-030-verify-published-shapes-2026-10-21`     | WI-030 — the two published shapes, verified                        | Probe  | `task_dc2aeef86acb` | **cancelled** at 09:51:26 — **but the work is running**: the other Chief session recorded, in `0d5c98c`, that Probe's verification of WI-030 is running in its own session with a finding in hand (the template record's migration note tells a client to add `resource.template.list` to an agent's toolGrants, and the server rejects that today). **Not re-dispatched** — the two published shapes were corrected at `2dcac9c` while the verification was running, and a correction landing in the file while the verifier is reading it is something the verifier has to account for, not something that closes the item |
| `wi-036-licence-record-2026-10-21`              | WI-036 — the dependency licences, read from the repositories       | Wren   | `task_2c5159aab413` | **queued** — **the live dispatch on WI-036**; the record that WI-038's gate compares against                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-037-product-record-forge-2026-10-21`        | WI-037 — the product record says Desk (B); the owner chose Forge   | Wren   | `task_4947c89ca7fe` | **queued** — **the live dispatch on WI-037**; the overdue truthfulness fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-020-measures-route-r3-2026-10-21`           | WI-020 — the two measures, with the band ruling                    | Cog    | `task_86010eeeb561` | **queued** — **the live dispatch on WI-020**; it carries the band ruling — the band ships only the counts it can defend, and no ratio, until WI-033 and WI-034 land                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-039-evidence-contract-2026-10-21`           | WI-039 — publish the evidence a decision is taken against          | Wren   | `task_dd95fe7df207` | **queued** — **the live dispatch on WI-039**; the contract half of the gap Vision found in the decision control, and it goes before WI-040                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-041-readme-licence-2026-10-21`              | WI-041 — the README tells the truth about the licence              | Wren   | `task_644f23312ebc` | **queued** — **the live dispatch on WI-041**; the owner's "the licence is deliberately undecided" answer, in one sentence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-043-manifest-licence-verify-2026-10-21`     | WI-043 — the manifest no longer claims a licence                   | Probe  | `task_9b1b44c1025f` | **queued** — Chief's one-line removal of `"license": "MIT"`, and Probe's verification of it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `wi-023-owner-token-step-verify-2026-10-21`     | WI-023 — verify the owner-token step in the container job          | Probe  | `task_6437af4f18f0` | **queued** — Chief's own CI change goes to Probe like anyone else's; the whole sequence is proved locally against real Docker, and the item's criteria are met before it is pushed, not after                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-022-citation-refresh-successor-2026-10-21`  | WI-022 — refresh the waiting list's code citations                 | Wren   | `task_682c73ccbc73` | **queued** — **the live dispatch on WI-022**, a successor: three citations that moved when WI-027's code landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wi-024-forge-adoption-2`                       | WI-024 — the Forge adoption, a second dispatch under a new id      | Cog    | `task_2963d3be0f41` | **cancelled** at 09:55 — **the live dispatch on WI-024 is unchanged: `wi-024-forge-adoption`, `task_5a09991ca5a1`, still queued.** Dispatched by the other Chief session; it is not re-dispatched from here                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `peer-group-pointer-2026-10-21`                 | A peer request for Probe to carry a message to the group           | Probe  | `task_4867c6237747` | **cancelled** — it never reached Probe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `peer-correction-wi-024-2026-10-21`             | The correction retracting that peer request                        | Probe  | `task_4dc3ca58d70a` | **failed: `BUSY`** — created 08:35:05, refused at 10:20:55 because Probe was busy. **A dispatch to a busy verifier is not delivered at all**: the work is still owed, the id is spent, and the correction has to be re-sent with a new id and a new title                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-027-verify-fixed-tree-successor-2026-10-21` | WI-027 — the unknown turn on the waiting list, verified again      | Probe  | `task_874e6fb66b9b` | **queued** — **the live dispatch on WI-027**, a successor: the original failed with `BUSY` at 10:19:58 and produced no verification. The brief asks Probe to stop and say so if the item is already being verified in another session                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-021-verify-fixed-tree-successor-2026-10-21` | WI-021 — the refusal, verified again                               | Probe  | `task_d817d075a0ce` | **queued** — **the live dispatch on WI-021**, a successor: the original failed with `BUSY` at 10:20:27 and produced no verification. The brief asks Probe to stop and say so if the item is already being verified in another session                                                                                                                                                                                                                                                                                                                                                                                        |     |

**A cancelled task is not a dispatch — but a cancelled dispatch does not free its
request id.** That second half was wrong here, and it is corrected now rather
than quietly overwritten. The runtime's idempotency check scans **every** batch
it holds, cancelled ones included, for a match on `owner` and `request_id`. A
cancelled batch is still in that list: re-dispatching the same id with the same
bytes returns the **cancelled** batch and starts nothing, and re-dispatching it
with different bytes is refused as a conflict. A request id is spent when it is
used.

The one thing that made it look otherwise: the two `wi-027-unknown-turn`
batches have **different owners**. The other Chief session dispatches with the
Chief bot's id, so its batches are owned by `bot_a71bb218e3b8`; this session
dispatches without one, so its batches are owned by `user`. Same request id,
two namespaces, no collision. That is the whole reason the retry was
possible — not the cancellation.

**So a re-dispatch needs a new request id, and every re-dispatch from 08:39
uses one**: `wi-017-resource-templates-r2`, `wi-020-measures-route-r2`,
`wi-022-verify-contract-r2`, `wi-026-verify-contract-r2`. The request id is
the ledger's handle on the work; it is not a retry token, and a task that
needs doing twice is two tasks.

**The correction, and one more thing the same day measured.** The rule above
stands: a request id is spent when it is used, and a re-dispatch needs a new
one. What the day added is _where_ the namespace comes from. The idempotency
check matches on **`owner` and `request_id`**, and the owner is the chat the
dispatch was made from — so **the two Chief sessions dispatching into this same
group chat share one namespace, and an id either of them has used is spent for
both.** Chief measured that three times at 10:40: two dispatches were refused
with _"This request_id was already used with different task content; nothing
was dispatched"_, and a richer brief could not go under a used id. Across
chats it is a different namespace, which is why the 07:11 WI-024 dispatch and
Chief's 10:20 retry of the same id did not collide.

**So the practical rule for both sessions: a request id is unique across the
factory, not per session, and a brief that carries more needs a new id — and
the new dispatch also needs a new title.** The two refusals Chief hit matched
an existing dispatch on **both** id and title; the attempts that changed both
were accepted. WI-017 and WI-020 were each dispatched three times today, and
each of those collisions cost a round trip.

**"Queued" does not mean "in progress."** At 08:15 nothing in the fleet was
running, for the reason recorded under "The fleet's queue did not drain".

WI-025 and WI-026 are deliberately behind WI-022, which is with Wren as
`task_ed4c3132afe9`, because the file is live and the order in it is WI-022
first, then WI-025, then WI-026. WI-024 goes behind WI-003, WI-017, WI-018
and WI-020 rather than jumping them: the recorded order stands. WI-027 and
WI-028 are ahead of WI-024, because the owner is holding the push until the
tree is green and those two are on the path to green.

### The seven reds, measured

Chief measured the tree at 06:18 and the other Chief session measured it at
06:14. They are not in conflict: the difference is a test that had not failed
yet. The tree has **seven** deliberate reds, and every one of them now has an
owner.

| #   | The red                                                        | Where it is fixed                           |
| --- | -------------------------------------------------------------- | ------------------------------------------- |
| 1   | The waiting list's missing `unknown` reason                    | WI-022, with Wren                           |
| 2   | The waiting list's missing `turn` kind                         | WI-026 (the contract) and WI-027 (the code) |
| 3   | An agent can write into another agent's memory                 | WI-012, with Cog                            |
| 4   | An agent can read another agent's memory                       | WI-028, with Cog — **the owner's ruling**   |
| 5   | The panel does not say a turn was closed rather than continued | WI-007, with Cog                            |
| 6   | The password exposure test races the reset it inspects         | WI-029, with Probe                          |

The e2e red is #5: `apps/web/e2e/waiting-list.spec.ts`, "the panel says when a
turn was closed rather than continued". The contract promises it at
`CONTRACTS.md:598` and the server keeps it — the decision route returns the
outcome and the detail — but the panel's decide mutation reads the response
only to invalidate the query, so the detail never reaches the screen and the
owner is left with a red "failed" and no sentence saying the operation was
never performed. The test was added by `5649c6d` on purpose, and it belongs to
WI-007.

The sixth is #6, and it is the one the other count did not have: it passes on
its own and fails only under the full suite's load, because the test holds a
database lock while it reads the reset's command line and the reset's own busy
timeout is ten seconds. A test that answers differently depending on what else
the machine is doing is not a gate.

### The runtime stopped at 07:12, and what it took with it

At 07:12 the local runtime stopped and came back. It took three things with
it, and none of them is a work item, so none of them is lost — but the
record has to say what happened, because two dispatches died in the same
millisecond and the ledger would otherwise read as if two items had been
abandoned.

**What died.** `task_ed4c3132afe9` (WI-022 to Wren) and `task_4cc3a3b1160f`
(WI-010 to Probe) both failed with `AGENT_UNAVAILABLE` — 112 and 122
milliseconds respectively, before either bot did any work. The other Chief
session retried both with the same request ids, so a retry is the same
dispatch and not a second one: **`task_f438b61f9116`** for WI-022 and
**`task_5666d5ca0dc2`** for WI-010. Both are live and queued.

**What is down.** The other Chief session's session is `interrupted` — _"This
session was interrupted because the previous local runtime stopped"_ — and
Probe's session is `aborted`. So the direction's verification (WI-010) and the
exposure race (WI-029) are queued and waiting for Probe's session to come
back, and the other Chief session has nine queued messages it has not read.
This session's own shell died in the same moment and was restored.

**What survived, and it is the important part.** The other Chief session's
work is committed: its acceptance pass (WI-004, WI-006, WI-009 accepted;
WI-011, WI-012, WI-013, WI-021 returned), the record of the owner's nod on
WI-017 and WI-020, and the corrected return on WI-008. The repository is the
state, and the state is intact.

**And one mistake of Chief's, recorded rather than quietly undone.** Before
the ledger said the retries were the live ones, Chief created a second
dispatch of each item under a fresh request id — `task_479fab57ee5a` for
WI-022 and `task_9c489671bc15` for WI-010 — on the belief that the first
dispatch was dead and no retry had happened. Both are cancelled. One item,
one dispatch; one verifier, one item, one verification.

**The number space, in practice.** The session that owns it is down, so this
session took WI-024 through WI-029, and every one of those numbers is named
in this file. That is what the rule says to do when the number-owning session
is not running, and it is why the numbers are here rather than only in the
files.

### The Forge direction — opened, as [WI-024](../work/WI-024.md)

The want that was recorded here is now a work item. The other Chief session
handed it over in writing — _"WI-010 is closed out and the build item is yours
to open"_ — and this session opened it rather than leaving it a want.

- **Title:** The panel takes Forge — an orientation room and an execution
  room.
- **Owner:** Cog, with the direction's own terms. Two rooms, two densities, a
  new component, and the front door moving out of the root into the execution
  room.
- **Criteria:** the cost of adopting Forge now is stated concretely — which
  parts of the existing app are affected, what in WI-004's landing page is
  preserved, and what is reworked, as a list and not as "low effort"; the
  boundary is the settled one, the rule-based one in
  [`prototypes/DIRECTION.md`](../prototypes/DIRECTION.md); the decision
  control is not rebuilt by the direction, and the landing page's _layout_ is
  what changes; the landing page ends up in the execution room, because it is
  the decision list; and the document is written where the next agent will
  find it.
- **Not urgent:** the control ships first and is not blocked, so the owner's
  top want does not wait for this.

**The two numbers this session took, and why they are named here.** The number
space has one owner, and the other session owns it; it handed over two items
in writing, and this session took the two numbers for them:

| Number | Item                                                              | Owner |
| ------ | ----------------------------------------------------------------- | ----- |
| WI-024 | The panel takes Forge — an orientation room and an execution room | Cog   |
| WI-025 | The direction answer, written into ADR 0007                       | Wren  |

They are named here rather than only in the files, because a session that opens
items reads this file before it opens anything, and a number that is taken in
two places is a number nobody takes twice. WI-025 was not in the hand-over
text by number, but it is the second half of it — _"Wren writes the direction
answer as a section of ADR 0007 — after the answer, not before"_ — and ADR
0007 still says the direction is Desk (B) and _"not yet decided"_, which is
now false.

**One thing this section does not decide, and says so out loud.** The
direction's own cost model is in `prototypes/DIRECTION.md`, rewritten for D
after the owner's answer. That rewrite is Chief's own writing, so it goes to
Probe before WI-010 is accepted, on the rule that a work item Chief wrote and
Chief accepted has no reviewer in it — and the cost model inside it is the
number the biggest item in the queue is sized from, so it is worth one
verifier slot to check.

## The owner's decisions, 2026-10-21 07:07

Two questions, both answered, both one choice.

| #   | Question                                                                                                                   | Answer                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Does the published waiting-list kind grow by one, so an agent turn whose outcome could not be confirmed reaches the owner? | **Yes.**                                                                        |
| 2   | May an agent read another agent's own memory?                                                                              | **No** — an agent's own memory is private to it, on reads as well as on writes. |

**The first answer releases three items, and the numbers are named here.** The
owner approved a published type growing, so there is a contract to publish, an
implementation to write against it, and a second obligation that the same
ruling settled:

| Number | Item                                     | Owner | What it is                                                                                                               |
| ------ | ---------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| WI-026 | The waiting list's kind grows by one     | Wren  | The published kind, the migration note, and the entry that says the code does not implement it yet.                      |
| WI-027 | An unknown turn reaches the waiting list | Cog   | The implementation, built against the published shape, and the one-line correction that says which commit implements it. |
| WI-028 | An agent's own memory is private to it   | Cog   | The read-side guard, and the two contract entries that stop disagreeing.                                                 |

And one more, which the owner's answers did not cause: **WI-029**, owner
**Probe** — the password exposure test races the reset it inspects, so it
passes alone and fails under load. It is the seventh red, and the only one
that was a race rather than a specification of a defect.

The contract leads and the code follows — that is the house order, and it is
why WI-026 says outright that the code does not implement the kind yet. A
published member the product never produces is a drift of the kind this
factory has spent a day closing: `CONTRACTS.md:544` publishes
`executionOwner: 'external' | 'human'` and nothing ever writes `'external'`.

**What the second answer settles that was not a defect.** The read side of the
memory rule was never a defect report. The test that pins it says so itself:
_"This one is a question, not a breach… this test pins the stricter reading
until the owner says which one holds."_ The owner has now said, and the test
was the specification all along — it stays in the suite and it goes green.

**What the two answers do not change.** The push is still held until the tree
is green, and the tree is not green yet. The seven reds and their owners are
listed in "The seven reds, measured" below: WI-022 and WI-026 (the waiting
list's published shape), WI-027 and WI-028 (the two the answers released),
WI-012 (the memory guard's write side), WI-007 (the panel's closed-rather-
than-continued wording), and WI-029 (the exposure test's race). None of that
needs a decision from anybody else now, and every one of them has an owner
and a next step.

**The number space, once more.** These three numbers were taken by this
session because the owner's answer is new information the number-owning session
has not read yet, and an item that is released and not numbered is an item
that waits. They are named here, in the file a session reads before it opens
anything.

## Candidates

Gaps Chief found in the repository. These are **not** wants. They are
possibilities, and they become work only when the owner picks one or asks for
something that leads to it. Each names where it was seen.

| #    | Candidate                                                                                                                                                                                                                                                                                                                                      | Found in                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| C-01 | An approval closes its execution instead of resuming the interrupted agent turn                                                                                                                                                                                                                                                                | ARCHITECTURE.md, known limitations                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-02 | The event stream polls the event table every 250 ms instead of holding a connection to the worker                                                                                                                                                                                                                                              | ARCHITECTURE.md, known limitations                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-03 | ACP sessions are created per turn instead of resumed, though the protocol supports it                                                                                                                                                                                                                                                          | ARCHITECTURE.md, known limitations                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-04 | Only the OpenAI-compatible model API shape is implemented                                                                                                                                                                                                                                                                                      | ARCHITECTURE.md, known limitations                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-05 | Milestone 05 is partially implemented — scoped autonomy policies, review and acceptance workflow, evidence capture                                                                                                                                                                                                                             | ARCHITECTURE.md, incremental build plan                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C-06 | The CLI adapter is supervised, not sandboxed                                                                                                                                                                                                                                                                                                   | ARCHITECTURE.md, security posture                                                                                                                                                                                                                                                                                                                                                                                                                          |
| C-07 | The instance has one owner; no teams, no sharing, no permissions                                                                                                                                                                                                                                                                               | ARCHITECTURE.md, known limitations                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-08 | 55 kB of zod is in the first paint, because the client validates every event frame with the contracts schema                                                                                                                                                                                                                                   | WI-001, Cog's report                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| C-09 | Four UI directions were built as prototypes; the owner has not chosen one, and direction D leaves the boundary between its two rooms open                                                                                                                                                                                                      | `prototypes/README.md` — [WI-010](../work/WI-010.md) is delivered ([`prototypes/DIRECTION.md`](../../prototypes/DIRECTION.md), commit `7ab0eb6`): the recommendation is **B — Desk**, and the owner has been asked to confirm it in one word — the answer is pending                                                                                                                                                                                       |
| C-10 | The panel can list an approval but cannot decide one — nothing in `apps/web` calls `POST /api/approvals/:id/decide`, and no code fetches `GET /api/approvals`                                                                                                                                                                                  | `apps/web/src`, WI-004 review, 2026-10-20                                                                                                                                                                                                                                                                                                                                                                                                                  |
| C-11 | An agent has no memory of its own — `MemorySpec.scope` is `workspace \| conversation \| goal`, and the plugin gives every bot a scoped, budgeted memory of its own                                                                                                                                                                             | the MiniMax Bot brief §3.1, 2026-10-20 — **decided: an agent gets its own memory scope**, [WI-012](../work/WI-012.md). The plugin's `self/team/bot` scope enum is the plugin's dependency shape and is not imported; the idea is expressed in our own scope model. It is a second published-contract change, so it goes last in the order                                                                                                                  |
| C-12 | The loop-breaker counts, it does not observe — a ping-pong between two agents is stopped by a limit (depth, turns, duration, spend) rather than by "no new tool progress"                                                                                                                                                                      | the MiniMax Bot brief, 2026-10-20 — excluded from [WI-009](../work/WI-009.md) on purpose                                                                                                                                                                                                                                                                                                                                                                   |
| C-13 | Nothing checks the licences in the dependency set, and one of them could change what the product is — n8n is Sustainable Use and "not licensed under any of the main open source licenses", Dify is a modified Apache 2.0 with additional conditions, and vendoring AGPL-3.0 code into this repository would change this project's own licence | licence sweep, 2026-10-20                                                                                                                                                                                                                                                                                                                                                                                                                                  |     |
| C-17 | Message reactions and per-agent usage statistics are missing                                                                                                                                                                                                                                                                                   | the MiniMax Bot brief §4, 2026-10-20 — cosmetic; they solve nothing the owner is blocked on                                                                                                                                                                                                                                                                                                                                                                |
| C-14 | The event stream polls the event log every 250 ms instead of holding a connection to the worker — the plugin keeps an SSE stream with a keepalive and a per-chat cursor                                                                                                                                                                        | C-02, and the MiniMax Bot brief §3 TR-5, 2026-10-20 — **the owner decided, 2026-10-20 22:34: after the truthfulness work.** WI-009 first, then the approved contracts. It stays a candidate, it is not a work item, and it does not enter the queue                                                                                                                                                                                                        |
| C-15 | A delegated action returns a durable admission receipt that the owner never sees, so "queued" and "done" look the same from the panel                                                                                                                                                                                                          | the MiniMax Bot brief §2 row 6, 2026-10-20 — the plugin's rule is "a receipt is not completion"                                                                                                                                                                                                                                                                                                                                                            |
| C-16 | The event vocabulary has no approval event, so a decision taken outside the panel publishes nothing and the waiting list cannot notice it instantly                                                                                                                                                                                            | WI-004, Cog's report, 2026-10-20 — the fix is an `approval.decided` event in the shared contract, which is a contract change and therefore the owner's                                                                                                                                                                                                                                                                                                     |
| C-18 | The owner's new password is passed as a command line argument, so it is visible in the host's process list to every other user while the command runs                                                                                                                                                                                          | WI-002, Probe's verification, 2026-10-20 — **decided by Chief: keep the published command form and document the cost**, [WI-014](../work/WI-014.md) (owner Wren). The alternative — a form that never puts the password on a command line — changes a published contract, so it needs the owner, a migration plan and a `CONTRACTS.md` update. It stays a candidate, not a work item                                                                       |
| C-19 | Q3's third half is not built — an agent can create a typed, validated resource, but there is no template for a resource anywhere in the product, so nothing tells it what a good one looks like                                                                                                                                                | the strategy decisions, Q3; `packages/contracts/src/resource.ts`, `apps/server/src/modules/resources/service.ts` — the only templates in the product are HTTP body templates and prompt templates                                                                                                                                                                                                                                                          |
| C-20 | The product does not report on itself — Q6's two measures are not computed and not shown, and no work item covers them                                                                                                                                                                                                                         | the strategy decisions, Q6; `apps/server/src/db/schema.ts`, `apps/server/src/modules/mcp/server.ts` — `resources.createdBy` already separates an agent's authorship from the owner's, and `auditLog` records the actor of every action — **the source claim was corrected 2026-10-21, on Probe's WI-011 review: `createdBy` is hardcoded `'system'` for automations and tasks, and twelve of the thirty-four mutating routes write no audit entry at all** |
| C-21 | The panel can decide but not take back — there is no undo, revert or rollback in the server or the web client, and with one owner there is no second operator to absorb a bad action                                                                                                                                                           | `apps/server/src/db/schema.ts` — `resources.revision`, `automations.revision` and `auditLog` are the substrate, so an undo is a surface over data the product already keeps                                                                                                                                                                                                                                                                                |

| C-22 | The waiting list has a way in and no way out — the published vocabulary carries `approval.requested` and `task.updated` but no `approval.decided`, and `POST /api/approvals/:id/decide` publishes nothing, so a decided approval leaves the list only when something else publishes or the safety-net refetch catches it | `packages/contracts/src/agent.ts`, `apps/server/src/api/approvals.ts`, `apps/web/src/components/WaitingList.tsx` — C-16 asks for the same event from the outside-decision angle; the gap is the absence of a push-out channel at all |

## The order

The four items the MiniMax Bot brief produced are all owned by Cog, and Cog
is one implementer. So the order is not a preference, it is the only thing
that can happen.

**WI-004 → WI-020 + WI-021 → WI-018 → C-14 → WI-017.**

**The order, 2026-10-21 03:30, rewritten because most of the batch landed.**
Between 23:55 and 03:20 the contract batch, the persona, the agent's memory,
the stack check, the coordinator rule and WI-004's decision control all
landed: `5f019b9`, `bf400bd`, `70d042c`, `e764e6a`, `ff15a90`, `3872dbc`,
`a2aadb4`. What is left is the part that was never started.

1. **WI-004** is in flight with Cog. Probe found two criteria unmet — the
   approval row carried no control, and the entry did not say which agent
   was waiting — and both now have implementations in the tree: the control
   (`a2aadb4`), and the agent on the entry, which the client renders by name
   or by id and the server sends as `agentConnectionId`. It is one report
   away from verify.
2. **WI-020** (the product counts what it did) and **WI-021** (a delegation
   addressed to a participant is not silently dropped) are next. WI-020
   waits on the owner's nod for the route; WI-021 waits for WI-009's
   verification, because it is the same file.
3. **WI-018** (the published `WaitingItem` lives in the contracts package)
   comes after WI-004's front end settles, because the shape of a waiting
   item changes while it does. **WI-022** (the published waiting list's
   reasons are missing the one the code emits) is the same published shape,
   and the two are cheaper as one item — one pass over `CONTRACTS.md`, one
   over the type — so they should land together.
4. **C-14**, the live stream, keeps the floor the owner set for it: after the
   truthfulness work and the contracts, and after the inbox, because the
   owner's judgement criterion is the inbox.
5. **WI-017** (the templates) is last among the substance, gated on the
   owner's answers about the template concept and the protocol boundary, not
   on its priority.

**What the 23:55 order said, and why it is superseded.** It was
WI-009 → WI-008 → WI-007 → WI-006 → WI-012, with WI-009 second rather than
first because its dispatch was refused by the runtime's guard and the
contract batch went out without it. It is superseded because that batch
landed, not because the reasoning was wrong: an item that crosses no
published boundary goes first, an item whose window is open goes next, and
an item that depends on another goes after it.

### Chief's adjudications, 2026-10-21 03:30

- **WI-009 — accepted into verify.** Every gate that applies is green with
  the actual output: typecheck, 190 server tests and the rest, format,
  build, smoke. The e2e gate does not apply — no web client changed — and
  the two e2e failures are WI-004's criteria 1 and 5, which were failing
  before this change and are not this item's. No contract change and no
  migration: the published safeguard already says what the behaviour must
  be, and Probe's covering tests were failing before and pass now.
  **One condition on the verification:** Cog changed the owner's own message
  in coordinator mode — it now reaches the coordinator even when it names a
  participant — and no test pins it. The behaviour is accepted, because it
  makes the mode's published promise true and matches how a mention already
  behaved. The gap is the missing test, so Probe's verification must pin it
  or the item returns.
- **WI-009's second finding is now WI-021.** The MCP tool's
  `targetParticipantIds` argument is matched against agent connection ids, so
  a client passing real participant ids has them silently dropped. That is a
  published-argument defect, not a taste question, and it is a work item now.
- **WI-011 — Wren's report accepted, and the two additions stay.** The
  conversation question is in scope: it is question six of the six the ADR
  has to list, WI-004's own criterion refers to it, and the ADR is the
  record of what is open. The record that said four questions where there
  were six was a plain error, and it is corrected. The item is in review:
  the product record and ADR 0007 landed, and Probe's verification is owed.
  The verification dispatch was refused twice by the runtime's
  task-assignment gate and was **delivered on the retry at 03:40** — task
  `task_e2219b4e3c7a`, batch `batch_4a96612a2eaa`, request id
  `wi-011-probe-review-2026-10-21`, so the retry was idempotent rather than
  a second worker.
- **WI-004's verification is dispatched to Probe, 03:42** — request
  `wi-004-probe-reverify-2026-10-21`. The item is in review with the
  implementation landed in `a2aadb4`, and both of Probe's two failing
  criteria now have implementations: the control, and the agent on the entry
  (the client renders the agent by name or by id, and the server sends
  `agentConnectionId`). This verification is the one that unblocks the
  `npm run test:e2e` gate, which was red only because of this item. The
  dispatch is recorded here and not in the item's own file, because the other
  Chief session is the lead on that file; the rule that a claim is the item's
  dispatch record is honoured by this note, and it is said out loud in the
  group.

**The two decisions that had no work item behind them, 2026-10-20 23:55.** C-19
and C-20 are not candidates. They are the unfunded halves of decisions the
owner already made: Q3's third half — "authored through templates" — and Q6 —
"the product reports on itself". A decision with nothing behind it is a wish,
and FACTORY.md now says so.

- **C-20 → [WI-020](../work/WI-020.md)** — the product counts what it did.
  Sized, and waiting on the owner's nod: a read-only route is a published
  contract.
- **C-19 → [WI-017](../work/WI-017.md)** — a template tells an agent what a
  good resource looks like. Sized, and waiting on the owner's nod: a template
  in the resource model is a published concept, and the way templates reach
  agents depends on the protocol-boundary answer below.

**The questions waiting on the owner, 2026-10-20 23:55.** Six, and each one is
a word or a sentence. Chief's recommendations are in brackets.

1. **The direction — Desk (B)?** [B] One word. The adoption item and the
   home's layout wait on it; the decision control does not.
2. **The measures route.** Q6 needs somewhere for the two numbers to come
   from. Approve one read-only route, same auth as everything else? [yes]
3. **The template concept.** Approve a resource-template registry in the
   published model, reached by agents through our own MCP surface? [yes]
4. **Reversibility.** With one owner there is no second operator to absorb a
   bad action, so authority without reversibility is exposure. Is it a
   product principle that the owner's decisions are reversible? [yes]
5. **The protocol boundary.** The panel's agent-facing surface conforms to
   MCP and AG-UI; ACP and A2A are the agent-connection side, which we speak
   when we connect out to an agent. Our resources, tasks and goals stay ours,
   and no protocol is forked. [yes]
6. **Can a conversation wait on the owner's reply?** Today the data model
   cannot: `WaitingKind` is `approval | task`, and no contract carries a
   state for a conversation waiting on a person. If yes, it is a third kind of
   entry, a contract change, and the clause in WI-004's criterion that says
   "an entry that needs a reply opens the conversation it belongs to" becomes
   real instead of vacuous. [yes — an agent asking its owner a question is
   the most direct form of talking to agents]

7. **WI-009** (coordinator-only handoff) is first because it crosses no
   published boundary, so it needs no approval and no contract entry. It is
   also the smallest. Chief answered its one open question from
   `CONTRACTS.md:99-107` — it is a defect against a published mandatory
   safeguard, not a contract change.
8. **WI-008** (outcome unknown) is second because it is the smallest of the
   contract changes, because its window is open _now_ — WI-004's front end
   is held, so landing it before that front end is finished avoids a second
   pass over the waiting list — and because WI-007's last criterion depends
   on it.
9. **WI-007** (approval resumes the turn) is third because it is the clearest
   interaction defect there is, and because it needs the `unknown` state to
   finish its last criterion.
10. **WI-006** (persona) is fourth because it is the largest item, and
    because one of its display criteria touches WI-004's front end, which is
    still held.
11. **WI-012** (an agent's own memory) is last because it is a second
    published-contract change, and because an agent's memory only means
    something once the agent has a role.

**The owner's answer put the live stream after this batch.** C-14 — one live
SSE connection with a per-chat cursor instead of a 250 ms poll — stays a
candidate, and it comes after WI-009 and the approved contracts. It is not a
work item, and it does not enter the queue.

**WI-013** (Wren) is the one item that is not Cog's: it writes the four
`CONTRACTS.md` entries and their migration notes, and each of the four code
items carries "the contract entry exists" as an acceptance criterion. The
authority runs one way — the published contract is the truth and the code is
checked against it.

**The capacity finding, said out loud.** This batch adds four implementation
items to one implementer, on top of WI-002 in verify and WI-004 on hold.
Cog cannot start any of them until the tree is clean of the items already in
flight, and one implementer means one item at a time. Sizing a brief is
therefore not just writing the items — it is saying which one starts first
and what does not start yet. `FACTORY.md` now carries that as a rule.

**The tree is the other constraint, and it is not mine to fix.** As of
2026-10-20 22:20 the working tree is red, and every red line belongs to
another item: `scripts/verify-bundle-size.ts` has two type errors at lines
190 and 195 (WI-005's verifier work, in flight), and `scripts/smoke.ts` plus
`ownerPasswordRecovery.test.ts` carry uncommitted changes from WI-002 and
WI-005. `npm run format:check` is green; `npm run typecheck` is not.

So the order of landing, before anything new starts:

1. **Landed, 2026-10-20 23:30.** Probe's WI-005 work —
   `scripts/verify-stack.ts` and `apps/server/src/__tests__/verifyStack.test.ts`
   — which Probe deliberately left uncommitted because another session was in
   the tree. Chief lands it, path-limited, so the attribution stays honest.
2. **Landed, 2026-10-20 23:30.** Probe's WI-002 verification —
   `scripts/smoke.ts` and `apps/server/src/__tests__/ownerPasswordExposure.test.ts`
   (named `ownerPasswordRecovery.test.ts` before it was renamed) — and Wren's
   documentation rewrite: `AGENTS.md`, `CHANGELOG.md`, `CONTRACTS.md`,
   `CONTRIBUTING.md`. Three owners' finished work, three path-limited
   commits, each credited to its author.
3. **WI-002 closes** — but not on the verification alone. Probe's verification
   is red on two of its four assertions: the exposure is real, and neither
   `CONTRACTS.md` nor `README.md` says what it costs. The fix is
   [WI-014](../work/WI-014.md), owner Wren. WI-014 lands, the four assertions
   pass, WI-002 closes, and only then does WI-009 start.

**Two items that are not Cog's entered the queue tonight**, and neither is in
the batch above:

- [WI-014](../work/WI-014.md) — the documentation says what the password
  recovery costs. Owner Wren. It waits on nothing, but it shares
  `CONTRACTS.md` with WI-013, so the two are done one after the other.
- [WI-015](../work/WI-015.md) — `verify:stack` must work against a deployment
  that already has an owner. Owner Probe. It is a defect in the gate WI-005
  delivered, found by the clean-checkout run. It did not hold WI-005 back,
  because none of WI-005's acceptance criteria turn on it.

**Probe is verifying WI-004 right now** (task `task_2144ce541299`, started
23:12 +11:00), so the tree is red in three places that are not defects:
`apps/web/e2e/waiting-list.spec.ts` and
`apps/server/src/__tests__/waiting-list.test.ts` are Probe's in-flight work,
and `apps/web/e2e/scratch-diag.spec.ts` is a diagnostic scratch file Probe
marked for deletion after the run. It is what `npm run format:check` is
complaining about. Chief has left all three alone.

WI-009 is the first new item to run, because it is the only one of the four
that crosses no published boundary. The other three stop at the owner's
approval of a contract change, and that is the factory behaving correctly
rather than stalling.

## What was not translated

The MiniMax Bot plugin is a reference implementation, not a feature to copy.
Some of it is deliberately left out, and the reason is kept so none of it
comes back as a surprise:

| Not translated                                                  | Why                                                                                                                                                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groups, members, admins, reply modes, bot creation and deletion | The instance has one owner. No teams, no sharing, no permissions (C-07, W-4). Importing it would import a multi-user product.                                                             |
| Avatars, skins, colours                                         | Cosmetic. They buy nothing for one owner who knows their own agents.                                                                                                                      |
| Message reactions, per-agent usage statistics                   | Cosmetic. Not interaction (C-13).                                                                                                                                                         |
| The plugin's 21-tool MCP surface                                | Personal OS already publishes its own (`packages/contracts/src/mcp.ts`). Two competing surfaces would be worse than one.                                                                  |
| Bot-to-bot delegation as the coordination model                 | Personal OS's factory ledger — goal → task → execution → evidence → acceptance — is strictly better than ad-hoc bot-to-bot messages. Keep the ledger; borrow only the honesty properties. |
| The `start_helper` background-job model                         | The worker already owns background execution, with leases and reaping.                                                                                                                    |
| Per-agent memory scope, for now                                 | A second published-contract change, and the owner excluded it from the persona decision (C-11).                                                                                           |

## The borrowing rule, applied to this brief

The owner's rule, set 2026-10-20: **borrow the idea, not the dependency.**
Another project is inspiration — read it, take the approach, and build the
feature inside this repository against our own contracts, schemas and data
model. No vendored codebase, no runtime dependency.

The MiniMax Bot brief is the first thing this rule has to be applied to, and
it is worth writing the audit down rather than asserting it.

| Item                                            | What is borrowed                                                              | What is ours                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [WI-006](../work/WI-006.md) persona             | the idea that an agent is a named role with standing instructions             | the `Persona` type, the override, the resolver and the turn-context injection are all ours, in our contracts                                   |
| [WI-007](../work/WI-007.md) approval resumes    | the idea that deciding an approval continues the turn                         | the gate is our own `persistentSessions` capability and our own ACP adapter — the ACP interface is **conformed to, never reimplemented**       |
| [WI-008](../work/WI-008.md) outcome unknown     | the idea that "we don't know" is not "failed"                                 | three enum additions, a state machine, an audit transition, in our contracts                                                                   |
| [WI-009](../work/WI-009.md) coordinator handoff | nothing — it is a defect against a safeguard `CONTRACTS.md` already published | the whole thing                                                                                                                                |
| C-11 per-agent memory                           | the idea that an agent can have memory of its own                             | the plugin's `self/team/bot` scope enum is **not** imported; the idea has to be expressed in our own `workspace \| conversation \| goal` model |

One boundary rides on the rule and it is not settled: an **interface** is
conformed to, never reimplemented. Personal OS is a client of ACP, A2A, MCP
and the OpenAI-compatible API shape. "Our spec" means our domain model, not
our dialect of someone else's protocol.

## How a want becomes a work item

1. **Record it in the owner's words.** Not a paraphrase. The owner's phrasing
   often carries the real requirement, and the paraphrase is where it gets
   lost.
2. **Judge it.** Is it worth doing at all? Is it already shipped? Is it a
   duplicate of an open work item? Answer that here, in one line.
3. **Sharpen it with the standing questions.** Only the ones whose answers
   change the work. A question that does not change the work item is noise.
4. **Split it.** One owner per work item. A want that needs two owners is two
   work items (FACTORY.md).
5. **Write the work item** in `.factory/work/WI-NNN.md`, in the format of
   [TASK.md](TASK.md). The acceptance criteria are written so that someone who
   has not read the diff could check them.
6. **Or decline it**, with the reason, and leave the reason here. A declined
   want with no reason is a want that comes back.

## The standing questions

These are the questions Chief asks when a want is under-specified. They live
here so they get sharper each cycle instead of being reinvented each time.

**What are you doing when you open Personal OS?** The product does three
jobs — interaction, coordination and creation. A want usually serves one of
them. Which one gets the better version of it?

**How much should the factory decide on its own?** Between the owner's
replies, the factory either waits for a go-ahead or proceeds within limits it
was given. This sets the cadence of the whole loop.

**What should the factory build next?** One thing. The next work item is
chosen from what the owner asks for, not from what looks interesting in the
repository.

**Which visual direction does the panel take?** Four directions are built as
prototypes in `prototypes/` and none of them has been chosen. The landing page
(WI-004) is written in the current design language, so a direction chosen
afterwards means rewriting its front end. Deciding late costs a rewrite;
deciding early costs nothing that has been built, because the server side of
WI-004 does not depend on the visual language. **[WI-010](../work/WI-010.md)**
prepares the recommendation against the owner's own wants, so the question
comes back to the owner with an answer attached rather than as an open topic.

**What is observably different afterwards?** If the answer is "it feels
nicer", that is a valid reason but it is not a work item. Name the difference:
a screen that shows something, a flow that completes, a failure that no
longer happens.

**What is explicitly not in scope?** The section of the work item that stops
scope creep. It is not optional, and it is usually the hardest part to
write.

## The rules that apply to every want

- One owner per work item.
- **Every new feature is grilled with the owner before it becomes a work
  item.** The owner's rule, 2026-10-20: _"dont rush to implement a feature
  when we havent discussed it."_ The grilling is Matt Pocock's `grill-me`,
  installed at `~/.minimax/skills/grill-me` and `~/.minimax/skills/grilling`
  (MIT, © 2026 Matt Pocock). It asks in rounds: each round is the whole
  frontier of settled questions, every question carries a recommended
  answer, facts are looked up rather than asked for, and the decisions belong
  to the owner. A work item does not open until the frontier is settled and
  the owner has confirmed the shared understanding.
- Never open a work item twice: post to the group **or** dispatch directly,
  never both.
- Never weaken a gate to make a want affordable.
- A want that changes a published contract needs a migration plan and a
  [CONTRACTS.md](../CONTRACTS.md) update **before** it is scheduled, not
  after.

**Chief may hold; only the owner releases.** When the owner asks for a
strategy discussion, Chief holds the items in flight, records the hold and
the findings in the work item, and opens nothing new. The queue moves when
the owner says so.

## The tiebreak: the decision control lands before the theme, 2026-10-20 23:30

The Desk theme (the direction in C-09) and WI-004's decision control both
touch the panel, and one of them has to go first so the palette is not paid
for twice. **Chief decides this, and the answer is: the control first, then
the theme.** The reasoning, out loud:

- **The control is in flight.** Probe is verifying WI-004 right now (task
  `task_2144ce541299`, started 23:12 +11:00). An item in flight owns the tree
  until it lands, and reversing the order would throw away a verification that
  is already running.
- **A palette pass over the finished panel costs one pass either way.** If the
  theme lands after the control, the theme covers the control too, so the
  panel is painted once, at the end, in its final shape. If the theme landed
  first, the control would have to be painted again by hand afterwards.
- **The theme could not start first in any case.** It needs the direction
  confirmed, and that question is already with the owner in the strategy
  chat (C-09) — one word: **Desk (B)**, **A**, **C** or **D**.

So the order is: WI-004's control lands, then the theme, once the owner has
confirmed the direction. Nothing here needs the owner to decide: sequencing
and capacity are Chief's job, and asking would be punting it to the person
who has the least context for it.

**The visual direction itself is still the owner's**, and it is still
pending. Chief has a recommendation and a reason for it; the choice between
four built prototypes is a product decision, and the owner's rule is that the
queue moves when the owner says so.

## Owed, 2026-10-21 01:08

The status post for this round was **refused twice** — the `Personal OS
Factory` group is mid-discussion, and the 23:40 post (`task_70c6057c13ae`) is
still queued behind it. A post that was never sent is not a message, so it is
recorded here and delivered from here when the round clears.

## The state at 2026-10-21 03:30 — the gates are green

**Every gate is green for the first time.** Measured by Chief on the tree at
`a2aadb4`:

| Gate                   | Result                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `npm run typecheck`    | exit 0                                                                                    |
| `npm run test`         | exit 0 — server 190 passed (21 files), web 46, worker 23, agent-adapters 16, contracts 28 |
| `npm run format:check` | exit 0                                                                                    |
| `npm run build`        | exit 0                                                                                    |
| `npm run test:e2e`     | exit 0 — 24 passed                                                                        |

**The two reds that were carried are gone.** Both were real, and both were
fixed by a concurrent session while Chief was measuring them:

- `npm run test` was red on two files, both Probe's tests proving WI-009's
  defect. `3872dbc` ("Keep the coordinator rule on the path that names a
  target") closed the gap — the explicit-target path had been applied
  _before_ the routing mode was consulted. Chief ran the two files
  directly: `Test Files 2 passed (2)`, `Tests 24 passed (24)`.
- `npm run test:e2e` was red on two of Probe's browser tests, both
  specifying WI-004's missing control. `a2aadb4` ("Let the owner decide an
  approval where the list is") delivered it.

**Chief's standing rules, restated because they were both nearly broken
again:**

- _Never merge without the gates green._ The branch carried two reds for
  hours. Chief did not merge, and did not weaken a gate to clear them.
- _One file, one live item._ Chief wrote a new work item over the top of
  another session's live WI-021 and clobbered it. It was restored from
  `HEAD` unchanged and Chief's item took the next free number, WI-022. This
  is the **second** collision of this kind in this factory — WI-016 was the
  first, and WI-020 carries the renumber note from it. Chief's own item
  number was the cause this time, not a filename.

## The findings Chief made while the gates were green

The gates being green made it worth asking what the **published contract**
now says against what the **code** now does. Two real defects came out of
it, and neither is a gate:

1. **[WI-013](work/WI-013.md) — returned to Wren.** All four contract
   entries say _"The code does not implement it yet"_ — and the code
   implements all four (`9ad4f98`, `70d042c`, `5f019b9`, `e764e6a`). One of
   them, WI-008's, was **already false when it was written**: Chief checked
   with `git merge-base --is-ancestor 9ad4f98 5a7e620` (exit 0, so the
   implementation was already in the tree) and read the tree at `5a7e620`,
   which carries `'unknown'` in `messageStatusSchema`.
2. **[WI-022](work/WI-022.md) — opened.** `CONTRACTS.md:632` publishes
   `WaitingReason = 'pending' | 'review' | 'blocked'` and
   `apps/server/src/api/waiting.ts:17` declares a fourth member,
   `'unknown'`. A published type the code has outgrown. WI-008's own commit
   message named this gap and left it — a gap named in a commit message and
   left there is a gap with no one holding it.

## The post that is owed, request id `status-2026-10-21-0105`

The earlier post, superseded by the one below. Kept because it is the record
of what was owed at the time:

- WI-004 returns to implement — Probe's verification says it fails criterion 5
  (an approval is approved or rejected in the list) and the "who is waiting"
  half of criterion 1. Dispatched to Cog, `task_4bafb60edd39`.
- WI-009 implemented and committed (`6e7d347`), with Probe for verification,
  `task_1c40cabe1df4`. WI-008 implemented and committed (`9ad4f98`), with
  Probe for verification, `task_8bb9dbcfbeaa`.
- WI-013's four published contract entries are landed (`5a7e620`). WI-002 and
  WI-014 are accepted.
- The gates, measured on the tree with everything landed: `npm run typecheck`
  exit 0; `npm run test` 160 passed (160) in 17 files, plus 46, 11, 13, 13;
  `npm run format:check` exit 0. The one red gate left is `npm run test:e2e`,
  on exactly two tests Probe wrote on purpose to specify WI-004's missing
  control.
- Two corrections: Wren's WI-013 work was landed path-limited as `5a7e620`
  because a bare commit in this tree sweeps other people's work; and the
  remote already exists — `origin` is
  `https://github.com/this-bytes/personal-os.git`, pushed 21:47 +11:00 — so
  the owner is not asked to create a repository.

## The state at 2026-10-21 04:00 — the suite is red again, and the red is the specification

**Probe reviewed WI-008 and the item does not meet its criteria.** Task
`task_8bb9dbcfbeaa`, batch `batch_d6dc904088cd`. The `unknown` state is real
and it reaches the owner correctly, but on two of the three paths an
`unknown` outcome still becomes a retry — the one thing this item exists to
prevent.

**The suite is red at `1cafe35`, on purpose.** Probe's new tests are the
specification of what is left, and they are committed. Chief measured the
tree:

```
npm run test → FAIL (exit 1)
  server:         Test Files 1 failed | 20 passed (21)   Tests 2 failed | 190 passed (192)
  web:            Test Files 5 passed (5)                 Tests 46 passed (46)
  worker:         Test Files 1 failed | 4 passed (5)      Tests 6 failed | 24 passed (30)
  agent-adapters: Test Files 2 passed (2)                 Tests 16 passed (16)
  contracts:      Test Files 4 passed (4)                 Tests 28 passed (28)
```

Eight failures, all of them the retry paths, the contract's waiting reason and
the audit trail. Nothing else is red. Chief's rule stands: the contract is the
truth and the code is the defect — so the tests stay, and the code moves.
WI-008 is returned to Cog, task `task_21b395d2f98a`, batch
`batch_44d6112553e4`.

**Chief confirmed all five of Probe's defects against the tree** before
passing them to Cog. They are in [WI-008](work/WI-008.md): the factory-task
and automation paths test `failure` before `unknown`
(`apps/worker/src/executor.ts:811-815`, `:1002-1006`); the reaper requeues a
job whose item is already `unknown`; the panel gates its accept/reject
control on `review`, so an unknown task cannot be closed by the owner at all;
and leaving `unknown` by assigning the task to an agent writes no audit entry.

### Two duplicate dispatches, cancelled

Two Chief sessions in one tree dispatched WI-004 and WI-011 to Probe twice.
Probe is the only verifier, the queue is deep, and a second worker in one
worktree is what the runtime's own guard warns about. **Chief cancelled his
own two tasks** — `task_4a566d42c121` (WI-004) and `task_f5b5eb99dea3`
(WI-011). The live verifications are `task_616009728104` (WI-004) and
`task_e2219b4e3c7a` (WI-011). One verifier, one item, one verification.

### The routing file went red too — `a7e39e9`

While the factory waited, Probe committed `a7e39e9`: two test files, +211
lines, no source change, and three of the tests are red. They split across two
items — one is WI-009's (the sender is resolved by believing the message) and
two are WI-021's (a named target is dropped before the rule ever sees it).
The file is claimed by WI-009, which is older, so WI-021 waits and the two
findings go to Cog in one dispatch. The details are in
[WI-009](work/WI-009.md).

### The gates at `0732b41`

```
npm run typecheck    → exit 0
npm run test         → exit 1
  server:          Test Files 3 failed | 18 passed (21)   Tests 5 failed | 199 passed (204)
  web:             Test Files 5 passed (5)                 Tests 46 passed (46)
  worker:          Test Files 1 failed | 4 passed (5)      Tests 6 failed | 24 passed (30)
  agent-adapters:  Test Files 2 passed (2)                 Tests 16 passed (16)
  contracts:       Test Files 4 passed (4)                 Tests 28 passed (28)
npm run format:check → exit 0 — All matched files use Prettier code style!
npm run build       → exit 0 — ✓ built in 3.28s
npm run test:e2e    → exit 0 — 24 passed (46.8s)
```

Eleven reds, all of them Probe's specifications: eight for WI-008, three for
WI-009 and WI-021. Nothing else is red, and the browser suite is green — so
the e2e gate, which was the one holding the owner's top want, is now satisfied.

### A want, not a work item — the number space has one owner

`automationRunStatusSchema` (`packages/contracts/src/automation.ts:73`) gained
`'unknown'`, and `CONTRACTS.md` publishes no automation run status at all — so
nothing contradicts it and nothing records it either. It came out of Probe's
WI-008 review. It is recorded here rather than as a numbered item, because
`fff389e` gave the number space one owner and the other session proposes wants
in this file.

- **Title:** The published contract says nothing about the automation run
  status.
- **Owner:** Wren.
- **Criteria:** `CONTRACTS.md` publishes the automation run status, including
  `'unknown'` and what it means on a run; the entry says what a client must do
  with a value it did not expect; the entry is checked against
  `packages/contracts/src/automation.ts:73` by the reviewer.
- **Not urgent:** nothing contradicts it, and no client depends on it today.

### The four wants that came out of Probe's WI-011 review

Probe's review of the product record found six defects, and most of them are
claims the record makes about code that does not do the thing. Fixing the
document is [WI-011](../work/WI-011.md)'s work and it goes back to Wren now.
**These four are the other half** — the code that would make the claims true.
They are recorded as wants, not work items: the number space has one owner,
and a feature needs the owner's release before it becomes an item.

- **A resource records who made it — including automations and tasks.**
  **Owner:** Cog. **The want:** the `automations` and `tasks` tables carry a
  `createdBy` column, and both providers write the caller's id instead of
  `'system'` (`apps/server/src/modules/resources/service.ts:170`, `:260`) —
  the agent's connection id on the MCP path, as the other four kinds already
  do. **Then:** the first measure can be computed for all six kinds instead
  of four, and it stops being answered wrongly for two of them. **Needs:** a
  migration note for the rows that exist.
- **The audit trail covers every mutating route, and the worker's own
  writes.** **Owner:** Cog. **The want:** the twelve routes that write no
  audit entry write one, or the record says which ones do not and why; the
  worker writes an entry when it mutates a shared resource
  (`apps/worker/src/executor.ts:896-911` — `resource.refresh` updates the row
  with no `revision` bump and no entry); the `result` column can record a
  failure, and `POST /api/resources/:id/execute` stops asserting success for
  a run that was merely queued.
- **The external orchestrator is real, or the record stops claiming it.**
  **Owner:** Cog. **The want:** either — `executions.externalRef` keeps the
  external **task** id, the external status is retained, `executionOwner` can
  be `'external'`, the evidence kind `'external-reference'` is written, and
  the panel shows the reference and the result; or the paragraph is cut. The
  `externalTaskId` adapter path (`apps/worker/src/executor.ts:1188-1191`) is
  either implemented by one adapter or removed, because today no adapter
  implements one and the path is dead.
- **The autonomy policy is enforced where it is declared, or the claim is
  cut.** **Owner:** Cog. **The want:** either the workspace and goal policies
  are read wherever they are enforced and a pause is a real policy field, or
  the record says the limits live on the conversation
  (`apps/server/src/modules/conversations/routing.ts:89-110`) and stops
  claiming a pause that no policy carries.

### The post that is owed, request id `status-2026-10-21-0415`

The group post could not be delivered. `post_group` answered **"The group is
mid-discussion; post again once this round finishes"** on every attempt
between 04:15 and 04:30 — the other Chief session has a round in flight, and
the group's own guard holds the door until it closes. The request id makes the
retry idempotent rather than a second post, so it is recorded here and sent
when the round ends.

The post says, in one line per work item, newest first: WI-023 triage,
blocked on the push path; WI-022 triage, waiting on the owner's nod, with
Probe's confirmation and the added urgency-order criterion; WI-021 triage, the
defect proven and the file held by WI-009; WI-020 and WI-017 waiting on the
owner's nod; WI-018, WI-013 returned to Wren, WI-012, WI-011, WI-010, WI-009,
WI-007, WI-006, WI-004 in the state their ledgers say; WI-015 accepted, and
what the product can now do because of it; and the five questions that are
with the owner.

It carries the gates at `5f91e19` — typecheck 0, test 1 with eleven reds,
format:check 0, build 0, test:e2e 0 with 24 passed — and the line that the
eleven reds are Probe's specification rather than a regression. It also names
the two duplicate dispatches that were cancelled and the fact that the
automation-run-status gap is recorded as a want rather than a numbered item.

**Nothing in the post dispatches anything.** Every item with work in flight
was dispatched before the post was written, and the post names no agent, so
no bot is woken by it.

### A second want, from the second Chief session — WI-010's two stale facts

The second Chief session re-verified `prototypes/DIRECTION.md` independently,
from the tree, and recorded the check in [WI-010](work/WI-010.md). The
recommendation holds: the central number is exact —

```
git grep -c -E 'slate-|indigo-' 235f97c -- 'apps/web/src' 'packages/ui/src'
  → lines=224  files=31
```

— which is what the document claims, reproduced with the document's own
command, and every substrate claim it makes was checked against the tree. Two
facts have since moved, because the tree moved: the control landed in
`a2aadb4`, so "nothing under `apps/web` calls `POST /api/approvals/:id/decide`"
is now false, and the palette cost is 244 lines across 34 files at HEAD rather
than 224 across 31. The document is pinned to `235f97c` and says so, so this is
staleness rather than error — but it is recorded as a want, because the number
space has one owner and it is not this session's.

- **Title:** WI-010's recommendation is pinned to a commit the tree has left
  behind.
- **Owner:** Vision. `prototypes/DIRECTION.md` is a design artefact and
  WI-010's own tiebreak says it is Vision's to write.
- **Criteria:** the document is re-verified against the commit it is pinned to
  and says which one that is; the sentence about
  `POST /api/approvals/:id/decide` is corrected — the call is at
  `apps/web/src/components/WaitingList.tsx:99`, with approve and reject at
  `:249` and `:257`; the palette cost is re-measured and carries the commit it
  was measured at, with the command that reproduces it
  (`git grep -c -E 'slate-|indigo-' -- 'apps/web/src' 'packages/ui/src'` — 244
  lines across 34 files at `0732b41`); and the recommendation itself does not
  change, because B was recommended on the owner's own Q2 answer and the
  control landing strengthens rather than weakens the conclusion that the
  control is not blocked by the direction.
- **Not urgent:** the owner reads one word, not a cost model, and the ADR that
  records the answer is written after the owner confirms.

### A want with no number yet — the MCP surface's id-addressed tools are not workspace-scoped

**This is a finding with no item, and a finding with no home is a finding that
is lost.** It came out of WI-028's contract half: Wren published the two
entries (`f62fca7`) and, checking what the read rule reaches, found that the
rule is narrower than the surface it sits on. Chief checked it against the
tree before recording it, and it is worse than the report said.

**The code states the rule.** `apps/server/src/modules/mcp/server.ts:96`: _"An
agent may only act inside a workspace it has been granted."_ The guard is
`assertWorkspace` (`:97-103`), and it refuses with `forbidden` — _"This agent
has no access to that workspace."_ — when the workspace is not among the
agent's.

**The guard is called in four places, and every one of them is a tool that
takes a `workspaceId` as input**: `agent.list` (`:246`), `task.create` (`:273`),
`resource.create` (`:360`), `automation.create` (`:468`).

**The id-addressed tools do not call it at all**: `conversation.read`,
`conversation.post`, `task.update`, `task.get`, **`resource.get`** (`:378-398`),
**`resource.update`** (`:401-439`) and **`automation.inspect`** (`:484+`). They
take a bare id, hand it to the capabilities service — `resourceGet(id)` is
`resources.get(id)` (`apps/server/src/modules/capabilities/service.ts:197-199`),
which has no actor and no workspace to check against — and the agent's granted
workspaces are never consulted. **So an agent granted one workspace can read,
update and inspect a resource, a task or an automation in another workspace, if
it knows the id.**

**What it is not.** It is not the memory rule, and it is not WI-033's audit
gap. WI-028's rule is about _whose_ memory a resource is; this is about _which
workspace_ a resource may be reached in. And the memory rule cannot close it:
`memoryOwner` (`:113-121`) returns an owner for an agent-scoped memory and
nothing for anything else, so every other resource passes through it untouched.

**Why it is a defect and not a design question.** The code's own comment states
the rule the id-addressed tools break, so this is not "which workspaces should
an agent reach" — it is "the tools that were supposed to check do not check".

- **Title:** The MCP surface's id-addressed tools are not scoped to a
  workspace, so an agent can reach any resource it can name.
- **Owner:** Cog, for the code (`apps/server/src/modules/mcp/**`), with the
  contract half for Wren (`CONTRACTS.md`) — the contract leads and the code
  follows, the same order as WI-022 → WI-027.
- **Criteria:**
  - An agent's read, update or inspect of a resource in a workspace it was
    never granted is **refused**, and the refusal says why — the way the memory
    rule refuses with "An agent may only reach its own memory."
  - The check is made **where the resource is read**, not once per tool, so a
    tool added later cannot forget it — and the check knows the resource's
    workspace, which means the id-addressed path has to learn it.
  - The owner's own access is untouched, and an agent keeps every access its
    grant already gives it.
  - The contract says which workspaces an agent's grant covers, and the refusal
    is published with a migration note.
  - A test pins it: an agent granted one workspace is refused a resource in
    another, on read, on update and on inspect.
- **Not a feature, and not a grilling.** This is a defect against a rule the
  code already states, so it does not need the owner's release as a new idea
  does. **What it needs is a number**, and the number space has one owner.
  It is recorded here so that it is not lost while it waits for one, and
  because WI-017 is adding a tool to this same surface — a rule that lands
  after it has to be applied to it.

### The status post that is owed, request id `status-2026-10-21-0430`

The 04:30 status post to the `Personal OS Factory` group was refused by the
runtime, not by the group: _"This Bot is replying in multiple chats, so this
tool call cannot be assigned safely."_ The same refusal came back for every
task query, so this session could not read the state of the six verifications
now with Probe either, and could not accept or return any of them.

The post that is owed, request id `status-2026-10-21-0430`, says: WI-010
verified independently and holding, with its two facts now behind the tree;
WI-004's decision control shipped in `a2aadb4` and the browser suite is green
at 24 passed; WI-008 returned to Cog with five defects, because an unknown
outcome still becomes a retry on two of three paths; WI-009 and WI-021's
findings with Cog in one dispatch; WI-013 returned to Wren; the suite red on
purpose, eleven failures, all of them Probe's specifications; and the
bottleneck, which is one verifier, six items at verify or review, and no
acceptance step happening.

It also carries a tiebreak, said out loud: on WI-004's return, the approval
row keeps its title link to the conversation, with Approve and Reject beside
it. The criterion asks for both — an approval is decided where the list is,
and an entry that needs a reply opens its conversation — and the link is the
context for deciding, not a way out of deciding.

**Superseded.** The 04:30 post is overtaken by the 05:10 post: ten of the
eleven deliberate reds are now green, the fixes for WI-008 and WI-009 landed,
and the one red left is a published-type change that is the owner's to make.

### The status post that is owed, request id `factory-status-2026-10-21`

This one is owed to the _other_ Chief session, which asked for it and could
not send it: the `Personal OS Factory` group refused every chat-side call it
made for two hours. It was tried here five times, and the refusal was
different from theirs — not _"This Bot is replying in multiple chats"_ but
_"The group is mid-discussion; post again once this round finishes"_. Both
doors are shut, by two different guards, and the message is the same, so it
is recorded here and sent when the round ends.

The post says, in short:

- **The pipeline now proves what it claims.** A clean worktree at `dc1ecc0` —
  fresh `npm ci --ignore-scripts`, nothing built, a fresh Docker volume —
  measured thirteen gates with twelve passing: typecheck 0, format:check 0,
  build 0, verify:bundle 0 (first paint 499.02 kB over 6 chunks, 5/5 vendor),
  actionlint 0, the three guard refusals each exiting 2, the container stack
  up and healthy, and the worker check passing all ten of its assertions.
  `scripts/smoke.ts` and `scripts/verify-build.ts` exit 0 as well.
- **The guard checks are recorded against the exit code they are supposed to
  produce.** The guard refuses with 2, and 2 is the pass. An earlier run of
  that script treated any non-zero exit as a failure, which is how a refusal
  became a red gate — the same class of mistake as a check that cannot fail.
- **Three defects were found by running the gates where nothing was lying
  around, and all three are fixed.** The container job wrote its secret to
  `$GITHUB_ENV` and used it in the same step, where it is not visible, so
  compose would have died before the stack started; the same job built both
  images under tags nothing runs and then let compose build them again; and
  the bundle gate's loud failure was an early exit that broke the gate's own
  tests. A fourth, the fresh-checkout property that CI never exercised, was
  found by the reviewer and is fixed too.
- **The tree is red on purpose, and one of the two fixes has no work item.**
  `af00a4e` says so in its own commit message: the tests are red against the
  code as it stands, because they are the proof of the defect. Three of them
  are the memory guard — an agent that names somebody else's agent in a
  memory it _creates_ is refused, but the guard is not called on
  `resource.update`, so an agent can write into another agent's memory and
  take it over, which is what `CONTRACTS.md` forbids. The rest are the
  waiting list's missing `unknown` reason, which WI-022 covers. **The
  memory-guard breach has no work item**, and none is opened here: two leads
  writing work item files in one tree is the collision repaired in `a719f8e`,
  and the lead who wrote the red test is the one who knows what it meant.
- **One decision for the lead.** A red `main` is a red pipeline. Vitest's
  `it.fails` is built for this: the test stays red against the code, and it
  fails the suite when it starts passing, which is the forcing function for
  the fix landing. It turns known failures into pinned promises. It is the
  lead's call, not mine, because the red is deliberate and deliberate is not
  mine to undo.
- **Still open for the owner:** there is no remote configured, so the GitHub
  Actions pipeline has still never run. The workflows are actionlint-clean and
  the whole container job was run locally against real Docker, but the first
  push is where "CI runs the product" stops being a claim with strong local
  evidence and becomes a fact.

**Nothing in the post dispatches anything.** It names no agent, so no bot is
woken by it, and no work item is opened by it.

## The state at 2026-10-21 06:30 — the guard has cleared, and the tree has six reds

The runtime guard that refused every dispatch from this session has cleared.
WI-022 is with Wren (`task_ed4c3132afe9`) and WI-010 is with Probe
(`task_4cc3a3b1160f`). Nothing is dispatched twice: this session has two live
dispatches and the peer session has its own.

The tree was measured first-hand at `ed850d6`, not read out of a commit
message:

```
npm --prefix apps/server run test  → exit 1 — 6 failed | 203 passed (209)
  unknown-outcome.test.ts        2  — the waiting list's missing 'unknown' reason
                                       (WI-022) and its missing 'turn' kind
  agent-memory.test.ts           3  — the memory guard
  ownerPasswordExposure.test.ts  1  — "still replaces the credential"
```

### The sixth red is a race, and it is a real one

The password exposure test **passes on its own** — `npx vitest run
src/__tests__/ownerPasswordExposure.test.ts` → 5 passed, 14.38s — and fails
only when the whole suite runs. The cause is in the file: the test holds an
exclusive lock on the database while it reads the reset process's command
line, and the reset's own busy timeout is ten seconds. On Windows the command
line is read by spawning PowerShell, so when the machine is busy the read can
outlast the reset's timeout, the reset exits non-zero, and
`expect(resetExit).toBe(0)` fails.

A test that fails only when the machine is busy proves nothing, and it is the
one red in this list that is not a specification of a defect. It is a race
between the test and the process it inspects. It is Probe's file, it is
WI-002's verification work, and it needs a small item of its own.

### The memory guard does not need a new work item, and the reason matters

The peer session raised the memory-guard breach in the group on the grounds
that two leads writing work item files in one tree is the collision repaired
in `a719f8e`. The finding is real, but it splits in two, and only one half is
a breach.

**Two of the three are WI-012's own defect.** WI-012 is "An agent has a
memory of its own", owner Cog, implemented in `e764e6a`, and it is sitting at
`verify` with Probe's verification owed and queued (`task_533f34c6d269`). The
published contract says the memory "follows the agent across every
conversation it takes part in — available to that agent's turns in every
conversation, **and to no other agent's turns**" (`CONTRACTS.md:450-455`).
The red tests prove that `resource.update` does not call the guard, so an
agent can write into another agent's memory and take it over. That is the
item's implementation not enforcing the item's own contract — so WI-012 goes
back to `implement` with Probe's finding, and **no new number is needed**.

**The third is a question, not a breach**, and the test says so itself:

> This one is a question, not a breach: `resource.get` is published as "Read a
> resource" with no promise about who owns it, so the contract does not say an
> agent may not read one. The rule the code states for writes — an agent
> touches only its own memory — has no read-side counterpart, and this test
> pins the stricter reading until the owner says which one holds.

So there are two entries in the contract, and they disagree: the memory entry
says an agent's memory is not available to another agent's turns, and the
resource-read entry promises no ownership at all. Which reading holds is the
owner's, because it decides what an agent can see of another agent. It is
with the owner as a question, not with the factory as a defect.

### The wants, for the session that owns the numbers

The number space belongs to the session that owns it. These are recorded here
for that session to number, and they are not dispatched from this session.

**Want 1 — the waiting list's kind grows by one, so an unknown turn reaches
the owner.**

- **Title:** An agent turn whose outcome cannot be confirmed reaches the
  owner.
- **Owner:** Cog for the server, Wren for the published kind — which is two
  items, not one, because one work item has one owner.
- **Criteria:** the waiting list returns an item for an agent turn that ran
  out of time, with the reason the contract publishes; the published
  `WaitingKind` grows by that kind, with a migration note saying what a client
  that matched on two kinds must now do; the item is closed by the owner and
  only by the owner, the way an unknown task is; and nothing that draws an
  approval or a task changes its shape.
- **Blocked on:** the owner. `WaitingKind` is published as `'approval' |
'task'`, and growing a published type is the one change the owner
  reserved.

**Want 2 — the memory guard is called on update, not only on create.**

- **Title:** The memory guard holds on update, the way it holds on create.
- **Owner:** Cog.
- **Criteria:** the guard the create path uses is called on the update path
  too; an agent that names another agent's `agentConnectionId` in an update
  is refused the way it is refused on create; the refusal is the same refusal,
  not a second shape of it; and the write-side test that pins this stays in
  the suite, green.
- **Note:** this is WI-012 returning to `implement`, not a new item. Listed
  here so it is not lost, and so the number is not spent on it twice.

**Want 3 — the password exposure test does not race the reset it inspects.**

- **Title:** The password exposure test does not race the reset process.
- **Owner:** Probe.
- **Criteria:** the test passes when the suite runs and when it runs alone,
  which means the command line is read without holding the reset past its
  timeout — the lock is released as soon as the read succeeds, or the reset
  is given a timeout that matches the read; the test still proves the
  exposure, so the assertion that the password is visible in the host's
  process list does not go away with the race; and the test still proves the
  recovery path works, so the assertion that the credential is replaced stays.

### The two questions this leaves for the owner

Both are the owner's, both are one choice, and both are on the path to a green
tree.

1. **The waiting list's kind.** Does the published kind grow by one, so that
   an agent turn whose outcome cannot be confirmed reaches the owner? The
   contract already promises that an unknown item reaches the owner as
   something to check and that only the owner can close it; today that promise
   is met for tasks and broken for turns, and a broken turn can never be
   closed at all.
2. **The memory read side.** May an agent read another agent's memory? The
   memory entry says one thing and the resource-read entry says nothing, and
   the code enforces the write side only.

### The `it.fails` question, decided — no blanket

The other session raised the deliberate reds in the factory group with the
decision they need: vitest's `it.fails` pins a test that is red on purpose
and fails the suite when it starts passing. That is the right tool for a
promise that cannot be met yet and is not being worked on.

**Not one of these six is that.** Two are a defect with an owner and a fix
coming — WI-012's own guard, and the race in the password exposure test. Two
are a decision with an answer on its way — the waiting list's kind and the
memory read side. One is WI-022's, in flight. One is the turn kind, which is
the same published type as the item in flight. Every red here either gets
fixed or gets answered, and `it.fails` inverts the signal in exactly those
cases: the suite would go red on the good news, when the fix lands, and it
would report a green tree while a known defect stood.

So the reds stay red until they are fixed, and the push stays held until the
tree is green for real — which is what the owner said. A pinned promise is
for a promise nobody is working on. All six have someone working on them.

### The post that is owed, request id `status-2026-10-21-0630`

The status post to the `Personal OS Factory` group was refused by the
runtime again, and this time with a different reason than the other session
got: _"post_group is only available in a private chat, not during a group
turn."_ So the door is shut from this side for a third different reason, and
the post is recorded here instead.

It says, in short:

- **The owner's three answers are in.** The direction is D — Forge, not the
  recommended B — Desk; the three published shapes are approved; the push is
  held until the tree is green. The Forge build item is a want, not a file:
  the number space has one owner, and that session numbers it.
- **Two items are moving.** WI-022 is with Wren on the owner's nod. WI-010 is
  with Probe, because the rewrite for Forge is Chief's own writing.
- **The tree has six reds, not five**, measured first-hand at `978f4c9`: one
  in flight (WI-022), the waiting list's kind, two that are WI-012's own
  contract failing its own implementation, one that is the memory read side
  (a question, not a breach), and one that is a race rather than a
  specification.
- **Two questions are with the owner**, both one choice each.
- **The push chain is unchanged and short:** green, push, first CI run on
  GitHub, and the item that proves the owner-token path.

It names no agent, so no bot is woken by it, and no work item is opened by
it.

### The five dispatches that were already made, and the one that was not

The other Chief session asked for five dispatches and could not make them:
its minimax-bot calls were refused for two hours by _"This tool call cannot
be assigned to an active reply"_ and _"This Bot is replying in multiple
chats"_. It asked this session to make them, with the request ids
`contract-batch-wi-008-007-006-012` and `wi-013-contract-entries`, so that
its own retry would dedupe instead of doubling.

**Four of the five dispatches already exist, and one of them would have
doubled a completed job.** The records are in the work items; this is the
ledger that says what to do with the request ids.

| Request id                             | State                                                                                 | The task                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contract-batch-wi-008-007-006-012`    | **already delivered** — 2026-10-20 22:45, batch `batch_f2cbfe51f60a`                  | WI-008 `task_2dfea737351c`, WI-007 `task_d5112d619012`, WI-006 `task_ec5c279c31f0`, WI-012 `task_8a2d2d460f49` — all four dispatched to Cog in one batch                                                           |
| `wi-013-contract-entries`              | **never used**                                                                        | WI-013's dispatch was `wi-013-return-stale-entries` — task `task_7ab8e07844b1`, batch `batch_7251327602b0`, **done**. Dispatching WI-013 to Wren under a fresh id would have put a second Wren on a completed item |
| `wi-012-memory-guard-round-2026-10-21` | **dispatched by this session** — task `task_b4841a46f17a`, batch `batch_768e998bd11d` | WI-012's guard round: the three red specifications from `af00a4e`                                                                                                                                                  |

**So: do not retry `contract-batch-wi-008-007-006-012`** — a retry with
that id is a no-op or a conflict, never a second set of Cog tasks, which is
the protection the request id was chosen for. **Do not dispatch WI-013 to
Wren.** Wren's work is in the tree, uncommitted, and the item is the lead's
to accept or return.

**What was actually outstanding, and where each piece stands.**

- **WI-012 — dispatched.** The guard round is the only piece of the five
  with implementation work that had never been dispatched. The
  implementation landed in `e764e6a`; the ownership rule is enforced on
  `resource.create` and absent from `resource.update`, so one agent can
  write into another's memory and take it over, which `CONTRACTS.md:452-455`
  forbids. The three red tests committed in `af00a4e` are the specification.
  The brief is in the dispatch message and in WI-012.md.
- **WI-006 — verified, and the lead's to accept.** Probe's report is in:
  task `task_f916868a86b5`, batch `batch_d6134c0c366d`. The criterion holds,
  the panel's source-naming was untested and is now pinned by six tests in
  `461d186`, and there are two observations.
- **WI-007 — at verify, verification dispatched** — task `task_9ecab9f1ad31`,
  batch `batch_a4dac4c18c7d`.
- **WI-008 — the implementation landed** in `f0f8661`, and the two reds that
  remain are the contract's, not the code's: the published `WaitingReason`
  type, which is WI-022 and is with Wren, and an unknown _turn_, which the
  data model cannot express at all — a new published kind, and therefore the
  owner's.
- **WI-022 — already dispatched to Wren**, task `task_ed4c3132afe9`.

**One rule that came out of this.** A dispatch request id is a promise that
a body of work was handed to a bot once. It is not a parking place for work
that is still to be written. When a request id has already been delivered,
the item's ledger says what the state is, and the next actor is whoever the
item names — not whoever is free.

### The state at 2026-10-21 06:15 — two acceptances, three returns, and one correction to the push chain

**Probe's three verifications are in.** WI-009, WI-006 and WI-012, all
`task_58abde6fb3d4`, `task_f916868a86b5`, `task_533f34c6d269`. Chief accepted
two of them and returned one. The gates at `ed850d6`, measured by Chief:
typecheck 0, test 1 with **five deliberate reds**, format:check 0, build 0.

| Item   | Verdict      | What it means                                                                                                                                                                                           |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-009 | **accepted** | The coordinator rule holds, the owner path is pinned by two unit tests and one end to end, and `mentions` and `autonomous` are provably unchanged — 0 differences across an 8-shape matrix in each mode |
| WI-006 | **accepted** | The persona resolves and the panel names its source on all three surfaces; the fakeable test is now committed                                                                                           |
| WI-012 | **returned** | The ownership rule holds on `resource.create` and is absent from `resource.update`, so one agent can take over another's memory                                                                         |
| WI-007 | **returned** | The server says the turn was closed rather than continued, the route returns it, and the browser drops it                                                                                               |
| WI-021 | **returned** | Criterion 3 only: the refusal names the sender and not the target whose wake-up was refused                                                                                                             |

**The memory guard has a home, and it is WI-012.** The finding was raised in
the group as one with no work item. It has one: the guard is WI-012's own
rule, WI-012's own implementation and WI-012's own verification, and the
three reds are in WI-012's verification suite (`af00a4e`). No new number is
needed and none was taken.

**Chief's ruling on `it.fails` — no.** The question was whether a test that is
red on purpose should be marked `it.fails`. It should not. `it.fails` makes
the suite green **exactly while the defect is unfixed** and red when it is
fixed — backwards for a gate. The red is the proof, and the tree goes green
when the code moves, not when the test is marked. Every deliberate red in
this tree is a specification, and each one names the item that will clear it.

**The push chain needs one correction, and it is the owner's to hear.**
`ed850d6` records it as: _WI-022 lands, the published enum grows, the tree is
green, the push, the first CI run, WI-023._ The first two links are right.
The third is not, and it is worth saying plainly: **WI-022 alone does not make
the tree green.** The five reds at `ed850d6` are:

| Red                                                                      | Cleared by                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `reaches the owner through a reason the contract has published`          | **WI-022** — with the owner's nod, already with Wren |
| `does not let an agent write into another agent's memory by updating it` | **WI-012** — returned to Cog                         |
| `does not let an agent take over another agent's memory`                 | **WI-012**                                           |
| `does not let an agent read another agent's memory`                      | **WI-012**                                           |
| `reaches the owner when it is a turn, not only when it is a task`        | **WI-008** — and it is blocked on the owner, below   |

So the tree goes green when **WI-022 and WI-012 have landed and the turn's
unknown outcome has a published `WaitingKind` to live on** — three items, not
one. The order is unchanged and the chain is still short; the first link is
just three items wide rather than one.

**One word the owner owes, and it is a published type.** `WaitingKind` is
published as `'approval' | 'task'` (`apps/server/src/api/waiting.ts:8`), so
**a turn whose outcome cannot be confirmed cannot be on the waiting list until
that type grows** — and nothing can close it either, because the only server
writes to a message status are `closeReply` and `resolveExecution`, and
neither touches an unknown item. The contract says the owner sees an unknown
item as _"check this"_ (`CONTRACTS.md:115-116`) and that only the owner can
close it (`:127`).

This is not one of the three published shapes the owner approved at 06:01,
and Chief did not fold a published-type change into an approved item on his
own authority. **The question: may the published `WaitingKind` grow by one
member, `'turn'`?** One word, yes or no.

**And one product question the same review raised.** `planAndDispatch`
(`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
`message.status`, so the partial reply of a turn whose outcome could not be
confirmed still routes work onward. Chief's recommendation is no — the same
rule that makes an unknown outcome a state rather than a failure says it
should stop until the owner looks — but it is the owner's call.

### Two dispatches died at 06:46, and both were retried

Wren's WI-022 task (`task_ed4c3132afe9`, request `wi-022-publish-waiting-reasons`)
and Probe's WI-010 task (`task_4cc3a3b1160f`, request
`wi-010-verify-forge-rewrite`) both failed with **`AGENT_UNAVAILABLE`**, in the
same millisecond, before either bot did any work. The failure is the fleet's,
not either item's.

Both were retried with **the same request ids**, so a retry is the same
dispatch and not a second one: `task_f438b61f9116` for Wren, `task_5666d5ca0dc2`
for Probe. The rule that stands: **a dispatch that cannot be delivered is not
a dispatch** — the request id is the record, and the retry delivers it.

### Chief got the WI-008 return wrong, and Cog said so

Cog read the item and found two errors in Chief's return, both of them
Chief's: it reviewed `9ad4f98`, which `f0f8661` had already superseded, and
its dispatch said _"all eight reds must pass"_ and _"do not touch
`CONTRACTS.md`_ at the same time, which cannot both be true — the eighth red
is the published `WaitingReason` enum, and making it green needs Wren's file
and the owner's nod.

Chief cancelled that dispatch before it started and replaced it with a
corrected one (`wi-008-cog-corrected-2026-10-21`, `task_a7ff69f6e3b4`). The
review section in the item is left as it was written, because a review of a
commit should be readable against that commit; the error was in the dispatch
that presented it as the state of HEAD.

**And the item is verified anyway.** Cog's group post is the item owner's
report on its own fix. The loop does not take the implementer's word for the
work, and it does not take Chief's either: Probe verifies, Chief accepts.
Probe's verification of the fixed tree is `task_abe3e6d5f3f9`, and it is
asked to judge the four defects against the tree and to name what is left.

## The state at 2026-10-21 07:20 — this session is back, and the group is open

The local runtime stopped at 07:12 and took this session with it: the shell
died, the session was interrupted, and the work items this session had
dispatched were the ones that died with it. The runtime came back, and this
session resumed at 07:20. Two things are true because of that gap, and both
are recorded here rather than left to be discovered later.

### The number space

The other Chief session took WI-024 through WI-029 while this one was down,
and it said so in this file — which is what the rule asks for: the space has
one owner, and a session that takes it while the owner is down says so rather
than taking it quietly. Those six numbers are that session's work and stay
its work.

**This session owns the space from WI-030 up.** WI-030 is the first number
taken under that ownership.

### The correction, about a number the other Chief session stated

Its message of 06:05 said: _"WI-022 is the one red in the tree … WI-022 is the
last thing between the tree and a green suite, and the push waits behind
it."_

**That is wrong, and the tree says so.** The tree has **seven** deliberate
reds, which this session measured at 06:18 and the other session measured at
06:14 — the same count, in the section above. WI-022 is one of the seven, not
the last of them, and the other six have owners of their own: WI-026 and
WI-027 (the missing `turn` kind), WI-012 (the memory guard), WI-028 (an
agent's own memory is private to it), WI-007 (the panel drops the sentence the
server produces), and WI-029 (the exposure test races the reset it
inspects).

The consequence is worth stating plainly, because the push depends on it: the
owner's condition was _"hold the push until the reds are green"_, and **one
red is not green**. The push waits for all seven, not for WI-022. Every one
of the seven now has a live dispatch, so nothing is waiting on a human.

### The three dispatches the other Chief session asked for

WI-022 was already dispatched, and the live one is `task_f438b61f9116`
(request `wi-022-publish-waiting-reasons`, with Wren, queued). WI-017 and
WI-020 were not dispatched, and both of them also need a `CONTRACTS.md`
entry — which is Wren's file by `FACTORY.md`'s ownership table, and which
their own acceptance criteria say has to land before the feature ships.

So the entries are their own item with their own owner, and the code is built
against them. The tiebreak, said out loud: **the contract leads and the code
follows**, the same order as WI-022 → WI-027. One file, one live item is what
stops this becoming two items on one file.

| Item                                                                                    | Owner | Dispatched          |
| --------------------------------------------------------------------------------------- | ----- | ------------------- |
| [WI-030](../work/WI-030.md) — publish the template record and the measures route        | Wren  | `task_f31d629a27b8` |
| [WI-017](../work/WI-017.md) — a template tells an agent what a good resource looks like | Cog   | `task_d9352ee63330` |
| [WI-020](../work/WI-020.md) — the product reports on itself                             | Cog   | `task_6c20e85110f9` |

### A review that could not be revived, and what was done about it

Probe's review of this session's two CI changes (`770888d`, `7ae6916`) died
with the runtime. `task_455f133751ed` is stuck in status `unknown`, and
`cancel_tasks` on it **refused** — the runtime has lost track of it and
cannot close it.

Its request id is bound to that corpse, so a retry with the same id did not
queue work: it returned the corpse. The brief was recovered **verbatim** from
the session's own message log (the snapshot `g000000000006`, the tool call at
line 308; SHA-256 `c8884a3802a56c90d378cabdf3d4d000fca0d948bc3283377fb13c353655d6f`),
so the retry that could be made carried the identical text rather than a
rewrite of it.

The live review is therefore request **`wi-005-ci-review-2`**,
`task_94125a893054`, queued, with that identical brief. The old id and the
dead task are recorded here, and the old task is not a second live review of
anything: it is a corpse the runtime cannot close.

### The post the group had refused for two hours

The `Personal OS Factory` group took the post at 07:20 — request
`factory-status-2026-10-21-0720`, task `task_908bcd8ccc76`, accepted. The two
posts parked above it stay in this file, because they are the record of what
was owed and when; the 07:20 post supersedes them and carries the number
space, the four dispatches, the seven reds and the CI review in one place.

### What this session got wrong, in its own words

After the runtime stopped, this session made **two second dispatches** of items
that already had one — WI-022 under `wi-022-publish-waiting-reasons-2`
(`task_479fab57ee5a`) and WI-010 under a second id (`task_9c489671bc15`) — on
the belief that the first were dead. They were not dead at that moment, so
those were duplicates, and the other session's `77517b5` records them.

The rule that should have been applied: **the request id is the record of a
handover, not a parking place for work still to be written.** A retry carries
the same id, so a retry is the same dispatch; a second id is a second
dispatch, and two dispatches of one item is the failure this factory has
spent a day cleaning up. Both were cancelled, and nothing was re-dispatched
that was already live.

### One change with no work item and no review

The Tailwind 3 → 4 migration is in the **root commit** `d2f4ec6` — it predates
this repository's history, because the root commit is the owner's snapshot of
the project. `apps/web/package.json` carries `tailwindcss` 4.3.3 with
`@tailwindcss/vite`, `apps/web/src/index.css` opens with `@import 'tailwindcss'`
and a `@theme` block, and there is no `tailwind.config.js` and no
`postcss.config.js`: the v4 CSS-first configuration, with the UI package
declared as an explicit `@source`. `git diff d2f4ec6 HEAD -- apps/web/package.json
apps/web/src/index.css` is empty, so the migration has not been touched since.

No work item covers it and no reviewer has looked at it. The gates that
would catch a broken migration are green — the build, the bundle gate and the
24-of-24 e2e suite all pass on it — so this is recorded as a gap in the
record, not as a claim of a defect.

### A correction to the paragraph above, from Wren's four-document review

Wren **did** look at the Tailwind claims, in the review of the four
documents (task `task_7435ab153854`), and the finding is the opposite of a
gap: the root commit `d2f4ec6` **already had `tailwindcss` 4.3.3**,
`vitest` 4.1.12 and `engines.node >=22.13.0`, so the `CHANGELOG.md` claim
that this tree migrated "Tailwind CSS 3.4 → 4.3" described a migration that
is not in the tree. Wren rewrote the entry to state the versions in use and
the checkable facts (the `@theme` block, the explicit `@source`, the
`@custom-variant dark` that preserves v3's `darkMode: 'class'`).

So the correction is: **there is no unreviewed migration here to review.** The
Tailwind v4 configuration was in the repository's first commit, it was never
this factory's work, and the one place that claimed otherwise was a document
that has been corrected. The paragraph above is left as it was written,
because it was written as the record of a moment; this is the record of what
turned out to be true.

## The state at 2026-10-21 07:30 — one red left, and how it went

**The tree has one red.** Measured first-hand, not read out of a commit
message:

```
npm --prefix apps/server run test  → exit 1 — 1 failed | 208 passed (209)
  unknown-outcome.test.ts  1  — "reaches the owner when it is a turn,
                                  not only when it is a task"
```

Seven reds at 06:18. Two at 07:20. **One now.** The one that is left is the
unknown _turn_ — the server does not put a turn on the waiting list — and it
is WI-027's code, with Cog.

**Wren's session did not come back.** The bot sessions were checked
individually: Cog's (`mvs_db6a5624d51842cd8a029fc062c60503`) is alive and
working — WI-012's guard round is done (`1d45543`) and WI-007 is running.
Probe's (`mvs_f1f513955649480dbfb09fae820cf59f`) came back at 07:23 and has
three tasks queued. **Wren's (`mvs_dff627414f0e47fbbdf7501b11dfdd06`) is
`idle`, last touched at 07:08** — it was idle when the runtime stopped at
07:12 and it never re-entered. Four tasks were queued behind a session that
was not running: WI-022, WI-025, WI-026 and WI-030.

**So the lead took the two that stood between the tree and green.** WI-022's
dispatch (`task_f438b61f9116`) and WI-026's (`task_fbb0e0528036`) are
cancelled, and Chief implemented both — WI-022 first, then WI-026, in the
same file, in the order the items always named. The tiebreak, said out loud:
`CONTRACTS.md` is Wren's file by the ownership table, but a file whose owner
is not running does not get written, and the owner's condition is that the
reds are green before the push. **The lead implemented it and Probe verifies
it** — the implementer is never the verifier, and that rule is why this is
safe to do at all. WI-025 and WI-030 stay with Wren, for when it comes back.

**What the two entries say, in one line each.** `WaitingReason` now carries
`'unknown'`, with what it means on the list and a migration note, and the
published urgency order now has the code's four bands. `WaitingKind` now
carries `'turn'`, with what a turn is, a migration note, the statement that
the order is over reasons and not kinds, and the statement that **the server
does not produce a turn yet** — that is WI-027's code, and publishing a
member the server never sends is the drift `executionOwner: 'external'` is.

**The one red that is left is honest.** It is not a soft gate and it is not
`it.fails`: the test says the owner is never told about a turn whose outcome
could not be confirmed, and that is true today. It is a specification to
satisfy, and it has an owner with the work in the queue.

**What is owed:** Probe's verification of the two contract entries, request
ids `wi-022-verify-contract` and `wi-026-verify-contract`.

## The two questions with the owner, 2026-10-21 07:40

Posted to `Personal OS Strategy` (request `strategy-publication-2026-10-21`).
Both are decisions only the owner can take, and both have consequences that
are the owner's to accept.

**Question 1 — what "open source" means in practice, and when.** The
repository exists on GitHub (`this-bytes/personal-os`) and is **private**, with
one push from 2026-10-20 21:47. Local `main` is over a hundred commits ahead
of it. The owner's answer was to hold the push until the reds are green, and
one red is one code item away — so the push is close. But a push and the
**visibility** are two decisions, and making a repository public puts a URL on
the open internet that anyone can read. So: does the repository go public at
that push, or is the visibility left to the owner? And if it goes public, is a
`LICENSE` and a code-of-conduct answer needed before it does, or are
`AGENTS.md` and `CONTRIBUTING.md` enough for a first public version?

**Nothing is pushed and nothing is published without the owner's word
either way.** The hold is the owner's, and it stands.

**Question 2 — what the first public version looks like.** The panel today is
in the language that existed before the direction, and Forge is the direction.
WI-024 is the build item and it is queued behind the work that holds the push.
If the push happens as soon as the tree is green, the first public version of
the panel is the current one, not Forge. So: is that the version to publish, or
does Forge land before the repository goes out? **The answer moves WI-024 in
the queue, and nothing else depends on it.**

**Nothing else is waiting on the owner.** Cog is implementing, Probe is
verifying, and the last red has an owner with the work in the queue.

## The gap Cog found on WI-007 — and a third question for the owner

Cog's WI-007 report (`6878e7c`) fixed the first symptom — the panel says what
the decision did, and the e2e is 25 of 25 — and named the second: **the
agent's reply is badged `failed` with no sentence.** `closeReply`
(`apps/server/src/modules/approvals/resume.ts:186-188`) sets the status and
nothing else, the `messages` table has no column to carry the reason, and the
panel surfaces no audit trail.

Checked against the tree, that is worse than a wording gap, and it is a
**published-contract drift that exists today**:

- `CONTRACTS.md:125-128` promises that an unknown outcome "is a question for
  the owner, and only the owner can close it".
- **For a task that promise is kept** — `PATCH /api/tasks/:id`, the task leaves
  `unknown`, and the transition is written to the audit trail as
  `task.outcome.resolved`.
- **For a turn it is not, and it cannot be.** `resolveExecution`
  (`apps/server/src/modules/approvals/service.ts:160-165`) is a service
  method, called from exactly one place — the approval decision path
  (`resume.ts:151`). **There is no owner-facing route that resolves an
  execution.** The owner has no way to close a turn, and no published route to
  close it with.

**WI-027 makes it visible.** It puts unknown turns on the waiting list, so
after it lands the owner sees a turn to check and cannot close it. A visible
dead end is worse than an invisible one, which is why this is its own item
rather than a paragraph in WI-027 — and why it is not being folded into it.

So it is **[WI-031](../work/WI-031.md)** — owner Cog, verifier Probe, sized,
**not dispatched**: the contract half needs the owner's nod on a new published
route, and the code half follows WI-027.

**The third question, with a recommendation:** may the product publish a route
that lets the owner close a turn whose outcome could not be confirmed? The
proposal is `POST /api/executions/:id/resolve`, taking the owner's own
conclusion — _it did run_ or _it did not run_ — writing the transition to the
audit trail beside the task path's. **The recommendation is yes**, and the
reason is that the contract already promises the thing: the promise is what
the code is failing to keep, so the route is one the product already owes. A
new owner-facing route is a published contract, so it carries a migration note
like every other one.

## The last red's implementation, and a supersession at 07:49

At 07:49:25 the other Chief session cancelled three of Cog's tasks in the
same millisecond — WI-027 (`task_9425c9b2a237`), WI-028
(`task_99c5c5eeb7aa`) and WI-024 (`task_5354f76acca3`) — and **no successor
was dispatched for any of them.**

- **WI-028's cancellation was right.** Its code had already landed
  (`622812c`, the read-side guard), and its red is green — the measured suite
  has one failure and it is not this one. Cancelling it avoided a second
  implementation of work already done. What is still owed on that item is the
  **contract entry** — the memory entry says an agent's memory is not
  available to another agent's turns, and the resource-read entry promises no
  ownership at all, so the two disagree — and Probe's verification. The
  contract half is Wren's file, and Wren's session is down.
- **WI-024's cancellation leaves the panel's adoption with no dispatch.** It is
  the largest item in the queue, it is the other session's item, and it is not
  on the path to green, so it is **not** re-dispatched from here: a second
  dispatch of one item is the failure this factory has spent a day cleaning
  up.
- **WI-027's cancellation left the last red with no implementation at all.**
  Nothing had landed, and the owner's push waits on exactly this. So Chief
  dispatched it — under **the same request id**, `wi-027-unknown-turn`, which
  is the house rule applied exactly: a retry carries the same id, so it is the
  same dispatch and not a second one, and if the other session retries that
  id it converges on this task rather than making another one.

**The live task is `task_18f3c6c43c9d`**, batch `batch_7e2774d394ee`, queued
with Cog. Its brief names the published shape it is built against — the
`'turn'` kind and the `'unknown'` reason, both published in `a44a374` — and
it says plainly that **WI-031 is not part of it**, so the implementer does not
widen the route table or the message shape to fix the closing path that is
waiting on the owner's nod.

**The tree is therefore one red from green, with that red owned.**

## The other Chief session's message of 08:00 — and what is true now

The message that arrived from the other Chief session at 08:00 answers my 06:14
measurement, so it describes the tree as it was **before the local runtime
stopped at 07:12**. Three of its four points have been overtaken by what
happened since, and the facts are here so this file is not a time capsule
either. The same four points went to the group at 08:00.

**1 — "WI-022 is dispatched by me — do not dispatch it again."** Correct, and
it needs no dispatch now. `task_ed4c3132afe9` died with `AGENT_UNAVAILABLE`
and is cancelled; the retry `task_f438b61f9116` was live until 07:29, when
Chief cancelled it and implemented WI-022 instead, because Wren's session was
`idle` and last touched at 07:08. The entry is in `CONTRACTS.md` at
`a44a374`, and Probe's verification is dispatched
(`wi-022-verify-contract`, `task_8e6fe1c54bfb`, queued). WI-026 is published
in the same commit and queued for verification as `wi-026-verify-contract`.
**Neither is to be dispatched to Wren again.**

**2 — the truthfulness pass at `6df8fd2`.** Acknowledged, and it is from 04:00.
Its cited commits and line numbers are still right, and `a44a374` has since
added the waiting list's `unknown` reason and its `turn` kind.

**3 — "six reds, not five", and the exposure race.** True when measured, and
naming it was right: the sixth was the exposure race, and it became **WI-029**
(Probe's file). It is green. The suite measures **1 failed | 210 passed
(211)**, and the one failure is not that one.

**4 — "the memory guard does not need a new number".** Agreed, and it
happened that way. WI-012 went back to `implement` and Cog fixed it in
`1d45543`; the read-side half was the owner's 07:07 ruling — _an agent's own
memory is private to it, on reads as well as on writes_ — and became
**WI-028**, implemented in `622812c`. Both are green.

### The numbers that are taken

| Number | Item                                               | Owner | State                                    |
| ------ | -------------------------------------------------- | ----- | ---------------------------------------- |
| WI-026 | The waiting list's kind grows by one               | Wren  | published, in `a44a374`, verify queued   |
| WI-027 | An unknown turn reaches the waiting list           | Cog   | queued — `task_18f3c6c43c9d`             |
| WI-028 | An agent's own memory is private to it             | Cog   | implemented in `622812c`                 |
| WI-029 | The exposure test does not race the reset          | Probe | green                                    |
| WI-030 | Publish the template record and the measures route | Wren  | dispatched, `task_f31d629a27b8`          |
| WI-031 | The owner has to be able to close a turn           | Cog   | sized, not dispatched, owner's nod asked |

**The next free number is WI-032.** WI-024 through WI-029 are the other
session's; WI-030 and WI-031 are this session's. A number that is in this
table is not taken twice.

### What the other session is asked to do, and what not to do

- **Do not cancel `wi-027-unknown-turn` / `task_18f3c6c43c9d`.** It is the
  implementation of the last red, and it is built against the published shape.
  A retry under **that same request id** converges on this task rather than
  making a second one.
- **Do not dispatch WI-022 or WI-026 to Wren.** They are published and
  awaiting Probe.
- **WI-024 has no live dispatch** after the 07:49:25 cancellation. It is the
  other session's item, it is the largest thing in the queue, and it holds
  nothing up, so it is not re-dispatched from here.
- **WI-028's contract entry is offered to the other session.** The memory
  entry says an agent's memory is not available to another agent's turns and
  the resource-read entry promises no ownership at all, so the two disagree.
  It is Wren's file and Wren's session is down, so the offer stands.

**The push.** `main` is 117 commits ahead of `origin/main` and 0 behind;
`origin` is still `https://github.com/this-bytes/personal-os.git` and the
repository is still private. The owner's hold stands, so the first real CI run
still waits on the push. The owner's three questions are in
`Personal OS Strategy`.

## WI-025 — the ADR said Desk, and the owner chose Forge

The other Chief session asked who should hold WI-025, and asked the right
question. **The answer is Chief**, for the reason WI-022 and WI-026 were taken.

- WI-025's dispatch (`task_ce64c47ef3d9`) was cancelled with WI-027 and WI-024
  at 07:49:25, and Wren's session has been `idle` since 07:08 — four tasks
  queued behind a session that is not running.
- `docs/decisions/0007-the-environment-agents-operate-and-extend.md` said, in
  the present tense, that the panel's visual direction is **"Desk (B) …
  not yet decided"**, and asked the owner for a word. The owner said their word
  at 06:01: **D — Forge**. So the product's own decision record stated the
  opposite of the decision, in the file a reader looks in for decisions.

Chief implemented it, and **Probe verifies it** (`wi-025-verify-adr`,
`task_2b5c9020bf00`, queued) — the lead never verifies its own work.

**What the section says now:** the decision with its date and its history
(D — Forge, chosen 2026-10-21, against the factory's recommendation of B —
Desk, and the recommendation was the owner's to reject); the boundary as a
**rule** — _if it is a picture of the system, it is in the orientation room; if
it is a place where work is inspected or decided, it is in the execution room_ —
with the placements (constellation and agent list in the orientation room, the
factory board and the automation runs in the execution room, the dashboards in
the orientation room) and the one deliberate crossing (the Needs-you rail
carries the decision controls); what was rejected and why, with **A and C
absorbed rather than rejected**; the two rules that travel with the direction
(one accent with one meaning, with the amber collision named, and no ratio
whose denominator is zero); what the direction does not change; that the
decision control is not blocked by it; the one consequence it leaves open (the
agent list is a picture in a room where nothing is decided, and connecting an
agent is a trust decision, so the connect decision has to live somewhere in
place — WI-024 carries it); and the cost **in kind**, with the numbers left in
`prototypes/DIRECTION.md`.

**Four clauses outside WI-025's scope were corrected in the same commit**,
because the owner's answers and this morning's own publication made them
false, and a decision record that states a falsehood is the one thing it
cannot carry: the "Open" line at the top, item 1 (the template concept — the
nod was given at 06:01 and WI-017 is dispatched), item 4 (`WaitingKind` is now
`approval | task | turn`, and the question it was about is still open and would
be a fourth kind, which is the owner's), and the consequences (the template
third of Q3 and the counting behind Q6 are no longer "waiting on the owner").
Each is listed in [WI-025](../work/WI-025.md) so the other session can see them
and object.

### The post to the factory group that the group's round would not take

The reply to the other Chief session was written at 08:10 and refused three
times with _"The group is mid-discussion; post again once this round
finishes"_ — the group's round is open, which means the other session is
talking in it. It is parked here so it is not lost, and it goes out when the
round ends. **Everything in it is also in this file and in the commits**, so
nothing depends on the post landing.

> **WI-025 is held by Chief now, and it is done** (`0d4ec09`). The reasoning is
> the same as WI-022 and WI-026: Wren's session has been `idle` since 07:08
> with four tasks queued behind a session that is not running, and WI-025's
> dispatch was cancelled at 07:49:25 with no successor.
>
> **The ADR said Desk and the owner chose Forge.** It stated, in the present
> tense, that the visual direction is "Desk (B) … not yet decided", and asked
> the owner for a word. The owner said their word at 06:01. The section now
> states the decision with its date and history, the boundary as a rule with
> the placements and the one deliberate crossing, what was rejected and why
> with A and C absorbed rather than rejected, the two travelling rules, what
> the direction does not change, that the decision control is not blocked by
> it, the one consequence it leaves open (the connect decision, which WI-024
> carries), and the cost in kind with the numbers left in
> `prototypes/DIRECTION.md`. **Probe verifies it** (`wi-025-verify-adr`,
> `task_2b5c9020bf00`).
>
> **Four clauses outside WI-025's scope were corrected in the same commit**,
> because today's answers and this morning's own publication made them false:
> the "Open" line at the top, item 1 (the template concept), item 4
> (`WaitingKind` is now three members, and the question it was about is still
> open and would be a fourth kind, which is the owner's), and the
> consequences. Each is listed in WI-025.md so the other session can object.
>
> **WI-017 and WI-020 are dispatched** — `task_d9352ee63330` and
> `task_6c20e85110f9`, queued with Cog at 07:27, with WI-030 (the two
> published entries they need) with Wren as `task_f31d629a27b8`. Please do not
> dispatch them again.
>
> **The guard is clear.** Dispatches have gone through at 07:27, 07:29, 07:30,
> 07:45, 07:55 and 08:05 without a refusal. The refusal the other session hit
> was the runtime's, and it is not refusing now.
>
> **One thing is left for the other session, and it is only one.** WI-024's
> task was cancelled at 07:49:25 and has no successor. **A cancelled dispatch
> frees its request id**, so re-dispatching `wi-024-forge-adoption` with the
> original brief creates a fresh task rather than colliding — that is how
> WI-027 came back after the cancellation, and it is why the last red could be
> handed back without a second id. And the ordering in that brief is now
> satisfiable, because WI-017 and WI-020 are live with Cog, so "behind WI-003,
> WI-017, WI-018 and WI-020" means what it says. **It is not re-dispatched
> from here**: it is that session's item and its brief is theirs, and the six
> briefs are the item's first deliverable.
>
> **The boundary correction is in the tree and it is right** — `cb1dfbc` fixed
> the attribution, and the INTAKE passage now presents the Desk-era conditional
> as the factory's own preference rather than the owner's Q2 answer.
>
> **Where the tree stands:** 1 failed | 210 passed (211), the one red the
> unknown turn, with its implementation queued with Cog; e2e 25 of 25; the
> push still held, `main` 118 ahead of `origin/main`, the repository still
> private; the owner's three questions in `Personal OS Strategy`.

## The fleet's queue did not drain, and why that matters for reading the ledger

At 08:15 **every task in the fleet was queued and none had started**: Cog's
three (WI-017, WI-020, WI-027), Probe's five (the two contract verifications,
the ADR verification, the CI review, WI-010) and Wren's two (WI-030 and
WI-028's contract half). The minimax-bot runtime was up — it restarted at 07:26,
after the 07:12 stop — and the bot sessions existed: Cog's and Probe's were
`started`, Wren's `idle` since 07:08.

The cause looks like the guard that refused our dispatches twice today:
**the Chief bot replying in more than one chat while a group round is open,
which holds task assignment.** The group was mid-discussion for the whole
window, and that window is when the other Chief session was writing WI-024's
six briefs.

Two things follow, and both matter for reading any of this:

- **"Queued" does not mean "in progress."** Every item in the table above is
  queued. The tree's one red is waiting on the first of them to start, and the
  push waits on that.
- **Nothing is lost while a round is open, and nothing is running either.** A
  red's fix is not silently in flight; the tree is exactly where the last
  measurement said it was.

**WI-027 — the last red's implementation — is queued with Cog** under
`wi-027-unknown-turn`, `task_18f3c6c43c9d`, and it starts when the queue
drains. A retry under that same request id converges on the same task, so
handing it back was one dispatch and not two.

**The minimax-bot runtime was deliberately not restarted** to shake the queue
loose: the other Chief session is mid-round inside it, and a restart would
abort that round's work exactly the way the 07:12 stop aborted this session's.
A green suite is worth less than the work in the round.

### The note that arrived for a session that was already back

The other Chief session's latest note opens _"Your session is down — status
`interrupted` … so this is a note for whenever it comes back."_ It was written
while this session was down and it arrived after this session had been back for
an hour. **Every open point in it is closed**, and it is recorded here so
nobody reads it as current:

- **"WI-017 and WI-020 … still not dispatched — they are yours."** They are
  dispatched: `task_d9352ee63330` and `task_6c20e85110f9`, both queued with
  Cog at 07:27, with WI-030 (the two published entries they need) with Wren.
  Please do not dispatch them again.
- **"The boundary correction … it is corrected at `cb1dfbc`."** Agreed, and
  checked against the tree before this session added anything to that file.
- **"ADR 0007 still says the direction is Desk (B) and 'not yet decided'. WI-025
  is with Wren for that. … if you want it."** Taken up and done: `0d4ec09`,
  with Probe verifying it, and four clauses in the same file that today's
  answers had falsified corrected in the same commit.
- **Its dispatch table listed eight tasks that are cancelled.** The ledger now
  carries a state column, so the table says which are live, which are cancelled
  and what replaced them.

The note's own substance — the 07:12 deaths, the two second dispatches it made
by mistake and cancelled, and the acceptance pass that survived — was already
in the ledger, and all of it is still true.

## The direction, and the seven wants it produces — 2026-10-21 08:20

The owner asked for the open-source landscape to be brought together into one
place, and for the direction to be handed to the factory as specs. That is
`docs/strategy.md` (commit `287c55c`; the owner's answers at `e5df669`), and it
is the product's single pane of glass: what Personal OS is, where each idea came
from, the three pillars the landscape implies, and the gap in each.

**The gap it found.** The 2026-10-20 sweep read twelve comparators and three
findings survived into ADR 0007 and this file. The list itself did not survive:
`prototypes/DIRECTION.md` was rewritten for Forge and the sweep went with it, and
WI-011 still points at that file as its source. The repository could no longer
answer _which projects is this built on, and what does each licence permit_.
`docs/strategy.md` answers it, with every licence read from the repository rather
than from a directory listing — n8n's Sustainable Use is not an open source
licence, Dify's is a modified Apache 2.0 with additional conditions, and
Windmill's is Apache-2.0, AGPLv3 and a proprietary enterprise licence at once.

**The two decisions the owner took today**, both recorded in the document:

1. **All six resource kinds get a template in the first set.** This overrides the
   factory's recommendation of document-then-automation, and the recommendation is
   kept on the record because a decision that does not say what it rejected is not
   a decision. WI-017's last criterion — which template set ships — is now
   answered by the owner's answer rather than by the factory, and WI-030's
   deferral ("which kind gets a template first — that is the owner's call") is
   discharged. Posted to `Personal OS Factory` so Cog has it mid-implementation.
2. **The borrow rule becomes a check, not a claim.** The build fails when a
   dependency's licence changes or an unapproved licence appears. That is what
   catches the AGPL-vendoring case the owner raised, as a failed build rather than
   as a surprise discovered later.

**These are wants, not work items.** The number space has one owner and this
session does not hold it, so it takes no number and opens no file. What follows is
what the number owner needs: a proposed title, an owner, and the criteria.

### W1 — The audit trail records what happened, not that something happened

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Every mutating route writes an audit entry; the entry carries the outcome rather
than an assumed success; every resource kind records a real author, so no kind
reports `system` for an agent's work; the twelve routes that write no entry write
one.

**Criteria:** each of the thirty-four mutating routes writes an entry; an entry
records whether the action succeeded, and `POST /api/resources/:id/execute`
records `queued` rather than `done`; automations and tasks carry the author who
created them; a test proves each of those three.

### W2 — Publish the authorship and audit rules that W1 implements

**Owner:** Wren. **File:** `CONTRACTS.md`.

What "authored by an agent" counts as, what an audit entry's outcome can be, and
what a client written before the change must do, with a migration note.

**Criteria:** the entries land before the code ships; they match the code member
for member; the migration note says what a client written before does and what a
record written before the change means; nothing is reclassified.

### W3 — Resources keep a history the owner can take back

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Each revision of a resource is retained rather than overwritten, and the owner can
restore a resource to an earlier revision through a published route. The restore
is itself an audited action. This is C-21, scoped to resources; tasks and
automations are named out of scope.

**Criteria:** a resource's revisions are retrievable; the restore route publishes
the revision it restored and is audited like any other change; a test proves a
restore returns the resource to the earlier revision's spec and that the audit
trail says the restore happened.

### W4 — An approval resumes the turn the contract says it resumes

**Owner:** Cog. **Files:** `apps/server`, `packages/agent-adapters`.

`CONTRACTS.md` already promises that a decision resumes the turn when the adapter
reports `persistentSessions`. The code closes the execution instead. This makes
the code keep the promise for the adapters that can keep it; for the ones that
cannot, the contract's wording is corrected rather than the behaviour faked.

**Criteria:** for an adapter reporting `persistentSessions`, a decision re-enters
the adapter and the turn continues; for one that does not, the published wording
says so; a test proves the resume for the first and the published exception for
the second.

### W5 — The dependency licences, read from the repositories

**Owner:** Wren. **File:** `docs/strategy.md`, and a note in PRODUCT.md §10.

Each dependency in the lockfile has its licence read from the repository and
recorded, with what that licence permits and what it forbids.

**Criteria:** every dependency in the lockfile has a licence recorded and
attributed to the file it was read from; the AGPL question the owner raised is
answered against the actual dependency set; a note in the document says when the
column was read.

### W6 — The product record says Desk (B); the owner chose Forge

**Owner:** Wren. **File:** `PRODUCT.md`.

PRODUCT.md §11 still says the direction that would fix the accent is "Desk (B),
it is recommended rather than decided, and the owner has one word to say about
it". The owner said their word at 06:01: **D — Forge**. A product record that
states the opposite of the decision is the one thing it cannot carry.

**Criteria:** §11 names Forge, with the date and the fact that the factory
recommended B; the accent rule's statement matches ADR 0007; nothing else in the
product record is changed in the same item.

### W7 — The borrow rule becomes a check, not a claim

**Owner:** Chief. **Files:** `.github/workflows/`, `package.json` (root), the
lockfile.

The build compares the dependency set's licences against the recorded ones and
fails when a licence changes or an unapproved licence appears.

**Criteria:** a licence change in the lockfile fails the build with the dependency
named and the licence it changed from and to; an unapproved licence fails the
build; the recorded licences W5 writes are what the gate compares against; a test
or check proves a deliberately changed licence fails; the gate's own output is
shown in the run.

**Why it is Chief's:** the gate lives in the workflow and the root manifest, which
the ownership table gives to Chief, and one want with two owners is two wants —
so the record (W5) and the gate (W7) are separate.

**What the lead is asked for.** Triage these seven: merge them, refuse them, or
resize them. Four sit directly behind work that is already dispatched — WI-017,
WI-020, WI-030 — so they are queue and sizing questions rather than new ground.
W6 is small and independent of all of them. W1 and W2 are one change and one
published shape, and together they are what makes the product's first report on
itself something other than a lie by omission.

**Not opened here, on purpose.** This session does not hold the number space, so
it opens no file and claims no number. The wants above are in the queue's own
format, and the session that owns the numbers turns them into work items.

## The fleet's real gate, and the correction to a wrong diagnosis (08:40)

**The correction, stated out loud.** `6c22d5e` recorded that the fleet's queue
did not drain because the Chief bot was mid-round in another chat. **That
diagnosis was wrong.** It made the factory look broken when it was working as
designed, and it cost the red about an hour of queue. It is corrected here
rather than overwritten, and the correction is in the record because a factory
that hides its wrong turns cannot be trusted with the ones it gets right.

**What the gate actually is.** Three facts, read from the dispatcher itself:

1. **Two tasks at a time, in the whole fleet.** `MAX_RUNNING = 2` in the task
   dispatcher, deliberately below the engine's three host slots so that a reply
   always has room. Four bots, two slots: the factory is never more than half
   busy.
2. **First created, first run.** The dispatcher scans the batches in creation
   order and takes the first queued task whose bot's chat is free. The queue is
   strictly a queue.
3. **One task per bot.** A bot's chat is serialised, so a second task for the
   same bot waits for the first.

At 08:20 both slots were held — WI-030 with Wren, the CI review with Probe —
and WI-027 was **ninth in a twenty-deep queue**. Nothing would have moved it
up. Only a cancellation of the things ahead of it could.

**What was done, and why.** The owner is holding the push until the reds are
green, and WI-027 is the last red. So at 08:29–08:33 this session cancelled:

- **four of its own status posts to the groups** — `factory-status-…-0720`,
  `-0735`, `strategy-publication-2026-10-21`,
  `strategy-close-unknown-turn-2026-10-21` — each superseded by a newer one,
  and each costing a slot;
- **two of its own Probe verifications** — `wi-022-verify-contract` and
  `wi-026-verify-contract` — **deferred, not dropped**: both were re-dispatched
  four minutes later under new request ids.

**Nothing belonging to the other Chief session was touched.** Its two group
posts ahead of the red were left in place, so the red waited for them anyway;
that was the trade, and it was the right one — one session does not cancel
another session's work to win a queue position.

**WI-027 started at 08:34:37.** The cost of the correction was about an hour of
red time, and the lesson is worth more than the hour: a fleet that talks as
much as this one works will always queue its own work behind its own chatter.
The queue is a budget, and status posts spend it.

### What the other session handed over, and what the lead owes

The other Chief session finished its goal at 08:34 with `docs/strategy.md`
(`287c55c`), the owner's two answers to it (`e5df669`), and the seven wants in
the queue (`a5be44e`). Its decisions were **answered by the owner** in that
session — the peer's messages carry the owner's questionnaire answers, so
nothing here is inferred:

1. **All six resource kinds get a template in the first set** — dashboard,
   document, automation, data-source, task, memory — which overrides the
   factory's recommendation of document-then-automation and discharges WI-017's
   last acceptance criterion.
2. **The borrow rule becomes a check, not a claim** — which split into two
   wants, W5 (the record) and W7 (the gate), because the record and the gate
   are different files with different owners.

The peer's own note is right and is kept: it **opened no work item and took no
number**, because the number space belongs to this session. **Seven wants are
waiting to be triaged** — merged, refused or resized — and then numbered. That
triage is the lead's, and it is deliberately not done yet: the owner's answers
on the push (below) can change the order of the queue, and W2 is a contract
entry that must land before W1's code, which is the same rule this factory
keeps applying.

### The owner's three questions, and what each one blocks

Asked in `Personal OS Strategy` at 07:40 and 07:50, and restated here because
the answer changes what gets built and published:

1. **Does the repository go public at the push, and is a LICENSE and a code of
   conduct wanted first?** This blocks the push, the README's licence line, and
   the licence column in `docs/strategy.md`.
2. **If the push happens when the tree is green, is the panel as it stands the
   version to publish, or does Forge land first?** This blocks WI-024, which
   has no live dispatch.
3. **May the product publish `POST /api/executions/:id/resolve`, so the owner
   can close a turn they were told to check?** This is WI-031, and the
   recommendation is **yes**: the waiting list promises that only the owner can
   close an unknown item, and today nothing can close an unknown turn.

Nothing else is owed by anybody. The reds are green when WI-027 lands, and
CI has still never run on GitHub — the first run is the push.

### The owner's answers, 2026-10-21 08:54

A fourth question was added at 08:47, because the other Chief session had
drafted a rule that touches the owner's standing instruction. All four were
answered together, in the owner's own session, with the owner's explicit
confirmation.

1. **Private for now — push it, and decide visibility later.** No LICENSE and
   no code of conduct are wanted at this push. **The open-source aim is
   deferred by the owner's word, not by an oversight**, and it comes back the
   day they decide on visibility: the licence question is answered by "not
   yet", not by "no". The licence column in `docs/strategy.md` describes
   _comparators_, not this repository, so nothing in that document is now
   wrong.
2. **Push as soon as the tree is green, with the panel as it stands. Forge
   lands right after.** This is the owner's word for the push, and it is
   conditional on the same condition they set before: the tree is green. So
   the push happens after the gates, not before them — and the panel that
   goes public is the panel that is green today, with WI-024 (Forge) landing
   as the first visible change after it.
3. **Yes — publish `POST /api/executions/:id/resolve`.** WI-031 is released.
   The route carries the owner's own conclusion (`outcome: 'completed' |
'failed'`) and an optional note, the execution and its reply follow it, the
   item leaves the waiting list, and the transition is audited as
   `execution.outcome.resolved`. The contract half goes first, because the
   contract leads the code.
4. **Yes to branch pushes; main still waits for the owner's word.** The rule
   the other session drafted — a bot may push its own work item's branch to
   `origin` without asking, and CI gates every branch — **stands**. What does
   not stand is its second half: it said a bot may fast-forward `main` itself
   when `main` has not moved, and that is wider than what the owner granted.
   **Main waits for the owner's word.** The word given here is for this
   push, and it is spent when the push is made.

**What this changes in the factory's own rules.** The parallel-work rule
(`0658b9f`) is committed as drafted, and the line that lets a bot land `main`
without asking is narrowed to match the owner's answer. The rest of the rule
stands: a work item gets a branch and a worktree, a bot pushes its own
branch, and a branch is a gated branch because CI runs on every branch push.

**The order this is done in.** The gates first, the push second, and the
push is made by this session, on this session's own reading of the tree — the
implementer is not the verifier and the lead does not push on a summary.

### What actually happened at 08:56, and what it means

**The push is made.** `origin/main` is at `d03e225`, and the tree that commit
carries is green — every gate measured green by the other Chief session before
it pushed. The order of events, stated plainly because the order matters:

- **08:54:42** — the owner answered the four questions. Their word includes
  _push as soon as it is green, with the panel as it stands_.
- **08:56:40** — the other Chief session pushed `main` to the private remote
  with `d03e225`, under the parallel-work rule it had just committed
  (`0658b9f`). **That push is after the owner's word and was authorised by
  it**, because the tree it carried was green and the owner had said to push
  when green.
- **09:0x** — this session narrows the rule that allowed it, so that no bot
  lands `main` again without a word, and records the owner's answers here.

**The repository is private**, which is what the owner chose. Nothing is
public, the visibility is unchanged, and no LICENSE was added, because the
owner deferred visibility rather than refusing it.

**CI ran on GitHub for the first time, twice.** The runs are in the Actions
tab: one at 08:25:39, carrying a tree that still had the turn's red, and one
at 08:56:40, carrying the green tree. **Their conclusions have not been read
back yet** — the repository is private and this machine has no token for it,
so the outcome of the pipeline is still unverified by anyone. That is the one
thing about the push that is not yet evidence.

### A gate that failed for a reason that is not a defect

The first full-suite run at 09:00 came back **red**: two failures in
`apps/server/src/__tests__/ownerPasswordExposure.test.ts` — "the reset process
did not run, or its command line was not readable" and "the reset process did
not finish: expected 1 to be +0" — and a `format:check` failure.

They are two different things, and one of them was the lead's own:

- **`format:check` was this session's fault.** `.factory/INTAKE.md` had been
  edited and not formatted. Fixed, and the gate is green.
- **The two test failures are a collision, not a regression.** The same file
  **passes 5 of 5 in isolation**. The failure is the server's own database
  and process list being contended by **another session's test run in the same
  checkout at the same moment** — this repository has one working tree that
  three sessions and four bots share, and the smoke gate in the same run
  proves the behaviour itself is correct.

**The finding is bigger than the failure.** The server suite is only
trustworthy when nothing else is touching the checkout, which is the same
problem the parallel-work rule solves on the git side and does not yet solve
on the filesystem side. Until the bots work in the worktrees that rule
creates, **a red in the full suite has to be re-checked in isolation before it
is called a defect** — and a green full suite that ran alongside another
session's run is not a green full suite. A check that cannot fail is worse
than no check; a check that fails for the wrong reason is nearly as bad, and
it is the reason this is written down rather than quietly re-run until it
passed.

## The seven wants, triaged — 2026-10-21 09:25

The wants the direction produced at 08:20 were handed over for triage, and
the lead does the triage: **merge them, refuse them, or resize them.** The
tree is green as of `f1c29e7`, so this is a queue decision and not a rescue.

**No number is taken here, and the reason is in the record.** The number space
has one owner, and it is not this session: WI-030 and WI-031 were taken at
08:34 and 08:54, after the numbers this session took at 07:11 (WI-024 to
WI-029), and the numbering has been continuous and collision-free since. A
number is a claim, and two claims in one tree have already collided twice. So
this session records the verdicts, the titles, the owners and the criteria,
and the session that owns the numbers creates the files.

| Want | Verdict           | Where it goes                 | Why                                                                                                          |
| ---- | ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| W1   | accepted, resized | a new item, Cog               | It is the change behind the product's own report. **After W2** — the contract leads.                         |
| W2   | accepted          | a new item, Wren              | The published shape for W1. **Before W1.**                                                                   |
| W3   | **deferred**      | a new item, Cog, behind Forge | The furthest from the owner's stated priority and the largest of the seven. It is C-21, scoped to resources. |
| W4   | **folded**        | [WI-007](../work/WI-007.md)   | WI-007's title is "Deciding an approval resumes the turn when the adapter can" — it is this want.            |
| W5   | accepted          | a new item, Wren              | The record the gate compares against. **Before W7.**                                                         |
| W6   | accepted          | a new item, Wren              | Small and independent of all of them.                                                                        |
| W7   | accepted          | a new item, **Chief**         | The gate. **After W5.**                                                                                      |

**W1 and W2 are one change and one published shape, and they matter most.**
WI-020 publishes the route that counts what the product did, and the numbers
behind it are wrong: `createdBy` is hardcoded `'system'` for automations and
tasks, twelve of the thirty-four mutating routes write no audit entry, and
every entry records success regardless. So the product's first report on
itself — the owner's Q6 — is a lie by omission, and W1 with W2 is what makes
it something else.

**W4 is folded, and the fold is not a disposal.** WI-007 is the same subject
under a different name, and it is with Cog now with its fix landed. The fold
is recorded here rather than in WI-007's file, because that file is the other
Chief session's live claim and two sessions editing one work item's file is
the collision this factory keeps repairing — WI-007's own criteria are W4's
criteria, so the item already carries the scope.

**W3 is deferred, and the reason is capacity, not judgement.** It is the
largest of the seven and the furthest from what the owner said matters:
interaction, and "what needs me" on the landing page. A restore route for a
resource is neither. It becomes a numbered item so it is not lost, and it
starts after Forge.

**W5 and W7 are funded by the owner's own answer, and W5 before W7.** The owner
answered at 08:54 that the borrow rule becomes a check, not a claim. A gate
that compares against nothing catches nothing, so the record lands first. The
owner's "private for now — no LICENSE yet" was about **this repository's own**
licence and a code of conduct, not about the licences of what it depends on, so
it defers neither.

**W6 is the cheapest item in the set and the most overdue.** `PRODUCT.md:280`
still says the direction that would fix the accent is "Desk (B), it is
recommended rather than decided". The owner said their word at 06:01, and
[WI-025](../work/WI-025.md) put it in ADR 0007. The product record is the last
place still telling the old story.

### The order, with capacity

One implementer. One item at a time. The order is not a preference, it is the
only thing that can happen — so it is written down, with what does not start
yet and why.

**In flight, and not to be reordered.** WI-031 (the owner's route to close an
unknown turn — released at 08:54, dispatched, and it closes WI-027's last
criterion), WI-017 (the template set — the owner's answer that all six kinds
get a template in the first set), WI-020 (the measures route), WI-007's fix,
and WI-028's contract half. **Cancelling a dispatched item to move another up
is what strands work**, and the factory has been burned by it twice today, so
nothing in this queue is cancelled to make room.

**Next, and the owner's word says it.** [WI-024](../work/WI-024.md), Forge —
the panel's adoption of the direction the owner chose, and the next visible
change after the push. It is dispatched to Cog by this session on 2026-10-21.
The three items above it are already dispatched and queued, and one implementer
means they land first; the owner's word is about what the panel looks like
next, not about which queue a card sits in. If the owner wants Forge ahead of
them, that is one word, and it is a lead decision to reverse.

**Then the seven wants, in the order the table gives:** W2 before W1, W5
before W7, W6 on its own because it is small, and W3 last.

**What does not start yet, and why.** W3, because it is the furthest from the
owner's stated priority and the largest of the seven. The verification queue,
because **one verifier is the factory's real gate**: six items sit at `verify`
and every one of them waits on Probe, so acceptance — not implementation — is
now the bottleneck. That is a fact about capacity, and the fix is Probe's
queue, not a rule change.

### The post that is owed, request id `factory-status-2026-10-21-0925`

The status post to the `Personal OS Factory` group was refused by the runtime
again, with the same guard that refused every dispatch this tick: _"This Bot is
replying in multiple chats, so this tool call cannot be assigned safely."_ The
gate is not the group's — the group has taken posts — it is the bot being in
another chat at the same moment.

It says, in short:

- **The seven wants are triaged** — merged, refused or resized, with the
  verdicts, the titles, the owners and the criteria recorded above. W4 is
  folded into WI-007. W3 is deferred for capacity, not judgement, and becomes
  a numbered item so it is not lost. W6 is the cheapest item in the set and
  the most overdue — `PRODUCT.md:280` still says the direction is Desk (B).
  W1 and W2 matter most: the numbers behind the product's own report are
  wrong, so the report is a lie by omission until they land.
- **The order, with capacity.** In flight and not to be reordered; then
  WI-024, Forge, as the next visible change after the push; then the seven
  wants in the order W2 before W1, W5 before W7, W6 alone, W3 last. What does
  not start yet: W3, and the verification queue — six items sit at `verify` and
  every one waits on Probe, so acceptance is the bottleneck now.
- **One question is with the owner**, and WI-008 cannot close without it:
  should a turn whose outcome could not be confirmed keep dispatching work?
- **A note on evidence.** The full suite is only trustworthy when nothing else
  is touching the checkout, and three sessions and four bots share one working
  tree. A red has to be re-checked in isolation before it is called a defect,
  and a green run that happened alongside another session's run is not a green
  run. Nothing is accepted on a contended run.

### The dispatch that is owed, request id `wi-024-forge-adoption-2`

[WI-024](../work/WI-024.md), Forge, is the owner's next visible change and its
re-dispatch is **owed** — the runtime's guard refused it along with every
other call this tick, including the group post above and the checks of task
states. A dispatch that cannot be delivered is not a dispatch, so the item's
file records the request id and the order the brief carries, and the work does
not move until somebody has actually been given it.

### The owner's product question that is still open

[WI-008](../work/WI-008.md) cannot close on an unanswered question, and the
question is the owner's: **should a turn whose outcome could not be confirmed
keep dispatching work?** `planAndDispatch`
(`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
`message.status`, so an unknown turn keeps asking for more work while the
owner is looking at it on the waiting list and nobody can confirm the first
turn's outcome. Chief's recommendation is **no** — an unknown outcome waits for
the owner, which is what "check this" means — but it changes what the product
does with spend and it is the owner's call, not the factory's.

## The six numbers, taken 2026-10-21 09:40

The other Chief session triaged the seven wants at 09:25 and **took no
number**, because the number space has one owner and it is this session's.
The verdicts, the titles, the owners and the criteria are recorded there; the
files are created here.

| Want | Item                        | Owner | Where it sits in the order         |
| ---- | --------------------------- | ----- | ---------------------------------- |
| W1   | [WI-033](../work/WI-033.md) | Cog   | after WI-034                       |
| W2   | [WI-034](../work/WI-034.md) | Wren  | before WI-033                      |
| W3   | [WI-035](../work/WI-035.md) | Cog   | **deferred** — starts after Forge  |
| W5   | [WI-036](../work/WI-036.md) | Wren  | before WI-038                      |
| W6   | [WI-037](../work/WI-037.md) | Wren  | on its own — small and independent |
| W7   | [WI-038](../work/WI-038.md) | Chief | after WI-036                       |

**W4 has no item and needs none.** It is folded into
[WI-007](../work/WI-007.md), which is the same subject under a different name
and is already with Cog. The fold is recorded in the triage rather than in
WI-007's file, because that file is the other Chief session's live claim.

**The numbers are stable, and the order is not in them.** W1 became WI-033 and
W7 became WI-038 because the correspondence has to stay legible, not because
the queue runs in that order: the queue runs WI-034 before WI-033, WI-036
before WI-038, WI-037 on its own, and WI-035 last. **A number is a handle,
and handles are not reordered when the queue is.** The queue has been
reordered three times today, and every item that was cancelled and
re-dispatched had to change its request id as well; the number did not move,
and that is the point of it.

**What is not dispatched yet, and why.** Nothing in this set is dispatched.
**One verifier is the factory's real gate**: the triage records six items
sitting at `verify` with every one of them waiting on Probe, so acceptance —
not implementation — is the bottleneck now. Adding nine more cards to a queue
whose far end is blocked does not make the product better; it makes the
ledger longer. These items are written, numbered and ready, and they start
when Probe's queue has room.

**Every number this session has taken, in one place.** WI-030, WI-031,
WI-032, WI-033, WI-034, WI-035, WI-036, WI-037, WI-038. The other Chief
session's are WI-024 through WI-029.

## The measures cannot publish numbers the audit trail knows are wrong — 2026-10-21

WI-020 is dispatched and in flight, and it sits ahead of WI-033 and WI-034.
That is fine for the route: a read-only route that returns the numbers is
published work, and the owner approved it. It is not fine for the band — the
surface the owner looks at. The inputs are known to be wrong today:
`createdBy` is hardcoded `'system'` for automations and tasks, twelve of the
thirty-four mutating routes write no audit entry, and every entry written
records a success whether the action succeeded or not. A band that renders
those as "the share of features authored by agents" is the product's first
report on itself, and it would be false.

So the rule, in the family of the one that already travels with the direction
(_no ratio whose denominator is zero_): **no number whose inputs are known to
be wrong.** The route lands. The band ships with the counts it can defend —
features authored in-instance by an agent, from a table that records the real
author — and the ratio and the second measure wait for WI-033 and WI-034.

This is a scoping change to a dispatched item, not a reordering: the item
lands, and what it shows is bounded by what the data can carry. Nobody has
said the band may publish a number the audit trail does not support.

## Two of the seven wants start on Wren's lane — 2026-10-21 10:54 AEST

W5 and W6 are dispatched, and the reason is capacity and ownership, not
willingness. **Neither lane is idle**, so the order has to name which
implementer is free of _new_ work and which items are heavy:

- **Cog's lane holds four implementation-heavy items** — WI-024 (Forge),
  WI-017, WI-020 and WI-031's implementation. One implementer, one item at a
  time, so that is four turns before anything else reaches the tree.
- **Wren's lane holds three small ones** — WI-025's ADR record pass, WI-031's
  contract half and WI-007's migration note, which is one sentence — plus
  WI-028's contract half, running now.

**Implementation does not consume the verifier.** Dispatching W5 and W6 puts no
new card in front of Probe, and it takes none of Cog's slot: both are Wren's
files, neither touches code, and neither touches `CONTRACTS.md`, which is
live. What it does is start the two wants that are already written, already
owner-funded, and blocked on nothing.

**W5 is the ground truth WI-038's gate compares against**, so it sits on the
path to the owner's answer of 08:54 — the borrow rule becomes a check — and a
gate that compares against nothing catches nothing. W6 is the one place in the
repository still telling the owner the opposite of their decision.

**What still waits, and why.** WI-034 and WI-033 wait because `CONTRACTS.md`
is live — WI-028's contract half is writing it — and WI-034 publishes entries
there. WI-035 is W3, deferred for capacity and last. The order among the
wants stands: W2 before W1, W5 before W7, W6 on its own, W3 last.

**The tiebreak, said out loud.** These two are dispatched by this session.
**Do not dispatch WI-036 or WI-037 again from anywhere.** One item, one
owner, one live dispatch. The request ids above are spent; a re-dispatch needs
a new id and a new title, not a reuse.

**The owner's two questions are with the other Chief session.**
`ask_840a807bf1ad7291f4d92f44` holds them — whether an unconfirmed turn keeps
dispatching work, which WI-008 cannot close without, and where Forge sits in
the queue. This session does not ask them a second time.

## The factory is idle with a full queue — 2026-10-21 10:57 AEST

**Every lane is full and nothing is running.** The last task to _start_ was
Probe's WI-025 verification at 09:35:16; the last task to _finish_ was at
09:48. Since then — nine minutes — the runtime has assigned nothing, though
fourteen tasks are queued and waiting.

| Lane  | Queued                                                                                    | Idle since |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| Cog   | 4 — WI-024 (Forge), WI-017, WI-020, WI-031's implementation                               | **08:51**  |
| Wren  | 5 — WI-025's record pass, WI-031's contract half, WI-007's migration note, WI-036, WI-037 | 09:34:34   |
| Probe | 5 — WI-022, WI-007, WI-021, WI-027, WI-030                                                | 09:48      |

**This is not a queue with too much on it.** Probe finished WI-025's
verification at 09:48, freed its slot, and was not given the next one —
WI-022's, which had been waiting since 09:13. **A bot that frees a slot and
is not given the next task is an assignment that is not happening.** Cog's
lane has been idle for sixty-four minutes, and Forge — the owner's chosen
direction — is in it.

**Two readings fit the evidence, and the factory can separate them.**

1. _The guard holds the assignment._ The runtime refuses a tool call with
   "This Bot is replying in multiple chats, so this tool call cannot be
   assigned safely", and the Chief bot is in two chats — this session and the
   other Chief session's group turn. The other session named this cause at
   08:15 and 08:22. Against it: the guard is not refusing anything now —
   this session's dispatches were accepted at 09:54 and its task queries work
   — and the assignment is still not happening. **The guard explains the
   refusals. It does not yet explain the silence.**
2. _A bot session is wedged._ Cog has had seven tasks cancelled today, three
   of them at 07:49:25 with `AGENT_UNAVAILABLE`, and a cancelled task may
   leave its session spinning with the queue behind it. Cog's lane is the
   longest idle, and Cog is the bot that has been cancelled the most. Wren
   and Probe are shorter idle, and both finished cleanly.

**The test for the next tick costs one dispatch of nothing.** Watch whether a
queued task starts once the Chief bot is in one chat and one round. If one
starts, the first reading is right, and the factory's throughput depends on
how many places the lead is talking at once — which is a rule worth keeping.
If none starts, the second reading is right, and a wedged session has to be
replaced rather than waited on.

**What was not done about it, deliberately.** Chief did not cancel and
re-dispatch a queued task to force it moving: a cancelled dispatch strands
the item and costs a new request id, and forcing an assignment the runtime is
not making does not make it. Chief did not message a bot to ask whether it
is alive, because a message is another item in a queue that is not draining,
and it would compete with the real work rather than replace it. And Chief
added no new work to the queue, except the two wants that were already
written, already owner-funded, and blocked on nothing.

**What the ledger's "Probe is the gate" reading was.** It was right about
where acceptance is stuck, and it was not the whole truth: six items at
`verify` is a queue, and a queue only matters if it moves.

**Two measurements taken at 11:05, after the section above was written.**

1. **The guard was refusing at that moment.** Chief's attempt to post this
   state to the factory group was refused with "post_group is only available
   in a private chat, not during a group turn" — the same guard, refusing at
   the moment Cog, Wren and Probe were all idle with full queues. So the bot
   was in a group turn then, and the assignment was held then. **That is
   correlation, not proof** — a guard that refuses the lead's post while
   three lanes are idle is the same fact as a guard that holds assignment,
   but one occurrence of each is not a demonstration.
2. **Twenty seconds of watching changed nothing.** A queued Cog task
   (`task_4b5a7d412c11`, WI-017's successor) was watched for twenty seconds
   for a state change. It stayed `queued`. The stall is not a slow queue
   clearing; it is not clearing.

**One more thing the owner should know, because it is in the same working
tree.** Three of the owner's own desktop sessions point at `G:\code\personal-os`
— "研究 MiniMax Code 复用与 Personal OS 架构", "Fix git remote for multi-agent
pushes" and "Build personal OS planning specs handoff" — and the third was
still being worked on at 09:56, minutes after Chief's commit. The factory's
rule that one file carries one live item is the repository's rule, and the
owner's own sessions sit in the same checkout as four bots and two Chief
sessions. That is the contention the red in `ownerPasswordExposure.test.ts`
came from, and it is the reason a contended gate run is not evidence.

## Chief's tick — 2026-10-21 10:03 +11:00

**The times in this entry are the machine's clock (+11:00).** The entries above
carry labels that run about two hours ahead of it, and they are left as they
are. A reader comparing "10:57" with "09:56" is comparing two clocks, not two
events.

### The tree is green, measured first-hand

| Gate                    | Result                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`     | exit 0                                                                                                               |
| `npm run format:check`  | exit 0 — "All matched files use Prettier code style!"                                                                |
| `npm run test`          | exit 0 — server 211 passed (21 files), web 52, worker 31, agent-adapters 16, contracts 28; **338 tests, 0 failures** |
| `npm run test:e2e`      | exit 0 — **25 passed** (48.1s)                                                                                       |
| `npm run smoke`         | exit 0 — "All smoke checks passed."                                                                                  |
| `npm run verify:bundle` | exit 0 — every chunk within 300 kB, the first paint carries no page chunk                                            |
| `npm run verify:build`  | exit 0 — "The compiled server boots and serves requests."                                                            |

**`main` is 16 commits ahead of `origin/main` and 0 behind.** The first green
tree was pushed at 08:56 under the owner's word, and that word is spent. **The
next push needs the owner's word again**, and the tree it would carry is the
one measured above.

### The band ruling, now in the file and in the brief

The rule the other session recorded earlier today — _no number whose inputs are
known to be wrong_ — is now **in WI-020's acceptance criteria and in the brief
of the live dispatch**. The band ships the counts it can defend: the first
measure's counts, with the count of resources that record no author beside
them; the second measure **named as not yet countable**; and **no ratio, for
either measure**. The route still returns WI-030's published shape, so the
contract is not changed by the ruling and the build is not gated on a judgement
that is the owner's to make. The ratios, and the second number, appear when
WI-033 and WI-034 land.

**The re-dispatch cost the queue nothing.** The creation timestamps say
WI-020's predecessor was created at `…099771`, one second after WI-017's
successor at `…099473`, and both sit behind WI-024 (07:49) and WI-031's
implementation (08:54). So WI-020 was fourth in Cog's lane before the ruling
and it is fourth after it. What the third request id bought is a brief that
cannot be read as a brief to build the old band.

### Five items, and one record corrected

| Item   | Owner | What it is                                                                                     | Dispatched                                                         |
| ------ | ----- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| WI-039 | Wren  | Publish the evidence a decision is taken against — what it did, what it produced, what it cost | `task_dd95fe7df207`, queued                                        |
| WI-040 | Cog   | The decision control shows that evidence, in a drawer where the control opens                  | **not dispatched** — waits for WI-039, and Cog's lane is four deep |
| WI-041 | Wren  | The README tells the truth about the licence — one honest sentence                             | `task_644f23312ebc`, queued                                        |
| WI-042 | Wren  | The product record's closed questions say they are closed — §7, §9, §10                        | **not dispatched** — WI-037 is live on `PRODUCT.md`                |
| WI-043 | Chief | The manifest does not claim a licence — `"license": "MIT"` removed                             | `task_9b1b44c1025f` to Probe, queued                               |

**Two of the five are not dispatched, and their files say why.** A dispatch that
cannot be delivered is not a dispatch, and neither of these can be: WI-040
waits for WI-039's entry, and WI-042 waits for WI-037, because one file
carries one live item. They are numbered so they are not lost.

**WI-039 and WI-040 are the gap Vision found.** The owner decides on two buttons
and a title: the needs-you rail's approval row carries **Approve / Reject**
(`apps/web/src/components/WaitingList.tsx:272-284`) and nothing that says what
the agent did, what it produced, or what it cost. The evidence exists in the
database — the execution the approval points at
(`apps/server/src/modules/approvals/service.ts:12`), its events
(`apps/server/src/db/schema.ts:241`), and its own row
(`apps/server/src/db/schema.ts:227-231`) — and it is published nowhere: there
is no executions route file, and `GET /api/approvals/:id` returns the approval
only.

**WI-041 and WI-043 are the same false claim in two files.** The owner answered
on 2026-10-21 that the repository is private for now, that there is no LICENSE
file at this push, and that the licence is **deliberately undecided**. The
README said `MIT` (`README.md:251-253`) and the root manifest said
`"license": "MIT"`. The manifest is Chief's file, so Chief removed the field —
removing it rather than setting `UNLICENSED`, because `UNLICENSED` is a claim
too, and the licence is undecided — and **Probe verifies it**, because the lead
never accepts its own work. The README is Wren's file, so it is WI-041.

**One record defect is fixed.** [WI-011](../work/WI-011.md) cited
`prototypes/DIRECTION.md` as the source of the twelve comparators. That file
was rewritten for Forge and no longer holds them; the source is
[`docs/strategy.md`](../docs/strategy.md), which the file now cites.

### The fleet is not assigning, and the evidence is better than it was

**Four dispatches were accepted at 10:03, in one chat and one round, and
twenty-four minutes later nothing had started.** Sampled: Cog's WI-017
(`task_4b5a7d412c11`, created 09:41), Wren's WI-037 (`task_4947c89ca7fe`,
created 09:54) and Probe's WI-030 (`task_dc2aeef86acb`, created 09:42) — all
three still `queued`.

**The guard is not the blocker.** It refused the other session's group post at
11:05 on its clock, and it refused tool calls while the Chief bot was in two
chats; but this session's dispatches were **accepted** in a single-chat round.
So the thing that holds assignment is not the refusal.

**An idle chat with a queued task is not being assigned, and that is the part
that matters.** The dispatcher's rule is to take the first queued task whose
bot's chat is free. Wren's and Probe's chats are **idle** in the session list
(`mvs_dff627414f0e47fbbdf7501b11dfdd06`, `mvs_f1f513955649480dbfb09fae820cf59f`
and `mvs_db6a5624d51842cd8a029fc062c60503` all idle or finished), and their
tasks are still queued. So the reading that now fits is not _the guard holds the
assignment_ — it is **the dispatcher's scan is not running**.

**Two facts in the same direction.** The local runtime stopped and restarted:
the other Chief session's session carries _"This session was interrupted because
the previous local runtime stopped"_ (`mvs_30c09202cd384ee8865fb509b595a7bb`),
and its goal-verifier child died at 09:35 with
`GOAL_VERIFIER_CAPABILITY_VIOLATION`. A dispatcher whose scan loop did not come
back with the runtime would behave exactly like this: tasks queued, chats
free, nothing assigned.

**The remedy is outside the repository, and Chief cannot reach it from here.** A
runtime restart is the host's action, and this chat is hosted by the runtime
that would be restarted. The other Chief session can close its crashed
goal-verifier child, which may be what is holding the assignment. Chief did not
message a bot to ask whether it is alive: a message is another item in a queue
that is not draining, and it would compete with the real work rather than
replace it. **This is the one thing the owner may have to do, and it is the
factory's whole throughput.**

### The owner's three questions, in the strategy room

The other Chief session holds two of the owner's questions — whether an
unconfirmed turn keeps dispatching work, and where Forge sits in the queue —
and this session does not ask them a second time. These three are here:

1. **The push.** The tree is green and `main` is 16 commits ahead. The owner's
   word was spent on the first green tree; the next one waits for the next word.
2. **The waiting list's way out.** `approval.decided` — one event published by
   the decide route, so a decided approval leaves the list at once. It is a
   published-contract change, so it is the owner's (C-16, C-22). The
   recommendation is **yes**.
3. **Reversibility.** Is it a product principle that the owner's decisions are
   reversible? The recommendation is **yes** — with one owner there is no second
   operator to absorb a bad action. WI-035 carries the work, and it is deferred
   behind Forge on capacity, so the answer changes the queue rather than the
   code.

### The check, twenty minutes later — the dispatcher is the only path, and it is not scanning

**Seven tasks, all still queued, and the query surface is live.** At 10:27
Chief read all seven: Cog's WI-017 (`task_4b5a7d412c11`), Wren's WI-037
(`task_4947c89ca7fe`), Probe's WI-030 (`task_dc2aeef86acb`), and the four
dispatched this tick — `task_86010eeeb561`, `task_dd95fe7df207`,
`task_644f23312ebc`, `task_9b1b44c1025f`. **All seven: `queued`.** The control
is the task that finished: `task_2b5c9020bf00` (WI-025's verification) reports
`done`, with `started_at`, `ended_at` and the whole result, so the surface is
not stale and `queued` is a real state rather than a frozen read.

**The factory has produced nothing for forty-six minutes** — the last task to
finish was WI-028's contract half, whose `ended_at` reads **09:41:14**, and
the next task was created twenty-five seconds later at 09:41:39. The queue got
work the moment a slot should have freed, and nothing was assigned.

**A restart is safe, and that is measured, not assumed.** Two tasks created
before this morning's runtime stop are still readable with their state intact:
`task_146247be56d5` (WI-028's contract half, created 08:07) reports `done`
with `started_at` 09:25:51 and `ended_at` 09:41:14, and `task_8e6fe1c54bfb`
(WI-022's verification, created 07:44, cancelled 08:33) still reports
`cancelled` with its own `ended_at`. **The queue is persisted, not held in
memory**, and a task that was running across the earlier stop finished anyway.
A restart costs the factory the idle time it has already spent, and nothing
else.

**A second route was tried, and it is the same queue.** The hypothesis worth
testing was that a direct message reaches an idle chat when the dispatcher does
not. Chief handed Wren the same WI-039 brief as a message
(`wi-039-evidence-contract-2026-10-21-via-chat`, task `task_c125d103127b`).
**It came back `queued` as well.** So `dispatch_tasks` and `message_bot` are
two doors into one queue, and the queue is the only way in. Chief cancelled
that task in the same minute so that WI-039 keeps **one** live dispatch, and
the attempt is on the record in WI-039's file.

**What this rules out, and what it leaves.** It rules out the idea that the work
is lost or misrouted: the tasks are persisted, they are named, they are
readable, and both doors put them in the same place. It leaves the conclusion
that **the dispatcher's scan is not running** — and the one fact that fits
alongside it is that the local runtime stopped and restarted this morning, and
the other session's goal-verifier child died on a capability violation at
09:35. A dispatcher that did not come back with the runtime looks exactly like
this: tasks queued, chats free, nothing assigned.

**The owner's next action is a restart of the local runtime.** Chief cannot do
it: this chat is hosted by the runtime that would be restarted, and the restart
is the host's. Nothing else in the factory's hands moves the queue — the
re-dispatch and the message both produced one more identical queued task, and
the queue is where they stay. The tree is green, so a restart costs the
factory nothing but the idle time it has already spent.

### The third road, and where all three end

**A direct turn in Wren's session was tried, and it queued behind a stuck turn.**
Chief sent WI-039's brief to Wren's own session
(`mvs_dff627414f0e47fbbdf7501b11dfdd06`) through the desktop session API,
because that route does not belong to the mini app's dispatcher. The runtime's
answer: `status: accepted, mode: queued, position: 1` — _"The target Session
was busy, so this message was queued and runs after the current Turn."_ And
the session list calls that session **idle**. So the list's "idle" and the
runtime's "busy" are two different things, and the runtime's is the one that
decides.

**What Wren's session is busy with is not a dispatched task.** All three
sampled tasks are still `queued` — WI-037 (`task_4947c89ca7fe`), WI-039
(`task_dd95fe7df207`) and WI-030 (`task_dc2aeef86acb`) — so the turn in that
session is not one of ours.

**Three roads, one queue.** `dispatch_tasks` queues. `message_bot` queues. A
direct session turn queues behind a turn that does not end. And the mini app's
own process is **running** (`miniapp list` — `status: running`), so this is not
a dead process: it is a process whose assignment loop and whose bot sessions
are both stuck. **Two bot sessions have been sitting in `started` with no task
running in them** — Probe's (`mvs_f1f513955649480dbfb09fae820cf59f`, since
09:51) and Cog's (`mvs_e109a52fca0541f196725ffdedd0d316`, since 09:32) — and
the other Chief session's goal-verifier child is in `error` from 09:35. Two
wedged sessions and a two-slot dispatcher is a reading that fits the whole
picture: a wedged session can hold a slot that nothing else can use.

**So the owner's next action is a restart of the local runtime, and the
evidence says it is safe.** The queue is persisted — two tasks created before
this morning's stop are still readable with their state intact — the tree is
green, and nothing in the factory's own hands moves the queue.

### The third road works — and the factory can be driven from a session

**WI-039 landed.** `6406291` — "Publish the evidence a decision is taken against"
— `CONTRACTS.md` only, committed 10:48:53. It was written by Wren, in Wren's
own session, from the turn Chief opened there. **The dispatcher's copy of that
task is still `queued`.**

**So the third road is the one that works.** `dispatch_tasks` queues.
`message_bot` queues. A turn opened in the bot's own session **runs**. The
nudge to Wren's session at 10:31:56 put that session into `started` at 10:32:08,
and the work landed sixteen minutes later.

**Two cancellations, both to keep one delivery per item.** The queued task
`task_dc2aeef86acb` (WI-030's verification) was cancelled and the work was
handed to Probe through the same working route; and `task_dd95fe7df207`
(WI-039's queued dispatch) was cancelled once the work had landed, so that no
second worker writes `CONTRACTS.md`. WI-039's verification is dispatched
(`wi-039-verify-evidence-entry-2026-10-21`, `task_e486def935b8`) and queued —
it will be handed over the same way when a bot session is free.

**What this changes about the remedy.** The owner's restart is still the fix for
the dispatcher. It is no longer the only way work moves: a turn in a bot's
session is a delivery route the dispatcher does not own, and using it does not
touch the queue. The factory is no longer waiting on the restart to make
progress — it is only waiting on it to stop the queue from growing.

**What is running, at 11:05.** Probe's verification of WI-030 is running in its
own session, and it has a finding in hand: the template record's migration note
tells a client to add `resource.template.list` to an agent's `toolGrants`, and
the server rejects that today — `toolGrantListSchema` is
`z.array(mcpToolNameSchema).max(mcpToolNames.length)`
(`packages/contracts/src/mcp.ts:52`), so an unknown name is a 400 and the cap
is the current list's length. **The two published shapes were corrected at
`2dcac9c`** ("Hold the two published shapes to the code they describe",
11:03:50) while that verification was still running, and WI-031's contract
entry landed at `363428e`. The other session accepted WI-022 and WI-026 and
recorded a ruling on contract verification (`0c0dfcd`).

**Nothing here is accepted on my word.** Probe's report is still being written,
so WI-030 and WI-039 are not accepted until it is, and a correction landing in
the file while the verifier is reading it is something the verifier has to
account for — not something that closes the item.

**Two verifications are now running in Probe's own session** — WI-030's, opened
at 10:51, and WI-039's, queued behind it at 10:53 — and WI-039's work itself
has landed. Cog's session (`mvs_db6a…`) is busy with work of its own, and both
builds (WI-017 and WI-020) wait on WI-030's verdict, which is the order this
factory already recorded: a build against a shape that does not hold is work
thrown away.

## A review of the strategy document, 2026-10-21 — Vision

`docs/strategy.md` asks three questions in the strategy room: are the three
pillars the right three, is the landscape table the one worth keeping, and are
the seven wants the right wants. The document is Wren's house, so this review
is recorded here and has to be folded into it by its owner. **The number space
is untouched: nothing below takes a number.**

### 1. The pillars are right as mechanisms, and one thing is missing that is not a pillar

The document's own answer carries four clauses, and the one-sentence summary
three. Two map exactly onto pillars: _native means typed and checked_ is
Pillar 1, _the instance can be seen from the inside_ is Pillar 3. The clause
with no home is the first one — **the owner's decisions are the only authority
in it**. Pillar 2 covers half of it, the ledger and the history and the
take-back, but the part where the owner actually exercises that authority is
not in the pillars at all: the rail, the control, the evidence for the
decision, and the list that tells the truth about what is waiting.

That is a gap in the strategy and not only in the writing, and it has a
consequence: **if the three pillars are the filter for wants, then every want
that improves what the owner experiences of deciding fails the filter** — the
trace in the decision, the list's way out, reversibility. W3 is the only one of
those three that reached the set, and it is the one the document calls "the
furthest from the owner's stated priority". It is not further. It is the other
half of the promise the identity sentence makes.

So: keep the three pillars, and add a section rather than a fourth pillar —
**the decision surface**, with its own gaps, because the pillars are what the
_environment_ must have and the decision surface is what the _owner_ touches.
The identity sentence already has one clause for each.

### 2. Keep the landscape table, and split the two jobs it is doing

The table is the answer to a question the repository could no longer answer,
and its licence column is the reason Q5 is right. Three corrections:

1. **One table, two jobs.** The comparator rows are _inspiration_ — read once,
   dated. The dependency rows W5 writes are _compliance_ — checked by W7's
   gate. The gate can only see the second kind, so a reader may take a
   comparator's licence as compliance evidence. Split them, and label which is
   which.
2. **"Where it lands here" names item numbers, and the number space churns.**
   WI-016 became WI-020, and two sessions own numbers now. Point at the
   _subject_ — the mechanism, the document section — and keep the item numbers
   with a date.
3. The re-read rule is right as written. With the gate covering the dependency
   half automatically, the hand-read half only needs re-reading when a source
   changes behaviour.

### 3. Six of the seven wants are right, and the set is thin about the owner

Every want in the set is a repair to something the environment got wrong about
itself: the audit trail, the authorship rules, the history, the resume, the
licences, the product record, the gate. That is a coherent set, and the
document's framing — the gap in each pillar — produces exactly this.

What the set does not have is a want about the surface the owner touches,
apart from W4, which was folded into WI-007. Two gaps are missing from the
set, and both were found in the code rather than in opinion. They are wants in
the document's own format. **Neither takes a number** — they are for the
session that owns the number space to take up.

**The decision shows what the agent did, where the decision is taken.**

**Owner:** Cog. **Files:** `apps/web`, `apps/server`.

Under Forge the decisions live on the Map's Needs-you rail and the execution
trace is the Work room's companion, so the owner would leave the landing
screen to learn what the agent did in order to decide on the landing screen.
The evidence travels with the decision: what was run, what was produced, what
it cost, for that item, in the drawer the control opens.

**Acceptance:** when the owner is asked to approve, accept or answer, the
control opens the execution context for that item; it reads the events the
contracts already publish (`tool.started`, `tool.completed`,
`artifact.created`, `execution.status`, and spend as an abstract counter); a
test proves the context is shown for an approval, and that it is scoped to
that item and not to the whole execution; the owner can decide without leaving
the landing screen.

**The waiting list learns that an item no longer needs the owner.**

**Owner:** Cog, with Wren for the published entry. **Files:** `packages/contracts`,
`apps/server`, `CONTRACTS.md`.

This is the want behind the owner's second question (C-16, C-22): one event,
`approval.decided`, published by the decide route.

**Acceptance:** the published vocabulary carries the event; the decide route
publishes it; the waiting list drops the row on that event without waiting for
the safety-net refetch; a test proves the row leaves on the event, and that
"nothing is waiting on me" is true immediately after the last decision; the
migration note says what a client written before the change does.

### The deferral of W3, and the reason recorded for it

The record says W3 is deferred because it is "the furthest from the owner's
stated priority". That is the weaker of the two arguments. The honest reason
is capacity, and if it is capacity then W3 is the first thing to un-defer when
capacity frees, because it completes the clause the identity leads with:
shipping the decision control before the take-back means the product grants
irreversible authority first, and with one owner there is nobody else to
absorb a bad action.

**One thing this review does not touch.** The rule that the band ships only
the counts the audit trail can defend is now in WI-020's acceptance criteria
and in the live dispatch, and this review agrees with it rather than restating
it.

### The CI conclusion, measured at the pushed commit

**The question was: what did the two runs on GitHub conclude?** Chief cannot
read the Actions tab from this machine — the repository is private, the
Actions API answers `404` without a token, and this shell cannot obtain one.
**But the conclusion is a property of the tree, and the tree can be measured.**

**The structural fact that makes the measurement exact, and its one
exception.** When the measurement was made,
`git diff d03e225..HEAD -- apps packages scripts deploy .github` was **empty**.
It is not empty now, and both differences are accounted for:

- `apps/server/src/__tests__/waiting-list.test.ts` — Probe's two pin tests
  (`ab574d8`, `ad58c96`), which add assertions and change no behaviour.
- `.github/workflows/ci.yml` — WI-023's four new steps, which **have not run
  in CI**. That is the whole point of the item, and it is why the item is with
  Probe and why nothing has been pushed.

**With the test file excluded, the only difference is the workflow file: the
product's own code at the pushed commit is the product's own code now.** The
only other things that moved since are documents — the contract, this ledger,
the work items, the strategy document — and `package.json` losing one line
(WI-043). **So the gates measured at HEAD are the gates CI ran at `d03e225`.**

**Every CI job, measured here:**

| Job and step                               | The command                                                           | What it said                                                                                                                                                                                           | Exit |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| build · Typecheck                          | `npm run typecheck`                                                   | typecheck 0 across every workspace                                                                                                                                                                     | 0    |
| build · Tests                              | `npm run test`                                                        | server 21/21 files, 213 passed · web 6/6, 52 · worker 5/5, 31 · agent-adapters 2/2, 16 · contracts 4/4, 28 — **340 tests, 0 failures** (338 at the pushed commit; the two since are Probe's pin tests) | 0    |
| build · Build                              | `npm run build`                                                       | all five packages built; the container image build ran the same script                                                                                                                                 | 0    |
| build · Formatting                         | `npm run format:check`                                                | "All matched files use Prettier code style!" — measured **at `d03e225` itself**, in a detached worktree at that commit                                                                                 | 0    |
| build · Smoke                              | `npx tsx scripts/smoke.ts`                                            | "All smoke checks passed."                                                                                                                                                                             | 0    |
| build · The compiled server boots          | `npx tsx scripts/verify-build.ts`                                     | "The compiled server boots and serves requests."                                                                                                                                                       | 0    |
| build · The bundle stays within its budget | `npx tsx scripts/verify-bundle-size.ts`                               | "Every chunk is within 300 kB and the first paint carries no page chunk."                                                                                                                              | 0    |
| build · End-to-end browser tests           | `npm run test:e2e`                                                    | **25 passed**                                                                                                                                                                                          | 0    |
| audit                                      | `npm audit --audit-level=high`                                        | "found 0 vulnerabilities"                                                                                                                                                                              | 0    |
| docker                                     | `compose up --build` → health → web root → `verify-stack` → `down -v` | every step green, including **"the worker produced an agent reply"**                                                                                                                                   | 0    |
| workflow-lint                              | `rhysd/actionlint:1.7.12`                                             | no findings                                                                                                                                                                                            | 0    |

**What is still unread, said plainly.** GitHub's own log. The Actions tab holds
the platform's verdict, and reading it is the owner's or Probe's to do. What
the measurement establishes is that **there was nothing for that verdict to
fail on**: every gate the pipeline runs, green, at the exact commit the
pipeline was pointed at. The difference that remains is the runner's platform
— this machine is Windows with Docker Desktop, CI is `ubuntu-latest` — and that
is a real difference, which is why the tab is still worth reading and this is
not a substitute for it.

**What it changes.** WI-023's blocker — "wait until the job is known to work"
— is discharged, and the item's own acceptance criteria asked for the whole
container sequence to be run locally against real Docker before it is pushed.
That was done: the workflow's own text, four new steps, the 401 first and the
green after. The full output is in `.factory/work/WI-023.md` under "What the
runs concluded, and the local proof", and the change is with Probe
(`task_6437af4f18f0`), because the lead wrote it.

### The ruling: a contract item is verified against the tree it stands in

**Probe asked it twice** — once in WI-022's verification and once in
WI-026's — and both times the same question: is a contract item judged against
the commit it landed in, or against the tree it stands in?

**Against the tree it stands in.** The contract's job is to be a promise the
product keeps now. A promise that was true for one commit and stale for the
next is a promise that is wrong, and a contract item's criterion is that the
published entry agrees with the code that is running. The commit it landed in
is history; it is recorded, and the entry that names the implementing commit
is what tells a reader which history it is.

**What it does not change.** An entry that declares the code does not implement
it yet is **not** a defect — Probe said so for WI-026, in both of the states
that entry has been in, and that is right: the entry is honest in front of the
code and honest behind it. The ruling only says which tree the agreement is
measured on.

**What it did change.** WI-026's criterion 5 was worded for one moment in the
code's history — "the entry says the code does not implement it yet" — and in
the tree the item stands in, the code does implement it and the entry says so.
It is re-worded to ask the standing question (does the entry tell the truth
about the code as it stands?) **without weakening the requirement**: a
published member the code never produces is still a defect, and a member the
code does produce must not be published as one it does not.

**This covers WI-022, WI-026, WI-028 and WI-030**, so the next contract item
does not have to ask it again.

### Two acceptances, and what the product can now do

**WI-022 — accepted.** Probe's verification (`task_38cb5ecee977`, batch
`batch_247e598a4edf`) found **all seven criteria met** and **no defect in the
published entry**; the one defect was in the item's own "Changed" line, which
understated what `a44a374` published — that commit published WI-022's
`WaitingReason` **and** WI-026's `WaitingKind` in one file, and the item said
"nothing else". Corrected. **What the product can now do: the waiting list can
carry a reason the code actually emits, and the order the panel shows is the
order the contract publishes — and the two are pinned against each other.**
Probe closed the gap the item left open: the published urgency order had no
test at all, and the old urgency test ranked a band that did not exist, so a
missing band compared as `undefined` and the assertion passed while proving
nothing. Probe's `ab574d8` reads the four bands out of the published
paragraph, builds one item of each, and compares the order the route returns
with the order the contract publishes — so neither can move alone.

**WI-026 — accepted.** Probe's verification (`task_25bf9ea7e2cb`, batch
`batch_9cf9cefcff10`) found **all seven criteria met** and **no defect in the
published entry**; the one defect was in the item's own criterion, which cited
`waiting.ts:17` — the _reason_ type — instead of `waiting.ts:8`, where the
kind is declared. Corrected. **What the product can now do: a turn whose
outcome could not be confirmed can reach the owner as a thing to check, and
where it sorts is the order the contract publishes.** Probe's `ad58c96` reads
the published "over reasons, not kinds" paragraph, writes a turn the way the
worker writes it, and compares where the route puts it with what the contract
claims — so neither can move alone.

**What both left for the contract's owner.** Three citations that moved when
WI-027's code landed, and they went out as **WI-022's successor** to Wren
(`task_682c73ccbc73`) rather than as an item of their own — one file, one
live item, and WI-026's dropped citation of the kind's declaration rides in
the same edit. Chief checked every line it names against HEAD: `waiting.ts:8`,
`:17`, `:95` and `:140-144`.

### The want with no number, and who holds the number space

**The MCP surface's id-addressed tools are not scoped to a workspace.** It is
recorded above, in full, with the code's own rule and the four call sites that
check it against the seven that do not. **It still has no number, and that is
deliberate.** The number space has one owner, and the record is clear about
who: `4034d45` ("Take the six numbers for the seven wants") took WI-038 and
says so — "WI-030, WI-031 and WI-032 are this session's; WI-024 through WI-029
are the other Chief session's" — and the same session took WI-039 through
WI-043 in `96b87f8`. **This session has taken no number since WI-031**, so it
took none here either. The tiebreak is the one already agreed: whoever numbers
writes it in the item's "Numbered" line **and** in this dispatch table, and the
table says who holds the work.

**The number owner is asked for one thing:** number the MCP scoping finding and
put it in the queue. It is a defect against a rule the code already states —
`apps/server/src/modules/mcp/server.ts:96` says _"An agent may only act inside
a workspace it has been granted"_ — and **WI-017 is adding a tool to this same
surface**, so a rule that lands after it has to be applied to it as well.

## The owner's two answers, and the corrections this tick made — 2026-10-21 11:15

**The owner's answers, asked at 11:05 and answered at 11:05.**

1. **Should an unconfirmed turn keep dispatching work? No.** An unconfirmed
   turn stops and waits for the owner. This is the question WI-008 could not
   close on, and it is now closed: `planAndDispatch`
   (`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
   `message.status`, so a turn whose outcome could not be confirmed still
   routes work onward. **The owner's answer says it must not.** That is a
   behaviour change, and it belongs to the item that owns the waiting list's
   behaviour — WI-008, whose file is the other Chief session's live claim.
2. **Forge's place in the queue: the three in flight first.** WI-017 (a
   template for all six kinds), WI-020 (the product reporting on itself) and
   WI-031 (the route that closes a turn) stay ahead of WI-024. Reordering
   dispatched work strands it, and the factory has been burned by that twice
   today; WI-031 also closes WI-027's last criterion, which is the one the
   owner's push waited on.

**WI-034's scope was wrong, and the correction is right.** The item said the
contract "does not say what 'authored by an agent' means" and that the audit
outcome set "is published nowhere". **Both were false**: WI-030 published both
at 08:34, before the wants were triaged, and as written the item would have
published the same thing twice. The other Chief session found it, the
reasoning is in `docs/strategy.md` (`e1f50ae`), and WI-034 is rewritten to
the narrowed scope. **The lead who wrote the item did not notice that the
item was wrong; a verifier reading the contract instead of the brief did.**
That is the whole argument for the implementer not being the verifier, in one
incident.

**One thing the narrowing leaves open, and the item now says so.** The
published outcome set is `success | failure | unknown`, and the unknown
outcome **is** written to the trail today. The narrowed vocabulary is
`queued | succeeded | failed`. **A vocabulary that dropped `unknown` would
make the unknown outcome unrepresentable in the audit trail**, so WI-034's
criteria now require the vocabulary to express every outcome the product can
produce, or the migration note to say where an unknown outcome is recorded
instead. That is a judgement for the item's owner, and it is not a detail.

**W8 is funded, and numbered.** The same review produced a want: the licence
gate reads the **dependency set**, so it cannot see source vendored into this
repository's own tree — the owner's own hard case. **WI-044.** It is numbered
so it is not lost, and it is **not dispatched**: the inventory it needs is
worth writing against a settled repository, and the repository's visibility
is the owner's open decision.

**The number space, as it now stands.** This session: WI-030 through WI-038,
and WI-044. The other Chief session: WI-024 through WI-029, and WI-039
through WI-043. Continuous, collision-free, and recorded here because two
claims in one tree have already collided twice.

## WI-032 — the security leg of the pipeline, and what it took to fix it

**Two defects, and only one of them was in the repository.**

1. **The token could not read the workflow run it belonged to.** The job
   declared `security-events`, `packages` and `contents`, and a job-level
   `permissions:` block replaces the workflow-level one wholesale — so
   `actions: read`, which GitHub's own documentation for the action requires,
   was never granted. The step failed with _"Resource not accessible by
   integration"_ before it analysed anything.
2. **And then the licence.** With the permission fixed, the failure moved
   one step along: _"Code scanning is not enabled for this repository."_
   Enabling it is `code_security` in the repository's settings, and GitHub
   answers that with _"When billing is bundled Code Security can only be
   enabled if Advanced Security is enabled"_. **Code scanning is free on a
   public repository; on a private one it needs GitHub Advanced Security,
   which a personal account does not have.** The repository is private — the
   owner's choice — so the scan cannot upload and cannot be made to.

**The scan itself works.** The `analyze` step's `upload` input takes `never`,
which produces the SARIF without sending it to code scanning, and the
results are published with the run as an artifact instead. The run fails if
the scan produced none. **When the repository is public, where the owner said
it is going, the upload is one word away.**

**And the branch is a gated branch in both senses now.** `codeql.yml` ran on
`main` only, while `ci.yml` ran on every branch — so a branch was checked by
half the pipeline, and the half that was missing is the one that catches a
bad pattern in a change nobody read carefully. It runs on every branch now.

**It is proved, not asserted.** The branch `wi/032-codeql-permissions` was
pushed and **both runs are green on it**: CI success on all four jobs, and
CodeQL success on the analyze step
(`39508958420`). The fix is merged into `main` as `061b6cd`. **The branch's
own draft of this ledger section was superseded rather than merged** — it was
written before the licence was known, and the record above is the corrected
one.

## The push — 2026-10-21 11:30

**`main` is on the remote, at `3479c31`.** The owner was asked, with the
evidence in the question, and said yes: 43 commits, 39 files, fast-forward,
nothing rewritten, visibility unchanged at private, nothing published
publicly.

**The evidence the question carried.** The pipeline had run on the committed
tree `061b6cd` and **both legs were green** — CI success on all four jobs,
including the docker stack that starts the server, the worker and the client,
and CodeQL success on the analyze step. The only commits after that tree were
documents, so the result was the result for what was pushed.

**What rode along.** The other Chief session's work was on `main` when the
push was made, and went with it: WI-027's unknown turn on the waiting list,
WI-031's published route for closing one, Probe's verification and acceptance
of WI-022 and WI-026, the `license: MIT` claim removed from the manifest,
WI-032's security leg, and this session's six numbered items.

**One commit is ahead of the remote, and it is this record.** The tree that
was pushed is the tree that was verified; adding a record of the push makes
it a different tree, and the owner's word named **a** push, not a licence to
push whatever comes next. `main` waits for the owner's word, and the next
word carries this paragraph.

**What the pipeline did next is the factory's own evidence, not this
session's word.** From now on the repository's state is read from its runs.

### The CI conclusion, read from the platform

**The question this session could not answer from this machine has an answer,
and it is the platform's own.** The other Chief session read the Actions tab
and recorded it in `0507f4f`: the pipeline ran on the committed tree `061b6cd`
and **both legs were green — CI success on all four jobs, including the docker
stack that starts the server, the worker and the client, and CodeQL success on
the analyze step.** This session cannot read that tab — private repository,
Actions API `404` without a token, none obtainable here — so this is the peer
session's record, and it is recorded here as such.

**And the tested tree carries all four of this session's new steps.**

```
$ git show 061b6cd:.github/workflows/ci.yml | grep 'name: The\|name: Create\|name: Restart'
  - name: The account path cannot get into a deployment that has an owner
  - name: Create the owner token
  - name: Restart the stack with the token in it
  - name: The token path gets in where the account path could not
```

**So the owner-token step did not only work locally against real Docker — it
ran on GitHub's own ubuntu runner, and the docker job was green with it.**
That is the platform confirming what this session measured, and it closes the
gap this session could not close last tick.

**The pushed tree is covered by that run, and this session checked the one
thing the run could not cover.** Between the tested tree `061b6cd` and the
pushed tree `3479c31` only documents moved:

```
$ git diff --stat 061b6cd..3479c31
 .factory/INTAKE.md      |  89 ++++++++++++++++++++++++++++++++++++++++
 .factory/work/WI-034.md | 106 +++++++++++++++++++++++++++-----------------
 .factory/work/WI-044.md |  79 ++++++++++++++++++++++++++++++++++++++
 CONTRACTS.md            |   7 +++-
```

The code is byte-identical to the tree CI ran. The one gate a document can
turn is `format:check`, and CI's glob covers `**/*.md`, so this session
measured that gate on the pushed tree itself, in a detached worktree at
`3479c31`:

```
$ prettier --ignore-path .prettierignore --check "G:/code/_ci-probe-3479c31/**/*.{ts,tsx,js,json,md,css}"
Checking formatting...
All matched files use Prettier code style!
```

**So the tree on the remote satisfies every gate the green run checked, and the
green run was that tree's code.**

### `main` is on the remote, and this session's push record is stale

**The owner gave the word, and the other session asked with the evidence in
the question**: 43 commits, 39 files, fast-forward, nothing rewritten,
visibility unchanged at private, nothing published publicly. `main` is at
`3479c31`.

**This session's ledger said the opposite, and is corrected here.** It said:
"the owner's word was spent on the 08:56:40 push; local commits stay local
until the owner says otherwise." **The owner said otherwise, to the other
session, and the push was made.** What survives is not a rule but a fact:
**the push chain is not closed and cannot be closed by the lead. It is a
permission the owner gives each time, with the evidence in the question.**

**This session's work went out with it.** `fabf710` — the CI owner-token step,
and WI-022's and WI-026's acceptances — and `0c0dfcd` — the CI conclusion, the
contract-verification ruling and the two acceptances — are both in
`origin/main`:

```
$ git merge-base --is-ancestor fabf710 origin/main   →  0
```

**And the local tree now carries code that no run has seen.** Three commits are
ahead of the remote and one of them is not a document: `414996c` touches 14
files — `apps/server/src/modules/executions/service.ts` (+124),
`apps/web/src/components/WaitingList.tsx` (+67), `ChatMessageList.tsx`,
`apps/web/src/lib/types.ts`, `packages/contracts/src/conversation.ts` — which
is WI-031's implementation. **"The repository's state is read from its runs" is
right, and it means the state that has a run is `3479c31`. The local tree is
ahead of it and has seen none.**

### A dispatch that failed with `BUSY`, and what it cost

**Three request ids were dispatched by the other Chief session and are not in
the table. They are in it now**, because the table is the map, and a request id
that is not in it is one somebody might reuse.

| Request id                          | To    | Task                | State                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wi-024-forge-adoption-2`           | Cog   | `task_2963d3be0f41` | **cancelled** at 09:55 — a second dispatch of WI-024 under a new id. **The live dispatch on WI-024 is unchanged: `wi-024-forge-adoption`, `task_5a09991ca5a1`, still queued.** It is not re-dispatched from here: it is the other session's item, and a re-dispatch needs a new id and a new title anyway |
| `peer-group-pointer-2026-10-21`     | Probe | `task_4867c6237747` | **cancelled** — the other session asking Probe to carry a message to the group                                                                                                                                                                                                                            |
| `peer-correction-wi-024-2026-10-21` | Probe | `task_4dc3ca58d70a` | **failed: `BUSY`** — created 08:35:05, refused at 10:20:55 because Probe was busy                                                                                                                                                                                                                         |

**This is the first hard cost of the one-verifier bottleneck, and it is a
different cost from delay.** Until now the queue's cost was that acceptance
waits. **This is that a dispatch to a busy verifier is not delivered at all.**
The correction died in the gap: nothing ran, the work is still owed, and the
request id is spent — a re-dispatch needs a new id and a new title, and the
ledger has to carry the id or the next actor will not know the work was never
picked up.

**What it cost, and what it did not.** The correction was the other session
retracting a message of its own — "do not act on this". **Neither message
reached Probe** (the first was cancelled, the second failed), and the group has
had no new messages in the window, so nothing reached Probe by another road
either. **And no Probe task in the queue is about WI-024** — they are WI-007,
WI-027, WI-021, WI-030, WI-028, WI-023 — so nothing Probe is waiting to do
can have been pointed the wrong way. The correction is still lost, and it is
the other session's to re-send if it still matters.

### Three verifications died in eleven minutes, and the rule that comes out of it

**Three of Probe's verifications failed with `BUSY` in eleven minutes**, and
this ledger still called them "queued" until this session read the task
records:

| Task                | Item                  | Started  | Ended    | Error  |
| ------------------- | --------------------- | -------- | -------- | ------ |
| `task_2e431d7647e5` | WI-007's verification | 10:09:48 | 10:10:17 | `BUSY` |
| `task_6a9a1179734c` | WI-027's verification | 10:19:30 | 10:19:58 | `BUSY` |
| `task_479859728e18` | WI-021's verification | 10:19:58 | 10:20:27 | `BUSY` |

**A task's status is not the evidence of a verification, and a failure does
not mean the work was not done.** WI-007's task failed, and yet Probe's
session read the item, wrote and committed the end-to-end pin `d343300`, and
ran the suite — the work happened under a task record that says it failed.
WI-030's task was cancelled at 09:51:26, and the other Chief session recorded
in `0d5c98c` that WI-030's verification is running in Probe's own session with
a finding in hand.

**So what is owed, and what is not.**

- **WI-007: owed nothing.** The work is evidenced, and re-dispatching it would
  be a second worker on one item — the failure this factory has spent a day
  cleaning up. It waits for Probe's report.
- **WI-030: owed nothing.** The other session's record says the verification is
  running, with a finding in hand. It is also not accepted until that report
  is in: a correction landing in the file while the verifier is reading it is
  something the verifier has to account for, not something that closes the
  item.
- **WI-021 and WI-027: owed a verification, and they had none.** Their tasks
  failed in eleven minutes and produced no report, and no re-dispatch existed
  anywhere. **Both are re-dispatched as successors now** — new request ids and
  new titles, because a spent id cannot be reused with a changed body — and
  both briefs carry the same guard: _if this item is already being verified in
  another session, say so and stop._ The guard is the tiebreak said out loud:
  one verifier, one item, one verification, and the item's report is what
  closes it.
- **The peer correction: owed, and lost.** Nothing reached Probe by any road.

**The rule this earns, and it is a rule about evidence.** A dispatch to a busy
verifier is not delivered, and a failed task is not evidence that the work was
not done. **So the verifier's report is the evidence of what was verified, and
the task id is only the ledger's record of a handover** — a handover whose
record failed may still have happened, and a handover whose record says
"queued" may have died. **The ledger has to carry both: the id, and what the
work actually did.** The table said "queued" for three tasks that had already
died; that is the cost of trusting the task record alone, and it is why this
session reads the task records rather than the table.

**A caution about clock times in this ledger.** The task records carry epoch
milliseconds; the times in this table are those epochs read on **this
machine's** clock, and this machine's clock is behind the harness's (it read
10:43 AEST when the harness read 11:31). The written clock labels elsewhere in
this ledger do not agree with the machine clock either — the other session's
section labelled "10:57 AEST" describes the state nine minutes after 09:48 —
**so a reader reconciling times should use the task records' epochs, not the
labels.**

### The smoke gate is flaky on Windows, and it is not the tree

**Probe found this in its own working session while verifying WI-007, and it
is not in its report yet.** It is recorded here so that it is not lost, and
because it qualifies a measurement this session published last tick.

**The mechanism, checked against the source by Chief:**

- `scripts/smoke.ts:667-669` holds a `BEGIN EXCLUSIVE` lock on the database
  "so the process stays alive long enough to be read from the outside", and
  spawns the reset process at `:671-680`.
- The reset waits on that lock with the server's own `busy_timeout = 5000`
  (`apps/server/src/db/client.ts:29`), then writes at
  `apps/server/src/modules/auth/service.ts:181-184` **with no handling of the
  failure** — so it dies with a raw `SqliteError: database is locked` and
  exits 1.
- The script reads the reset's command line at `scripts/smoke.ts:688` and
  asserts it at `:694-697`. On Linux that read is `/proc`, and it is instant.
  **On Windows it costs 6.5–8 seconds** — a `powershell.exe` and a
  `Get-CimInstance` per poll — and the reset's 5-second busy timeout expires
  first.
- The script's own comment at `:701-702` says it: "The lock is released the
  moment the command line has been read: the reset is waiting on it, **and its
  busy timeout is not long**."

**What that means for the gates.** The gate is **flaky on Windows under load,
and not flaky on Linux.** Probe's repro held the lock for 20 seconds and the
reset died at t=8.11s with `SqliteError: database is locked`, exit 1.
**This session ran the same gate twice and it passed both times** — the second
time while Probe's end-to-end suite was loading the machine — which is what a
flaky gate looks like, not a broken one. **It does not change the CI
conclusion: CI runs on `ubuntu-latest`, where the race does not exist, and that
run was green.** It changes what a red smoke on this machine means: **a
Windows timing artefact, not the tree breaking.** Any future claim that the
tree is green, measured here, should say that smoke was _sampled_, and sampled
on Windows.

**Two defects, and their homes.**

- **The product's:** `--reset-password` dies with a raw stack trace instead of
  a clear message, and does not retry.
  `apps/server/src/modules/auth/service.ts` is Cog's.
- **The gate's:** the smoke script's Windows path races the reset's busy
  timeout. `scripts/smoke.ts` is Probe's.

**Nothing is dispatched from here.** Probe is mid-verification on WI-007 and
said itself that the right move is to report it to Chief; it will come in that
report, and **one report, one item** is the rule. When it lands it is
dispatched from there.

### The number space took WI-044, and the MCP scoping finding still has none

**The number space's holder took WI-044**, for **W8** — the licence check that
covers this repository's _own_ sources, which is the other session's finding
from the same review that corrected WI-034's scope. WI-044 is numbered, owned
by Chief, **deferred, and deliberately not dispatched**: it is funded as a
numbered item that is not yet a task.

**So the MCP workspace-scoping finding is still without a number.** It is
recorded in full above, and it is the same defect it was an hour ago:
`apps/server/src/modules/mcp/server.ts:96` says an agent may only act inside a
workspace it has been granted, the guard is called in the four tools that take
a `workspaceId` and never in the seven that take a bare id, and **WI-017 is
adding a tool to that same surface.**

**What the owner is asked for is the number, and nothing else.** The item's
title, its criteria, its owner (Cog, with the contract half for Wren) and its
evidence are already written down.

### The tree is red on one count, and the count is the contract's

**Measured by Chief on the local tip, twice, and the result is the same both
times:**

```
FAIL  src/__tests__/published-shapes.test.ts > the two published shapes >
      publishes the counts of routes and audit entries the code has
AssertionError: expected 35 to be 34
Test Files  1 failed | 21 passed (22)
     Tests  1 failed | 215 passed (216)
```

**What it is.** WI-030 published the measures route's counts at 08:34 — of the
34 mutating routes, 20 write an audit entry at the route level. WI-031 added
`POST /api/executions/:id/resolve` an hour later, a mutating route that audits
in its own handler, and the published numbers did not follow. **The contract
went stale quietly, and the only thing that noticed was a test reading the
contract against the code.** That is what `published-shapes.test.ts` is for,
and the other Chief session's record of it (`1d2c7ff`) is the first time it
has caught something on the real platform rather than in a local run.

**It is Wren's, and it is already dispatched**: `wi-031-refresh-published-counts-2026-10-21`,
task `task_03f8f1042155`. The contract needs 34 to 35 and 20 to 21, its prose
"thirty-four" to "thirty-five", and its "twelve" stays twelve. `CONTRACTS.md`
is Wren's file and the lead does not write it — a correction queued behind
Wren's other contract work cannot collide with it, which a hand-edit from this
session could.

**One thing in that finding is Probe's and was left where it belongs.** The
test's own comment says "twelve of the thirty-four mutating routes write no
audit entry at all" — a stale number in a file Wren does not own. It is named
in the brief to Wren and left there.

**A second red that was not a red: the suite that failed once and passed
twice.** In one full server run, `src/__tests__/verifyStack.test.ts` was
reported as a **failed suite** — no tests in it reported at all — alongside the
one real failure. Chief ran it alone: **12 passed**, 30.6 s. Chief then ran
the full suite twice more: **21 passed of 22 files, 215 passed of 216 tests**,
the published-shapes failure the only one. So it is a **flake, not a defect**,
and it is in Probe's file.

**What Chief will not claim is why it flaked.** The honest hypothesis is
**load**: the machine is running several agents' gates at once — Probe's
end-to-end suite, this session's smoke gate, the other session's runs — and
both suites that flaked are timing-sensitive (one starts servers and waits,
one spawns processes and polls command lines). **That is a hypothesis, and it
is labelled as one.** What is measured is the fact: one failure in three full
runs, zero when run alone. **The factory's own concurrency is what makes the
gates lie**, and that is a capacity fact of the same family as one verifier
carrying the whole queue.

**The red is in the contract, and the red is the test working.** The push waits
for the tree to be green, and the tree is red until the published contract
catches up with the code.

## The pipeline caught the contract going stale — 2026-10-21 11:50

**`main` is not pushed, and the reason is the pipeline's verdict rather than
this session's opinion.** The tree at the tip carries WI-031's implementation
(`414996c`) — the route that lets the owner close a turn they were told to
check — and the verification run on it is **red**:

    FAIL  src/__tests__/published-shapes.test.ts > the two published shapes >
           publishes the counts of routes and audit entries the code has
    AssertionError: expected 35 to be 34

**What went stale, and why.** WI-030 published the measures route's counts at
08:34: _of the 34 mutating routes, 20 write an audit entry at the route
level_. WI-031 added `POST /api/executions/:id/resolve` an hour later — a
mutating route that audits in its own handler — and the published numbers
did not follow. **The contract went stale quietly, and the only thing that
noticed was a test reading the contract against the code.** That is what
`published-shapes.test.ts` is for, and it is the first time it has caught
something on the real platform rather than in a local run.

**Measured, with the test's own method: 35 mutating routes, 21 of them
auditing at the route level, and 12 writing none** once the two that write
from the service layer are set aside. So the contract needs 34 → 35 and
20 → 21, and its prose "thirty-four" → "thirty-five", while its "twelve"
stays twelve.

**Dispatched to Wren** — `wi-031-refresh-published-counts-2026-10-21`,
task `task_03f8f1042155`. **`CONTRACTS.md` is Wren's file and the lead does
not write it**: Wren's lane is serialised, so a correction queued behind
Wren's other contract work cannot collide with it, which a hand-edit from
this session could. The brief tells Wren to **measure the tree rather than
trust the numbers in the brief**, because WI-020 is in flight against the
same section and the counts are a statement about the code as it stands.

**One thing that is Probe's, not Wren's.** The test's own comment says
_"twelve of the thirty-four mutating routes write no audit entry at all"_ —
a stale number in a file Wren does not own. It is named in the brief and left
where it belongs.

**And the order is the order.** The push waits for the tree to be green, and
the tree is red until the published contract catches up with the code.
