# Runtime integration matrix

**Research baseline:** upstream documentation checked on 2026-10-22. These are
integration candidates, not a claim that Personal OS supports their native
lifecycles today. Pin actual runtime/protocol versions and rerun the demonstrations
before marking a row verified. Upstream main can change independently of this repo.

All five runtimes are approved targets. Codex/OpenCode prove R1; Pi/Hermes/OpenClaw
follow in R2. Provider-specific code stays behind the shared adapter contract.

| Runtime  | Candidate supported interface                                                                | What implementation must verify                                                                                                                                                                                     | Personal OS delivery status                                                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex    | Native App Server, or a maintained ACP bridge where it preserves the required behavior.      | Bidirectional thread/turn lifecycle, session continuation, streamed items, permissions/input, interruption, auth and exact transport/version. Prefer the native surface when a bridge loses necessary capabilities. | Target; no named native integration demonstrated by this recovery.                                                                                                                                                                          |
| OpenCode | ACP for client integration; native HTTP server/OpenAPI and SSE for remotely hosted sessions. | Sessions/messages, event correlation, permissions, abort, reconnect/log recovery and authenticated remote access.                                                                                                   | Target; generic HTTP/ACP adapters are not proof of this compatibility.                                                                                                                                                                      |
| Pi       | Native long-lived JSONL RPC subprocess; SDK only if lifecycle/isolation remains appropriate. | Prompt handling versus settled execution, steering/follow-up queues, abort, persistent session selection and extension UI requests. Approval behavior depends on the runtime/extensions.                            | Target; generic CLI output parsing is insufficient proof.                                                                                                                                                                                   |
| Hermes   | ACP or its programmatic gateway; native HTTP run API is a remote candidate.                  | Durable run ids, streamed events, permission resolution, steer/stop, session continuity, authentication and supported version.                                                                                      | **ACP surface demonstrated against Hermes 0.21.0 on 2026-10-23**: the handshake answered, and one turn completed with the runtime's own answer, through the product's own adapter. The HTTP run API still needs implementation and testing. |
| OpenClaw | Gateway WebSocket protocol, or supported ACP bridge.                                         | Gateway handshake/auth/scopes, sessions, events, approvals, cancellation and remote reconciliation. HTTP tool invocation alone is not the full lifecycle.                                                           | Target; do not claim generic HTTP feature parity.                                                                                                                                                                                           |

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

| Adapter type       | Runtime it speaks to           | Session continuity                                                                                                                           | After a restart                           | Verified against                     |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| `acp`              | Any ACP agent                  | resumable — the ACP session id names the session and `session/load` puts the agent back into it                                              | no — an uncertain run waits for the owner | Hermes 0.21.0, 2026-10-23            |
| `codex`            | The Codex CLI                  | fresh unless the connection is not ephemeral — Codex then keeps its session on disk, and the App Server transport is what re-enters it       | no — an uncertain run waits for the owner | codex-cli 0.163.0, 2026-10-23        |
| `codex-app-server` | The Codex App Server           | resumable unless the connection is ephemeral — the App Server's thread id names the session, and `thread/resume` puts the agent back into it | no — an uncertain run waits for the owner | codex-app-server 0.163.0, 2026-10-24 |
| `mcp`              | An MCP server                  | fresh — an MCP session belongs to the connection, not to the conversation's turn                                                             | no — an uncertain run waits for the owner | MCP SDK 1.32.1, 2026-10-23           |
| `cli`              | A command-line agent           | fresh — the process ends with the turn, and the next turn is a new session-less process                                                      | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23     |
| `http`             | A gateway over HTTP            | fresh — the request carries the turn and the gateway is not asked to remember the session                                                    | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23     |
| `a2a`              | An agent-to-agent orchestrator | fresh — the orchestrator's task id names a task, and a task is not claimed as a session                                                      | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23     |
| `model`            | A model API                    | fresh — a model call has no session                                                                                                          | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23     |
| `echo`             | The built-in local test agent  | fresh unless the agent is asked to ask — a turn that asked keeps the session it asked in, so the answer can be its next input                | no — an uncertain run waits for the owner | agent-adapters 0.1.0, 2026-10-23     |

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

| Capability             | The ACP route | What that means                                                                                                                           |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Permission requests    | supported     | The runtime's own `session/request_permission` reaches the owner as the product's approval, and the owner's decision answers the runtime. |
| Artifacts              | not supported | The route streams the agent's text and its tool calls, and makes no resource of either.                                                   |
| Input files and images | not supported | **The ACP route sends text only.**                                                                                                        |

**The ACP route sends text only.** The adapter's prompt is a single
`type: 'text'` block. A message in the product carries an attachment as a
reference to a resource, and the boundary an adapter is given carries text: a
runtime that can read images reads them once the turn carries content parts,
and not before. OpenCode's own capabilities include images, so the limit is
the product's and not the runtime's.

**What is proved where.** The permission path is proved by
`scripts/verify-acp-permissions.ts`, which drives the built adapter against
an agent that speaks the protocol. It has not been demonstrated against an
installed runtime yet — that is SPEC-R1-2's demonstration, and the owner
drives it.

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
