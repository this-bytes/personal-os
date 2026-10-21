# Product

**Personal OS is an environment that one person's agents operate and extend.**

That is the owner's answer, given on 2026-10-20, and this document is the product's
copy of it. An environment agents operate and extend — not a chat home. The software
factory is a part of it, not the whole of it, and the panel is where the owner meets
it.

This document defines what the product owns, what it deliberately does not own, and
where v1.0 stops.

## 1. The owner's role

**The owner directs, approves and accepts. Agents do everything else.**

Everything the product does on its own is something the owner has already delegated.
The product asks the owner for authority in exactly three forms — direct it, approve
it, accept it — and the owner is the only one who can give any of them.

**One exception, and it is a trust decision rather than a decision.** Connecting a new
agent is not something the owner evaluates and then approves; it is something the
owner trusts. A connection is how something outside the instance acts inside it, with
the instance's data behind it, so the owner's answer to "connect this?" is not "is it
good?" but "do I trust it?".

## 2. Product ownership boundaries

Personal OS is responsible for three things.

1. **Interaction.** One interface for individual agent chats, group conversations,
   workspaces and generated content.
2. **Coordination.** Goals, tasks, agent assignments, automation, approvals and
   observed outcomes.
3. **Creation.** Agents can build and maintain dashboards, documents, automations and
   other supported resources.

It is **not** responsible for:

- implementing its own LLM inference engine,
- replacing existing agent frameworks,
- forcing external agents to use its internal task scheduler.

The last point matters, and it is a boundary the product holds rather than a feature
it has. When work is handed to an external orchestrator, Personal OS does not
recreate the other system's internals — and it does not mirror the work either.
What it stores today is an execution's `externalRef`, and the only value that ever
reaches it is an ACP session id: the path for a genuine external task id asks the
adapter for one, and no adapter implements it. No external status is retained, no
execution is ever marked as externally owned, and the panel shows neither the
reference nor the owner — `externalRef` and `executionOwner` do not appear in the
web client at all.

## 3. The one owner, and the agents

Personal OS has exactly one human user: the owner. That is a deliberate constraint,
not an oversight. Multi-user tenancy and organisations are out of scope for v1.0.

It does have many agents. Each connected agent is an independent runtime with its own
context, its own credentials and its own failure modes. Personal OS owns the shared
conversation history; each external agent owns its own runtime context.

## 4. Core concepts

### Conversation

The centre of the product. A conversation works with one agent, several agents, or
with no active agent at all. It carries:

- a **routing mode** — `mentions`, `coordinator` or `autonomous`,
- **participants** — humans and agents,
- **messages** with content parts (text, artifacts, files),
- **safeguards** — turn, time and spend limits, plus a pause switch.

Routing mode controls _routing_, never agent intelligence. A capable agent in
`mentions` mode is still capable; it simply is not woken unless it is addressed.

### Agent connection

A named, configured attachment to an external agent, reached through an adapter. A
connection carries a server-held configuration reference; credentials live in a
separate encrypted record and never leave the server. It also carries the **tool
grants**: the MCP tools that connection may call. The owner narrows them per
connection, and a tool that was not granted is not published to the agent at all.

Adding a new kind of agent must not require changing conversation storage or the
factory task model. That is the single most important extensibility boundary in the
product.

### Resource

A thing that exists independently of any conversation: a dashboard, a document, an
automation, a data source, a task or a memory item. Humans, agents and automations all
operate on resources through one shared API, and the validation is shared: each
kind's own provider validates its spec. The revision handling and the audit trail
are **not** uniform, and the product says so rather than smoothing it over. A
resource update compares `expectedRevision` and refuses on a mismatch; an
automation update increments its revision and never compares it, so the last write
wins. A resource update writes an audit entry; an automation update writes none.
And the worker's own `resource.refresh` action updates the resource row with no
revision bump and no entry.

A resource is not a chat message that got pinned. It survives the conversation that
created it.

**A resource is what "native" means for an agent-created feature.** An agent's
feature is a typed, validated resource in these contracts — one of the six kinds
above, with a spec its owning provider validates — and never a surface invented for
agents. **The third half of that is built.** The product publishes a template for
each of the six kinds, and an agent lists them and creates from one: the templates
are on the MCP surface as `resource.template.list`
(`packages/contracts/src/mcp.ts:21`), and `resource.create` takes a template and
builds the resource from the template's own spec
(`apps/server/src/modules/mcp/server.ts:363`, `:384-386`). A template is an
example, and the spec it carries is validated by the owning provider exactly as a
hand-written spec is.

### Factory

The work-tracking layer:

```
Goal -> Task -> Execution -> Evidence -> Acceptance
```

