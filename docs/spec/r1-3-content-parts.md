# SPEC-R1-3 — A message's parts reach the runtime

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:**
independent reviewer
**Depends on:** SPEC-R1-1, SPEC-R1-2 (the demonstrations named the gap) · **Blocks:**
nothing yet
**Evidence:** [the demonstration](../demonstration-content-parts-2026-10-24.md),
[the gate](../../scripts/verify-content-parts.ts)

## Outcome

A file the owner attaches in a room reaches the runtime, **as that runtime's own
protocol takes it**, on every route that says it can carry one. A route that
cannot says so, and the panel refuses the attachment there rather than
accepting it and dropping it.

## Why this is a spec and not a patch

The gap is not in one adapter. It is in the **boundary**:

- `AgentTurnInput` carries `message: string` and `context: string` — text.
- The worker builds that text from the parent message's parts, keeping only the
  text parts (`apps/worker/src/executor.ts`, `parentText`).
- So no adapter can receive an attachment, on any route, because the boundary
  has no room for one.

The demonstration measured it on both routes that run a real runtime:
`docs/demonstration-codex-2026-10-24.md` records the agent saying _"I don't
see an attached file."_, and `docs/demonstration-opencode-2026-10-24.md`
records the agent reading a different file — the one in its own working
directory — and never seeing the attachment. The file is in the owner's
message, and the file is in the resource store. It does not cross.

**The fix belongs in the shared boundary, not in one adapter.** That is why
this is a contract change and not a patch to the ACP adapter.

## The shape today

A message carries content parts (`packages/contracts/src/conversation.ts`):

| Part         | What it is                                        |
| ------------ | ------------------------------------------------- |
| `text`       | the words                                         |
| `artifact`   | a reference to a resource the agent produced      |
| `file`       | a reference to a resource the owner attached      |
| `attachment` | a reference to a resource, with a name and a type |
| `image`      | a reference to an image resource                  |

The turn boundary carries none of that. The worker joins the text parts and
sends a string.

## Contract

### The turn carries what the text does not

`AgentTurnInput` gains one optional member:

```ts
  /**
   * The message's parts that its text does not carry, for a runtime that can
   * take more than text.
   *
   * The content is in the part, not a reference to it: an adapter is given a
   * resource id it cannot follow. A part the runtime cannot take is left out,
   * and what is left is what the turn carries. The parts are present only on a
   * turn whose connection reports `acceptsAttachments`; a connection that does
   * not report it is sent the text and nothing else.
   */
  parts?: AgentTurnPart[];
```

with the part itself:

```ts
export const agentTurnPartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    /** The resource the file is, in the product's own name for it. */
    resourceId: z.string(),
    /** The name the owner gave it. */
    filename: z.string(),
    mimeType: z.string(),
    /** The file's content, as text. */
    text: z.string(),
  }),
]);
```

**The part carries the content, not a resource id.** The adapter boundary is
the product's own boundary and it is not allowed to reach into the resource
store; a runtime that is handed `res_1234` has no way to follow it. The worker
resolves the resource when it builds the turn, and the content is in the turn.

**The resource id is in the part anyway.** The content is what the runtime
reads, and the id is what the product names the thing by — so an agent that
wants to talk about the file, or the product that wants to link it, has a name
for it that is not a path on somebody's disk.

**There is no text part, and that is the point.** The message's text crossed in
the turn's message before this existed. A part carrying it again would have the
runtime read the owner's question twice — and a turn that resumes an approval
carries the _decision_ in `message`, not the message the file belongs to, so a
text part could not be the message's words in that case either. The union has
one kind today; a second kind joins it without breaking anything.

**The content is text.** A file whose bytes are not text is not carried, and
the panel says so. Carrying bytes means a protocol that takes bytes inline,
and each route's shape for that is its own business — not this slice's.

### The route says whether it can carry them

`agentCapabilitiesSchema` gains one optional member, on the same terms as
`acceptsSteering`:

```ts
  /**
   * The runtime takes the message's parts, and not only its text.
   *
   * Absent means absent: a runtime that says nothing is a runtime that takes
   * text.
   */
  acceptsAttachments?: boolean;
```

The ACP row and the Codex App Server row carry `acceptsAttachments: true`.
The echo, CLI, HTTP, A2A, model and MCP rows say nothing, and their routes
carry text only.

### Each adapter maps a part into its own protocol

**ACP.** The protocol's prompt is a list of content blocks, and the runtime's
own code says exactly what it does with each:

