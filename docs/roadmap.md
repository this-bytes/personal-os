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

## What has landed

The first delivery round ran five slices in parallel, each on its own branch in
its own worktree, and each was merged into `main` with its contract published in
`CONTRACTS.md` and its own record in `docs/contract-*.md`.

| Slice                              | Outcome                                                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-145** — the adapter lifecycle | Every adapter has `connect` → `send` → `close`. A turn on an unconnected instance is refused with a message that says what to do. The capability probe closes what it opened.                                                                       |
| **WI-142** — the adapter presets   | A preset per adapter type and per approved runtime: a default configuration validated against the real schema, a leader persona, and the honest notes. Every runtime preset is marked unverified.                                                   |
| **WI-143** — the factory's goals   | A goal has a rollup and a task has dependencies, with cycle rejection, as pure functions over the existing service. The migration adds a column and drops nothing.                                                                                  |
| **WI-141** — the rich chat surface | Markdown and code, a turn activity trace, artifact previews and a stop control that says what it did — in the Forge visual language.                                                                                                                |
| **WI-144** — the team room         | A coordinator dispatches to a worker, the worker runs, the result returns, and the handoff is visible. See the slice's own record for what is partial.                                                                                              |
| **WI-152** — the steer             | A steer goes into the turn that is running, for a connection that reported it can take input mid-turn, and a steer that cannot be delivered waits for the next turn and says why.                                                                   |
| **WI-151** — the attachment upload | The composer uploads a file, the server stores the bytes beside the workspace, and the transcript opens it. See the slice's own record for the limits that remain.                                                                                  |
| **WI-153** — the Hermes preset     | The catalogue carries the surface the installed Hermes publishes, and a script proves a runtime through the product's own adapter. The handshake answered and a turn came back through it.                                                          |
| **WI-154** — the capability view   | A turn is admitted with the capability set it runs against: the view is pinned at admission, a capability or grant change takes effect on the next turn, and the panel says what the turn was admitted with. The MCP token stays connection-scoped. |

**R0's first slice is landed.** The adapter lifecycle gives every adapter an
explicit `connect` → `send` → `close`, the worker connects the instance the
turn runs on — on the chat path, the task path and the automation path alike —
and the turn's outcome is the adapter's outcome rather than a quiet completion.
The proof is a worker-level regression that drives a **real** MCP server over
stdio and records its answer, and a second case where a handshake that fails is
an actionable failure. **R0 is not closed**: the rest of the stage — shared
execution ownership across the three callers, authorised dispatch, session
references and restart reconciliation — has not been done.

**R1 is partly landed and partly not.** The chat surface, the activity trace and
the stop control are in. **Steering is in now**: a steer goes into the turn that
is running, for a connection whose adapter reported that it can take input
mid-turn, and a steer that cannot be delivered waits for the next turn and says
why. **The chat is now proved end to end in a browser**: the suite runs the
worker, the owner's message reaches it, the adapter runs, and the answer lands
in the room as the agent's own message, marked with the adapter that wrote it —
and a steer into a running turn comes back as the agent's answer to the steer.
The acceptance demonstration still needs a named runtime to complete a turn —
the adapter the browser proves is the built-in `echo` one, which is a product
adapter and not a runtime. **The Hermes ACP surface has now answered the
handshake and completed a turn**: the installed Hermes 0.21.0 answered
`initialize` with `loadSession: true`, and a turn came back with the runtime's
own answer, both through the product's own adapter. The `hermes-acp` template
therefore carries the evidence its `verified: true` rests on. **Two more of the
approved runtimes are installed here** — measured on this machine, not assumed:
`codex --version` reports `codex-cli 0.163.0` and `opencode --version`
reports `1.19.4`, with Hermes at
`C:\Users\Aaron\AppData\Local\hermes\bin\hermes.exe`. Pi and OpenClaw are not
installed. An installed runtime is not yet a demonstrated one — the R1
demonstrations in [SPEC-R1-1](spec/r1-1-codex-demonstration.md) and
[SPEC-R1-2](spec/r1-2-opencode-demonstration.md) are what turn these three
installs into evidence.

**R2 has one demonstrated runtime and four templates.** The presets are starting
points for the five named runtimes. **One runtime has been demonstrated in this
repository** — Hermes, which answered a handshake and completed a turn through
the product's own adapter — and the other four are still templates that say
so in the copy the owner reads.

**WI-132 has landed with it.** The waiting list's shape is published once, in the
contracts package, and the server and the panel both read it there, so a client
cannot describe a list the server does not send. The panel's capability row now
says which tool the agent was refused and widens the grant from the row itself,
through the published route, and it is labelled "Needs a grant" rather than
"Blocked" — a grant the owner can widen from the row is not work that is stuck.

**WI-154 has landed with it.** A turn is now admitted with the capability set
it runs against. The view is pinned when the turn is admitted, so a capability
or grant change takes effect on the next turn and not underneath the one that
is running — and the steering decision asks the turn rather than the
connection, which is the same change seen from the other side. The panel shows
what the turn was admitted with, and the revision on the agent's own card says
when that set last moved. **The view is not a sandbox.** The MCP token names
its connection, so a grant the owner widens reaches the agent's next tool call
as well as its next turn; the contract says so rather than implying a
per-turn enforcement that does not exist.

