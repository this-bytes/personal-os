# SPEC-R1-4 — The ACP route carries the runtime's tool activity

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:**
independent reviewer
**Depends on:** SPEC-R1-2 (the demonstration measured the gap) · **Blocks:**
nothing yet
**Evidence:** [the gate](../../scripts/verify-acp-tool-activity.ts),
[the demonstration](../demonstration-acp-tool-activity-2026-10-25.md)

## The gap

**The room's activity timeline is empty on the ACP route.** The Codex route
shows every command the agent ran and every file it changed; the ACP route
shows the turn and the answer and nothing in between, so the owner watches a
spinner while the agent reads files and runs commands.

The cause is one line in the adapter. The ACP protocol reports what the agent
is doing as `session/update` notifications, and the adapter reads exactly one
kind of them:

```ts
const kind = getByPath(update, 'sessionUpdate');
if (kind !== 'agent_message_chunk') return;
```

The protocol's other update kinds are dropped on the floor. They are not rare:
they are how every ACP agent says "I am reading this file" and "I ran this
command". The OpenCode transcript recorded the consequence — _"the room's
activity timeline is empty on this route"_ — and the Codex route showed the
same work that the ACP route did not.

**This is a gap in one adapter, not in the product.** The contract already has
`tool.started` and `tool.completed`, the worker already publishes them, the
server already turns them into the room's activity rows
(`apps/server/src/modules/executions/activity.ts`), and the panel already
draws them. Nothing needs to change but the adapter that throws the
notifications away.

## What the protocol sends

Measured against the installed runtime, not read out of a document. The probe
drove OpenCode 1.19.4 over ACP with a prompt that made it use its tools, and
captured every `session/update` notification verbatim:

```
the notification kinds: {"available_commands_update":1,"tool_call":2,"tool_call_update":4,"agent_message_chunk":14,"usage_update":1}
```

A tool call arrives as a `tool_call` and is then updated by
`tool_call_update`s, all keyed by the same `toolCallId`:

```json
{
  "sessionUpdate": "tool_call",
  "toolCallId": "call_fafa130590dd48f98dc67419",
  "title": "read",
  "kind": "read",
  "status": "pending",
  "locations": [],
  "rawInput": {}
}
```

```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "call_fafa130590dd48f98dc67419",
  "status": "in_progress",
  "kind": "read",
  "title": "read",
  "locations": [{ "path": "G:\\code\\personal-os\\data\\probe-acp-tools\\workspace\\notes.txt" }],
  "rawInput": { "filePath": "G:\\code\\personal-os\\data\\probe-acp-tools\\workspace\\notes.txt" }
}
```

```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "call_fafa130590dd48f98dc67419",
  "status": "completed",
  "title": "data\\probe-acp-tools\\workspace\\notes.txt",
  "content": [
    {
      "type": "content",
      "content": { "type": "text", "text": "The probe file says: PROBE-MARKER-41C." }
    }
  ],
  "rawOutput": {
    "output": "<path>...</path>",
    "metadata": { "preview": "The probe file says: PROBE-MARKER-41C." }
  }
}
```

Three things follow from what the runtime actually sends, and each one is a
rule the adapter has to keep:

1. **A call is announced, then updated.** The first sighting of a
   `toolCallId` starts the call. The updates that follow are the same call.
2. **`in_progress` is not the end.** The runtime repeats `in_progress` with
   more of the output each time it streams; only `completed` and `failed` end
   a call. A route that answered every update would show one call per line of
   output.
3. **The title is not the name.** The title starts as the tool's name and
   becomes the path or the command by the time the call finishes. The
   `kind` is what names the action.

## The shape

**The contract does not change.** `tool.started` and `tool.completed` are
already published, with `toolName`, `input` and `output`, and the ACP route
emits them for the first time. Nothing is reclassified and no migration is
needed.

The adapter maps one protocol update onto the product's events:

| The runtime says                       | The product says                                            |
| -------------------------------------- | ----------------------------------------------------------- |
| a `toolCallId` seen for the first time | `tool.started` with the tool's name and the runtime's input |
| a `toolCallId` reaching `completed`    | `tool.completed` with what the tool did                     |
| a `toolCallId` reaching `failed`       | `tool.completed` with the failure in it                     |

**The tool's name is the product's word for the action.** The ACP protocol
names a call's kind — `read`, `edit`, `execute`, `search` — and the product
names the same actions on the other route (`command`, `file_change`), so the
two routes say the same thing in the same room:

| The protocol's kind | The product's name |
| ------------------- | ------------------ |
| `execute`           | `command`          |
| `edit`              | `file_change`      |
| `read`              | `read`             |
| `delete`            | `file_delete`      |
| `move`              | `file_move`        |
| `search`            | `search`           |
| `fetch`             | `fetch`            |

**A kind that is not an action is not an action.** `think` and `switch_mode`
are the runtime talking about itself, not about the owner's work, and the
product has no word for either. The same rule the Codex route follows: _"an
item the product has no word for is not invented into one."_ A kind the
protocol has not named at all is carried under the name the runtime gave it,
because a tool that ran is a fact and the room should show it.

**The input is the runtime's own.** `rawInput` is what the tool was asked to
do — `{filePath}` for a read, `{command, cwd}` for a command — and it is
carried as it is. The product does not re-shape another protocol's input into
its own vocabulary, because it cannot know what the runtime meant by it.

