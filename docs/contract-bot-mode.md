# The bot mode — contract note

This is the contract note for WI-144. It is written for the integration owner,
who folds it into `CONTRACTS.md`. Nothing here changes `CONTRACTS.md` itself.

The bot mode lets the owner talk to one agent in a room — the **coordinator** —
and have that agent hand a bounded piece of work to another agent — a
**worker** — and get the worker's actual answer back, without the owner
kicking it off again. A third agent can **review** the result.

The coordinator is an external agent using an authorised product tool. The
server records the intent and enqueues; the worker runs the work; the result
comes back through the recorded handoff. The server never decides what a
worker should do and never writes a worker's answer.

---

## 1. The two new shapes

Both live in `packages/contracts/src/bot.ts`, exported from the package index
by one line.

### 1.1 The bot — a role and a scope in a room

```ts
type BotRole = 'coordinator' | 'worker' | 'reviewer';

interface BotScope {
  /** Whether the bot may delegate at all. */
  mayDispatch: boolean;
  /**
   * The agent connections this bot may hand work to. An empty list means
   * nobody: dispatching is a decision the owner granted, not a side effect of
   * sharing a room.
   */
  dispatchableAgentConnectionIds: string[];
}

interface Bot {
  id: string;
  workspaceId: string;
  conversationId: string;
  /** The connection the bot speaks through. */
  agentConnectionId: string;
  role: BotRole;
  displayName: string;
  scope: BotScope;
  createdAt: string;
}
```

A bot is **not** a new kind of agent. It is a role and a scope attached to an
agent connection that is already in the room. The role is a name and never a
colour; the scope is an allowlist and never a broadcast. An empty
`dispatchableAgentConnectionIds` means _nobody_, so a bot that was never given
a team cannot wake one by accident.

### 1.2 The handoff — the published `DelegatedTask`, extended

`CONTRACTS.md` → _Contract 7 — The interaction model_ → _The delegated work
tree_ publishes `DelegatedTask` and says the code does not implement it yet.
This slice implements it, and the handoff record **is** that shape — not a
second, differently-named concept. The published fields keep their names and
their meanings; the bot mode's fields are added alongside them:

```ts
interface DelegatedTask {
  // --- published, unchanged ---
  id: string;
  /** The turn that delegated the work. */
  parentTurnId: string;
  /** The agent connection that does the delegated work. */
  agentConnectionId: string;
  status: 'queued' | 'running' | 'stopping' | 'succeeded' | 'failed' | 'cancelled' | 'lost';
  /** The reference to the output: the message the worker answered with. */
  outputRef?: string;
  /** When the result reached the parent. */
  deliveredAt?: string;
  /** The consumption candidate, recorded when the parent read the output. */
  consumedAt?: string;

  // --- added by the bot mode ---
  workspaceId: string;
  /** The room the delegation came from. */
  conversationId: string;
  /** The room the delegated work ran in. It is not the parent's room. */
  childConversationId: string;
  /** The child turn that did the work. */
  childTurnId?: string;
  /** The connection that delegated the work. */
  parentAgentConnectionId: string;
  /** The role the delegated work was asked for. */
  role: BotRole;
  /** The factory task the work is tracked as. */
  taskId?: string;
  /** What the coordinator asked for. */
  instruction: string;
  /** What came back. */
  result?: string;
  /** The delivery message that carried the result into the parent's room. */
  deliveryMessageId?: string;
  /** The delegation depth of the child turn. */
  depth: number;
  createdAt: string;
  updatedAt: string;
}
```

There is **one** concept, not two: the _bot_ is the role and the scope, and
the _delegated task_ is the record of work handed over. A handoff is not a
bot, and a bot is not a handoff; the delegation names both ends.

### 1.3 Delivery is not consumption

This is the published rule and the slice keeps it:

- `deliveredAt` is written when the result **reached the room that asked**.
- `consumedAt` is written only when the turn that read the result **ended
  completed**. A parent that reads a result and then fails leaves the result
  unconsumed, so the next continuation finds it unconsumed again.

The client reads the difference: a handoff that was delivered and not consumed
reads as _Delivered, not used_ — a neutral notice with an icon, **not** the
accent and **not** the error colour. A consumed one reads as _Used_.

