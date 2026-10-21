# Self-improvement without self-dependence — the runbook

**What this is.** The procedure for improving Personal OS with the help of the
agents inside it, without the instance ever being able to break the thing that
would repair it.

**The decision behind it** is ADR 0010. The seven boundaries below are that
decision; this document is how they are kept, and how each one is proved.

---

## The shape

Two planes, one product.

```
  ┌──────────────────── control plane (inside the instance) ─────────────────────┐
  │  Interaction      Work              Resources        Runtime                 │
  │  conversations    goals/tasks       resources        agent connections       │
  │  participants     executions        templates        adapters                │
  │  messages         evidence          memory scopes    automations             │
  │  turns            approvals         data sources     queue · scheduler       │
  │  delegations      audit                                   ↕                    │
  │                            Substrate: contracts · db · events · audit         │
  │                            auth · workspaces · capability API                │
  └──────────────────────────────────┬──────────────────────────────────────────┘
                                     │  dispatch · record · observe
                    ┌────────────────┴─────────────────┐
                    │  development plane (outside)      │
                    │  repository · CI · roles · release │
                    └──────────────────────────────────┘
```

The instance records what is wanted, what is in flight, what evidence exists and
what is waiting on the owner. It never builds, merges, deploys or restarts
itself.

---

## The seven boundaries, and how each is proved

### B1 — No self-application

> An agent inside the instance may propose a code change; it may not apply,
> merge, deploy or restart the instance.

**How it is kept.** The release path is out of band: a merge, a tag, an image
build, and a rollout from a shell. Nothing inside the instance can reach it —
the instance has no credentials for the git remote and no command that starts a
deployment.

**How it is proved.** Read the shipped image: the server's routes and its
outbound surface contain no path that applies, merges, deploys or restarts a
release. The check is a read of `apps/server/src/api/` and the adapter
registry; it is not an inference.

### B2 — Recovery is not an agent capability

> Rollback to a known-good release is one command that works while the instance
> is down. Backup and restore is a file copy, not an agent workflow.

**How it is kept.** The deployment is a Docker Compose stack
(`deploy/compose.yaml`): two services, `personal-os:latest` and
`personal-os-worker:latest`, sharing the named volume `personal-os-data`. The
code is in the image; the data is in the volume. Rolling the code back does not
touch the data.

**The rollback, with the instance stopped.**

```bash
cd <checkout-of-the-known-good-tag>
docker compose -f deploy/compose.yaml up -d --build   # the known-good tag
```

**The backup, as a file copy.**

```bash
docker run --rm -v personal-os-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/personal-os-data-$(date +%Y%m%dT%H%M%S).tar.gz -C /data .
```

**How it is proved.** Stop the instance, roll back, start it, and read
`GET /api/health` and one conversation. The proof is a run, not a claim — and
until it has been run, this paragraph is a procedure that nobody has executed.

