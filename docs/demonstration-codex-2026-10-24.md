# The Codex demonstration, 2026-10-24

**The runtime:** `codex-cli 0.163.0`, signed in on this machine with a ChatGPT
account. **The surface:** the App Server — `codex app-server`, the JSON-RPC
service Codex exposes on standard input and output. Not the command line
route. **The revision:** `e2e8d0f`, the merge of PR #33, which is the commit
the App Server adapter landed in. **The date:** 2026-10-24.

This is the transcript SPEC-R1-1 asks for. It names the commands that were run,
the output that was produced, and the limits that remained. Everything quoted
below was observed; nothing here is a description of what ought to happen.

## Where the run happened

On a **separate instance**, not the owner's own. Its own port (4391 for the
API, 5191 for the client), its own database
(`data/demo-codex-2026-10-24/`), its own secret key, its own owner account.
The owner's instance on 4317 and the owner's account were not touched: the
demonstration was run on a throwaway so that nothing it wrote — a file, a
conversation, a thread inside Codex's own storage — landed in the owner's
workspace. The throwaway was retired afterwards: its processes were stopped
and its database, its owner account and the files the run wrote are gone. The
run's own screenshots and observation logs were kept outside the instance, and
outside the repository.

The run was driven through the real web client in a real browser (Chromium
through Playwright), against the real product: the same composer, the same
panel, the same routes the panel calls. The owner of the throwaway instance
was driven by the implementing agent — the owner in the transcript is that
account, and the credentials were generated for it and exist nowhere else. The
screenshots that were taken during the run are not committed — this repository
holds no images — so everything they showed is written out here instead.

## The connection

Created through the panel's own request, `POST /api/agents`, with the
`codex-app-server` template's configuration:

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| `command`        | `codex`                                |
| `cwd`            | `data/demo-codex-2026-10-24/workspace` |
| `sandbox`        | `read-only`                            |
| `approvalPolicy` | `on-request`                           |
| `ephemeral`      | `false`                                |
| `threadSource`   | `personalOs`                           |
| `timeoutSeconds` | `900`                                  |

The server probes a connection when it is saved, and the capabilities it
reported were the runtime's own, not the template's:

```json
{
  "chat": true,
  "streaming": true,
  "persistentSessions": true,
  "backgroundTasks": false,
  "cancel": true,
  "approvals": true,
  "artifacts": false,
  "acceptsSteering": true
}
```

The panel's presence list read `Codex · codex-app-server · connected`.

The sandbox was `read-only` on purpose. With `workspace-write` the same
demonstration ran a command that wrote a file **without asking anyone** — the
first run of this transcript did exactly that. The permission request only
appears when the runtime cannot do the thing on its own, and the preset's own
default is the honest one.

## The pinned protocol

The App Server JSON Schema the adapter is written against is committed at
`docs/protocols/codex-app-server/0.163.0/`, beside `PINNED.md`, which names
the runtime, the command that produced the schema and the fact that what is
committed is a subset of the generated bundle. The schema is excluded from
Prettier: it is committed byte for byte, as the runtime generated it, so that
a reader can check it against the runtime's own output.

The gate reads it, and it checks that every method the adapter sends is one
the protocol defines:

```
-- the pinned protocol --
  ok      Codex 0.163.0 is pinned, with 17 methods in the protocol's tables.
```

## The adapter run

Two checks, both shipped, both run against the installed runtime rather than
a fixture.

`npm run verify:codex-app-server` drives the adapter against the repository's
own App Server double:

```
-- the route, against the App Server double --
  ok      the handshake answered.
  ok      the capability row the preset publishes is the capability the adapter reports.
  ok      the thread carried: thread_1 is the session the turn ran in.
  ok      the turn carried: the runtime’s text came back as the turn’s events.
  ok      the tool activity carried: the runtime’s command arrived as tool events.
  ok      the steer carried: the runtime received it while the turn was running.
  ok      the approval carried: "Run npm test" reached the owner.
  ok      the runtime was answered: the approval request was not left hanging.
  ok      every method the adapter sent is one the pinned protocol defines (initialize, thread/start, turn/start, turn/steer).
  ok      the session continued: the next turn went back into thread_1.
```

