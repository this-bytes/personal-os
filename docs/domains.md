# Module boundaries

The existing domain map is in
[apps/server/src/domains.ts](../apps/server/src/domains.ts). It classifies modules,
tables and declared exceptions. The
[domain tests](../apps/server/src/__tests__/domains.test.ts) check classification
and permitted imports against current source. Read those files before changing a
boundary; this page does not maintain a second ownership table.

Domains own behavior and persistence; implementing agents own complete slices
across code, tests and documentation. A domain is not a permanent bot assignment.
Use shared contracts and explicit service interfaces for cross-module behavior.
The capability API composes authorized entry points without becoming a catch-all
business-logic layer.

Current declared debts include resource/task ledger access, execution outcome
writes, the owner settling the queue job that was held for an uncertain turn or
for an uncertain automation run, autonomy-policy reads and the session
reference's read of the connections it names. Their exact declarations live in
domains.ts.

Review them against current source when the relevant slice is selected. Historical
work-item identifiers name evidence, not the active priority order.

## Domains and pillars are different axes

A **domain** is a unit of code ownership: Interaction, Work, Resources, Runtime
and Substrate, each owning its modules, tables and contracts. The map is
enforced — a module nobody classified or a table nobody claimed fails the build.

A **pillar** is a unit of product capability: Chat, Runtimes, Teams, Factory,
Resources, Platform and Plugins. Pillars are what work is dispatched against,
and each one names the domains it touches. The pillar map and the rule that
separates them are in [ARCHITECTURE.md](../ARCHITECTURE.md) §4, and the decision
that introduced the second axis is
[ADR 0015](decisions/0015-pillars-are-capabilities-domains-are-ownership.md).

The seam between two pillars is a published contract shape or an event on the
spine. It is never a table one pillar writes and another reads.

[ARCHITECTURE.md](../ARCHITECTURE.md) describes target responsibilities and
[the roadmap](roadmap.md) orders delivery. Changing those responsibilities does not
silently migrate table ownership or waive existing domain tests.