> **Partial.** The consumption _candidate_ and the confirmation are one column
> here, not two: `consumedAt` is written only at the moment of confirmation.
> A candidate that is never confirmed leaves the column empty, which is the
> behaviour the published contract asks for. There is no separate record of
> the candidate itself.

---

## 2. The lifecycle and its events

The published events are used, on the existing spine, with the existing
monotonic sequence:

```
delegation.started  →  delegation.delivered  →  delegation.consumed
```

Each carries the whole `delegatedTask`, and each is added to
`packages/contracts/src/events.ts` (the published event vocabulary) and to the
SSE client's event list.

| Event                  | When                                                                     | `status` after                                |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `delegation.started`   | The coordinator handed the work over and the child turn was queued.      | `queued`                                      |
| `delegation.delivered` | The worker answered (or failed); the result reached the room that asked. | `succeeded` / `failed` / `cancelled` / `lost` |
| `delegation.consumed`  | The room's turn read the result and ended completed.                     | unchanged                                     |

The status vocabulary is the published one, including `stopping` and `lost`.
`lost` is **settled**: it is never re-run, and it is not `failed`.

**How the child's outcome maps onto the published status set:**

| The child turn ended          | The delegation is |
| ----------------------------- | ----------------- |
| completed                     | `succeeded`       |
| failed                        | `failed`          |
| cancelled                     | `cancelled`       |
| unknown (outcome unconfirmed) | `lost`            |

> **Interpretation, flagged for the integration owner.** The published status
> set has no member for "started, outcome unconfirmed", so a child turn whose
> outcome could not be confirmed is settled as `lost`. It is settled and never
> retried, which is the published intent, but `lost` otherwise means "the
> executor no longer exists". If the published set is meant to grow an
> `unknown` member, this is the one place to change it.

**The tracked task** follows the factory's own rule — an agent reporting
completion is not acceptance:

| The delegation ended | The factory task is |
| -------------------- | ------------------- |
| `succeeded`          | `review`            |
| `failed`             | `blocked`           |
| `cancelled`          | `cancelled`         |
| `lost`               | `unknown`           |

The task is never moved to `done` by an agent. Only `POST /api/tasks/:id/accept`
closes it.

---

## 3. The routes

All of them are guarded with `requireAuth` and use the shared error envelope.

| Route                                          | What it does                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/conversations/:id/bots`             | Register a bot in a room, or change the one already there: `{ agentConnectionId, role, displayName?, scope? }`.                                                                                    |
| `GET /api/conversations/:id/bots`              | The team of a room and the work it has handed over: `{ bots, delegatedTasks }`.                                                                                                                    |
| `POST /api/conversations/:id/bots/dispatch`    | Hand work over on the coordinator's behalf: `{ coordinatorAgentConnectionId, agentConnectionId, instruction, title?, taskId? }`.                                                                   |
| `GET /api/features/bots/team?conversationId=…` | The bot feature's own read model — the same payload as the conversation route, under the feature's `apiPrefix` (`/api/features/bots`).                                                             |
| `GET /api/executions/:id`                      | **The turn**: its status, its delegation tree, and its committed revision. `capabilityView` and `committedRevision` are `null` (absent, not empty) because they are published and not implemented. |

The delegation tree hangs off the turn rather than off a route of its own: a
turn that delegated work carries that work, and a turn that was delegated
work carries the turn that delegated it. There is no second route for the
same turn.

---

## 4. The MCP product tool

```
bot.dispatch
  { conversationId, agentConnectionId, instruction, title? }
  → { delegatedTask, taskId, childTurnId }
