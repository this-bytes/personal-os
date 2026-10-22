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

The implementation adds five fields, all optional and all required by production
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
  detail?: string;
}
```

`status` lets a client render a partially streamed answer. `correlationId` ties every
turn derived from one human request together. `origin` records who spoke and how far
the delegation chain has travelled — the basis of the echo-loop guard. `executionId`
names the execution the message belongs to — the execution is the run itself, and
the message it produced is that run's own record
(`apps/server/src/modules/conversations/service.ts:56-57`). **`detail` is the
server's own sentence about how the message ended** — a message that did not finish
says why, in the server's words
(`packages/contracts/src/conversation.ts:90`), and the client shows it as it is
given rather than rewording it
(`apps/web/src/components/ChatMessageList.tsx:136`).

**Migration.** Nothing is reclassified. The fields are additive and no existing
record is rewritten: a message that carries none of them is still a message, and a
message that carries `detail` is still the message it was. A client written before
this change has to allow for `detail` on a message that carries it, and must not
read its absence as a failure.

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
`unknown` too (`packages/contracts/src/agent.ts:138-144`), and it means something
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
`packages/contracts/src/agent.ts:164`, and `taskStatusSchema` at
`packages/contracts/src/factory.ts:25`.

**Migration.** Nothing is reclassified. Rows recorded as `failed` before this
change stay `failed` — we cannot know which of them were really unknown — and
`unknown` applies only to transitions made after it.

### Closing an unknown outcome

`POST /api/executions/:id/resolve` is how the owner closes an execution whose
outcome could not be confirmed. It is the leg of the promise
[The unknown outcome](#the-unknown-outcome) makes that was missing: a task is
closed through `PATCH /api/tasks/:id`, and this route is what a turn has.

```ts
interface ResolveExecutionInput {
  outcome: 'completed' | 'failed';
  note?: string; // up to 2,000 characters, the owner's own words
}
```

**The route carries the owner's own conclusion.** `outcome` is required, and it
is one of two values: `completed` — it did run — or `failed` — it did not run.
The product does not know what happened; the owner does, and the route records
what they said. `note` is optional, and it is the owner's own words.

**The note is capped at 2,000 characters**, and the cap is the code's
(`apps/server/src/api/executions.ts:9`). **A longer note is refused, not
shortened**: the request fails validation with `validation_failed` and HTTP 422,
carrying the same error envelope as any other validation failure
([Error envelope](#error-envelope)). The execution stays in `unknown` —
a note that is too long closes nothing and records nothing, because the body is
refused before the transition is written. A client written against the shape
above has to cap the note itself, and it must not read the refusal as a
truncated note.

**The route answers for an execution whose outcome could not be confirmed** —
one in `unknown`. An execution in any other state has already been settled, and
this route does not settle it twice.

**The execution's status becomes that**, and nothing else decides it: an
execution in `unknown` becomes `completed` or `failed`, and `finishedAt` is
written with it. **The reply's status follows it** — the messages of that
execution become `complete` or `failed`. The message status is not the
execution status: it carries `complete` where the execution carries
`completed` (`packages/contracts/src/conversation.ts:62`), and a client that
expects the execution's word on the reply's word will be wrong.

**The reply carries the server's own sentence.** `detail` is the account the server
produced of how the turn ended, and it travels on the reply: the messages of that
execution carry it when the execution is settled
(`apps/server/src/modules/executions/service.ts:108-111`, and
`apps/server/src/modules/approvals/resume.ts:197-201` for the turn that is closed
rather than continued). **A client shows it as it is given**
(`apps/web/src/components/ChatMessageList.tsx:136`): the account of what happened
is the server's, and rewording it in the client would be the client telling the
owner something the server knows better. **A client written before this route existed
reads a reply that carries no `detail`, and that is not an error** — the sentence is
the account of a turn that did not finish, and a turn that finished has nothing to
say.

**The note is recorded with the transition.** The audit entry carries it, and on
an execution that failed it is the execution's `error`, because that column
carries a reason only where there is an error
(`apps/server/src/modules/approvals/service.ts:170`).

**The route is for the run the list draws as a turn.** A turn on the waiting
list is an execution whose outcome could not be confirmed and that belongs to no
task ([The waiting list](#the-waiting-list)), and the id the list draws is
`turn:<execution id>` — the id this route takes. A run that belongs to a task is
the task's own outcome, and it is closed through the task's own path.

**The item leaves the waiting list.** A turn is on the list because its
execution's outcome could not be confirmed, so an execution that is no longer
`unknown` is no longer waiting on the owner.

**The transition is written to the audit trail** as `execution.outcome.resolved`,
beside the task path's `task.outcome.resolved`
(`apps/server/src/modules/factory/service.ts:319`). It names the owner the way
the task path's does — `actorType: 'human'` and the owner's id — and its
metadata carries the transition, `from: 'unknown'` and `to` the outcome.

**The route is additive.** No existing route's shape or semantics change. It
takes the same authentication and workspace rules as every other owner-facing
route — a session cookie or the owner token, and never an agent token, which is
MCP-only — and it is published in the route table with the rest.

This entry is the contract for **WI-031**, and the code implements it — as of
`414996c`, which landed twenty-seven minutes after the contract itself
(`363428e`), and `3dd490b` brought the route to the published shape after it.
The route is `POST /api/executions/:id/resolve`, at
`apps/server/src/api/executions.ts:21`, and it is registered at
`apps/server/src/app.ts:227`. **Only the owner may call it**, under the same
authentication as every other owner-facing route
(`apps/server/src/api/helpers.ts:14-16`). **The route's own writer is the
executions service**, which writes the execution's status
(`apps/server/src/modules/executions/service.ts:93-95`) and the reply's status
(`apps/server/src/modules/executions/service.ts:108-111`) together; the
route calls it at `apps/server/src/api/executions.ts:25`. **There are two
writers of an execution's outcome, not one**: the other is `resolveExecution`
(`apps/server/src/modules/approvals/service.ts:163`), which the approval
decision path calls (`apps/server/src/modules/approvals/resume.ts:159`) and
this route does not.

**Migration.** Nothing is reclassified, and no execution is closed by this
change. A client written before this route existed has nothing to migrate: the
route table did not carry it, so no client was written against it, and every
route it knew keeps the shape and the semantics it had. **A turn recorded
before the change keeps the outcome it was recorded with** — an execution left
in `unknown` stays in `unknown` and stays on the waiting list until the owner
closes it, because the route closes nothing by arriving. An unknown outcome is
still never retried automatically. **The note's bound changes no record.** A
client written against the published shape before the bound was published may
send a note the code has always refused, and it is refused now with
`validation_failed`; a client whose notes stay within 2,000 characters is
unaffected. **A note recorded before the change is not reclassified** — the cap
is on what a client may send, not on what a record may hold, and a record is
not rewritten because a contract gained a bound.

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
| `mcp`   | Agents that are an MCP server.                                           |
| `echo`  | Built-in deterministic agent, for local use and tests.                   |

ACP provides a session-oriented interface and capability negotiation. A2A supports
task-oriented communication between independent agents, including discovery,
artifacts and task states.

The standards are implemented using maintained protocol SDKs where possible, not
rewritten from scratch.

### The MCP adapter

An MCP server becomes an agent connection. The owner names the server, the tool
a turn calls, and the tools the connection may call at all; the credentials
live in a server-held secret record and are never inlined into the
configuration.

```ts
interface McpAdapterConfig {
  transport: 'stdio' | 'http';
  command?: string; // stdio
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  url?: string; // http
  authTokenRef?: string; // a reference, never a value
  protocolVersion: string;
  toolName: string;
  argumentTemplate: string;
  allowedTools: string[];
  timeoutSeconds: number;
}
```

A turn is one tool call. The adapter initializes the session, lists the
server's tools, and calls the configured one; the tool's text output is the
reply.

**The adapter claims only what it can do.** An MCP tool call is atomic: it
cannot be interrupted, it cannot take input while it runs, and it answers in
one piece. So the adapter reports `cancel: false`, `streaming: false` and
`acceptsSteering: false`. A connection whose server does not publish the
configured tool, or whose tool is outside `allowedTools`, reports `chat: false`
rather than failing a turn at the moment the owner is waiting for it.

**The server's environment does not leak into the agent's.** A supervised MCP
server process is started with an explicit allow-list plus the values the owner
configured — the same rule the `cli` adapter follows, and the same helper
(`buildSanitizedEnv` in `packages/agent-adapters/src/util.ts`).

**Migration.** The adapter type enum grows by one member and nothing is
reclassified. A client that switches exhaustively on the adapter type must now
render `mcp`; a connection that is not an MCP server is unaffected. The
capabilities shape grows by one optional member, `acceptsSteering`, and absent
means the connection cannot be steered. A connection recorded before this
change reports the capabilities it always reported.

This entry is the contract for **WI-053**, and the code implements it — the
adapter is `packages/agent-adapters/src/mcp.ts`, the configuration schema is
`packages/contracts/src/adapter-config.ts`, and the panel's connection form
carries the fields.

### The adapter lifecycle

Every adapter has the same three steps, and the order matters.

```ts
interface AgentAdapter {
  readonly type: AdapterType;
  connect(connection: AgentConnection): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  close?(): void | Promise<void>;
}
```

`connect` establishes the runtime and reports the capabilities that are actually
true. `send` runs one turn on that runtime. `close` releases everything the
adapter holds — the supervised child process, the transport, the socket.

**A capability probe on one instance does not initialize a later instance.**
`connect()` on a throwaway instance says nothing about an instance that has not
been connected, so an instance whose runtime was never established is not
assumed to be ready.

**A turn asked to run on an unconnected instance is refused, not attempted.** The
refusal is an `execution.error` event with the code `adapter_not_connected`
(published as `ADAPTER_NOT_CONNECTED_CODE` in
`packages/contracts/src/agent.ts`) and a message that says what is wrong and what
to do about it: _"This MCP adapter was not connected. Call connect() before
send()."_ When a connection attempt failed, the reason follows the fix, because
the reason is what the owner acts on.

**The refusal exists where there is a runtime to be missing.** An adapter that
holds a runtime between the connection and the turn must be connected; an adapter
whose runtime is the turn itself, or nothing at all, has nothing to be missing.

| Adapter | `connect()` establishes                                                                        | A turn without `connect()`                                 |
| ------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `mcp`   | the server process and the `initialize` / `notifications/initialized` / `tools/list` handshake | **refused** with `adapter_not_connected`                   |
| `cli`   | that the command exists                                                                        | **refused** with `adapter_not_connected`                   |
| `acp`   | a handshake probe against a real agent                                                         | allowed — the turn sets its own session up                 |
| `a2a`   | the agent card                                                                                 | allowed — the request is made and answered within the turn |
| `http`  | the gateway's capabilities                                                                     | allowed — the request is made and answered within the turn |
| `model` | the provider's capabilities                                                                    | allowed — the request is made and answered within the turn |
| `echo`  | the echo agent's capabilities                                                                  | allowed — there is no runtime to be missing                |

**ACP keeps its send-time setup.** A turn still initialises, creates or restores
its session and prompts the agent, with or without a prior `connect()`. ACP's
`connect()` is a real handshake against a real agent, and the capabilities it
reports are the ones the agent answered with; it is a probe, not a runtime the
turn borrows, so it releases the agent it started.

**A turn that ends, fails or is abandoned must not leave a child process
behind.** The caller closes the adapter when the turn is over, and a capability
probe closes the instance it opened.

**Migration.** The interface grows by one optional member, `close?()`, so every
existing adapter and every existing caller still compiles; absent means the
adapter holds nothing to release. No capability flag changed meaning:
`cancel: false` still means the protocol cannot interrupt a turn, and
`streaming: false` still means the protocol cannot stream one. The refusal is a
failure of the _connection_, not of the adapter's abilities.

This entry is the contract for **WI-145**, and the code implements it — as of
`cc3f2c4` — the lifecycle is `packages/agent-adapters/src/lifecycle.ts`, the
refusal is in each adapter, and `packages/agent-adapters/src/__tests__/lifecycle.test.ts` drives
the real fixtures: a real MCP server over stdio, a real ACP agent and real child
processes. The slice's own record is
[docs/contract-adapter-lifecycle.md](docs/contract-adapter-lifecycle.md).

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
  /**
   * Whether the agent can take input while a turn is running. A connection
   * that does not report it cannot be steered; see
   * [Contract 7](#contract-7--the-interaction-model).
   */
  acceptsSteering?: boolean;
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

### The adapter boundary

**The domain depends on the adapter interface and never on the adapters.** The interface
and the shapes around it are published here, by `@personal-os/contracts`. The package that
holds the concrete adapters — `@personal-os/agent-adapters` — is not a dependency of the
domain.

```ts
/** What an adapter may say. */
interface AdapterLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