A goal survives changes in agents, sessions and provider accounts. A task keeps its
ownership even when the agent that performs it is disconnected. An execution may be
performed entirely by an external orchestrator; Personal OS stores the reference and
the evidence it can observe.

Acceptance is deliberately separate from completion. An agent saying "done" moves a
task to `review`; only an explicit acceptance decision closes it.

### Automation

A trigger and an authorised action. Automations are validated before they can be
enabled, they run in the supervised worker, and their runs are recorded.

A trigger is a schedule, an event, or a manual run. An event trigger names one of a
small allowlist of meaningful events, and every event carries the depth of the chain
that produced it — so two automations cannot wake each other forever.

## 5. Autonomy

Autonomy is optional and configurable per workspace and goal. Every autonomy policy
carries at least:

- execution limits (turns, duration, spend),
- the actions that are allowed,
- the operations that require approval.

**The policy is stored; it is not yet enforced.** A workspace's or a goal's autonomy
mode and policy are written and read back, but nothing reads them to make a
decision — the only mention outside the storage layer is a badge in the panel's
settings. The limits that are actually enforced are the conversation's own (see
[CONTRACTS.md](CONTRACTS.md), _Routing behaviour_), on a different object from the
one the policy is attached to. And there is no pause in a policy: the only pause in
the product is the conversation's own `paused` flag.

Manual is the default everywhere. An agent never gains authority by being added to a
group: adding an agent to a conversation changes who can be reached, not what that
agent is permitted to do.

In autonomous mode, an agent may only begin work through an approved trigger and
within its granted scope. The system must never create an unlimited agent-to-agent
response loop; the routing safeguards in [CONTRACTS.md](CONTRACTS.md) exist for
exactly that reason.

## 6. What the product is for every day

**Tasks/work and documents.** That is the owner's answer to what "everyday
productivity" means, and it is the scope the product is built around: the work the
owner asks for, and the things that come out of it.

Deliberately out of it: **email and calendar**. The owner's answer named them by
exclusion. An instance that reads someone's mail and writes their calendar is a
different product with a different trust boundary, and nobody has asked for it.

## 7. The product reports on itself

The product answers two questions about itself, and shows both in the panel:

1. **The share of features authored by agents in-instance** — of the resources that
   exist, how many an agent made rather than the owner.
2. **The share of operations done without the owner touching code** — of the routine
   work the instance does, how much of it the owner never had to hand-edit.

**The first measure has its data for four of the six kinds. The second is nearly
there, and the gap is named.** A dashboard, a document, a data source and a memory
item record who created it, so "which of these did an agent make?" is answerable
from the data the product already keeps. But an automation and a task record their
author as `system`, so for those two kinds the answer is **wrong**, not merely
uncounted.

The audit trail records the actor of most actions. Of the thirty-six routes that
change something, twenty-one write an entry at the route, three more write from
the service layer — an approval decision, an AG-UI run resume, and a task that
leaves `unknown` — and twelve write none: a capability probe, an agent token
revoked, a logout, an owner-token mint, an automation edited or deleted, a
conversation deleted, a participant added or removed, a goal, and a workspace
created or edited. An entry names who acted and what they acted on, and every
entry written today records a success whether the action succeeded or not —
`POST /api/resources/:id/execute` records one for a run that was merely queued.
The second measure's denominator is therefore a real question, and it is part of
what the owner has not settled.

**The two are counted, and the panel shows them.** `GET /api/measures` returns the
published shape for a workspace (`apps/server/src/api/measures.ts:17`), and the
panel shows the counts in a band of their own
(`apps/web/src/components/MeasuresBand.tsx`). Both are counted from the data the
product already keeps — the authorship a resource carries, and the entries the
audit trail holds — and not from a counter that is incremented on some code path.

**No ratio whose denominator is zero.** For a long while the honest value of "the
share of features authored by agents" is zero or undefined, because no agent has
authored a feature in-instance yet. A panel that greets its owner with 0% reads as
broken, and the product's first report on itself must not be a lie by omission. So
the counts are shown — N features, M operations — and a ratio is shown only when
there is a denominator to divide by.

## 8. What an agent-authored artefact needs

**An agent-authored artefact does not exist until something has checked it.**

This is the rule behind both working precedents of agent self-extension: a skill
authored under a typed contract with evals, and a workflow created under
validate-before-deploy and copy-before-edit. An agent that can write a thing with
nothing checking it has not produced a feature; it has produced a proposal.

**The ledger is where the product already does this.** Goal → task → execution →
evidence → acceptance. An execution carries the evidence the run produced, and a
task is closed by an explicit acceptance decision rather than by the agent's own
report that it is done. The check is the acceptance; the ledger is the shape.

## 9. The extension surface — a recommendation, not a decision

