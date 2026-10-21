# Direction — Forge (D)

**Written by:** Vision, for [WI-010](../.factory/work/WI-010.md).
**Written against:** commit `3479c31` (2026-10-21).
**The tree is not clean.** At the time of writing, `apps/web/src/components/WaitingList.tsx`,
`apps/web/src/components/ChatMessageList.tsx`, `apps/web/src/lib/types.ts`,
`apps/server/src/modules/approvals/resume.ts`, `apps/server/src/modules/conversations/service.ts`,
`packages/contracts/src/conversation.ts` and others are modified in the working tree.
**Every number in this document is measured at `3479c31`, not at the working tree**, and
the commands that reproduce them name the commit. A re-measure on the working tree
gives a different answer, and naming the commit is what makes the two comparable.
**The code pointers are pinned at `0d4731f` (2026-10-22).** Every `file:line` in
this document was read at that commit, not at `3479c31` and not at the working
tree. A pointer is the one kind of claim here that goes stale without anything in
the document changing, so the commit it was read at is named next to it: a reader
checking against a later tree should re-measure the pointers rather than trust
them. **A claim about what the tree does or does not contain is pinned the same
way.** The evidence read is named as missing **at `0d4731f`**, because the route
that answers it is being written on another branch and will change that.
**Owner decision, 2026-10-21: D — Forge.** The recommendation had been B (Desk).
The owner chose D. This document names the direction the owner chose, settles the
boundary Forge left open, states what adopting it costs today, and records what was
rejected on the owner's behalf — because a decision that does not say what it
rejected is not a decision.
**Status:** a decision, taken by the owner. The item that builds it is **WI-024**
(Cog). The ADR that records it is `docs/decisions/0007-*.md`, and it is Wren's.

---

## The decision

**D — Forge.** The hybrid: an **orientation room** in Orbit's spatial language
and an **execution room** in Deck's dense, instrumented language, held together
by one material — a dark base, hairline borders, violet for structure, cyan for
data, amber always meaning live or waiting on you.

The three surfaces, as the prototype has them:

- **Map** — the orientation room. The constellation, the counters, the tiles,
  and an instrument rail carrying **Needs you** and **Live pulse**.
- **Work** — the execution room. The conversation with the **execution trace**
  beside it.
- **Dashboards** — bound data sources, with the widget bindings visible.

## The boundary Forge leaves open, now settled

The prototype README records the open question: D puts the map and the
dashboards in one room and the conversation in the other, but **the factory
board, the agent list and the automation runs could reasonably belong to
either.** A direction that inherits an open boundary is not a decision, so
here is the rule and the answers.

**The rule.** _If it is a picture of the system, it is in the orientation room.
If it is a place where work is inspected or decided, it is in the execution
room — with two declared exceptions, the Needs-you rail and the constellation,
which carry decisions in the orientation room because a decision is taken where
the list is._

| Surface                     | Room        | Why                                                                                                                                                      |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The constellation (the map) | Orientation | It is the picture of the system.                                                                                                                         |
| The agent list              | Orientation | The constellation **is** the agent list, spatialised. A flat roster beside it would build the same information twice, and the map is the better version. |
| The factory board           | Execution   | It is a dense, stateful view of work in flight, and it behaves like the trace.                                                                           |
| The automation runs         | Execution   | Same. They are live instrumentation, not a picture of the system.                                                                                        |
| The dashboards              | Orientation | They are bound to data sources the owner configured.                                                                                                     |

**The two deliberate crossings, and why they exist.** Two surfaces cross out of
the orientation room to carry a decision, and they are the only two.

1. **The Map's Needs-you rail carries the approvals' decision controls.** WI-004
   was returned to `implement` on 2026-10-21 for exactly this reason — the panel
   could list an approval and could not decide one, because the criterion says
   an approval is approved or rejected _where the list is_. A Forge panel that
   links out to the conversation for a decision would re-create that defect
   inside a bigger frame. So the rail is not a summary that links away; it is
   the decision surface, and Work is where you go when the rail's summary is
   not enough.
2. **The constellation carries the connect decision.** The owner's answer on Q2
   makes connecting an agent a trust decision, and the orientation room is a
   room where, as a rule, nothing is decided — so a map that could list an
   agent and not connect one would fail the criterion WI-004 was returned for.
   The constellation **is** the agent list, spatialised, so the connect
   decision stays with it rather than with a roster somewhere else.