/** What the server hands an adapter. */
interface AdapterContext {
  resolveSecret(ref: string): Promise<string | undefined>;
  logger: AdapterLogger;
}

/** A registry of adapters, as the domain needs it. */
interface AdapterProvider {
  has(type: AdapterType): boolean;
  list(): AdapterType[];
  create(config: AdapterConfig, ctx: AdapterContext): AgentAdapter;
}
```

- **The domain names `AdapterProvider`, not the class.** `packages/agent-adapters` holds
  the class that implements it (`AdapterRegistry`) and every concrete adapter; the domain
  holds the shape. **So the domain cannot reach an adapter except through this boundary,
  and adding an adapter type does not touch it.**
- **One place builds the registry.** `apps/server/src/runtime.ts` is the composition root,
  and it is the only file outside the tests that names the adapters package.
- **The worker reaches adapters through the server's runtime**, not through the package,
  and does not declare the package as a dependency at all.

**This is checked, not promised.** `apps/server/src/__tests__/adapter-boundary.test.ts`
reads the source tree and fails if a domain module imports the adapters package, if the
worker declares the dependency, or if any file other than the composition root names the
package.

**The limit, stated plainly: this is about the dependency, not about the words.** The
domain may name a provider in a fixture — that is configuration, and
`docs/decisions/0004-adapter-registry.md` allows it. **What the check holds is the
named import edge:** it fails when a domain module, the worker, or any shipped file
outside the composition root names `@personal-os/agent-adapters`. What it does not
hold is an import that reaches the package by a relative path — such an import
carries no package specifier, so the check stays green and `tsc` is what catches it,
with TS2307.

**Migration.** The shapes move from `@personal-os/agent-adapters` to
`@personal-os/contracts`, and the adapters package re-exports them, so an existing import
of `AdapterContext` or `AdapterLogger` from the adapters package keeps working. The
domain's own import of `AdapterRegistry` becomes an import of `AdapterProvider` — **a
change of type, not of behaviour, and nothing outside the domain can tell.**
`apps/worker` no longer declares the adapters package.

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
`70d042c`. `personaSchema` is at `packages/contracts/src/agent.ts:30`,
`resolvePersona` at `:80`, the connection's base persona at `:103`, and the
participant's override at `packages/contracts/src/conversation.ts:38`.

**Migration.** Nothing is reclassified and nothing is rewritten. Both fields are
optional, so a connection and a participant written before this change stay valid
and resolve to the runtime's default. The persona applies only to turns taken after
it.

### The adapter presets

A preset is a **starting template** for an agent connection. Every adapter type
has one, and each of the five approved target runtimes has one.

```ts
interface AdapterPreset {
  id: string; // stable, the key the client and server use
  adapterType: AdapterType; // the type the preset belongs to
  name: string; // what the owner reads in the picker
  description: string; // what it is for, in a line or two
  config: AdapterConfig; // validated against the schema for its type
  persona: Persona; // the published persona shape
  capabilities: AgentCapabilities; // what the adapter type can deliver
  requires: string[]; // what the owner still has to supply
  credential?: 'apiKey' | 'authToken'; // which secret field belongs here
  verified: boolean; // has this template been run here?
  runtime?: 'Codex' | 'OpenCode' | 'Pi' | 'Hermes' | 'OpenClaw';
}
```

**A preset is not an integration.** The five approved target runtimes are
integration _candidates_: none has been demonstrated in this repository. Every
preset that names a runtime carries `verified: false` and says so in the copy the
owner reads. The difference between "here is the command line we believe this
runtime uses" and "this integration is proven" is visible in the data and in the
panel, not only in a changelog.

**A preset carries the persona whole.** The schema requires both `role` and
`instructions`, because [the persona](#the-persona) is resolved by
`resolvePersona`: a conversation's override **replaces** the connection's base
persona field by field and never merges with it. A preset that supplied only a
role would leave a stranger the moment a conversation overrode the
instructions, and the other way round. A preset's persona becomes the
**connection's base persona** — the base, never an override.

**The catalogue is a pure function of the module**, so it is testable without a
database: `listAdapterPresets()`, `listAdapterPresetsFor(adapterType)` and
`getAdapterPreset(id)`. Every entry is parsed through the schema when the module
is loaded, so a preset whose configuration does not parse against its own
adapter type throws at import — in the build and in the tests — rather than
reaching an owner.

**A preset's capabilities are a ceiling, not a promise.** They say what the
adapter type can deliver for that template. What the agent actually supports is
discovered by the probe the server runs on save, and the panel shows the probe's
answer rather than the preset's list.

**A preset names a credential and never carries one.** It carries no value and
no `*Ref` either — a reference names a secret record on the server, and a preset
cannot know which record the owner will create. The catalogue is served to the
browser, so a preset that carried a credential would leak it.

**A preset is a base, not a replacement.** `POST /api/agents` takes an optional
`presetId`; the server lays the owner's configuration over the preset's,
validates the merged configuration with the existing `parseAdapterConfig` path,
and takes the preset's persona as the base persona when the owner wrote none.
The owner's own persona wins.

The runtime mapping — each preset picks **one** surface and names the
alternative in its copy, so the owner chooses the surface rather than having
one hidden from them:

| Runtime  | Adapter type | The surface the preset uses         | The alternative it names                        |
| -------- | ------------ | ----------------------------------- | ----------------------------------------------- |
| Codex    | `cli`        | the command line                    | the native App Server and ACP surfaces          |
| OpenCode | `acp`        | an ACP-compatible session           | the native HTTP server and its SSE event stream |
| Pi       | `cli`        | the long-lived JSONL RPC subprocess | —                                               |
| Hermes   | `http`       | the HTTP run API                    | ACP and the programmatic gateway                |
| OpenClaw | `http`       | the HTTP gateway surface            | the gateway WebSocket and the ACP bridge        |

This entry is the contract for **WI-142**, and the code implements it — as of
`0c7c1f5` — the catalogue is `packages/contracts/src/adapter-presets.ts`, the
route is `GET /api/agent-presets`, and the panel's connection form carries the
template picker. The slice's own record is
[docs/contract-adapter-presets.md](docs/contract-adapter-presets.md).

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
  templateId?: string; // the template this resource was made from
  templateVersion?: number; // and the version of it
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

**A resource records where it came from.** `templateId` and `templateVersion` are
optional, and they are a record rather than a link: a resource made from a template
carries the template's id and the version of it, a resource written from a spec
carries neither, and a later version of the same template does not change a resource
that was made from an earlier one. The resource stays an ordinary resource — the same
contract, the same validation, the same revision — and the two fields are the only
trace of the template it was made from.

**Migration.** The two columns are additive and nullable
(`apps/server/drizzle/0009_kind_lilith.sql`), and **nothing is backfilled**: a
resource written before the migration has `null` in both, which is what the shape
above publishes as absent. The same two columns are on `automations` and on `tasks`,
and the same rule applies to them.

**The author is a closed set.** `createdBy` is a string, and the strings it may
hold are published as `resourceAuthorSchema`
(`packages/contracts/src/resource.ts:26`): an agent connection's id (`agt_…`), the
owner's user id (`usr_…`), the literal `owner` for a write by the owner when no
user id is known, and the literal `system` for a write with no authenticated actor
behind it. The recorded id is derived from the authenticated identity
(`apps/server/src/lib/author.ts:28`), never from the request body, so a caller
cannot name an author the request did not authenticate.

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

A template is a **named, versioned example of one resource kind, with its spec and the
guide that says what a good one of that kind is, that an agent can start from**. It
answers a question a schema cannot: a schema is a type, and a template is an example
that was written, reviewed and shipped.

```ts
interface ResourceTemplate {
  id: string; // stable across versions
  version: number; // positive integer, bumped when the spec changes
  type: ResourceType; // the kind this template starts
  title: string;
  description: string;
  spec: unknown; // validated by the owning provider for `type`
  guide: ResourceTemplateGuide; // required
}

interface ResourceTemplateGuide {
  summary: string;
  whenToUse: string[];
  whenNotToUse: string[];
  fields: { path: string; what: string; mustSet: boolean }[];
  mistakes: string[];
  checklist: string[];
}

