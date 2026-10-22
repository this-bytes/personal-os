# The adapter lifecycle: connect, send, close

Contract notes for `CONTRACTS.md`, and the record of what the adapters
actually do. The integration owner folds the contract section into
`CONTRACTS.md`; this file stays as the slice's own record.

## The problem this slice closes

`ARCHITECTURE.md` §4 says it plainly: _"A successful capability probe on one
instance does not initialize a later instance."_ The MCP adapter made that
sentence a bug rather than a rule:

- `packages/agent-adapters/src/mcp.ts` created the transport in `connect()`
  and refused to answer a turn without one — with the message **"The MCP
  server was never reached."**, which describes a symptom and gives the owner
  nothing to act on.
- The only caller of `connect()` in the tree was the **probe** path in
  `apps/server/src/modules/agents/service.ts:358`, which connected an
  instance, read the capabilities and threw the instance away.
- The **worker** (`apps/worker/src/executor.ts`) created an adapter and
  called `send()` with no `connect()`. So the probe could report a connection
  as `connected` while the real turn failed.

## The lifecycle

Every adapter now has the same three steps.

| Step                  | What it does                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `connect(connection)` | Establishes the runtime and returns the capabilities that are actually true.                    |
| `send(input)`         | Runs one turn on that runtime.                                                                  |
| `close()`             | Releases everything the adapter holds: the supervised child process, the transport, the socket. |

`close()` is part of the published interface. It was added **additively** —
`close?(): void | Promise<void>` on `AgentAdapter` in
`packages/contracts/src/agent.ts` — so every existing adapter and every
existing caller still compiles. It is safe to call more than once, at any
point in the lifecycle, and on an instance that was never connected.

A turn that ends, fails or is abandoned must not leave a child process
behind. The turn releases what it used, and the caller closes the adapter
when the turn is over.

### The refusal

A turn asked to run on an instance whose runtime was never established is
refused with an `execution.error` event:

- **code**: `adapter_not_connected` (published as `ADAPTER_NOT_CONNECTED_CODE`
  in `packages/contracts/src/agent.ts`)
- **message**: `This MCP adapter was not connected. Call connect() before send().`
  (and the same for the other adapters, with their own name)

When a connection attempt failed, the reason follows the fix — _"The last
connection attempt failed: The MCP server did not complete the handshake."_ —
because the reason is what the owner acts on.

### Which adapters refuse a turn without a connection

| Adapter | `connect()` establishes                                                                        | A turn without `connect()`                                 |
| ------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `mcp`   | the server process and the `initialize` / `notifications/initialized` / `tools/list` handshake | **refused** with `adapter_not_connected`                   |
| `cli`   | that the command exists                                                                        | **refused** with `adapter_not_connected`                   |
| `acp`   | a handshake probe against a real agent (see below)                                             | allowed — the turn sets its own session up                 |
| `a2a`   | the agent card                                                                                 | allowed — the request is made and answered within the turn |
| `http`  | the gateway's capabilities                                                                     | allowed — the request is made and answered within the turn |
| `model` | the provider's capabilities                                                                    | allowed — the request is made and answered within the turn |
| `echo`  | the echo agent's capabilities                                                                  | allowed — there is no runtime to be missing                |

The rule behind the table: **the refusal exists where there is a runtime to
be missing.** An adapter that holds a runtime between the connection and the
turn must be connected; an adapter whose runtime is the turn itself, or
nothing at all, has nothing to be missing.

### ACP keeps its send-time setup

ACP initialises the agent as part of the turn, and that is kept. The recovery
notes are explicit: _"Retain ACP's working send-time setup; do not blindly
impose a second handshake on every protocol."_ A turn still initialises,
creates or restores its session and prompts it, with or without a prior
`connect()`.

ACP's `connect()` is still a **real** handshake against a real agent, and the
capabilities it reports are the ones the agent answered with
(`persistentSessions` follows the agent's `loadSession`). It is a probe, not
a runtime the turn borrows, so it releases the agent it started — a
capability probe that leaves a process behind is a leak, not a capability.
The cost is one extra short-lived agent process per ACP turn, because the
connection is probed before the turn. `close()` releases the agent of a turn
that is still in flight.

## What the worker must change

`apps/worker/src/executor.ts` owns three adapter call sites. Each needs the
connection established before the turn, and the adapter closed when the turn
is over.

1. **`executeChatTurn`** — the connection row is already loaded at line 186.
   After `runtime.registry.create(...)` (line 412), add:

   ```ts
   await adapter.connect(connection);
   ```

   and in the `finally` (line 500), next to `clearTimeout(timeout)`:

   ```ts
   await adapter?.close?.();
   ```

2. **`executeFactoryTask`** — the adapter is created at line 842 and the
   connection row is not loaded. Load the row for
   `payload.agentConnectionId`, call `await adapter.connect(row)`, and hoist
   the adapter (`let adapter: AgentAdapter | null = null`) so the `finally`
   (line 863) can call `await adapter?.close?.()`.

3. **`executeAutomation`** — same shape at line 1073, with
   `action.agentConnectionId`.

The `connect()` call is the fix for the defect: without it an MCP or CLI
turn is refused with `adapter_not_connected` instead of failing obscurely.
The `close()` call is what releases the runtime the turn used.

## The probe path in the server

`apps/server/src/modules/agents/service.ts:358` connects an adapter, reads
the capabilities and discards the instance. For MCP that leaves the server
process running: the transport is only released by `close()`. This is
pre-existing behaviour, and `close()` now makes it fixable in one line —
call `await adapter.close?.()` after reading the capabilities. ACP's probe
releases its own agent, and the HTTP-shaped adapters hold nothing.

## What is deliberately not done

- **The worker and the server are not edited here.** They belong to the
  integration owner, and the notes above say exactly what to change.
- **No capability flag changed meaning.** `cancel: false` still means the
  protocol cannot interrupt a turn; `streaming: false` still means the
  protocol cannot stream one. `connect()` reports what is true, and the
  refusal is a failure of the _connection_, not of the adapter's abilities.
- **No second handshake is imposed on ACP.** Its turn still sets its own
  session up.
- **The domain does not know the adapters.** `packages/contracts` holds the
  interface and the error code; `packages/agent-adapters` holds the
  implementations. No provider name appears in the contracts.
- **No secret is echoed.** An adapter resolves a credential through
  `AdapterContext.resolveSecret` and puts it in a header. Nothing in a
  refusal, an event or a message carries a credential value.

## Tests

`packages/agent-adapters/src/__tests__/lifecycle.test.ts` drives the real
fixtures — a real MCP server over stdio, a real ACP agent, real child
processes — and asserts:

1. connect then send reaches the server, and the tool's result is recorded;
2. send without connect is refused, with the exact message;
3. `close()` releases the child process (checked against the process table on
   Windows, so the check means the same thing on every platform);
4. a handshake that fails leaves no process behind;
5. a connection on one instance does not stand in for another — the sentence
   from `ARCHITECTURE.md` §4;
6. a turn that ends, fails or is abandoned releases its process, for the CLI
   and the ACP adapter as well as MCP.

The CLI adapter's environment is proven not to leak: the server's own
environment does not reach the command, and the configured values do.