**The output is what the tool said, and what the runtime reported.** The
content blocks carry the tool's answer; `rawOutput` carries the runtime's own
shape of it. Both are kept:

```ts
{
  status: 'completed',
  output: 'The probe file says: PROBE-MARKER-41C.',
  raw: { output: '<path>...</path>', metadata: { … } },
}
```

**A failed call is a finished call.** The product has no failure event for a
tool call — `tool.completed` is the end of a call, and the status says how it
ended. A call that failed is not an `execution.error`: the turn carried on,
and the failure belongs to the tool.

## The gate

`npm run verify:acp-tool-activity` drives the **built** adapter against an
agent that speaks the protocol and checks the events the turn produced:

1. A tool call the runtime announces becomes a `tool.started` with the
   product's name for the action and the runtime's input.
2. The call's end becomes a `tool.completed` carrying what the tool said.
3. The updates in between do not become events: a call is one row, not one
   row per line of output.
4. A call that fails is a finished call, not a failed turn.

The gate runs in the CI fast lane, because a gate that only runs on the
machine that wrote it is a habit. It says which check failed: the "ok" line is
printed only when the check added no failure.

## Acceptance

1. A room whose agent runs over ACP shows the agent's tool calls in its
   activity timeline, while the turn runs. — **met**, against the installed
   OpenCode 1.19.4; see the demonstration below.
2. A call is one row, however much output the runtime streamed for it. — **met**,
   by the gate and by the route's own tests.
3. A call that failed shows as a finished call with its failure in it. — **met**.
4. `npm run verify:acp-tool-activity` passes, the adapter's tests pass, and
   the whole suite passes. — **met**.
5. The demonstration against the installed runtime shows the timeline. — **met**.

## Evidence

### What landed

| What                                                                | What it does                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/acp.ts`                                | The route reads the runtime's tool notifications and turns them into the product's tool events. |
| `packages/agent-adapters/src/__tests__/acp-tool-activity.test.ts`   | The mapping, and the turn that carries it.                                                      |
| `packages/agent-adapters/src/__tests__/fixtures/fake-acp-agent.mjs` | The double now uses a tool, with the sequence the installed runtime sends.                      |
| `scripts/verify-acp-tool-activity.ts`                               | The gate, in the fast lane.                                                                     |
| `docs/demonstration-acp-tool-activity-2026-10-25.md`                | The transcript: the room shows the agent's read.                                                |

### The tests that fail without the implementation

This was **measured, not assumed**. The implementation was reverted — the
adapter's source stashed and the package rebuilt — and the tests and the gate
were left in place and run against the tree without it.

| Check                                                             | What it said without the implementation                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/__tests__/acp-tool-activity.test.ts` | **14 of the 15 tests failed**: the mapping returned nothing, and the turn told the room about 0 of the runtime's 1 calls. |
| `scripts/verify-acp-tool-activity.ts`                             | failed, with every reason named (below)                                                                                   |

The gate's own report without the implementation:

```
The gate for a runtime's tool activity on the ACP route.
  ok   the build the gate exercises is the build of this tree
  ok   the matrix agrees with the code

The gate failed:
  - the runtime's tool call did not reach the room as a tool.started.
  - the runtime's tool call did not reach the room at all.
  - the runtime's finished tool call did not reach the room as a tool.completed.
  - the runtime announced one call and the room was told about 0 of them.
  - the runtime finished one call and the room was told about 0 of them.
  - a tool call that failed did not reach the room as a tool.completed.
```

### The demonstration

The gate proves the product's half. The runtime's half was measured against
the installed runtime, and the room's own execution trace carries the call:

```
12:28:52 am · 0ms        turn.admitted queued
12:28:53 am · 0ms        turn · running running
12:29:00 am · 3.2s · ×9  message.delta message.completed · 76 chars
12:29:01 am · 1ms        tool.started read status completed
12:29:04 am · 0ms        turn.committed completed
```

and the row opens with the file the agent read and what it got:

```
INPUT
{ "filePath": "G:\\code\\personal-os\\data\\demo-acp-tool-activity-2026-10-25\\workspace\\notes.txt" }

OUTPUT
{ "status": "completed", "output": "The file on disk says: TOOL-ACTIVITY-MARKER-7B4.", "raw": { … } }
```

`docs/demonstration-acp-tool-activity-2026-10-25.md` is the transcript.

### What the demonstration found

**The first run showed the row with an empty input.** The route had announced
the call on the runtime's announcement, and OpenCode announces a call with an
empty `rawInput` and fills the arguments in with the next update. The route
now announces a call when the runtime has said enough about it to be worth a
row, and the repository's own double sends the same sequence the runtime
does — so the gate checks the thing the runtime does rather than the thing
the route hoped for.

## What is not covered

- **Steering.** The runtime does not advertise it, and the panel says so
  rather than offering a control that cannot work.
- **The reply that repeats the session's earlier text.** The runtime replays
  the session's messages when it is prompted, and the room shows one long
  bubble holding the whole session so far. That is a separate defect, with a
  separate reason, and it is not fixed here.
- **The other ACP routes' tool names.** Hermes and the other ACP runtimes
  report their own kinds; the mapping is by kind, so a runtime that names a
  kind the protocol has not named carries that kind as its name.
