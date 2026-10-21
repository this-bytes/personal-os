> The factory's process record — the entries it wrote about itself — is in
> [history.md](history.md). It is kept for the record; it is not part of the
> state. This file is the state: the queue of wants, the decisions, and the rules.

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

## Numbers claimed in the 48-hour build

The number space has one owner: the session that leads implementation in a
tree. During the 48-hour build that is the session running the push below,
and it holds the block **WI-090 to WI-096** so that two sessions cannot claim
the same number.

| Number | Item                                                       | Owner  |
| ------ | ---------------------------------------------------------- | ------ |
| WI-087 | The stranded branches, and what is actually worth keeping  | worker |
| WI-088 | The ledger split into what it is and what it was           | worker |
| WI-090 | The substrate the product's own two measures stand on      | worker |
| WI-091 | The gate that notices when a published contract goes false | worker |
| WI-092 | reserved                                                   |        |
| WI-093 | reserved                                                   |        |
| WI-094 | reserved                                                   |        |
| WI-095 | reserved                                                   |        |
| WI-096 | reserved                                                   |        |

**WI-089 is not in this block and does not belong to it.** The peer session
holds WI-089 for the hot-reload item, and held WI-088 before it. Both numbers
were collisions with this push and both were resolved by re-filing, not by
reusing. **Take a number from this block, not the next free one above the
highest taken** — on 2026-10-22 that rule produced two collisions in twenty
minutes, because it cannot see an item that has not been filed yet.

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
| `wi-007-verify-fixed-tree-2026-10-21`                      | WI-007 — the fixed tree, verified                                       | Probe  | `task_2e431d7647e5` | **done** — Probe's verification of the fixed tree **reached the group on 21 Oct and carried the acceptance**: the report is measured at `63aba3a` and names every pin, and **WI-007 is accepted** (18:05) on it, with the gates re-measured on today's tree. The task itself failed with `BUSY` at 10:10:17, but the work was evidenced: Probe's own session read the item, wrote and committed the end-to-end pin `d343300` ("Hold the note about a decision to the item it is about"), and ran the suite                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-007-migration-note-2026-10-21`                         | WI-007 — the migration note's missing sentence                          | Wren   | `task_e6fe9555ca74` | **done** — one sentence of `CONTRACTS.md`, and the last thing between WI-007 and acceptance: **it landed at `3479c31` (11:18)**, and WI-007 is accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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
| `wi-041-readme-licence-2026-10-21`                         | WI-041 — the README tells the truth about the licence                   | Wren   | `task_644f23312ebc` | **SPENT, and the row was wrong** — this request id was the "deliberately undecided" implementation, `64d38f4`, merged `5012df2`. **It is not "the live dispatch on WI-041".** The MIT implementation that followed it was `wi-041-readme-mit-2026-10-21`, `task_d7f28085ef46`, **cancelled when the tiebreak took the file**; the verification that closed the item was `probe-verify-wi-041-readme-licence-2026-10-21-1340`, `task_5b4e02d59413`. **WI-041 is accepted** — see the acceptance row at the end of this table                                                                                                                                                                                                                                                                                                                                                                                                                                      |
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
| `wi-065-template-record-contract-status-2026-10-21-1330`   | WI-065 — the template record says what the code now does                | Wren   | `task_6274afe1abc1` | **dead with the runtime, and replaced** — the task's status went to `unknown` when the **Mini App's own dispatcher stopped** (measured and recorded in `.factory/watchdog.md`), and the turn stopped posting at **18:12:27** with the worktree clean, so **no work was lost and none was in flight**. Cancelled at 18:59 (unconfirmed), and the **replacement is dispatched**: `wi-065-template-record-status-replacement-2026-10-21-1905` / `task_2bf6b0a6164a`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |     |
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

