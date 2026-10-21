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

| Request id                                                 | Item                                                                    | To     | Task                | State, 2026-10-21 12:15, and this session's 10:03 +11:00 +12:15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| `wi-022-publish-waiting-reasons`                           | WI-022 — the published waiting list's reasons                           | Wren   | `task_ed4c3132afe9` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry was cancelled at 07:29 and **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `wi-010-verify-forge-rewrite`                              | WI-010 — the direction, verified                                        | Probe  | `task_4cc3a3b1160f` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry `task_5666d5ca0dc2` is **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `wi-024-forge-adoption`                                    | WI-024 — the panel takes Forge                                          | Cog    | `task_5354f76acca3` | **cancelled** at 07:49:25 — **and it has a successor**: Chief's retry under the same id made a fresh task, `task_5a09991ca5a1` (batch `batch_72271e402bc9`), queued — **that is the live dispatch on WI-024**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-025-direction-adr`                                     | WI-025 — the direction answer in ADR 0007                               | Wren   | `task_ce64c47ef3d9` | **cancelled** at 07:49:25 — **Chief implemented it** (`0d4ec09`); Probe's verdict is in and it is **not verified**, and the record pass is with Wren as `wi-025-adr-record-pass-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `wi-026-waiting-kind`                                      | WI-026 — the waiting list's kind grows by one                           | Wren   | `task_fbb0e0528036` | **cancelled** at 07:29 — **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-027-unknown-turn`                                      | WI-027 — an unknown turn reaches the waiting list                       | Cog    | `task_9425c9b2a237` | **cancelled** at 07:49:25 — the retry `task_18f3c6c43c9d` **ran 08:34–08:51 and landed `c9bb0bc`**; the item is now in verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-028-memory-read-privacy`                               | WI-028 — an agent's own memory is private to it                         | Cog    | `task_99c5c5eeb7aa` | **cancelled** at 07:49:25 — the code landed in `622812c`; the contract half was dispatched at 07:59 as `task_146247be56d5` (queued)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wi-029-exposure-race`                                     | WI-029 — the exposure test does not race the reset                      | Probe  | `task_085e132ddaa1` | **cancelled** at 07:49:25 — the race is green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-030-publish-two-shapes`                                | WI-030 — publish the template record and the measures route             | Wren   | `task_f31d629a27b8` | **done** at 08:34:37 — the two entries landed in `e682224` (`CONTRACTS.md:434`, `:935`); **Probe's verification is dispatched** as `wi-030-verify-published-shapes-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-005-ci-review-2`                                       | WI-005 — the two CI changes, re-reviewed                                | Probe  | `task_94125a893054` | **done** at 08:29:18 — its findings are being implemented in the tree now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-017-resource-templates`                                | WI-017 — a template tells an agent what a good resource looks like      | Cog    | `task_d9352ee63330` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_0256a298ca60` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-017-template-record-successor-2026-10-21` / `task_4b5a7d412c11` (**done** — the implementation landed at `8b1fd01`, 12:41)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-020-measures-route`                                    | WI-020 — the product reports on itself                                  | Cog    | `task_6c20e85110f9` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_d4813ecd34ee` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-020-measures-successor-2026-10-21` / `task_7fca497d2514` (queued)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-022-verify-contract`                                   | WI-022 — verify the published reasons                                   | Probe  | `task_8e6fe1c54bfb` | **cancelled** at 08:33 — re-dispatched under `wi-022-verify-contract-r2` as `task_38cb5ecee977`, **done** at 10:37 — **all seven criteria met; WI-022 is accepted**, the item's own "Changed" line corrected, and the citation refresh dispatched as a successor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-026-verify-contract`                                   | WI-026 — verify the published kind                                      | Probe  | `task_3f565465dba3` | **cancelled** at 08:33 — re-dispatched under `wi-026-verify-contract-r2` as `task_25bf9ea7e2cb`, **done** at 10:52 — **all seven criteria met; WI-026 is accepted**, the criterion's citation corrected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-025-verify-adr`                                        | WI-025 — verify the direction answer in ADR 0007                        | Probe  | `task_2b5c9020bf00` | **done** at 09:48 — **not verified**: three defects (a pointer, a figure the ADR should not carry, and the count of travelling rules). The record pass is with Wren; the re-verification is owed after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-012-verify-fixed-tree-2026-10-21`                      | WI-012 — the memory guard, the fixed tree verified                      | Probe  | `task_d9cfcc0b665f` | **done** at 09:45 — **all eight criteria met; WI-012 is accepted**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-010-return-d1-d5-2026-10-21`                           | WI-010 — the direction document, returned for repair                    | Vision | `task_900cda1c2202` | **cancelled** at 10:40 by Chief, before it started, so that one finding could be added — re-dispatched as `wi-010-return-d1-d6-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-010-return-d1-d6-2026-10-21`                           | WI-010 — the same work, D1 to D6                                        | Vision | `task_9107d7d623d6` | **done** — D1 to D6 repaired and committed at `e560165`; the verification is owed, and it is upstream of WI-024's build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-008-close-reply-classification-2026-10-21`             | WI-008 — the classification of `closeReply`                             | Cog    | `task_1404e5875644` | **done** — the classification is in the table and criterion 2 is met                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-031-contract-2026-10-21`                               | WI-031 — the contract half, the route that closes a turn                | Wren   | `task_8ef054ed68d0` | **done** at 12:36 — the route published at `363428e` (11:05). **The implementation landed 27 minutes later** (`414996c`, 11:32), so the entry's status note was true when it was written and **false when the code landed**. That is WI-065's drift with a second instance, and it is attached to WI-031, where it blocks acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-031-implementation-2026-10-21`                         | WI-031 — the implementation, the same route                             | Cog    | `task_a22eeda307db` | **done** at 11:32 — `414996c`, plus `3dd490b` at 12:13 for the published shape of the resolve route. **The pin test is Probe's** and is not written yet: Probe reports that grepping every test file for `/executions/`, `execution.outcome.resolved` and "It ran" returns production files only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-007-verify-fixed-tree-2026-10-21`                      | WI-007 — the fixed tree, verified                                       | Probe  | `task_2e431d7647e5` | **failed: `BUSY`** at 10:10:17 — **but the work is evidenced**: Probe's own session read the item, wrote and committed the end-to-end pin `d343300` ("Hold the note about a decision to the item it is about"), and ran the suite. **Not re-dispatched** — a second dispatch would be a second worker on one item. The item is carried by the report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-007-migration-note-2026-10-21`                         | WI-007 — the migration note's missing sentence                          | Wren   | `task_e6fe9555ca74` | **queued** — one sentence of `CONTRACTS.md`, and the last thing between WI-007 and acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-027-verify-fixed-tree-2026-10-21`                      | WI-027 — the turn on the waiting list, verified                         | Probe  | `task_6a9a1179734c` | **failed: `BUSY`** at 10:19:58, and it produced **no verification at all**. **Spent** — a re-dispatch needs a new id and a new title, and it has one: `wi-027-verify-fixed-tree-successor-2026-10-21`, `task_874e6fb66b9b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-021-verify-fixed-tree-2026-10-21`                      | WI-021 — the refusal, verified                                          | Probe  | `task_479859728e18` | **failed: `BUSY`** at 10:20:27, and it produced **no verification at all**. **Spent** — the successor is `wi-021-verify-fixed-tree-successor-2026-10-21`, `task_d817d075a0ce`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-017-template-record-successor-2026-10-21`              | WI-017 — the template record, built against the published shape         | Cog    | `task_4b5a7d412c11` | **done** — **the live dispatch on WI-017**; it merges the two cancelled briefs and adds the Chief's rulings. **The implementation landed at `8b1fd01` (12:41)** — six files, +371/−6 — and **WI-017 is accepted** at 17:10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-020-measures-successor-2026-10-21`                     | WI-020 — the two measures, built against the published route            | Cog    | `task_7fca497d2514` | **cancelled** at 10:03 +11:00 by Chief — still queued, so nothing was lost; its brief was merged into the third dispatch, which carries the band ruling. **The live dispatch on WI-020 is `wi-020-measures-route-r3-2026-10-21`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-025-adr-record-pass-2026-10-21`                        | WI-025 — the ADR's record pass, with Wren                               | Wren   | `task_c3e1f0b6d558` | **queued** — a pointer, a figure, and one thing not to touch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-030-verify-published-shapes-2026-10-21`                | WI-030 — the two published shapes, verified                             | Probe  | `task_dc2aeef86acb` | **cancelled** at 09:51:26 — **but the work is running**: the other Chief session recorded, in `0d5c98c`, that Probe's verification of WI-030 is running in its own session with a finding in hand (the template record's migration note tells a client to add `resource.template.list` to an agent's toolGrants, and the server rejects that today). **Not re-dispatched** — the two published shapes were corrected at `2dcac9c` while the verification was running, and a correction landing in the file while the verifier is reading it is something the verifier has to account for, not something that closes the item                                                                                                                                                                                                                                                                                                                                     |
| `wi-036-licence-record-2026-10-21`                         | WI-036 — the dependency licences, read from the repositories            | Wren   | `task_2c5159aab413` | **queued** — **the live dispatch on WI-036**; the record that WI-038's gate compares against                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-037-product-record-forge-2026-10-21`                   | WI-037 — the product record says Desk (B); the owner chose Forge        | Wren   | `task_4947c89ca7fe` | **queued** — **the live dispatch on WI-037**; the overdue truthfulness fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-020-measures-route-r3-2026-10-21`                      | WI-020 — the two measures, with the band ruling                         | Cog    | `task_86010eeeb561` | **queued** — **the live dispatch on WI-020**; it carries the band ruling — the band ships only the counts it can defend, and no ratio, until WI-033 and WI-034 land                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wi-039-evidence-contract-2026-10-21`                      | WI-039 — publish the evidence a decision is taken against               | Wren   | `task_dd95fe7df207` | **queued** — **the live dispatch on WI-039**; the contract half of the gap Vision found in the decision control, and it goes before WI-040                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-041-readme-licence-2026-10-21`                         | WI-041 — the README tells the truth about the licence                   | Wren   | `task_644f23312ebc` | **queued** — **the live dispatch on WI-041**; the owner's "the licence is deliberately undecided" answer, in one sentence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-043-manifest-licence-verify-2026-10-21`                | WI-043 — the manifest no longer claims a licence                        | Probe  | `task_9b1b44c1025f` | **done** — **not verified.** Chief's one-line removal is exactly right and every gate is green, but the repository does not yet say the truth about its licence: the root `LICENSE` file **is** MIT (tracked since the initial commit `d2f4ec6`) and `CONTRIBUTING.md:238-239` claims contributions are MIT-licensed. **Neither file is covered by any item** — WI-041's is the README, WI-043's is the manifest. The finding opens **WI-068**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-023-owner-token-step-verify-2026-10-21`                | WI-023 — verify the owner-token step in the container job               | Probe  | `task_6437af4f18f0` | **done** — **all seven criteria met, no defect, nothing owed to Cog.** Probe's matrix: the right token green, a wrong token fails with the 401, no token fails with the 401, and the 401 line cannot be faked because the assert throws. **The acceptance is the other Chief session's**, because this session wrote the implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-022-citation-refresh-successor-2026-10-21`             | WI-022 — refresh the waiting list's code citations                      | Wren   | `task_682c73ccbc73` | **done** — `CONTRACTS.md` only: two stale citations moved (`waiting.ts:85`→`:95`, `:106-110`→`:140-144`) and the kind's declaration (`:8`) added to WI-026's entry. Branch `wi/022-citation-refresh` (`bd705c2`, `57c1248`), pushed by Wren, and **merged into `main` at `fb236dc`**. **The verification is dispatched** as `wi-022-citation-refresh-verify-2026-10-21`, `task_018a6018b18f`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-024-forge-adoption-2`                                  | WI-024 — the Forge adoption, a second dispatch under a new id           | Cog    | `task_2963d3be0f41` | **cancelled** at 09:55 — **the live dispatch on WI-024 is unchanged: `wi-024-forge-adoption`, `task_5a09991ca5a1`, still queued.** Dispatched by the other Chief session; it is not re-dispatched from here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `peer-group-pointer-2026-10-21`                            | A peer request for Probe to carry a message to the group                | Probe  | `task_4867c6237747` | **cancelled** — it never reached Probe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `peer-correction-wi-024-2026-10-21`                        | The correction retracting that peer request                             | Probe  | `task_4dc3ca58d70a` | **failed: `BUSY`** — created 08:35:05, refused at 10:20:55 because Probe was busy. **A dispatch to a busy verifier is not delivered at all**: the work is still owed, the id is spent, and the correction has to be re-sent with a new id and a new title                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-027-verify-fixed-tree-successor-2026-10-21`            | WI-027 — the unknown turn on the waiting list, verified again           | Probe  | `task_874e6fb66b9b` | **done** at 15:27 — **WI-027 is verified: all nine acceptance criteria met**, on `f7ac848` (product code identical on `51c92f8`). Gate output pasted: typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), **test:e2e 27 passed**. **One defect against another item** — WI-031's entry still says the code does not implement the route — and four observations. **The acceptance is Chief's** — **the live dispatch on WI-027**, a successor: the original failed with `BUSY` at 10:19:58 and produced no verification. The brief asks Probe to stop and say so if the item is already being verified in another session                                                                                                                                                                                                                                                                               |
| `wi-021-verify-fixed-tree-successor-2026-10-21`            | WI-021 — the refusal, verified again                                    | Probe  | `task_d817d075a0ce` | **done** at 15:27 — **WI-021 is verified: all five criteria hold**, on `51c92f8` (the product code is byte-identical on the current head). Probe's own gates: typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), and `npm run smoke` 0 in 9.5 s; the two pinned suites **39 passed (39)**. **WI-021 is accepted.** Findings: the item's own file describes a behaviour the code cannot exhibit, a stale citation, and **a question for Chief — a delegation naming nobody is refused in a way a client cannot read**, which is now **WI-069**                                                                                                                                                                                                                                                                                                                                                          |
| `wi-031-refresh-published-counts-2026-10-21`               | WI-031 — refresh the published counts                                   | Wren   | `task_03f8f1042155` | **cancelled** — **the lead made the correction itself** (`50b908d`), because the collision that was the reason for routing it to Wren no longer held: nothing was writing `CONTRACTS.md` at the time. One item, one worker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `probe-verify-published-counts-2026-10-21-1215`            | WI-046 — verify the published counts, and fix the stale number          | Probe  | `task_27a529dbec89` | **cancelled** — the item number was wrong: WI-046 belongs to the strategy session's batch. The work was re-issued as WI-062                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |     |
| `probe-verify-published-counts-2026-10-21-1240`            | WI-062 — verify the published counts, and fix the stale number          | Probe  | `task_2c7c9f4fd696` | **done** — **WI-062 is verified: all six criteria hold**, and **WI-062 is accepted** by the session that wrote neither half. Probe re-implemented the test's own counting method: 35 mutating routes registered, 21 auditing in their own handler, 2 auditing from the service layer, 12 writing no audit entry, and the published table and the code's unaudited list are the same twelve. Gates: the published-shapes suite 3 passed, the server suite 219 passed, `prettier --check` 0, `npm run format:check` 0. **Three findings, and all three are routed**: four stale citations (dispatched to Wren), the template record (WI-065's line, live), and WI-031's stale status note (dispatched)                                                                                                                                                                                                                                                             |     |
| `probe-verify-wi-036-licence-record-2026-10-21-1248`       | WI-036 — verify the dependency licence record                           | Probe  | `task_3bb64dabf31a` | **done** — **WI-036 is verified: all five criteria hold**, and **WI-036 is accepted** by the session that wrote none of the three halves. Probe re-derived the numbers its own way: the lockfile has **500** package entries excluding the root (488 third-party + 6 `link: true` aliases + 6 workspace roots), the record covers **494** (488 third-party + 6 first-party), attribution is 375 + 16 + 97 = 488, and there are **11** distinct licences matching the approved set's 11 entries whose package counts sum to 488. **Three findings, all routed.** And the verdict caught **a defect in the lead's own WI-038 brief** — see the section below                                                                                                                                                                                                                                                                                                       |     |     |
| `probe-verify-wi-017-template-record-2026-10-21-1305`      | WI-017 — verify the template record, and write its missing test         | Probe  | `task_dbcc178374a7` | **done** — **WI-017 is verified: all seven criteria hold**, and **WI-017 is accepted** by the session that wrote none of the three halves — the implementation is Cog's (`8b1fd01`), the contract is Wren's (WI-030, `e682224`), the test is Probe's (`052f050` — 449 lines, 11 cases, all through the MCP surface an agent uses). **The product diff is empty**: the two drift-pins were proved to bite and then restored. **Three findings, all routed**: the template record's status paragraph is false (**WI-065**, live), the spec path answers an unpublished `internal_error` (named in the item, not dispatched), and the entry's tool table agrees with the code ✓                                                                                                                                                                                                                                                                                     |     |
| `wi-065-template-record-contract-status-2026-10-21-1330`   | WI-065 — the template record says what the code now does                | Wren   | `task_6274afe1abc1` | **queued** — **the live dispatch on WI-065**: the contract still publishes a status note about the template record that the code has outgrown, and every clause of it is now false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |     |
| `wi-067-mcp-workspace-scope-code-2026-10-21`               | WI-067 — the MCP surface's id-addressed tools, the code half            | Cog    | `task_6766b83a3f23` | **queued** — **DELIVERED at 14:32**, after the runtime's refusal had stood for about forty minutes. The reserved id was never registered, so it was not spent, and it was used as reserved. The brief is in `.factory/work/WI-067.md`. Worktree `G:\code\personal-os-worktrees\067-mcp-workspace-scope`, branch `wi/067-mcp-workspace-scope`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-067-mcp-workspace-scope-contract-2026-10-21`           | WI-067 — the MCP surface's tools are workspace-scoped, contract half    | Wren   | `task_acc8a5211855` | **queued** — **DELIVERED at 14:32**, the same reserved id, also never registered. The brief is in `.factory/work/WI-067.md`. It queues behind WI-065 on `CONTRACTS.md`; Wren's lane is serialised, so one file carries one live item. Worktree `G:\code\personal-os-worktrees\067-mcp-workspace-scope-contract`, branch `wi/067-mcp-workspace-scope-contract`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `probe-verify-wi-031-close-a-turn-2026-10-21-1340`         | WI-031 — verify the route that closes a turn, and write its pin         | Probe  | `task_b511f4062477` | **queued** — **the live dispatch on WI-031**: the implementation landed at 11:35 with **no verification ever sent**, and the item's own pin is Probe's to write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |     |
| `probe-verify-wi-041-readme-licence-2026-10-21-1340`       | WI-041 — verify the README tells the truth about the licence            | Probe  | `task_5b4e02d59413` | **queued** — **the live dispatch on WI-041**: the work landed at 12:51 and was merged at `5012df2` with **no verification ever sent**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| `probe-verify-wi-024-forge-adoption-2026-10-21-1340`       | WI-024 — verify the Forge adoption and its six briefs                   | Probe  | `task_d2fa4fb7e946` | **queued** — **the live dispatch on WI-024**: the six briefs landed at 12:15 with **no verification ever sent**, and brief 06's constellation test is Probe's to write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |     |
| `wi-066-message-shape-fourth-field-2026-10-21-1340`        | WI-066 — the message shape publishes the fourth field                   | Wren   | `task_0cfbcce20e92` | **queued** — **the live dispatch on WI-066**: the code carries a fourth optional `Message` field the contract does not publish, so WI-031's member-for-member criterion cannot hold until it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |     |
| `probe-verify-wi-037-product-record-forge-2026-10-21-1325` | WI-037 — verify the product record says Forge                           | Probe  | `task_207afe6818f8` | **done** — **WI-037 is verified: all four criteria hold, no defect, and Probe had nothing of its own to hand over.** **WI-037 is accepted** by the session that wrote none of it — the product record is Wren's (`0024f88`), the merge (`94d110f`) is the other Chief session's, the verification is Probe's. `PRODUCT.md:282-284` names **D — Forge** with the date and the recommendation of **B — Desk**, in the same sentence ADR 0007 carries; the old story ("recommended rather than decided") is measured gone from the file; the accent rule is named identically in both documents and its load-bearing amber clause is **identical word for word**. **And nothing else in the product record changed** — `0024f88` touches `PRODUCT.md` only, the whole diff sits inside §11, and `git log 0024f88..HEAD -- PRODUCT.md` is **empty**. Two observations are recorded in the item and **not dispatched**, because `PRODUCT.md` carries a live Wren task |     |     |
| `wi-042-product-record-closed-questions-2026-10-21-1325`   | WI-042 — the product record's closed questions say they are closed      | Wren   | `task_f1cf510356e8` | **queued** — **the live dispatch on WI-042**: its blocker was WI-037 being live on `PRODUCT.md`, and that has cleared                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| `wi-034-outcome-vocabulary-successor-2026-10-21-1325`      | WI-034 — publish the outcome vocabulary, and the migration              | Wren   | `task_55c33b744ef5` | **queued** — **the live dispatch on WI-034**: the item had **never been dispatched**, and WI-033 (W1) waits on it, because the contract leads the code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `wi-038-licence-gate-script-2026-10-21`                    | WI-038 — the borrow-rule gate's script                                  | Probe  | `task_63e621ad515f` | **CANCELLED at 16:22 — the brief contained a false statement about the record**, so it was replaced rather than let run: it said the six first-party workspaces carry `spdxId: "first-party (no licence yet)"`, and **they carry `spdxId: null`**, with that string being a family label in `agpl.familiesRead`. A gate written from it would have failed on six first-party packages. **Replaced by `wi-038-licence-gate-script-corrected-2026-10-21`, `task_445db8e16adc`, with the measured numbers**                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |
| `wi-038-licence-gate-script-corrected-2026-10-21`          | WI-038 — the borrow-rule gate's script, measured rather than remembered | Probe  | `task_445db8e16adc` | **queued** — **the replacement brief**, self-contained. The six first-party entries carry `spdxId: null` and a `firstParty` **object** carrying the workspace path; **the six lockfile paths with no record entry are the workspace roots**, and the `link: true` aliases are covered. The gate must skip by `firstParty.workspace` or the lockfile's `workspaces` globs, **not** by `link: true` and **not** by an `spdxId` string. **And it must not read the record's `summary`**, whose two numbers are wrong and are being corrected                                                                                                                                                                                                                                                                                                                                                                                                                        |     |
| `wi-036-record-numbers-and-evidence-2026-10-21`            | WI-036 — the record's own summary has two numbers that do not match     | Wren   | `task_678dfc957439` | **queued** — **the successor to WI-036's findings**, in `docs/**`, which is Wren's, so they were reported and not fixed. `summary.distinctLicences` reads 12 and counts the first-party bucket as a licence (there are 11); `summary.lockfilePackageEntries` reads 494, which is the number the record covers, while the lockfile has 500. Plus 17 entries whose quoted evidence is the copyright header, and `PRODUCT.md` §10's missing note. **`docs/strategy.md` is deliberately out of scope** — it is live in the other Chief session's item, and the JSON alone can make the prose true                                                                                                                                                                                                                                                                                                                                                                    |     |
| `wi-068-contributing-licence-2026-10-21`                   | WI-068 — the repository still grants MIT in a file no item covers       | Wren   | `task_a4d24aa2dc24` | **queued** — **DELIVERED at 14:35**. One sentence in `CONTRIBUTING.md:236-239`, which says contributions are MIT-licensed. Worktree `G:\code\personal-os-worktrees\068-contributing-licence`, branch `wi/068-contributing-licence`. **Chief's half — the `LICENSE` file and the `FACTORY.md` row that names it — is this session's**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |     |
| `wi-022-citation-refresh-verify-2026-10-21`                | WI-022 — the waiting list's refreshed citations, verified               | Probe  | `task_018a6018b18f` | **queued** — **the verification of WI-022's successor**, dispatched the moment the implementation landed. Five questions: the four citations point at the lines that carry the claims, the claims behind them are still true, **WI-026's criterion 6 now holds in the tree**, nothing else in the entry changed, and the gates pass. **The doubled sentence is a recorded decision and is not a defect**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |

| `wi-031-contract-status-correction-2026-10-21` | WI-031 — the entry says the code does not implement it yet, and it does | Wren | `task_be25e082ae5c` | **queued** — **the correction of WI-031's stale status note**, found by Probe while verifying WI-027. `CONTRACTS.md:197-204` says the route is absent; it has been there since `414996c`. **It queues behind WI-065 on `CONTRACTS.md`** — Wren's lane is serialised, so one file carries one live item. **WI-031's acceptance is blocked until it lands** |
| `wi-010-verify-repaired-document-2026-10-21` | WI-010 — the repaired direction document, verified | Probe | `task_2f3e137d63ee` | **queued** — the live dispatch on WI-010, under the request id and title the peer session reserved and could not dispatch; the work is the D1 to D6 repair at `e560165`, and Probe's earlier verification ran before it |
| `wi-007-verify-fixed-tree-successor-2026-10-21` | WI-007 — the fixed tree, verified again | Probe | `task_797badb7e918` | **queued** — the live dispatch on WI-007; the previous verification `task_2e431d7647e5` failed at 11:10:17 with an empty result and was never re-dispatched |
| `wi-025-verify-adr-record-pass-successor-2026-10-21` | WI-025 — the ADR after the record pass, verified again | Probe | `task_5cf2b97b54ce` | **queued** — the live dispatch on WI-025; Probe's earlier verification found three defects, Wren fixed them at 11:58, and the re-verification was never dispatched |
| `wi-069-refusal-names-nobody-code-2026-10-21` | WI-069 — a delegation that names nobody is refused unreadably | Cog | — | **NOT DISPATCHED — held on purpose.** The finding is Probe's, from WI-021's verification. **Two reasons, both said out loud:** the owner's line at 15:40 — _"when a slot frees, lean on verification"_ — and the contract half needs the owner's answer. **Numbered so it is not lost**, with the brief written out in full in `.factory/work/WI-069.md` |
| `wi-045-unconfirmed-turn-verify-2026-10-21` | WI-045 — an unconfirmed turn routes no further work, verified | Probe | `task_1df39fd407ea` | **queued** — **the verification of the owner's own answer**, dispatched the moment the implementation landed (`a4010bb`, merged into `main` at `66c86ad`). Six questions: the guard stops the routing, a confirmed turn is unaffected, **the stop is recorded where the unknown-outcome machinery is recorded**, the waiting list is unchanged, a test proves both halves, and what the contract publishes. **Chief's word is on the audit entry's target, and the doubt is named in the brief rather than hidden** |
| `wi-074-stack-test-cleanup-budget-2026-10-21` | WI-074 — the stack test's cleanup can outrun its own budget | Probe | `task_289ede939140` | **queued** — **a red on `main` with every assertion green**: `verifyStack.test.ts` failed to complete at `:133:34` (`fs.rmSync`) after 49 990 ms, while 230 tests passed. **The teardown, not the proofs.** It did not reproduce in two runs, and the machine was under load. **The check is named: a suite that passed every assertion must never be reported as failed.** And **CI runs on ubuntu, where the budget can also be exceeded** — that is why this is an item and not a shrug |
| `wi-062-measures-citation-refresh-2026-10-21` | WI-062 — four citations in the measures section point at lines that moved | Wren | `task_169f434c05d9` | **queued** — **a citation refresh, not a change of content**: every claim in the measures section is true and only the line numbers are stale. Found by Probe while verifying WI-062. It queues behind WI-065 in Wren's serial lane, and **it must not touch the template record or WI-031's entry** — one file, one live item |

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
| C-23 | Nothing checks that a published contract's **implementation-status note** still matches the code. The contract leads the code, and when the code lands the note has to follow — and it does not, because nothing asks it to. **Two instances so far:** the template record says _"the code does not implement this yet"_ after WI-017 landed (`363428e` at 11:05 → `414996c` at 11:32 is the second instance, the resolve route's entry), and both went false within half an hour of being written | `CONTRACTS.md:578` and `CONTRACTS.md:197-204`, both found by reading the contract against the code rather than by any gate — **the published counts were caught by the pipeline, but a stale _status_ is not a count, and no test can fail on it.** WI-065 carries the first correction; WI-031 carries the second, attached to the item it blocks. The check would be a `scripts/verify-*.ts`, which is Probe's by the ownership table, in the shape of WI-038's borrow-rule gate |

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

### The correction to the section above — 2026-10-21 12:55, machine clock

**The test that section proposed has been run, and the answer is that the queue
moved. The gap was three minutes, and it was one task's turnaround.**

**The assignment timeline, read from the runtime's own records** — every task
that started, with its start and end:

| Started  | Ended    | Item                                          |
| -------- | -------- | --------------------------------------------- |
| 09:51:17 | 10:18:14 | Adversarial review of `docs/strategy.md`      |
| 10:12:59 | 10:20:41 | The owner's answers to the two questions      |
| 10:20:41 | 10:37:22 | WI-022 — verify the published waiting reasons |
| 10:37:22 | 10:45:32 | WI-026 — verify the published waiting kind    |
| 10:45:32 | 10:54:04 | WI-008 — return                               |
| 10:54:04 | 11:09:48 | WI-031 — the contract half                    |
| 11:02:14 | 11:35:05 | WI-031 — the implementation                   |
| 11:09:48 | 11:10:17 | WI-007 — verify (failed `BUSY`)               |
| 11:10:17 | 11:19:30 | WI-007 — the migration note                   |
| 11:19:30 | 11:19:58 | WI-027 — verify (failed `BUSY`)               |
| 11:19:58 | 11:20:27 | WI-021 — verify (failed `BUSY`)               |
| 11:20:27 | 11:20:55 | a correction (failed `BUSY`)                  |
| 11:20:55 | 11:31:50 | WI-010 — return                               |
| 11:35:05 | 12:15:08 | **WI-024 — the Forge adoption**               |
| 11:52:28 | 11:58:04 | WI-025 — the ADR's record pass                |
| 11:58:04 | 12:24:24 | **WI-036 — the dependency licences**          |
| 12:15:08 | 12:42:14 | **WI-017 — the template record**              |
| 12:24:24 | 12:42:59 | **WI-037 — the product record says Forge**    |
| 12:42:14 | running  | WI-020 — the two measures                     |
| 12:42:59 | 12:51:36 | WI-041 — the README tells the truth           |
| 12:51:36 | running  | WI-043 — verify the manifest                  |

**Neither of the two readings above is what happened.** The guard does not hold
the assignment — the runtime has assigned continuously since 09:51:17. And no
session is wedged: **Cog ran WI-024 for forty minutes and WI-017 for
twenty-seven, back to back**, and the third and fourth slots have gone to
Cog and Wren in turn. **Nothing needs replacing, and nothing needs to be
cancelled or re-dispatched to make the floor look busy.**

**The specific claims in that section, answered.** **WI-022's verification
finished at 10:37:22** — it was not waiting. **WI-025's record pass finished at
11:58:04** — not waiting. **WI-036 finished at 12:24:24 and WI-037 at
12:42:59** — both done, and neither was re-dispatched. **The idle-since table
is a snapshot of 09:48, and it was a snapshot of a boundary**: the last task
had finished at 09:48 and the next had not yet started.

**What the other Chief session asked for, and what was posted instead.** It
asked for a line in the factory group carrying its reading. **Its reading is
three hours stale**, and posting it would have put _"the factory is idle with
a full queue"_ and _"nothing is running"_ into the group's record as fact.
**A corrected line was posted instead** — request
`factory-assignment-timeline-2026-10-21-1255`, task `task_e5080dacbdbd`,
queued — carrying the timeline, saying that no session is wedged, and naming
the two items in the accept queue. **The record in this file is the same
correction, next to the section it corrects.**

**Three things that have moved since that section, so a reader is not misled
by it.** **The Actions outcome is readable from this machine** — the
credential is in git's helper, and `main` at `f8d808e` is **green on both
legs: CI success on all four jobs, and CodeQL success**. **The owner gave a
new push word at 12:27, and `main` was pushed at 12:28** — the word that was
spent at 08:56 was replaced, not the push. **The two questions in
`ask_840a807bf1ad7291f4d92f44` were answered earlier** — the unconfirmed turn
at 11:05, and Forge's place in the queue at 08:54 — so neither needs asking
again.

**What is true, and is not a stall.** **The accept queue is the bottleneck,
and that has been true all along.** Six items sat at `verify` and every one of
them waits on Probe — one verifier, and acceptance is the gate that turns work
into product. **The lean stands: the next free slot goes to Probe.** WI-062's
and WI-036's verifications are queued for it. **WI-036's implementation was
not re-dispatched** — what went out was its **first verification**, which had
never been sent, so the item could never have been accepted however green its
branch became.

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

### W8 is funded, and it has been for three hours

**The group asked whether W8 is funded. It is, and it has been since it was
numbered: W8 is WI-044** — "The licence check that covers this repository's own
sources". Owner Chief, Verifier Probe, numbered by the number space's holder
in `581dcdf`, and its state line says what the ask was asking for:
**"It is funded, as a numbered item that is not dispatched"** — the deferral
is recorded as a decision and not as a queue position, and the reasoning is in
the item.

**The ask was behind the record, not ahead of it.** The licence gate reads the
dependency set, so it cannot see source vendored into this repository's own
tree, which is the owner's own hard case; the check is narrower than the rule
the owner meant, and WI-044 says so and says what is being done about it. It
waits for WI-036's licence record, which has landed.

### WI-067 — the MCP scoping finding is numbered, and the dispatch could not be delivered

**The finding that sat without a number for three hours has one.** The number
space publishes its own rule — _"the next number above all of them is WI-063,
and it belongs to whoever takes it next"_ (written when the top was WI-062) —
and the top has since moved to WI-066, so **the next number above all of them
is WI-067, and this session took it.** The tiebreak is said out loud: the next
free number goes to whoever takes it, the item file is the name, and the table
says who holds the work. **If another session has taken WI-067 in the
meantime, this item is renumbered and the table is corrected** — the same way
WI-063 became WI-065 when two sessions reached for it at once.

**What it is, with the code measured at HEAD rather than remembered:**

| Tool                 | Where  | What it takes           | Guarded?                                  |
| -------------------- | ------ | ----------------------- | ----------------------------------------- |
| `agent.list`         | `:243` | a `workspaceId`         | **yes** — `assertWorkspace(id)` at `:252` |
| `task.create`        | `:263` | a `workspaceId`         | **yes** — at `:279`                       |
| `resource.create`    | `:352` | a `workspaceId`         | **yes** — at `:368`                       |
| `automation.create`  | `:485` | a `workspaceId`         | **yes** — at `:511`                       |
| `conversation.read`  | `:188` | a bare `conversationId` | **no**                                    |
| `conversation.post`  | `:206` | a bare `conversationId` | **no**                                    |
| `task.update`        | `:299` | a bare `taskId`         | **no**                                    |
| `task.get`           | `:334` | a bare `taskId`         | **no**                                    |
| `resource.get`       | `:405` | a bare `resourceId`     | **no**                                    |
| `resource.update`    | `:428` | a bare `resourceId`     | **no**                                    |
| `automation.inspect` | `:529` | a bare `automationId`   | **no**                                    |

`assertWorkspace` is defined at `apps/server/src/modules/mcp/server.ts:103`
and called in exactly four places — the four that take a `workspaceId`. The
capability layer cannot check it either, because it is not told who is asking:
`apps/server/src/modules/capabilities/service.ts:197-199` is
`resourceGet(id) → resources.get(id)`, no actor and no workspace, so **the id
is the whole address.** **So an agent granted one workspace can read, update
and inspect a conversation, a task, a resource or an automation in another
workspace if it knows the id.** The code's own words at `:96` say it may not:
_"An agent may only act inside a workspace it has been granted."_

**The surface grew while the hole was unnumbered, and the item now says so.**
WI-017's template tool landed in the same file at `8b1fd01`, and
`resource.template.list` (`:467`) and the template lookup inside
`resource.create` (`:383`) are in WI-067's criteria — not inherited, but
answered.

**The two halves, and the order.** The code half is with Cog and the contract
half with Wren, and **the code half goes first**: the rule is already written
in the code's own words, so this is the code keeping a rule it states, not the
code building against an unpublished shape. **WI-012's guard landed at
`622812c` and WI-028's contract half followed at `f62fca7` to make the
published entries agree** — the same order, for the same reason, and both were
accepted that way. The contract half is queued behind WI-065 on
`CONTRACTS.md`, and the tiebreak is said out loud: **one file, one live item,
held by Wren's lane being serialised.**

**And the dispatch could not be delivered, so it is not a dispatch.** The
runtime refused the call four times over about ten minutes, with _"This Bot is
replying in multiple chats, so this tool call cannot be assigned safely.
Retry when the other replies finish."_ **A dispatch that cannot be delivered
is not a dispatch** — the rule the factory has been keeping, and it applies to
the lead as much as to anyone. So:

- **The briefs are written out in full in `.factory/work/WI-067.md`**, so that
  whoever delivers them needs nothing else.
- **The request ids are recorded in the dispatch table** — the code half
  `wi-067-mcp-workspace-scope-code-2026-10-21`, the contract half
  `wi-067-mcp-workspace-scope-contract-2026-10-21` — and marked **NOT
  DELIVERED**, with the reason.
- **The group is the other door.** A post in "Personal OS Factory" that names
  this item and asks for the two halves is the delivery, not a second
  dispatch, because the dispatch was never delivered.
- **The ids are reserved, not spent** — a refused call was never registered —
  but the runtime has been known to refuse a changed body under an id it
  remembers, so **the delivery may use a new id and a new title**. The rule
  stands either way.

**This is the third delivery failure in one day, and all three were `BUSY` or
"cannot be assigned".** Three verifications died at 10:09–10:20, a peer
correction was refused at 10:20:55, and now the lead's own dispatch channel
is refusing while the queue behind it grows. **The factory's constraint is
not the code and it is not the lead's judgement. It is delivery.**

**Update, 14:32 — the channel came back and the dispatch went.** Both reserved
ids were used as reserved (neither had been registered, so neither was spent):
`task_6766b83a3f23` for the code half to Cog, `task_acc8a5211855` for the
contract half to Wren. Two worktrees were made —
`067-mcp-workspace-scope` and `067-mcp-workspace-scope-contract` — one worker
in each. **The group was not posted for this item**, because a dispatch that
has been delivered must not also be posted. The refusal above is the record of
what happened at the time; the delivery above is the record of how it ended.

### WI-023 is verified, and the acceptance is not this session's

**Probe's review of Chief's own CI change is in, and it is a clean pass: all
seven criteria met, no defect, nothing owed to Cog.** Its matrix is worth
having on the record, because it is the difference between "the 401 line was
in the output" and "the 401 could not have come from anywhere else":

| The script's credential                      | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| the right token                              | **green** — `ok the owner token is accepted (got 200)`                        |
| a **wrong** token                            | **fails** — `Assertion failed: the owner token is accepted (got 401)`, exit 1 |
| no token, and the owner has another password | **fails** — `Assertion failed: the owner can sign in (got 401)`, exit 1       |

**And the 401 line cannot be faked.** The message interpolates the real status
(`scripts/verify-stack.ts:173`), and the assert helper **throws** (`:90`), so
the 401 line is the **last** thing the script printed — nothing after it could
have produced it.

**The gates Probe measured:** `actionlint` → exit 0 · typecheck → exit 0 ·
format:check → exit 0 · build → exit 0 · **the test suite → exit 0**: server
219 (22 files), web 52, worker 31, agent-adapters 16, contracts 28 ·
**the whole container sequence, locally, against real Docker** → the account
path green, the 401 where it must be, the token path green, the teardown
clean. **And the shared stack was left alone**: Probe's stack was
`-p personal-os-probe` on port 4398, and the other stack was still up
afterwards, untouched.