_This section records a recommendation. The owner has not chosen it yet._

**MCP Apps (SEP-1865)** is the standard for a server shipping its own UI to a host:
pre-declared `ui://` templates the host can review before execution, plain MCP
JSON-RPC so the exchange stays auditable, sandboxed frames, and a host able to
require explicit approval for UI-initiated tool calls. It is a proposal rather than
a ratified standard, and it requires a text-only fallback. It is the recommended
target for **agent-created UI**.

**AG-UI** is the recommended target for the **agent-to-UI event stream**.

**The host's approval gate stays in front of any agent-initiated call.** That part
is not a detail: it is the same shape as "the human decides", and it is the same
shape as the ledger.

**Scoped, so nobody reads this as a licence to fork something.** MCP Apps is a
different surface from a domain resource — it is about a server shipping its own UI
to a host, not about what a resource is. The panel's agent-facing surface is MCP and
AG-UI. ACP and A2A are the agent-connection side, which Personal OS speaks when it
connects out to an agent. **Our resources, tasks and goals stay ours, and no
protocol is forked.**

## 10. Borrowing, and the protocol boundary

**Borrow the idea, not the dependency.** Another project that solves part of what
we need is inspiration: read it, take the approach, and build the feature inside this
repository against our own contracts, schemas and data model. Personal OS does not
vendor a codebase in and does not take a runtime dependency to get a feature. The
doctrine keeps the rule itself in [FACTORY.md](FACTORY.md); this is the product-side
consequence of it.

**Every dependency is read, and the reading is published.** The dependencies we
do take are read in place — from the package's own licence file where it ships
one, and from the `license` field of its own `package.json` where it does not —
and the reading is published in
[docs/dependency-licences.json](docs/dependency-licences.json). The record holds
one entry for every package the lockfile installs: the file the licence was read
from, the lines of that file that identify the licence, the date it was read,
and the licences this project accepts with the reason for each. **The licences
are read, not assumed.**

**An interface is conformed to, never reimplemented.** Personal OS is a client of
ACP, A2A, MCP and the OpenAI-compatible API shape. "Our spec" means our domain
model, not our dialect of someone else's protocol.

**Where the boundary falls exactly is still open.** The reading in front of the
owner is recorded in ADR 7: the panel's agent-facing surface conforms to MCP and
AG-UI, ACP and A2A are the agent-connection side, and our resources, tasks and goals
stay ours. The owner is being asked to settle it.

## 11. The panel's own rules

**One accent with one meaning.** The rule is that the panel uses a single accent
colour, and it always means the same thing: live or waiting on you. Structure and
data stay in their own colours. Amber is the one collision that breaks it, because
in Forge amber always means live or waiting on you and never caution, so a caution
block has to become neutral or use the error colour. This is the rule that lets a
number be read at a glance instead of being decoration, and it is the one thing a
visual direction has to get right before the rest of the visual work matters.

**The panel does this now.** Its accent is amber, and it means one thing: live,
or waiting on you. Every row of the waiting rail wears it — an approval, a
task in review, an unknown outcome and a blocked item are all waiting on the
owner, and the four reasons a row can be there are carried by its label
rather than by four colours. A task awaiting acceptance and a streaming turn
wear it too. Structure stays in indigo — the active nav item, an agent's
messages, the app's own badge — and the event stream's state is a shape
rather than a colour: a filled disc when it is open, a dashed ring while it
is connecting, a hollow ring when it is idle. A caution is the neutral scale
or the error colour, never the accent. The tokens live in
`apps/web/src/index.css`, the inventory of every site that used to reach for
amber is in [docs/panel-accent.md](docs/panel-accent.md), and a test fails if
amber appears anywhere but the token layer. The direction is **D — Forge**,
chosen by the owner on **2026-10-21**, against the factory's recommendation of
**B — Desk**, and it is recorded in ADR 7.

## 12. What v1.0 deliberately leaves out

These are absent on purpose. Their absence is not an architectural limitation — the
resource, conversation and agent boundaries provide places to add them when there is a
demonstrated need.

- Multi-user tenancy and organisations
- Native mobile and desktop applications
- Full collaborative editing
- Custom agent inference and reasoning engines
- A general-purpose plugin marketplace
- Complex visual workflow programming
- Distributed task infrastructure
- A custom multi-agent orchestration framework
- Sophisticated automatic knowledge extraction
- Arbitrary agent-generated application code

## 13. Success criteria

A milestone is not delivered because an agent reported success. It needs a working
demonstration and tests that confirm its acceptance conditions.

The five milestones and their acceptance criteria are described in
[ARCHITECTURE.md](ARCHITECTURE.md#7-incremental-build-plan).
