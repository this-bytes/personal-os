# Runtime integration matrix

**Research baseline:** upstream documentation checked on 2026-10-22. These are
integration candidates, not a claim that Personal OS supports their native
lifecycles today. Pin actual runtime/protocol versions and rerun the demonstrations
before marking a row verified. Upstream main can change independently of this repo.

All five runtimes are approved targets. Codex/OpenCode prove R1; Pi/Hermes/OpenClaw
follow in R2. Provider-specific code stays behind the shared adapter contract.

| Runtime  | Candidate supported interface                                                                | What implementation must verify                                                                                                                                                                                     | Personal OS delivery status                                                                                                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex    | Native App Server, or a maintained ACP bridge where it preserves the required behavior.      | Bidirectional thread/turn lifecycle, session continuation, streamed items, permissions/input, interruption, auth and exact transport/version. Prefer the native surface when a bridge loses necessary capabilities. | Target; no named native integration demonstrated by this recovery.                                                                                                                                                                                                                                                                                                      |
| OpenCode | ACP for client integration; native HTTP server/OpenAPI and SSE for remotely hosted sessions. | Sessions/messages, event correlation, permissions, abort, reconnect/log recovery and authenticated remote access.                                                                                                   | **ACP surface demonstrated against OpenCode 1.19.4 on 2026-10-24**: the handshake answered, a turn streamed back through the adapter, the runtime's own permission request reached the owner and the owner's decision answered it, and every later turn continued the same session. The native HTTP server still needs implementation and testing.                      |
| Pi       | Native long-lived JSONL RPC subprocess; SDK only if lifecycle/isolation remains appropriate. | Prompt handling versus settled execution, steering/follow-up queues, abort, persistent session selection and extension UI requests. Approval behavior depends on the runtime/extensions.                            | **The Pi route is implemented**: the product speaks Pi's own RPC protocol — the streaming text, the tools it ran, the end of the turn, the session the next turn continues, a steer that arrives while Pi works, and a picture that crosses as bytes. It is proved against the repository's own double of Pi; the demonstration against an installed Pi is outstanding. |
| Hermes   | ACP or its programmatic gateway; native HTTP run API is a remote candidate.                  | Durable run ids, streamed events, permission resolution, steer/stop, session continuity, authentication and supported version.                                                                                      | **ACP surface demonstrated against Hermes 0.21.0 on 2026-10-23**: the handshake answered, and one turn completed with the runtime's own answer, through the product's own adapter. The HTTP run API still needs implementation and testing.                                                                                                                             |
| OpenClaw | Gateway WebSocket protocol, or supported ACP bridge.                                         | Gateway handshake/auth/scopes, sessions, events, approvals, cancellation and remote reconciliation. HTTP tool invocation alone is not the full lifecycle.                                                           | Target; do not claim generic HTTP feature parity.                                                                                                                                                                                                                                                                                                                       |

**What the Hermes demonstration does and does not cover.** It covers the
handshake — the runtime's own capabilities, including that it can restore a
session — and one turn, streamed back through the adapter. It does not yet
cover steer and stop against a live Hermes turn, a permission request
answered from the panel, or the durable run ids the HTTP surface carries.
**The credential that made the turn possible was short-lived**, so the
demonstration is dated rather than standing, and the preset's evidence says
so.

## Adapter types and their session limits

Personal OS reaches a runtime through an adapter, and each adapter type has a
different answer to one question: **does the runtime keep a session that the
next turn in the same conversation can go back into?**

The answer decides whether a conversation's turn continues the last one or
starts a new one. The product does not guess: a connection that reports
persistent sessions is continued, and a connection that does not is recorded as
keeping no session, so nothing claims a continuity that does not exist.

**The column "Verified against" names the version the claim was checked
against.** A row whose runtime version changes is a row whose claim has to be
checked again, and the date says when it last was.

