# Brief 05 — The Needs-you rail

**Piece:** the item's piece 5, WI-004's control wrapped. **Lands third.**
**Owner:** Cog. **Verifier:** Probe.

This is the brief the direction document's fifth defect is load-bearing for, so it
is worth saying the correction plainly before the work starts.

## The correction, in the rail's own words

The direction document promised the owner that they "never leave the landing screen
to approve, reject **or accept**". **The rail cannot accept.** Acceptance is decided
on the factory board, on the card (`apps/web/src/components/TaskBoard.tsx:310-329`),
reached from the rail by a link that opens the exact card, and **no open item owns
putting an acceptance control on the rail**.

So the rail says what it can do, and nothing more:

- It carries **Approve** and **Reject** for approvals, in place, on the row.
- It carries the **two conclusions on a turn** that WI-031 added: *it ran* and *it
  did not run* (`414996c`).
- It does **not** carry acceptance. A task that is waiting for acceptance says so,
  and the link opens the exact card on the board where the decision is taken.

Building an acceptance control on the rail is a separate item and it needs the
owner. This brief does not quietly build one, because an unowned decision surface
is the kind of thing this factory keeps finding.

**The boundary rule the rail is the exception to.** The rule is: _if it is a picture
of the system, it is in the orientation room; if it is a place where work is
inspected or decided, it is in the execution room — with one declared exception,
the Needs-you rail, which carries decisions in the orientation room because a
decision is taken where the list is._ The rail is not a summary that links away; it
is the decision surface, and Work is where you go when the rail's summary is not
enough.

**And the landing page is not the list any more.** The item's rule, as corrected on
2026-10-21, is that the **root route is the Map room** and the **Needs-you rail
sits on it** — the decision list is the rail, the rail decides in place, and the
owner never leaves the landing screen to approve or reject. What moves into the
execution room is the **Conversations page** (brief 01), not the decision list. The
owner's loop stays "scan and act" — in one room, in place.

## What it changes

**Where the waiting list lives.** It moves off the Conversations page and into the
Map room's rail, as the **Needs you** section, re-laid-out to the prototype's rail
(`prototypes/d-forge/theme.css:510-553`): each waiting item is a card with its
reason, its detail and, where it has one, its decision control. The list's own
logic does not change — the layout it sits in does.

**The rail's frame and its other half.** The rail component itself — its heading,
its count, its frame — and the **Live pulse** section beside it, which shows the
recent activity on the event stream the panel already holds. The Live pulse is not a
control and is not this brief's decision surface; it is part of the instrument rail,
and it is named here so that it is not lost between two briefs.

**The note after a decision.** The server's sentence about what the decision did is
shown under the rail, naming the item it is about, and it outlives the item — the
note does not vanish when the thing it is about leaves the list.

## What it preserves

Everything that is not visual language. WI-004's landing page is preserved in
behaviour, not in shape:

- **One request.** The rail still asks `GET /api/waiting` once, and the list is
  still derived on the server. The client does not join three lists.
- **The derived list.** The server decides what is waiting and why. The rail draws
  it.
- **The event-driven invalidation.** The list still refreshes from the event
  stream; it does not poll.
- **One thing is one entry.** A pending approval that belongs to a task is that
  task, and the task does not appear beside it. A turn a pending approval accounts
  for is not drawn again.
- **The three states.** Loading says what it is loading; empty says *Nothing is
  waiting on you*; a list that could not be loaded says *The waiting list could not
  be loaded* and is **not** an empty list.
- **The row's fields and its copy.** The item's title, its reason and the server's
  detail are shown as they are given. The client does not reword what the server
  said.
- **The links.** A task links to its exact card on the board; an approval or a
  turn links to the conversation it belongs to.
- **The decision control itself.** WI-004's control is taken as it is. The
  control is not rebuilt, and the server's route behind it is not touched.

**And WI-031's line.** The server's sentence on the turn's reply is already in the
tree at `414996c`; the rail shows what it is given and does not reword it.

## Acceptance criteria

- [ ] The rail carries Approve and Reject on an approval row, in place, and the
      decision reaches the server through the same route as before.
- [ ] The rail carries *it ran* and *it did not run* on a turn row.
- [ ] **The rail does not carry an acceptance control**, and a task waiting for
      acceptance says so and links to the exact card on the board.
- [ ] The rail's boundary is the direction's declared exception, and the build
      follows the corrected rule rather than the version the document carried
      before 2026-10-21.
- [ ] One request to `GET /api/waiting`, and the list is still derived on the
      server.
- [ ] The list still refreshes from the event stream.
- [ ] One thing is one entry: a pending approval that belongs to a task is that
      task, and a turn a pending approval accounts for is not drawn twice.
- [ ] The loading, empty and error states are all still there, and a list that
      could not be loaded is still not an empty list.
- [ ] The note after a decision names the item it is about and outlives the item.
- [ ] The client shows every sentence the server gives it without rewording it.
- [ ] The old landing page is gone as a separate page: the decision list is in the
      rail, and the landing screen is the Map room.

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`. The browser suite is this brief's gate as much as the others:
the rail's decisions are decided in place, and that has to be true in the browser.

## Not in scope

- **An acceptance control on the rail.** It needs the owner and its own item.
- **The waiting list's behaviour.** One request, the derived list, the
  invalidation, the states and the rule are preserved, not re-decided.
- **The server.** No route changes, no contract changes, no data model.
- **The panel's wording.** The server produces the sentences; the client shows
  them.
