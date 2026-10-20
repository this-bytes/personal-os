# Product

Personal OS is an agent-native control panel and personal software factory.

This document defines what the product owns, what it deliberately does not own, and
where v1.0 stops.

## 1. Product ownership boundaries

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

The last point matters. When work is handed to an external orchestrator, Personal OS
retains the external task id and status instead of creating a competing internal
workflow. Personal OS shows the work, the references and the results — it does not
recreate the other system's internals.

## 2. The three audiences

Personal OS has exactly one human user: the owner. That is a deliberate constraint,
not an oversight. Multi-user tenancy and organisations are out of scope for v1.0.

It does have many agents. Each connected agent is an independent runtime with its own
context, its own credentials and its own failure modes. Personal OS owns the shared
conversation history; each external agent owns its own runtime context.

## 3. Core concepts

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
operate on resources through one shared API with the same validation, the same
revision handling and the same audit trail.

A resource is not a chat message that got pinned. It survives the conversation that
created it.

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

## 4. Autonomy

Autonomy is optional, configurable per workspace and goal, and bounded everywhere it
appears. Every autonomy policy carries at least:

- execution limits (turns, duration, spend),
- the actions that are allowed,
- the operations that require approval,
- a way to pause the work.

Manual is the default everywhere. An agent never gains authority by being added to a
group: adding an agent to a conversation changes who can be reached, not what that
agent is permitted to do.

In autonomous mode, an agent may only begin work through an approved trigger and
within its granted scope. The system must never create an unlimited agent-to-agent
response loop; the routing safeguards in [CONTRACTS.md](CONTRACTS.md) exist for
exactly that reason.

## 5. What v1.0 deliberately leaves out

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

## 6. Success criteria

A milestone is not delivered because an agent reported success. It needs a working
demonstration and tests that confirm its acceptance conditions.

The five milestones and their acceptance criteria are described in
[ARCHITECTURE.md](ARCHITECTURE.md#7-incremental-build-plan).