interface ResourceTemplateRef {
  id: string;
  version?: number; // omitted means the newest published version
}
```

`ResourceType` is the published kind enum — `dashboard | document | automation |
data-source | task | memory`
(`packages/contracts/src/resource.ts:4-10`,
`packages/contracts/src/resource.ts:12`). A template
belongs to exactly one kind, and `version` is part of its identity: the registry
may hold several versions of one template, and each version is a spec that was
reviewed on its own.

**The guide is required.** It is not an optional part of the record: `guide` is
required in `ResourceTemplate`, and it has six sections. `summary` says what the
template is for, `whenToUse` and `whenNotToUse` say when to reach for it and when not
to, `fields` says which fields the caller has to set — each one with the `path` it
lives at, what it means and whether it `mustSet` — `mistakes` says what a reader
would get wrong, and `checklist` is the last look before shipping. **This is the one
change that breaks a client that holds templates of its own**: a template without a
guide is no longer a template, so anything that reads, writes or ships a template has
to carry one.

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
the product would reject. **The resource records where it came from** — the
template's id and the version of it, as `templateId` and `templateVersion` — and it
is a copy rather than a link: a later version of the same template does not change
a resource that was made from an earlier one.

**The template is reached through the tool surface an agent already uses.** That
surface is the existing `resource.*` MCP surface — not a second tool surface, and
not a second way to create a resource:

| Tool                     | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `resource.template.list` | List the templates published for one resource kind.  |
| `resource.template.get`  | Read one template in full — its spec and its guide.  |
| `resource.create`        | Create a resource — from a template, or from a spec. |

`resource.template.list` takes an optional `type` — the kind — and returns the
templates published for it. **Without a `type` it returns the newest published
version of every template**, one row per template and none of them twice, sorted by
id (`apps/server/src/modules/resources/templates.ts:414`). The six that ship are
one for each kind, so a call with no `type` answers with six templates.

`resource.template.get` takes `{ id, version? }` and reads one template in full —
**its spec and its guide** — so an agent can read what a good one of that kind is
before it creates anything. A version names one reviewed spec
(`apps/server/src/modules/resources/templates.ts:434`); without one, the
newest published version is meant
(`apps/server/src/modules/resources/templates.ts:428-431`). An unknown template id
is `not_found`.

`resource.create` gains **one optional input**, `template`:

```ts
// the resource.create input
{ workspaceId?, type, title, data?, template? }
```

**`data` and `template` are not mutually exclusive — they merge.** `template` names
the template to start from, and its `type` must equal the `type` the call asks for.
`data` is the caller's own values, and the resource's `data` is the template's
`spec` with those values merged into it. **A call that carries both is no longer
refused — it is answered**, and the values the call did not name are the template's.
A template whose spec the owning provider refuses is `validation_failed`
(`apps/server/src/modules/resources/service.ts:673-678`), and a template of another
kind is refused the same way
(`apps/server/src/modules/resources/service.ts:687-691`); an unknown template id is
`not_found`. Those codes are already published in
[Error envelope](#error-envelope); this entry adds none. The tool's visibility
follows the same grant rule as every other tool on that surface, published in
[MCP exposure](#mcp-exposure).

**The merge rules are these.** They are implemented by `mergeTemplateSpec`
(`apps/server/src/modules/resources/templates.ts:534`), and the rules per kind
are at `apps/server/src/modules/resources/templates.ts:509-522`:

- **Objects merge key by key.** A key the caller's values do not name keeps the
  template's value, and the merge is recursive: a nested object merges the same way.
- **An array is replaced whole.** The caller's array is the array; the template's
  does not survive beside it.
- **A change of the shape key replaces the whole spec.** The shape key is `kind` for
  a data source and `scope` for a memory. When the caller's values name the shape
  key and it differs from the template's, the caller's values are the spec: a data
  source that becomes `http` keeps no inline `payload`, and a memory that becomes
  agent-scoped keeps none of the workspace memory's shape. A caller who says nothing
  about the shape keeps the template's.
- **Some paths are replaced whole, whatever they are.** An automation's `trigger` and
  `action` are named whole — the caller who names one means that one — and a memory's
  `value` is the memory itself.
- **A dashboard's widgets merge by the widget's own `id`.** A widget the caller names
  by the same id is updated field by field; a widget the caller does not name
  survives; a widget the caller adds is appended after the template's. A widget whose
  `type` changes is the caller's, whole.
- **The merge never refuses.** The owning provider judges the merged spec exactly as
  it judges a spec that arrived whole.

**The code implements this — as of `20ca643`.** WI-017 built the record, the tool
and the input, and WI-097 built the guide, the filling and the record of where a
resource came from; the tree carries all of it. `resourceTemplateGuideSchema` is at
`packages/contracts/src/resource.ts:87` and `ResourceTemplateGuide` at
`packages/contracts/src/resource.ts:116`. `resourceTemplateSchema` is at
`packages/contracts/src/resource.ts:128` and `ResourceTemplate` at
`packages/contracts/src/resource.ts:149` — the record, with the guide required in it
(`packages/contracts/src/resource.ts:147`) — and `resourceTemplateRefSchema` and
`ResourceTemplateRef` are beside them at
`packages/contracts/src/resource.ts:157` and
`packages/contracts/src/resource.ts:161`. `resource.template.list` and
`resource.template.get` are both published tool names — they are in `mcpToolNames`
at `packages/contracts/src/mcp.ts:21-22`, inside the range
`packages/contracts/src/mcp.ts:10-26`, and in the
default agent grant list at `packages/contracts/src/mcp.ts:47-48`. The server
registers both tools only where
the connection is granted them, the way every other tool on that surface is
(`apps/server/src/modules/mcp/server.ts:533-577`). `resource.create` takes the
`template` input at `apps/server/src/modules/mcp/server.ts:429`, merges the caller's
values into the template's spec at
`apps/server/src/modules/mcp/server.ts:447-449`, and passes the template's id and
version on at `apps/server/src/modules/mcp/server.ts:459`. The merge rules
themselves are at `apps/server/src/modules/resources/templates.ts:509-522`, and the
resource records them at
`apps/server/src/modules/resources/service.ts:191-192` and
`apps/server/src/modules/resources/service.ts:401-402`.

**The six templates that ship are one for each kind**, authored in the repository
at `apps/server/src/modules/resources/templates.ts:21`:

| Kind          | Template id                |
| ------------- | -------------------------- |
| `dashboard`   | `dashboard.metrics`        |
| `document`    | `document.brief`           |
| `data-source` | `data-source.json`         |
| `automation`  | `automation.manual-prompt` |
| `task`        | `task.deliverable`         |
| `memory`      | `memory.decision-note`     |

Each is published at version 1, each carries a guide, and every one is checked
against the provider that owns its kind when the service is built
(`apps/server/src/modules/resources/service.ts:486-488`), so a template that drifted
is caught at the door rather than by an agent that reached for it.

**A client may now call `resource.template.list` and `resource.template.get`, and may
send `template` on `resource.create`.** The calls exist and the input is accepted; a
client written before this change has to make room for all of it.

**Migration.** Nothing is reclassified and no record is rewritten.
`resource.create` without `template` behaves exactly as it does today, so no
existing client changes what it sends. **The surface grew, and that is the change a
client written before has to allow for**: a client that reads the list of MCP tools
gains two names — `resource.template.list` and `resource.template.get` — and a
client that validates an agent's `toolGrants` against the known names has to allow
for them, because the grant vocabulary grew with the surface. **A client that holds
a template of its own has to carry a guide**, because the guide is required.
**A client that sends both a spec and a template now gets an answer instead of a
refusal**: the two merge, and the merged spec is what the resource carries. A
client that renders a resource is affected in one place: the resource gained two
optional fields, `templateId` and `templateVersion`, and a resource written before
the migration carries neither.

### A resource is never born live

**A resource is never born live.** A dashboard is created unpublished and an automation
is created disabled, whatever the spec asked for — so **a template creates a draft**, and
publishing or enabling it is a separate, deliberate act.

- **The judgment is the owning provider's, not the merge's.** The merge never refuses and
  never judges: it merges, and the provider judges the result exactly as it judges a spec
  that arrived whole (`apps/server/src/modules/resources/templates.ts:534`). The
  automation's provider writes `enabled: false` on create
  (`apps/server/src/modules/resources/service.ts:276`); the dashboard's writes
  `published: false` (`apps/server/src/modules/resources/service.ts:756`, reached
  from the provider's create at `apps/server/src/modules/resources/service.ts:342`).
- **Creation is the only place the rule bites.** An update that names `published: true` or
  `enabled: true` still makes a resource live, because an update is a deliberate act on a
  resource that already exists. **The two kinds behave the same way here**: the generic
  `PATCH /api/resources/:id` takes a spec, and the automation's provider writes the
  `enabled` that spec names (`apps/server/src/modules/resources/service.ts:310`) just as
  the dashboard's writes the `published` it names.
- **Each kind has its own act.** `POST /api/resources/:id/publish` publishes a dashboard
  and enables an automation (`apps/server/src/modules/resources/service.ts:578`), and the
  automation also has `POST /api/automations/:id/enable` and
  `POST /api/automations/:id/disable` (`apps/server/src/api/automations.ts:61`,
  `apps/server/src/api/automations.ts:72`).

**Forcing the flag does not make a broken spec acceptable.** A spec that is not an object
is passed on untouched, so the schema refuses it exactly as it always did.

**Migration.** A client that created a dashboard with `published: true` — from a template
or on its own — now gets an unpublished one, and has to make the publish act to make it
live. **The flag was not read by the client**: `apps/web/src/components/ResourceEditor.tsx:37`
is the only place the web client mentions it, and it writes `published: false` when the
owner starts a new dashboard — so nothing visible changes, and the contract says so rather
than leaving it to be found. Nothing is reclassified and no record is rewritten.

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
`packages/contracts/src/resource.ts:216`, the spec's `agentConnectionId` at
`packages/contracts/src/resource.ts:226`,
and `listAgentMemories` at
`apps/server/src/modules/resources/agent-memory.ts:29` is what puts the agent's
memories in the turn context.

**The read side is WI-028, and the code implements it — as of `622812c`.** The
owner's ruling of 2026-10-21 at 07:07 was that an agent's own memory is private
to it, on reads as well as on writes, and the sentence above now says so. The rule
is one call — `assertOwnMemory` at
`apps/server/src/modules/mcp/server.ts:240`, with `memoryOwner` at
`apps/server/src/modules/mcp/server.ts:204` — and it
answers the same way for the three resource tools: `resource.create` at
`apps/server/src/modules/mcp/server.ts:482`,
`resource.update` at `apps/server/src/modules/mcp/server.ts:551` and `resource.get`
at `apps/server/src/modules/mcp/server.ts:516`. A memory's owner is
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
| `resource.template.get`  | Read one template in full — its spec and its guide.     |
| `automation.create`      | Create an automation.                                   |
| `automation.inspect`     | Inspect an automation and its runs.                     |
| `autonomy.read`          | Read the autonomy policy in force for a scope.          |

These are Personal OS tool names, not predefined MCP methods. Agents discover each
tool's input and output schema through MCP.

Tool visibility and authorisation reflect the requesting agent's grants. An owner
token sees every tool; an agent token sees only the tools that connection was
granted. **An ungranted tool is not registered at all**, so it does not appear in the
`tools/list` response and the MCP server cannot route a call to it.

**`autonomy.read` is in the default grant list, so every agent connection gets it.**
A connection with no explicit grants runs on the default set
(`packages/contracts/src/mcp.ts:37-51`), and that set carries `autonomy.read`: an
agent can read the policy that governs it without the owner granting anything else.
A connection whose grants were narrowed explicitly keeps the list it was given — the
tool is not added to a stored list. The owner has it too, because the owner's grant
list is every tool.

It takes an optional `workspaceId`, `goalId` and `conversationId`, and answers with
the effective policy — the strictest of the workspace's policy, the goal's policy and
the conversation's own safeguards, and where each value came from. The shape is the
one published in [the autonomy-policy route](#the-autonomy-policy-route); the tool
answers with the policy itself, where the route answers with it under a `policy`
key. A `workspaceId` the caller names must be one it may reach: an agent reads
only the policy of a workspace it was granted, and a connection that names no
workspace gets its own.

**Reading the policy is not one of the actions the policy governs.** The tool
answers even when the policy refuses that agent's other actions, because an agent
that cannot see why it was refused cannot do anything sensible about it
(`apps/server/src/modules/mcp/server.ts:111`).

**`resource.template.get` is in the default grant list, so every agent connection
gets it.** The same default set carries it beside `resource.template.list`
(`packages/contracts/src/mcp.ts:47-48`): an agent can read a template's guide — what
a good one of that kind is, which fields it must set, and what a reader would get
wrong — without the owner granting anything else. A connection whose grants were
narrowed explicitly keeps the list it was given, and the owner has it too, because
the owner's grant list is every tool.

**A tool the agent was not granted is a dead end for the agent and a silence for
the owner.** A tool the connection was not granted is never registered on its MCP
server, so a call for it is answered with "not found" and the agent is stopped by a
refusal it cannot appeal and cannot show the owner. **The refusal is recorded, and
the owner finds the agent on the waiting list** ([the waiting list](#the-waiting-list)):
the row names the agent and the tool it needed, and the owner's action on it is
`POST /api/agents/:id/grants`, which widens that one grant. The answer the agent
gets is not changed by any of this.

**A refusal on the MCP surface is not the HTTP envelope.** A tool that refuses
answers with `isError: true`, and the result's text is a **flat** `{ code, message,
details }` — the code, the message and the details side by side, with **no `error`
key** around them. The shared envelope in [Error envelope](#error-envelope) is
published for the HTTP surface, and it is not the shape an MCP refusal carries: a
client written against the HTTP envelope finds no `error` key in an MCP refusal and
has to read `code` and `message` off the top level. `details` is there when the
refusal has details and absent when it does not
(`apps/server/src/modules/mcp/server.ts:53-60`).

**The refusal names the action; the rest of its wording is not fixed.** A refusal
the autonomy policy makes says which action was refused, in a sentence the owner can
act on, and it carries the action and the allowed actions in `details`
(`apps/server/src/modules/mcp/server.ts:117-121`). **The wording itself is not part
of the contract**: the sentence is composed from the policy in force, so it changes
when the policy changes, and a client must not match on it. A client matches on the
`code` — a refused action is `forbidden` — and on the `action` in `details`. The one
exception is a refusal whose message is fixed in the code and published in this
section, such as "An agent may only reach its own memory."

**Who owns a resource is settled before it is handed over.** `resource.get`
carries the same rule the writes already carried: an agent-scoped memory is
available to that agent's turns in every conversation, and to no other agent's
turns, reads included. The rule is stated once, in
[The agent memory scope](#the-agent-memory-scope), and it is one rule for the
three resource tools — `resource.create`, `resource.update` and `resource.get` — so
reading a resource is not a way around it. A read that names another agent's
agent-scoped memory is refused with `forbidden` and the message "An agent may
only reach its own memory." The owner's own access is not touched by any of this.

**The read side is WI-028, and the code implements it — as of `622812c`.**

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
  templateId?: string; // the template this task was made from
  templateVersion?: number; // and the version of it
}
```

