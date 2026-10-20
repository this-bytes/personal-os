# Personal OS

**An agent-native control panel and personal software factory.**

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
npm install
npm run build

# Terminal 1 — the API server
npm run dev -w @personal-os/server

# Terminal 2 — the execution worker
npm run dev -w @personal-os/worker

# Terminal 3 — the web client
npm run dev -w @personal-os/web
```

Open <http://localhost:5173>. The first run asks you to create the owner account.

The built-in **Echo** agent works without any external setup, so you can exercise the
whole loop — mention an agent in a conversation, watch it reply — before connecting a
real agent.

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

# In a container
docker compose -f deploy/compose.yaml exec server \
  node apps/server/dist/index.js --reset-password "<new password>"
```

For headless access — an MCP client, a script — the instance also takes a static
owner token. Set `PERSONAL_OS_OWNER_TOKEN` in `deploy/.env` and send it as a bearer
credential:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_OWNER_TOKEN" http://localhost:4317/mcp
```

That token is the owner, so treat it like a password.

### Docker Compose

```bash
cp deploy/.env.example deploy/.env    # then set PERSONAL_OS_SECRET_KEY
docker compose -f deploy/compose.yaml up --build
```

The stack serves the web client and the API on <http://localhost:4317>. The data
directory (`./data`) holds the SQLite database, generated files and the secret key.

`PERSONAL_OS_SECRET_KEY` is required: both the server and the worker read it, so
they must always be given the same value. Generate one with
`openssl rand -base64 32`.

#### Running the stack from WSL

The compose file works unchanged from a WSL distribution. The repository is
reached through `/mnt/<drive>`, and Docker Desktop's engine does the rest.

```bash
wsl -d Ubuntu
cd /mnt/g/code/personal-os

# The credential helper that Docker Desktop installs on Windows is not on the
# Linux PATH, and BuildKit needs it to pull the pinned Dockerfile frontend.
mkdir -p ~/.local/bin
ln -sf "/mnt/c/Program Files/Docker/Docker/resources/bin/docker-credential-desktop.exe" \
  ~/.local/bin/docker-credential-desktop

docker compose -f deploy/compose.yaml up -d --build
./scripts/verify-deployment.sh http://127.0.0.1:4317 "<owner email>" "<owner password>"
```

`scripts/verify-deployment.sh` checks a running deployment end to end: the client
is served, the API answers, an agent is registered, the worker answers a message,
the audit trail records the work, and MCP exposes its tools.

It never creates the owner account. On an instance that has not been set up yet it
says so and stops, so that running it cannot consume the first-run slot and hide
the setup screen from the person using it.

The SQLite database lives in a Docker volume on the engine's own filesystem, not
on a network share, which is what SQLite's locking requires.

## Connecting an agent

Agent connections are adapters. Personal OS ships with six:

| Adapter | Use it for                                                                           |
| ------- | ------------------------------------------------------------------------------------ |
| `echo`  | A built-in deterministic agent. No configuration, no network.                        |
| `cli`   | A local command-line agent. Supervised process, sanitised environment, hard timeout. |
| `acp`   | An [ACP](https://agentclientprotocol.com)-compatible agent (session oriented).       |
| `a2a`   | An [A2A](https://a2a-protocol.org)-compatible agent (task oriented).                 |
| `http`  | Any framework-specific gateway with a JSON or SSE endpoint.                          |
| `model` | A model API without a full external harness (OpenAI-compatible chat completions).    |

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
│   └── decisions/        # Architecture decision records
├── deploy/
│   └── compose.yaml
├── .factory/             # The software factory: role briefs and the work item format
├── PRODUCT.md            # What this is and what it is not
├── ARCHITECTURE.md       # How the pieces fit together
├── CONTRACTS.md          # The published contracts
├── AGENTS.md             # Rules for coding agents working in this repo
└── FACTORY.md            # How the software factory works, and who owns what
```

## Documentation

- [PRODUCT.md](PRODUCT.md) — product ownership boundaries and scope
- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flow and design decisions
- [CONTRACTS.md](CONTRACTS.md) — the conversation, connection, resource and factory contracts
- [AGENTS.md](AGENTS.md) — the development contract for coding agents
- [FACTORY.md](FACTORY.md) — how the software factory works, and who owns what
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — how to report a vulnerability
- [docs/decisions](docs/decisions) — architecture decision records

## The software factory

Personal OS is built by a small team of agents with separate, non-overlapping
mandates, coordinated by a factory lead:

| Role               | Owns                                                | Answers                                       |
| ------------------ | --------------------------------------------------- | --------------------------------------------- |
| Factory lead       | Triage, dispatch, acceptance, CI, releases          | Should this be built, and is it done?         |
| Implementation     | The server, the worker, the contracts, the adapters | Does it work?                                 |
| Verification       | Every test, the browser suite, the smoke test       | Does it _keep_ working, and can it be broken? |
| Contracts and docs | The published surface, the ADRs, the release notes  | Is what we publish still true?                |

The doctrine lives in the repository, in [FACTORY.md](FACTORY.md) and
[`.factory/`](.factory/), not in a chat window. An agent — human or
autonomous — reads the same rules from the same version-controlled place.

The split is the point. The person who writes a change is not the person who
decides whether it is correct. It is the same separation the product itself
enforces on conversations: a message that wakes every participant is an
infinite loop, not a conversation.

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

MIT.
