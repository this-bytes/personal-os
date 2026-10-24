# Product

**Personal OS is an environment that one person's agents operate and extend.**

The owner-approved [chat-first recovery](docs/decisions/0018-the-chat-first-recovery-decisions.md)
dated 2026-10-22 defines the current direction, and
[ARCHITECTURE.md](ARCHITECTURE.md) says how the system is built to serve it.
This document describes requirements. A requirement here is not a delivery claim:
the [roadmap](docs/roadmap.md) and the [specs](docs/spec/) say what exists.

## 1. The owner's role

The owner directs, approves and accepts. Agents perform the delegated work within
explicit scope, continuing until a verified result, a configured limit or a real
blocker. Connecting an agent is a trust decision. Permission does not expand merely
because an agent joins a group or receives delegated work.

Personal OS has one human owner. Multi-user tenancy and organizations are outside
this recovery.

## 2. Product ownership boundaries

Personal OS owns interaction, coordination and creation: shared conversations,
goals/tasks, observed executions, approvals, evidence, resources and acceptance.
External harnesses own reasoning, native tools, runtime sessions and their internal
execution. Personal OS integrates them through supported protocols and maintained
libraries rather than implementing a new harness.

An external orchestrator may own an entire execution. Personal OS records its
reference and observed outcomes without copying its internal scheduler. A missing
status is unknown, not an invented success.

The agents building Personal OS operate out of band using the repository, CI and
existing coding tools. Building, releasing and recovering the product work with
the instance stopped. The in-product factory is not their prerequisite.

## 3. Rich conversations

Conversation is the primary working surface. The owner can talk to one agent or
use a persistent team room, inspect tool activity and outputs, answer questions and
permission requests, and give further direction without losing context.

The required chat baseline includes streaming, Markdown/code, files and images,
output previews, persistent history, runtime activity, cancellation, permission
resolution and user questions. Steering-now and queued follow-ups are distinct.
Unsupported capabilities are explained and have supported alternatives; a terminal
can supplement the shared experience where needed.

Group rooms support explicit mentions and optional coordinators. Handoffs and
results are visible. An agent message never wakes every participant. Loop limits,
depth limits, deduplication, execution budgets and pause controls remain mandatory.
A coordinator must act and verify, not merely generate plans or task records.

## 4. Runtime connections and identity

The target runtimes are Codex, OpenCode, Pi, Hermes and OpenClaw. Their supported
interfaces and version checks are tracked in [the adapter matrix](docs/adapters.md).
Local CLIs and externally hosted agents use the same conversation model. HTTP is
one transport option, not a universal lifecycle contract.

Agent identity is stable across sessions: name, instructions, granted capabilities
and optional memory. A connection, a runtime session and a run are separate
objects. Working sessions are scoped to the conversation/project. The shared
transcript belongs to Personal OS; private native context belongs to the harness.

## 5. Projects, memory and files

A project has a declared execution location, repository/files, instructions and
permitted access. Remote agents declare their own environment; a local path is not
assumed to identify the same remote files. Results return as inspectable artifacts,
diffs or repository references. Parallel coding uses isolated workspaces or
branches/worktrees with an explicit integration owner.

Instructions, project knowledge and conversation history are distinct. The owner can
inspect and edit them; sharing between projects is explicit. Native harness memory
is identified separately from Personal OS-managed knowledge. Attaching a file does
not automatically grant shell or filesystem access outside the project.

## 6. The factory and autonomy

The factory's work model remains:

```text
Goal → Task → Execution → Evidence → Acceptance
```

Goals endure across runtime and provider changes. Assignment that starts work is
explicit, authorized and observable. Recording an assignee is not evidence that
execution began. An agent's report of completion moves work to review; only owner
acceptance closes a product task.

Within approved scope agents may inspect, edit, test and delegate. Destructive
operations, publishing, deployment and wider access follow explicit approval rules.
Delegation cannot widen permissions. Turn, duration, concurrency and spend limits
must bound continuing work; unavailable spend telemetry is reported as unavailable,
not as zero or a fictional currency amount.

The existing autonomy mode is descriptive rather than an enforced control. Making
modes meaningful requires an explicit compatibility plan. Do not describe the
approved target as already enforced.

## 7. Resources and everyday use

Everyday scope remains tasks/work and documents, with dashboards, automations,
data sources and memory as supported resources. Email and calendar remain out of
scope. Resources have typed, provider-validated payloads, schemaVersion, revision
and an audit trail. Revision checks protect updates; templates are validated
examples rather than a second extension framework.

Existing resource features and data remain supported while chat is improved.
Agent-created outputs need an inspectable result and a check before being treated
as delivered. A text response can be an observation; it is not proof of a file,
resource or code change.

## 8. Continuity and truthful state

Closing the browser does not stop work. Reconnection restores persisted history and
activity. Restart reconciles a surviving external run when supported; otherwise an
uncertain side effect is reported for resolution rather than automatically replayed.
Prompt acceptance, message delivery, agent consumption, run completion, verification
and owner acceptance are distinct facts.

No UI or documentation may claim resume, cancellation, sandboxing or exactly-once
execution unless the relevant adapter/environment and tests establish it.

## 9. Product measures

Retain the existing measures of agent-authored resources and recorded operations.
Show their definitions, provenance and missing data honestly. These measurements
support the owner; they do not establish that a requested deliverable exists.

## 10. Borrowing and protocol boundaries

Borrow approaches from other products and implement Personal OS behavior against
its contracts. Prefer maintained protocol SDKs and established libraries over
handwritten protocol implementations. This is compatible with independent product
ownership; it does not require embedding another product or its scheduler.

The existing dependency licence record is
[docs/dependency-licences.json](docs/dependency-licences.json). Its published model
is one entry for every package in the lockfile, recording the evidence that identifies it
and its source. Its actual coverage and approved licences must be verified when
dependencies change; a prose assertion is not a new licence audit.

MCP exposes tools/resources; ACP and native agent protocols connect harnesses;
AG-UI or MCP Apps may be interoperability projections when demonstrated needs
justify them. None replaces the internal domain model. Evaluate actual source and
licensing before copying code. [The adapter research](docs/adapters.md) records
upstream sources and distinguishes documentation findings from local verification.

## 11. The panel's own rules

Keep Forge's visual language. Conversations are the primary work surface; the map,
factory board and dashboards support them. Questions, approvals, activity and
outputs are available where work is directed. A global waiting view links to that
context rather than forcing the owner to reconstruct it.

The accent continues to mean live or waiting on the owner; structural and caution
colors retain distinct meanings. The earlier map-first layout is superseded.

## 12. Delivery and exclusions

Follow [the roadmap](docs/roadmap.md): execution foundations, rich chat with Codex
and OpenCode, all five runtimes, team coordination, then the factory. Each stage
needs a working user demonstration and meaningful tests.

**Plugins extend the product without becoming a marketplace.** A plugin is a
first-party extension that lives in this repository, is reviewed like the rest of
it, and extends functionality through the first-class API and the event engine
while staying isolated enough to be enabled and removed. It is not a distribution
channel and not a surface for third-party code. The decision is
[ADR 0016](docs/decisions/0016-plugins-are-isolated-runtime-extensions.md).

This recovery does not add a general workflow engine, an inference engine,
distributed task infrastructure, a plugin marketplace, native mobile/desktop
applications or arbitrary agent-authored application execution. The existing web
application remains the delivery surface.