**WI-132's two claims named a commit that did not carry the shape.** They named
`4d389c7`, and at that commit the published field was the loose
`toolName?: string | null` — optional, so a row could leave it out, and that is a
third wire shape the server never sends. The declaration was tightened, and it
landed on main in `e76b124`; the claims name that commit now. **The gate reads the
code at the commit a claim names**, not only the working tree: a claim about the
tree says nothing about the commit it points at, and nothing noticed.

**The chat surface now stands on adopted source.** The owner asked for the
conversation to be built from existing open-source work rather than from
scratch, so the trace and the code block were re-anchored onto shadcn/ui's
`Trace` and `Code Block` (MIT), adapted to this repository's tokens and kept
in this repository's hands. What was adopted, what was rejected and on what
evidence, what is upstream, and what is still genuinely missing are written
down in [the reuse inventory](reuse-inventory.md). Three things came out of
the evaluation that are worth naming here: the adapters, the presets and the
route already cover most of the brief, and **the chat surface was never the
gap** — steering, the five native runtimes and a real runtime demonstration
are.

**And the empty room now offers prompts.** The reuse inventory listed the empty
transcript as a gap, and it named shadcn's `Suggestion` pattern as what would
close it. It is closed: an empty room offers a row of prompts, the first of
them names a participant in the room, and pressing one sends it as the message
it is — the same path a typed message takes, with the delivery mode the owner
has chosen. The pattern is upstream's (MIT) and its composition is kept whole;
the prompts are this repository's.

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

### Engineering review follow-ups (2026-10-23)

These are bounded implementation slices found during the repository review at
`644d33f`; they are not claims that the corresponding recovery stage is complete.
Inspect updated main and existing branches before assigning them.

- **R0: hold an expired worker lease as uncertain before replaying side effects.**
  `Queue.reapStaleJobs` currently requeues a stale running job unless the executor
  already recorded an unknown outcome. A process killed before that write can
  replay an external side effect. Add worker-loss integration coverage, lease
  fencing and an atomic domain/job transition; retain remote reconciliation where
  supported. Acceptance: kill a worker after a fixture records a side effect,
  restart it, and prove no duplicate effect and a visible owner-resolvable outcome.
- **Execution boundary: recover worker-owned connection probes from WI-077.**
  `wi/077-agent-adapter-domain` at `404c9df` contains useful unmerged work, not a
  duplicate: current `agents.probe()` still constructs/connects adapters in the
  API process. Port its queue-based probe behavior without replacing newer
  capability revisions, lifecycle cleanup, grants or execution code. Atomically
  enqueue and record the probe; make the asynchronous API/client contract explicit.
  Acceptance: the API starts no runtime; the worker publishes success/failure and
  timeout, closes its adapter on every path, and preserves capability revisions
  when the reported set is unchanged. Existing worker tests are recovery inputs,
  not proof that the old branch is compatible with today's tree. Its branch and
  recovery bundle preserve the source; the obsolete physical worktree is retired.
- **R0/R3: make Bot dispatch retry-safe.** `bot.dispatch` currently accepts no
  request ID. Add an actor-scoped idempotency key and atomic creation of the
  delegation, task, execution and queue job through existing services. Acceptance:
  simultaneous identical retries yield one child; changed content conflicts;
  returned results wake only the requesting coordinator.
- **R1/R2: persist native sessions and expose advanced capabilities coherently.**
  `AgentAdapterExtras` names native capabilities, but the common execution path
  does not project them into the product. Ordinary follow-ups are not proven to
  restore native context; named runtime presets remain unverified. Use the adapter
  matrix and maintained protocol clients. Acceptance: real Codex and OpenCode
  multi-turn/reconnect demonstrations with one advanced capability surfaced safely,
  explicit unsupported operations, and no provider branches in conversation storage.
- **Platform: prove execution isolation and recovery outside the agent's authority.**
  CLI `cwd` and sanitized environment do not confine filesystem access. The Compose
  worker shares the database volume and currently runs as the image's default user.
  Keep release/recovery external, define the project execution binding and least
  privilege, and test backup/restore including SQLite WAL, artifacts and encryption
  key handling. Acceptance: an agent cannot alter the running release/recovery
  controls; restore a disposable populated instance and verify its records/files.
- **Development configuration: replace retired persistent Bot role instructions.**
  The installed Bot settings still refer to deleted role briefs and prohibit
  implementers from editing tests/docs/manifests. Apply current FACTORY.md through
  the plugin's supported settings or management API, retaining existing identities,
  memory and chats. Acceptance: one implementer delivers a bounded slice with its
  own tests/dependencies/docs; an independent reviewer checks it; no ceremonial
  file-role handoffs or duplicated dispatch occurs. Never edit live state.json.

The engineering evidence and preserved-work locations are recorded in
[the review](engineering-review-2026-10-23.md).

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
