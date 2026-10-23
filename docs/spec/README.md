# The spec queue

[ADR 0012](../../docs/decisions/0012-specs-and-adrs-drive-the-build.md) makes
this folder the work queue. A spec is a bounded user-visible outcome, the
contract change it makes, the evidence that proves it works on a real path,
and what is explicitly not in it. Nothing opens here that a spec does not
carry.

## The queue

| Spec                                                                                  | State     | Depends on                      | Outcome                                                                                    |
| ------------------------------------------------------------------------------------- | --------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| [SPEC-P0 — feature audit](audit-2026-10-23.md)                                        | done      | —                               | The honest inventory of what exists for the owner and what exists for an agent.            |
| [SPEC-S1 — approval and execution parity](s1-approval-execution-parity.md)            | done      | SPEC-P0                         | The authority loop becomes agent-operable. One row is carried to SPEC-S2.                  |
| [SPEC-S2 — the remaining owner parity](s2-remaining-owner-parity.md)                  | open      | SPEC-S1, SPEC-P0                | The rest of the owner surface, in the audit's ranked order. Batches 1 and 2 are delivered. |
| [SPEC-RESOURCE-RUN — publish and execute tell the truth](resource-publish-execute.md) | delivered | SPEC-P0                         | Publishing and executing a resource stop claiming they happened.                           |
| [SPEC-GRANT-EDITOR — the grant editor's save](grant-editor-save.md)                   | delivered | —                               | The owner's grant decision reaches the connection it was made for.                         |
| [SPEC-R0-1 — shared execution ownership](r0-1-shared-execution-ownership.md)          | delivered | —                               | One execution owner serves chat, tasks and automations.                                    |
| [SPEC-R0-2 — authorised dispatch](r0-2-authorised-dispatch.md)                        | open      | SPEC-R0-1, SPEC-GRANT-EDITOR    | The grant decision taken at admission is the one enforced at execution.                    |
| [SPEC-R0-3 — session references](r0-3-session-references.md)                          | delivered | SPEC-R0-1                       | A conversation points at the runtime session behind it.                                    |
| [SPEC-R0-4 — restart reconciliation](r0-4-restart-reconciliation.md)                  | delivered | SPEC-R0-1, SPEC-R0-3            | A surviving run is reconnected and the rest are named uncertain.                           |
| [SPEC-R1-1 — Codex demonstration](r1-1-codex-demonstration.md)                        | open      | SPEC-R0-1, SPEC-R0-3, SPEC-R0-4 | The owner completes real work against a real, installed Codex runtime.                     |
| [SPEC-R1-2 — OpenCode demonstration](r1-2-opencode-demonstration.md)                  | open      | SPEC-R0-1, SPEC-R0-3, SPEC-R0-4 | The owner completes real work against a real, installed OpenCode runtime.                  |

Two sequences live in the queue, and they answer different questions. **The S
sequence is parity**: what can the owner do that an agent cannot, driven by
the audit's ranking. **The R sequence is the execution foundation**: what the
runtime owes the product before a demonstration can be honest, driven by the
roadmap's stages. The grant editor and the broken windows belong to neither
sequence — they are defects on the way, and they are named because a defect
with no name is a defect nobody picks up.

## The order, and why it is this order

**R0-1 → R0-3 → R0-4 → R0-2**, then the demonstrations.

- **R0-1** has no predecessor, and the three callers it unifies are the three
  the later specs depend on.
- **R0-3** has no predecessor and unblocks the demonstration: without a
  session reference, R1's history-restore and restart-reconciliation
  acceptance cannot be shown honestly.
- **R0-4** needs the session reference to reconnect a surviving run.
- **R0-2** comes last because it is blocked by the grant editor's save, and
  the demonstrations do not need it.
- **R1-1** and **R1-2** are the release criteria for the stage. Both runtimes
  are installed on this machine — Codex 0.163.0 and OpenCode 1.19.4 — so the
  demonstrations can be real rather than fixture-backed.

## What a spec owes the reviewer

- The outcome, in terms of what a person can do.
- The contract change it makes, published in `CONTRACTS.md` in the slice that
  makes it.
- A gate that runs in CI on the delivered revision and fails closed.
- Evidence naming the revision, the commands, the results and the limits.
- A **Not in scope** section, because a bounded slice is only bounded if its
  boundary is written down.
