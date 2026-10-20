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
  personaOverride?: Persona; // the override, for this conversation only
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

`personaOverride` is defined in [The persona](#the-persona).

### Additive extensions

The implementation adds three fields, all optional and all required by production
behaviour:

```ts
interface Message {
  // ...
  status?: 'streaming' | 'complete' | 'failed' | 'unknown';
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

### The unknown outcome

A message, an execution and a task each carry a status, and one of those statuses
means something other than failure: **`unknown` — we started this and we cannot
confirm how it ended.**

```ts
type MessageStatus = 'streaming' | 'complete' | 'failed' | 'unknown';

type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown';

type TaskStatus = 'open' | 'active' | 'blocked' | 'review' | 'done' | 'cancelled' | 'unknown';
```

The rule that separates `unknown` from `failed` is whether anything started. A path
where nothing began is `failed`: the work never happened and there is nothing to
check. A path where something began and the outcome cannot be confirmed is
`unknown` — a turn that timed out may well have had its side effect before the
timeout. The owner sees an `unknown` item as **"check this"**, never as **"fix
this"**.

**A second `unknown`, on a connection.** `AgentConnectionStatus` carries
`unknown` too (`packages/contracts/src/agent.ts:127-134`), and it means something
else: a connection whose state was never checked, which is how a new connection
starts. This `unknown` is about an outcome that cannot be confirmed; that one
is about a state that was never looked at. They are different things that
happen to share a word, and the field they appear on says which is which.

**An `unknown` item is never retried automatically.** There is no reaper, no
redispatch and no reconciliation pass. An unknown outcome is a question for the
owner, and only the owner can close it. Every transition into and out of
`unknown` is written to the audit trail.

This entry is the contract for **WI-008**, and the code implements it — as of
`9ad4f98`. `messageStatusSchema` carries `'unknown'` at
`packages/contracts/src/conversation.ts:62`, `executionStatusSchema` at
`packages/contracts/src/agent.ts:153`, and `taskStatusSchema` at
`packages/contracts/src/factory.ts:25`.

**Migration.** Nothing is reclassified. Rows recorded as `failed` before this
change stay `failed` — we cannot know which of them were really unknown — and
`unknown` applies only to transitions made after it.

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
  persona?: Persona; // the base persona
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

### The persona

An agent the owner talks to has a persona: a named role with standing instructions.

```ts
interface Persona {
  role?: string; // 1–200 characters, one line, shown to the owner
  instructions?: string; // up to 8,000 characters, shown to the agent
}
```

The persona lives in two places. The connection sets the base; a conversation may
override it.

```ts
interface AgentConnection {
  // ...
  persona?: Persona; // the base persona
}

interface Participant {
  // ...
  personaOverride?: Persona; // the override, for this conversation only
}
```

**Resolution — most specific first, whole entity.** If the participant's override
sets `role` or `instructions`, that override _is_ the persona and the connection's
base is not consulted. Otherwise the connection's base is the persona. Otherwise the
agent runs with its runtime's own default framing.

The override replaces rather than merges, field by field. A conversation that sets
only `role` does not silently keep the connection's `instructions`: a half-overridden
persona is a stranger.

**One resolver, one truth.** The resolution is a pure function in the contracts
package, so the server, the worker and the web client cannot disagree about which
persona is in force. The panel shows which persona is in force and names its source
— `conversation`, `connection` or `default` — so an overridden value is never
displayed as if it were the base.

**The persona frames the turn and nothing else.** The resolved persona is prepended
to the turn context the worker already builds. It is not a second instruction
system, and it never replaces or duplicates the external runtime's own harness or
instruction file.

This entry is the contract for **WI-006**, and the code implements it — as of
`70d042c`. `personaSchema` is at `packages/contracts/src/agent.ts:28`,
`resolvePersona` at `:79`, the connection's base persona at `:102`, and the
participant's override at `packages/contracts/src/conversation.ts:38`.

**Migration.** Nothing is reclassified and nothing is rewritten. Both fields are
optional, so a connection and a participant written before this change stay valid
and resolve to the runtime's default. The persona applies only to turns taken after
it.

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

| Event                | Meaning                                         |
| -------------------- | ----------------------------------------------- |
| `message.delta`      | Streaming text update.                          |
| `message.completed`  | Finished message.                               |
| `tool.started`       | Tool invocation reported.                       |
| `tool.completed`     | Tool result reported.                           |
| `approval.requested` | Action requires approval.                       |
| `artifact.created`   | Produced resource.                              |
| `execution.status`   | Running, blocked, completed, failed or unknown. |
| `execution.error`    | Structured failure.                             |

Adapters emit only events they can genuinely observe. Missing events are not
fabricated.

The status an `execution.status` event carries is the execution status:

```ts
type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown';
```

`unknown` is defined in [The unknown outcome](#the-unknown-outcome).

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
| `memory`      | `{ scope, key, value, tags, agentConnectionId? }`                                       |

Charts render from structured datasets, not agent-generated executable JavaScript.

### The template record

A template is a **named, versioned example of one resource kind, with its spec, that
an agent can start from**. It answers a question a schema cannot: a schema is a
type, and a template is an example that was written, reviewed and shipped.

```ts
interface ResourceTemplate {
  id: string; // stable across versions
  version: number; // positive integer, bumped when the spec changes
  type: ResourceType; // the kind this template starts
  title: string;
  description: string;
  spec: unknown; // validated by the owning provider for `type`
}

interface ResourceTemplateRef {
  id: string;
  version?: number; // omitted means the newest published version
}
```

`ResourceType` is the published kind enum — `dashboard | document | automation |
data-source | task | memory` (`packages/contracts/src/resource.ts:4-12`). A template
belongs to exactly one kind, and `version` is part of its identity: the registry
may hold several versions of one template, and each version is a spec that was
reviewed on its own.

**A template is not a resource.** It has no workspace, no revision, no `createdBy`
and no audit trail of its own; it is not a row in `resources` and not a row in any
table. Templates are **authored in the repository and reviewed like code**, so
there is no template editor in the panel and no route or tool creates a template.
The registry is the same for every workspace — a template is not scoped to one.

**A resource created from a template is a normal resource.** It has the same
[resource contract](#resource-contract): the same schema, the same validation, the
same audit trail and the same revision, and it starts at revision 1 like every
other resource. **The template's spec is validated by the owning provider exactly
as a resource's spec is**, so a template cannot drift into describing something
the product would reject. The resulting resource carries no reference back to its
template — it is the resource, not a template instance.

**The template is reached through the tool surface an agent already uses.** That
surface is the existing `resource.*` MCP surface — not a second tool surface, and
not a second way to create a resource:

| Tool                     | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `resource.template.list` | List the templates published for one resource kind.  |
| `resource.create`        | Create a resource — from a template, or from a spec. |

`resource.template.list` takes the kind and returns the templates published for
it. `resource.create` gains **one optional input**, `template`:

```ts
// the resource.create input
{ workspaceId?, type, title, data?, template? }
```

`template` names the template to start from: its `spec` is the resource's `data`,
and its `type` must equal the `type` the call asks for. `data` and `template` are
**mutually exclusive** — a call that supplies both is refused, because there is
no published answer to which of the two wins. An unknown template id is
`not_found`; a template whose kind does not match, and a template whose spec the
owning provider refuses, are `validation_failed`. Those codes are already
published in [Error envelope](#error-envelope); this entry adds none. The tool's
visibility follows the same grant rule as every other tool on that surface,
published in [MCP exposure](#mcp-exposure).

**The code does not implement this yet.** The record, the tool and the input are
published ahead of their implementation, because the contract leads and the code
follows: the implementation is WI-017, and the shapes above are what it has to
reach. Nothing in the code carries a template today — there is no template record
in `packages/contracts`, the published tool names
(`packages/contracts/src/mcp.ts:11-23`) do not include one, and the server has
none. A client written against this entry must treat the tool as absent until
WI-017 lands, the same way the [waiting list](#the-waiting-list) publishes a kind
the server does not send yet.

**Migration.** Nothing is reclassified. `resource.create` without `template`
behaves exactly as it does today, so no existing client changes what it sends,
and no resource written before this change is affected — a resource has no
template field and gains no template reference. A client that reads the list of
MCP tools gains one name, `resource.template.list`, and a client that validates
an agent's `toolGrants` against the known names has to allow for it, because the
grant vocabulary grows with the surface. A client that renders a resource is
unaffected: a resource created from a template is an ordinary resource with the
same fields it always had.

### The agent memory scope

A memory belongs to a workspace, a conversation, a goal — or to an agent.

```ts
type MemoryScope = 'workspace' | 'conversation' | 'goal' | 'agent';

interface MemorySpec {
  scope: MemoryScope;
  agentConnectionId?: string; // required when scope is 'agent'
  key: string;
  value: unknown;
  tags: string[];
}
```

**The memory belongs to the agent, not to the persona.** A conversation may
override an agent's persona, and a persona is per conversation; memory that changed
when the conversation changed would not be the agent's memory. An agent-scoped
memory is keyed by `agentConnectionId`, so it follows the agent across every
conversation it takes part in — available to that agent's turns in every
conversation, and to no other agent's turns, **reads included**.

**An agent touches only its own memory, on the way in and on the way out.** The
rule is one rule: an agent creates, reads and updates an agent-scoped memory only
when that memory names that agent, and it cannot hand the memory to another agent
on the way through — a memory that already belongs to another agent stays that
agent's. The other three scopes are shared by design and are not touched by this
rule, and neither is any resource that is not an agent-scoped memory. The owner is
outside this rule: the owner's own API takes an owner session, and the owner reads
what it owns.

The agent's memories are in the turn context, within a budget of 6,000 characters,
pinned first and then most recent, so an agent's memory cannot crowd out the
conversation. The other three scopes keep their meaning and behave exactly as they
do today.

This entry is the contract for **WI-012**, and the code implements it — as of
`e764e6a`. `memoryScopeSchema` carries `'agent'` at
`packages/contracts/src/resource.ts:102`, the spec's `agentConnectionId` at `:112`,
and `listAgentMemories` at
`apps/server/src/modules/resources/agent-memory.ts:29` is what puts the agent's
memories in the turn context.

**The read side is WI-028, and the code implements it — as of `622812c`.** The
owner's ruling of 2026-10-21 at 07:07 was that an agent's own memory is private
to it, on reads as well as on writes, and the sentence above now says so. The rule
is one call — `assertOwnMemory` at
`apps/server/src/modules/mcp/server.ts:147`, with `memoryOwner` at `:113` — and it
answers the same way for the three resource tools: `resource.create` at `:361`,
`resource.update` at `:422` and `resource.get` at `:392`. A memory's owner is
`memoryOwner`'s answer, and an agent that is not that owner is refused with
`forbidden` and the message "An agent may only reach its own memory."

**Migration.** Nothing is reclassified. The three existing scopes keep their
meaning, no memory is reclassified, and the `agent` scope applies only to memories
written after this change — we cannot know which of the existing workspace-scoped
memories were "really" the agent's. The read side changes no record either: a
memory written before this change keeps the owner it was written with, and an
agent that could read another agent's agent-scoped memory before this change is
now refused it. A client that read another agent's memory has to handle that
refusal; a client that reads its own memory, or a shared one, is unaffected.

### MCP exposure

Personal OS exposes these capabilities through an MCP server at `/mcp`, so compatible
external agents can discover and operate them.

| Tool                     | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `workspace.list`         | List the workspaces available to the caller.            |
| `conversation.read`      | Read a conversation with its participants and messages. |
| `conversation.post`      | Post a message to a conversation.                       |
| `agent.list`             | List the agent connections in a workspace.              |
| `task.create`            | Create a factory task.                                  |
| `task.update`            | Update a factory task.                                  |
| `task.get`               | Read a task with its evidence.                          |
| `resource.create`        | Create a resource, optionally from a template.          |
| `resource.get`           | Read a resource. Not another agent's own memory.        |
| `resource.update`        | Update a resource with optimistic concurrency.          |
| `resource.template.list` | List the templates published for one resource kind.     |
| `automation.create`      | Create an automation.                                   |
| `automation.inspect`     | Inspect an automation and its runs.                     |

These are Personal OS tool names, not predefined MCP methods. Agents discover each
tool's input and output schema through MCP.

Tool visibility and authorisation reflect the requesting agent's grants. An owner
token sees every tool; an agent token sees only the tools that connection was
granted. **An ungranted tool is not registered at all**, so it does not appear in the
`tools/list` response and the MCP server cannot route a call to it.

**Who owns a resource is settled before it is handed over.** `resource.get`
carries the same rule the writes already carried: an agent-scoped memory is
available to that agent's turns in every conversation, and to no other agent's
turns, reads included. The rule is stated once, in
[The agent memory scope](#the-agent-memory-scope), and it is one rule for the
three resource tools — `resource.create`, `resource.update` and `resource.get` — so
reading a resource is not a way around it. A read that names another agent's
agent-scoped memory is refused with `forbidden` and the message "An agent may
only reach its own memory." The owner's own access is not touched by any of this.

An agent token is **MCP-only**. It is accepted by `/mcp` and rejected by the owner's
HTTP API, including `/api/auth/owner-token`. The owner HTTP API requires a human
session or the static owner token.

**Migration.** Nothing is reclassified and no record is rewritten. A client that
called `resource.get` expecting any resource it could name now has to handle a
refusal: an agent's call that names another agent's agent-scoped memory comes
back `forbidden`, with the message "An agent may only reach its own memory." The
owner's own calls are unaffected, and so are an agent's calls for its own memory,
for the three shared scopes, and for every resource that is not an agent-scoped
memory. The refusal is the one the writes already return, so a client that already
handles `forbidden` on `resource.create` and `resource.update` needs nothing new.

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
  status: 'open' | 'active' | 'blocked' | 'review' | 'done' | 'cancelled' | 'unknown';
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

`unknown` is defined in [The unknown outcome](#the-unknown-outcome).

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

**Deciding an approval resumes the turn when the adapter can.** The execution stays
`blocked` while the owner is deciding. On a decision:

- the adapter reports `persistentSessions` → the turn re-enters the **same** session
  with the decision as its next input, and finishes normally;
- otherwise → the execution finishes with the decision's outcome, and the panel says
  the turn was **closed** rather than continued.

The capability is the gate. `AgentCapabilities.persistentSessions` is negotiated at
connect time and reported honestly by the adapter, and there is no second, parallel
signal.

**The decision is recorded before the resume is attempted**, so an answer is never
lost because the session could not be restored.

**The external session id lives in `externalRef`**, the execution's existing
external orchestrator reference. A blocked execution with no `externalRef` carries
no session to resume.

This paragraph replaces the one that said a decision always finishes its execution.
That paragraph was true of the code as it stood and is not true of the contract any
more: resuming a blocked turn needs a protocol-level resume that not every adapter
supports, and the capability to do it is already modelled and negotiated.

This entry is the contract for **WI-007**, and the code implements it — as of
`5f019b9`. `resumeSession` is implemented at
`packages/agent-adapters/src/acp.ts:213` and called at
`apps/worker/src/executor.ts:375`, and the gate is the capability and the session
id together: `canResume = capabilities?.persistentSessions === true &&
Boolean(execution.externalRef)`.

**Migration.** Nothing is reclassified. An execution that is already `blocked` when
this ships has no persisted session id, so a decision on it cannot be resumed and
closes the execution exactly as it does today. Only executions started after this
change carry a session id.

Every entry in the audit trail answers three questions: **who requested an action,
which agent performed it, and what the result was.** Entries are append-only and
readable at `GET /api/audit`.

### The waiting list

`GET /api/waiting?workspaceId=…` returns everything waiting on the owner as one
list, so the client asks for one thing instead of fetching three and joining the
answers itself.

```ts
type WaitingKind = 'approval' | 'task' | 'turn';
type WaitingReason = 'pending' | 'review' | 'blocked' | 'unknown';

interface WaitingItem {
  id: string; // unique across kinds, so the client can key the list
  kind: WaitingKind;
  title: string;
  detail: string;
  reason: WaitingReason;
  workspaceId: string;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
}
```

`id` is the kind and the underlying id, joined by a colon — `approval:apr_1`,
`task:tsk_1` — so one list can be keyed without the client having to pair the
id with the kind.

**`unknown` is a reason of its own.** An item whose outcome could not be
confirmed is on this list because there is something to check, not because a
decision is waiting and not because the work is stuck. The state itself is
defined in [The unknown outcome](#the-unknown-outcome); this entry publishes the
list's use of it, and the two are not two definitions. The published type
carries `pending | review | blocked | unknown`, member for member with
`apps/server/src/api/waiting.ts:17`, and the route takes the reason straight
from the task's status (`waiting.ts:85`), so a task that cannot be confirmed
arrives as `reason: 'unknown'` and the published type cannot drift away from
what the route returns.

**Migration.** The enum grows by one member and nothing is reclassified. A
client that matched on three reasons has a fourth case to handle, and the
fourth is not `blocked` in disguise: it does not say the work is stuck, and
clearing it is not what unblocks the item. A client that switches exhaustively
on the reason must now render `unknown` as something to check, or it will show
an item with no label at all. A task recorded before this change keeps the
reason it was recorded with — no task's status is rewritten, and no task that
was `review` or `blocked` becomes `unknown`. A client that treats an
unrecognised reason as a generic "something is waiting" keeps working, and
should.

**One thing is one entry.** A pending approval that belongs to a task _is_ that
task waiting on the owner, so the task does not appear a second time beside it.
The owner would otherwise see the same thing twice and have no way to tell
which one to act on.

**`turn` is its own kind.** A turn on this list is an agent turn whose outcome
could not be confirmed: the work started and the server cannot say how it
ended. It is not blocked, not failed, and not something the owner can fix — it
is something to check. The `unknown` state itself is defined in
[The unknown outcome](#the-unknown-outcome); this entry publishes the list's
use of it, and the two are not two definitions. A turn is not an approval and
not a task, so it is not spelled as either.

This entry is the contract for **WI-027**, and the code implements it — as of
`c9bb0bc`. A turn on the list is an execution whose outcome could not be
confirmed and that belongs to no task, and `listUnknownTurns`
(`apps/server/src/modules/conversations/service.ts`) is what lists them; the
route draws them as `turn:<execution id>`, in the band of the work whose
outcome could not be confirmed. A turn that a pending approval already
accounts for is not drawn again beside that approval, the way a task that a
pending approval already accounts for is not.

**The order of the list is over reasons, not kinds.** A turn carries the reason
its outcome earned, so an unknown turn sorts where an unknown task sorts. The
published order below is not changed by this entry.

**Migration.** The kind grows by one member and nothing is reclassified. A
client that matched on two kinds has a third case to handle, and a turn is
neither of the two it knew: a client that groups its list by kind has to decide
where a turn sits in its own interface rather than filing it under a task. A
client that matches on the reason is unaffected — the reasons did not change
with this entry. A row recorded before this change keeps the kind it was
recorded with: no approval becomes a turn, and no task becomes a turn.

The order is the order of urgency, and it is the order the code assembles the
list in (`apps/server/src/api/waiting.ts:106-110`): an agent that cannot
continue comes first, then the work whose outcome could not be confirmed, then
the work waiting for an acceptance decision, then the work that is stuck.

The list is scoped to one workspace, and `workspaceId` is required. The route
is read-only, returns only what the owner can see, and requires the same
authentication as every other route.

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

**The new password is visible in the host's process list.** It is passed as a
command-line argument, so it sits there for as long as the command runs, and
another user on the host can read it there. It is also the only way to set the
password after setup — no route changes it — so the exposure cannot be avoided
by running something else instead. That is the cost of this recovery path, and
it is paid knowingly: the path exists so that an owner who cannot authenticate
is not left deleting the database.

| Method             | Path                                                 | Purpose                                                                                 |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET`              | `/api/health`                                        | Liveness and setup state.                                                               |
| `GET`              | `/api/auth/status`                                   | Whether setup is still required.                                                        |
| `POST`             | `/api/auth/setup`                                    | Create the owner account. Once per instance.                                            |
| `POST`             | `/api/auth/login`                                    | Start a session.                                                                        |
| `POST`             | `/api/auth/logout`                                   | End the session.                                                                        |
| `GET`              | `/api/auth/me`                                       | The current owner.                                                                      |
| `POST`             | `/api/auth/owner-token`                              | Return the configured owner token. Owner only — an agent token is refused.              |
| `GET/POST`         | `/api/workspaces`                                    | List and create workspaces.                                                             |
| `GET/PATCH`        | `/api/workspaces/:id`                                | Read and update a workspace.                                                            |
| `GET/POST`         | `/api/agents`                                        | List and create agent connections.                                                      |
| `GET/PATCH/DELETE` | `/api/agents/:id`                                    | Read, update, remove a connection. `PATCH` accepts `toolGrants`.                        |
| `POST`             | `/api/agents/:id/probe`                              | Re-run capability discovery.                                                            |
| `GET/POST`         | `/api/agents/:id/tokens`                             | Issue and list MCP tokens.                                                              |
| `DELETE`           | `/api/agents/:id/tokens/:tokenId`                    | Revoke an MCP token.                                                                    |
| `GET`              | `/api/secrets`                                       | List the secret configurations. Metadata only — a value never leaves the server.        |
| `GET/POST`         | `/api/conversations`                                 | List and create conversations.                                                          |
| `GET/PATCH/DELETE` | `/api/conversations/:id`                             | Read, update, remove a conversation.                                                    |
| `GET/POST`         | `/api/conversations/:id/messages`                    | Read and post messages.                                                                 |
| `POST`             | `/api/conversations/:id/participants`                | Add a participant.                                                                      |
| `DELETE`           | `/api/conversations/:id/participants/:participantId` | Remove a participant.                                                                   |
| `GET/POST`         | `/api/resources`                                     | List and create resources.                                                              |
| `GET/PATCH`        | `/api/resources/:id`                                 | Read and update a resource.                                                             |
| `POST`             | `/api/resources/:id/publish`                         | Publish a resource.                                                                     |
| `POST`             | `/api/resources/:id/execute`                         | Execute a resource.                                                                     |
| `GET`              | `/api/resources/:id/inspect`                         | Validate without changing.                                                              |
| `GET/POST`         | `/api/goals`                                         | List and create goals.                                                                  |
| `GET`              | `/api/goals/:id`                                     | Read a goal.                                                                            |
| `GET/POST`         | `/api/tasks`                                         | List and create tasks.                                                                  |
| `GET/PATCH`        | `/api/tasks/:id`                                     | Read and update a task. `PATCH` cannot set `done`; it also enforces `expectedRevision`. |
| `POST`             | `/api/tasks/:id/assign`                              | Assign a task to an agent.                                                              |
| `POST`             | `/api/tasks/:id/accept`                              | Record an acceptance decision.                                                          |
| `GET/POST`         | `/api/automations`                                   | List and create automations.                                                            |
| `GET/PATCH/DELETE` | `/api/automations/:id`                               | Read, update and remove an automation.                                                  |
| `POST`             | `/api/automations/:id/enable` · `/disable`           | Toggle scheduling.                                                                      |
| `GET`              | `/api/approvals`                                     | List approval requests.                                                                 |
| `GET`              | `/api/approvals/:id`                                 | Read an approval request.                                                               |
| `POST`             | `/api/approvals/:id/decide`                          | Approve or reject a sensitive operation.                                                |
| `GET`              | `/api/waiting`                                       | Everything waiting on the owner, in one list. See below.                                |
| `GET`              | `/api/audit`                                         | Read the audit trail.                                                                   |
| `GET`              | `/api/measures`                                      | The product's two measures of itself. See below.                                        |
| `GET`              | `/api/events`                                        | Server-sent event stream.                                                               |
| `ANY`              | `/mcp`                                               | MCP streamable HTTP endpoint.                                                           |

### The measures route

`GET /api/measures?workspaceId=…` returns the product's two measures of itself. It
is **read-only**, it answers for **one workspace**, and it follows the same rules
as every other route: the same authentication — a session cookie or the owner
token, and never an agent token, which is MCP-only
(`apps/server/src/api/helpers.ts:13-17`) — and a `workspaceId` that is required,
as it is on the [waiting list](#the-waiting-list).

```ts
interface Measure {
  count: number;
  denominator: number;
  ratio: number | null; // null when the denominator is zero
}

interface Measures {
  workspaceId: string;
  agentAuthoredResources: Measure;
  agentPerformedOperations: Measure;
}
```

**A measure is a count, its denominator, and a ratio** — the ratio is never
returned without the two it came from, because a client that reads the ratio has
to know what it is a ratio of. The ratio is the exact fraction
`count / denominator`, between 0 and 1; a client that shows it as a percentage
applies its own rounding.

**Where there is no denominator the ratio is `null` and not `0`, and the count is
still returned.** A panel that greets its owner with 0% reads as broken, and the
product's first report on itself must not be a lie by omission.

**What "authored by an agent" counts as.** A resource is **agent-authored** when
its `createdBy` carries the `agt_` form — the id form of an agent connection
(`apps/server/src/lib/ids.ts:9-17`). **The test is the id form, not a lookup**: a
connection that has since been removed does not make the resources it authored
owner-authored. It is **owner-authored** otherwise: the owner's user id, or the
literal `owner` that is written when there is no user id
(`apps/server/src/api/resources.ts:37`,
`apps/server/src/modules/mcp/server.ts:368`). `createdBy` is one column holding
two id spaces, so neither `'owner'` nor `'system'` is an agent. A resource's kind,
its title, and who worked on it afterwards are not part of the reading. On the
audit side an operation is **agent-performed** when the entry's `actorType` is
`agent`, and the actor id is then the agent connection id; the published
`ActorType` carries `human | agent | system | automation`
(`packages/contracts/src/common.ts:33`), and the code writes `human` and `agent`
only.

**What the reading cannot cover.** Four things, said plainly.

**Two of the six kinds can never be agent-authored.** The `automation` and `task`
projections hardcode `createdBy: 'system'`
(`apps/server/src/modules/resources/service.ts:170`, `:260`), and their tables
have no `created_by` column at all (`apps/server/src/db/schema.ts:385-401`,
`:305-330`) — the value is invented at projection time and nothing is stored. An
agent-created automation or task is recorded as authored by `'system'`. **The
first measure is therefore a lower bound**: those resources sit in the
denominator and can never sit in the count, so the ratio is a share over four of
the six kinds, reported over all six.

**Twelve of the thirty-four mutating routes write no audit entry at all.** Of the
34 mutating routes in `apps/server/src/api/`, 20 write an audit entry at the
route level, two more write one from the service layer — `POST
/api/approvals/:id/decide` at `apps/server/src/modules/approvals/resume.ts:53`,
and `PATCH /api/tasks/:id` at `apps/server/src/modules/factory/service.ts:275`,
and that one only when the task leaves `unknown`. The other twelve write none:

| Method   | Path                                                 |
| -------- | ---------------------------------------------------- |
| `POST`   | `/api/agents/:id/probe`                              |
| `DELETE` | `/api/agents/:id/tokens/:tokenId`                    |
| `POST`   | `/api/auth/logout`                                   |
| `POST`   | `/api/auth/owner-token`                              |
| `PATCH`  | `/api/automations/:id`                               |
| `DELETE` | `/api/automations/:id`                               |
| `DELETE` | `/api/conversations/:id`                             |
| `POST`   | `/api/conversations/:id/participants`                |
| `DELETE` | `/api/conversations/:id/participants/:participantId` |
| `POST`   | `/api/goals`                                         |
| `POST`   | `/api/workspaces`                                    |
| `PATCH`  | `/api/workspaces/:id`                                |

So **the second measure is a ratio of audited operations only**. It cannot be
read as the share of everything the owner did: a third of the mutating surface
is invisible to it.

**The agent's own operations are not audited at all.** The MCP surface writes no
audit entry — there is no audit call anywhere in
`apps/server/src/modules/mcp/server.ts`, and none in the capabilities service its
tools call, which reach the resources service directly rather than through the
auditing route. The only writer of the trail that is not an owner HTTP route is
the worker's `unknown` record (`apps/worker/src/executor.ts:97`). So every
audited operation is an owner operation, except the worker's own `unknown`
entries, which carry `actorType: 'agent'`. **The second measure does not count
the work an agent does through MCP**: an agent can create, update and publish
resources all day and the trail will show none of it. An implementation that
wants the measure to mean what it says has to widen the audit coverage first,
and that is WI-020's to decide.

**Nothing records a failure.** The audit trail's `result` carries
`success | failure | unknown` (`apps/server/src/modules/audit/service.ts:19`),
but no writer in the product writes `failure`: the route helper hardcodes
`success` (`apps/server/src/api/helpers.ts:62`), the audit service defaults to
it (`apps/server/src/modules/audit/service.ts:71`), and the only other value any
writer produces is the `unknown` of
[The unknown outcome](#the-unknown-outcome)
(`apps/worker/src/executor.ts:104`). An operation that failed is counted here as
an operation that completed.

**The code does not implement this yet.** The route and its shape are published
ahead of their implementation, because the contract leads and the code follows:
the implementation is WI-020, and the shapes above are what it has to reach. No
route answers this today, and nothing named `measures` exists in the server.

**Migration.** Nothing is reclassified and no record is rewritten. The route is
new and read-only, so a client that does not call it is unaffected, and a client
that does has no earlier version of it to migrate from. **No resource's
`createdBy` is changed** — the two kinds that record `'system'` keep recording
it, and the measure publishes that as a lower bound rather than correcting the
data behind the owner's back. **No audit entry is rewritten**, so the second
measure's denominator is what the trail actually holds, which is fewer
operations than the owner performed; a client that keeps a measure over time is
keeping a number whose denominator moves as more routes are audited. A client
that reads `ratio` has to handle `null`, which is a value the ratio can now take
and which is not the same as 0.

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
