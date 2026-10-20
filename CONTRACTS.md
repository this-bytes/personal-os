# Contracts

These are the published contracts of Personal OS. Everything that crosses a process
boundary — HTTP, MCP, the worker queue, adapter events — is defined here, and the
authoritative schema lives in [`packages/contracts`](packages/contracts).

Contract rules:

1. A published contract is not changed without an explicit migration and
   compatibility story.
2. Domain modules do not redefine these shapes.
3. Extensions are additive and are marked as such below.

---

## Contract 1 — Conversations

Conversations are the centre of the product. A conversation works with one agent,
multiple agents, or with no active agent at all.

Each external agent maintains its own runtime context; Personal OS owns the shared
conversation history.

```ts
type ID = string;

type RoutingMode = 'mentions' | 'coordinator' | 'autonomous';

interface Conversation {
  id: ID;
  workspaceId: ID;
  title: string;
  routingMode: RoutingMode;
  coordinatorId?: ID;
  createdAt: string;
}

interface Participant {
  id: ID;
  conversationId: ID;
  type: 'human' | 'agent';
  agentConnectionId?: ID;
  displayName: string;
}

interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  targetParticipantIds: ID[];
  replyToId?: ID;
  kind: 'text' | 'system' | 'artifact' | 'activity';
  content: ContentPart[];
  createdAt: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'artifact'; resourceId: ID }
  | { type: 'file'; resourceId: ID };
```

### Additive extensions

The implementation adds three fields, all optional and all required by production
behaviour:

```ts
interface Message {
  // ...
  status?: 'streaming' | 'complete' | 'failed';
  correlationId?: ID;
  origin?: {
    kind: 'human' | 'agent' | 'system' | 'automation';
    actorId: ID;
    agentConnectionId?: ID;
    depth: number;
  };
  executionId?: ID;
}
```

`status` lets a client render a partially streamed answer. `correlationId` ties every
turn derived from one human request together. `origin` records who spoke and how far
the delegation chain has travelled — the basis of the echo-loop guard.

### Routing behaviour

**Mentions mode.** Only explicitly addressed agents receive a turn.

**Coordinator mode.** A designated agent receives the request and may delegate to
other participants according to its capabilities and authorisation.

**Autonomous mode.** Agents may initiate or continue exchanges within the
conversation's granted scope and limits.

These modes control routing, not agent intelligence.

### Mandatory routing safeguards

- An agent-generated message does not automatically trigger every other participant.
- All routed turns have a correlation id and an origin.
- Echo loops and repeated processing of the same event are prevented.
- Configurable turn, time and spending limits apply.
- Only one owner is responsible for coordinating a particular delegation.
- Pausing a conversation prevents Personal OS from dispatching new turns.
- An agent cannot gain additional permissions simply by being added to a group.

In autonomous mode, an explicit initiation policy is required — a user-approved
objective, a bounded schedule or an authorised trigger.

The system must never create an unlimited agent-to-agent response loop.

---

## Contract 2 — Agent connections

This is the most important extensibility boundary. Personal OS must support new
agents without changes to conversation storage or the factory task model.

### Adapter categories

| Adapter | Intended use                                                             |
| ------- | ------------------------------------------------------------------------ |
| `cli`   | Local command-line agents.                                               |
| `acp`   | Interactive agents exposing ACP-compatible sessions.                     |
| `a2a`   | Independently operating agents supporting interoperable task delegation. |
| `http`  | Hermes, OpenClaw and other framework-specific gateways.                  |
| `model` | Direct model sessions without a full external agent harness.             |
| `echo`  | Built-in deterministic agent, for local use and tests.                   |

ACP provides a session-oriented interface and capability negotiation. A2A supports
task-oriented communication between independent agents, including discovery,
artifacts and task states.

The standards are implemented using maintained protocol SDKs where possible, not
rewritten from scratch.

### Common connection contract

