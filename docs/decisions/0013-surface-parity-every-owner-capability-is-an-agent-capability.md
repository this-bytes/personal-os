# 13. Every owner capability is an agent capability — surface parity

**Status:** accepted — owner direction, 2026-10-23.

## Context

The owner directs work from the web chat and will run management agents
through the same interface — _operate within it, not through the code_. That
makes the agent-facing surface the owner's seat, not a convenience port.

Measured on main at `e038af8`, 2026-10-23: the server exposes roughly 62
owner-facing REST routes across 14 domains (agents, approvals, audit,
automations, autonomy, conversations, events, executions, factory, measures,
resources, workspaces, …), while the MCP server registers **16 tools**
(`packages/contracts/src/mcp.ts`): workspace.list, conversation read/post,
resource create/get/update and the two resource templates, task
create/get/update, automation create/inspect, agent.list, autonomy.read,
bot.dispatch.

Everything outside those 16 — answering an approval, inspecting or stopping an
execution, reading events, measures or audit, driving automations beyond
creating them — exists for the human UI and is invisible to an agent. A
feature that cannot be operated over MCP is, for the product's own stated
purpose, not exposed.

## 2026-10-23 — The lead: the tool count was wrong, and the round trip has landed

This record said **17 tools**; the tree published **16**, and the enumeration
above did not add up to seventeen either. The audit measured the difference
(evidence E2 and E9 in `docs/spec/audit-2026-10-23.md`) and the number here
is now the one the tree publishes.

**The round trip this record asks for landed with SPEC-S1.** Seven tools were
added — `approval.list`, `approval.decide`, `execution.list`, `execution.get`,
`execution.stop`, `event.list` and `audit.list` — which makes 23 in all, and
`npm run verify:mcp-parity` now exists and runs in CI, so the check this
record promised is a check rather than a hope.

**What is still open is named rather than closed.** The measures, the
automations beyond creating them, and the assignment of work to an agent are
still human-only. They are on the parity list with a written reason, and
SPEC-S2 carries them in the audit's ranked order. The assignment is left
there on purpose: an agent handing work to another agent is the autonomous
team the owner has not asked for yet.

## Decision

**Surface parity is a requirement with a check, not a direction with hope.**

1. Every operation the owner can perform in the web UI exists as an MCP tool
   over the same contract schemas (`packages/contracts` is the single source)
   and the same grant model (`agentToolGrants` gates registration; nothing
   ungranted is listed).
2. Parity is enforced by a shipped CI gate — `npm run verify:mcp-parity` —
   that enumerates owner-facing routes from the published contracts and
   requires a registered tool for each, or an explicit exemption with a
   written reason (auth flows and pure-UI reads only). The gate, not prose,
   is the rule. An ungranted operation is a contract defect, not a screen
   shortcut.
3. New capabilities are **spec'd contract-first**: the contract + MCP tool
   exist before the UI consumes them, so the human surface and the agent
   surface are born together. A UI-only feature does not pass review.

## Consequences

- `docs/spec/p0-feature-audit.md` produces the exact current inventory;
  `docs/spec/s1-mcp-surface-parity.md` closes the gaps in owner-value order.
- The grant model must extend to the new tools at spec time, not after:
  approval-shaped authority (the owner's turn decides destructive actions)
  applies uniformly to human and agent callers.
- When the management agents are piped in, they need no privileged path. What
  they can do is what the owner granted, listed in the capability view the
  turn was admitted with.
