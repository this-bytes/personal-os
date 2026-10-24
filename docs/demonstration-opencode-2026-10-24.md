# The OpenCode demonstration, 2026-10-24

**The runtime:** `opencode 1.19.4`, started as `opencode acp` — the Agent Client
Protocol session server. No credential: the free model OpenCode reaches without
one answered every turn in this transcript. **The surface:** the ACP session
route. **The revision:** `ba35992`, the head of `main` after PR #36, which is
the commit the OpenCode demonstration was run against. **The date:** 2026-10-24.

This is the transcript SPEC-R1-2 asks for. It names the commands that were run,
the output that was produced, and the limits that remained. Everything quoted
below was observed; nothing here is a description of what ought to happen.

It also names the two defects the run found. Both were fixed and landed before
the run was repeated; the transcript below is the second run, against the fixed
product.

## Where the run happened

On a **separate instance**, not the owner's own. Its own port (4393, for both
the API and the built client it serves), its own database
(`data/demo-opencode-2026-10-24/instance/`), its own secret key, its own owner
account. The owner's instance on 4317 and the owner's account were not touched:
the demonstration ran on a throwaway so that nothing it wrote — a file, a
conversation, a session inside OpenCode's own storage — landed in the owner's
workspace.

The run was driven through the real web client in a real browser (Chromium
through Playwright), against the real product: the same composer, the same
panel, the same routes the panel calls. The owner of the throwaway instance was
driven by the implementing agent — the owner in this transcript is that
account, and the credentials were generated for it and exist nowhere else. The
screenshots that were taken during the run are not committed — this repository
holds no images — so everything they showed is written out here instead.

## The connection

Created through the panel's own form: **Agents → Add connection**, the adapter
type set to _ACP session agent_, the template set to _OpenCode (ACP session)_,
the name, the working directory and the environment filled in, and **Create
connection** pressed. The template filled the command and the arguments:

| Field            | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| `command`        | `opencode`                                                                |
| `args`           | `acp`                                                                     |
| `cwd`            | `data/demo-opencode-2026-10-24/workspace`                                 |
| `env`            | `OPENCODE_CONFIG=data/demo-opencode-2026-10-24/opencode-permissions.json` |
| `timeoutSeconds` | `900`                                                                     |

The server probes a connection when it is saved, and the capabilities it
reported were the runtime's own, not the template's:

```json
{
  "chat": true,
  "streaming": true,
  "persistentSessions": true,
  "backgroundTasks": true,
  "cancel": true,
  "approvals": true,
  "artifacts": false
}
```

The panel showed the connection as `connected`, with the capability chips
`chat`, `streaming`, `sessions`, `tasks`, `cancel`, `approvals` and
`set revision 2` — revision 2 because the probe found a set that differed from
the one the connection was created with. The presence list in the room read
`OpenCode · acp · connected`.

### Why the runtime was configured to ask

This machine's OpenCode allows every operation by default. A first run wrote a
file and ran a command with nobody asked, and the runtime's own log recorded
why:

```
message=evaluated permission=edit pattern="data\\demo-opencode-2026-10-24\\workspace\\proof.txt" action.permission=* action.action=allow action.pattern=*
message=evaluated permission=bash pattern="node -e \"console.log(1234)\"" action.permission=* action.action=allow action.pattern=*
```

`action.action=allow` with a wildcard pattern: the runtime never asked. The
demonstration therefore ran it with the configuration it takes to ask, taken
from the installed runtime's own schema (`PermissionActionConfig` is
`"ask" | "allow" | "deny"`, per tool or per pattern):

```json
{ "permission": { "read": "allow", "edit": "ask", "bash": "ask" } }
```

This is the runtime's own configuration, delivered through the connection's
`env`. It is not a product setting, and the product did not need one: the
permission request is the runtime's, and the runtime's configuration decides
whether it makes one.

## The protocol

ACP version 1. The adapter sends `initialize`, `session/new` or `session/load`,
and `session/prompt`, and reads `session/update` notifications. The shapes were
read from the installed runtime's own embedded schema rather than from a
document:

```
INITIALIZE {"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":false,"writeTextFile":false},"terminal":false}}
SESSION_NEW  {"sessionId":"ses_e92c372b3ffewUNJF1h0oct9BL","configOptions":[...]}
SESSION_LOAD {"configOptions":[...]}
SESSION_LOAD_KEYS [ 'configOptions' ]
```

The runtime's schema has both response shapes — one with a session id and one
without — and the load response is the one without. The adapter keeps the id it
asked to load when the runtime does not name it; see _What the demonstration
found_.

## The adapter run

Two checks, both run against the installed runtime rather than a fixture.

The handshake alone:

```
npx tsx scripts/verify-runtime.ts --preset opencode-acp --probe-only
```

```
-- the handshake --
  chat: true
  streaming: true
  persistentSessions: true
  backgroundTasks: true
  cancel: true
  approvals: true
  artifacts: false

Command:  opencode acp

The handshake answered. No turn was run (--probe-only).
```

And a turn:

```
npx tsx scripts/verify-runtime.ts --preset opencode-acp --prompt "Reply with exactly: ACP-ROUTE-OK"
```

```
-- the turn --
  asking: Reply with exactly: ACP-ROUTE-OK

ACP-ROUTE-OK

The runtime produced an answer.
```

## The owner's run

### 1. The runtime answers through the product's own adapter

The handshake answered and a turn produced an answer, above. The runtime
answered without a credential.

### 2. The runtime is connected

Created through the panel's form, with the template's command and arguments
filled in by the template itself. The server probed it on save and the panel
showed the runtime's own capabilities, above.

### 3. The room is opened

The room `cnv_6n9y958vobm96o6v`, in routing mode _mentions_, with the OpenCode
connection as its only agent. The presence list read:

```
O
Owner
human
O
OpenCode
acp · connected
```

The panel's turn capability panel was shown on the room.

### 4. A small change is asked for

> @OpenCode what can you do in this room? Answer in one short sentence.

The answer arrived in pieces. The live bubble, sampled every half second:

```
+0.5s  reply 09:22 pm · depth 1 · exe_qnxnrcti2p8t7dhq  No content
+6.2s  I can work with you in this room as an OpenCode ACP session—
+6.7s  I can work with you in this room as an OpenCode ACP session—reading and editing the repo, running commands, and keeping
```

The turn's record ended `complete`, and the execution trace was on screen.

**The activity timeline was not.** The Codex route showed the runtime's tool
calls beside its answer; the ACP route shows none, because the adapter reads
only the `agent_message_chunk` notifications and the ACP route never turned the
runtime's `tool_call` updates into the product's tool events. The runtime's
tool activity is invisible in the room on this route. That is recorded under
_Limits_.

### 5. The owner follows up while the work runs

> @OpenCode run the command node -e "setTimeout(() => {}, 45000)" and then tell me what happened

The runtime asked for permission first, as it was configured to:

> The agent wants to run node -e "setTimeout(() => {}, 45000)": command=node -e "setTimeout(() => {}, 45000)"

The owner approved it, and the command ran. The answer was:

> Done. Ran for ~45s with no output (idle timeout).

Then the owner followed up while the work was still going:

> @OpenCode stop that command and answer me now

**The follow-up was queued, not delivered into the running turn.** The steer
control was on screen and disabled, and the panel said why:

```
the steer control is present while the turn runs: true, enabled: false
the panel says about steering: "steering unavailable"
the queue control is present: true, enabled: true
```

That is the honest difference between the two routes. The Codex App Server
advertises `acceptsSteering`, and its turns take a steer. The ACP route does
not, and the panel says so rather than offering a control that cannot work.

### 6. A permission request is answered

This is the step that matters, and it is the one that was broken twice before
it worked.

> @OpenCode create a file named proof.txt in the working directory, containing the word proof

The runtime asked. The request reached the owner **in the runtime's own words**,
with the operation's own detail:

> # The agent wants to run G:\code\personal-os\data\demo-opencode-2026-10-24\workspace\proof.txt: filepath=G:\code\personal-os\data\demo-opencode-2026-10-24\workspace\proof.txt, diff=Index: G:\code\personal-os\data\demo-opencode-2026-10-24\workspace\proof.txt
>
> --- G:\code\personal-os\data\demo-opencode-2026-10-24\workspace\proof.txt
>
> An agent is stopped and waiting for your decision.
>
> OpenCode
> ·
> OpenCode lead
> persona: connection
>
> Approval
> Approve
> Reject

The owner pressed **Approve**. The turn continued in the same session, the
runtime was answered with the owner's decision, and the operation happened. The
agent said:

> I'll create proof.txt with the word proof.

And the workspace held the file the runtime was asked to create:

```
the workspace now holds: ["proof.txt"]
the file says: "proof"
```

The turn's own record ended `complete`, with no note on it.

### 7. A run is stopped

The owner pressed stop on the run that was in flight. The panel read:

```
the run state after the stop: "stop requested"
```

and the run stayed there. The turn it stopped is still holding its approval
(`apr_acp_ce51c79061ee4c006b4f5569d0451b72`, `pending`), and its execution
(`exe_zfmq53qj033bw1b9`) is `blocked`. A stopped turn is not a finished turn:
the owner can still decide the request that is waiting.

### 8. The browser is closed and reopened, and the worker is restarted

The room was reopened from the client and held its seven turns. The runtime
session panel was there.

Then the worker was taken away **while a turn was in flight** and brought back:

```
the turn is in flight
the turn's execution: exe_p127b5wqubv9n7ws
stop-worker: stopped 35540
the panel while the worker is away: "running"
start-worker: worker pid 6280
```

The panel kept saying `running` while the worker was gone. When the worker came
back, the turn was reconciled, and it was reconciled as **unknown**:

```
the last agent turn's detail: "The runtime could not say what became of this
run, so the outcome is uncertain. It was not run again, and the owner decides
what happens next."
```

The execution row says the same:

```json
{
  "id": "exe_p127b5wqubv9n7ws",
  "status": "unknown",
  "error": "The runtime could not say what became of this run, so the outcome is uncertain. It was not run again, and the owner decides what happens next."
}
```

The turn was not run again. That is the whole point of the reconciliation: a
turn whose outcome cannot be confirmed is a question for the owner, not a
reason to repeat the work.

### 9. A file is attached

`attached.txt` was attached in the composer and the owner asked:

> @OpenCode read the attached file and tell me exactly what it says

The attachment **is** in the message the owner sent:

```json
{"type":"text","text":"@OpenCode read the attached file and tell me exactly what it says"}
{"type":"file","resourceId":"res_nmg2gc2it03t84s6"}
```

And the resource was stored, with its bytes:

```json
{
  "id": "res_nmg2gc2it03t84s6",
  "type": "document",
  "title": "attached.txt",
  "data": "{\"kind\":\"file\",\"filename\":\"attached.txt\",\"mimeType\":\"text/plain\",\"size\":51}"
}
```

**The runtime never received it.** The agent answered:

> I'll read proof.txt.
> proof

It read `proof.txt` — the file it had created in its own working directory
earlier — and never saw the attachment, because the adapter boundary carries
text only. The worker's turn input keeps the text parts of a message and drops
the rest, so no adapter can receive an attachment on this route.

This is the baseline the route really has, and it is the gap SPEC-R1-2 names.

### 10. The persisted history

Every turn in the room ran in **one** session:

```
the session each agent turn ran in: ["ses_e92909d78ffezuUkeNi4kVovbD"]
```

and every execution carried it:

