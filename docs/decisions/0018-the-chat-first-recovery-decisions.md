# 18. The chat-first recovery decisions

**Status:** accepted — owner direction, 2026-10-22. Recorded here 2026-10-24.

## Context

On 2026-10-22 the owner approved a direction for the product: recover toward a
rich chat-first experience, prove it across harnesses before expanding into
autonomous teams and the product factory. The record of that approval lived in
`docs/recovery.md`, a 14-row decision table with an accompanying measurement of
where the repository stood.

The document set was being consolidated, and retiring that file without a record
would have left the owner's approved direction living only in Git history — with
[ADR 0007](0007-the-environment-agents-operate-and-extend.md) and
[ADR 0010](0010-self-improvement-without-self-dependence.md) both pointing at
it. A record that other records point at is part of the architecture, not a
working note.

## Decision

The owner's decisions stand as recorded on 2026-10-22. They are requirements,
not inferences from the old code.

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

**The measurement taken with the decision.** At the review starting at `c61cd7b`,
79 of the latest 100 non-merge commits changed only Markdown or factory records.
There were 131 work-item files, including 53 labelled implement. These are
repository measurements, not counts of live agents.

**The gaps the decision was taken against**, in the repository's own words:

- MCP `send` required a connected instance while the worker constructed an
  instance and called `send` without connecting it. The actual adapter was
  exercised against its fixture: `send` alone failed with "The MCP server was
  never reached"; connect-then-send succeeded.
- MCP `task.create` could store `assigneeId` without enqueueing execution, and
  the tool list had no `task.assign`.
- Factory evidence could consist only of agent response text.
- Rich chat was partial.
- Interaction Contract 7 described unimplemented behaviours.
- Smoke covered the lifecycle using an echo agent.
- Queue labels and dispatch status could drift.

**What stays outside the recovery:** multi-user tenancy, a replacement inference
engine, a new agent harness, distributed queue infrastructure, a plugin
marketplace and a general workflow designer.

## Consequences

- **`docs/recovery.md` is retired.** Its decisions live here; its measurement and
  its gap list live here; its pointer role is taken by this record.
- **ADR 0007 and ADR 0010 point here** instead of at a file that no longer
  exists.
- **The gaps are historical.** Each one was answered by a spec; the specs are
  the current statement of what is done, and
  [docs/roadmap.md](../roadmap.md) says what is outstanding.
- **The exclusions still stand**, and plugins are now named inside them: a
  plugin is a first-party extension, not a marketplace. See
  [ADR 0016](0016-plugins-are-isolated-runtime-extensions.md).
- **The order stands.** Execution foundations, then rich chat with Codex and
  OpenCode, then all five runtimes, then team coordination, then the factory.
  Each stage needs a working demonstration and meaningful tests.
