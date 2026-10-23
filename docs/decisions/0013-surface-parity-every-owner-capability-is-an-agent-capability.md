# 13. Every owner capability is an agent capability — surface parity

**Status:** accepted — owner direction, 2026-10-23.

## Context

The owner directs work from the web chat and will run management agents
through the same interface — _operate within it, not through the code_. That
makes the agent-facing surface the owner's seat, not a convenience port.

Measured on main at `e038af8`, 2026-10-23: the server exposes roughly 62
owner-facing REST routes across 14 domains (agents, approvals, audit,
automations, autonomy, conversations, events, executions, factory, measures,
resources, workspaces, …), while the MCP server registers **17 tools**
(`packages/contracts/src/mcp.ts`): conversation post/read, resource
create/get/update/templates, task create/get/update, automation
create/inspect, agent.list, workspace.list, autonomy.read, bot.dispatch.

Everything outside those 17 — answering an approval, inspecting or stopping an
execution, reading events, measures or audit, driving automations beyond
creating them — exists for the human UI and is invisible to an agent. A
feature that cannot be operated over MCP is, for the product's own stated
purpose, not exposed.

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