```ts
interface AgentConnection {
  id: string;
  name: string;
  adapterType: string;
  configRef: string;
  enabled: boolean;
}

interface AgentCapabilities {
  chat: boolean;
  streaming: boolean;
  persistentSessions: boolean;
  backgroundTasks: boolean;
  cancel: boolean;
  approvals: boolean;
  artifacts: boolean;
}

interface AgentAdapter {
  connect(connection: AgentConnection): Promise<AgentCapabilities>;

  send(input: {
    conversationId: string;
    externalSessionId?: string;
    message: string;
    context: string;
    executionId: string;
  }): AsyncIterable<AgentEvent>;

  getStatus?(executionId: string): Promise<AgentExecutionStatus>;
  cancel?(executionId: string): Promise<void>;
}
```

This interface deliberately captures the minimum common functionality.

**Production extensions.** The implementation adds, without changing the shape above:

- **Versioning.** `configRef` points at a versioned configuration record; the
  adapter configuration itself carries a `schemaVersion`.
- **Structured errors.** Adapters report failures as `execution.error` events with a
  `code` and a `message`.
- **Deadlines.** Every adapter configuration carries a `timeoutSeconds`, enforced by
  the worker and by the adapter.
- **Auth references.** Credentials are referenced by id (`apiKeyRef`, `authTokenRef`)
  and resolved server-side.
- **Optional protocol-specific methods.** `AgentAdapterExtras` declares
  `resumeSession`, `nativeCapabilities` and `externalTaskId`, which are used only
  when the protocol supports them.
- **Cancellation.** `input.signal` is an `AbortSignal`; an adapter that can cancel
  must honour it.
- **Per-connection tool grants.** The owner narrows the MCP tools a connection may
  call. The effective grant list is reported on the connection detail:

  ```ts
  interface AgentConnectionDetail extends AgentConnection {
    workspaceId: string;
    toolGrants: McpToolName[]; // the effective list
    capabilities: AgentCapabilities | null;
    status: AgentConnectionStatus;
    lastError: string | null;
    lastConnectedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }
  ```

  `toolGrants` is an additive field. A connection with no explicit grants uses the
  default agent set. A connection with an empty grant list cannot call Personal OS
  through MCP at all.

### Important design rules

**Preserve native capabilities.** Do not reduce sophisticated agents to basic
prompt-response text if the native protocol supports richer operations.

**No assumptions about resume.** Persist the conversation regardless, but only offer
native session restoration when the adapter supports it.

**Explicit execution ownership.** When a task is handed to an external orchestrator,
retain its external task id and status instead of creating a competing internal
workflow.

**Credentials stay server-side.** Never expose provider credentials or CLI
authentication material to browser clients.

**Supported authentication only.** Account management must respect
provider-supported methods rather than extracting or reusing undocumented session
tokens.

### Adapter events

The common event vocabulary:

| Event                | Meaning                                |
| -------------------- | -------------------------------------- |
| `message.delta`      | Streaming text update.                 |
| `message.completed`  | Finished message.                      |
| `tool.started`       | Tool invocation reported.              |
| `tool.completed`     | Tool result reported.                  |
| `approval.requested` | Action requires approval.              |
| `artifact.created`   | Produced resource.                     |
| `execution.status`   | Running, blocked, completed or failed. |
| `execution.error`    | Structured failure.                    |

Adapters emit only events they can genuinely observe. Missing events are not
fabricated.

---

## Contract 3 — Agent-created applications and resources

An agent must be able to create and modify the same resources that you can create
through the interface. The simplest approach is a shared resource API.

```
Human ─┐
Visual editor ─┼─> Shared resource operations ─> Dashboards · Documents · Automations
Agent ─┘         (Create · Read · Update ·        Data sources · Tasks · Memory
                 Publish · Execute · Inspect)
MCP / API tools ─┘
```

### Resource contract

```ts
interface Resource<T = unknown> {
  id: string;
  workspaceId: string;
  type: string;
  schemaVersion: number;
  revision: number;
  title: string;
  data: T;
  createdBy: string;
  updatedAt: string;
}

interface ResourceProvider<T> {
  validate(data: unknown): T;
  create(input: T): Promise<Resource<T>>;
  get(id: string): Promise<Resource<T>>;
  update(id: string, expectedRevision: number, data: T): Promise<Resource<T>>;
}
```

This is a shared envelope, not a requirement to store every document or file as JSON.
Each resource type maintains an appropriate internal representation while exposing
stable operations.

**The revision number provides optimistic concurrency protection**, so two agents
cannot silently overwrite each other's changes. A stale `expectedRevision` is
rejected with `409 revision_conflict`.

