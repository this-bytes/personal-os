# SPEC-R1-1 — The owner completes real work against a real, installed Codex runtime

**State:** open · **Owner:** implementing agent, with the owner driving the demonstration · **Verifier:** independent reviewer against this spec and the roadmap's release criteria
**Depends on:** SPEC-R0-1, SPEC-R0-3, SPEC-R0-4 · **Adapter:** `packages/agent-adapters/src/codex.ts`

## Outcome

The owner completes real work in the web chat against a **real, installed
Codex runtime** — the same conversation, the same panel, the same answer —
and the transcript of that session is the evidence.

This is the acceptance the chat-first recovery named, and the repository's
own record of the requirement is explicit:

> The Echo agent, `fake-codex-agent.mjs` fixtures and protocol replays are
> tests, not evidence. The evidence is a demonstration transcript naming the
> runtime version, the commands run, the output produced and the limits that
> remained. A fixture run labelled as a real-runtime proof fails review.

The fixture is a test. The demonstration is the proof.

## The runtime is installed

Measured on this machine, not assumed:

```
codex --version   →  codex-cli 0.163.0
```

`docs/roadmap.md` says the same, and says it measured rather than assumed:
"**Two more of the approved runtimes are installed here** — `codex --version`
reports `codex-cli 0.163.0` and `opencode --version` reports `1.19.4`, with
Hermes at `C:\Users\Aaron\AppData\Local\hermes\bin\hermes.exe`." That line was
corrected on 2026-10-23, before this spec was written.

What is still missing is not the install. An installed runtime is not a
demonstrated one, and this spec is what makes the difference for Codex.

## Preconditions

Every fact below was measured on this machine on 2026-10-23. The commands and
their output are recorded so a reviewer can re-measure them.

### The runtime and where it lives

```
Get-Command codex
```

```
Name       CommandType     Source
----       -----------     ------
codex.ps1  ExternalScript  C:\Users\Aaron\AppData\Roaming\npm\codex.ps1
```

The shim is npm's. What it runs is:

```
Get-Content C:\Users\Aaron\AppData\Roaming\npm\codex.ps1 | Select-String 'codex.js'
```

```
& "$basedir/node$exe"  "$basedir/node_modules/@openai/codex/bin/codex.js" $args
```

So the real entry point is
`C:\Users\Aaron\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js`
— a **Node script**, not a native binary. The package is `@openai/codex`
v0.163.0. A spawner that resolves `codex` on Windows therefore has to survive
the `.cmd` shim; `packages/agent-adapters/src/util.ts`'s `spawnExecutable`
is what does that today, and the demonstration uses it rather than a new path.

### The version and the signed-in account

```
codex --version
codex login status
```

```
codex-cli 0.163.0
Logged in using ChatGPT
```

`codex login status` exits 0. The credential lives in Codex, not in Personal
OS: the panel never holds it, and the transcript never shows it.

### The non-interactive surface

```
codex exec --help
```

```
  exec              Run Codex non-interactively [aliases: e]
  ...
  -i, --image <FILE>...        Images to attach to the initial prompt
  -C, --cd <DIR>               Tell the agent to use the specified directory as its working root
  -s, --sandbox <SANDBOX_MODE> Select the sandbox policy to use when executing model-generated shell commands
      --approve-for-me         Route approval requests through automatic review using the workspace-write sandbox
      --dangerously-bypass-approvals-and-sandbox
                                Skip all confirmation prompts and execute commands without sandboxing. EXTREMELY
                                DANGEROUS. Intended solely for running in environments that are externally sandboxed
      --skip-git-repo-check    Allow running Codex outside a Git repository
      --ephemeral              Run without persisting session files to disk
      --output-schema <FILE>   Path to a JSON Schema file describing the model's final response shape
      --json                   Print events to stdout as JSONL
  -o, --output-last-message <FILE>
                                Specifies file where the last message from the agent should be written
```