| Execution              | Status    | Session                          |
| ---------------------- | --------- | -------------------------------- |
| `exe_qnxnrcti2p8t7dhq` | committed | `ses_e92909d78ffezuUkeNi4kVovbD` |
| `exe_jz8x7q3ni5xealpt` | committed | `ses_e92909d78ffezuUkeNi4kVovbD` |
| `exe_rupqr9e691r5r1l1` | committed | `ses_e92909d78ffezuUkeNi4kVovbD` |
| `exe_zfmq53qj033bw1b9` | blocked   | `ses_e92909d78ffezuUkeNi4kVovbD` |
| `exe_p127b5wqubv9n7ws` | unknown   | `ses_e92909d78ffezuUkeNi4kVovbD` |
| `exe_g6ay9en6bik34gd1` | committed | `ses_e92909d78ffezuUkeNi4kVovbD` |

The session was created by the first turn and every later turn — including the
turn that was suspended on the owner's decision, the turn that was stopped, and
the turn whose outcome became unknown — continued it.

## What the demonstration found

Two defects, both real, both fixed and landed before the run above was
repeated.

### The load response carries no session id

Every turn after the first failed with:

```
ACP agent did not return a session id when loading the session.
```

The runtime was right and the adapter was wrong: the protocol's load response
does not have to carry a session id, and OpenCode 1.19.4 answers with its
configuration options and nothing else. The session the client asked to load is
the session it has. **PR #35**, `8babc92`.

### The request was published before the row named the session

The decision to continue a turn reads the session from the execution row. The
worker wrote that row **when the turn ended**, but the request was published
**during** the turn, and the owner answers as soon as it is on screen:

| Time         | What happened                                                 |
| ------------ | ------------------------------------------------------------- |
| 09:50:41.463 | the request was recorded, and the panel showed it             |
| 09:50:41.969 | the owner approved it; the decision read the row              |
| 09:50:41.971 | the turn ended, and the worker wrote the session onto the row |

Two milliseconds too late. Both requests in that run died this way, and both
closed with the same sentence: _"The turn was closed rather than continued:
the agent cannot re-enter a session, so the operation was not performed."_ —
which is the opposite of what OpenCode does. **PR #36**, `1a55b08`.

## The limits

**The ACP route carries text and permission requests, and nothing else.**

- **No tool activity.** The runtime's `tool_call` updates are not turned into
  the product's tool events, so the room's activity timeline is empty on this
  route. The Codex route shows the same work.
- **No attachments.** A file the owner attaches is stored, and the message
  carries it, and the runtime never sees it. The boundary keeps the text parts
  of a message and drops the rest.
- **No steering.** The runtime does not advertise it, and the panel says
  `steering unavailable` instead of offering a control that cannot work.
- **The reply repeats the session's earlier text.** Each turn's answer begins
  with the answers of the turns before it, because the runtime replays the
  session's messages when it is prompted. The room shows one long bubble that
  holds the whole session so far. It is the runtime's behaviour, faithfully
  carried, and it is not what a room should show.

**The permission request does not survive the suspension.** The turn that asked
is suspended and the agent is released with it, so the request goes with the
transport. The runtime is asked again in the turn the decision resumes, and the
answer it gets then is the owner's — the answer to the same operation. A
runtime that asks about something else is asked about again.

**The run is on a throwaway.** Everything above was observed on a separate
instance with its own database, and the instance is retired with it.

## The version and the revision

| What              | Value                                     |
| ----------------- | ----------------------------------------- |
| Runtime           | `opencode 1.19.4`                         |
| Surface           | ACP session (`opencode acp`)              |
| Revision          | `ba35992`                                 |
| Room              | `cnv_6n9y958vobm96o6v`                    |
| Connection        | `agt_cdgdeerttg11g795`                    |
| Session           | `ses_e92909d78ffezuUkeNi4kVovbD`          |
| Working directory | `data/demo-opencode-2026-10-24/workspace` |

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

## What a reader can re-run

On a machine with `opencode` on the PATH, the same adapter is driven against
the installed runtime:

```
npx tsx scripts/verify-runtime.ts --preset opencode-acp --probe-only
npx tsx scripts/verify-runtime.ts --preset opencode-acp --prompt "Reply with exactly: ACP-ROUTE-OK"
```

The rest of the run is the panel: add the connection from the _OpenCode (ACP
session)_ template, give it a working directory and the permission
configuration above, open a room, mention the agent, and watch the request
arrive.
