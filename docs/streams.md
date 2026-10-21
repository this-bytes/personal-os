# The three-day window — the streams

For a fresh agent with no memory of this repository. Read [AGENTS.md](../AGENTS.md) first, then [FACTORY.md](../FACTORY.md), then this file, then your work item.

## What this window is for

Three days of unlimited agent capacity, and the product ends it in a well-put-together state rather than a slightly larger one. The window is not a feature sprint. It is a window in which the factory's own machinery is made legible, the panel's visual language is made honest, and the product's report on itself is made true. Four streams do that work, and every one of them is small enough to be checked by someone who has not read the diff. What the window must also produce is a repository that a new agent can pick up without being told what is in flight — which is why the queue itself is one of the four items rather than something assumed.

## The four streams

| Work item                                                                     | Owner lane                                                   | What it delivers                                                                                                                                                                                                                                                                                 | What it depends on                                                                                                                                     | What it must not touch                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [WI-070](../.factory/work/WI-070.md) — the panel speaks AG-UI                 | Cog, in `apps/server/src/api/`                               | A pure projection from the existing server events to AG-UI 1.0, on an additive route, with the mapping published in CONTRACTS.md                                                                                                                                                                 | Nothing. `GET /api/events` stays exactly as it is, and the projection is a pure function over it                                                       | `GET /api/events`; the domain modules; the domain schemas in `packages/contracts/src`; an AG-UI client in the web panel |
| [WI-071](../.factory/work/WI-071.md) — the accent means one thing             | Cog for the component logic, Wren for the documentation half | One accent with one meaning — live or waiting on you — caution out of amber, and a written inventory of every amber site in the web client The briefs and `prototypes/DIRECTION.md`, which are on `main` under `prototypes/`; the owner's ruling on the conflict between them and PRODUCT.md §11 | The dashboards (brief 04) and the constellation (brief 06); the brief files themselves; the wholesale slate re-hue and the `indigo-` rename (brief 02) |
| [WI-072](../.factory/work/WI-072.md) — the queue is a file a program can read | Chief, in `scripts/` and `.factory/`                         | A YAML header on every item file, a generated `.factory/queue.json`, and `work-item.ts` with `queue --write`, `set`, `check` and `claim`                                                                                                                                                         | Nothing to start with. The migration of about fifty item files is the risk, and it is named as one                                                     | The meaning of the states — the transition table is the rule; any item's prose; a scheduler that dispatches on its own  |
| [WI-073](../.factory/work/WI-073.md) — the numbers are true                   | Cog, in the server and the web client                        | The existing measures branch audited against the five gaps in PRODUCT.md §7, repaired, and landed: a truthful audit outcome, a named test, and a contract that no longer lies                                                                                                                    | The owner's ruling on the three options in the item; the `wi/020-measures-route` branch rebased onto `main`                                            | A second measures route; rewriting a stored `createdBy` or an audit entry; the licence and visibility question          |

## The lanes, and the rule that two streams never touch one file

The lanes are FACTORY.md's, and they are what stops two agents writing the same file at the same time:

```
apps/server/src/**          Cog
apps/worker/src/**          Cog
packages/contracts/src/**   Cog
packages/agent-adapters/**  Cog
packages/ui/src/**          Cog
apps/web/src/**             Cog (component logic, class names)
**/*.test.ts, **/*.test.tsx Probe
apps/web/e2e/**             Probe
scripts/smoke.ts            Probe
scripts/verify-*.ts         Probe
*.md, docs/**               Wren
.github/workflows/**        Chief
package.json (root)         Chief
package-lock.json           Chief
LICENSE (root)              Chief
FACTORY.md, .factory/**     Chief
```

**Two streams never touch one file.** A bot that needs a file owned by someone else asks Chief; it does not take it (FACTORY.md:65). `docs/streams.md` is in Wren's lane, so a change to it goes through Wren.

**Where the lanes overlap, and why that decides the order.** WI-071 and WI-073 both sit in `apps/web/src/**` — WI-073 touches `apps/web/src/components/MeasuresBand.tsx` and `apps/web/src/pages/Conversations.tsx`. WI-070 and WI-073 both sit in `apps/server/src/**`. WI-072 touches every item file in `.factory/work/`, including the four items in this window. So WI-071 and WI-073 are **sequenced, not parallel**, and WI-072's migration lands before or after the other items' files are finalised, never during.