`revision` and `externalRef` are additive fields. A task update presents the
revision it read; a stale revision is rejected with `409 revision_conflict`. A task
assigned to an external orchestrator keeps that orchestrator's own task identifier in
`externalRef` rather than creating a competing internal workflow.

`templateId` and `templateVersion` are additive fields too, and optional: a task
made from a template carries the template's id and the version of it, and a task
written from a brief carries neither. **Nothing is backfilled** — the two columns
are nullable and were added by `apps/server/drizzle/0009_kind_lilith.sql`, so a
task written before the migration has `null` in both, which is what the shape
publishes as absent.

`unknown` is defined in [The unknown outcome](#the-unknown-outcome).

**A task is judged by the task contract.** The task provider validates a task
resource's `data` against `taskSpecSchema` (`packages/contracts/src/factory.ts:74`) —
the task contract with the fields a caller does not write left out, and nothing else
allowed in (`apps/server/src/modules/resources/service.ts:374-379`). **A task that
breaks it is refused**, with `validation_failed` and the issues in `details`; and an
inspection of a task that breaks it reports it as invalid —
`GET /api/resources/:id/inspect` answers `valid: false` and the issues it found.
**This changes what the product reports, not only what it accepts**: a task the
product used to accept — one carrying a field the task contract does not name, or a
status the contract does not carry — was accepted because the provider's `validate`
returned whatever it was given, and it is refused now. A task written before this
change stays on disk and stays readable; it is the inspection that now says it
breaks the contract.

Execution attempts, external references and status history are separate records.
This leaves an opening for more advanced factory behaviour without designing a
comprehensive issue tracker today.

### Goals, dependencies and progress

A goal is the durable unit of intent, and it is now more than a label on a task:
the owner can open a goal and see the work under it, and see its shape as
counts.

**A task carries what it waits on.** `factoryTaskSchema` gains one optional
field, so a task written before the column existed reads back as a task that
waits on nothing — which is what it recorded.

```ts
export const factoryTaskSchema = z.object({
  // ...every existing field, unchanged...
  /** The tasks this task waits on. A task never waits on itself. */
  dependsOnTaskIds: z.array(idSchema).optional(),
});
```

The direction is the task that waits to the task it waits on. **A task must
never wait on itself, directly or through a chain**: the work would be waiting
for work that is waiting for it, and nothing would ever move again. A write that
would close such a loop is refused with `bad_request` and the graph is left as
it was.

**The dependency edge** carries what the board needs to name what it is waiting
for, without a second read.

```ts
export const taskDependencySchema = z.object({
  taskId: idSchema; // the task that is waiting
  dependsOnTaskId: idSchema; // the task it waits on
  dependsOnTitle: z.string(); // what the waited-on task is called
  dependsOnStatus: taskStatusSchema; // the status it is in
  satisfied: z.boolean(); // done or cancelled: out of the way
});
```

**The goal rollup is counts, never a ratio.** A counter is a count and never a
ratio: the band says how many, and a share is only shown when there is something
to divide by.

```ts
export const goalRollupSchema = z.object({
  goalId: idSchema,
  total: z.number().int().min(0),
  waitingOnOwner: z.number().int().min(0), // in review, or unknown
  waitingOnDependency: z.number().int().min(0),
  byStatus: z.object({
    open: z.number().int().min(0),
    active: z.number().int().min(0),
    blocked: z.number().int().min(0),
    review: z.number().int().min(0),
    done: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    unknown: z.number().int().min(0),
  }),
});
```

The work waiting on the owner is counted apart from the work merely under way:
a task in `review` waits for an acceptance decision, and a task whose outcome
could not be confirmed waits for the owner to say what happened.

**The goal view** is the goal, its rollup, its tasks and its dependencies.

```ts
export const goalViewSchema = z.object({
  goal: goalSchema,
  rollup: goalRollupSchema,
  tasks: z.array(factoryTaskSchema),
  dependencies: z.array(taskDependencySchema),
});
```

Three reads carry this, all behind the session and all answering with the
shared error envelope:

| Method | Path                      | Answers                                                    |
| ------ | ------------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/goals/overview`     | `{ goals, rollups }` — the goals and the counts under each |
| `GET`  | `/api/goals/:id/view`     | the goal view: goal, rollup, tasks and dependencies        |
| `GET`  | `/api/tasks/dependencies` | `{ dependencies }` — what the workspace's tasks wait on    |

`PATCH /api/tasks/:id` accepts `dependsOnTaskIds`, and the list replaces the
task's dependencies. A dependency on a task that does not exist is refused with
`not_found`; a dependency that would close a loop is refused with
`bad_request`. The task's revision moves with the change, so the existing
`expectedRevision` guard applies to it as it does to every other field.

**The acceptance rule is untouched.** A task moves to `review`, never straight
to `done`. Only `POST /api/tasks/:id/accept` closes a task, and a rejection
sends the work back with the reason.

**Migration.** `apps/server/drizzle/0011_nice_leopardon.sql` adds one nullable
column and drops nothing: `ALTER TABLE tasks ADD depends_on_task_ids text;`. No
row is rewritten and no data is dropped. The generated snapshot is committed
with the SQL.

**The limits, stated plainly.** Dependencies are set after the task exists — a
task is made, and then it is told what it waits on. The wait is a fact about
the work, not a rule: a task that waits on a task that is not out of the way is
shown as waiting, and nothing stops an agent from being handed it anyway. The
counts are of the tasks, not of the effort, and a goal's shape is read at the
moment it is asked for, so nothing can drift out of date.

This entry is the contract for **WI-143**, and the code implements it — as of
`4dc105b` — the shapes are in `packages/contracts/src/factory.ts`, the rules are
pure functions in `apps/server/src/modules/factory/graph.ts`, and the slice's own
record is [docs/contract-factory-goals.md](docs/contract-factory-goals.md).

### Autonomy policy

An autonomy policy carries at least execution limits, allowed actions and approval
requirements. It has **no pause of its own**: the only pause in the product is the
conversation's own `paused` flag.

**The effective policy is the strictest of three.** A workspace's policy, a goal's
policy and a conversation's own safeguards are resolved in one place —
`resolveAutonomyPolicy` in `packages/contracts/src/autonomy.ts` — and every
enforcement point consumes that one result. The strictest limit wins,
`allowedActions` is the intersection of the policies that name any,
`approvalRequired` is their union, and the mode is the least autonomous of them. A
goal may tighten its workspace and may never loosen it. The action vocabulary is
closed — `message.send`, `tool.call` and `artifact.create` — and an action outside
it is refused rather than passed.

**When no policy names any action, the effective set is every action in the
vocabulary.** That is the other half of the intersection, and it is published
rather than implied: a policy that names no action does not restrict the
actions, so the effective set is the whole vocabulary, which is what the stored
defaults mean. **The policies that reach that state are the ones that never
named one** — a write that names an empty list is refused, because an empty list
is not a tighter policy but the absence of one, and a stored empty list cannot
be told apart from the stored default. See
[the autonomy-policy write](#the-autonomy-policy-write).

**The limits, the allowed actions and the approvals are enforced.** The worker holds
a turn to the effective policy: the chain's turn count
(`apps/worker/src/executor.ts:1426`) and its spend
(`apps/worker/src/executor.ts:1433`), and the workspace's spend for the day
(`apps/worker/src/executor.ts:1440`), before the turn starts; the policy's duration
limit caps the turn while it runs, and every action the agent announces is checked
against what the policy allows. The MCP surface refuses an action the policy does not
allow, and one the policy wants the owner to approve until the owner has decided. A
turn that exceeds a limit stops, and the outcome is recorded rather than silently
truncated.

**A daily cap is a cap on the workspace.** The workspace's spend for the day is the
sum of the spend units on the executions of that workspace since 00:00 UTC
(`apps/worker/src/executor.ts:1481-1491`,
`apps/worker/src/executor.ts:1482-1488`), and it is the same day for every workspace —
the system stores ISO timestamps everywhere and has no per-workspace timezone. A daily
cap of zero is no cap, as it is for the chain's spend limit. The cap applies across
the workspace's conversations and goals, and not per chain, which is the whole
difference between a daily cap and `maxSpendUnits`.

**A cap is only as good as the number it is measured against.** The daily cap is
measured against the spend units recorded on the executions, and a turn's cost is
one spend unit — the measure the product already has
(`apps/server/src/modules/conversations/routing.ts:306`). **The cost is recorded
against the execution when the turn ends**: the worker writes one unit for an
agent turn and none for a turn that never reached the agent
(`apps/worker/src/executor.ts:892-899`, `apps/worker/src/executor.ts:1186-1191`).
**The row is created with no spend units**, because the cost is not known until
the turn has run (`apps/server/src/modules/conversations/dispatch.ts:171`,
`apps/server/src/modules/factory/service.ts:372`), and the column defaults to zero
(`apps/server/src/db/schema.ts:259`). **So the workspace's spend for the day is
the sum of what its turns actually cost, and the cap bites.**

**The mode is resolved, readable, and enforced nowhere.** It is carried through the
resolver and it is readable wherever the policy is, but no enforcement point reads
it: the only reads of a resolved mode are in the resolver's own tests. **`manual`
does not gate delegation** — an agent may hand work to another agent under
`manual` exactly as it may under `autonomous`, because the mode is consulted by
nothing. The mode is a description and not a control: it records the posture the
owner has set, and it does not decide what runs.

**The mode the owner sets is the mode that is in force.** A workspace carries the
mode twice — the column the panel shows and the policy the resolver reads — and a
setting that lands in one of them and not the other tells the owner something
false: a panel that says "autonomous" while the policy in force says "manual".
**So the two are written together and cannot disagree, whichever way round the
change arrives.** **That is about the setting being honest, not about the mode
being in force** — the mode is still enforced nowhere.

**The effective policy is readable** over `GET /api/autonomy-policy` and through the
`autonomy.read` MCP tool. Its shape is published in
[the autonomy-policy route](#the-autonomy-policy-route).

**And the workspace's own policy is writable.** `PATCH /api/workspaces/:id` accepts an
`autonomyPolicy`, so the limits, the allowed actions and the approvals the owner wants
are set over the API rather than by editing the database. Its shape and the rules of the
write are published in [the autonomy-policy write](#the-autonomy-policy-write).

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
`apps/worker/src/executor.ts:429`, and the gate is the capability and the session
id together: `canResume = capabilities?.persistentSessions === true &&
Boolean(execution.externalRef)`.

**Migration.** Nothing is reclassified. An execution that is already `blocked` when
this ships has no persisted session id, so a decision on it cannot be resumed and
closes the execution exactly as it does today. Only executions started after this
change carry a session id. An approval raised before this change whose execution is
no longer `blocked` cannot be decided either: the decision is refused with
`conflict` and a message that names the execution's status — `This operation is
completed. It is not waiting for a decision.` for an execution that had already
completed — so the approval stays pending and on the waiting list, and nothing
else closes it.

Every entry in the audit trail answers three questions: **who requested an action,
which agent performed it, and what the result was.** Entries are append-only and
readable at `GET /api/audit`.

### The audit outcome

An entry in the audit trail records **what the action produced**, not that a request
was handled. The trail's `result` carries one of four values:

```ts
result: 'queued' | 'succeeded' | 'failed' | 'unknown';
```

**`queued` means the action was accepted and has not finished.** `POST
/api/resources/:id/execute` records `queued` for an automation run it enqueues
(`apps/server/src/modules/resources/service.ts:621`), and answers `queued: true`
(`apps/server/src/modules/resources/service.ts:626`): the route accepted the request
and the run has not happened. The same route runs a data source and a dashboard there
and then, so **the vocabulary is per action, not per route** — one route can record
`queued` for one kind and `succeeded` for another. **`succeeded` means the outcome was
observed and the action worked; `failed` means the outcome was observed and it did
not.**

**`unknown` means the outcome could not be confirmed** — neither a success nor a
failure. It is the same word the unknown outcome uses
([The unknown outcome](#the-unknown-outcome)), and it is in this vocabulary because
the product produces it: the worker writes it when a turn's outcome cannot be
confirmed (`apps/worker/src/executor.ts:112`), and the conversation dispatch writes it
when a turn stops for the same reason
(`apps/server/src/modules/conversations/dispatch.ts:247`). **A vocabulary without
`unknown` would leave the unknown outcome unrepresentable in the trail**, and the
trail is where it is recorded.

**Every mutating route writes an entry, and every entry records what the action
produced.** The route helper wrote `success` for every route that used it
(`apps/server/src/api/helpers.ts:76`) and the audit service defaulted to it
(`apps/server/src/modules/audit/service.ts:79`), so an entry said "done" about a run
that was merely queued. **The twelve routes that used to write no entry at all now
write one each, at the route** —
[the measures route](#the-measures-route) publishes the coverage, that every mutating
route writes an entry, and it lists those twelve, one row each, with the action each
one records. **A route whose action fails writes an
entry that says `failed`**: today it writes none, because every route-level entry is
written after the work and a handler that throws never reaches it, and the error
handler writes nothing (`apps/server/src/app.ts:194`).

**The code does not implement this yet.** The vocabulary is published ahead of its
implementation, because the contract leads and the code follows: the implementation
is WI-033, and the shape above is what it has to reach. No writer in the product
produces `queued`, `succeeded` or `failed` today, and the trail's `result` carries
`success | failure | unknown` until it does
(`apps/server/src/modules/audit/service.ts:19`). **The coverage is implemented**:
every mutating route writes an entry, and the twelve that used to write none write
one each at the route.

**Migration.** **Nothing is reclassified.** No stored entry is rewritten, and no entry
is given an outcome it did not have.

**What a client written before this change may assume, and what it must now check.** It
may assume that `unknown` means the outcome could not be confirmed, and that the trail
is append-only. It must now handle four words where it handled three, and two of the
old ones are gone: **`success` is `succeeded`, and `failure` is `failed`.** A client
that reads `entry.result === 'success'` reads a word that no longer exists.

**A record written before the change carries `success`, `failure` or `unknown` and no
`queued`, and it keeps its word.** An old `success` means an entry was written and the
outcome was not observed — it is not evidence that the action worked. An old `failure`
means the trail never carried it, because no writer produced it, so a client that reads
one treats it as unobserved too. An old `unknown` is the unknown outcome, and it means
exactly what it means after the change.

### The waiting list

`GET /api/waiting?workspaceId=…` returns everything waiting on the owner as one
list, so the client asks for one thing instead of fetching three and joining the
answers itself.

```ts
type WaitingKind = 'approval' | 'task' | 'turn' | 'capability';
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
  toolName: string | null; // the tool the agent was refused, when it waits for a grant
}
```

`id` is the kind and the underlying id, joined by a colon — `approval:apr_1`,
`task:tsk_1`, `capability:cap_1` — so one list can be keyed without the client
having to pair the id with the kind.

**`unknown` is a reason of its own.** An item whose outcome could not be
confirmed is on this list because there is something to check, not because a
decision is waiting and not because the work is stuck. The state itself is
defined in [The unknown outcome](#the-unknown-outcome); this entry publishes the
list's use of it, and the two are not two definitions. The published type
carries `pending | review | blocked | unknown`, member for member with
`apps/server/src/api/waiting.ts:17`, and the route takes the reason straight
from the task's status (`apps/server/src/api/waiting.ts:108`), so a task that cannot be confirmed
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
not a task, so it is not spelled as either. The published kind carries
`approval | task | turn`, member for member with
`apps/server/src/api/waiting.ts:8`.

This entry is the contract for **WI-027**, and the code implements it — as of
`c9bb0bc`. A turn on the list is an execution whose outcome could not be
confirmed and that belongs to no task, and `listUnknownTurns`
(`apps/server/src/modules/conversations/service.ts`) is what lists them; the
route draws them as `turn:<execution id>`, in the band of the work whose
outcome could not be confirmed. A turn that a pending approval already
accounts for is not drawn again beside that approval, the way a task that a
pending approval already accounts for is not.

**`capability` is its own kind.** A capability an agent was refused is waiting on
the owner: the agent called a tool it was not granted, and it cannot go on until
the owner widens that grant. It is not an approval and not a task, so it is not
spelled as either. The published kind carries
`approval | task | turn | capability`, member for member with
`apps/server/src/api/waiting.ts:8`.

**The row carries which agent wanted it and what it needed.** `agentConnectionId`
names the agent that was refused, and `toolName` names the MCP tool it was
refused. `toolName` is `null` on every other kind, because a capability is the
only thing on this list that is named by a tool.

**One row per agent and capability.** A refusal that repeats is the same thing
waiting, not another thing, so the row is counted rather than duplicated
(`apps/server/src/modules/agents/blocked.ts:69`): the count is on the row, and
the owner sees one thing to act on, not a count of how many times the agent
tried.

**The owner widens the grant from the list.** The action for a capability row is
`POST /api/agents/:id/grants` with the row's `toolName`. It widens that agent's
grant to include the one tool and leaves the rest of the grant as it was, so the
action that unblocks an agent cannot take anything away.

**The row leaves when the grant is widened.** A capability the agent holds is not
waiting on the owner any more, so the row leaves the list as soon as the grant
includes it. Whichever route widened the grant, the row leaves: both go through
the one write that changes a grant (`apps/server/src/modules/agents/service.ts:326`).
A list that keeps the row is a list that lies about what is waiting.

**The row leaves and the grant is written in one transaction (WI-131).** The two writes are
one change and are made together (`apps/server/src/modules/agents/service.ts:287`):
the row that says what the agent is waiting on leaves the list, and the grant that
says what the agent may call is written. **So the guarantee is kept in both
directions. The row leaves exactly when the grant includes the capability** — and
**the row stays when the grant write fails.** A write that is refused — a
configuration that is gone, a constraint the owner cannot meet — leaves both as they
were: the row is still on the list, and the grant was not widened. A list that drops
the row while the agent is still blocked is a list that lies the other way.

A transaction is also what holds across processes. The worker is a second process on
the same database, and the refusal it records there is written in a transaction of its
own (`apps/server/src/modules/agents/blocked.ts:44`), so the two meet in the database
rather than in one function's timing: a guarantee that rests on a function never
yielding is not a guarantee.

**Migration.** Nothing changes for a client that widens a grant successfully: the row
leaves the list and the grant is set, exactly as before. **A client whose grant write
failed now keeps the row it was told about** — the write is refused and the list still
says what is waiting, where before the row had left the list while the agent was still
blocked and the owner was told that nothing was waiting.

**Migration.** The kind grows by one member and the item grows by one field, and
nothing is reclassified. A client that matched on three kinds has a fourth case
to handle, and a capability is none of the three it knew: a client that groups
its list by kind has to decide where a capability sits in its own interface
rather than filing it under a task. A client that matches on the reason is
unaffected — the reasons did not change with this entry, and a capability
carries `pending`, the band an approval carries, because both are an agent that
cannot go on. The new field is `null` on every kind that is not a capability, so
a client that reads the fields it knows keeps working; a client that switches
exhaustively on the item's fields has one more field to read.

The blocked capability is the contract for **WI-121**, and the code implements it —
as of `d229b53`: the refusal is recorded at `apps/server/src/modules/mcp/server.ts:720`, the list
draws it as its own kind at `apps/server/src/api/waiting.ts:163`, and the owner's
action is `POST /api/agents/:id/grants`.

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
list in (`apps/server/src/api/waiting.ts:183`): an agent that cannot
continue comes first, then the work whose outcome could not be confirmed, then
the work waiting for an acceptance decision, then the work that is stuck.

The list is scoped to one workspace, and `workspaceId` is required. The route
is read-only, returns only what the owner can see, and requires the same
authentication as every other route.

### The approval evidence

`GET /api/approvals/:id/evidence` returns the evidence a decision is taken
against. The owner decides on two buttons and a title; this is what the buttons
are about.

```ts
interface ApprovalEvidence {
  approvalId: string;
  workspaceId: string;
  execution: ExecutionEvidence | null;
}

