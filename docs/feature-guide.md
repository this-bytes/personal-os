# Implementing a feature

Use this guide when adding or repairing a vertical slice. It applies to the
independent development workflow in FACTORY.md; it does not dispatch product agents.

## 1. Establish the outcome and seam

Read the active roadmap stage, relevant PRODUCT/ARCHITECTURE sections, published
contracts, schema and module source. Inspect existing branches/items for the same
outcome. Write a short brief containing trigger, observed gap, expected user
behavior, affected paths, non-goals and a demonstration that can fail on this gap.

Completion: a reviewer can tell what the owner will be able to do and how to check
it. A file list, implementation plan or count of tests is not the outcome.

## 2. Work in isolation

Create a branch/worktree using scripts/work-item.ts. Declare scope and coordinate
only actual file overlaps. One implementer owns the slice's code, tests, migration
and documentation; independent review is a check, not a ban on writing tests.

Completion: changes are isolated and no conflicting live edit is being overwritten.

## 3. Define compatibility before implementation

Boundary shapes belong in packages/contracts. Use existing service entry points
rather than redefining shapes in API handlers, UI components or adapters. Identify
old readers/writers and event consumers. Preserve them through additive fields,
defaults, versioning or explicit migration handling; do not reinterpret existing
statuses or turn task creation into implicit execution.

For database changes edit schema.ts, generate SQL and snapshot with db:generate,
and test against prior populated data. Never rewrite applied migrations. An old run
without a native reference stays non-resumable rather than gaining an invented id.

Completion: every changed boundary has a concrete old/new behavior and data plan.
Update CONTRACTS.md in the implementation slice, not by claiming the target is live
in advance.

## 4. Put behavior in its owner

| Change                        | Implementation seam                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Runtime protocol support      | packages/agent-adapters; maintained SDK when suitable; strict event validation and capability reporting.                           |
| Shared execution lifecycle    | Worker orchestration composed with execution/session/queue services. Chat, task and automation callers reuse it.                   |
| Routing/group handoff         | Conversation/work services, with correlation and routing safeguards; add routing.test.ts coverage for routing changes.             |
| Goal/task/evidence/acceptance | Factory service through shared capability interfaces; keep owner acceptance separate.                                              |
| Resource behavior             | Typed provider through the shared resource API, preserving schemaVersion and revision.                                             |
| UI behavior                   | apps/web and reusable packages/ui; render actual capabilities/events, with loading, empty, failed, waiting and unsupported states. |
| API/MCP                       | Thin authenticated, validated commands over domain services; shared errors and permission enforcement.                             |

A new runtime does not require a provider switch in conversation or task storage.
Do not spawn an adapter from the API server, notify the browser from the worker, or
make every caller implement its own initialization/recovery logic.

Completion: production behavior is reachable through the real user/API path and
persists across the intended boundary.

## 5. Test the outcome and its failure modes

Write a focused regression at the real seam before fixing a known bug. Use pure
unit tests for rules, integration tests for lifecycle/persistence and a browser test
for the user interaction. A protocol fixture establishes deterministic semantics;
a real-harness demonstration establishes actual runtime compatibility. Record both.

Choose failure cases that apply: duplicate submission/events, stale revisions,
permission denial/expiry, invalid payload, child exit, timeout, unsupported control,
browser disconnect and worker restart during a side effect. Assert observable
output and state, not only "did not throw" or a source-code substring.

Completion: the original gap fails before the fix and succeeds after; old data and
unsupported runtime capabilities have meaningful coverage. Avoid new tests that
merely pin prose, exact source-line locations or a copy of the implementation.

## 6. Verify and obtain independent review

Run AGENTS.md's applicable gates on the delivered tree. Format touched files;
inspect the diff for unrelated formatting. Record the revision, commands, outputs,
real-runtime versions, demonstration and remaining limitations on the item.

Independent review checks requirement coverage, module boundaries, compatibility,
permission enforcement and failure behavior. Resolve findings, rerun affected gates
and push the isolated branch. Follow existing green-CI/integration rules for landing;
a failed gate is a finding to fix, not a reason to weaken it.

Completion: an inspected deliverable and applicable measured checks, with no
unresolved required work hidden behind a "done" report. If a gate is blocked by the
environment, name it and keep delivery unaccepted.

## First example: MCP execution regression

Trigger: assign a task to an MCP-backed agent through the real worker path.
Current gap: the worker creates a fresh adapter and calls send while the MCP
transport is null. A previous capability probe used a different instance.

Use the repository's MCP fixture in an isolated worker integration test. Confirm the
error, then initialize the executing adapter and consume its real lifecycle. Assert
the tool ran, its result was persisted, the task/execution states agree and the
transport closes on completion and failure. Check chat/automation callers for the
same issue. Do not require every adapter to use MCP's handshake sequence or rewrite
the whole executor to fix one lifecycle defect.

That is the first slice in R0. The doc-only recovery has not implemented it.
