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

| #    | Want                                                                                                                                      | Said       | Verdict                                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-1  | "I see everything waiting on me in one place"                                                                                             | 2026-10-20 | accepted — [WI-004](../work/WI-004.md)                                                                                                                                                                            |
| W-2  | Interaction — talking to agents is the job that should get genuinely better                                                               | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md), [WI-012](../work/WI-012.md); the bar for [WI-004](../work/WI-004.md) still applies |
| W-3  | "Run within a stated scope"                                                                                                               | 2026-10-20 | accepted — the scope is stated below                                                                                                                                                                              |
| W-4  | "Only me" — one person runs the instance                                                                                                  | 2026-10-20 | accepted — no permissions, sharing or onboarding work                                                                                                                                                             |
| W-5  | "dont rush to implement a feature when we havent discussed it" — and the product vision that came with it                                 | 2026-10-20 | accepted — a strategy session, not a work item; the rule is recorded below                                                                                                                                        |
| W-6  | Move the MiniMax Bot plugin's conversation-layer guarantees onto Personal OS's factory-grade ledger                                       | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md); the rest is in Candidates                                                          |
| W-7  | "one cohesive, self-hosted, agent-native application, not a collection of dependent third-party services"                                 | 2026-10-21 | accepted — [WI-047](../work/WI-047.md), [WI-048](../work/WI-048.md), [WI-049](../work/WI-049.md), [WI-051](../work/WI-051.md)                                                                                     |
| W-8  | "I'm particularly interested in MiniMax Code's desktop experience as the foundation for our interaction design"                           | 2026-10-21 | accepted — the desktop application is not published, so the primitives are recreated, not copied: [WI-050](../work/WI-050.md), [WI-051](../work/WI-051.md), [WI-052](../work/WI-052.md)                           |
| W-9  | "resolve how Personal OS can be continuously improved by its own agents without becoming dependent on itself for deployment and recovery" | 2026-10-21 | accepted — [WI-051](../work/WI-051.md), [WI-057](../work/WI-057.md), [WI-058](../work/WI-058.md), [WI-061](../work/WI-061.md)                                                                                     |
| W-10 | "I favour independent development and release execution, with production Personal OS acting as the control plane for goals and work"      | 2026-10-21 | accepted — the control plane is the ledger, not a second runtime: [WI-053](../work/WI-053.md), [WI-054](../work/WI-054.md), [WI-057](../work/WI-057.md), [WI-058](../work/WI-058.md)                              |
| W-11 | "Challenge that approach, identify the minimum necessary boundaries"                                                                      | 2026-10-21 | accepted — the challenge and the seven boundaries are ADR 0010, and the runbook is [WI-057](../work/WI-057.md)                                                                                                    |
| W-12 | "recommend a domain structure that allows features to evolve independently while remaining one cohesive product"                          | 2026-10-21 | accepted — [WI-047](../work/WI-047.md), [WI-048](../work/WI-048.md), [WI-049](../work/WI-049.md)                                                                                                                  |
| W-13 | "avoid building another agent harness or unnecessary infrastructure"                                                                      | 2026-10-21 | accepted — a constraint on the work, and the reason the harness patterns split by boundary: ADR 0009, [WI-052](../work/WI-052.md), [WI-056](../work/WI-056.md)                                                    |

Verdicts: `open` — not yet judged. `accepted` — became a work item, cited
here. `declined` — not doing it, with the reason kept. `folded` — already
covered by an existing work item.

## Numbers claimed in the 48-hour build

The number space has one owner: the session that leads implementation in a
tree. During the 48-hour build that is the session running the push below,
and it holds the block **WI-090 to WI-097** so that two sessions cannot claim
the same number.

**This table is the number space, and it is on `main` so that both sessions
read it.** A number is added to it **the moment it is taken**, before the
item's file is written and before the branch is pushed — because an item filed
on a branch is invisible to a session that reads `main`, and that blindness is
what produced every collision on 2026-10-22. **Read this table, not the next
free number above the highest taken.**

| Number | Item                                                                                                                                       | Owner  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| WI-087 | The stranded branches, and what is actually worth keeping                                                                                  | worker |
| WI-088 | The ledger split into what it is and what it was                                                                                           | worker |
| WI-090 | The substrate the product's own two measures stand on                                                                                      | worker |
| WI-091 | The gate that notices when a published contract goes false                                                                                 | worker |
| WI-092 | The bundle-budget test's five-second timeout                                                                                               | peer   |
| WI-093 | The pin that says the old rule instead of the current one                                                                                  | worker |
| WI-094 | The pin reads the rule out of a phrase — **folded into WI-093**, one file, one live item                                                   | peer   |
| WI-095 | The resolver does not throw on a policy row that lost a field                                                                              | worker |
| WI-096 | Publish what WI-082 changed, and stop the product denying it                                                                               | worker |
| WI-097 | The guide, the filling, and where a resource came from                                                                                     | worker |
| WI-098 | The ADR's boundary rule re-synced                                                                                                          | peer   |
| WI-099 | The autonomy policy's surfaces, tested                                                                                                     | worker |
| WI-100 | The published-shapes guard, re-pointed at the claim                                                                                        | worker |
| WI-101 | The integration landing — the vehicle nine items rode in on                                                                                | worker |
| WI-102 | The daily spend cap, enforced                                                                                                              | worker |
| WI-103 | The contract's pointers into the file WI-080 changed                                                                                       | peer   |
| WI-104 | The published id is not the id the route takes                                                                                             | peer   |
| WI-105 | Record what a turn costs, so the daily cap is measured against something real                                                              | worker |
| WI-106 | Four sentences in the licence record that are looser than what they describe                                                               | lead   |
| WI-107 | The gate that notices when a published citation stops pointing at code                                                                     | worker |
| WI-108 | A broken spec answers `validation_failed`, not `internal_error`                                                                            | worker |
| WI-109 | Land the five domains on the integration vehicle — **was WI-104, then WI-106, then WI-107, renumbered three times**                        | worker |
| WI-110 | The effective policy is composed by the one module that may read across — **was WI-105, then WI-107, then WI-108, renumbered three times** | worker |
| WI-111 | Publish what WI-097 and WI-090 actually built — **was WI-103, then WI-106**                                                                | worker |
| WI-112 | The rule's fifth copy, in the strategy record — **was WI-111**                                                                             | peer   |
| WI-113 | The contract publishes the refusal, and the tests read the message out of the contract instead of repeating it                             | peer   |
| WI-114 | The four pointers WI-108's landing moved, and the two in the template guide                                                                | lead   |
| WI-115 | The template guide describes an authorship defect WI-020 closed, and cites three lines that never carried it                               | lead   |
| WI-116 | **the pin WI-112's acceptance owes** — published at 08:10 in `WI-112.md:182`, and HELD                                                     | peer   |
| WI-117 | The stranded branches, measured again — the peer's branch-hygiene record                                                                   | peer   |
| WI-118 | The mode the owner sets is the mode that is in force                                                                                       | worker |
| WI-119 | The strategy document's copy of the record's loose sentence, in three places                                                               | peer   |
| WI-120 | The published front page states the identity the owner replaced                                                                            | peer   |
| WI-121 | The decision surface carries what an agent is blocked on                                                                                   | peer   |

**The next free number is WI-122.**

**WI-118 was claimed twice, and this is the record that kept it.** The lead
opened this session's mode item as WI-113 at 07:50, yielded it when the
peer's earlier WI-113 claim was found, and took **WI-118 at 08:16** — the
claim was on a pushed branch, so a session reading `main` could not see it.
**The peer session then took WI-118 at 08:28**, for the strategy record's
copy of the licence record's loose sentence, reading the same block that
named WI-117 as the peer's own and WI-116 as reserved. **Neither claim was
bound to a live dispatch** — the peer's item file carries no dispatch id but
Probe's WI-106 verification — **so the tiebreak applies and the claim
published first keeps the number: WI-118 is the lead's**, and it is on
`main` at `115d226`. **The peer's strategy-record-prose item takes WI-119.**
**This is the same blindness the block was corrected for, and the block alone
cannot fix it** — a claim on a branch is invisible to a session that reads
`main`, so the tiebreak has to be settled by the two sessions and written
down here, which is what this paragraph is.

**The block was corrected on 2026-10-22 at 08:20, and it is maintained in place because
that is what it is for.** It said "**the next free number is WI-113**" while WI-113 was
the peer session's own claim of 07:27, WI-114 and WI-115 were this session's, and
WI-116 was the peer's reservation — **so the block named a number that three sessions
of claims had already spoken for, and the one rule it carries is "take a number from
this block".** **WI-113 is the peer's, WI-114 and WI-115 are the lead's, and WI-116 is
the peer's reservation** — the peer stated it at 07:55: _"if this session's
contract-publication item is ever opened, it takes WI-116"_. **The next number either
session may take is WI-117.**

**WI-117 and WI-118 were taken after that correction.** WI-117 is the peer
session's branch-hygiene measurement, which the peer session has said it is
taking. **WI-118 is this session's — "the mode the owner sets is the mode that
is in force" — which was opened as WI-113 at 07:50 and moved when the peer's
earlier WI-113 claim was found: the peer published WI-113 at 07:27 for the
contract's refusal publication, neither claim was bound to a live dispatch, and
the claim published first keeps the number. **So the next number either session
may take is WI-119.\*\*

**The block was corrected AGAIN on 2026-10-22 at 08:45, and this time two of the
three errors were the lead's own.** The row for **WI-106 said "peer"** and it is the
lead's — **the peer conceded it in writing at 05:15** ("WI-106 is yours, and my
publication moved to WI-111") and dispatched it at 05:37 as `task_fede9dee2ed9`; the
cell now says **lead**. **WI-116 was described as "reserved — the peer's
contract-publication item, if it is ever opened", and it is not a reservation: it is
published.** `.factory/work/WI-112.md:182` reads _"It is **owed, and it has a number —
WI-116** — and it is **HELD**"_, published in `683ad44` at 08:10, and **the peer
session's own tiebreak at 08:22 (`b292f97`) says so**: _"**WI-116 is the pin, and it
is not renumbered.**"_ **WI-117 is the peer's** — the branch pile-up measurement,
claimed at **08:09:24** (`c2f9322`, branch `wi/117-branch-pileup-verdict`, item file
`.factory/work/WI-117.md`), **ten minutes before** this block's own 08:19 correction
named it free — and **the tiebreak both sessions publish says the earlier published
claim keeps the number where no dispatch binds it**, so WI-117 is that item and this
block's 08:19 sentence was the stale claim.

**And WI-118 is not what this session first wrote at 08:45: it is the mode item, and
the prose item takes WI-119.** The peer session published **WI-118 — "The mode the
owner sets is the mode that is in force"** at **08:13** (`028174a`, with
`.factory/work/WI-118.md`, the contract's entry and the code), and that claim was
published **before** the prose item was filed, so **the published WI-118 keeps the
number**. The prose item — "the strategy document's copy of the record's loose
sentence, in three places", on branch `wi/118-strategy-record-prose`, owner Wren,
verifier Probe, opened from Probe's WI-106 verification — filed itself as WI-118 too,
and **two items cannot hold one number**: it moves to **WI-119**, and **its item file
must be `WI-119.md`** when it is worked. **The branch keeps its name** — a pushed
branch is not renamed without the lead's word, and this is that word: it stays
`wi/118-strategy-record-prose`, and the item inside it is WI-119.

**So the next number either session may take is WI-120**, and the contract-publication
item the peer reserved, if it is ever opened, takes **WI-120** as well — because
WI-117 is the pile-up measurement, WI-118 is the mode item, and WI-119 is the prose.

**WI-089 is not in this block and does not belong to it.** The peer session
holds WI-089 for the hot-reload item, and held WI-088 before it. Both numbers
were collisions with this push and both were resolved by re-filing, not by
reusing. **Take a number from this block, not the next free one above the
highest taken** — on 2026-10-22 that rule produced two collisions in twenty
minutes, because it cannot see an item that has not been filed yet.

**WI-092 is the peer session's, and the amber pin moved to WI-093.** The
number was committed on `main` before this session filed its item, and the
peer's own tiebreak record had already reserved WI-093 for it. The number was
reused, never: the item moved and the record moved with it.

**WI-104 is the peer session's, and this push's landing item moved three times.**
The peer opened WI-104 on `main` at 04:50 — "the published id is not the id the
route takes" — and its own file says: _"If another session has taken WI-104 in
the meantime, this item is renumbered and the table is corrected."_ **This
session was dispatched at about 04:05 and did not write its item file into the
ledger until after 05:00**, so the peer's read of the number space was correct
when it was taken: WI-104 was in no item file, no dispatch record and no commit.
**WI-105 is the peer's too** — "record what a turn costs, so the daily cap can
bite", on `wi/105-record-turn-cost`, dispatched and in flight — so the item file
that was written under WI-105 moved on, and says so at the top.

**AND WI-106, WI-107 AND WI-108 WERE TAKEN WHILE THIS PUSH WAS IN FLIGHT, SO THE
ITEMS MOVED AGAIN.** The peer's `wi/106-publish-template-contract` carries its
own `.factory/work/WI-106.md`, and it appeared on the remote after this session
had taken WI-106 for the landing item; the lead then read the number space and
found **WI-107** taken by the peer's contract-pointer gate
(`scripts/verify-contract-pointers.ts`) and **WI-108** taken by Cog's
validation-error fix. **Two numbers cannot mean two items**, so the landing item
moved to **WI-109** and the crossing's item to **WI-110**, and the table above
moved with them. **The numbers were renumbered, never reused**, and the record
moved with them.

**WI-094 was folded into WI-093, and the tiebreak is said out loud.**
`apps/web/src/__tests__/forge-briefs.test.ts` carries **two independent
reds** — the amber assertion this session found, and the boundary-rule proxy
phrase the peer session found — and **one file is one live item at a time**.
Probe's dispatch for WI-094 (`task_6c74144b03df`) was cancelled rather than
left to race WI-093 on the same file, and WI-093's brief carries WI-094's
analysis unchanged. WI-094's number is not reused.

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

### The scope widened on 2026-10-21

The owner added three areas on 2026-10-21, and the scope is now:

> Improve **interaction** — the owner talking to agents — and make the panel
> answer **"what needs me"** on the landing page; **and** publish the
> **domain structure** the product is made of; **and** keep the **boundaries
> that let the instance improve itself** without being able to break itself.
> One owner. No permissions, no sharing, no onboarding, no migration work.

**The reason for the order is capacity, and it is recorded here because
FACTORY.md asks for it.** The interaction items already in flight own the
conversation contract, the worker, the adapter and the approvals, and the new
work touches the same files. So the new work is **funded and numbered** and
ordered behind them — not because it matters less, and not because it is
deferred in principle.

**What the widening does not do.** It adds no second runtime, no dependency, no
desktop application and no workflow engine. The owner's words were "avoid
building another agent harness or unnecessary infrastructure", and that is a
constraint on the work inside the scope rather than a wish.

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

