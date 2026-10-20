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

| #   | Want                                                                                                      | Said       | Verdict                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W-1 | "I see everything waiting on me in one place"                                                             | 2026-10-20 | accepted — [WI-004](../work/WI-004.md)                                                                                                                                               |
| W-2 | Interaction — talking to agents is the job that should get genuinely better                               | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md); the bar for [WI-004](../work/WI-004.md) still applies |
| W-3 | "Run within a stated scope"                                                                               | 2026-10-20 | accepted — the scope is stated below                                                                                                                                                 |
| W-4 | "Only me" — one person runs the instance                                                                  | 2026-10-20 | accepted — no permissions, sharing or onboarding work                                                                                                                                |
| W-5 | "dont rush to implement a feature when we havent discussed it" — and the product vision that came with it | 2026-10-20 | accepted — a strategy session, not a work item; the rule is recorded below                                                                                                           |
| W-6 | Move the MiniMax Bot plugin's conversation-layer guarantees onto Personal OS's factory-grade ledger       | 2026-10-20 | accepted — [WI-006](../work/WI-006.md), [WI-007](../work/WI-007.md), [WI-008](../work/WI-008.md), [WI-009](../work/WI-009.md); the rest is in Candidates                             |

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

| #   | Decision                                                                                     | The answer                                                                                                     |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Q1  | Which ground the product is built on                                                         | An environment agents operate and extend — not a chat home; the factory is a part of it, not the whole of it    |
| Q2  | Does the human ever operate software, or only decide                                         | Only decide: direct, approve, accept. Agents do everything else. Connecting a new agent is a trust decision    |
| Q3  | What "native" means for an agent-created feature                                             | A typed, validated resource in our own contracts, authored through templates                                   |
| Q4  | Which two things "everyday productivity" means                                               | Tasks/work and documents. Not email, not calendar                                                              |
| Q5  | What "borrow without depending" means in practice                                            | **Corrected by the owner:** *"i want to use these as inspriation and then implement into our codebase against our spec"* |
| Q6  | What number proves "sustainable and agent-developed"                                         | The share of features authored by agents in-instance, and the share of operations done without the owner touching code; both shown in the panel |

**Q5 in the doctrine.** The owner's answer is now a rule in
[FACTORY.md](../FACTORY.md): *Borrow the idea, not the dependency.* Another
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

## Candidates

Gaps Chief found in the repository. These are **not** wants. They are
possibilities, and they become work only when the owner picks one or asks for
something that leads to it. Each names where it was seen.

| #    | Candidate                                                                                                                                                                 | Found in                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | An approval closes its execution instead of resuming the interrupted agent turn                                                                                           | ARCHITECTURE.md, known limitations                                                                                                                                                      |
| C-02 | The event stream polls the event table every 250 ms instead of holding a connection to the worker                                                                         | ARCHITECTURE.md, known limitations                                                                                                                                                      |
| C-03 | ACP sessions are created per turn instead of resumed, though the protocol supports it                                                                                     | ARCHITECTURE.md, known limitations                                                                                                                                                      |
| C-04 | Only the OpenAI-compatible model API shape is implemented                                                                                                                 | ARCHITECTURE.md, known limitations                                                                                                                                                      |
| C-05 | Milestone 05 is partially implemented — scoped autonomy policies, review and acceptance workflow, evidence capture                                                        | ARCHITECTURE.md, incremental build plan                                                                                                                                                 |
| C-06 | The CLI adapter is supervised, not sandboxed                                                                                                                              | ARCHITECTURE.md, security posture                                                                                                                                                       |
| C-07 | The instance has one owner; no teams, no sharing, no permissions                                                                                                          | ARCHITECTURE.md, known limitations                                                                                                                                                      |
| C-08 | 55 kB of zod is in the first paint, because the client validates every event frame with the contracts schema                                                              | WI-001, Cog's report                                                                                                                                                                    |
| C-09 | Four UI directions were built as prototypes; the owner has not chosen one, and direction D leaves the boundary between its two rooms open                                 | `prototypes/README.md` — [WI-010](../work/WI-010.md) is held: the owner is settling the direction in a strategy session, and Chief opens nothing new until the owner releases the queue |
| C-10 | The panel can list an approval but cannot decide one — nothing in `apps/web` calls `POST /api/approvals/:id/decide`, and no code fetches `GET /api/approvals`             | `apps/web/src`, WI-004 review, 2026-10-20                                                                                                                                               |
| C-11 | An agent has no memory of its own — `MemorySpec.scope` is `workspace \| conversation \| goal`, and the plugin gives every bot a scoped, budgeted memory of its own        | the MiniMax Bot brief §3.1, 2026-10-20 — a weaker version (pull memory scoped to the agents already in the conversation) may serve the same want without a second contract change       |
| C-12 | The loop-breaker counts, it does not observe — a ping-pong between two agents is stopped by a limit (depth, turns, duration, spend) rather than by "no new tool progress" | the MiniMax Bot brief, 2026-10-20 — excluded from [WI-009](../work/WI-009.md) on purpose                                                                                                |
| C-13 | Message reactions and per-agent usage statistics are missing                                                                                                              | the MiniMax Bot brief §4, 2026-10-20 — cosmetic; they solve nothing the owner is blocked on                                                                                             |
| C-14 | The event stream polls the event log every 250 ms instead of holding a connection to the worker — the plugin keeps an SSE stream with a keepalive and a per-chat cursor   | C-02, and the MiniMax Bot brief §3 TR-5, 2026-10-20 — an architecture decision (Chief's), not a product want                                                                            |
| C-15 | A delegated action returns a durable admission receipt that the owner never sees, so "queued" and "done" look the same from the panel                                     | the MiniMax Bot brief §2 row 6, 2026-10-20 — the plugin's rule is "a receipt is not completion"                                                                                         |

## The order

The four items the MiniMax Bot brief produced are all owned by Cog, and Cog
is one implementer. So the order is not a preference, it is the only thing
that can happen.

**WI-008 → WI-007 → WI-006 → WI-009.**

1. **WI-008** (outcome unknown) is first because it is the smallest, because
   its window is open _now_ — WI-004's front end is held, so landing it
   before that front end is finished avoids a second pass over the waiting
   list — and because WI-007's last criterion depends on it.
2. **WI-007** (approval resumes the turn) is second because it is the clearest
   interaction defect there is, and because it needs the `unknown` state to
   finish its last criterion.
3. **WI-006** (persona) is third because it is the largest item, and because
   one of its display criteria touches WI-004's front end, which is still
   held.
4. **WI-009** (coordinator-only handoff) is last because it is gated on an
   answer only the owner can give, and because the routing path is not on
   the owner's critical path the way the truthfulness of the waiting list
   is.

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

1. Probe lands `apps/server/src/__tests__/ownerPasswordRecovery.test.ts` —
   it is Probe's file and it is untracked, and WI-002 cannot be accepted
   while its verification is not in the repository.
2. WI-005's two verification scripts land clean, so `typecheck` is green
   again.
3. WI-002 closes, and only then does WI-009 start.

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