| Block                                               | What the runtime makes of it     |
| --------------------------------------------------- | -------------------------------- |
| `{type:'text', text}`                               | the prompt's text                |
| `{type:'resource', resource:{uri, mimeType, text}}` | a text part: `[<uri>] \| <text>` |
| `{type:'image', data, mimeType}`                    | an image part, base64            |

So the ACP adapter sends the file as a `resource` block whose `uri` names the
file, whose `mimeType` is the file's, and whose `text` is the content. The
runtime turns it into a text part the model reads, which is what "the agent
sees the file" means on this route.

The uri is a name and not a path: `personal-os://attachment/notes.txt`. A path
would be a path on the runtime's machine, and this file is not on it.

**The owner's words are in one text block, with the room's context.** The
adapter does not add them again from the parts, because the turn's message is
already the words. A runtime that read the question twice would answer as if it
had been asked twice — and the ACP route replays the session's earlier text on
each prompt, so a prompt that repeats itself is not a small thing here.

**Codex App Server.** The pinned protocol (`turn/start`, `UserInput`) takes
`{type:'text'}`, `{type:'image', url|fileId}`, `{type:'localImage', path}`,
`{type:'audio', url}`, `{type:'localAudio', path}`, `{type:'skill', path}` and
`{type:'mention', path}`. There is no "a file with its content" item, so the
App Server route sends the file's content as a text item that names the file.
That is the honest mapping: the route says it carries the content, and the
content is what the runtime receives.

### The panel refuses what cannot be carried

The composer knows the room's agent participants and their capabilities. When
**no** agent in the room can carry an attachment, the composer refuses the
file and says which agent cannot take it. When some can and some cannot, the
attachment is allowed and the turn that cannot carry it says so in its
context, so an agent is never left answering as if it had read a file it never
saw.

## Gate

A shipped check that drives the built adapter against an agent that speaks the
protocol and records the prompt it received:

```
npm run verify:content-parts
```

It proves five things and fails when any of them is untrue:

1. The build the gate exercises is the build of this tree.
2. The prompt the runtime received carries the file's content, as the
   protocol's own `resource` block.
3. The App Server route carries the file as a text item that names it.
4. The capability rows say the truth about attachments.
5. The route that says it cannot carry attachments does not carry them.

The gate **says which check failed**. A gate that prints "ok" beside a check
it failed is worse than a gate that prints nothing, so the line is printed only
when the check added no failure, and a build that is missing a part of the
product is reported as a failure rather than thrown as a crash.

## Acceptance

1. The owner attaches a file in a room whose agent can carry attachments, and
   the agent reads the file's content and answers from it. — **met**, against
   the installed OpenCode 1.19.4; see the demonstration below.
2. The composer refuses the file in a room whose agents cannot carry
   attachments, and the refusal names the reason. — **met**, in the same run.
3. A route with no `acceptsAttachments` receives the text and nothing else. —
   **met**, by the gate and by the worker's own test.
4. `npm run verify:content-parts` passes, the contracts' tests pass, and the
   browser suite passes. — **met**.

## Not in scope

- **Images and binary files.** The part carries text. Carrying bytes is each
  protocol's own shape, and the App Server's own shape — a path — would hand
  the runtime a path inside the product's data directory.
- **Writing the attachment into the runtime's working directory.** The content
  is carried in the prompt. A route that wants the file on disk is a different
  design, and the CLI route's cwd already is that design.
- **The CLI route carrying attachments.** A CLI agent could read a file that is
  in its working directory, and that claim has to be demonstrated before the
  row says so. Absent means absent.
- **A room where one agent can and another cannot.** The composer allows the
  attachment and the agent that cannot carry it says so in its context.

## Evidence

### What landed