```

- It is a **product tool**, in `mcpToolNames`, and it is **not** in
  `defaultAgentToolGrants`. A connection that may delegate is a connection
  the owner has said may delegate: `POST /api/agents/:id/grants` with
  `{ "tool": "bot.dispatch" }`. A connection that was not granted it does not
  have the tool registered at all — it does not appear in `tools/list`.
- The tool is the seam. The server records the intent, creates the delegated
  work, its tracked task and its child turn, and enqueues. The worker runs it.
- The tool is callable by an agent connection only. The owner's API route is
  the way in for the owner.

---

## 5. The rules that keep it honest

These are refusals, not warnings. Each one is a test.

1. **The scope decides.** A bot that may not delegate hands work to nobody. A
   bot may only hand work to the agents its scope names.
2. **The caller must be a bot of the room.** An agent that was never
   registered has no scope, so it delegates to nobody.
3. **The target must be a bot of the room**, and not a coordinator — a
   coordinator does not take delegated work.
4. **The connection must exist, be enabled, and be in the workspace.**
5. **Authority may narrow, never widen.** The delegated work would run on the
   worker's own connection, so the worker would bring its own tools with it.
   If the worker's effective MCP grants are not a subset of the coordinator's,
   the delegation is refused. A coordinator cannot launder a more privileged
   agent's authority.
6. **The depth limit holds.** A delegation's depth is the room's own chain
   depth plus one, and a delegation at or past `MAX_DELEGATION_DEPTH` is
   refused. The chain terminates on its own.
7. **The delivery wakes one agent.** The worker's result is delivered into the
   parent room, attributed to the worker, addressed to the coordinator that
   asked. It does not wake the room, and it does not create a new delegation
   chain unless the coordinator explicitly asks for one.

### 5.1 The one routing change

`apps/server/src/modules/conversations/routing.ts` gained one case, and it is
narrow:

> A worker's report of a delegated result wakes the coordinator that asked,
> and nobody else.

The report is marked (`RoutingInput.delegation`), and the marker is set by the
host that knows the delegation — never by anything a message says about
itself. Without the marker, the existing rule stands untouched: a non-coordinator
agent message still wakes nobody, and naming the coordinator explicitly is
still refused. The marker only changes what happens to **the coordinator that
the delegation names**.

Everything else in the routing safeguards is unchanged and still tested: an
agent message never wakes every participant, the turn limit, the depth limit,
the duplicate check, and the refusal of a delegation that names nobody.

---

## 6. What the owner can see

The team room (`/bots`, the client feature `feat_bots`) is dense, and shows:

- **the team** — who is in the room, each one's role as a name, and how many
  agents it may hand work to;
- **who is working** — a bot that is running wears the accent, and an idle
  bot wears nothing;
- **the handoffs** — who handed what to whom, what was asked for, the answer
  that came back, and the state of the tracked task;
- **delivery against consumption** — _Delivered, not used_ (neutral, with an
  icon) against _Used_.

The colour rules hold: the accent means live or waiting on the owner and
nothing else; `--color-err` is for failures and only failures; a caution is
neutral and always carries an icon; an agent's hue is an identity and never a
meaning; a counter is a count and never a ratio.

---

## 7. Limits, and what is deliberately not done

### Done

- The bot definition: role, scope, display name, per room.
- The dispatch tool, the routes, the isolated child room, the tracked task,
  the child turn.
- The delivery of the result into the parent room, attributed to the worker,
  addressed to the coordinator alone.
- The delegation tree on the turn route.
- The three lifecycle events.
- The team room in the client, including delivery against consumption.
- Delivery is not consumption: `consumedAt` is written only when the parent's
  turn ends completed.

### Partial

- **The owner cannot dispatch into a room where the coordinator has never
  answered.** A delegation hangs from a turn, so a parent turn has to exist.
  The refusal says so plainly ("Let it answer once first"), and the MCP path
  — a coordinator dispatching from its own turn — is unaffected. If the owner
  should be able to dispatch into a fresh room, the parent turn needs a
  meaning that does not exist yet.
- **The "reminded again" rule is only half there.** An unconsumed result stays
  in the room's history, so the coordinator sees the delivery again on its
  next turn — but there is no explicit "this result is still waiting" block
  in the prompt. The published rule is about the host reminding the parent;
  that prompt block is not written.
- **`stopping` is in the vocabulary but nothing enters it.** There is no route
  to call a delegation off, and no way to stop a child turn from the team
  room.
- **`lost` is settled by the mapping, not by a reaper.** Nothing detects that
  a worker holding a delegation has restarted and settles the delegation as
  `lost`; today `lost` is reached when a child turn's outcome cannot be
  confirmed.

### Not started

- **Steering.** The published `MessageDelivery = 'steer' | 'queue'` rule and
  `AgentCapabilities.acceptsSteering` are not used: a delegation always goes
  through the queue. A coordinator cannot steer a worker mid-task, and the
  degradation is not reported because steering is not offered at all.
- **The capability view and the committed revision** on `GET /api/executions/:id`
  are `null`. They are published and belong to WI-055.
- **`turn.committed`, the five-step commit, and the rest of WI-055.** The
  turn statuses this slice uses are the ones the code already has
  (`queued`, `running`, `completed`, `failed`, `unknown`); the published
  `TurnStatus` set with `blocked`, `committed`, `cancelled` and `lost` is
  not implemented here.

---

## 8. The files

| Where                                                 | What                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/contracts/src/bot.ts`                       | The bot, the scope, the delegated task, the dispatch request and result. |
| `packages/contracts/src/events.ts`                    | `delegation.started`, `delegation.delivered`, `delegation.consumed`.     |
| `packages/contracts/src/mcp.ts`                       | `bot.dispatch` in the tool names.                                        |
| `packages/contracts/src/index.ts`                     | One export line.                                                         |
| `apps/server/src/db/schema.ts`                        | The `bots` and `delegated_tasks` tables.                                 |
| `apps/server/src/modules/conversations/bots.ts`       | The bot service: register, list, dispatch, deliver, consume.             |
| `apps/server/src/modules/conversations/routing.ts`    | The one routing case, and its tests.                                     |
| `apps/server/src/modules/conversations/dispatch.ts`   | Carries the delegation marker.                                           |
| `apps/server/src/api/conversations.ts`                | The room's bot routes.                                                   |
| `apps/server/src/api/executions.ts`                   | `GET /api/executions/:id`, with the delegation tree.                     |
| `apps/server/src/modules/executions/service.ts`       | `get`, so the turn route can read a turn.                                |
| `apps/server/src/modules/mcp/server.ts`               | The `bot.dispatch` product tool.                                         |
| `apps/server/src/features/bots/feature.ts`            | The server feature and its read model.                                   |
| `apps/server/src/app.ts`, `context.ts`, `runtime.ts`  | The wiring.                                                              |
| `apps/worker/src/executor.ts`                         | The delivery of the result, and the consumption.                         |
| `apps/web/src/lib/bots.ts`                            | The client's types and the reading of a handoff's state.                 |
| `apps/web/src/features/bots/`                         | The client feature and the team room.                                    |
| `apps/web/src/lib/events.ts`                          | The three event names on the SSE client.                                 |
| `apps/server/drizzle/0011_friendly_otto_octavius.sql` | The migration: two new tables, nothing dropped.                          |

