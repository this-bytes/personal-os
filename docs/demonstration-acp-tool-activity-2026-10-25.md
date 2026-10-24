# The tool-activity demonstration, 2026-10-25

**The runtime:** `opencode 1.19.4`, started as `opencode acp` — the Agent Client
Protocol session server. **The surface:** the ACP session route. **The
revision:** the head of `wi/166-acp-tool-activity`, which is the commit the
demonstration was run against. **The date:** 2026-10-25.

This is the transcript SPEC-R1-4 asks for. It names the commands that were run,
the output that was produced, and the limits that remain. Everything quoted
below was observed; nothing here is a description of what ought to happen.

It settles one thing: **the room shows what the agent is doing.** The agent
read a file with its own tools, and the room's execution trace carries the
call — the tool's name, the file it was called with, and what it got back.

And it settles a second: **a turn's work is the turn's own.** The runtime
replays a session when it is loaded, and the product loads the session to
continue it; the measurement below says where that replay lands, and the
route's rule keeps it out of the turn that resumed it.

## Where the run happened

On a **separate instance**, not the owner's own. Its own port (4395, for both
the API and the built client it serves), its own database
(`data/demo-acp-tool-activity-2026-10-25/instance/`), its own secret key, its
own owner account. The owner's instance on 4317 and the owner's account were
not touched.

The run was driven through the real web client in a real browser (Chromium
through Playwright), against the real product: the same composer, the same
panel, the same routes the panel calls. The owner of the throwaway instance
was driven by the implementing agent, and the credentials were generated for
it and exist nowhere else. The screenshots are not committed — this repository
holds no images — so everything they showed is written out here instead.

## The connection

Created through the panel's own form: **Agents → Add connection**, the adapter
type set to _ACP session agent_, the template set to _OpenCode (ACP session)_,
the name, the working directory and the environment filled in, and **Create
connection** pressed. The connection is `agt_ba62eaejoxde37jx`.

The runtime was configured to allow everything, so that the run measured the
route and not the runtime's own permission rules:

```json
{ "permission": { "read": "allow", "edit": "allow", "bash": "allow" } }
```

## What the protocol sent

The route reads the runtime's `session/update` notifications. A probe drove
the same runtime directly and captured every one of them:

```
the notification kinds: {"available_commands_update":1,"tool_call":2,"tool_call_update":4,"agent_message_chunk":14,"usage_update":1}
```

A tool call is announced and then updated, all under one `toolCallId`:

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

**The announcement carries an empty input.** The runtime says what the call is
before it says what the call is for, and the arguments arrive with the next
update. A route that announced the call on the announcement would show a row
with an empty input — and the room would not know which file the agent read.

## The session's replay

**Loading a session replays it, and the replay is not the turn's work.** The
protocol's `session/load` is how a client restores its view of a session, and
the runtime sends the session's messages as `session/update` notifications: the
owner's words, the agent's answers, and the tool calls the session made.

The product continues a session across the turns of a conversation, so the
replay reaches the route on every turn after the first. A probe drove the
installed runtime through a load and recorded where every notification landed:

```
the load answered: {"configOptions":[{"id":"model","name":"Model", ...
the notifications that arrived before the load's own answer: 10
the notifications that arrived after it: 11
```

The ten that arrived first are the replay:

```
during-load  user_message_chunk   "Read notes.txt with your tools, then reply with exactly: FIRST-TURN-OK"
during-load  tool_call             call_6dd25c9fc9664c15a39edab2
during-load  tool_call_update      call_6dd25c9fc9664c15a39edab2
during-load  agent_message_chunk   "FIRST-TURN-OK"
```

and the second prompt carried only the new words:

```
turn-2       agent_message_chunk   "SECOND-TURN-OK"
```

**So the boundary is exact: the replay lands while the load is in flight, and a
second prompt carries only what was just asked.** The route reads the runtime's
updates only once the turn's prompt has been sent, so the session's history
stays out of the turn that resumed it.

## The owner's run

### 1. The room is opened

A room was opened through the product's own API with OpenCode as its only
agent: `cnv_ptzk4oyetk3vstp6`.

### 2. The agent is asked to read a file

`notes.txt` was written in the runtime's working directory, with a marker in
it that appears nowhere else:

```
The file on disk says: TOOL-ACTIVITY-MARKER-7B4.
```

and the owner asked:

> @OpenCode read the file notes.txt in the working directory and tell me exactly what it says

### 3. The room shows the work

The agent answered, and the answer carries the marker:

```json
[{ "type": "text", "text": "I'll read it.TOOL-ACTIVITY-MARKER-7B4." }]
```

**And the room's execution trace carries the call.** The panel's own record of
the turn, as it was read back from the event log:

```
12:28:52 am · 0ms        turn.admitted queued
12:28:53 am · 0ms        turn · running running
12:29:00 am · 3.2s · ×9  message.delta message.completed · 76 chars
12:29:01 am · 1ms        tool.started read status completed
12:29:04 am · 0ms        turn.committed completed

spend 1 units · duration 10.9s
```

The row that was not there before is the `tool.started` one, and it carries the
product's name for the action — `read`.

### 4. The row opens, and says what the call was for

```
INPUT
{
  "filePath": "G:\\code\\personal-os\\data\\demo-acp-tool-activity-2026-10-25\\workspace\\notes.txt"
}

OUTPUT
{
  "status": "completed",
  "output": "The file on disk says: TOOL-ACTIVITY-MARKER-7B4.",
  "raw": {
    "output": "<path>G:\\code\\personal-os\\data\\demo-acp-tool-activity-2026-10-25\\workspace\\notes.txt</path>...",
    "metadata": { "preview": "The file on disk says: TOOL-ACTIVITY-MARKER-7B4.", "truncated": false, ... }
  }
}
```

