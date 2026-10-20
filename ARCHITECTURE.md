# Architecture

This document describes how Personal OS is put together, why, and what the current
implementation actually does.

## 1. Shape of the system

```
Personal OS clients
        │
        │  Responsive Web / PWA · Desktop · Mobile
        ▼
┌──────────────────────────────────────────────┐
│ Personal OS server                           │
│                                              │
│  Conversations ── Agent connections          │
│         │                    │              │
│         └──── Factory & tasks ┘              │
│                                              │
│  Automations · Dashboards & docs             │
│  Workspaces & memory                         │
│                                              │
│  Shared capability API                       │
│  (common operations for humans, agents,      │
│   automations)                               │
└──────────────────────────────────────────────┘
        │                      │
        ▼                      ▼
   Execution            Persistence
   ACP·A2A·CLI·APIs·MCP  SQLite · Files · Execution history
        │
        ▼
┌──────────────────────────────────────────────┐
│ Personal OS worker (supervised)              │
└──────────────────────────────────────────────┘
```

Personal OS is a **modular monolith with a separate supervised execution process**.

That is still a small application, but the split prevents a failing or compromised
agent CLI from taking down the API server. The API server never runs an agent
itself: it decides _what_ should run, records the outcome, and streams progress.

### Why the worker is a separate process

Agent execution is the one part of the system that runs untrusted code. A CLI agent
is a subprocess the owner chose to trust; an MCP server or a gateway may be a remote
system behaving unexpectedly. Keeping that work out of the API process means:

- a crashed agent cannot take the server with it,
- a long-running agent cannot block an HTTP request,
- the server can be restarted without interrupting running work.

The two processes coordinate through the same SQLite database. There is no broker,
no message bus and no second datastore.

## 2. Technology baseline

| Component            | Decision                                     |
| -------------------- | -------------------------------------------- |
| Runtime              | Node.js LTS                                  |
| Language             | TypeScript                                   |
| Backend              | Fastify                                      |
| Frontend             | React + Vite                                 |
| UI                   | Tailwind + shadcn-style components           |
| Database             | SQLite, WAL enabled                          |
| Database access      | Drizzle ORM                                  |
| Real-time            | SSE for server-to-client updates             |
| Local storage        | Filesystem with database metadata            |
| Background execution | SQLite-backed queue and worker               |
| Authentication       | Single-owner local authentication            |
| Agent runtime        | Adapter registry and supervised subprocesses |
| Deployment           | Docker Compose                               |
| Testing              | Vitest + Playwright                          |

These are implementation defaults. They can change if a proof of concept identifies a
concrete limitation.

**Not introduced, and not to be introduced without demonstrated need:** Redis,
Kubernetes, PostgreSQL, microservices, a plugin marketplace, a custom workflow engine.

The whole system should be straightforward for another person to install from an
open-source repository.

## 3. Processes and their boundaries

### The API server (`apps/server`)

Owns conversations, agent connections, resources, the factory, automations and the
MCP endpoint. It never executes an agent.

Modules are separated by concern inside one process — `conversations`, `agents`,
`resources`, `factory`, `automations`, `capabilities`, `events`, `mcp` — but none of
them is a service in the microservice sense. They are plain modules over one
database handle.

### The worker (`apps/worker`)

Claims jobs from the queue, runs adapters, writes results back. Three job types:

| Job               | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `chat.turn`       | Runs one agent turn for one conversation.               |
| `factory.execute` | Runs an agent against a factory task, records evidence. |
| `automation.run`  | Runs a due automation.                                  |

The worker also owns the automation scheduler: every thirty seconds it looks for
automations whose next run is due and enqueues them. It moves the schedule forward
_before_ enqueueing, so a slow run cannot cause the same automation to be queued
twice.

The worker also owns the **event watcher**, which makes event-triggered automations
work. It tails the persisted event log and enqueues any enabled automation whose
trigger names the event that just happened. Because it reads the log rather than
subscribing in-process, an event published by the API server triggers an automation
exactly like an event published by the worker.

Two guards stop an automation chain from running forever:

- Only allowlisted events can be triggers at all. `execution.event` and `heartbeat`
  are excluded because they fire constantly and carry no meaning as a trigger.
- Every event carries the **chain depth** it was produced at. An event at the maximum
  depth (3) triggers nothing, so at most three automation hops can follow one
  another.

### The web client (`apps/web`)

A React single-page application. It talks to the API over HTTP and subscribes to
`/api/events` for live updates. It never holds a credential for an external agent and
never talks to a database directly.

## 4. Data flow of a chat turn

1. The user posts a message to `POST /api/conversations/:id/messages`.
2. The conversation service stores the message with a **correlation id** and an
   **origin** (`human`, `agent`, `system` or `automation`).