**The one thing that breaks this, and does not break on its own.** The server
**applies pending migrations on boot** (`apps/server/src/index.ts:55` and
`apps/server/src/runtime.ts:61`). So a rollback of the _code_ is not a rollback
of the _schema_: an image older than the migration will start against a newer
database and may fail. This is why B3 exists, and why a release that carries a
migration is not an ordinary release. **Making the migration acceptance real is
[WI-061](#wi-061--the-release-does-not-migrate-on-boot) — funded, not done.**

### B3 — Data changes are gated separately from code

> The live schema changes only through reviewed migrations with a rollback
> story; migrations are owner-accepted, never agent-applied.

**How it is kept.** A migration is a file in `apps/server/drizzle/`, generated
by `npm run db:generate` and committed with its snapshot. A migration that
drops user data needs an explicit migration plan (AGENTS.md). No agent applies
a migration: the agent proposes the change, the owner merges it, and the
release applies it.

**How it is proved.** The migration policy names the owner as the acceptor, and
the release procedure is the only path that applies a migration. As of this
writing the _policy_ is real and the _mechanism_ is not: the boot applies
pending migrations without asking (see B2). WI-061 closes that gap.

### B4 — The panel is the recovery surface, so it is the most boring component

> The panel, the contracts and the ledger must not depend on the feature
> currently being built. A failed deployment degrades the feature, not the
> panel.

**How it is kept.** The panel is a client of the server's contracts and
nothing else. A feature under construction is a new route, a new table or a
new contract — not a change to the shell that draws them.

**How it is proved.** A dependency check: the panel's imports of the server's
contract package name only published contracts, and the server's ledger and
approval modules do not import the module the feature under construction
belongs to. The domain map in `docs/domains.md` is what makes this checkable
per feature.

### B5 — Agent "done" is a proposal everywhere

> The rule the ledger already applies to tasks applies to releases and
> migrations: agents report, the owner accepts.

**How it is kept.** `POST /api/tasks/:id/accept` is the only thing that closes
a task, and it is the owner's call. The same word is used for a release: a
merged pull request is a proposal the owner accepted, and an agent's report
that the gates are green is evidence, not acceptance.

**How it is proved.** The acceptance rule is unchanged, and it is stated in the
same words in the contract and in the code. This boundary is the one the
repository already keeps, which is why it is listed first in the ledger's own
order: goal → task → execution → evidence → acceptance.

### B6 — The repository remains the state

> The repository records code work; the instance's ledger records instance
> work; neither is a copy of the other.

**How it is kept.** One link each way, in the direction each record owns.

- A **code work item** lives in the repository: `.factory/work/*.md`, its
  dispatch record, its gates, its number. Its instance task carries the work
  item's id in `externalRef`.
- An **instance task** lives in the instance's ledger: an agent-authored
  resource, an automation, a conversation goal. A repository record of it
  cites the instance task id.
- A **goal** that spans both lives in the instance — it is a goal, not a file —
  and names the work items it spans.

Nothing is reconstructed from the other record. A drift is visible as a
dangling reference on one side, which is a finding rather than a silent
inconsistency.

**How it is proved.** A work item in the repository and its instance task
reference each other in one direction each, and neither is rebuilt from the
other. The mechanism already exists: `tasks.externalRef` and
`executions.externalRef` are the external-orchestrator reference, and
[WI-058](#wi-058--the-ledger-carries-the-work-item) is what puts the work
item's id in it.

### B7 — The roles' host is outside the instance

> The instance dispatches and records; the roles keep their own host. The
> instance can always say what it is waiting for, even when every role is down.

**How it is kept.** The roles are reachable over MCP and the instance reaches
them through the published `mcp` adapter type — a connection, not a process
the instance hosts. The instance holds the ledger and the dispatch; the role
holds the execution.

**How it is proved.** With every role unreachable, the instance still lists
what it is waiting for: the ledger's open tasks, the waiting list, and the
`unknown` items whose outcomes could not be confirmed. A control plane that
cannot answer "what am I waiting for" is not a control plane.

---

## The end-to-end flow

```
Owner                    Instance (control plane)                  Roles (own host)      Repository / CI
─────                    ─────────────────────────                  ───────────────      ───────────────
"improve routing"  ──▶  goal → task → execution → evidence    ──▶  dispatch via the    worktree, branch,
                        acceptance waits for the owner            mcp adapter          commit, gates
                                                          ◀──  result + gate report as evidence
                             records delivery, then consumption        │
                        proposed, never applied                      │
                                                                        ▼
                                                            owner accepts ──▶ merge, tag, CI
                                                            (the owner)             │
                                                                                    ▼
                                                                        one-command rollout from a shell
                                                                        (instance may be down; rollback is one command)
```

---

## What a release touches, and who may touch it

| Step                      | Who       | Where                  | Gate                                                |
| ------------------------- | --------- | ---------------------- | --------------------------------------------------- |
| The want is recorded      | Chief     | `.factory/INTAKE.md`   | in the owner's words, with the reason for the order |
| The work item is opened   | Chief     | `.factory/work/`       | one owner, one worktree, one number                 |
| The code is written       | Cog       | `apps/`, `packages/`   | the repository's own gates                          |
| The tests are written     | Probe     | test files, `scripts/` | a red that names the gap                            |
| The contract is published | Wren      | `CONTRACTS.md`         | the owner's approval — a published boundary         |
| The evidence is attached  | Cog       | the work item          | the gates' real output, not a summary of it         |
| The work is accepted      | Chief     | the work item          | **never the implementer**                           |
| The release is out        | the owner | a shell                | tag → build → `docker compose up -d`                |

---

## The open items this runbook names

- **[WI-061](#wi-061--the-release-does-not-migrate-on-boot)** — the release
  does not migrate on boot. B2 and B3 are procedures until this lands.
- **[WI-058](#wi-058--the-ledger-carries-the-work-item)** — the ledger carries
  the work item's id, so B6's link exists in both directions.
- **[WI-059](#wi-059--resources-reads-the-ledger-through-the-capability-api)**
  and **[WI-060](#wi-060--a-turns-resolution-lives-on-the-turns-own-row)** —
  the two declared crossings in the domain map, each with an owner.
