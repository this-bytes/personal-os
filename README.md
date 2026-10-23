# Personal OS

**The environment one person's agents operate and extend.**

**Current build direction:** rich chat across independent agent harnesses, then
autonomous teams and the product factory. See the [recovery decisions](docs/recovery.md)
and [delivery sequence](docs/roadmap.md). These are approved targets, not a claim
that the features already work.

Personal OS is a single, self-hosted instance that gives you one place to talk to
agents, run group conversations, and let agents build the things you need —
dashboards, documents, automations, data sources, tasks and memory.

It is not a chat frontend with a plugin bolted on. Conversations, resources and the
software factory share one contract set, so an agent can operate on exactly the same
objects you do.

---

## What it is

|                  |                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **Interaction**  | One interface for individual agent chats, group conversations, workspaces and generated content. |
| **Coordination** | Goals, tasks, agent assignments, automation, approvals and observed outcomes.                    |
| **Creation**     | Agents build and maintain dashboards, documents, automations and other supported resources.      |

Personal OS does **not** implement its own inference engine, replace existing agent
frameworks, or force external agents onto its internal scheduler.

## Quick start

```bash
git clone <your-fork> personal-os && cd personal-os
npm ci
npm run build

# Terminal 1 — the API server
npm run dev

# Terminal 2 — the execution worker
npm run dev:worker

# Terminal 3 — the web client
npm run dev:web
```

Open <http://localhost:5173>. The first run asks you to create the owner account.

The built-in **Echo** agent works without external setup and exercises basic
messaging/execution plumbing: mention an agent and watch it reply. It does not
prove real-harness tool use or delivery of a requested artifact.

### One command for all three

The three processes can also be started together:

```bash
npm run dev:stack
```

The stack runs the shared packages from their TypeScript rather than from their
compiled output, so a change to a contract or to an adapter reaches the running
instance instead of waiting for a rebuild. It watches the server, the worker, the
contracts and the adapters, and restarts only what a change affects. The web
client reloads in place.

Development commands validate the installed workspace dependency tree first.
When dependency manifests or the lockfile change, the combined stack drains and
stops. Run `npm ci` in that checkout and restart it. Each worktree and operating
system needs its own installation; share npm's download cache, not `node_modules`.

The development launcher requests graceful worker shutdown so the current turn
can finish. A crash or forced termination can still interrupt it. Lease expiry
alone does not prove that an external side effect stopped: restart reconciliation
and uncertain-outcome handling must be verified per runtime. The R0 recovery stage
closes remaining gaps rather than promising safe replay.

`PERSONAL_OS_PORT` and `PERSONAL_OS_WEB_PORT` move the stack off the default
ports, which is how it runs beside a deployment that already holds them:

```bash
PERSONAL_OS_PORT=4318 PERSONAL_OS_WEB_PORT=5174 npm run dev:stack
```

This is the same code the deployment runs, started from the checkout rather than
from an image: a change to it reaches the running instance as it is written.
The source-hosted service below keeps the development instance running and follows main.
When the point is to see the current code rather than the shipped artifact,
run the source stack; see "Host from source during development" below.

### There are no default credentials

Personal OS has no built-in login. The owner account is created the first time you
open the instance, and that setup screen is the onboarding: it asks for a display
name, an email and a password, and the account it creates owns every workspace.

Once the owner exists, the login screen asks for that email and password. If you
forget them, the password can be replaced in place — the conversations, resources
and tasks are not affected, and every open session is signed out:

```bash
# On the host
npx tsx scripts/reset-owner-password.ts "<new password>"

# For the hosted instance, use its data directory
PERSONAL_OS_DATA_DIR="$HOME/.local/share/personal-os/data" npm run reset:owner-password -- "<new password>"
```

**The new password is visible to other users on the host while the command
runs.** It is passed as a command-line argument, so it appears in the host's
process list for as long as the command runs, and another user on the host can
read it there — in `/proc/<pid>/cmdline` on Linux, in the process table on
macOS and Windows. The checkout form puts it in the list twice: once for the
`tsx` process you started, and once for the server it spawns. The command is
in your shell's history as well.

There is no way around that with the forms above. Nothing else sets the
password — the setup screen only runs once, and no route changes it
afterwards — so recovering a forgotten password means putting the new one on a
command line, and whoever reads the process list while it runs holds the
password to your instance. Run it on a host whose other users are ones you
trust.

