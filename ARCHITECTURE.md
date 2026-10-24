# Architecture

**This is the constitution.** It says what the system is, what may never change,
and what the pillars are. It is deliberately short: a document nobody finishes
reading governs nothing.

Everything else has a home, and this document points at it rather than
restating it.

| Question                         | Where it is answered                           |
| -------------------------------- | ---------------------------------------------- |
| What does the product own?       | [PRODUCT.md](PRODUCT.md)                       |
| What shape crosses a boundary?   | [CONTRACTS.md](CONTRACTS.md)                   |
| What does each word mean?        | [glossary.md](glossary.md)                     |
| What is the work, in what order? | [docs/roadmap.md](docs/roadmap.md)             |
| Why is it like this?             | [docs/decisions/](docs/decisions/)             |
| How do I build one slice?        | [docs/feature-guide.md](docs/feature-guide.md) |

A rule in this document that names a check is enforced by that check. A rule that
does not name one is marked **prose only** and is kept alive by review rather than
by the build. The distinction is the point: this repository already holds the line
that _a rule nothing verifies is a claim_, and this document applies it to itself.

## 1. The direction

Personal OS is the environment one person's agents operate and extend.

The owner directs, approves and accepts. Conversation is the working surface: the
owner talks to an agent, watches what it does, answers its questions and inspects
what it produced, in one place. Team coordination and the product factory build on
that foundation rather than beside it.

Personal OS owns interaction, coordination and creation — conversations,
goals and tasks, observed executions, approvals, evidence, resources and
acceptance. External runtimes own reasoning, native tools and their own sessions.
Personal OS integrates them through their supported protocols; it does not
reimplement them.

Building, releasing and repairing Personal OS happens outside the instance, with
the repository, CI and ordinary coding tools. The product's own factory is a
feature of the product, never its prerequisite.

## 2. The shape of the system

Personal OS is a modular monolith with a separately supervised worker.

```text
Browser: conversation · activity · outputs · decisions
    ↕ authenticated HTTP commands and persisted SSE updates
API: validation · authorization · domain services
    ↕                          ↕
SQLite/WAL + artifact files ← Worker: queue · execution lifecycle
                                  ↕ supported runtime protocols
                     Codex · OpenCode · Pi · Hermes · OpenClaw
```

The server never runs an agent. It records an intent and enqueues work. The
worker owns runtime connections and writes events and state to the database; it
never calls the server to notify the browser. The server streams persisted
events; the browser never holds a runtime credential and never drives a harness.

One SQLite database in WAL mode holds the queue and the event log. It is the
whole deployment. Add infrastructure only for a requirement somebody has measured.

## 3. The non-negotiables

Nineteen rules. Ten were already gates; nine are checks this document adds.

| #   | Rule                                                                           | Proved by                                              | Status          |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------- |
| 1   | The API server never runs an agent                                             | `adapter-boundary.test.ts`                             | Partly enforced |
| 2   | The worker's runtime path reaches the server only through the database         | `verify:standards`                                     | Enforced        |
| 3   | One spine: cross-domain facts travel as events, never as direct table writes   | `domains.test.ts`                                      | Partly enforced |
| 4   | One sanctioned crossing: the capability API may read across every domain       | `domains.test.ts`                                      | Enforced        |
| 5   | Every shape that crosses a boundary is published once, in `packages/contracts` | `published-shapes.test.ts`                             | Enforced        |
| 6   | A module and a table belong to exactly one domain                              | `domains.test.ts`                                      | Enforced        |
| 7   | Every citation in the published contract points at code                        | `scripts/verify-contract-pointers.ts`                  | Enforced        |
| 8   | Every owner capability is also an agent capability                             | `verify:mcp-parity`                                    | Enforced        |
| 9   | No surface claims a capability that was not demonstrated                       | `verify:contracts`, `verify:standards`                 | Partly enforced |
| 10  | A resource update carries the revision it was based on                         | `acceptance-and-chain.test.ts`, `agent-memory.test.ts` | Enforced        |
| 11  | A credential's value never appears in a response                               | `agents.test.ts`, `agent-presets.test.ts`              | Enforced        |
| 12  | An agent's completion report is not acceptance                                 | `acceptance-and-chain.test.ts`                         | Enforced        |
| 13  | The core domain never names a provider                                         | `adapter-boundary.test.ts`, `verify:standards`         | Partly enforced |
| 14  | Every zod import is from `zod/v3`                                              | `verify:standards`                                     | Enforced        |
| 15  | A preset that claims a demonstration names the runtime it demonstrated         | `verify:standards`                                     | Enforced        |
| 16  | Every pillar here appears in the roadmap, and every stage names a pillar       | `verify:standards`                                     | Enforced        |
| 17  | No new infrastructure without a demonstrated requirement                       | `review`                                               | Prose only      |
| 18  | A migration that drops user data needs an explicit migration plan              | `review`                                               | Prose only      |
| 19  | Every work item is a spec and every decision is an ADR                         | `review`                                               | Prose only      |

Three of these carry a known exception, and each is named rather than hidden:

- **Rule 1.** No domain module may reach the package that holds the adapters,
  and only the composition root may name it. The capability probe in
  `modules/agents/service.ts` still establishes a runtime inside the API process.
  The roadmap owns that, and the rule is _partly_ enforced until it lands.
