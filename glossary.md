# Glossary

Personal OS has one vocabulary, and this file is it. A published contract, a field
name or a file name that still uses an older word is the wire's name for the same
thing, not a second concept.

Where the canonical term and the published name differ, the difference is named
here rather than renamed in the schema. The wire keeps its published names; the
conversation uses the terms below.

## The runtime side

**Runtime**:
An external harness that does the reasoning and the native tool work — Codex,
OpenCode, Pi, Hermes, OpenClaw. Personal OS does not implement one.
_Avoid_: harness, provider, model

**Adapter**:
The client Personal OS uses to talk to a Runtime over a supported protocol. It
reports what the runtime can genuinely do and emits only the events it can
genuinely observe.
_Avoid_: driver, connector, extension

**Connection**:
A Runtime configured for one workspace, together with its configuration, its
secret reference and the authority granted to it. A Connection is configuration;
it is not a running process.
_Avoid_: runtime, agent, session

**Session**:
The Runtime's own continuing context for a Conversation or a project. Its native
identifier belongs to the harness; Personal OS stores a reference to it.
_Avoid_: connection, run, conversation

**Workspace**:
The scope that owns the owner's data — conversations, resources, connections and
their records. Everything the product stores belongs to one.
_Avoid_: project, organisation, tenant

**Project**:
A declared execution location — a repository or directory, its instructions and
its permitted access — that work can be pointed at. A Project is not a Workspace
and owns no data of its own.
_Avoid_: workspace, repository, folder

**Capability**:
Something a Runtime can genuinely do, learned by probing rather than assumed. A
Connection's capability set is versioned, and a Run is admitted with the set that
was current when it was admitted.
_Avoid_: feature, support, permission

**Grant**:
The owner's permission for a Connection to use a named tool. A Grant is the
owner's authority over what an agent may do; it is neither an Approval nor a
Capability.
_Avoid_: permission, scope, approval

**Approval**:
A recorded decision on one pending action, carrying the decision's identity and an
expiry. It resumes the Run it was asked about and cannot be reused to authorize
another action.
_Avoid_: consent, grant, permission

## The work side

**Run**:
One bounded execution of agent work — a request submitted to a Runtime, the events
it produced, and the outcome. It is the unit the transcript and the ledger both
speak about. The published table and field keep their names (`executions`,
`executionId`).
_Avoid_: turn, execution, step, job

The tree still says _turn_ in places — `CONTRACTS.md`, `turn-end.ts`,
`TERMINAL_TURN_STATUSES`, and the published `WaitingKind` value `'turn'`. Those are
the wire's older names for this same thing, not a second concept. A slice brings
them into line; until then, _run_ and _turn_ mean one thing.

**Goal**:
An outcome the owner wants, enduring across runtime and provider changes. A Goal
holds Tasks and rolls up their progress.
_Avoid_: project, objective, milestone

**Task**:
A durable unit of delegated product work, with dependencies, evidence and an
acceptance decision. An assignee on a Task is a record; dispatch is a separate,
authorized act.
_Avoid_: work item, ticket, issue, run

**Delegation**:
A Task handed from one agent to another. A Delegation can narrow authority and
never widens it.
_Avoid_: bot task, sub-task, handoff request

**Evidence**:
An inspectable output that backs a claim — an artifact, a diff, a test report, a
resource. A text reply is an observation, not Evidence.
_Avoid_: proof, result, report, deliverable

**Acceptance**:
The owner's recorded decision that a Task's outcome is accepted. An agent's
report of completion moves work to review; only acceptance closes it.
_Avoid_: sign-off, approval, completion

**Spec**:
A bounded, user-visible outcome in the repository, with the contract change it
makes and the evidence that proves it. Specs are the unit of work in this
repository.
_Avoid_: work item, ticket, slice, plan

## The conversation side

**Conversation**:
The durable thread an owner and agents work in, holding participants, messages and
the shared transcript.
_Avoid_: room, thread, session, channel

**Participant**:
An agent, or the owner, taking part in a Conversation.
_Avoid_: member, agent, user

**Agent**:
An identity that acts: a name, its instructions, the capabilities it may use and
its optional memory. The identity is stable; the Run is not.
_Avoid_: bot, persona, runtime, participant