3. The routing engine decides who should receive a turn. The decision is pure logic
   over the conversation, the participants, the message and the current chain state.
4. For each target agent connection, the server creates an `executions` row and
   enqueues a `chat.turn` job.
5. The worker claims the job, builds the adapter, creates the agent's reply message
   in `streaming` state, and iterates the adapter's event stream.
6. Every `message.delta` is appended to the reply and published to the event log.
   The web client renders it live.
7. On completion the message is marked `complete` and the execution is closed.

The reply message is written to the database _while it streams_. A browser that
reconnects mid-answer sees the partial answer, and an answer that outlives the
connection is not lost.

### The echo-loop guard

Three mechanisms work together:

- **Correlation id** — every turn derived from one human request shares it.
- **Reply link** — an agent's reply records the message it answers.
- **Duplicate check** — before dispatching, the server looks for an existing reply
  from that agent, in that chain, to that exact parent message. If one exists, the
  dispatch is skipped.

On top of that, an agent's message never automatically wakes every other
participant. In `mentions` mode it wakes nobody unless it mentions somebody. In
`coordinator` mode only the coordinator may delegate, and only explicitly. In
`autonomous` mode the same rule applies to agent messages, while a human message
reaches the full participant scope.

## 5. Persistence

SQLite in WAL mode. The database lives on a local filesystem — **not** a network
share, because SQLite locking is not reliable there.

| Table                                       | Holds                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `users`, `sessions`                         | The single owner and their sessions.                               |
| `workspaces`                                | The unit of access scoping, with the autonomy policy.              |
| `agent_connections`                         | Connections, capabilities, status.                                 |
| `secret_configs`                            | Encrypted adapter configurations and credentials.                  |
| `conversations`, `participants`, `messages` | The conversation model.                                            |
| `executions`, `execution_events`            | What ran, and what it reported.                                    |
| `queue_jobs`                                | The worker queue.                                                  |
| `goals`, `tasks`, `evidence`                | The factory.                                                       |
| `resources`, `resource_files`               | The shared resource store.                                         |
| `automations`, `automation_runs`            | Scheduling and run history.                                        |
| `audit_log`                                 | Who requested an action, which agent performed it, and the result. |

Migrations are generated with drizzle-kit and applied at boot by the migrator. The
schema, the migrations and the runtime share one definition.

### The event log doubles as the stream

Every event the client can see is written to `execution_events` with a monotonic
sequence number, and the SSE endpoint tails that table. This has two consequences
worth stating:

- The server can restart without losing the event stream.
- Events produced by the _worker_ reach the browser through exactly the same path as
  events produced by the _server_. There is one mechanism, not two.

The SSE endpoint replays the fifty most recent events on connect, so a reconnecting
client converges on the current state.

## 6. Security posture

| Area              | How it is handled                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | One owner account. scrypt password hashing, opaque session tokens stored as SHA-256 digests.                                                                                                                                                                              |
| Network           | Private by default. TLS belongs to the reverse proxy in front of the container.                                                                                                                                                                                           |
| Agent credentials | AES-256-GCM encrypted at rest. The key lives in `PERSONAL_OS_SECRET_KEY` or a generated `data/secret.key`. Never returned to a client.                                                                                                                                    |
| CLI execution     | Sanitised environment (no server secrets inherited), bounded working directory, hard timeout, cooperative cancellation.                                                                                                                                                   |
| Workspaces        | Server-enforced scoping. The client never supplies its own scope.                                                                                                                                                                                                         |
| Agent actions     | Explicit grants per connection. Adding an agent to a conversation does not change its permissions.                                                                                                                                                                        |
| MCP               | Bearer token required. An agent token is MCP-only — it cannot reach the owner's HTTP API at all. It is scoped to one connection and exposes only the tools that connection was granted; an ungranted tool is not registered, so it does not even appear in the tool list. |
| Outbound requests | Data sources and `http.request` actions are checked against an SSRF guard: only `http`/`https`, and never a private, loopback or link-local address. Opt out with `PERSONAL_OS_ALLOW_PRIVATE_TARGETS=true` for a trusted LAN deployment.                                  |
| Data sources      | Read-only, single statement, and restricted to an allowlist of tables. `users`, `sessions`, `secret_configs`, `agent_tokens` and `audit_log` cannot be read by a data source.                                                                                             |
| Recovery          | Database and files are in one directory and are backed up together. Restore is a file copy.                                                                                                                                                                               |

**One essential rule for a self-hosted open-source product:** never give every
connected agent unrestricted access to the Personal OS host merely to make
integrations easier. An agent may be allowed to work on one directory, use one tool,
or create a dashboard — without receiving authority over the whole server.