## The order, and why it is this order

1. **WI-072, the queue, and the `wi/046` merge come first.** Until the queue is readable and the domains-and-interaction-model architecture is landed, a stream's work cannot be dispatched and cannot be integrated. Everything below is easier once the repository can say what is in flight. WI-046's file lives on its own branch and not on `main`, so it is invisible to any checkout of `main` — which is the clearest example of the problem WI-072 exists to fix.
2. **WI-071, the accent, runs in parallel as soon as its lane is free.** It is the most visible product change in the window, and it is the one the owner has already ruled on.
3. **WI-073, the measures, is the fastest product win.** Most of it is written on `wi/020-measures-route`; what it needs is an audit, a repair and a landing. It lands an existing branch rather than starting a new tree, which makes it the cheapest win available.
4. **WI-070, AG-UI, can run last.** It is additive, it changes nothing that exists, and if it disappoints the projection and its route are deleted and nothing else moves. It also has the most to say about what the panel's agent-facing surface should be, and the panel's own surface is worth looking at after the visual language has settled.

The order is a statement about dependencies, not about worth. WI-070 is the item that decides what an outside agent can build against, and it is last because it is the one that can be last.

## The research under the streams

**AG-UI 1.0 — the target for the agent-to-UI event stream.** A published, versioned, MIT-licensed behavioural spec with JSON Schema as its source of truth and generated SDKs for TypeScript, Python and .NET. Thirty-one event types in eight families, on a SCREAMING_SNAKE_CASE wire format; every event carries `type`, `timestamp` and `rawEvent`, lifecycle events carry `threadId` and `runId`, and `RUN_STARTED` carries a required `protocolVersion`. Its transports are HTTP with SSE and HTTP with Protobuf, and resumption is protocol-level, by `threadId` and `runId`, with a `STATE_SNAPSHOT` for a client that reconnects after a gap. <https://docs.ag-ui.com/introduction>, and the spec's repository at <https://github.com/ag-ui-protocol/ag-ui>.

**Its honest limits.** AG-UI is **not ratified by a standards body**. It is a community protocol with a published 1.0 version marker. Its generative-UI story is a draft: its stable answer to "render this UI" is that the model emits a tool call whose result carries the payload and the client renders it. And because WI-070's layer is a pure projection, the fallback is one commit — delete the projection and the route, and nothing else changes.

**AG-UI and MCP are complements.** MCP is the agent-to-tools plane; AG-UI is the agent-to-user plane. A third format is not the answer.

**MCP Apps (SEP-1865) — and why it does not start in this window.** The MCP Apps extension lets a server ship UI to a host: pre-declared `ui://` templates the host can review before execution, plain MCP JSON-RPC so it stays auditable, and a host that can require explicit approval for UI-initiated tool calls. <https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/>.

- **PRODUCT.md §9 is out of date on one point.** MCP Apps merged as Final on 2026-01-28, and §9 still reads as though it is a proposal.
- **But the stable spec predates the MCP core rewrite of 2026-07-28**, which removed the initialize handshake, and that reconciliation has not been confirmed. **MCP Apps work must not start until it is.** WI-070 is the AG-UI half and does not depend on it.
- **The MCP Apps approval gate is host-local and ephemeral, and it cannot substitute for the product's Contract 5 approvals.** Any MCP Apps work must **layer on** Contract 5, never merge into it. The product's ledger is the record; the host's gate is a gate.

**The queue research.** How other tools make a work-item state machine real: GitHub's Agentic Workflows keeps Markdown task files as the source and generates the machine-readable view; Kubernetes's `hack/verify-generated-files.sh` regenerates and fails when the tree is dirty; GitHub's `dependencies/blocked_by` and Linear's `blocks`/`blocked` make a blocker a field rather than a state. WI-072 is that shape, applied to this repository.

## What the pipeline gets