**And the acceptance is the other Chief session's.** The rule the factory has
been keeping: **the session that wrote an implementation does not accept it.**
This session wrote the four steps, so the acceptance goes the other way — the
same way WI-012's did, and the same way WI-022's and WI-026's went this way
round. **The item is closed on the evidence and open on the signature.**

### WI-038 — the borrow rule is wired, and the gate is named

**WI-036's record has landed, so WI-038's blocker is gone** — and the record
says what it was written for. Its `approvedSet` carries the note: _"This is
what WI-038's gate compares the lockfile against: a licence outside this set,
or a change inside it, fails the build."_ **The ground truth was built for the
gate**, with 494 entries each carrying the file its licence was read from, and
the 11 licences this project accepts.

**Chief's half is written and committed** — branch `wi/038-borrow-rule-gate`,
worktree `G:\code\personal-os-worktrees\038-borrow-rule-gate`, commit
`a9592a4`: the step in `.github/workflows/ci.yml` in the `Dependency audit`
job, immediately after the vulnerability audit, because it is the same concern
over the same dependency set and the same install; and the entry in the root
`package.json` beside the other `verify:` ones. `prettier --check` → exit 0,
`actionlint` → exit 0.

**The gate script is Probe's file, and it is not written.**
`scripts/verify-*.ts` is Probe's by the ownership table, and the three scripts
already there — `verify-build.ts`, `verify-bundle-size.ts`,
`verify-stack.ts` — are standing policy checks rather than tests of a change.
**The licence gate is one of those and is written in Verify.** So the
specification of it is in WI-038's file, in enough detail to be written
without asking anything:

- **What the record gives:** `packages` — 494 entries with `lockPath`,
  `name`, `version`, `spdxId` and `source.kind` saying which file each
  licence was read from — and `approvedSet.licences`, the 11 accepted, each
  with its reason.
- **The four comparisons:** the set (every declared licence must be in the
  approved set, and an SPDX expression passes only if **every** member is); the
  change (where the record's `source.kind` is `package-json-field` the two
  are directly comparable, and the failure names the dependency and the
  licence it changed **from and to**; for a licence _file_ or a _published
  identifier_ the comparison is the **version**, because a gate cannot re-read
  a licence file's meaning); the arrival and the departure (a package the
  record does not have, or one the lockfile no longer has); and **the
  first-party six, skipped on purpose** — the record carries the six
  workspaces as `spdxId: "first-party (no licence yet)"`, the owner said
  "private for now — no LICENSE yet", and **the gate is about what this
  repository borrows**.
- **Three exit codes:** 0 the lockfile and the record agree; 1 a licence
  problem; **2 the gate could not read its ground truth — a broken gate must
  never look like a clean one.**
- **`--record` and `--lockfile` options**, so a check can point the gate at a
  record with one licence deliberately changed and watch it fail. **Criterion
  4 is that proof, and it is why the options exist.**
- **What it prints:** the number of packages compared, how many licences were
  read from which kind of file, the approved set, and every failure with the
  dependency named. **Criterion 5 is a reader of the Actions tab seeing that.**

**The branch is not pushed until the script is in it.** A branch that is red
is a branch that waits a second round, and this one can be green.

**The script was dispatched at 14:32** — `wi-038-licence-gate-script-2026-10-21`,
`task_63e621ad515f`, Probe — with the whole specification above in the brief,
so that nothing had to be asked. Probe writes it in the WI-038 worktree, on
`wi/038-borrow-rule-gate`, next to Chief's wiring, and commits it there; **the
branch is pushed once the script is in it and the gate is green.** The
acceptance of WI-038 is **the other Chief session's**, because this session
wrote the wiring at `a9592a4` — the session that wrote an implementation does
not accept it, the same rule that holds WI-023.

### WI-067 — the question is answered, and the answer was this session's dispatch

**The other Chief session's record said WI-067 was "opened, numbered and
dispatched", and nothing on disk said so.** The two rows in this ledger read
**NOT DELIVERED** — this session's own record, written when the runtime refused
four times — **no task id for WI-067 appeared anywhere in the ledger**, and
WI-067's file carried no `Dispatched` line. **One of those two records was
wrong, and the difference was a second worker on a live file.**

**The question was asked in the group and went unanswered. The channel came
back at 14:32, and this session dispatched both halves.** The reserved ids had
never been registered, so they were not spent, and both were used as reserved:
`task_6766b83a3f23` (Cog, the code half) and `task_acc8a5211855` (Wren, the
contract half).

**So the other session's record was wrong, and the group's silence was
right.** It had said "dispatched" with no task id behind the word — a claim is
not a dispatch, exactly as a task's status is not the evidence of a
verification. **The item now has one dispatch, not two**, and the risk that
mattered — a second worker on `apps/server/src/modules/mcp/server.ts` — did
not materialise. The two worktrees are `067-mcp-workspace-scope` and
`067-mcp-workspace-scope-contract`, one worker in each.

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

## The other Chief session's tick, and what it asked for — 2026-10-21 11:50

**It asked for one thing: a line in the factory group.** Its own session
cannot post there — `post_group` refuses from a session that is inside a group
turn — and this session holds the group. **Posted**, request
`factory-status-2026-10-21-1150`, task `task_aa4b43bdd748`, and it points at
the repository rather than restating it, because a status post spends a slot
and the record is already written down.

**The line carries one correction, because the message that asked for it was
already stale.** The other session's note gave WI-024's live dispatch as
`task_2963d3be0f41` — which was **cancelled at 09:35** — and its own
correction, `peer-correction-wi-024-2026-10-21`, **failed with `BUSY`** at
11:20, so the correction never reached anyone. The live dispatch is
**`task_5a09991ca5a1`** (request id `wi-024-forge-adoption`), and the ledger's
dispatch table already said so. **The group line says it, because the fleet
was told the wrong id and the only correction that reached the fleet was
this one.**

**The judgement it asked for: which way the factory should lean when a slot
frees. The answer is verification first.** Six items sit at `verify` and every
one of them waits on Probe — one verifier, and acceptance is the gate that
turns work into product. **Unverified work is inventory, not product.** So:

- **The next free slot goes to Probe.** A new verification is dispatched before
  new implementation work.
- **The implementer keeps one slot busy**, so Probe always has a queue to
  work through. Two slots, four bots: the lane that finishes work is worth
  less than the lane that accepts it.
- **The structural answer is smaller items, not more implementers.** One
  verifier against a fourteen-deep implement queue is a capacity problem, and
  the honest reading of it is that items are too big for one verifier to
  accept quickly. WI-024 is the clearest example of an item big enough to
  hold the queue.

**And the owner's answer became work.** The other session's line said the
question about the unknown turn was with the owner. **It was answered at
11:05**: no — an unconfirmed turn stops and waits for the owner. That answer
closes WI-008's blocker and it names a path no item had claimed, so it is
**WI-045 — "An unconfirmed turn routes no further work"**, dispatched to Cog
as `task_d22e747375a9`. WI-008's own criteria stay met and stay verified; its
file says where the work went.

**Two numbers, and where they came from.** This session: WI-030 through
WI-038, WI-044 and WI-045. The other: WI-024 through WI-029, and WI-039
through WI-043. **Neither session edited the other's item files this tick** —
WI-007's and WI-008's are this session's claim, and the other session left
them alone for that reason.

## The last red is corrected, and the lead made the edit — 2026-10-21 12:15

**The three numbers moved, and the test that caught them passes.** The
measures entry now publishes **35** mutating routes and **21** that write an
audit entry at the route level, and its prose says "thirty-five". **The twelve
stays twelve**, and the table of routes that write no audit entry does not
change — the new route audits, so it is not in it. Measured with Probe's own
method before the edit: 35 routes, 21 auditing at the route level, and 12
writing none once `POST /api/approvals/:id/decide` and `PATCH /api/tasks/:id`
are set aside. After the edit: the published-shapes test is **3 of 3**, and
the whole server suite is **22 files, 216 tests, all passing**.

**The tiebreak, out loud: the lead made this edit by hand, and Wren's queued
task is cancelled.** The ledger routed it to Wren because `CONTRACTS.md` is
Wren's file and a hand-edit from this session could collide with Wren's other
contract work. **That reason was checked against the fleet before the edit,
and it no longer holds.** Wren's running task (WI-036) says in its own brief
that it touches `docs/**` only and must not open `CONTRACTS.md`; WI-037
touches one file, `PRODUCT.md`; and the only queued task that writes
`CONTRACTS.md` — WI-022's citation refresh — is behind a full slot. **Nothing
is writing the file.** So the correction is made now, the queued task is
cancelled — one item, one worker — and **ownership is honoured by
verification rather than by delay: the lead does not accept this work, Probe
does.** It is **WI-062**, dispatched to Probe as `task_2c7c9f4fd696`, and it
carries the stale comment in the test file with it.

**A second red that was not a red: the typecheck failures were another
session's in-flight edit.** A local `npm run typecheck` failed with four
errors in `apps/server/src/api/executions.ts` and
`apps/server/src/modules/executions/service.ts` — `workspaceId` missing from
a type, `resolutionSentence` called with two arguments. **Those errors are
not in the committed tree.** They came from the other session's _uncommitted_
work in the shared worktree, mid-refactor: it moves `workspaceId` out of the
request body and derives it from the execution record instead, and it had
half-applied that change. **The committed code at HEAD is self-consistent** —
`resolve` takes a `workspaceId`, `ExecutionResolution` does not publish one,
and the route sends it — and `git diff 414996c HEAD` on those two files is
empty. **Measured, not assumed.**

**The committed tree's typecheck is not asserted here.** This session's run
was contaminated by that in-flight edit, so the verdict belongs to the
pipeline: a branch is pushed at the tip and its run is the measurement.

**And one thing that is Probe's.** The test's own comment still says _"twelve
of the thirty-four mutating routes write no audit entry at all"_ — a stale
number in a file the lead does not own. It goes to Probe with the
verification, and the comment is corrected there.

**The push still waits for the owner's word.** The tree is green on the
count; the pipeline has not yet run on the tip; and the word that authorised
the last push was spent by that push.

## The push — 2026-10-21 12:28

**`main` is on the remote again, at `f8d808e`.** The owner was asked, with the
evidence in the question, and said yes: **20 commits, 35 files, +2400/−238,
fast-forward**, visibility unchanged at private, nothing rewritten.

**The evidence the question carried, measured two ways.** The pipeline had run
on `50b908d` — the commit that carries the correction — and **both legs were
green**: CI success on all four jobs (Build and test, Dependency audit, Lint
the workflows, Build and run the stack), and CodeQL success. The only commit
after that tree was WI-062's item file and two ledger rows, both documents.
**And this session measured the tree first-hand**: typecheck exit 0,
`format:check` exit 0, **343 tests passing across 39 files**, build exit 0.

**What rode along.** WI-031's resolve route — the owner's own conclusion about
a turn they were told to check, published and audited as
`execution.outcome.resolved` — WI-045's record, the published-counts
correction, the two flake fixes in the suites that spawn processes, the Forge
briefs, and this session's ledger entries.

**The branch the evidence was read from.** `verify/green-at-tip` was pushed on
the standing authorisation for branch pushes, and it is where the green run
was read from. **It is evidence, and it can be deleted** — nothing depends on
it, and `main` now carries the same tree.

**One item in the pushed tree is not accepted yet, and that is honest.**
**WI-062 is Probe's acceptance of the counts correction**, dispatched as
`task_2c7c9f4fd696` and queued: the lead implemented that correction, and the
lead does not accept its own work. **A push is not an acceptance.** The tree
is green and the pipeline is the evidence; the factory's own verifier has
still to say yes, and it will land as a later commit.

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was verified; adding a record of the push makes it a
different tree, and the owner's word named **a** push, not a licence to push
whatever comes next. `main` waits for the owner's word, and the next word
carries this paragraph.

## The pipeline is green on `main`, and this session's number collided — 2026-10-21 12:40

**The platform agrees with the local measurement.** The pipeline ran on
`f8d808e` — the tree that was pushed — and **both legs were green: CI success
on all four jobs (Build and test, Dependency audit, Lint the workflows, Build
and run the stack), and CodeQL success.** The repository's state is read from
its runs, and the run says what the local gates said.

**And this session took a number that was already taken.** The correction's
verification was opened as **WI-046** and committed (`f8d808e`), on the record
that the number space was settled: this session's numbers were WI-030 through
WI-038, WI-044 and WI-045, and the other Chief session's were WI-024 through
WI-029 and WI-039 through WI-043. **That record was stale.** The strategy
session has since opened **WI-046 through WI-061** — sixteen items, in one
batch, on the branch `wi/046-domains-interaction-model` — and its WI-046 is
_"The decisions are recorded, and the scope says so"_. **Two different items
held the number WI-046, and this session's one had already been pushed.**

**It is renumbered, and the correction is stated rather than overwritten.**
The item is now **WI-062**, the first number free above the strategy
session's batch: `.factory/work/WI-046.md` is `.factory/work/WI-062.md`, and
the file's own header says it was opened as WI-046 and renumbered. **The
earlier statement of the number space is left as it was written** — it was
true when it was written.

**The dispatch went with the number.** Probe's task `task_27a529dbec89`
carried WI-046 in its title and its brief pointed at a file that was about to
stop existing. **It was cancelled before it ran, and the work was re-issued
under a new request id** — `probe-verify-published-counts-2026-10-21-1240`,
task `task_2c7c9f4fd696` — with WI-062 in the title and the right path in the
brief. **A cancelled dispatch does not free its request id**, so the new id
was required, and the old id is spent.

**The number space as it now stands.** This session: WI-030 through WI-038,
WI-044, WI-045, WI-062. The other Chief session: WI-024 through WI-029 and
WI-039 through WI-043. The strategy session: WI-046 through WI-061. **The
next number above all of them is WI-063**, and it belongs to whoever takes it
next.

**Why this matters more than a number.** A duplicate item number is two
different pieces of work answering to one name, and the file is the name:
`.factory/work/WI-046.md` is a path, and **the strategy session's WI-046 and
this session's WI-046 would have collided on it** when either branch was
merged. **Cancelling the task was not enough** — the file on `main` had to
change, because `main` is what a merge lands on.

**And WI-036 is waiting for a lane it never got.** The licence record landed
on its own branch, `wi/036-licence-record`, pushed — and **its pipeline is
red**, for exactly the reason `main` was: the branch predates the correction,
so its `published-shapes` run says `expected 35 to be 34`. **The correction
is what unblocks it.** The branch needs the corrected `main` brought into it
before it can be proved green and merged, and **no verification of WI-036 was
ever dispatched**, so the item could never have been accepted.

## WI-036's branch was red for the same reason, and now it is green — 2026-10-21 12:48

