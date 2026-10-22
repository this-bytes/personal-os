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
writes and autonomy-policy reads. Their exact declarations live in domains.ts.
Review them against current source when the relevant slice is selected. Historical
work-item identifiers name evidence, not the active priority order.

[ARCHITECTURE.md](../ARCHITECTURE.md) describes target responsibilities and
[the roadmap](roadmap.md) orders delivery. Changing those responsibilities does not
silently migrate table ownership or waive existing domain tests.
