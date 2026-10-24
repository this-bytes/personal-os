# Delivery roadmap

**Active plan:** the chat-first recovery approved by the owner on 2026-10-22,
recorded in [ADR 0018](decisions/0018-the-chat-first-recovery-decisions.md).
[ARCHITECTURE.md](../ARCHITECTURE.md) says what may not change and what the
pillars are; this document says what is being built and in what order.

Existing usable features remain supported. Each stage is delivered as small
vertical slices, not one large branch.

**What has landed is not written here.** It is written by the spec that earned
it, and the queue of those is [docs/spec/README.md](spec/README.md). This
document carries the order, the outstanding work, and the honest state of each
stage.

## Order and release criteria

| Stage                      | Pillar   | User outcome                                                                                       | Dependency                                 |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| R0 — execution foundations | Platform | A dispatched command reaches a correctly initialized runtime and produces truthful, durable state. | Existing code and regression reproduction. |
| R1 — rich chat             | Chat     | The owner can complete real work in one cohesive conversation with Codex and OpenCode.             | R0.                                        |
| R2 — five runtimes         | Runtimes | Pi, Hermes and OpenClaw use the same experience with honest capability differences.                | R1; transport research can run earlier.    |
| R3 — autonomous teams      | Teams    | A coordinator hands work to specialists, checks results and follows through visibly within bounds. | R1/R2; no factory dependency.              |
| R4 — product factory       | Factory  | A delegated goal produces inspected evidence and waits for owner acceptance.                       | R3.                                        |

Demonstrations exercise a real supported runtime version, not an echo responder.
Protocol fixtures remain useful deterministic tests. Record both, and name the
limits of each. A stage is delivered only when its user demonstration and the
applicable repository gates pass on the delivered revision.

### The standing pillars

Three pillars are not stages. They are always open, and a slice in any of them
is a slice like any other.

| Pillar        | What it carries                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resources** | Documents, dashboards, automations, data sources, memory, files, templates, publish and execute.                                                                                         |
| **Platform**  | Contracts, schema and migrations, the event spine, audit, auth, the queue and worker, the capability API, the panel shell, release and recovery.                                         |
| **Plugins**   | The isolated extension surface. The contract shape is decided in [ADR 0016](decisions/0016-plugins-are-isolated-runtime-extensions.md); the mechanism is a spec that does not exist yet. |

## Where each stage stands

**R0 is not closed.** The adapter lifecycle, shared execution ownership across
the three callers, session references and restart reconciliation have landed —
[the adapter lifecycle record](contract-adapter-lifecycle.md),
[SPEC-R0-1](spec/r0-1-shared-execution-ownership.md),
[SPEC-R0-3](spec/r0-3-session-references.md) and
[SPEC-R0-4](spec/r0-4-restart-reconciliation.md). **Authorised dispatch
([SPEC-R0-2](spec/r0-2-authorised-dispatch.md)) is deferred** by the owner's
direction, so that slice has not been done and R0 is not closed.

**R1's acceptance is met.** The chat surface, the activity trace, the stop
control, steering and the attachment upload are in, and the attachment now
reaches the runtime. The chat is proved end to end in a browser: the suite runs the
worker, the owner's message reaches it, the adapter runs, and the answer lands
in the room as the agent's own message — and now against installed runtimes
rather than only against the built-in `echo` one, which is a product adapter
and not a runtime.

**Three runtimes have answered a turn through the product's own adapters** —
Codex on 2026-10-24, OpenCode over ACP, and Hermes over ACP — and the preset
catalogue carries the evidence each claim rests on. **Both R1 acceptance
demonstrations have been made.** The owner completed real work in the web chat
against Codex 0.163.0 over its App Server — [the
demonstration](demonstration-codex-2026-10-24.md),
[SPEC-R1-1](spec/r1-1-codex-demonstration.md) — and then the same work against
OpenCode 1.19.4 over ACP, where the runtime's own permission request reached
the owner and the owner's decision answered it — [the
demonstration](demonstration-opencode-2026-10-24.md),
[SPEC-R1-2](spec/r1-2-opencode-demonstration.md).

