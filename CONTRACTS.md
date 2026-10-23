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

The implementation adds six fields, all optional and all required by production
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
  delivery?: 'steer' | 'queue';
}
```

`status` lets a client render a partially streamed answer. `correlationId` ties every
turn derived from one human request together. `origin` records who spoke and how far
the delegation chain has travelled — the basis of the echo-loop guard. `executionId`
names the execution the message belongs to — the execution is the run itself, and
the message it produced is that run's own record
(`apps/server/src/modules/conversations/service.ts:78-83`). **`detail` is the
server's own sentence about how the message ended** — a message that did not finish
says why, in the server's words
(`packages/contracts/src/conversation.ts:151`), and the client shows it as it is
given rather than rewording it
(`apps/web/src/components/ChatMessageList.tsx:136`). **`delivery` says how the
message was sent** — a steer went into the turn that was running, and a queue
message waits for the next one. Absent means `queue`: a message written before
this existed is a queued message, exactly as it was.

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
(`apps/server/src/modules/executions/service.ts:343-346`, and
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
(`apps/server/src/modules/approvals/service.ts:172`).

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
(`apps/server/src/modules/factory/service.ts:449-458`). It names who reached the
conclusion the way the task path's does — `actorType: 'human'` and the owner's
id for the owner's own call, `actorType: 'agent'` and the connection's id for
the agent's `execution.resolve` — and its metadata carries the transition,
`from: 'unknown'` and `to` the outcome.

**The route is additive.** No existing route's shape or semantics change. It
takes the same authentication and workspace rules as every other owner-facing
route — a session cookie or the owner token, and never an agent token, which is
MCP-only — and it is published in the route table with the rest.

This entry is the contract for **WI-031**, and the code implements it — as of
`414996c`, which landed twenty-seven minutes after the contract itself
(`363428e`), and `3dd490b` brought the route to the published shape after it.
The route is `POST /api/executions/:id/resolve`, at
`apps/server/src/api/executions.ts:19`, and it is registered at
`apps/server/src/app.ts:252`. **Only the owner may call the route**, under the same
authentication as every other owner-facing route
(`apps/server/src/api/helpers.ts:14-16`). **The route's own writer is the
executions service**, which writes the execution's status
(`apps/server/src/modules/executions/service.ts:328-338`) and the reply's status
(`apps/server/src/modules/executions/service.ts:343-346`) together; the
route calls it through the shared capability API at
`apps/server/src/api/executions.ts:27`, which the agent's `execution.resolve`
calls too. **There are two
writers of an execution's outcome, not one**: the other is `resolveExecution`
(`apps/server/src/modules/approvals/service.ts:165`), which the approval
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
| `codex` | OpenAI Codex, which reports its work as an event stream.                 |

ACP provides a session-oriented interface and capability negotiation. A2A supports
task-oriented communication between independent agents, including discovery,
artifacts and task states.

The standards are implemented using maintained protocol SDKs where possible, not
rewritten from scratch.

### The Codex adapter

**Codex is not a command-line agent that prints text.** `codex exec --json` writes
a JSONL event stream: a thread starts, a turn starts, items complete — a message,
a command it ran, a file it changed — and the turn reports how it ended. The `cli`
adapter reads standard output as text, so it would put JSON in the room. Codex
therefore has its own adapter, and the mapping lives in
`packages/agent-adapters/src/codex.ts`.

**The adapter says what the runtime said, and nothing more.** A command the
runtime ran becomes a `tool.started` / `tool.completed` pair with the same tool
name, so the trace shows one tool that ran rather than two unrelated rows. The
turn's own report is believed: `turn.completed` completes the message and the
execution, `turn.failed` fails it. An item the product has no word for — a plan,
a reasoning note, a token count — produces no event, because an adapter emits
only events it can genuinely observe.

**A turn that ends without a report is not a success.** If the runtime finishes
without saying how the turn ended, the execution is `unknown` — the status the
product already uses for "we started this and we cannot say how it ended".

**The credential stays in Codex.** Codex signs in with its own account and keeps
that sign-in in its own home directory. The supervised process inherits the
owner's home directory and nothing else, and the configuration carries no
secret: there is no credential field for this adapter type.

**Migration.** The adapter type enum grows by one member and nothing is
reclassified. A client that switches exhaustively on the adapter type must now
render `codex`; a connection that is not a Codex agent is unaffected. The
adapter configuration for this type carries `command`, `args`, `cwd`, `env`,
`sandbox`, `skipGitRepoCheck`, `ephemeral`, `model` and `timeoutSeconds`, and
every one of them but `command` has a default. A connection recorded before
this change keeps the adapter type it had.

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

This entry is the contract for **WI-053**, and the code implements it — as of
`1fb60e7`, the commit that brought the adapter, its configuration schema and the
panel's fields. The adapter is `packages/agent-adapters/src/mcp.ts`, the
configuration schema is `packages/contracts/src/adapter-config.ts`, and the
panel's connection form carries the fields.

### The adapter lifecycle

Every adapter has the same three steps, and the order matters.

```ts
interface AgentAdapter {
  readonly type: AdapterType;
  /** Whether this adapter holds a runtime between the connection and the turn. */
  readonly holdsRuntime?: boolean;
  connect(connection: AgentConnection): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  close?(): void | Promise<void>;
}
```

`connect` establishes the runtime and reports the capabilities that are actually
true. `send` runs one turn on that runtime. `close` releases everything the
adapter holds — the supervised child process, the transport, the socket.

**The worker connects the instance the turn runs on.** The worker creates the
adapter, connects it, sends on it, and closes it — on the chat path, the task
path and the automation path alike. **A capability probe on one instance does
not initialize a later instance**, so the instance that runs the turn is the
one that is connected; a probe elsewhere says nothing about it.

**`holdsRuntime` says whether the connection is needed.** An adapter that holds
a runtime between the connection and the turn says `true`; an adapter whose
turn brings its own runtime — a protocol that sets up its session when it is
asked for one — says `false`, so the caller does not impose a second handshake
on a protocol that already has one. **Absent means true**: a caller that
connects before it sends is never wrong, only occasionally more work than the
protocol needs.

**A failed handshake is the turn's failure.** A connection that cannot be
established records an actionable failure rather than a turn that quietly
completed, and the adapter's own report of the failure is the turn's outcome:
a turn the agent failed is a failed turn, and the reason it gave is the reason
the owner reads.

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

**A session is opened with the working directory and the MCP servers.** The
protocol asks for both, and an agent that checks them refuses a request that
leaves them out — Hermes refuses it as `invalid params`, and the turn never
starts. The adapter sends the directory the connection was configured with, and
no MCP servers, because it grants no client-side capability.

**A refusal carries its reason.** A runtime that refuses a request usually
says why in the error's data, and the reason is the part the owner needs:
"no provider configured" is actionable and "internal error" is not. The
adapter's failure carries the reason through, so the panel can say what is
wrong and what to do about it.

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
  evidence?: {
    runtime: string; // the runtime that answered
    version?: string; // the version that answered, when it publishes one
    demonstratedOn: string; // the day, as YYYY-MM-DD
    observed: string; // what was observed, in a sentence the owner can read
  };
  runtime?: 'Codex' | 'OpenCode' | 'Pi' | 'Hermes' | 'OpenClaw';
}
```

**A preset claims an integration only when it can show the evidence.** A
preset that says it has been demonstrated carries the evidence it rests on —
the runtime, the version, the day and what was observed — and **a preset that
claims the demonstration without the evidence does not parse**. A preset that
has not been demonstrated says so in the copy the owner reads, and the panel
wears the caution treatment beside it.

**What has been demonstrated.** The built-in echo agent is this repository's own
runtime: the server tests drive it, and the browser suite runs the whole chain
— server, queue, worker, adapter, event log, stream — against it. **The Hermes
ACP template has been run against the installed Hermes 0.21.0**: the handshake
answered, and a turn completed with the runtime's own answer, both through
this product's adapter. The other four approved runtimes — Codex, OpenCode, Pi
and OpenClaw — are still candidates: they are not installed here, and their
presets carry `verified: false`.

**A handshake is worth something, and it is not a turn.** The handshake asks
whether a runtime is there; the turn asks whether it works. A runtime that
answers the handshake and then refuses the turn has demonstrated the first and
not the second. **A preset that names one of the five runtimes carries
`verified: false` until this repository has run that exact template against
that runtime and completed a turn with it.**

**A handshake is worth something, and it is not a turn.** The handshake asks
whether a runtime is there; the turn asks whether it works. A runtime that
answers the handshake and then refuses the turn has demonstrated the first and
not the second. **A preset that names one of the five runtimes carries
`verified: false` until this repository has run that exact template against
that runtime and completed a turn with it.**

**The ACP surface of an installed Hermes answered the handshake this
repository ran against it**, and reported that it can restore a session — which
is what `connect()` asks and what the panel shows beside a connection.

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

Each preset picks **one** surface and names the alternative in its copy, so the
owner chooses the surface rather than having one hidden from them:

| Preset          | Runtime  | Adapter type | The surface the preset uses         | The alternative it names                        |
| --------------- | -------- | ------------ | ----------------------------------- | ----------------------------------------------- |
| `codex-cli`     | Codex    | `cli`        | the command line                    | the native App Server and ACP surfaces          |
| `opencode-acp`  | OpenCode | `acp`        | an ACP-compatible session           | the native HTTP server and its SSE event stream |
| `pi-cli`        | Pi       | `cli`        | the long-lived JSONL RPC subprocess | —                                               |
| `hermes-http`   | Hermes   | `http`       | the HTTP run API                    | ACP and the programmatic gateway                |
| `hermes-acp`    | Hermes   | `acp`        | an ACP-compatible session           | the HTTP run API and the programmatic gateway   |
| `openclaw-http` | OpenClaw | `http`       | the HTTP gateway surface            | the gateway WebSocket and the ACP bridge        |

**A runtime is proved by running it.** `scripts/verify-runtime.ts` takes a
preset, builds the adapter the worker would build for it, and asks the runtime
two questions through the product's own code: does it answer the handshake,
and does it answer a turn. It runs a real agent and spends the runtime's
tokens, and it refuses a preset that needs a credential it cannot supply
rather than half-running it. **What it prints is the evidence a preset's
`verified: true` rests on**, and the script says what it observed and no
more: a runtime that reports its own failure as its answer has still produced
an answer, and the text is the only evidence of what happened.

This entry is the contract for **WI-142**, and the code implements it — as of
`0c7c1f5` — the catalogue is `packages/contracts/src/adapter-presets.ts`, the
route is `GET /api/agent-presets`, and the panel's connection form carries the
template picker. The slice's own record is
[docs/contract-adapter-presets.md](docs/contract-adapter-presets.md).