| Adapter type       | Runtime it speaks to           | Session continuity                                                                                                                           | After a restart                           | Verified against                                                                |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `acp`              | Any ACP agent                  | resumable — the ACP session id names the session and `session/load` puts the agent back into it                                              | no — an uncertain run waits for the owner | Hermes 0.21.0, 2026-10-23; OpenCode 1.19.4, 2026-10-24                          |
| `codex`            | The Codex CLI                  | fresh unless the connection is not ephemeral — Codex then keeps its session on disk, and the App Server transport is what re-enters it       | no — an uncertain run waits for the owner | codex-cli 0.163.0, 2026-10-23                                                   |
| `codex-app-server` | The Codex App Server           | resumable unless the connection is ephemeral — the App Server's thread id names the session, and `thread/resume` puts the agent back into it | no — an uncertain run waits for the owner | codex-app-server 0.163.0, 2026-10-24                                            |
| `pi`               | Pi, as its own RPC session     | resumable unless the connection is ephemeral — Pi's session is the file it keeps, and `switch_session` puts the agent back into it           | no — an uncertain run waits for the owner | Pi protocol 1.4.0 (published), 2026-10-25; the installed runtime is outstanding |
| `mcp`              | An MCP server                  | fresh — an MCP session belongs to the connection, not to the conversation's turn                                                             | no — an uncertain run waits for the owner | MCP SDK 1.32.1, 2026-10-23                                                      |
| `cli`              | A command-line agent           | fresh — the process ends with the turn, and the next turn is a new session-less process                                                      | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23                                                |
| `http`             | A gateway over HTTP            | fresh — the request carries the turn and the gateway is not asked to remember the session                                                    | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23                                                |
| `a2a`              | An agent-to-agent orchestrator | fresh — the orchestrator's task id names a task, and a task is not claimed as a session                                                      | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23                                                |
| `model`            | A model API                    | fresh — a model call has no session                                                                                                          | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23                                                |
| `echo`             | The built-in local test agent  | fresh unless the agent is asked to ask — a turn that asked keeps the session it asked in, so the answer can be its next input                | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23                                                |

**The column says what the adapter reports.** A row names the answer the
adapter gives for a connection as it is configured, and a row that says
"fresh unless …" names the condition under which the answer changes. Whether a
runtime can really be put back into its session is a separate question, and
the demonstration specs are where it is measured with the runtime in front of
us.

**The column "After a restart" names what the runtime can be asked.** After a
worker dies, the product may ask the runtime what became of the run it was
working on. A runtime that can answer says so, and the run is reconnected. A
runtime that cannot is not asked, and the outcome is uncertain — the owner
settles it. **No runtime the product ships today can be asked**, so every
uncertain run waits for the owner; a runtime that gains the ability changes its
row.

**What "fresh" costs.** A conversation whose agent is `fresh` still holds a
history, and the next turn still reads it. What it does not get is the
runtime's own memory of the conversation: the agent is handed the room's
history, not resumed into the runtime's session. The capability row says which
of the two the owner has.

**What "resumable" claims.** It claims one thing: the next turn in the same
conversation goes back into the same runtime session, and the transcript names
that session so a reader can tell one session's answer from another's.

### What the ACP route carries

The ACP route is the one this repository has exercised against an installed
runtime, so what it carries is written down here rather than left to the
capability row alone.

| Capability          | The ACP route | What that means                                                                                                                                                                     |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission requests | supported     | The runtime's own `session/request_permission` reaches the owner as the product's approval, and the owner's decision answers the runtime.                                           |
| Tool activity       | supported     | The runtime's own `tool_call` and `tool_call_update` notifications become the product's tool events, so the room's timeline shows the files the agent read and the commands it ran. |
| Artifacts           | not supported | The route makes no resource of anything it carries.                                                                                                                                 |
| Input files         | supported     | A file the owner attached is sent as the protocol's own `resource` block, with the content in it.                                                                                   |
| Input images        | supported     | A picture the owner attached is sent as the protocol's own `image` block, with the bytes in it.                                                                                     |
| Steering            | not supported | The runtime does not advertise `acceptsSteering`, so a follow-up is queued for the next turn and the panel says so.                                                                 |

**The ACP route carries the runtime's tool activity.** The protocol reports what
the agent is doing as `session/update` notifications — a `tool_call` that
announces the call, and `tool_call_update`s that carry it to its end — and the
route turns them into the product's tool events. The room's timeline shows the
files the agent read and the commands it ran, while the turn runs.

A call is one row, however much the runtime streamed for it: the updates in
between are the same call saying more about itself, and only its end is news
after its start. The tool's name is the product's word for the action — a
command is a `command` on this route too — and a kind that is not an action at
all, like a thought, is not an action the room is shown.

**A turn's work is the turn's own.** A session that is loaded is replayed: the
runtime sends the session's earlier messages, answers and calls, so a client can
restore its view of it. The route reads the runtime's updates only once the
turn's prompt has been sent, so the session's history stays out of the turn
that resumed it — the room's answer is the answer to what was just asked, and
the timeline is a record of this turn.

**A picture travels as bytes, and the bytes travel.** A file's content is text
and a picture's content is not, so the two travel on two capabilities and in two
kinds of part. The ACP route sends the protocol's own `image` block; the Codex
App Server route sends the bytes as an image by url — a data url, and not a
local image by path, because a path is a path on the runtime's machine and this
picture is not on it.

**The ACP route sends the message's parts.** The protocol's prompt is a list of
content blocks, and a file the owner attached is one of them: a `resource`
block, whose `uri` names the file and whose text is the file's content. The
runtime turns that into a part the model reads — `[<uri>] | <text>` — which is
what "the agent sees the file" means on this route.