For headless access — an MCP client, a script — the instance also takes a static
owner token. Set `PERSONAL_OS_OWNER_TOKEN` in `~/.config/personal-os/stack.env` and send it as a bearer
credential:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_OWNER_TOKEN" http://localhost:4317/mcp
```

That token is the owner, so treat it like a password.

### Host from source during development

Use a Linux filesystem checkout on `main` (including under WSL), with its own
`node_modules`. Install Node from `.nvmrc`, then:

```bash
bash deploy/install-service.sh
```

The panel is on <http://localhost:5173>; Vite proxies `/api` and `/mcp` to the
API on port 4317. The user service survives terminal closure and restarts after
crashes. For startup without a login, enable user lingering once with
`sudo loginctl enable-linger "$USER"`.

Configuration lives in `~/.config/personal-os/stack.env`. Data defaults to
`~/.local/share/personal-os/data`, outside the checkout. Keep this directory and
the encryption key together when backing up or moving an instance. An existing
Docker volume must be backed up and copied explicitly; switching launchers does
not migrate it. Never run two stacks against the same database during a move.

The update timer checks `origin/main` every 30 seconds. It refuses dirty or
diverged checkouts, drains the stack before a fast-forward, then restarts it.
Changed dependencies are installed before startup. A manual pull into `main`
also triggers a full restart. Active worker turns get up to 30 minutes to drain;
updates have a brief outage and do not promise uninterrupted remote executions.

```bash
bash deploy/update.sh                     # update now
systemctl --user status personal-os-stack
journalctl --user -u personal-os-stack -f
systemctl --user disable --now personal-os-update.timer  # pause automatic pulls
npm run verify:source                     # same disposable source-hosting test as CI
npm run verify:stack -- http://127.0.0.1:5173 # writes test agent/conversation to your instance
```

For foreground operation, use `bash deploy/source-stack.sh`. Ordinary source
edits reload the affected process; dependency, migration, launcher and commit
changes drain the entire stack. Foreground operation needs a manual restart
after a full drain; the installed service handles it automatically.

The listener binds to `0.0.0.0` by default. LAN access needs the host firewall
and, on WSL, Windows networking configured to reach port 5173. Application
startup does not create containers or change firewall rules.

## Connecting an agent

Agent connections are adapters. Personal OS ships with seven:

| Adapter | Use it for                                                                           |
| ------- | ------------------------------------------------------------------------------------ |
| `echo`  | A built-in deterministic agent. No configuration, no network.                        |
| `cli`   | A local command-line agent. Supervised process, sanitised environment, hard timeout. |
| `acp`   | An [ACP](https://agentclientprotocol.com)-compatible agent (session oriented).       |
| `a2a`   | An [A2A](https://a2a-protocol.org)-compatible agent (task oriented).                 |
| `http`  | Any framework-specific gateway with a JSON or SSE endpoint.                          |
| `model` | A model API without a full external harness (OpenAI-compatible chat completions).    |
| `mcp`   | An MCP server exposing an agent tool, initialized before sending a turn.             |

Add one under **Agents**. Credentials are posted once, encrypted at rest on the
server, and never returned to the browser.

## External agents, over MCP

Personal OS publishes its own capabilities as an MCP server at `/mcp`. A compatible
external agent can list workspaces, read and post to conversations, manage tasks, and
create or update resources.

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_OWNER_TOKEN" \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
     http://localhost:4317/mcp
```

Issue a per-agent token under **Agents → Tokens**. An agent token is scoped to that
connection: it sees only the tools it is allowed to use.

## Repository layout

```
personal-os/
├── apps/
│   ├── server/           # API and business logic
│   ├── worker/           # Agent and process execution
│   └── web/              # React control panel
├── packages/
│   ├── contracts/        # Shared schemas and types
│   ├── agent-adapters/   # ACP, A2A, CLI, HTTP, model adapters
│   └── ui/               # Reusable components
├── docs/
│   ├── spec/             # The work queue: a spec is the unit of work
│   ├── roadmap.md        # The recovery stages the specs deliver
│   ├── feature-guide.md  # How to implement a complete slice
│   └── decisions/        # Architecture decision records
├── deploy/
│   ├── install-service.sh
│   ├── update.sh
│   └── source-stack.sh
├── .factory/             # Read-only history (ADR 0012); compact contract evidence
├── PRODUCT.md            # What this is and what it is not
├── ARCHITECTURE.md       # How the pieces fit together
├── CONTRACTS.md          # The published contracts
├── AGENTS.md             # Rules for coding agents working in this repo
└── FACTORY.md            # The retired out-of-band workflow, kept as history
```

## Documentation

- [docs/spec/](docs/spec/) — the work queue: a spec is the unit of work (ADR 0012)
- [docs/roadmap.md](docs/roadmap.md) — the recovery stages the specs deliver
- [docs/adapters.md](docs/adapters.md) — runtime integration research
- [docs/reuse-inventory.md](docs/reuse-inventory.md) — what the chat surface takes from other people's code, and what it still has to build
- [PRODUCT.md](PRODUCT.md) — product ownership boundaries and scope
- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flow and design decisions
- [CONTRACTS.md](CONTRACTS.md) — the conversation, connection, resource and factory contracts
- [AGENTS.md](AGENTS.md) — the development contract for coding agents
- [FACTORY.md](FACTORY.md) — the retired out-of-band workflow, kept as history
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — how to report a vulnerability
- [docs/decisions](docs/decisions) — architecture decision records

## Development and the product factory

Personal OS is built out of band using coding tools, the repository, CI and an
independent release path. That workflow works with the product stopped. One
implementer delivers code, tests and documentation for a slice; independent review
checks the result. Fixed bot names and exclusive test-file ownership are optional
historical practices, not required dispatch gates.

The product's factory is a later feature built on rich chat and durable execution.
It coordinates the owner's goals and tasks through connected agents; it is not the
system required to build Personal OS itself. The build is driven by specs and
ADRs: take the next outcome from [the spec queue](docs/spec/README.md). The old
out-of-band workflow in [FACTORY.md](FACTORY.md) is kept as history, not as
process.

## Development

```bash
npm run typecheck        # every workspace
npm run test             # unit and integration tests
npm run format:check     # prettier
npm run build            # build every workspace
npx tsx scripts/smoke.ts # end-to-end check against a throwaway database
npm run test:e2e         # browser tests against the built client
```

The smoke test starts the real server and worker, exercises setup, agent registration,
a chat turn, resource concurrency, the task acceptance workflow and the MCP surface,
then tears everything down.

The browser tests drive the built web client in headless Chromium. They need the
browser once: `npx playwright install chromium`.

## Requirements

- Node.js 22.13 or newer (developed against Node 25)
- npm 10 or newer (npm workspaces; pnpm also works)
- A filesystem that supports SQLite locking — **not** a network share

## Licence

MIT. The owner chose it on 2026-10-21, and the full text is in the
[LICENSE](LICENSE) file at the root of the repository.