| Request id                                                 | Item                                                                    | To     | Task                | State, 2026-10-21 12:15, and this session's 10:03 +11:00 +12:15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| `wi-022-publish-waiting-reasons`                           | WI-022 — the published waiting list's reasons                           | Wren   | `task_ed4c3132afe9` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry was cancelled at 07:29 and **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `wi-010-verify-forge-rewrite`                              | WI-010 — the direction, verified                                        | Probe  | `task_4cc3a3b1160f` | **cancelled** — died with `AGENT_UNAVAILABLE`; the retry `task_5666d5ca0dc2` is **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `wi-024-forge-adoption`                                    | WI-024 — the panel takes Forge                                          | Cog    | `task_5354f76acca3` | **cancelled** at 07:49:25 — **and it has a successor**: Chief's retry under the same id made a fresh task, `task_5a09991ca5a1` (batch `batch_72271e402bc9`), queued — **that is the live dispatch on WI-024**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-025-direction-adr`                                     | WI-025 — the direction answer in ADR 0007                               | Wren   | `task_ce64c47ef3d9` | **cancelled** at 07:49:25 — **Chief implemented it** (`0d4ec09`); Probe's verdict is in and it is **not verified**, and the record pass is with Wren as `wi-025-adr-record-pass-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `wi-026-waiting-kind`                                      | WI-026 — the waiting list's kind grows by one                           | Wren   | `task_fbb0e0528036` | **cancelled** at 07:29 — **Chief implemented it** (`a44a374`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-027-unknown-turn`                                      | WI-027 — an unknown turn reaches the waiting list                       | Cog    | `task_9425c9b2a237` | **cancelled** at 07:49:25 — the retry `task_18f3c6c43c9d` **ran 08:34–08:51 and landed `c9bb0bc`**; the item is now in verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-028-memory-read-privacy`                               | WI-028 — an agent's own memory is private to it                         | Cog    | `task_99c5c5eeb7aa` | **cancelled** at 07:49:25 — the code landed in `622812c`; the contract half was dispatched at 07:59 as `task_146247be56d5` (queued)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wi-029-exposure-race`                                     | WI-029 — the exposure test does not race the reset                      | Probe  | `task_085e132ddaa1` | **cancelled** at 07:49:25 — the race is green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-030-publish-two-shapes`                                | WI-030 — publish the template record and the measures route             | Wren   | `task_f31d629a27b8` | **done** at 08:34:37 — the two entries landed in `e682224` (`CONTRACTS.md:434`, `:935`); **Probe's verification is dispatched** as `wi-030-verify-published-shapes-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-005-ci-review-2`                                       | WI-005 — the two CI changes, re-reviewed                                | Probe  | `task_94125a893054` | **done** at 08:29:18 — its findings are being implemented in the tree now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-017-resource-templates`                                | WI-017 — a template tells an agent what a good resource looks like      | Cog    | `task_d9352ee63330` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_0256a298ca60` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-017-template-record-successor-2026-10-21` / `task_4b5a7d412c11` (**done** — the implementation landed at `8b1fd01`, 12:41)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-020-measures-route`                                    | WI-020 — the product reports on itself                                  | Cog    | `task_6c20e85110f9` | **cancelled** at 08:16 — re-dispatched at 08:39 as `task_d4813ecd34ee` (queued), **and that one was cancelled at 10:50 by Chief and merged** into the live dispatch `wi-020-measures-successor-2026-10-21` / `task_7fca497d2514` (queued)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-022-verify-contract`                                   | WI-022 — verify the published reasons                                   | Probe  | `task_8e6fe1c54bfb` | **cancelled** at 08:33 — re-dispatched under `wi-022-verify-contract-r2` as `task_38cb5ecee977`, **done** at 10:37 — **all seven criteria met; WI-022 is accepted**, the item's own "Changed" line corrected, and the citation refresh dispatched as a successor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-026-verify-contract`                                   | WI-026 — verify the published kind                                      | Probe  | `task_3f565465dba3` | **cancelled** at 08:33 — re-dispatched under `wi-026-verify-contract-r2` as `task_25bf9ea7e2cb`, **done** at 10:52 — **all seven criteria met; WI-026 is accepted**, the criterion's citation corrected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-025-verify-adr`                                        | WI-025 — verify the direction answer in ADR 0007                        | Probe  | `task_2b5c9020bf00` | **done** at 09:48 — **not verified**: three defects (a pointer, a figure the ADR should not carry, and the count of travelling rules). The record pass is with Wren; the re-verification is owed after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-012-verify-fixed-tree-2026-10-21`                      | WI-012 — the memory guard, the fixed tree verified                      | Probe  | `task_d9cfcc0b665f` | **done** at 09:45 — **all eight criteria met; WI-012 is accepted**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-010-return-d1-d5-2026-10-21`                           | WI-010 — the direction document, returned for repair                    | Vision | `task_900cda1c2202` | **cancelled** at 10:40 by Chief, before it started, so that one finding could be added — re-dispatched as `wi-010-return-d1-d6-2026-10-21`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-010-return-d1-d6-2026-10-21`                           | WI-010 — the same work, D1 to D6                                        | Vision | `task_9107d7d623d6` | **done** — D1 to D6 repaired and committed at `e560165`; the verification is owed, and it is upstream of WI-024's build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-008-close-reply-classification-2026-10-21`             | WI-008 — the classification of `closeReply`                             | Cog    | `task_1404e5875644` | **done** — the classification is in the table and criterion 2 is met                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-031-contract-2026-10-21`                               | WI-031 — the contract half, the route that closes a turn                | Wren   | `task_8ef054ed68d0` | **done** at 12:36 — the route published at `363428e` (11:05). **The implementation landed 27 minutes later** (`414996c`, 11:32), so the entry's status note was true when it was written and **false when the code landed**. That is WI-065's drift with a second instance, and it is attached to WI-031, where it blocks acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wi-031-implementation-2026-10-21`                         | WI-031 — the implementation, the same route                             | Cog    | `task_a22eeda307db` | **done** at 11:32 — `414996c`, plus `3dd490b` at 12:13 for the published shape of the resolve route. **The pin test is Probe's** and is not written yet: Probe reports that grepping every test file for `/executions/`, `execution.outcome.resolved` and "It ran" returns production files only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wi-007-verify-fixed-tree-2026-10-21`                      | WI-007 — the fixed tree, verified                                       | Probe  | `task_2e431d7647e5` | **done** — Probe's verification of the fixed tree **reached the group on 21 Oct and carried the acceptance**: the report is measured at `63aba3a` and names every pin, and **WI-007 is accepted** (18:05) on it, with the gates re-measured on today's tree. The task itself failed with `BUSY` at 10:10:17, but the work was evidenced: Probe's own session read the item, wrote and committed the end-to-end pin `d343300` ("Hold the note about a decision to the item it is about"), and ran the suite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-007-migration-note-2026-10-21`                         | WI-007 — the migration note's missing sentence                          | Wren   | `task_e6fe9555ca74` | **done** — one sentence of `CONTRACTS.md`, and the last thing between WI-007 and acceptance: **it landed at `3479c31` (11:18)**, and WI-007 is accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-027-verify-fixed-tree-2026-10-21`                      | WI-027 — the turn on the waiting list, verified                         | Probe  | `task_6a9a1179734c` | **failed: `BUSY`** at 10:19:58, and it produced **no verification at all**. **Spent** — a re-dispatch needs a new id and a new title, and it has one: `wi-027-verify-fixed-tree-successor-2026-10-21`, `task_874e6fb66b9b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-021-verify-fixed-tree-2026-10-21`                      | WI-021 — the refusal, verified                                          | Probe  | `task_479859728e18` | **failed: `BUSY`** at 10:20:27, and it produced **no verification at all**. **Spent** — the successor is `wi-021-verify-fixed-tree-successor-2026-10-21`, `task_d817d075a0ce`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `wi-017-template-record-successor-2026-10-21`              | WI-017 — the template record, built against the published shape         | Cog    | `task_4b5a7d412c11` | **done** — **the live dispatch on WI-017**; it merges the two cancelled briefs and adds the Chief's rulings. **The implementation landed at `8b1fd01` (12:41)** — six files, +371/−6 — and **WI-017 is accepted** at 17:10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-020-measures-successor-2026-10-21`                     | WI-020 — the two measures, built against the published route            | Cog    | `task_7fca497d2514` | **cancelled** at 10:03 +11:00 by Chief — still queued, so nothing was lost; its brief was merged into the third dispatch, which carries the band ruling. **The live dispatch on WI-020 is `wi-020-measures-route-r3-2026-10-21`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-025-adr-record-pass-2026-10-21`                        | WI-025 — the ADR's record pass, with Wren                               | Wren   | `task_c3e1f0b6d558` | **queued** — a pointer, a figure, and one thing not to touch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-030-verify-published-shapes-2026-10-21`                | WI-030 — the two published shapes, verified                             | Probe  | `task_dc2aeef86acb` | **cancelled** at 09:51:26 — **but the work is running**: the other Chief session recorded, in `0d5c98c`, that Probe's verification of WI-030 is running in its own session with a finding in hand (the template record's migration note tells a client to add `resource.template.list` to an agent's toolGrants, and the server rejects that today). **Not re-dispatched** — the two published shapes were corrected at `2dcac9c` while the verification was running, and a correction landing in the file while the verifier is reading it is something the verifier has to account for, not something that closes the item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-036-licence-record-2026-10-21`                         | WI-036 — the dependency licences, read from the repositories            | Wren   | `task_2c5159aab413` | **queued** — **the live dispatch on WI-036**; the record that WI-038's gate compares against                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-037-product-record-forge-2026-10-21`                   | WI-037 — the product record says Desk (B); the owner chose Forge        | Wren   | `task_4947c89ca7fe` | **queued** — **the live dispatch on WI-037**; the overdue truthfulness fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-020-measures-route-r3-2026-10-21`                      | WI-020 — the two measures, with the band ruling                         | Cog    | `task_86010eeeb561` | **queued** — **the live dispatch on WI-020**; it carries the band ruling — the band ships only the counts it can defend, and no ratio, until WI-033 and WI-034 land                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wi-039-evidence-contract-2026-10-21`                      | WI-039 — publish the evidence a decision is taken against               | Wren   | `task_dd95fe7df207` | **queued** — **the live dispatch on WI-039**; the contract half of the gap Vision found in the decision control, and it goes before WI-040                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wi-041-readme-licence-2026-10-21`                         | WI-041 — the README tells the truth about the licence                   | Wren   | `task_644f23312ebc` | **SPENT, and the row was wrong** — this request id was the "deliberately undecided" implementation, `64d38f4`, merged `5012df2`. **It is not "the live dispatch on WI-041".** The MIT implementation that followed it was `wi-041-readme-mit-2026-10-21`, `task_d7f28085ef46`, **cancelled when the tiebreak took the file**; the verification that closed the item was `probe-verify-wi-041-readme-licence-2026-10-21-1340`, `task_5b4e02d59413`. **WI-041 is accepted** — see the acceptance row at the end of this table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `wi-043-manifest-licence-verify-2026-10-21`                | WI-043 — the manifest no longer claims a licence                        | Probe  | `task_9b1b44c1025f` | **done** — **not verified.** Chief's one-line removal is exactly right and every gate is green, but the repository does not yet say the truth about its licence: the root `LICENSE` file **is** MIT (tracked since the initial commit `d2f4ec6`) and `CONTRIBUTING.md:238-239` claims contributions are MIT-licensed. **Neither file is covered by any item** — WI-041's is the README, WI-043's is the manifest. The finding opens **WI-068**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wi-023-owner-token-step-verify-2026-10-21`                | WI-023 — verify the owner-token step in the container job               | Probe  | `task_6437af4f18f0` | **done** — **all seven criteria met, no defect, nothing owed to Cog.** Probe's matrix: the right token green, a wrong token fails with the 401, no token fails with the 401, and the 401 line cannot be faked because the assert throws. **The acceptance is the other Chief session's**, because this session wrote the implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-022-citation-refresh-successor-2026-10-21`             | WI-022 — refresh the waiting list's code citations                      | Wren   | `task_682c73ccbc73` | **done** — `CONTRACTS.md` only: two stale citations moved (`waiting.ts:85`→`:95`, `:106-110`→`:140-144`) and the kind's declaration (`:8`) added to WI-026's entry. Branch `wi/022-citation-refresh` (`bd705c2`, `57c1248`), pushed by Wren, and **merged into `main` at `fb236dc`**. **The verification is dispatched** as `wi-022-citation-refresh-verify-2026-10-21`, `task_018a6018b18f`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-024-forge-adoption-2`                                  | WI-024 — the Forge adoption, a second dispatch under a new id           | Cog    | `task_2963d3be0f41` | **cancelled** at 09:55 — **the live dispatch on WI-024 is unchanged: `wi-024-forge-adoption`, `task_5a09991ca5a1`, still queued.** Dispatched by the other Chief session; it is not re-dispatched from here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `peer-group-pointer-2026-10-21`                            | A peer request for Probe to carry a message to the group                | Probe  | `task_4867c6237747` | **cancelled** — it never reached Probe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `peer-correction-wi-024-2026-10-21`                        | The correction retracting that peer request                             | Probe  | `task_4dc3ca58d70a` | **failed: `BUSY`** — created 08:35:05, refused at 10:20:55 because Probe was busy. **A dispatch to a busy verifier is not delivered at all**: the work is still owed, the id is spent, and the correction has to be re-sent with a new id and a new title                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `wi-027-verify-fixed-tree-successor-2026-10-21`            | WI-027 — the unknown turn on the waiting list, verified again           | Probe  | `task_874e6fb66b9b` | **done** at 15:27 — **WI-027 is verified: all nine acceptance criteria met**, on `f7ac848` (product code identical on `51c92f8`). Gate output pasted: typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), **test:e2e 27 passed**. **One defect against another item** — WI-031's entry still says the code does not implement the route — and four observations. **The acceptance is Chief's** — **the live dispatch on WI-027**, a successor: the original failed with `BUSY` at 10:19:58 and produced no verification. The brief asks Probe to stop and say so if the item is already being verified in another session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `wi-021-verify-fixed-tree-successor-2026-10-21`            | WI-021 — the refusal, verified again                                    | Probe  | `task_d817d075a0ce` | **done** at 15:27 — **WI-021 is verified: all five criteria hold**, on `51c92f8` (the product code is byte-identical on the current head). Probe's own gates: typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), and `npm run smoke` 0 in 9.5 s; the two pinned suites **39 passed (39)**. **WI-021 is accepted.** Findings: the item's own file describes a behaviour the code cannot exhibit, a stale citation, and **a question for Chief — a delegation naming nobody is refused in a way a client cannot read**, which is now **WI-069**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `wi-031-refresh-published-counts-2026-10-21`               | WI-031 — refresh the published counts                                   | Wren   | `task_03f8f1042155` | **cancelled** — **the lead made the correction itself** (`50b908d`), because the collision that was the reason for routing it to Wren no longer held: nothing was writing `CONTRACTS.md` at the time. One item, one worker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `probe-verify-published-counts-2026-10-21-1215`            | WI-046 — verify the published counts, and fix the stale number          | Probe  | `task_27a529dbec89` | **cancelled** — the item number was wrong: WI-046 belongs to the strategy session's batch. The work was re-issued as WI-062                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |     |
| `probe-verify-published-counts-2026-10-21-1240`            | WI-062 — verify the published counts, and fix the stale number          | Probe  | `task_2c7c9f4fd696` | **done** — **WI-062 is verified: all six criteria hold**, and **WI-062 is accepted** by the session that wrote neither half. Probe re-implemented the test's own counting method: 35 mutating routes registered, 21 auditing in their own handler, 2 auditing from the service layer, 12 writing no audit entry, and the published table and the code's unaudited list are the same twelve. Gates: the published-shapes suite 3 passed, the server suite 219 passed, `prettier --check` 0, `npm run format:check` 0. **Three findings, and all three are routed**: four stale citations (dispatched to Wren), the template record (WI-065's line, live), and WI-031's stale status note (dispatched)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |     |
| `probe-verify-wi-036-licence-record-2026-10-21-1248`       | WI-036 — verify the dependency licence record                           | Probe  | `task_3bb64dabf31a` | **done** — **WI-036 is verified: all five criteria hold**, and **WI-036 is accepted** by the session that wrote none of the three halves. Probe re-derived the numbers its own way: the lockfile has **500** package entries excluding the root (488 third-party + 6 `link: true` aliases + 6 workspace roots), the record covers **494** (488 third-party + 6 first-party), attribution is 375 + 16 + 97 = 488, and there are **11** distinct licences matching the approved set's 11 entries whose package counts sum to 488. **Three findings, all routed.** And the verdict caught **a defect in the lead's own WI-038 brief** — see the section below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |     |
| `probe-verify-wi-017-template-record-2026-10-21-1305`      | WI-017 — verify the template record, and write its missing test         | Probe  | `task_dbcc178374a7` | **done** — **WI-017 is verified: all seven criteria hold**, and **WI-017 is accepted** by the session that wrote none of the three halves — the implementation is Cog's (`8b1fd01`), the contract is Wren's (WI-030, `e682224`), the test is Probe's (`052f050` — 449 lines, 11 cases, all through the MCP surface an agent uses). **The product diff is empty**: the two drift-pins were proved to bite and then restored. **Three findings, all routed**: the template record's status paragraph is false (**WI-065**, live), the spec path answers an unpublished `internal_error` (named in the item, not dispatched), and the entry's tool table agrees with the code ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |     |
| `wi-065-template-record-contract-status-2026-10-21-1330`   | WI-065 — the template record says what the code now does                | Wren   | `task_6274afe1abc1` | **dead with the runtime, and replaced** — the task's status went to `unknown` when the **Mini App's own dispatcher stopped** (measured and recorded in `.factory/watchdog.md`), and the turn stopped posting at **18:12:27** with the worktree clean, so **no work was lost and none was in flight**. Cancelled at 18:59 (unconfirmed), and the **replacement is dispatched**: `wi-065-template-record-status-replacement-2026-10-21-1905` / `task_2bf6b0a6164a`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |     |
| `wi-067-mcp-workspace-scope-code-2026-10-21`               | WI-067 — the MCP surface's id-addressed tools, the code half            | Cog    | `task_6766b83a3f23` | **queued** — **DELIVERED at 14:32**, after the runtime's refusal had stood for about forty minutes. The reserved id was never registered, so it was not spent, and it was used as reserved. The brief is in `.factory/work/WI-067.md`. Worktree `G:\code\personal-os-worktrees\067-mcp-workspace-scope`, branch `wi/067-mcp-workspace-scope`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wi-067-mcp-workspace-scope-contract-2026-10-21`           | WI-067 — the MCP surface's tools are workspace-scoped, contract half    | Wren   | `task_acc8a5211855` | **queued** — **DELIVERED at 14:32**, the same reserved id, also never registered. The brief is in `.factory/work/WI-067.md`. It queues behind WI-065 on `CONTRACTS.md`; Wren's lane is serialised, so one file carries one live item. Worktree `G:\code\personal-os-worktrees\067-mcp-workspace-scope-contract`, branch `wi/067-mcp-workspace-scope-contract`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `probe-verify-wi-031-close-a-turn-2026-10-21-1340`         | WI-031 — verify the route that closes a turn, and write its pin         | Probe  | `task_b511f4062477` | **queued** — **the live dispatch on WI-031**: the implementation landed at 11:35 with **no verification ever sent**, and the item's own pin is Probe's to write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |     |
| `probe-verify-wi-041-readme-licence-2026-10-21-1340`       | WI-041 — verify the README tells the truth about the licence            | Probe  | `task_5b4e02d59413` | **queued** — **the live dispatch on WI-041**: the work landed at 12:51 and was merged at `5012df2` with **no verification ever sent**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| `probe-verify-wi-024-forge-adoption-2026-10-21-1340`       | WI-024 — verify the Forge adoption and its six briefs                   | Probe  | `task_d2fa4fb7e946` | **queued** — **the live dispatch on WI-024**: the six briefs landed at 12:15 with **no verification ever sent**, and brief 06's constellation test is Probe's to write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |     |
| `wi-066-message-shape-fourth-field-2026-10-21-1340`        | WI-066 — the message shape publishes the fourth field                   | Wren   | `task_0cfbcce20e92` | **queued** — **the live dispatch on WI-066**: the code carries a fourth optional `Message` field the contract does not publish, so WI-031's member-for-member criterion cannot hold until it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |     |
| `probe-verify-wi-037-product-record-forge-2026-10-21-1325` | WI-037 — verify the product record says Forge                           | Probe  | `task_207afe6818f8` | **done** — **WI-037 is verified: all four criteria hold, no defect, and Probe had nothing of its own to hand over.** **WI-037 is accepted** by the session that wrote none of it — the product record is Wren's (`0024f88`), the merge (`94d110f`) is the other Chief session's, the verification is Probe's. `PRODUCT.md:282-284` names **D — Forge** with the date and the recommendation of **B — Desk**, in the same sentence ADR 0007 carries; the old story ("recommended rather than decided") is measured gone from the file; the accent rule is named identically in both documents and its load-bearing amber clause is **identical word for word**. **And nothing else in the product record changed** — `0024f88` touches `PRODUCT.md` only, the whole diff sits inside §11, and `git log 0024f88..HEAD -- PRODUCT.md` is **empty**. Two observations are recorded in the item and **not dispatched**, because `PRODUCT.md` carries a live Wren task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |     |     |
| `wi-042-product-record-closed-questions-2026-10-21-1325`   | WI-042 — the product record's closed questions say they are closed      | Wren   | `task_f1cf510356e8` | **queued** — **the live dispatch on WI-042**: its blocker was WI-037 being live on `PRODUCT.md`, and that has cleared                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| `wi-034-outcome-vocabulary-successor-2026-10-21-1325`      | WI-034 — publish the outcome vocabulary, and the migration              | Wren   | `task_55c33b744ef5` | **queued** — **the live dispatch on WI-034**: the item had **never been dispatched**, and WI-033 (W1) waits on it, because the contract leads the code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `wi-038-licence-gate-script-2026-10-21`                    | WI-038 — the borrow-rule gate's script                                  | Probe  | `task_63e621ad515f` | **CANCELLED at 16:22 — the brief contained a false statement about the record**, so it was replaced rather than let run: it said the six first-party workspaces carry `spdxId: "first-party (no licence yet)"`, and **they carry `spdxId: null`**, with that string being a family label in `agpl.familiesRead`. A gate written from it would have failed on six first-party packages. **Replaced by `wi-038-licence-gate-script-corrected-2026-10-21`, `task_445db8e16adc`, with the measured numbers**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |
| `wi-038-licence-gate-script-corrected-2026-10-21`          | WI-038 — the borrow-rule gate's script, measured rather than remembered | Probe  | `task_445db8e16adc` | **queued** — **the replacement brief**, self-contained. The six first-party entries carry `spdxId: null` and a `firstParty` **object** carrying the workspace path; **the six lockfile paths with no record entry are the workspace roots**, and the `link: true` aliases are covered. The gate must skip by `firstParty.workspace` or the lockfile's `workspaces` globs, **not** by `link: true` and **not** by an `spdxId` string. **And it must not read the record's `summary`**, whose two numbers are wrong and are being corrected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |     |
| `wi-036-record-numbers-and-evidence-2026-10-21`            | WI-036 — the record's own summary has two numbers that do not match     | Wren   | `task_678dfc957439` | **MERGED at 01:12 by Chief, as `38e1a9a`** — and the merge is the lead's job, and it was clean: `docs/dependency-licences.json` and `PRODUCT.md` **have not moved on `main` since the branch's base**, so the branch was not stale, and `git merge-tree` was clean. **What it changed, measured:** the summary's two false numbers (`lockfilePackageEntries` 494 → **500**, `distinctLicences` 12 → **11**), and **seventeen `source.evidence` quotes that were truncated and are now re-quoted in full.** **The clearest case is the one worth stating here:** `node_modules/convert-source-map/LICENSE` opens _"Copyright 2013 Thorsten Lorenz. All rights reserved._ **Permission is hereby granted, free of charge**_ …" and the record used to quote only _"Copyright 2013 Thorsten Lorenz. All rights reserved."\_ — **which, standing alone, says a MIT-licensed package is proprietary.** **The successor to WI-036's findings**, in `docs/**`, which is Wren's, so they were reported and not fixed. `summary.distinctLicences` reads 12 and counts the first-party bucket as a licence (there are 11); `summary.lockfilePackageEntries` reads 494, which is the number the record covers, while the lockfile has 500. Plus 17 entries whose quoted evidence is the copyright header, and `PRODUCT.md` §10's missing note. **`docs/strategy.md` is deliberately out of scope** — it is live in the other Chief session's item, and the JSON alone can make the prose true. **AND THIS MERGE IS WHY WI-036'S RE-VERIFICATION WAS RE-DISPATCHED A THIRD TIME: the second one's criterion 2 said "every dependency entry and every count must be exactly what they were… if any dependency entry changed, that is a serious finding" — and the successor changed seventeen entries and two counts BY DESIGN. So that brief's premise became false, and a brief with a false premise is replaced, not annotated.** `task_da8b553081e2` was cancelled for that reason and the verification re-dispatched under `wi-036-record-reverification-third-2026-10-22`, task `task_762f49d237f9`, batch `batch_47786131592a`, title "WI-036 — the licence record, re-verified against the merged successor" — **whose criterion 2 is the truth: the record changed in exactly two ways, both of them corrections, and the seventeen re-quotes must each be the verbatim head of the file they name** |
| `wi-068-contributing-licence-2026-10-21`                   | WI-068 — the repository still grants MIT in a file no item covers       | Wren   | `task_a4d24aa2dc24` | **queued** — **DELIVERED at 14:35**. One sentence in `CONTRIBUTING.md:236-239`, which says contributions are MIT-licensed. Worktree `G:\code\personal-os-worktrees\068-contributing-licence`, branch `wi/068-contributing-licence`. **Chief's half — the `LICENSE` file and the `FACTORY.md` row that names it — is this session's**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |     |
| `wi-022-citation-refresh-verify-2026-10-21`                | WI-022 — the waiting list's refreshed citations, verified               | Probe  | `task_018a6018b18f` | **queued** — **the verification of WI-022's successor**, dispatched the moment the implementation landed. Five questions: the four citations point at the lines that carry the claims, the claims behind them are still true, **WI-026's criterion 6 now holds in the tree**, nothing else in the entry changed, and the gates pass. **The doubled sentence is a recorded decision and is not a defect**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |

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
| `wi-022-citation-refresh-verify-r2-2026-10-21` **(the same row, corrected — the correction above was itself wrong)** | WI-022 — the waiting list's refreshed citations, verified (again) | Probe | `task_5634427d74e4` | **CORRECTED AGAIN AT 01:30, AND THE PEER SESSION IS RIGHT AND THIS SESSION WAS WRONG.** The correction above said the report had never reached the group. **It has.** Measured against the group's own message store at 01:25 — **126 messages** — the report is at **index 114, `msg_task_5634427d74e4`, 6 587 characters**, and it ends: _"**Verdict: verified.** All four citations are exact, the claims behind them are true of the code, WI-026's criterion 6 now holds in the published text, the diff is eight lines and nothing else, and the gates pass."_ **The peer's withdrawal of this brief is therefore right — WI-022's successor needs an acceptance, not a second look — and the successor is already accepted** (`.factory/work/WI-022.md`, State `accepted`: _"the waiting list's published entry now cites the lines that carry its claims"_). **AND THE REASON THE CORRECTION ABOVE GOT IT WRONG IS NOW MEASURED, AND IT IS THE REUSABLE PART.** The task is a `discussion`, and **it wrote two messages**: the report at index 114, and an **empty** one — `msg_e34f5f54466c`, **length 0** — at index 115, immediately after it. **The task's own `messageId` field says `msg_e34f5f54466c`** — the empty one. **So a discussion task's `messageId` is not the report: the report is under `msg_task_<task-id>`, and the field points somewhere else entirely.** **Reading that field tells you nothing about what was delivered, and the row's instruction — _"if it was dispatched, cancel it"_ — was never safe to act on from the field alone.** The withdrawal stands; the id is spent; nothing is re-dispatched |
| `wi-078-error-envelope-anchor-2026-10-21` | WI-078 — the error-envelope link does not resolve | Wren | `task_993e382b1071` | **queued — the return to implement, after Probe's verification found three findings.** **One of the three is this item's own and it is blocking:** `CONTRACTS.md:178` links `(#the-error-envelope)`; the heading is `### Error envelope` at `:1414`, whose slug is `#error-envelope`, and **the file's own other reference at `:618` uses it correctly** — so the link this item published does not resolve. **One word.** **A new id and a new title, because the verification's id is spent.** The other two findings are not Wren's: the missing gate is **WI-081** (Probe's file) and the contradicted neighbour is **WI-031's own correction, which queues behind this one on the same lane.** Branch `wi/078-error-envelope-anchor`, worktree `G:\code\personal-os-worktrees\078-error-envelope-anchor`. **CANCELLED AT 22:22 — IT WAS A DUPLICATE, AND THE DUPLICATE WAS MINE.** **The fix had already been made at 21:52**, by another lane, on the item's original branch: `f768625`, _"Point the refusal at the envelope's own heading"_, pushed to `origin/wi/078-published-note-bound`. **The chief merged it — `4f19166`, "Merge WI-078: point the refusal at the envelope's own heading", one line of `CONTRACTS.md` — and `CONTRACTS.md:178` now reads `([Error envelope](#error-envelope))`, the same slug `:618` uses.** **So the anchor is fixed, and this dispatch is cancelled rather than left to land a second copy of the same one-word change on a second branch.** **The request id is spent on the cancelled task and must never be reused** — and the lesson is the one the peer session's 22:21 commit names: **one request id, one task.** This batch carried **two** tasks under one id, which is why the peer session could not tell which of them a retry would dedupe against |
| **no request id — the dispatcher never saw one for this item** | WI-081 — nothing holds the published note's bound to the code's | Probe | `task_51cd8330a3e0` | **queued — opened and dispatched.** It comes from Probe's own finding in WI-078's verification: `apps/server/src/__tests__/published-shapes.test.ts` holds three cases (the template record's kinds, the unaudited routes, the route and audit counts) and **zero** references to `note`, `ResolveExecutionInput` or `2_000` — **so it passes identically with the bound unpublished or mis-numbered, and a gate that passes on a wrong tree is not a gate.** **The lead confirmed it by reading the test.** The published bound (`CONTRACTS.md:165`, 2,000 characters) and the code's cap (`apps/server/src/api/executions.ts:9`, `z.string().max(2_000)`) are **both right today, and nothing would say so if one of them changed.** **Probe writes the case and the lead verifies it — the session that wrote the work does not accept it.** Branch `wi/081-published-note-bound-gate`, worktree `G:\code\personal-os-worktrees\081-published-note-bound-gate`. **THE REQUEST-ID COLUMN IS CORRECTED, AND THE PEER SESSION IS RIGHT: the id `wi-081-published-note-bound-gate-2026-10-21` was never registered with the dispatcher, so a row that named it was a record that lies.** **This task went out inside the batch that carried WI-078's anchor fix, under that batch's id `wi-078-error-envelope-anchor-2026-10-21` — one request id for two tasks, which is the mistake the peer session's 22:21 commit named.** **WI-081's durable handle from here is `task_51cd8330a3e0`.** **The fix is not to re-dispatch, which would put a second worker on WI-081, but to say so** |
| `wi-069-refusal-names-nobody-code-2026-10-21` | WI-069 — a delegation that names nobody is refused in a way a client can read | Cog | `task_cac8204bf63a` | **queued — the code half, and it does not wait for the owner's answer.** The reason string is already product behaviour a client reads in the panel, so the refusal can be made readable before the contract says anything about it. **The lead decided the one thing the item left open: the branch becomes reachable and names the id** — it was **written for exactly this case** (`routing.ts:349-353`) and a later filter rendered it unreachable, so making it reachable **restores the code's own intent and removes the dead branch at the same time**; leaving it dead would leave the code promising something the engine does not keep, **which is the defect the item is about.** Batch `batch_48b9074135d0`, worktree `G:\code\personal-os-worktrees\069-refusal-names-nobody-code`. **The contract half still waits on the owner, and `wi-069-refusal-shape-contract-2026-10-21` is reserved and unspent.** The test is Probe's, and is dispatched the moment the implementation lands |
| `wi-076-reset-password-lock-retry-2026-10-21` | WI-076 — the owner's password recovery survives a locked database | Cog | `task_ba1a4b6cda3b` | **queued — released at 22:28, and the reason is measured rather than a change of mind.** The dispatcher fills its slots in **batch order**, and the verifications this would have displaced were **already ahead of it in that order** — so **dispatching to Cog does not take a verification's slot; it takes a slot after them.** Cog's lane was empty, and an owner who cannot recover a password because the command prints a stack trace is a worse thing to leave idle than a verification that moves one place further down the queue. **And the file is free** — this is `apps/server/src/index.ts` and the auth service, and the contract lane is Wren's. Batch `batch_19b8a0870174`, worktree `G:\code\personal-os-worktrees\076-reset-password-lock-retry`. **The title was shortened from the one the item file carried, because the dispatcher refuses a title over eighty characters — and the first attempt created no task, so the id was not spent by it.** The test is Probe's |
| `wi-010-return-two-defects-2026-10-21` | WI-010 — the direction document, returned with two defects | Vision | `task_8377ee92cad2` | **DISPATCHED at 23:45 — the return, not a new item.** Probe's verification (task `task_2f3e137d63ee`, delivered to the group as `msg_task_925de8a43034`, 10 227 characters) says **verified, with two defects**: every repair D1 to D6 holds, the three moved facts hold, the boundary holds, the gates are green — and **two defects are open, both the document's to fix**. Batch `batch_63357c20afb0`. **Defect 1** — the code pointers drifted two minutes after the repair, when WI-031 landed: the control row is `WaitingList.tsx:307-322` ("Approve" `:313`, "Reject" `:321`), the POST is `:113`, the list's comment is `:353-360`; the document says `:274-284`, `:112`, `:293-300`, and `TaskBoard.tsx:315-318` is **still exact**. **Defect 2** — the trace's spend claim is false: the four event payloads carry no spend (`packages/contracts/src/agent.ts:179-208`), and `spendUnits` appears **exactly once** in the published contracts (`common.ts:58`, a bare schema); the spend units live on the execution row and are published by the evidence read, **whose code does not exist — that is WI-086.** **Chief's ruling rides with it: the boundary rule gains a SECOND declared crossing** — the constellation, with the Needs-you rail — because the constellation _is_ the agent list and a decision is taken where the list is. **The rule's exact words are in the brief, so the brief and the document cannot drift.** **The D1–D6 id is spent; a new dispatch needs a new id and a new title** |
| `wi-086-evidence-read-route-2026-10-21` | WI-086 — the evidence a decision is taken against, in code | Cog | `task_8f877457d72d` | **NUMBERED AND DISPATCHED at 23:45.** `CONTRACTS.md:1047-1145` publishes `GET /api/approvals/:id/evidence` and says in its own words that **the code does not implement it yet**: "there is no route for it, and `GET /api/approvals/:id` answers with the approval alone". WI-039 published the promise (`6406291`), WI-040 is the drawer — **and the route in the middle was owned by nothing**: grepping every item file for the read returns no item at all. **So a published contract promised a read and no work item kept it.** Batch `batch_0cd727c48876`, branch `wi/086-evidence-read-route`, worktree `G:\code\personal-os-worktrees\086-evidence-read-route`, cut from `main` at `ceed799`. **WI-086 is the next free number above all taken numbers** (WI-085 is the highest), and if the peer session takes WI-086 first, the collision is recorded in the item that lost the number. **The contract is the specification and is not changed by this item — the contract leads the code.** Two pins are owed: an approval with no execution answers `execution: null`, and a tool call with no completion answers `outcome: 'unfinished'` |
| `wi-024-briefs-defects-2026-10-21` | WI-024 — the briefs' six defects | Cog | `task_5fea284be00f` | **DISPATCHED at 23:47 — the return on the briefs.** Probe's verification (`task_d2fa4fb7e946`, measured at `fc1a3dc`, report delivered to the group) says **every criterion is met on its face and the deliverable is sound — but six defects sit in the briefs.** Batch `batch_2f4882362dc5`. **Defect 1 was the lead's to rule, and is ruled: brief 06 stands and the rule is amended** — the connect decision stays with the constellation and the boundary rule gains a **second declared crossing**, because the constellation _is_ the agent list and a decision is taken where the list is; **the rule's exact words are in the brief**, and WI-010's return carries the same words into the direction document. **Defects 2 to 6 are edits:** brief 03 cites a path that does not exist (`apps/web/src/api/events.ts`), brief 03's 50-event citation points at the drain loop that fetches 200, brief 03's spend criterion cannot be met from the data it reads (the same finding as WI-010's defect 2), brief 04's contracts citation has drifted, and brief 05 says the waiting list "does not poll" and it does. **The resource editor's placement is the owner's question and is not this dispatch** |
| `wi-031-contract-status-correction-r2-2026-10-21` | WI-031 — the route entry says the code does not exist, and it does | Wren | `task_70be52bdefa9` | **PREPARED AT THE TIME, AND DELIVERED AT 00:17 — this row said "NOT DELIVERED", which was true when it was written and is not true now.** The second attempt was interrupted by the runtime restart. The task `task_70be52bdefa9` ran from 23:22, produced 2,550 characters, and then the runtime restarted at about 23:30; the task went to **`unknown`** — released, not cancelled — and **its branch `wi/031-contract-status-correction` carries no commit of its own, so the work is gone and has to be done again.** The id `wi-031-contract-status-correction-r2-2026-10-21` is spent. The re-dispatch is **prepared** under `wi-031-contract-status-correction-r3-2026-10-21`, title "WI-031 — the route entry says the code does not exist, and it does, again", to Wren, with the brief in `.factory/work/WI-031.md` — **and it WAS sent, at 00:17 by the peer session, as `task_4da9c3a974f1`, batch `batch_d4156652506a`, queued to Wren** The first attempt, `wi-031-contract-status-correction-2026-10-21` (`task_be25e082ae5c`), **failed at 20:45** — the runtime restarted mid-turn — so **that id is spent**, and this one is new, with a new title. **The defect, measured by this session before the brief was written:** `CONTRACTS.md:235-242` still says "the code does not implement it yet" and "there is no `/api/executions` route", though the route landed in `414996c`/`3dd490b`, is served at `apps/server/src/api/executions.ts:21` and registered at `app.ts:223`; and the paragraph's "the only writer of an execution's outcome is `resolveExecution`" is false, because the executions service writes it too (`apps/server/src/modules/executions/service.ts:93-111`, and that is the writer this route calls, at `api/executions.ts:25`). It queues behind **WI-065** (live, `task_2bf6b0a6164a`) and **WI-078's anchor fix** (`task_993e382b1071`), because `CONTRACTS.md` is one file and one live item at a time. **WI-031 must not be accepted until this lands** — Probe's own words, in WI-078's verification. Batch `batch_faa4525ade7f` |
| `wi-034-outcome-vocabulary-verify-again-2026-10-22` | WI-034 — the outcome vocabulary, verified again | Probe | `task_46d304ac52ef` | **DISPATCHED at 00:14 — the re-dispatch, because the first one never ran.** The first verification (request id `wi-034-outcome-vocabulary-verify-2026-10-21-1910`, task `task_f5ccfea7ea35`, batch `batch_2c18c7ef889e`) **died with `AGENT_UNAVAILABLE` before it ran** — no report, no measurement, no verdict — so **WI-034 has never been verified at all**, and that request id is spent for good. Batch `batch_915d9b303a81`. The brief is the one that was already written: seven criteria, and **the contract's claims about today's code are the ones to test** — the route helper hardcodes `success`, the audit service defaults to it, and **no writer in the product writes `failure`**. **The merge moved the lines by 64, so the item file's own line numbers are stale.** **Probe writes the check; the lead names it** **THE VERDICT CAME BACK: NOT VERIFIED** — all seven criteria hold, and one defect blocks the acceptance: three of the section's code citations have drifted under it, and one of them contradicts the neighbouring entry's own corrected citation of the same line. The task ran 55 minutes and returned a 9 098-character report. **WI-034 is NOT accepted, and the lead has not accepted it.** The correction is dispatched to Wren in the row below, and the detail is in `.factory/work/WI-034.md`|
| `wi-080-stale-contract-comment-verify-2026-10-21` | WI-080 — the code comment that describes the contract, verified | Probe | `task_9f0c155958f9` | **DISPATCHED, AND THE LEDGER HAD NO ROW FOR IT UNTIL NOW — this session's own hole, found by reading this table against the dispatcher's own state.** WI-080's implementation was merged into `main` as `ceed799` (the comment at `apps/server/src/modules/mcp/server.ts:145-153` now says the contract states the rule, that it is the same rule the writes carry, and where it is published — `CONTRACTS.md:720`, `:734-735`, `:642`, `:705`), and the lead measured that the stale sentence no longer occurs in the file and that **all 14 changed lines in the code file are comment lines**. **The verifier is Probe because the implementation was Cog's** (`task_9d753ce22c6b`, done, 6,111 characters) — **the session that wrote the work does not accept it.** Batch `batch_de65c84293ae`, **and then it FAILED**: the task was refused BUSY after 28 seconds with no result (`task_9f0c155958f9`), so **WI-080 has still never been verified** and that id is spent. **Re-dispatched at 02:41** under `wi-080-stale-contract-comment-verify-again-2026-10-22`, title "WI-080 — the code comment that describes the contract, verified again", batch `batch_4eec70cdf2cc`, task `task_0d1955cb7610` — **and that one was refused BUSY after 28 seconds too, with no result**, so that id is spent as well. **And the peer session's third attempt died too**: `wi-080-stale-contract-comment-verify-third-2026-10-22`, task `task_5152a57d9d84`, was refused `BUSY` after 4m40s (03:10:29 → 03:15:09) with a zero-length answer, so that id is spent as well — **which left WI-080 with no live verification at all from 02:41 until 03:27, and no report of any kind in between.** **The live dispatch is now Wren's**: `wi-080-stale-contract-comment-verify-wren-2026-10-22`, task `task_6a3e9baccce4`, batch `batch_292830de9d51`, queued at Wren at 03:27 — see the row below. The brief is `.factory/work/WI-080.md`, and the lead's measurements are in it **with the caveat that `CONTRACTS.md`'s lines have moved before, so the verifier re-measures rather than trusting the numbers above** |
| `wi-094-pin-reads-the-rule-again-2026-10-22` | WI-094 — the pin reads the rule out of the document, two crossings | Probe | `task_b804c88b7aa7` | **DISPATCHED AT 01:56 — THE RE-DISPATCH, because the first dispatch was cancelled with nothing in its place.** The first dispatch (`wi-094-pin-reads-the-rule-2026-10-22`, `task_6c74144b03df`) was cancelled at 01:38:37, and **for three minutes the tree was red with nobody holding it**: `main` is red on two cases in `apps/web/src/__tests__/forge-briefs.test.ts` because the pin hard-codes `const exception = 'one declared exception, the Needs-you rail'` (`forge-briefs.test.ts:275`) while the amended rule publishes **two** crossings (`prototypes/DIRECTION.md`, `d3ef0d2`). **A cancelled task is not a dispatch, and its id is spent.** Batch `batch_754ed5784eb9`, **and then it FAILED**: refused BUSY after 28 seconds with no result (`task_b804c88b7aa7`), so **the pin's fix did not happen** and that id is spent. **Re-dispatched at 02:41** under `wi-094-pin-reads-the-rule-third-2026-10-22`, title "WI-094 — the pin follows the rule, and the rule has two crossings", batch `batch_84abdeeb9a51`, task `task_5479f0f5e8ca` — **and that one was refused BUSY at 02:47 as well.** **The work had already landed under another number**: WI-093's pin (`ab27fd9`, merged `203b7e0`) reads the boundary rule out of `prototypes/DIRECTION.md`, holds brief 01, brief 05 and the briefs index to it, **and parses the table cells instead of comparing a padded row** — which is this item's third case, the one this session measured and corrected in `.factory/work/WI-094.md`. The brief is `.factory/work/WI-094.md` — which carries the lead's 01:52 addition, the index's copy of the rule and the keeper — and the dispatched message adds two corrections: **the suite does not go green when WI-024's briefs land** (the briefs move one side of the assertion and the pin moves the other, and only both together are green), and **WI-024's briefs repair had landed on `origin/wi/024-forge-briefs-correction` at `71e91d0`** and was merged into `main` at 01:54 (`69c250b`). **The title was shortened to fit the dispatcher's 80-character cap — the 85-character title was rejected and created no task, so that id was not spent by the failed attempt — and the message is verbatim** |
| `wi-031-contract-verify-2026-10-22` | WI-031 — the contract's route entry, verified against the merged tree | Probe | `task_30847905e60e` | **DISPATCHED AT 02:35 — the verification, and WI-031 has never been verified by anybody.** Its implementation landed earlier, and its contract correction landed on `main` in the same window as this session's WI-065 merge (`7bc3e2d`): the contract now says the code implements the route and names **both** writers of an execution's outcome. **The rule is that the Chief dispatches Verify the moment Implement lands, and this is that moment.** Batch `batch_4a020620af78` — **and it was refused BUSY after 28 seconds with no report**, so that id is spent and WI-031's verification was still not done. **The peer session's re-dispatch died too**: `wi-031-contract-verify-again-2026-10-22`, task `task_f93c4f09452d`, was refused `BUSY` after 4m23s (03:10:18 → 03:14:41) with a zero-length answer, so that id is spent — **WI-031 has no verification report of any kind, and three request ids are now spent on it.** **The live dispatch is now Wren's**: `wi-031-contract-verify-wren-2026-10-22`, task `task_c07c22d8d6b5`, batch `batch_5529c0595838`, queued at Wren at 03:34 — see the row below. The brief is `.factory/work/WI-031.md` — nine criteria — and the lead's note says three things: **the tree moves, so re-measure every pointer and say which commit you measured at**; **the criterion "a test pins it, and the test is Probe's to write" is the verifier's to satisfy**, on the verifier's own branch and not merged; and **the three red cases in `apps/web/src/__tests__/forge-briefs.test.ts` that this brief warned about are GONE — WI-093's pin fixed them, merged `203b7e0` and accepted — so any red the verifier finds is a real finding** — any other red is Probe's to report. **The owner of the work is Cog and Chief accepts, so Probe verifies and does not accept** |
| `wi-036-record-reverification-again-2026-10-22` | WI-036 — the licence record, re-verified under MIT | Probe | `task_da8b553081e2` | **DISPATCHED at 00:15 — the third dispatch, because the first two both died.** The helper (`hlp_72d0eace0a08`) was interrupted by the runtime stop at 20:47; the peer's (`task_e4b8ac641700`, request id `probe-verify-wi-036-licence-record-mit-2026-10-21`) **died with `AGENT_UNAVAILABLE` before it ran**. **So WI-036 sat in `verify` with no verification behind it, and both earlier ids are spent for good.** Batch `batch_eee413cb8359`. The live brief carries the peer's fuller wording — it names `docs/strategy.md` as well as the licences record — and the five criteria are measured **again against the tree as it stands**, with the numbers **re-derived rather than trusted**. **The dependency entries must be unchanged**, and the brief says so: compare against the commit before the correction and **report every difference**. **The acceptance is not Chief's**, because Chief changed the files |
| `wi-069-refusal-names-nobody-code-again-2026-10-22` | WI-069 — the refusal that names nobody, in code | Cog | `task_eb08b8648967` | **DISPATCHED at 00:15 — the re-dispatch, because the first one never ran.** The first code dispatch (request id `wi-069-refusal-names-nobody-code-2026-10-21`, task `task_cac8204bf63a`, batch `batch_48b9074135d0`) **died with `AGENT_UNAVAILABLE` before it ran** — no code, no commit, no report — so **the branch is exactly as `work-item.ts new WI-069` left it**: `wi/069-refusal-names-nobody-code` at `68de2ca`, worktree `G:\code\personal-os-worktrees\069-refusal-names-nobody-code`, and that request id is spent for good. Batch `batch_34569948b8d7`. The lead's decision rides with it: **the branch becomes reachable and names the id**, because it was written for exactly this case and a later filter rendered it unreachable. **The check is Probe's, not Cog's**, and is dispatched the moment the implementation lands. **The contract half still waits on the owner, and `wi-069-refusal-shape-contract-2026-10-21` is reserved and unspent.** **AND A SECOND DISPATCH FOR THE SAME ITEM APPEARED, AND THE TIEBREAK IS SAID OUT LOUD: ONE ITEM, ONE IMPLEMENTER.** The peer session re-dispatched WI-069's code half at 00:17 — request id `wi-069-refusal-names-nobody-code-r2-2026-10-21`, task `task_4a1e95f795ae`, batch `batch_b273a0104cc3`, title "WI-069 — a delegation that names nobody is refused, readably" — **and two implementers on one item is two branches and two copies of the same change.** **The peer's task is cancelled and this one stands, and the reasons are measured:** this dispatch was created at **00:11:34**, six minutes earlier, so **the dispatcher serves it first in batch order**; its brief is **5 683 characters** and carries the item file's own criteria in full **plus the state of the branch** (`68de2ca`, no commit of its own), while the peer's is **959 characters** and points at the item file; and **the one rule the peer's brief carries that mine does not — that `CONTRACTS.md` is one live item at a time, because WI-031's correction and WI-069's contract half are the same file — is already stricter in mine**, which says the code half **must not edit `CONTRACTS.md` at all**. **The peer's brief also gives the death time as 23:12:38; the dispatcher's own record says 23:32:38.** The peer's request id is spent on the cancelled task **MERGED AT 02:12 AS `eb775b5` - Cog's code half, on `wi/069-refusal-names-nobody-code` at `95f95af`.** Three files, +107/-4: `apps/server/src/modules/conversations/routing.ts` (+42), `apps/server/src/modules/conversations/service.ts` (+15) and the item's own record. **The merge-tree was clean.** Gates on the merged tree: typecheck **0**, build **0**, format **0** (measured in a scratch worktree at the commit), test **1** - **server 28 files / 295 tests green, worker 31, agent-adapters 16, contracts 28 green, and web 3 failed | 65 passed (68) - and those three are the pin's, unchanged by this merge, and they are WI-094's.** **What the product can now do: a delegation that names nobody is refused by name** - the branch that named the target it turned down is reachable, so the refusal a client reads says who was not woken. **The acceptance is not Chief's: Probe verifies the merged tree, and the contract half still waits on the owner's answer to whether the product should publish the shape of a refusal.** |
| `wi-085-autonomy-policy-attack-again-2026-10-22` | WI-085 — the independent attack on the autonomy policy, again | Probe | `task_029bcf0e9ab8` | **DISPATCHED at 00:43 — the re-dispatch, because the first one reached Probe and returned nothing.** The first dispatch (request id `wi-085-autonomy-policy-attack-2026-10-21`, task `task_bea8586af7aa`, batch `batch_0003c8d5b647`) **delivered its brief** — it is in Probe's chat, 3 972 characters — **and came back `failed` with `error: BUSY` and a zero-length report.** **So this is a different failure from the three above: the work reached the agent and the answer did not come back.** The branch is exactly as it was: `wi/085-autonomy-policy-attack` at `cd9507e`, **no commit of its own**, so **no attack has been written.** Batch `batch_ee7c4912191c`. **And the situation moved while this item waited: Cog's WI-082 implementation finished** (`task_8e03c28ed9df`, done, 11 194 characters), **so the implementation now exists to disagree with** — and the brief says the stronger thing: **write the test against the published decisions, not against whatever Cog wrote, and do not weaken the test to match the code.** **AND THE SECOND DISPATCH WAS CANCELLED BEFORE IT EVER STARTED, SO THE ITEM HAD NO LIVE DISPATCH AT ALL — a cancelled dispatch does not free the item, and it does not re-dispatch it.** `task_029bcf0e9ab8` was cancelled by the other Chief session at **00:48:59**, **six minutes after it was created and before it was ever started** (`started` empty, `result` empty), so **its brief never reached Probe** — Probe's chat holds only the first brief (`msg_task_bea8586af7aa`, 3 972 characters) and its empty answer (`msg_ec91a51ddc42`, length 0), and **not one word of this attack has been written.** **So the item is dispatched a third time, under a third id, with a third title: `wi-085-autonomy-policy-attack-third-2026-10-22`, task `task_aff3a7d35ca5`, batch `batch_c7c6dac19ed4`, title "WI-085 — attack the autonomy policy against its published decisions".** **The reason this one cannot simply wait is measured, not asserted: WI-082 is the largest change this factory has made to the execution path, and the owner relaxed the implementer-must-not-accept rule for that item alone — so WI-085 is the check that makes the relaxation safe, and an item carrying the cost of a relaxation is not a thing that can sit idle.** **If the other session sends it instead, cancel this one: one item, one dispatch, and the later one wins** **UPDATE, 01:48 - THE ATTACK IS WRITTEN, AND THE THIRD DISPATCH IS CANCELLED AS A DUPLICATE.** A third dispatch went out (`wi-085-autonomy-policy-attack-third-2026-10-22`, `task_aff3a7d35ca5`, batch `batch_c7c6dac19ed4`) and sat queued; **in the meantime the attack was written by an independent verifier agent under the peer session**, and it is on the branch: `c33fc41` (01:21, "Take the attack as the lead rewrote it, and record what it found") and `e8b3b8b` (01:27, "Cover the two lists the resolver leaves unguarded, and pin the mode surfaces"), with **`apps/worker/src/__tests__/autonomy-policy-attack.test.ts` carrying 33 `it()` cases**. The verdict is recorded in **WI-082's own file** (33 cases, 29 pass, 4 fail, and every failure is a finding: WI-082 meets the settled decisions on the resolution point, on strictest wins, on deny by default and on readability, and **does not meet the fourth**, because the effective mode gates nothing). **The third dispatch was cancelled at 01:48 as the duplicate it had become - one verifier, one item, one verification - and its request id is spent.** **WI-085 is implemented and its verdict is recorded; the acceptance is Chief's, and the branch is red by design because the four failures are findings against WI-082's code, not defects in the attack.** |
| `wi-078-error-envelope-anchor-2026-10-21` | WI-081 — nothing holds the published note's bound to the code's | Probe | `task_51cd8330a3e0` | **THE ID CELL IS CORRECTED, AND THE PEER SESSION IS RIGHT: `wi-081-published-note-bound-gate-2026-10-21` was never registered with the dispatcher, so a cell naming it was a record that lies. This task went out inside the batch that carried WI-078's anchor fix, under that batch's id - one request id for two tasks - and that id is spent on both and can never be reused, because a retry under it would dedupe against the wrong one. **WI-081's durable handle is its task id, `task_51cd8330a3e0`.\*_ **ACCEPTED — 2026-10-22, by Chief, and the lead verified it because Probe wrote it.** The branch `wi/081-published-note-bound-gate` is merged into `main` as **`28aedaf`**. **The lead proved the check bites, in both directions, on this host:** the contract's published number moved to 20 000 → **`1 failed | 3 passed (4)`**, "expected 20000 to be 2000"; the code's cap moved to 20 000 → **`1 failed | 3 passed (4)`**, "expected 2000 to be 20000"; **both restored, and `git diff` on the two files under test is empty.** The diff is **one file of code** (+61/−8) and **the three cases already in it are byte-identical**. The gates on the merged tree: typecheck 0, test 0 (**437** — server 294, web 68, worker 31, agent-adapters 16, contracts 28), build 0, and the format gate measured on the committed tree. **Product: the owner's note's cap is a promise the repository keeps** — before this, the published number and the enforced number were two numbers that happened to be equal, and one moving alone would have left the contract saying something the code did not do with **nothing saying so**; now one moving without the other turns a test red, and the failure names both. **The findings went out**: the stale header is fixed on the branch (and the new bullet carries **no number on purpose**), the header conflict with WI-075's branch is the lead's and did not have to be resolved by this merge, the web bundle-budget timeout is **WI-092**, and **WI-068 has not been started** |
| `wi-092-bundle-budget-timeout-2026-10-22` | WI-092 — the bundle-budget test inherits a five-second timeout it never asked for | Probe | `task_d0ac3698176e` | **NUMBERED AND DISPATCHED at 00:58.** Batch `batch_324aa23dda74`, branch `wi/092-bundle-budget-timeout`, worktree `G:\code\personal-os-worktrees\092-bundle-budget-timeout`. It is Probe's own finding in WI-081's verification, and Probe did not fix it because it belongs to another item: `apps/web/src/__tests__/bundleBudget.test.ts` has **no explicit timeout**, there is **no vitest config in `apps/web` or at the root**, so **every case inherits Vitest's 5 s default**, and **nine cases each spawn a `tsx` process.** Probe's measurement: idle 3.07 s green, 6 burners 8.07 s green, 12 burners 26.59 s green, **48 burners — 6 of the 9 cases timed out at 5 000 ms**. **And it is not only saturation: one of three full `npm run test` runs went red on a merely busy machine** (23.6 s, then "Test timed out in 5000ms"). **This is the same class as WI-074's finding at `apps/server/src/__tests__/agents.test.ts:117`, and the class has now happened twice — the second time taking a green suite red on a machine that was not under load.** The item asks for the file to choose its own timeout, **without weakening the gate**: `npm run build` only **warns** when a chunk grows past the limit, and `scripts/verify-bundle-size.ts` is what stops the change. **A root vitest config is deliberately out of scope** — it would change the timeout of every suite, and the lead has not asked for that |
| `wi-092-collision-amber-pin-2026-10-22` | WI-092 — a collision on the number, and the item that lost it renumbers | the other session (the amber pin) | — | **THE TIEBREAK, SAID OUT LOUD: WI-092 IS THIS SESSION'S, AND THE OTHER SESSION'S ITEM RENUMBERS TO WI-093.** Measured at 01:35: `origin/main`'s `.factory/work/WI-092.md` is **this session's** — "the bundle-budget test inherits a five-second timeout" — committed at `0d4731f` and **dispatched** (`task_d0ac3698176e`, queued to Probe), **and the brief that task carries names that exact file path.** The other session has taken WI-092 for a different item — "the pin that says the old rule instead of the current one", on branch `wi/092-amber-pin-restated` — and **has written it over this session's file in the shared main checkout, uncommitted.** **Three facts settle it:** (1) **a number is taken when it is recorded, not when it is typed into an uncommitted file** — this session's is committed on `origin/main` and in the dispatcher's ledger; (2) **renaming this session's item would orphan a queued task whose brief names the file path**, and a dispatch that points at a path that no longer exists is not a dispatch; (3) **the other session's claim costs a rename on a branch that has not been merged, and nothing of theirs is destroyed by it.** **WI-093 is free** — the highest number on disk is 92. **So the amber pin becomes WI-093, and the collision is recorded here and in the group.** **This session's file was not touched: the other session's uncommitted content was left exactly as it was, and this row is here because `.factory/work/WI-092.md` is the one file in this repository that two sessions are writing at once** **MERGED INTO `main` AT `203b7e0` (2026-10-22, 02:49), AND VERIFIED BY CHIEF, who is this item's verifier.** The branch `wi/093-amber-pin-restated` (renamed from `wi/092-amber-pin-restated` when the item was renumbered) carries the pin at `ab27fd9` — the boundary rule read out of `prototypes/DIRECTION.md` and held to brief 01, brief 05 and the briefs index, with the table cells parsed instead of matched as rendered text — and WI-087's Phase 1 accent salvage, without which the pin cannot be green. **The gates on the merged tree: typecheck 0, test 0 (server 28 files / 295 tests, web 9 / 82, worker 5 / 31, agent-adapters 2 / 16, contracts 4 / 28), format:check 0 measured on the committed tree with the pinned prettier, build 0, test:e2e 0 (27 passed), verify:bundle 0.** **The proof that both replacements bite — five drifts, five reds, each restored byte-for-byte — is in `.factory/work/WI-093.md`.** **WI-087's own verification is not this item's verification, and the lead has not accepted WI-087** **ACCEPTED — 2026-10-22, Chief, who is this item's verifier.** Every criterion is met and the evidence is in `.factory/work/WI-093.md`: the six gates on the merged tree, and the five drifts that are five reds, each restored byte-for-byte — the document dropping its clause, the document naming one crossing, the briefs index drifting, brief 01 drifting, and amber returning at `AppShell.tsx:37`. **Neither of the two replacement assertions is commit-anchored or skipped.** The brief's rule 8 — what the accent guard covers that the pins do not, and the other way round — is answered there too. **WI-087's Phase 1 accent salvage rode in with this merge because the pin cannot be green without it; that is a dependency, not an acceptance, and the lead has not accepted WI-087**|
| `wi-094-pin-reads-the-rule-2026-10-22` | WI-094 — the pin reads the rule out of a phrase, and the rule moved | Probe | `task_6c74144b03df` | **NUMBERED AT 01:35, AND THE TREE IS RED BECAUSE OF IT — SO THE PUSH WAITS.** The red is measured: `apps/web/src/__tests__/forge-briefs.test.ts:275` holds `const exception = 'one declared exception, the Needs-you rail';` and **the rule now has two declared crossings** — `prototypes/DIRECTION.md` was amended in `d3ef0d2` (01:20, "Repair the direction document: the drifted pointers, the spend claim, and the second crossing"), where "one declared exception, the Needs-you" **no longer occurs and "two declared exceptions" does**. **Two cases are red:** *"is the rule in DIRECTION.md, exception included, and the briefs quote it with the exception"* and *"carries the reason the exception exists, in the brief that states the rule in full"*. **The pin's own comment says what it is for** — *"The flat rule — the one without this clause — is what two of the briefs quoted before the lead settled the landing page's premise, and it is the one thing a document quoting itself cannot catch"* — **so the fix is NOT to swap one phrase for another: the pin must read the exception clause out of the document and hold the briefs to that, and must be STRONGER for it, asserting that the document publishes a clause naming BOTH crossings so the document cannot quietly lose one.** `\*\*/_.test.ts`is Probe's by the ownership table, so the lead dispatches it and does not write it. **DISPATCHED at 01:35**, batch`batch*c9fb073fa382`, branch `wi/094-pin-reads-the-rule`, worktree `G:\code\personal-os-worktrees\094-pin-reads-the-rule`. **The briefs are NOT this item's** — `prototypes/briefs/01`and`05` still quote the old rule and **that is WI-024's repair, Cog's, in flight** (`task_5fea284be00f`). **The tree is red in the window between the two landings, and that is correct: the pin is holding the briefs** **UPDATE, 01:48 - THE TASK WAS CANCELLED, AND THE ITEM WAS ABSORBED INTO WI-093.** The dispatch `task_6c74144b03df`never started and was **cancelled**: the peer session's **WI-093** - "The pin that says the old rule instead of the current one", re-filed from their WI-092 - **absorbs this item, and the reason is one file**:`apps/web/src/**tests**/forge-briefs.test.ts`carries two independent pins, and one file carries one live item. **WI-093's file carries this item's analysis and intent unchanged and points at this item's file**, so the analysis is not lost, and this item's file stays as the record of it. **WI-093 is staffed by a verifier agent under Chief because Probe's verification queue is saturated, and Chief reviews it** - the separation that matters is preserved, because the pin is written by an agent that did not write the work it checks. **The request id`wi-094-pin-reads-the-rule-2026-10-22`is spent and must never be reused.** **UPDATE, 02:20 - THE FOLD INTO WI-093 STANDS IN THE RECORD, BUT THE WORK WAS NEVER FOLDED, AND THE ORDER IS THE LEAD'S CALL.** Measured on `wi/092-amber-pin-restated`at`2365586`: the branch still holds `const exception = 'one declared exception, the Needs-you rail';` and does not read the clause out of the document at all - **so WI-093's agent landed the amber pin (`7c99dd7`) and the rule's reds are still red on that branch.** The reds are the tree's reds, and **the only live path to green is Probe's re-dispatch**, `wi-094-pin-reads-the-rule-again-2026-10-22`, `task_b804c88b7aa7`, queued. **So: WI-094's task lands FIRST, and then WI-093's branch merges `main`in** - the peer has merged main into that branch twice already, at 01:54 and 01:57 - **and that merge is checked for a conflict in`apps/web/src/**tests**/forge-briefs.test.ts`; if it conflicts, the boundary-rule block comes from WI-094 and the amber cases from WI-093.** One file, one live item, one writer at a time. **And the two additions this session made to WI-094's own file landed at 01:52 and 01:57 - the index's copy of the rule needs a keeper, and the third red is a matcher that reads rendered cells instead of parsed ones - so both are in front of whoever writes the pin, because the item file is the brief.** |
|`wi-036-record-reverification-third-2026-10-22`| WI-036 — the licence record, re-verified against the merged successor | Probe |`task_762f49d237f9` | **DISPATCHED at 01:35 — the third dispatch, because the second one's premise went false when the successor merged.** The second (`task_da8b553081e2`, `wi-036-record-reverification-again-2026-10-22`) was **cancelled at 01:35**, not because it was wrong but because **its criterion 2 said "every dependency entry, every `spdxId`, every attribution and every count must be exactly what they were… if any dependency entry changed, that is a finding, and it is a serious one"** — and the successor, merged as `38e1a9a`twenty minutes earlier, **changed seventeen entries'`evidence`quotes and two counts by design.** **A brief with a wrong premise is replaced, not annotated.** Batch`batch_47786131592a`. **What the new brief asks, and it is the whole point of the successor:** the record's change must be **exactly** the two summary numbers — **500** lockfile entries and **11** distinct licences, **re-derived and not read** — and the seventeen re-quoted evidence strings, **each of which must be the verbatim head of the file it names** — and **no evidence quote may still stop before the grant**, because a quote that ends at "All rights reserved." is a false statement about a permissive licence — **AND IT DIED: refused `BUSY`after 28 seconds (the 02:11 wave) with a zero-length answer, so that id is spent and WI-036's re-verification was left with no live dispatch at all.** **The live dispatch is now Vision's**:`wi-036-record-reverification-vision-2026-10-22`, `task_8609cdc160f8`, batch `batch_49d7c93ab481`, queued at Vision at 03:35 — see the row below
| `probe-verify-wi-066-published-shapes-2026-10-21`**(re-requested at 21:55 — NOT DISPATCHED, THE ID IS SPENT)** | WI-066 — the published shapes, verified | Probe | — | **NOT DISPATCHED, AND THE REASON IS MEASURED: THIS REQUEST ID WAS ALREADY USED.** This session dispatched it at **21:14** — as`hlp_1f8922079492`— **Probe's verification came back and the lead accepted WI-066 at 22:05.** The peer's request for the same id was written at **21:55**, before that acceptance, and it is answered now: **the id is spent, the item is closed, and a second dispatch would put a second verifier on a closed item.**`.factory/work/WI-066.md`reads State`accepted`, and the acceptance is in the row above. **The brief in that request is exactly the brief Probe was given, and exactly what Probe checked** — the item file, ten criteria, three gates, and *"measure the code's `Message` schema, the count is five, not four"\_ — **and the acceptance records the count: five extension fields** — `status` `:78`, `correlationId` `:79`, `origin` `:80`, `executionId` `:81`, `detail` `:90` — **with the contract's prose (`:68`), its block (`:71-84`) and the code all agreeing on five** |
| `wi-034-citation-drift-correction-2026-10-22` | WI-034 — the three citations that drifted under the section | Wren | `task_fa2d04db7c5d` | **DISPATCHED at 02:51 — the correction that Probe's NOT VERIFIED verdict sent back.** Batch `batch_5f660955d239`, branch `wi/034-citation-drift`, worktree `G:\code\personal-os-worktrees\034-citation-drift`. **The defect, measured by the lead on `main` at `203b7e0`:** `CONTRACTS.md:936` cites `resources/service.ts:515` (that line reads `return current;`; the claim belongs at `:525`), `CONTRACTS.md:956` cites `audit/service.ts:71` (it reads `.values({`; the claim belongs at `:79`), and `CONTRACTS.md:962` cites `app.ts:185` (it reads `request.actorType = 'human';`; the claim belongs at `:190`). **And the contract contradicted itself about one of them** — the measures route already cites `audit/service.ts:79` correctly at `CONTRACTS.md:1408`, which `100324a` corrected. **The order is named by the lead: the correction lands first, and Probe's check (`02c4627`, on `wi/034-outcome-vocabulary-check`, red today only on this defect — `1 failed \| 5 passed (6)`) lands after it, so it lands green.** **AND WI-034 IS ACCEPTED — 2026-10-22, 05:50.** The correction landed (`9ff3616`, merged `26fb68e`) and Probe's check landed with it, **green on the merged tree: `Test Files 1 passed (1) | Tests 6 passed (6)`**, pinning all six citations — `audit/service.ts:79`, `app.ts:190`, `resources/service.ts:525` among them. **The acceptance rests on two things and only two: Probe's verification measured all seven criteria holding, and the one defect it found is now corrected and the verifier's own instrument confirms it.** **What the product can now do: the contract's audit-outcome entry can be followed — the vocabulary, the rule that every mutating route writes an entry, and the migration note all land on the code they talk about, and a gate in the tree says so.** **And one red is coming, dated: two of the check's six citations move when the vehicle lands (`helpers.ts:62` gains 14 lines before it; `executor.ts:104` moves), so the check goes red then — that is the gate working, and the fix is to re-measure those two citations in the landing commit** |
| `wi-094-pin-reads-the-rule-third-2026-10-22` | WI-094 — the pin follows the rule, and the rule has two crossings | Probe | `task_5479f0f5e8ca` | **THE THIRD DISPATCH OF WI-094'S PIN — AND IT DIED `BUSY` AT 02:47, BEFORE IT RAN.** Batch `batch_84abdeeb9a51`. **The work it was dispatched for had already landed**: `ab27fd9` on `wi/093-amber-pin-restated` reads the boundary rule out of the document, holds brief 01, brief 05 and the briefs index to it, and parses the table cells — and it was merged into `main` at `203b7e0` and verified by Chief, whose five-drift red-then-green proof is in `.factory/work/WI-093.md`. **One file, one live item, one writer** — so this dispatch has nothing left to do, and its request id is spent for good |
| `wi-010-direction-document-verify-2026-10-22` | WI-010 — the repaired direction document, verified | Probe | `task_f99a95269325` | **DISPATCHED AT 03:11 — the verification WI-010 has never had.** Batch `batch_ec9af87a7b55`, **queued** at Probe — **AND IT DIED: refused `BUSY` after 9m47s (03:04:26 → 03:14:13) with a zero-length answer, so that id is spent and WI-010 was left with no live verification at all.** **The live dispatch is now Cog's**: `wi-010-direction-document-verify-cog-2026-10-22`, `task_0398b06e6479`, batch `batch_a352306b01f5`, queued at Cog at 03:27 — see the row below. The repair landed at `d3ef0d2` and the rule is that the lead dispatches Verify the moment Implement lands, and **this is that moment**: the document publishes the boundary rule with two declared crossings, brief 03's spend claim is corrected, and the pointers are pinned at a named commit. **Two earlier dispatches for this item are stale and are not re-used: `wi-010-pins-repoint-2026-10-22` / `task_881a59c250c3` and `wi-010-repairs-two-defects-retry-2026-10-22` / `task_34751d004b8f`, both `BUSY`, both spent.** **The brief corrects the false premises:** WI-024's briefs repair merged (`69c250b`), and **WI-093's pin merged (`203b7e0`) and now reads the rule out of the document — so there is nothing left to re-point**, which is what the earlier dispatch asked for; WI-098 (the ADR's own copy) is a separate item with its own verification queued, and the ADR is not this item's defect; and **the resource editor's placement is the owner's open question, so the document's silence about it is not a defect.** **The tree is green and pushed at `cad175d`** — typecheck 0, test 0, build 0, format 0, e2e 0 (27 passed), bundle 0, CI and CodeQL `success` — so any red the verifier finds is a real finding |
| `wi-031-contract-verify-again-2026-10-22` | WI-031 — the contract's route entry, verified once more | Probe | `task_f93c4f09452d` | **DISPATCHED AT 03:30 — the verification WI-031 has never had.** Batch `batch_3bbb068fb6cf`, **queued** at Probe — **AND IT DIED: refused `BUSY` after 4m23s (03:10:18 → 03:14:41) with a zero-length answer, so that id is spent.** **The live dispatch is now Wren's**: `wi-031-contract-verify-wren-2026-10-22`, `task_c07c22d8d6b5`, batch `batch_5529c0595838`, queued at Wren at 03:34 — see the row below. The second attempt (`wi-031-contract-verify-2026-10-22`, `task_30847905e60e`) was refused `BUSY` after 28 seconds with no report, so **that id is spent** and this is a new id and a new title. The correction merged at `e125039`: the contract says the code implements `/api/executions` and names **both** writers of an execution's outcome. **The tree is green at `7c4bc45`** — so any red the verifier finds is real, and the three reds in `forge-briefs.test.ts` that an earlier version of this brief warned about are gone (WI-093's pin, merged `203b7e0`). **Re-measure every pointer and say which commit you measured at**, because `CONTRACTS.md` moved under the earlier brief. **Do not verify WI-069's contract half** — one file, one live item, and that half waits on the owner |
| `wi-080-stale-contract-comment-verify-third-2026-10-22` | WI-080 — the code comment that describes the contract, verified at last | Probe | `task_5152a57d9d84` | **DISPATCHED AT 03:30 — the verification WI-080 has never had.** Batch `batch_02f40bf03433`, **queued** at Probe — **AND IT DIED: refused `BUSY` after 4m40s (03:10:29 → 03:15:09) with a zero-length answer, so that id is spent.** **The live dispatch is now Wren's**: `wi-080-stale-contract-comment-verify-wren-2026-10-22`, `task_6a3e9baccce4`, batch `batch_292830de9d51`, queued at Wren at 03:27 — see the row below. Both earlier attempts were refused `BUSY` after 28 seconds with no result — `task_9f0c155958f9` and `task_0d1955cb7610` — so **both ids are spent**. The implementation (Cog's, `task_9d753ce22c6b`) merged at `ceed799`: the comment at `apps/server/src/modules/mcp/server.ts:145-151` now says the contract states the rule, that it is the same rule the writes carry, and where it is published. **The verifier is Probe because the implementation was Cog's.** **The tree is green at `7c4bc45`**, so any red is real; and the brief says the `CONTRACTS.md` line numbers have moved since the brief was written, so **re-measure them**. **Do not edit `CONTRACTS.md`** — one file, one live item, and WI-031's correction, WI-034's citation drift and WI-034's new check all live there |
| `wi-010-direction-document-verify-cog-2026-10-22` | WI-010 — the repaired direction document, verified by a second hand | Cog | `task_0398b06e6479` | **DISPATCHED AT 03:27 — THE VERIFICATION, ON A LANE THAT CAN TAKE IT.** Probe's chat has refused twenty-eight delegations and nothing in it has succeeded since 02:11:29, so the verification dispatched to Probe at 03:11 (`task_f99a95269325`, the row above) was refused `BUSY` after 9m47s with a zero-length answer. **Vision wrote the direction document, so Vision cannot verify it; Cog did not write it, so Cog is independent of the work; the lead accepts.** Batch `batch_a352306b01f5`, queued at Cog. **The tiebreak is said out loud in the brief itself, so the verifier knows why it was chosen and what is already settled:** WI-024's briefs repair merged (`69c250b`), **WI-093's pin merged (`203b7e0`) and reads the rule out of the document, so there is nothing left to re-point** — which is what an earlier dispatch asked for; WI-098 (the ADR's own copy) is a separate item and not this item's defect; and **the resource editor's placement is the owner's open question, so the document's silence about it is not a defect.** The brief says: **measure everything yourself and say which commit you measured at**, edit nothing (`prototypes/DIRECTION.md` is Vision's file and `CONTRACTS.md` is one file one live item), and **an unmet criterion is a finding, not a failed report** — **AND THE VERDICT CAME BACK: ALL THREE CRITERIA MET, AND ONE DEFECT, SO WI-010 IS NOT ACCEPTED YET.** Cog's report, measured at `af43b08` with the tree green (typecheck 0, test 0 — 48 files, 452 tests — format:check 0, build 0): **the boundary rule and its two declared crossings hold and the rule is byte-identical in all four copies** (the document, brief 01, brief 05, the briefs index), **the drifted pointers all resolve at the pinned commit `0d4731f`,** and **the spend claim holds** (the four event payloads carry no spend, the units live on the execution row, and the approval-evidence read's code is still not in the tree). **The one defect is a commit label in a lane-count sentence:** `prototypes/DIRECTION.md:293-297` says "…whose lane held fifteen open items **at the pinned commit**", but "pinned" means `0d4731f` there — and at `0d4731f` Cog's lane held **twenty-one** not-accepted items, with six of the fifteen named already accepted. **The number and the list are exactly right at `3479c31`**, so the fix is one phrase and no re-measurement. **The defect is dispatched to Cog** as `wi-010-lane-count-commit-label-2026-10-22`, `task_69aace150952` — **Vision's chat cannot take it, because that chat's session is `started` and refuses every delegation** — **and WI-010 is accepted when that one phrase lands** **AND THE DEFECT'S FIX IS LANDED, THE LEAD VERIFIED IT, AND WI-010 IS ACCEPTED — 2026-10-22, 05:44.** Cog's fix (`task_69aace150952`, `2d7f33d`, merged `e18a6f0`) is one phrase: `prototypes/DIRECTION.md:293-294` said “…whose lane held fifteen open items **at the pinned commit**”, and in that document “pinned” means `0d4731f` (`:12-13`) — **so the words were the error and not the number**, and it now says **“at `3479c31`”**. **The lead verified the fix with a red-then-green proof, and Probe's lane is still dead, so the lead is the verifier for the correction and wrote none of it.** **The red:** the old wording pointed at `0d4731f`, and at `0d4731f` the filter — Cog-owned item files, not accepted, not superseded — gives **twenty-one**, not fifteen, **and six of the fifteen items the sentence itself names were already accepted there** (WI-007, WI-008, WI-017, WI-021, WI-027, WI-028), so the sentence contradicted its own list at the commit it named. **The green:** at `3479c31` the same filter gives **exactly fifteen** — WI-003, WI-007, WI-008, WI-017, WI-018, WI-020, WI-021, WI-024, WI-027, WI-028, WI-031, WI-032, WI-033, WI-035, WI-040 — **and that is exactly the set the sentence names, with no omission and no extra**, and the new wording agrees with the document's own rule at `:9`. **The gates on the merged tree at `e18a6f0`:** typecheck 0, format:check 0, build 0, test 0 — server 29 files / 301 tests, web 9 / 82, worker 5 / 31, agent-adapters 2 / 16, contracts 4 / 28 = **49 files, 458 tests, 0 failures**. **What the product can now do: the direction document names the commit its lane count was measured at, so a reader can reproduce the count instead of trusting it.** **Owed and not this item's: nothing in the tree pins that sentence, so a check that pins the lane sentence's count against the list it names is Probe's file to write.** |
| `wi-080-stale-contract-comment-verify-wren-2026-10-22` | WI-080 — the code comment that describes the contract, verified | Wren | `task_6a3e9baccce4` | **DISPATCHED AT 03:27 — the verification, on a lane that can take it.** Probe's chat has refused twenty-eight delegations and nothing in it has succeeded since 02:11:29: **both attempts to Probe (`task_9f0c155958f9`, `task_0d1955cb7610`) and the peer session's third (`task_5152a57d9d84`) were refused `BUSY` with a zero-length answer**, so three ids are spent and WI-080 had no live verification at all. **Cog implemented this item (`task_9d753ce22c6b`, merged `ceed799`) and cannot verify it; Wren did not write it.** Batch `batch_292830de9d51`, queued at Wren. The brief says the implementation merged as `ceed799`, that the comment at `apps/server/src/modules/mcp/server.ts:145-151` must be read against **the contract as it is published now**, and that **the published places are to be found from the contract and not from line numbers, because `CONTRACTS.md` has moved under earlier briefs**; **edit nothing** (`CONTRACTS.md` is one file one live item, and `forge-briefs.test.ts` is Probe's file); and **an unmet criterion is a finding, not a failed report** — **AND THE VERDICT CAME BACK, AND IT IS "VERIFIED": WI-080 IS ACCEPTED BY CHIEF, 2026-10-22.** Wren's report: **every claim in the comment is true of the contract as published**, read against the contract and not against the brief's line numbers — `:754` carries the tool table's row for `resource.get` ("Read a resource. Not another agent's own memory."), `:739` is the heading `### MCP exposure`, `:768-770` carry "who owns a resource is settled before it is handed over — the same rule the writes carry", `:676` and `:771-773` carry "the rule is stated once" and the three tools, and `:776` with `:705-706` and `:780-782` carry the owner's API being out of reach. **The lead re-measured it rather than taking it on trust:** `:754` and `:739` read as quoted, and the diff `ceed799^1..ceed799` is **8 comment lines in and 6 out with every changed line a comment line**, so this row's "all 14 changed lines are comment lines" is true. Gates at `297a387`: typecheck 0, test 0 (48 files, 452 tests), format:check 0, build 0. **The acceptance is the lead's and the lead did not write the work.** **AND THE MERGE THAT DELIVERED IT BROKE EIGHT OF THE CONTRACT'S POINTERS INTO THE SAME FILE — the comment grew by two lines, so every line of `server.ts` below it moved +2 and `CONTRACTS.md` did not follow** (`:636`, `:638`, `:639`, `:640`, `:724`, `:725` and `:726` twice; plus `:1343`'s `:368`, already stale, which should be `:395`). **Measured line by line by the lead.** **That is WI-103**, dispatched to Wren as `wi-103-contract-pointers-after-wi-080-2026-10-22`, `task_b0c1dbb8ab05` — **and this acceptance does not waive it** |
| `wi-031-contract-verify-wren-2026-10-22` | WI-031 — the contract's route entry, verified by a second hand | Wren | `task_c07c22d8d6b5` | **DISPATCHED AT 03:34 — and WI-031 still has no verification report of any kind.** The attempt at 02:35 (`task_30847905e60e`) and the peer session's at 03:30 (`task_f93c4f09452d`) were both refused `BUSY` with a zero-length answer, so **three request ids are spent on this item and nothing was measured.** **Cog wrote the correction; Wren did not, and `CONTRACTS.md` is Wren's file.** Batch `batch_5529c0595838`, queued at Wren. The brief carries the nine criteria and says three things: **re-measure every pointer and say which commit you measured at**, because the tree moves; **the criterion that a test pins it was written for Probe to write — since Probe cannot be reached, the substituted verifier satisfies it on her own branch, not merged, or reports it as a finding against the criterion rather than waiving it silently**; and **do not verify WI-069's contract half** (one file, one live item — that half waits on the owner) — **AND THE VERDICT CAME BACK: ALL NINE CRITERIA HOLD, NOTHING IS UNMET — BUT ONE REAL DEFECT IN THE PUBLISHED PROSE AND ONE FALSE BLOCKER IN THE ITEM FILE, SO WI-031 IS NOT ACCEPTED YET.** Wren's report, measured at `26fb68e` (the tip moved twice under her; every cited code file is unchanged since `2138448`): criterion 1 the route is `POST /api/executions/:id/resolve` at `executions.ts:21`, registered at `app.ts:223`, published at `CONTRACTS.md:1287`, and the panel calls it at `WaitingList.tsx:146`; criterion 2 `outcome` is a required enum of `completed`/`failed` and the route picks none; criterion 3 the transition is audited in both directions and names the owner; criterion 4 the reason reaches the panel; criterion 5 the entry carries the route, the shape and a migration note; criterion 6 the route is additive and reuses `requireAuth`; criterion 7 the published shape matches the code exactly; criterion 8 **the pin already exists and is Probe's own** — `close-unknown-turn.test.ts` (7 cases) and `ChatMessageDetail.test.tsx` (2 cases), which fail before the change and pass after; criterion 9 all gates pass, including smoke and 27 e2e cases. **THE DEFECT: `CONTRACTS.md:214-218` says "the id the list draws is `turn:<execution id>` — the id this route takes", and it is not true — the route takes the BARE execution id, the client strips the prefix at `WaitingList.tsx:279`, and anything else 404s, so a client written to that sentence literally would post `/api/executions/turn:exe_123/resolve` and get `Execution` not found.** **AND THE ITEM FILE CARRIES A FALSE BLOCKER: `.factory/work/WI-031.md` says in three places that the close path has no test, but the pin landed at 19:21:40 on 2026-10-21 and the file was committed at 00:18:17 on 2026-10-22, four hours forty-six minutes later, carrying a stale observation forward as live.** **Both corrections belong to Wren**, who wrote both files — **and the peer session's ruling is sharper than this session's, and the lead adopts it: the contract half was verified by the author of that half, so it is HELD for an independent check and the lead does not accept it on that verification.** **The defect is numbered WI-104 by the peer session** (item file written 04:36, held undispatched behind WI-103), **and this session's own dispatch of the same defect at 04:44 was cancelled at 04:48, before it ran, as the duplicate it would have been — request id `wi-031-turn-prefix-and-item-file-2026-10-22` is spent** |
| `wi-036-record-reverification-vision-2026-10-22` | WI-036 — the licence record, re-verified against the merged successor | Vision | `task_8609cdc160f8` | **DISPATCHED AT 03:35 — the third brief, on a lane that can take it.** The third brief to Probe (`task_762f49d237f9`) was refused `BUSY` after 28 seconds with a zero-length answer, so that id is spent and **WI-036's re-verification had no live dispatch at all.** **Wren wrote the successor (`38e1a9a`) and a Chief session merged it, so neither can verify it; Vision did not write it.** Batch `batch_49d7c93ab481`, queued at Vision. The brief spells the premise out so it can be checked rather than believed: **the record's change must be exactly two summary numbers — 500 lockfile entries and 11 distinct licences — re-derived and not read out of the record, and seventeen re-quoted evidence strings, each of which must be the verbatim head of the file it names, with no quote still stopping before the grant** (a quote ending at "All rights reserved." is a false statement about a permissive licence). **`docs/strategy.md` is out of scope** — it is live in another item — and `docs/**` is not to be edited: this is a verification, and a defect is a finding in the report — **AND IT WAS REFUSED: the relay delivered the brief to Vision at 04:20:05 and the bot turn came back at 04:20:33, 28 seconds later, with a zero-length answer** — **the same refusal Probe's chat gives, and for the same reason: that chat's session is `started`.** So that id is spent and **WI-036's re-verification had no live dispatch for another four minutes.** **Re-dispatched to Cog** as `wi-036-record-reverification-cog-2026-10-22`, `task_6a2d0711a7a9`, batch `batch_c5558c1bed80` — **Cog did not write the record** (Wren wrote the successor and a Chief session merged it) — and the brief is the same third brief, with the lead's note that the first substitution died to **AND THE WORK WAS DONE — THE ROW ABOVE SAYS "REFUSED" AND THE LEDGER WAS WRONG.** The task row reads `failed` / `BUSY` after 39 minutes, and the 04:20 relay into the same chat was refused in 28 seconds as a **duplicate of the same request id arriving while the first was still running** — which is correct behaviour, not a refusal of the work. **Vision ran the verification for 45 minutes and delivered the report at 04:40:33**, as `task_37175eba6381`, batch `batch_09ec5c9f92ae`, request id `wi-036-record-verification-vision-2026-10-22`. **So the request id `wi-036-record-reverification-vision-2026-10-22` is spent, and the work it asked for is delivered.** **WI-036 IS ACCEPTED** — the five criteria are met, and the C3 reading is stated out loud in `.factory/work/WI-036.md`: the parenthetical is the brief's own definition of the failure (a quote that misstates its licence), and the other reading would fail 323 of 375 and is a re-quoting project, not a criterion. **The re-quoted count is 19, not 17, and the PRODUCT.md note was added by the successor (`f1db91f`, `PRODUCT.md:259-267`) — two of the brief's premises were wrong.** **Four sentences in the record are looser than what they describe; they are numbered WI-106** |
| `wi-103-contract-pointers-after-wi-080-2026-10-22` | WI-103 — the contract's pointers into the code file it corrected | Wren | `task_b0c1dbb8ab05` | **DISPATCHED AT 04:17 — THE NUMBER IS THE LEAD'S (WI-103, the next free number above WI-102), AND THE DEFECT WAS FOUND BY WI-080's VERIFICATION AND MEASURED BY THE LEAD.** WI-080's merge (`ceed799`) replaced a 24-line doc comment with a 26-line one — 8 lines in, 6 out, every one a comment line — so **every line of `apps/server/src/modules/mcp/server.ts` below the comment moved +2, and `CONTRACTS.md`'s pointers into that file did not follow.** Nine citations are wrong: `:636` (`:465-481` → `:467-483`), `:638` (`:361` → `:363`), `:639` (`:373-377` → `:375-379`), `:640` (`:382-384` → `:384-386`), `:724` (`:153` → `:155`), `:725` (`:386` → `:388`), `:726` (`:447` → `:449` and `:417` → `:419`), and `:1343` (`:368` → `:395`). **The ninth was already stale before WI-080** — `22ef5ba` moved it to `:393` without updating the citation — **so the +2 arithmetic explains eight of the nine and not the ninth, which is why the brief says to measure and not to add.** Batch `batch_6158711cfd29`, queued at Wren. **The scope is `CONTRACTS.md` only: the code is correct and the contract's pointers are what is wrong.** **One file, one live item — WI-034's citation drift was live in `CONTRACTS.md`, and the lead landed it first** (measured before it was taken: `merge-tree` named no conflicted file, and the three corrected citations were re-measured line by line — `resources/service.ts:525` is the enqueue, `audit/service.ts:79` is the `success` default, `app.ts:190` is the error handler) **so the lane is clear.** The brief also says: check every other pointer `CONTRACTS.md` holds into that file and **report the wrong ones, do not fix them** **AND IT DIED `BUSY` AT 05:18 — 28 SECONDS, A ZERO-LENGTH ANSWER, SO THAT REQUEST ID IS SPENT AND IS NEVER REUSED.** It was created at 04:17 and sat queued for an hour behind the ceiling of two runs, and it was refused the moment it was dequeued, because Wren's chat was still inside WI-080's verification turn. **The item was never answered and it had no file: `.factory/work/WI-103.md` did not exist anywhere in the repository's history.** The lead wrote that file and re-measured every number at `main` = `d777953` rather than copying the report — **ten pointers into `mcp/server.ts`, nine wrong, one right** — and named the four pointers that are already right so that they are not “fixed”. **The re-dispatch is the row below.** |
| `wi-010-lane-count-commit-label-2026-10-22` | WI-010 — the lane-count sentence's commit label, corrected | Cog | `task_69aace150952` | **DISPATCHED AT 04:35 — THE FIX FOR WI-010's ONE DEFECT, AND IT IS ONE PHRASE.** The verification met all three criteria and found exactly one defect: `prototypes/DIRECTION.md:293-297` says "…whose lane held fifteen open items **at the pinned commit**", and in that document "pinned" means `0d4731f` (`:12-19`) — but **at `0d4731f` Cog's lane held twenty-one not-accepted items, and six of the fifteen named were already accepted there, while the number and the list are exactly right at `3479c31`.** **So the words are the error and not the number: "at the pinned commit" becomes "at `3479c31`", and no re-measurement is needed.** Batch `batch_4ffdf594ca21`, queued at Cog. **The document's owner is Vision, and Vision's chat cannot take work — its session is `started` and it refuses every delegation in 28 seconds — so the lead substituted an implementer who did not write the document and did not write the verification.** **Scope is that one phrase and nothing else in that file:** the pin in `forge-briefs.test.ts` reads the document, the briefs quote it, and the document is held to a pinned commit. The brief says the suite must come out exactly as it is — 48 files, 452 tests |
| `wi-036-record-reverification-cog-2026-10-22` | WI-036 — the licence record, re-verified against the merged successor | Cog | `task_6a2d0711a7a9` | **DISPATCHED AT 04:34 — THE THIRD BRIEF, ON A LANE THAT TAKES WORK.** The third brief to Probe (`task_762f49d237f9`) was refused `BUSY` after 28 seconds, and the second attempt, to Vision, **was refused the same way at 04:20:05 → 04:20:33 with a zero-length answer** — so **two ids are spent and the item had no live dispatch at all.** Batch `batch_c5558c1bed80`, queued at Cog. **Cog did not write the record: Wren wrote the successor (`38e1a9a`) and a Chief session merged it, so neither can verify it.** The brief is the same third brief — 500 lockfile entries and 11 distinct licences, both re-derived and not read out of the record, and seventeen re-quoted evidence strings each of which must be the verbatim head of the file it names, with no quote still stopping before the grant — with the lead's note that `docs/strategy.md` is out of scope and `docs/**` is not to be edited **CANCELLED AT 05:10 BY CHIEF AS A DUPLICATE OF FINISHED WORK.** The verification was already delivered at 04:40:33 (the row above), and a second verification of the same record on the same tree is a second answer to a question that has been answered. One item, one verification. The request id is spent and is not re-used |
| `wi-031-turn-prefix-and-item-file-2026-10-22` | WI-031 — the route's id, and the item file's false blocker, corrected | Wren | `task_f49babe336fd` | **CANCELLED AT 04:48, BEFORE IT RAN — IT WAS THE DUPLICATE, AND THE DUPLICATE WAS MINE.** It was dispatched at 04:44 on the same defect the peer session had already numbered **WI-104** and written an item file for at 04:36, and it asked for a second thing on top: that `WI-031.md`'s three false "the close path has no test" lines be corrected — **but the peer had already appended that correction to `WI-031.md` at 04:36**, in the form the house prefers (a dated correction beside the standing claim, not an overwrite). **So this dispatch would have put two workers on one contract sentence and two writers on `WI-031.md`.** **The peer's WI-104 stands, and it is deliberately not dispatched** — `CONTRACTS.md` is one file and one live item, and WI-103's pointer correction is live on it, so WI-104 goes out when WI-103 lands. **The request id is spent and is never reused.** **The measurement this dispatch carried is not lost — it is in WI-104's item file and in this ledger.** Batch `batch_64507d46b05`, queued at Wren. **The defect:** `CONTRACTS.md:214-218` says "the id the list draws is `turn:<execution id>` — the id this route takes", **and the route takes the bare execution id** — the client strips the prefix itself at `WaitingList.tsx:279`, the server looks the row up by the bare id at `executions/service.ts:71`, and anything else 404s, **so a client written to that sentence literally would post `/api/executions/turn:exe_123/resolve` and get `Execution` not found.** It came from the original contract half (`363428e`), not from the correction — **but it is in this item's contract half, which is Wren's.** **And the false blocker:** `.factory/work/WI-031.md` says in three places (lines 17-20, 114, 150) that the close path has no test, **but the pin landed at 19:21:40 on 2026-10-21 (`a72eee4`, on `main` by 19:32:27) and the file was committed at `3f1cc2f` at 00:18:17 on 2026-10-22 — four hours forty-six minutes later — carrying a stale observation forward as a live blocker.** **Both files are Wren's, so both corrections are dispatched to her.** **And because she verified her own contract half, the lead verifies these two corrections and the lead accepts WI-031 once they land.** **One file, one live item: `CONTRACTS.md` is live with WI-103, dispatched ahead of this, so the brief says to base the branch on top of WI-103's branch and to stop rather than work around it if it has not landed** |
| `wi-104-turn-id-contract-2026-10-22` | WI-104 — the published id is not the id the route takes | Wren | — | **OPENED AT 04:50 BY CHIEF, FROM A FINDING IN WI-031'S VERIFICATION, AND DELIBERATELY NOT DISPATCHED.** The defect: `CONTRACTS.md:216-217` says the id the waiting list draws is `` `turn:<execution id>` `` — "the id this route takes" — **and it is not.** The list draws `` `turn:${turn.executionId}` `` (`apps/server/src/api/waiting.ts:126`), the client **strips the prefix itself** (`apps/web/src/components/WaitingList.tsx:279`), the route takes the raw `:id` (`apps/server/src/api/executions.ts:21-22`), and the server looks up the **bare** id (`apps/server/src/modules/executions/service.ts:71`). **A client written to that sentence literally gets "Execution not found".** **Held because `CONTRACTS.md` is one file and one live item at a time, and WI-103's pointer correction is live on it** — and because dispatching into a chat that is busy is refused, so the id would be spent for nothing. **It goes out when WI-103 lands.** The number was read immediately before it was taken: WI-102, WI-103 and WI-105 are taken and WI-104 was in no item file, no dispatch record and no commit |
| `wi-106-record-four-loose-sentences-2026-10-22` | WI-106 — four sentences in the licence record are looser than what they describe | Wren | — | **OPENED AT 05:15 BY CHIEF, FROM THE OBSERVATIONS IN WI-036'S RE-VERIFICATION, AND DELIBERATELY NOT DISPATCHED.** The four: `reads.evidence` says "Every entry carries … the first identifying lines" and **375 of 494 do, 16 carry a field value, 97 carry an identifier, and the 6 first-party entries carry none**; PRODUCT.md §10's "read in place" is true of **391 of 488**; `agpl.familiesRead` carries **12 rows against `distinctLicences: 11`**; and there is **no explicit "packages in this record" number**, so the 500-vs-494 gap is explained in two places. **None of them fails a criterion of WI-036 and the record does not over-claim** — they are the same class the factory keeps finding, so they are numbered rather than left as observations. **Held because WI-103 is live on Wren's queue and a chat serves one turn at a time, so a dispatch now would be refused and the id spent for nothing.** It goes out when WI-103 lands **AND IT WENT OUT AT 05:37, BECAUSE THE HOLD WAS A QUEUE FACT AND NOT A FILE FACT, AND THE QUEUE FACT STOPPED BEING TRUE.** Request id `wi-106-record-four-loose-sentences-2026-10-22`, task `task_fede9dee2ed9`, batch `batch_192b7faefcf4`, queued at Wren. **WI-103 is no longer live on Wren's queue** — its first dispatch died `BUSY` at 05:18 and its second was cancelled by the lead at 05:46 — **so the lane was free.** **And this item never touched `CONTRACTS.md`, which is the file WI-103 and WI-104 hold: it touches `docs/dependency-licences.json` and `PRODUCT.md`. **So the one-file-one-item rule never held this item back, and it went out while the lane was free.** The brief carries the four measurements — `reads.evidence` true of 375 of 494 with 6 first-party entries carrying none, PRODUCT.md §10's “read in place” true of 391 of 488,`agpl.familiesRead` at 12 rows against `distinctLicences: 11`, and no single packages-in-this-record number — **and it names `docs/strategy.md` as out of scope, because that file is live in the peer's unlanded branch.\*\* **The check that would pin the four sentences is named as owed and is Probe's file to write.** |
| `wi-103-contract-pointers-second-2026-10-22` | WI-103 — the eight pointers into the code file, corrected again | Wren | `task_040837aa9079` | **CANCELLED AT 05:39 BY CHIEF — A SECOND DISPATCH OF ONE ITEM INTO ONE CHAT IS TWO WRITERS ON ONE FILE, AND ITS TITLE SAID “EIGHT” FOR NINE.** The peer session dispatched this item at 05:24, six minutes after the first dispatch died `BUSY`, and before `.factory/work/WI-103.md` existed. **The brief's substance was correct** — the same nine numbers, the same “measure and not to add” rule, the same “report other pointers, do not fix them” — but it instructed Wren to **create the item file**, which the lead had written by 05:30, and it would have put a second writer on `CONTRACTS.md`. **The request id is spent and is not reused.** The measurement the brief carried is not lost: it is in `.factory/work/WI-103.md` and in this ledger. |
| `wi-103-contract-pointers-repair-2026-10-22` | WI-103 — the nine pointers into the file WI-080 changed, corrected | Wren | `task_9583acd61e3f` | **DISPATCHED AT 05:32 — THE SECOND ATTEMPT, WITH A NEW ID AND A NEW TITLE, BECAUSE THE FIRST ONE'S ID IS SPENT.** Batch `batch_4a931b9276b4`, queued at Wren. **Every number in the brief was re-measured by the lead at `main` = `d777953`, not copied from the verification's report:** `CONTRACTS.md` holds **ten** pointers into `apps/server/src/modules/mcp/server.ts` and **nine are wrong** — `:636` (`:465-481` → `:467-483`), `:638` (`:361` → `:363`), `:639` (`:373-377` → `:375-379`), `:640` (`:382-384` → `:384-386`), `:724` (`:153` → `:155`), `:725` (`:386` → `:388`), `:726` (`:447` → `:449` and `:417` → `:419`), and `:1343` (`:368` → `:395`) — **and one is right** (the `:119` for `memoryOwner`, which sits above the comment). **The ninth is +27 and not +2, because `22ef5ba` moved it to `:393` without updating the citation and WI-080 added the last two lines of the gap, so the brief says measure and do not add.** The brief names the four pointers that are already right — the `:119`, `apps/server/src/api/resources.ts:37`, and `packages/contracts/src/mcp.ts` `:21`, `:11-23`, `:45` — so that they are not “fixed”, and it says to **report any other wrong pointer into that file, not fix it.** **Scope is `CONTRACTS.md` only and only the nine numbers: the code is correct.** The test that pins the nine is named as an acceptance criterion and **is Probe's file to write.** **WI-104 and WI-106 are held behind this item and go out when it lands.** **AND IT WAS CANCELLED BY CHIEF AT 05:46, AND THE ORDER IS NOW NAMED.** The brief's numbers were right for `main` and wrong for the tree that is about to land, so the dispatch was withdrawn before it ran; **the request id is spent and is never reused.** **Measured by the lead:** `git merge-tree --write-tree main origin/wi/106-publish-template-contract` names **one** conflicting file — `.factory/work/WI-106.md`, an add/add on a number and not a code conflict — and `main` has not touched `apps/server/src/modules/mcp/server.ts` since `ceed799`, so **the tree that lands carries that branch's `server.ts` byte for byte, and the branch's numbers are the landed tree's numbers.** The branch's re-citation is correct for its tree (`:532-576` the registration, `:217` `const assertOwnMemory = (`, `:181` `const memoryOwner`, `:450`/`:514`/`:484` the three tools, `:428` the template input) and the branch is **CI green and CodeQL green** at `03362af`. **And the correction on `main` would not only be mis-pointed — it would be wrong: `CONTRACTS.md:639`'s “refuses a call that carries both a spec and a template” is **replaced** on that branch, where `resource.create` **merges** the caller's values into the template's spec (`:446-448`) and passes the template's id and version on (`:458`).** **So: the integration branch lands first, and WI-103's edit is measured on the tree that lands.** `.factory/work/WI-103.md` is written (the peer's measured file, with the lead's note appended) and carries the rule — **read every pointer out of the tree it stands on.** **The next request id is not taken yet**; it is taken when it goes out, after the landing. |
| `wi-111-publish-template-contract-2026-10-22` | WI-111 — publish what WI-097 and WI-090 actually built | worker, under Chief | — | **THE NUMBER WAS TAKEN AT 04:31 AND CARRIED ON THE REMOTE FROM 04:53, AND YIELDED TO THE PEER'S LIVE DISPATCH** — CI run #236's own title reads "Publish what WI-097 and WI-090 built, and re-file as WI-106" — **and the peer's WI-106 was opened at 05:15 against `main` alone and dispatched to Wren at 05:37, so this item yielded the number to the live dispatch and moved to WI-111.** The item's file is `.factory/work/WI-111.md`, and the branch is `wi/106-publish-template-contract` |
| `wi-098-adr-rule-resync-verify-vision-2026-10-22` | WI-098 — the ADR's boundary rule re-synced, verified by a second hand | Vision | `task_9051dea0390b` | **CANCELLED AT 06:24 BY CHIEF — ONE VERIFIER, ONE ITEM, ONE VERIFICATION.** Probe's adversarial brief was on the same branch at the same commit (`3b5d427`) and had already been delivered at 06:20, and Probe himself flagged the duplicate: _"please do not run it twice; take this one, or tell me to stand down."_ **The lead takes Probe's.** Batch `batch_4c19afaa431b`, queued at Vision at 06:08, cancelled before it ran. **The request id is spent and is not reused.** |
| `wi-098-adr-provenance-pointer-2026-10-22` | WI-098 — the ADR's provenance pointer, corrected to the tree that lands | Wren | `task_7effecefa1b9` | **THE VERDICT CAME BACK: NOT VERIFIED — AND THE ONE BLOCKING DEFECT IS DISPATCHED.** Probe's adversarial brief, delivered at 06:20, measured at `3b5d427` with base `a236a63`: **the substance is right — the quote, the re-sync judgement, the crossings paragraph, the fourth place — and criteria 4 and 6 hold**, but **DEFECT 1 IS BLOCKING.** The ADR's provenance note at `:164` cites `prototypes/DIRECTION.md:51-55`, and **the rule stands at `:53-57` on `main`** (`**The rule.**` at `:53`) while it stands at `:51` on the branch — so the lead merged the branch onto today's `main` in a scratch tree, **no conflict lines**, and in the merged tree the rule is at `:53-57` and the ADR still says `:51-55`. **The prose is byte-identical (312/312): the substance is right and the pointer is not.** **THE LEAD'S RULING: the note carries the commit the range was read at, beside the range** — the convention `prototypes/DIRECTION.md` sets at `:12-19`. Batch `batch_b53d03239c3d`, queued at Wren at 06:31, with the order: **merge `origin/main` into the branch first** (measured clean), **read the range in that tree, cite it, and name the commit it was read at.** **The other three findings are the lead's own errors, and they are corrected on `main` in `.factory/work/WI-098.md`:** **criterion 1** was written against the stricter reading (the raw blocks are 322 against 328 and are **not** byte-identical; the stripped prose bodies are 312 each and **are**), **the line-count figures were off by one** (the file is **401** lines by newline count, stale by **35**, not 402 and 36 — the convention is now written down), **and the wrap claim was overstated** (greedy-78 reproduces 14 of 35 of the base ADR's prose paragraphs, the best width is 79, and the existing paragraphs carry lines longer than 78). **DEFECT 3 is a commit message that is literally false and cannot be repaired without a force-push** (`678744d` says the direction "does not contain the word 'connect' at all"; it does, on four lines at `d3ef0d2^`) — **a force-push is the owner's word, and the lead's recommendation is to leave it standing with this correction beside it.** |
| `wi-111-strategy-fifth-copy-2026-10-22` | WI-111 — the rule's fifth copy in the strategy record, brought up to date | Wren | `task_33fdaa157940` | **OPENED AND DISPATCHED AT 06:31, FROM A FINDING IN WI-098's VERIFICATION.** The number was read immediately before it was taken: WI-102 through WI-110 are taken, and WI-111 appeared in no item file, no dispatch record and no commit. **The finding:** `docs/strategy.md:248-250` still carries the boundary rule **with no exception clause at all** — "_if it is a picture of the system, it is in the orientation room; if it is a place where work is inspected or decided, it is in the execution room._" — **and the rule now has two declared exceptions, the Needs-you rail and the constellation, which `prototypes/DIRECTION.md` publishes.** **So this copy does not merely repeat the rule, it under-states it, and a reader of `docs/strategy.md` gets a rule that contradicts the settled direction.** It is live on `main` at the same lines, it is **not** in WI-093's copy list (that pin covers brief 01, brief 05 and `prototypes/briefs/README.md`), and **no test reads `docs/strategy.md`** — `git grep -ln 'strategy\.md'` over the test trees returns nothing. **"Four places" is four places the ADR touches; a fifth copy of the rule text, in the flattest form, is live and unpinned.** **The file is free, and the lead measured it before the dispatch:** the peer's unlanded branch changes `docs/strategy.md` at lines 108, 154, 179, 326, 359, 450, 562 and 578 — **not at 248-250**, and the sentence itself is unchanged there — **so this item merges cleanly with that branch.** Batch `batch_5606d02332eb`, queued at Wren. **The check that pins this copy is named as owed and is Probe's file to write.** **AND THE ITEM WAS RENUMBERED TO WI-112 BEFORE IT WENT OUT, so the title above names a number the item no longer holds:** WI-111 was taken by the peer session's publication, published on its branch at 06:21 and not visible on `main` when this item was opened at 06:31. **The request id above is spent and is not reused; the item is WI-112 and its file is `.factory/work/WI-112.md`.** |
| `wi-098-adr-rule-resync-accept-2026-10-22` | WI-098 — the ADR's boundary rule, re-synced and the pointer that names it | Wren | `task_9051dea0390b` | **ACCEPTED — 2026-10-22, ON TWO INDEPENDENT VERIFICATIONS THAT CONVERGED.** Probe's adversarial brief (06:20, measured at `3b5d427` with base `a236a63`) returned **NOT VERIFIED** and named one blocking defect: the ADR's provenance note at `:164` cited the rule at `prototypes/DIRECTION.md:51-55` and **the rule stands at `:53-57` on `main`**, because `95e5165` added two lines above it after the branch's base. Vision's independent verification reached the same place and asked for the same fix: **the range, and the commit the range was read at named beside it.** **The edit is on `main` — the note reads "`:53-57` as read at `95e5165`"** — and **nothing else in the ADR changed; the quote is byte-identical (312/312).** **THE LEAD'S RULING, which the edit follows: a pointer carries the commit it was read at**, the convention `prototypes/DIRECTION.md` sets for itself at `:12-19`. **THREE OF THE FINDINGS WERE THE LEAD'S OWN AND ARE CORRECTED ON `main`:** criterion 1 was written against the stricter reading (the raw blocks are 322 against 328 and are **not** byte-identical; the stripped prose bodies are 312 each and **are** — and the quote is re-wrapped to the ADR's measure, so the slices break at different words), the line-count figures were off by one (the file is **401** lines by newline count and stale by **35**, not 402 and 36 — **the convention is now written down**), and the wrap claim was overstated (greedy-78 reproduces 14 of 35 of the base ADR's prose paragraphs; the best width is 79). **DEFECT 3 is a commit message that is literally false** (`678744d` says the direction "does not contain the word 'connect' at all"; it does, on four lines at `d3ef0d2^`) **and it cannot be repaired without a force-push, which is the owner's word** — **the lead's recommendation is to leave it standing with this correction beside it.** The branch was merged as `3fab75a` and the one conflict it made — the add/add on the item file — was **resolved in favour of `main`, because the item file is Chief's.** **What the product can now do: the ADR that records the boundary rule quotes the direction record's own wording, and the note saying where the quote came from names the commit it was read at — so a reader can re-measure it instead of trusting a bare line number.** |
| `wi-106-record-four-loose-sentences-retry-2026-10-22` | WI-106 — the four loose sentences in the licence record, said what is true | Wren | — | **NOT DISPATCHED YET, AND THIS REQUEST ID IS NOT SPENT — `wi-106-record-four-loose-sentences-retry-2026-10-22` IS TAKEN FOR THE NEXT ATTEMPT AND HAS NOT BEEN USED.** The first dispatch (`wi-106-record-four-loose-sentences-2026-10-22`, `task_fede9dee2ed9`) **was refused `BUSY` at 06:30 after a seventeen-minute run** — that id is spent. **Wren's lane is busy-refusing, not dead:** her session advances while her delegations are refused, because a worker is inside her chat on the strategy copy. **The lead is not spending another id into a refusing lane**, and the item's file carries the order and the id. **The number is settled: WI-106 is the licence record.** The peer session took WI-106 first at 04:31 and **conceded it in writing** — _"WI-106 is yours, and my publication moved to WI-111"_ — **and its own branch must be corrected before it lands, because its `WI-111.md` holds a copy of this item's file and its `WI-106.md` holds the publication's, the wrong way round. The lead resolves that at the merge, in favour of `main`.** |
| `wi-112-strategy-fifth-copy-2026-10-22` | WI-112 — the rule's fifth copy in the strategy record, brought up to date | Wren | — | **OPENED AT 06:31, RENUMBERED TO WI-112, AND THE WORK IS ALREADY IN FLIGHT.** The finding: `docs/strategy.md:248-250` still carries the boundary rule **with no exception clause at all**, while the rule now has two declared exceptions — the Needs-you rail and the constellation — **so this copy under-states the rule rather than repeating it, and a reader of that document gets a rule that contradicts the settled direction.** It is live on `main` at the same lines, it is **not** in WI-093's copy list (that pin covers brief 01, brief 05 and `prototypes/briefs/README.md`), and **no test reads `docs/strategy.md`**. **The file is free, measured before the dispatch:** the peer's unlanded branch changes `docs/strategy.md` at lines 108, 154, 179, 326, 359, 450, 562 and 578 — **not at 248-250**, and the sentence itself is unchanged there. **The lead's dispatch was refused `BUSY` in 29 seconds at 06:32 and that id is spent**, but **a worker is on the same defect right now on the peer session's branch `wi/111-strategy-rule-fifth-copy`, with tests running since 06:40** — **so this item is being worked and needs no new dispatch.** **The number moved: this item was filed as WI-111 at 06:31 and is WI-112, because the peer session's publication took WI-111 on its branch at 06:21 and was not visible on `main` when this item was opened. The branch keeps its name — a pushed branch is not renamed without the lead's word — and the lead's word is that it keeps it.** **THE LEAD’S NOTE, 2026-10-22 07:35 — THIS ITEM IS RECORDED TWICE, ONCE BY EACH SESSION, AND THE TWO ROWS ARE ONE ITEM: this row and the peer’s row below.** Both were dispatched under the same request id, `wi-111-strategy-fifth-copy-2026-10-22` / `task_33fdaa157940`, which **died `BUSY` at 06:31:50 and is spent**; the item was renumbered to **WI-112** on both sides — by this session at 06:31 when the publication claimed WI-111, and by the peer session at 06:50 when the collision was settled on `main`. **The number is settled and it is the peer’s settlement, now published on `main`: WI-106 = the licence record, WI-111 = the publication, WI-112 = this copy.** **Nothing is lost by the duplication and nothing is deleted: both rows stand.** |
| `wi-118-mode-the-owner-sets-2026-10-22` | WI-118 — the mode the owner sets is the mode that is in force | worker, under Chief | — | **OPENED AT 07:50 BY CHIEF AS WI-113, FROM WI-085's RED CASE ABOUT THE MODE THE OWNER CAN SEE, AND RENUMBERED TO WI-118 BEFORE IT LANDED.** The panel shows `workspace.autonomyMode` and `PATCH /api/workspaces/:id` is the only way an owner can set a mode, but the policy in force is resolved from `autonomyPolicy.mode`, so the owner's setting landed in one of them and not the other — the panel said "autonomous" and the policy in force said "manual". The service now writes both together, whichever way round the change arrives, and the contract says so in the same breath as **the mode is still enforced nowhere and what it is to mean is still the owner's decision.** Four cases, two mutation proofs, both red and both restored. **THE NUMBER, AND WHY IT MOVED:** this item was opened as WI-113 at 07:50 against a block that said "the next free number is WI-113", and **the peer session had published WI-113 at 07:27 for the contract's refusal publication** — neither claim was bound to a live dispatch, so the tiebreak applies and **the claim published first keeps the number; WI-113 is the peer's.** The block was the defect: it said WI-113 was free while the ledger three hundred lines below already recorded it as taken, **and a block that disagrees with its own ledger is a guess.** This landing extends the block to carry every number the ledger has taken — WI-113 through WI-118 — so the next session that reads `main` sees the numbers this session saw |
| `wi-106-and-wi-111-lead-dispatches-2026-10-22` | WI-106 and WI-111 — the lead's two dispatches, and why both were refused | Wren | `task_7effecefa1b9` | **BOTH REFUSED `BUSY`, AND NEITHER ID IS REUSED.** The lead dispatched WI-098's pointer correction (`wi-098-adr-provenance-pointer-2026-10-22`, `task_7effecefa1b9`) and WI-111's strategy copy (`wi-111-strategy-fifth-copy-2026-10-22`, `task_33fdaa157940`) at 06:31, and **both were refused in 28 and 29 seconds — because Wren's chat was already inside the same work for the peer session.** That is the documented refusal and not a broken lane: **a delegation into a busy chat is refused, and a refused id is spent.** **WI-098's pointer correction turned out not to be needed at all: the edit was already on Wren's branch at `origin/wi/098-adr-rule-resync`, pushed at 06:35, and the lead measured it and merged it as `3fab75a`.** |
| `wi-112-strategy-fifth-copy-2026-10-22` | WI-112 — the rule's fifth copy in the strategy record, brought up to date | Wren | `task_33fdaa157940` | **OPENED AND DISPATCHED AT 06:31, FROM A FINDING IN WI-098's VERIFICATION, AND RENUMBERED TO WI-112 BY CHIEF AT 06:50 WHEN WI-111 WAS CLAIMED TWICE.** The number was read immediately before it was taken: WI-102 through WI-110 are taken, and WI-111 appeared in no item file, no dispatch record and no commit — **on `main`, which is where this session reads; the publication had claimed WI-111 on its own branch at 06:13 and published it at 06:35, and this session had not looked there.** **The dispatch then died `BUSY` at 06:31:50, so nothing live binds the number, and the earlier published claim keeps it: the publication is WI-111 and this item is WI-112.** The work is untouched by the rename — the branch carries the fix to `docs/strategy.md` either way. **The finding:** `docs/strategy.md:248-250` still carries the boundary rule **with no exception clause at all** — "_if it is a picture of the system, it is in the orientation room; if it is a place where work is inspected or decided, it is in the execution room._" — **and the rule now has two declared exceptions, the Needs-you rail and the constellation, which `prototypes/DIRECTION.md` publishes.** **So this copy does not merely repeat the rule, it under-states it, and a reader of `docs/strategy.md` gets a rule that contradicts the settled direction.** It is live on `main` at the same lines, it is **not** in WI-093's copy list (that pin covers brief 01, brief 05 and `prototypes/briefs/README.md`), and **no test reads `docs/strategy.md`** — `git grep -ln 'strategy\.md'` over the test trees returns nothing. **"Four places" is four places the ADR touches; a fifth copy of the rule text, in the flattest form, is live and unpinned.** **The file is free, and the lead measured it before the dispatch:** the peer's unlanded branch changes `docs/strategy.md` at lines 108, 154, 179, 326, 359, 450, 562 and 578 — **not at 248-250**, and the sentence itself is unchanged there — **so this item merges cleanly with that branch.** Batch `batch_5606d02332eb`, queued at Wren. **The check that pins this copy is named as owed and is Probe's file to write.** |

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

---

## 2026-10-22 01:56 — This session lost its transport, and the ledger had a hole in it

**The transport.** This session's `minimax-bot` MCP registration is gone: `mavis
mcp list` returns no servers, `dispatch_tasks` and `get_tasks` answer "not
found", and the Mini App runtime itself is healthy — it listens on
127.0.0.1:58925 and its `/mcp/minimax-bot` route answers, refusing only the
calls that do not carry the Host's loopback token. The registration was lost
across the ~23:30 and 23:37 runtime restarts, so **this session dispatched
nothing, cancelled nothing and posted nothing for two hours**, and the three
dispatches it prepared were delivered by the peer Chief session, which has
transport.

**What a fresh session sees.** A child agent session started afterwards has the
whole tool set — `dispatch_tasks`, `cancel_tasks`, `post_group`, `get_tasks` —
so the registration is per session, and this session's is the one that was
withdrawn. Two facts worth keeping: the dispatch and the group post have to be
made with `caller_bot_id` **empty** (with `bot_a71bb218e3b8` they fail with
_"This tool call cannot be assigned to an active reply. Retry from the current
chat."_ — the reply binds to the Chief's chat, which is busy with the turn
issuing it), and the dispatcher's title cap is 80 characters, so an
85-character title is rejected **and no task is created, so that id is not spent
by the failed attempt**.

**The hole in the ledger was this session's own.** WI-080's verification was
dispatched (`wi-080-stale-contract-comment-verify-2026-10-21`,
`task_9f0c155958f9`, to Probe) and **no row for it existed in this table** —
the table named WI-080's _implementation_ (`task_9d753ce22c6b`) and nothing
else. The row is written now.

**WI-031's correction was on its branch, and unrecorded.** Branch
`wi/031-contract-status-correction` carries `2e9c95d` ("Say the code implements
WI-031's route, and that there are two writers" — `CONTRACTS.md`, 15 insertions
/ 8 deletions, 00:15) and `3f1cc2f` (the item file's record, 00:18), and the
item file on that branch reads **State: verify** — "the contract's status note
is corrected and true of the tree (`2e9c95d`) … Probe verifies it". **Neither
commit id appears anywhere in this ledger.** The re-dispatch this session
prepared would have done the same work a second time in a second branch — **one
item, one implementer**, the tiebreak the peer session took on WI-069 at 00:15.
The peer session cancelled that queued task at 01:47:25, and this session's
delivery hand confirmed it cancelled. **What WI-031 owes next is the merge, and
then Probe's verification of the merged correction**; `main` still says
"Nothing in the tree answers it today: there is no `/api/executions` route",
while the route is served at `apps/server/src/api/executions.ts:21` and
registered at `app.ts:223`.

**`main` is red, and that is why it is unpushed.** Measured by this session on
the tree at `437d072`: `typecheck` 0, `build` 0, **`test` 1**, **`format:check`
1**. The test red is `apps/web/src/__tests__/forge-briefs.test.ts`, exactly two
cases — "is the rule in DIRECTION.md, exception included, and the briefs quote it
with the exception", and "carries the reason the exception exists, in the brief
that states the rule in full". The format red is **one** file,
`.factory/work/WI-092.md`, and it is uncommitted in the shared checkout, so the
**pushed** tree's format is clean — measured per file, the way the pre-push hook
does it. Everything else was green: server 295, web 66 of 68, worker 31,
agent-adapters 16, contracts 28. **The standing word authorises the push on
green, not before**, so `main` was left where it was — eight commits ahead of
`origin/main`, and unpushed. **And one correction to a brief that was already
written:** WI-094's brief says the web suite "is expected to go green when
WI-024's briefs land", and that is not true — the briefs move one side of the
assertion and the pin moves the other, and the suite is green only when both
land. WI-024's briefs were merged into `main` at 01:54 (`69c250b`) and the
pin's successor was dispatched at 01:56 (`task_b804c88b7aa7`).

**The floor report went to the group** — `chief-floor-2026-10-22-0155`, batch
`batch_e234cf0b6a85`, task `task_7491ead3dcb6`, `first_speaker: Chief`, status
queued. The engine's own note says the post is durably accepted and may still
be queued: **acceptance is not completion**, and the group reads it when the
queue serves it.

**And then the briefs' merge added a THIRD red case, which the brief nobody
had read would have missed.** With WI-024's briefs repair merged (`69c250b`),
`apps/web/src/__tests__/forge-briefs.test.ts` is red on **three** cases, not two:

```
x is the rule in DIRECTION.md, exception included, and the briefs quote it with the exception
x carries the reason the exception exists, in the brief that states the rule in full
x puts every surface in the room the direction document puts it in
```

**The third one is a whitespace failure, not a room failure:**
`brief 01 puts "The factory board" in the wrong room: expected '| The factory
board           | Execu…' to contain '| Execution |'` — at
`forge-briefs.test.ts:314`. The pin reads brief 01's table row as **raw text**
and asks whether the row contains `| Execution |`; **the briefs repair rewrote
that table and prettier aligned it**, so the cell now reads `| Execution          |`
and the substring the pin looks for is not in it. **No surface moved.** So WI-094
has three things to fix, not two, and **the third is not about the rule at all** —
a table cell compared as padded text. The lead's correction is appended to
`.factory/work/WI-094.md`, which the dispatched task tells Probe to read first:
**compare the cell's value, not the row's raw text** — a document that re-aligns
its own table is not a document that moved a surface.

Everything else in the tree is green at `6a76b6c`: server 28 files / 295 tests,
worker 5 / 31, agent-adapters 2 / 16, contracts 4 / 28, web 8 files / 68 tests
with **3 failed, all three in this one file**. `forge-briefs.test.ts` is the
only file in the tree that reads `DIRECTION.md`. **So `main` is still not
pushed**, and the push waits on one thing: the pin's successor landing.

**WI-065's correction landed on `main` at 02:21, and WI-031's landed with it.**
The template record's false sentence is gone — `CONTRACTS.md` no longer says "The
code does not implement this yet" about the template record. **The two that
remain are at `:964` and `:1169`, and they are different entries and different
items** (the audit outcome, and the approval evidence). The merge was measured
before it was taken — `merge-tree` named no conflicted file — and measured again
after: typecheck 0, format 0, build 0, and **the same three pin cases and
nothing else** — server 28 files / 295 tests, worker 5 / 31, agent-adapters
2 / 16, contracts 4 / 28, web 8 files / 68 with 3 failed, all three in
`forge-briefs.test.ts`. **The merge is Chief's, and the merge message says so
out loud.** The peer session merged WI-031 in the same window (`e125039`), so
`CONTRACTS.md` now also says the code implements WI-031's route and names both
writers of an outcome — **which is the merge WI-031's verification was waiting
on, so what WI-031 owed next was Probe's verification of the merged
correction — and it is dispatched**: `wi-031-contract-verify-2026-10-22`,
`task_30847905e60e`, batch `batch_4a020620af78`, queued at Probe, at 02:35.

**And one measurement worth keeping, because it nearly produced a wrong
conclusion.** Running `vitest run --root apps/server` by hand reports **21
failed test files and 59 failed tests on a tree the official gate calls green**
— it does not load the package's own configuration, and 125 tests are skipped
instead of run. **The gate is `npm run test`; a hand-rolled vitest invocation is
not the gate, and a red it reports is not a red in the tree.**

**And then, at 02:11, the verifier lane closed: FOUR delegations into Probe's
chat were refused BUSY, in a row, every one of them 28 seconds with no
result.** WI-080's verification (`task_9f0c155958f9`, this session's), WI-036's
third re-verification (`task_762f49d237f9`), this session's pin fix
(`task_b804c88b7aa7`), and Vision's pin re-point (`task_881a59c250c3`). **The
relay delivered each brief and the bot turn was refused** — the uniform 28
seconds is the refusal, not a slow start. **A refused task is not a dispatch
and its id is spent**, so all four pieces of work are undone — including the
pin fix the push waits on — and **the queue emptied itself by failing**.

**The session that serves Probe's chat** (`mvs_f1f513955649480dbfb09fae820cf59f`)
**reports `started` with a turn-system error — "Cron definition was deleted
before execution" — and has not been updated since 02:11:35.** A delegation
into a chat whose session is mid-turn is refused, and this session's own
letters to that session queue behind the same turn. **This is exactly the shape
the watchdog's rule exists for, and the rule was followed: reported, never
cancelled.** The two re-dispatches went out at 02:41 under new ids and new
titles, and **if they are refused the same way, the verifier lane needs the
runtime restarted — and that is the owner's decision, not this session's:** a
restart interrupts the two live turns, and it would also apply the on-disk
`MAX_RUNNING = 4` patch, which is a second decision that is not this session's
to take.

**And two briefs went to that one file, which the lead had to reconcile.** The
item's brief holds the pin to the document — it must read the exception clause
out of `DIRECTION.md` and hold the briefs to that — and a second brief asked
for the two pins to be re-pointed at the new wording, which is a string swap
that leaves the pin brittle for the next rule change. **The item's brief wins,
and the dispatched brief says so in terms.**

---

**Chief's section — 2026-10-22 03:45 — the green push and the platform's verdict,
the verifier lane's death measured, four verifications moved onto lanes that can
take them, and the owner's decision that is still open.**

**The green push, and the platform's verdict — the ledger had no record of either,
and it should have had both.** `main` was pushed at 03:11 as `2138448` ("Dispatch
the two verifications that kept dying on host capacity, with new ids"),
`origin/main` = local `main` = `2138448`, `rev-list --left-right --count
origin/main...main` = `0 0`. **The gates, measured on the tree that was pushed:**
typecheck 0, test 0 (server 28 files / 295 tests, web 9 files / 82 tests, worker
5 / 31, agent-adapters 2 / 16, contracts 4 / 28), format:check 0, build 0,
test:e2e 0 (27 passed), verify:bundle 0. **The platform's verdict, read afterwards
and from outside this machine: CodeQL `completed/success` and CI
`completed/success` — Dependency audit, Build and test, Lint the workflows, Build
and run the stack — VERDICT: GREEN.** **Green is a property of the HEAD being
pushed: the local gates on that tree, and the platform's verdict read afterwards
and recorded here.** Three commits have landed on top of it since — `4d6b7ef`,
`80c3c63` and `a08f206` — **and all three touch only `.factory/work/*.md` item
records, so the code tree is still exactly what was measured at `2138448`.** This
session pushed nothing: the peer session pushed, and this session read the
verdict.

**Then the thing that ended the verifier lane, measured rather than felt.**
**Probe's chat has refused twenty-eight delegations.** Measured against the chat's
own message store (`bot_bot_324879ec19f2.json`): every refusal is a `relay` brief
followed by a **zero-length** `bot` answer with `status=error` and
`kind=delegation` — no report, no partial answer, no trace of a turn that started.
**Nothing in that chat has succeeded since 02:11:29.** The refusals took two
shapes and both are refusals: the 02:11–02:47 wave refused in exactly 28–29
seconds — that is the refusal, not a slow start — and the 03:01–03:20 wave took
four to ten minutes and still refused. **Three of the dead ones are the peer
session's own dispatches**, sent at 03:11 and 03:30, and they died with the same
`BUSY`: WI-010 to Probe (`task_f99a95269325`, 9m47s), WI-031 to Probe
(`task_f93c4f09452d`, 4m23s), WI-080 to Probe (`task_5152a57d9d84`, 4m40s); WI-098's
fourth attempt (`task_fff9833390f9`, 28 s) and WI-099's (`task_7ebe712884fa`,
29 s) died the same way. **The factory's last five verifications, across two
sessions, are all dead and all report nothing — and a refused task is not a
dispatch, so six owed verifications had no live dispatch at all.**

**The cause, measured, and it is not the runtime.** `miniapp list` says the runtime
is **`running`**, so this is **not** the stopped-runtime failure mode of
2026-10-21. The session that serves Probe's chat,
`mvs_f1f513955649480dbfb09fae820cf59f`, reports **`status: started`**,
**`errorSource: turn-system`**, message **"Cron definition was deleted before
execution"**, `updatedAt` **02:11:35** — **81 minutes unchanged at the time of
reading.** A delegation into a chat whose session is mid-turn is refused; that is
the whole mechanism. **This session's own letters to that session queue behind the
same turn, which is why the lead's letters are part of the wedge and not a cure
for it.**

**A correction to this session's own earlier text, and the correction is in the
owner's favour.** The paragraph above said a restart "would also apply the on-disk
`MAX_RUNNING = 4` patch, which is a second decision that is not this session's to
take." **That is no longer true.** Measured now: **every dispatcher copy on disk
reads `const MAX_RUNNING = 2`** — the plugin-cache copy and the liveboards
backup both — so **a restart is policy-neutral on the ceiling**, and the only cost
left is that it interrupts live turns.

**Four owed verifications moved onto lanes that can take them, and the tiebreak is
said out loud in every brief so it can be overruled.** **WI-010 → Cog**
(`task_0398b06e6479`), **WI-080 → Wren** (`task_6a3e9baccce4`), **WI-031 → Wren**
(`task_c07c22d8d6b5`), **WI-036 → Vision** (`task_8609cdc160f8`). The rule applied
each time: **the verifier did not write the work** (Vision wrote the direction
document, Cog wrote the comment and the route-entry correction, Wren wrote the
licence-record successor), **the item keeps exactly one verification**, and **the
lead accepts**. **And the limit of the substitution is stated plainly, because the
owner's own earlier lesson is that it was never the verifier that was the
constraint: substituting a verifier does not fix the lane — the lane is broken by a
wedged session, and only a restart clears it.** Substitution is a holding action
that keeps four items from going unverified while the factory waits; it is not a
repair, and it does not make WI-098's, WI-099's or WI-075's verifications run.

**And one race the lead must record rather than let a reader discover later.**
`prototypes/DIRECTION.md` is being edited in the shared checkout **right now** by
the peer lane — a claim pinned at `0d4731f` ("Accept WI-081, and number WI-092:
the bundle-budget test's five-second timeout"), which **is** in `main`'s history —
and it is **the very file WI-010's verification measures.** The verification may
therefore find the document moved under it, and **the brief says to name the
commit it measured at and to re-measure every pointer**, so the race produces a
finding rather than a wrong verdict. **The lead did not stage, commit or edit
that file** — it is another session's work in flight — and this section is
committed with `git commit --only .factory/INTAKE.md` precisely so that it
cannot be swept in.

**This session's own transport came back mid-way, and it changes who sent what.**
The `minimax-bot` MCP answers again with an **empty `caller_bot_id`** (setting it
to the Chief's own id fails with "This tool call cannot be assigned to an active
reply"), so the four dispatches above and the floor report went out **directly from
this session's own tool calls** rather than through a child session's hands. The
attribution stays with Chief in the brief and here.

**The ledger's own repair — six rows that were lying.** A row that claims a live
dispatch which is dead is a record that lies, and a reader would act on it. The
rows for `wi-080-stale-contract-comment-verify-2026-10-21`,
`wi-094-pin-reads-the-rule-again-2026-10-22`, `wi-031-contract-verify-2026-10-22`,
`wi-036-record-reverification-third-2026-10-22`,
`wi-010-direction-document-verify-2026-10-22`,
`wi-031-contract-verify-again-2026-10-22` and
`wi-080-stale-contract-comment-verify-third-2026-10-22` are corrected in place:
each now carries the refusal, the time it took, the fact that the id is spent, and
where the item's live dispatch actually is. **Two of those rows also named a
verdict that had since changed** — WI-031's brief warned the verifier about "three
red cases in `forge-briefs.test.ts`" that are **gone**, fixed by WI-093's pin
(`203b7e0`) and accepted — so that warning is corrected in the row too, because a
stale warning in a brief is a defect in the brief.

**And one piece of work was one `git push` away from being lost.** WI-075's branch
`wi/075-published-status-claims` existed in **one local checkout and on no remote**
— `ls-remote --heads origin` returned nothing for it. It is now on origin at
`c832ad8` ("Watch the contract's claims about the code, and not just its shapes",
`apps/server/src/__tests__/published-shapes.test.ts`, +241/−9), pushed with the
hook's prettier check passing. **Its verification is still owed, and it is
contested with WI-081 — both branches touch the same test file — so the lead has
to rule on which of the two is the live item on that file before either is
merged.** That ruling is not taken here.

**And the contest is now measured, and the measurement says WI-075's branch
cannot land as it stands.** `git merge-tree --write-tree --name-only main
wi/075-published-status-claims` returns tree `e0b91c9` with **one conflicted file
— `apps/server/src/__tests__/published-shapes.test.ts`** — and `Auto-merging …
CONFLICT (content)`, exit 1. The reason is visible in the history: **WI-081's
gate is in `main`** (`523900e`, "Hold the published note's bound to the code's own
cap", accepted at `0d4731f`), **and WI-075's branch adds 241 lines to that same
file from a base that predates it** (`c832ad8`, based on `cd9507e`). **So the live
item on that file is WI-081's, and WI-075's gate has to be brought forward onto
it — keeping both assertions — before WI-075 can be verified at all.** That is
implementation work and not a verification, and **the item's own file is in the
other Chief session's hands right now** (`.factory/work/WI-075.md` is modified in
the shared checkout), **so the lead records the measurement and leaves the item to
its owner: no branch was merged, no conflict was resolved, and no verification
was dispatched.**

**And the tree this record is pushed on, measured on that tree.** The gates, run
on `main` with the peer's `95e5165` and this session's ledger commit in it:
**typecheck 0, format:check 0, build 0, test 0 — server 28 files / 295 tests,
web 9 files / 82, worker 5 / 31, agent-adapters 2 / 16, contracts 4 / 28** (48
files, 452 tests). **So the tree is green and the standing word authorises the
push.** The peer session pushed `a08f206` (03:40) and `95e5165` (03:52) — **and
`95e5165` is the commit that moved `prototypes/DIRECTION.md`, so the web pin
suite was re-run over the changed document and stayed green, which is the
measurement that matters for WI-010's verification.** **This session's push
carries the ledger record and the record of the tree's own gates, and no code.**

**And the platform's verdict on that push, read afterwards and from outside this
machine.** `af43b08` — **CodeQL `completed/success`** (Analyze
javascript-typescript) and **CI `completed/success`** (Lint the workflows,
Dependency audit, Build and test, Build and run the stack) — **VERDICT: GREEN.**
**Green is a property of the HEAD being pushed: the local gates on that tree, and
the platform's verdict read afterwards and recorded here.** `origin/main` =
`af43b08` = local `main`, `rev-list --left-right --count origin/main...main` =
`0 0`. **This paragraph is the one commit this session leaves unpushed** — the
verdict above is for `af43b08`, which is on `origin/main`, and the next push
carries this record; the verdict for that push is read then, and read the same
way.

---

**Chief's section — 2026-10-22 04:25 — the first verification to land on a
substituted lane came back VERIFIED, and the merge that delivered it broke
eight of the contract's pointers into the same file.**

**WI-080 is accepted.** Wren's verdict — read against the contract and not
against the brief's line numbers — is that **every claim in the comment is true
of the contract as published**: `:754` carries the tool table's row for
`resource.get`, `:739` is the heading `### MCP exposure`, `:768-770` carry
"who owns a resource is settled before it is handed over — the same rule the
writes carry", `:676` and `:771-773` carry "the rule is stated once" and the
three tools, and `:776` with `:705-706` and `:780-782` carry the owner's API
being out of reach. **The lead re-measured it rather than taking it on trust:**
`:754` and `:739` read as quoted, and the diff `ceed799^1..ceed799` on
`server.ts` is **8 comment lines in and 6 out, every changed line a comment
line**, so this factory's earlier "all 14 changed lines are comment lines" is
true. Gates at `297a387`: typecheck 0, test 0 (48 files, 452 tests),
format:check 0, build 0. **The lead accepts, and the lead did not write the
work.** The item's own record says so under "Accepted — 2026-10-22, Chief
(Wren verified)", and its `State:` line — which still read "implement — opened,
briefed in full, and NOT dispatched" — is corrected in place rather than
overwritten, with the history kept.

**And the merge that delivered WI-080 broke eight of the contract's pointers
into the same file — the merge made the comment true and moved the code the
contract points at.** The comment grew by two lines, so every line of
`apps/server/src/modules/mcp/server.ts` below it moved +2, and `CONTRACTS.md`
did not follow: `:636` (`:465-481` → `:467-483`), `:638` (`:361` → `:363`),
`:639` (`:373-377` → `:375-379`), `:640` (`:382-384` → `:384-386`), `:724`
(`:153` → `:155`), `:725` (`:386` → `:388`) and `:726` (`:447` → `:449`, `:417`
→ `:419`) now point at lines that hold a comment or a different statement, and
`:1343`'s `:368` was **already** stale before WI-080 — it should be `:395`.
**Every one of the nine was measured line by line by the lead**, and the ninth
one is the reason the brief tells the fixer to measure rather than to add two:
`22ef5ba` moved that line to `:393` without updating the citation, and WI-080's
+2 took it to `:395`. **WI-080's acceptance does not waive any of it.**

**So the drift is WI-103, and the lead has numbered it** (the next free number
above WI-102) and dispatched it to Wren: `wi-103-contract-pointers-after-wi-080-2026-10-22`,
`task_b0c1dbb8ab05`, batch `batch_6158711cfd29`. **Scope is `CONTRACTS.md`
only — the code is correct and the contract's pointers are what is wrong** — and
the brief also says to check every other pointer `CONTRACTS.md` holds into that
file and **report the wrong ones, not fix them**.

**And WI-034's own citation drift was landed first, because `CONTRACTS.md` is one
file and one live item.** The branch `wi/034-citation-drift` at `7e58b8d` was
pushed and unmerged, and it was holding the file that WI-103 needs. **The lead
measured the merge before taking it** — `merge-tree` named no conflicted file —
and **re-measured the three corrected citations against the tree**:
`resources/service.ts:525` is the enqueue, `audit/service.ts:79` is the
`result: input.result ?? 'success'` default, and `app.ts:190` is the error
handler, where each old citation pointed somewhere else. **Merged as `26fb68e`,
"Merge WI-034's citation drift: the audit outcome entry cites the lines that
carry its claims", and the merge message says out loud that the merge is the
lead's.** The gates, on the merged tree: **typecheck 0, format:check 0, build
0, test 0 — server 28 files / 295 tests, web 9 / 82, worker 5 / 31,
agent-adapters 2 / 16, contracts 4 / 28** (48 files, 452 tests).

**And what this section is worth, stated plainly: the substitution worked.**
The first verification to come back on a lane other than Probe's was **not a
thinner report** — it carried a claim-by-claim table, the gates, and **two
findings of its own, one of which was a regression in the published contract
that nobody had looked for** and which would have stayed false in `main`
otherwise. **That is the evidence for the owner's second question, and the lead
does not answer it — but the lead puts it in front of the owner.**

---

**Chief's section — 2026-10-22 04:40 — the cause is a rule, not one broken chat,
and two verifications came back with findings in them.**

**The rule, measured across all four chats: a chat whose session is `started`
refuses every delegation, in exactly 28 seconds, silently.**

| Chat   | Session                                | Status                                                      | What it does                                                                                |
| ------ | -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Probe  | `mvs_f1f513955649480dbfb09fae820cf59f` | **`started`** (turn-system error, unchanged since 02:11:35) | **28 delegations refused**, nothing succeeded since 02:11:29                                |
| Vision | `mvs_1dd69a42fec84f3ca0600075470232a4` | **`started`** (updated 04:18:43)                            | **refused** — WI-036's re-verification, 04:20:05 → 04:20:33, 28 seconds, zero-length answer |
| Cog    | `mvs_db6a5624d51842cd8a029fc062c60503` | **`idle`**                                                  | takes work — WI-010's verification delivered                                                |
| Wren   | `mvs_dff627414f0e47fbbdf7501b11dfdd06` | **`idle`**                                                  | takes work — WI-080's verification delivered                                                |

**And the discriminator is the status type, not the message.** **Wren's session
carries the very same turn-system message as Probe's — "Cron definition was
deleted before execution", `errorSource: turn-system` — and it works, because
its status is `idle`.** So this section corrects the 03:45 report's framing: the
cause is not Probe's chat being broken, and not a queued worker's refusal. **It
is a general rule, and the factory is running at half capacity because of it, and
every dispatch into a `started` chat costs 28 seconds and produces nothing.**

**The lever is the same one, and the 2026-10-21 measurement says it works:**
`miniapp restart` released the stuck sessions then and the dispatcher refilled
both slots in seconds. **The cost is unchanged — it interrupts live turns — and
the decision remains the owner's; the lead has not taken it.** What has changed
is the size of the prize: **two of the four chats are refusing now, not one.**

**WI-010 is verified, with one defect, so it is not accepted yet.** All three
criteria hold — the rule and its two declared crossings, the pointers, the spend
claim — and the single defect is a commit label in a lane-count sentence, where
the number is right at `3479c31` and the words say "at the pinned commit". **One
phrase, dispatched to Cog** (`task_69aace150952`), **because Vision's chat cannot
take it.** **WI-080 is accepted** — see the section above — and **its
verification found the regression the lead had not looked for**: the merge that
made the comment true moved the code the contract points at, so **eight of
`CONTRACTS.md`'s pointers into `server.ts` are now wrong**, and that is WI-103.

**And WI-036's second substitution was refused too — which is the measurement
that turned a suspicion into a rule.** It went to Vision at 04:20:05 and came
back at 04:20:33 with a zero-length answer, in exactly the time Probe's
refusals take, because Vision's session is `started` too. **It is on its third
lane now** (`task_6a2d0711a7a9`, to Cog).

**The platform's verdict on the pushed tree:** `d6edaf3` — **CodeQL
`completed/success`** (Analyze javascript-typescript) and **CI
`completed/success`** (Build and test, Lint the workflows, Dependency audit,
Build and run the stack) — **VERDICT: GREEN**, read afterwards and from outside
this machine. **No item was accepted on evidence that does not cover the file it
accepted: WI-080's acceptance came with the lead's own re-measurement of the
comment and of the diff, and with the regression that same verification found,
routed rather than waived.**

**WI-031 is verified too — all nine criteria hold, nothing unmet — and it is not
accepted either, for two reasons the verification found.** The contract's
`turn:<execution id>` sentence is false of the code (the route takes the bare id;
the client strips the prefix; anything else 404s), and the item file has been
holding the item open for **four hours forty-six minutes** on a blocker that
stopped being true at 19:21:40 the night before. **Both corrections belong to
Wren**, who wrote both files — **and the peer session's ruling is sharper than
this session's, and the lead adopts it: the contract half was verified by the
author of that half, so it is HELD for an independent check.** **The defect is
WI-104** — the peer session's number, its item file written at 04:36, deliberately
not dispatched because `CONTRACTS.md` is one file and one live item and WI-103 is
live on it — **and this session's dispatch of the same defect at 04:44 was
cancelled at 04:48, before it ran, as the duplicate it would have been: two
workers on one contract sentence and two writers on `WI-031.md`, which the peer
had already appended to at 04:36.**

**And that ruling is the reusable part, so the lead says it out loud here: a
substituted verifier stands only where the substituted verifier did not write the
work.** WI-080 (Cog wrote it, Wren verified it) and WI-010 (Vision wrote it, Cog
verified it) are that case. **WI-031's contract half is not** — Wren wrote that
half and verified it, and **a writer does not verify their own work**. **So the
owner's question — whether a substituted verifier stands — does not have one
answer, it has two, and this item is where the difference shows.**
**So: two items verified, one accepted, two owed a one-line or one-phrase
correction — and not one item accepted on a report the lead had not measured.**
**And the shape of the last hour is the answer to the question the owner was
asked:** four verifications were dispatched to live lanes, three came back with
real findings in them, and **two of those findings were defects nobody had gone
looking for** — eight false pointers in the published contract, and a published
sentence that tells a client to post the wrong id.

---

**Chief's section — 2026-10-22 05:00 — the peer session's floor reply, checked
against the engine's own code, and the one measurement it does not have.**

**The peer session's report is right, and this session checked it rather than
taking it on trust.** Three claims verified in the engine's own code and in the
tree: **the two refusal mechanisms are both real** —
`task-dispatcher.mjs:463` reads `if (this.runs.size >= MAX_RUNNING) return;`, so
**a task waits for a slot and is not dead**, and `engine.mjs:202` reads
`if (this.inbox.busy(chatId)) return true;`, so **a delegation into a chat that
is mid-turn is refused `BUSY`**; **the ceiling patch script is tracked on
`main`** (`scripts/raise-factory-concurrency.mjs`, `7006148`, 2026-10-21 23:43),
**so the recipe is durable even though the applied state is not** — the peer
measured that a content-addressed plugin-cache refresh erased the patch, which
is exactly why every copy on disk reads `MAX_RUNNING = 2` again; **and WI-091's
gate is still not on `main`** (`scripts/contract-status.json` and
`scripts/verify-contract-status.ts` are absent from it), so the WI-086 trap is
still ahead of the factory.

**And the one measurement this session has that the peer's reply does not: a
refusal has a permanent form and a temporary form, and the session's status
tells them apart.**

| Chat   | Session status               | The refusal                                                                                          |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Probe  | **`started`** since 02:11:35 | **permanent** — 28 refusals, nothing since 02:11:29                                                  |
| Vision | **`started`** since 04:18:43 | **permanent** — WI-036's re-verification, 04:20:05 → 04:20:33                                        |
| Wren   | `idle` now                   | **temporary** — WI-034's correction died `BUSY` after 35 minutes while her chat was mid-verification |
| Cog    | `idle`                       | takes work                                                                                           |

**So this session's 03:45 diagnosis and the peer session's 04:20 diagnosis are
two halves of one thing: the ceiling is what limits how much runs at once, and a
chat whose session is left `started` refuses everything indefinitely.** The peer
is right that **a restarted Probe would not have saved WI-034's correction** —
that one was the ceiling and a busy chat, not a dead session. **And this session
is right that a restart buys back more than one lane: it buys back Probe's chat
and Vision's chat, because both are `started`.**

**Which makes a third decision for the owner, beyond the two already asked: the
order is patch, then restart** — re-apply the tracked ceiling patch so the
runtime comes back with more than two turns, then restart to clear the `started`
sessions. **A restart alone restores two chats and leaves the factory at two
turns; the patch alone buys throughput and leaves both chats still refusing. The
peer's recommendation on timing — after the live turn lands, so nothing is
interrupted — is the lead's recommendation too.**

**And one harness fact worth keeping, because a RED that means nothing looks
exactly like a RED that means everything.** `624fa50` came back `VERDICT: RED` —
**and not because a job failed: CodeQL succeeded, and `Dependency audit`,
`Lint the workflows` and `Build and test` all succeeded**, while
`Build and run the stack` came back **`completed/cancelled`**, because the next
push superseded that run. **Two sessions pushing one branch cancel each other's
CI runs, so the verdict has to be read after the last push of the window, and a
verdict with one cancelled job is a superseded run and not a broken tree.** The
final push's verdict: **`d66e8bd` — CodeQL `completed/success`, CI
`completed/success` on all four jobs — VERDICT: GREEN.**

**And this section's floor post did not land, and the record says so rather than
letting a reader wonder.** The 05:05 addendum carrying the table above, the
patch-then-restart order and the CI-cancellation fact **was refused four times
with "the group is mid-discussion"** — the floor was in a round that ran from
04:39 past 05:05, and each post starts a round. **So the floor holds this
session's 03:45 report and the peer session's 04:20 reply, and this addendum
lives here instead.** The content is not lost: it is in the table above, and the
live lanes have it in their briefs.

**The owner's open decision, and it is the only thing that restores the lane.**
**`miniapp restart minimax-bot`** clears the wedged session and is the only thing
that does. **The cost is measured, not asserted:** it interrupts live turns, and
Cog's WI-102 implementation was live when this was written. **This session did not
take it** — a live turn is not this session's to cancel, and the restart has been
treated as the owner's since 02:41. **The second open question is whether a
substituted verifier stands**, for the four items above and for WI-098's and
WI-099's next attempts. **The floor report carrying both questions went to the
group at 03:45** (`chief-verifier-lane-dead-2026-10-22-0345`, batch
`batch_53dd0398764f`, task `task_08f4f84fa3c5`, queued). **And the lead accepts
nothing in this section: no item was verified, no item was accepted, and no
verdict was read from a report that has not landed.**

## The owner's decisions, 2026-10-21 12:20

A strategy session, grilled with the owner over four rounds, on the shape of
Personal OS: its domains, its interaction design, and how it improves itself.
The owner's own words are in the queue above as W-7 through W-13. This
section is the factory's record of what was decided and what it costs.

### What was asked, and what was answered

| #   | The question                                                                                                   | The owner's answer                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Does the MiniMax Code-style desktop experience become a first-class surface, and does it host its own runtime? | **No desktop app.** Web and PWA; the desktop contributes interaction primitives, rendered by the web client.                   |
| D2  | Declarative rules first, or a structural move?                                                                 | **Five domains, declarative-first.** Publish the map and the ownership rules; no file moves yet.                               |
| D3  | Is the instance's own substrate outside what agents may change?                                                | **Yes.** The owner accepts migrations; release is out of band; the instance never applies, merges, deploys or restarts itself. |
| D4  | MiniMax Code's CLI is MIT — does that open the door to depending on it?                                        | **No.** Read and reimplement against our contracts, attribute what is carried over, zero runtime dependencies.                 |
| D5  | Which word owns the five-part structure?                                                                       | **"Domains."** "The three pillars" keeps its name, with one line distinguishing them.                                          |
| D6  | How many items for the interaction model?                                                                      | **One.** The whole MiniMax Code interaction model, adopted at once.                                                            |
| D7  | Where do the factory roles sit?                                                                                | **Control-plane membership only.** The instance dispatches and records; the roles keep their own host.                         |
| D8  | How does the big item land without colliding with the interaction items in flight?                             | **Publish the contract revision now; land the code as one work item afterwards.**                                              |
| D9  | Which harness patterns become published contracts?                                                             | **Split by boundary.** Client-visible in the interaction contract; worker internals as their own item.                         |
| D10 | Where do these decisions sit in the order?                                                                     | **Funded, ordered behind the in-flight interaction items,** and the stated scope amended to say so.                            |
| D11 | How does the instance reach the roles that keep their own host?                                                | **Add an `mcp` adapter type,** so any MCP server can be an agent connection.                                                   |
| D12 | Which ledger is authoritative for which work?                                                                  | **The repository records code work; the instance's ledger records instance work; one link each way.**                          |
| D13 | How much of the interaction contract does the plan specify?                                                    | **Fully** — every shape, its states, routes, events and the migration note.                                                    |

### What was decided, and where it landed

| Decision                                                 | The record                                                        | The work                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Five domains, declared and checked                       | ADR 0008, `docs/domains.md`, `apps/server/src/domains.ts`         | [WI-047](../work/WI-047.md), [WI-048](../work/WI-048.md), [WI-049](../work/WI-049.md) |
| MiniMax Code is a specification                          | ADR 0009, the landscape row in `docs/strategy.md`, PRODUCT.md §10 | [WI-050](../work/WI-050.md), [WI-051](../work/WI-051.md)                              |
| The interaction model, published                         | `CONTRACTS.md`, Contract 7                                        | [WI-052](../work/WI-052.md)                                                           |
| An MCP server is an agent connection                     | `packages/agent-adapters/src/mcp.ts`, Contract 2                  | [WI-053](../work/WI-053.md), [WI-054](../work/WI-054.md)                              |
| The instance improves itself without depending on itself | ADR 0010, `docs/self-improvement.md`                              | [WI-057](../work/WI-057.md), [WI-058](../work/WI-058.md)                              |
| The interaction model, implemented                       | —                                                                 | [WI-055](../work/WI-055.md) — **not dispatched**                                      |
| The worker's context budget and eligibility chain        | —                                                                 | [WI-056](../work/WI-056.md) — **not dispatched**                                      |

### Three findings that changed the plan, and where they went

**The `executions` module.** The plan's module inventory missed it, and the
domain map would have been wrong without it. `apps/server/src/modules/executions/`
is Interaction's — it is the owner's authority over a turn whose outcome could
not be confirmed — while the `executions` table stays Work's, because the
ledger owns the row. That is one declared shared table write, and it is
[WI-060](../work/WI-060.md).

**The server migrates on boot.** `apps/server/src/index.ts:55` and
`apps/server/src/runtime.ts:61` both call `runMigrations`. So boundary B3 —
the owner accepts migrations — is a procedure and not a mechanism today, and
B2's rollback is a rollback of the code rather than of the schema. The
runbook says so in the place where somebody will read it at two in the
morning, and the gap is [WI-061](../work/WI-061.md).

**One crossing, not zero.** `modules/resources/service.ts` imports
`FactoryService` to serve the task resource provider, and the plan expected
the map to be clean. It is declared instead, with an owner and a way out:
[WI-059](../work/WI-059.md).

### What was not done, and why

**The interaction model's code.** The contract is published and the
implementation is one work item, but it waits behind WI-006, WI-007, WI-008,
WI-009, WI-004 and WI-010, which own the files it touches. Publishing a
contract before code is the repository's own pattern, and the entry says
plainly that the code does not implement it yet.

**The worker's context budget and the tool eligibility chain.** Real gaps, and
a separate item: they are inside the worker, so they are not client-visible and
they are not contract. [WI-056](../work/WI-056.md).

**A second runtime, a desktop application, a dependency.** The owner's last
sentence was "avoid building another agent harness or unnecessary
infrastructure", and nothing in this session added one.

### The numbers

**This session: WI-046 through WI-061.** Taken by the session that owns the
number space, and the other Chief session's numbers — WI-024 through WI-029
and WI-039 through WI-043 — were left alone.

---

## 2026-10-22 04:20 — A shift, measured: one dead dispatch, one defect closed, and the verifier lane still the owner's

**The state this shift found, measured rather than read off the item files.**
263 tasks in the fleet state: **2 running, 4 queued**, and **neither running
task is a stall.** WI-102's implementation had held its slot 33 minutes and
WI-080's verification 17 — both under the 45-minute trigger — and both chats
show a `streaming` delegation with a `started` session. **`miniapp list` says
the Mini App runtime is `running`**, so the `running` rows are work in flight
and not leftovers of a stopped dispatcher. **Nothing was cancelled, and nothing
should have been**: elapsed time is a trigger to look, never a reason.

**The verifier lane is still dead, and the decision is still the owner's.**
Probe's session `mvs_f1f513955649480dbfb09fae820cf59f` reports `status: started`
with `errorSource: turn-system` and _"Cron definition was deleted before
execution"_, **unchanged since 03:53**. **`miniapp restart minimax-bot`
is still the only thing that clears it**, and it has been the owner's since
02:41. This shift did not take it — a live turn is not a shift's to cancel.

**And one dispatch was dead where the ledger said it was pending.** WI-034's
correction dispatch to Wren — `wi-034-citation-drift-correction-2026-10-22`,
task `task_fa2d04db7c5d`, batch `batch_5f660955d239` — **is `failed` in the
fleet state**, while the item's own file said it was dispatched. The correction
it was sent to produce exists anyway (`9ff3616`, on `wi/034-citation-drift`),
so no work was lost — but **the record that said "dispatched" was a record that
lies**, and it is corrected in WI-034's file. **A dispatch that cannot be
delivered is not a dispatch, and a dispatch that dies is not a pending one.**

**What this shift did.** WI-034's blocking defect — three code citations in
`CONTRACTS.md`'s `### The audit outcome` that had drifted under the section, one
of them contradicting the neighbouring entry's citation of the same line — is
closed, and Probe's pin holds it, because the pin and the contract cite the
same string and one without the other is red.
**The correction landed on `main` first, and this shift did not land it: the
other Chief session merged it as `26fb68e` while this shift's gates were
running**, with merge-tree naming no conflicted file and the three citations
re-measured against the tree before the merge was taken. **What was left for
this shift was the other half — the pin itself** —
`apps/server/src/__tests__/audit-outcome-vocabulary.test.ts` (252 lines), on
branch `wi/034-outcome-vocabulary-check`.
**The pin was red on `main` and is green on the tree it lands in.** Measured
here, all three states, not copied from a report: the stale contract and the
stale pin give **`1 failed | 5 passed (6)`**; the corrected contract and the
stale pin give **`1 failed | 5 passed (6)`**; the corrected contract and the
moved pin give **`6 passed (6)`**. The pin's own header said its red case was
red because the contract had drifted, **which the
correction made false**, so the header was corrected in the same landing — a
file that says the contract is broken when the contract is whole is the same
defect as a contract that lies about the code. **No assertion was loosened and
no criterion was dropped.**

**And one number had two claimants, and one dispatch still has no file at all.**
**WI-103 was numbered and dispatched to Wren** —
`wi-103-contract-pointers-after-wi-080-2026-10-22`, `task_b0c1dbb8ab05`, batch
`batch_6158711cfd29`, queued — **and `.factory/work/WI-103.md` does not exist.**
Measured: `git log --all --diff-filter=A -- .factory/work/WI-103.md` returns
nothing, so **the file has never existed on any branch in this repository.**
The number space's rule is that an item's file is the specification and the
dispatch carries it; **a dispatch whose specification exists only in a chat is
a dispatch the repository cannot hold.** **And the number 103 did have a second claimant:** the branch
`wi/103-publish-template-contract` existed at `48295c2` — the same commit as
`wi/101-integration-landing` — and it carried **no WI-103.md file either**, so
it was a pointer to an item that was never written down.
**That claim is now withdrawn by the session that owns the numbers.** The
branch is gone, the item is re-filed as **WI-106**, and
`.factory/work/WI-106.md` is written and pushed on
`wi/106-publish-template-contract` — and that file **says out loud that it was
first filed as WI-103**, and why WI-106 is the next free number. **So the
collision this shift measured is resolved, by the right session, in the right
way: a number is a claim about an item, and the loser of the claim re-files
rather than renames the winner.**
**What is left is the item with no file at all.** WI-103 — the peer's, "the
eight pointers into the code file that WI-080's merge moved", dispatched to
Wren as `task_b0c1dbb8ab05` and queued — **still has no file, and
`git log --all --diff-filter=A -- .factory/work/WI-103.md` returns nothing.**
**This shift does not create the file: the number space belongs to the session
that owns it.** **The want, for whoever owns the numbers:** _"the contract's
pointers into `apps/server/src/modules/mcp/server.ts`, which WI-080's merge
moved by +2 — nine citations, measured line by line by the lead, one of them
already stale before WI-080"_ — owner Wren, scope `CONTRACTS.md` only, and the
brief that goes with it is already in the dispatch.

**And it is not the only one.** Measured the same way, over every branch:
**`.factory/work/WI-105.md` and `.factory/work/WI-107.md` have never existed
either**, and **WI-105 is running** (`task_cc1bd927efc4`, on Cog). **Three
live items are specified only in chat.** The item's file is what makes the
work survive the session that wrote it; **a spec that lives in a chat dies
with the chat**, and the number block in `.factory/INTAKE.md:47-56` counts a
branch and a dispatch as a claim, which is not the same thing as a written
specification.

**The item is NOT accepted, and this shift did not accept it.** Chief wrote the
item, the correction and the merge, so it does not accept it — **the
re-verification by another hand is owed**, on the landed tree, and it goes to a
lane that can take it with the limit of the substitution stated in the dispatch:
**a substituted verifier is a holding action, not a repair of the lane.**

**What is still owed to the owner.** **`miniapp restart minimax-bot`** — the
verifier lane, and with it WI-098's, WI-099's and this item's verifications.
**And whether a substituted verifier stands at all**, which is the second half
of the floor report already queued at 03:45 (`task_08f4f84fa3c5`).

**And one number the owner should have from this shift: the factory's own
ledger is 1,423 lines and 340 KB, and 42 of the 80 item files on `main` still
say `implement` while their dispatch is dead or finished.** WI-020's measures
dispatch (`task_86010eeeb561`) is `done` and the route, the contract entry and
`apps/server/src/__tests__/measures.test.ts` are all on `main`, while WI-020's
file still reads `implement —`. **That is a ledger that lies in the other
direction, and it is a cheap repair** — but it is not this shift's, and the
number space belongs to the session that owns it.

---

## 2026-10-22 06:30 — Chief: the stall resolved itself, three lines corrected, the queue drained, and the restart's price measured again

**What this section is:** three corrections to claims this session published, four
cancellations with their reasons, one dispatch that was stood down, one that was
sent, and the measurement of what the owner's restart buys — now taken from the
runtime's own source, because the answer changed at 06:19.

### 1. Three corrections, and the one that hurts

**Correction one — WI-036's second substitution was not "permanent", and the
ledger said it was.** At `:1524-1528` this session wrote that the brief to Vision
"went to Vision at 04:20:05 and came back at 04:20:33 with a zero-length answer
… because Vision's session is `started` too". **That is false**, and the peer
session's commit `8909bfe` carries the measurement: Vision ran the verification
for 45 minutes and delivered the report at 04:40:33. The refusal was the
transport refusing into a chat that was already turning — **a temporary form.**

**Correction two — the table at `:1594-1599` calls Vision's refusal "permanent"
and Probe's "permanent" on the same grounds. One of the two was.** Vision's
session advanced (04:18:43 → 05:12:31); Probe's has not moved since 03:53:48.

**Correction three — and this one withdraws a claim this ledger made at
`:1601-1607`: "a chat whose session is left `started` refuses everything
indefinitely" is false as a rule, and "a restart buys back Probe's chat and
Vision's chat, because both are `started`" is false with it.** **A restart buys
back one wedged chat — Probe's — plus the floor and the stalled round's slot. It
does NOT buy back Vision's chat: Vision was never dead, and a restart would have
destroyed live work.**

**And the fourth correction, made at 06:19 against this session's own newest
claim, which is the one that matters: "`started` and not advancing does not mean
dead — it can mean slow.** The stalled group round held the floor for 82 minutes
with the chat's last message stuck at `status: streaming` and **zero characters**,
its session frozen with the same turn-system error as Probe's, and this session
called it **wedged** at 05:00, 05:20, 05:27 and again at 06:05. **It was not
wedged: it finished at 06:19:51 and posted 4,950 characters** — the peer session's
factory status report. **So the discriminator this section used at `:1590-1607`
— advancement rather than the status string — is sound for deciding _whether a
chat refuses work_, and unsound for deciding _whether a turn is alive_.** A turn
that writes nothing for eighty minutes is exactly what a slow turn looks like
from outside, and `.factory/watchdog.md` says so in its own words: _"A healthy
long task is indistinguishable from a livelock, from outside."_

**What survives, stated so the next session does not have to re-derive it:**

| Chat   | What is measured                                                                                                                                  | Verdict                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Probe  | 30 delegations refused since 2026-10-20 21:46:39, the last at 04:25:20; **no Probe task created since**; the session has not moved since 03:53:48 | **the lane refuses everything** — and whether its turn is dead or slow is now unknown, because the round had the same signature and finished |
| Vision | the session advanced; WI-036's verification ran 45 minutes on it                                                                                  | alive                                                                                                                                        |
| Wren   | the session advanced to 05:32:50, then took WI-106 at 06:13                                                                                       | alive                                                                                                                                        |
| Cog    | WI-108's turn is **in flight since 05:31:49 with zero characters for 53 minutes**                                                                 | **a live turn, and a restart would cut it off**                                                                                              |

### 2. Four cancellations, each with the reason it was the duplicate

**The dispatcher takes the first queued task whose bot's chat is free, in
creation order** (`task-dispatcher.mjs:463-468`), and a task addressed to a busy
chat stays queued **without consuming a worker** (`task-dispatcher.mjs:465-467`).
So a stale task at the head of the queue does not merely wait — **it takes the
next free slot and spends it on work that is already done.** Measured at 05:40:
five queued tasks, three of them for items accepted hours earlier.

- **`task_8c1dd8c7a349`** (`wi-080-verification-finding-2026-10-22`, created 04:03)
  — **cancelled 05:47.** Wren's report **to Chief**, queued because Chief's chat
  was busy. WI-080 was accepted on that same verification at 04:10. **Its one
  live obligation was a request — "the ledger row for WI-098 is yours, WI-098
  sits outside your reserved WI-090 to WI-097 block" — and that row is written
  below.**
- **`task_37175eba6381`** (`wi-036-record-verification-vision-2026-10-22`, created
  04:39) — **cancelled 05:47.** Vision's WI-036 verification report, addressed to
  Chief. **WI-036 is accepted** (`18d417f`, 05:13) on that report.
- **`task_9d0bc34027c1`** (`wi-036-record-verified-and-one-reading-question-2026-10-22`,
  created 04:55) — **cancelled 05:47.** The summary of the same verification,
  addressed to Chief. **One item, one verification.**
- **`task_040837aa9079`** (`wi-103-contract-pointers-second-2026-10-22`, created
  05:24) — **cancelled 05:39** by this session, and the peer session's row
  records the same cancellation. **It was the second dispatch of one item into
  one chat**, and its title said "eight" for nine.

### 3. WI-103 was dispatched by this session, and stood down by measurement

**This session dispatched WI-103 for the fourth time at 06:00**
(`wi-103-contract-pointers-fourth-2026-10-22` → `task_3936128201cd`, batch
`batch_696580395fc1`, queued at Wren), with the nine pointers re-measured line by
line at `main` = `e18a6f0`. **It was cancelled at 06:15 — 12 minutes later — and
the reason is the peer session's published hold, which this session then
measured instead of believing.**

**What the peer session held, and why (its commit `f473982`, 06:05:34):** the
landing vehicle already re-cites those pointers, so **correcting `main` would
preserve a sentence the landing removes.** **And this session's own measurement
confirms it, and more strongly than the peer put it.** The contract's citations
into `mcp/server.ts` on the vehicle (`origin/wi/101-integration-landing`) are:

```
server.ts:109-110   server.ts:116-122   server.ts:217   server.ts:52-61   server.ts:532-576
```

**and on `main` they are:**

```
server.ts:153   server.ts:368   server.ts:465-481
```

**Not one of them survives the landing.** The vehicle rewrites the whole section
those pointers sit in, so **a correction measured on `main`'s numbering would be
wrong the moment the vehicle lands — nine edits to a contract that is about to be
replaced.** The peer's hold stands, the lead adopts it, and **the dispatch is
cancelled.**

**So WI-103's five ids, all spent:**

| request id                                         | task                | what happened                                                                       |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `wi-103-contract-pointers-after-wi-080-2026-10-22` | `task_b0c1dbb8ab05` | **failed** `BUSY` at 05:18:07, 28 s, zero-length answer                             |
| `wi-103-contract-pointers-second-2026-10-22`       | `task_040837aa9079` | **cancelled** 05:39 — a second dispatch of one item into one chat                   |
| `wi-103-contract-pointers-repair-2026-10-22`       | `task_9583acd61e3f` | **cancelled** 05:52 by the peer session                                             |
| `wi-103-contract-pointers-fourth-2026-10-22`       | `task_3936128201cd` | **cancelled 06:15 by this session** — the vehicle re-cites the pointers             |
| `wi-106-record-four-loose-sentences-2026-10-22`    | `task_fede9dee2ed9` | **not WI-103** — the peer session's dispatch of WI-106 to Wren, running since 06:13 |

**WI-103 is HELD behind the landing vehicle, and that is the peer's ruling as
lead.** Its item file is now on `main` (`f473982` added
`.factory/work/WI-103.md`, 221 lines), so **the specification the item needs is in
the repository** — the defect that made this item "a dispatch the repository
cannot hold" is closed.

### 4. WI-098's ledger row, which Wren asked for, and the five dead ids behind it

**Wren's message to Chief said: "the ledger row for WI-098 is yours — WI-098
sits outside your reserved WI-090 to WI-097 block, so the row is not mine to
write."** It is written here. **The live dispatch rows for this section are in
this section's tables, not in the dispatch table at `:370-492`, which the peer
session is editing.**

| request id                                        | item                                                                  | lane   | task                | note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wi-098-adr-rule-resync-verify-vision-2026-10-22` | WI-098 — the ADR's boundary rule re-synced, verified by a second hand | Vision | `task_9051dea0390b` | **DISPATCHED AT 06:08 — AFTER FIVE DEAD ATTEMPTS.** Batch `batch_4c19afaa431b`, queued at Vision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `wi-108-verified-by-vision-2026-10-22`            | WI-108 — a broken spec is refused, not crashed                        | Vision | `task_cb4460d7e002` | **VERIFIED BY VISION, AND IT WAITS ON THE VEHICLE'S LANDING.** Vision's report, measured at `a65ff32`: **all four criteria met** — the four providers refuse a broken spec in exactly the shape the task provider has always used (`validation_failed`, 422, the message "This `<kind>` does not satisfy the `<type>` contract.", and the schema's own issue list as `details`), the task and memory providers keep their own inline refusals byte for byte, **the contract is untouched** (`CONTRACTS.md` is byte-identical between the branch's base and its head, blob `39eff42c`, and is not in the diff at all), and the tests assert the code, the exact message and the exact details — four cases assert `validation_failed`, the exact message, that `details` is an array, and that `details[0].path` is the precise path. **One disclosed change outside the four kinds:** a task or memory template whose spec breaks its contract now carries `details.issues` as a list of issues where it used to carry the error's message string. **The four kinds the item names change, and nothing else.** **The work is NOT on `main`: the branch it stands on carries the landing vehicle, and merging it conflicts in exactly the two files both Chief sessions write — `.factory/INTAKE.md` and `.factory/work/WI-106.md` — so the landing is the other session's to make and the lead's conflict rule is recorded: `WI-106.md` resolves in favour of `main`, and `INTAKE.md` keeps both sides' rows.** |
| `wi-106-record-four-loose-sentences-2026-10-22`   | WI-106 — four sentences in the licence record, corrected              | Wren   | `task_fede9dee2ed9` | **DISPATCHED BY THE PEER SESSION AT 06:13**, running. It never touches `CONTRACTS.md`, so the one-file rule never held it back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `wi-103-contract-pointers-fourth-2026-10-22`      | WI-103 — the published contract's nine wrong pointers, corrected      | Wren   | `task_3936128201cd` | **CANCELLED 06:15 BY THIS SESSION** — see §3. The id is spent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**WI-098's five earlier ids are all spent and all are dead:**
`wi-098-adr-rule-resync-2026-10-22` → `task_5568293c3a21` failed; `-r2` →
`task_32bfeb7e30e6` cancelled; `-r3` → `task_3d06659e7583` failed; `-r4` →
`task_fff9833390f9` failed; `-r5` → `task_62b5fed93d3b` failed — **all five to
Probe, no report ever.** The work is Wren's branch `wi/098-adr-rule-resync`
(`3b5d427`, four commits: the ADR's re-sync, the item file, a tightened fifth
criterion, and the connect claim measured). **The tiebreak is in the brief: Wren
wrote the work; Vision wrote `prototypes/DIRECTION.md`, which is the _reference_
this item syncs to, not the work verified — so a substituted verifier stands.**

### 5. WI-010 is landed, accepted and pushed — and the lead measured the gates itself

**The peer session landed and accepted WI-010 while this session was measuring the
same tree.** Merge `e18a6f0` ("Merge WI-010's lane-count commit label"), commit
`2d7f33d` ("Name the commit the lane count was measured at"), one file, one line:
`prototypes/DIRECTION.md:293-294`, "at the pinned commit" → "at `3479c31`". The
item file carries the acceptance, and it is the peer's acceptance as lead.

**This session measured the gates on that tree independently: typecheck exit 0,
format:check exit 0, build exit 0, test exit 0 — 49 files, 458 tests, 0 failures
— and the counts agree with the acceptance's.** The acceptance is on the merged
tree and the gates are on the merged tree, so the evidence covers the file it
accepted. **The peer session pushed it at 06:05:34 (`f473982`, CI `success`,
CodeQL `success`), and `origin/main` = `main` at that commit.**

### 6. The stalled group round: 82 minutes, and it was slow, not dead

`task_060987119527`, request id `chief-watchdog-2026-10-22-0401`, chat
`group:grp_cc2adeea48f4`, session `mvs_da4fd6a55d284724835efedd6434bfcc`. **It is
this session's own floor post** — the 04:01 watchdog line, whose relay landed at
04:39:02. Its continuation turn started streaming at **04:57:37** and **produced
no characters for 82 minutes**; the message sat at `status: streaming`, `text:
""`, `parts: []`, and the session carried the same turn-system error as Probe's
wedged chat and did not move.

**It was not cancelled, and the rule is why nothing was lost.** The watchdog's
precondition is three conditions — over 45 minutes, **the session is not
`started`**, and the chat's last message from that bot is `streaming`. **The
session read `started`, so condition two failed, and the check reports and does
not cancel.** This session called the round "wedged" four times and did not act
on that reading; **the rule was right and the reading was wrong.**

**It finished at 06:19:51 and posted 4,950 characters** — the peer session's
factory status report, which carries WI-010's acceptance, WI-103's hold, WI-106's
dispatch and the owner's decision queue. **So the floor is open again at 06:19,
and the stall that held one of two slots for 82 minutes has cost the factory
nothing but silence.**

### 7. What the restart actually buys — measured in the runtime's source

**The lever is `miniapp restart minimax-bot`, and it is the owner's. What it buys
is measured rather than claimed, and it is not "every `started` chat":**

| What it clears                      | How, in the runtime's own code                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **the group's mid-discussion lock** | `engine.mjs:205-206` — `isBusy()` returns true while `this.groupLoops` holds the chat, and `groupLoops` is an **in-memory** `Map` (`engine.mjs:153`), so a new runtime starts with it empty and **the floor is open** — it is open now, because the round finished |
| **a slot held by a stale task**     | `task-dispatcher.mjs:17` — `this.runs = new Map()` is **in-memory**; the slot count is `this.runs.size` (`task-dispatcher.mjs:463`), so a restart frees slots that the task records still claim                                                                    |
| **the wedged turns**                | `engine.mjs:149` — `this.running` is in-memory too, and `engine.mjs:1551` names the case: "Cut off without an error: the Mini App restarted"                                                                                                                       |

**What it costs, measured at 06:25: Cog's WI-108 turn is in flight** — the chat's
last message from Cog is `streaming` with zero characters since **05:31:49**, the
task `task_6fe3e4d8fcca` is still `running` at 53 minutes, and Cog's session has
not advanced since 05:31:40. **That is the same shape as the round that took 82
minutes to produce its report, so it may well be a slow turn with a real answer
coming.** **A restart now would cut it off**, and the floor post at 06:19 — which
says Cog's live turn "finished at 05:31" — is wrong on that point, because the
turn that started at 05:31:49 has not finished.

**So the order remains: the ceiling patch, then the restart.**
`scripts/raise-factory-concurrency.mjs` is tracked on `main` (`7006148`), and every
copy of the dispatcher on disk reads `MAX_RUNNING = 2` again because a
content-addressed plugin-cache refresh erased the applied state.

### 8. What the owner is asked to decide, and the lead's recommendation on each

**The peer session put seven questions on the floor at 06:19, and they are the
owner's queue.** This session's two are the same two and are not repeated on the
floor; the lead's position on each:

1. **The restart, and when.** **Recommendation: after Cog's WI-108 turn lands, and
   not before** — a restart cuts a live turn off, and the floor post's premise
   that no turn is running is wrong. **It buys the floor (already open), a slot,
   and Probe's chat.** **The ceiling patch first**, so the restart does not leave
   the factory at two turns.
2. **Whether a substituted verifier stands.** **The answer is two answers, and the
   peer's ruling is adopted: a substituted verifier stands only where the
   substituted verifier did not write the work.** WI-098 is that case — Wren wrote
   the work, Vision wrote the direction record but not the re-sync. **WI-031's
   contract half is not:** Wren wrote that half and verified it, so it is HELD for
   an independent check. **WI-010 was accepted by the lead on its own measurement
   of Cog's fix, and the lead wrote none of it** — which is the same rule applied
   to the lead's own acceptance.

**c63d270 — VERDICT: GREEN.** CodeQL completed/success (Analyze javascript-typescript) and CI completed/success on all four jobs (Dependency audit, Lint the workflows, Build and test, Build and run the stack), read afterwards and from outside this machine. The gates measured on that tree before the push: typecheck exit 0, format:check exit 0, build exit 0, test exit 0 — 49 files, 458 tests, 0 failures. **This record is committed on main and deliberately left unpushed, so the verdict it carries belongs to the tree that is actually published (c63d270); the next push carries it, and its own verdict is read the same way.** — Chief, 2026-10-22 06:50

---

## 2026-10-22 07:15 — Chief: no restart has happened, WI-098 is verified and one edit short, and a second lane is refusing

**Four facts, each measured, and two of them correct something this session said
minutes ago.**

**One — no restart has happened, and a report says one did.** The Mini App's own
runtime diagnostics say otherwise: `runtime.start_requested` and `runtime.ready`
both at **2026-10-21 23:37:39**, one run id, `current: true`, `truncated: false`.
**The runtime has been up continuously since 23:37 yesterday, so nothing has been
restarted since, and the restart is still the owner's to give.** Vision's WI-098
report states that two queued bot-to-bot messages "were both closed as cancelled
at 05:50 **by the restart**" and that "a bot-to-bot message queued behind a turn
did not survive the restart". **That inference is void: no restart occurred.**
Those two messages, and a third, were cancelled **by this session, deliberately**,
at **05:50:20, 05:50:21 and 05:50:22** — a stale queued delivery spending a slot
on work already accepted, and the reasons are in `:1590-1615` and in this
section's §2. **This section's §2 also says "cancelled 05:47", and the measured
time is 05:50:20 — the correction is here rather than overwritten.** The
operational point in that report still stands and is worth keeping: **anything
that must not be lost belongs in the group floor or in the repository, not only
in a bot-to-bot message.** Vision is also right that it was never dead — the
substitution of Cog for WI-010's one-phrase fix was unnecessary, and the fix
landed anyway.

**Two — WI-098 is verified, and one edit is owed.** Vision's report (delivered
06:30:06, `task_d446cc3898d3`) measures the branch's own merged head
`5b9661d` (06:21, unpushed; the remote tip is `3b5d427`): **C3, C4, C5 and C6
MET** — both crossings named with the reason given once, "one declared
exception" at 0 hits, the format and test gates exit 0, and the diff exactly two
files. **C1 is half met:** the quote at `:157-161` is the same 312 characters as
the rule publishes and the two normalised strings are equal, but the ADR re-wraps
it to its own measure, so the two slices break at different words — and **the
cited range is stale: the rule stood at `:51-55` at `d3ef0d2` and at the fork
point `a236a63`, and `95e5165` added two lines above it, so on current `main`
and on the branch's own head the rule stands at `:53-57`.** **C2 is half met:**
the note names both repairs and not the line. **So the item is one edit from
acceptance: `:51-55` → `:53-57` at `:164`, and pin the commit it was measured
at**, because a bare line number is the pre-`95e5165` style and will drift
again. The item file's own record carries three stale sentences, reported and
not edited.

**That edit is not dispatched, and the reason is the rule that has cost this
factory five ids.** The ADR and the item file are **Wren's** (`*.md` and
`docs/**` are hers in `FACTORY.md`'s ownership table), and **Wren's lane is
refusing**: WI-106's turn ran eighteen minutes and came back with a zero-length
answer at 06:31, and the WI-111 brief was refused instantly at 06:32, while her
session keeps advancing (06:37:57). **A dispatch into a refusing lane spends the
id for nothing** — WI-098's verification alone burned five (`-r1` … `-r5`, all to
Probe) — **so the correction waits for Wren's lane, and the lead does not spend
the sixth id on it.** WI-098 is **verified, one edit short, not accepted.**

**Three — WI-108 is landed and its verification is running.** Cog finished
WI-108 at 06:30:59 after **59 minutes**: branch
`wi/108-validation-error-for-a-broken-spec`, commit `a65ff32`, pushed to origin,
built on the landing vehicle at `2e4981e`, `CONTRACTS.md` untouched, and the
change is one helper plus the four providers' validation wrapping. **Its
verification is running** (`wi-108-verification-report-vision-2026-10-22`,
`task_cb4460d7e002`, Vision, started 06:40:01) — **Cog wrote the work, so Cog
cannot verify it, and Vision did not write it.**

**Four — the lane state at 07:10, which is what the owner's restart buys
against.**

| Lane   | Measured state                                                                                                                                        | Can it take work? |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Cog    | WI-108 delivered; the chat's last message is `done` at 06:30:59                                                                                       | **yes**           |
| Vision | WI-098's verification delivered at 06:30:06; WI-108's verification running since 06:40:01                                                             | **yes, busy**     |
| Wren   | session advancing (06:37:57) but two delegations refused — an 18-minute turn returned a zero-length answer at 06:31, and WI-111 was refused instantly | **no — refusing** |
| Probe  | 30 delegations refused since 2026-10-20 21:46:39, the last at 04:25:20; no Probe task created since; the session has not moved since 03:53:48         | **no — refusing** |

**So two of the four lanes are refusing, and one of them is refusing _while its
session advances_** — which is the measurement that separates Wren from Probe:
**Wren's lane is busy-refusing, Probe's is the one with no advancement at all.**
And **WI-111 is being worked right now outside the dispatcher's two slots** — a
worker session in `G:\code\personal-os-worktrees\111-strategy-rule-fifth-copy`,
its test run started 06:40 — **so the factory is not idle while one slot sits
free.**

**And the restart's cost is lower than this ledger has been saying, and its
benefit is untested.** Cog's WI-108 turn **spanned 05:50** — the window Vision
attributes to a restart — and finished at 06:30:59 with its full report, so **the
runtime's in-memory maps are not what this session's §7 assumed**: a restart
would not necessarily cut a live turn. **What a restart certainly does is clear
the in-memory `groupLoops` and `runs` (`engine.mjs:153`, `task-dispatcher.mjs:17`),
and release Probe's chat from a refusal that has run for 54 hours.** **Nobody has
dispatched to Probe since 04:25:20, so the release is untested** — and that is the
one thing the owner can test cheaply, by ordering the restart and watching
whether a delegation into Probe's chat is accepted.

## 2026-10-22 07:26 — Chief: WI-108 is on `main`, the ceiling is vendor code, and the owner's three decisions, answered with what was measured

**WI-108 is landed, and this ledger's own note about it was wrong.** `9c6444a`
(07:15:46) "Merge WI-108: a broken spec is refused, not crashed". **My `bf28f0a`
(06:56:42) recorded WI-108 as "verified and waiting on the vehicle" — it was not
waiting; the vehicle carried it at 07:15:46, and Vision's verification landed
after the code, not before it.** The four files that carry the fix are
**byte-identical between `main` and the branch tip `a65ff32`**: `service.ts`
`e519b554…`, `templates.ts` `9bcce9cd…`, `resources.test.ts` `032debf4…`,
`resource-templates.test.ts` `a1515f91…`. So Vision's verification (delivered
07:05, `task_cb4460d7e002`) measured code that is **already published**, and its
six checks, the before/after error shape (`internal_error`/500 →
`validation_failed`/422, with the task provider's exact message and the schema's
issue list) and its mutation proof (6 red of 36, then green) all hold on the
published tree. **Its two findings are not fixed by landing:** the item's three
citations into `CONTRACTS.md` point 52, 39 and 159 lines out, and **the refusal
message is published nowhere in the contract.**

**WI-098 is landed, and its pointer is true on the published tree.** `3fab75a`
(06:52:23) merged `wi/098-adr-rule-resync` (`53802d0`) into this session's line;
the peer's `9a88ebe` (07:08:43) carried that line into the published one.
Re-measured on `main`: the rule stands at `prototypes/DIRECTION.md` `:53-57`, and
the ADR's provenance note reads `:53-57` as read at `95e5165` — **the pointer is
true on the tree that publishes it, not only on the branch it was written on.**
The record correction owed is **four stale sentences in
`.factory/work/WI-098.md`** — "character for character", "Probe's pin", "402
lines", "366 lines" — and that is **Wren's file, in a lane that refuses.**

**The peer's merge resolved the ledger conflict with nothing lost.** `9a88ebe`
merged `87c7b16` into this session's tree. Measured on the merged file: **all 19
of this session's section headers and all 19 of the peer's are present**, 30
dispatch rows with none lost, no conflict markers; the two `WI-112.md` sides were
the same blob (`034610c2`) before the merge, and the ADR auto-merged with **this**
session's corrected version — the peer's tree still carried the one-declaration
quote.

**The ceiling is vendor code, and the recommendation on it changes.** The
two-slot limit is one line — `const MAX_RUNNING = 2;` in `task-dispatcher.mjs` —
and that file is **official plugin code in a content-addressed cache**
(`C:\Users\Aaron\.minimax\v2\plugin-cache\official\`). Measured: **seven version
directories sit there, six of them written at 2026-10-21 07:06**, and **exactly
one copy of `task-dispatcher.mjs` exists on disk**. A patch there works until the
next official plugin update and then **vanishes silently, taking the capacity
decision with it.** Vision raised this and it is right, and I checked it rather
than take it. **So: no — do not patch the vendor cache.** The factory is not
short of slots; it is short of **healthy lanes**.

**The lanes, measured at 07:2x.** Cog **free** (last turn `done` 05:31), Vision
**free** (report delivered 07:05), **Probe refusing** (last delegation 04:25:20 —
176 minutes ago, `status=error`), **Wren refusing** (last delegation 06:30 —
49 minutes ago, `status=error`). **77 of the 109 item files on `main` are not
yet accepted.** The factory is idle because two lanes refuse, not because it is
busy.

**No restart has happened.** `runtime.start_requested` and `runtime.ready` are
both at **2026-10-21 23:37:39**, one run id `5bc9c2db`, `current: true`. The four
cancellations at 05:50 were **this session's own queue-clearing, not the
restart** — Vision corrected that cause, and this ledger's own record of them
(`c63d270`) already names them as this session's.

**The owner's three decisions, answered with what was measured.**

1. **The restart, and when — recommend yes, and the cheapest moment is now.**
   Nothing is in flight but a report relay whose content has already been read. A
   restart buys back **both** refusing lanes, and that is the only thing that
   unblocks WI-103, WI-104, WI-106, WI-098's record correction and every
   Probe-verified item on the board. **Its price: it cuts this session's own
   turn** (the runtime logs "Cut off without an error: the Mini App restarted")
   and any turn in flight at that moment — so order it at the end of a cycle,
   with nothing started.
2. **The ceiling patch — recommend no, and the reason changed.** Not because the
   ceiling is right, but because the mechanism does not survive an update (above).
   The durable line is **the ceiling stays at two** until the lanes are repaired;
   a capacity decision that a vendor update can silently erase is not a decision.
3. **A substituted verifier — settled: yes** where the substitute did not write
   the work (WI-098, WI-010), **no** for WI-031's contract half, which stays
   **HELD**.

**Two dispatches, and the number space.** `wi-086-land-and-wi-112-verify-2026-10-22`
(batch `batch_5f496c9fb4f6`): **Cog** `task_80405e5083e5` — WI-086, the
approval-evidence read, re-applied onto today's tree with every citation
re-pointed (its branch is a day old and `CONTRACTS.md` has been republished three
times since); **Vision** `task_40d13d90f6d5` — WI-112, verified read-only as a
**substituted** verifier, with the pin the item says is Probe's file left owed.
**WI-113 is taken** — the contract publishes the refusal, and the tests read the
message out of the contract instead of repeating it — and it is **held, not
dispatched**, because `CONTRACTS.md` is WI-086's live file until Cog's dispatch
lands.

## 2026-10-22 07:39 — Chief: the WI-108 landing was backed out, the pointers that broke it are measured to the line, and the repair is dispatched

**Correction to the section above: WI-108 is NOT on `main`.** The peer session
reset `main` back to **`9a88ebe`** — the green, published tree — and with it went
the WI-108 landing (`9c6444a`) and this session's ledger commit (`fc2e39b`).
That commit's text survived as an uncommitted working-tree change and is
committed again below. **The reason the landing came out is measured, and it is
not a defect in WI-108's fix: eight pointers still named the lines the files had
before the fix.**

**The published tree is GREEN; the local tree was RED.** The platform's verdict
on `9a88ebe`, read from outside the machine: CodeQL `completed/success`, CI
`completed/success` on every job — "Build and test", "Dependency audit", "The
published contract matches the tree", "The contract's pointers point at code",
"Lint the workflows", "Build and run the stack" — **VERDICT: GREEN**. The tree
with WI-108's landing on it was **not** green: `npm run test` at `fc2e39b`
exited **1**, with **2 test files failed, 2 tests failed, 415 passed of 417** —
`audit-outcome-vocabulary.test.ts` ("`service.ts:594` no longer carries the
enqueue of an automation run") and `contractPointers.test.ts` (the gate, with
**five** contract pointers naming a line that holds no code). **Both failures
are pointers, and both are the shift WI-108's change causes.** The gate did its
job: it caught the landing on the tree the landing was made for.

**The shifts, measured from the diff between `9a88ebe` and the landing.**
`service.ts`: **+2** lines from ~250 (the automation provider's parse became
`parseSpec(...)`) and **+40** from ~704 (the `kindNames` map and `parseSpec`), so
above 250 unchanged, 250-704 **+2**, below 704 **+42**. `templates.ts`:
**+12** from ~465 (the `templateIssues` change).

**The nine pointers, each with its measured target on the tree that has WI-108
applied.**

| #   | where                                                        | cited                | must become          | the code it names                                                                                                                              |
| --- | ------------------------------------------------------------ | -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `CONTRACTS.md:749`                                           | `service.ts:645-650` | `service.ts:647-652` | the `try { providerFor(...).validate(...) }` that refuses a template whose spec the owning provider rejects                                    |
| 2   | `CONTRACTS.md:751`                                           | `service.ts:660-662` | `service.ts:662-664` | the `if (template.type !== type) { throw errors.validation(...) }`                                                                             |
| 3   | `CONTRACTS.md:758`                                           | `templates.ts:522`   | `templates.ts:534`   | `export function mergeTemplateSpec(`                                                                                                           |
| 4   | `CONTRACTS.md:759`                                           | `templates.ts:497`   | `templates.ts:509`   | `const mergeRules: Record<ResourceType, MergeRules> = {`                                                                                       |
| 5   | `CONTRACTS.md:803`                                           | `templates.ts:497`   | `templates.ts:509`   | the merge rules themselves                                                                                                                     |
| 6   | `CONTRACTS.md:822`                                           | `service.ts:459`     | `service.ts:461`     | `assertTemplatesValid(templates, ...)` — every template judged by the provider that owns its kind                                              |
| 7   | `CONTRACTS.md:1230`                                          | `service.ts:594`     | `service.ts:596`     | `queue.enqueue({`                                                                                                                              |
| 8   | `CONTRACTS.md:1231`                                          | `service.ts:599`     | `service.ts:601`     | `return { output: { queued: true, ... } };` — **and the old citation pointed at the `payload:` line, so this one was stale before WI-108 too** |
| 9   | `apps/server/src/__tests__/audit-outcome-vocabulary.test.ts` | `at: [594, 599]`     | `at: [596, 601]`     | the claim names the enqueue where it now stands                                                                                                |

**The repair is dispatched, to the lane that wrote the fix.**
`wi-108-reland-with-citations-repointed-cog-2026-10-22`, batch
`batch_3eb8edf3d380`, task **`task_b8b449d29d74`** → **Cog**: re-apply
`a65ff32` onto today's `main`, re-point the nine pointers, make the pointer gate
exit 0, gate everything, land and report. **WI-108's verified behaviour is not
published**, so the product still answers a broken spec with a server fault —
that is what this repair buys back.

**One dispatch cancelled, with the reason.** `task_80405e5083e5` (WI-086, the
approval-evidence read, to Cog) was **cancelled at @@TIME@@ before it started**:
it was queued, and **one file, one live item** — both WI-086 and this repair
need `CONTRACTS.md`, and the repair is the critical path, so WI-086 is **held**,
not lost. It needs a NEW request id and a NEW title when it is re-dispatched.
Vision's WI-112 verification (`task_40d13d90f6d5`) is **still queued and still
good** — it is read-only, and it does not touch `CONTRACTS.md`.

**The lanes, measured at @@TIME@@.** Cog **free** (the repair is queued), Vision
**busy** on the peer's WI-106 verification (`task_64ef89071335`, running), **the
peer's WI-106 implementation queued at Wren** (`task_44c894c402ef`) — so Wren's
lane gets another test, and this session does not spend an id there.
`task_cb4460d7e002` (Vision's WI-108 verification) is **57 minutes old and
`waiting_for_tasks`**: over the 45-minute trigger, **and protected** — a task in
`waiting_for_tasks` is never cancelled, and its report has already been read.

**And the tree this session pushed nothing to.** `origin/main` is `9a88ebe` and
is green; this session's commits from `3a0b8fd` onward are already inside it
(they are ancestors of `9a88ebe`). What is **not** published is WI-108's
behaviour and this session's two ledger sections, and both are on their way:
the ledger below, and the repair above.

## 2026-10-22 07:58 — Chief: the push is done, the merge was measured, WI-108 is accepted, and two items are opened and held

**The push that was blocked for an hour is done.** `origin/main` is `9a88ebe` and
this session's eleven commits are inside it. The peer session's vehicle landed while
this session's commits were unpushed, so the push was rejected as non-fast-forward;
this session merged `origin/main` into its own tree as `9a88ebe`, resolved the two
conflicts, measured the merged tree and pushed it.

**The two conflicts, both in Chief-owned files, both resolved by measurement.**
`.factory/work/WI-112.md` (add/add) resolved to `origin/main`'s copy — it is the later
one, it records the 06:50 settlement and the completed implementation, where this
session's copy still read "implement" and carried literal quote-mangling text from a
failed backtick substitution. **`.factory/INTAKE.md` keeps both sides' rows**, the base
row drops because this session's corrected row supersedes it, and this session's WI-112
row now discloses that **the item is recorded twice, one row per session, under one
spent request id.**

**The gates on the merged tree, measured:** typecheck 0 · format:check 0 · build 0 ·
test 0 — **49 files, 602 tests, 0 failures** at `9a88ebe`, and the pushed tree is
fast-forward.

### WI-108 is accepted, and its landing is held behind one correction

**Vision's verification says the work is sound** — "the item's work is sound and I
would accept it" — all six checks met, the error shape measured before and after, the
mutation proof judged independently at **6 red of 36**, every gate green at `a65ff32`.
The acceptance is recorded in `.factory/work/WI-108.md`, and **what the product can now
do** is written there: **a dashboard, document, data source or automation whose spec
breaks its contract is refused, not crashed** — `validation_failed` and HTTP 422, in the
published error envelope, carrying the schema's own issues as `details`, the same
refusal in the same shape that a task or a memory has always given.

**But the merge turns two gates red, and the lead measured it instead of shipping a red
line.** On the tree that carries the merge (`fc2e39b`): `contractPointers.test.ts` **5
failures**, `audit-outcome-vocabulary.test.ts` **1 failure**, `npm run test` **2 failed
| 415 passed (417)**. **The cause is WI-108's own line shift** — the helper moves
everything below it, `service.ts` 756 → 798 lines and `templates.ts` 630 → 642 — and
**eleven of `CONTRACTS.md`'s citations into those two files now point at the wrong
lines.** The code is correct; the contract is stale, and the contract is Wren's.

**The order the lead sets, said out loud: WI-086 lands (it is live on `CONTRACTS.md`
right now — Cog, `task_80405e5083e5`), then WI-108's merge, then ONE correction pass,
WI-114.** **One pass, not two** — the factory has now spent four items re-pointing
citations by hand and this lead will not let it do it twice for one change. **WI-108's
merge is on `wi/108-landing` (`fc2e39b`), and `main` stays green and published until
the correction can land with it.**

### Two items opened by this measurement, both held

- **WI-114 — the eleven pointers that WI-108's landing moved, and the two in the
  template guide.** Thirteen corrections, measured one by one against the tree that
  carries the merge, and **the six that did not move are named so they are not
  "fixed"**. Owner Wren, because `CONTRACTS.md` and `docs/**` are hers. **Held, not
  dispatched** — `CONTRACTS.md` is WI-086's live file.
- **WI-115 — the template guide describes an authorship defect that WI-020 fixed, and
  cites three lines that never carried it.** `docs/resource-templates.md:66-70` says
  automations and tasks "report `createdBy: 'system'` regardless of who created them",
  citing `service.ts:203,293,448` — which read `},`, `action: AutomationAction;` and a
  comment about the registry. **The author is now read from the record**
  (`createdBy: row.createdBy,` at `:234`; `factory.taskAuthor(id) ??
RESOURCE_AUTHOR_SYSTEM` at `:345`). Held behind WI-114.

**The number space, read immediately before it was taken.** `main` runs to **WI-112**;
the peer session took **WI-113** at 07:27 for "the contract publishes the refusal, and
the tests read the message out of the contract instead of repeating it", and that claim
is **earlier** and **not bound to a live dispatch**, so by the tiebreak both sessions
published — _a claim bound to a live dispatch keeps its number; where no dispatch binds
it, the earlier published claim keeps it_ — **WI-113 is the peer's**, and this session
took WI-114 and WI-115.

### The peer's finding about WI-098's record is stale, and this session says so with the lines

The peer recorded at 07:27 that WI-098's record is "four stale sentences in
`.factory/work/WI-098.md` — 'character for character', 'Probe's pin', '402 lines' and
'366 lines' — and that is **Wren's file, in a lane that refuses**." **Three of the four
are already corrected in context, and the fourth is a sentence the item file itself
certifies as true. The file is Chief's, not Wren's.**

- **"character for character"** — at `:61` it is the **rewritten criterion**, which now
  says the quote carries the rule's _prose_, character for character, "once the
  blockquote markers, the `**The rule.**` label and the italic underscores are
  stripped", and then says "**the raw ranges are not byte-identical** (322 against 328)
  **and this criterion does not claim they are**". The second occurrence, at `:112`, is
  a line in "What was measured" — a record of the measurement as taken on the branch's
  base, and **the item file itself says at `:187` that "the item file's `:103-104` claim
  is TRUE"**.
- **"Probe's pin"** — at `:83-85` and `:104-107` it says the pin is Probe's and that
  **WI-094 is Probe's re-point of it**. That is correct, and it is the answer.
- **"402 lines"** — at `:91` and `:194` the sentence reads "the file is **401** lines by
  newline count (`wc -l`), **402** by the count that includes the trailing empty element,
  and 403 lines on today's `main`", with the convention written down. That is the
  correction.
- **"366 lines"** — at `:89`, `:193` and `:234` it is **WI-025.md's** stale figure being
  _reported, not edited_, and the sentence beside it says the staleness is **35, not
  36**.

**The acceptance of WI-098 stands, and it was published at `9a88ebe`.**

### The lanes, measured — and the refusals are the host's, not the lanes'

Wren's last two delegations were refused with **`"Too many Bots are running at once.
Try again shortly"`, `errorCode: BUSY`, `retried: 2`** — **that is host capacity, not
an occupied chat.** The peer's "Wren's lane is refusing" is a conclusion about Wren
that the error message does not support: the same refusal would hit any lane. **Probe's
refusals are the same kind.** Cog takes work; Vision takes work; **the floor is short
of slots and healthy lanes, and the two-lane ceiling is the mechanism.**

**The restart is still the owner's.** The lead's position, measured: the runtime has
been up since 2026-10-21 23:37:39, **no restart has happened**, and a restart is the
only untested lever for Probe's chat — nobody has dispatched into it since 04:25:20.
**Its price is that it cuts the turn it lands in**, so it goes at the end of a cycle
with nothing started. **And the ceiling stays at two**: it is vendor code in a
content-addressed cache, and a patch there vanishes silently on the next plugin update.

### A CORRECTION TO THE SECTION ABOVE, dated, by the lead

**The section above says WI-108's merge is on `wi/108-landing` and not on `main`, and
that `main` stays green until the correction can land with it. That was true when the
lead measured it and it is now false, and the correction stands beside it.**

**The peer session published WI-108's landing at 07:30** (`4e64f3d`), on its own branch
and its own path, **and that landing re-pointed nine of the eleven citations WI-108
moved.** The lead's red measurement was taken on its own merge commit `fc2e39b`, which
did not carry the peer's re-pointing; **the tree that publishes the item is green.**
The lead's merge at 07:47 (`dc5cefd`) brought the published line and the lead's records
together, and **the gates on that tree are: typecheck 0 · format:check 0 · build 0 ·
test 0 — 61 files, 615 tests, 0 failures**, with the pointer gate at **122 pointers, 0
failures**. The lead's own back-out at 07:37 was against a tree the peer had already
published ten minutes earlier, **so it undid nothing that was public**, and it is
recorded here rather than quietly dropped.

**WI-114 therefore shrinks from thirteen corrections to four**, and the four are named
in that item's file: **`CONTRACTS.md:806`** (`service.ts:374-375` → `:376-377`) and
**`:1946`** (`service.ts:338` → `:340`), plus **`docs/resource-templates.md:32`**
(`service.ts:581-591` → `:583-593`) and **`:355`** (`templates.ts:522-543` →
`:534-555`). **Two of the four are the ones no gate can see** — they point at code,
and the code is not the claim. **Both items stay held: `CONTRACTS.md` is WI-086's live
file until Cog's dispatch lands.**

**And the lesson, dated: a red measurement is true of the tree it was measured on, and
this factory's trees move under you.** Measure the tree that publishes the work.

## 2026-10-22 07:55 — Chief: an independent measurement that agrees with the peer's re-pointing, one number conceded, and the rule that would have prevented this turn's wrong claim

**This session measured the pointers WI-108's landing moved, independently, and the
targets agree with the peer's re-pointing.** The nine, each computed from the shift
rather than read off the code — `service.ts` **+2** from ~250 and **+40** from ~704,
`templates.ts` **+12** from ~465 — and each checked against the code it names:

| where it was cited                                  | where the code is      | the code                                                                                                                                                                            |
| --------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTRACTS.md:749` `service.ts:645-650`             | `service.ts:647-652`   | the `try { providerFor(...).validate(...) }` that refuses a template whose spec the owning provider rejects                                                                         |
| `CONTRACTS.md:751` `service.ts:660-662`             | `service.ts:662-664`   | the `if (template.type !== type) { throw errors.validation(...) }`                                                                                                                  |
| `CONTRACTS.md:758` `templates.ts:522`               | **`templates.ts:534`** | `export function mergeTemplateSpec(` — **identical to the peer's**                                                                                                                  |
| `CONTRACTS.md:759` and `:803` `templates.ts:497`    | `templates.ts:509-522` | `const mergeRules: Record<ResourceType, MergeRules> = {`                                                                                                                            |
| `CONTRACTS.md:822` `service.ts:459`                 | `service.ts:461-463`   | `assertTemplatesValid(templates, ...)`                                                                                                                                              |
| `CONTRACTS.md:1230` `service.ts:594`                | **`service.ts:596`**   | `queue.enqueue({` — **identical to the peer's**                                                                                                                                     |
| `CONTRACTS.md:1231` `service.ts:599`                | **`service.ts:601`**   | `return { output: { queued: true, ... } };` — **identical to the peer's**, and the old citation pointed at the `payload:` line, so **that one was stale before WI-108 ever landed** |
| `audit-outcome-vocabulary.test.ts` `at: [594, 599]` | `at: [596, 601]`       | the claim that names the enqueue                                                                                                                                                    |

**Two sessions, one tree, the same lines.** The peer's landing re-pointed them, the
platform's verdict on `4e64f3d` is **GREEN** with "The contract's pointers point at
code" among the jobs, and the peer's own correction above records the published tree
as green: **typecheck 0 · format:check 0 · build 0 · test 0 — 61 files, 615 tests, 0
failures**, pointer gate **122 pointers, 0 failures**. **The nine above are therefore
already corrected; what remains is the peer's WI-114 (four pointers) and WI-115 (the
template guide), and both are HELD behind WI-086, which is `CONTRACTS.md`'s live file.**

**One number conceded, and this is the record that lost it.** The 07:26 section of
this ledger says **"WI-113 is taken"** — the contract publishes the refusal, and the
tests read the message out of the contract instead of repeating it. **The peer
session took WI-113 at 07:27 for the same work; its claim was published first, and
neither claim was bound to a live dispatch. By the tiebreak both sessions published —
the one published first keeps the number — WI-113 is the peer's, and this record is
the one that lost it.** If this session's contract-publication item is ever opened, it
takes **WI-116**. WI-113 is **held**, because `CONTRACTS.md` is WI-086's live file.

**The rule that would have prevented this turn's wrong claim, stated because it is
cheap.** The 07:39 section of this ledger said "WI-108 is NOT on `main`", and it was
wrong. **The cause is not a bad measurement: it was a stale one.** The claim was made
against the local tracking ref `origin/main`, which was **thirteen minutes and one push
behind the remote** — the peer had published `4e64f3d` at 07:30:45, and the local ref
learned of it only when this session's push was rejected at 07:43. **The durable
anchor for "what is published" is the remote tip, read with `git ls-remote origin
refs/heads/main`, not the local tracking ref** — and `ls-remote` was available here and
was not read before the claim was written. **Measure the remote before you publish a
claim about the remote.** The peer records a neighbouring lesson in the section above —
"a red measurement is true of the tree it was measured on" — and this is its twin: **a
green-looking local ref is true of the local ref.**

**One attribution differs, and the difference is only blame.** The 07:39 section says
"the peer session reset `main` back to `9a88ebe`"; the peer's section above calls the
same event "the lead's own back-out at 07:37". **The measurement both agree on: the
local `main` ref moved from `fc2e39b` back to `9a88ebe` between 07:27 and 07:39, the
ledger's 89-line section survived it as an uncommitted working-tree change, and a
conflicted `WI-108.md` was left behind in the working tree with conflict markers in
it.** That is a `reset --mixed` in a tree two sessions share, and it is the one
mechanism in this factory that can move another session's branch under it. **A wrong
claim stays standing with a dated correction beside it: both attributions stay, and the
mechanism is the thing to fix.**

**The dispatches, with their durable ids.** **`task_b8b449d29d74`** (Cog — WI-108
re-landed with the pointers re-pointed, request `wi-108-reland-with-citations-repointed-cog-2026-10-22`,
batch `batch_3eb8edf3d380`) was **cancelled before it started: the peer had already
landed it correctly.** WI-086 — the approval-evidence read, **live on `CONTRACTS.md`**
— was **re-dispatched** with a **NEW request id and a NEW title**
(`wi-086-land-and-repoint-cog-2026-10-22-r2`, batch `batch_05f2a3ebbde7`, task
`task_9f6a55468fe9`), and its brief carries the warning this turn paid for: **a
landing that moves a line the contract cites breaks that citation, and the pointer
gate is what catches it.** Vision's **WI-112** verification (`task_40d13d90f6d5`) is
still queued and still good: read-only, a substituted verifier, and the pin the item
says is Probe's file left owed.

**The lanes, at @@TIME@@.** Cog free (WI-086 queued), Vision busy on the peer's WI-106
verification (`task_64ef89071335`), the peer's WI-106 implementation queued at Wren
(`task_44c894c402ef`) — **Wren's lane gets another test, and this session spends no
request id there.** Probe's lane: **still refusing**, 30 delegations refused since
2026-10-20 21:46:39, the last at 04:25:20. **And the restart still has not happened** —
`runtime.start_requested` and `runtime.ready` are both at **2026-10-21 23:37:39**, one
run id `5bc9c2db`, `current: true`.

## 2026-10-22 08:12 — Chief: Probe's WI-034 report corroborates an acceptance, the lead re-measured it on today's tree, and a path sweep found two broken paths

**Probe's WI-034 verification came back VERIFIED — and the item was accepted two hours
before the report arrived.** The report's own first move is a premise correction: the
brief's "NOT merged into `main`" is stale. **All four of WI-034's shas are ancestors of
`main` today — `7e58b8d`, `9ff3616`, `a147d41` and `26fb68e`** — and WI-034 was
accepted at 05:50. The verdict: the three corrected numbers are right, the other four
citations land, the section is true in every claim it makes, nothing else in the
contract contradicts it, and **the pin is two-sided — it reddens if the contract moves
rather than the code.** **That corroborates an acceptance already made; no second
acceptance is spent on a closed item.**

**The lead re-measured it on the tree it stands in, because the report was measured at
`main` = `f473982` and the tree has moved twice since.**

- **The pin is green on today's tree: 1 file passed, 6 tests passed, exit 0.**
- **All eight citations in `### The audit outcome` point at the code they claim** —
  `service.ts:596` (`queue.enqueue({`), `service.ts:601` (`{ queued: true, … }`),
  `executor.ts:112` (`result: 'unknown',`), `dispatch.ts:247` (`result: 'unknown',`),
  `helpers.ts:76` (`result: 'success'`), `audit/service.ts:79`
  (`result: input.result ?? 'success',`), `app.ts:193` (`app.setErrorHandler(`) and
  `audit/service.ts:19` (the outcome set).
- **The section is now `CONTRACTS.md:1222-1288` — 67 lines, not the 62 Probe measured**
  — and the stale numbers `service.ts:515`, `audit/service.ts:71` and `app.ts:185` are
  still nowhere in the contract.
- **The pin's blob changed after Probe read it** — `0219da1` at `f473982`, `7c7edbe9`
  on `main` now — because `a51f608` ("Re-state the audit outcome check: the section's
  own pointer must carry the claim") landed after it.
- **And that re-statement closed Probe's caveat.** Probe measured the pin's first
  assertion as `expect.soft(section, …).toContain(claim.citation)` and correctly noted
  that the `audit/service.ts` pattern matches **two** lines — `:79` and `:92` are
  byte-identical — so the pattern alone did not pin the number. **The current pin finds
  the citation by range**
  (`citationsTo(section, claim.file).find((c) => c.from <= claim.at[1] && c.to >= claim.at[0])`),
  **so a citation of `:92` can no longer satisfy the claim at `:79`, and the number is
  now pinned by the instrument.** Probe's caveat was true of the tree it was measured on
  and is not true now.

**Probe's one defect is in the brief, not the work:** the brief cites
`apps/server/src/api/app.ts:185`, and **there is no `apps/server/src/api/app.ts`** — the
real path is `apps/server/src/app.ts`, which both the commit message and the contract
give. **A brief must cite a path `ls-tree` confirms.**

**And the lead swept every path in the tree, because of that.** Every path cited in the
`.factory/work/WI-*.md` files and in the published documents, checked against the tree:

- **The published documents come back with exactly one broken path.**
  `docs/resource-templates.md:845` names **`docs/decisions/0008-_.md`**, which does not
  exist — the ADR is **`docs/decisions/0008-five-domains.md`**, and the guide's own table
  at `:861` points at the same placeholder. **That is now in WI-115's scope and its
  acceptance criteria**, because WI-115 already owns that file and is already held
  behind WI-086.
- **One false citation in a published item file:** `WI-111.md:426` claims
  `apps/server/src/api/goals.ts` writes the `goal.created` audit entry; **no such file
  exists**, and `goal.created` is audited in `apps/server/src/api/factory.ts:55`.
  **Corrected by appending beside the claim, not overwriting it.**
- **Eight more are not defects:** `scripts/verify-licences.ts`,
  `scripts/verify-citations.ts`, `scripts/verify-vendored-sources.ts`,
  `docs/vendored-sources.json` and four test files are **files those items are owed**.
  **An item may name a file that does not exist yet; a claim about what the code does
  today may not.** And `apps/web/src/api/events.ts`, cited at `WI-024.md:443`, is not a
  false claim at all — that line says the file is _not_ there.

## 2026-10-22 08:08 — Chief: the push is green, WI-112 is accepted on a substituted verification, and the pin it owes has a number

**The verdict on this session's push: GREEN.** `76ce2a3` (07:59:52), read from
outside the machine: **CodeQL `completed/success`** — "Analyze
(javascript-typescript)" `completed/success` — and **CI `completed/success`** on
every job: "Lint the workflows", "The published contract matches the tree", "The
contract's pointers point at code", "Build and test", "Dependency audit", "Build
and run the stack". **VERDICT: GREEN.** The gates measured on that tree before the
push: **typecheck 0 · format:check 0 · build 0 · test 0 — 61 files, 615 tests, 0
failures**, and the pointer gate reads **122 pointers, 0 failures**.

**WI-112 is ACCEPTED, on a substituted verification, and the acceptance is written
down.** Vision — the substituted verifier, Wren's and Probe's lanes refusing, and
Vision wrote none of this work — reads: **"WI-112 — ACCEPT. All five criteria
hold. Nothing in the work needs changing; four sentences in the item's own record
do."** Measured at `origin/main` = `4e64f3d` in a clean detached worktree
(`G:\code\personal-os-worktrees\verify-wi112`, dirty = 0) with the repository's
pinned prettier 3.6.2, and **the verifier edited nothing**. The decisive
measurement: `docs/strategy.md:265-270` holds the rule as
`prototypes/DIRECTION.md:53-57` publishes it, and **compared as strings the two are
equal — 312 characters each**, with the source's `**The rule.**` label stripped and
the italics kept; both declared exceptions are present and "one declared
exception" is in neither. Nothing else in the file moved: lines 1–264
byte-identical, old 265–267 → new 265–270, the rest a shift of **+3**, 754 → 757
lines. **The acceptance and the four record corrections are appended to
`.factory/work/WI-112.md`, and the corrections are named there rather than
rewritten** — a wrong claim stays standing with a dated correction beside it.

**WI-116 is taken, and it is the pin the acceptance owes.** Vision: the pin "is
owed, and it needs a number". The pin would live in
`apps/web/src/__tests__/forge-briefs.test.ts` — the file that already holds this
rule's copies and already resolves the repository root — and **that file is
Probe's by the ownership table, so the verifier did not write it and will not: a
verifier who writes the pin is no longer independent of it.** **WI-116: "a check
pins the strategy record's copy of the rule, so a fifth copy cannot go stale
unnoticed."** It is **HELD**, because Probe's lane refuses, and the restart is
what releases it. It is numbered here so the number does not have to be taken
again.

**The floor post is up.** Request `chief-floor-0800-2026-10-22`, batch
`batch_1cd57ed2962f`, task **`task_b1a2adb1db7e`**, posted to **"Personal OS
Factory"** (`grp_cc2adeea48f4`) — **durably accepted and queued**; acceptance is
not completion, and whether it has reached the group's log is a separate reading.
It carries the owner's three decisions with their measurements, the green verdict,
the correction to this session's own red measurement, the nine pointers measured
independently, the number conceded, and the lanes.

**The watchdog's report for this hour: two tasks over the 45-minute trigger, and
nothing cancelled.** `task_cb4460d7e002` (Vision's WI-108 verification) is **83
minutes** old and **`waiting_for_tasks`** — **over the trigger and protected**: a
task in `waiting_for_tasks` is never cancelled, and its report has been read.
`task_2a34be8fd7d9` (the WI-108 report relay) is **71 minutes** and `running`, and
the cancel condition is not met either: the last message from the bot that owns it
is a live `streaming` delegation, so **its session is started**, and the watchdog
cancels only a task whose session is **not** started. **So: two reported, none
cancelled, no group round interrupted.**

**The lanes, at @@TIME@@.** Cog's **WI-086** is queued (`task_9f6a55468fe9`,
request `wi-086-land-and-repoint-cog-2026-10-22-r2`, batch `batch_05f2a3ebbde7`) and
`CONTRACTS.md` is its live file. Vision's WI-106 verification (`task_64ef89071335`)
is **done**. The peer's WI-106 implementation is still queued at Wren
(`task_44c894c402ef`). **Probe's lane still refuses** — 30 delegations refused
since 2026-10-20 21:46:39, the last at 04:25:20 — and **no restart has happened**:
`runtime.start_requested` and `runtime.ready` are both at **2026-10-21 23:37:39**,
one run id `5bc9c2db`, `current: true`.

**And two commits are deliberately unpushed, so the recorded GREEN belongs to the
tree that is actually published.** This session's ledger record is on `origin/main`
at `76ce2a3` with its verdict above; **this section and WI-112's acceptance sit in
local commits that the next push carries**, and that push's own verdict is read
the same way.

### The rule for "what is published", taken from the peer and adopted — 2026-10-22, 08:15

**The peer session's 07:55 record states the rule this session's own back-out needed:
the durable anchor for "what is published" is the remote tip, read with `git ls-remote
origin refs/heads/main`, and not the local tracking ref `origin/main`.** The tracking
ref is refreshed by a fetch, and a push updates it only afterwards, so a claim about
what is published can be a whole push stale. **The lead's back-out at 07:37 was made
against a tracking ref that was thirteen minutes behind, which is why the lead wrote
"WI-108 is NOT on `main`" when it had been on `main` since 07:30:45.**

**The lead adopts it, and the lead's own correction stands beside it: a red measurement
is true of the tree it was measured on.** The two are the same rule seen twice — _read
the tree the work stands in, not a ref you assume is current._ **Measured now, the
remote tip and the tracking ref agree — both `76ce2a3` — and `ls-remote` is the read
the lead will use from here.**

**And the two sessions converged on the pointers.** The peer measured the nine citations
WI-108's shift moved, independently, **from the shift rather than off the code** —
`service.ts` **+2** from ~250 and **+40** from ~704, `templates.ts` **+12** from ~465
— **and the targets agree with the peer's own re-pointing and with the lead's table in
WI-114.** Three measurements, one set of lines, and the peer's landing already carries
them.

**The number space, after the concession.** **WI-116 is reserved by the peer** for a
contract-publication item it has not opened — _"if this session's contract-publication
item is ever opened, it takes WI-116"_ — **so the next number either session may take
is WI-117.** WI-113 is the peer's; WI-114 and WI-115 are the lead's; and both of the
lead's are **held behind WI-086, which is `CONTRACTS.md`'s live file and is running
right now.**

### One gate failed and the cause was a race, not the tree — 2026-10-22, 08:18

**A full `npm run test` run on the tree this session was about to push came back
`TEST_EXIT=1`, with the failing workspace's output cut off by the lead's own
`Select-Object -Last 14`. The lead did not know what had failed, and a red gate with
no known cause is exactly the kind of thing that gets pushed anyway or buried.**

**The cause, from the commit timestamps rather than from a guess.** The failed run
spanned roughly 08:08 to 08:14, and **the peer session committed `683ad44` at
08:10:05 — inside that window** — "Accept WI-112 on Vision's substituted verification,
and record the green verdict". **Two Chief sessions share one working tree, and a test
suite that reads files while the other session is writing them is measuring a tree
that does not exist.**

**The lead's re-measurement, in order: the server workspace alone — 39 files, 423
tests, exit 0; then the full suite with every line captured to a file — `TEST_EXIT=0`,
61 files, 615 tests, 0 failures, and no failure line anywhere in the log.** **So the
tree is green and the failed run was a race.**

**The rule, because it will happen again: the lead and the peer session share
`G:\code\personal-os`, and a gate measured while the other session is committing is
not a measurement.** **Check the commit timestamps on both sides before believing a
red, and measure again on a tree that has stopped moving.** And the lead's own habit of
truncating a gate's output with `-Last` is what made this cost an hour of
re-measurement: **capture the whole log, then read it.**

## 2026-10-22 08:21 — Chief: the second correction of this session's own, the lane that came back, and the slot that is wasted

**Correction to the 08:08 section above: Probe's lane is ALIVE, and this session
published a stale claim about it.** That section says "Probe's lane still refuses —
30 delegations refused since 2026-10-20 21:46:39, the last at 04:25:20". **The
refusal count is right and the lane state is wrong.** Measured at @@TIME@@ from
Probe's own chat log: **30 refused delegations** (`bot`/`error`/`delegation`),
first at 2026-10-20 21:46:39 local and last at **2026-10-22 04:25:20** — and
**41 completed delegations, the last at 2026-10-22 07:25:16, which is a verdict:
"WI-106 — NOT VERIFIED (narrowly), measured at `1712fd2`, base `main` at
`9a88ebe`."** The peer has WI-106 round two queued for Probe. **Probe is working
again; the refusal streak ended at 04:25:20.**

**The cause of the mistake is the thing to record: it was a re-used measurement.**
The claim was measured at 07:16 and written at 08:08 without re-measuring the lane,
and Probe had worked at 07:25 in between. **This is the same failure class as the
07:39 section's "WI-108 is NOT on `main`"**, which was measured against a stale
local tracking ref. **Two mistakes, one shape: a claim written from an older
measurement of a moving thing.** The two rules, both now on the record:
**re-measure the lane before you publish a claim about the lane, and read the
remote tip with `git ls-remote` before you publish a claim about what is
published.** A measurement is not a fact until it is re-taken at the moment the
claim is made.

**Wren's lane is still refusing, and it is the one the restart would buy.** Wren's
own log: **8 refused delegations**, the last at **2026-10-22 06:32:01**, and 27
completed, the last at 04:06:42. **Two WI-106 tasks are queued at Wren**
(`task_44c894c402ef`, 50 minutes; and the round-two work). So the restart's
remaining benefit is **Wren's lane — and one wasted slot.**

**And one of the two running slots IS being wasted, measured.** The dispatcher
runs at most two tasks at once, and one of the two running tasks is
`task_2a34be8fd7d9` — the WI-108 report relay to Chief — **83 minutes old and
still `running`**, whose content was read at 07:05. The other is Cog's WI-086
(28 minutes into real work). **So a real turn is queued behind a relay that
finished its work an hour ago.** The watchdog's conditions for cancelling it are
**not** met — the last message from the bot that owns it is `done`, not
`streaming` — so it is **reported, not cancelled**, and **a restart is what clears
it.** That is the restart's price and its benefit, both in one sentence: **it
costs the turn in flight (Cog's WI-086, if it is ordered now) and it buys back
Wren's lane and this slot.**

**The floor post is replaced, not appended, and the reason is the same mistake.**
The 08:00 post (`chief-floor-0800-2026-10-22`, task `task_b1a2adb1db7e`) was
**cancelled while it was still queued** — it carried the stale "two refusing
lanes" claim, and a post that has not landed has no published text to correct, so
it is **replaced**: **`chief-floor-0822-2026-10-22`**, batch `batch_323e73000687`,
task **`task_ec6625381f3e`**, posted to "Personal OS Factory"
(`grp_cc2adeea48f4`), **durably accepted and queued**. **A request id is spent
when used, so the replacement carries a NEW id and a NEW title** — and the
replacement carries the corrected lane state, the narrowed restart recommendation
with its price named, and both of this session's corrections.

**And a second collision, on WI-116, settled by the same tiebreak.** This session
took **WI-116** for the pin WI-112's acceptance owes, and it is **published**
(`683ad44`, 08:10:05, and named in `WI-112.md`). The peer session's number table,
as it stands in its working tree, adds a row reading **"WI-116 | reserved — the
peer's contract-publication item, if it is ever opened"** and makes **WI-117** the
next free number. **Both claims are unbound by a live dispatch**, and **this
session's was published first**, so by the tiebreak both sessions published — the
one published first keeps it — **WI-116 is the pin, and it is not renumbered.**
And note what a reservation is: the same rule the peer published says **a number
is added to the table the moment it is taken**, and a row that reserves a number
for an item that is "if it is ever opened" is not a taken number. **Nothing is
lost either way: the peer's own table says the next free number is WI-117, so a
contract-publication item opened later takes WI-117 and the number space reads
the same in both ledgers.** This section is committed **without** the peer's table
edit, which stays in the working tree for the peer to commit.

**The verdict on the final push, and the state of the board at @@TIME@@.**
`origin/main` is **`d1e1a34`** — this session's acceptance commit `683ad44` inside
it, and the peer's `ded50ab` and `d1e1a34` beside it. The gates measured on the
tree that was pushed: **typecheck 0 · format:check 0 · build 0 · test 0 — 61
files, 615 tests, 0 failures.** **And the platform's verdict on `d1e1a34`, read
from outside the machine: GREEN** — **CodeQL `completed/success`** ("Analyze
(javascript-typescript)" `completed/success`) and **CI `completed/success`** on
every job: "Lint the workflows", "The published contract matches the tree", "The
contract's pointers point at code", "Dependency audit", "Build and test", "Build
and run the stack". This section and the two above are **local and
unpushed by design**, so the recorded GREEN belongs to the tree that is actually
published; the next push carries them and its own verdict is read the same way.

## 2026-10-22 08:25 — Chief: the floor has been locked for an hour and nineteen minutes, and that is the fourth thing the restart buys

**The floor is locked, and it is measured.** The group log's **last relay landed at
2026-10-22 07:04:29** — every post after it is queued. Measured at @@TIME@@, that is
**one hour and nineteen minutes with nothing landing**, and **five posts are queued
behind it**: this session's 08:22 report (the owner's three decisions), the peer's
07:55 report, the peer's 08:25 report, and Vision's two **WI-112 — ACCEPT** posts.
The bot's own replies have failed `BUSY` 33 times, the last at 07:04:29.

**So the restart buys four things, and only one of them is a lane.** (1) **Wren's
lane**, which has refused 8 delegations since 2026-10-20, the last at 06:32:01, with
**two WI-106 tasks queued at it**; (2) **Probe is already back** — its refusal
streak ended at 04:25:20 and it delivered WI-106's verdict at 07:25 — so the restart
no longer buys Probe; (3) **the wasted slot** — `task_2a34be8fd7d9`, the WI-108
report relay, is now **90 minutes `running`** while a real turn waits behind it, and
the watchdog's cancel conditions are not met, so only a restart clears it; (4) **the
floor itself**, which is where **the owner's decisions are waiting**.

**And the price is still exact, and it has moved with the work.** The restart cuts
the turn in flight. **Cog's WI-086 is 35 minutes into real work** (`task_9f6a55468fe9`,
running since ~07:47) — **so a restart ordered now destroys half an hour of
published work.** The cheapest moment is **after WI-086 lands**, and that is the
only thing worth the owner waiting for.

**So the recommendation to the owner, measured and final for this hour: yes, restart
— but after Cog's WI-086 turn lands, and not before.** The restart's cost is one
live turn; its benefit is a refusing lane, a wasted slot, and **the floor the
owner's own decisions are stuck behind.**

**This section is local and unpushed by design, like the last two, so the recorded
GREEN belongs to the tree that is actually published** — `origin/main` is
**`b292f97`**, and **its verdict is being read from outside the machine and is
recorded here when it lands.**

## 2026-10-22 08:30 — Chief: a RED that is a cancellation, read honestly

**The verdict on `b292f97` reads RED, and the RED is not a defect — it is a
cancellation.** Read from outside the machine: CodeQL `completed/success` ("Analyze
(javascript-typescript)" `completed/success`), and CI **`completed/cancelled`** —
with **every job that ran green**: "Build and test" `completed/success`, "The
published contract matches the tree" `completed/success`, "Lint the workflows"
`completed/success`, "The contract's pointers point at code" `completed/success`,
"Dependency audit" `completed/success`, and **"Build and run the stack"
`completed/cancelled`** — cancelled **mid-run by the push that followed it**
(`525177b`, 08:27:53, this session's floor-lock record). **A superseded run
reports itself cancelled, and a cancelled run is not a red tree.** The verdict that
counts is the one on the published head `525177b`, and it is being read now.

**And the rule that keeps this honest, because the same word is used for two
things.** The ledger has used "RED" for "the gates failed on the tree I measured" —
the case at `fc2e39b`, where `npm run test` exited 1 with 2 files failed — and that
was a real red. **A cancelled run is a different animal: no job reported a failure,
and the work it was cancelled on has already moved on.** **Record the two
separately: "the gates failed" and "the run was superseded" are not the same
sentence, and only one of them is a defect.**

**The tree that is published, at @@TIME@@.** `origin/main` is **`525177b`**: this
session's floor-lock record on top of `b292f97` (the corrections), `11a65e8` (the
peer's number block, WI-113 to WI-117), `d1e1a34` (the peer's rule for what is
published) and `683ad44` (this session's acceptance of WI-112). **The gates
measured on that tree before it was pushed: typecheck 0 · format:check 0 · build 0
· test 0 — 61 files, 615 tests, 0 failures**, and the format gate re-checked on the
pushed file: "All matched files use Prettier code style!" The only code change in
the whole chain since the green measurement at `683ad44` is **none** — every commit
after it touched the ledger and the history file, and **no test reads
`.factory/INTAKE.md`**, which was measured, not assumed.

**The floor, at @@TIME@@.** Still locked: the last relay landed at **07:04:29**,
**one hour and twenty-three minutes** ago, with five posts queued behind it —
this session's 08:22 report carrying the owner's three decisions, the peer's 07:55
and 08:25 reports, and Vision's two **WI-112 — ACCEPT** posts. **A restart is the
only thing that clears it**, and the price is Cog's WI-086 turn, which is now
**40 minutes into real work**. **So: after that turn lands, and not before.**

## 2026-10-22 08:35 — Chief: the published head's verdict, GREEN

**`525177b` is GREEN.** Read from outside the machine: **CodeQL
`completed/success`** ("Analyze (javascript-typescript)" `completed/success`)
and **CI `completed/success`** on every job — "Dependency audit", "Build and
test", "The contract's pointers point at code", "Lint the workflows", "The
published contract matches the tree", "Build and run the stack". **VERDICT:
GREEN.** The section above's reading of the `b292f97` RED stands beside it: a
superseded run reports itself cancelled, and **the run that counts is the one on
the head that is published** — and that one is green.

**And the state of the factory at 08:35, in one place.** `origin/main` is
`525177b` and it carries WI-098's accepted edit, **WI-108's landing and
acceptance**, **WI-112's acceptance**, the landing vehicle, WI-111, WI-112,
WI-113 to WI-117 in the published number block, and this session's two
corrections. **One record commit is local and unpushed by design** (`e885012`:
the cancellation reading), and it rides out with the next push. **Cog is running
WI-086** (`task_9f6a55468fe9`) on `CONTRACTS.md`; **Vision is free**;
**Probe is alive** (WI-106's verdict delivered at 07:25, round two queued);
**Wren's lane still refuses**, with two WI-106 tasks queued at it; **one of the
two running slots is still wasted** on the 90-minute relay; **the floor is still
locked** with five posts queued behind it, including the owner's three
decisions.

## 2026-10-22 08:45 — Chief: Probe's licence-record verdict, a red that was the instrument, and the number space settled again

**One — WI-106 is NOT VERIFIED, narrowly, and the verdict is against `1712fd2`, not
against the branch's current tip.** Probe's report (delivered 07:25, `task_64ef89071335`)
measured the branch `wi/106-record-four-loose-sentences` at `1712fd2` and found **every
number in the record re-derives exactly**: the shapes are **375 `licence-file` / 16
`package-json-licence-field` / 97 `published-licence-identifier` / 6 `source: null` =
494**, and `summary.readFromLicenceFile/PackageJsonField/PublishedIdentifier` reads
375/16/97; `agpl.familiesRead` has **11 rows summing to 488**, and the 11 distinct
`spdxId`s among the 488 third-party entries are exactly those 11; **494 `lockPath`s,
0 missing, 0 extra** against the lockfile's 500 entries excluding the root; the 375
licence-file quotes each contain the first line of the file they name (**375/375, 0
mismatches**) and the 16 `package.json` entries each carry the recorded field value
(**16/16, 0 mismatches**). **All five gates were green there** — server 38/410, web
9/82, worker 6/59, agent-adapters 3/23, contracts 4/28, **602 tests in 60 files, 0
failures**.

**Two wording findings stand between it and acceptance, and neither is a
re-measurement problem.** (1) `reads.evidence` still opened **"Every entry carries the
file its licence was read from…"** and then, three clauses later, said **"The six
first-party workspaces carry no source"** — **it contradicts itself inside one
sentence**, and the criterion at `.factory/work/WI-106.md:45-46` asks for exactly the
opposite. (2) `PRODUCT.md` §10 still said **"the lines of that file that identify the
licence"** (true of **375 of the 494**; **119 entries carry no such lines**) and **"one
entry for every package the lockfile installs"** (**397** packages described, **494**
held) — **the prose twin of the sentence that was corrected.** Both are one-sentence
edits.

**And the branch has moved since the verdict, so the verdict does not apply to it.**
`origin/wi/106-record-four-loose-sentences` is at **`c2375e4`** = `1712fd2` + three
commits at 08:00 — `035626f` (the JSON: "Each third-party entry records the file its
licence was read from…"), `01ceb37` (`PRODUCT.md`), `c2375e4` (the item file, +59) —
**64 insertions and 5 deletions across three files.** **The item is unverified at its
current tip.** The re-verification is **already queued by the peer session**
(`task_64ed239e7565` to Probe, and `task_b49a674c7e40` the notice; request id
`wi-106-round-two-chief-2026-10-22`), **so this session spent no request id on WI-106
and dispatched nothing for it.** Probe's merge check was clean — `merge-tree` → **0
conflict lines** — and the merged tree takes the branch's record, `PRODUCT.md` and item
file with `docs/strategy.md` unchanged. **And there is still no pin**: `git grep -ln
'dependency-licences' 1712fd2` over the test trees returns **empty**, so **no test file
in the repository mentions licences at all** and there is no borrow-rule gate script.
**That check is Probe's file to write, it is owed, and it is named as an acceptance
criterion.**

**Two — the published tree is NOT red on the format gate, and the red was the
instrument, not the tree.** The peer session's round-two brief states that "your `main`
is red on the format gate, and it is five of your ledger files" (`.factory/history.md`,
`.factory/INTAKE.md`, `.factory/work/WI-108.md`, `WI-114.md`, `WI-115.md`). **Measured
three ways, and it is green every way.** `npm run format:check` on this working tree →
**exit 0**, "All matched files use Prettier code style!". The five files' **committed
blobs** at `76ce2a3`, extracted byte-for-byte, carry **CRLF = 0** in every one and pass
`prettier --check` with the repository's `.prettierrc.json` → **exit 0**. The same
check on `origin/main`, on `origin/wi/117-branch-pileup-verdict` and on
`origin/wi/106-record-four-loose-sentences` → **exit 0**, every copy.

**And the instrument that produces the false red is reproduced.** `git show
76ce2a3:.factory/history.md | Out-File` writes **9,382 CRLF** where the blob holds
**9,382 LF and 0 CRLF** (586,734 bytes → 596,116), and `prettier --check` then exits
**1** on that copy — because `.prettierrc.json` sets **`"endOfLine": "lf"`**. **The
content is byte-identical apart from the line endings, and the committed file is
clean.** **So nothing is blocked: the peer's WI-106 branch may take today's `main`,
and the five ledger files are not a defect to fix.** The rule this earns: **a red
measured on an extracted copy is a red measured on the extraction** — check the
copy's line endings before believing it, and check the committed bytes.

**Three — WI-118 is the peer's live item, and it is NOT dispatched.** It is the
strategy document's copy of the record's loose sentence, in three places; the item
file is `.factory/work/WI-118.md` on branch `wi/118-strategy-record-prose` @ `e72304c`
(owner Wren, verifier Probe), opened from Probe's WI-106 verification. **The lead is
not dispatching it** — it is the peer's item, it holds a branch and an item file, and
**one writer per item**: a second dispatch would put two writers on `docs/strategy.md`.
**It is recorded here so it is not lost if the peer's session stops, and if it is
still undispatched at the next round the lead dispatches it from this record** — no
request id is spent, and none is claimed.

**The three sentences, measured on today's tree** (`docs/strategy.md` is unchanged
since `9a88ebe`, so Probe's line numbers still hold): `:494-495` — "494 packages, one
entry each, **every entry naming the file its licence was read from**", true of **488
of the 494**; `:660` — "**every entry names the file its licence was read from**", true
of **488 of the 494**; `:673-674` — "**Every entry carries the first identifying lines
of the file it was read from**", true of **375 of the 494**. **The third is the exact
twin of the sentence WI-106 corrected in the record**, which is why the two copies now
disagree — the outcome the record's own `approvedSet.note` warns about: _"two copies of
the same licences is a record that can disagree with itself."_

**Four — the floor at 08:45.** Running: `task_9f6a55468fe9` (Cog, **WI-086**, on
`CONTRACTS.md` — **this is what holds WI-114 and WI-115**) and `task_2a34be8fd7d9`
(**Vision's WI-108 report relay into Chief's chat — started 07:25:27, still running,
and its content was already read and WI-108 accepted off it at 07:46; it is the wasted
slot, and it is reported, not cancelled**). Queued: the two WI-106 round-two tasks, the
WI-106 completion notice, and five group posts. **Probe's lane is alive** (WI-106's
verdict at 07:25); **Wren's lane still refuses**, with two WI-106 tasks queued at it.
**The ceiling stays at two.** **The peer's two record commits (`e885012`, `cfb1345`) are
local and ride out with the next push**, by the peer's own record.

**And the restart, re-read on today's evidence.** **Probe's lane is back** — it
delivered the WI-106 verdict at 07:25 — and **Vision's lane was never dead**, so what
is left of the restart's benefit is **the wasted slot and Wren's refusal**, against a
price of **the turn it lands in**, which right now is **Cog's live WI-086**. **It is
still the owner's word**, and **the floor is not that moment now.**

## 2026-10-22 09:15 — Chief: WI-106 is accepted and landed, the number space moves to WI-122, and the owner's word on the public repository is on the record

**One — WI-106 is ACCEPTED, on Probe's VERIFIED verdict, and the work is landed.**
The verdict is **VERIFIED**: _"Both wording findings are fixed, nothing else moved, all
nine gates green on the branch's own tree."_ **It is against `60d5bb8`, the branch's
actual head — not the `c2375e4` the round-two brief named.** The brief's tree note
was stale and the verifier said so: the branch was **not** rebased back onto
`1712fd2`; it carries main's merge at `e885012` plus two ledger commits, **27
commits past `1712fd2`**. **A brief's tree note is not a measurement; the commit the
verifier names is.** Both findings are fixed — `reads.evidence` opens **"Each
third-party entry records the file its licence was read from…"** and no longer says
"every entry"; `PRODUCT.md:290-293` says **"one entry for every package in the
lockfile"** and no longer says "the lines of that file that identify the licence" —
and **nothing else moved**: the whole 494-entry array, `approvedSet`, `agpl.*`,
`summary` and the other five `reads` strings are byte-identical, and `PRODUCT.md` has
**one hunk** with the **366 lines outside it byte-identical**. The counts re-derive
exactly: **375 / 16 / 97 / 6 = 494**, third-party **488**, **11** distinct `spdxId`s,
`familiesRead` **11 rows summing to 488**. The nine gates on the branch's own
worktree: **exit 0**, including `npm run gates` — **"Every gate passed. The tree is
green."** **Merged into `main` as `8817b92`** (`merge-tree` → **0 conflict lines**;
the branch's diff against main is exactly three files).

**The tiebreak, said out loud.** The peer session dispatched the round-two
verification under its own request id `wi-106-round-two-chief-2026-10-22`, and its
record carries the same verdict. **This session lands the verified work and closes
the item on Probe's report, so that a verified item is not left verified-but-open.
No second acceptance is needed or wanted.**

**Two — the pin is still owed and is still not written.** `git grep -ln
'dependency-licences' 60d5bb8` over the test trees returns **empty**: **no test file
in the repository mentions licences at all.** The record can drift back into the two
sentences this item corrected until a check holds them, and **that check is Probe's
file to write.**

**Three — the number space moves to WI-122, and WI-120 and WI-121 are the peer's.**
The peer filed **WI-120 — "The published front page states the identity the owner
replaced"** (owner Wren) and **WI-121 — "The decision surface carries what an agent
is blocked on"** (owner Cog), both reading this block and taking the next two
numbers, and both saying **"the next free number after this is WI-122"**. **The
block now carries both rows and says WI-122.** **And WI-119's file must be renamed
before it merges**: `main` carries a **different** WI-118 — the mode item — and
`git merge-tree --write-tree main wi/118-strategy-record-prose` returns **CONFLICT
(add/add) in `.factory/work/WI-118.md`**. **The prose item is WI-119 and its file
must be `WI-119.md`**; the branch `wi/118-strategy-record-prose` **keeps its name**.

**Four — the owner's word on the public repository, read from WI-120's own file.**
_"Does the owner stand behind a public MIT repository — with the front page
corrected to the new identity before anyone finds it?"_ — **"Yes to both, in that
order."** **The repository is public and MIT and stays that way, and the front page
is corrected in the world, not on a branch**: WI-120's own file says **"the merge to
`main` and the push of `main` are inside this item"**. **The lead's standing word
already covers it** — _push `main` whenever CI is green_ — and **nothing else is
pushed on the strength of that answer.**

**Five — the floor at 09:15.** **Cog is running WI-086** on `CONTRACTS.md` — **that
is what holds WI-114 and WI-115**. **Probe's lane is alive and productive**: it
delivered a NOT VERIFIED verdict at 07:25 and a **VERIFIED** verdict at 09:05, and
both were measured adversarially rather than read out of the record. **Wren's lane
still refuses.** **The relay that held a slot has released it** — Vision's WI-108
report is `waiting_for_tasks`. **The ceiling stays at two.**

## What the published repository says — 2026-10-22, Vision

Three things the strategy room should have, all verified rather than inferred.
The first is a fact about the world; the second is what that fact makes of the
product's first impression; the third is a gap in the decision surface that the
code confirms.

### 1. The repository is public, and it is MIT

`github.com/this-bytes/personal-os` serves the repository to an anonymous
request: the README, the file tree, `.factory/`, `docs/`, `apps/`, the
licence, the code of conduct, the security policy. GitHub's own sidebar reads
**MIT license**. The README's licence section reads _"MIT. The owner chose it on
2026-10-21, and the full text is in the LICENSE file at the root of the
repository."_ The manifest says `"license": "MIT"`, the root `LICENSE` file is
MIT, and the commit carrying the decision is `74e00cb` — _"The owner chose MIT,
and the repository is published under it"_, 2026-10-21 19:27. `origin/main` is
at `525177b` and two commits behind `main`, so the public copy is current to
08:27 this morning.

**So the licence is settled and the repository is public.** The record is
current on the licence — WI-041 is accepted as the MIT implementation, not the
"deliberately undecided" one — but the owner's 08:54 answer was _"Private for
now — push it, and decide visibility later."_ **A push has been made and the
remote is public, so "visibility later" no longer preserves the choice: a
public remote is a publication, and a publication cannot be withdrawn.** The
history is on GitHub's side; a private switch hides the front page without
un-serving what was already served. Zero stars, zero forks — nobody has found
it, which is the one piece of good news in this section.

That is the owner's decision, not the factory's: stand behind a public MIT
repository, which is the vision's own form — open-source and self-hosted — or
make the remote private and, if the history matters, rewrite what was
published.

### 2. The front page states the identity the owner replaced

If the repository is public, the first three lines of the README are the
product's front door to the world, and they currently read:

> **An agent-native control panel and personal software factory.**

The manifest's description reads the same sentence, and GitHub's page title,
meta description and social preview all carry it: _"…talk to agents, run group
conversations, and let agents build the things you need."_

The product record says otherwise. `docs/strategy.md` records the identity as
_an environment that one person's agents operate and extend_, and it lists
what the product is not: **not a chat home**, not a workflow editor, not an
inference engine, not a plugin marketplace. The old tagline promises three of
those exclusions in one sentence: a control panel is coordination, "talk to
agents, run group conversations" is a chat home, and the software factory is
the half of the product the owner said is a part of it and not the whole of it.

Nothing is wrong with the repository's licence and nothing is wrong with the
code. What is wrong is that the published front page is still the old product,
and it is the one artefact already in the world.

**The line that fixes it, in the product's own words:**

> **The environment one person's agents operate and extend.**

and the manifest's description to match: `Personal OS — the environment one
person's agents operate and extend.`

### 3. The decision surface is blind to what an agent cannot do

The fourth pillar — the decision surface — is the set of ways the owner can be
asked for authority. The waiting list carries approvals and tasks, and the
autonomy-policy path creates an approval when an action needs the owner
(`mcp/server.ts:116-144`), so a gated action becomes visible. **A capability
the agent was never granted does not.** An ungranted tool is not registered on
the agent's MCP server at all (`mcp/server.ts:24-27`), so the call is refused
with a 403 the agent sees and the owner does not (`mcp/server.ts:101-104`),
nothing is published, and nothing reaches the waiting list.

So the list is complete for _approvals_ and silent for _blocked agents_. The
owner is never told that an agent cannot do the thing it is trying to do, and
the identity's own trust decision — widening what an agent may do — has no
route to the surface where the owner exercises authority. The product's promise
is "everything waiting on me in one place", and this is not a violation of it:
nothing is waiting on the owner. **The agent is waiting, and it will never be
in the list.**

**A want in the document's format. It takes no number.**

**The decision surface also carries what an agent is blocked on.**

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

A refusal the agent cannot appeal and the owner cannot see is a dead end. The
refusal becomes something the owner can see and act on: the waiting list gains
a kind for a blocked capability, carrying which agent wanted it and what it
needed, so widening that agent's grant is a decision the owner takes in the
same place they take every other one. One row per agent and capability, not
one per attempt, or the list fills with probe noise.

**Acceptance:** a call refused for a missing grant publishes the refusal; the
waiting list carries it as its own kind, one row per agent and capability; the
owner can widen the grant from the list; the row leaves when the grant is
widened; a test proves the refusal reaches the list and that the row leaves
after the grant.

## 2026-10-22 09:20 — Chief: the front page is corrected, two numbers are taken, and WI-112's record is true

**One — the owner's answer, and the standing word that covers the push.** In the strategy
group the owner answered _"Does the owner stand behind a public MIT repository — with the
front page corrected to the new identity before anyone finds it?"_ with **"Yes to both, in
that order."** The repository is public and MIT and stays that way, and the front page is
corrected **in the world, not on a branch** — a correction that lives only on a branch
leaves the published page carrying the old sentence for every reader who arrives first.

**The push of `main` needs no new word.** `.factory/chief.md:90-94` and `FACTORY.md:92-97`
carry the owner's standing word of **2026-10-21 18:07** — _"push `main` whenever CI is
green"_ — and `FACTORY.md:94-95` says it plainly: **"That word is not spent — it stands
until the owner changes it."** The conditions before the push are `FACTORY.md:99-107`: the
local gates pass **on the tree being pushed**, the landed code is code the pipeline has
measured green, and the push is a fast-forward from where the work started.
**The platform's verdict is read afterwards and recorded** (`FACTORY.md:109-113`), and **a
red verdict on a pushed `main` is a factory failure to fix and say out loud**, never a push
to undo by force. **One push at a time**, because a push cancels the run that judges it.

**Two — WI-120 and WI-121 are this session's items, and both are dispatched.**

| item       | what it is                                                      | owner | request                                            | task                |
| ---------- | --------------------------------------------------------------- | ----- | -------------------------------------------------- | ------------------- |
| **WI-120** | The published front page states the identity the owner replaced | Wren  | `wi-120-front-page-identity-2026-10-22`            | `task_2b5160e24223` |
| **WI-121** | The decision surface carries what an agent is blocked on        | Cog   | `wi-121-blocked-agent-decision-surface-2026-10-22` | `task_bbf11f83be2b` |

**WI-121 is Vision's third want, and it was left unnumbered for three hours.** It is
numbered now, and it is dispatched. **A want that is written down but not numbered is how
the MCP scoping defect sat for three hours**, and the rule that stops it is the one the
block already carries: _a number is added to the table the moment it is taken_.

**Three — the block carries each number once, and the rows that are there are right.** The
other Chief session read these two item files out of the shared tree and published the two
claims into the block at **09:10:59** (`4458ad1`), with **"the next free number is
WI-122"**. **Those rows are the block's, and they stand.** This session had inserted its own
two rows at 09:0x — the same two numbers, the same titles — and **they are removed**, so
each number appears once. The owner column reads `peer` for both rows because the block is
written from that session's side of the tree. **The tiebreak was never needed: there was one
claim, taken once, and published by the session that read it.**

**Four — WI-112's four record corrections are applied, not just listed.** In
`.factory/work/WI-112.md`: the duplicated `## The problem` is gone; the State line reads
**`accepted`**; the pin's three copies are named (`RULE_COPIES` is **measured** — three
entries — and the item's own "Not in scope" section said three); and the house-form
sentence names **brief 01:18 and brief 05:29 only**, because the phrase _"quoted exactly as
the direction document states it"_ is in those two files and **grep over
`prototypes/briefs` returns those two lines and no third** — the briefs README carries the
rule as a bare blockquote. **The section that named the four stays**, so the difference
between what the item said and what is true is still visible. **The pin is still owed**: no
test reads `docs/strategy.md`, it is **WI-116**, and it is **HELD** behind Probe's lane —
a verifier who writes the pin is no longer independent of it.

**Five — a want, and it is not numbered.** The README's **body** carries the product's older
framing — _"one place to talk to agents, run group conversations…"_ is a chat home, and the
product record lists what this product is not (`docs/strategy.md:37`). **The owner's
decision was about one line, and this is a rewrite of the document, not a one-line
correction**, so it is recorded here as a want and not as an item. It has no owner until it
is triaged, and a want without an owner is a wish — which is the point of writing it down.

**Six — the dispatch tool's own rule, measured twice.** Dispatching from this session failed
with _"This Bot is replying in multiple chats, so this tool call cannot be assigned
safely"_, because this bot answers in two chats at once — the strategy group and the
owner's chat. **The dispatch succeeds when the caller id is left empty**, which is what the
tool's own description says to do from the user's own chat. **A dispatch that cannot be
delivered is not a dispatch**: both request ids are recorded in their item files, and the
items can be delivered from there.

**Seven — what the product can now do.** When WI-120 lands, **the front page of a public
repository says what the product is, in the product's own words**. When WI-121 lands, **an
agent blocked on a capability the owner never granted appears in the owner's waiting list,
with the agent's name and what it needed, and the owner can widen the grant from that list
— and the row leaves once they have.**

## 2026-10-22 2026-10-22 09:37 — Chief: WI-086 is landed, the peer's ledger is merged, and the two held items are re-measured

**One — the merge, and why it was stuck.** `origin/main` was at `20ce58e` and the lead's tree
was at `4458ad1`, and `git merge origin/main` was refused: **"Your local changes to
`.factory/INTAKE.md` would be overwritten."** The peer had a 73-line block uncommitted in
the shared tree. **The block was extracted byte-for-byte — 5,652 characters, 74 lines, a
pure append — the working copy reverted, and `origin/main` merged in as `52a06ae` with
`merge-tree` reporting no conflict lines.** The peer's block was then found **already
committed by the peer at 09:23** (`01771e3`, `56adfeb`) in the shared tree, while the merge
was in flight. **Nothing was lost.** The lesson is the one this tree keeps teaching:
**two Chief sessions share one working tree, so the tree moves under the lead mid-measure,
and a merge that was refused at 09:10 was merged at 09:25.**

**Two — WI-086 is LANDED, and it is not accepted.** Merge **`06c1b2f`** ("Land WI-086: the
evidence a decision is taken against, in code"), from branch **`wi/086-evidence-read-route-v2`**
(tip `d53882d`, plus `6c3f572`, the item record's own update). `merge-tree` clean. **9 files,
+939/-59**: the reader `apps/server/src/modules/approvals/evidence.ts` (new, 193 lines), the
route at `apps/server/src/api/approvals.ts:37` registered at `app.ts:225`, the three
re-pointed citations in `approvals/service.ts`, the published shape in
`packages/contracts/src/approvals.ts`, the test file `approval-evidence.test.ts` (new, 437
lines), the contract note at `CONTRACTS.md:1480`, and `scripts/contract-status.json`
flipping the claim to `implemented`.

**The old branch `wi/086-evidence-read-route` @ `d4926f0` was NOT merged** — it carries a
day-old tree whose every cited line had moved — and it was **not force-pushed**, because the
pre-push hook refuses a rewrite of a published branch without the owner's word, and no owner
has said so.

**This is the landing, not the acceptance.** The verification is dispatched to **Probe** —
request id `wi-086-verify-probe-chief-2026-10-22`, task **`task_4b2fc4b5eb9f`** — who wrote
none of the work. **Probe's lane is alive** (its last two messages are `done`, and it
delivered WI-106's VERIFIED verdict at 09:05), so this is a dispatch into a working lane and
not a request id spent into a refusing one.

**Three — the number space is unchanged, and the next free number is WI-122.** WI-106 is the
lead's and was closed at 09:10; WI-114 and WI-115 are the lead's; WI-116 is the pin WI-112
owes; WI-117 is the peer's branch-hygiene measurement; WI-118 is the peer's mode item;
WI-119 is the peer's prose item; WI-120 and WI-121 are the peer's. **No number was taken
this turn, and the block was not edited.**

**Four — WI-114 and WI-115 are re-measured on the tree WI-086's landing produced, and both
stay HELD.** The hold was on the file — `CONTRACTS.md` was Cog's until WI-086 landed — and
**the file is free. The hold is now on the lane.** `docs/**` and `*.md` are **Wren's**, and
**Wren's lane is down: her chat's last five messages are `role=bot, status=error, 0
characters`, each directly after a relay — WI-103, WI-106, WI-098, WI-111 and the WI-106
round-two verdict. Five delegations, five refusals, not one word back.** The lead does not
spend a request id into a lane that is refusing, so **neither item is dispatched.**

**What the re-measurement found, and it is in the item files:**

- **WI-114** — two of its four corrections are confirmed (`CONTRACTS.md:806` → `service.ts:376-377`;
  `docs/resource-templates.md:355` → `templates.ts:534-555`), one has **moved**
  (`CONTRACTS.md:1946` → **`:1955`**, because the contract grew by nine lines elsewhere), and
  **one of its own proposed numbers was never right**: `resources/service.ts` has stood at
  **798 lines since `a65ff32` at 06:29**, and `async execute(id)` has stood at **`:589`**
  throughout, so the proposed `:583-593` does not hold "the automation provider's
  `execute`" — `:583` reads `return updated;` and `:593` reads `if (type === 'automation')
{`. **Three ranges are candidates and the item does not choose between them: `:589-622`,
  `:593-602`, and `:624-634` (`inspect`, which is the code that refuses a drifted template at
  the point it is read). Which one the row cites is the document owner's call, not a number
  the lead should invent.**
- **WI-115** — two of its numbers moved by two lines (`service.ts:345` → **`:347`**,
  `:513` → **`:515`**), and **a fourth finding joined its scope**: the guide's claim at
  `:71-73` that "the task provider's `validate` is `(data: unknown) => data` (`service.ts:299`)
  — it returns whatever it is given, so the registry's drift check catches nothing for tasks"
  is **false twice** — `:299` reads `if (!row) throw errors.notFound('Automation');`, and the
  task provider's `validate` is at **`:351-360`**, where it parses with `taskSpecSchema` and
  refuses with `errors.validation` — **WI-108's landing (`a65ff32`) is what fixed it.** The
  paragraph's **first** half is still true: `apps/server/src/modules/mcp/server.ts` holds
  **zero** occurrences of `audit`, so "the MCP server contains no `audit` call at all" holds.
  **The correction must not remove the true half.** The two broken paths stand too: `:845`
  names `docs/decisions/0008-_.md`, which does not exist (the ADR is
  `docs/decisions/0008-five-domains.md`), and `:861` names the glob
  `docs/decisions/0008-*.md`.

**Five — the floor, cleaned of seven stale tasks.** The dispatcher takes the first queued
task whose chat is free, so a stale task at the head **spends the next free slot on work
that is already done.** Seven were cancelled: five reporting on **WI-106**, which was closed
and accepted at 09:10 (and one of them carrying the claim that WI-106 is WI-119, which the
published number space contradicts), and two reporting the WI-086 landing — one to a bot and
one to the group. **That last one is a deliberate choice, and it is the tiebreak said out
loud: WI-086's landing is the lead's act, so the lead reports it, once, with the merge and
the push and the verification dispatch in the same post.** Of the seven, five had already
failed on their own — **three `BUSY`, two `AGENT_UNAVAILABLE`** — which is the same
refusal seen in Wren's lane, and one of them failed **on the group post itself**, so
**Probe's WI-106 verdict never reached the group by the peer's route.** This post carries it.

**Six — what the product can now do, pending the verifier's verdict.** **A decision's
evidence can be read in code.** The approval's execution — the thing the decision was taken
against — is served by a route at `apps/server/src/api/approvals.ts:37`, registered at
`app.ts:225`, in a shape the contract publishes at `packages/contracts/src/approvals.ts`
and exports as `approvalEvidenceSchema`. **And the claim table now holds it:** the note in
`CONTRACTS.md:1480` and the claim in `scripts/contract-status.json` cannot claim
"implemented" while the route or the exported schema is gone, and the pointer gate checks
the note's three line numbers. **WI-086 is landed, not accepted: Probe's verdict is owed.**

## 2026-10-22 09:45 — Chief: the front page is published, and the platform's verdict on the pushed sha

**One — the front page is published.** `20ce58e..ce51521  main -> main`, fast-forward, exit 0,
and the repository's own pre-push hook ran the format gate over the files in the push and
passed. **The published tip, read from the remote and not from a tracking ref:**
`git ls-remote origin refs/heads/main` → **`ce51521`**.

**Two — the gates on the tree that was pushed.** `npm run gates`, **exit 0**: typecheck 25272ms,
test 75978ms, build 15625ms, format 11658ms, contract-status 703ms, contract-pointers 1348ms,
smoke 10270ms, compiled-build 2499ms, bundle-size 685ms — **"Every gate passed. The tree is
green."** The three conditions of `FACTORY.md:99-107` were met: the local gates green on the
tree being pushed, the landed code byte-identical to a tree the pipeline has measured
(`git diff --name-only origin/wi/086-evidence-read-route-v2..ce51521` touches only `.factory/**`,
`PRODUCT.md`, `README.md`, `docs/dependency-licences.json` and `package.json` — **no code
path**), and a fast-forward from where the work started.

**Three — the platform's verdict, read afterwards and recorded** (`FACTORY.md:109-113`). **CI
run `39687241876` on `ce51521`: `completed/success`. CodeQL run `39687241897` on `ce51521`:
`completed/success`.** The previous run on `20ce58e` was green in 5m39s, so the pipeline was
measuring green when this push superseded it, and **the run that judged the last push of the
batch is the one that matters** — it judged a tree that carries everything `20ce58e` carried,
plus the front page.

**Four — the published front page, measured the way a stranger measures it.** An anonymous
fetch of what GitHub serves: `raw.githubusercontent.com/this-bytes/personal-os/main/README.md`
line 3 reads the product's own sentence — **The environment one person's agents operate and
extend.** — which is `docs/strategy.md:20` with the product's name left off, and
`raw.githubusercontent.com/this-bytes/personal-os/main/package.json` reads
**"description": "Personal OS — the environment one person's agents operate and extend.",**.
The old line — _"An agent-native control panel and personal software factory"_ — was the
page title, the meta description and the social preview, and **it stated three of the
product's own exclusions** (`docs/strategy.md:37`: not a chat home, not a workflow editor, not
an inference engine, not a plugin marketplace). It is gone from the front page.

**Five — the lead wrote this one, and the borrow is on the record.** The dispatch to Wren
(`wi-120-front-page-identity-2026-10-22`, task `task_2b5160e24223`) **queued for fifteen
minutes and never started** — the dispatch ceiling was full of two tasks that had already
produced their results and were parked in `waiting_for_tasks`. The owner's answer was
_"before anyone finds it"_, and the front page is the one artefact already in the world. **So
the queued dispatch was cancelled** — so that no two workers would meet in one worktree — and
the lead executed the two-line change itself, **borrowing `README.md` from Wren**, with the
manifest's description inside WI-120's item. **Probe still verifies it, and the lead cannot
accept its own work:** the verification is dispatched as
`wi-120-verify-published-front-page-2026-10-22`, task `task_f8085b21663f`, against the
**published** artefact — **that dispatch was cancelled and replaced, and the section below
says why.** **WI-120 is in `review` and not accepted until a verdict comes back.**

**Six — WI-121 is dispatched and waiting for a slot.** Vision's blocked-agent want — _"the
decision surface carries what an agent is blocked on"_ — is numbered, filed and dispatched to
Cog (`wi-121-blocked-agent-decision-surface-2026-10-22`, task `task_bbf11f83be2b`, **queued**).
**The ceiling is the reason it has not started**, and the ceiling is the reason the front page
was executed by the lead rather than by its owner.

**Seven — one push at a time.** This record travels in the next push, and that push's run is
the one that judges the tree. **The code is byte-identical to `ce51521`**, so the verdict
cannot differ for a reason that touches code.

## 2026-10-22 09:55 — Chief: the verifier, and the ceiling that made the substitution

**One — WI-120's verification stands with Vision, not Probe.** Probe's dispatch was made
first (`wi-120-verify-published-front-page-2026-10-22`, task `task_f8085b21663f`) and was
**cancelled** when it was measured to be **queued behind a full dispatch ceiling rather than
refusing** — and a second verifier on one item is exactly the duplicate work a ceiling of
**two** cannot afford. **Vision is the substituted verifier**
(`wi-120-verify-published-front-page-vision-2026-10-22`, task `task_faa2e8e0f9f1`), and the
condition for a substitute is met: **Vision wrote none of this work.** WI-120 is in `review`
and **not accepted** until that verdict comes back. **The lead wrote the change and cannot
accept its own work**, and that is the whole point of the separation.

**Two — the ceiling, measured, and what it is actually made of.** Three dispatches were
queued in ten minutes — Wren's WI-120, Cog's WI-121, and the verifications — and **none of
them started**. The two slots are held by `task_2a34be8fd7d9` (the 08:55 relay, **90
minutes** old) and `task_9f6a55468fe9` (Cog's WI-086, **whose result was delivered and whose
landing is on `main` at `06c1b2f`**). **Both are `waiting_for_tasks`, not working**: each
waits on dependency batches whose floor posts are still `reviewed: false`, and **the floor
has been locked since 07:04:29**. The floor's own messages say why — each relayed result is
followed by a bot message with **`status: error` and empty text**, which is a Chief turn on
the floor that died rather than answered. **So the factory's capacity is two finished tasks
and a locked floor, and the backlog behind them is real work: WI-120's verification and
WI-121's implementation.**

**Three — what was NOT done, deliberately.** The two parked tasks were **not cancelled**. They
have produced their results, their deliveries are recorded, and cancelling them would mark
delivered work as cancelled **without touching the cause** — the unreviewed floor posts and
the lock behind them. **Cancelling is not the repair; the lock is.** The peer's own record
of the same diagnosis is that a restart buys the floor, the wasted slot and the lanes, at the
price of the turn in flight — and **Cog's WI-086 turn has now landed**, which was the
condition the owner attached to that restart.

**Four — the front page does not wait for any of this.** It is published, measured and green:
`ce51521` merged, `npm run gates` exit 0 with all nine gates, **CI run `39687241876`
`completed/success` and CodeQL run `39687241897` `completed/success` on that sha**, and the
served `README.md` line 3 and manifest description read the product's own sentence. **The
owner said "before anyone finds it", and the repository still has zero readers.** That is why
the lead executed the change itself rather than waiting for a queue.

## 2026-10-22 09:55 — Chief: the platform's verdict on the published tip

**The published tip is `2806f72`, and it is green on both workflows.** **CI run `39688717116` on
`2806f72`: `completed/success`. CodeQL run `39688717169` on `2806f72`: `completed/success`.**

**And it is a verdict on the front page's code.** The tree behind `2806f72` is byte-identical to
`ce51521` — the tree that carries the corrected front page — and
`git diff --name-only ce51521..2806f72` touches **only `.factory/**`\*\*. The commits between
them are records: the landing's own record, and the record of the verifier decision and the
ceiling.

**And the runs this one supersedes.** The run on the middle commit `4047fef` was overtaken by the
last push of the batch. **The record's own rule applies: a push that was overtaken is not a red
build and not a failed gate — it is a push that was overtaken, and the run that judges it is the
next one.** That next run is the one on `2806f72`, and it is green. **One push at a time, and
the verdict read after each** — which is what the three pushes this turn were: `ce51521` (the
front page), `4047fef` (records), `2806f72` (records).

## 2026-10-22 10:00 — Chief: the published tip is green, and two stale tasks were cleared

**One — the published tip is `7ffa4e4`, and it is green on both workflows.** **CI run `39689875528`
on `7ffa4e4`: `completed/success`. CodeQL run `39689875473` on `7ffa4e4`: `completed/success`.** The
tree behind it is byte-identical to `ce51521` — the tree that carries the corrected front page — and
`git diff --name-only ce51521..7ffa4e4` touches **only `.factory/**`\*\*.

**Two — two stale tasks were cleared, and the rule that allowed it.** `task_2a34be8fd7d9` (the 08:55
relay, **95 minutes**, its result delivered) and `task_cb4460d7e002` (Vision's WI-108 verification,
**its verdict delivered at 07:00 and WI-108 accepted on it**, **2h58m**) were both sitting in the
queue while the ceiling of two stayed full. **Neither was working**: both had produced their
results, and both were waiting on floor posts whose Chief turns had died. **`FACTORY.md:203-207`
says cancelling is Chief's judgement, because elapsed time alone cannot tell a stall from a long
task — and these were not long tasks, they were finished ones.** The owner's standing answer named
the same lever: _"one wasted slot (a 90-minute relay still running)"_. **Nothing was lost**: the
relay's result carried the owner's three decisions to this session, and WI-108's verdict is in the
record and in its own item file.

**Three — the owner's decisions, and where they went.** `chief-floor-0822-2026-10-22`
(`task_ec6625381f3e`) **failed with `BUSY`** and never reached the floor — **but its three
decisions were delivered to this session through the relay's own result**, and they stand:
**the restart, yes, after Cog's WI-086 turn lands** — it landed at `06c1b2f`, so the condition is
met; **the ceiling patch, no** — `MAX_RUNNING = 2` is one line in vendor code in a content-addressed
cache, and a patch there vanishes on the next plugin update; **a substituted verifier, yes** where
the substitute wrote none of the work. **The floor's lock is not yet released** — it began at
**07:04:29** when a Chief turn on the floor died with `status: error` and empty text, and **39 of
the floor's 160 messages are dead turns of that kind.** The repair is the restart, and it is the
owner's to call.

**Four — the queue, as it stands.** **WI-121 is running**: Cog started the blocked-agent item at
09:49. **WI-120's verification is queued** (Vision, `task_faa2e8e0f9f1`), and **the brief reached
the lane** — the partial result on Vision's session reads _"Re-running it, and pulling up the item
file and ignore rules. `2806f72..7ffa4e4` touches only `.factory/INTAKE.md` — no code, no docs, no
front-page files"_ — **but that turn was interrupted by the cancellation of the stale task record
it was attached to**, and the session is now `aborted`. **WI-120 stays in `review` until the verdict
lands: the lead wrote that change and cannot accept its own work.**

## 2026-10-22 10:10 — Chief: the verifier, twice withdrawn, and what is actually blocking it

**One — the verification of WI-120 has been dispatched twice and withdrawn twice, and the
sequence is on the record because it is the kind of thing that gets retold wrongly.**
`wi-120-verify-published-front-page-2026-10-22` (task `task_f8085b21663f`) went to Probe at 09:34
and **never started** — it queued behind a full dispatch ceiling, and it was cancelled at 09:43
rather than left to sit. `wi-120-verify-published-front-page-vision-2026-10-22` (task
`task_faa2e8e0f9f1`) went to Vision as the substituted verifier, **whose lane's session went
`aborted`**; the brief reached it — the session's partial result reads _"Re-running it, and
pulling up the item file and ignore rules"_ — and the turn was interrupted when the stale WI-108
task record it was attached to was cancelled. **It could not be re-driven, so it was cancelled
too.** **A re-dispatch carries a new request id and a new title, and the spent ids are not
reused:** `wi-120-verify-published-front-page-probe-r2-2026-10-22`, task `task_f689f6b918a1`,
is now at Probe, and **Probe is the item's verifier again**.

**Two — what is blocking it, measured, not guessed.** The verification is **queued**, not
running, and the reason is not the lane: **Probe's lane showed activity at 10:03** and its session
is `started`. **The dispatch ceiling has no free slot for it.** One slot is doing real work —
**Cog is running WI-121** — and the second is not free. **Cancelling the two finished tasks
relieved the backlog but did not open the ceiling**, and that is worth knowing: **the ceiling is
counting something that is not working**, and the floor's dead Chief turns (**39 of 160 floor
messages are `status: error` with empty text, the lock beginning at 07:04:29**) are the part of
it that a restart repairs.

**Three — the owner's restart, and why it has not been done by this session.** The owner's
standing answer was _"the restart — yes, but after Cog's WI-086 turn lands"_, and it landed at
`06c1b2f`, so the condition is met. **This session has no restart lever that is not destructive:
archiving or deleting a session ends a live turn**, and the peer Chief session's turn has been
running since 09:09 and is doing real record work. **So the restart is the owner's to call, and
it is the one thing standing between the factory and its queue.** What it buys is measured in the
owner's own answer: **Wren's lane, the wasted slot, and the floor.**

**Four — and the thing that matters most is already done.** The front page is published, the
published tip is green on both workflows, and the served README and manifest read the product's
own sentence. **The verification is what closes the item's record; it is not what makes the
front page true.**

## 2026-10-22 10:17 — Chief: the published tip's verdict, green on both workflows

**The published tip is `bd0781d`, and it is green on both workflows.** **CI run `39690801978` on
`bd0781d`: `completed/success`. CodeQL on `bd0781d`: `completed/success`.** The tree behind it is
byte-identical to `ce51521` — the tree that carries the corrected front page — and
`git diff --name-only ce51521..bd0781d` touches **only `.factory/**`\*\*.

**So every verdict this morning, on every tip, was green on the same code:** `ce51521`
(CI `39687241876`, CodeQL `39687241897`), `7ffa4e4` (CI `39689875528`, CodeQL `39689875473`),
`b45fae5` (CI `39690801978` on the tip before it, CodeQL on it), and `bd0781d` (CI `39690801978`,
CodeQL). **The pushes this turn were four, and each one was made after the previous run
finished** — `ce51521` carries the front page, and the three after it carry records only.

**And the one verdict still owed is a verdict on the published artefact.** WI-120's verification
is at Probe (`task_f689f6b918a1`), **queued** — the ceiling's second slot is not free, and this
session has no non-destructive lever that would open it. **The lead wrote that change and cannot
accept its own work**, so the item stays in `review` until Probe's verdict lands.

## 2026-10-22 10:25 — Chief: the published tip is green on both workflows, and this is the last push of the batch

**The published tip is `c95946d`, and it is green on both workflows: CI `completed/success` and
CodeQL `completed/success` on that sha.** Its code is byte-identical to `ce51521`, the tree that
carries the corrected front page, so **every verdict this morning was a verdict on the front
page's code** — CI `39687241876` + CodeQL `39687241897` on `ce51521`, CI `39689875528` + CodeQL
`39689875473` on `7ffa4e4`, CI `39690801978` + CodeQL on `b45fae5`, CI `39690801978` + CodeQL on
`bd0781d`, and CI + CodeQL on `c95946d`.

**This is the last push of the batch, and the record says how the next one is read.** The
commit this record travels in carries the same code again, so **the run that judges it judges the
same bytes** — `git diff --name-only c95946d..<this commit>` touches only `.factory/**` — and
the rule is the one already on this record: **the verdict that matters is the one read after the
last push of a batch, and a push that was overtaken is not a red build.**

**One state change, and it is reversible.** Vision's bot-lane session
(`mvs_1dd69a42fec84f3ca0600075470232a4`) was **archived**: it had gone `aborted` and could not
accept the WI-120 verification, and the task record attached to it was cancelled. **Nothing live
was lost — the session was already dead — and archiving is reversible.** **It did not release the
dispatch slot**, which settles one thing: **the blocker is not a lane that can be archived.**
**Probe's live lane was left alone**, because archiving a session that may be mid-turn would
destroy real work on a guess, and the WI-116 pin is owed to that lane.

**What is still owed, stated plainly.** **WI-120's verification is queued at Probe**
(`task_f689f6b918a1`) and has not started. **The lead wrote that change and cannot accept its
own work**, so the item stays in `review` until Probe's verdict lands. **WI-121 is running.**
**WI-116 — the pin — is HELD behind Probe's lane.** And the owner's restart, authorised once
Cog's WI-086 turn landed, is the repair for the floor's **39 dead Chief turns** and for Wren's
lane; **this session has no non-destructive lever for it, and it is the owner's to call.**
