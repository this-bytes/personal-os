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
The Compose stack below is the deployment — it runs the compiled code, and
replacing what a running deployment serves means building the images again.
When the point is to see the current code rather than the shipped artifact,
run the source stack; see "Running the instance from source" below.

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

Compose gives the worker fifteen minutes to finish its current turn during a
graceful stop. A timeout or crash can still interrupt it; this grace period is not
a guarantee against duplicate remote side effects. Per-runtime restart
reconciliation and uncertain outcomes are part of the R0 acceptance checks.

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

### Running the instance from source

The Compose stack runs the compiled code, and bringing new code to a running
deployment means building the images again. To serve the current code
instead — a change reaching the running instance as it is written, with no
image and no build — run the source stack:

```bash
npm run dev:stack
```

That is the same three processes the deployment runs, started from the
checkout. The client is on <http://localhost:5173> and the API on
<http://localhost:4317>.

`deploy/source-stack.sh` starts the same stack with the parts a long-lived
instance needs done for it: the secret key and the data directory from
`deploy/.env`, so the instance opens the same database and decrypts the
configuration the deployment encrypted; and the stack bound to every
interface, so the host can reach it.

```bash
bash deploy/source-stack.sh
```

#### Reaching it from another machine

The client and the API listen on every interface inside the distribution, so
anything that can reach the host can reach them — if the host lets it in.

On Linux that is a firewall rule, and it needs an elevated shell:

```bash
sudo ufw allow 5173/tcp
sudo ufw allow 4317/tcp
```

On WSL it is worth being precise, because the two layers answer differently.
Windows forwards a listener in the distribution to the host's **loopback**
address, and not to the host's address on the network. The host's firewall
then refuses traffic that did not originate on the host. So the port has to
be opened on the host itself, and there are two ways to do that:

- **Publish the port with Docker Desktop.** The publish writes the firewall
  rule with it, so no elevated shell is needed. The published container
  forwards to a jump port inside the distribution, because a container cannot
  target a port the host already publishes to it, and because the container
  reaches the host through its loopback — the jump port is never exposed to
  the network.
- **Forward the port with `netsh interface portproxy`.** This is the
  documented Windows way to forward a port into WSL. It needs an elevated
  shell, which a remote owner of the machine does not have.

`deploy/source-stack.sh --publish` takes the first route:

```bash
bash deploy/source-stack.sh --publish
```

It publishes the client on 5173 and the instance on 4317. Both addresses
serve the panel and proxy the API under them, so the instance answers on the
port the deployment used as well as on the client's own.

The source-stack launcher refuses Windows-mounted checkouts under WSL to keep
runtime data on a filesystem with suitable SQLite locking. Native dependencies
must match the Node platform that runs them. Use a separate Linux installation
and checkout in the distribution:

```bash
git clone /mnt/g/code/personal-os ~/code/personal-os
cd ~/code/personal-os
npm ci
bash deploy/source-stack.sh --publish
```

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
│   ├── roadmap.md        # Current delivery sequence
│   ├── feature-guide.md  # How to implement a complete slice
│   └── decisions/        # Architecture decision records
├── deploy/
│   ├── compose.yaml
│   └── source-stack.sh
├── .factory/             # Current work item and compact contract-status evidence
├── PRODUCT.md            # What this is and what it is not
├── ARCHITECTURE.md       # How the pieces fit together
├── CONTRACTS.md          # The published contracts
├── AGENTS.md             # Rules for coding agents working in this repo
└── FACTORY.md            # How the software factory works, and who owns what
```

## Documentation

- [docs/roadmap.md](docs/roadmap.md) — the active delivery sequence
- [docs/adapters.md](docs/adapters.md) — runtime integration research
- [docs/reuse-inventory.md](docs/reuse-inventory.md) — what the chat surface takes from other people's code, and what it still has to build
- [PRODUCT.md](PRODUCT.md) — product ownership boundaries and scope
- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flow and design decisions
- [CONTRACTS.md](CONTRACTS.md) — the conversation, connection, resource and factory contracts
- [AGENTS.md](AGENTS.md) — the development contract for coding agents
- [FACTORY.md](FACTORY.md) — the independent development workflow
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
system required to build Personal OS itself. Follow [FACTORY.md](FACTORY.md) for
development and [the roadmap](docs/roadmap.md) for the delivery sequence.

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
