# SPEC-P0 — Feature audit: what actually exists

**State:** open · **Owner:** implementing agent, one session · **Verifier:** Gilfoyle
**Depends on:** ADR 0012, ADR 0013 · **Blocks:** SPEC-S1

## Outcome

A single honest inventory answering, for every owner-facing capability in the
product: does it exist for the human, and does it exist for the agent. The
owner's complaint — "all features are half implemented, a lot of functionality
not exposed" — becomes a table with verdicts, not a vibe.

## Method

For each of the 15 server modules (agents, approvals, audit, auth, automations,
autonomy, capabilities, conversations, events, executions, factory, mcp,
measures, resources, workspaces), one row per user-visible operation, taken
from the published contracts and the web UI, never from intention:

| column    | source of truth                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Operation | the thing a person can actually do in the chat/UI                                                                                    |
| API       | route(s) from the code, method + path                                                                                                |
| Agent     | MCP tool name from `packages/contracts/src/mcp.ts`, or **none**                                                                      |
| State     | shipped / partial / fixture-only — partial means it runs on Echo or fixtures but has no demonstration on a real runtime or real data |
| Verdict   | **exposed-paired** / **human-only** / **broken-window** (UI offers it, API half-honours it)                                          |

Measurements, not memory: read the code, run the shipped checks. The current
known baseline to be confirmed or corrected, not trusted: ~80 API routes, 17
MCP tools; approvals, executions, events, audit and measures have no agent
path at all; all adapter presets are marked unverified since WI-142.

## Deliverable

`docs/spec/audit-2026-10-23.md` — the table plus a ranked list of
human-only and broken-window rows, ordered by owner value (approval round
trips and execution control first; pure-UI reads last). Every row gets one of:
`SPEC-S1` (parity now), `SPEC-Sx` (named later spec), or `exempt` with a
reason.

## Acceptance

- Spot-checked by the verifier against the code on the delivered revision:
  at least 10 rows re-measured independently, discrepancies = rework.
- No row marked shipped without a command and output in the evidence file.

## Not in scope

Fixing anything. The audit only tells the truth; S1 and later specs move it.