interface ExecutionEvidence {
  id: string;
  status: ExecutionStatus;
  error: string | null;
  spendUnits: number;
  startedAt: string | null;
  finishedAt: string | null;
  toolCalls: ToolCallEvidence[];
  artifacts: ArtifactEvidence[];
}

interface ToolCallEvidence {
  toolName: string;
  startedAt: string;
  completedAt: string | null;
  outcome: 'completed' | 'unfinished';
}

interface ArtifactEvidence {
  title: string | null;
  resourceId: string | null;
  createdAt: string;
}
```

**What the agent did** is `toolCalls`: the tool calls of that execution and how
each ended. The calls are the execution's `tool.started` events and the
`tool.completed` events that answer them
(`packages/contracts/src/agent.ts:191`, `:197`). A call that answered has
`outcome: 'completed'` and a `completedAt`; a call that did not has
`outcome: 'unfinished'` and a `completedAt` of `null`. The events name the tool
and not the call, so a call is answered by the next completion for that tool.
**The published vocabulary has no failure event for a tool call**, so the events
do not say why a call did not finish, and this entry does not claim a reason.

**What it produced** is `artifacts`: the execution's `artifact.created` events
(`packages/contracts/src/agent.ts:210`), each with the title it was given and
the resource it made, when it was given either.

**What it cost** is `spendUnits` and `status`. `status` is the execution's own
status, published in [Adapter events](#adapter-events). `error` carries the
reason the execution stopped, and only then: a cancellation carries `null`,
because a cancellation is a decision and not a fault
(`apps/server/src/modules/approvals/service.ts:170`).

**The spend units are recorded, and today they are zero.** A spend unit is an
abstract cost counter, not currency (`packages/contracts/src/common.ts:58`). The
execution is created with `spendUnits: 0`
(`apps/server/src/modules/conversations/dispatch.ts:171`) and nothing writes the
column afterwards — the turn count the router uses to enforce a spend limit is
computed in memory and never stored
(`apps/server/src/modules/conversations/routing.ts:281`). A client that shows
the cost shows `0`, and that is a true statement about what is recorded rather
than a measure of what the work was worth.

**The evidence is the execution and the execution's events.** An approval points
at the execution that raised it (`approval.executionId`,
`packages/contracts/src/approvals.ts:29`), and the tool calls and the
artifacts are that execution's events, read from the event log. **No new storage
is introduced** — the approval, the execution and its events all exist already.
This is the execution's record. The factory's task evidence — results,
artifacts, tests and observations, recorded against a task — is a different
record, and this read does not carry it.

**An approval with no execution shows no execution.** `executionId` can be null
(`apps/server/src/modules/approvals/resume.ts:71`), and the execution it names can be
gone (`apps/server/src/modules/approvals/resume.ts:86`). Both show
`execution: null`, and with it no tool calls, no artifacts and no cost: there
was nothing to show, not an empty run. The decide route already answers the
same way, and its `detail` says which of the two it was.

**The read is read-only, it answers for one approval, and it takes the same
authentication as every other route** — a session cookie or the owner token, and
never an agent token, which is MCP-only.

This entry is the contract for **WI-039**, and the code implements it — the route
is `GET /api/approvals/:id/evidence`, at `apps/server/src/api/approvals.ts:37`,
and it is registered at `apps/server/src/app.ts:226`. The shape it answers is the
one published above, and it lives at `packages/contracts/src/approvals.ts:91`. The
drawer that reads it is WI-040's, and it waits for this route.

**Migration.** There was nothing before this read, so there is nothing to
migrate. A client written against the published surface before this change had
no evidence to fetch, so no promise it was given is now broken. The read is
additive — no existing route changes its shape, no record is reclassified, and a
client that does not call it is unaffected.

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

## Contract 7 — The interaction model

A turn is the unit of one agent's answer. This contract publishes what a turn
is, what it may be given while it runs, how its history becomes canonical, and
what happens to the work it delegates.

It adds to Contract 1 (Conversations) and Contract 2 (Agent connections) and
replaces nothing in them. The factory ledger, the resource contract and the
routing safeguards are untouched by it.

### The turn

A turn is an execution: a row in `executions` with a `conversationId` and no
`taskId`. The waiting list already calls this kind of thing a turn
([The waiting list](#the-waiting-list)); this entry makes it explicit and does
not introduce a parallel concept.

```ts
type TurnStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'committed'
  | 'failed'
  | 'cancelled'
  | 'unknown'
  | 'lost';
