# Delivery roadmap

**Active plan:** chat-first recovery approved by the owner on 2026-10-22.
[recovery.md](recovery.md) records the decisions; ARCHITECTURE.md defines the target
seams. Stages below are pending, not accepted work. Existing usable features remain
supported. Each stage is delivered as small vertical slices, not one large branch.

## Order and release criteria

| Stage                      | User outcome                                                                                       | Dependency                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| R0 — execution foundations | A dispatched command reaches a correctly initialized runtime and produces truthful, durable state. | Existing code and regression reproduction. |
| R1 — rich chat             | The owner can complete real work in one cohesive conversation with Codex and OpenCode.             | R0.                                        |
| R2 — five runtimes         | Pi, Hermes and OpenClaw use the same experience with honest capability differences.                | R1; transport research can run earlier.    |
| R3 — autonomous teams      | A coordinator hands work to specialists, checks results and follows through visibly within bounds. | R1/R2; no factory dependency.              |
| R4 — product factory       | A delegated goal produces inspected evidence and waits for owner acceptance.                       | R3.                                        |

Demonstrations exercise a real supported runtime version, not an echo responder.
Protocol fixtures remain useful deterministic tests. Record both, and name the
limits of each. A stage is delivered only when its user demonstration and the
applicable repository gates pass on the delivered revision.

## R0 — establish the execution foundation

**First slice to implement: repair MCP initialization through the worker.**

Scope: packages/agent-adapters, the worker executor, relevant contracts and tests.
Use a fixture MCP server that requires initialization. Drive the actual chat/task
worker path, demonstrate the existing failure, initialize the executing adapter
instance, verify capabilities and define cleanup on completion/error. Include the
automation path if it shares the defect. Retain ACP's working send-time setup;
do not blindly impose a second handshake on every protocol.

Acceptance:

- Worker execution reaches the fixture tool and records the actual result.
- A failed handshake blocks submission and records an actionable failure.
- A successful probe on another instance does not falsely count as initialization.
- Cleanup/deadlines do not leak a child process or claim confirmed cancellation
  when it was not observed.
- Existing echo/CLI/ACP behavior remains compatible.

**Next bounded slices:**

1. Establish shared execution ownership across chat, tasks and automations. Extract
   only the lifecycle needed by these callers, with compatible event/state mapping.
2. Define explicit authorized task dispatch through the shared service and MCP.
   Task creation stays non-executing. Duplicate dispatch cannot start two runs.
3. Introduce session references, correlation/idempotency and terminal-event rules
   sufficient for the first real integrations. Document native capability limits.
4. Test restart/reconciliation and unknown outcomes with side effects. Keep the
   current no-blind-replay guard; do not wait for a lease to expire and assume the
   previous executor stopped.

Completion evidence: a worker-level regression, duplicate-submission and restart
cases, observed status transitions and applicable gates. Full factory autonomy,
queue-index reform and new dashboards do not belong in R0.

## R1 — complete rich chat with Codex and OpenCode

Use the [adapter matrix](adapters.md) to pin supported runtime versions and select
maintained integration surfaces. Implement the same UI, API and persistence flow
for both; provider-specific behavior remains in adapters.

Deliver in slices: stable sessions/history; normalized streaming/activity; scoped
project bindings and authenticated artifacts; permission/user-question handling;
steer/queue/stop controls; reconnect/restart behavior. Each slice includes visible
UI and failure behavior rather than landing a backend-only promise.

Acceptance demonstration for **each** runtime:

1. Connect/authenticate, select an approved project and begin a conversation.
2. Ask for a small file/code change. Observe streaming text, native tool activity
   and an inspectable output/diff with provenance.
3. Send a follow-up during work. Demonstrate steering when supported and visible
   queueing otherwise; distinguish received input from submitted input.
4. Resolve a real permission request or user question in the conversation. If the
   runtime does not expose one of these, demonstrate the explicitly documented
   limitation and the alternative; a fabricated fixture request is not proof of
   runtime support.
