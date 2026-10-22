# 8. The product has five domains

**Status:** accepted

## Context

Personal OS is a modular monolith with a supervised worker: thirteen server modules
(`auth`, `workspaces`, `agents`, `conversations`, `resources`, `factory`,
`automations`, `approvals`, `events`, `audit`, `capabilities`, `mcp`, plus
`executions`), seven web pages, and six published contracts.

That is a _technical_ layout. It says where the files are; it does not say which
parts of the product may evolve independently, or which may not reach into which.
Two features that both need the same table today have no way to be developed in
parallel without a merge conflict, and no way to be reasoned about separately.

The obvious answers were both wrong. A structural move — rearranging the tree
into folders — would touch every file's ownership, compete with a live queue of
work, and change nothing about the boundaries themselves. Documentation alone
would last one sprint: this repository already names "a claim that nothing
verifies" as a weakness, and a domain map nothing checks is exactly that.

## Decision

**Five domains**, published as an ownership map and enforced by a test, before any
file moves.

| Domain      | Owns                                                                                 |
| ----------- | ------------------------------------------------------------------------------------ |
| Interaction | conversations, participants, messages, turns, routing, the stream                    |
| Work        | goals, tasks, executions, evidence, acceptance, approvals                            |
| Resources   | the six resource kinds, templates, data sources, memory, files                       |
| Runtime     | agent connections, adapters, tool grants, secrets, the queue                         |
| Substrate   | contracts, the database, the event spine, audit, identity, the shared capability API |

Three rules make them real rather than decorative:

1. **Ownership** — a domain owns its tables, its contracts and its tests.
2. **One spine** — cross-domain facts travel as events on the one event log,
   never as direct table writes.
3. **One sanctioned crossing** — a domain may use Substrate, and the shared
   capability API may read across every domain. Nothing else may reach across
   unless the crossing is declared with a reason and the work item that removes
   it.

The machine-readable truth is `apps/server/src/domains.ts`; the human copy is
`docs/domains.md`; the guard is `apps/server/src/__tests__/domains.test.ts`,
which reads the modules and the schema as they are on disk. A module nobody
classified, a table nobody claimed, or a crossing nobody declared fails the
build.

**The map is declarative.** It names the boundaries; it does not move files. A
module moves when a work item needs it to, and the move is its own work item.

## Consequences

- **The map cannot decay into today's layout unnoticed.** A new module has to
  declare its domain; a new table has to be claimed.
- **Two features can now be scoped.** "Resources" and "Work" are separate
  concerns with separate owners, and the crossing between them is a named debt
  (WI-059) rather than an accident.
- **Three judgement calls had to be made, and are recorded**:
  `capabilities` is Substrate rather than Runtime, because it is the sanctioned
  crossing and a crossing that belongs to one domain is not a crossing;
  `events` and `audit` are Substrate, because the spine every domain depends on
  cannot live inside one of them; `automations` is Resources rather than Runtime,
  because an automation is one of the six resource kinds.
- **The test proves the module boundary and the table claims, and not more.** It
  cannot prove that a table is used correctly, and it does not police table
  _writes_ — one write across a boundary is declared in the manifest and owned
  by a work item (WI-060). A rule nothing verifies is a claim, and this one is
  honest about its edges.
- **The cost is a second place to look.** The map and the manifest can disagree.
  The manifest is the truth and the map is the copy; the test checks the
  manifest against the code, and the map against the manifest, by hand.