This entry is the contract for **WI-153**, and the code implements it — as of
`dcc7fec`. The catalogue is `packages/contracts/src/adapter-presets.ts`, the
evidence a claim of demonstration rests on is there too, the proof is
`scripts/verify-runtime.ts`, the session the protocol asks for is
`packages/agent-adapters/src/acp.ts`, and the reason a refusal carries is
`packages/agent-adapters/src/jsonrpc.ts`. The slice's own record is
`.factory/work/WI-153.md`.

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
(`apps/server/src/modules/resources/service.ts:707-713`), and a template of another
kind is refused the same way
(`apps/server/src/modules/resources/service.ts:721-725`); an unknown template id is
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
`packages/contracts/src/resource.ts:182` and `ResourceTemplateGuide` at
`packages/contracts/src/resource.ts:211`. `resourceTemplateSchema` is at
`packages/contracts/src/resource.ts:223` and `ResourceTemplate` at
`packages/contracts/src/resource.ts:244` — the record, with the guide required in it
(`packages/contracts/src/resource.ts:242`) — and `resourceTemplateRefSchema` and
`ResourceTemplateRef` are beside them at
`packages/contracts/src/resource.ts:252` and
`packages/contracts/src/resource.ts:256`. `resource.template.list` and
`resource.template.get` are both published tool names — they are in `mcpToolNames`
at `packages/contracts/src/mcp.ts:50-51`, inside the range
`packages/contracts/src/mcp.ts:10-95`, and in the
default agent grant list at `packages/contracts/src/mcp.ts:121-122`. The server
registers both tools only where
the connection is granted them, the way every other tool on that surface is
(`apps/server/src/modules/mcp/server.ts:759-813`). `resource.create` takes the
`template` input at `apps/server/src/modules/mcp/server.ts:573`, merges the caller's
values into the template's spec at
`apps/server/src/modules/mcp/server.ts:596-598`, and passes the template's id and
version on at `apps/server/src/modules/mcp/server.ts:608`. The merge rules
themselves are at `apps/server/src/modules/resources/templates.ts:509-522`, and the
resource records them at
`apps/server/src/modules/resources/service.ts:207-208` and
`apps/server/src/modules/resources/service.ts:417-418`.

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
(`apps/server/src/modules/resources/service.ts:503-505`), so a template that drifted
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
  (`apps/server/src/modules/resources/service.ts:292`); the dashboard's writes
  `published: false` (`apps/server/src/modules/resources/service.ts:818`, reached
  from the provider's create at `apps/server/src/modules/resources/service.ts:358`).
- **Creation is the only place the rule bites.** An update that names `published: true` or
  `enabled: true` still makes a resource live, because an update is a deliberate act on a
  resource that already exists. **The two kinds behave the same way here**: the generic
  `PATCH /api/resources/:id` takes a spec, and the automation's provider writes the
  `enabled` that spec names (`apps/server/src/modules/resources/service.ts:326`) just as
  the dashboard's writes the `published` it names.
- **Each kind has its own act.** `POST /api/resources/:id/publish` publishes a dashboard
  and enables an automation (`apps/server/src/modules/resources/service.ts:595`), and the
  automation also has `POST /api/automations/:id/enable` and
  `POST /api/automations/:id/disable` (`apps/server/src/api/automations.ts:61`,
  `apps/server/src/api/automations.ts:72`).

**Forcing the flag does not make a broken spec acceptable.** A spec that is not an object
is passed on untouched, so the schema refuses it exactly as it always did.

**Migration.** A client that created a dashboard with `published: true` — from a template
or on its own — now gets an unpublished one, and has to make the publish act to make it
live. **The flag was not read by the client**: `apps/web/src/components/ResourceEditor.tsx:85`
is the only place the web client mentions it, and it writes `published: false` when the
owner starts a new dashboard — so nothing visible changes, and the contract says so rather
than leaving it to be found. Nothing is reclassified and no record is rewritten.

### Publishing and executing a resource

**Not every kind of resource can be published or executed, and this is where the
contract says which can.** Publishing makes a resource live; executing runs it. Only
some kinds have either act:

| Kind          | Publish            | Execute                          |
| ------------- | ------------------ | -------------------------------- |
| `dashboard`   | it becomes visible | its widgets' sources run         |
| `document`    | —                  | —                                |
| `automation`  | it becomes active  | the run is queued for the worker |
| `data-source` | —                  | its query runs                   |
| `task`        | —                  | —                                |
| `memory`      | —                  | —                                |

**The declaration is published once**, in `resourceOperationSupport`
(`packages/contracts/src/resource.ts:108`), keyed by every published kind. The server
refuses a kind that does not support the operation, and the panel offers only the
actions that can succeed; both read that one record, through
`canPublishResource` (`packages/contracts/src/resource.ts:131`) and
`canExecuteResource` (`packages/contracts/src/resource.ts:136`). A kind added to
`resourceTypeSchema` does not compile until it has been answered for there, so the
question cannot be skipped by adding a kind.

**A refusal is not a success.** `POST /api/resources/:id/publish` and `POST
/api/resources/:id/execute` refuse a kind that does not support the operation with
`400 bad_request` and a message the owner can read — the kind, the operation, and the
kinds that do have it. The refusal is raised in the service
(`apps/server/src/modules/resources/service.ts:781`) and answered with the shared
[error envelope](#error-envelope), so a refusal is never the same 200 as a success
that did not happen.

**A success says what happened.** The two routes answer with the outcome in the body:

```ts
// POST /api/resources/:id/publish → 200
{ outcome: 'published', resource: Resource }

// POST /api/resources/:id/execute → 200
{ outcome: 'queued' | 'succeeded', result: { output: unknown } }
```

`published` means the resource is live. `queued` means the action was accepted and has
not finished — an automation's run is enqueued for the worker, and it has not happened
yet. `succeeded` means the action ran and produced its output. The vocabulary is per
action, not per route: one route records `queued` for one kind and `succeeded` for
another. The outcome enum is published as `resourceOperationOutcomeSchema`
(`packages/contracts/src/resource.ts:151`).

**The panel believes the server.** The editor renders the outcome the response
claimed, and a refusal is rendered as a refusal — not swallowed into a success. It
does not offer a button that can only be refused, and it says which action a kind
does not have rather than leaving a gap.

**There is now an agent path for both operations, and it is the same path.** The MCP
surface publishes `resource.publish` and `resource.execute`, and each tool does what
its route does, on the same object, through one shared capability. The refusal is the
route's refusal — a kind with no publish act, and a kind with no run, are refused with
the same words and the same facts. See [The resource acts](#the-resource-acts).

### The resource acts

The two acts a resource may have, and the two tools that perform them. SPEC-RESOURCE-RUN
made the owner path honest — the route refuses a kind that has no such act and says so,
and the panel offers only the actions that can succeed. This is the agent path for the
same two operations.

| Tool               | Route                             | Input            | Output                               |
| ------------------ | --------------------------------- | ---------------- | ------------------------------------ |
| `resource.publish` | `POST /api/resources/:id/publish` | `{ resourceId }` | `{ outcome: 'published', resource }` |
| `resource.execute` | `POST /api/resources/:id/execute` | `{ resourceId }` | `{ outcome, result: { output } }`    |

The shared capability is `apps/server/src/modules/capabilities/service.ts:568` for the
publish and `apps/server/src/modules/capabilities/service.ts:591` for the run. The
routes call it at `apps/server/src/api/resources.ts:208` and
`apps/server/src/api/resources.ts:228`, the tools are registered at
`apps/server/src/modules/mcp/server.ts:709` and
`apps/server/src/modules/mcp/server.ts:735`, and the names are published in
`packages/contracts/src/mcp.ts:48`.

**The grant rule is the rule the other round trips already keep, and the reason is the
coverage table's own.** A **read** verb joins the default grant set; a verb that
**spends the owner's authority** does not, and the owner grants it by name. Neither of
these two is a read:

- **Publishing** "makes a resource visible to everyone; it is the owner's own act".
  Publishing a dashboard makes it visible; publishing an automation is what makes it
  active, and an active automation runs the owner's work — the action it carries
  prompts an agent, and the owner's budget and the owner's authority are what stand
  behind it.
- **Running a resource** is running it _now_. An automation's run is enqueued for the
  worker, and the action it carries may prompt an agent; a data source's query makes
  the outbound request the owner's configuration describes; a dashboard's run is its
  widgets' sources run.

So **neither is in the default grant set**, and a connection that was not granted one
of them does not have it registered at all. A call for one is refused and the refusal
is recorded the way every other ungranted call is recorded — the owner finds the agent
on the waiting list and widens that one grant.

**The refusal is the route's refusal.** A kind with no publish act, and a kind with no
run, are refused by the tool with the same words and the same facts the route refuses
them with, because the route and the tool are thin adapters over one shared capability.
The refusal names the kind and the act, and the details carry the kinds that do have
the act.

**The scoping rule is the rule the other id-addressed tools already keep.** Each of
these two names an id, so each names an _object_ and not a workspace: the object's own
row is read to find the workspace it belongs to, and that workspace is checked against
the caller's scope before anything of the object is returned or acted on. **An agent
is bounded to the workspace it was granted, never to the whole tenant**, and a refusal
carries nothing of the object back.

**The record names who acted, and the authority behind it is the owner's grant.** A
publish writes `resource.published` and a run writes `resource.executed`, each with
the `actorType` of the caller — `human` for the owner's own call, `agent` for an
agent's — and the caller's id.

**Migration.** Nothing is reclassified and no record is rewritten. The two routes keep
their published shapes and their published authentication — a session cookie or the
owner token, and never an agent token. The two trail entries the routes used to write
at the route level are written by the shared capability instead, so the owner's own
publish and an agent's publish leave the same entry, naming who acted.

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
`packages/contracts/src/resource.ts:311`, the spec's `agentConnectionId` at
`packages/contracts/src/resource.ts:321`,
and `listAgentMemories` at
`apps/server/src/modules/resources/agent-memory.ts:29` is what puts the agent's
memories in the turn context.

**The read side is WI-028, and the code implements it — as of `622812c`.** The
owner's ruling of 2026-10-21 at 07:07 was that an agent's own memory is private
to it, on reads as well as on writes, and the sentence above now says so. The rule
is one call — `assertOwnMemory` at
`apps/server/src/modules/mcp/server.ts:259`, with `memoryOwner` at
`apps/server/src/modules/mcp/server.ts:223` — and it
answers the same way for the three resource tools: `resource.create` at
`apps/server/src/modules/mcp/server.ts:600`,
`resource.update` at `apps/server/src/modules/mcp/server.ts:669` and `resource.get`
at `apps/server/src/modules/mcp/server.ts:634`. A memory's owner is
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
| `bot.dispatch`           | Hand work to another agent, and take its answer back.   |
| `agent.list`             | List the agent connections in a workspace.              |
| `task.create`            | Create a factory task.                                  |
| `task.update`            | Update a factory task.                                  |
| `task.get`               | Read a task with its evidence.                          |
| `task.accept`            | Record an acceptance decision on a task.                |
| `resource.create`        | Create a resource, optionally from a template.          |
| `resource.get`           | Read a resource. Not another agent's own memory.        |
| `resource.update`        | Update a resource with optimistic concurrency.          |
| `resource.publish`       | Publish a resource — make it live.                      |
| `resource.execute`       | Run a resource now.                                     |
| `resource.template.list` | List the templates published for one resource kind.     |
| `resource.template.get`  | Read one template in full — its spec and its guide.     |
| `automation.create`      | Create an automation.                                   |
| `automation.inspect`     | Inspect an automation and its runs.                     |
| `autonomy.read`          | Read the autonomy policy in force for a scope.          |
| `approval.list`          | List the approvals in a workspace, or read one of them. |
| `approval.decide`        | Decide an approval, with a reason.                      |
| `approval.evidence`      | Read the evidence a decision is taken against.          |
| `execution.list`         | List the turns of a workspace, newest first.            |
| `execution.get`          | Read a turn: its status, its activity, its run control. |
| `execution.stop`         | Ask a turn to stop, and answer with what was done.      |
| `execution.resolve`      | Close a turn whose outcome could not be confirmed.      |
| `event.list`             | List the events of a workspace.                         |
| `audit.list`             | List the audit entries of a workspace.                  |

These are Personal OS tool names, not predefined MCP methods. Agents discover each
tool's input and output schema through MCP.

Tool visibility and authorisation reflect the requesting agent's grants. An owner
token sees every tool; an agent token sees only the tools that connection was
granted. **An ungranted tool is not registered at all**, so it does not appear in the
`tools/list` response and the MCP server cannot route a call to it.

**`autonomy.read` is in the default grant list, so every agent connection gets it.**
A connection with no explicit grants runs on the default set
(`packages/contracts/src/mcp.ts:111-132`), and that set carries `autonomy.read`: an
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
(`packages/contracts/src/mcp.ts:121-122`): an agent can read a template's guide — what
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

### The approval and execution round trips

An agent that cannot answer an approval cannot run anything dangerous, and an
approval surface that only a human can reach means every automation dangles on
someone being at the browser. **These seven tools are that round trip**, and
they are exposed over the same grant model as every other tool — no second
permission system, and no new authority kind.

**The shapes are these.**

| Tool              | Input                                    | Output                                                          |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `approval.list`   | `{ workspaceId?, status?, approvalId? }` | `{ approvals: Approval[] }`                                     |
| `approval.decide` | `{ approvalId, approved, reason? }`      | `{ approval, execution, outcome, detail }`                      |
| `execution.list`  | `{ workspaceId?, status?, limit? }`      | `{ executions: ExecutionDetail[] }`                             |
| `execution.get`   | `{ executionId }`                        | the turn's read model: `turn`, `activities`, `run`, `execution` |
| `execution.stop`  | `{ executionId, note? }`                 | `{ executionId, outcome, detail, run }`                         |
| `event.list`      | `{ workspaceId?, limit? }`               | `{ events: StoredEvent[] }`                                     |
| `audit.list`      | `{ workspaceId?, limit? }`               | `{ entries: AuditEntry[] }`                                     |

**`approval.list` reads the owner's queue.** It is the same approvals, the same
rows and the same service the route at `GET /api/approvals` reads
(`apps/server/src/modules/capabilities/service.ts`). `status` narrows it to
`pending`, `approved` or `rejected`. `approvalId` names one row of it, and a row
that is not in the named workspace is not in that queue.

**`approval.decide` is the owner's decision path, used as it is.** The tool
takes the same decision the route at `POST /api/approvals/:id/decide` takes
(`apps/server/src/api/approvals.ts`): the answer is recorded first, the
`approval.decided` event is published, and the turn the approval refers to is
continued in the session it was in when the adapter can re-enter one, or closed
with the answer still on record. **The owner's decision and the agent's
decision are one path and one trail.** The answer says which happened:
`outcome` is `resumed` or `closed`.

**The record names who decided, and the authority behind it is the owner's
grant.** The approval's `decidedBy` carries the id of the caller that made the
call, and the audit entry carries `actorType` — `human` for the owner's own
decision, `agent` for an agent's. The owner is not an actor kind of their own:
an agent deciding under a grant is recorded as the agent that acted, and the
grant is what stands behind it.

**`execution.stop` is honest about what it did.** A turn that had not started is
cancelled, and the answer says `cancelled` — that is the only outcome that says
the turn is over. A turn that is already running can only be _asked_: the worker
holds the live session and the API server never runs an agent, so there is no
channel from the API to a running turn, and the answer says `requested` and that
the runtime may still finish the turn. A turn that is waiting on an approval,
one that has already finished, and one whose outcome could not be confirmed all
answer `not_running`. **Nothing here claims a turn stopped when only a request
was made, and nothing claims exactly-once.** A turn whose outcome could not be
confirmed is reported for resolution and is not replayed
([the unknown outcome](#the-unknown-outcome)).

**The scoping rule is the rule the other id-addressed tools already keep.** A
tool that names an id names an _object_, so the object is looked up in its own
row and its workspace is checked against the caller's scope before anything of
it is read; a tool that names a workspace checks that workspace against the
same scope. **An agent is bounded to the workspace it was granted, never to the
whole tenant**, and a refusal carries nothing of the object back — not its
title, not its body, not its count.

**The grant membership is deliberate.** The read-only tools — `approval.list`,
`approval.evidence`, `execution.list`, `execution.get`, `event.list` and
`audit.list` — are in the
default grant set
(`packages/contracts/src/mcp.ts:111-132`): an agent whose turn is blocked on the
owner has to be able to see what it is blocked on, and an agent that has just
acted has to be able to read what it did. **The destructive verbs are not.**
`approval.decide`, `execution.stop`, `execution.resolve`, `task.accept`,
`resource.publish` and `resource.execute` are
the owner's to grant, one by one,
exactly as `bot.dispatch` is, because each of them spends an authority the owner
holds. A connection that was not granted them does not have them registered, so
a call for one is refused and the refusal is recorded the way every other
ungranted call is recorded — the owner finds the agent on the waiting list and
widens that one grant.

**`approval.decide` is not one of the actions the autonomy policy asks the
owner to approve.** It is the answer to an approval, and asking for an approval
in order to answer one is a deadlock the owner cannot break — the waiting list
would carry a request to decide a request to decide
(`apps/server/src/modules/mcp/server.ts:133`). The policy's allowed-actions
list still applies: a policy that forbids tool calls still forbids this one.

**The parity gate is what holds this.** `npm run verify:mcp-parity` reads the
HTTP surface table in this document and the tool names in
`packages/contracts/src/mcp.ts`, and it fails when an owner-facing route is
neither paired with a registered tool nor listed with a reason and the spec that
will pair it. The route that the server registers and the contract does not
publish is a failure too: a route nobody wrote down can never be paired, and is
therefore a human-only route by another name. **The gate fails closed**, and it
refuses to pass when it has proved nothing.

### The authority loop's own detail

Three more owner capabilities, and the three tools that perform them. Each tool
does the same operation, on the same object, as the route it pairs with, and
reads the same data — the route and the tool are thin adapters over one shared
capability, so an agent and a person operate through the same code path.

| Tool                | Route                              | Input                             | Output                                        |
| ------------------- | ---------------------------------- | --------------------------------- | --------------------------------------------- |
| `approval.evidence` | `GET /api/approvals/:id/evidence`  | `{ approvalId }`                  | the `ApprovalEvidence` the route answers with |
| `execution.resolve` | `POST /api/executions/:id/resolve` | `{ executionId, outcome, note? }` | `{ execution, outcome, detail }`              |
| `task.accept`       | `POST /api/tasks/:id/accept`       | `{ taskId, satisfied, reason? }`  | `{ task }`                                    |

**The grant rule is the rule the round trips above already keep.** A **read**
verb joins the default grant set; a verb that **spends the owner's authority**
does not, and the owner grants it by name. `approval.evidence` is a read — it
decides nothing and changes nothing — so it is in the default grant set
(`packages/contracts/src/mcp.ts:111-132`): an agent whose turn is blocked on a
decision has to be able to see what it is blocked on, the same ground
`approval.list` is held to. `execution.resolve` and `task.accept` spend the
owner's authority — one closes a turn whose outcome is unknown, the other
accepts a task — so **neither is in the default grant set**, and a connection
that was not granted one does not have it registered at all. A call for one is
refused and the refusal is recorded the way every other ungranted call is
recorded.

**The scoping rule is the rule the other id-addressed tools already keep.** Each
of these three names an id, so each names an _object_ and not a workspace: the
object is looked up in its own row and its workspace is checked against the
caller's scope before anything of it is read. **An agent is bounded to the
workspace it was granted, never to the whole tenant**, and a refusal carries
nothing of the object back.

**The record names who acted, and the authority behind it is the owner's
grant.** `approval.evidence` decides nothing and writes nothing.
`execution.resolve` writes `execution.outcome.resolved` and `task.accept`
writes `task.accepted` or `task.rejected`, and each entry carries the
`actorType` of the caller — `human` for the owner's own call, `agent` for an
agent's — and the caller's id. The owner is not an actor kind of their own: an
agent acting under a grant is recorded as the agent that acted, and the grant is
what stands behind it.

**An acceptance is not a report.** `task.accept` records an explicit judgement,
and only a satisfied acceptance closes the task. A task that moves to `review`
is waiting for this decision, and no other verb can make it: the rule that an
agent reporting completion is not acceptance holds for the tool as it holds for
the route.

**Migration.** Nothing is reclassified and no record is rewritten. The three
routes keep their published shapes and their published authentication — a
session cookie or the owner token, and never an agent token. A client that
does not call the new tools is unaffected. A connection that was granted the
default set gains `approval.evidence` and nothing else; a connection whose
grants were narrowed explicitly keeps the list it was given.

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
allowed in (`apps/server/src/modules/resources/service.ts:390-395`). **A task that
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
(`apps/worker/src/executor.ts:1252`) and its spend
(`apps/worker/src/executor.ts:1259`), and the workspace's spend for the day
(`apps/worker/src/executor.ts:1266`), before the turn starts; the policy's duration
limit caps the turn while it runs, and every action the agent announces is checked
against what the policy allows. The MCP surface refuses an action the policy does not
allow, and one the policy wants the owner to approve until the owner has decided. A
turn that exceeds a limit stops, and the outcome is recorded rather than silently
truncated.

**A daily cap is a cap on the workspace.** The workspace's spend for the day is the
sum of the spend units on the executions of that workspace since 00:00 UTC
(`apps/worker/src/executor.ts:1289-1298`,
`apps/worker/src/executor.ts:1293-1298`), and it is the same day for every workspace —
the system stores ISO timestamps everywhere and has no per-workspace timezone. A daily
cap of zero is no cap, as it is for the chain's spend limit. The cap applies across
the workspace's conversations and goals, and not per chain, which is the whole
difference between a daily cap and `maxSpendUnits`.

**A cap is only as good as the number it is measured against.** The daily cap is
measured against the spend units recorded on the executions, and a turn's cost is
one spend unit — the measure the product already has
(`apps/server/src/modules/conversations/routing.ts:332`). **The cost is recorded
against the execution when the turn ends**: the worker writes one unit for an
agent turn and none for a turn that never reached the agent
(`apps/worker/src/execution-owner.ts:703`).
**The row is created with no spend units**, because the cost is not known until
the turn has run (`apps/server/src/modules/conversations/dispatch.ts:216`,
`apps/server/src/modules/factory/service.ts:482`), and the column defaults to zero
(`apps/server/src/db/schema.ts:321`). **So the workspace's spend for the day is
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

The `done` status is reachable through exactly one path — the acceptance
decision. `PATCH /api/tasks/:id` cannot set it, and the MCP `task.update` tool
does not offer it. **The acceptance has two front doors and one writer**: the
owner's `POST /api/tasks/:id/accept` route and the owner's granted
`task.accept` tool, both of which call the same shared capability and land on the
same service. The rule is enforced in the service layer, which is the single
choke point every caller passes through.

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
`packages/agent-adapters/src/acp.ts:238` and called at
`apps/worker/src/executor.ts:406`, and the gate is the capability and the session
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
(`apps/server/src/modules/resources/service.ts:653`), and answers `queued: true`
(`apps/server/src/modules/resources/service.ts:660`): the route accepted the request
and the run has not happened. The same route runs a data source and a dashboard there
and then, so **the vocabulary is per action, not per route** — one route can record
`queued` for one kind and `succeeded` for another. **`succeeded` means the outcome was
observed and the action worked; `failed` means the outcome was observed and it did
not.**

**`unknown` means the outcome could not be confirmed** — neither a success nor a
failure. It is the same word the unknown outcome uses
([The unknown outcome](#the-unknown-outcome)), and it is in this vocabulary because
the product produces it: the worker writes it when a turn's outcome cannot be
confirmed (`apps/worker/src/execution-owner.ts:731`), and the conversation dispatch writes it
when a turn stops for the same reason
(`apps/server/src/modules/conversations/dispatch.ts:315`). **A vocabulary without
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
handler writes nothing (`apps/server/src/app.ts:219`).

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

**A conversation can be asked what is waiting on it.** The same route takes an
optional `conversationId`, and the list it returns then holds only what belongs
to that conversation: the requests its agents made, the turns in it whose
outcome could not be confirmed, and the capabilities its agents were refused.
A task is not in it — a task is decided on the factory board and belongs to no
conversation. The list without the parameter is the whole list, unchanged, so
adding the parameter changes nothing for a client that does not send it.

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

**The shape above is the contracts package's declaration.** It is published
once, in `packages/contracts/src/waiting.ts`: the kind union at
`packages/contracts/src/waiting.ts:16`, the reason union at
`packages/contracts/src/waiting.ts:25`, and the item at
`packages/contracts/src/waiting.ts:28`. **The server builds its rows against
that declaration** (`apps/server/src/api/waiting.ts:3`) **and the panel reads
the same one** (`apps/web/src/components/WaitingList.tsx:5-10`), so **there is one
published shape and the client cannot describe a different one.** The fourth
kind and the field that names the tool arrive by construction rather than by
remembering: a client that declares its own copy is describing a list the
server does not send.

The published waiting shape is the contract for **WI-132**, and the code
implements it — as of `e76b124`.

**Migration.** The shape moved and nothing is reclassified: the route returns
the same rows it returned before. **A client that copied the old declaration
must import the new one** — the kind union, the reason union and the item now
live in `packages/contracts/src/waiting.ts`, and a copy the client made is a
copy that does not know about the fourth kind or about the tool. A client that
imported the server's own declaration from `apps/server/src/api/waiting.ts`
keeps working: that module publishes the contracts package's declaration back
out under the same names (`apps/server/src/api/waiting.ts:14`).

**`unknown` is a reason of its own.** An item whose outcome could not be
confirmed is on this list because there is something to check, not because a
decision is waiting and not because the work is stuck. The state itself is
defined in [The unknown outcome](#the-unknown-outcome); this entry publishes the
list's use of it, and the two are not two definitions. The published type
carries `pending | review | blocked | unknown`, member for member with
`packages/contracts/src/waiting.ts:25`, and the route takes the reason straight
from the task's status (`apps/server/src/api/waiting.ts:97`), so a task that cannot be confirmed
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
`approval | task | turn | capability`, member for member with
`packages/contracts/src/waiting.ts:16`.

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
`packages/contracts/src/waiting.ts:16`.

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

**The panel's row carries that action.** The route above satisfies the API's
half of it, but a criterion that says "from the list" names the surface where
the owner finds the row, so the row itself carries the action: the panel's
capability row holds a button that calls `POST /api/agents/:id/grants` with the
row's own `toolName`
(`apps/web/src/components/waiting/WaitingRow.tsx:159`), and it
says which tool it is with the row's own `toolName` as well
(`apps/web/src/components/waiting/WaitingRow.tsx:75`). **The row is also named for
what it is**: a capability row is labelled "Needs a grant"
(`apps/web/src/components/waiting/WaitingRow.tsx:216`) and not "Blocked", because a
capability carries the reason `pending` and a label that went by the reason
would file it under work that is stuck rather than under a grant the owner can
widen from the row.

**The row is one row, in two places.** The waiting list on the conversations
page and the room itself use the same row
(`apps/web/src/components/waiting/WaitingRow.tsx:36`), so a request reads the
same in both places and there is one set of words for it.

The panel's capability row is the contract for **WI-132**, and the code
implements it — as of `e76b124`.

**Migration.** Nothing changes for a client that reads the list: the rows are
the rows, and the fourth kind is the fourth kind. **A client that renders the
list must now give the capability its own label** — a client that fell through
to "Blocked" for a kind it did not know showed the owner that work was stuck
when the owner could widen the grant from the same row. The action the row
carries is the published one, so a client that already posts to
`POST /api/agents/:id/grants` sends the same request it sent before.

**The row leaves when the grant is widened.** A capability the agent holds is not
waiting on the owner any more, so the row leaves the list as soon as the grant
includes it. Whichever way the grant was widened, the row leaves: the change,
the widening and the list all go through the one write that changes a grant
(`apps/server/src/modules/agents/service.ts:472`). A list that keeps the row is
a list that lies about what is waiting.

**The row leaves and the grant is written in one transaction (WI-131).** The two writes are
one change and are made together (`apps/server/src/modules/agents/service.ts:353`):
the row that says what the agent is waiting on leaves the list, and the grant that
says what the agent may call is written. **So the guarantee is kept in both
directions. The row leaves exactly when the grant includes the capability** — and
**the row stays when the grant write fails.** A write that is refused — a
configuration that is gone, a constraint the owner cannot meet — leaves both as they
were: the row is still on the list, and the grant was not widened. A list that drops
the row while the agent is still blocked is a list that lies the other way.

**A widening is not taken back (WI-146).** The union that widens the grant is
computed **inside** the transaction that writes it, from a read taken inside the
same transaction (`apps/server/src/modules/agents/service.ts:411`), and the
transaction takes the write lock before it reads
(`apps/server/src/modules/agents/service.ts:474`). **So a widening that another
process committed while this one was waiting is not taken back: the grant ends
up holding both capabilities.** A read taken outside the transaction could be
stale by the time the write landed, and a union computed from a stale grant
narrows the grant back to what it was — the owner's other action is lost, and
the list goes on showing the capability as waiting. The lock is taken first
because a deferred transaction that reads and then writes cannot wait: once
another process has committed, SQLite refuses to turn its read lock into a
write lock and answers `SQLITE_BUSY` at once rather than waiting, so the write
is lost instead of delayed.

The widening and the owner's change are the contract for **WI-146**, and the code
implements it — as of `e9c7d95`.

A transaction is also what holds across processes. The worker is a second process on
the same database, and the refusal it records there is written in a transaction of its
own (`apps/server/src/modules/agents/blocked.ts:44`), so the two meet in the database
rather than in one function's timing: a guarantee that rests on a function never
yielding is not a guarantee.

**The owner changes the grant with a change, not with a list.** `PATCH
/api/agents/:id` accepts `toolGrants` and `toolGrantChange` beside `name`,
`enabled`, `config`, `secrets` and `persona`
(`apps/server/src/api/agents.ts:47`), and the route hands the body on to the
service (`apps/server/src/api/agents.ts:211`). The grant fields of that body
are:

```ts
type AgentGrantPatch = {
  toolGrants?: McpToolName[];
  toolGrantChange?: {
    enable?: McpToolName[];
    disable?: McpToolName[];
  };
};
```

**The change is the owner's own edit of the grant, and it is applied to the grant
as it is now.** `enable` is what the owner turned on and `disable` is what they
turned off; the server reads the grant inside the transaction that writes it
(`apps/server/src/modules/agents/service.ts:397`) and applies the change to what
it finds there. **So a widening another writer committed after the client read
the grant survives the owner's save** — it is not in the change, so it is not
taken back.

**The order of the ways a body can change a grant is published, because the order
is the point.** A body may carry a change **and** a list. **The change is
applied and the list is not written.** The change is a command — "apply this to
the grant as it is now" — and the list is a state — "the grant is exactly
this". **The list is the one of the two that can take a widening back**, because
it says what the grant was when the client read it and nothing about what it is
now. **A body that carries only a list is written exactly as sent**
(`apps/server/src/modules/agents/service.ts:417`).

**So the order is one total order: change, then widening, then list**
(`apps/server/src/modules/agents/service.ts:385`,
`apps/server/src/modules/agents/service.ts:406`,
`apps/server/src/modules/agents/service.ts:417`). **The widening is not a field
of the update body** — it is the body of `POST /api/agents/:id/grants` — **so a
body of `PATCH /api/agents/:id` carries at most a change and a list, and the
change wins.**

**There are two ways to widen a grant, and they are two operations with
different meanings.** `POST /api/agents/:id/grants` takes one tool and widens the
grant by it; it never narrows (`apps/server/src/api/agents.ts:216`). **It is the
action a blocked agent needs**, and the one the waiting-list row carries.
`PATCH /api/agents/:id` with `toolGrantChange` is the owner's own edit of the
grant, and it **can** narrow, because the owner chose to. **Both stay.** They
are not two versions of one thing: the first adds the one tool an agent was
refused, and the second changes a set the owner is looking at.

**The revision moves with the grant, and the rule is one comparison.** The grant
as it stands and the grant the patch writes are compared, and the revision moves
when they differ (`apps/server/src/modules/agents/service.ts:441`). **So the
owner's change moves the revision when it moves the grant and does not move it
when it moves nothing**, and the rule is generic over the ways a grant changes:
a path added later cannot forget to move it.

**Migration.** A client that sends only `toolGrants` is unaffected and keeps
working exactly as before: the list still means "the grant is exactly this
list", and the row still leaves the waiting list when the grant includes the
capability. **A client that sends a change sends the change instead of the
list.** **The route grew a field and nothing else** — that is the change a
client written before has to allow for, and it is one field on one body.
**Nothing recorded changes shape**: the connection still reports `toolGrants` as
the effective list, the waiting list still reports the same kinds, and a
capability the agent holds still leaves the row when the grant includes it.
**No client has to change today.**

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
as of `d229b53`: the refusal is recorded at `apps/server/src/modules/mcp/server.ts:1319`, the list
draws it as its own kind at `apps/server/src/api/waiting.ts:140`, and the owner's
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
list in (`apps/server/src/api/waiting.ts:156`): an agent that cannot
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
(`packages/contracts/src/agent.ts:217-222`, `:223-228`). A call that answered has
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
(`apps/server/src/modules/approvals/service.ts:172`).

**The spend units are recorded, and today they are zero.** A spend unit is an
abstract cost counter, not currency (`packages/contracts/src/common.ts:58`). The
execution is created with `spendUnits: 0`
(`apps/server/src/modules/conversations/dispatch.ts:216`) and nothing writes the
column afterwards — the turn count the router uses to enforce a spend limit is
computed in memory and never stored
(`apps/server/src/modules/conversations/routing.ts:307`). A client that shows
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

**An agent reads the same evidence, under `approval.evidence`.** The tool
performs this read on the same approval and answers with the same shape, so an
agent and the owner look at the same thing before the same decision. It is a
read, it is in the default grant set, and it is bounded to the caller's own
workspace like every other id-addressed tool — see [The authority loop's own
detail](#the-authority-loops-own-detail).

This entry is the contract for **WI-039**, and the code implements it — the route
is `GET /api/approvals/:id/evidence`, at `apps/server/src/api/approvals.ts:39`,
and it is registered at `apps/server/src/app.ts:251`. The shape it answers is the
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
  /**
   * What the agent was reported to be able to do, at admission.
   *
   * Null when the connection had never been probed: the turn was admitted
   * against an agent whose capabilities nobody had observed yet.
   */
  capabilities: AgentCapabilities | null;
  toolGrants: string[];
  pinnedAt: string;
}
```

A turn recorded before this change has no view, and the API reports it as
absent rather than as empty. An empty view would say the agent had no tools,
which is a different claim.

**The view is pinned when the turn is admitted.** Every place that admits a
turn pins the same view, because there is one rule for it and it lives with
the capability API, which is the one module that reads across every domain
(`apps/server/src/modules/capabilities/capability-view.ts:29`). A conversation
turn and a factory turn are pinned the same way
(`apps/server/src/modules/conversations/dispatch.ts:208`,
`apps/server/src/modules/factory/service.ts:479`).

**The turn's own view answers what the turn may do.** Whether a turn can be
steered is asked of the view the turn was admitted with, and not of the
connection it runs on
(`apps/server/src/modules/capabilities/capability-view.ts:62`). A capability
that changed after the turn started does not change the turn, and takes effect
on the next one. A turn whose view says the capabilities were never observed
cannot be steered: nothing was observed. A turn recorded before the view
existed has none, so the connection answers for it — the same answer it gave
before the view was captured.

**The revision counts the times the set moved.** A connection's capability set
has a revision, and it moves when the set moves: the tool grants change, a
probe reports different capabilities, or the configuration is replaced and the
capabilities become unknown again
(`apps/server/src/modules/agents/service.ts:442`,
`apps/server/src/modules/agents/service.ts:518`,
`apps/server/src/modules/agents/service.ts:469`). The rule is one comparison
of the grant before the write and the grant after it
(`apps/server/src/modules/agents/service.ts:441`), so a grant saved unchanged
does not move the revision: the revision counts the changes, not the writes.

**The view does not re-scope the MCP token.** The token an agent holds names
its connection, so a grant the owner widens reaches the agent's next tool call
as well as its next turn. The view pins the grants for the turn's own
decisions — whether it can be steered, and what the panel says it may do — and
it is not a per-turn enforcement of the tool surface. A client that shows the
view is showing what the turn was admitted with, not a sandbox around it.

This entry is the contract for **WI-154**, and the code implements it — as of
`573ee57`. The rule is `apps/server/src/modules/capabilities/capability-view.ts`,
the shape is `packages/contracts/src/chat.ts`, the pinning is
`apps/server/src/modules/conversations/dispatch.ts` and
`apps/server/src/modules/factory/service.ts`, the revision is
`apps/server/src/modules/agents/service.ts`, the read is
`apps/server/src/api/executions.ts`, and the panel is
`apps/web/src/components/chat/TurnCapabilityPanel.tsx`. The slice's own record
is `.factory/work/WI-154.md`.

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

**The committed revision.** The revision of canonical history is a content hash
over the messages the history holds, in the order it holds them. A commit
publishes the revision of the history through the message it committed, so a
reader that holds a revision can tell whether the history changed underneath it.
The turn's `committedRevision` is that revision, and it is null exactly when
the turn's output is not in a canonical history: a turn that failed, a turn
whose outcome is unconfirmed, and a turn whose output belongs to a task rather
than to a conversation's history.

**A committed turn is not a completed turn.** A turn whose output was committed
is `committed`; a turn that merely returned is `completed`. The revision is how
a reader tells them apart without reading the whole history.

### The session reference

A conversation holds a durable reference to the runtime session behind it.

```ts
interface SessionReference {
  id: string;
  workspaceId: string;
  conversationId: string;
  /** The agent connection whose runtime holds the session. */
  agentConnectionId: string;
  /** The runtime's own name for the session. */
  sessionId: string;
  /** Whether the next turn can continue this session. */
  continuity: 'resumable' | 'fresh';
  /** The revision of the connection's capability set, when it is known. */
  capabilitiesRevision: number | null;
  establishedAt: string;
  updatedAt: string;
}
```

There is one reference per conversation and agent connection, because two
agents in one room keep two sessions and neither is the other's. The reference
is published on the conversation's own read model, so a client can read which
session it is looking at.

**Continuity is a fact about the runtime, not a hope.** A connection whose
capability set reports persistent sessions is `resumable`: the next turn in that
conversation goes back into the same runtime session. A connection that reports
no persistent sessions — or that nobody has probed at all — is `fresh`, and the
product does not claim a continuity it cannot see. The capability row records
the limit, and the panel shows it.

**The transcript names the session.** A reply that came out of a session says
so in its origin, so a reader can tell one session's answer from another's.
The origin names no session when the runtime keeps none.

**What the adapter matrix records.** For every adapter type, the matrix in
`docs/adapters.md` records the session limit and the version the claim was
verified against. A limit is a stated fact, not a surprise, and a matrix row
whose runtime version changes is a row whose claim has to be checked again.

**Migration.** Nothing is reclassified and no record is rewritten. The reference
is a new table and a new field, and a conversation that has not run a turn since
this change holds no reference and publishes an empty list. A client written
before this change keeps working: the conversation's read model carries the
fields it carried before, and a field it does not know about is a field it does
not read.

**Implementation status.** SPEC-R0-3, and the code implements it — as of
`6847121`: the reference is published on the conversation's read model, the turn
records it, and the next turn continues it when the runtime said it could.

### The terminal event of a turn

"Finished" is defined once, and every reader reads the same definition.

**A turn ends once.** The product publishes exactly one terminal event per
turn, after it has recorded the turn's own conclusion, and that event names the
state the turn is in. An adapter's own report that the turn finished is folded
into that conclusion rather than published as a second ending: a log with two
endings is a log a reader cannot settle. The worker publishes the ending of a
turn it ran; the server publishes the ending of a turn it ended — a queued turn
the owner cancelled, a turn the owner closed, a turn an approval closed.

**The statuses that end a turn** are `committed`, `completed`, `failed`,
`cancelled` and `lost`. `queued`, `running`, `blocked` and `unknown` are states
of a turn rather than endings, and a suspended turn has no terminal event at
all: it is held until the owner decides, and it may yet continue.

**The event names** are one per ending:

| Status      | Event            | What it means                                                          |
| ----------- | ---------------- | ---------------------------------------------------------------------- |
| `committed` | `turn.committed` | The turn's output is in canonical history.                             |
| `completed` | `turn.completed` | The adapter returned and the output is not in a canonical history.     |
| `failed`    | `turn.failed`    | The turn failed, and the reason is on the turn.                        |
| `cancelled` | `turn.cancelled` | The turn was stopped.                                                  |
| `lost`      | `turn.lost`      | Delegated work whose executor is gone was settled rather than retried. |

`unknown` has no event, because it is not an ending: it is the state of a turn
that started and whose outcome could not be confirmed, and only the owner can
close it (see "The unknown outcome"). `lost` ends a _delegation_ rather than an
execution, so it names a delegation's ending and is never the status of a run.

**What a reader may rely on afterwards.** After the terminal event, the turn's
status is final: the row and the event say the same thing, no further event
ends the turn, and the turn's `committedRevision` is the revision its output
was committed to — or null, when it was not committed to one.

**An unsettled turn.** A turn in `unknown` has an admission and no terminal
event, and the row says the state. The owner's conclusion is what ends it, and
the conclusion publishes the one event that ends the turn.

**What an interrupted turn looks like in the log.** A turn that was interrupted
— the deadline passed, the worker was restarted — has an admission and
whatever the runtime managed to publish, and **no terminal event**. The
reconciliation that settles an interrupted turn is a later slice; until it
lands, an interrupted turn is unsettled rather than quietly reported as a
failure, and the owner's conclusion is what ends it.

**Migration.** The status enum grows by one member and nothing is reclassified:
`committed` is new, and a turn recorded before this change stays `completed`,
`failed`, `cancelled` or `unknown`. **A turn that was `completed` before this
change is not `committed` in disguise** — we cannot know whether its output was
in a canonical history — and its `committedRevision` is null. A client that
switches exhaustively on the status has to render `committed`, and a client that
draws a turn's activity has to draw the terminal event of a committed turn.

**Implementation status.** SPEC-R0-3, and the code implements it — as of
`6847121`: the owner publishes one terminal event per turn, and the panel, the
MCP tools and the audit trail read the same definition of what ends a turn.

### Correlation and idempotency

A turn carries a correlation id. It ties the run to the events it published,
to the message it wrote and to its terminal state, so one turn can be followed
through the log without guessing which events belong to it. The turn's read
model publishes it.

**A dispatch has an identity.** It is derived from the message, the
conversation and the agent it went to, so the same dispatch always produces
the same key. A dispatch that repeats with the same key finds the run it
started last time and does not start a second one: one run, one set of events.
A dispatch to a different agent in the same conversation is a different
dispatch, and starts its own run.

**Migration.** The two columns are additive and nullable
(`apps/server/drizzle/0014_session_references.sql`), and nothing is backfilled:
a turn recorded before this change carries no correlation id and no committed
revision, and both are null, which is what the shape publishes as absent. The
idempotency key is derived from the dispatch and stored on the execution row, so
a dispatch repeated after this change finds the run it started last time, and a
dispatch repeated before it started a second run, which is not reconciled.

### Steer and queue

A message is sent with a delivery mode.

```ts
type MessageDelivery = 'steer' | 'queue';
```

`queue` is the default: the message waits for the next turn. `steer` goes into
the turn that is running.

**The route reads the mode, and says what it did with it.** A steer that can be
delivered is delivered into the turn that is running; a steer that cannot is a
queued message, and the answer says why. The mode is on the message itself, so
a client that reads the room later can see which it was.

```ts
interface Message {
  // ...
  delivery?: MessageDelivery;
}
```

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
be steered. **Only a connection that reported the capability is given a
channel to read steers from**, and the turn that runs on it is the one that
takes them.

```ts
interface AgentTurnInput {
  // ...
  steer?: AsyncIterable<string>;
}
```

**A steer targets one agent.** A message with `delivery: 'steer'` is delivered
to the running turn's agent alone. It does not wake other participants, and it
does not count as a new turn for the duplicate check. This extends
[Routing behaviour](#routing-behaviour); it weakens none of the
[Mandatory routing safeguards](#mandatory-routing-safeguards).

**A steer starts no turn of its own.** The turn that is running is the one that
takes it, and the message waits in the room until that turn takes it.

**An unconsumed steer is not dropped.** A steer the running turn never
consumed is delivered to the next turn, and is recorded as having been
delivered late.

This entry is the contract for **WI-152**, and the code implements it — as of
`cee9c69`. The delivery mode is `packages/contracts/src/conversation.ts`, the
steering channel is `packages/contracts/src/agent.ts`, the rules are
`apps/server/src/modules/conversations/steer.ts`, and the channel that carries
a steer into the turn that is running is `apps/worker/src/steer.ts`. The
slice's own record is `.factory/work/WI-152.md`.

### The chat surface

The conversation surface renders the turn, the work behind it and the owner's
controls over it.

**The turn's activity is published, not inferred.** The events the worker
already writes — `turn.admitted`, `session.started`, `tool.started`,
`tool.completed`, `message.delta`, `message.completed`, `artifact.created`,
`execution.status` — are read back from the event log and given a shape a
client can render.

```ts
type TurnActivityKind =
  | 'turn' // the turn itself: admitted, running, finished
  | 'tool' // a tool call: started and completed
  | 'message' // the reply being written
  | 'artifact' // something the agent produced
  | 'status'; // the execution's status changing

interface TurnActivity {
  kind: TurnActivityKind;
  /** The event's own name, so nothing is lost in the projection. */
  type: string;
  /** The tool's name, when the event is about a tool. */
  toolName: string | null;
  /** The artifact's resource id, when the event is about an artifact. */
  resourceId: string | null;
  /** A short, already-redacted summary for the trace row. */
  summary: string;
  /** The turn's own id, so a row can be tied back to it. */
  executionId: string | null;
  at: string;
}
```

**A tool's output is summarised, never carried whole.** The trace row carries a
bounded summary — how big it was, what it changed — rather than the output
itself. The event log keeps the truth; the surface keeps it readable.

**The stop control asks, and says what it did.** `POST /api/executions/:id/stop`
records the request and answers with what actually happened, because a request
to stop is not a confirmed cancellation: a queued job that never started is
cancelled truthfully, and a turn already running can only be asked.

```ts
type StopOutcome = 'cancelled' | 'stopping' | 'unsupported' | 'unknown';
```

**`unsupported` is a real answer.** A connection whose adapter cannot be
interrupted says so, and the control is disabled with the reason beside it —
never offered and then silently ignored.

**Markdown is rendered as text.** A message body is parsed into blocks and
rendered as elements; raw HTML in a message is shown as the characters the
agent wrote and never becomes markup, and a link or an image is checked before
its URL is used. A message cannot run code in the panel that shows it.

**The limits, stated plainly.** Steering works, and only for a connection that
reports `acceptsSteering`: a steer for a connection that cannot take input
mid-turn is a queued message, and the panel says so in the server's words. A
file the owner attaches is uploaded, and the message carries a reference to the
resource the upload created; the composer also offers the resources that
already exist, and a message may carry both. The trace shows the events the log
holds; it is not a complete account of what an adapter did inside its own
runtime.

This entry is the contract for **WI-141**, and the code implements it — as of
`dad1801` — the shapes are in `packages/contracts/src/chat.ts`, the activity
read model is `apps/server/src/modules/executions/activity.ts`, and the surface
is `apps/web/src/components/chat/`. The slice's own record is
[docs/contract-chat-rich-client.md](docs/contract-chat-rich-client.md).

**A prompt the owner presses is a message.** An empty room offers a row of
prompts, and pressing one sends that prompt as the message it is: through the
same path a typed message takes, with the delivery mode the owner has chosen,
and under the same routing rules. It is not a second kind of request that
bypasses what the room is governed by, and it is not turned into another
delivery behind the owner's back. **The prompts are openings, not claims.**
None of them asserts that an agent can read a file or run a command, because
an agent may not be able to; what an agent does with a prompt is the agent's
answer and the owner's to read. The row is offered while the transcript is
empty, and it is gone once the transcript is not.

This entry is the contract for the prompts an empty room offers, and the code
implements it — as of `0f53acb`. The row is `packages/ui/src/suggestion.tsx:47`,
the prompts are `apps/web/src/lib/suggestions.ts:22`, and the surface that
shows them is `apps/web/src/pages/ConversationDetail.tsx:540`.

### The attachment upload

A file the owner wants to send does not have to be a resource already.

```
POST /api/resources/upload       // store the bytes, answer with the resource
GET  /api/resources/:id/content  // the bytes of a resource that is a file
```

**The bytes travel as base64 in a JSON body.** The server needs no multipart
parser, and the product needs no new dependency for one.

```ts
{
  workspaceId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
}
```

The answer is `201` with the resource, in the same envelope every other
resource write answers with, and the route writes an audit entry at the route
level.

**An uploaded file is a `document` resource, told apart by its data.** The
resource type vocabulary is unchanged — there is no `file` type — and the
file's data carries the metadata and nothing else:

```ts
{
  kind: 'file';
  filename: string;
  mimeType: string;
  size: number;
}
```

**The path of the bytes is never in the resource.** The bytes are written under
the data directory, at `<dataDir>/files/<resourceId>` — the name is the
resource's id, so nothing the owner sent reaches the path — and the row that
says where they are goes into `resource_files`, the table the schema already
declared and nothing read. **The resource row and the `resource_files` row are
written in one transaction**, so a resource never points at bytes that were not
stored.

**A file is at most 10 MB.** A file over the cap is refused with the shared
error envelope and a sentence the owner can act on — before the body is read
when the request says how big it is, and again after the bytes are decoded.
Both answers are the same one.

**A client that attaches by reference keeps working.** Nothing about
`POST /api/resources` changed, and the message a client sends is unchanged: a
`file` content part with a resource id, which is what it always was.

**The limits that remain.** The bytes live in the data directory of one
deployment, and two deployments do not share them. **Nothing removes the
bytes**: `resource_files` cascades on delete, so the row goes when the resource
goes, but the file on disk stays, and there is no route that deletes a resource
today. **A file document can exist without bytes** — `POST /api/resources` and
the MCP `resource.create` tool accept the file shape, and only the upload route
stores a file. **An agent cannot upload**: the upload is on the owner-facing
API only. **The bytes are served as they were uploaded**: there is no
scanning, no rewriting and no preview.

This entry is the contract for **WI-151**, and the code implements it — as of
`75485dc`. The routes are `apps/server/src/api/resources.ts`, the bytes are
written by `apps/server/src/modules/resources/files.ts`, and the slice's own
record is `.factory/work/WI-151.md`.

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
  role: 'coordinator' | 'worker' | 'reviewer';
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

**The additions are additive.** A reader of the published shape reads the same
fields it read before and ignores the rest: no published field changes its name
or its meaning, and nothing is reclassified. The added fields say where the
work came from, which room it ran in, what was asked for and what came back.

**Delivery is not consumption.** `deliveredAt` records that the result reached
the parent. A completion notification does not mark the result consumed: the
host records a consumption candidate only after it has successfully read a
terminal task's output, and confirms it as consumed only when the parent turn
ends completed and its terminal state is committed. A parent that reads a
result and then fails leaves the result unconsumed, so the next continuation is
reminded of it again.

### The bot mode

The bot mode is a room of agents that work as a team. The owner talks to one
agent in the room — the **coordinator** — and the coordinator hands a bounded
piece of work to another agent — a **worker** — and gets the worker's actual
answer back without the owner kicking it off again. A third agent can
**review** the result.

A bot is **not** a new kind of agent. It is a role and a scope attached to an
agent connection that is already in the room.

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

**The role is a name and never a colour, and the scope is an allowlist and never
a broadcast.** An empty `dispatchableAgentConnectionIds` means _nobody_, so a
bot that was never given a team cannot wake one by accident.

**The rules that keep it honest.** These are refusals, not warnings, and each
one is a test.

1. **The scope decides.** A bot that may not delegate hands work to nobody, and
   a bot may only hand work to the agents its scope names.
2. **The caller must be a bot of the room.** An agent that was never registered
   has no scope, so it delegates to nobody.
3. **The target must be a bot of the room**, and not a coordinator — a
   coordinator does not take delegated work.
4. **The connection must exist, be enabled, and be in the workspace.**
5. **Authority may narrow, never widen.** The delegated work would run on the
   worker's own connection, so the worker would bring its own tools with it.
   If the worker's effective MCP grants are not a subset of the coordinator's,
   the delegation is refused: a coordinator cannot launder a more privileged
   agent's authority.
6. **The depth limit holds.** A delegation's depth is the room's own chain depth
   plus one, and a delegation at or past the depth limit is refused, so the
   chain terminates on its own.
7. **The delivery wakes one agent.** The worker's result is delivered into the
   parent room, attributed to the worker, addressed to the coordinator that
   asked. It does not wake the room, and it does not create a new delegation
   chain unless the coordinator explicitly asks for one.

**One routing change, and it is narrow.** A worker's report of a delegated
result wakes the coordinator that asked, and nobody else. The report is marked,
and the marker is set by the host that knows the delegation — never by anything
a message says about itself. Without the marker the existing rule stands
untouched: a non-coordinator agent message still wakes nobody, and naming the
coordinator explicitly is still refused. The marker only changes what happens
to **the coordinator that the delegation names**. Every other routing safeguard
is unchanged and still tested.

**The outcome of the child turn is the outcome of the delegation.** A child turn
that completed makes the delegation `succeeded`; one that failed makes it
`failed`; one that was cancelled makes it `cancelled`; one whose outcome could
not be confirmed makes it `lost`. **`lost` is settled**: it is never re-run and
it is not `failed`. A delegation that has settled stays settled.

**The tracked task follows the factory's own rule** — an agent reporting
completion is not acceptance. A delegation that succeeded moves its task to
`review`, one that failed moves it to `blocked`, one that was cancelled moves
it to `cancelled`, and one that was lost moves it to `unknown`. The task is
never moved to `done` by an agent: only `POST /api/tasks/:id/accept` closes it.

**The dispatch tool is a product tool.** `bot.dispatch` is in `mcpToolNames` and
is **not** in the default grant set: a connection that may delegate is a
connection the owner has said may delegate, through
`POST /api/agents/:id/grants`. A connection that was not granted it does not
have the tool registered at all, so it does not appear in `tools/list`. The tool
is the seam: the server records the intent, creates the delegated work, its
tracked task and its child turn, and enqueues. The worker runs it. The tool is
callable by an agent connection only; the owner's way in is the route.

**What the bot mode does not do.** The parts that are not built are named here
rather than left to be inferred.

- **The owner cannot dispatch into a room where the coordinator has never
  answered.** A delegation hangs from a turn, so a parent turn has to exist. The
  refusal says so plainly, and the tool path — a coordinator dispatching from
  its own turn — is unaffected.
- **The "reminded again" rule is only half there.** An unconsumed result stays
  in the room's history, so the coordinator sees the delivery again on its next
  turn, but there is no explicit block in the prompt saying the result is still
  waiting.
- **`stopping` is in the vocabulary but nothing enters it.** There is no route to
  call a delegation off, and no way to stop a child turn from the team room.
- **`lost` is settled by the mapping, not by a reaper.** Nothing detects that a
  worker holding a delegation has restarted and settles the delegation as
  `lost`; today `lost` is reached when a child turn's outcome cannot be
  confirmed.
- **Steering is not offered.** The published `delivery: 'steer'` rule and
  `acceptsSteering` are not used: a delegation always goes through the queue. A
  coordinator cannot steer a worker mid-task.
- **The capability view and the committed revision** on `GET /api/executions/:id`
  are `null`. They are published and belong to WI-055.

This entry is the contract for **WI-144**, and the code implements it — as of
`3c4db59`.

### The routes and the events

| Route                                  | Method | What it does                                                                           |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `/api/executions/:id`                  | GET    | The turn: its status, its capability view, its delegation tree, its committed revision |
| `/api/conversations/:id/fork`          | POST   | Fork the conversation at a message                                                     |
| `/api/conversations/:id/rewind`        | POST   | Continue from an earlier message as a new turn                                         |
| `/api/conversations/:id/messages`      | POST   | Gains `delivery: 'steer' \| 'queue'`, default `queue`                                  |
| `/api/conversations/:id/bots`          | GET    | The team of a room and the work it has handed over                                     |
| `/api/conversations/:id/bots`          | POST   | Register a bot in a room, or change the one already there                              |
| `/api/conversations/:id/bots/dispatch` | POST   | Hand work over on the coordinator's behalf                                             |

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

This entry is the contract for **WI-055**, and it is partly implemented. What
exists today: a turn is an execution, `unknown` is published for messages,
executions and tasks, and `origin.depth` records the delegation distance. The
delegation tree, the delegated task, the three delegation events and the bot
routes arrive with **WI-144**, and the code implements them — as of `3c4db59`.
**Steering has an entry of its own: WI-152, "Steer and queue", above.** What
this entry still adds — `turn.admitted`, `turn.committed`, `turn.failed`,
`turn.lost`, the capability view, the five-step commit, fork and rewind —
arrives with WI-055. The published shapes above are the contract that item
implements against, so the model can be reviewed as a whole before any of it
is written.

---

## Contract 8 — The feature seam

A feature is a unit of product that slots into the runtime: a room in the panel,
a surface in the client, and — when it needs one — routes under the API. A
feature declares itself in a **manifest**, and both sides read it.

### The manifest

The manifest is a published shape, so it is validated rather than trusted: a
feature that ships an id that is not an id, or a room with no path, fails when
the tree is checked rather than when the owner opens the panel.

```ts
interface FeatureManifest {
  /** "feat_" followed by lower-case words. */
  id: string;
  /** What the feature is called in words. */
  name: string;
  /** One sentence on what the feature is for. */
  description?: string;
  /** The rooms the feature contributes. */
  rooms: FeatureRoom[];
  /**
   * The prefix the feature's own routes live under.
   *
   * A feature that has no routes of its own leaves it out. When it is there,
   * it is the whole of the feature's share of the HTTP surface — nothing else
   * registers under it.
   */
  apiPrefix?: string;
}

interface FeatureRoom {
  /** Stable across renames: the room's own id. */
  id: string;
  /** What the owner reads in the room switch. */
  label: string;
  /** Where the room lives. */
  path: string;
  /** How dense the room is: the orientation room is airy, the work room is dense. */
  density: 'airy' | 'dense';
  /** Where the room sits in the switch. Lower comes first. */
  order: number;
}
```

The shape is `packages/contracts/src/feature.ts:73`, and the manifest a feature
writes is `FeatureManifestInput` — the same fields, with the defaults left for
the reader to fill in — while `FeatureManifest` is the same shape with them
filled.

### What the seam enforces

**The rules are refusals, not repairs.** A feature registered twice under one id
is refused, and two features claiming the same room path are refused, because a
path leads to one room and a second claim would send the owner to the wrong
one (`packages/contracts/src/feature.ts:105`).

**A feature's routes live under the prefix it declared.** The manifest's
`apiPrefix` is the whole of that feature's share of the HTTP surface; nothing
else registers under it.

**The server holds a registry, and the runtime installs what is in it.** A
feature is given the app and the services, so it registers its own routes
(`apps/server/src/features/registry.ts:48`), and the runtime installs every
registered feature when it builds the app
(`apps/server/src/app.ts:263`). Adding a server feature is one line in
`apps/server/src/features/index.ts:12`; the runtime's own files are not
touched.

**The client finds its features by a glob.** The files are part of this
repository, they are reviewed like the rest of it, and the browser never fetches
a feature it did not ask for
(`apps/web/src/features/registry.ts:57`).

### What the seam is not

**It is not a plugin marketplace and not a runtime loader for third-party
code.** A feature is first-party: it lives in this repository, it is reviewed
like the rest of it, and it is named at build time. What the seam buys is
narrower and more useful — two features can be built at the same time, on two
branches, and land without either of them touching `app.ts`, `App.tsx` or the
shell. How a feature is written is in
[docs/feature-authoring.md](docs/feature-authoring.md).

### What the seam does not yet cover

**The seam is not yet the union of the server's routes.** Measured on
2026-10-23 against `e717408`: the server registers 90 routes with `HEAD`
excluded, and two of them come from a feature — the Map's and the bots team's.
The client globs eight features, and six of them have no server-side feature
behind them. The route table below is therefore not the union of the features'
routes on the server: that is a coverage gap, not a structural one, and the
seam itself is what makes closing it a matter of adding a feature rather than
editing the runtime.

**The published table is the surface this contract promises, and it is
exhaustive over the API.** Every route the server registers under `/api` has a
row in it. Two routes outside `/api` do not, and both are transports rather
than API routes: the MCP endpoint on `/mcp`, whose methods the transport
itself declares, and the CORS catch-all. The MCP endpoint is described in prose
under MCP exposure. Two rows have no route yet —
`POST /api/conversations/:id/fork` and `POST /api/conversations/:id/rewind` —
and they arrive with WI-055, which publishes them first and implements them
second.

This entry is the contract for **WI-139**, and the code implements it — as of
`f2d9195`. The shape is `packages/contracts/src/feature.ts`, the server's
registry is `apps/server/src/features/registry.ts`, the runtime installs what
is in it at `apps/server/src/app.ts:263`, and the client finds its features by
a glob at `apps/web/src/features/registry.ts:57`. The slice's own record is
`.factory/work/WI-139.md`.

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

| Method             | Path                                                 | Purpose                                                                                                                                                     |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`              | `/api/health`                                        | Liveness and setup state.                                                                                                                                   |
| `GET`              | `/api/auth/status`                                   | Whether setup is still required.                                                                                                                            |
| `POST`             | `/api/auth/setup`                                    | Create the owner account. Once per instance.                                                                                                                |
| `POST`             | `/api/auth/login`                                    | Start a session.                                                                                                                                            |
| `POST`             | `/api/auth/logout`                                   | End the session.                                                                                                                                            |
| `GET`              | `/api/auth/me`                                       | The current owner.                                                                                                                                          |
| `POST`             | `/api/auth/owner-token`                              | Return the configured owner token. Owner only — an agent token is refused.                                                                                  |
| `GET/POST`         | `/api/workspaces`                                    | List and create workspaces.                                                                                                                                 |
| `GET/PATCH`        | `/api/workspaces/:id`                                | Read and update a workspace. `PATCH` accepts `autonomyPolicy`.                                                                                              |
| `GET/POST`         | `/api/agents`                                        | List and create agent connections.                                                                                                                          |
| `GET`              | `/api/agent-presets`                                 | The adapter preset catalogue. A template, never an integration.                                                                                             |
| `GET/PATCH/DELETE` | `/api/agents/:id`                                    | Read, update, remove a connection. `PATCH` accepts `toolGrants` and `toolGrantChange`.                                                                      |
| `POST`             | `/api/agents/:id/probe`                              | Re-run capability discovery.                                                                                                                                |
| `POST`             | `/api/agents/:id/grants`                             | Widen one tool grant. The action a blocked agent needs.                                                                                                     |
| `GET/POST`         | `/api/agents/:id/tokens`                             | Issue and list MCP tokens.                                                                                                                                  |
| `DELETE`           | `/api/agents/:id/tokens/:tokenId`                    | Revoke an MCP token.                                                                                                                                        |
| `GET`              | `/api/agents/:id/memories`                           | The agent's own memories, and the brief's budget, used and dropped counts.                                                                                  |
| `GET`              | `/api/secrets`                                       | List the secret configurations. Metadata only — a value never leaves the server.                                                                            |
| `GET/POST`         | `/api/conversations`                                 | List and create conversations.                                                                                                                              |
| `GET/PATCH/DELETE` | `/api/conversations/:id`                             | Read, update, remove a conversation.                                                                                                                        |
| `GET/POST`         | `/api/conversations/:id/messages`                    | Read and post messages.                                                                                                                                     |
| `POST`             | `/api/conversations/:id/participants`                | Add a participant.                                                                                                                                          |
| `DELETE`           | `/api/conversations/:id/participants/:participantId` | Remove a participant.                                                                                                                                       |
| `PATCH`            | `/api/conversations/:id/participants/:participantId` | Change a participant's persona override. `null` clears it.                                                                                                  |
| `GET/POST`         | `/api/conversations/:id/bots`                        | The team of a room, and register or change a bot in it.                                                                                                     |
| `POST`             | `/api/conversations/:id/bots/dispatch`               | Hand work to another agent on the coordinator's behalf.                                                                                                     |
| `GET/POST`         | `/api/resources`                                     | List and create resources. A resource is never born live.                                                                                                   |
| `GET/PATCH`        | `/api/resources/:id`                                 | Read and update a resource.                                                                                                                                 |
| `POST`             | `/api/resources/:id/publish`                         | Publish a resource. The act that makes one live. Only the kinds that support it. The agent tool is `resource.publish`. See [the entry](#the-resource-acts). |
| `POST`             | `/api/resources/:id/execute`                         | Execute a resource. Only the kinds that support it. The agent tool is `resource.execute`. See [the entry](#the-resource-acts).                              |
| `GET`              | `/api/resources/:id/inspect`                         | Validate without changing.                                                                                                                                  |
| `POST`             | `/api/resources/upload`                              | Store a file's bytes and answer with the resource that points at them.                                                                                      |
| `GET`              | `/api/resources/:id/content`                         | The bytes of a resource that is a file.                                                                                                                     |
| `GET/POST`         | `/api/goals`                                         | List and create goals.                                                                                                                                      |
| `GET`              | `/api/goals/overview`                                | The goals and the counts under each.                                                                                                                        |
| `GET`              | `/api/goals/:id`                                     | Read a goal.                                                                                                                                                |
| `GET`              | `/api/goals/:id/view`                                | A goal with its work, its dependencies and its shape.                                                                                                       |
| `GET/POST`         | `/api/tasks`                                         | List and create tasks.                                                                                                                                      |
| `GET`              | `/api/tasks/dependencies`                            | What the workspace's tasks wait on.                                                                                                                         |
| `GET/PATCH`        | `/api/tasks/:id`                                     | Read and update a task. `PATCH` cannot set `done`; it also enforces `expectedRevision`.                                                                     |
| `POST`             | `/api/tasks/:id/assign`                              | Assign a task to an agent.                                                                                                                                  |
| `POST`             | `/api/tasks/:id/accept`                              | Record an acceptance decision.                                                                                                                              |
| `POST`             | `/api/executions/:id/resolve`                        | Close a turn the owner cannot confirm. See [the entry](#closing-an-unknown-outcome).                                                                        |
| `GET`              | `/api/executions/:id`                                | The turn: its status, its capability view, its delegation tree, its committed revision, and the activity behind it.                                         |
| `POST`             | `/api/executions/:id/stop`                           | Ask a turn to stop, and answer with what the request actually did.                                                                                          |
| `GET/POST`         | `/api/automations`                                   | List and create automations.                                                                                                                                |
| `GET/PATCH/DELETE` | `/api/automations/:id`                               | Read, update and remove an automation.                                                                                                                      |
| `POST`             | `/api/automations/:id/enable` · `/disable`           | Toggle scheduling.                                                                                                                                          |
| `GET`              | `/api/approvals`                                     | List approval requests.                                                                                                                                     |
| `GET`              | `/api/approvals/:id`                                 | Read an approval request.                                                                                                                                   |
| `GET`              | `/api/approvals/:id/evidence`                        | The evidence a decision is taken against. See [the entry](#the-approval-evidence).                                                                          |
| `POST`             | `/api/approvals/:id/decide`                          | Approve or reject a sensitive operation. Publishes `approval.decided`.                                                                                      |
| `GET`              | `/api/waiting`                                       | Everything waiting on the owner, in one list. See below.                                                                                                    |
| `GET`              | `/api/audit`                                         | Read the audit trail. See [the entry](#the-audit-outcome).                                                                                                  |
| `GET`              | `/api/measures`                                      | The product's two measures of itself. See below.                                                                                                            |
| `GET`              | `/api/autonomy-policy`                               | The autonomy policy in force for a scope. See below.                                                                                                        |
| `GET`              | `/api/events`                                        | Server-sent event stream.                                                                                                                                   |
| `GET`              | `/api/agui/events`                                   | The same stream in AG-UI. See [the AG-UI stream](#the-ag-ui-stream).                                                                                        |
| `POST`             | `/api/agui/runs/:runId/resume`                       | Answer the interrupts of an AG-UI run. See [the AG-UI stream](#the-ag-ui-stream).                                                                           |
| `GET`              | `/api/features/bots/team`                            | The bot feature's read model — the same payload as the conversation route, under the feature's own prefix.                                                  |
| `GET`              | `/api/features/map`                                  | The map feature's read model.                                                                                                                               |
| `ANY`              | `/mcp`                                               | MCP streamable HTTP endpoint.                                                                                                                               |

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
(`apps/server/src/db/schema.ts:639`, `apps/server/src/db/schema.ts:553`) — and the
projections read it
(`apps/server/src/modules/resources/service.ts:250`,
`apps/server/src/modules/resources/service.ts:381`). An agent-created
automation or task is recorded as authored by the agent that made it.

**Every mutating route writes an audit entry.** Of the 41 mutating routes in
`apps/server/src/api/`, 33 write an audit entry at the route level, and eight more
write one from the service layer — `POST /api/approvals/:id/decide` and `POST
/api/agui/runs/:runId/resume`, both at
`apps/server/src/modules/approvals/resume.ts:55`, `PATCH /api/tasks/:id` at
`apps/server/src/modules/factory/service.ts:424`, and that one only when the task
leaves `unknown`, and `POST /api/executions/:id/stop` at
`apps/server/src/modules/executions/service.ts:277` — which is where the agent's
own stop request is written too, so the request is in the trail whoever made it.
`POST /api/executions/:id/resolve` writes at
`apps/server/src/modules/executions/service.ts:352` and `POST /api/tasks/:id/accept`
at `apps/server/src/modules/factory/service.ts:577`; both are written by the
service layer so that the agent's `execution.resolve` and `task.accept` land in
the same trail as the owner's own calls. `POST /api/resources/:id/publish` and
`POST /api/resources/:id/execute` write from the shared capability for the same
reason, at `apps/server/src/modules/capabilities/service.ts:578` and
`apps/server/src/modules/capabilities/service.ts:602`, so that the agent's
`resource.publish` and `resource.execute` land in the
same trail as the owner's own calls.
**No mutating route writes none.**

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

**Most of the agent's own operations are not audited at all.** The MCP surface
writes no audit entry of its own — there is no audit call anywhere in
`apps/server/src/modules/mcp/server.ts` — and the capabilities service its tools
call reach the resources service directly rather than through the auditing
route. **Four verbs are the exception**, and they are the exception because they
spend the owner's authority: `execution.resolve` and `task.accept` reach the
executions and factory services, which write the trail themselves, and
`resource.publish` and `resource.execute` reach the shared capability, which
writes `resource.published` and `resource.executed` itself. So a
connection that was granted one of them leaves `execution.outcome.resolved`,
`task.accepted`, `resource.published` or `resource.executed` behind with
`actorType: 'agent'`. The other writer of the trail
that is not an owner HTTP route is
the worker — its `unknown` record (`apps/worker/src/execution-owner.ts:724-733`) and the
policy refusals it writes (`apps/worker/src/execution-owner.ts:754-772`). So every audited
operation is an owner operation, except the worker's own entries, which carry
`actorType: 'agent'`. **The second measure does not count the work an agent does
through MCP**: an agent can create and update resources all day and the
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
(`apps/worker/src/execution-owner.ts:731`), and the `failure` it writes when the
autonomy policy refuses a turn or an action
(`apps/worker/src/execution-owner.ts:771`). **An operation that failed at the route is
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

**The approval the event carries is published.** A client reading only this
contract must be able to know the fields of the payload it receives, so the
approval is declared here member for member. It is the same approval the decide
route already returns, and the server's own type is derived from the schema rather
than being a copy of it
(`packages/contracts/src/approvals.ts:25`).

```ts
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface Approval {
  id: string;
  workspaceId: string;
  /** What the approval was raised against. Null when it names nothing. */
  executionId: string | null;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
  /** The one line the owner reads to decide. */
  summary: string;
  /** What the agent wanted. The shape is the agent's own and is not published. */
  details: unknown;
  status: ApprovalStatus;
  /** Why the decision was made. Null while the approval is still waiting. */
  reason: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  createdAt: string;
  /** When the owner decided. Null while the approval is still waiting. */
  decidedAt: string | null;
}
```

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
