# Chat-first recovery

**Status:** owner-approved direction, 2026-10-22. Documentation change only;
implementation is tracked by the [roadmap](roadmap.md).

## Purpose and precedence

Personal OS is the environment one person's agents operate and extend. Its primary
working surface is a rich conversation: the owner directs work, sees activity,
answers questions and inspects results there. Team coordination and the factory
use that foundation. The out-of-band development workflow builds the product
independently of the product's own factory feature.

This decision supersedes conflicting priorities in strategy.md, streams.md,
free-period-plan.md and the earlier roadmap; the map-first layout in the Forge
prototype; and fixed-role handoff requirements in the former FACTORY.md. Retain
Forge's visual language. Existing resource features, data and published interfaces
remain supported. The broader product remains an agent-operated environment;
chat-first is the delivery order and working surface, not a reduction to text chat.

Published schemas and routes remain governed by CONTRACTS.md and
packages/contracts. This plan does not silently change their wire behavior.
Proposed lifecycle and capability additions require implementation, compatibility
handling and a contract update in the slice that introduces them. Older ADRs remain
historical evidence; this decision supersedes their conflicting UX emphasis and
build-process rules, not their unchanged safety and protocol boundaries.

## Owner decisions

The owner confirmed every recommendation in Q1–Q14 and then approved the
consolidated architecture and recovery sequence. These are requirements, not
inferences from the old code.

| Decision | Approved requirement                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1       | Streaming, tool activity, files/images, Markdown/code, output previews, history, stop/cancel and in-conversation questions/permissions form the rich-chat checklist.                                     |
| Q2       | Support Codex, OpenCode, Pi, Hermes and OpenClaw, including externally hosted agents through suitable supported interfaces. HTTP is an option, not a universal agent protocol.                           |
| Q3       | One cohesive conversation interface preserves each harness's capabilities; a terminal is a supported fallback or diagnostic surface, not the primary integration contract.                               |
| Q4       | Direct chats and persistent team rooms, mentions, optional coordinators and visible handoffs/results. Roles and names are configurable.                                                                  |
| Q5       | A delegated goal drives continued action, checking and follow-up until a verified result, an execution limit or a real owner decision blocks it. Planning or filing tasks alone is not delivery.         |
| Q6       | Stable identities, instructions and optional memory; separate working sessions by conversation/project and truthful session-resume support.                                                              |
| Q7       | Agents inspect/edit/run tests/delegate within approved scope. Destruction, publishing, deployment and wider access follow explicit approval rules. Delegation cannot widen authority.                    |
| Q8       | Explicit project workspace, instructions and access; remote agents declare their execution environment and return inspectable artifacts, diffs or repository references. Parallel coding uses isolation. |
| Q9       | Steer-now, queued follow-ups and stop are distinct operations; unsupported actions are explained. Delivery and consumption are distinguishable.                                                          |
| Q10      | Closing the browser does not stop work. Reconnect restores history/activity. Restart reconnects surviving runs where possible and identifies uncertain outcomes without blind replay.                    |
| Q11      | External orchestrators own their internal execution. Personal OS retains goal, authority, observed progress and acceptance rather than duplicating their scheduler.                                      |
| Q12      | Instructions, project knowledge and history are separate and inspectable. Cross-project sharing is explicit. Harness-native memory is identified separately.                                             |
| Q13      | Conversation is the primary working surface. Board, map and dashboards support it; Forge styling remains.                                                                                                |
| Q14      | Prove rich chat with Codex and OpenCode, support all five targets, then deliver autonomous teams and the factory.                                                                                        |

## Current evidence and limits

At the review starting at c61cd7b, 79 of the latest 100 non-merge commits changed
only Markdown or factory records. There were 131 work-item files, including 53
labelled implement. These are repository measurements, not counts of live agents.
The recovery worktree starts at 6855065, which also contains intervening policy
fixes; preserve those changes.

Existing strengths: provider-neutral contracts and adapters; a supervised worker;
persisted events; conversations, routing guards, resource revisions and owner
acceptance; Vitest, Playwright and smoke infrastructure. Retain them.

| Observed gap                                                                                                    | Evidence / first action                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP send requires a connected instance, while the worker constructs an instance and calls send without connect. | packages/agent-adapters/src/mcp.ts and apps/worker/src/executor.ts. The actual adapter was exercised against its fixture: send alone failed with "The MCP server was never reached"; connect then send succeeded. Reproduce through the worker as the first regression. ACP initializes inside send and does not share this exact failure. |
| MCP task.create can store assigneeId without enqueueing execution; the tool list has no task.assign.            | packages/contracts/src/mcp.ts, modules/mcp/server.ts and modules/factory/service.ts. Preserve create semantics; add an explicit authorized dispatch operation with idempotency rather than making creation silently run work.                                                                                                              |
| Factory evidence can consist only of agent response text.                                                       | executeFactoryTask in apps/worker/src/executor.ts. Require inspectable deliverables and verification evidence for delivery claims. Text remains a valid observation.                                                                                                                                                                       |
| Rich chat is partial.                                                                                           | ConversationDetail, Composer and ChatMessageList support basic messaging; complete normalized activity, attachments/previews and lifecycle controls need vertical slices.                                                                                                                                                                  |
| Interaction Contract 7 describes unimplemented behaviors.                                                       | CONTRACTS.md marks its additions as not yet implemented. Plan each behavior against actual source; do not call it implemented because it is published in prose.                                                                                                                                                                            |
| Smoke covers lifecycle using an echo agent.                                                                     | scripts/smoke.ts. Retain it as a plumbing check, add real-harness acceptance demonstrations.                                                                                                                                                                                                                                               |
| Queue labels and dispatch status can drift.                                                                     | WI-072 and scripts/work-item.ts. Resolve existing items as selected; queue reform is not a prerequisite for product delivery.                                                                                                                                                                                                              |

The MCP reproduction used Node's TypeScript transform on the unmodified adapter
sources and the repository's MCP fixture; it was not a full worker integration test.
It establishes the adapter lifecycle failure. The first implementation slice must
lock it down at the actual worker seam. The complete test suite was not run during
that initial read-only review; validation of this documentation is recorded in
WI-138.

## Scope that stays outside the recovery

Multi-user tenancy, a replacement inference engine, a new agent harness, distributed
queue infrastructure, a plugin marketplace and a general workflow designer remain
out of scope. Existing dashboards/resources/automations are preserved; expanding
them does not displace the chat-first sequence. Agent-authorship measures remain
supported, but a count or documentation correction cannot substitute for a working
chat or delivery demonstration.

Implementation choices such as precise migration fields, pinned runtime versions,
retention limits and concurrency defaults are settled in the relevant slice, with
safe bounded defaults and evidence. A choice that changes the requirements above
returns to the owner; routine technical choices do not require another interview.
