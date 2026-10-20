# Direction — Forge (D)

**Written by:** Vision, for [WI-010](../.factory/work/WI-010.md).
**Written against:** commit `235f97c` (2026-10-21), clean working tree.
**Owner decision, 2026-10-21: D — Forge.** The recommendation had been B (Desk).
The owner chose D. This document is rewritten for D: the rejections, the
settled boundary and the cost model are all D's now. The reasoning that chose
B is kept in "What the recommendation was, and why it changed" at the end,
because a decision that does not say what it rejected is not a decision, and
the owner deserves the record of what was rejected on their behalf.
**Status:** a decision, taken by the owner. The item that builds it is Chief's
to open; the ADR that records it is `docs/decisions/0007-*.md`, and it is
Wren's.

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

**The rule.** *If it is a picture of the system, it is in the orientation room.
If it is a place where work is inspected or decided, it is in the execution
room.*

| Surface | Room | Why |
| --- | --- | --- |
| The constellation (the map) | Orientation | It is the picture of the system. |
| The agent list | Orientation | The constellation **is** the agent list, spatialised. A flat roster beside it would build the same information twice, and the map is the better version. |
| The factory board | Execution | It is a dense, stateful view of work in flight, and it behaves like the trace. |
| The automation runs | Execution | Same. They are live instrumentation, not a picture of the system. |
| The dashboards | Orientation | They are bound to data sources the owner configured. |

**The one deliberate crossing, and why it exists.** The Map's **Needs you**
rail is the only place that crosses from orientation into work on purpose:
**it carries the decision controls.** WI-004 was returned to `implement` on
2026-10-21 for exactly this reason — the panel could list an approval and
could not decide one, because the criterion says an approval is approved or
rejected *where the list is*. A Forge panel that links out to the conversation
for a decision would re-create that defect inside a bigger frame. So the rail
is not a summary that links away; it is the decision surface, and Work is where
you go when the rail's summary is not enough.

**The owner's top want is safe.** W-1 — *"I see everything waiting on me in one
place"* — is satisfied by one rail on the landing screen. The honest caveat is
in the risk section below: in Forge the map is what the page is *about* and the
rail sits beside it, so the list is present rather than primary.

## Why D, against the test

D was judged against the owner's own settled answers, and it passes all four —
but it is the direction that passes with the most to carry, so the reasoning is
recorded honestly rather than generously.

1. **Q2 — the human decides, and the panel surfaces only what needs the
   owner's authority.** Forge's Needs-you rail is that surface, and the
   boundary above puts every decision in the execution room where it is taken.
   The orientation room is the one place the panel is allowed to show the
   system *for its own sake*, which is why the rule above is about pictures and
   not about numbers.
2. **W-1 — everything waiting on me in one place.** One rail, on the landing
   screen, carrying the count and the actions. The risk is real and is stated
   below.
3. **W-2 — talking to agents is the job.** The Work room is a conversation
   with the execution trace beside it, and the trace is the surface that makes
   an agent's work legible rather than merely readable.
4. **Q6 — the product reports on itself.** The two measures go in the Map's
   counters band, which becomes the self-report: features authored by agents
   in-instance, and operations completed without the owner touching code.

**One rule travels with the direction.** *No ratio whose denominator is zero.*
For a long while the honest value of "the share of features authored by agents"
is zero or undefined, because no agent has authored a feature in-instance yet.
A panel that greets its owner with 0% reads as broken, and the product's first
report on itself must not be a lie by omission. Show the counts — N features, M
operations — and show the ratio only when there is a denominator to divide by.

## The cost of adopting D now, concretely

D is the most expensive of the four, and it is expensive in **structure**, not
in paint. That distinction is the whole cost model, so it is worth stating
plainly before the numbers.

**The material is closer to what already exists than the alternative was.**
Forge's base is dark, with hairline borders and a single accent family. The
current app is already a dark base (`bg-slate-950 text-slate-100`) with hairline
borders and one accent (`indigo-`). The neutral scale re-hues — Forge's base is
`#07060d`, a violet-black, against slate-950's `#020617` — but the scale
survives, and with it most of the 215 call sites that name a `slate-` token.
Forge's theme is one variable block (`--bg`, `--surface`, `--border`, `--text`,
`--muted`, `--faint`, `--accent`, `--live`, `--ok`, `--warn`, `--err`,
`--info`), not a second design system.

**The palette pass, line by line** (reproduce with
`git grep -c -E '<token>' -- 'apps/web/src' 'packages/ui/src'`):

| Token | Lines | Files | Under Forge |
| --- | --- | --- | --- |
| `slate-` | 215 | 34 | The neutral scale. Re-hued in place, the call sites do not move; renamed, all 215 do. **The adoption item picks one.** Re-huing in place is the cheaper and is what the prototype's variable block assumes. |
| `indigo-` | 34 | 14 | Becomes violet (`--accent: #a78bfa`). One bulk rename of a single token family. |
| `amber-` | 10 | 6 | **The only semantic collision in the palette.** See below. |
| `red-` | 26 | 19 | Maps to `--err: #fb7185`. Survives. |
| `emerald-` | 9 | 7 | Maps to `--ok: #34d399`. Survives. |
| `violet-` | 0 | 0 | New. |
| `cyan-` | 0 | 0 | New. |