**The reason is one reason, given once.** A decision is taken where the list
is. The rail is the list of what is waiting on the owner; the constellation is
the list of the agents. Each carries the decision that belongs to its own list,
and neither sends the owner to another room to take it.

**What the rail can actually do, stated to the line.** The rail carries
**Approve and Reject** for approvals — WI-004's control, already built at
`a2aadb4`, on the row at `apps/web/src/components/WaitingList.tsx:307-322`
(Approve at `:313`, Reject at `:321`), posting to the existing
`POST /api/approvals/:id/decide` at `:113`.
**It does not carry acceptance.** A task's acceptance is decided on the factory
board, on the card, at `apps/web/src/components/TaskBoard.tsx:315-318`, reached
from the rail by a link that opens the exact card. That is the product's own
shape, stated in the list's own comment: _"An approval is a request inside a
conversation and a turn happened inside one, so the conversation is where they
are read. A task is decided on the factory board, and the link opens the exact
card so the decision is one click away."_
(`apps/web/src/components/WaitingList.tsx:353-360`) No open item owns putting an
acceptance control on the rail, and building one is a separate item that needs
the owner.

**The owner's top want is safe.** W-1 — _"I see everything waiting on me in one
place"_ — is satisfied by one rail on the landing screen. The honest caveat is
in the risk section below: in Forge the map is what the page is _about_ and the
rail sits beside it, so the list is present rather than primary.

## Why D, against the test

D was judged against the owner's own settled answers, and it passes all four —
but it is the direction that passes with the most to carry, so the reasoning is
recorded honestly rather than generously.

1. **Q2 — the human decides, and the panel surfaces only what needs the
   owner's authority.** Forge's Needs-you rail is that surface, and the
   constellation's connect control is the other. The rule above governs where
   content lives; the rail and the constellation are its two declared
   exceptions, because the decision and the list have to be in the same place.
   The orientation room is the one place the panel is allowed to show the
   system _for its own sake_, which is why the rule is about pictures and not
   about numbers.
2. **W-1 — everything waiting on me in one place.** One rail, on the landing
   screen, carrying the count and the approve and reject controls. The risk is
   real and is stated below.
3. **W-2 — talking to agents is the job.** The Work room is a conversation
   with the execution trace beside it, and the trace is the surface that makes
   an agent's work legible rather than merely readable.
4. **Q6 — the product reports on itself.** The two measures go in the Map's
   counters band, which becomes the self-report: features authored by agents
   in-instance, and operations completed without the owner touching code.

**Two rules travel with the direction.** Any adoption of Forge has to honour
both, and they are rules by the document's own word.

1. **_No ratio whose denominator is zero._** For a long while the honest value
   of "the share of features authored by agents" is zero or undefined, because
   no agent has authored a feature in-instance yet. A panel that greets its
   owner with 0% reads as broken, and the product's first report on itself must
   not be a lie by omission. Show the counts — N features, M operations — and
   show the ratio only when there is a denominator to divide by.
2. **_One accent with one meaning — amber always means live or waiting on
   you._** Violet is structure, cyan is data, and amber is the one colour that
   means the owner is needed. Every amber usage in the panel is measured against
   that meaning, which is why the palette's one semantic collision is named
   below rather than waved through.

## The cost of adopting D now, concretely

D is the most expensive of the four, and it is expensive in **structure**, not
in paint. That distinction is the whole cost model, so it is worth stating
plainly before the numbers.

**The material is closer to what already exists than the alternative was.**
Forge's base is dark, with hairline borders and a single accent family. The
current app is already a dark base (`bg-slate-950 text-slate-100`) with hairline
borders and one accent (`indigo-`). The neutral scale re-hues — Forge's base is
`#07060d`, a violet-black, against slate-950's `#020617` — but the scale
survives, and with it the 310 occurrences of `slate-` across 216 lines in 34
files. Forge's theme is one variable block (`--bg`, `--surface`, `--border`,
`--text`, `--muted`, `--faint`, `--accent`, `--live`, `--ok`, `--warn`, `--err`,
`--info`), not a second design system.

**The palette pass, line by line.** Measured at `3479c31`. Lines and files come
from `git grep -c -F '<token>' 3479c31 -- 'apps/web/src' 'packages/ui/src'`;
occurrences come from `git grep -o -F '<token>' 3479c31 -- 'apps/web/src'
'packages/ui/src' | Measure-Object -Line`.