The CLI adapter enforces this as far as a portable process can: it drops the server's
environment, confines the working directory, and caps runtime. **It is not a
sandbox.** Strong isolation is the deployment's job — run the worker container with a
read-only root filesystem, no host mounts beyond the agent's own directory, and no
access to the Personal OS secret key.

## 7. Incremental build plan

Five milestones. Each one has a working demonstration and tests, not just an agent's
claim of success.

### 01 — Foundation and first agent chat

Web UI, login, workspaces, conversations, persistence, one working agent adapter.

**Acceptance:** chat with an agent, reload or restart the server, and retain the
conversation. — _implemented_

### 02 — Agent interoperability and group chats

A second, architecturally different adapter, capability discovery, participants,
mentions and configurable group routing.

**Acceptance:** two different agent types participate in one group conversation
without modifying conversation storage or the first adapter. — _implemented: six
adapter types, capability discovery, mentions, coordinator and autonomous routing_

### 03 — Personal software factory

Goals, tasks, assignments, execution status, evidence and a work overview. Support
for directly managed and externally delegated work.

**Acceptance:** an agent can receive a task, report progress and produce a result
that persists independently of its conversation. — _implemented, including the
distinction between an agent reporting completion and acceptance_

### 04 — Agent-built dashboards and automations

Resource API, MCP tools, data-source bindings, dashboard widgets, a persistent
scheduler.

**Acceptance:** an agent creates a dashboard, configures its refresh, and verifies it
updates after a server restart. — _implemented: resource API with revision
semantics, MCP tool surface, dashboard and document providers, cron scheduler_

### 05 — Autonomy and richer applications

Scoped autonomous goals, review workflows, document editing, richer dashboards and
improved memory.

**Acceptance:** an authorised agent progresses a goal, creates or updates useful
resources, and exposes evidence for human review. — _partially implemented: scoped
autonomy policies, review and acceptance workflow, evidence capture_

## 8. How it is tested

Four layers, each answering a different question:

| Layer                | Command                      | What it proves                                                                                                                                                                             |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit and integration | `npm run test`               | 130 tests across contracts, adapters, server and worker: routing safeguards, queue leases, resource revisions, the acceptance boundary, guards, MCP grants.                                |
| End-to-end           | `npx tsx scripts/smoke.ts`   | 42 checks against a real server and worker on a throwaway database: setup, a chat turn, concurrency, acceptance, audit, approvals, MCP, and an event-triggered automation actually firing. |
| Browser              | `npm run test:e2e`           | Playwright drives the built client in headless Chromium: the owner creates the account, narrows an agent's MCP tool grants, and builds an event-triggered automation.                      |
| Deployment           | `scripts/verify-compose.ps1` | The Compose stack starts, the server becomes healthy, the worker runs, and the client is served.                                                                                           |

The browser tests run against the **built** client that the server serves, not the
Vite dev server, so they exercise the same bundle that ships.

## 9. Known limitations

These are real, and deliberately not hidden:

- **The CLI adapter is supervised, not sandboxed.** See the security note above.
- **The event stream polls.** The SSE endpoint tails the event table every 250 ms
  instead of holding a connection to the worker. The worker's event watcher polls
  the same table every 500 ms. For a personal instance this is invisible; it would
  not scale to many clients.
- **Only the OpenAI-compatible model API shape is implemented.** Other providers need
  an adapter.
- **ACP sessions are not resumed.** The adapter creates a session per turn. Native
  `session/load` is supported by the protocol but not used yet. The published
  contract has already moved: `CONTRACTS.md` says a turn re-enters the same session
  when the adapter reports `persistentSessions` (WI-007). The code has not caught
  up.
- **Data sources are read-only and table-scoped.** SQLite data sources accept a
  single `SELECT` over an allowlist of tables. Credentials, sessions and audit
  records are deliberately not readable.
- **An approval closes its execution; it does not resume it.** When an agent asks
  for approval, the execution is marked `blocked` and the request is recorded.
  Deciding the approval finishes the execution with the decision's outcome — it
  does not re-enter the adapter and continue the interrupted turn. Resuming a
  blocked adapter turn needs a protocol-level resume that not every adapter
  supports. `CONTRACTS.md` now publishes the opposite as the contract — a decision
  resumes the turn when the adapter reports `persistentSessions` (WI-007) — and the
  code still closes the execution.
- **A single owner.** No teams, no sharing, no permissions beyond "this workspace".
- **There is no email delivery, so there is no reset link.** The owner account is
  created at first run and there are no default credentials. A forgotten password is
  replaced from the command line (`node apps/server/dist/index.js --reset-password`),
  which keeps every conversation, resource and task and signs out the sessions the
  old credential produced. The new password is passed as a command-line argument, so
  it is visible in the host's process list for as long as the command runs, and
  another user on the host can read it there.
- **No native desktop or mobile client.** The web client is responsive and
  installable as a PWA.