The file the agent read, and what it read in it. Before this slice the trace
on this route held the turn and the answer and nothing in between, so the
owner watched a spinner while the agent worked.

## What the demonstration found

**The row's input was empty, and the runtime's reason is not a defect.** The
first run of this demonstration showed the tool row with an empty input:

```
INPUT
{}
```

The route had announced the call on the runtime's announcement, and OpenCode
announces a call with an empty `rawInput` and fills the arguments in with the
next update. **The fix is in the route**: a call is announced when the runtime
has said enough about it to be worth a row — what it is, and what it was
called with when the runtime has said that. The room's row then carries the
file, a moment later than the call began, and the room can show what it knows.

**The repository's own double now sends the same sequence.** The fake agent
answered the call with an empty input too, so the gate checks the thing the
runtime does rather than the thing the route hoped for.

**The reply repeated the session's earlier text, and the cause was the same
replay.** The transcript of the first run carried this as a limit:

> **The reply repeats the session's earlier text.** Each turn's answer begins
> with the answers of the turns before it, because the runtime replays the
> session's messages when it is prompted.

The room showed one long bubble holding the whole session so far. The
measurement above says why, and it says something the first reading did not:
the runtime does **not** replay when it is _prompted_ — it replays when the
session is _loaded_, and the product loads the session to continue it. So the
replay is the load's, not the turn's.

**The fix is in the route, and it is the same fix for both symptoms.** A turn's
work is what arrives after the prompt: the route reads the runtime's updates
only once the turn's prompt has been sent. The repeated answer and the
replayed tool call were the same defect — the session's history shown as the
turn's work — and one rule closes both.

The gate proves it against the built product, and it was measured both ways.
With the guard taken out of the adapter and the package rebuilt, the gate said:

```
The gate failed:
  - the turn that continued the session answered "THE-ANSWER-1THE-ANSWER-2", and the session's earlier answer is not this turn's work.
  - the turn made one call and the room was told about 2 of them, so the session's earlier calls were shown as this turn's work.
  - the turn finished one call and the room was told about 2 of them, so the session's earlier calls were shown as this turn's work.
```

With the guard in, the same gate says the turn answers with its own words and
shows the calls it made.

## The limits

What this run does **not** show, stated plainly:

- **The room, with two turns in one session, was not re-run.** The first run of
  this demonstration showed the tool activity, and that part stands. The second
  turn — the one that shows the session's history kept out of the turn — was
  not run against the runtime, because the runtime stopped being able to
  answer. At 01:01 the installed OpenCode's own log says:

  ```
  level=ERROR message="stream error" providerID=opencode modelID=big-pickle
    error.error="AI_APICallError: Free usage limit reached. Subscribe to OpenCode Go to keep going: https://opencode.ai/go"
  ```

  Every prompt after that failed the same way, including a direct
  `opencode run "reply with exactly: OK"` and a probe that does not touch the
  product's code at all. The runtime's free allowance is spent; that is an
  account condition, not a defect in the route. What is proved about the room
  is proved by the gate, which drives the **built** product against an agent
  that speaks the protocol, and what is proved about the runtime is proved by
  the measurement above. The room itself, with two turns in one session, is
  still to be run when the runtime can answer.

- **A runtime that fails without saying so leaves the turn waiting.** The
  failing run above shows it: the runtime logged the error and never answered
  the prompt, so the turn stayed `running` until the adapter's timeout. The
  route reports what the runtime says, and the runtime said nothing.
- **Steering.** The runtime does not advertise it, and the panel says
  `takes input mid-turn: no` rather than offering a control that cannot work.
- **Artifacts.** The route makes no resource of anything it carries, and the
  panel says `produces artifacts: no`.
- **A permission request and a tool call in the same turn.** The permission
  path is proved by
  [`docs/demonstration-opencode-2026-10-24.md`](demonstration-opencode-2026-10-24.md);
  this run let everything through, so it did not exercise the two together.

## The version and the revision

| What               | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Runtime            | `opencode 1.19.4`                                             |
| Route              | ACP session (`acp`)                                           |
| Instance           | port 4395, `data/demo-acp-tool-activity-2026-10-25/instance/` |
| Connection         | `agt_ba62eaejoxde37jx`                                        |
| Room               | `cnv_ptzk4oyetk3vstp6`                                        |
| Execution          | `exe_xb931201x1hqootx`                                        |
| Owner's message    | `msg_90x49vqjqut35w9t`                                        |
| The agent's answer | `msg_g2nn4nbwez78j0jn`                                        |

## The acceptance commands

```
npm run verify:acp-tool-activity
```

```
The gate for a runtime's tool activity on the ACP route.
  ok   the build the gate exercises is the build of this tree
  ok   a tool call reaches the room
  ok   the call is shown with the arguments the runtime gave
  ok   the end of the call reaches the room
  ok   a call is one row
  ok   a call that failed is a finished call
  ok   the turn answers with its own words
  ok   the turn shows the calls it made
  ok   the matrix agrees with the code

The room shows what the agent did.
```

## What a reader can re-run

- `npm run verify:acp-tool-activity` — the gate, on any machine, with no
  runtime and no account.
- `npm test -w @personal-os/agent-adapters -- acp-session-replay` — the route's
  own tests for the replay, against the protocol's double.
- `npm test -w @personal-os/agent-adapters -- acp-tool-activity` — the route's
  own tests, against the protocol's double.

The run itself needs the installed OpenCode and a browser. The driver scripts,
the screenshots and the logs are kept outside this repository, under
`data/demo-acp-tool-activity-2026-10-25/`, and the throwaway instance they
wrote to was retired when the run ended.