```

**`completed` and `committed` are different.** `completed` means the adapter
returned. `committed` means the turn's output is in canonical history and the
turn can be resumed from. The difference is the whole point of the commit
protocol below, and a client that renders the two alike cannot tell a turn
that merely finished from a turn that can be continued.

**`lost` is settled, not retried.** A delegated task whose executor no longer
exists — the worker that was running it was restarted, say — is settled as
`lost` after the restart. It is not `failed`, and it is not re-run
automatically. This is the same honesty the `unknown` state already gives a
turn: work whose outcome cannot be confirmed is never quietly retried.

### The capability view

A turn's effective tool set and grants are captured when the turn is admitted,
and cannot change underneath it. A capability or grant change takes effect on
the next turn.

```ts
interface TurnCapabilityView {
  agentConnectionId: string;
  /** The revision of the connection's capability set at admission. */
  capabilitiesRevision: number;
  toolGrants: string[];
  pinnedAt: string;
}
```

A turn recorded before this change has no view, and the API reports it as
absent rather than as empty. An empty view would say the agent had no tools,
which is a different claim.

### Canonical history

A turn's output enters canonical history only when the commit is acknowledged.
The commit is five steps, in this order:

1. capture a semantic snapshot, and validate the session, the turn and the
   operation's identity;
2. perform the durable mutation, and read canonical history back within the
   same session operation lane;
3. validate the read-back, and obtain the committed revision;
4. wait for the required `HistoryCommitted` projection — and complete the
   compaction lifecycle, when compaction is involved;
5. acknowledge the caller.

**An in-flight event is not canonical history.** The event stream says what is
happening; canonical history is what a resumed turn reads. A client that
reconnects mid-turn sees the events; a turn that resumes reads the history.

The reply message's status moves from `streaming` to `complete` only when the
commit is acknowledged. A crash between the write and the commit leaves the
message `unknown` — the state the contract already publishes, and the one that
means _started, outcome unconfirmed_.

### Steer and queue

A message carries a delivery mode.

```ts
type MessageDelivery = 'steer' | 'queue';
```

`queue` is the default, and it is what happens today: the message waits for the
next turn. `steer` delivers the message into the turn that is running.

**Steering is a capability, not a hope.** A connection whose adapter cannot
take input mid-turn cannot be steered. For such a connection a `steer` is
degraded to a `queue` message, and the degradation is reported rather than
silent: the contract's wording is corrected for the adapter that cannot keep
the promise, and the behaviour is not faked.

```ts
interface AgentCapabilities {
  // ...
  acceptsSteering?: boolean;
}
```

A connection that does not report `acceptsSteering` cannot be steered. Absent
means absent: a connection written before this existed is an agent that cannot
be steered.

**A steer targets one agent.** A message with `delivery: 'steer'` is delivered
to the running turn's agent alone. It does not wake other participants, and it
does not count as a new turn for the duplicate check. This extends
[Routing behaviour](#routing-behaviour); it weakens none of the
[Mandatory routing safeguards](#mandatory-routing-safeguards).

**An unconsumed steer is not dropped.** A steer the running turn never
consumed is delivered to the next turn, and is recorded as having been
delivered late.

### Fork and rewind

Two additive operations on a conversation.

```
POST /api/conversations/:id/fork    // fork at a message
POST /api/conversations/:id/rewind  // continue from an earlier message
```

A fork creates a new conversation that inherits the participants, the persona
overrides and the history up to the message it was forked at, and records the
conversation it came from. A rewind creates a new turn whose canonical history
starts at an earlier message; the earlier turns are retained, not rewritten.

Both are audited like any other change. This is the conversation counterpart of
the resource-level history-and-take-back item, which stays scoped to resources:
the two do not overlap.

### The delegated work tree

Delegated agent work is a visible tree, not a depth counter. `origin.depth`
stays as it is; the tree adds a parent reference beside it.

```ts
interface DelegatedTask {
  id: string;
  /** The turn that delegated the work. */
  parentTurnId: string;
  agentConnectionId: string;
  status: 'queued' | 'running' | 'stopping' | 'succeeded' | 'failed' | 'cancelled' | 'lost';
  outputRef?: string;
  /** When the result reached the parent. */
  deliveredAt?: string;
  /** The consumption candidate, recorded when the parent read the output. */
  consumedAt?: string;
}
```

**Delivery is not consumption.** `deliveredAt` records that the result reached
the parent. A completion notification does not mark the result consumed: the
host records a consumption candidate only after it has successfully read a
terminal task's output, and confirms it as consumed only when the parent turn
ends completed and its terminal state is committed. A parent that reads a
result and then fails leaves the result unconsumed, so the next continuation is
reminded of it again.

### The routes and the events

| Route                             | Method | What it does                                                                           |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `/api/executions/:id`             | GET    | The turn: its status, its capability view, its delegation tree, its committed revision |
| `/api/conversations/:id/fork`     | POST   | Fork the conversation at a message                                                     |
| `/api/conversations/:id/rewind`   | POST   | Continue from an earlier message as a new turn                                         |
| `/api/conversations/:id/messages` | POST   | Gains `delivery: 'steer' \| 'queue'`, default `queue`                                  |

The events are the existing ones, on the existing spine, with the existing
monotonic sequence: `turn.admitted`, `turn.committed`, `turn.failed`,
`turn.lost`, `delegation.started`, `delegation.delivered`, `delegation.consumed`.

**Migration.** The status enum grows by two members and nothing is
reclassified. A client that switches exhaustively on the status must now render
`committed` and `lost`, and a turn that is `committed` is not `completed` in
disguise: it is a turn that can be resumed from. The delivery field defaults
to `queue`, so a client written before this change behaves exactly as it did —
a message it sends is queued, as it always was. A turn recorded before the
change has no capability view and no delegation tree, and the API reports both
as absent rather than empty. No record written before the change is rewritten.

This entry is the contract for **WI-055**, and the code does not implement it
yet. What exists today: a turn is an execution, `unknown` is published for
messages, executions and tasks, and `origin.depth` records the delegation
distance. What this entry adds — `committed`, `lost`, the capability view, the
five-step commit, steering, fork, rewind and the delegation tree — arrives with
that item. The published shapes above are the contract that item implements
against, so the model can be reviewed as a whole before any of it is written.

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
| `GET/PATCH`        | `/api/workspaces/:id`                                | Read and update a workspace. `PATCH` accepts `autonomyPolicy`.                          |
| `GET/POST`         | `/api/agents`                                        | List and create agent connections.                                                      |
| `GET`              | `/api/agent-presets`                                 | The adapter preset catalogue. A template, never an integration.                         |
| `GET/PATCH/DELETE` | `/api/agents/:id`                                    | Read, update, remove a connection. `PATCH` accepts `toolGrants`.                        |
| `POST`             | `/api/agents/:id/probe`                              | Re-run capability discovery.                                                            |
| `POST`             | `/api/agents/:id/grants`                             | Widen one tool grant. The action a blocked agent needs.                                 |
| `GET/POST`         | `/api/agents/:id/tokens`                             | Issue and list MCP tokens.                                                              |
| `DELETE`           | `/api/agents/:id/tokens/:tokenId`                    | Revoke an MCP token.                                                                    |
| `GET`              | `/api/secrets`                                       | List the secret configurations. Metadata only — a value never leaves the server.        |
| `GET/POST`         | `/api/conversations`                                 | List and create conversations.                                                          |
| `GET/PATCH/DELETE` | `/api/conversations/:id`                             | Read, update, remove a conversation.                                                    |
| `GET/POST`         | `/api/conversations/:id/messages`                    | Read and post messages.                                                                 |
| `POST`             | `/api/conversations/:id/participants`                | Add a participant.                                                                      |
| `DELETE`           | `/api/conversations/:id/participants/:participantId` | Remove a participant.                                                                   |
| `GET/POST`         | `/api/resources`                                     | List and create resources. A resource is never born live.                               |
| `GET/PATCH`        | `/api/resources/:id`                                 | Read and update a resource.                                                             |
| `POST`             | `/api/resources/:id/publish`                         | Publish a resource. The act that makes one live.                                        |
| `POST`             | `/api/resources/:id/execute`                         | Execute a resource.                                                                     |
| `GET`              | `/api/resources/:id/inspect`                         | Validate without changing.                                                              |
| `GET/POST`         | `/api/goals`                                         | List and create goals.                                                                  |
| `GET`              | `/api/goals/overview`                                | The goals and the counts under each.                                                    |
| `GET`              | `/api/goals/:id`                                     | Read a goal.                                                                            |
| `GET`              | `/api/goals/:id/view`                                | A goal with its work, its dependencies and its shape.                                   |
| `GET/POST`         | `/api/tasks`                                         | List and create tasks.                                                                  |
| `GET`              | `/api/tasks/dependencies`                            | What the workspace's tasks wait on.                                                     |
| `GET/PATCH`        | `/api/tasks/:id`                                     | Read and update a task. `PATCH` cannot set `done`; it also enforces `expectedRevision`. |
| `POST`             | `/api/tasks/:id/assign`                              | Assign a task to an agent.                                                              |
| `POST`             | `/api/tasks/:id/accept`                              | Record an acceptance decision.                                                          |
| `POST`             | `/api/executions/:id/resolve`                        | Close a turn the owner cannot confirm. See [the entry](#closing-an-unknown-outcome).    |
| `GET/POST`         | `/api/automations`                                   | List and create automations.                                                            |
| `GET/PATCH/DELETE` | `/api/automations/:id`                               | Read, update and remove an automation.                                                  |
| `POST`             | `/api/automations/:id/enable` · `/disable`           | Toggle scheduling.                                                                      |
| `GET`              | `/api/approvals`                                     | List approval requests.                                                                 |
| `GET`              | `/api/approvals/:id`                                 | Read an approval request.                                                               |
| `GET`              | `/api/approvals/:id/evidence`                        | The evidence a decision is taken against. See [the entry](#the-approval-evidence).      |
| `POST`             | `/api/approvals/:id/decide`                          | Approve or reject a sensitive operation. Publishes `approval.decided`.                  |
| `GET`              | `/api/waiting`                                       | Everything waiting on the owner, in one list. See below.                                |
| `GET`              | `/api/audit`                                         | Read the audit trail. See [the entry](#the-audit-outcome).                              |
| `GET`              | `/api/measures`                                      | The product's two measures of itself. See below.                                        |
| `GET`              | `/api/autonomy-policy`                               | The autonomy policy in force for a scope. See below.                                    |
| `GET`              | `/api/events`                                        | Server-sent event stream.                                                               |
| `GET`              | `/api/agui/events`                                   | The same stream in AG-UI. See [the AG-UI stream](#the-ag-ui-stream).                    |
| `POST`             | `/api/agui/runs/:runId/resume`                       | Answer the interrupts of an AG-UI run. See [the AG-UI stream](#the-ag-ui-stream).       |
| `ANY`              | `/mcp`                                               | MCP streamable HTTP endpoint.                                                           |

### The autonomy-policy route

`GET /api/autonomy-policy` answers with the autonomy policy in force for a scope. It
is **read-only**, it answers for **one workspace**, and it follows the same rules as
every other route: a session cookie or the owner token, and never an agent token,
which is MCP-only (`apps/server/src/api/helpers.ts:14-16`) — a request carrying an
agent token comes back `401 unauthorized`.

`workspaceId` is required; `goalId` and `conversationId` are optional. A request
without a `workspaceId` comes back `422 validation_failed` in the shared error
envelope, with `workspaceId` named as the field at fault.

```ts
type AutonomyMode = 'manual' | 'assisted' | 'autonomous';
type AutonomyAction = 'message.send' | 'tool.call' | 'artifact.create';
type AutonomyPolicyLevel = 'workspace' | 'goal' | 'conversation' | 'default';

