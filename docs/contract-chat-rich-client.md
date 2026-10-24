# The chat surface — contract notes

WI-141 gives the conversation surface a first-class chat client: Markdown,
tool activity, previews and run controls. These are the notes the integration
owner needs to fold into `CONTRACTS.md`; `CONTRACTS.md` itself was not
touched by this item.

## The contracts that were added

`packages/contracts/src/chat.ts` is new. It publishes:

| Shape                                                                   | What it is                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `turnStatusSchema`                                                      | The turn's status, in the vocabulary Contract 7 publishes: `queued`, `running`, `blocked`, `completed`, `committed`, `failed`, `cancelled`, `unknown`, `lost`.                             |
| `messageDeliverySchema`                                                 | `steer` or `queue`, as Contract 7 publishes it.                                                                                                                                            |
| `turnCapabilityViewSchema`                                              | The capability view Contract 7 publishes, field for field.                                                                                                                                 |
| `delegatedTaskSchema`                                                   | The delegated work tree Contract 7 publishes: delivery and consumption kept apart.                                                                                                         |
| `chatActivitySchema`                                                    | One thing an agent did: the turn it belongs to, its kind, the published event name, the tool's name, the input and the output, the state, the timestamps and the one line the owner reads. |
| `runStateSchema`                                                        | The **client-side** state of a run: `idle`, `running`, `stopping`, `stopped`, `unsupported`, `unknown`.                                                                                    |
| `runControlOptionSchema`                                                | One operation — `stop`, `steer`, `queue` — with whether it can be used and, when it cannot, why.                                                                                           |
| `turnViewSchema`, `chatActivityReadModelSchema`, `stopTurnResultSchema` | The read model behind a turn and the answer to a stop request.                                                                                                                             |

### The client state and the published statuses

`runState` is deliberately **not** the published turn status. It is the
client's view of the run, and it maps onto the published statuses like this:

| Client state  | Means                                                        | Published status it stands for                                     |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `idle`        | No turn is running.                                          | `queued`, `blocked`, or a turn that has settled.                   |
| `running`     | A turn is running.                                           | `running`.                                                         |
| `stopping`    | A stop was requested; the runtime may still finish the turn. | None yet — it becomes `cancelled` when the turn really reaches it. |
| `stopped`     | The turn was cancelled.                                      | `cancelled`.                                                       |
| `unsupported` | The runtime cannot do this at all.                           | None.                                                              |
| `unknown`     | The turn started and nobody can say how it ended.            | `unknown`.                                                         |

`committed` and `lost` are rendered apart from `completed`: the panel says
"completed" for a turn whose adapter returned, and it would say "committed"
for a turn whose output is in canonical history. The code does not produce
`committed` or `lost` yet — WI-055's commit protocol and delegation tree do —
so the panel has nothing to render for them today.

### The additive changes to `conversation.ts`

- `contentPartSchema` grew two members: `attachment` (a resource id, a display
  name and an optional mime type) and `image` (the same, plus an optional
  location). The three older members are unchanged, so a message written
  before this grew still parses.
- `postMessageInputSchema` grew `delivery`, defaulting to `queue`. A client
  written before this change behaves exactly as it did.

## The routes

Both routes live in `apps/server/src/api/executions.ts` and are guarded with
`requireAuth`.

| Route                      | Method | What it does                                                                                                                    |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `/api/executions/:id`      | GET    | The turn: its status, its capability view, its delegation tree, its committed revision — and the activity read model behind it. |
| `/api/executions/:id/stop` | POST   | Records a stop request and answers with what actually happened.                                                                 |

`GET /api/executions/:id` is the route Contract 7 publishes. The activity is
part of that answer rather than a second route for the same turn: the trace
the panel draws is a read model of the turn, and a second route with another
name would be a second way of asking about the same turn.

The response is:

```ts
{
  turn: {
    id, conversationId, agentConnectionId, status, error, spendUnits,
    startedAt, finishedAt,
    capabilityView: null,      // the view the turn was admitted with; absent, not empty
    delegatedTasks: null,      // absent, not empty
    committedRevision: null,   // the revision the turn committed to; null when it committed to none
    correlationId: null,       // the id that ties the turn to its events
  },
  activities: ChatActivity[],
  run: { state: RunState, options: RunControlOption[] },
}
```

A turn's `status` is `committed` when its output is in canonical history and
`completed` when the adapter merely returned. The two are different facts, and
the `committedRevision` is how a client tells them apart without reading the
history.

`POST /api/executions/:id/stop` answers with `{ executionId, outcome, detail,
run }`, where `outcome` is one of:

| Outcome       | When                                                                                              | What it says                                           |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `cancelled`   | The turn had not started and its queued job was cancelled.                                        | The turn will not run.                                 |
| `requested`   | The turn was already running, or its job had already been claimed.                                | The runtime was asked and may finish the current turn. |
| `not_running` | The turn had already finished, was waiting on an approval, or its outcome could not be confirmed. | There was nothing to stop.                             |

