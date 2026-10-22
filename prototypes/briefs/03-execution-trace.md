# Brief 03 — The execution trace

**Piece:** the item's piece 3. **Lands fourth.**
**Owner:** Cog. **Verifier:** Probe.

The conversation's companion: a gutter beside the transcript that makes an agent's
work legible rather than merely readable. It was out of scope under the Desk
recommendation and is part of the direction now.

## What it changes

**The Work room's right-hand column** (`prototypes/d-forge/theme.css:954-1000+`): a
monospace timeline of one execution's events, each row a node on a spine —
`tool.started`, `tool.completed`, `artifact.created`, `execution.status`. **No
spend counter:** the events carry no spend. The spend units live on the execution
row (`apps/server/src/db/schema.ts:231`) and are published by the **approval
evidence read** (`CONTRACTS.md:1047-1145`), whose code is **WI-086** and which
answers for one approval — so a trace of an arbitrary execution cannot show a
cost it was never given.

**Where the events come from: the live stream the panel already holds.** The event
vocabulary is already in the contracts (`packages/contracts/src/agent.ts:170-210`),
and the browser is already receiving those events over `GET /api/events`
(`apps/web/src/lib/events.ts:48`, with the API client in
`apps/web/src/lib/api.ts`). The trace is a surface over what already arrives at
the browser. **No server change.**

**The honest limit, stated here rather than discovered later.** There is no route
that reads an execution's events: the only client-visible channel is the stream,
and the stream primes the browser with the most recent 50 events
(`apps/server/src/api/events.ts:6`, `:35-41` — `PRIME_LIMIT` and the prime loop;
the drain that follows it fetches 200 at `:45`). So:

- while an execution is running, its trace fills in live, completely;
- an execution that finished before the browser connected has the trace the
  primed window happens to carry, which may be a line or may be nothing.

**A whole history needs `GET /api/executions/:id/events`.** That is a server route,
and the server is not this item's to change. It is named here as a separate item
for the lead: without it, the trace is a live instrument, which is what Deck's
gutter is, and not a history.

**The trace never invents an event.** It shows what arrived and nothing else, and
its empty state says what it is rather than showing an empty column.

## What it preserves

- **The conversation.** The transcript, the composer, the participants and the
  participant manager are untouched; the trace sits beside them.
- **The stream.** The trace reads what the panel already receives. It does not open
  a second connection, and it does not steal events from the queries that already
  depend on them.
- **The streaming text.** The reply still streams into the transcript exactly as it
  does.
- **The narrow screen.** The trace is the first thing to go when there is no room
  for it; the conversation never is.

## Acceptance criteria

- [ ] The trace shows `tool.started`, `tool.completed`, `artifact.created` and
      `execution.status` for the execution the conversation is showing.
- [ ] It fills in live, over the stream the panel already holds, with no second
      connection and no server change.
- [ ] **No spend counter.** The trace shows no cost, because the events carry
      none. Spend is published by the approval evidence read (WI-086), for an
      approval's own execution, and where it is shown it is an abstract counter
      (`spendUnits`), never as money.
- [ ] It shows only events that arrived. It does not infer, summarise away, or
      invent one.
- [ ] Its empty state says what it is — "no events yet" — rather than showing an
      empty column.
- [ ] The limit is visible to the owner: a trace that the browser cannot fill
      because the events are older than its window says so, instead of pretending
      the execution did nothing.
- [ ] The conversation still works with the trace collapsed, and the trace never
      crowds out the transcript.

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`.

## Not in scope

- **A route for an execution's event history.** It needs the server and its own
  item.
- **The conversation's behaviour.** The trace is a surface over data the product
  already keeps.
- **Money, and spend.** No spend counter is shown: the events carry none, and
  where spend is published — the approval evidence read, WI-086 — `spendUnits` is
  an abstract counter and stays one.