interface EffectiveAutonomyPolicy {
  mode: AutonomyMode;
  allowedActions: AutonomyAction[];
  approvalRequired: AutonomyAction[];
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  dailySpendUnits: number;
  /** Which policy decided each value. */
  sources: {
    mode: AutonomyPolicyLevel;
    allowedActions: AutonomyPolicyLevel;
    approvalRequired: AutonomyPolicyLevel;
    maxTurns: AutonomyPolicyLevel;
    maxDurationSeconds: AutonomyPolicyLevel;
    maxSpendUnits: AutonomyPolicyLevel;
    dailySpendUnits: AutonomyPolicyLevel;
  };
}
```

The route answers with that policy under a `policy` key. A workspace whose stored
policy is the default, asked about on its own, answers:

```json
{
  "policy": {
    "mode": "manual",
    "allowedActions": ["message.send", "tool.call", "artifact.create"],
    "approvalRequired": [],
    "maxTurns": 8,
    "maxDurationSeconds": 900,
    "maxSpendUnits": 0,
    "dailySpendUnits": 0,
    "sources": {
      "mode": "workspace",
      "allowedActions": "default",
      "approvalRequired": "default",
      "maxTurns": "workspace",
      "maxDurationSeconds": "workspace",
      "maxSpendUnits": "default",
      "dailySpendUnits": "default"
    }
  }
}
```

**`sources` says where each value came from, and it is part of the answer.** It
names the policy that decided each value, so a client that shows an agent what it is
permitted to do can say which bound it is reading. A source of `default` means no
policy bounded that value and the shipped default was used.

**A goal or a conversation belonging to another workspace has no say.** The loader
checks the workspace each belongs to, so a caller cannot reach across workspaces to
loosen a policy or to tighten one either
(`apps/server/src/modules/autonomy/service.ts:72-76`).

**The rules the policy is resolved by are published** in
[the autonomy policy](#autonomy-policy).

### The autonomy-policy write

`PATCH /api/workspaces/:id` accepts an `autonomyPolicy` beside `name`, `description` and
`autonomyMode` (`apps/server/src/api/workspaces.ts:15`). **What is written is the
workspace's own policy, not the policy in force.** The policy in force is composed by the
resolver out of the workspace's, the goal's and the conversation's, so there is no row
that is "the effective policy" to write to; the workspace's is the one the owner owns.

```ts
type AutonomyPolicyPatch = {
  mode?: AutonomyMode;
  allowedActions?: AutonomyAction[];
  approvalRequired?: AutonomyAction[];
  maxTurns?: number;
  maxDurationSeconds?: number;
  maxSpendUnits?: number;
  dailySpendUnits?: number;
};
```

**A change says what changes.** Every field is optional and the ones the owner does not
name are left as they were, so setting the turn limit does not clear the action list that
was set before it (`apps/server/src/modules/workspaces/service.ts:127`). **An absent list
is left alone and an empty list is refused**
(`apps/server/src/modules/workspaces/service.ts:102`), so a change can tighten the list
but never clear it. An empty list names no action, and a policy that names no action does
not restrict the actions — **writing one would widen the policy to every action in the
vocabulary while looking like a tightening.** The refusal is a `422 validation_failed` in
the shared error envelope, and it says what to write instead: name the actions the agent
may take, or leave the list out to keep the one the policy already carries.

**An action the system does not know is refused.** The two lists are constrained to the
published vocabulary — `message.send`, `tool.call`, `artifact.create`
(`packages/contracts/src/autonomy.ts:38`) — and a name outside it comes back
`422 validation_failed` in the shared error envelope. A policy that names an action the
system does not understand allows nothing, and a write that was accepted would say so
only by silence.

**The mode is written into both of the places a workspace keeps it.** The mode the owner
sets is the mode that is in force: a patch that names a mode sets the column the panel
shows _and_ the policy the resolver reads, and a patch that names no mode leaves both
alone (`apps/server/src/modules/workspaces/service.ts:133`). The two cannot disagree.

**The goal's policy is still not writable.** Goals have no update route, so the policy a
goal carries can only be changed by editing the database. This entry is about the
workspace's own policy and says nothing about the goal's.

**Migration.** There was nothing before this write, so there is nothing to migrate. The
write is additive — no route changes its shape, no record is reclassified, and a client
that does not send the field is unaffected. A client that sent `autonomyPolicy` to this
route before and saw no effect now sees the effect it asked for; that is the point of
the write, and it is not a promise this contract breaks.

**A client that cleared the list under the rule in force got every action.** The write
path landed on 2026-10-22 and an empty list was accepted then, so a workspace whose owner
cleared its list carries an empty stored list today, and the resolver reads a stored
empty list as a policy that names no action — the same as the stored default, and the
same effective set of every action in the vocabulary. **No stored row is migrated:** an
empty stored list cannot be told apart from the stored default, and reading it as "no
action allowed" would silence every workspace that never named one. What changes is the
write: a client that means to clear now gets `422 validation_failed` and a message
saying what to write instead, and it tightens by naming the actions it allows.

### The measures route

`GET /api/measures?workspaceId=…` returns the product's two measures of itself. It
is **read-only**, it answers for **one workspace**, and it follows the same rules
as every other route: the same authentication — a session cookie or the owner
token, and never an agent token, which is MCP-only
(`apps/server/src/api/helpers.ts:14-16`) — and a `workspaceId` that is required,
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
(`apps/server/src/lib/ids.ts:30`). **The test is the id form, not a lookup**: a
connection that has since been removed does not make the resources it authored
owner-authored. It is **owner-authored** otherwise: the owner's user id, or the
literal `owner` that is written when there is no user id.

**The author is a closed set**, published as `resourceAuthorSchema`
(`packages/contracts/src/resource.ts:26`): an agent connection's id, the owner's
user id, the literal `owner` for a write by the owner when no user id is known, and
the literal `system` for a write with no authenticated actor behind it. **One
derivation, one place**: the recorded id is derived from the authenticated identity
in `apps/server/src/lib/author.ts:28`, and the service interfaces take that
identity rather than a `createdBy` string, so a caller cannot name an author the
request did not authenticate. The JSON shape is unchanged — `createdBy` is still a
string. `createdBy` is one column holding two id spaces, so neither `'owner'` nor
`'system'` is an agent. A resource's kind, its title, and who worked on it
afterwards are not part of the reading. On the audit side an operation is
**agent-performed** when the entry's `actorType` is `agent`, and the actor id is
then the agent connection id; the published `ActorType` carries
`human | agent | system | automation`
(`packages/contracts/src/common.ts:33`), and the code writes `human` and `agent`
only.

**Every kind carries an author now.** The `automation` and `task` kinds keep their
author on the row — `created_by` on both tables
(`apps/server/src/db/schema.ts:360`, `apps/server/src/db/schema.ts:446`) — and the
projections read it
(`apps/server/src/modules/resources/service.ts:234`,
`apps/server/src/modules/resources/service.ts:365`). An agent-created
automation or task is recorded as authored by the agent that made it.

**Every mutating route writes an audit entry.** Of the 37 mutating routes in
`apps/server/src/api/`, 34 write an audit entry at the route level, and three more
write one from the service layer — `POST /api/approvals/:id/decide` and `POST
/api/agui/runs/:runId/resume`, both at
`apps/server/src/modules/approvals/resume.ts:55`, and `PATCH /api/tasks/:id` at
`apps/server/src/modules/factory/service.ts:317`, and that one only when the task
leaves `unknown`. **No mutating route writes none.**

The twelve that used to write none write one each, at the route:

| Route                                                       | Action                             |
| ----------------------------------------------------------- | ---------------------------------- |
| `POST /api/agents/:id/probe`                                | `agent.probed`                     |
| `DELETE /api/agents/:id/tokens/:tokenId`                    | `agent.token.revoked`              |
| `POST /api/auth/logout`                                     | `auth.logged_out`                  |
| `POST /api/auth/owner-token`                                | `auth.owner_token.issued`          |
| `PATCH /api/automations/:id`                                | `automation.updated`               |
| `DELETE /api/automations/:id`                               | `automation.removed`               |
| `DELETE /api/conversations/:id`                             | `conversation.removed`             |
| `POST /api/conversations/:id/participants`                  | `conversation.participant.added`   |
| `DELETE /api/conversations/:id/participants/:participantId` | `conversation.participant.removed` |
| `POST /api/goals`                                           | `goal.created`                     |
| `POST /api/workspaces`                                      | `workspace.created`                |
| `PATCH /api/workspaces/:id`                                 | `workspace.updated`                |

`workspace.created` is deliberately **not scoped to a workspace**: the workspace
does not exist until the call returns, so the entry is an instance-level one, like
`auth.setup` and `auth.login`. That keeps a fresh workspace's second measure at
0/0/null rather than 0-of-1.

So **the second measure is a ratio of audited operations only**. It cannot be
read as the share of everything the owner did: the MCP surface is invisible to it.

**What the reading cannot cover.** Three things, said plainly.

**The rows written before the author was recorded hold the measure back.** The
migration adds `created_by` with `DEFAULT 'system'`
(`apps/server/drizzle/0008_resource_author.sql`), so every pre-existing row keeps
the `'system'` it effectively had. **History is not backfilled.** Those rows sit in
the denominator and can never sit in the count, so **the first measure is a lower
bound**: the ratio can only understate what the agents authored, and it does so by
exactly the rows that predate the author being recorded.

**The agent's own operations are not audited at all.** The MCP surface writes no
audit entry — there is no audit call anywhere in
`apps/server/src/modules/mcp/server.ts`, and none in the capabilities service its
tools call, which reach the resources service directly rather than through the
auditing route. The only writer of the trail that is not an owner HTTP route is
the worker — its `unknown` record (`apps/worker/src/executor.ts:105`) and the
policy refusals it writes (`apps/worker/src/executor.ts:1521-1528`). So every audited
operation is an owner operation, except the worker's own entries, which carry
`actorType: 'agent'`. **The second measure does not count the work an agent does
through MCP**: an agent can create, update and publish resources all day and the
trail will show none of it. An implementation that wants the measure to mean what
it says has to widen the audit coverage first, and that is WI-033's to do, with
WI-034 publishing the rules it implements.

**Almost nothing records a failure.** The audit trail's `result` carries
`success | failure | unknown` (`apps/server/src/modules/audit/service.ts:19`),
but the route helper hardcodes `success`
(`apps/server/src/api/helpers.ts:76`) and the audit service defaults to it
(`apps/server/src/modules/audit/service.ts:79`). The two values a writer does
produce come from the worker: the `unknown` of
[The unknown outcome](#the-unknown-outcome)
(`apps/worker/src/executor.ts:112`), and the `failure` it writes when the
autonomy policy refuses a turn or an action
(`apps/worker/src/executor.ts:1528`). **An operation that failed at the route is
counted here as an operation that completed.**

**The route exists.** It answers with the shape above, member for member: the
workspace, and the two measures. The counts are queries over the data the
product keeps — the `createdBy` column of the workspace's resources, and the
audit trail — and not counters that are incremented on some code path. `ratio`
is `null` when the denominator is zero, and the count is still returned.

**What the two numbers can defend.** The first measure is a **floor**: a
resource that records no agent author — the `'system'` of a row written before the
author was recorded, and everything the owner created — is in the denominator and
can never be in the count, so the ratio can only understate what the agents
authored. The second measure is **not a share of completed work**, and it is
published with two different facts behind it. The first is a count of routes:
every mutating route writes an entry, and the MCP surface writes none at all. The
second is a rule about outcomes: every audited route records `result: 'success'`
whatever happened, the only writer that records anything else is the worker, and
the count has no filter on the result — so the denominator counts attempts, not
confirmed completions. And because the owner's own routes record `human` and the
MCP surface writes no entry at all, the only `actorType: 'agent'` entries a
workspace's measure can see today are the worker's own — its `unknown` records and
the policy refusals it writes: the ratio is the share of the trail the worker
wrote, not the share of the work an agent did.

**Migration.** Nothing is reclassified and no record is rewritten. The route is
new and read-only, so a client that does not call it is unaffected, and a client
that does has no earlier version of it to migrate from. **No resource's
`createdBy` is changed** — the rows written before the author was recorded keep
the `'system'` they were written with, and the measure publishes that as a lower
bound rather than correcting the data behind the owner's back. **History is not
backfilled**: the migration adds the column with a default of `'system'`
(`apps/server/drizzle/0008_resource_author.sql`), so the count is a floor until
new writes accumulate. **No audit entry is rewritten**, so the second measure's
denominator is what the trail actually holds, which is fewer operations than the
owner performed; a client that keeps a measure over time is keeping a number
whose denominator moves as more routes are audited. A client that reads `ratio`
has to handle `null`, which is a value the ratio can now take and which is not
the same as 0.

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
| `approval.decided` | `{ approval }`                                      |
| `heartbeat`        | `{ at }`                                            |

On connect the server replays the fifty most recent events, so a reconnecting client
converges on the current state.

**A decided approval is published.** `POST /api/approvals/:id/decide` records the
decision and publishes `approval.decided`, carrying the approval. **The waiting
list has a way out of it**: a client that watches the stream learns that the answer
has arrived and can take the approval off its list, instead of polling for an
approval that has already been answered. The event is published once, whatever the
turn does next — whether it continues or closes does not change the fact that the
owner decided.

**Migration.** The event vocabulary grows by one member and nothing is
reclassified. **A client that does not know `approval.decided` needs no change**:
the event is additive, and the approval it carries is the same approval the decide
route already returns. A client that switches exhaustively on the event name must
now have a case for it. **The panel's own list already follows it**, so a decision
taken outside the panel — in another tab, or by another surface — leaves the list
at once rather than at the next slow refresh. No stored record is rewritten.

### The AG-UI stream

`GET /api/agui/events` carries the panel's events in **AG-UI 1.0** — the published
agent-to-user protocol, at <https://docs.ag-ui.com>. It is the same event log the
panel's own stream reads, projected into AG-UI's vocabulary at the API boundary:
nothing under `apps/server/src/modules/` knows AG-UI exists, and no AG-UI type
appears in `packages/contracts`. The projection is
`apps/server/src/api/agui-protocol.ts`, and it is a pure function of the panel's
event and the state it is handed — no I/O, no clock, nothing to undo.

**`GET /api/events` does not move.** Its nine event names, its priming behaviour
and its framing are what they were, except for the one name this section adds.
The AG-UI route is additive: a new route beside it, for a consumer that speaks a
published protocol rather than ours.

The stream is Server-Sent Events, framed as the AG-UI HTTP+SSE binding frames it:
each frame's `data` is exactly one AG-UI event as a JSON object, and the
keep-alive is an SSE comment. The panel's own framing — an `event:` name and an
`id:` — is not carried, because AG-UI consumers ignore those fields. On connect
the server replays the fifty most recent events, as the panel's own stream does.
`GET /api/agui/events?conversationId=<id>` narrows the stream to one
conversation.

**Runs.** An execution is a run. `threadId` is the conversation the execution
belongs to, and `runId` is the execution id. An execution that belongs to no
conversation — a factory task's execution — names the execution as its thread.
A run opens with `RUN_STARTED` and closes with `RUN_FINISHED` or `RUN_ERROR`,
and everything the run opened — an answer, a tool call — is closed before the
run closes. A turn that continues after an approval is a **new** run, because
AG-UI says a run that continues an interrupted one is a run of its own; it is
named `<executionId>:2`, `:3` and so on, counting the runs of that execution.
The producer declares its version on every `RUN_STARTED` as
`protocolVersion: "1.0"`.

**The mapping.** Every event the panel publishes has a stated counterpart, and
every agent event has one too. An event with no counterpart is named as such
rather than left out.

| Panel event                                 | AG-UI                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `message.created` — the owner's own message | No event of its own. It is the input of a run rather than its output, and it is streamed inside the run that message started. |
| `message.created` — the agent's answer      | `TEXT_MESSAGE_START`, after the message that started the turn                                                                 |
| `message.updated`                           | `TEXT_MESSAGE_END`, when the run still has the answer open                                                                    |
| `execution.event`                           | The agent event inside it, mapped below                                                                                       |
| `task.updated`                              | `CUSTOM` named `task.updated`                                                                                                 |
| `resource.updated`                          | `CUSTOM` named `resource.updated`                                                                                             |
| `agent.status`                              | `CUSTOM` named `agent.status`                                                                                                 |
| `automation.run`                            | `CUSTOM` named `automation.run`                                                                                               |
| `approval.decided`                          | `CUSTOM` named `approval.decided`                                                                                             |
| `heartbeat`                                 | None. A heartbeat is the transport's keep-alive, and the AG-UI binding carries that as an SSE comment.                        |

| Agent event                              | AG-UI                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution.status` — `queued`, `running` | `RUN_STARTED`, when the run is not open yet                                                                                                                                                                                                       |
| `execution.status` — `completed`         | `RUN_FINISHED` with no outcome — the run succeeded                                                                                                                                                                                                |
| `execution.status` — `failed`            | `RUN_ERROR`                                                                                                                                                                                                                                       |
| `execution.status` — `cancelled`         | `RUN_FINISHED` with the cancelled outcome                                                                                                                                                                                                         |
| `execution.status` — `unknown`           | `RUN_FINISHED` with the cancelled outcome, and metadata naming the outcome that could not be confirmed. AG-UI has no reading for "neither a success nor a failure", and a run stopped by a limit the producer enforces is the closest one it has. |
| `execution.status` — `blocked`           | None. A blocked status carries no approval to name, and an interrupt needs one; the approval that blocks a run arrives as an approval request, and that is what closes the run.                                                                   |
| `message.delta`                          | `TEXT_MESSAGE_CONTENT`, preceded by `TEXT_MESSAGE_START` when the answer is not open yet                                                                                                                                                          |
| `message.completed`                      | `TEXT_MESSAGE_END`                                                                                                                                                                                                                                |
| `tool.started`                           | `TOOL_CALL_START` and `TOOL_CALL_ARGS`                                                                                                                                                                                                            |
| `tool.completed`                         | `TOOL_CALL_END` and `TOOL_CALL_RESULT`                                                                                                                                                                                                            |
| `artifact.created`                       | `TOOL_CALL_START`, `TOOL_CALL_END` and `TOOL_CALL_RESULT` — a tool call named `artifact.created` whose result carries the artefact                                                                                                                |
| `approval.requested`                     | `RUN_FINISHED` with the interrupt outcome                                                                                                                                                                                                         |
| `execution.error`                        | `RUN_ERROR`                                                                                                                                                                                                                                       |

