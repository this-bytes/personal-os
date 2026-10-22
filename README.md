# Personal OS

**The environment one person's agents operate and extend.**

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

**The worker is never stopped in the middle of a turn.** A turn that is killed
leaves a job whose lease expires, and the queue runs that turn a second time — so
the worker is asked to stop, finishes the turn it is running, and exits.

`PERSONAL_OS_PORT` and `PERSONAL_OS_WEB_PORT` move the stack off the default
ports, which is how it runs beside a deployment that already holds them:

```bash
PERSONAL_OS_PORT=4318 PERSONAL_OS_WEB_PORT=5174 npm run dev:stack
```

This is an iteration tool, not a deployment. The deployment is the Compose stack
below, and it runs the compiled code.

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

**Replacing the stack does not re-run an agent turn.** The worker is given
fifteen minutes to finish the turn it is running before it is stopped, because a
turn that is killed leaves a job whose lease expires — and the queue runs that
turn a second time.

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

To replace a running stack with new code, build the images and bring the stack
back up without `--build`. The build is the slow part, and the data volume is not
recreated, so the owner account and everything in it survive the replacement:

```bash
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml up -d
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
│   ├── strategy.md       # What this is, where each idea came from, where it goes
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

- [docs/strategy.md](docs/strategy.md) — what this is, where each idea came from, and where it goes
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

MIT. The owner chose it on 2026-10-21, and the full text is in the
[LICENSE](LICENSE) file at the root of the repository.