| `wi-031-contract-status-correction-2026-10-21` | WI-031 — the entry says the code does not implement it yet, and it does | Wren | `task_be25e082ae5c` | **FAILED — and a failed task is not a dispatch.** `task_be25e082ae5c` was created for this correction and **came back `failed`**, so the row that said "queued" was wrong for hours and is corrected here. **The work has not been done and nothing is owed by it.** **The re-dispatch has gone out — by the peer session, which got there first — under `wi-031-contract-status-correction-r2-2026-10-21`, `task_70be52bdefa9`, batch `batch_faa4525ade7f`, to Wren, with the defect measured before the brief was written.** **A new id and a new title, because this one is spent.** **Until it lands, WI-031 is not accepted** |
| `wi-010-verify-repaired-document-2026-10-21` | WI-010 — the repaired direction document, verified | Probe | `task_2f3e137d63ee` | **done — ended 22:39:20, 2,995 characters — and the verdict is "verified, with two defects", so WI-010 is NOT accepted.** The report reached the group as `msg_task_925de8a43034` (10 227 characters). **Every repair D1 to D6 holds, the three moved facts hold, the boundary holds and the gates are green** — but two defects are open, **both the direction document's to fix**: D5's code pointers drifted after WI-031's land, and the trace's spend claim is a claim the contracts do not support. **The acceptance is the lead's, and it is not taken here — the item returns to its owner.** The return is dispatched as `wi-010-return-two-defects-2026-10-21`, `task_8377ee92cad2`, batch `batch_63357c20afb0`, to Vision, **with the lead's ruling on the boundary rule riding with it** |
| `wi-007-verify-fixed-tree-successor-2026-10-21` | WI-007 — the fixed tree, verified again | Probe | `task_797badb7e918` | **cancelled** at **18:24:50** — WI-007 is **accepted** on Probe's report, so the re-verification was redundant, and **one verifier, one item, one verification** is the rule. The cancel could not be issued from the turn that accepted the item (the `minimax-bot` tools were withdrawn then); it was issued at **18:24:50**, once they returned, and the slot went back to the queue |
| `wi-025-verify-adr-record-pass-successor-2026-10-21` | WI-025 — the ADR after the record pass, verified again | Probe | `task_5cf2b97b54ce` | **ACCEPTED — 2026-10-21, by the other Chief session.** Probe's re-verification (task `task_5cf2b97b54ce`, batch `batch_6774b75d3ec7`, measured on `main` at `7896bce`) found **all nine criteria hold**: D1 the pointer, D2 the count of travelling rules, D3 the figure — all fixed, and the substance untouched while they were fixed. **The session that wrote the ADR does not close it**, so the acceptance is the other Chief session's, and it is taken here. **Every claim was measured again by the lead before closing:** the ADR at `:5` names `a186c42`; `Select-String -Pattern '195|216|215'` over the ADR returns **zero matches**; `:204` and `prototypes/DIRECTION.md:110` both say "**Two rules travel with the direction.**"; the ADR's quote of the rule is verbatim against `DIRECTION.md:45-48` **and carries the Needs-you rail exception**; `git diff 0d4ec09..HEAD -- docs/decisions/0007-…md` is **three hunks and nothing else** — the pointer, the quote re-sync and the figure's removal. **Two defects Probe found in the item's own file were corrected by the lead** — the "268 lines" figure (the file is **366**) and the boundary rule quoted **without its declared exception**. **What the product can now do: the decision the owner made is findable in the place a reader looks for decisions** — ADR 0007 names **D — Forge**, with the date, against the factory's recommendation of **B — Desk**, says what was rejected and why, no longer asks a question that was answered hours earlier, and carries no figure the cost model owns. The full record is in `.factory/work/WI-025.md` under "The acceptance" |
| `wi-069-refusal-names-nobody-code-2026-10-21` | WI-069 — a delegation that names nobody is refused unreadably | Cog | `task_cac8204bf63a` | **DISPATCHED at 22:28 — this row said "NOT DISPATCHED — held on purpose", and it was wrong.** The code half went out to Cog as `task_cac8204bf63a`, batch `batch_48b9074135d0`, worktree `G:\code\personal-os-worktrees\069-refusal-names-nobody-code`. **The reason it was released is measured, not a change of mind:** the dispatcher fills its slots in batch order, so the verifications this would have displaced were already ahead of it. The full row is further down this table. **The contract half still waits on the owner's answer, and `wi-069-refusal-shape-contract-2026-10-21` is reserved and unspent.** The finding is Probe's, from WI-021's verification. **Two reasons, both said out loud:** the owner's line at 15:40 — _"when a slot frees, lean on verification"_ — and the contract half needs the owner's answer. **Numbered so it is not lost**, with the brief written out in full in `.factory/work/WI-069.md` |
| `wi-045-unconfirmed-turn-verify-2026-10-21` | WI-045 — an unconfirmed turn routes no further work, verified | Probe | `task_1df39fd407ea` | **queued** — **the verification of the owner's own answer**, dispatched the moment the implementation landed (`a4010bb`, merged into `main` at `66c86ad`). Six questions: the guard stops the routing, a confirmed turn is unaffected, **the stop is recorded where the unknown-outcome machinery is recorded**, the waiting list is unchanged, a test proves both halves, and what the contract publishes. **Chief's word is on the audit entry's target, and the doubt is named in the brief rather than hidden** |
| `wi-074-stack-test-cleanup-budget-2026-10-21` | WI-074 — the stack test's cleanup can outrun its own budget | Probe | `task_289ede939140` | **ACCEPTED — 2026-10-21, by Chief.** Probe wrote the fix (`31a38e7`, "Stop the stack test's teardown from being the reason a green suite is failed" — three test files, +513/−4) and **the lead verified it, because the session that wrote the work does not accept it.** **What the product can now do: the stack test's teardown can never be the reason a suite whose every assertion passed is reported as failed.** The lever is `maxRetries` (5, with a 100 ms delay) — **the one the measurement named, not a bigger number** — the teardown's worst case is 19 000 ms of the hook's unchanged 30 000 (pinned by a test), the twelve cases are unchanged (counted before and after, and pinned), and the twelve new pins **provoke** the failure rather than waiting for the machine. Gates measured by the lead on a clean scratch worktree: typecheck 0, test 0 (437), format 0, build 0; and the pipeline's own verdict on the branch that carried the new test code: **CodeQL success, CI success.** The full record is in `.factory/work/WI-074.md` under "The acceptance". **The task held a slot for 92.7 minutes, over the trigger, and it was reported and not cancelled: the chat was silent, but the files were being written at 22:04. It finished on its own at 22:46:01.** **And the duplicate discussion task `task_863981d9f4d3` was cancelled at 22:49 — its work had already landed, and a second copy of a report is not a report** |
| `wi-062-measures-citation-refresh-2026-10-21` | WI-062 — four citations in the measures section point at lines that moved | Wren | `task_169f434c05d9` | **queued** — **a citation refresh, not a change of content**: every claim in the measures section is true and only the line numbers are stale. Found by Probe while verifying WI-062. It queues behind WI-065 in Wren's serial lane, and **it must not touch the template record or WI-031's entry** — one file, one live item |

