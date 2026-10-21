# The five domains

**What this is.** The map of what owns what in Personal OS: the five domains, the
tables each one owns, the contracts it publishes, and the one place a domain is
allowed to reach across.

**One line, so the two vocabularies do not collide.** `docs/strategy.md` has
_the three pillars_ — borrowed patterns, not parts of the system. This document
has _the five domains_ — the parts the system is made of. A pillar is something
the product learned; a domain is something the product is.

**The machine-readable copy is `apps/server/src/domains.ts`**, and
`apps/server/src/__tests__/domains.test.ts` checks it against the modules and
the schema as they are on disk. A module nobody classified, a table nobody
claimed, or a crossing nobody declared fails the build.

**This map is declarative.** It names the boundaries; it does not move files. A
module moves when a work item needs it to, and the move is its own work item.

---

## The rule

1. **Ownership.** A domain owns its tables, its contracts and its tests. A
   second domain reaching into them is a defect, not a shortcut.
2. **One spine.** Cross-domain facts travel as events on the one event log
   (`execution_events`), never as direct table writes.
3. **One sanctioned crossing.** A domain may use Substrate, and the shared
   capability API may read across every domain. Nothing else may reach across
   — unless the crossing is declared in `apps/server/src/domains.ts` with a
   reason and the work item that removes it.

---

## The domains

| Domain          | What it owns                                                                                                                          | Modules                                                 | Tables                                                                                               | Contracts                                                                 | Owner |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| **Interaction** | Talking to agents: conversations, participants, messages, turns, the owner's authority over a turn, routing, the stream               | `conversations`, `executions`                           | `conversations`, `participants`, `messages`                                                          | Contract 1 (Conversations), the event stream                              | Cog   |
| **Work**        | The ledger: goals, tasks, executions, evidence, acceptance, approvals, the waiting list, autonomy policy                              | `factory`, `approvals`, `autonomy`                      | `goals`, `tasks`, `executions`, `evidence`, `approvals`                                              | Contract 4 (The software factory), Contract 5 (Approvals and audit)       | Cog   |
| **Resources**   | What agents build: the six resource kinds, templates, data sources, memory scopes, files, the automations among them, and the count of what agents built | `resources`, `automations`, `measures`                  | `resources`, `resource_files`, `automations`, `automation_runs`                                      | Contract 3 (Agent-created applications and resources)                     | Cog   |
| **Runtime**     | What executes: agent connections, adapters, tool grants, the secret store, the queue, the MCP surface                                 | `agents`, `mcp`                                         | `agent_connections`, `secret_configs`, `queue_jobs`                                                  | Contract 2 (Agent connections), Contract 6 (Automations), the MCP surface | Cog   |
| **Substrate**   | What everything rests on: contracts, the database, the event spine, the audit trail, identity, tenancy, and the shared capability API | `auth`, `workspaces`, `events`, `audit`, `capabilities` | `users`, `sessions`, `agent_tokens`, `workspaces`, `execution_events`, `event_sequence`, `audit_log` | the error envelope, the capability API                                    | Cog   |

**The directories outside `src/modules`** are not domains: `api` is the HTTP
surface (a thin adapter over the capability API), `db` is the schema and the
client, `lib` is the shared helpers, and `queue` is the job queue the worker
consumes.

### Five judgement calls, and why

- **`capabilities` is Substrate, not Runtime.** The plan's inventory listed the
  module under Runtime; its rule named "the shared capability API in Substrate"
  as the one sanctioned crossing. The rule wins, because a crossing that
  belongs to one domain is not a crossing — it is that domain's own business.
  Every route and MCP tool is a thin adapter over it, so a person and an agent
  operate on the same objects through the same code path.
- **`events` and `audit` are Substrate.** The event log is the spine that rule
  2 depends on: if it lived in a product domain, three domains would reach
  across to it. The audit trail is read by the ledger and by every route, and
  belongs to nobody in particular.
- **`automations` is Resources, not Runtime.** An automation is one of the six
  resource kinds, and the resource service creates and enables them. Keeping
  the two modules in one domain is why `automations/service.ts` and
  `resources/service.ts` can call each other without a crossing.
- **`autonomy` is Work.** The policy says what work may proceed, and it is
  attached to a workspace and a goal — the goal's policy is Work's own row.
  The workspace's policy is Substrate's, which every domain may use. The
  conversation's own limits are the one row the policy reaches across for,
  and that reach is declared above.
- **`measures` is Resources.** The product's two measures are counted from the
  data the product already keeps: the authorship a resource carries, and the
  entries the audit trail holds. The audit trail is Substrate, which every
  domain may use, so the module's only other dependency is the resource
  store — which Resources owns. Placing it in Work or in Substrate would have
  meant a crossing that buys nothing.

---

## The crossings that exist, and the way out

Three places reach across today. All three are declared, all three are owned, and
all three have a work item that removes them. A declared crossing is a debt with a
name, not a permission.

| Crossing                           | Where                           | Why                                                                                                                                                  | Removed by                                                         |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Resources → Work                   | `modules/resources/service.ts`  | The task resource provider reads the factory ledger to present a task as a resource. The ledger owns the task; the resource API owns the view of it. | WI-059 — Resources reads the ledger through the capability API     |
| Interaction → Work _(table write)_ | `modules/executions/service.ts` | A turn is stored as an execution row, so the owner closing an unknown turn writes the ledger's row.                                                  | WI-060 — the turn's own resolution fields move onto the turn's row |
| Work → Interaction _(table read)_  | `modules/autonomy/service.ts`   | The effective autonomy policy is composed from a workspace's, a goal's and a conversation's own limits, so resolving it reads the conversation's row. | WI-107 — the caller that may read across composes the policy     |

The second one is a table write rather than an import, so it is declared but not
machine-checked: proving that a module writes only its own tables needs a
data-flow analysis this repository does not have, and a rule nothing verifies is
a claim. The third one is the same shape for a read: the map has no data-flow
analysis to prove that a module reads only its own tables either, so the read is
declared in the manifest and checked only for the shape of the declaration — a
real table, the domain that owns it, and a work item.

**The autonomy policy is the reason a crossing exists at all.** It is composed
from three domains' rows: the workspace's policy (Substrate, which every domain
may use), the goal's policy (Work, its own domain), and the conversation's own
limits (Interaction). **One rule composes three domains' facts, so it reaches
across by nature** — and the map's third rule says a crossing that is genuinely
necessary is declared rather than hidden. The module that enforces it is Work's,
because the policy says what work may proceed; the reach is into Interaction's
table, and WI-107 removes it by composing the policy in the one module that is
allowed to read across — the rule ADR 0008 already states.

---

## What a change to a domain costs

- **A new module** is classified in `apps/server/src/domains.ts` and described
  here. The test fails until it is.
- **A new table** is claimed by exactly one domain, in the manifest and here.
  The test fails until it is.
- **A new import across a domain boundary** is refused by the test. Either the
  import goes away, or the crossing is declared with a reason and a work item.
- **A contract change** is a published boundary: it needs a migration note, an
  entry in `CONTRACTS.md`, and the owner's approval. Which contract belongs to
  which domain is in the table above.

---

**What this document does not do.** It does not change any behaviour, move any
file, or settle a contract. It names the boundaries, and the test keeps them
true. The rules that carry the meaning — the routing safeguards, the revision
guard, the acceptance rule — are unchanged by this map and remain where they
are.
