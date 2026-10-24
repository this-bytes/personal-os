# The attachment demonstration, 2026-10-24

**The runtime:** `opencode 1.19.4`, started as `opencode acp` — the Agent Client
Protocol session server. No credential: the free model OpenCode reaches without
one answered every turn in this transcript. **The surface:** the ACP session
route. **The revision:** `e40cddb`, the head of `wi/165-content-parts`, which is
the commit the demonstration was run against. **The date:** 2026-10-24.

This is the transcript SPEC-R1-3 asks for. It names the commands that were run,
the output that was produced, and the limits that remain. Everything quoted
below was observed; nothing here is a description of what ought to happen.

It settles one thing, and it is the thing both earlier demonstrations measured
and could not deliver: **a file the owner attaches now reaches the runtime.**

## Where the run happened

On a **separate instance**, not the owner's own. Its own port (4394, for both the
API and the built client it serves), its own database
(`data/demo-content-parts-2026-10-24/instance/`), its own secret key, its own
owner account. The owner's instance on 4317 and the owner's account were not
touched: the demonstration ran on a throwaway so that nothing it wrote — a file,
a conversation, a session inside OpenCode's own storage — landed in the owner's
workspace.

The run was driven through the real web client in a real browser (Chromium
through Playwright), against the real product: the same composer, the same
panel, the same routes the panel calls. The owner of the throwaway instance was
driven by the implementing agent — the owner in this transcript is that account,
and the credentials were generated for it and exist nowhere else. The
screenshots that were taken during the run are not committed — this repository
holds no images — so everything they showed is written out here instead.

## The connection

Created through the panel's own form: **Agents → Add connection**, the adapter
type set to _ACP session agent_, the template set to _OpenCode (ACP session)_,
the name, the working directory and the environment filled in, and **Create
connection** pressed.

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
  "artifacts": false,
  "acceptsAttachments": true
}
```

`acceptsAttachments: true` is the new row, and it is the **ACP route's own
claim about itself** — the adapter reports it because the protocol's prompt is a
list of content blocks and a file is one of them. It is not a product setting
and it is not the template's.

The connection is `agt_23a5niwbmt5r9aiv`, and the presence list in the room
read `OpenCode · acp · connected`.

### Why the runtime was configured to ask

This machine's OpenCode allows every operation by default. The earlier
demonstration measured that in the runtime's own log:

```
message=evaluated permission=edit pattern="...\\proof.txt" action.permission=* action.action=allow action.pattern=*
```

`action.action=allow` with a wildcard pattern: the runtime never asks. This
run used the same configuration as the earlier one, so that the runtime would
have asked had it wanted to:

```json
{ "permission": { "read": "allow", "edit": "ask", "bash": "ask" } }
```

Nothing in this run needed a permission request — the owner only asked a
question — so the configuration did not come into play. It is carried over so
that the run is comparable with the one before it.

## The protocol

ACP version 1. The adapter sends `initialize`, `session/new` or `session/load`,
and `session/prompt`, and reads `session/update` notifications.

The prompt is where this slice's change lives. The protocol's prompt is a list
of content blocks, and the ACP route now sends **two kinds** of block:

| Block                                               | What the runtime makes of it     |
| --------------------------------------------------- | -------------------------------- |
| `{type:'text', text}`                               | the prompt's text                |
| `{type:'resource', resource:{uri, mimeType, text}}` | a text part: `[<uri>] \| <text>` |

The uri is a name and not a path: `personal-os://attachment/attached.txt`. A
path would be a path on the runtime's machine, and this file is not on it.

## The owner's run

### 1. The room is opened

A room was opened through the product's own API with OpenCode as its only
agent: `cnv_aqdo5mplen0ux9nt`.

The composer in that room **offered the file**:

```
STEP 3 the composer offers the file: enabled=true
```

### 2. A file is attached

`attached.txt` was attached in the composer. The upload went through the
product's own route and was stored with its bytes:

```json
{
  "id": "res_kvhrdjkcp5x0ekfa",
  "type": "document",
  "revision": 1,
  "title": "attached.txt",
  "data": {
    "kind": "file",
    "filename": "attached.txt",
    "mimeType": "text/plain",
    "size": 71
  }
}
```

The composer showed the attachment as a chip on the message being written —
`attached.txt`, _"Uploaded attached.txt."_ — with the paperclip and the upload
button still available.

The file's content was a sentence with a marker in it. The marker appears in
nowhere else — not in the room, not in the working directory, not in the
runtime's own storage:

```
The attached file says: MARKER-9F3C2A7B is the passphrase of the file.
```

### 3. The owner asks about it

> @OpenCode what does the attached file say? Reply with the file's exact content and nothing else.

The message the owner sent carried the attachment:

```json
[
  {
    "type": "text",
    "text": "@OpenCode what does the attached file say? Reply with the file's exact content and nothing else."
  },
  { "type": "file", "resourceId": "res_kvhrdjkcp5x0ekfa" }
]
```

### 4. The agent answers from the file

**The runtime received the file, and the agent answered from it:**

```json
[
  {
    "type": "text",
    "text": "The attached file says: MARKER-9F3C2A7B is the passphrase of the file."
  }
]
```

