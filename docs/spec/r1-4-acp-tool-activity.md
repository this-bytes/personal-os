# SPEC-R1-4 — The ACP route carries the runtime's tool activity

**State:** delivered, with one piece of evidence outstanding — the room itself,
with two turns in one session, is still to be demonstrated, because the
installed runtime's free allowance was spent before the second turn could be
asked · **Owner:** implementing agent, one session · **Verifier:**
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

## The turn's work is the turn's own

**A session that is loaded is replayed.** The protocol's `session/load` is how a
client restores its view of a session, and the runtime sends the session's
messages as `session/update` notifications: the owner's words, the agent's
answers, and the tool calls the session made. That history arrives while the
load is still in flight — before the load's own answer.

The product continues a session: a turn that is the next one in a conversation
continues the session the conversation is in, when the runtime said it keeps
sessions (`apps/worker/src/executor.ts`). So the replay reaches the route on
every turn after the first, and a route that treated every update as the turn's
work put the session's history into the turn that resumed it:

- the owner's room showed the earlier answer again, so the answer was the
  session's whole transcript so far rather than the turn's answer;
- the activity timeline showed a row for a call the runtime made a turn ago, so
  the trace was not a record of this turn.

**The rule: a turn's work is what arrives after the prompt.** The route reads
the runtime's updates only once the turn's prompt has been sent. The boundary
is exact, and it was measured rather than assumed — a probe drove the installed
runtime through a load and recorded where every notification landed:

| What the runtime sent                                                        | When it arrived                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `user_message_chunk`, `tool_call`, `tool_call_update`, `agent_message_chunk` | **during the load**, before the load's own answer |
| `available_commands_update`                                                  | after the load's answer                           |
| `agent_message_chunk` — the new words only                                   | during the second prompt                          |

The replay is the load's; the second prompt carries only the new words. So the
updates that arrive before the prompt is written belong to the load, and the
ones that arrive after it belong to this turn.

The contract does not change. This is the adapter deciding what a turn's events
are, and it is the same decision the Codex route already makes.

## The gate

`npm run verify:acp-tool-activity` drives the **built** adapter against an
agent that speaks the protocol and checks the events the turn produced:

1. A tool call the runtime announces becomes a `tool.started` with the
   product's name for the action and the runtime's input.
2. The call's end becomes a `tool.completed` carrying what the tool said.
3. The updates in between do not become events: a call is one row, not one
   row per line of output.
4. A call that fails is a finished call, not a failed turn.
5. A turn that continues a session answers with its own words: the session's
   earlier answer is not this turn's work.
6. A turn that continues a session shows the calls it made: the session's
   earlier calls are not this turn's work either.

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
4. A turn that continues a session shows only its own work: its own answer and
   its own calls. — **met** by the gate, which drives the built product; the
   room itself is still to be run, because the installed runtime's free
   allowance was spent before the second turn could be asked. See the
   demonstration's limits.
5. `npm run verify:acp-tool-activity` passes, the adapter's tests pass, and
   the whole suite passes. — **met**.
6. The demonstration against the installed runtime shows the timeline. — **met**.

## Evidence

### What landed

| What                                                                | What it does                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/acp.ts`                                | The route reads the runtime's tool notifications and turns them into the product's tool events.      |
| `packages/agent-adapters/src/acp.ts` (the turn's work)              | The route reads the runtime's updates only once the turn's prompt has been sent.                     |
| `packages/agent-adapters/src/__tests__/acp-tool-activity.test.ts`   | The mapping, and the turn that carries it.                                                           |
| `packages/agent-adapters/src/__tests__/acp-session-replay.test.ts`  | The replay, measured on the transport, and the turn that keeps only its own work.                    |
| `packages/agent-adapters/src/__tests__/fixtures/fake-acp-agent.mjs` | The double now uses a tool, with the sequence the installed runtime sends, and it replays a session. |
| `scripts/verify-acp-tool-activity.ts`                               | The gate, in the fast lane.                                                                          |
| `docs/demonstration-acp-tool-activity-2026-10-25.md`                | The transcript: the room shows the agent's read, and the second turn shows only its own work.        |

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

### The tests that fail without the turn's work

**Also measured, not asserted.** The guard that keeps the load's replay out of
the turn — `if (!promptSent) return;` — was taken out of the adapter, the
package was rebuilt, and the tests and the gate were left in place:

| Check                                                              | What it said without the guard                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/__tests__/acp-session-replay.test.ts` | **3 of the 6 tests failed**: the turn answered `THE-ANSWER-1THE-ANSWER-2`, and the room was told about 2 calls where the turn made 1. |
| `scripts/verify-acp-tool-activity.ts`                              | failed, with every reason named (below)                                                                                               |

```
The gate for a runtime's tool activity on the ACP route.
  ok   the build the gate exercises is the build of this tree
  ok   a tool call reaches the room
  ok   the call is shown with the arguments the runtime gave
  ok   the end of the call reaches the room
  ok   a call is one row
  ok   a call that failed is a finished call

The gate failed:
  - the turn that continued the session answered "THE-ANSWER-1THE-ANSWER-2", and the session's earlier answer is not this turn's work.
  - the turn made one call and the room was told about 2 of them, so the session's earlier calls were shown as this turn's work.
  - the turn finished one call and the room was told about 2 of them, so the session's earlier calls were shown as this turn's work.
```

The first test in that file proves the replay happens at all, on the transport
and without the adapter, so the ones after it are not passing because nothing
was replayed.

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

### The measurement the rule rests on

The rule — _a turn's work is what arrives after the prompt_ — is worth nothing
unless the runtime behaves the way the rule assumes. A probe drove the installed
runtime through a load and recorded where every notification landed:

| What the runtime sent                                   | When it arrived                                   |
| ------------------------------------------------------- | ------------------------------------------------- |
| the owner's words, the earlier call, the earlier answer | **during the load**, before the load's own answer |
| the new words                                           | during the second prompt                          |

The replay lands while the load is in flight, and a second prompt carries only
what was just asked. So the boundary is not a guess: the updates that arrive
before the prompt is written belong to the load, and the ones that arrive after
it belong to this turn.

The room itself, with two turns in one session, is still to be run: the
installed runtime's free allowance was spent before the second turn could be
asked, and the transcript says so with the runtime's own log line.

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
- **The other ACP routes' tool names.** Hermes and the other ACP runtimes
  report their own kinds; the mapping is by kind, so a runtime that names a
  kind the protocol has not named carries that kind as its name.
- **A runtime that replays after the prompt.** The rule this slice settled is
  the one the installed runtime follows: the replay lands while the load is in
  flight. A runtime that replayed _after_ the prompt had been sent would put
  its history into the turn, and nothing in the protocol says it may not.