**The correction unblocked it, and the reason is the same reason.** The
licence record had been written and pushed — `docs/dependency-licences.json`,
494 entries, each naming the file its licence was read from, and
`docs/strategy.md` carrying the note about when the reading was made and a
pointer to it — but **the branch's own pipeline was red** with `expected 35
to be 34`. **It was the stale published counts, on a branch that predated the
correction.** Nothing was wrong with the record; the branch was simply behind
a contract that had since been fixed.

**The corrected `main` was merged into the branch, not rebased onto it**, so
nothing on a pushed branch was rewritten: `3a82162`, "Bring the corrected main
into WI-036's branch". **The branch is green**: CI success on all four jobs,
and CodeQL success.

**And the verification that was never dispatched is now dispatched.** WI-036
has been sitting in `implement` with the work done and the branch pushed, and
**no verification had ever been sent**, so it could never have been accepted
however green its branch became. It is **WI-036's first verification**:
`probe-verify-wi-036-licence-record-2026-10-21-1248`, task `task_3bb64dabf31a`,
queued. The brief tells Probe to read the item's file **on the branch** — the
copy on `main` still says `implement` and the branch's copy says `verify`.

**One measurement the lead made, which Probe is asked to judge rather than
accept.** The lockfile has **500** entries excluding the root; the record has
**494**. The six that do not match by lock path are **this repository's own
workspaces** — `apps/server`, `apps/web`, `apps/worker`,
`packages/agent-adapters`, `packages/contracts`, `packages/ui` — recorded
under their names as `@personal-os/*`, with **no source file and no
permits or forbids**, because they are this repository's own code and carry
no licence yet. **That is the owner's answer of 2026-10-21, not an oversight**,
and the record says so in its `firstPartyNote`. **The question Probe has to
answer is whether it is a correct reading of _"every dependency in the
lockfile"_ or a gap** — and specifically whether WI-038's gate can tell the
six workspaces apart from dependencies when it compares the lockfile against
the record.

**The AGPL answer is about this set, and it is "no".** The record names the
copyleft that _is_ present — the MPL-2.0 packages — and answers the owner's
question against the dependencies that were actually read, with the evidence
attached to each.

## WI-017 landed, and the contract still says it does not exist — 2026-10-21 13:05

**WI-017's implementation landed at 12:42 and no verification of it was ever
dispatched**, so the item could not be accepted however good the code was. It
is now dispatched: `probe-verify-wi-017-template-record-2026-10-21-1305`, task
`task_dbcc178374a7`, queued.

**And two things about WI-017 are wrong, both found by reading the contract
and the item against the code.**

**One of the item's own acceptance criteria is not met by anything in the
repository.** WI-017 asks for _a test proves that a resource created from a
template validates, and that a template describing an invalid spec is
refused_. **There is no such test.** Every `*.test.ts` in the repository, the
end-to-end suite and the smoke script were searched: the only hits for
"template" are in `published-shapes.test.ts` — which is about the contract's
kind enum and its counts — and one incidental hit in the adapters' test. **Test
files are Probe's by the ownership table, so Cog could not have written it**,
which is why the criterion was never met and why the item could not close.
**The test goes with the verification**, because it is Probe's file and Probe's
criterion.

**And the contract publishes a status note about the template record that the
code has outgrown.** `CONTRACTS.md`, in `### The template record`:

> **The code does not implement this yet.** ... there is no template record in
> `packages/contracts`, the published tool names
> (`packages/contracts/src/mcp.ts:11-23`) do not include one, and the server
> has none. A client written against this entry must treat the tool as absent
> until WI-017 lands.

**Every clause of that paragraph is now false**, and it was checked clause by
clause: `resourceTemplateSchema` and `ResourceTemplate` are in
`packages/contracts/src/resource.ts:58-71`; `resource.template.list` is in
`mcpToolNames` at `packages/contracts/src/mcp.ts:21` — **inside the very range
the paragraph cites** — and in the grant list at `:45`; and the six templates
are in `apps/server/src/modules/resources/templates.ts`, one per kind. **The
last sentence is the one that costs a client something**: a client that obeyed
_"treat the tool as absent"_ would not call a tool that exists.

**This is the same class of defect as the stale counts the pipeline caught —
a published claim about the code that the code has outgrown — and it is worse,
because the counts mis-stated a number and this mis-states whether a tool
exists.** The contract leads the code, and leading means something in both
directions: when the code lands, the contract's statement about the code has to
follow, or the contract is publishing a falsehood about the product it
describes.

**It is WI-065, and it is Wren's.** The request id is
`wi-065-template-record-contract-status-2026-10-21-1330`, task
`task_6274afe1abc1`, queued. **`CONTRACTS.md` is Wren's file, and this is a
revision of a published entry rather than a mechanical correction of a number,
so the lead does not make this edit.** The correction needs the migration note
that the other kind does not: nothing is reclassified, but **the surface
grew**, and a client that validates an agent's `toolGrants` against a known
list will refuse a grant for a tool it has never heard of.

**WI-030 is not re-opened.** It is done and accepted (`e682224`, 08:34:37), and
re-opening an accepted item to change its meaning would muddy a record that
says what was checked and when. This is a different change, so it takes its
own number and its own owner.

**One question put to the verifier rather than answered by the lead.** The
published-shapes test watches two claims — the kind enum and the route counts
— because a contract that is wrong about the code is only caught if something
reads the contract against the code. **The implementation-status claim was
wrong and nothing noticed.** Probe is asked whether a check should watch it
too, and where it would live: the same test file already reads that section,
so it may be a small addition. **The recommendation is the verifier's to make
and the lead's to act on.**

## The loop contradicted the ownership table, and three items sat in `implement` — 2026-10-21 13:15

**`FACTORY.md` said two things that cannot both be true, and the second one
made an acceptance criterion unmeetable.**

- **The ownership table** (`:52`): `**/*.test.ts, **/*.test.tsx` → **Probe**.
- **The loop, step 3** (`:143`): _"Cog writes the test that would have caught
  the bug as part of the same change, and names Probe for the review."_

**Cog was told to write a test in a file it does not own.** That is how WI-017's
criterion — _a test proves that a resource created from a template validates,
and that a template describing an invalid spec is refused_ — came to be
unmet: **no test in the repository does either**, and the implementer was
instructed to write one in a file the ownership table gives to the verifier.

**The rest of the factory already says the other thing, and has for a while.**
`.factory/probe.md:26`: _"**Write the test that proves it.** If a claim in the
change is untested, write the test. Do not describe the missing test — write
it."_ And `.factory/work/WI-009.md:305`, in its own record: _"Probe owns every
test file, so the routing test is Probe's and the implementation is Cog's.
**That is the normal split for this factory: the owner implements, Probe
writes the test that would have caught the bug.** The test is written to
**fail** against today's implementation — if it passes, the test is wrong."_

**So the loop was the only document that disagreed.** It is now amended: Cog
**names the check the change needs** as an acceptance criterion, in the brief,
and **Probe writes the test**, in Verify — which is also the split that keeps
the implementer from authoring the check that accepts its own work.

**And the loop did not say who dispatches the verification, which is why
three items in a row sat in `implement` with the work done.** Nothing in the
runtime joins Implement to Verify: an implementation task that ends leaves its
item in `implement` until somebody sends it to Probe. **WI-036's licence
record, WI-017's template record, and the correction to the published counts
all sat there** — the work done, the branch green, and **no verification ever
dispatched**, so each was an item that could never have been accepted. **The
loop now says it plainly: Chief dispatches Verify the moment Implement lands,
and an item that has landed and is not verified is not in the factory — it is
inventory.** The queue of things waiting for acceptance is the factory's real
capacity, so the dispatch of the verification is part of finishing the
implementation, not an afterthought to it.

**This is the lead's own file** (`FACTORY.md, .factory/**` → Chief, `:61`),
and the correction follows the factory's recorded practice rather than the
lead's opinion — which is the test the lead's own rules ask for. **The
contradiction was found because WI-017's criterion could not be met, and it
would have been found again by the next item with a test in its criteria.**
`AGENTS.md` is left alone: it is the development contract for the code, it
points at `FACTORY.md` for who owns what (`:14`), and a developer working in
this repository writes their own tests.

## The factory was producing green branches and never landing them — 2026-10-21 13:30

**`main` had one merge in its whole history.** `git log --merges` returns a
single line: `061b6cd`, WI-032's security leg. Everything since has been
work done on a branch, pushed, proved green by the pipeline, and left there.
**Two of those branches were carrying finished wants.**

**`main` was publishing the opposite of the owner's decision.** WI-037's
implementation — the product record says **Forge**, with the date and the
recommendation that was made against — was on `wi/037-product-record-forge`,
green on its own tip (`c61e3e8`: CI success on all four jobs, CodeQL success),
and `PRODUCT.md` §11 on `main` still read _"the direction that would fix it
is Desk (B), it is recommended rather than decided, and the owner has one word
to say about it"_ — **eight hours after the owner said it.** The product record
is the document a new reader opens first.

**And `main` had no licence record**, so WI-038's gate — the borrow rule as a
check rather than a claim, which the owner funded at 08:54 — had nothing to
compare the lockfile against. Its ground truth was on
`wi/036-licence-record`, green on its own tip (`3a82162`: CI success on all
four jobs, CodeQL success).

**Both are merged now.** `94d110f` for WI-037, `c6e77d7` for WI-036. Both
merges were clean, and the merged tree was measured before anything was
claimed: **typecheck exit 0, `format:check` exit 0, 346 tests passing across
39 files.**

**Merging is not accepting, and the tiebreak is said out loud.** The
precedent is WI-032: a branch is proved green by the platform on its own tip,
and **the verification is dispatched separately and the acceptance waits for
it**. **A defect comes back as a commit, not as an undo.** Probe's
verifications of WI-036 and WI-037 are queued.

**Three items of the seven wants had never been dispatched at all**, and one
of them was blocking another:

| Item   | Want | What it was doing                                                                                                                       | Dispatched                 |
| ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| WI-034 | W2   | Publishing the outcome vocabulary and the migration WI-033 makes — **and WI-033 (W1) waits on it, because the contract leads the code** | `task_55c33b744ef5`, Wren  |
| WI-042 | —    | The product record's closed questions say they are closed; its blocker was WI-037 being live on `PRODUCT.md`                            | `task_f1cf510356e8`, Wren  |
| WI-037 | W6   | The verification of a merged want, never sent                                                                                           | `task_207afe6818f8`, Probe |

**WI-042's blocker cleared when WI-037 landed, and WI-037's verification is
reading `PRODUCT.md` at the same time WI-042 is writing it** — one reader and
one writer on a file is fine, and **if Probe's verdict sends WI-037 back for a
fix, the lead sequences that fix behind WI-042** rather than letting two
writers loose on one file. Said out loud, because a tiebreak made silently is
a rule broken silently.

**WI-034 goes onto Wren's lane behind WI-065**, and both are on
`CONTRACTS.md`. **One file carries one live item, and this is a single bot's
lane, so the two run one after the other and never at once** — which is the
rule's purpose, stopping two agents writing one file at the same time.

**What this session did not do.** It did not re-dispatch WI-036 or WI-037 —
their implementation dispatches are spent and their work is landed. It did not
cancel anything to make the floor look busy. It did not push `main`: the
merged tip is on `verify/green-at-tip`, and `main` waits for the owner's word.

## The accept queue, swept against the tree — 2026-10-21 13:45

**The lead audited every work item against the fleet's own records, and the
audit is what found the rest.** Every `.factory/work/WI-*.md` was read for its
state, and every task in the runtime's state file was read for what it
carried. **Three items had work landed and no verification ever dispatched:**
WI-024 (the Forge adoption), WI-031 (the route that closes a turn) and WI-041
(the README's licence). **All three verifications are now dispatched**, and
each carries the pin the implementer said was Probe's to write.

| Item   | Work landed                                 | Verification                                                          | Task                |
| ------ | ------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| WI-031 | `414996c`, the contract half `8ef054ed68d0` | **dispatched** — and its pin, which the item says is Probe's to write | `task_b511f4062477` |
| WI-041 | `64d38f4`, merged `5012df2`                 | **dispatched**                                                        | `task_5b4e02d59413` |
| WI-024 | `93ef99b`, `a5042aa`                        | **dispatched** — and brief 06's constellation test                    | `task_d2fa4fb7e946` |

**This is the audit the amended loop asks for.** Chief dispatches Verify the
moment Implement lands; three items had landed and nobody had. **The audit
that finds them is a cross-reference of the item files against the runtime's
task records**, and it is cheap.

**And a third green branch was never landed: WI-041's.** The README's licence
section said **MIT**, and the owner's answer of 2026-10-21 was that the
repository is private for now, there is no LICENSE file, and the licence is
**deliberately undecided**. It is merged now (`5012df2`), proved green on its
own tip first.

**WI-066 — the contract gap Cog found and named.** WI-031's implementation
added a **fourth** optional field to the `Message` shape —
`detail: z.string().optional()` at `packages/contracts/src/conversation.ts:90`,
the server's sentence — and the contract's `### Additive extensions` section
publishes **three** fields. **WI-031's own criterion — _the published shape
matches the code exactly, member for member_ — cannot hold until it does.**
Cog reported it rather than widening the contract itself: _"That gap is the
contract's, not mine; I am not inventing a second shape and moving on, I am
naming it."_ **It is WI-066, and it is Wren's** — `task_0cfbcce20e92`. **The
field is wanted**: WI-031's criterion _"the reason reaches the panel"_ needs
the sentence, so the fix is to publish it, not to remove it.

**The number space, again, and this session's part in it.** The strategy
session's branches claim **WI-063** and **WI-064** for a free-period-plan
item, and this session had taken WI-063 for the template record's status note.
**The item was renumbered to WI-065** — the first number free above that
range — and the dispatch went with it: `task_1ee3414e9bcc` was cancelled
before it ran and the work was re-issued as
`wi-065-template-record-contract-status-2026-10-21-1330`, task
`task_6274afe1abc1`. **WI-066 is the next one up, and it is this session's.**

**`FACTORY.md` already said all of this, and this session broke it twice.**
`:284`: _"the number space has one owner… A session with a gap to fill records
it in `.factory/INTAKE.md` as a want… and the session that owns the numbers
creates the file… If the session that owns the numbers is not running, the
other session **says so in the group** and takes the space, rather than taking
it quietly."_ **WI-046 was taken quietly, and WI-063 was taken quietly.** Both
are stated here rather than overwritten. **The allocation as it now stands:
WI-046 through WI-064 are the strategy session's; WI-030 through WI-038, WI-044,
WI-045, WI-062, WI-065, WI-066, WI-067, WI-068 and WI-069 are this session's.**

**The group post for it was refused** — the round is mid-discussion — so the
allocation is recorded here, and the group line goes when the round opens.

**And it is confirmed, not assumed.** The strategy session's branch
(`wi/064-free-period-plan`) now carries its own item — **WI-064, "The plan the
free period is spent on, and the roadmap that outlives it"** — and the
`WI-062.md` and `WI-063.md` on that branch are **this session's own files,
inherited from `main` and unmodified**. **So the two ranges do not overlap**:
WI-064 is theirs, WI-065 and WI-066 are this session's, and nothing has to be
written over. The rename bought the space that the other session's own item
needed.

**One thing raised and not fixed, because it is not this session's.**
`.factory/work/WI-067.md` — the strategy session's — is **not
prettier-clean**, so `npm run format:check` fails on it, and the pre-push
hook runs that check. **It is untracked at the time of writing, so the
committed tree is clean and the pipeline is unaffected**; the moment it is
committed the formatting gate goes red on the whole run, and the failure will
read as the repository's rather than as one file. **This session did not touch
it**: the file is not this session's, a fix found along the way belongs to its
own item, and a bot that needs a file owned by someone else asks Chief rather
than taking it. **The group post naming it was refused twice** — the round is
mid-discussion — so it is recorded here, and it goes to the group when the
round opens.

## WI-043 is not verified, and the finding opens WI-068 — 2026-10-21 14:24

**Probe's verification of WI-043 came back: not verified, and the reason is
not in WI-043's work.** The manifest change is exactly right — one deleted
line in `96b87f8`, every gate green — but the repository does not yet say the
truth about its licence.

**Three files said MIT. One is corrected, one is being corrected, and one is
still there.**

| Where                     | What it says                                                                                       | Whose           |
| ------------------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| `package.json` (root)     | `"license": "MIT"` — **removed** at `96b87f8`, WI-043                                              | Chief, done     |
| `README.md:251-253`       | "MIT." — **being corrected**, WI-041                                                               | Wren, in flight |
| `CONTRIBUTING.md:236-239` | "your contribution is licensed under the MIT licence, the same licence as the rest of the project" | **no item**     |
| `LICENSE` (root)          | **the MIT licence, in full, tracked since the initial commit `d2f4ec6`**                           | **no item**     |

**Measured here, not taken from the report.** `LICENSE` opens with "MIT License
/ Copyright (c) 2026 Personal OS contributors"; `git log --diff-filter=A --
LICENSE` names `d2f4ec6` (2026-10-20 18:47, "Initial commit") and no other
commit; `git ls-files` shows it is tracked, and it is the only licence file in
the repository. `CONTRIBUTING.md:236-239` is the `## Licence` section quoted
above. **And nothing depends on the file**: `LICENSE` appears in no file under
`.github/`, in no file under `scripts/`, and in no field of the root
`package.json`.

**And no item could have been given it, because the ownership table did not
name it.** `FACTORY.md:45-62` gives `*.md` to Wren — and `LICENSE` has no
extension — and nothing else in the table matches it either. **The file fell
through the ownership table.** That is how a file ends up with two owners and
no owner at once, and it is why Probe could not route the finding.

**So the finding opens WI-068** — `.factory/work/WI-068.md` — with two halves:
Chief's (the `LICENSE` file, and the `FACTORY.md` table row that names it) and
Wren's (the `CONTRIBUTING.md` sentence, dispatched as
`wi-068-contributing-licence-2026-10-21`, `task_a4d24aa2dc24`). **The reading
is said out loud in the item:** the file is removed on the reading that "there
is no LICENSE file at this push" means the repository carries no licence file,
and **removing a stray grant is the safe direction** — the repository is
private, nothing is published, and the file has been in the tree since the
first commit. **If the owner meant something else, the item goes back to
them.**

**WI-043 does not go back to Probe, because its verification would fail the
same way** — the finding is in the tree, not in the item. It waits for WI-068
to land, and so does WI-041: both items carry the criterion _"no LICENSE file
exists"_ and **neither can be satisfied until WI-068 does.**

**The acceptance of WI-068 is the other Chief session's**, because this session
wrote Chief's half.

**WI-068's Chief half is landed.** `0df2f0d` — the merge of
`wi/068-licence-file` (`b8ad178`) into `main`: the root `LICENSE` file is
removed, and `FACTORY.md:61` now names it, so the file that fell through the
ownership table has an owner. **The gates in the worktree, all green:**
typecheck 0, test 0 (server 219, web 52, worker 31, agent-adapters 16,
contracts 28), format:check 0, build 0. The branch is pushed —
`wi/068-licence-file` — and **the pre-push format gate ran and passed**. `main`
is not pushed; that is still the owner's word.

**And the verification is not dispatched yet, and the reason is said out loud.**
**One verifier, one item, one verification** — and WI-068's verification is of
the whole item, so it waits for Wren's half, which is queued behind WI-065. **A
verification dispatched on half the item would produce a red that means
nothing.** WI-043 and WI-041 wait for the same reason: both carry the
criterion _"no LICENSE file exists"_ and **neither can be satisfied until
WI-068 does.** **This is the one case the loop's "dispatch Verify the moment
Implement lands" does not cover** — an item whose halves have different owners
and land at different times — so it is stated here rather than quietly applied.

### The post that was owed — delivered, and the request id is retired

The group post could not be delivered by `post_group`. It answered **"The
group is mid-discussion; post again once this round finishes"** on **four
attempts between 14:38 and 14:52** — with a 90-second wait between the first
two, a 180-second wait before the third, and a further 120-second wait before
the fourth. **The round did not open in that window.**

**It was delivered at 14:55, as a group turn's reply** — because in a group turn
the reply text **is** the post, and `post_group` is private-chat only. That is
the other half of the refusal: the tool that was being asked to open the door
was the wrong door.

**So the request id `status-2026-10-21-1440` is retired and must not be used
again.** The post is in the group; a `post_group` retry under that id would be
a **second copy of the same status report**, and a copy nobody asked for. **A
request id is spent when it is used, and this one is spent** — by the delivery
that actually landed, not by the four calls that did not.

**And this was the fifth delivery failure of the day, in two different
channels.** The lead's own dispatch channel refused every call from 13:50 to
14:32 — forty minutes — and the group's channel refused the status post from
14:38. **The factory's constraint is not the code and it is not the lead's
judgement. It is delivery.**

The post says, in one line per work item, newest first: WI-022 verify, the
citation refresh merged into `main` at `fb236dc` and its verification
dispatched as `task_018a6018b18f`; WI-068 implement, Chief's half landed on
`main` at `0df2f0d` and Wren's half dispatched as `task_a4d24aa2dc24`; WI-067
implement, both halves dispatched as `task_6766b83a3f23` and
`task_acc8a5211855`; WI-038 implement, the wiring done and the gate script
dispatched as `task_63e621ad515f`; WI-043 verify and **not verified**, the
repository did not say the truth about its licence and the finding is WI-068;
WI-023 verified, all seven criteria met, the acceptance the other Chief
session's; WI-036, WI-037 and WI-041, the record halves landed and the
verifications queued; WI-031, WI-024, WI-017 and WI-062 verifying; WI-027 and
WI-021 verifying, the successors after the two `BUSY` deaths; WI-065 and WI-066
implementing; WI-020, WI-011, WI-013, WI-033, WI-034 and WI-035 implementing;
WI-044 funded and deliberately not dispatched; WI-022 and WI-026 accepted, and
what the product can now do because of them.

It carries the gates at `8b2abfe` — typecheck 0, test 0 with server 219, web
52, worker 31, agent-adapters 16 and contracts 28, format:check 0, build 0 —
and the line that **one verifier, eleven queued verifications and none
started** is the factory's binding constraint, with every one of the eleven
named and measured. It says **that nothing in the post is a request**, because
every dispatched item already has its owner and its task id, and a bot must
not start one twice because of a status report. It closes with the two facts
the floor needs: `main` is ahead of `origin/main`** and unpushed, and **WI-067's
code half is on a file the factory has just been editing\*\*, so two changes to
one file get sequenced rather than merged by accident.

## WI-022's successor landed, and its verification is dispatched — 2026-10-21 14:49

**Wren's citation refresh is done.** `CONTRACTS.md` only — two stale
citations moved and one was added:

- `CONTRACTS.md:879` — was (`waiting.ts:85`), now (`waiting.ts:95`) — the
  route takes the reason straight from the task's status.
- `CONTRACTS.md:931` — was `waiting.ts:106-110`, now `waiting.ts:140-144` —
  the order the code assembles the list in.
- `CONTRACTS.md:907` — **added**, `waiting.ts:8` — the published kind's
  declaration, in WI-026's entry.

**The third one is the one that matters.** WI-026's verification found a
defect: its entry cited `waiting.ts:17` — the **reason** type — where the
criterion asked for the **kind** at `:8`. That was corrected in the item's
record, but **the citation was never in the published text**, and a criterion
that a record satisfies and the contract does not is not met. This change puts
it there, and **the verification now checks that WI-026's criterion 6 holds in
the tree.**

**The merge.** The branch was branched at `b6aed8a`, and `CONTRACTS.md` had
not moved on `main` since, so the merge was clean: `fb236dc`, **"Merge WI-022:
the waiting list's code citations, refreshed"**. Chief merged it; **Wren wrote
the contract change and Probe verifies it, and Chief wrote neither**, so this
is not the lead accepting its own work.

**Chief read the citations once before dispatching, and that is a check, not a
verdict.** All four hold: `:8` is the `WaitingKind` declaration, `:17` the
`WaitingReason` declaration, `:95` the straight assignment
`const reason: WaitingReason = task.status;`, and `:140-144` the three
filters and the assembly. **The verdict is Probe's**, and the brief says so.

**The verification is dispatched** — `wi-022-citation-refresh-verify-2026-10-21`,
`task_018a6018b18f` — the moment the implementation landed, with five named
questions, and with the ruling that **the doubled sentence is a recorded
decision and is not a defect.**

**One question was put to Probe rather than answered here:** a citation drifts
silently whenever the code moves, and this refresh repaired three of them by
hand. Probe is asked whether a check should exist that catches a drifted
citation, and where it would live — `scripts/verify-*.ts` is Probe's by the
ownership table. **The brief says not to write one unless Probe says it
belongs**, because Probe's queue is eleven deep and a verdict on the three
citations is what this item needs.

## The third push — 2026-10-21 15:03

**`main` is on the remote at `e18bfff`.** The owner gave the word at **14:51** for
the green tree, and the push is made: **43 commits, 26 files, +11216/−138,
fast-forward**, visibility unchanged at private, nothing rewritten. The pre-push
hook ran and passed.

**The word was given against a sha the tip has moved past, and the gap was
measured rather than assumed.** The card named **`dfb1e9b`**; the tip stood at
**`e18bfff`**, **fifteen commits further on**. Every one of those fifteen is
accounted for, and **the only non-document change among them is WI-068's removal
of the root `LICENSE` file**. The licence position is the owner's own answer of
08:54 — private for now, no `LICENSE` file, no code of conduct — so **this push
records a decision that was already made and decides nothing new.**

**The evidence was read from the platform, on the tip's own code.** The pipeline
ran on **`213908d`** and **both legs were green: CI success on all four jobs
(Build and test, Dependency audit, Lint the workflows, Build and run the stack),
and CodeQL success.** The delta between that sha and the pushed tip is **exactly
one file, `.factory/INTAKE.md`** — ledger prose — and **no workflow reads
`.factory/`**: grepping `.github/workflows` for `.factory` and `INTAKE` returns
no match. **Every `.ts`, `.json`, contract and work-item file the push carries
was inside the measured tree**, and the seven code files it does carry
(`capabilities/service.ts`, `mcp/server.ts`, `resources/service.ts`,
`resources/templates.ts`, `packages/contracts/src/mcp.ts`,
`packages/contracts/src/resource.ts`, `agent-memory.test.ts`) and
`docs/dependency-licences.json` are the ones that sha's green run covered.
**The repository's own format gate passes on the tip** —
`prettier --check "**/*.{ts,tsx,js,json,md,css}"`, exit 0 — and the hook ran it
again over the files in the push.

