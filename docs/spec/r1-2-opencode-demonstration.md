# SPEC-R1-2 — The owner completes real work against a real, installed OpenCode runtime

**State:** open · **Owner:** implementing agent, with the owner driving the demonstration · **Verifier:** independent reviewer against this spec and the roadmap's release criteria
**Depends on:** SPEC-R0-1, SPEC-R0-3, SPEC-R0-4, and the ACP surface landing · **Adapter:** the ACP surface carried by `wi/160-opencode-acp`

## Outcome

The owner completes real work in the **same** web chat against a **real,
installed OpenCode runtime**, and the transcript of that session is the
evidence.

R1 asks for two runtimes precisely so that the interface is proven to be the
interface: not one harness with a different name, and not two interfaces
that happen to look alike. SPEC-R1-1 proves Codex; this one proves that what
was built for Codex is the product, and OpenCode is a second adapter rather
than a second product.

## The runtime is installed

Measured on this machine, not assumed:

```
opencode --version   →  1.19.4
```

As with Codex, `docs/roadmap.md`'s line that the other four approved
runtimes "are not installed here" is stale and should be corrected.

## Preconditions

Every fact below was measured on this machine on 2026-10-23. The commands and
their output are recorded so a reviewer can re-measure them.

### The runtime and where it lives

```
Get-Command opencode
```

```
Name          CommandType     Source
----          -----------     ------
opencode.ps1  ExternalScript  C:\Users\Aaron\AppData\Roaming\npm\opencode.ps1
```

The shim is npm's. What it runs is:

```
Get-Content C:\Users\Aaron\AppData\Roaming\npm\opencode.ps1 | Select-String 'opencode.exe'
```

```
& "$basedir/node_modules/opencode-ai/bin/opencode.exe"   $args
```

So the real entry point is
`C:\Users\Aaron\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`
— a **native Windows executable**, in the package `opencode-ai` v1.19.4. It
is a different shape from Codex's Node entry point, and the spawner has to
cope with both.

### The version

```
opencode --version
```

```
1.19.4
```

### The approved surface

`docs/adapters.md` names the surface OpenCode is to be integrated through:

> OpenCode | ACP for client integration; native HTTP server/OpenAPI and SSE
> for remotely hosted sessions. | Sessions/messages, event correlation,
> permissions, abort, reconnect/log recovery and authenticated remote access.

ACP is the client-facing route, and the runtime publishes it:

```
opencode --help
```

```
  opencode acp                 start ACP (Agent Client Protocol) server
  opencode run [message..]     run opencode with a message
  opencode serve               starts a headless opencode server
  opencode attach <url>        attach to a running opencode server
  opencode session             manage sessions
  opencode models [provider]   list all available models
  opencode providers           manage AI providers and credentials                   [aliases: auth]
  opencode export [sessionID]  export session data as JSON
  opencode import <file>       import session data from JSON file
  opencode db                  database tools
```

```
opencode acp --help
```

```
opencode acp

start ACP (Agent Client Protocol) server

Options:
      --print-logs   print logs to stderr                                                  [boolean]
      --log-level    log level                  [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure         run without external plugins                                          [boolean]
      --port         port to listen on                                         [number] [default: 0]
      --hostname     hostname to listen on                           [string] [default: "127.0.0.1"]
      --cwd          working directory
                     [string] [default: "…"]
```

`opencode acp` is the mode the adapter drives. `--cwd` sets the working
directory the session runs in, which is the directory the connection names.

### The permission model, and where the runtime raises a question

```
opencode --help
```

```
      --auto          auto-approve permissions that are not explicitly denied (dangerous!)
```

OpenCode has a permission model, and `--auto` is what turns it off. A runtime
that can auto-approve a permission is a runtime that asks. **Without** `--auto`,
OpenCode asks the client — and the client here is the product's ACP adapter.

### The credential

```
opencode auth list
```

```
Credentials ~\ .local\share\opencode\auth.json

—  0 credentials
```

Zero provider credentials are configured on this machine. The runtime still
reaches models:

```
opencode models
```

```
opencode/beam-free
opencode/big-pickle
opencode/deepseek-v4.1-flash-free
opencode/flint-40b-free
opencode/glm-5.3-flash-free
opencode/mimo-v2.6-flash-free
opencode/nemotron-3-ultra-free
opencode/nemotron-3.5-lightning-free
opencode/nemotron-3.5-super-vl-free
```