`codex exec` is the non-interactive route: the prompt goes in on standard
input (the argument `-` says so), and `--json` makes the runtime a stream of
JSONL events rather than a wall of text. `--sandbox` is the boundary the
owner chooses for the agent's own commands.

Two more of its subcommands, measured, because they bear on what the route
can and cannot do:

```
codex exec resume --help
```

```
Resume a previous session by id or pick the most recent with --last

Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]

Arguments:
  [SESSION_ID]
          Conversation/session id (UUID) or thread name. UUIDs take precedence if it parses. If
          omitted, use --last to pick the most recent recorded session
```

`codex exec resume` can re-enter a recorded session. It can only re-enter
one that was recorded, which `--ephemeral` is defined not to do.

And the approval policy that the non-interactive route does **not** carry:

```
codex --help
```

```
  -a, --ask-for-approval <APPROVAL_POLICY>
```

That flag belongs to the interactive CLI. `codex exec --help` does not list
it — the exec route offers `--approve-for-me` and
`--dangerously-bypass-approvals-and-sandbox` instead, and neither of those
asks the owner anything.

### The approved surface, and the one this spec must reach

`docs/adapters.md` names the surface Codex is to be integrated through:

> Codex | Native App Server, or a maintained ACP bridge where it preserves the
> required behavior. | Bidirectional thread/turn lifecycle, session
> continuation, streamed items, permissions/input, interruption, auth and exact
> transport/version. Prefer the native surface when a bridge loses necessary
> capabilities.

That surface is measured too:

```
codex --help
```

```
Commands:
  agents            Browse all agent sessions on the shared local app-server daemon
  exec              Run Codex non-interactively [aliases: e]
  ...
  app-server        [experimental] Run the app server or related tooling
```

```
codex app-server --help
```