**What rode along.** The three finished wants, each proved green on its own tip
before it was merged: **WI-036** (the dependency licence record),
**WI-037** (the product record says Forge, and stops telling the owner a thing
they had already decided) and **WI-041** (the README says the licence is
deliberately undecided, not MIT). **WI-022**'s citation refresh, which puts the
published kind's declaration where WI-026's criterion can see it.
**WI-068**, which removes the root `LICENSE` file and gives it an owner in
`FACTORY.md`'s table. **WI-067**, delivered by the other session. And this
session's ledger rows.

**The evidence branch moved with it.** `verify/green-at-tip` was fast-forwarded
`213908d..e18bfff` on the standing authorisation for branch pushes. **It is
evidence and it can be deleted** — nothing depends on it, and `main` carries the
same tree.

**A push is not an acceptance, and this push is no exception.** **Nine
verifications are queued behind one Probe**, and **WI-062 — the acceptance of
this session's own counts correction — is one of them**: the lead implemented
that correction and the lead does not accept its own work. The tree is green and
the pipeline is the evidence; **the factory's verifier has still to say yes**, and
it lands as a later commit. **What is on the remote is code that has not been
accepted by the factory.** That is the honest state of it.

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was verified; adding a record of the push makes it a
different tree. **`main` waits for the owner's next word.**

## The landing page's premise is settled, and the rule it was read from — 2026-10-21 15:00

**Vision's return on WI-010 found a defect in WI-024's criterion 5, and the
defect is the lead's to settle.** The repair of the direction document landed
at `e560165` (D1 to D6), and it changed the rule the build follows: the rule
now carries its declared exception, so the **Needs-you rail carries decisions
in the orientation room** (`prototypes/DIRECTION.md:45-48`), the rail is the
decision surface (`:58-66`), and the owner's W-1 is satisfied by **one rail on
the landing screen** (`:83-86`).

**The ruling.** The root route is the **Map**. The Needs-you rail sits on it
and carries the decision controls — Approve and Reject
(`apps/web/src/components/WaitingList.tsx:274-284`) — with acceptance staying
on the factory board, on the card, at
`apps/web/src/components/TaskBoard.tsx:315-318`, reached by a link that opens
the exact card. **The landing page does not move into the execution room, and
the decision list does not move with it.**

**Why this is the lead's call and not a new decision.** The owner chose
**D — Forge** at 06:01, from a prototype whose front door is the map
(`prototypes/README.md:24`: `d-forge/index.html` is **home (the map)**). The
rule is the factory's instrument for settling the boundary Forge left open, so
where the rule and the prototype disagree the rule yields and the exception is
written into the rule — rather than the prototype being quietly redrawn.

**The flat rule was quoted in three places, and two of them applied it wrongly.
That is the cause, not the symptom.**

| Where                                        | What it said                                       | Now                                                                            |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `prototypes/DIRECTION.md:45-48`              | the rule, as repaired                              | the rule, with the exception in it                                             |
| `docs/decisions/0007-*.md:157-158`           | the rule quoted without its exception              | re-synced by the lead and dated; **the decision did not change**               |
| `.factory/work/WI-024.md` (criterion 5)      | the landing page moves to the execution room       | corrected: the root is the Map, and the rail decides in place                  |
| `.factory/work/WI-040.md:24-29` and `:31-36` | the same quote, and the same landing-page sentence | corrected; the item is not dispatched, so its brief carries the corrected rule |

**One of the two that applied it wrongly is a live build, and the correction
had to reach the briefs.** WI-024's dispatch (`task_5a09991ca5a1`) ran
11:35:05 to 12:15:08 and wrote the six briefs into `prototypes/briefs/`
(`93ef99b`, corrections at `a5042aa`) — **before** this ruling. The briefs
were written from the repaired document (`e560165`, at 11:30) **and** the
item's stale criterion 5, and where the two disagreed the item won: brief 01
puts the root route on the Map room and names the rail as the rule's one
declared exception, while brief 05 says outright that _"the item's rule is
that the landing page moves out of the root into the execution room"_. **The
briefs' shape was already right; the premise's wording was not**, and the lead
corrected the three briefs — brief 05's statement of the item's rule, its quote
of the boundary rule, and brief 01's heading — with the dated note in
`prototypes/briefs/README.md`. **The code has not been written yet**, so the
correction lands before the build follows the briefs.

**What was not done.** No task was cancelled or re-dispatched: the correction
is in the item, and the item is the spec a brief is written from. WI-024's
dispatch (`task_5a09991ca5a1`) belongs to the other Chief session and is
untouched. The ADR was re-synced by the lead rather than routed to Wren,
because nothing held the file and Wren's lane is deep; the edit is one quoted
rule, the decision behind it is untouched, and Probe verifies it as it
verifies any lead's edit. **Vision's work was not accepted by this session**:
WI-010's verifier is Probe, and the acceptance is Chief's to make on Probe's
verdict, not on a report.

**Two dispatches are owed, and the guard refused both.** Every bot-directed
call from this session was refused with _"This Bot is replying in multiple
chats, so this tool call cannot be assigned safely"_ — `dispatch_tasks` and
`message_bot` alike — while the task queries were refused the same way. The
Chief bot was in more than one chat for the whole of it, which is the same
guard that held the fleet's assignment for twenty minutes this morning.

| Reserved request id                          | To    | What it is                                                                                                  | State                                                                                                                    |
| -------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `wi-010-verify-repaired-document-2026-10-21` | Probe | WI-010's re-verification after the D1–D6 repair, with the brief in this session's notes                     | **dispatched** — the peer session sent it under this reserved id and title (`task_2f3e137d63ee`, queued)                 |
| `wi-024-premise-correction-2026-10-21`       | Cog   | A short note that WI-024's criterion 5 changed, so the six briefs are written against the corrected premise | **retired, not dispatched** — the correction reached Cog through the briefs at 15:29, and Cog has no live or queued task |

**A reserved id is not a dispatch.** Neither task exists, and no id is spent
until a task is created under it. The peer session has both briefs and has
been asked to send them if its own guard is clear; **this session will not
dispatch either under a second id**, because one item, one live dispatch, and
one verification of one item.

**What carries the correction to Cog without the message.** WI-024's file
itself: the note is at the top of it, and the item's first deliverable is the
six briefs. A brief is written from the item, so the correction lands before
the briefs are written — which is the whole reason the correction was made
into the item rather than into a note.

## The accept queue was not slow — a livelock was holding half the factory — 2026-10-21 15:35

**The group has asked the owner three times for a second verifier, on the theory
that one verifier was the constraint. It was not, and this is the measurement
that says so.**

**The factory runs two tasks at once.** `MAX_RUNNING = 2` is hard-coded in the
runtime's dispatcher (`.../minimax-bot/node/task-dispatcher.mjs`) and **no
setting in this repository changes it**, so **half the factory is one slot.**
The dispatcher scans batches in creation order, takes the first queued task
whose bot's chat is free, and runs **one task per bot**.

**From 13:13:40 one of the two slots was held by a turn that was not working.**
`task_83be52cd5d71` — a discussion task in the Personal OS Strategy group —
showed `status: running` for **119 minutes** with `result`, `messageId` and
`endedAt` all empty, and the group's last message from that bot was **empty
text**. **While it held the slot: Probe's chat was idle** — 0 running, 0 queued
— and **27 tasks sat queued**, the three oldest being WI-027's, WI-021's and
WI-045's. **The queue did not move because there was nowhere for it to move
to.** A second verifier would have sat idle in the queue exactly like Probe
did.

**What it actually was — and the correction to this session's first reading.**
The first reading was that the worker was dead, and that the giveaway was its
session's status being terminal. **That was circular**: the session was read as
`aborted` **after** the task was cancelled, and the abort is what made it
`aborted`. **The status was measured after the intervention, so it proved
nothing about before it.**

**What the turn was doing came out when the abort released it: a livelock.** Its
output was a stream of unfinished reasoning — _"Two hours have passed and the
world moved. Let me take the state back in before I speak. … Let me check the
exact claims Probe named … Now let me check the other session's in-flight edits
… Facts are in. Now let me verify the last details before I rule and write."_ —
**restarting the same investigation without ever concluding.** It was alive by
every measure available, and it still consumed the slot.

**What was done.** The task was cancelled. **Nothing was lost**: its work was
already committed and in `main` (`e1f50ae`, "Answer Probe's review: six
defects, six observations, all of them mine"), its follow-up repair was a
separate live task, and **the released turn still produced its 2896-character
post, which the group received**. **Measured eight seconds after the slot
freed, Probe's WI-027 verification started**, and Cog's WI-045 implementation
took the other slot: **the queue began moving on its own for the first time
since 09:48.** The group was told — `task_c7064293a08e`, the first post of
this session's the channel accepted rather than refused.

**What is now in the repository, so the next stall is not found by accident.**
`.factory/watchdog.md` — Chief's file, and the knowledge lives in the
repository because the doctrine lives in the repository. **It reports; it does
not cancel**, and the reason is measured rather than cautious: **elapsed time
cannot tell a stall from a long task.** Over the 82 tasks that completed on
2026-10-21, **five ran for over two hours and every one of them finished**, the
longest taking 477 minutes. **A check that cancels on elapsed time alone would
have killed five real pieces of work.** The threshold is **45 minutes**, and it
is a _trigger to look_, never a reason to cancel. **Cancelling stays Chief's
judgement** — the evidence that made it safe today was that the work was
already committed, that the follow-up was a separate task, and that the turn
had posted nothing for two hours. `FACTORY.md` points at it from the loop.

**And a schedule to run it**, so the finding does not depend on a human
noticing: `sch_6db03ac6ba13`, every 30 minutes, as Chief. The first version of
that schedule told the bot to cancel on a terminal session status — **the
circular rule above** — and it was deleted and replaced the moment the
circularity was found. **A cancelled batch keeps its request id; a schedule can
be deleted outright.**

**The second-verifier question stands, and it is a smaller one than the group
has been asking.** With two slots, a second verifier buys parallelism **only
when a slot is free**, and today the slot was the problem. It is still worth
the owner's answer, on the measurement that today the queue did not move
because a turn was stuck, not because there was one of anything.

## The watchdog fires — 2026-10-21 15:50

**The check is verified, not assumed.** The schedule `sch_6db03ac6ba13` fired at
**15:50:26** and its next run is **16:20:27** — exactly the 30-minute interval.
**It created no task and posted nothing**, which is the specified behaviour
when nothing has been running for more than 45 minutes: the two tasks running
at that moment were 12 and 4 minutes old. **So the check that can fail did
fire, and it correctly concluded that there was nothing to report.**

**One branch of it is verified and the other is not, and that is said here
rather than left implied.** The **quiet** branch — nothing over the threshold,
say nothing — is verified. The **report** branch — something over the
threshold, report it with the task id, the minutes held, the chat blocked and
whether the work is already committed — is **not verified, because there was no
stall to report.** Manufacturing one to test it would be manufacturing the
failure the check exists to prevent.

**A correction to how the firing is read.** The liveboards `state.json` shows
`last_run: null` for this schedule, and **that field is not where the runtime
keeps it** — a check that reads the state file alone would conclude the
schedule never fired, which is the opposite of the truth. The authoritative
value is what `list_schedules` reports. **A check that reads the wrong place
is worse than no check**, and that is worth knowing about this one.

**And the queue answered a question the group has been asking all day.** At
15:27 WI-027's verification landed — **the first accept-queue item to close
since 09:48** — and at 15:49 WI-062's verification started. **The queue is
moving because the slot was freed, not because the verifier count changed.**

## The briefs were written before the ruling, and the correction reached them — 2026-10-21 15:45

**The lead's own claim of an hour ago was wrong, and it is corrected here
rather than overwritten.** This session wrote that WI-024 "is queued and has not
run", and that "the correction lands before the briefs are written". **Both
were false**: the dispatch (`task_5a09991ca5a1`) ran 11:35:05 to 12:15:08 and
wrote the six briefs at 11:58, and the ruling was at 15:09. The claim came from
the ledger's own row, which still said "still queued" — **a stale row read as
a live fact**, which is the mistake this factory has a rule about.

**What the briefs got right, and what they got wrong.** The direction document
had been repaired at `e560165` at 11:30, five minutes before the dispatch
started, and the briefs used it: **brief 01 puts the root route on the Map
room** and names the rail as the rule's one declared exception, and **brief 05
already makes the list into the rail that decides in place**. What the briefs
took from the _item_ instead was criterion 5, still the flat-rule version, and
brief 05 says so outright: _"The item's rule is that the landing page moves
out of the root into the execution room."_ **The briefs' shape was already
right; the premise's wording was not.** The lead corrected the three briefs —
brief 05's statement of the item's rule, its quote of the boundary rule, and
brief 01's heading — and `prototypes/briefs/README.md` carries the dated note.
**The code has not been written yet**, so the correction lands before the build
follows the briefs.

**Two dispatches are still owed, and the refusal is a different one now.**
From a scheduled turn every bot-directed call is refused with _"This tool call
cannot be assigned to an active reply. Retry from the current chat."_ — which
is not the multi-chat guard from the morning, and which a chat turn does not
hit. The ids stay reserved:
`wi-010-verify-repaired-document-2026-10-21` for Probe's re-verification of the
repaired direction document, and `wi-024-premise-correction-2026-10-21` for the
note to Cog. **The peer session has both briefs** and has been asked to send
them; **this session will not dispatch either under a second id.**

**And what the morning section got wrong, now the cause is measured.** The
other Chief session measured it: the runtime runs **two tasks at once**
(`MAX_RUNNING = 2`, hard-coded, and no setting in this repository changes it),
and a livelocked turn held one slot for 119 minutes. **Neither** reading in the
morning section was right — not the guard holding the assignment, and not a
wedged bot session — and the test that section set would have confirmed the
wrong one, because the queue began moving on its own eight seconds after the
slot was released, with no change in how many chats the Chief bot was in. The
correction is in that section and in the peer's, and the sizing rule now is
that **at most two items are in flight productively**, and a task that hangs
holds half the factory.

## The owner's two answers came at 16:40, and both confirm what is already built — 2026-10-21 17:05

**The questionnaire this session opened at 09:25 (`ask_c289c257da1653a1794d2c3a`)
was answered at 16:40, and both answers are the recommendations.**

1. **Should a turn whose outcome could not be confirmed keep dispatching
   work?** — **No: an unknown turn waits for you.**
2. **Do you want Forge ahead of the three released items?** — **No: let the
   three released items land first.**

**Neither answer changes anything, because both are already built.** The first
is **WI-045** — "an unconfirmed turn routes no further work" — which landed at
`a4010bb`, was merged into `main` at `66c86ad`, and **Probe's verification of
the owner's own answer is queued** (`task_1df39fd407ea`). The second is the
order **WI-024** already records: WI-031, WI-017 and WI-020 land before Forge,
and nothing is cancelled to move it. **What the answers do is retire two open
questions** — including the one that was holding WI-008, which is accepted.

**The second answer is now the owner's word rather than the lead's reading of
one.** The 08:54 sentence — "Forge lands right after" — was the lead's reading
of "next among the items that have not started", and WI-024's file said so
plainly: _"If the owner wants Forge ahead of them, that is one word."_ **The
word has now been given, in the other way**, and WI-024's file carries it.

**And the two things this session owed are closed.** WI-010's re-verification
is dispatched — the peer session sent it under the request id and title
reserved here (`task_2f3e137d63ee`, queued) — and **the premise-correction note
to Cog is retired rather than dispatched**, on the peer's reasoning, which is
right: the briefs were corrected at 15:29, Cog has no live task and no queued
task, and a note telling a worker a premise changed when it has already
changed is a false statement to a worker. **The correction reached Cog through
the file, which was the channel this session named as sufficient in the first
place.**

**Two corrections to this session's own record.** **`main` is pushed** — the
owner gave a new word at 16:20 and `main` went to `origin` as a fast-forward
(`e18bfff..8dcf69d`, CI success on all four jobs plus CodeQL), so the notes and
the messages that said the push word was spent were wrong. **And WI-024 ran**,
at 11:35 to 12:15, which this session had recorded as queued and had not run;
the correction is in the file and in the briefs. **The ADR edit stays the
lead's**, and WI-025's acceptance is the peer session's — the ownership was
transferred to Chief for exactly this reason, and the remedy is that the edit
is verified like any lead's edit.

## WI-027 is verified, and the drift has a second instance — 2026-10-21 16:00

**The accept queue moved for the first time since 09:48, and it moved because
the slot was freed.** WI-027's verification — the successor, request
`wi-027-verify-fixed-tree-successor-2026-10-21`, task `task_874e6fb66b9b` —
**finished at 15:27, sixteen minutes after it started, with all nine acceptance
criteria met.** The gates are pasted in the report: typecheck 0, format 0,
build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 ·
contracts 28), **test:e2e 27 passed**.

**The measurement, before and after the slot was released.** In the hour before
it: **two tasks completed, median 278 minutes.** In the sixteen minutes after:
**two tasks completed, median 16 minutes.** The livelock was costing the
factory more than the queue's length ever did.

**The finding that matters is not about WI-027.** Probe found a **live defect
in another item**, and **a defect blocks acceptance**, so it is written into
that item rather than left in a report:

**`CONTRACTS.md:197-204` says the code does not implement the resolve route.**

> **This entry is the contract for WI-031, and the code does not implement it
> yet.** … there is no `/api/executions` route … A client written against this
> entry must treat the route as absent until the implementation lands.

**Every clause is false.** The route is at `api/executions.ts:21`, registered
at `app.ts:217`, published in the route table at `CONTRACTS.md:1145`.

**And the cause is the order, not a mistake.** The contract half landed at
**11:05** (`363428e`) and the implementation at **11:32** (`414996c`), so **the
note was true when it was written and went false 27 minutes later.** The
contract led the code, and **the contract's statement about the code did not
follow.** **This is WI-065's drift with a second instance** — WI-065 says it
plainly: _"Leading means something in both directions: when the code lands,
the contract's statement about the code has to follow, or the contract is
publishing a falsehood about the product it describes."_

**So the pattern is recorded as a candidate, C-23, and the second instance is
attached to WI-031, where it blocks that item's acceptance.** The correction is
Wren's line and `CONTRACTS.md` carries WI-065 as a live item, so **it is not
written here** — one file, one live item. The check that would stop the third
instance is a `scripts/verify-*.ts`, which is Probe's by the ownership table,
in the shape of WI-038's borrow-rule gate. **A published count can go stale
and a test catches it; a published _status_ can go stale and nothing catches
it**, because a test would have to read the note and know what it claims.

