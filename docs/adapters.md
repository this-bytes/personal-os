# Runtime integration matrix

**Research baseline:** upstream documentation checked on 2026-10-22. These are
integration candidates, not a claim that Personal OS supports their native
lifecycles today. Pin actual runtime/protocol versions and rerun the demonstrations
before marking a row verified. Upstream main can change independently of this repo.

All five runtimes are approved targets. Codex/OpenCode prove R1; Pi/Hermes/OpenClaw
follow in R2. Provider-specific code stays behind the shared adapter contract.

| Runtime  | Candidate supported interface                                                                | What implementation must verify                                                                                                                                                                                     | Personal OS delivery status                                            |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Codex    | Native App Server, or a maintained ACP bridge where it preserves the required behavior.      | Bidirectional thread/turn lifecycle, session continuation, streamed items, permissions/input, interruption, auth and exact transport/version. Prefer the native surface when a bridge loses necessary capabilities. | Target; no named native integration demonstrated by this recovery.     |
| OpenCode | ACP for client integration; native HTTP server/OpenAPI and SSE for remotely hosted sessions. | Sessions/messages, event correlation, permissions, abort, reconnect/log recovery and authenticated remote access.                                                                                                   | Target; generic HTTP/ACP adapters are not proof of this compatibility. |
| Pi       | Native long-lived JSONL RPC subprocess; SDK only if lifecycle/isolation remains appropriate. | Prompt handling versus settled execution, steering/follow-up queues, abort, persistent session selection and extension UI requests. Approval behavior depends on the runtime/extensions.                            | Target; generic CLI output parsing is insufficient proof.              |
| Hermes   | ACP or its programmatic gateway; native HTTP run API is a remote candidate.                  | Durable run ids, streamed events, permission resolution, steer/stop, session continuity, authentication and supported version.                                                                                      | Target; specific HTTP lifecycle needs implementation and testing.      |
| OpenClaw | Gateway WebSocket protocol, or supported ACP bridge.                                         | Gateway handshake/auth/scopes, sessions, events, approvals, cancellation and remote reconciliation. HTTP tool invocation alone is not the full lifecycle.                                                           | Target; do not claim generic HTTP feature parity.                      |

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