A stop request is never presented as a confirmed cancellation. The request is
written to the audit trail under `execution.stop.requested` whether or not it
could be carried out, and the read model reads that trail, so a panel that
reloads still knows that the stop was asked for.

## The panel

The conversation surface is now the Forge prototype's room: a dense transcript
with an execution-trace gutter beside it.

- **The transcript.** The owner's own words sit in a bubble on their side, and
  an agent's reply is prose on the page — the border and the panel that used
  to put a box around every paragraph an agent wrote are gone, so a
  conversation reads as a conversation rather than as a log. A reply carries
  its actions, and the only action is copying its words: every other thing
  that can be done to a turn changes the state of the product, and the product
  says so in its own words rather than through an icon in the corner of a
  message. The column that holds the conversation is the one that scrolls, and
  it follows the output while the reader is at the bottom and lets go the
  moment they scroll away.
- **The server's account of a turn.** A turn's `detail` is shown as it is
  given, under the owner's own words as well as under an agent's. The client
  does not reword what the server said happened, because a reader who is told
  a turn was refused has to be able to trust that the refusal is the server's
  and not the panel's opinion of it.
- **Markdown.** An agent's words are drawn as Markdown — headings, lists,
  tables, and code blocks with a copy button and a language label. The
  security line is in `apps/web/src/components/chat/markdownBlocks.ts`: raw
  HTML is shown as characters, and a link's address is checked before it
  reaches an `href`.
- **The trace.** The gutter is derived from the event log, so it is still
  there after a reload. Each row is a dot, a time and a sentence: the
  published event name, the tool's name, the state, and the duration when
  both ends of it are known. A row expands to its input and its output.
- **The run controls.** Stop, steer and queue are three different things and
  stay three different things. A control that cannot be used says why, in
  the words the server gave.
- **Presence.** Who is in the room, each with their own orb in their own
  hue and the adapter that speaks for them.
- **Attachments.** The composer attaches a resource that already exists and
  the panel resolves its title from the resource API.

The accent still means one thing — live, or waiting on the owner. The trace's
live row, the streaming badge and the approval row wear it; nothing else
does. An agent's hue is an identity, taken from the same ring the map uses.

## What the integration owner has to change in `CONTRACTS.md`

Nothing. The integration has been done, and `CONTRACTS.md` carries the chat
surface already:

- `GET /api/executions/:id` and `POST /api/executions/:id/stop` are in the
  HTTP surface table, with what the stop actually did.
- The mutating-route count is 42, and every mutating route writes an audit
  entry at the route level.
- The server's own sentence about how a message ended is published as
  `detail`, and the client is told to show it as it is given rather than
  rewording it.

The `contractPointers` gate holds the citations into the code those claims
name, and the `published-shapes` test holds the counts.

## The dependency

`marked@18.1.1` was added to `apps/web`. It is MIT, it has no dependencies of
its own, and it is recorded in `docs/dependency-licences.json` with the
licence read from `node_modules/marked/LICENSE`.

It is used for **parsing only**. The panel renders the parsed tokens itself,
which is what keeps the security line: raw HTML is never enabled and never
becomes markup — a paragraph carrying `<script>` is shown as the characters
`<script>` — and a link's address is checked before it is put in an `href`,
so a `javascript:` address degrades to plain text.

`@shadcn/react@0.3.1` was added to `packages/ui`. It is MIT, it has no
dependencies of its own, and it is recorded in
`docs/dependency-licences.json` with the licence read from
`node_modules/@shadcn/react/LICENSE.md`.

It is used for **the message scroller only** — the engine that follows the
output while the reader is at the bottom and lets go when they scroll away.
The message, the bubble and the scroller's own parts are this repository's
own, written against the composition shadcn/ui publishes and keeping its
`data-slot` names exactly, so that a component written against upstream's
markup keeps working here. The dependency is one package and no transitive
trees, and it was taken because the scroll-following behaviour is the part
worth not re-deriving.

## What is deliberately not done

- **A steer reaches only a turn that captured a steering capability.** The
  run control reads the turn's captured view rather than the connection's live
  one, so a turn admitted without steering says why it cannot be steered
  instead of offering a steer that would go nowhere. A steer that cannot be
  delivered is a queued message, and the reason it could not be delivered
  rides back with the result — a steer that quietly became a queue is a lie
  the owner did not agree to.
- **A stop is a request, and the runtime may finish the turn it is in.** The
  worker holds the live adapter session and the API server never runs an
  agent, so the stop route asks the worker rather than reaching the runtime
  itself. The panel says what the server said would happen, in the server's
  words.
- **Attachments are by reference.** The resource API has no upload path, so
  the composer attaches a resource that already exists and the panel resolves
  its title from the resource API. The route's own content union accepts the
  older `file` part; when it adopts the contract's `contentPartSchema`, the
  `attachment` part carries the display name and the mime type on the message
  itself.
- **Images are drawn from a location, not from bytes.** The `image` part
  carries a resource id and an optional URL. A message row stays small and the
  resource stays the one place the picture lives.