The answer carries the marker, and the marker was in the attached file and
nowhere else. **The file crossed the adapter boundary and the runtime read
it.** The agent did not need permission to read the file, did not need it
written to its working directory, and did not read a different file.

The execution's own trace says what happened, in the order it happened:

```
11:20:36 pm · 0ms    turn.admitted
11:20:37 pm · 0ms    turn · running
11:20:49 pm · 532ms · ×2    message.delivered
11:20:50 pm · 0ms    turn.committed
```

The execution is `exe_u61hk7fbuk99knce`, and it records `spend 1 units ·
duration 13.5s`.

### 5. The panel says the route takes attachments

The room's **Turn capabilities** panel — which shows the capability set the
turn was _admitted_ with, not the connection's current one — reads:

```
chat                 yes
streams its answer   yes
keeps its session    yes
runs background tasks yes
can be cancelled     yes
asks for approvals   yes
produces artifacts   no
takes attachments    yes
takes input mid-turn no
```

`takes attachments: yes` is the same claim the adapter made, shown to the
owner in the room where it matters.

## What the earlier demonstrations measured

This is the contrast, and it is the reason this slice exists.

`docs/demonstration-opencode-2026-10-24.md` §9 attached a file to the same
runtime on the same route and recorded:

> **The runtime never received it.** The agent answered:
>
> > I'll read proof.txt.
> > proof

It read `proof.txt` — the file it had created in its own working directory
earlier — and never saw the attachment, because the adapter boundary carried
text only.

`docs/demonstration-codex-2026-10-24.md` recorded the same gap on the other
route: the agent said _"I don't see an attached file."_

The file was in the owner's message, and the file was in the resource store. It
did not cross. **This run is the same question asked again after the change,
and the answer is the opposite.**

## The refusal

A room whose agent cannot carry a file says so, and the panel refuses the file
there rather than accepting it and dropping it.

A second connection was created — the built-in `echo` route — and it reported
no `acceptsAttachments` at all, which is what "absent means absent" looks
like:

```json
{
  "chat": true,
  "streaming": true,
  "persistentSessions": false,
  "backgroundTasks": false,
  "cancel": true,
  "approvals": false,
  "artifacts": false,
  "acceptsSteering": true
}
```

In a room with that agent, the composer's upload control was disabled and the
reason was on screen, not only in a tooltip:

```
STEP 6 the composer refuses the file: disabled=true
STEP 6 the composer says: ["A room that cannot carry a file", "Echo cannot take an attachment on this route."]
```

## The limits

What this run does **not** show, stated plainly:

- **Images and binary files.** The part carries the file's content as text, so
  a file whose bytes are not text is not carried. The ACP protocol has an
  `image` block that takes bytes; the mapping for it is its own work, and this
  route does not claim it.
- **The file on the runtime's disk.** The content is carried in the prompt. It
  is not written into the runtime's working directory, and the runtime was not
  asked to write it.
- **A room with one agent that can and one that cannot.** The composer allows
  the attachment, and the agent that cannot carry it says so in its context.
- **The Codex App Server route against a real runtime.** The gate drives that
  route's built adapter and checks the prompt it builds; the runtime's half of
  that route was not demonstrated here.
- **The ACP route's other limits stand.** It still carries no tool activity and
  no steering.

## The version and the revision

| What               | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| Runtime            | `opencode 1.19.4`                                         |
| Route              | ACP session (`acp`)                                       |
| Revision           | `e40cddb`                                                 |
| Instance           | port 4394, `data/demo-content-parts-2026-10-24/instance/` |
| Connection         | `agt_23a5niwbmt5r9aiv`                                    |
| Room               | `cnv_aqdo5mplen0ux9nt`                                    |
| Resource           | `res_kvhrdjkcp5x0ekfa`                                    |
| Owner's message    | `msg_ddd4am5kcqbu4msc`                                    |
| The agent's answer | `msg_qiaivioyab8ppmiq`                                    |
| Execution          | `exe_u61hk7fbuk99knce`                                    |

## The acceptance commands

```
npm run verify:content-parts
```

```
The gate for a message's parts reaching the runtime.
  ok   the build the gate exercises is the build of this tree
  ok   the file reached the runtime as the protocol's own resource block
  ok   the App Server route carried the file as a text item that names it
  ok   the capability rows say the truth about attachments
  ok   a route that says nothing is a route that takes text

The route carries the file, in each protocol's own shape.
```

## What a reader can re-run

- `npm run verify:content-parts` — the gate, on any machine, with no runtime
  and no account.
- `npm test -w @personal-os/agent-adapters -- acp-content-parts` — the ACP
  route's own tests, against the protocol's double.
- `npm test -w @personal-os/worker -- content-parts` — the worker's resolution
  of the message's parts into a turn.
- `npm test -w @personal-os/web -- ComposerAttachments` — the composer refusing
  a file the room cannot carry.

The run itself needs the installed OpenCode and a browser. The driver scripts,
the screenshots and the logs are kept outside this repository, under
`data/demo-content-parts-2026-10-24/`, and the throwaway instance they wrote
to was retired when the run ended.
