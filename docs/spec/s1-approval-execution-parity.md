# SPEC-S1 — Approval and execution round trips become agent-operable

**State:** delivered · one acceptance row carried to SPEC-S2 · **Owner:** implementing
agent, one session · **Verifier:** Gilfoyle
**Depends on:** SPEC-P0 (its verdicts allocate the rows) · ADR 0013 is the rule

## Outcome

An external MCP-capable agent — the same transport the MiniMax bot team uses —
can, in one session against the running instance:

1. list pending approvals, decide one with a reason (the owner's turn stands
   behind the decision; the grant model records who decided);
2. create an execution-bearing task, observe its activity, and stop it;
3. read the audit and event trail of what it just did.

Today none of that exists for agents: 16 tools cover conversations, resources
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

## Evidence

Delivered on `feature/s1-mcp-parity` at `3d803d8`.

**The gates, on the delivered tree.** `npm run typecheck`, `npm run test`
(server 717, web 189, worker 99, agent-adapters 46, contracts 48),
`npm run format:check`, `npm run build`, `npx tsx scripts/smoke.ts`,
`npm run verify:contracts` (28 claims),
`npx tsx scripts/verify-contract-pointers.ts` (191 pointers) and
`npm run verify:mcp-parity` (82 published / 82 registered routes, 23 tools,
22 paired, 50 listed, 10 exempt, 0 failures) all pass.

**A real client session.** The demonstration ran against a running instance —
server, worker and SQLite — over streamable HTTP, with **Codex CLI 0.163.0** as
the harness agent. Not Echo, not a fixture.

1. **List the approvals, decide one with a reason — MET.** `conversation.post`
   was refused by the policy; `approval.list` returned the pending approval;
   `approval.decide` recorded the decision (`decidedBy`, the reason, and the
   `approval.decided` event); `conversation.post` then succeeded.
2. **Create an execution-bearing task, observe its activity, stop it —
   PARTIALLY MET.** `task.create` succeeded, and `execution.get` and
   `execution.stop` were exercised on a real execution in both states:
   `not_running` on a finished turn and `requested` on a running one, each
   recorded in the audit with `actorType: "agent"`. **The gap:** `task.create`
   does not create an execution. The execution comes from
   `POST /api/tasks/:id/assign`, which has no MCP tool, so the owner assigned
   the task over HTTP before the agent could observe and stop it. That route
   stays on the parity list with this reason, and SPEC-S2 carries it: an agent
   handing work to another agent is the autonomous team the owner has not asked
   for yet.
3. **Read the audit and event trail — MET.** `audit.list` returned the
   decision and the stop; `event.list` returned the turn's events.

**The limits, stated.** `approval.decide` is exempt from the autonomy policy's
_approval_ gate and not from its allowed-actions list — without that,
answering an approval would need an approval. `GET /api/approvals/:id/evidence`
and `POST /api/executions/:id/resolve` stay human-only, each with a written
reason: resolving an unknown execution is the owner's own conclusion about
work that may already have happened.

## Not in scope

New UI screens; measures, capabilities and factory-domain parity (S2+ after
the audit ranks them); changing the grant model itself; anything the audit
marks broken-window — those become their own named specs, not drive-by fixes.
