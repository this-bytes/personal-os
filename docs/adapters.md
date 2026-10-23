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

| Adapter type | Runtime it speaks to              | Session continuity                                                                              | Verified against                 |
| ------------ | --------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| `acp`        | Any ACP agent                     | resumable — the ACP session id names the session and `session/load` puts the agent back into it | Hermes 0.21.0, 2026-10-23        |
| `codex`      | Codex App Server or the Codex CLI | fresh — the turn runs in its own process and the runtime keeps no session for the next turn     | codex-cli 0.163.0, 2026-10-23    |
| `mcp`        | An MCP server                     | fresh — an MCP session belongs to the connection, not to the conversation's turn                | MCP SDK 1.32.1, 2026-10-23       |
| `cli`        | A command-line agent              | fresh — the process ends with the turn, and the next turn is a new session-less process         | agent-adapters 0.1.0, 2026-10-23 |
| `http`       | A gateway over HTTP               | fresh — the request carries the turn and the gateway is not asked to remember the session       | agent-adapters 0.1.0, 2026-10-23 |
| `a2a`        | An agent-to-agent orchestrator    | fresh — the orchestrator's task id names a task, and a task is not claimed as a session         | agent-adapters 0.1.0, 2026-10-23 |
| `model`      | A model API                       | fresh — a model call has no session                                                             | agent-adapters 0.1.0, 2026-10-23 |
| `echo`       | The built-in local test agent     | fresh — it keeps no session; the reference it offers names a suspended turn, not a conversation | agent-adapters 0.1.0, 2026-10-23 |

**What "fresh" costs.** A conversation whose agent is `fresh` still holds a
history, and the next turn still reads it. What it does not get is the
runtime's own memory of the conversation: the agent is handed the room's
history, not resumed into the runtime's session. The capability row says which
of the two the owner has.

**What "resumable" claims.** It claims one thing: the next turn in the same
conversation goes back into the same runtime session, and the transcript names
that session so a reader can tell one session's answer from another's.

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