| Token      | Lines | Files | Occurrences | Under Forge                                                                                                                                                                                                  |
| ---------- | ----- | ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slate-`   | 216   | 34    | 310         | The neutral scale. Re-hued in place, the occurrences do not move; renamed, all 310 do. **The adoption item picks one.** Re-huing in place is the cheaper and is what the prototype's variable block assumes. |
| `indigo-`  | 34    | 14    | 46          | Becomes violet (`--accent: #a78bfa`). One bulk rename of a single token family.                                                                                                                              |
| `amber-`   | 10    | 6     | 20          | **The only semantic collision in the palette.** See below.                                                                                                                                                   |
| `red-`     | 26    | 19    | 60          | Maps to `--err: #fb7185`. Survives.                                                                                                                                                                          |
| `emerald-` | 9     | 7     | 16          | Maps to `--ok: #34d399`. Survives.                                                                                                                                                                           |
| `violet-`  | 0     | 0     | 0           | New.                                                                                                                                                                                                         |
| `cyan-`    | 0     | 0     | 0           | New.                                                                                                                                                                                                         |

**The amber collision, all ten of them.** Forge's travelling rule is _amber
always means live or waiting on you_, and ten lines across six files use amber
today. **Eight of the ten are caution or interruption, not liveness**, and
naming them is the whole fix:

| Usage                                            | What it says today                            | Under Forge                                                        |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/components/AppShell.tsx:37`        | status dot while the stream is `reconnecting` | Interruption. Not liveness, not waiting.                           |
| `apps/web/src/components/AppShell.tsx:170`       | badge: "live updates interrupted"             | Interruption.                                                      |
| `apps/web/src/pages/ConversationDetail.tsx:349`  | routing blocked notice                        | Caution.                                                           |
| `apps/web/src/pages/ConversationDetail.tsx:504`  | conversation paused notice                    | Caution.                                                           |
| `apps/web/src/components/ResourceEditor.tsx:263` | resource conflict notice                      | Caution.                                                           |
| `apps/web/src/components/ResourceEditor.tsx:264` | the same conflict notice's text               | Caution.                                                           |
| `apps/web/src/components/StatusBadge.tsx:30`     | connection status `degraded`                  | Caution.                                                           |
| `packages/ui/src/card.tsx:63`                    | the `warning` card variant                    | Caution.                                                           |
| `apps/web/src/components/TaskBoard.tsx:293`      | the acceptance block, border                  | **Waiting on the owner — and it doubles as a caution.** See below. |
| `apps/web/src/components/TaskBoard.tsx:294`      | the same block's text                         | As above.                                                          |

The fix is semantic, not chromatic, and it is a named list rather than a
number: Forge's own theme sets `--live` and `--warn` to the same value
(`#fbbf24`), so there is no second amber to move the eight caution usages to.
They become neutral or use `--err`.

**And the miscount hid a second defect.** The acceptance block at
`TaskBoard.tsx:293-294` renders for **both** `review` and `unknown`, under one
amber treatment, for two different messages: _"The agent reported that it
finished. That is not acceptance — decide here whether the criteria are
actually met."_ and _"The agent started this and we cannot confirm how it
ended. It may already have run — check it, and decide here whether the
criteria are met."_ The first is a wait; the second is a caution. Under a rule
that gives amber one meaning, they must not share a treatment, so the build
item has to split them.

**The structural pass, which is where the money is.**

1. **Three surfaces and a room switch.** The top bar gains Forge's room
   navigation (Map / Work / Dashboards). `AppShell.tsx` changes shape, not
   just colour. Three routes, one material, two densities.
2. **The constellation is a genuinely new component.** An SVG graph of agents
   and threads, with a live spoke for agents working now and a thread drawn as
   the subgraph its agents share. The data is real — agent connections,
   conversations, participants — and the prototype hand-places the nodes, so
   the build item needs a real layout algorithm and a legibility rule for
   growth. This is the single hardest piece of any of the four directions and
   Forge does not avoid it; it inherits it from Orbit.
3. **The dashboards screen is Forge-only.** Widgets bound to a data source's
   payload, with the bindings visible rather than implied. The contracts
   already carry it: `dashboardSpec` (widgets, bindings, `refreshSeconds`) and
   `dataSourceSpec` (`json`, `http`, `sqlite`).