### Resource types

| Type          | Payload shape                                                                           |
| ------------- | --------------------------------------------------------------------------------------- |
| `dashboard`   | `{ widgets: [{ id, type, title, dataSourceId?, binding }], refreshSeconds, published }` |
| `document`    | `{ format: 'markdown' \| 'blocks', content, tags }`                                     |
| `data-source` | `{ kind: 'json' \| 'http' \| 'sqlite', payload? \| url? \| query?, headers }`           |
| `automation`  | `{ trigger, action, enabled }`                                                          |
| `task`        | The factory task projection.                                                            |
| `memory`      | `{ scope, key, value, tags }`                                                           |

Charts render from structured datasets, not agent-generated executable JavaScript.

### MCP exposure

Personal OS exposes these capabilities through an MCP server at `/mcp`, so compatible
external agents can discover and operate them.

| Tool                 | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `workspace.list`     | List the workspaces available to the caller.            |
| `conversation.read`  | Read a conversation with its participants and messages. |
| `conversation.post`  | Post a message to a conversation.                       |
| `agent.list`         | List the agent connections in a workspace.              |
| `task.create`        | Create a factory task.                                  |
| `task.update`        | Update a factory task.                                  |
| `task.get`           | Read a task with its evidence.                          |
| `resource.create`    | Create a resource.                                      |
| `resource.get`       | Read a resource.                                        |
| `resource.update`    | Update a resource with optimistic concurrency.          |
| `automation.create`  | Create an automation.                                   |
| `automation.inspect` | Inspect an automation and its runs.                     |

These are Personal OS tool names, not predefined MCP methods. Agents discover each
tool's input and output schema through MCP.

Tool visibility and authorisation reflect the requesting agent's grants. An owner
token sees every tool; an agent token sees only the tools that connection was
granted. **An ungranted tool is not registered at all**, so it does not appear in the
`tools/list` response and the MCP server cannot route a call to it.

An agent token is **MCP-only**. It is accepted by `/mcp` and rejected by the owner's
HTTP API, including `/api/auth/owner-token`. The owner HTTP API requires a human
session or the static owner token.

### Data-source guard rails

A data source is a convenience for dashboards, not a back door into the application's
own tables. Two rules are enforced server-side on every read:

- **Outbound requests** go through an SSRF guard. Only `http` and `https` are
  allowed, and never a private, loopback or link-local address. Set
  `PERSONAL_OS_ALLOW_PRIVATE_TARGETS=true` to opt out for a trusted LAN deployment.
- **SQLite reads** must be a single `SELECT` (or `WITH`) statement over an
  allowlist of tables. `users`, `sessions`, `secret_configs`, `agent_tokens` and
  `audit_log` are excluded by design.

---

## Contract 4 — The software factory

The factory does not need a complicated project management system. Its foundation is:

1. **Goal** — a persistent desired outcome, such as improving homelab reliability.
2. **Task** — a bounded assignment contributing to the goal.
3. **Execution** — one attempt by an agent, human or external system.
4. **Evidence** — results, artifacts, tests and observations.
5. **Acceptance** — confirmation of what was achieved, or an explicit reason why it
   remains incomplete.

A goal should survive changes in agents, sessions and provider accounts. A task
should retain its ownership even if the external agent is disconnected. An execution
may be performed entirely by an external orchestrator; Personal OS stores the
reference and the evidence it can observe.

```ts
interface FactoryTask {
  id: string;
  workspaceId: string;
  goalId?: string;
  title: string;
  description: string;
  assigneeId?: string;
  executionOwner: 'personal-os' | 'external' | 'human';
  status: 'open' | 'active' | 'blocked' | 'review' | 'done' | 'cancelled';
  acceptanceCriteria: string[];
  evidenceResourceIds: string[];
  revision: number; // optimistic concurrency, same rule as a resource
  externalRef?: string; // the external orchestrator's own task id
}
```

`revision` and `externalRef` are additive fields. A task update presents the
revision it read; a stale revision is rejected with `409 revision_conflict`. A task
assigned to an external orchestrator keeps that orchestrator's own task identifier in
`externalRef` rather than creating a competing internal workflow.