```
  --listen <URL>
          Transport endpoint URL. Supported values: `stdio://` (default), `unix://`, `unix://PATH`,
          `ws://IP:PORT`, `off`

          [default: stdio://]

      --stdio
          Use stdio as the transport (equivalent to `--listen stdio://`)
```

```
codex app-server generate-json-schema --help
codex app-server generate-ts --help
```

Both exist. `docs/adapters.md` asks the integration to _"evaluate the versioned
API and generated schemas rather than scraping terminal presentation"_, and
these two subcommands are how the protocol is pinned to the version that
produced it.

**Codex 0.163.0 publishes no `acp` entry point.** `codex --help` lists no
`acp` subcommand, so the ACP route that OpenCode uses is not available to
Codex, and no bridge may be assumed.

### What the demonstration needs from the environment

- `codex` on `PATH`, or the absolute path to
  `…\node_modules\@openai\codex\bin\codex.js` in the connection's `command`.
- A signed-in Codex account on that machine (`codex login status` answers).
- A project directory the agent may work in, passed as the connection's
  `cwd`. The demonstration uses a scratch directory it owns, not the
  repository itself.
- Nothing else. The runtime brings its own credential; the panel holds none.

## The path

### The path today

```
apps/web  →  POST /api/conversations/:id/messages
          →  apps/worker/src/executor.ts  executeChatTurn()
          →  packages/agent-adapters/src/codex.ts   CodexAdapter.send()
          →  packages/agent-adapters/src/util.ts     spawnExecutable()
          →  codex exec --json --sandbox <mode> …
          →  JSONL on stdout → the adapter's AgentEvent stream
          →  the worker's events → GET /api/events → the panel's trace
```

The adapter builds its own argument line, and the panel shows it:

```
packages/agent-adapters/src/codex.ts
  private buildArgs(): string[] {
    const args = [...this.config.args, 'exec'];
    args.push('--json');
    args.push('--sandbox', this.config.sandbox);
    if (this.config.skipGitRepoCheck) args.push('--skip-git-repo-check');
    if (this.config.ephemeral) args.push('--ephemeral');
    if (this.config.model) args.push('--model', this.config.model);
    if (this.config.cwd) args.push('--cd', this.config.cwd);
    // `-` says the prompt is on standard input, which is where the adapter
    // writes it.
    args.push('-');
    return args;
  }
```

`describeCommand()` returns that line, so the owner sees the real command
rather than a paraphrase of it.

### The gap this spec closes

**The repository has no App Server adapter.** The only Codex adapter runs
`codex exec`, and `codex exec` is the command line route — not the surface
`docs/adapters.md` approves for Codex, and not one that can carry the
capabilities the acceptance asks for.

What the `codex exec` route can and cannot do, from the code and from the
runtime's own help:

| Acceptance item                                     | `codex exec` route   | Why                                                                                                                                                            |
| --------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 connect and begin a conversation                  | reachable            | the adapter spawns the runtime and the worker runs the turn                                                                                                    |
| 2 streaming text and native tool activity           | reachable            | `--json` emits `item.completed` for `command_execution`, `file_change`, `mcp_tool_call` and `web_search`; the adapter maps them to the product's events        |
| 3 steer during the work                             | not from the runtime | `codex exec` has no steer operation; the product's `steer` delivery can only reach an adapter that accepts it                                                  |
| 4 permission request answered by the owner          | **not reachable**    | `codex exec` has no `--ask-for-approval`; the adapter reports `approvals: false`                                                                               |
| 5 stop a run                                        | reachable            | the adapter kills the child; the panel says `stop requested`, not `stopped`                                                                                    |
| 6 continue the same session after a browser restart | **not reachable**    | the `codex-cli` preset is `ephemeral: true`, so `codex exec --ephemeral` runs _"without persisting session files to disk"_ and `persistentSessions` is `false` |
| 7 attach a file or image                            | **not reachable**    | `codex exec` accepts `-i/--image`, but the adapter builds a text prompt only and never passes the owner's attachments                                          |
| 8 reopen the persisted history                      | reachable            | the product persists the turn and its activity                                                                                                                 |

So the demonstration is **not** a matter of running the existing adapter
harder. Items 4, 6 and 7 need a transport that can hold a thread, ask the
owner a question and carry an attachment. The App Server is the surface
`docs/adapters.md` names for exactly that.

### What the demonstration must add

- **A pinned protocol.** The App Server's schema for the version that ran,
  produced by `codex app-server generate-json-schema`, committed as the
  evidence artifact's first section.
- **A transport.** A JSON-RPC stdio client for the App Server. The repository
  has the shape of one in `packages/agent-adapters/src/jsonrpc.ts`, but that
  client is **ACP-shaped**: it sends `initialize` with `protocolVersion` and
  `clientCapabilities`, which is the ACP handshake, not the App Server's. It
  is a starting point, not a component to reuse unchanged.
- **A thread and turn mapping.** The App Server's thread lifecycle becomes the
  product's `AgentTurnInput` and `AgentEvent` stream, so the worker's
  `executeChatTurn()` path is unchanged and the runtime is still an adapter.
- **The approval request.** The App Server's approval request becomes the
  product's approval, answered by the owner through the waiting list
  (`POST /api/approvals/:id/decide`) and resumed through the
  `externalSessionId` the worker already carries.
- **The session reference.** SPEC-R0-3's durable reference, so a second turn
  continues the same thread rather than starting a new one.

Until those exist, the honest statement is: _the runtime answers a turn; it
does not yet answer with a thread it can continue, ask the owner a question,
or receive an attachment._

### One thing to settle in the transcript

The `codex-cli` preset is already marked `verified: true`, with evidence that
names _"a thread and a turn started, the agent message and the command it ran
came back as events"_. `thread` is App Server vocabulary; the preset's
configuration is the `codex exec` route. The demonstration names the surface
it actually ran on, and the preset's evidence is corrected to match.

## Procedure

The owner drives this. The numbers are the steps; each one says what the
owner does and what they observe.

1. **Prove the runtime answers through the product's own adapter first.**
   Run, from the repository root:

   ```
   npx tsx scripts/verify-runtime.ts --preset codex-cli --probe-only
   npx tsx scripts/verify-runtime.ts --preset codex-cli --prompt "what can you do?"
   ```

   Observe: the handshake answers and prints the capability rows; the command
   line the adapter will really run is printed; the turn returns the runtime's
   own answer. This is `packages/agent-adapters/src/codex.ts`'s `connect()`
   and `send()` — the same two calls the server and the worker make.

2. **Connect the runtime in the panel.** Open **Agents → Add an agent
   connection**. In the _Template_ dropdown choose the Codex template; set
   the name and the project directory Codex should work in; save. The server
   probes the connection on save and reports the real capabilities beside it
   (`apps/web/src/components/AgentConnectionForm.tsx`). Observe: the
   connection appears with the capabilities the runtime actually reported —
   not the ones the template hoped for.

3. **Begin a conversation.** Open a room and add the connection as a
   participant. Observe: the participant is listed in the room's team.

4. **Ask for a small change.** In the composer, address the agent and ask
   for a small file or code change in the scratch directory. Observe: text
   arrives in pieces, and the **Activity timeline** (`ActivityTimeline.tsx`)
   shows the runtime's own tool activity beside its answer — the command it
   ran, the file it changed — each marked with the adapter that produced it.

5. **Follow up while the work runs.** Switch the composer's delivery to
   **steer** (`RunControls.tsx`) and send a second message. Observe: the
   steer reaches the turn that is running, or the control says it is not
   supported. The panel distinguishes what was received from what was
   submitted; a greyed-out control with no reason is a defect.

6. **Answer a permission request.** Observe: the request appears in the
   room's waiting list and the owner answers it. Where Codex raises none on
   the surface in use, observe the **documented limitation** instead — the
   limitation is demonstrated and recorded, not skipped.

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

- **One interface, no provider branches.** The same UI, API and persistence
  flow serves Codex and OpenCode. Runtime-specific behaviour stays in the
  adapter.
- **The runtime version is pinned and recorded.** The demonstration names the
  version it ran against, and the adapter matrix records what was verified
  against it.
- **Nothing is claimed that was not observed.** Where Codex does not expose a
  capability the baseline needs — an in-conversation permission question, for
  instance — the product says so and offers the supported alternative. A
  fabricated request is not evidence of runtime support.
- **Credentials stay out of the transcript and the logs.** A shared transcript
  is Personal OS's; private native context belongs to the harness.
- **The surface is named.** The transcript says whether the run was the App
  Server or the command line route, and the adapter matrix row agrees.
- **The pinned protocol is committed.** The App Server schema that the run
  was written against is in the repository, so the transcript can be read
  against the protocol version that produced it.

## Gate

A shipped check that the runtime answers **through the product's adapter**,
not through a fixture: `scripts/verify-runtime.ts` runs against the installed
runtime and fails when the handshake does not answer or the turn produces no
answer. The check is marked so that CI can require it only on a machine that
has the runtime installed, and it is skipped — loudly, with the reason
printed — everywhere else.

A second shipped check holds the claim the demonstration makes: the capability
row a preset publishes is the capability the adapter reports, and an adapter
that advertises `approvals` or `artifacts` must actually surface them. A
preset that claims a capability its adapter refuses is a failing gate.

## Acceptance

The owner, in the web chat, against Codex 0.163.0:

1. Connect, select a project and begin a conversation.
2. Ask for a small file or code change. Observe streaming text, native tool
   activity and an inspectable output or diff with provenance.
3. Send a follow-up during the work. Demonstrate steering where the runtime
   supports it and visible queueing where it does not, and distinguish
   received input from submitted input.
4. Resolve a real permission request or user question in the conversation.
   Where Codex exposes none, demonstrate the documented limitation and the
   alternative — and say plainly which happened.
5. Stop a run, and show its confirmed state or the uncertain remote outcome.
6. Close and reopen the browser, and continue the same conversation and
   session. Restart the worker during a controlled run, and reconcile it or
   hold it unknown without a duplicate side effect.
7. Attach a file or image and inspect an output preview where supported.
   Unsupported modalities have clear UI behaviour; Codex is not presented as
   image-capable without a real demonstration.
8. Reopen the persisted history with its tool and result references intact.

Items 4, 6 and 7 are **not** reachable on the `codex exec` route as it stands.
The acceptance is met when they are reached on the surface
`docs/adapters.md` approves, or when the transcript demonstrates the
limitation and the alternative for each one and says plainly that it did.

## Evidence

A demonstration transcript, committed with the slice, that names:

- the runtime and its version (`codex-cli 0.163.0`),
- the commands that were run,
- the output that was produced,
- the limits that remained.

It is committed at **`docs/demonstration-codex-2026-10-23.md`** — a dated
document beside the other evidence in `docs/`, in Markdown, so a reviewer can
read the run without running anything. It contains, in this order:

1. **The pinned protocol.** The App Server JSON Schema produced by
   `codex app-server generate-json-schema` for the version that ran, in the
   section the transcript names.
2. **The adapter run.** The full output of
   `npx tsx scripts/verify-runtime.ts --preset codex-cli`, including the
   capability rows and the command line the adapter ran.
3. **The owner's run.** The numbered steps of the procedure above, what was
   observed at each step, and the event-stream excerpt for the turn — the
   `message.created`, `execution.event` and `tool.started` / `tool.completed`
   records, as the transcript read them.
4. **The limits.** Every capability the acceptance asked for that the runtime
   did not provide, each with the reason and the supported alternative.
5. **The version and the revision.** `codex-cli 0.163.0`, the commit the run
   was made on, and the date of the run.

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

- **Codex exposes no in-conversation permission request on the command line
  route.** Codex does have an approval policy — the top-level interactive CLI
  carries `-a, --ask-for-approval <APPROVAL_POLICY>` — but the non-interactive
  route does not: `codex exec --help` offers no `--ask-for-approval`, only
  `--approve-for-me` (automatic review under the `workspace-write` sandbox)
  and `--dangerously-bypass-approvals-and-sandbox`. Neither is a question to
  the owner, and a policy for an interactive session is not a question a
  panel can answer. **The supported alternative** is the App Server route,
  where the runtime raises the request itself and the panel answers it
  through the product's approval. On the command line route the product must
  say the limit rather than show a control that cannot work.
- **The command line route cannot continue a session.** The `codex-cli`
  preset is `ephemeral: true`, so the runtime runs `--ephemeral` — _"without
  persisting session files to disk"_ — and `persistentSessions` is `false`.
  A second turn is a new runtime session. `codex exec resume` exists as a
  command, but the product does not call it, so nothing continues.
- **The command line route carries no attachment.** `codex exec` accepts
  `-i/--image <FILE>`, and the adapter builds a text prompt only. The
  runtime's capability is there; the adapter's is not.
- **The command line route cannot steer.** There is no steer operation in
  `codex exec`. The product's `steer` delivery reaches an adapter that
  accepts it, and this one does not.
- **Codex 0.163.0 has no `acp` entry point.** The ACP route OpenCode uses is
  not available to Codex. No bridge is assumed, and the App Server is the
  route.
- **The App Server is marked experimental by the runtime itself**
  (`[experimental] Run the app server or related tooling`). The version is
  pinned and the schema is committed, so an upstream change is visible rather
  than silent.

## Not in scope

- The Codex adapter itself, unless the demonstration shows it is wrong. A
  defect found here is fixed by its own slice.
- Pi, Hermes and OpenClaw. They have their own specs.
- The factory, the goals board and the dashboards.
- A feature that the demonstration does not need. The baseline is the work.