Nine free models are reachable with no credential at all. The demonstration
may therefore run with zero credentials, and the transcript says so — which is
a fact about the runtime, not a licence to claim a credential path that was
not exercised. A run against a paid provider is a separate observation.

### What the demonstration needs from the environment

- `opencode` on `PATH`, or the absolute path to
  `…\node_modules\opencode-ai\bin\opencode.exe` in the connection's `command`.
- The ACP mode reached by the connection's `args` being `['acp']`.
- A project directory the agent may work in, passed as the connection's
  `cwd` and as `--cwd`.
- No provider credential is required for the free models. One is required for
  any other model, and the preset says so.

## The path

### The path today

```
apps/web  →  POST /api/conversations/:id/messages
          →  apps/worker/src/executor.ts  executeChatTurn()
          →  packages/agent-adapters/src/acp.ts      AcpAdapter.send()
          →  packages/agent-adapters/src/jsonrpc.ts   JsonRpcStdioClient
          →  opencode acp  (JSON-RPC over stdio)
          →  session/update notifications → the adapter's AgentEvent stream
          →  the worker's events → GET /api/events → the panel's trace
```

The adapter's turn, in `packages/agent-adapters/src/acp.ts`:

- `initialize`, with the ACP protocol version and the client capabilities;
- `session/new` — or `session/load` when the turn carries an
  `externalSessionId`;
- `session/prompt`, with the turn's message and context as **one text
  block**;
- the reply arrives as `session/update` notifications whose
  `sessionUpdate` is `agent_message_chunk`, and each becomes a
  `message.delta`.

The session id the runtime answers with is the execution's `externalRef`, and
`resumeSession()` can restore it — so this route can continue a session, and
`persistentSessions` is read from the runtime's own `loadSession`
capability rather than assumed.

### The surface that lands beside it

`wi/160-opencode-acp` carries the ACP surface this spec depends on, and this
spec does not repeat its work:

- the `opencode-acp` preset's `args` becomes `['acp']`, so the runtime is
  started **in ACP mode** rather than as a terminal UI;
- `packages/agent-adapters/src/jsonrpc.ts` spawns through
  `packages/agent-adapters/src/util.ts`'s `spawnExecutable`, which handles
  the npm `.cmd` shim on Windows. Without it the spawn is `ENOENT`, because a
  `shell: false` spawn of a `.cmd` file does not resolve;
- `packages/agent-adapters/src/util.ts`'s `resolveExecutable` becomes
  synchronous, so the path search is one call rather than a search per
  candidate;
- the preset becomes `verified: true`, with the observation recorded.

### The gap this spec closes

**The ACP adapter refuses the runtime's permission requests, while the
product's capability row says it supports them.**

`packages/agent-adapters/src/acp.ts`:

```ts
// Peer-initiated requests (file access, permissions) are declined: this
// adapter advertises no filesystem or terminal capability.
const offRequest = client.onRequest(() => {
  throw new Error('This Personal OS adapter does not grant client-side capabilities.');
});
```

Every request the runtime makes of the client is answered with an error.
OpenCode's permission request is exactly such a request, so it never reaches
the owner. And `session/request_permission` appears **nowhere** in the
repository:

```
Select-String -Path <repo> -Pattern 'request_permission'
```

```
No matches found
```

The product's approvals are raised from the MCP tool path
(`apps/server/src/modules/mcp/server.ts`), when an agent calls a tool that
needs the owner's decision — not from a runtime's own question. So there is
no path from OpenCode's permission request to the owner, and the acceptance
item below cannot be met on this route as it stands.

Worse, the capability row over-claims. `packages/contracts/src/adapter-presets.ts`:

```ts
  acp: {
    chat: true,
    streaming: true,
    persistentSessions: true,
    backgroundTasks: true,
    cancel: true,
    approvals: true,
    artifacts: true,
  },
```

and `acp.ts` returns the same `approvals: true` and `artifacts: true` from
its handshake. The panel therefore tells the owner that OpenCode supports
approvals and artifacts, and the adapter declines both. `docs/adapters.md` is
plain about this: _"An unknown capability is never advertised as supported."_

### What the demonstration must add

- **A permission request the owner can answer.** The adapter answers the
  runtime's permission request with the product's approval, the owner decides
  in the room's waiting list, and the decision goes back to the runtime. The
  worker already carries the machinery for a turn suspended on an approval:
  `resume.decision` and `resume.externalSessionId` in
  `apps/worker/src/executor.ts`, and `POST /api/approvals/:id/decide` in the
  API.
