# 10. Self-improvement without self-dependence

**Status:** accepted

## Context

The owner's proposal: production Personal OS acts as the control plane for goals
and work, and development and release execution are independent of the
instance. The instance knows what is wanted, what is in flight, what evidence
exists and what is waiting on the owner; the repository and CI do the work and
the releasing.

That proposal has one real hole, and it is the hole the owner asked to have
found. If the instance is the control plane _and_ the factory writes the code
that the instance runs, then a bad change can destroy the thing that would
repair it. The rule the repository already has — an agent-authored artefact does
not exist until something has checked it — covers skills, workflows and
resources, and does not cover the product's own release.

A second hole opens when the factory's roles move into the instance. The
factory is, today, four bots in a MiniMax Bot team with the repository as the
state. Moving them inside is the right move for the control plane, and the
wrong move if the instance's own health then decides whether the factory can
run.

## Decision

**Two planes, and seven boundaries.**

The instance is the control plane for goals and work. It never builds, merges,
deploys or restarts itself.

| #   | Boundary                                                              | Rule                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | No self-application                                                   | An agent inside the instance may propose a code change; it may not apply, merge, deploy or restart the instance. Release is out of band: tag → CI → immutable artefact → one-command rollout from a shell. |
| B2  | Recovery is not an agent capability                                   | Rollback to a known-good release is one command that works while the instance is down. Backup and restore is a file copy, not an agent workflow.                                                           |
| B3  | Data changes are gated separately from code                           | The live schema changes only through reviewed migrations with a rollback story; migrations are owner-accepted, never agent-applied.                                                                        |
| B4  | The panel is the recovery surface, so it is the most boring component | The panel, the contracts and the ledger must not depend on the feature currently being built. A failed deployment degrades the feature, not the panel.                                                     |
| B5  | Agent "done" is a proposal everywhere                                 | The rule the ledger already applies to tasks applies to releases and migrations: agents report, the owner accepts.                                                                                         |
| B6  | The repository remains the state                                      | The repository records code work; the instance's ledger records instance work; neither is a copy of the other.                                                                                             |
| B7  | The roles' host is outside the instance                               | The instance dispatches and records; the roles keep their own host. The instance can always say what it is waiting for, even when every role is down.                                                      |

**B6 is one link each way.** The mechanism already exists: `tasks.externalRef`
and `executions.externalRef` are the external-orchestrator reference. A code
work item lives in the repository (`.factory/work/*.md`, its dispatch record,
its gates, its number) and its instance task carries the work item's id in
`externalRef`. An instance task — an agent-authored resource, an automation, a
conversation goal — lives in the instance's ledger, and a repository record of
it cites the instance task id. A goal that spans both lives in the instance, as
a goal rather than a file, and names the work items it spans. Nothing is
reconstructed from the other record: a drift shows up as a dangling reference on
one side, which is a finding rather than a silent inconsistency.

**The instance reaches the roles over MCP.** The roles are an MCP server, and
Personal OS had no MCP client — the server's own MCP module is a _server_, and
exposes Personal OS outward. So the `mcp` adapter type was added: any MCP
server becomes an agent connection, and after it lands, connecting a new agent
is a trust decision rather than an integration project.

## Consequences

- **The instance can be improved by its own agents without being able to break
  itself.** B1 and B3 are what make the owner's proposal safe; B7 is what makes
  it survivable.
- **The roles gain a ledger, not a dependency.** The instance's ledger is the
  single record of the factory's work — goals, tasks, executions, evidence —
  and the roles keep their own host, so an outage of the roles leaves the
  instance able to say what it is waiting for.
- **B2 is the part most likely to be forgotten.** A runbook that describes a
  rollback nobody has run is a claim. `docs/self-improvement.md` carries the
  procedure and the proof for each boundary, and the proof for B2 is a rollback
  executed with the instance stopped.
- **The cost is a second record of factory work.** Two ledgers can drift, and
  B6's answer — one link each way, in the direction each record owns — is a
  discipline rather than a mechanism. Drift is visible as a dangling reference,
  which is the most this design can promise and the most it should.
- **The owner may later want Personal OS to become its own development
  environment.** That is the self-dependence this record refuses. It remains the
  owner's decision to make, and these boundaries are the reason to think twice
  first.