| `wi-076-reset-password-lock-retry-2026-10-21` | WI-076 — the owner's password recovery dies with a raw stack trace | Cog | `task_ba1a4b6cda3b` | **DISPATCHED at 22:28 — this row said "NOT DISPATCHED — held on purpose", and it was wrong.** It went out to Cog as `task_ba1a4b6cda3b`, batch `batch_19b8a0870174`, worktree `G:\code\personal-os-worktrees\076-reset-password-lock-retry`. The full row is further down this table. The finding is Probe's, from WI-007's verification, and it is the product's half of a gate fix Probe made. **One reason, said out loud:** the owner's line at 15:40 — _"when a slot frees, lean on verification"_ — and the accept queue is ten deep with one running. **Numbered so it is not lost**, with the brief written out in full in `.factory/work/WI-076.md`. The request id is reserved and unspent |
| `wi-065-template-record-status-replacement-2026-10-21-1905` | WI-065 — the template record says what the code now does (replacement) | Wren | `task_2bf6b0a6164a` | **queued** — the replacement for the task that died with the runtime. The brief is self-contained and carries the item, the criteria, the line-ending finding the dead turn was chasing, and the note that **WI-075's merge is gated on this landing** |
| `wi-034-outcome-vocabulary-verify-2026-10-21-1910` | WI-034 — the outcome vocabulary, verified | Probe | `task_f5ccfea7ea35` | **queued** — WI-034's contract half landed (`be10169`) and was merged into `main` at `2cb8ba7`, and **the lead dispatches Verify the moment Implement lands**. The brief says to re-measure every pointer, because the merge moved the lines by 64 |
| `wi-077-author-shape-house-form-2026-10-21-1920` | WI-077 — the contract publishes the author of every kind, in the house form | Wren | `task_5c00453d1f61` | **queued** — opened and dispatched this turn. WI-034 deliberately did not publish the authorship storage shape, so **WI-033's fourth criterion referred the contract to an entry that did not exist**. This is the entry, in the house form, and it is **on the critical path to WI-033** |
| `probe-verify-wi-037-product-record-forge-2026-10-21-1325` **(reused — a defect)** | WI-034 — the outcome vocabulary, written | Wren | `task_55c33b744ef5` | **done** — the contract's `### The audit outcome` entry and its migration note, `be10169` plus `ccfb3c2` for the item's own `State:` line, pushed and merged into `main` at `2cb8ba7`. **And the record is wrong about how it was dispatched:** this request id belongs to **WI-037's verification** (row above), and it was used a second time for a different item. **A request id is spent when it is used, and a reused id makes the table lie.** It is recorded here rather than hidden, and the id is spent for good |
| `wi-028-name-the-change-and-fix-pointers-2026-10-21-1940` | WI-028 — the two published entries: name the change, and point the pointers | Wren | `hlp_fcab95870b97` | **running** — **WI-028 goes back to Wren for one edit.** Probe's verification is in hand (`task_458901e810d7`, measured at `767fbe3`) and reads _"on substance verified … one edit in Wren's file away from acceptance"_. **Criterion 1's last clause fails on the second entry** — the MCP exposure entry states the rule and names no commit and no item, while the memory-scope entry names both twice. **And seven code pointers have drifted** under `8b1fd01`; the claims are true, the pointers no longer point. **The `message_bot` path was refused** — "This tool call cannot be assigned to an active reply" — because this session sits in a crash-recovery `started` state, so the brief went as an isolated execution for Wren and **this request id is reserved and unspent** |
| `wi-066-published-shapes-member-for-member-2026-10-21-1950` | WI-066 — the published shapes, member for member | Wren | — | **WITHDRAWN — and the mistake is the point.** This session was about to hand WI-066 to Wren in the group at 20:45, **and WI-066 had already been dispatched at 13:40 by the peer session** (`wi-066-message-shape-fourth-field-2026-10-21-1340`, `task_0cfbcce20e92`) **and Wren had already implemented it** (`f63c978`, "Publish the message shape's fifth field"). **The item's own file carried no task id, and this session read that as "not dispatched" — the dispatch table is the record of what is dispatched, and it was not consulted.** A second worker on one item is the thing these rules exist to prevent, and it was stopped before it went out. **Wren's implementation independently corrected the count the same way this session did — "the item's own count was four and the tree's is five … the tree wins" — and the lead's corrected title and criteria are now merged with her record.** Merged into `main` as `d3add55`; **WI-066 is in `verify` and Probe's verification is still to be dispatched** |
| `wi-078-note-bound-2026-10-21` | WI-078 — the published note has no bound the code has | Wren | `hlp_b55e5e1b22e4` | **DISPATCHED at 21:12, under the id the peer session reserved.** The peer session opened WI-078 from Probe's WI-031 verification and wrote the better brief — it measured the contract's own line numbers and **found the house form for publishing a bound** (a trailing comment on the field's own line, as `CONTRACTS.md:376` and `:377` do). **That brief was in the working tree and uncommitted when the tree was reconciled at 20:57, so it was restored by hand and is committed.** **It is the last thing standing between WI-031 and its acceptance.** Branch `wi/078-published-note-bound`, worktree `G:\code\personal-os-worktrees\078-published-note-bound` |
| `probe-wi-028-reverify-after-correction-2026-10-21-2112` | WI-028 — re-verify the two published entries after the correction | Probe | `hlp_c38af0b8226a` | **DISPATCHED at 21:12.** The change is `22ef5ba`, merged into `main` as `d530f73`: the MCP exposure entry now names its change, and all seven drifted pointers point where they say. **The peer session independently re-measured all seven pointers and confirmed the added sentence sits in the MCP exposure entry** — a cross-check, not the verification. **Probe's formal re-verification is this one, and it is the one that carries the acceptance** |
| `probe-verify-wi-041-readme-licence-2026-10-21-1340` | WI-041 — verify the README tells the truth about the licence | Probe | `task_5b4e02d59413` | **done — and WI-041 is accepted.** Probe measured the tree as it stands at `e676ba9`: **all six criteria, as the item's file stands (corrected 19:08), are met on their face.** `README.md:251-254` reads "MIT. The owner chose it on 2026-10-21, and the full text is in the [LICENSE](LICENSE) file at the root of the repository." The gates: `prettier --check README.md` 0, `npm run format:check` 0; supporting, `typecheck` 0 and `test` 0 — server 25 files/248, web 7/54, worker 5/31, agent-adapters 2/16, contracts 4/28. **Criterion 3's second clause — "the repository is public under it" — was a fact the verifier could not confirm from its own machine, and the lead confirmed it from outside this one:** an unauthenticated read of the repository's endpoint returns `visibility = public`, `license = MIT / MIT License`, `private = False`. **The implementation was taken by the other Chief session under the tiebreak (`f129594`, merged `141f0be`) and the verification is Probe's, so the lead accepts it and no writer accepts its own work** |
| `wi-036-record-reverification-2026-10-21-1955` | WI-036 — re-verify the licence record against the file as it stands | Probe | `hlp_72d0eace0a08` | **queued** — **the peer's question, asked and not skipped:** WI-036 was accepted on Probe's verification of the record at `edbd105`, and **the file has been edited since** — `45e7b2b`, `ed7b829` and `6cf63b5` each changed six lines of `docs/dependency-licences.json`, because the owner's 19:08 MIT decision made the record's "private for now, with no LICENSE yet" notes false and the other Chief session landed the correction under the tiebreak. **Nobody had asked whether the acceptance survives the edit; that is a question for the verifier and not for a lead.** The brief names the five criteria, quotes what changed, and says plainly: judge **whether the acceptance still holds**, not the record's quality |

| `probe-verify-wi-066-published-shapes-2026-10-21` | WI-066 — the published shapes, verified | Probe | — | **DISPATCHED at 21:14, under the request id the peer session reserved — and the peer session's group request for it never became a task.** WI-066's **implementation** was dispatched at 13:40 (`wi-066-message-shape-fourth-field-2026-10-21-1340`, `task_0cfbcce20e92`) and is merged into `main` as `d3add55`; **there was no row anywhere for a verification of WI-066**, and the item file sat at `verify` with **all ten criteria unticked**. **Measured at 21:12 against the dispatcher's own state: the request id `probe-verify-wi-066-published-shapes-2026-10-21` was nowhere in it, and no task text mentioned WI-066's verification — so the peer session's group request, like this session's, carried the words and made no task.** The brief is the item file — `.factory/work/WI-066.md` — ten criteria, three gates, and the instruction to **measure the code's `Message` schema and write down what it actually carries** rather than take the count from the file (the count is five, not four). **Dispatched by the session that still had transport**, as `hlp_1f8922079492`. **DONE — and WI-066 is ACCEPTED (22:05, by Chief).** Probe's verdict, verbatim: _"WI-066 verifies clean: all ten criteria hold against the tree — nine from `f63c978` itself, the tenth from WI-078, which landed mid-verification. Nothing accepted; the lead's to accept."_ **Measured, not read:** `messageSchema` (`packages/contracts/src/conversation.ts:68-91`) carries **five** extension fields — `status` `:78`, `correlationId` `:79`, `origin` `:80`, `executionId` `:81`, `detail` `:90` — and the contract's prose (`:68`), its block (`:71-84`) and the code all say, publish and carry **five**. **The gates, measured by the verifier:** `prettier --check CONTRACTS.md` pass · `format:check` pass · `published-shapes` **3 passed** · `typecheck` exit 0 · `test` exit 0 (**435 tests**: server 292, web 68, worker 31, adapters 16, contracts 28) · `build` exit 0. **The implementation was Wren's (`f63c978`, merged `d3add55`) and the verification was Probe's, so the lead accepts and no writer accepts its own work.** **What the product can now do: the published message shape matches the code's, member for member — five fields, not the three the prose claimed and not the four its block listed — so a client written against the contract is written against what the code actually accepts.** **The peer's group request for this verification never became a task, and the id is spent on `hlp_1f8922079492`: it must not be dispatched a second time.** |
| `probe-wi-028-reverify-after-correction-2026-10-21-2112` | WI-028 — re-verify the two published entries after the correction | Probe | `hlp_c38af0b8226a` | **done — and WI-028 is ACCEPTED.** Probe's re-verification reads _"all five criteria now hold on `main` HEAD `a8c728c` (tree `1a53a18`). Both earlier findings are fixed. Ready for the lead to accept — I am not accepting it."_ Gates all 0: typecheck; test (server 282 · web 68 · worker 31 · agent-adapters 16 · contracts 28 — **425, 0 failures**); format:check; build. **The code was Cog's, the contract entries were Wren's, and the verification is Probe's — so the lead accepts and no writer accepts its own work.** **What the product can now do: an agent's own memory is private to it, on reads as well as on writes, and the contract says so in both places.** Two findings, neither blocking: **a stale comment in `mcp/server.ts` that now misdescribes the contract (WI-080)**, and **a stale line number in WI-028's own file** — the same defect class this re-verification exists to catch, in the file this item owns, **corrected by the lead, who owns it** |
| `wi-078-note-bound-verify-2026-10-21-2130` | WI-078 — the published note's bound, verified | Probe | `hlp_3c50e3033785` | **queued** — the implementation landed at `0eb1a35` and was merged into `main` as `998f15f`. The bound is published in the house form (`note?: string; // up to 2,000 characters, the owner's own words`, `:165`), the prose says a longer note is **refused, not shortened** (`validation_failed`, HTTP 422, and the execution stays in `unknown` with nothing recorded), and the migration note says a note recorded before the change is not reclassified. **DONE — and WI-078 is NOT accepted: the verification found three findings and the item returns to Wren.** Probe's verdict, verbatim: _"WI-078's substance checks out against the code and all six gates pass — but I found one broken link in the new prose, the published-shapes gate does not actually gate this item, and WI-031's neighbouring paragraph in the same section is now self-contradicted. Not accepting: the lead accepts."_ **Finding 1 — WI-078's own, and blocking:** `CONTRACTS.md:178` links `(#the-error-envelope)`; the heading is `### Error envelope` at `:1414`, whose slug is `#error-envelope`, and **the file's own other reference at `:618` uses it correctly** — so the link WI-078 published does not resolve. **One word.** **Finding 2:** `published-shapes` does not gate this item — **the lead confirmed it by reading the test**: `apps/server/src/__tests__/published-shapes.test.ts` has exactly three cases (the template record's kinds, the unaudited routes, the route and audit counts) and **zero** references to `note`, `ResolveExecutionInput` or `2_000`. **The item's criterion at `:138-139` was false as written, and a false premise in a brief is replaced, not annotated** — the criterion is corrected in the item file and **the gap is now WI-081.** **Finding 3:** WI-031's paragraph at `:235-242` still says "there is no `/api/executions` route" though it landed in `414996c`/`3dd490b` and is registered at `app.ts:223`, so the section contradicts itself — **pre-existing, WI-031's own correction, and it blocks WI-031, not WI-078.** The gates: prettier ×2, `published-shapes` 3/3, typecheck, test (68/31/16/28, exit 0), build — all pass |
| `wi-080-stale-contract-comment-2026-10-21` | WI-080 — the code comment that describes a contract that no longer exists | Cog | — | **OPENED, BRIEFED IN FULL, NOT DISPATCHED — the dispatch was refused.** Both `start_helper` and `message_bot` answered _"This tool call cannot be assigned to an active reply"_, and Cog's task table shows nothing running on it, so the refusal is Cog's **chat being mid-turn**, not the queue being full. **The request id is reserved and unspent**, and the brief is written out in full in `.factory/work/WI-080.md` — **a dispatch that cannot be delivered is not a dispatch.** The defect: `apps/server/src/modules/mcp/server.ts:145-151` says _"The published contract describes `resource.get` as 'Read a resource' and says nothing about who owns a resource"_ — **true when `622812c` wrote it, false since WI-028's correction**, which made the contract say ownership at `CONTRACTS.md:704` and `:718-726`. **DISPATCHED at 22:0x as `task_9d753ce22c6b`, batch `batch_436b7f6e344e`, to Cog.** **And the refusal was neither the chat nor the queue:** `start_helper` and `message_bot` both answered _"This tool call cannot be assigned to an active reply. Retry from the current chat."_, **and `dispatch_tasks` — the path that makes a task rather than a chat turn — was admitted immediately.** So the rule measured tonight is: **`message_bot` and `start_helper` are chat-bound and are refused from a session that is mid-turn; `dispatch_tasks` is not.** The request id is now **spent** |
| `wi-079-citation-checker-2026-10-21-2120` | WI-079 — a published citation that resolves to nothing | Probe | — | **NUMBERED AND BRIEFED, NOT DISPATCHED.** It comes from Probe's own answer to his own question in WI-022's verification — _"should a check exist that catches a drifted citation, and if so where does it live?"_ — and his answer is a design: `scripts/verify-citations.ts`, doing what it can prove (every `path:line` in `CONTRACTS.md` and the briefs resolves to a file, a line and a non-blank line), carrying the borrow-rule gate's **same three exit codes**, and **not** described as "catches drifted citations" because it does not. **The class is real and the defect is live**: `prototypes/briefs/03-execution-trace.md:20` cites `apps/web/src/api/events.ts` and **there is no `apps/web/src/api/` directory in this repository** — found by reading, in WI-024's verification. **It waits on a precondition and not on a queue:** WI-038's own gate script is **not merged** (it stands on `wi/038-borrow-rule-gate` at `a194f2c`), and Probe's own words are _"a second new script should not land in the same breath as the first"_ and _"it should land after this one is merged"_ — and the exit-code convention has to exist on `main` first to be copied from rather than remembered. The brief is written out in full in `.factory/work/WI-079.md` |
| `wi-022-citation-refresh-verify-r2-2026-10-21` | WI-022 — the waiting list's refreshed citations, verified (again) | Probe | `task_5634427d74e4` | **WITHDRAWN — and a false claim in it is corrected here.** This session requested a re-dispatch at 21:05 on the ground that `task_018a6018b18f` was interrupted at 20:45 with **length 0**, and concluded the work was gone. **It was not** — WI-022's successor was **accepted at `8fc0289`** (an ancestor of `origin/main`), on Probe's criteria met with measured evidence. **The id is spent and the request is withdrawn: a second verification of one item is never created.** **AND THE CLAIM THAT THE REPORT REACHED THE GROUP WAS FALSE, AND IT IS CORRECTED HERE RATHER THAN LEFT STANDING.** The row said _"Probe's report was delivered to the group at 20:59:56 — `task_5634427d74e4`, 6,587 characters — and it ends 'Verdict: verified'"_. **Measured against the group's own message store at 22:57: the task is `queued` with no `result` and no `endedAt`, and the group store holds **zero** occurrences of its distinctive closing sentence — _"the diff is eight lines and nothing else, and the gates pass"_ — and **no message of 6,587 characters at all** (the only message in that length band is 6,547). The one _"Verdict: verified"_ in the store belongs to **WI-041's** report, not WI-022's. **So the report has never reached the group, and the row's instruction — _"if it was dispatched, cancel it"_ — would have led a reader to cancel the only pending delivery of a verification that was accepted.\*\* **The task is therefore KEPT, not cancelled: `task_5634427d74e4` is the one thing still standing between Probe's verification and the group.** **This is the same defect class this file keeps catching, in a row written about the very thing that catches it: a record that says something happened which did not happen, and which a reader would act on** |
| `wi-078-error-envelope-anchor-2026-10-21` | WI-078 — the error-envelope link does not resolve | Wren | `task_993e382b1071` | **queued — the return to implement, after Probe's verification found three findings.** **One of the three is this item's own and it is blocking:** `CONTRACTS.md:178` links `(#the-error-envelope)`; the heading is `### Error envelope` at `:1414`, whose slug is `#error-envelope`, and **the file's own other reference at `:618` uses it correctly** — so the link this item published does not resolve. **One word.** **A new id and a new title, because the verification's id is spent.** The other two findings are not Wren's: the missing gate is **WI-081** (Probe's file) and the contradicted neighbour is **WI-031's own correction, which queues behind this one on the same lane.** Branch `wi/078-error-envelope-anchor`, worktree `G:\code\personal-os-worktrees\078-error-envelope-anchor`. **CANCELLED AT 22:22 — IT WAS A DUPLICATE, AND THE DUPLICATE WAS MINE.** **The fix had already been made at 21:52**, by another lane, on the item's original branch: `f768625`, _"Point the refusal at the envelope's own heading"_, pushed to `origin/wi/078-published-note-bound`. **The chief merged it — `4f19166`, "Merge WI-078: point the refusal at the envelope's own heading", one line of `CONTRACTS.md` — and `CONTRACTS.md:178` now reads `([Error envelope](#error-envelope))`, the same slug `:618` uses.** **So the anchor is fixed, and this dispatch is cancelled rather than left to land a second copy of the same one-word change on a second branch.** **The request id is spent on the cancelled task and must never be reused** — and the lesson is the one the peer session's 22:21 commit names: **one request id, one task.** This batch carried **two** tasks under one id, which is why the peer session could not tell which of them a retry would dedupe against |
| **no request id — the dispatcher never saw one for this item** | WI-081 — nothing holds the published note's bound to the code's | Probe | `task_51cd8330a3e0` | **queued — opened and dispatched.** It comes from Probe's own finding in WI-078's verification: `apps/server/src/__tests__/published-shapes.test.ts` holds three cases (the template record's kinds, the unaudited routes, the route and audit counts) and **zero** references to `note`, `ResolveExecutionInput` or `2_000` — **so it passes identically with the bound unpublished or mis-numbered, and a gate that passes on a wrong tree is not a gate.** **The lead confirmed it by reading the test.** The published bound (`CONTRACTS.md:165`, 2,000 characters) and the code's cap (`apps/server/src/api/executions.ts:9`, `z.string().max(2_000)`) are **both right today, and nothing would say so if one of them changed.** **Probe writes the case and the lead verifies it — the session that wrote the work does not accept it.** Branch `wi/081-published-note-bound-gate`, worktree `G:\code\personal-os-worktrees\081-published-note-bound-gate`. **THE REQUEST-ID COLUMN IS CORRECTED, AND THE PEER SESSION IS RIGHT: the id `wi-081-published-note-bound-gate-2026-10-21` was never registered with the dispatcher, so a row that named it was a record that lies.** **This task went out inside the batch that carried WI-078's anchor fix, under that batch's id `wi-078-error-envelope-anchor-2026-10-21` — one request id for two tasks, which is the mistake the peer session's 22:21 commit named.** **WI-081's durable handle from here is `task_51cd8330a3e0`.** **The fix is not to re-dispatch, which would put a second worker on WI-081, but to say so** |
| `wi-069-refusal-names-nobody-code-2026-10-21` | WI-069 — a delegation that names nobody is refused in a way a client can read | Cog | `task_cac8204bf63a` | **queued — the code half, and it does not wait for the owner's answer.** The reason string is already product behaviour a client reads in the panel, so the refusal can be made readable before the contract says anything about it. **The lead decided the one thing the item left open: the branch becomes reachable and names the id** — it was **written for exactly this case** (`routing.ts:349-353`) and a later filter rendered it unreachable, so making it reachable **restores the code's own intent and removes the dead branch at the same time**; leaving it dead would leave the code promising something the engine does not keep, **which is the defect the item is about.** Batch `batch_48b9074135d0`, worktree `G:\code\personal-os-worktrees\069-refusal-names-nobody-code`. **The contract half still waits on the owner, and `wi-069-refusal-shape-contract-2026-10-21` is reserved and unspent.** The test is Probe's, and is dispatched the moment the implementation lands |
| `wi-076-reset-password-lock-retry-2026-10-21` | WI-076 — the owner's password recovery survives a locked database | Cog | `task_ba1a4b6cda3b` | **queued — released at 22:28, and the reason is measured rather than a change of mind.** The dispatcher fills its slots in **batch order**, and the verifications this would have displaced were **already ahead of it in that order** — so **dispatching to Cog does not take a verification's slot; it takes a slot after them.** Cog's lane was empty, and an owner who cannot recover a password because the command prints a stack trace is a worse thing to leave idle than a verification that moves one place further down the queue. **And the file is free** — this is `apps/server/src/index.ts` and the auth service, and the contract lane is Wren's. Batch `batch_19b8a0870174`, worktree `G:\code\personal-os-worktrees\076-reset-password-lock-retry`. **The title was shortened from the one the item file carried, because the dispatcher refuses a title over eighty characters — and the first attempt created no task, so the id was not spent by it.** The test is Probe's |
| `wi-010-return-two-defects-2026-10-21` | WI-010 — the direction document, returned with two defects | Vision | `task_8377ee92cad2` | **DISPATCHED at 23:45 — the return, not a new item.** Probe's verification (task `task_2f3e137d63ee`, delivered to the group as `msg_task_925de8a43034`, 10 227 characters) says **verified, with two defects**: every repair D1 to D6 holds, the three moved facts hold, the boundary holds, the gates are green — and **two defects are open, both the document's to fix**. Batch `batch_63357c20afb0`. **Defect 1** — the code pointers drifted two minutes after the repair, when WI-031 landed: the control row is `WaitingList.tsx:307-322` ("Approve" `:313`, "Reject" `:321`), the POST is `:113`, the list's comment is `:353-360`; the document says `:274-284`, `:112`, `:293-300`, and `TaskBoard.tsx:315-318` is **still exact**. **Defect 2** — the trace's spend claim is false: the four event payloads carry no spend (`packages/contracts/src/agent.ts:179-208`), and `spendUnits` appears **exactly once** in the published contracts (`common.ts:58`, a bare schema); the spend units live on the execution row and are published by the evidence read, **whose code does not exist — that is WI-086.** **Chief's ruling rides with it: the boundary rule gains a SECOND declared crossing** — the constellation, with the Needs-you rail — because the constellation _is_ the agent list and a decision is taken where the list is. **The rule's exact words are in the brief, so the brief and the document cannot drift.** **The D1–D6 id is spent; a new dispatch needs a new id and a new title** |
| `wi-086-evidence-read-route-2026-10-21` | WI-086 — the evidence a decision is taken against, in code | Cog | `task_8f877457d72d` | **NUMBERED AND DISPATCHED at 23:45.** `CONTRACTS.md:1047-1145` publishes `GET /api/approvals/:id/evidence` and says in its own words that **the code does not implement it yet**: "there is no route for it, and `GET /api/approvals/:id` answers with the approval alone". WI-039 published the promise (`6406291`), WI-040 is the drawer — **and the route in the middle was owned by nothing**: grepping every item file for the read returns no item at all. **So a published contract promised a read and no work item kept it.** Batch `batch_0cd727c48876`, branch `wi/086-evidence-read-route`, worktree `G:\code\personal-os-worktrees\086-evidence-read-route`, cut from `main` at `ceed799`. **WI-086 is the next free number above all taken numbers** (WI-085 is the highest), and if the peer session takes WI-086 first, the collision is recorded in the item that lost the number. **The contract is the specification and is not changed by this item — the contract leads the code.** Two pins are owed: an approval with no execution answers `execution: null`, and a tool call with no completion answers `outcome: 'unfinished'` |
| `wi-024-briefs-defects-2026-10-21` | WI-024 — the briefs' six defects | Cog | `task_5fea284be00f` | **DISPATCHED at 23:47 — the return on the briefs.** Probe's verification (`task_d2fa4fb7e946`, measured at `fc1a3dc`, report delivered to the group) says **every criterion is met on its face and the deliverable is sound — but six defects sit in the briefs.** Batch `batch_2f4882362dc5`. **Defect 1 was the lead's to rule, and is ruled: brief 06 stands and the rule is amended** — the connect decision stays with the constellation and the boundary rule gains a **second declared crossing**, because the constellation _is_ the agent list and a decision is taken where the list is; **the rule's exact words are in the brief**, and WI-010's return carries the same words into the direction document. **Defects 2 to 6 are edits:** brief 03 cites a path that does not exist (`apps/web/src/api/events.ts`), brief 03's 50-event citation points at the drain loop that fetches 200, brief 03's spend criterion cannot be met from the data it reads (the same finding as WI-010's defect 2), brief 04's contracts citation has drifted, and brief 05 says the waiting list "does not poll" and it does. **The resource editor's placement is the owner's question and is not this dispatch** |
| `wi-031-contract-status-correction-r2-2026-10-21` | WI-031 — the route entry says the code does not exist, and it does | Wren | `task_70be52bdefa9` | **PREPARED AT THE TIME, AND DELIVERED AT 00:17 — this row said "NOT DELIVERED", which was true when it was written and is not true now.** The second attempt was interrupted by the runtime restart. The task `task_70be52bdefa9` ran from 23:22, produced 2,550 characters, and then the runtime restarted at about 23:30; the task went to **`unknown`** — released, not cancelled — and **its branch `wi/031-contract-status-correction` carries no commit of its own, so the work is gone and has to be done again.** The id `wi-031-contract-status-correction-r2-2026-10-21` is spent. The re-dispatch is **prepared** under `wi-031-contract-status-correction-r3-2026-10-21`, title "WI-031 — the route entry says the code does not exist, and it does, again", to Wren, with the brief in `.factory/work/WI-031.md` — **and it WAS sent, at 00:17 by the peer session, as `task_4da9c3a974f1`, batch `batch_d4156652506a`, queued to Wren** The first attempt, `wi-031-contract-status-correction-2026-10-21` (`task_be25e082ae5c`), **failed at 20:45** — the runtime restarted mid-turn — so **that id is spent**, and this one is new, with a new title. **The defect, measured by this session before the brief was written:** `CONTRACTS.md:235-242` still says "the code does not implement it yet" and "there is no `/api/executions` route", though the route landed in `414996c`/`3dd490b`, is served at `apps/server/src/api/executions.ts:21` and registered at `app.ts:223`; and the paragraph's "the only writer of an execution's outcome is `resolveExecution`" is false, because the executions service writes it too (`apps/server/src/modules/executions/service.ts:93-111`, and that is the writer this route calls, at `api/executions.ts:25`). It queues behind **WI-065** (live, `task_2bf6b0a6164a`) and **WI-078's anchor fix** (`task_993e382b1071`), because `CONTRACTS.md` is one file and one live item at a time. **WI-031 must not be accepted until this lands** — Probe's own words, in WI-078's verification. Batch `batch_faa4525ade7f` |
| `wi-034-outcome-vocabulary-verify-again-2026-10-22` | WI-034 — the outcome vocabulary, verified again | Probe | `task_46d304ac52ef` | **DISPATCHED at 00:14 — the re-dispatch, because the first one never ran.** The first verification (request id `wi-034-outcome-vocabulary-verify-2026-10-21-1910`, task `task_f5ccfea7ea35`, batch `batch_2c18c7ef889e`) **died with `AGENT_UNAVAILABLE` before it ran** — no report, no measurement, no verdict — so **WI-034 has never been verified at all**, and that request id is spent for good. Batch `batch_915d9b303a81`. The brief is the one that was already written: seven criteria, and **the contract's claims about today's code are the ones to test** — the route helper hardcodes `success`, the audit service defaults to it, and **no writer in the product writes `failure`**. **The merge moved the lines by 64, so the item file's own line numbers are stale.** **Probe writes the check; the lead names it** |
| `wi-036-record-reverification-again-2026-10-22` | WI-036 — the licence record, re-verified under MIT | Probe | `task_da8b553081e2` | **DISPATCHED at 00:15 — the third dispatch, because the first two both died.** The helper (`hlp_72d0eace0a08`) was interrupted by the runtime stop at 20:47; the peer's (`task_e4b8ac641700`, request id `probe-verify-wi-036-licence-record-mit-2026-10-21`) **died with `AGENT_UNAVAILABLE` before it ran**. **So WI-036 sat in `verify` with no verification behind it, and both earlier ids are spent for good.** Batch `batch_eee413cb8359`. The live brief carries the peer's fuller wording — it names `docs/strategy.md` as well as the licences record — and the five criteria are measured **again against the tree as it stands**, with the numbers **re-derived rather than trusted**. **The dependency entries must be unchanged**, and the brief says so: compare against the commit before the correction and **report every difference**. **The acceptance is not Chief's**, because Chief changed the files |
| `wi-069-refusal-names-nobody-code-again-2026-10-22` | WI-069 — the refusal that names nobody, in code | Cog | `task_eb08b8648967` | **DISPATCHED at 00:15 — the re-dispatch, because the first one never ran.** The first code dispatch (request id `wi-069-refusal-names-nobody-code-2026-10-21`, task `task_cac8204bf63a`, batch `batch_48b9074135d0`) **died with `AGENT_UNAVAILABLE` before it ran** — no code, no commit, no report — so **the branch is exactly as `work-item.ts new WI-069` left it**: `wi/069-refusal-names-nobody-code` at `68de2ca`, worktree `G:\code\personal-os-worktrees\069-refusal-names-nobody-code`, and that request id is spent for good. Batch `batch_34569948b8d7`. The lead's decision rides with it: **the branch becomes reachable and names the id**, because it was written for exactly this case and a later filter rendered it unreachable. **The check is Probe's, not Cog's**, and is dispatched the moment the implementation lands. **The contract half still waits on the owner, and `wi-069-refusal-shape-contract-2026-10-21` is reserved and unspent.** **AND A SECOND DISPATCH FOR THE SAME ITEM APPEARED, AND THE TIEBREAK IS SAID OUT LOUD: ONE ITEM, ONE IMPLEMENTER.** The peer session re-dispatched WI-069's code half at 00:17 — request id `wi-069-refusal-names-nobody-code-r2-2026-10-21`, task `task_4a1e95f795ae`, batch `batch_b273a0104cc3`, title "WI-069 — a delegation that names nobody is refused, readably" — **and two implementers on one item is two branches and two copies of the same change.** **The peer's task is cancelled and this one stands, and the reasons are measured:** this dispatch was created at **00:11:34**, six minutes earlier, so **the dispatcher serves it first in batch order**; its brief is **5 683 characters** and carries the item file's own criteria in full **plus the state of the branch** (`68de2ca`, no commit of its own), while the peer's is **959 characters** and points at the item file; and **the one rule the peer's brief carries that mine does not — that `CONTRACTS.md` is one live item at a time, because WI-031's correction and WI-069's contract half are the same file — is already stricter in mine**, which says the code half **must not edit `CONTRACTS.md` at all**. **The peer's brief also gives the death time as 23:12:38; the dispatcher's own record says 23:32:38.** The peer's request id is spent on the cancelled task |
| `wi-085-autonomy-policy-attack-again-2026-10-22` | WI-085 — the independent attack on the autonomy policy, again | Probe | `task_029bcf0e9ab8` | **DISPATCHED at 00:43 — the re-dispatch, because the first one reached Probe and returned nothing.** The first dispatch (request id `wi-085-autonomy-policy-attack-2026-10-21`, task `task_bea8586af7aa`, batch `batch_0003c8d5b647`) **delivered its brief** — it is in Probe's chat, 3 972 characters — **and came back `failed` with `error: BUSY` and a zero-length report.** **So this is a different failure from the three above: the work reached the agent and the answer did not come back.** The branch is exactly as it was: `wi/085-autonomy-policy-attack` at `cd9507e`, **no commit of its own**, so **no attack has been written.** Batch `batch_ee7c4912191c`. **And the situation moved while this item waited: Cog's WI-082 implementation finished** (`task_8e03c28ed9df`, done, 11 194 characters), **so the implementation now exists to disagree with** — and the brief says the stronger thing: **write the test against the published decisions, not against whatever Cog wrote, and do not weaken the test to match the code** |
| `wi-081-published-note-bound-gate-2026-10-21` | WI-081 — nothing holds the published note's bound to the code's | Probe | `task_51cd8330a3e0` | **ACCEPTED — 2026-10-22, by Chief, and the lead verified it because Probe wrote it.** The branch `wi/081-published-note-bound-gate` is merged into `main` as **`28aedaf`**. **The lead proved the check bites, in both directions, on this host:** the contract's published number moved to 20 000 → **`1 failed | 3 passed (4)`**, "expected 20000 to be 2000"; the code's cap moved to 20 000 → **`1 failed | 3 passed (4)`**, "expected 2000 to be 20000"; **both restored, and `git diff` on the two files under test is empty.** The diff is **one file of code** (+61/−8) and **the three cases already in it are byte-identical**. The gates on the merged tree: typecheck 0, test 0 (**437** — server 294, web 68, worker 31, agent-adapters 16, contracts 28), build 0, and the format gate measured on the committed tree. **Product: the owner's note's cap is a promise the repository keeps** — before this, the published number and the enforced number were two numbers that happened to be equal, and one moving alone would have left the contract saying something the code did not do with **nothing saying so**; now one moving without the other turns a test red, and the failure names both. **The findings went out**: the stale header is fixed on the branch (and the new bullet carries **no number on purpose**), the header conflict with WI-075's branch is the lead's and did not have to be resolved by this merge, the web bundle-budget timeout is **WI-092**, and **WI-068 has not been started** |
| `wi-092-bundle-budget-timeout-2026-10-22` | WI-092 — the bundle-budget test inherits a five-second timeout it never asked for | Probe | `task_d0ac3698176e` | **NUMBERED AND DISPATCHED at 00:58.** Batch `batch_324aa23dda74`, branch `wi/092-bundle-budget-timeout`, worktree `G:\code\personal-os-worktrees\092-bundle-budget-timeout`. It is Probe's own finding in WI-081's verification, and Probe did not fix it because it belongs to another item: `apps/web/src/__tests__/bundleBudget.test.ts` has **no explicit timeout**, there is **no vitest config in `apps/web` or at the root**, so **every case inherits Vitest's 5 s default**, and **nine cases each spawn a `tsx` process.** Probe's measurement: idle 3.07 s green, 6 burners 8.07 s green, 12 burners 26.59 s green, **48 burners — 6 of the 9 cases timed out at 5 000 ms**. **And it is not only saturation: one of three full `npm run test` runs went red on a merely busy machine** (23.6 s, then "Test timed out in 5000ms"). **This is the same class as WI-074's finding at `apps/server/src/__tests__/agents.test.ts:117`, and the class has now happened twice — the second time taking a green suite red on a machine that was not under load.** The item asks for the file to choose its own timeout, **without weakening the gate**: `npm run build` only **warns** when a chunk grows past the limit, and `scripts/verify-bundle-size.ts` is what stops the change. **A root vitest config is deliberately out of scope** — it would change the timeout of every suite, and the lead has not asked for that |

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
| C-23 | Nothing checks that a published contract's **implementation-status note** still matches the code. The contract leads the code, and when the code lands the note has to follow — and it does not, because nothing asks it to. **Two instances so far:** the template record says _"the code does not implement this yet"_ after WI-017 landed (`363428e` at 11:05 → `414996c` at 11:32 is the second instance, the resolve route's entry), and **the two did not drift at the same rate — the resolve route's note was true when it was written and false 27 minutes later (`363428e` at 11:05 → `414996c` at 11:32), while the template record's note was published at 08:25 (`e682224`) and went false at 12:41 (`8b1fd01`), four hours and fifteen minutes later. The summary this row carried understated the drift; the correction, and the want it names, are in _"The wants' own execution produced a ninth want"_, below.** | `CONTRACTS.md:578` and `CONTRACTS.md:197-204`, both found by reading the contract against the code rather than by any gate — **the published counts were caught by the pipeline, but a stale _status_ is not a count, and no test can fail on it.** WI-065 carries the first correction; WI-031 carries the second, attached to the item it blocks. The check would be a `scripts/verify-*.ts`, which is Probe's by the ownership table, in the shape of WI-038's borrow-rule gate |

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