**The amber collision, named exactly.** Forge's rule is *amber always means
live or waiting on you*. Ten lines across six files use amber today, and **four
of them mean something else**: `ConversationDetail.tsx:349` and `:504`, and
`ResourceEditor.tsx:263` and `:264` are caution blocks, not liveness. Under
Forge they read wrong — a caution would look like something waiting on the
owner. The fix is semantic, not chromatic, and it is four lines: Forge's own
theme sets `--live` and `--warn` to the same value (`#fbbf24`), so there is no
second amber to move them to, and they need to become neutral or use `--err`.
The remaining six amber usages — `AppShell.tsx:37` and `:170`, and
`StatusBadge.tsx:30` — are already liveness or waiting, which is why the
current app was closer to Forge's rule than it looked.

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
   and `execution.status`, with spend as an abstract counter (`spendUnits`).
   All of it is already in the contracts, so this is a surface over existing
   data — which is also what makes it worth having.
5. **Agents get an identity hue.** Forge's theme carries one `--agent-*` token
   per agent, so each agent connection has a colour in the panel. The current
   app has no equivalent concept. It lines up with the persona work: an agent
   has a name, a role and now a hue.

**Preserved from what is already written.** The waiting list keeps everything
that is not visual language: one request to `GET /api/waiting`, the derived
list, the event-driven invalidation, the "one thing is one entry" rule, and the
loading, empty and error states. No data model, no contract, no server
behaviour changes — the list is derived on the server. In Forge it becomes the
Needs-you rail, and it **gains** the decision controls that WI-004's criterion
requires.

**Not touched.** The server, `packages/contracts`, the database, CI, the
dependency set, the lockfile. Nothing in this direction changes behaviour, so
nothing in it needs a contract change.

**Not in this cost.** The undo surface, which the Desk recommendation
discussed, is still not in scope: the second half of the owner's authority —
*show me what happened, let me take it back* — has no surface in the product
today. The substrate is there (resources and automations carry `revision` with
`expectedRevision`, and `auditLog` records who did what to what), and an undo
is a surface over data the product already keeps rather than a new data model.
It needs its own brief and its own owner, because authority without
reversibility is exposure: with one owner there is no second operator to
absorb a bad action.

## The risk, stated plainly

**In Forge the map is the hero, and the list is beside it.** Desk led with the
decision list, so W-1 was the page. Forge leads with the constellation, so W-1
is a rail. That is a real difference in habit, not in capability: an owner
whose actual loop is "scan the list and act" will find Forge's landing screen
decorative before they find it useful.

Two mitigations, and the second is the load-bearing one:

1. The rail's count is always visible, and the rail is never a route away from
   the landing screen.
2. **The rail carries the decision controls**, so the loop is "scan and act"
   *in place* — the owner never leaves the landing screen to approve, reject
   or accept. That is the mitigation that makes Forge's landing surface an
   inbox rather than a map with a notification badge.

**Forge is a large build for one implementer who already has eight items
ahead of it** (WI-003, WI-004, WI-006, WI-007, WI-012, WI-016, WI-017,
WI-018) and two more in verify. That is the honest cost of this direction and
it belongs in the build item's sizing, not in a footnote.

## Sequencing

**The decision control is not blocked by the direction, and should not wait
for it.** The inbox is already a component. The control can be built now in the
current language, and the adoption then wraps the finished control in Forge's
Needs-you rail. What the adoption re-lays-out is the *layout* of the list, not
the control inside it.

**Forge lands as one visible change.** Light tokens with dark cards and dark
page backgrounds read as broken, not as transitional — and that rule applies
to Forge too, which is the one place Forge is *not* a warm coat of paint. The
palette pass and the structure pass are the same pass.

**The order that follows from that:**

1. Build the decision control, in the current language. (WI-004.)
2. Build Forge as one visible change: the three surfaces, the material, the
   trace, the constellation, the dashboards, and the finished control in the
   rail.
3. Write the ADR as a section of 0007.

## What was recommended, and why it changed

The recommendation before the owner's answer was **B — Desk**, on this
reasoning, which is kept because it is the record of what was rejected on the
owner's behalf and by how much.

- **B — Desk.** Rejected. Warm paper, light, Today-first: a single vertical
  scroll answering what needs me, what is running, what exists, and a
  reading-width conversation column. It is the cheapest of the four and
  closest to the existing stack. It was recommended because it is the only
  direction whose home screen *is* the decision list, which is W-1 and Q2 in
  the same screen. **Against it: it is a warm-paper rebuild of a dark panel**,
  a serif added to a product that has no serif, and a 195-line palette
  rewrite to buy a three-band scroll. It buys the least structure of the four.
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
material that re-hues rather than replaces. **What it saves:** a 195-line
palette rewrite, a new serif token, and a light/dark inversion across the
whole panel.

## What this document does not do

It does not build anything, and it does not change the panel's behaviour. It
names the direction the owner chose, settles the boundary Forge left open,
states what adopting it costs today, and records what was rejected. The
constellation, the dashboards screen, the trace and the per-agent hues are each
a build item with its own owner. The ADR is Wren's, and it is written after
this, not before.
