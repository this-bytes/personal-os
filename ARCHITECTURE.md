# Architecture

**Target:** owner-approved chat-first recovery, 2026-10-22. The process split and
technology below already exist. Session lifecycle, workspace isolation and rich
chat behaviors described as targets are not implementation claims. See
[recovery status](docs/recovery.md#current-evidence-and-limits) and
[the delivery sequence](docs/roadmap.md).

## 1. Shape of the system

Personal OS remains a modular monolith with a separately supervised worker.

```text
Browser: conversation · activity · outputs · decisions
    ↕ authenticated HTTP commands and persisted SSE updates
API: validation · authorization · domain services
    ↕                          ↕
SQLite/WAL + artifact files ← Worker: queue · execution lifecycle
                                  ↕ supported runtime protocols
                     Codex · OpenCode · Pi · Hermes · OpenClaw

Independent development: coding tools → repository → CI → release/recovery
```

The server never runs agents. For explicit execution commands it validates intent, records it and enqueues work.
Creating a task, even with an assignee, is not an execution command.
The worker owns runtime connections and writes events/state to persistence. It
never calls the server to notify the browser. The server streams persisted events;
the browser never holds external agent credentials or directly controls a harness.

Independent development and release do not depend on the instance or its factory.
A future in-product improvement request hands work to that external path; it
cannot become the only way to repair the product.

## 2. Technology baseline

Keep Node.js LTS, strict TypeScript, Fastify, React/Vite, Tailwind/UI primitives,
Drizzle, SQLite WAL, filesystem artifacts, SSE, Vitest/Playwright and a supervised source stack during active development.
The SQLite-backed queue needs no new broker. Add infrastructure only for a measured
requirement. Prefer maintained SDKs for protocol clients; do not build an inference
engine or an agent harness.

## 3. Responsibilities and existing modules

These responsibilities are seams in the existing application, not new services or
an instruction to move every table. The existing domain map in docs/domains.md and
apps/server/src/domains.ts continues to govern current imports. Any change to that
map requires a focused, reviewed slice.

| Responsibility         | Existing implementation / target seam                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversations          | conversations: participants, shared messages, routing, delivery and projection into the transcript.                                                                                                                    |
| Execution lifecycle    | worker executor, executions module and queue: sessions, runs, transitions, input delivery, interruption and recovery. Ownership of existing execution tables stays as documented until an explicit migration/refactor. |
| Runtime adapters       | agents, registry and packages/agent-adapters: configuration, capabilities, protocol mapping, authentication and runtime-specific references. Concrete providers stay outside core domain logic.                        |
| Projects and knowledge | workspaces and resource/memory APIs today; project execution binding, filesystem permissions and isolation remain target additions. A UI workspace is not already a sandbox.                                           |
| Work                   | factory, approvals and autonomy: goals, tasks, delegation, verification, owner acceptance and authorization.                                                                                                           |
| Resources              | resources/automations: documents, dashboards, artifacts, templates and validated resource providers.                                                                                                                   |
| Shared substrate       | contracts, database, events, audit, auth and capability API. Cross-module behavior goes through explicit interfaces; the capability API is an entry point, not a place to accumulate business logic.                   |

Shared boundary shapes live in packages/contracts. Domain services own their
behavior and persistence; HTTP and MCP adapters validate and call those services.
The worker orchestration composes permitted services instead of copying domain
rules or freely updating unrelated tables.

## 4. Connection, session and run

A connection identifies an external runtime configuration and granted authority. A
session identifies that runtime's continuing context for a project/conversation. A
run is a bounded execution within a session, associated with the triggering message
or task. Stable Personal OS identities are separate from native session identifiers.

**Target:** an execution service shared by chat, task and automation callers owns
adapter initialization, capability discovery, session creation/resumption, prompt
submission, event consumption, input delivery, cancellation and cleanup. Callers
provide purpose and authorized context; they do not each implement adapter setup.

Adapter instances remain ephemeral. The worker now connects the instance that
runs a turn and releases it in `finally`; adapters with `holdsRuntime: false`
establish their runtime inside `send`. A capability probe closes its own instance.
This repairs the earlier MCP initialization defect (WI-145); it does not establish
conversation-wide native session continuity. The worker currently restores an
external session for supported approval continuations, while ordinary follow-up
turns still need explicit session ownership and persistence.

Store runtime references and capability snapshots sufficient to interpret a run.
Unsupported resume, steering, artifacts or approvals remain unsupported, not
emulated by changing labels. Native details belong in validated adapter metadata;
adding a runtime must not require provider branches in conversation/task storage.

## 5. One durable execution flow

**Target flow**, introduced in compatibility-preserving slices:

1. Validate the command, actor, project scope, revision and idempotency key.
2. Atomically record the intent, run and queue job. Duplicate submission returns
   the existing result instead of starting a second side effect.
3. The worker claims the job, resolves authority and establishes the runtime
   connection/session before submitting input.
4. Persist normalized events, native references and materialized run state with
   stable identities/order. Replayed remote events do not duplicate transcript
   entries. Keep only bounded, redacted native metadata useful for diagnosis.
5. Stream persisted updates through the existing server event surface. Tool output
   remains distinct from assistant messages and from verified deliverables.
6. Record real completion/error/stop semantics. Accepted input alone does not
   establish completion. Store artifacts with durable metadata and provenance.
7. A verification result is separate from runtime completion. Product work waits
   for owner acceptance where required.

Proposed states distinguish queued, running, waiting for input/permission,
completed, failed, cancelled and uncertain outcomes. Existing status enums are not
renamed by this document. Introduce additive states/events or explicit mappings
with schemaVersion, migrations and client compatibility in CONTRACTS.md.

## 6. Recovery and interruption

Browser reconnect uses persisted history plus an event cursor; ephemeral token
state is not canonical history. Define event retention and snapshot fallback so a
cursor outside retention can recover without missing messages.

A queue lease is not proof that a remote side effect stopped. After worker loss,
reconcile the external reference/status where supported. If the outcome cannot be
established, hold it as unknown and offer explicit resolution. Avoid promising
exactly-once execution across an arbitrary external runtime.

Steering, follow-up queueing, cancellation and hard process termination are
different. Persist delivery/acknowledgment where observable, explain unsupported
operations, and never present a local timeout as confirmed remote cancellation.
Enforce per-session serialization unless the runtime explicitly supports concurrent
turns; bounded concurrency across isolated sessions is a separate limit.

## 7. Scope, permissions and files

A project execution binding identifies local or remote location, repository/files,
instructions and permitted capabilities. It is not merely a browser grouping.
Preserve existing workspaces; add optional bindings with explicit defaults rather
than assuming all existing paths or projects are executable.

Personal OS enforces its MCP grants, dispatch authority, approval decisions and
budgets. Native filesystem/shell actions need harness/environment enforcement.
Do not advertise isolation until tests establish it. Runtime authentication stays
in encrypted server-held configuration and out of event payloads and browser data.
An approval has an expiry/decision identity, resumes the intended run and cannot
be reused to authorize another action.

Artifacts use authenticated storage and validated metadata, size/type limits and
path containment. Preview untrusted HTML/files with appropriate isolation; do not
serve arbitrary agent output as trusted application code. Shared local paths and
remote artifacts have explicit provenance.

## 8. Teams and the factory

Teams are conversation participants with configurable roles. A coordinator is an
external agent using authorized product tools, not an inference loop implemented
inside the server. Scheduling records dispatches, results and dependencies using
the existing queue; it is bounded domain behavior, not a new workflow framework.

The later coordination slice must close the loop from submission to observed
completion to verification to follow-up. It includes correlation identifiers,
deduplication, loop/depth/turn limits, bounded concurrency and pause. Every handoff
links parent and child, states who owns execution, and returns an inspectable
result. Delegation can narrow but never widen authority.

Externally managed teams retain their scheduler and internal tasks. Store their
external reference and observed progress, not a second internal reconstruction.
Core code does not know provider names.

The product factory layers goals/tasks/evidence/acceptance onto this same execution
service. A text reply is evidence of a response; a claimed deliverable needs a
resource, artifact, diff, test report or other inspectable output. Owner acceptance
remains separate from agent completion and independent development review.

## 9. Compatibility and implementation discipline

Preserve existing conversations, agents, tasks, resources, approvals, secrets,
event readers and migrations. Add nullable/defaulted fields where appropriate;
backfill only with observed facts. An old execution without a native session
reference cannot be retroactively made resumable. Keep existing API behavior while
new commands are introduced. In particular, task creation with an assignee remains
creation; dispatch is an explicit authorized operation.

Every slice carries contract changes, migrations/snapshots, a feature test,
failure/restart cases and a user demonstration. Follow
[the feature guide](docs/feature-guide.md). No large structural refactor is a
prerequisite for the first worker-lifecycle fix.

## 10. Operating the current build

See README.md for installation and AGENTS.md for gates. The current source stack is
npm run dev:stack; deploy/install-service.sh installs the supervised source stack
with persistent data outside the checkout. A health response does not prove agent execution.

The current owner-password recovery command is npm run reset:owner-password,
implemented by scripts/reset-owner-password.ts.
Its password argument is visible in the host process list/command line: another
user on that host may read it. Use it only on a trusted host and follow the
README's recovery instructions. This recovery plan does not change that command.

Schema migration on boot and code/schema rollback behavior must be checked before
a deployment claims safe rollback. Retain the external release/recovery boundary
from ADR 0010; its historical runbook describes procedures and limitations rather
than proof that every rollback scenario has been exercised.