**What the second demonstration cost.** It found two defects, and both are
fixed and landed: the ACP adapter insisted on a session id that the protocol's
load response does not have to carry (PR #35), and the approval was published
before the execution row named the session the decision continues in (PR #36).
It also named the limits the route really has: the ACP route carries the
agent's text and the runtime's permission requests, and no tool activity, no
attachments and no steering.

**The third slice closed the attachment gap that the second demonstration
measured.** A file the owner attached never crossed the adapter boundary: the
turn carried text, and the worker built that text from the message's text
parts and dropped the rest. The OpenCode transcript recorded the agent
reading a different file — the one in its own working directory — and the
Codex transcript recorded _"I don't see an attached file."_ The fix was in the
shared boundary and not in one adapter: the turn now carries the message's
parts that its text does not carry, the worker resolves the file, and each
adapter maps it into its own protocol's shape. **The file now reaches the
runtime** — [the demonstration](demonstration-content-parts-2026-10-24.md),
[SPEC-R1-3](spec/r1-3-content-parts.md) — and a room whose agent cannot carry
a file refuses the attachment rather than taking it and dropping it.

**What the ACP route still cannot do.** It carries no steering.

**The fourth slice closed the second gap the second demonstration measured.**
The room's activity timeline was empty on the ACP route: the adapter read one
kind of the runtime's `session/update` notifications and dropped the rest, so
the protocol's `tool_call` updates — how every ACP agent says "I am reading
this file" — never became the product's tool events. The fix was in the
adapter, because the contract already had the events and the room already
drew them. **The room now shows the work** — the tool's name, the file it was
called with, and what it got back — [the demonstration](demonstration-acp-tool-activity-2026-10-25.md),
[SPEC-R1-4](spec/r1-4-acp-tool-activity.md).

**And the demonstration found the reason the reply repeated itself.** The
runtime replays a session when it is _loaded_, and the product loads the
session to continue it, so the session's earlier answers and calls arrived as
the turn's own work: the owner read one long bubble holding the whole session,
and the timeline carried a row for a call the runtime made a turn ago. One
rule closes both — _a turn's work is what arrives after the prompt_ — and the
measurement behind it says the boundary is exact. The room itself, with two
turns in one session, is still to be demonstrated on the ACP route: the
installed runtime's free allowance was spent before the second turn could be
asked.

**The sixth slice settled that rule on the other route, and showed the room
holding two turns.** The rule had been settled on the ACP route, where the
runtime replays the session it loads; the App Server route had no such rule
and was right by accident, because the installed App Server 0.163.0 replays
nothing when a thread is resumed. It does not have to be an accident: the route
now reads the runtime's notifications only after the prompt, and only those
that name the turn it started, and the gate proves it against a runtime that
hands the thread's history back. **The room holds two turns in one session** —
the owner's two questions, the runtime's two answers, one thread, and the
second answer about the second question —
[the demonstration](demonstration-two-turns-2026-10-25.md),
[SPEC-R1-6](spec/r1-6-two-turns-one-session.md). The runtime's own memory
survived the turn as well: the second question carried no history, and the
runtime answered from the thread it kept.

**R2 has three demonstrated runtimes and two templates.** The presets are starting
points for the five named runtimes. Pi and OpenClaw are not installed here, and
an installed runtime is not yet a demonstrated one.

**The fifth slice closed the one item the rich-chat checklist still had open.**
The checklist names _files/images_, and the file half was delivered with the
third slice; the picture half was not, and the adapters' matrix said so in its
own words: the part carried the file's content as text, so a file whose bytes
were not text could not be carried, and _the protocol has an `image` block that
takes bytes, and that mapping is its own work_. The fix was in the shared
boundary and in each route's own shape: a picture is a part of its own, it
travels as bytes, and the ACP route sends the protocol's `image` block while
the Codex App Server route sends the bytes as an image by url — a data url, and
not a local image by path, because a path is a path on the runtime's machine.
The runtime's half was measured first: the installed Codex read a picture sent
either way. **The picture now reaches the runtime** —
[the demonstration](demonstration-content-images-2026-10-25.md),
[SPEC-R1-5](spec/r1-5-content-images.md) — and the room shows the picture.

**And the demonstration found the route validating against a stale copy of the
contract.** The panel composed a message the route refused with
`validation_failed`, and the owner was told nothing about why: the route kept
its own three-part union of content parts while the contract had grown an
attachment and an image. The route now uses the contract's own shape, and a
test says so for every part the contract publishes.

**R3 has a team room.** A coordinator dispatches to a worker, the worker runs, the
result returns, and the handoff is visible. See
[ADR 0011](decisions/0011-feature-slots.md) and the slice's own record for what
is partial.

**R4 has goals and dependencies.** A goal has a rollup and a task has
dependencies, with cycle rejection. Acceptance, verification and the delegated
loop are the outstanding work.

## Engineering review follow-ups (2026-10-23)

These are bounded implementation slices found during the repository review at
`644d33f`; they are not claims that the corresponding recovery stage is complete.
Inspect updated main and existing branches before assigning them. The evidence
and preserved-work locations are recorded in
[the review](engineering-review-2026-10-23.md).

- **R0: hold an expired worker lease as uncertain before replaying side effects.**
  **Delivered by [SPEC-R0-4](spec/r0-4-restart-reconciliation.md).** A stale job is
  settled by what the product knows: a run that had not started may be run again, a
  run that had started is never replayed, and the uncertain one is published as
  uncertain and waits for the owner.
- **Execution boundary: recover worker-owned connection probes from WI-077.**
  `agents.probe()` still constructs and connects adapters in the API process, which
  is the known exception on the architecture's rule 1. Port the queue-based probe
  behavior from `wi/077-agent-adapter-domain` without replacing newer capability
  revisions, lifecycle cleanup, grants or execution code.
- **R0/R3: make Bot dispatch retry-safe.** `bot.dispatch` accepts no request ID.
  Add an actor-scoped idempotency key and atomic creation of the delegation, task,
  execution and queue job through existing services.
- **R1/R2: persist native sessions and expose advanced capabilities coherently.**
  `AgentAdapterExtras` names native capabilities, but the common execution path does
  not project them into the product. Ordinary follow-ups are not proven to restore
  native context. — **Half of this is now closed by
  [SPEC-R1-6](spec/r1-6-two-turns-one-session.md):** an ordinary follow-up does
  restore the runtime's native context, measured against the installed App Server
  0.163.0 (the second turn answered with the word the first turn gave it, with no
  history in the prompt) and proved by the gate and by the room's own two turns.
  What is still open is the other half: the extras are named and not projected.
- **Platform: prove execution isolation and recovery outside the agent's authority.**
  CLI `cwd` and sanitized environment do not confine filesystem access. Define the
  project execution binding and least privilege, and test backup/restore including
  SQLite WAL, artifacts and encryption key handling.
- **Development configuration: replace retired persistent Bot role instructions.**
  Apply the current FACTORY.md through the plugin's supported settings or management
  API, retaining existing identities, memory and chats. Never edit live state.json.

## The parked branches

Work was done on branches that were never merged. It is parked, not lost:
every branch below is pushed to the remote, so nothing here is held on one
machine or in one worktree.

**A parked branch is a source, not a proposal.** The unit of work is a spec,
and a slice that takes something from one of these branches opens its own
spec, its own branch and its own review. Merging a parked branch wholesale
would bring its old base, its old decisions and its untested code with it.
Read the branch for what it proves, then write the slice that needs it.

| Branch                                                    | What it holds                                                            | Where it stands                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `feature/r1-1-codex-app-server`                           | The Codex App Server route and the gate that covers it                   | Landed: PR #33; [SPEC-R1-1](spec/r1-1-codex-demonstration.md) delivered    |
| `feature/r1-2-acp-permissions`                            | A runtime's permission request reaching the owner                        | Landed: PR #24; [SPEC-R1-2](spec/r1-2-opencode-demonstration.md) delivered |
| `wi/165-content-parts`                                    | A file the owner attaches reaching the runtime                           | Landed: PR #38; [SPEC-R1-3](spec/r1-3-content-parts.md) delivered          |
| `docs/adr-0012-slice-a`                                   | ADR 0012's first slice: the queue, the records and the priorities        | Live                                                                       |
| `chore/mcp-parity-named-spec`                             | The spec that will pair the broken windows                               | Live                                                                       |
| `wi/077-agent-adapter-domain`                             | The queue-based capability probe the R0 follow-up above ports from       | Preserved source; named in this document                                   |
| `wi/159-server-setup-cost`                                | The test setup cost work: a migrated image per suite, one batch per tree | Preserved source; the review measured it                                   |
| `wi/146-editor-probe-client`                              | WI-146's editor probes                                                   | Preserved source                                                           |
| `wi/136-a-type-cannot-be-named-without-an-implementation` | An unfinished merge the review kept                                      | Preserved source                                                           |
| `wi/133-dependency-audit-once`                            | The audit job's second pass, and its untracked resolver                  | Preserved source                                                           |
| `wi/038-borrow-rule-gate`                                 | A gate that checks every declared licence against the record             | Parked work; no spec yet                                                   |
| `wi/072-queue-index`                                      | The queue index                                                          | Parked work; no spec yet                                                   |
| `wi/132-panel-waiting-shape`                              | A published change to the waiting shape                                  | Parked work; a contract change, so it needs a spec                         |
| `wi/092-bundle-budget-timeout`                            | The bundle budget's own timeout                                          | Parked work; no spec yet                                                   |
| `wi/161-chat-class-surface`                               | The chat surface refactor: bubbles, message actions, a scrolling column  | Landed: the refactor reached `main` as #31, corrected on the way in        |

One of them has since landed. `wi/161-chat-class-surface` held the chat
surface refactor, preserved as a draft pull request. The refactor was then
ported onto `main` as its own slice and landed as #31, with the fixes the
branch lacked: the turn is an `<article>` again, the server's account of a
turn shows under the owner's own words, the four dropped browser tests are
back, and the community dependency is pinned and its licence recorded. The
branch keeps the commit it was written as. It is a source, not a proposal:
nothing further should be taken from it without a spec.

The branches that carry only a record - `wi/042`, `wi/062`,
`wi/077-author-shape-house-form`, `wi/103`, `wi/106` and `wi/119` - hold the
process record of a finished item, `.factory/work/WI-nnn.md`, which `main`
does not carry, and prose edits to `PRODUCT.md` and `CONTRACTS.md`, which
`main` does. Their prose has landed; their records have not, and they are
kept because how a decision was reached is still worth reading.

Three more hold something `main` does not have under any name:

- `wi/044-vendored-sources` - `docs/vendored-sources.json`, the inventory of
  source vendored into this repository's own tree. `main` carries
  `docs/dependency-licences.json`, which is a different record: the licences
  of the packages in the lockfile, not the code copied in beside it.
- `wi/088-ledger-state-and-history` - the factory's process history, moved out
  of `INTAKE.md` into `.factory/history.md`. `main` has replaced that
  arrangement with one record per item under `.factory/work/`.
- `wi/117-branch-pileup-verdict` - the same `INTAKE.md`, with a verdict on the
  branch pileup.

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