- **The capability row stops over-claiming.** Either the adapter surfaces
  permissions and artifacts, or the row says it does not. A row that claims a
  capability the adapter refuses is a failing gate, not a documentation
  nit.
- **An attachment the runtime can read.** The adapter sends one text block
  today. OpenCode's own capabilities include images; the demonstration needs
  the content parts to cross, or the record has to say that OpenCode's chat
  baseline excludes them.

## Procedure

The owner drives this. The numbers are the steps; each one says what the
owner does and what they observe.

1. **Prove the runtime answers through the product's own adapter first.**
   Run, from the repository root:

   ```
   npx tsx scripts/verify-runtime.ts --preset opencode-acp --probe-only
   npx tsx scripts/verify-runtime.ts --preset opencode-acp --prompt "what can you do?"
   ```

   Observe: the handshake answers and prints the capability rows; the command
   line the adapter will really run is printed and names the ACP mode; the
   turn returns the runtime's own answer.

2. **Connect the runtime in the panel.** Open **Agents → Add an agent
   connection**. In the _Template_ dropdown choose the OpenCode template; set
   the name and the project directory the session should run in; save. The
   server probes the connection on save and reports the real capabilities
   beside it (`apps/web/src/components/AgentConnectionForm.tsx`). Observe:
   the capabilities reported are the ones the runtime actually answered —
   **not** the template's claim. If they differ, that difference is the
   finding, and it is recorded before the demonstration goes further.

3. **Begin a conversation.** Open a room and add the connection as a
   participant. Observe: the participant is listed in the room's team.

4. **Ask for a small change.** In the composer, address the agent and ask
   for a small file or code change in the scratch directory. Observe: text
   arrives in pieces, and the **Activity timeline** (`ActivityTimeline.tsx`)
   shows the runtime's own tool activity beside its answer.

5. **Follow up while the work runs.** Switch the composer's delivery to
   **steer** (`RunControls.tsx`) and send a second message. Observe: the
   steer reaches the turn that is running, or the control says it is not
   supported, and the panel distinguishes what was received from what was
   submitted.

6. **Answer a permission request.** Observe: the runtime asks, the request
   appears in the room's waiting list, and the owner's decision goes back to
   the runtime and the turn continues. If the adapter still refuses the
   request, that is the gap in this step, and the transcript records it as
   the gap it is — with the alternative the runtime supports.

7. **Stop a run.** Press **Stop**. Observe: the state reads `stop requested`,
   and then `stopped` or `outcome unknown` — the panel does not claim a
   cancellation it cannot confirm.

8. **Close and reopen.** Close the browser, reopen it, and continue the same
   conversation. Observe: the conversation and its history are there, the
   activity trace is intact, and the turn continues the **same** runtime
   session — the transcript names that session. Then restart the worker
   during a controlled run and observe the turn reconciled, or held unknown,
   with no duplicated side effect.

9. **Attach a file and inspect the result.** Attach a file or image in the
   composer. Observe: the runtime received it, and the output preview shows
   what the runtime produced, with provenance.

10. **Reopen the persisted history.** Reopen the room after a full reload.
    Observe: the messages, the tool activity and the result references are
    all still there, and still point at the same session.

## Contract

- **The same interface.** The UI, the API and the persistence are the ones
  SPEC-R1-1 demonstrated. Nothing in the client branches on the runtime.
- **The ACP surface is a client of ACP.** The adapter speaks the protocol
  OpenCode publishes, through a maintained client where one exists — not a
  reinterpretation of it.
- **The runtime's own event stream is read, not invented.** The adapter
  emits only events it can genuinely observe.
- **Differences are stated, not smoothed over.** Where OpenCode exposes less
  than the chat baseline, the capability row says which, the panel explains
  it, and the record keeps the difference visible. The baseline is a floor,
  not a claim of parity.
- **The version is pinned and recorded.** The demonstration names the version
  it ran against.
- **A capability row is a promise the adapter keeps.** The row is published
  from what the adapter does, not from what the runtime might do.

## Gate

A shipped check that the runtime answers **through the product's adapter**:
`scripts/verify-runtime.ts` runs against the installed runtime and fails
when the handshake does not answer or the turn produces no answer. The check
is marked so that CI can require it only on a machine that has the runtime
installed, and it is skipped — loudly, with the reason printed — everywhere
else.

A second shipped check holds the capability row's promise: every capability a
preset publishes is one the adapter actually surfaces. An adapter that
publishes `approvals` and then declines every peer request is a failing
gate.

