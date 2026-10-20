# Contributing to Personal OS

Thank you for looking at Personal OS. This project is a self-hosted,
agent-native control panel and personal software factory, and it is built by
humans and autonomous agents working from the same rules.

**Read [AGENTS.md](AGENTS.md) before you change anything.** It is the
development contract: what the product owns, how the modules are separated,
and which published contracts you must not break.

If you are an autonomous agent, you are held to the same contract, and you
should also read [FACTORY.md](FACTORY.md).

## Getting set up

You need **Node.js 22.13 or newer** and **npm 10 or newer**.

```bash
git clone https://github.com/<your-fork>/personal-os
cd personal-os
npm ci
npm run build
```

The database is SQLite and the filesystem must support SQLite locking — a
network share will not work.

### If `npm ci` fails to build a native module on Windows

`npm ci` can fail with `gyp ERR! find VS … Could not find any Visual Studio
installation to use`. That is npm, not this project: `better-sqlite3` declares
`"gypfile": false` and ships a prebuilt binary for every platform, but npm
does not record that marker in the lockfile, so it decides to compile the
package from source. The compile is unnecessary.

Either install the **Desktop development with C++** workload from the Visual
Studio Build Tools, or skip the build step, which loses nothing because the
prebuilt binary is already in the package:

```bash
npm ci --ignore-scripts
npm run build
```

Linux and macOS are unaffected — their toolchains are present, and the
compile simply succeeds.

Run the three processes separately while developing:

```bash
npm run dev -w @personal-os/server   # API, http://localhost:4317
npm run dev -w @personal-os/worker   # execution worker
npm run dev -w @personal-os/web      # client, http://localhost:5173
```

The first run asks you to create the owner account. The built-in **Echo**
agent works with no external setup, so you can exercise the whole loop —
mention it in a conversation, watch it reply — before connecting a real
agent.

## The gates

Every pull request must pass these. They are the same gates CI runs and the
same ones the bots are held to.

```bash
npm run typecheck             # strict TypeScript, every workspace
npm run test                  # unit and integration tests
npm run format:check          # prettier
npm run build                 # every workspace builds
npx tsx scripts/smoke.ts      # end-to-end, against a throwaway database
npm run test:e2e              # browser tests (needs the build first)
npx tsx scripts/verify-build.ts
```

The last three are conditional: run the smoke test if you touched the server
or the worker, the browser tests if you touched the web client, and the build
check if you changed how the compiled output is produced.

`npm run test:e2e` needs a browser once: `npx playwright install chromium`.

## How a change gets reviewed

Personal OS is reviewed by a small team of bots with separate, non-overlapping
mandates — an implementation engineer, a verification engineer and a contracts
and documentation engineer — coordinated by a factory lead. The roles and the
file ownership table are in [FACTORY.md](FACTORY.md).

The point of separating them is simple: the person who writes a change is
not the person who decides whether it is correct. The verification engineer's
job is to make your change fail. If it does not fail, you may not have tried
hard enough — that is a compliment, not a complaint.

For a human contributor this means:

- expect a review that asks for a test;
- expect questions about the contract when you touch a published shape;
- expect the documentation to be checked against your code.

## Pull requests

Keep a pull request to one work item. A pull request that fixes two unrelated
things is two pull requests.

Before you open one:

1. Run the gates and paste the actual output in the description.
2. Say what the change makes the product able to do, not just which files
   changed.
3. If you changed a published contract, include the migration plan and say
   how existing data survives it.
4. Update the documentation that your change makes untrue. If you are unsure
   which, [AGENTS.md](AGENTS.md) says what has to match what.

Fill in the pull request template. It is short on purpose.

## Commits and history

Write commit messages that explain why. The diff already says what changed.

```
Add the per-connection MCP tool grants

An agent token could call every published tool, which made the token
scoped in name only. Grants are now stored per connection and an
ungranted tool is not registered at all, so it never appears in
tools/list.
```

## Reporting a bug

Open an issue with the template in `.github/ISSUE_TEMPLATE/`. The most useful
thing you can include is the output of the failing gate, and the reproduction
steps. If the bug involves an agent, say which adapter and what the agent
reported.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Licence

By contributing you agree that your contribution is licensed under the MIT
licence, the same licence as the rest of the project.