**The approval round trip.** An approval request closes the run with an interrupt
that carries **the approval's own id**, so an interrupt id and an approval id are
the same thing. The interrupt publishes the answer it expects as its
`responseSchema`:

```json
{ "approved": true, "reason": "It is my own homelab" }
```

`POST /api/agui/runs/:runId/resume` answers it. The body is AG-UI's resume list,
one entry per interrupt answered:

```json
{
  "resume": [{ "interruptId": "apr_1", "status": "resolved", "payload": { "approved": true } }]
}
```

`status` is `resolved` when the interrupt was answered and `cancelled` when it was
abandoned; an abandoned interrupt is a refusal, so the operation is not approved.
The `payload` is validated against the schema the interrupt published, and an
answer that does not match it is refused. The resume resolves the approval the
interrupt id names, through the same path `POST /api/approvals/:id/decide` uses,
and it refuses an interrupt that belongs to another run.

**The limits.** Three, said plainly.

**The route observes runs; it does not start them.** AG-UI's HTTP binding is a
POST that opens a run and streams it back. This route is a GET that reports the
runs the panel is already running, so no `RunAgentInput` is delivered and
`RUN_STARTED` carries no input echo. It is a custom transport under the
protocol's own rules: the event model, the patterns and the framing are the
protocol's.

**The run id of a continued turn depends on what a consumer saw.** The interrupt
id does not: it is the approval's id, and it is what a resume names.

**A consumer that connects late may see a run open that opened before it.** The
projection is built from the events the consumer saw, so a run it connected to
mid-way opens when it first sees material for that run.