**Images are carried now.** The part carries a picture's bytes as an image block,
with the bytes in it, and the route says so in its capability row: a route that
takes a file's words is not thereby a route that takes a picture's bytes, and
`acceptsImages` is absent when a route cannot. See
`docs/demonstration-content-images-2026-10-25.md`.

**What is proved where.** The permission path is proved twice: by
`scripts/verify-acp-permissions.ts`, which drives the built adapter against an
agent that speaks the protocol, and by the demonstration against the installed
runtime, `docs/demonstration-opencode-2026-10-24.md`, where the runtime's own
edit request reached the waiting list, the owner approved it, and the operation
happened. The attachment path is proved three times: by
`scripts/verify-content-parts.ts`, which drives the built adapter against an
agent that speaks the protocol and checks the prompt the runtime received; by
`docs/demonstration-codex-2026-10-24.md`, which recorded the gap before it was
closed; and by `docs/demonstration-content-parts-2026-10-24.md`, where the
owner attached a file to the installed OpenCode and the agent answered with
the file's exact content. The tool activity path is proved twice: by
`scripts/verify-acp-tool-activity.ts`, which drives the built adapter against
an agent that speaks the protocol and checks the events the turn produced, and
by `docs/demonstration-acp-tool-activity-2026-10-25.md`, where the installed
OpenCode's own tool calls showed up in the room's timeline.

### What the Codex App Server route carries

The App Server's pinned protocol takes a text item, an image by url or by file
id, a local image by path, an audio by url and a local audio by path. **It has
no item for "a file with its content"**, so a file the owner attached goes in a
text item that names the file and carries its content. That is the honest
mapping: the route says it carries the content, and the content is what the
runtime receives.

**A picture has an item of its own, and the route carries the bytes in it.** The
image goes in as an image by url, with the bytes as a data url — and not as a
local image by path, because a path is a path on the runtime's machine and this
picture is not on it. Both shapes were measured against the installed runtime,
and both were taken; the path was not, for that reason. See
`docs/demonstration-content-images-2026-10-25.md`.

The route carries a steer — the runtime's own `turn/steer`, addressed to the
turn that is running — and it asks the owner for permission, which the adapter
surfaces as the product's approval. `scripts/verify-codex-app-server.ts` proves
that against the repository's own App Server double.

**A turn’s work is what arrives after the prompt.** The App Server’s session is
a thread, and a thread that is resumed is the runtime’s own history. The
installed App Server 0.163.0 replays nothing when a thread is resumed: the
resume sends nothing, the second turn’s answer is its own, and the runtime kept
its own memory of the first turn. The App Server deprecated full-history
hydration for paginated threads, so a runtime that hydrates a long thread may
hand that history back, and a promise that holds only on the version that
happens to keep it is not a promise. The route reads the runtime’s
notifications only once the turn’s prompt has been sent, and only those that
name the turn it started, so the thread’s history stays out of the turn that
resumed it: the room’s answer is the answer to what was just asked, and the
timeline is a record of this turn. `scripts/verify-two-turns.ts` proves it
against the repository’s own App Server double, in both shapes a replay takes.

**What is proved where.** The route is proved by
`scripts/verify-codex-app-server.ts` — the thread, the turn, the steer, the
approval, and the session continuing in the same thread — and by
`scripts/verify-two-turns.ts` for the turn’s own work, against a runtime that
hands the thread’s history back.

### What the Pi route carries

**Pi is not the command line route.** The generic `cli` adapter starts a
process and writes the prompt to it. Pi’s own protocol carries more than a
prompt — the streaming text, the tools it ran, whether it has settled, the
session it is in, and a steer that arrives while it works — so Pi has its own
route, written against its own protocol: the JSONL records it writes to
standard input and reads from standard output. The protocol is published, and
the pinned version this route is written against is **1.4.0**.

**The protocol’s own rules are the route’s rules.** Pi frames its records as
strict JSONL: one object per line, split on LF only, because a record may hold
the Unicode line and paragraph separators that a generic line reader would
treat as a boundary. The route reads them that way, and the double in
`packages/agent-adapters/src/__tests__/fixtures/fake-pi.mjs` does too — a
double that framed records differently would be proving a protocol Pi does not
speak.

**What the route carries.**

| Pi’s own record                    | The product’s event                        |
| ---------------------------------- | ------------------------------------------ |
| `message_update` with a text delta | the answer, as it streams                  |
| `message_end` with the assistant   | the finished answer, from Pi’s own message |
| `tool_execution_start`             | a call the runtime made                    |
| `tool_execution_end`               | that call, finished                        |
| `agent_settled`                    | the end of the turn                        |
| the `prompt` command               | the turn’s question                        |
| the `prompt` response, handled     | the end of the turn, with no run           |
| the `steer` command                | the owner’s message, while Pi is working   |
| the `abort` command                | the owner’s stop                           |
| `get_state` and `switch_session`   | the session, and the next turn’s session   |