5. Stop a run and show its confirmed state or explain uncertain remote outcome.
6. Close/reopen the browser and continue the same conversation/session. Restart
   the worker during a controlled run and reconcile or hold unknown without a
   duplicate side effect.
7. Attach a file/image and inspect an output preview where supported. Unsupported
   modalities have clear UI behavior; neither baseline runtime may be presented as
   image-capable without a real demonstration.
8. Reopen persisted history with tool/result references intact. Keep credentials
   and private native context out of the transcript and logs.

A chat baseline includes the full UI checklist even when an individual runtime has
lesser capabilities. Unsupported controls are explained; hiding every hard feature
behind "unsupported" does not complete R1. Record which runtime proves each
baseline capability and any remaining unmet requirement before declaring the stage.

## R2 — support Pi, Hermes and OpenClaw

Each adapter demonstrates session continuity, event mapping, real completion,
interruption, authentication and artifact behavior to the degree its pinned
protocol supports. Reuse the R1 UI and lifecycle tests. Add protocol fixtures and
real-harness evidence; document gaps rather than promising feature parity.

Prove at least one externally hosted agent connection. Use the runtime's supported
HTTP/SSE, WebSocket, ACP bridge or other declared native surface. Do not build a
new remote process host merely to label every integration "HTTP". Remote workspace
identity, reconnect, authentication and external run references are explicit.

Completion: all five named targets have a tested capability row, an installation/
connection recipe and a real chat demonstration. Adding an adapter changes no
conversation storage or task-provider logic.

## R3 — visible autonomous team coordination

Deliver direct chats and persistent group rooms with configurable identities and
roles. Use the existing mentions/routing safeguards; add explicit correlated
handoffs, returned results and coordinator continuation. Product tools enable the
coordinator to act. Neither a plan nor an assignee field substitutes for dispatch.

Acceptance demonstration:

- The owner delegates a bounded project goal once to a coordinator.
- The coordinator dispatches to two specialists, including different harnesses,
  sees their actual results and follows up without another owner kickoff.
- A reviewer checks an inspectable output; a failed check leads to correction,
  not an unsupported success report.
- Parent/child work, progress, waiting reasons, tool activity and results are
  visible from the room. Private contexts are shared only through explicit handoffs.
- Concurrent coding cannot overwrite the same files silently; isolated branches/
  workspaces have an integration owner.
- Turn/depth/time/concurrency/spend limits and pause stop further dispatch as
  designed. Missing cost telemetry is explicit; a hard spend guarantee requires
  enforceable runtime support, otherwise another enforced budget bounds execution.
- A missing specialist produces a bounded retry or a visible blocker. No broadcast
  loop or endless re-planning occurs.
- An external orchestrator can own an entire execution without its internal task
  tree being mirrored into Personal OS.

## R4 — the product factory

Layer goals, durable tasks, dependencies, verification evidence and owner acceptance
onto the proven R3 loop. Preserve the existing task/resources/approval APIs and
history; migrate explicitly when adding fields.

Acceptance demonstration: the owner gives a goal and scope once; work proceeds
through execution, inspection and correction to a concrete deliverable and recorded
verification. The owner can inspect evidence and accept/reject. Rejecting sends
work back with the reason; agent-reported completion alone never closes the task.
The out-of-band build/release path still functions with the instance stopped.

## Existing backlog and scope control

Historical work-item narratives are available in Git at 507708b. Compact evidence
records retained for contract checks are not an active backlog. Inspect source and
branches before selecting old work, identify what is already landed, and map any
remaining gap to a stage. Preserve valuable fixes and data; do not bulk-accept
removed items. Security/data-loss defects may be fixed immediately with a named
reason and tests.

Source-line citation repair, identity wording tests, counts, maps and new queue
machinery do not displace a stage's user outcome. Documentation accompanying a
behavioral change is part of that slice. No new role roster, orchestrator, broker
or general workflow engine is needed to begin.

For each selected slice record one owner, isolated branch/worktree, touched paths,
contract/migration impact, acceptance demonstration and actual validation. The
implementer writes tests; independent review checks the result. Follow FACTORY.md
and [the feature guide](feature-guide.md), rather than creating a competing plan.