**Two more findings, and both are records, so both are corrected here.**
**The close path has no test anywhere** — Probe grepped every test file for
`/executions/`, `execution.outcome.resolved` and "It ran" and got production
files only. **WI-031's own criterion assigns that pin to Probe**, so the hole
is known and owned and still a hole. **And the records behind this were
stale**: `WI-027.md` named the verification that **failed with `BUSY` at
10:19:58 and produced no verification at all** as the live dispatch, and this
ledger's dispatch table still showed **both of WI-031's halves as queued**
when both had landed. **The ledger being wrong about what has been dispatched
is how a finding goes unread twice** — so the table is corrected, `WI-027.md`
names the successor, and `WI-031.md` carries the defect.

**What is not done, and why.** WI-027's **acceptance is Chief's** and is not
recorded as done here: the item is verified, and the acceptance is a decision
that goes in the item's file with the verdict against it. **WI-031's
verification is queued** (`task_b511f4062477`) and will rule on the close
path's pin. **WI-065 is live on `CONTRACTS.md`**, so the second instance's
correction waits for it rather than making two live items on one file.

## Three items close, and the queue moves — 2026-10-21 15:45

**The queue moved for the first time since 09:48.** The livelocked turn that
held half the factory for two hours was cancelled, and in the sixteen minutes
after the release **two tasks completed with a 16-minute median** — against two
in the hour before, with a 278-minute median. **Probe's WI-027 verification and
Cog's WI-045 implementation took the two slots.**

**And three items are accepted**, because Probe's verdicts are in and the
gates are green:

| Item   | Verdict                                                                 | The measurement it stands on                                                                                                                   |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-027 | **all nine criteria met**                                               | `f7ac848`; typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), **test:e2e 27 passed** |
| WI-021 | **all five criteria met**                                               | `51c92f8`; typecheck 0, format 0, build 0, test 0, **`npm run smoke` 0 in 9.5 s**, the two pinned suites **39 passed (39)**                    |
| WI-008 | **all four defects closed**, and the owner's question answered at 11:05 | typecheck 0, test 0 at `8b2abfe`; and `git diff --stat 51c92f8..HEAD -- apps packages mcp CONTRACTS.md scripts` is **empty**                   |

**This session wrote none of the three**, so the lead does not accept its own
work: WI-027's implementation is Cog's (`c9bb0bc`, `4e5db84`), WI-021's fix is
Cog's (`57606a8`), WI-008's is Cog's (`9ad4f98`, `f0f8661`) with the contract
half Wren's (WI-013). **All three acceptances are recorded here so that the
other Chief session does not accept them again.**

**What the product can now do because of them.**

- **WI-008 — an unknown outcome is not a failure.** A turn, execution or task
  whose outcome cannot be confirmed is recorded as **`unknown`**, and `failed`
  no longer reads as "safe to retry" — so a side effect that may already have
  happened is not run twice. **An unknown outcome is never retried or
  redispatched automatically**; the waiting list shows it as **"check this"**,
  not "fix this"; and every transition to and from it is in the audit trail.
- **WI-027 — a turn reaches the owner the way an unknown task does.** It is
  drawn on the waiting list as its own kind, **`turn`**, with the reason
  **`unknown`**, in the same urgency band as an unknown task, because the list
  is ordered over reasons and not over kinds. The owner can close it with
  **"It ran"** or **"It did not run"**.
- **WI-021 — a delegation is never silently dropped.** It reaches the
  participant, or it is refused with a reason that names **both** the sender
  whose right to delegate was refused and the agent that was not woken, and
  the routing result carries `targets: []` so a client can tell a refusal from
  a success without reading the prose.

### WI-031's acceptance is blocked, and the correction is dispatched

**Probe found a live defect against WI-031 while verifying WI-027**, and **a
defect blocks acceptance**, so it is written into the item rather than left in
a report nobody reads twice. `CONTRACTS.md:197-204` says the code does not
implement the resolve route yet and that a client must treat it as absent —
**false since `414996c` (11:32)**, and it was true when it was written at 11:05,
so the contract led the code and the contract's statement about the code did
not follow. **WI-065's drift with a second instance**, recorded as candidate
**C-23**.

**The correction is dispatched** — `wi-031-contract-status-correction-2026-10-21`,
`task_be25e082ae5c`, to Wren — in the pattern WI-027's own entry uses:
_"the code implements it — as of `414996c`"_. **It queues behind WI-065 on
`CONTRACTS.md`**, because Wren's lane is serialised and one file carries one
live item. The other Chief session recorded the finding and the deferral; the
deferral was to wait for WI-065 to clear the file, and **a dispatch into
Wren's serial queue is how it clears.**

### WI-069 — numbered, and held on purpose

**Probe's second finding on WI-021 was a question for Chief**, and it is now
numbered: **WI-069, "A delegation that names nobody is refused in a way a
client cannot read."** A delegation addressed to a participant id that matches
**nobody** is refused with a generic reason and **no `blocked` key**, so a
client cannot tell that refusal from "there was nothing to wake". Measured:
ids are filtered to enabled agent connections at
`apps/server/src/modules/conversations/routing.ts:131` before the refusal is
built, so such a delegation never reaches the branch that names the target;
the reason becomes _"An agent message does not automatically trigger other
participants in coordinator mode."_ and `blocked` is undefined.

**It is held, and the reasons are said out loud rather than left to be
guessed.**

1. **The owner's line at 15:40:** _"When a slot frees, lean on verification —
   six items sit at `verify` and every one of them waits on Probe, and
   unverified work is inventory rather than product."_ **Acceptance is the
   constraint, so a new implementation item does not take capacity while ten
   verifications wait.**
2. **The contract half needs the owner's answer**, because **WI-021 has no
   entry in `CONTRACTS.md` at all** — the refusal's shape is published nowhere,
   so this is a gap in what the product says about itself and not a violation
   of something it already said. **Chief's recommendation is yes, and in the
   smallest form**, and it is still the owner's.

**It is numbered so it is not lost**, and the brief is written out in full in
`.factory/work/WI-069.md`, with the acceptance criteria drafted. The request
ids are reserved: `wi-069-refusal-names-nobody-code-2026-10-21` for Cog and
`wi-069-refusal-shape-contract-2026-10-21` for Wren.

### Three records corrected, because a wrong record is how a finding goes unread twice

1. **WI-021's state line named the spent dispatch** — `task_479859728e18`, the
   one that failed with `BUSY` at 10:20:27. The live one is
   `task_d817d075a0ce`. Corrected, and the item is now **accepted**.
2. **WI-021's own file described a behaviour the code cannot exhibit.** It
   said _"a connection that matches no participant is named by its id."_ The
   branch exists (`routing.ts`, `participantName`) but **no input reaches it**,
   because ids are filtered to enabled connections at `:131` before the
   refusal is built. **It is harmless dead code; the file's account of it was
   the untrue part**, and the account is corrected.
3. **WI-021's citation was stale** — the translation at `service.ts:419-429`,
   now at `:467-476`. **The code did not move; the line range did.**

### The smoke gate is not flaky any more, and this session's record says so wrongly

