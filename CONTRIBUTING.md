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
`"gypfile": false` and ships a prebuilt binary for every platform it supports,
but npm reads that marker from the lockfile, and the lockfile does not carry
it — so npm decides to compile the package from source. The compile is
unnecessary, and it is the only thing that fails.

Either install the **Desktop development with C++** workload from the Visual
Studio Build Tools, or skip the install scripts, which loses nothing:

```bash
npm ci --ignore-scripts
npm run build
```

The package tarball already contains the prebuilt binary — a `prebuilds/`
directory with one `.node` file per platform — and `better-sqlite3` loads that
directly, so nothing has to be compiled. The only install script in the
dependency tree is `esbuild`'s, and it only validates the platform binary that
`esbuild`'s own platform package already ships. Skipping it changes nothing
the build needs.

Linux and macOS are not affected by the failure, because the toolchain is
usually there. The compile still runs on them, and it is just as unnecessary.

You can also add `"gypfile": false` to the `better-sqlite3` entry in
`package-lock.json` by hand, and `npm ci` will honour it and skip the compile.
It is not a durable fix: the next `npm install` rewrites the lockfile without
the marker. `--ignore-scripts` is the workaround that holds.

There is no upgrade either — 13.0.3 is the latest release, and it ships the
same prebuilt binaries.

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
npm run test:e2e              # browser tests
npx tsx scripts/verify-build.ts
npm run verify:bundle         # the client bundle is within its budget
```

The last four are conditional: run the smoke test if you touched the server
or the worker, the browser tests and the bundle budget if you touched the web
client, and the build check if you changed how the compiled output is
produced.

The first two build the three workspaces they depend on — `contracts`,
`agent-adapters` and `server` — so they work on a fresh checkout without a
separate build step. The last two read the build output, so `npm run build`
has to have run before them. `npm run test:e2e` builds the client itself
before it drives it.

`npm run test:e2e` needs a browser once: `npx playwright install chromium`.

## Checking a deployment

The gates above prove the code works. To prove a running deployment works —
the container stack, or one you started yourself — use:

```bash
npm run verify:stack -- http://127.0.0.1:4317
```

It signs in, registers an agent, posts a message to it and waits for the
worker's reply. A health check cannot do that: it says the server answers,
not that the worker is alive and executing.

It writes to the deployment, so it creates the owner if there is none and it
always adds an agent and a conversation. Against a deployment that is not
yours, pass `--allow-remote` to say that you mean it.

To check the container stack itself — build both images, start it, serve the
client, run the worker, and tear it down again — run the whole thing in one
command. It needs Docker:

```powershell
./scripts/verify-compose.ps1
```

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

## Branches and the remote

Work happens on a branch, never on `main`, and the branch is pushed. `main` is
the integration branch: it is where reviewed, green work lands.

```bash
git switch -c feat/my-change
# …work, test…
git push -u origin feat/my-change
```

CI runs on every branch push, so a pushed branch is a gated branch. A pull
request runs it again against the merge result, which is the run that matters.

Merge with a fast-forward and never force-push. A force-push replaces what is
on the remote with what is in your repository, so it takes every commit that
landed since with it — including other people's.

The repository has two git hooks, in [`.githooks/`](.githooks/). They run when
`core.hooksPath` points at them:

```bash
git config core.hooksPath .githooks
```

- **pre-commit** warns when a file is staged and has changed again since it
  was staged — the shape of two people editing one file.
- **pre-push** refuses a push that is not a fast-forward, and checks that the
  files in the push are formatted.

Both are warnings about _other people's_ work as much as your own, so they are
worth reading rather than skipping.

## Working on it with an agent

The bots that build this repository work in worktrees — one per work item —
so two agents never share a working tree. To take one for yourself:

```bash
npx tsx scripts/work-item.ts new WI-017 forge-panel
```

That creates the branch `wi/017-forge-panel` and a worktree beside the
repository, installs the dependencies and builds the packages the gates need.
`npx tsx scripts/work-item.ts list` shows the worktrees and their work items;
`remove` takes one away.

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