| File                                                      | Change                                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/agent.ts`                         | `AgentTurnPart` and `AgentTurnInput.parts`; `acceptsAttachments` on the capability row.                                                                                    |
| `apps/server/src/modules/capabilities/capability-view.ts` | `turnAcceptsAttachments`, on the same terms as steering.                                                                                                                   |
| `apps/worker/src/content-parts.ts`                        | The resolver: a resource becomes the file's content, and the files that cannot be carried are named. The message's text is not resolved again — it is already in the turn. |
| `apps/worker/src/executor.ts`                             | The turn carries the parts, and the context names a file the route could not carry.                                                                                        |
| `packages/agent-adapters/src/acp.ts`                      | `acpPrompt`: the protocol's `resource` block. The route says it can carry attachments.                                                                                     |
| `packages/agent-adapters/src/codex-app-server.ts`         | `buildTurnInput`: the content as a text item that names the file.                                                                                                          |
| `packages/contracts/src/adapter-presets.ts`               | The ACP and App Server rows carry `acceptsAttachments: true`.                                                                                                              |
| `apps/web/src/components/Composer.tsx`                    | The composer refuses a file the room cannot carry, and says why.                                                                                                           |
| `apps/web/src/pages/ConversationDetail.tsx`               | The room's own answer: which of its agents can carry an attachment.                                                                                                        |
| `apps/web/src/components/chat/TurnCapabilityPanel.tsx`    | The panel says it: _takes attachments: yes_.                                                                                                                               |
| `scripts/verify-content-parts.ts`                         | The gate, in the fast lane.                                                                                                                                                |
| `docs/demonstration-content-parts-2026-10-24.md`          | The transcript: the file reaches the installed runtime, and the panel refuses it where it cannot.                                                                          |

### The commands that were run, and what they said

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

The package suites, on the slice's tree:

```
agent-adapters   82 passed
contracts        48 passed
worker          123 passed
web             215 passed
```

### The tests that fail without the implementation

This was **measured, not assumed**. The implementation was reverted — the
tracked files checked out at their state before this slice, the new worker
module moved out of the way, the packages rebuilt — and each check was run
against the tree without it.

| Check                                                             | What it said without the implementation                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-adapters/src/__tests__/acp-content-parts.test.ts` | **5 tests failed**: `TypeError: acpPrompt is not a function` (×3), `expected undefined to be defined` (the runtime received no resource block), `expected undefined to be true` (the route does not say it can carry a file)                                                                   |
| `apps/worker/src/__tests__/content-parts.test.ts`                 | **5 tests failed**: `expected undefined to deeply equal [ { type: 'file', …(4) } ]` — the turn carries no parts; `expected 'The agent: What does the attached fil…' to contain 'notes.txt'` — the context does not name the file the route could not carry; `expected undefined to be defined` |
| `apps/web/src/components/__tests__/ComposerAttachments.test.tsx`  | **1 test failed**: `expect(element).toBeDisabled()` — _Received element is not disabled_ — the upload control is offered for a room that cannot carry a file                                                                                                                                   |
| `scripts/verify-content-parts.ts`                                 | failed, with every reason named (below)                                                                                                                                                                                                                                                        |

The gate's own report without the implementation:

```
The gate for a message's parts reaching the runtime.
  ok   the build the gate exercises is the build of this tree
  ok   a route that says nothing is a route that takes text

The gate failed:
  - the built adapter does not export buildTurnInput, so the route cannot carry a file.
  - the ACP route did not send the file as the protocol's resource block.
  - the built adapter does not carry a file for the App Server route.
  - the ACP route does not say that it can carry an attachment, and it can.
  - the acp-session template does not say that its route can carry an attachment.
  - the opencode-acp template does not say that its route can carry an attachment.
  - the hermes-acp template does not say that its route can carry an attachment.
  - the codex-app-server template does not say that its route can carry an attachment.
```

**The gate was made better by this.** The first run of the experiment crashed
with a `TypeError` instead of reporting, and it printed an "ok" line beside a
check that had failed. Both were fixed, and the run above is the fixed one.

### The demonstration

The gate proves the product's half of it. The runtime's half — that OpenCode
turns the resource block into a part the model reads — was measured against
the installed runtime.

`docs/demonstration-content-parts-2026-10-24.md` is the transcript. The owner
attached a file in the web chat and asked the agent what it said. The agent
answered:

> The attached file says: MARKER-9F3C2A7B is the passphrase of the file.

The marker was in the attached file and nowhere else. **The file crossed the
boundary and the runtime read it.**

The same run showed the refusal: in a room whose agent reports no
`acceptsAttachments`, the composer's upload control was disabled and the
reason was on screen — _"Echo cannot take an attachment on this route."_ — and
the capability panel in the first room read _"takes attachments: yes"_.

This is the contrast with the two earlier demonstrations, which measured the
same gap and could not deliver it:

| Document                                         | What the agent answered                                          |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `docs/demonstration-codex-2026-10-24.md`         | _"I don't see an attached file."_                                |
| `docs/demonstration-opencode-2026-10-24.md`      | _"I'll read proof.txt."_ — the file in its own working directory |
| `docs/demonstration-content-parts-2026-10-24.md` | the file's exact content, from the file the owner attached       |

### What is not covered

- **Images and binary files.** The part carries text.
- **A room with one agent that can and one that cannot.** The composer allows
  the attachment and the agent that cannot carry it says so in its context.
- **The file on the runtime's disk.** The content is carried in the prompt; it
  is not written into the runtime's working directory.
- **The Codex App Server route against a real runtime.** The gate drives that
  route's built adapter and checks the prompt it builds; the runtime's half of
  that route was not demonstrated.