**Persona**:
The voice and role overlay applied to an Agent in a Conversation. A Persona changes
how an agent speaks and acts; it does not change its authority.
_Avoid_: agent, role, instruction set

**Event**:
A persisted fact on the one event log, carrying a sequence number and a chain
depth. Events are how facts cross a module, a process and a plugin boundary.
_Avoid_: message, activity, notification

**Activity**:
The derived, per-Run trace the panel shows — tool calls, results and state
changes, read from Events.
_Avoid_: event, log, trace

## Resources

**Resource**:
A typed, versioned product object with a payload, a schema version and a
revision — a document, a dashboard, an automation, a data source, a memory, a file.
_Avoid_: object, entity, artifact, record

**Artifact**:
A file that a Run produced, stored with validated metadata and provenance.
_Avoid_: resource, file, output, deliverable

**Template**:
A validated example of a Resource's payload, offered as a starting point. It is
not a second extension mechanism.
_Avoid_: preset, blueprint, scaffolding

## Extensions

**Feature**:
A surface of the panel that lives in this repository and is added at build time:
its own folder, its own routes, its own navigation entry. A Feature has no
lifecycle, cannot be removed at runtime, and cannot be installed from outside the
repository.
_Avoid_: plugin, extension, page, view

**Plugin**:
An isolated extension of the product: a process the host starts and stops, with
its own storage, reaching the product only through the first-class API and the
event engine. A Plugin can be enabled and removed through the API, and removing
one leaves nothing behind.
_Avoid_: feature, extension, marketplace, add-on

## The substrate

**Contract**:
A published shape that crosses a boundary — an HTTP body, an MCP tool, a queue
payload, an adapter event. Contracts live in one package and are changed
deliberately.
_Avoid_: schema, type, interface, api

**Domain**:
One of the five ownership units — Interaction, Work, Resources, Runtime, Substrate.
A Domain owns its modules, its tables and its contracts.
_Avoid_: pillar, module, layer, service

**Pillar**:
One of the units of product capability that work is dispatched against — Chat,
Runtimes, Teams, Factory, Resources, Platform and Plugins. A Pillar owns an
outcome; a Domain owns the code.
_Avoid_: domain, module, team, milestone

**Capability API**:
The one sanctioned crossing between Domains: the shared surface through which a
person and an agent operate on the same objects by the same code path.
_Avoid_: service layer, api, facade

## People and authority

**Owner**:
The one human the product serves. The Owner directs, approves and accepts.
_Avoid_: user, admin, operator, customer

**Authority**:
What a caller is permitted to do, resolved from its Connection's grants and the
autonomy policy. Authority can be delegated and can never be widened by
delegation.
_Avoid_: permission, access, rights

## The pillars

A pillar is a unit of product capability. Each one is what work is dispatched
against, and each one owns an outcome rather than a set of files.

**Chat**:
The pillar that owns the conversation surface — transcript, streaming, activity
trace, attachments, previews, steering, stopping, permissions, questions and
history.
_Avoid_: messaging, inbox, rooms

**Runtimes**:
The pillar that owns the five adapter targets: their adapters, presets, capability
probing, session references and the artifacts they produce.
_Avoid_: adapters, harnesses, providers

**Teams**:
The pillar that owns rooms and coordination — participants, mentions, routing,
handoffs, delegation and the budgets that bound them.
_Avoid_: rooms, group chats, coordination

**Factory**:
The pillar that owns goals, tasks, dependencies, evidence, acceptance, approvals,
the autonomy policy and the measures.
_Avoid_: projects, backlogs, planning

**Resources**:
The pillar that owns what the product stores and what agents build — documents,
dashboards, automations, data sources, memory, files and templates. It names the
same scope as the Resources domain, from the other axis.
_Avoid_: content, library, catalogue

**Platform**:
The pillar that owns contracts, schema, the event spine, audit, auth, the queue
and worker, the capability API, the panel shell, and release and recovery.
_Avoid_: infrastructure, foundation, plumbing

**Plugins**:
The pillar that owns the isolated extension surface — plugins with their own
process and their own storage, enabled and removed through the API.
_Avoid_: extensions, add-ons, modules
