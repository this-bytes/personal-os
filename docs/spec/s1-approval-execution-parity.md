# SPEC-S1 — Approval and execution round trips become agent-operable

**State:** open · **Owner:** implementing agent, one session · **Verifier:** Gilfoyle
**Depends on:** SPEC-P0 (its verdicts allocate the rows) · ADR 0013 is the rule

## Outcome

An external MCP-capable agent — the same transport the MiniMax bot team uses —
can, in one session against the running instance:

1. list pending approvals, decide one with a reason (the owner's turn stands
   behind the decision; the grant model records who decided);
2. create an execution-bearing task, observe its activity, and stop it;
3. read the audit and event trail of what it just did.

Today none of that exists for agents: 17 tools cover conversations, resources
and tasks only. This spec makes the **authority loop** — not the content loop
— agent-operable, because an agent that cannot answer an approval cannot run
anything dangerous, and a human-only approval surface means every automation
dangles on someone being at the browser.

## Contract

Add to `packages/contracts/src/mcp.ts` (names indicative; final set from
SPEC-P0 rows, published in `CONTRACTS.md` with shapes):

- `approval.list`, `approval.decide` — decide carries the owner-granted
  decision path, refuses without it; refusal is recorded like every ungranted
  call (the existing `guard` in `modules/mcp/server.ts`).
- `execution.list`, `execution.get`, `execution.stop` — bounded to the
  caller's workspaces, same scoping rule as the resource tools.
- `event.list`, `audit.list` — read-only trails, filtered by the caller's
  scope; `measure.read` follows in S2.

Rules that make this safe, from ADR 0013: registration follows
`agentToolGrants` (ungranted = not listed = refused-and-recorded); a tool
naming an id names an object, not a workspace (existing rule, reuse it);
destructive verbs require the same approval-shaped authority the UI demands.
No new authority kinds are invented here; parity means the same model,
exposed.

## Gate

`npm run verify:mcp-parity` joins `scripts/gates.json`: every owner-facing
route from the published contracts is either matched by a registered tool or
named on the exemption list with a written reason. S1 flips the approval,
execution, event and audit rows from human-only to paired; the rest stay
listed and fail-closed on any new human-only route added later.

## Acceptance

- A real MCP client session (stdio or streamable-HTTP, version recorded)
  completes all three numbered outcomes against a running instance with a
  real harness agent — not Echo, not fixtures. Transcript in the evidence.
- The parity gate runs in CI on the delivered revision and refuses a
  demonstration substitute.
- Unit + integration coverage for grant refusal, workspace scoping, and
  decide-without-authority.

## Not in scope

New UI screens; measures, capabilities and factory-domain parity (S2+ after
the audit ranks them); changing the grant model itself; anything the audit
marks broken-window — those become their own named specs, not drive-by fixes.