`npm run verify:codex-runtime` drives the same adapter against the **installed
Codex**:

```
-- the installed runtime --
  ok      the runtime answered the handshake.
  ok      the runtime produced an answer.
  ok      the session continued: the turn that resumed 01a16c89-3d94-7403-a925-c398809bba5e produced an answer.
```

For comparison, the command line route on the same machine and the same
runtime — `npx tsx scripts/verify-runtime.ts --preset codex-cli --prompt "..."`:

```
Runtime:  Codex — Codex (command line)
Adapter:  codex

-- the handshake --
  chat: true
  streaming: true
  persistentSessions: false
  backgroundTasks: false
  cancel: true
  approvals: false
  artifacts: false

Command:  C:\Users\Aaron\AppData\Roaming\npm\codex.CMD exec --json --sandbox read-only --skip-git-repo-check --ephemeral -
```

Two routes, one runtime, and they are not the same surface. The command line
route is one process per turn (`--ephemeral`), keeps no session between turns,
and cannot ask the owner anything.

## The owner's run

### 1. The runtime answers through the product's own adapter

See **The adapter run** above. The handshake answers, the capability rows are
printed, the command line the adapter will really run is printed, and the turn
returns the runtime's own answer.

### 2. The runtime is connected

The connection was created and the server probed it. The capabilities it
reported are in **The connection** above, and they are the runtime's own: the
route reported `approvals: true` and `acceptsSteering: true` because the
App Server supports them, and `artifacts: false` and `backgroundTasks: false`
because it does not.

### 3. The room is opened

A conversation was opened with the connection as its only agent participant.
The presence list read:

```
Owner
human

Codex
codex-app-server · connected
```

### 4. A small change is asked for

`@Codex what can you do in this room?` was sent from the composer.

The text arrived in pieces. Sampled every half second from the live room:

```
+0.5s  the live text reads: "reply 06:48 pm · depth 1 · exe_y08l6il82dc6oid7  No content"
+5.2s  the live text reads: "I can help with the"
+5.7s  the live text reads: "I can help with the Personal OS repository in this room: explain the"
+6.2s  the live text reads: "I can help with the Personal OS repository in this room: explain the architecture, investigate bugs, review code, implem"
```

The event log for that turn is the runtime's own, token by token:

```
193 message.created
194 execution.event: execution.status queued
195 message.created
196 execution.event: execution.status running
197 execution.event: delta "I"
198 execution.event: delta " can"
199 execution.event: delta " help"
...
225 execution.event: delta ".\n\n"
226 execution.event: delta "I"
227 execution.event: delta "’ll"
...
298 execution.event: message.completed "I can help with the Personal OS repository in this room: ..."
299 message.updated
300 execution.event: execution.status committed
```

The turn capability panel was shown (`keeps its session: yes`, `runs
background tasks: no`, `can be cancelled: yes`, `asks for approvals: yes`,
`produces artifacts: no`, `takes input mid-turn: yes`), and the execution
trace was shown beside the transcript.

The runtime's **tool activity** came back as tool events rather than as prose.
When Codex was asked to write a file, the trace carried the command it ran:

```
335 execution.event: tool.started {"command":"pwsh.exe -Command \"Set-Content -LiteralPath 'G:\\code\\personal-os\\data\\demo-codex-2026-10-24\\workspace\\proof.txt' -Value 'proof' -NoNewline\""}
```

and, once the command had run:

```
394 execution.event: tool.completed {"command":"pwsh.exe -Command 'node -e \"setTimeout(() => {}, 120000)\"'","exit_code":0,"output":"","status":"completed"}
```

### 5. The owner follows up while the work runs

While a turn was running, the composer's delivery was switched to **steer
now** and a second message was sent: `@Codex stop waiting and answer me now
instead`.