4. **The execution trace is now in scope.** It was out of scope under the Desk
   recommendation and it is now part of the direction: the conversation's
   companion, carrying `tool.started`, `tool.completed`, `artifact.created`
   and `execution.status`. Those four event types are in the contracts
   (`packages/contracts/src/agent.ts:179-208`), and **none of them carries
   spend**. Spend is not on the events: the abstract counter (`spendUnits`,
   `packages/contracts/src/common.ts:58`) is held on the execution's own row
   (`apps/server/src/db/schema.ts:231`), and it is published by the
   approval-evidence read — `GET /api/approvals/:id/evidence` — whose contract
   is published (`CONTRACTS.md:1047-1145`) and whose code is **WI-086** — **not
   in the tree at `0d4731f`**. So the trace is a surface over existing data for
   the events, and a surface over a read that does not exist yet for the cost.
5. **Agents get an identity hue.** Forge's theme carries one `--agent-*` token
   per agent, so each agent connection has a colour in the panel. The current
   app has no equivalent concept. It lines up with the persona work: an agent
   has a name, a role and now a hue.

**Preserved from what is already written.** The waiting list keeps everything
that is not visual language: one request to `GET /api/waiting`, the derived
list, the event-driven invalidation, the "one thing is one entry" rule, and the
loading, empty and error states. No data model, no contract, no server
behaviour changes — the list is derived on the server. In Forge it becomes the
Needs-you rail, and it **keeps** the decision control WI-004's criterion
required, which is already built at `a2aadb4` and verified. The adoption
changes the layout it sits in, not the control inside it.

**Not touched.** The server, `packages/contracts`, the database, CI, the
dependency set, the lockfile. Nothing in this direction changes behaviour, so
nothing in it needs a contract change.

**Not in this cost.** The undo surface, which the Desk recommendation
discussed, is still not in scope: the second half of the owner's authority —
_show me what happened, let me take it back_ — has no surface in the product
today. The substrate is there (resources and automations carry `revision` with
`expectedRevision`, and `auditLog` records who did what to what), and an undo
is a surface over data the product already keeps rather than a new data model.
It is **C-21**, and W3 numbers it and defers it for capacity.

## The risk, stated plainly

**In Forge the map is the hero, and the list is beside it.** Desk led with the
decision list, so W-1 was the page. Forge leads with the constellation, so W-1
is a rail. That is a real difference in habit, not in capability: an owner
whose actual loop is "scan the list and act" will find Forge's landing screen
decorative before they find it useful.

Two mitigations, and the second is the load-bearing one:

1. The rail's count is always visible, and the rail is never a route away from
   the landing screen.
2. **The rail decides in place**, so the loop is "scan and act" _in place_ —
   the owner never leaves the landing screen to approve or reject. That is the
   mitigation that makes Forge's landing surface an inbox rather than a map
   with a notification badge.

**The third authority is not on the rail, and the loop is not entirely in
place.** Acceptance is decided on the board, one link away, and the risk
paragraph above is true of two of the three authorities rather than three of
three. The honest form of the promise is the one WI-024 now carries: the rail
**carries the decision controls it actually has** — approve and reject — and
acceptance is reached by a link that opens the exact card. Putting an
acceptance control on the rail is a separate item, and it needs the owner.

**Forge is a large build for one implementer whose lane held fifteen open
items at `3479c31`** (WI-003, WI-007, WI-008, WI-017, WI-018, WI-020,
WI-021, WI-024, WI-027, WI-028, WI-031, WI-032, WI-033, WI-035, WI-040). The
live count moves as the factory moves, so this is a count at a commit and not a
standing total. That is the honest cost of this direction and it belongs in the
build item's sizing, not in a footnote.

## Sequencing

**The decision control is not blocked by the direction, and does not need to
wait for it.** WI-004's control is already built and verified. What Forge
changes is the layout the control sits in, and the inbox is already a
component, so the adoption wraps the finished control in the Needs-you rail.
What the adoption re-lays-out is the _layout_ of the list, not the control
inside it.

**Forge lands as one visible change.** Light tokens with dark cards and dark
page backgrounds read as broken, not as transitional — and that rule applies
to Forge too, which is the one place Forge is _not_ a warm coat of paint. The
palette pass and the structure pass are the same pass.

**The order that follows from that:**