Execution attempts, external references and status history are separate records.
This leaves an opening for more advanced factory behaviour without designing a
comprehensive issue tracker today.

### Autonomy policy

Manual, assisted and autonomous modes remain workspace-level defaults, with narrower
restrictions per goal or operation. Autonomous agents can only initiate work through
an approved trigger and granted capabilities.

An autonomy policy carries at least execution limits, allowed actions, approval
requirements and a way to pause the work.

**An agent claiming a task is complete is not the same as the task satisfying its
acceptance criteria.** An agent's completion moves the task to `review`. Only an
explicit acceptance decision moves it to `done`.

The `done` status is reachable through exactly one path — the acceptance endpoint.
`PATCH /api/tasks/:id` cannot set it, and the MCP `task.update` tool does not offer
it. The rule is enforced in the service layer, which is the single choke point every
caller passes through.

---

## Contract 5 — Approvals and audit

Sensitive operations require an explicit decision. Nothing is approved implicitly.

When an adapter emits `approval.requested`, Personal OS records a pending approval
request and holds the execution in `blocked`. The owner decides through
`POST /api/approvals/:id/decide`. An approval that is never decided stays pending —
the system never resolves it silently.

**Deciding an approval finishes the execution it belongs to.** An approved request
closes the execution as `completed`; a rejected one closes it as `failed` with the
owner's reason. The decision does **not** re-enter the adapter and continue the
interrupted turn — resuming a blocked adapter turn needs a protocol-level resume
that not every adapter supports. This is a deliberate limitation, documented rather
than approximated.

Every entry in the audit trail answers three questions: **who requested an action,
which agent performed it, and what the result was.** Entries are append-only and
readable at `GET /api/audit`.

---

## Contract 6 — Automations

An automation pairs a trigger with an action.

```ts
type AutomationTrigger =
  | { type: 'schedule'; cron?: string; everyMinutes?: number }
  | { type: 'event'; event: string }
  | { type: 'manual' };

type AutomationAction =
  | { type: 'agent.prompt'; agentConnectionId: string; prompt?: string }
  | { type: 'resource.refresh'; resourceId: string }
  | { type: 'http.request'; url: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE' };
```

An event trigger names one event from an **allowlist**:

```
message.created · message.updated · task.updated · resource.updated
agent.status · automation.run
```

Only these events may be triggers. `execution.event` and `heartbeat` are excluded
because they fire constantly and carry no meaning as a trigger; a trigger that is
meaningless should not be configurable.

**Chain depth bounds an automation chain.** Every event carries the depth it was
produced at. An automation started by an event at depth _d_ produces its events at
depth _d + 1_, and an event at the maximum depth (3) triggers nothing. Two
automations therefore cannot wake each other indefinitely.

An `agent.prompt` action may use these placeholders in its prompt:

| Placeholder     | Expands to                                                                        |
| --------------- | --------------------------------------------------------------------------------- |
| `{{context}}`   | A description of the trigger — for an event trigger, the event name and sequence. |
| `{{event}}`     | The JSON of the event that triggered the run.                                     |
| `{{eventType}}` | The name of the triggering event.                                                 |
| `{{title}}`     | The title of the automation.                                                      |

A `resource.refresh` action re-reads the resource's data source and stores the
result, so the resource really has fresh data afterwards — it is not a no-op.

---

## The HTTP surface

All routes are prefixed with `/api`. Authentication is a session cookie
(`pos_session`) or a bearer token.

There are **no default credentials**. The owner account is created by
`POST /api/auth/setup`, which succeeds only once per instance; after that the
login route is the only way in. A forgotten password is replaced by the server
binary's `--reset-password` mode, which changes nothing else:

```
node apps/server/dist/index.js --reset-password "<new password>"
```

It is not an HTTP route, because it is the recovery path for an owner who
cannot authenticate. Every session is revoked when it runs.