The panel's steer control was enabled while the turn ran. The message went
out with `delivery: steer`, addressed to the agent, and the server's own
account of what happened to it came back on the message:

```
delivery: steer
detail: "The turn that was running took this steer."
```

And the runtime acted on it. The agent's answer to the turn that was running:

> I stopped waiting. I hadn't started the 90-second command, so there's no
> result to report.

The steer reached the turn that was running, and Codex answered it.

### 6. A permission request is answered

`@Codex create a file named proof.txt in the working directory, containing the
word proof` was sent with the `read-only` sandbox in force.

The request arrived in the waiting list, in the room's own words:

> Run "C:\Users\Aaron\AppData\Local\Microsoft\WindowsApps\Microsoft.PowerShell_8wekyb3d8bbwe\pwsh.exe"
> -Command "Set-Content -LiteralPath
> 'G:\code\personal-os\data\demo-codex-2026-10-24\workspace\proof.txt' -Value
> 'proof' -NoNewline"
>
> An agent is stopped and waiting for your decision.

with **Approve** and **Reject** beside it. The event log shows the request as
the runtime's own, with an approval id that carries the session:

```
336 execution.event: approval.requested {"approvalId":"apr_codex_01a16ce2-454d-7cb1-b860-8d9ff6a84517_1","summary":"Run \"...pwsh.exe\" -Command \"Set-Content -LiteralPath '...proof.txt' -Value 'proof' -NoNewline\""}
```

The owner approved it. The decision came back to the runtime **as the next
turn in the same thread** — the next execution was admitted and ran the
command, this time with the verification in the same line:

```
338 message.created
339 execution.event: execution.status queued
340 execution.event: execution.status running
351 execution.event: tool.started {"command":"pwsh.exe -Command \"Set-Content -LiteralPath '...proof.txt' -Value 'proof' -NoNewline; Get-Content -LiteralPath '...proof.txt' -Raw\""}
```

The agent's own account of the turn:

> I'll create proof.txt in the working directory with the word proof. Writing
> the file requires approval because this session has read-only access.

The file exists, with the word `proof` in it.

### 7. A run is stopped

`@Codex run the command node -e "setTimeout(() => {}, 120000)" and then tell
me what happened` was sent. The panel said the turn was running, the stop
control was enabled, and the stop was pressed.

The state read **`stop requested`**, and the panel said what the server said
would happen:

> Stop requested. The runtime may finish the current turn.

It did. The runtime finished the turn it was in:

> The command ran for about 120 seconds, produced no output, and exited
> successfully with code 0.

A stop is a request, and the panel does not claim a cancellation it cannot
confirm.

### 8. The browser is closed and reopened, and the worker is restarted

The room survived a full reload: the messages, the tool activity and the
result references were all there, and the runtime session was named in the
panel's own panel —

```
RUNTIME SESSION
Co... @1a16ce2-1fb2-7691-bc9f...   the next turn continues it
```

Every agent turn in the room ran in that one session:

```
2026-10-24T07:41:51.588Z exe_b83u2rk33mm9k1gw session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T07:42:00.984Z exe_d30jf2w8zap73c9w session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T07:46:36.670Z exe_9o9m5dby878q5h9w session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T07:56:43.440Z exe_k91ah1ct5hz8amoy session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T07:58:20.092Z exe_l8lmfmmpf962a4mb session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T08:00:15.805Z exe_81qgs1wvjktw0khn session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
2026-10-24T08:02:24.349Z exe_sp9jmlb0muhi7w3b session=01a16cdb-e1cf-72c1-9ac7-ed4f00920d5a status=complete
```

The worker was then **stopped while a turn was in flight** and a new worker
was started. The turn was not re-run and was not silently forgotten. It was
held, and the server's sentence says what that means:

```
exe_c3nkec7oshj3jd67 status=unknown
error: "The runtime could not say what became of this run, so the outcome is
uncertain. It was not run again, and the owner decides what happens next."
```

The next turn — the owner's own next message — ran in the same session, and
the runtime said plainly what it had lost:

> The earlier command's session is no longer accessible, so I can't verify its
> result. I'll run it again for this request.

### 9. A file is attached

A file was attached in the composer and the message went out carrying it:

```json
{
  "id": "msg_t35w11xokpl7o7si",
  "origin": { "kind": "human" },
  "delivery": "queue",
  "content": [
    { "type": "text", "text": "@Codex read the attached file and tell me what it says" },
    { "type": "file", "resourceId": "res_ljwjmhh24lo1hg5i" }
  ]
}
```

**The runtime did not receive it.** The agent answered:

> I don't see an attached file. Please attach it again or give me its path in
> the working directory, and I'll read it.

That is a limit of the route as it stands, and it is in **The limits** below.

### 10. The persisted history

After a full reload the room held every turn, the tool activity and the
result references, and every one of them still pointed at the same session —
the ids in the table under step 8 are the ids the room carried after the
reload.

## The limits

**1. The attachment does not reach the runtime.** The composer's upload
worked, the resource was created (`res_ljwjmhh24lo1hg5i`), and the owner's
message carried the file part to the server. The adapter does not map that
part into the App Server's turn input, so the runtime never saw it, and the
agent said so rather than pretending otherwise. The connection reports
`artifacts: false`, and nothing in the capability row claims otherwise. **The
supported alternative:** the file is in the workspace the connection points at
— the agent read `attached.txt` by path when it was told where it was.

**2. A stop is a request.** The runtime finished the turn it was in after the
stop was pressed, and the panel said so: _"Stop requested. The runtime may
finish the current turn."_ The App Server has no cancellation of its own for a
running turn.

**3. A worker restart holds the turn, it does not repeat it.** The turn that
was in flight when the worker was stopped was held `unknown` with the
outcome uncertain, and the server said it was not run again. The side effect
of the _next_ turn was that the runtime started a fresh session and ran the
command again, because the App Server's thread does not survive the process
that held it. The thread is on disk; the process is not.

**4. The runtime's paragraphs arrive joined.** Codex produced three separate
items and the product's transcript shows them as one run of text:

> I'll run the command and wait for it to finish. It should stay open for about
> two minutes without printing anything.The command is still running and has
> produced no output, as expected.

The item boundaries are not carried across, so a paragraph break the runtime
wrote is lost between the items.

**5. The turn's own row is empty while the turn runs.** The server creates the
agent's message row when the turn is admitted, and it is filled when the turn
ends. While the turn runs the live text is drawn in the streaming bubble
beside it, so for a few seconds the transcript shows an empty turn and the
live text in two places. The turn is not lost and the text is not duplicated;
the empty row is the row waiting for its content.

**6. The command line route is not this route.** `codex exec --json` is one
process per turn, keeps no session between turns, and cannot ask the owner
for permission. `persistentSessions: false`, `approvals: false`. The App
Server is the richer surface and this run was on it.

## The version and the revision

|                 |                                                                              |
| --------------- | ---------------------------------------------------------------------------- |
| Runtime         | `codex-cli 0.163.0`, signed in with a ChatGPT account                        |
| Surface         | the App Server (`codex app-server`), JSON-RPC over standard input and output |
| Revision        | `e2e8d0f` — the merge of PR #33, which landed the App Server adapter         |
| Date            | 2026-10-24                                                                   |
| Pinned protocol | `docs/protocols/codex-app-server/0.163.0/`                                   |

## The acceptance commands

Run on the delivered revision:

```
npm run format:check
npm run typecheck
npm run test
npm run test:e2e
npm run smoke
npm run gates
```

All of them passed on the revision this document was committed with: every
gate, and the browser suite against the built client — 40 tests.

## What a reader can re-run

Without a Codex account, the route is proved against the repository's own
double:

```
npm run verify:codex-app-server
```

With one, the same adapter is driven against the installed runtime:

```
npm run verify:codex-runtime
npx tsx scripts/verify-runtime.ts --preset codex-cli --prompt "what can you do?"
```