**A picture crosses as bytes.** Pi’s prompt takes images, and its image is the
same shape the ACP route already sends: `{type: 'image', data, mimeType}`. A
file the owner attached has no shape of its own in Pi — a prompt is a message,
and a message is text — so the file’s content goes in the message, and the
route says so.

**A prompt Pi handled itself ends the turn at once.** Pi answers a prompt with
a record that says whether the prompt was accepted, queued or handled, and a
prompt it _handled_ starts no run — so there is no `agent_settled` to wait for,
and a turn that waited for one would never end. The disposition is in the
answer to the command, not among the session’s events, and the route reads it
there.

**The session is the file Pi keeps.** Pi’s session is a file, and
`switch_session` takes the path, so the path is what the execution publishes as
its session reference — the way the App Server’s thread id is. The next turn in
the same conversation resumes that session through the runtime, so the runtime
keeps its own memory of the conversation.

**What the route does not carry, plainly.** Pi’s extension questions — the
`extension_ui_request` records an extension sends when it needs the user — are
not carried on this route, so the capability row says the route cannot ask the
owner for permission. Pi’s compaction and retry records are not carried either:
the room shows the work, and a retry is the runtime’s own business.

`scripts/verify-pi-route.ts` proves the route against the repository’s own
double of Pi: the answer, the tools, the end of the turn, the session the next
turn continues, a steer that arrives while Pi works, and a picture that crosses
as bytes. **The demonstration against an installed Pi is outstanding** — Pi is
not installed in this repository, and a double is not a runtime.

## Common capability record

For each pinned integration record supported/unsupported/unknown and evidence for:
streaming; session continuation; reconnect/reconcile; tool activity; file/diff
outputs; input files/images; previews; permission requests; user questions;
steering; follow-up queueing; cancellation; session fork; usage/cost telemetry.

This is a target test matrix, not a replacement for the current published capability
schema. Extend packages/contracts additively when implementing richer support.
An unknown capability is never advertised as supported. Session fork is useful but
not a prerequisite for the agreed initial rich-chat checklist.

Authentication, protocol negotiation and native transport details belong to the
adapter. HTTP is a transport, not a universal request/response schema. MCP tool
exposure, ACP client interaction and agent-to-agent delegation have different jobs.
Use the existing queue and lifecycle; do not build a new remote harness service to
make every backend look like an HTTP chatbot.

Keep useful native events as bounded, redacted metadata alongside normalized domain
events. Do not store credentials, unrestricted native logs or hidden reasoning by
default. Only observable, appropriate user-facing activity is rendered.

## Primary sources and what to borrow

- [Codex App Server](https://github.com/openai/codex/tree/main/codex-rs/app-server):
  native application integration. Evaluate the versioned API and generated schemas
  rather than scraping terminal presentation.
- [OpenCode server](https://opencode.ai/docs/server/) and
  [ACP support](https://opencode.ai/docs/acp/): native HTTP API/event stream and
  portable client interaction. The server docs publish an OpenAPI surface.
- [Pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md):
  structured command responses and events; a prompt response need not mean all work
  is settled. The former badlogic/pi-mono URL redirects to this repository.
- [Hermes programmatic integration](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md):
  ACP, gateway and HTTP interfaces. Choose the surface that exposes needed lifecycle
  operations, not just chat-completion text.
- [OpenClaw Gateway](https://github.com/openclaw/openclaw/blob/main/docs/gateway/protocol.md)
  and [ACP bridge](https://github.com/openclaw/openclaw/blob/main/docs/cli/acp.md):
  remote control plane and client bridge, with gateway authority retained.
- [ACP TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk):
  evaluate the maintained protocol implementation instead of extending handwritten
  framing/handshake code without a demonstrated need.
- [Zed external agents](https://zed.dev/docs/ai/external-agents): a cohesive host UI
  with independent agent runtimes. Borrow the separation, not the entire editor.
- [MiniMax Code MiniApps](https://github.com/MiniMax-AI/MiniMax-Code-MiniApps):
  the Bot catalog describes configurable teams, group mentions, memory and
  scheduled work. Use observable behavior as inspiration; neither that catalog nor
  the public CLI proves the private desktop host's internal implementation.

These are source readings, not a comprehensive license audit or production
compatibility certification. Review the exact dependency/version/license when an
implementation adds a library or reuses code. Do not embed an upstream product to
avoid implementing Personal OS's own contracts.