**This session recorded the Windows smoke gate as flaky and unresolved.** It
is **fixed, by Probe, in test-side code**: `63aba3a` (12:00, _"Read the process
table without losing the race"_) replaces the PowerShell start-up with a
one-question WMI read through `cscript` — **267 ms measured against
PowerShell's 5.7 s** — and `1c92001` (12:10) fixes two further suite flakes.
Probe's own run of the gate on the current tree: **exit 0 in 9.5 s**, including
the three checks that were failing.

**The residual, honestly.** The fallback path — a machine with no script host
— is still the slow PowerShell read, so there the race can return, and **the
product-side 5-second budget is unchanged** (`busy_timeout = 5000`,
`apps/server/src/db/client.ts:29`). **That half is Cog's to change**, and it is
not what made the gate flaky.

### The owner's Forge correction, which is now on the record

**WI-024's live dispatch is `task_5a09991ca5a1`** — not `task_2963d3be0f41`,
which was cancelled at 09:35. **The correction that said so failed with `BUSY`
at 10:20:55**, and the owner's line at 15:40 carries it. It is recorded in the
dispatch table and it changes nothing: WI-024 is not re-dispatched from here,
because it is the other session's item and a re-dispatch needs a new id and a
new title anyway.

### The number space, as it now stands

**WI-069 is this session's**, taken as the next number above all of them. WI-030
through WI-038, WI-044, WI-045, WI-062, WI-065 through WI-069 are this
session's; WI-024 through WI-029 and WI-039 through WI-043 are the other Chief
session's; WI-046 through WI-064 are the strategy session's. **If another
session has taken WI-069 in the meantime, it is renumbered and the table is
corrected** — the same way WI-063 became WI-065.

## The second verifier: answered, and the question is closed — 2026-10-21 16:00

**The group asked the owner three times for a second verification bot, on the
diagnosis that one verifier was the constraint. The measurement said otherwise,
and the question was put again with the measurement attached. The answer is
no.**

**One verifier, plus the stall watchdog.** The fleet's problem on 2026-10-21 was
not that Probe was slow or alone — **Probe's chat sat idle for 119 minutes**
while a livelocked turn held one of the two slots. **A second verifier buys
parallelism only when a slot is free**, and on the day the slots were the
thing that was wrong. **So the question was put with the corrected diagnosis
attached, and the answer was: one verifier and the watchdog is enough.**

**How the answer came, stated plainly rather than as the owner clicking it.**
It came through the questionnaire's **recommended default on timeout** — the
option marked recommended was _"no — one verifier plus the stall watchdog is
enough"_, and the runtime adopted it. **That is a resolved answer, not an
explicit click, and it is recorded as what it is.** The safe direction was
marked recommended, and the alternative — adding a bot the owner did not
choose — is the one that changes the shape of the team and its cost.

**And the measurement that changed the question is the reason the answer is
safe to act on.** The queue moved once the slot was freed and the stall was
watched for: **WI-027's verification landed at 15:27, the first accept-queue
item to close since 09:48, and WI-062's started at 15:49.**

**What this closes.** The second-verifier question is **answered and is not to
be asked again.** If the accept queue stops moving, the first question is
**whether a slot is stuck**, and the watchdog answers it every 30 minutes
without a human noticing. **A second verifier is the second question, not the
first.**

**The watchdog's first firing is verified.** `sch_6db03ac6ba13` fired at
**15:50:26**, its next run is **16:20:27**, and it created no task and posted
nothing — correct, because the two running tasks were 12 and 4 minutes old and
nothing was over the 45-minute threshold. **The quiet branch of the check is
verified; the report branch is not, because there was no stall to report.**
Manufacturing one to test it would be manufacturing the failure the check
exists to prevent.

**The group post was refused, and that is recorded here because the decision
matters to the floor.** The round was open, and `post_group` answered _"the
group is mid-discussion; post again once this round finishes"_ on **two
attempts, at 16:00 and 16:05** — request ids
`factory-group-verifier-answered-2026-10-21-1600` and `-1605`. **The earlier
post about the livelock, `task_c7064293a08e`, is still queued** and will be
delivered when the round opens. **The decision itself does not wait on the
group**: it is the owner's answer, it is in the ledger, and the watchdog that
implements it is already running on its own schedule. **A refusal to post is a
delivery failure, not a reason to leave the record unwritten** — which is why
this section exists, and why the group's copy is a convenience and not the
state.

### WI-045 — the owner's answer is implemented, and its verification is dispatched

**`a4010bb` "Stop an unconfirmed turn from routing work onward"** on
`wi/045-unconfirmed-turn`, pushed to origin so CI gates it, and **merged into
`main` at `66c86ad`**. Five files, 86 insertions: `dispatch.ts` (the guard and
the audit entry), `service.ts` and `app.ts` (the audit service reaches the
dispatcher), `routing.ts` and `executor.ts` (the call sites).

**The guard.** `planAndDispatch` reads `message.status` before it routes
anything (`apps/server/src/modules/conversations/dispatch.ts:69-88`).
`complete` and `failed` are settled answers and route as they always did;
`unknown` and `streaming` stop the routing — no execution, no queued job — and
the routing decision says why, with a new block reason `unconfirmed`. Measured
against a real server: a confirmed turn → 1 dispatch and 1 queued `chat.turn`;
the same turn marked `unknown` → **0 dispatches, 0 queued jobs**.

**Chief's word on Cog's one judgement, and the doubt is named rather than
hidden.** Cog flagged that **the audit entry targets the message, not the
execution.** Cog's first version targeted the execution, which broke Probe's
verified assertion at
`apps/worker/src/__tests__/unknown-outcome.test.ts:251` — that lookup keys on
the target alone (`entries.find((item) => item.targetId === 'exe_1')`) and the
trail is newest-first, so **a second entry on the same target shadows the one
that was pinned.** Cog did not touch the test.

**The ruling: the stop targets the message.** The message is the thing that
was not routed and the thing the owner reads; the execution id is not lost and
travels in `metadata.executionId`; and **the audit trail is keyed by target**,
so a second entry on one target makes a target-keyed lookup ambiguous — and
that lookup is pinned and verified. **The criterion is not rewritten.**
Criterion 3 says _the stop is recorded where the rest of the unknown-outcome
machinery is recorded_, and **that wording is what Probe judges it against.**
Chief's ruling resolves the ambiguity in the implementation; it does not move
the goalposts.

**The verification is dispatched** — `wi-045-unconfirmed-turn-verify-2026-10-21`,
`task_1df39fd407ea` — with six questions. One is the criterion above. **One is
the question Cog's change raises and nobody has answered yet: `streaming` is
not an unconfirmed outcome, it is a turn in progress**, and the owner answered
about an _unconfirmed_ turn. Probe is to say whether any legitimate path calls
`planAndDispatch` with a streaming message, and what it does now.

**And the owner has closed the second-verifier question**, so this section does
not ask again: **no — one verifier plus the stall watchdog**, the question is
closed, and the first question when the accept queue stops moving is whether a
slot is stuck. The other Chief session recorded that answer at `671f9f2`, and
**this session had the question open in its own report and does not reopen
it.**

**The queue is moving.** WI-027's verification landed at 15:27 — the first
accept-queue item to close since 09:48 — and **WI-036's verification started
at 15:38**. The livelocked turn that held half the factory was cancelled, and
in the sixteen minutes after the release two tasks completed with a
**16-minute median**, against two in the hour before with a 278-minute median.

## The watchdog sweep, 2026-10-21 16:10 — four verifications that never arrived

**This is the watchdog's own sweep, on the 30-minute cadence, and it found the
failure this factory exists to prevent: work that landed and a verification that
was never delivered.** Four items have their work in `main` and **no live
dispatch**, and every one of them is a hole rather than a deliberate hold.

### What is running, measured

| Task                | Held     | What it is                                                                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task_aa4b43bdd748` | 28.9 min | Chief's tick in the Personal OS Factory group. **Fresh output at 16:03:26** — it ruled on WI-045's judgement call and merged WI-045 into `main`. |
| `task_3bb64dabf31a` | 11.7 min | Probe, WI-036 — verify the dependency licence record against the lockfile.                                                                       |

**Neither is a stall, and nothing was cancelled.** The watchdog's trigger is 45
minutes and neither task has reached it; the group turn is measurably
producing output and the Probe turn is eleven minutes old. The queue behind
them: **Probe 8 queued, Wren 7, Cog 1, Chief 1.**

### The four items, and what died on each

| Item       | The work, and where it is                                                                | What died                                                                                                                                                                                                                                                                                                                    | Lane        |
| ---------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **WI-007** | Cog's fix `6878e7c` (**in main**); Wren's migration note `task_e6fe9555ca74`, done 11:19 | Probe's verification of the fixed tree, `task_2e431d7647e5`, **failed at 11:10:17** with an empty result, and was never re-dispatched.                                                                                                                                                                                       | **free**    |
| **WI-010** | D1 to D6 repaired (`e560165`, **in main**); Chief's own task closed 15:12                | **Probe's re-check was never dispatched.** The item's state line says _"Probe re-checks, Chief closes"_ — and Probe's only WI-010 verification (`task_5666d5ca0dc2`) ran 07:08 to 07:46, **before** the repairs.                                                                                                             | **free**    |
| **WI-025** | Wren's three record fixes (`a107cb9`, `b1b9ee9`, **in main**)                            | Probe's verification (`task_2b5c9020bf00`, 09:28) found **three defects** in the ADR's record; Wren fixed them at 11:58; **the re-verification was never dispatched.**                                                                                                                                                       | **free**    |
| **WI-039** | The contract half **landed** — `6406291`, `CONTRACTS.md` only, +101 lines, **in main**   | The verification was handed to Probe's **own session** (`mvs_f1f513955649480dbfb09fae820cf59f`) at 10:53, and the dispatcher task `task_e486def935b8` was cancelled at 10:54 — **and the brief never arrived.** That session's three user-role messages are the three dispatcher briefs; the WI-039 brief is not among them. | **blocked** |

**WI-039's lane is blocked, and the block is concrete.** Its subject is
`CONTRACTS.md`, and **`wi/046-domains-interaction-model` holds that file** —
34 files changed, `CONTRACTS.md` among them, unmerged. Verifying WI-039 against
`main` measures a tree that does not carry WI-046's contract changes. **Either
the verification waits for that branch, or it is scoped to the WI-039 entry
alone and says so.** That is a tiebreak for the lead, and it is said out loud
here rather than taken quietly.

**The three free lanes are free, measured.** No live branch touches
`apps/server/src/__tests__/approval-resume.test.ts` or
`apps/web/e2e/waiting-list.spec.ts` (WI-007), `prototypes/DIRECTION.md`
(WI-010), or `docs/decisions/0007-the-environment-agents-operate-and-extend.md`
(WI-025) — `wi/046` touches ADRs 0008, 0009 and 0010, **not 0007**.

### What this sweep dispatched, and why it dispatched nothing

**Nothing was dispatched from here, and that is a decision rather than an
omission.** Probe's chat is busy with **eight** Probe tasks queued behind it;
the live Chief session in the group owns the dispatch and the number space,
and at 16:06:05 it dispatched WI-045's verification
(`task_1df39fd407ea`, request `wi-045-unconfirmed-turn-verify-2026-10-21`).
**Dispatching WI-007, WI-010 or WI-025 from a second session is two verifiers
on one item.** The four are recorded here as **ready to go**, with the lane
named, so the session that holds the queue takes them in this order:
**WI-007, WI-010, WI-025** — the three with a free lane — and **WI-039** when
`wi/046` clears `CONTRACTS.md`, or with the check scoped down and said.

### Two records are wrong, and two gaps are recorded correctly

**The same defect the ledger recorded at 15:35, in a third shape: the record
is wrong about what has been dispatched.**

1. **WI-007's state line names a failed task as its live dispatch** — _"Probe's
   verification of the fixed tree is dispatched, task `task_2e431d7647e5`"_ —
   and that task is `failed` with an empty result. A reader would count WI-007
   as busy.
2. **WI-039's record says the verification "was handed over the working
   route"** to Probe's session. **That handover did not land.** The brief is
   not in the session's history, and the dispatcher task that would have
   delivered it was cancelled a minute later.

**WI-010's and WI-025's records are honest** — they say a check is owed — and
that is the problem: **nothing was ever dispatched for either, and nobody
noticed.** A gap that is correctly described is still a gap.

**None of the four records is corrected here.** `.factory/work/**` is the
lead's file, and this sweep does not edit another session's item records.

### The branches, and one that CI cannot gate

**Measured from the merge base, not from `main`** — the difference matters,
because `main` has moved on and the two lists are not the same thing.

| Branch                             | What it actually changes                                                          | On origin      |
| ---------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| `wi/020-measures-route`            | the measures route — `apps/server`, `apps/web`, `packages/contracts`              | **pushed**     |
| `wi/038-borrow-rule-gate`          | `.github/workflows/ci.yml` and `package.json`, and nothing else                   | **NOT pushed** |
| `wi/046-domains-interaction-model` | 34 files — `CONTRACTS.md`, `docs/**`, `packages/**`, `apps/server/src/domains.ts` | **pushed**     |
| `wi/064-free-period-plan`          | `docs/free-period-plan.md`, `docs/roadmap.md`, `WI-064.md`                        | **pushed**     |

**`wi/038-borrow-rule-gate` is the only branch holding work that is not on
origin**, so CI cannot gate it. Its work is one CI step and one manifest
entry — the borrow-rule gate — and a queued Probe task (`task_63e621ad515f`)
is meant to verify it. **A branch nobody pushed is a branch nobody gated.**

**Nine worktrees are stale leftovers** — `022`, `032`, `036`, `037`, `041`, and
two each for `067` and `068` — every one clean, every one an ancestor of
`main`. **"A worktree exists" is therefore not a signal that anything is
happening.** The two `WI-067` branches and the two `WI-068` branches are **the
same items' leftovers, not two items each**: both `067` branches sit on
`afc2811` and both `068` branches are merged, so **the number space did not
collide — there are four worktrees and two items.**

### What the owner has

**The push.** Local `main` is `71c9297`, `origin/main` is `e18bfff`, and
**14 commits are unpushed** — WI-045's merge, the watchdog, and the ledger
among them. **`main` waits for the owner's word**, and this sweep does not
spend it.

**The WI-039 lane tiebreak** — wait for `wi/046`, or scope the check to the
WI-039 entry alone.

**And the two contract calls already open** — WI-021 publishes no entry in
`CONTRACTS.md` at all, so the refusal's shape is published nowhere, and
WI-069's contract half waits on the owner's answer. Both are already on the
record and neither is new.

**Nothing else needs the owner.** The queue is moving, no slot is stuck, and
the four items above wait on a dispatch, not on a decision.

### WI-062 is verified, and it is accepted by the session that wrote neither half

**Probe's verification of WI-062 is done** — request
`probe-verify-published-counts-2026-10-21-1240`, task `task_2c7c9f4fd696` —
and **all six criteria hold.** Probe re-implemented the test's own counting
method rather than trusting it: **35 mutating routes registered, 21 auditing in
their own handler, 2 auditing from the service layer, 12 writing no audit
entry**, and **the published table and the code's unaudited list are the same
twelve** — nothing in one and not the other. The gates: the published-shapes
suite 3 passed, the server suite 219 passed, `prettier --check` 0,
`npm run format:check` 0.

**Accepted: 2026-10-21, by this session.** The contract correction at
`50b908d` is the **other** Chief session's — its own commit message says _"The
lead does not accept its own work"_ — and the test's comment fix at
`137385c` is Probe's, which Probe says in its report goes _"to the lead for
acceptance. I do not accept my own work."_ **This session wrote neither half,
so the lead accepts it, and neither writer accepts its own work.** The item
file said so too, before the verification came back: _"the lead implemented it,
so Probe verifies it and Chief accepts it."_

**What the product can now do because of it.** The published contract says how
much of the product's mutating surface the audit trail actually covers, and
the number is right: **35 mutating routes, 21 that write an audit entry at the
route level, 12 that write none.** An owner reading it learns that **a third
of the mutating surface is invisible to them** — which is what the contract
says in words — rather than a smaller number.

**And all three of Probe's findings are routed, not left in a report.**

1. **Four stale citations in the measures section** — the claims are true, the
   line numbers are not: `CONTRACTS.md:1199` cites `mcp/server.ts:368` where
   the work is at `:393`; `:1212` cites `resources/service.ts:170` and `:260`
   where it is at `:193` and `:283`; `:1193-1194` cites `lib/ids.ts:9-17` for
   the `agt_` form, and those lines are the generic id generator while the
   prefix is chosen at `agents/service.ts:202`. **Dispatched to Wren** as
   `wi-062-measures-citation-refresh-2026-10-21`, `task_169f434c05d9` — **a
   citation refresh, not a change of content**, and it must not touch the
   template record or WI-031's entry.
2. **The template record at `CONTRACTS.md:578-581`** still says the code does
   not implement it yet, and the registry is in the tree. **That is WI-065's
   line**, and WI-065 is live in Wren's queue.
3. **WI-031's entry at `CONTRACTS.md:197-204`** — the same shape, and
   **dispatched** as `task_be25e082ae5c`.

**And the one question for the owner.** WI-069's contract half needs it:
**should the product publish the shape of a delegation refusal**, so that a
client can tell _"you named an id that matched nobody"_ from \_"there was
nothing to wake"? **Chief's recommendation is yes, and in the smallest form** —
a refusal that names nobody says so, and carries a `blocked` key as the refusal
that names a target does. **But WI-021 has no entry in `CONTRACTS.md` at
all**, so the refusal's shape is published nowhere, and publishing it is a
contract change, and a contract change is the owner's. The code half does not
wait for the answer, and **the item is numbered and written so it can go the
moment the answer comes.**

### A note against this sweep, and a tiebreak that is not taken

**This sweep's commit carried one row that is not its own, and the fact is
recorded rather than left in the commit.** `5982db8` took the working-tree
content of `.factory/INTAKE.md`, and the other Chief session's correction to
the `probe-verify-published-counts-2026-10-21-1240` row — WI-062's dispatch,
corrected from **queued** to **done** — was in that working tree when the
commit ran. **The check before committing looked at the diff's file names and
not at its content, which is the check that would have caught it.**

**It is not being rewritten.** The correction is right — WI-062's verification
finished at 15:58 and the item is accepted — it is where it was going, and
rewriting `main`'s history while another session commits on top of it is a
worse trade than a container carrying one extra row. The group post that would
have said this out loud was **refused — the round is mid-discussion** — so it is
here.

**And the tiebreak this sweep did not take.** **WI-039's verification is
blocked on `CONTRACTS.md`, and `wi/046-domains-interaction-model` holds that
file.** This sweep does not decide that: it is the lead's call, whether the
verification waits for that branch or is scoped to the WI-039 entry alone, and
**a tiebreak made silently is a rule broken silently.**

## The fourth push — 2026-10-21 16:20

**`main` is on the remote at `8dcf69d`.** The owner was asked with the evidence
in the question and said yes: **17 commits, 22 files, +1662/−132, fast-forward**,
visibility unchanged at private, nothing rewritten. The pre-push hook ran and
passed.

**The evidence, and the gap between what was measured and what was pushed.**
The pipeline ran on **`71c9297`** and **both legs were green: CI success on all
four jobs (Build and test, Dependency audit, Lint the workflows, Build and run
the stack), and CodeQL success.** This session measured the same tree
first-hand: **typecheck 0, `format:check` 0, 346 tests across 39 files, build 0.** **The tip moved two commits past the measured sha** — `597c759` and
`8dcf69d`, both the other Chief session's — and **both touch documents only**:
`git diff --name-only 71c9297..8dcf69d` is `.factory/INTAKE.md` and
`.factory/work/WI-062.md`, and **nothing under `apps/`, `packages/`,
`scripts/` or `.github/`**. **Every line of code that was pushed is the code
the pipeline measured.** The format gate was re-run on the pushed tree and
passed.

**What rode along.** **The stall watchdog** — `.factory/watchdog.md`, the
schedule `sch_6db03ac6ba13`, and `FACTORY.md`'s pointer to it from the loop.
**The second-verifier answer**, and the question closed. **WI-027's
verification** and the second instance of WI-065's drift, attached to WI-031
where it blocks acceptance. **WI-045's implementation**, merged, and the close
path's contract note with it. **WI-062 accepted**, by the session that wrote
neither half of it.

**And the accept queue moved, which is the thing the day was for.** **Four
verifications closed since 15:27** — WI-027, WI-021, **WI-062**, and WI-036 —
**the first closures since 09:48.** Before the livelock was cleared the queue
had not moved in six hours. **The cause is measured, not argued: a turn held
one of the factory's two slots for 119 minutes, Probe's chat sat idle the
whole time, and the group's diagnosis — that one verifier was the constraint
— was wrong.** The watchdog now finds that within 30 minutes without a human
noticing, and **the check reports rather than cancels**, because five
legitimate tasks that day ran past two hours and every one of them finished.

**A push is still not an acceptance.** WI-017, WI-024, WI-031 and WI-037's
verifications are queued and unrun. **What is on the remote is code the
pipeline approved, not code the factory has accepted.**

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was measured; adding a record of the push makes it a
different tree. **`main` waits for the owner's next word.**

### WI-036 is accepted, and the verdict caught a defect in the lead's own brief

**WI-036 is verified — all five criteria hold** — and **accepted** by the
session that wrote none of the three halves: the record is Wren's (`edbd105`),
the merge (`c6e77d7`) is the other Chief session's, and the verification is
Probe's.

**Probe re-derived the numbers its own way rather than trusting the record.**
The lockfile has **500** package entries excluding the root — **488**
third-party, **6** `link: true` aliases (`node_modules/@personal-os/*`), **6**
workspace roots (`apps/server`, `apps/web`, `apps/worker`,
`packages/agent-adapters`, `packages/contracts`, `packages/ui`). The record
covers **494**: the 488 third-party plus the six first-party, whose `lockPath`
is the **alias** path, whose `spdxId` is **`null`**, and whose `firstParty` is
an **object** carrying the workspace path. Attribution: **375** licence-file +
**16** package.json field + **97** published identifier = **488**. **11**
distinct licences, and the approved set's 11 entries' package counts sum to
**488** exactly. **What the product can now do because of it:** the factory can
say what it borrows, read from each package's **own file** rather than from a
listing — and **the answer to the hard case is a fact now, not a hope: not one
dependency is under the AGPL, the GPL or the LGPL.** The only copyleft is
MPL-2.0 — `lightningcss@1.32.0` and its eleven platform variants — named one
by one.

**And the verdict caught a defect in the lead's own brief, which is the most
useful thing in it.**

**The brief this session gave Probe for WI-038's gate script said: _"The record
carries the six workspaces as `spdxId: "first-party (no licence yet)"`"_ — and
**that is false.** The six carry **`spdxId: null`**; the string is a **family
label in `agpl.familiesRead`**, and it is on no entry. Probe measured the
record while verifying WI-036 and reported it, unprompted: **"a gate would
fail on them, and the lead should know before WI-038 is written."** A gate
written from the false brief would have failed on **six first-party packages\*\*,
on every build, in the one gate this factory is adding to prove it can catch
things.

**Both readings of the false brief fail, which is why it had to be replaced
rather than annotated.** Skipping by the `spdxId` string skips **nothing** —
no entry carries it — and skipping by `link: true` skips the six **aliases**,
which the record _does_ cover, and leaves the six **workspace roots**
uncovered. The real skip is by **`firstParty.workspace`**, or by the lockfile
root's `"workspaces": ["apps/*", "packages/*"]`.

**So the brief was cancelled and re-issued** — `task_63e621ad515f` cancelled,
replaced by `wi-038-licence-gate-script-corrected-2026-10-21`,
`task_445db8e16adc`, self-contained, with every number measured rather than
remembered. **And this session measured the record itself before re-issuing
it**, rather than taking Probe's figures on trust: the 500, the 494, the 6
aliases, the 6 workspace roots, the `null` spdxId, the `firstParty` object, the
12 families of which one is not a licence. **The correction is also in the
brief: the gate must compute every count itself and must not read the
record's `summary`, because two of that summary's numbers are wrong.**

**The rule this establishes, and it is the same rule as everywhere else: a
brief that states a fact about the code is checked against the code before it
is sent.** The lead's briefs state facts — line numbers, field names, the
shape of a record — and **a fact in a brief is a claim, and this session
repeated one it had not measured.** The verifier caught it, and **the thing
that saved the gate was a verifier asking a question in a report rather than
the lead being careful.** That is the factory working.

### WI-036's findings are routed

**Dispatched to Wren** — `wi-036-record-numbers-and-evidence-2026-10-21`,
`task_678dfc957439`:

1. **`summary.distinctLicences` reads 12** and counts the first-party bucket as
   a licence; **there are 11**, and `docs/strategy.md:576` already says
   "accepts all eleven licences above" — **the document is right and the JSON
   is wrong by one**, in the one place a machine reads.
2. **`summary.lockfilePackageEntries` reads 494**, which is the number the
   record _covers_; the lockfile has **500**. **The field name does not
   describe the number it holds.**
3. **17 of the 375 licence-file entries quote the copyright header** rather
   than the licence text — 11 BSD, 4 ISC, 1 MIT, 1 Blue Oak. **The licences
   recorded are right in all 17**; it is the quoted lines that do not identify
   them, and **re-quoting them in the record makes the prose true without
   editing the prose.**
4. **`PRODUCT.md` §10 carries no note**, and the want named one.

**`docs/strategy.md` is deliberately out of scope of that dispatch** — it was
written by hand by the other Chief session as recently as 14:52 and it is live
in that session's item. **One file, one live item**, and the JSON alone can
carry the whole fix.

## The check now carries the one signal the fleet state cannot give — 2026-10-21 16:30

**A healthy long task and a livelock are indistinguishable from outside, and
that was measured rather than assumed.** At 16:24 a group task had been running
43 minutes. **Its session status was `started`, and the last message its bot
had posted to the chat was empty** — because the engine appends an empty
placeholder when a turn starts and the real text when it ends. **The
livelocked turn of 13:13 had exactly the same two properties.** Both signals
are the same for both cases, so **no automatic action is safe**, and the check
reports. That is now written into the file rather than left as a habit.

**So the report carries one more thing: the session status**, read with
`mavis session get` on the task's `sessionId`. **`started` means the turn is
still in flight.** It does not clear the task — a healthy 43-minute task and
the livelock both showed `started` — but it tells the reader that **nobody is
watching a corpse**, and it is the one thing a reader cannot get from the fleet
state alone.

**The schedule changed, and the change is recorded rather than hidden.** The
old id **`sch_6db03ac6ba13` fired twice** — **15:50:26** and **16:20:56**, the
second exactly 30 minutes after the first — and both firings found nothing
over the threshold and said nothing. **It was deleted and replaced by
`sch_0e4ff8fa16b2`**, whose prompt carries the session status in the report.
**The new id's `last_run` is null and its first firing is 16:57:39: it has not
fired yet, and the two verified firings belong to the old id.** A schedule can
be deleted outright — unlike a cancelled batch, which keeps its request id
forever.

**The procedure lives in the repository, and the schedule is only the
trigger.** `.factory/watchdog.md` is the check; `sch_0e4ff8fa16b2` says "read
that file and follow it". **A check whose knowledge lives in one session's
memory is not a check**, and this one has been read by a schedule twice and by
a person twice.

**And `main` is green on the platform at the pushed sha.** `8dcf69d` — the
tree the owner authorised — **CI success on all four jobs and CodeQL success**,
read from the run itself and not from a summary.

### The post that is owed — request id `status-2026-10-21-1635`

`post_group` answered **"The group is mid-discussion; post again once this round
finishes"** again, at 16:35. **The request id makes the retry idempotent
rather than a second post**, so it is recorded here and sent when the round
opens. **The post was written and its content is here:** WI-036 accepted (all
five criteria, Probe's own arithmetic — 500 lockfile entries, 494 covered, 375

- 16 + 97 = 488, 11 licences summing to 488, and **not one dependency under the
  AGPL, the GPL or the LGPL**); **the WI-038 brief corrected and re-issued**
  after the lead's own brief was caught stating the record wrongly — `spdxId:
null`, not a licence string, and **the six uncovered lockfile paths are the
  workspace roots, not the `link: true` aliases**, so the old dispatch
  `task_63e621ad515f` was cancelled and `task_445db8e16adc` carries the measured
  numbers; **WI-036's findings dispatched to Wren** as `task_678dfc957439` with
  `docs/strategy.md` deliberately out of scope; WI-062 accepted; the gates at
  `cafdc45` — typecheck 0, test 0 (server 219 · web 52 · worker 31 ·
  agent-adapters 16 · contracts 28), format:check 0, build 0; **seventeen items
  accepted**; and a note that **two sessions are in one checkout** — this
  session's ledger edits were swept into the other session's commit at 16:28, so
  **the record was not lost but it was committed under a message that does not
  describe it**, and the commits here are path-limited and stage only this
  session's own files.

### Two agents in one checkout, and what it cost today

**This session's ledger edits were committed by the other session at 16:28**,
inside `04f3506` — _"Give the stall report the one signal the fleet state
cannot give"_ — because both sessions work in `G:\code\personal-os` and that
session ran `git add` on a file this session had also edited. **The record was
not lost: every section is intact, verified by reading it back.** But it was
**committed under a message that does not describe it**, and one markdown
escape artefact (`\*\*`) came with it, which this session corrected.

**The rule this makes concrete, and the factory already had it.** The work-item
script's own docstring says it: _"one worktree per work item... two agents in
one checkout overwrite each other."_ **Chief's ledger is the exception that
created the risk** — both sessions write `INTAKE.md`, and the doctrine has
always made the ledger shared. **The mitigations that worked:** commits are
**path-limited** and stage only this session's own files, so a later commit
cannot sweep a neighbour's work into its message; and **this session left the
other session's in-flight files alone** — `docs/strategy.md` and
`apps/server/src/__tests__/resource-templates.test.ts` were in the working
tree and were not touched, not formatted, and not committed.

**What is still true after it.** The other session's `04f3506` also brought in
this session's `docs/strategy.md` scope decision's counterpart: this session
dispatched WI-036's findings with **`docs/strategy.md` out of scope**, because
that file was being written by hand by the other session at 14:52. **The two
sessions collided on a file and the ledger caught it before a dispatch did.**

### A red on `main` with every assertion green — and two numbers written over

**At 16:38 the server suite went red and nothing was wrong with the code it
was testing.** `npm run test` at `main`:

```
 ❯ src/__tests__/verifyStack.test.ts (12 tests) 49990ms
⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/__tests__/verifyStack.test.ts [ src/__tests__/verifyStack.test.ts ]
 ❯ src/__tests__/verifyStack.test.ts:133:34
 Test Files  1 failed | 22 passed (23)
      Tests  230 passed (230)
```

**230 tests passed and the file still failed.** The failure is the file's own
teardown: `apps/server/src/__tests__/verifyStack.test.ts:131-134` —
`afterAll(async () => { await Promise.all(children.map(stop)); for (const dir
of dataDirs) fs.rmSync(dir, { recursive: true, force: true }); }, 30_000)`.
**The error site is `:133:34`, `fs.rmSync`, and the hook's budget is the
`30_000` at `:134`.** The file took **49 990 ms**.

**The children are not the unbounded part.** `stop()` (`:106-119`) resolves on
the child's `exit`, and a 4-second timer sends `SIGKILL` and resolves anyway,
so `Promise.all(children.map(stop))` costs about four seconds. **The removal
is what ran past the budget** — and on Windows, removing a tree that a
just-killed process still holds open is exactly the operation that blocks.

**It did not reproduce.** `npm --prefix apps/server run test` → **exit 0**, 23
files passed (23), 230 passed (230). `npm run test` over the whole tree →
**exit 0**, 23/23 and 230/230, then web 52, worker 31, agent-adapters 16,
contracts 28. **The machine was under load when it went red** — this host also
runs other tenants' containers (`shiny-octo-broccoli-webui`,
`technitium-dns-companion`) beside the shared `personal-os` stack, and Chief
was running a git check and a docker check at the same moment.

**So it is opened as WI-074 and handed to Probe** —
`wi-074-stack-test-cleanup-budget-2026-10-21`, `task_289ede939140` — and the
reasons are said out loud rather than shrugging at. **A suite that passed
every assertion must never be reported as failed.** **CI runs on
`ubuntu-latest`, and the budget that the removal overruns is not
Windows-specific even though the blocking is** — so the same budget can be
exceeded on a busy runner. And **a gate that can go red for no reason is a
gate that trains people to ignore it**; this factory already spent a day on a
smoke gate that was flaky on Windows and fixed in `63aba3a`.

**And this session wrote over two of the other session's item files.**

**WI-070 and WI-071 existed and were written over by mistake**, the same
minute they were overwritten, and **both were restored from `HEAD` byte for
byte** — the working tree was clean afterwards, and the other session's files
are untouched. The cause is plain: **the number space is shared and two
sessions write into it**, and this session had not seen that the other session
opened **four** items at once at 16:24 (`8575e10`, "Open the four streams of
the free window") — WI-070, WI-071, WI-072 and WI-073.

**The collision is recorded in WI-074's own file, because that is the only
place a reader will look.** And the other session had already handled the
first half of this correctly: they took WI-069, found this session's WI-069
(`8f87d87`) already on `main`, **renumbered to WI-070 and recorded the
collision in the item** — which is exactly right, and which is why their
WI-070's own note names this session as the number space owner.

**So the number space, as it now stands.** WI-030–WI-038, WI-044, WI-045,
WI-062, WI-065–WI-069 and **WI-074** are the number space owner's; WI-024–WI-029
and WI-039–WI-043 are the other Chief session's; WI-046–WI-064 are the
strategy session's; and **WI-070, WI-071, WI-072 and WI-073 are the other
Chief session's**, opened together at 16:24. **The top is WI-073, so the next
free number is WI-074, and this session took it.**

**And the rule this makes concrete, for the second time this week.** WI-063
became WI-065 the same way. **The remedy is the same and it is cheap: renumber,
restore what was overwritten, and write the collision into the item that lost
it.** It is cheap only because the items are committed. **An uncommitted item
file written over is an item file lost**, and this one was committed.

## The peer session asked for two dispatches; one was owed, one was already done — 2026-10-21 16:55

**The peer Chief session asked this session to dispatch two things its own guard
refused — _"This Bot is replying in multiple chats, so this tool call cannot be
assigned safely"_ — and to do them under the request ids it had reserved.**
This session's guard was clear, so it could.

**One was dispatched exactly as asked, under the peer's own id and title.**
**WI-010's re-verification**: request `wi-010-verify-repaired-document-2026-10-21`,
batch `batch_c461fb5d999b`, task **`task_2f3e137d63ee`**. **The brief was
written from the item's own record** — `.factory/work/WI-010.md` under "Repairs
— D1 to D6, applied 2026-10-21" — plus the three facts the repair moved, plus
that nothing under `apps/`, `packages/` or `scripts/` moved, plus the guard
clause the peer asked for, plus **the ADR edit at `b1b9ee9` named as the lead's
separate work and not part of the verdict.**

**And two more were dispatched, because the peer's own sweep assigns them to
the session that holds the queue, and this session holds it.** Its ledger says:
_"Dispatching WI-007, WI-010 or WI-025 from a second session is two verifiers
on one item. The four are recorded here as **ready to go**, with the lane
named, so the session that holds the queue takes them in this order: **WI-007,
WI-010, WI-025** — the three with a free lane — and WI-039 when `wi/046`
clears `CONTRACTS.md`."_ **All three were in inventory**: the work landed and
no verification was ever dispatched, so none of them could have been accepted.

- **WI-007**: `wi-007-verify-fixed-tree-successor-2026-10-21`, batch
  `batch_bc1a40770076`, task **`task_797badb7e918`**. The previous
  verification, `task_2e431d7647e5`, **failed at 11:10:17 with an empty
  result** and was never re-dispatched.
- **WI-025**: `wi-025-verify-adr-record-pass-successor-2026-10-21`, batch
  `batch_6774b75d3ec7`, task **`task_5cf2b97b54ce`**. Probe's verification
  found three defects, **Wren fixed them at 11:58**, and **the re-verification
  was never dispatched.** The brief adds one thing the peer's list did not:
  Probe said to leave the ADR's verbatim quote of the boundary rule alone, and
  **that quote changed at `b1b9ee9`**, so the brief checks it is both verbatim
  against the document's current text **and carrying the exception**.

**WI-039 is not dispatched, and the tiebreak is taken out loud.** `wi/046` still
holds `CONTRACTS.md`, and verifying WI-039 against `main` measures a tree that
does not carry WI-046's contract changes. **Scoping the check down to the
WI-039 entry alone was available and was not taken** — the verification waits
for `wi/046`.

**The second ask is declined, and the id should be retired rather than
dispatched.** The peer asked for a short note to Cog — request
`wi-024-premise-correction-2026-10-21` — on the grounds that _"a brief that
predates the correction would carry the old premise."_ **That state ended at
15:29, in the peer's own commit `5402ad2`**, whose message says: _"The lead
wrote that WI-024 'is queued and has not run' and that 'the correction lands
before the briefs are written'. **Both were false**: the dispatch ran 11:35:05
to 12:15:08 and wrote the six briefs at 11:58, and the ruling was at 15:09."_
**Measured in the tree:** `prototypes/briefs/05-needs-you-rail.md` no longer
contains _"moves out of the root"_ or _"the rule the item states"_; line 37
reads _"**And the landing page is not the list any more.** The item's rule, as
corrected on 2026-10-21, is that the **root route is the Map room** and the
**Needs-you rail**…"_; `01-rooms-and-surfaces.md:33` reads _"The root route
lands on the **Map room**"_. **The briefs were last changed at 15:29, after the
ruling at 15:09, and Cog has no live task and no queued task at all.**
**So the correction has already reached Cog through the file** — the channel
the peer itself named as sufficient — **and a note telling a worker that a
premise changed when it has already changed is a false statement to a worker.**
It would also spend a slot on an idle lane to wake Cog to re-read briefs that
are already right, **with the risk that Cog reads it as "redo the briefs" and
writes a second set.**

**Two corrections to the peer's message, because the record was wrong in both
places and a wrong record is what this factory has a rule about.**
**"`main` is not pushed; the owner's word was spent at 08:56" — it is pushed.**
The owner gave a **new** explicit word at **16:20**, and `main` went to
`origin` as a fast-forward: **`e18bfff..8dcf69d`, 17 commits, 22 files,
+1662/−132, nothing rewritten, still private**, with **CI success on all four
jobs and CodeQL success** read from the runs. **The peer's own commits rode
along in it** — `b1b9ee9`, `60a4561` and `5402ad2` are all on `origin/main`.
And **"WI-024 is queued and has not run" — it ran**, at 11:35:05 to 12:15:08.

**The ADR edit stays the lead's, and is not re-routed.** The peer asked whether
it would be better as Wren's. **WI-025's ownership was already transferred to
Chief** for exactly this reason — _"a file whose owner is not running does not
get written"_, and the ADR is the product's own decision record — **so the edit
sits inside that transfer rather than outside it.** **The remedy is that it is
verified like any lead's edit**, which is what WI-025's new verification does,
and **WI-025's acceptance is the peer's, not this session's**, because the
session that wrote the ADR does not close it.

### WI-037 is accepted, and the direction is recorded with the loser visible

**WI-037 is verified — all four criteria hold, no defect** — and **accepted**
by the session that wrote none of the three halves: the product record is
Wren's (`0024f88`), the merge (`94d110f`) is the other Chief session's, and the
verification is Probe's.

**What the product can now do because of it: the direction is recorded, dated,
and keeps the loser visible.** `PRODUCT.md:282-284` names **D — Forge**, chosen
by the owner on **2026-10-21**, against the factory's recommendation of **B —
Desk**, and it is recorded in ADR 7 — **the same sentence the ADR carries, date
and em-dashes included** (`docs/decisions/0007-…:140-141`). **The loser is
still in the record**, so a reader who remembers "the recommendation was Desk"
can see that the recommendation was **overruled** rather than silently
changed. The old story — _"recommended rather than decided, and the owner has
one word to say about it"_ — is **measured gone from the file**.

**The accent rule is conformed, and the conformance holds.** It is named the
same way in both documents — **"One accent with one meaning"**
(`PRODUCT.md:270`; ADR `:204-205`) — and the load-bearing amber clause is
**identical, word for word**, after normalising italics and whitespace: _"amber
is the one collision that breaks it, because in Forge amber always means live
or waiting on you and never caution, so a caution block has to become neutral
or use the error colour."_

**And nothing else in the product record moved.** `0024f88` touches
**`PRODUCT.md` only** — 1 file, 12 insertions, 9 deletions, the whole diff
inside §11. `c61e3e8` touches **only** this item's own `State:` line. The
merge `94d110f` brought exactly those two files. And **no one has touched
`PRODUCT.md` since** — `git log 0024f88..HEAD -- PRODUCT.md` is **empty** — so
the other live Wren task has not moved it either. **The only mentions of Desk
or Forge anywhere in the product record are the ones in §11**
(`PRODUCT.md:271-284`).

**The two observations are recorded in the item, not dispatched.**

1. **The ADR moved under the item, but not where it matters.** `b1b9ee9`
   re-synced the **boundary** quote; the accent rule is untouched, so the
   conformance the item was built against still holds.
2. **The product record's rule carries one sentence the ADR's quote does not**
   — _"Structure and data stay in their own colours."_ It **was already there**
   and it does not contradict the ADR, but Probe is right that it is worth a
   clause **so that nobody later reads the extra sentence as a divergence
   between the two documents.**
3. **And the product record names the ADR in plain text** — _"recorded in ADR
   7"_ — while the ADR links back to the product record both ways. The product
   record is the document a new reader opens first, and a plain-text reference
   is one more click.

**None of the three is a defect, and `PRODUCT.md` carries a live Wren task**, so
none is dispatched: **one file, one live item.** They are written into
WI-037's own file, which is where the next Wren product-record item will read
them.

### WI-017 is accepted, and the contract led the code by four hours — 2026-10-21 17:10

**WI-017 is verified — all seven criteria hold** — and **accepted** by the
session that wrote none of the three halves: the implementation is Cog's
(`8b1fd01`, 12:41), the contract is Wren's (WI-030, `e682224`, 08:25:55), and the
test is Probe's (`052f050`, 16:31). **Nineteen items are accepted** — measured
off the item files' own `**State:**` lines, not off a memory of them.

**What the product can now do because of it: an agent that does not know what a
good resource looks like can ask.** One template ships for each of the six
resource kinds — `dashboard.metrics`, `document.brief`, `data-source.json`,
`automation.manual-prompt`, `task.deliverable` and `memory.decision-note` — and
an agent reads one through the MCP surface it already uses, rather than
guessing the shape from a schema.

**And the boundaries are the point.** A template is **not a row**: no table, no
workspace, no revision, no `createdBy`, and the `resources` table carries no
template column — the registry is the same for every workspace. A resource made
from a template **is the resource its spec would have produced**, field for
field (everything but `id` and `updatedAt`), with the same audit entries, and
**Probe compared the deltas rather than the counts**. The failures are honest
too: a template whose spec the provider refuses is refused with the published
`validation_failed` and nothing is created; the same spec offered as a plain
spec is refused by the provider too, so the refusal is the provider's and not a
policy; an unknown template is `not_found`; a template of another kind is
`validation_failed`; and a call carrying **both** a spec and a template is
`validation_failed`.

**Probe wrote the criterion no test met, and proved the pins bite.** The
implementation shipped with no test for the template record, so criterion 6
carried Probe's own file: `apps/server/src/__tests__/resource-templates.test.ts`
— **449 lines, 11 cases**, all driven through the MCP surface an agent uses.
Removing the provider's check in
`apps/server/src/modules/resources/service.ts` turned _"refuses a template whose
spec the owning provider rejects"_ red (1 failed | 10 passed); removing the
mutual exclusion in `apps/server/src/modules/mcp/server.ts` turned _"refuses a
call that carries both a spec and a template"_ red. **Both were restored, and
the product diff is empty** — a proof, not a claim.

**And the contract led, which is the rule the item was written under.** WI-030's
entry landed at **08:25:55** (`e682224`) and the implementation at **12:41:31**
(`8b1fd01`) — **four hours and fifteen minutes earlier**.

**The three findings, and where each one goes.**

1. **A defect in the published contract, and it is already being corrected.**
   `CONTRACTS.md:578-586` — the implementation-status paragraph of "### The
   template record" — is **false in every clause**: _"The code does not implement
   this yet… there is no template record… the server has none."_ Every one of
   those was false within half an hour of being written, and every one of them
   is false now — **re-read at 17:09 for this paragraph, not quoted from
   memory**. **The shapes themselves agree with the code**, so this is a status
   paragraph and not a shape: **WI-065's job**, live in Wren's queue as
   `task_6274afe1abc1`.
2. **Observation, and a third class of gap.** The same surface answers two
   different codes for _"a spec the provider refuses"_: the **template** path
   answers the published `validation_failed` ✓, and the **spec** path answers
   `internal_error`, because the provider's zod error is not an `AppError` and
   `errorResult` maps anything else to `internal_error`
   (`apps/server/src/modules/mcp/server.ts:48-57`) — **and `internal_error` is
   not among the codes the error envelope publishes**
   (`CONTRACTS.md:1300-1301`). **This is pre-existing behaviour of
   `resource.create`**, not something this item introduced, but the template
   path makes the contrast visible. It is named here so it is not lost, and
   **it is not dispatched** — the contract change in it is the owner's call.
3. **Observation.** The entry's tool table (`CONTRACTS.md:555-558`) and the MCP
   exposure table (`:678`) agree with the code's tool name and purpose ✓, and
   the citation `packages/contracts/src/mcp.ts:11-23` still brackets the
   tool-name list ✓.

**And Probe's question is answered by the lead's own ruling.** Probe asked
whether a check should watch the implementation-status claim, and answered
_yes_ — it is **WI-075**, `task_db738ae1549b`, with the narrow form as the
must-have, the general form attempted if a reliable detection exists, and **the
merge gated on WI-065's correction so that `main` never goes red.**

### The queue's real constraint, measured at 17:25 — slots, not verifiers

**All eleven of Probe's verifications are queued and none is running**, checked
one by one at 17:25: WI-041, WI-031, WI-045, WI-074, WI-024, WI-038, WI-022,
WI-010, WI-007, WI-025 and WI-075 — **eleven `queued`, zero `running`, zero
`done`**. **And the reason is two tasks that are both legitimately running**:
Wren's WI-034 implementation (`task_55c33b744ef5`, kind `bot`, its own chat,
started **17:15:20**) and the group's own round — **this session's turn**
(`task_ef428a0ed84b`, kind `discussion`, chat `group:grp_cc2adeea48f4`, started
**17:17:05**).

**So the accept queue is not waiting on Probe's capacity. It is waiting on the
factory's two slots, and one of them is this group round.** A group round holds
a slot for the length of the round, and the round is long because the status is
written carefully — **so the careful reporting and the verifications are
competing for the same two places.** The thing to say out loud is that **the
fix is fewer, shorter rounds and one batched status, not another verifier** —
which is the shape the owner's 15:40 answer already chose, and this measurement
confirms it from the other side.

**And the gates are green on the tree that accepted WI-017.** typecheck 0, test
0 (server 23 files / 230 tests · web 52 · worker 31 · agent-adapters 16 ·
contracts 28), format:check 0, build 0 — measured at `2f8ed30`, after WI-017's
acceptance landed.

## The 462-minute stall — cancelled, and the watchdog corrected twice

**The full account, with the measurements, is in `.factory/watchdog.md`** — the
watchdog file carries the correction to its own discriminator, and this section
is the ledger's pointer to it. **This section was appended, then dropped by a
whole-file write from the other Chief session at 17:22, and re-appended.**

**The slot.** `task_721e68cc2556` — a discussion task in the Personal OS Factory
group — started at **08:28:11** on 2026-10-21 and was still `running` at
**17:10**, **462 minutes**, holding one of the factory's two dispatcher slots.
`MAX_RUNNING = 2` is hard-coded in the runtime's dispatcher, so **one task that
had already delivered its work was worth half the factory.**

**What it cost, measured.** The factory's own daily tick, `task_ef428a0ed84b`,
was **created at 12:00:46 and queued for five hours** because there was no slot
for it. The accept queue stood at **32**. And the watchdog's **16:57:58** run —
the first run while something was genuinely over the threshold — **died with
`AGENT_UNAVAILABLE` after two retries**, so the stall was never reported at all.

**The cancellation, and the evidence it rested on.** The task's `result` was the
**11:50** post (`msg_fef6d97d1eb0`, 7456 characters), its work was committed and
pushed (`4cc09c2`, `84c4365`, `13342cf` — all ancestors of `origin/main`), and
its chat had posted nothing for five hours. Cancelled at **17:10:25** with
`cancel_tasks`. **The slot refilled in twelve seconds**: the daily tick started
at once, `task_55c33b744ef5` (WI-034) took the other, and the queue went
**32 → 31**.

**And then the task's own last words were read, and they were not idle.** Its
chat's last message — `msg_29329712a9b1`, `kind: task_review`, **started
16:59:05**, `status: streaming` — was a turn **eleven minutes old** that had
accepted WI-037, dispatched WI-075, and was midway through writing WI-017's
acceptance. **The cancellation aborted it mid-write.**

### The correction — and it is in `.factory/watchdog.md`, not overwritten

**"The task's `result` is five hours old" does not mean "nothing has happened
since".** A `task_review` continuation turn runs under the **same `taskId`** and
posts new messages **without touching `result`**. The task's `result` records
the last **settled** turn of the task, not the task's current output.

**The sound liveness signal is the chat's last message from that bot: its
`startedAt` and its `status`.** The engine appends a placeholder with
`status: 'streaming'` when a turn starts and flips it to `done`, `error` or
`aborted` when it ends. The idle window was real and it was five hours
(11:51:26 → 16:59:05), and then the task woke up. **A check run at 13:00 would
have been right to cancel it; a check run at 17:05 would have been wrong to.**

**So cancelling now has two conditions, not one:** over the 45-minute threshold,
**and** the chat's last message from that bot is not `streaming`. The file's old
rule — _"never cancel a task whose chat is showing fresh output"_ — was right,
and it was written as a caution instead of as a **precondition**. That is the
error, and it is now the precondition.

### What the cancellation cost, and what it did not

**Survived:** `3816382` (WI-037 accepted), `df3a5c1` (the owner's two answers)
and `c136b8e` (W6 accepted, WI-063's renumbering repaired) — all committed, all
ancestors of `HEAD`; and WI-075's dispatch `task_db738ae1549b`, **queued**.

**Not committed:** `.factory/work/WI-017.md`'s acceptance — written but
unformatted and uncommitted — and `.factory/work/WI-075.md`, untracked. **Both
are the peer session's files and this session did not touch them.** The peer
was told, in the session message, exactly what survived and what did not, and
asked to commit them before anything discards them.

**WI-075's dispatch has no row in the dispatch table yet.** It is live, and the
row belongs to the session that dispatched it.

### The watchdog corrected three more ways

1. **The check needs no fleet slot.** A schedule fires by `fireSchedule` →
   `runBotTurn` in `engine.mjs`, into the bot's own chat; it never enters the
   dispatcher's queue and is not subject to `MAX_RUNNING = 2`. Measured: the
   watchdog reported normally at **15:50:26** and at **16:20:56**, and at both
   moments **both dispatcher slots were occupied**. **The belief that a wedged
   factory can starve its own watchdog was wrong.**
2. **A failed check is invisible.** The runtime advances a schedule's `last_run`
   whether the turn succeeded or failed, and it creates **no task** for a
   schedule — so **a failed check is indistinguishable from a clean sweep** in
   the fleet state. The error survived only in the chat's message record. **The
   check now reads its own previous run and carries a failure forward.**
3. **The report channel fails exactly when it is needed.** `post_group` is
   refused with _"the group is mid-discussion"_ while a group round is open —
   **and a stalled group round is precisely what keeps a group round open.** The
   462-minute stall's report was **refused at 17:12** by a _healthy_ group
   round. **The report must not depend on the group post**; it lands where the
   check already runs, and the group post is an extra attempt that may be
   refused.

**And silence is ambiguous, so the check now always says what it measured** —
one line when nothing is over the threshold, the full report when something is,
and a ledger line whenever it finds something **or whenever its previous run
failed**. The old rule — _"do nothing and say nothing"_ — is what let a failed
check look like a clean one.

**The check also learned where the fleet state actually lives:** `taskBatches`
is an **array of batches**, each with a `tasks` array — not a keyed object.
Reading it as an object yields nothing, and that is how a reader loses twenty
minutes.

### What is still owed

The stall report to the group, request id
`factory-group-stall-report-2026-10-21-1712`, was **refused at 17:12** and is
**owed**. **This section is the report's content**, so it goes out intact when
the round opens.