**The CI verdict is readable on this machine.** `git credential fill` returns a `gho_` OAuth token with `repo` scope, and `GET /repos/this-bytes/personal-os/commits/<sha>/check-runs` returns the check runs for this private repository — ten of them on `origin/main`, all green: `Build and run the stack`, `Build and test`, `Dependency audit`, `Lint the workflows` and `Analyze (javascript-typescript)`. So the pipeline can require a CI verdict rather than substituting a local gate run for it.

Two traps, both worth knowing before writing the read-back: `GET /commits/<sha>/status` returns `total_count=0` here, because Actions reports through **Checks** and not through commit statuses; and a local unpushed sha returns `422`, not `404`, so read check-runs only for shas the remote has. **CI green is necessary but not sufficient** — it is the evidence for `implement → verify` and never for `review → accepted`.

## The number space

**One owner per tree, and sessions ask rather than take.** The number space has one owner: the session that leads implementation in a tree opens and numbers the items (FACTORY.md:296-307). A session with a gap to fill records it as a want and the session that owns the numbers creates the file. If the session that owns the numbers is not running, the other session says so in the group and takes the space rather than taking it quietly.

**What happened here.** WI-069 was taken by the number space owner in `8f87d87` while these four items were being written. They were renumbered to WI-070 through WI-073 as a result, and the collision is written into each item rather than left in a log. The strategy session took the next free numbers above all allocated ones because it had a gap to fill and the owner was not reachable to open the files. A number is never recycled and never renamed: a cancelled item keeps its number and its file, and a renumbered item keeps the history of both numbers in its own file.

**Numbers in this window:** WI-070, WI-071, WI-072 and WI-073 are these four. WI-030–WI-038, WI-044, WI-045, WI-062 and WI-065–WI-069 are the number space owner's; WI-024–WI-029 and WI-039–WI-043 belong to the other Chief session; WI-046–WI-064 are the strategy session's.

## How to start

1. **Read** [AGENTS.md](../AGENTS.md), then [FACTORY.md](../FACTORY.md), then this file, then your work item.
2. **Claim your number.** The table of items lives in `.factory/INTAKE.md`. If the session that owns the numbers is running, give it the want and let it open the file. If it is not running, say so in the group and take the next free number above all allocated ones.
3. **Make your worktree**, which gives you the branch and the claim:

   ```bash
   npx tsx scripts/work-item.ts new WI-nnn <slug>
   ```

   It creates the branch `wi/<nnn>-<slug>` and the worktree beside the repository, and it installs the dependencies. Work in that worktree, never in the main checkout.

4. **Work in it**, following your item's acceptance criteria. Where an item names a check, that is the check: name it, and let Probe write the test.
5. **Run the gates** your item lists, and run the ones that do not apply too, if only to say why they do not apply.
6. **Push your branch.** This needs no approval; it is yours, and CI gates it:

   ```bash
   git push -u origin HEAD
   ```

   Landing on `main` is a different thing. During this window the owner granted a **bounded** landing authority: a branch may be landed when every local gate passes, CI is green on that pushed branch, the branch is a descendant of `main`'s tip at merge time, no other session has an open dispatch on the same files, and the landing is reported. Anything that does not meet all five waits for the owner.

7. **Report with the actual gate output.** "Tests pass" is a claim; `Tests 158 passed (158)` is evidence. **An agent's report is a proposal.** Probe attacks it, and Chief decides.

## What must not be built

- **No custom workflow engine.** AGENTS.md rule 5. WI-072 makes the queue legible; it does not grow a workflow engine out of it.
- **No plugin marketplace.**
- **No new infrastructure without a demonstrated requirement.** No Redis, no Kubernetes, no PostgreSQL, no microservices. The queue is a file in the repository, because the repository is the state.
- **No forked protocol.** AG-UI is conformed to, not reimplemented: the event names are AG-UI's, the wire format is AG-UI's, and the product's own event contract does not become AG-UI-shaped.
- **No agent merging its own work.** A branch is pushed by its author and landed by someone else.
- **No weakening a gate.** No deleting a test to make a suite pass, no widening a lint rule, no loosening a type, no disabling a CI job that fails.
- **No scheduler that dispatches on its own.** It is a separate decision and it needs the owner. The measured failure in this repository is lost work, not mis-ordered work, and lost work is fixed by making the queue readable.
- **No auto-accept, no second verifier, and no database table for work items.** Two sources of truth is the drift, not the cure.
