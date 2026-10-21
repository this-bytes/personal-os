# Brief 01 — Rooms and surfaces

**Piece:** the item's piece 1, three surfaces and a room switch. **Lands second.**
**Owner:** Cog. **Verifier:** Probe.

`AppShell.tsx` changes shape, not just colour. Three routes, one material, two
densities.

## What it changes

**The room switch.** The top bar gains Forge's room navigation (`Map / Work /
Dashboards`, `prototypes/d-forge/theme.css:170-214`): a pill of three links with a
dot on the active room. It replaces nothing that is lost — the current navigation
(`AppShell.tsx:22-29`) is the room's contents, and each room holds what belongs in
it.

**The rooms.** The boundary rule decides what is in which room, and the rule is
now settled and corrected: _if it is a picture of the system, it is in the
orientation room; if it is a place where work is inspected or decided, it is in the
execution room — with one declared exception, the Needs-you rail._ The rail is
brief 05's.

| Surface | Room | Where it goes |
| ------- | ---- | ------------- |
| The constellation (the map) | Orientation | the Map room's canvas — brief 06 |
| The agent list | Orientation | it **is** the constellation, spatialised. A flat roster beside it would build the same information twice |
| The factory board | Execution | a view in the Work room |
| The automation runs | Execution | a view in the Work room |
| The dashboards | Orientation | the Dashboards room — brief 04 |
| The conversation | Execution | the Work room's transcript, with brief 03's trace beside it |
| The built resources | Orientation | the Map room's tiles |

**The landing screen.** The root route lands on the **Map room**, and the
Conversations page moves out of the root into the **execution room**: its thread
list becomes the Work room's left column and its waiting list becomes the Map's
rail (brief 05). The old routes keep working — a deep link to a conversation, a
card on the board, a resource — because a URL is not a room.

**Why the old landing page leaves the root.** It is the decision list today, and a
decision list is not what a landing screen should be: the owner opens the panel to
orient and to work, and a room that greets them with a queue of decisions before
they can see the system is the wrong first impression. The decision list itself
does not go away and the owner does not leave the landing screen to decide — the
rail is in the Map room and it decides in place, which is the boundary rule's one
declared exception and the direction's second mitigation. **What changes is that
the decision list is no longer the page, and what is on the page is the system.**

**The one place this room and the execution room overlap.** The conversation's
thread list is in the Work room and the rail is in the Map room, and both hold
rows that link to each other. That is the boundary working, not breaking: a
picture links to the work, and the work links back to the picture.

**Two densities.** Orientation is airy and the execution room is dense; the
prototype's `body.dense` switch (`theme.css:67-78`) is the mechanism, and it is
what makes the two rooms read as one product rather than two screens that share a
stylesheet. The ornament follows: the Map room carries the aurora field
(`theme.css:84-121`), the Work room does not — it is the dense, instrumented
language, and a blurred field behind a trace gutter is noise.

**The counters band.** The Map room's band of counters (`theme.css:318-360`) is
where the product reports on itself, and the band follows the direction's second
travelling rule: **no ratio whose denominator is zero.** It shows the counts — N
features, M operations — and shows a ratio only when there is a denominator to
divide by. A panel that greets its owner with 0% reads as broken, and the product's
first report on itself must not be a lie by omission.

The counts come from what the panel already reads: the resources and the agent
connections behind "features authored by agents in-instance" (a resource's
`createdBy` against the agent ids), and the automations behind "operations
completed". Where the data behind a measure does not exist yet, the band shows
nothing for it — not a zero, not a ratio. A missing measure is not a zero
measure.

**The Live pulse.** The rail's second section: the recent activity on the event
stream the panel already holds (`apps/web/src/state/events.tsx`). It is an
instrument, not a control, and it belongs to the rail's frame — named here so that
brief 05's half of the rail is not mistaken for the whole of it.

## What it preserves

- **The shell's gate.** `RequireAuth` still decides who is in, and the login screen
  is still eager on purpose.
- **One chunk per route.** The lazy loading is kept: the owner stays on one screen
  at a time, and the first paint is the shell plus the route that was asked for.
- **Every page's behaviour.** The pages keep their data, their queries and their
  actions. A room is a layout; the things inside it still do what they did.
- **The workspace switcher, the stream indicator, the sign-out.** The shell's
  furniture is Forge's furniture too.
- **The deep links.** `/conversations/:id`, `/factory?task=…`, `/agents`,
  `/resources`, `/automations`, `/settings` all keep working, because a URL is
  not a room and the rail's links depend on it.
- **The waiting list's behaviour** (brief 05's, restated here because the landing
  page moves): one request, the derived list, the event-driven invalidation, the
  three states, the one-thing-one-entry rule.

## Acceptance criteria

- [ ] The room switch is in the top bar, and the active room is marked.
- [ ] The root route lands on the Map room.
- [ ] Every surface in the boundary table is in the room the rule puts it in, and
      the rule's one declared exception is the rail.
- [ ] The two densities are real: the execution room is denser than the
      orientation room, and the difference is the material's, not a different
      stylesheet.
- [ ] The counters band shows counts, and **shows no ratio whose denominator is
      zero**. A measure with no data behind it shows nothing, not a zero.
- [ ] The deep links still work, and the rail's links still land where they landed.
- [ ] The pages inside the rooms still do what they did.

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`. The browser suite matters here more than anywhere else: the
rooms are a navigation change, and a navigation change that only works in the type
checker has failed.

## Not in scope

- **The rail's contents.** Brief 05.
- **The trace, the dashboards, the constellation.** Briefs 03, 04 and 06. This
  brief builds the rooms they move into and the frames they sit in.
- **Any behaviour change.** A direction changes how the panel looks and how it is
  laid out, not what it does.
