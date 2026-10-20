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

| #   | Want                                                                        | Said       | Verdict                                                                                   |
| --- | --------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| W-1 | "I see everything waiting on me in one place"                               | 2026-10-20 | accepted — [WI-004](../work/WI-004.md)                                                    |
| W-2 | Interaction — talking to agents is the job that should get genuinely better | 2026-10-20 | open — the bar for WI-004: an entry the owner can act on, not a link to a screen about it |
| W-3 | "Run within a stated scope"                                                 | 2026-10-20 | accepted — the scope is stated below                                                      |
| W-4 | "Only me" — one person runs the instance                                    | 2026-10-20 | accepted — no permissions, sharing or onboarding work                                     |
| W-5 | "dont rush to implement a feature when we havent discussed it" — and the product vision that came with it | 2026-10-20 | accepted — a strategy session, not a work item; the rule is recorded below          |

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

## Candidates

Gaps Chief found in the repository. These are **not** wants. They are
possibilities, and they become work only when the owner picks one or asks for
something that leads to it. Each names where it was seen.

| #    | Candidate                                                                                                                                 | Found in                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C-01 | An approval closes its execution instead of resuming the interrupted agent turn                                                           | ARCHITECTURE.md, known limitations                                                                      |
| C-02 | The event stream polls the event table every 250 ms instead of holding a connection to the worker                                         | ARCHITECTURE.md, known limitations                                                                      |
| C-03 | ACP sessions are created per turn instead of resumed, though the protocol supports it                                                     | ARCHITECTURE.md, known limitations                                                                      |
| C-04 | Only the OpenAI-compatible model API shape is implemented                                                                                 | ARCHITECTURE.md, known limitations                                                                      |
| C-05 | Milestone 05 is partially implemented — scoped autonomy policies, review and acceptance workflow, evidence capture                        | ARCHITECTURE.md, incremental build plan                                                                 |
| C-06 | The CLI adapter is supervised, not sandboxed                                                                                              | ARCHITECTURE.md, security posture                                                                       |
| C-07 | The instance has one owner; no teams, no sharing, no permissions                                                                          | ARCHITECTURE.md, known limitations                                                                      |
| C-08 | 55 kB of zod is in the first paint, because the client validates every event frame with the contracts schema                              | WI-001, Cog's report                                                                                    |
| C-09 | Four UI directions were built as prototypes; the owner has not chosen one, and direction D leaves the boundary between its two rooms open | `prototypes/README.md` — now [WI-006](../work/WI-006.md) prepares the recommendation, the owner chooses |
| C-10 | The panel can list an approval but cannot decide one — nothing in `apps/web` calls `POST /api/approvals/:id/decide`, and no code fetches `GET /api/approvals` | `apps/web/src`, WI-004 review, 2026-10-20 |

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
WI-004 does not depend on the visual language. **[WI-006](../work/WI-006.md)**
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
  item.** The owner's rule, 2026-10-20: *"dont rush to implement a feature
  when we havent discussed it."* The grilling is Matt Pocock's `grill-me`,
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
