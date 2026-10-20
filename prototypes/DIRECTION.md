# Direction — a recommendation, not a decision

**Written by:** Vision, for [WI-010](../.factory/work/WI-010.md).
**Written against:** commit `c734a99`, plus a working tree that is not clean. The
panel's landing page exists as uncommitted work — `apps/web/src/components/WaitingList.tsx`
is new and untracked, `apps/web/src/pages/Conversations.tsx` is modified and
uncommitted, and `apps/server/src/api/waiting.ts` is new and untracked. Every
statement below about "the landing page" describes those files, not a released
build.
**Status:** a recommendation. It is not a decision until the owner answers the
question at the end. The ADR that records the answer is `docs/decisions/0007-*.md`,
which is Wren's, and it is written after the owner confirms.

## The question, in one word

**Desk (B)?**

Confirm it, or name a different direction. Nothing else is needed to settle it.

## The recommendation

**B — Desk.** Warm paper, light, one vertical scroll that answers what needs
me, what is running, what exists, and a reading-width conversation column with
a plain-language side panel.

The panel's front door is a decision list, because the owner's own answer to
Q2 is that the human *decides* — directs, approves, accepts — and the agents do
everything else. B is the only direction whose home screen is that list, in
reading order, in a calm light surface, for one owner.

## The test this was judged by

The owner's decisions in `.factory/INTAKE.md` give a sharper test than taste.
A direction has to pass all four.

1. **Q2 — the human decides, and the panel surfaces only what needs the owner's
   authority.** Not what is interesting, not what is new, not what is running.
   Everything else is the agents' business.
2. **W-1 — "I see everything waiting on me in one place."** One list, one place,
   not three screens to reconcile.
3. **W-2 — talking to agents is the job that should get genuinely better.** The
   conversation is a first-class surface, not a tab.
4. **Q6 — the product reports on itself.** The two measures — the share of
   features authored by agents in-instance, and the share of operations done
   without the owner touching code — have to be visible in the panel.

And one constraint that is not a test but a veto: the stated scope says the
panel is not a project dashboard, and the instance has one owner with no
permissions, sharing or onboarding.

A general form of this test, proposed here and not decided: *does this make the
environment better for the next agent, or only better for this turn?* It is
offered as a candidate for the factory's standing questions, because the
factory will meet wants that do not fit the queue, and it needs a line to draw.

## Why B

**It is the decision surface, in the order the owner decides.** B's home leads
with what needs the owner, in a single scroll, and every entry in it is
something the owner can act on. That is W-1 and Q2 in the same screen, and
nothing in it is decoration. A has the same list, but the list is not what the
page is *about* — see below.

**It is built for one owner.** One vertical scroll, light, calm, no spatial
navigation to learn. The instance has one user. A console sized for a control
room is the wrong furniture for one person.

**It gives W-2 a real surface.** B's conversation is a reading-width column
with a plain-language side panel — participants, safeguards, artifacts. Talking
to an agent is the job, and this is the room it happens in.

**It carries Q6's two measures without growing a screen.** They belong in a band
on the home, under a heading like "what the environment did on its own": the
share of features authored by agents in-instance, and the share of operations
completed without the owner touching code. That is a band, not a dashboard, and
it sits in the same place the owner already looks.

**It is the cheapest of the four, and cheapest is a real argument here.** One
implementer, four items already queued behind a red tree. B is closest to the
existing stack, which means the direction decision costs the factory the least
of the four options it has.

## Why not A — Deck

**Rejected. Its spine is the wrong instrument for the owner's role.** A promotes
the event stream from an implementation detail to the primary navigation
surface. The panel then answers "what just happened" — which is the panel as a
monitor of agent activity, the exact identity this product does not want. Q2
says the human decides; a live event stream is a fine place to *watch* and a
poor place to *decide*. It is also the largest behavioural change of the four:
every surface in A is an inspector over one stream.

**Harvested: the trace gutter.** It is not mock. `packages/contracts` carries
`tool.started`, `tool.completed`, `artifact.created` and `execution.status`,
and spend is already tracked as an abstract counter (`spendUnits`), so "what the
agent is doing" is in the data model today. The gutter is a component that
belongs to the conversation surface, and it will land inside B's language when
it gets its own item. It is not part of this direction, and this item does not
build it.

## Why not C — Orbit