1. Forge as one visible change: the three surfaces, the material, the trace,
   the constellation, the dashboards, and the finished control in the rail.
   (WI-024.)
2. Write the ADR as a section of 0007, after the answer, not before.

## What was recommended, and why it changed

The recommendation before the owner's answer was **B — Desk**, on this
reasoning, which is kept because it is the record of what was rejected on the
owner's behalf and by how much.

- **B — Desk.** Rejected. Warm paper, light, Today-first: a single vertical
  scroll answering what needs me, what is running, what exists, and a
  reading-width conversation column. It is the cheapest of the four and
  closest to the existing stack. It was recommended because it is the only
  direction whose home screen _is_ the decision list, which is W-1 and Q2 in
  the same screen. **Against it: it is a warm-paper rebuild of a dark panel**,
  a serif added to a product that has no serif, and a rewrite of the same 216
  lines and 310 occurrences that Forge re-hues — with the dark base inverted
  to a light one and a new font token on top. It buys the least structure of
  the four.
- **A — Deck.** Absorbed rather than rejected. A's trace gutter is now part of
  Forge's execution room, and A's dense instrumented language is the
  execution room's language. A alone was rejected: it promotes the event
  stream from an implementation detail to the primary navigation surface, so
  the panel answers "what just happened" — a fine place to watch and a poor
  place to decide.
- **C — Orbit.** Absorbed rather than rejected. C's constellation is now the
  orientation room. C alone was rejected: a constellation answers "who is
  working", not "what needs you", and it is the hardest of the four to keep
  legible as agents and threads grow. That difficulty is Forge's now, and it
  is priced in the cost section rather than argued away.

**What the change costs that the recommendation did not:** a new component
(the constellation), a third surface (dashboards), a room switch, and a
material that re-hues rather than replaces. **What it saves:** a rewrite of
the 310 occurrences, a new serif token, and a light/dark inversion across the
whole panel.

## What the decision surface still needs

The direction is a layout. Three things the owner's role depends on are not
part of it. One has an item now; two are still candidates, and they are named
here while the briefs are still unwritten.

**The decision needs its context in the room where the decision is taken.**
Under this direction the decisions live on the Map's rail and the execution
trace is the Work room's companion. That splits a decision from the evidence
for it: the owner would leave the landing screen to learn what the agent did,
in order to decide on the landing screen. The rail's mitigation only holds if
the evidence is on the rail too. So the trace item must carry two scopes — the
conversation's companion in the Work room, **and** the decision's context
where the control is: what the agent did, what it produced, what it cost, in
the drawer the control opens. The events are already in the contracts
(`tool.started`, `tool.completed`, `artifact.created`, `execution.status` —
`packages/contracts/src/agent.ts:179-208`), so those are a surface over what
the product already records. **The cost is not one of them.** The execution's
spend units are held on its own row (`apps/server/src/db/schema.ts:231`) and
published by the approval-evidence read, `GET /api/approvals/:id/evidence`,
whose contract is published and whose code is **WI-086**. **This is now
WI-039** (the contract half, landed at `6406291`), **WI-086** (the read that
answers it, not in the tree at `0d4731f`) and **WI-040** (the control shows the
evidence it decides on).

**The waiting list has a way in and no way out.** The published vocabulary
carries `approval.requested` and `task.updated`; it carries no
`approval.decided`, and the decide route publishes nothing. So every way of
_needing_ the owner pushes into the list, and no way of _not_ needing the owner
pushes out of it. A decided approval leaves the row only when something else
publishes, or the safety-net refetch catches it. For the one surface the owner
judges the product by, "nothing is waiting on me" has to be true now, not
eventually. This is **C-16** and **C-22**, and it is the owner's nod, because
it is a contract change.

**The second half of the authority is still missing.** Reversibility: the undo,
over a substrate the product already keeps. It has no item — **C-21**, and W3
numbers it as WI-035 and defers it for capacity. A decision the owner cannot
take back is a decision taken under duress, and with one owner there is nobody
else to absorb the mistake.

## What this document does not do

It does not build anything, and it does not change the panel's behaviour. It
names the direction the owner chose, settles the boundary Forge left open,
states what adopting it costs today, and records what was rejected. The
constellation, the dashboards screen, the trace and the per-agent hues are each
a build item with its own owner, and the build is WI-024. The ADR is Wren's,
and it is written after this, not before.
