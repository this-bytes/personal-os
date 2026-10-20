# AGENTS.md

This file is the development contract for coding agents working in this repository.
Read it before you change anything.

## Orientation

Personal OS is a self-hosted, agent-native control panel and personal software
factory. Before implementing anything, read:

1. [PRODUCT.md](PRODUCT.md) — what the product owns and what it does not.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit together.
3. [CONTRACTS.md](CONTRACTS.md) — the published contracts.
4. [FACTORY.md](FACTORY.md) — how the factory works and which files you own.
5. The relevant module's source. The contract definitions live in
   `packages/contracts`; the schema lives in `apps/server/src/db/schema.ts`.

## Development contract

1. **Read the relevant product, architecture and contract definitions before
   implementation.** Do not infer the shape of a contract from the code that happens
   to use it.
2. **Prefer established libraries and protocols over custom frameworks.** ACP and A2A
   are implemented as clients of those protocols, not as reinterpretations of them.
3. **Do not introduce dependencies on one particular agent provider into core domain
   logic.** The domain must not know that Hermes, Codex or OpenClaw exist.
4. **Preserve published contracts, or provide explicit migration and compatibility
   handling.** A contract change is a product decision, not a refactoring detail.
5. **Do not add infrastructure components without a demonstrated requirement.** No
   Redis, no Kubernetes, no PostgreSQL, no microservices, no plugin marketplace, no
   custom workflow engine.
6. **Implement working vertical slices**, including UI, API, persistence and tests.
7. **Preserve data through migrations and restarts.** A migration that drops user
   data needs an explicit migration plan.
8. **Verify new agent types and resources work through the same existing
   interfaces.** A new adapter must not require changes to conversation storage or
   the factory task model. A new resource type must work through the shared resource
   API.
9. **Do not expand scope merely because an additional feature is convenient to
   implement.**
10. **Document actual behaviour and outstanding limitations, not hypothetical
    capabilities.** If a feature is half-built, say so.

## Where things live

| Path                      | Contains                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/contracts`      | Shared schemas and types. The single source of truth for every shape that crosses a boundary. |
| `packages/agent-adapters` | The adapter registry and the built-in adapters.                                               |
| `packages/ui`             | Reusable UI primitives (source, not compiled).                                                |
| `apps/server`             | API, domain modules, database, MCP endpoint.                                                  |
| `apps/worker`             | The queue consumer and the automation scheduler.                                              |
| `apps/web`                | The web client.                                                                               |
| `docs/decisions`          | Architecture decision records.                                                                |

## Rules that are easy to break by accident

**The API server never runs an agent.** It creates an `executions` row and enqueues a
job. The worker runs it. If you find yourself importing an adapter into
`apps/server`, stop and reconsider.

**The worker never talks to the browser.** It writes to the database; the server
streams the event log. Do not add an HTTP call from the worker to the server.

**Credentials are never returned.** `secret_configs` rows are encrypted and their
values never appear in an API response. A client that wants to change a credential
sends the new value in `secrets` and the server replaces the record.

**Routing safeguards are not suggestions.** The rules in
`apps/server/src/modules/conversations/routing.ts` — an agent message never wakes
every participant, the turn limit, the depth limit, the duplicate check — are the
difference between a group chat and an infinite loop. Any change there needs a test
in `routing.test.ts`.

**Revision numbers are the concurrency guard.** Every resource update carries the
revision it was based on. Do not "optimise away" the check.

**An agent reporting completion is not acceptance.** Factory tasks move to `review`,
never straight to `done`. Only `POST /api/tasks/:id/accept` closes a task.

**`schemaVersion` and `revision` are part of the resource envelope.** Do not remove
them because a payload does not need them yet.

## Working in this repository

```bash
npm install                 # install everything (npm workspaces)
npm run build               # build every workspace, in dependency order
npm run typecheck           # typecheck every workspace
npm run test                # unit and integration tests
npm run format:check        # prettier — run `npm run format` to fix
npx tsx scripts/smoke.ts    # end-to-end check against a throwaway database
npm run test:e2e            # browser tests against the built client
```

Order matters when building: `contracts` → `agent-adapters` → `server` → `worker` →
`web`. The root `build` script already does this.

**Format what you touch.** `npm run format` rewrites the files prettier
complains about. A pull request whose diff is mostly reformatting hides the
change that matters, so run it before you commit rather than after.

### Adding a database change

1. Edit `apps/server/src/db/schema.ts`.
2. Run `npm run db:generate -w @personal-os/server`.
3. Commit the generated SQL **and** the snapshot.
4. Never edit a migration that has been applied anywhere.

### Adding an agent adapter

1. Add the type to `adapterTypeSchema` in `packages/contracts/src/agent.ts` and the
   configuration schema to `packages/contracts/src/adapter-config.ts`.
2. Implement the adapter in `packages/agent-adapters/src/`, emitting only events you
   can genuinely observe.
3. Register it in `createDefaultRegistry()`.
4. Add tests. A CLI adapter needs a test that proves it does not leak the server's
   environment.

### Adding a resource type

1. Add the type to `resourceTypeSchema` and its payload schema to
   `packages/contracts/src/resource.ts`.
2. Add a provider in `apps/server/src/modules/resources/service.ts`.
3. Add it to the MCP tool surface only if it is genuinely useful to an external
   agent.

### Adding an API route

1. Put it in the matching module under `apps/server/src/api/`.
2. Use `parseBody` / `parseQuery` for validation so failures use the shared error
   envelope.
3. Guard it with `requireAuth` unless it is explicitly public.
4. Update the route table in [CONTRACTS.md](CONTRACTS.md).

## Style

- TypeScript, strict mode. No `any` without a comment explaining why.
- Comments explain _why_, not _what_. The code already says what.
- Errors are structured: `AppError` with a code, a message and optional details.
- Prefer a pure function that can be tested without a database. The routing rules
  and the cron parser are both written this way on purpose.
- Keep the module boundaries. A conversation module does not reach into the factory's
  tables.

## Before you say you are done

Most of the gates below work on their own, on a fresh checkout. `npm run
typecheck` and `npm run test` build the workspaces they need on the way, and
`npm run test:e2e` builds the client before it drives it. Two of them read the
build output and need `npm run build` to have run first: `npm run
verify:bundle` fails with "The client has not been built" and `npx tsx
scripts/verify-build.ts` fails with "Cannot find module …/apps/server/dist/index.js"
on a checkout that has never been built.

- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run format:check` passes.
- `npm run build` passes if you touched the web client, the server or the
  worker.
- `npx tsx scripts/smoke.ts` passes if you touched the server or the worker.
- `npm run test:e2e` passes if you touched the web client.
- `npm run verify:bundle` passes if you touched the web client or the build.
- `npx tsx scripts/verify-build.ts` passes if you changed how the compiled
  output is produced.
- `npm run verify:stack` passes if you touched how a deployment runs, or the
  worker. It proves a running instance executes an agent, which a health
  check cannot. It needs a deployment that is already running, and it takes
  the base URL as an argument: `npm run verify:stack -- http://127.0.0.1:4317`.
  It writes to that deployment — it creates the owner if there is none, and it
  always adds an agent and a conversation. Against a deployment that is not
  yours, pass `--allow-remote`.
- The documentation matches the code. If you changed a contract, `CONTRACTS.md`
  changed with it.