### The citations this slice moves

This slice adds code to nine files that `CONTRACTS.md` cites by line. The code
is where it honestly belongs, so the citations move instead. Every citation
`CONTRACTS.md` makes into a file this slice touches is listed here. The
"now" column is the code the sentence is about, at the line it points at today;
the last column is that same code after this slice. Every line in the last
column was checked to hold code and not a comment.

| Citation in CONTRACTS.md                                | What it points at now                                   | What it points at after this slice    |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `apps/server/src/api/executions.ts:21`                  | the `POST /api/executions/:id/resolve` route            | the same route, at line 45            |
| `apps/server/src/api/executions.ts:25`                  | the route's call into `executions.resolve`              | the same call, at line 49             |
| `apps/server/src/app.ts:194`                            | `app.setErrorHandler`                                   | the same handler, at line 215         |
| `apps/server/src/app.ts:226`                            | `registerApprovalRoutes(app)`                           | the same registration, at line 247    |
| `apps/server/src/app.ts:227`                            | `registerExecutionRoutes(app)`                          | the same registration, at line 248    |
| `apps/server/src/db/schema.ts:231`                      | the `spend_units` column, which defaults to zero        | the same column, at line 233          |
| `apps/server/src/db/schema.ts:330`                      | `created_by` on the automations table                   | the same column, at line 420          |
| `apps/server/src/db/schema.ts:416`                      | `created_by` on the tasks table                         | the same column, at line 506          |
| `apps/server/src/modules/conversations/dispatch.ts:171` | the execution row created with no spend units           | the same row, at line 180             |
| `apps/server/src/modules/conversations/dispatch.ts:247` | the dispatch's `unknown` audit record                   | the same record, at line 256          |
| `apps/server/src/modules/conversations/routing.ts:281`  | `deriveChainState`, computed in memory and never stored | the same function, at line 307        |
| `apps/server/src/modules/conversations/routing.ts:306`  | the one spend unit a turn costs                         | the same line, at line 332            |
| `apps/server/src/modules/executions/service.ts:93-95`   | the execution's status write                            | the same write, at lines 132-134      |
| `apps/server/src/modules/executions/service.ts:108-111` | the reply's status write                                | the same write, at lines 147-150      |
| `apps/server/src/modules/mcp/server.ts:429`             | `resource.create` taking the `template` input           | the same input, at line 483           |
| `apps/server/src/modules/mcp/server.ts:447-449`         | the merge into the template's spec                      | the same merge, at lines 501-503      |
| `apps/server/src/modules/mcp/server.ts:451`             | `resource.create`'s memory-ownership answer             | the same call, at line 505            |
| `apps/server/src/modules/mcp/server.ts:459`             | the template's id and version passed on                 | the same line, at line 513            |
| `apps/server/src/modules/mcp/server.ts:485`             | `resource.get`'s memory-ownership answer                | the same call, at line 539            |
| `apps/server/src/modules/mcp/server.ts:515`             | `resource.update`'s memory-ownership answer             | the same call, at line 569            |
| `apps/server/src/modules/mcp/server.ts:533-577`         | where the resource tools are registered                 | the same block, at lines 587-631      |
| `apps/server/src/modules/mcp/server.ts:720`             | the blocked capability's refusal record                 | the same record, at line 774          |
| `apps/worker/src/executor.ts:105`                       | the worker's `unknown` audit record                     | the same record, at line 110          |
| `apps/worker/src/executor.ts:112`                       | the worker's `unknown` record                           | the same record, at line 117          |
| `apps/worker/src/executor.ts:429`                       | the call into the ACP adapter's resume                  | the same call, at line 434            |
| `apps/worker/src/executor.ts:892-899`                   | the execution row and its spend units                   | the same row, at lines 987-994        |
| `apps/worker/src/executor.ts:1186-1191`                 | the execution row and its spend units                   | the same row, at lines 1281-1286      |
| `apps/worker/src/executor.ts:1426`                      | the chain's turn count against the policy               | the same check, at line 1521          |
| `apps/worker/src/executor.ts:1433`                      | the chain's spend against the policy                    | the same check, at line 1528          |
| `apps/worker/src/executor.ts:1440`                      | the workspace's spend for the day                       | the same check, at line 1535          |
| `apps/worker/src/executor.ts:1481-1491`                 | the workspace's daily spend                             | the same function, at lines 1576-1586 |
| `apps/worker/src/executor.ts:1482-1488`                 | the day the daily spend is counted over                 | the same lines, at lines 1577-1583    |
| `apps/worker/src/executor.ts:1521-1528`                 | the policy refusals the worker writes                   | the same records, at lines 1616-1623  |
| `apps/worker/src/executor.ts:1528`                      | the refusal when the policy refuses a turn              | the same record, at line 1623         |
| `packages/contracts/src/mcp.ts:10-26`                   | the `mcpToolNames` range                                | the same range, at lines 10-33        |
| `packages/contracts/src/mcp.ts:21-22`                   | the two published tool names                            | the same names, at lines 28-29        |
| `packages/contracts/src/mcp.ts:37-51`                   | the default agent grant set                             | the same set, at lines 44-58          |
| `packages/contracts/src/mcp.ts:47-48`                   | the default agent grant list                            | the same list, at lines 54-55         |

Two published **counts** move with the code, and the integration owner has to
re-point those as well:

| The published claim                                                                             | Today                        | After this slice             |
| ----------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------- |
| _Of the N mutating routes in `apps/server/src/api/`, M write an audit entry at the route level_ | 37 routes, 34 at route level | 39 routes, 36 at route level |

The two new mutating routes are `POST /api/conversations/:id/bots` and
`POST /api/conversations/:id/bots/dispatch`, and both write their audit entry
at the route level. The three routes that audit from the service layer are
unchanged, and so is the claim that **no** mutating route writes none.

The route table in `CONTRACTS.md` also grows: the four routes in section 3 that
are not there yet. Only the two `POST` ones are mutating, and only those two
move the count above.