| Method             | Path                                       | Purpose                                                                                 |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `GET`              | `/api/health`                              | Liveness and setup state.                                                               |
| `GET`              | `/api/auth/status`                         | Whether setup is still required.                                                        |
| `POST`             | `/api/auth/setup`                          | Create the owner account. Once per instance.                                            |
| `POST`             | `/api/auth/login`                          | Start a session.                                                                        |
| `POST`             | `/api/auth/logout`                         | End the session.                                                                        |
| `GET`              | `/api/auth/me`                             | The current owner.                                                                      |
| `GET/POST`         | `/api/workspaces`                          | List and create workspaces.                                                             |
| `PATCH`            | `/api/workspaces/:id`                      | Update a workspace.                                                                     |
| `GET/POST`         | `/api/agents`                              | List and create agent connections.                                                      |
| `GET/PATCH/DELETE` | `/api/agents/:id`                          | Read, update, remove a connection. `PATCH` accepts `toolGrants`.                        |
| `POST`             | `/api/agents/:id/probe`                    | Re-run capability discovery.                                                            |
| `GET/POST`         | `/api/agents/:id/tokens`                   | Issue and list MCP tokens.                                                              |
| `DELETE`           | `/api/agents/:id/tokens/:tokenId`          | Revoke an MCP token.                                                                    |
| `GET/POST`         | `/api/conversations`                       | List and create conversations.                                                          |
| `GET/PATCH/DELETE` | `/api/conversations/:id`                   | Read, update, remove a conversation.                                                    |
| `GET/POST`         | `/api/conversations/:id/messages`          | Read and post messages.                                                                 |
| `POST/DELETE`      | `/api/conversations/:id/participants`      | Manage participants.                                                                    |
| `GET/POST`         | `/api/resources`                           | List and create resources.                                                              |
| `GET/PATCH`        | `/api/resources/:id`                       | Read and update a resource.                                                             |
| `POST`             | `/api/resources/:id/publish`               | Publish a resource.                                                                     |
| `POST`             | `/api/resources/:id/execute`               | Execute a resource.                                                                     |
| `GET`              | `/api/resources/:id/inspect`               | Validate without changing.                                                              |
| `GET/POST`         | `/api/goals`                               | List and create goals.                                                                  |
| `GET/POST`         | `/api/tasks`                               | List and create tasks.                                                                  |
| `GET/PATCH`        | `/api/tasks/:id`                           | Read and update a task. `PATCH` cannot set `done`; it also enforces `expectedRevision`. |
| `POST`             | `/api/tasks/:id/assign`                    | Assign a task to an agent.                                                              |
| `POST`             | `/api/tasks/:id/accept`                    | Record an acceptance decision.                                                          |
| `GET/POST`         | `/api/automations`                         | List and create automations.                                                            |
| `PATCH/DELETE`     | `/api/automations/:id`                     | Update and remove an automation.                                                        |
| `POST`             | `/api/automations/:id/enable` · `/disable` | Toggle scheduling.                                                                      |
| `GET`              | `/api/approvals`                           | List approval requests.                                                                 |
| `POST`             | `/api/approvals/:id/decide`                | Approve or reject a sensitive operation.                                                |
| `GET`              | `/api/audit`                               | Read the audit trail.                                                                   |
| `GET`              | `/api/events`                              | Server-sent event stream.                                                               |
| `ANY`              | `/mcp`                                     | MCP streamable HTTP endpoint.                                                           |

### Error envelope

Every failure uses the same shape:

```json
{
  "error": {
    "code": "revision_conflict",
    "message": "The resource changed since it was read (expected revision 1, current 2).",
    "details": { "expectedRevision": 1, "currentRevision": 2 }
  }
}
```

Codes include `unauthorized`, `forbidden`, `not_found`, `conflict`,
`validation_failed`, `revision_conflict` and `limit_exceeded`.

### Event stream

`GET /api/events` is a Server-Sent Events stream. Each message carries an `event`
name and a JSON `data` payload.

| Event              | Payload                                             |
| ------------------ | --------------------------------------------------- |
| `message.created`  | `{ message }`                                       |
| `message.updated`  | `{ message }`                                       |
| `execution.event`  | `{ conversationId?, executionId, event }`           |
| `task.updated`     | `{ task }`                                          |
| `resource.updated` | `{ resource }`                                      |
| `agent.status`     | `{ connectionId, status, capabilities, lastError }` |
| `automation.run`   | `{ run }`                                           |
| `heartbeat`        | `{ at }`                                            |

On connect the server replays the fifty most recent events, so a reconnecting client
converges on the current state.