**Rejected, and not deferred.** A constellation answers "who is working", not
"what needs you". The owner is one person with a handful of agents; the map is
a picture of a system that does not exist yet. C is also the hardest of the
four to keep legible as agents and threads grow, it introduces a genuinely new
component, and it has nowhere natural for Q6's two measures. The question it
answers best is one a single owner does not have. If the instance ever has many
owners and many agents, the data model can support it, and it becomes worth
revisiting then.

## Why not D — Forge

**Rejected for three reasons, and the open boundary is settled below anyway.**

**Its orientation room is the project dashboard the scope rules out.** D puts
Orbit's spatial language in the orientation room, and it puts dashboards
there too. The scope says the panel is not a project dashboard, and Q2 says the
panel surfaces what needs the owner's authority and nothing else. A screen of
factory operations is the coordination view built for its own sake.

**A direction that needs a second decision is not one decision.** D puts the
map and the dashboards in one room and the conversation in the other, and the
factory board, the agent list and the automation runs could reasonably belong
to either. Adopting D is adopting a direction and then immediately making
another decision about where half the product lives.

**It is the most expensive of the four.** Two rooms, two densities, a new
component and a dashboard screen, for the one implementer who is already four
items behind.

**Harvested: D's one-material rule.** One accent with one meaning — amber
always means live or waiting on you, structure and data stay in their own
colours. That rule belongs to B too, and it is the reason the two Q6 measures
can be read at a glance instead of being decoration.

**If you say Forge instead, the boundary is settled like this:** the factory
board, the agent list and the automation runs do *not* go in the orientation
room. They are what needs the owner's authority, so they belong in the
execution room, next to the conversation, where a decision can be taken. The
orientation room keeps the map and nothing else. That is the version of D that
would be worth building, and it is not the version on the table.

## The cost of adopting B now, concretely

**Preserved from the landing page that is already written.** `WaitingList.tsx`
keeps everything that is not visual language: one request to `GET /api/waiting`,
the derived list, the event-driven invalidation, the "one thing is one entry"
rule, and the loading, empty and error states. `Conversations.tsx` keeps the
landing route. No data model, no contract, no server behaviour changes — the
list is derived on the server and does not depend on how it looks. The
component survives; its appearance does not.

**Reworked: the theme layer.** `apps/web/src/index.css` carries the whole
current language in one `@theme` block — a cool slate scale, an indigo accent,
a mono font token — and a dark base (`bg-slate-950 text-slate-100`) on the
body, plus three `.pos-*` component classes. B replaces that with a warm paper
scale, a terracotta accent, and a light base. The `darkMode: 'class'` variant
is already declared, so a dark variant can stay available; B is a light base,
not the deletion of dark. B also pairs a serif for headings, and there is no
serif token today — one new token.

**Reworked: the classes that name the old palette.** 195 lines across 32 files
mention `slate-` or `indigo-` directly. 29 of them are in `packages/ui` —
`primitives.tsx`, `card.tsx`, `button.tsx`, `input.tsx` — and the other 166 are
in app code, the heaviest being `TaskBoard.tsx` (19), `Settings.tsx` (19),
`ChatMessageList.tsx` (15), `AppShell.tsx` (14), `Login.tsx` (11) and
`ConversationDetail.tsx` (11). This is the real cost of a direction change and
it is not a small one: it is one theme edit, one pass over the shared
primitives, and a pass over the app's own components.

**Reworked: the two screens that carry the product.** The landing page becomes
B's three bands — what needs me, what is running, what exists — with the
Q6 measures in a fourth, short band. The conversation page becomes a
reading-width column with a plain-language side panel, which is a layout
change to `ConversationDetail.tsx` and `ChatMessageList.tsx`.

**Not touched.** The server, `packages/contracts`, the database, CI, the
dependency set, the lockfile. Nothing in this direction changes behaviour, so
nothing in it needs a contract change.

**Not in this cost.** The trace gutter, the constellation graph and the
dashboard are all out. The expensive part of the four directions — a new
component, a second room, a second density — is the part B does not buy. That
is most of why B is the cheapest.

## What this recommendation does not do

It does not build anything, and it does not change the panel's behaviour. It
names one direction, rejects three with reasons, settles the boundary Forge
leaves open, and states what adopting B costs today. The trace gutter, the
constellation and the dashboard are each a behaviour change and each needs its
own brief and its own owner. When the owner answers, Chief opens the work item
that builds the direction, and Wren writes the ADR.