- **Rule 3.** Imports and table claims are checked. Table _writes_ across a
  boundary are declared in `domains.ts` with a reason and an owner, because
  proving them needs a data-flow analysis this repository does not have.
- **Rule 13.** The package edge is checked. The words are checked too, by
  `verify:standards`. Neither proves a provider cannot appear in a string
  somebody writes tomorrow, which is why it is _partly_ enforced.

Rules 17 to 19 are prose. They are kept by review, and they are marked so that
nobody mistakes them for gates.

## 4. The pillars

A **pillar** is a unit of product capability — the thing a person can be said to
own. A **domain** is a unit of code ownership, and the domain map is unchanged:
Interaction, Work, Resources, Runtime and Substrate, each owning its modules,
tables and contracts, checked by `domains.test.ts`.

The two are different axes and neither replaces the other. A pillar names the
domains it touches. The seam between two pillars is a published contract shape
or an event on the spine — never a table one pillar writes and another reads.

| Pillar        | Owns                                                                                                                | Touches              | Must not change                                     | Done means                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Chat**      | transcript, streaming, activity trace, attachments, previews, steer/queue/stop, permissions and questions, history  | Interaction, Runtime | the published message and event shapes              | the owner completes real work in one room with a named runtime, proved in a browser        |
| **Runtimes**  | the five runtimes: their adapters, presets, capability probing, session references, runtime artifacts               | Runtime              | the adapter interface and the capability shape      | each of the five has a tested capability row and a real chat demonstration                 |
| **Teams**     | participants, mentions, routing, handoffs, delegation, budgets                                                      | Interaction, Work    | the routing safeguards in `routing.ts`              | a coordinator delegates once, sees the real results and follows up without another kickoff |
| **Factory**   | goals, tasks, dependencies, evidence, acceptance, approvals, autonomy policy, measures                              | Work                 | the acceptance boundary                             | a goal produces inspected evidence and waits for owner acceptance                          |
| **Resources** | documents, dashboards, automations, data sources, memory, files, templates                                          | Resources            | the resource envelope (`schemaVersion`, `revision`) | a resource is created, edited, published and executed through the shared API               |
| **Platform**  | contracts, schema, the event spine, audit, auth, the queue and worker, the capability API, the panel shell, release | Substrate, Runtime   | the published contracts                             | every owner route has an agent equivalent, and the tree is green                           |
| **Plugins**   | isolated extensions: their own process, their own storage, enabled and removed through the API                      | Substrate, Runtime   | the first-class API and the event spine             | a plugin is installed, used through the API, and removed with nothing left behind          |

**Plugins** are the seventh pillar and the least settled. The contract shape is
fixed — a plugin is a process the host starts and stops, it keeps its own
storage, it reaches the product only through the first-class API and the event
engine, and removing it leaves nothing behind. The mechanism belongs to a spec,
and the spec does not exist yet.

## 5. Working in parallel

**One agent, one pillar, one worktree.**

Several agents work in this repository at once. They do not share a checkout, and
they do not share a pillar. An agent that is given a pillar works in its own
worktree on its own branch, and the branch is what lands.

The repository already has the tool — `npx tsx scripts/work-item.ts new WI-nnn
<slug>` — and [AGENTS.md](AGENTS.md) has the mechanics. What was missing was the
rule that an agent is _given_ a pillar rather than a vague slice, which is why two
agents sometimes reached for the same work.

The pillar map is also what stops two agents redesigning the same seam from
different directions. The **must not change** column is the short list of things
another pillar is relying on. If a slice needs to move one of them, that is a
contract change: it is proposed, reviewed and landed on its own, never slipped
into a slice that was about something else.

A pillar's scope is its declaration, not a file list. Two agents on two pillars
may legitimately touch the same shared file — the contracts barrel, the domain
manifest, the server's feature list — and the rule for those is additive change
plus a rebase, not a partition.

## 6. What this document does not settle

The **mechanism** behind each pillar — the process model, the storage model, the
packaging, the migrations — belongs to the spec that implements it. The pillar
map says what must be true and what must not change; the spec says how.

The **roadmap** orders the work and says what is outstanding. It is not a
history: what has landed lives in the spec that earned it and in the ADR that
decided it.

The **contracts** are the published shapes. They change deliberately, with a
migration story, and this document never changes them by implication.

## 7. Operating this build

See [README.md](README.md) for installation and [AGENTS.md](AGENTS.md) for the
gates. The current source stack is `npm run dev:stack`;
`deploy/install-service.sh` installs the supervised source stack with persistent
data outside the checkout. A health response does not prove agent execution.

The owner's password recovery command is `npm run reset:owner-password`,
implemented by `scripts/reset-owner-password.ts`. Its password argument is
visible in the host process list: another user on that host may read it. Use it
only on a trusted host and follow the README's recovery instructions. This
recovery plan does not change that command.

Schema migration on boot and code/schema rollback behavior must be checked before
a deployment claims safe rollback. Retain the external release/recovery boundary
from ADR 0010; its historical runbook describes procedures and limitations rather
than proof that every rollback scenario has been exercised.
