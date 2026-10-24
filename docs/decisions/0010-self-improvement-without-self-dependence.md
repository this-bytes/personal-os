# 10. Development and recovery are independent of the product

**Status:** accepted; clarified by the 2026-10-22 recovery.

Build Personal OS out of band using coding tools, the repository, CI and a release
path that works with the instance stopped. The product's factory is a feature,
not a prerequisite for its own implementation, deployment or repair.

An in-product agent can propose improvements and return code/evidence through an
external development path. The instance does not apply, merge, deploy or restart
its own release. Optional references connect product work and repository work;
neither duplicates the other's scheduler or becomes the sole development record.
Named bot roles and MCP-hosted teams are not requirements for building the product.

Release and recovery remain outside the instance. Keep backups independent, review
schema changes separately, preserve user data and prove restore/restart behavior.
A code rollback does not undo a schema migration. These are requirements, not a
claim that boot-time migration approval or every rollback scenario is implemented.

Product-side coordination follows R3/R4 in [the roadmap](../roadmap.md).
Development follows [FACTORY.md](../../FACTORY.md). The prior unphased runbook and
role-host plan remain available in Git at 507708b, not as executable instructions.
The owner's recovery decisions are recorded in
[ADR 0018](0018-the-chat-first-recovery-decisions.md).