## Acceptance

The owner, in the web chat, against OpenCode 1.19.4:

1. Connect, select a project and begin a conversation.
2. Ask for a small file or code change. Observe streaming text, native tool
   activity and an inspectable output or diff with provenance.
3. Send a follow-up during the work. Demonstrate steering where the runtime
   supports it and visible queueing where it does not.
4. Resolve a real permission request or user question in the conversation,
   or demonstrate the documented limitation and the alternative.
5. Stop a run, and show its confirmed state or the uncertain remote outcome.
6. Close and reopen the browser, and continue the same conversation and
   session. Restart the worker during a controlled run, and reconcile it or
   hold it unknown without a duplicate side effect.
7. Attach a file or image and inspect an output preview where supported.
8. Reopen the persisted history with its tool and result references intact.

And, for the product as a whole:

- Adding the OpenCode adapter changed **no** conversation storage and **no**
  task-provider logic. That is the acceptance the roadmap states for R2, and
  it is asserted by the diff, not by intent.

Item 4 is **not** reachable on the ACP route as it stands: the adapter
declines every peer request, so the runtime's question never reaches the
owner. The acceptance is met when the request crosses, or when the
transcript demonstrates the limitation and the alternative and says plainly
that it did.

## Evidence

A demonstration transcript, committed with the slice, that names the runtime
and its version (`1.19.4`), the commands that were run, the output that was
produced, and the limits that remained.

It is committed at **`docs/demonstration-opencode-2026-10-23.md`** — a dated
document beside the other evidence in `docs/`, in Markdown, so a reviewer can
read the run without running anything. It contains, in this order:

1. **The adapter run.** The full output of
   `npx tsx scripts/verify-runtime.ts --preset opencode-acp`, including the
   capability rows the handshake returned and the command line the adapter
   ran.
2. **The owner's run.** The numbered steps of the procedure above, what was
   observed at each step, and the event-stream excerpt for the turn — the
   `message.created`, `execution.event` and `tool.started` / `tool.completed`
   records, as the transcript read them.
3. **The permission request.** The runtime's request, the owner's decision,
   and the runtime's answer — or, if the request never crossed, the refusal
   the adapter returned, verbatim.
4. **The limits.** Every capability the acceptance asked for that the runtime
   did not provide, each with the reason and the supported alternative.
5. **The version and the credential.** `1.19.4`, the date of the run, and
   whether the run used a free model or a credentialed one.

The acceptance commands, run on the delivered revision:

```
npm run format:check
npm run typecheck
npm run test
npm run test:e2e
npm run smoke
npm run gates
```

The repository's gates pass on the delivered revision, and the browser suite
passes against the built client.

## Limits

Stated plainly, because the baseline asks for a floor and a floor is not a
parity claim.

- **OpenCode asks; the adapter declines.** The runtime has a permission model
  — `opencode --auto` exists to auto-approve permissions that are not
  explicitly denied, which is only meaningful if the runtime asks when they
  are. The product's ACP adapter answers every peer request with _"This
  Personal OS adapter does not grant client-side capabilities."_ **The
  supported alternative** is the product's own approval: the request becomes
  an approval in the room's waiting list, the owner decides there, and the
  decision is sent back — the worker already carries `resume.decision` and
  `resume.externalSessionId` for a turn suspended on one.
- **The ACP route sends text only.** The adapter's prompt is a single
  `type: 'text'` block. OpenCode's capabilities include images; the
  attachment does not cross until the content parts do.
- **The ACP route can continue a session, and the capability is the
  runtime's.** `persistentSessions` is read from the runtime's own
  `loadSession` capability, and `session/load` is how a turn resumes. This is
  a capability OpenCode has and Codex's command line route does not.
- **The command line route is not the demonstration.** `opencode run` exists
  and can emit JSON (`--format json`), but `docs/adapters.md` names ACP for
  client integration, and the ACP route is the one that carries the lifecycle.
  `opencode serve` is the native HTTP surface, which is R2's business.
- **Zero credentials is enough for the free models and nothing more.** The
  demonstration runs against a free model with no provider credential. A
  credentialed model is a separate observation, and the transcript says which
  one it saw.

## Not in scope

- Changing the chat interface to suit OpenCode. The interface is the
  product; the runtime is an adapter.
- Pi, Hermes and OpenClaw. They have their own specs.
- The factory, the goals board and the dashboards.
- An externally hosted agent connection. R2 asks for one; this spec is about
  a local runtime.
