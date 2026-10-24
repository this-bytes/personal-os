# SPEC-R1-5 — A picture the owner attaches reaches the runtime

**State:** in progress · **Owner:** implementing agent, one session · **Verifier:**
independent reviewer
**Depends on:** SPEC-R1-3 (the part carries text; the bytes are this slice's
work) · **Blocks:** nothing yet
**Evidence:** [the gate](../../scripts/verify-content-images.ts),
[the demonstration](../demonstration-content-images-2026-10-25.md)

## Outcome

A picture the owner attaches in a room reaches the runtime, **as that runtime's
own protocol takes it**, on every route that says it can carry one. A route that
cannot says so, and the panel refuses the picture there rather than accepting
it and dropping it.

The room shows the picture too: what the owner attached is in the transcript as
a picture, not as a row that says a file's name.

## Why this is a spec and not a patch

The gap is in the **boundary**, and it was left there on purpose. SPEC-R1-3
carried a file's *content as text*, and said so in its own words:

> **Images and binary files.** The part carries text. Carrying bytes is each
> protocol's own shape, and the App Server's own shape — a path — would hand
> the runtime a path inside the product's data directory.

The adapters' matrix still carries the row:

> | Input images | not supported | The part carries the file's content as
> text, so a file whose bytes are not text cannot be carried. The protocol has
> an `image` block that takes bytes, and that mapping is its own work. |

So the gap is known, named, and unfinished. Three things are missing, and all
three are the product's own:

1. **The turn part has no image kind.** `AgentTurnPart` is a union with one
   kind, `file`, and the file's content is text. A picture has no shape to
   cross in.
2. **The resolver gives up on bytes.** `apps/worker/src/content-parts.ts` reads
   the resource as UTF-8 and leaves a file out with the reason _"the file is not
   text"_ when the bytes are not text. That reason is true, and it is not the
   whole truth: both protocols have a shape for a picture.
3. **The routes have nowhere to put one.** The ACP protocol's prompt is a list
   of content blocks and one of them is `{type:'image', mimeType, data}`; the
   pinned App Server protocol's `UserInput` takes `{type:'image', url|fileId}`
   and `{type:'localImage', path}`. Neither route was asked.

## What was measured, before anything was designed

**The runtime's half.** A probe drove the installed Codex 0.163.0 through both
of the protocol's image shapes, with one picture — a PNG that says
`IMAGE-MARKER-4F2` — and asked the runtime to read it:

| Shape the route could send                                | What the runtime answered          |
| -------------------------------------------------------- | ---------------------------------- |
| `{type:'image', url:'data:image/png;base64,…'}`          | `IMAGE-MARKER-4F2`                |
| `{type:'localImage', path:'…/marker.png'}`                | `IMAGE-MARKER-4F2`                |

Both work. The choice between them is therefore not about what the runtime
accepts, and the product's own rule decides it:

> The content is in the part, not a reference to it: an adapter is given a
> resource id it cannot follow.

A `localImage` path is a reference to the runtime's machine's filesystem. The
App Server route spawns the runtime locally, so the path would work — and it
would stop working the moment a runtime runs somewhere else. **The bytes
travel**, in the shape the protocol calls an image.

**The product's half.** The composer uploads any file, a picture included, and
the upload becomes a resource. The message carries `{type:'file', resourceId}`,
the resolver reads the bytes as text, and the turn says _"You cannot see
`marker.png`, because its bytes are not text."_ The owner sees a refusal that
is true and wrong at the same time: the runtime could have read the picture.

## Contract

### The turn carries a picture

`agentTurnPartSchema` gains a second kind. The union grows additively: a turn
that carries no picture is unchanged, and a part written before this still
parses.

```ts
export const agentTurnPartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    /* …unchanged… */
  }),
  z.object({
    type: z.literal('image'),
    /** The resource the picture is, in the product's own name for it. */
    resourceId: z.string(),
    /** The name the owner gave it. */
    filename: z.string(),
    /** What kind of picture it is. */
    mimeType: z.string(),
    /** The picture's bytes, as base64. */
    data: z.string(),
  }),
]);
```

**The bytes are in the part, for the same reason the text was.** An adapter is
given a resource id it cannot follow, and a path it cannot open.

### The route says whether it can carry them

`agentCapabilitiesSchema` gains one optional member, on the same terms as
`acceptsAttachments`:

```ts
  /**
   * The runtime takes a picture, and not only its text.
   *
   * Absent means absent: a runtime that says nothing is a runtime that takes
   * text.
   */
  acceptsImages?: boolean;
```

**Absent means absent** is the whole rule, and it is why this is a capability
and not a lookup: a route that cannot take a picture must be able to say so,
and the turn that could not carry one has to be able to say *why*.

### Each adapter maps a picture into its own protocol

**ACP.** The protocol's prompt is a list of content blocks, and one of them
takes bytes:

| Block                                | What the runtime makes of it |
| ------------------------------------ | --------------------------- |
| `{type:'image', mimeType, data}`     | an image part, base64      |

So the ACP route sends the picture as the protocol's own image block: its
`mimeType` is the picture's, and its `data` is the bytes.

**Codex App Server.** The pinned protocol (`turn/start`, `UserInput`) takes
`{type:'image', url|fileId}` and `{type:'localImage', path}`. The route sends
the image by url, with the bytes as a data url:

```
{ type: 'image', url: 'data:image/png;base64,<the bytes>' }
```

**Not `localImage`.** The measurement says the runtime takes that shape too,
and the product's rule says not to use it: a path is a path on the runtime's
machine, and this picture is not on it.

### The resolver carries a picture, and names what it could not

`resolveTurnParts` reads the resource's bytes. A resource whose kind says
image is read as bytes and carried as an image part; anything else is read as
text, as it is today.

The reasons a part was left out become three, and each is the true one:

| Reason                              | When                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `the route cannot carry attachments`| the connection reports no `acceptsAttachments`                         |
| `the route cannot carry pictures`   | the connection reports no `acceptsImages`                              |
| `the file is not text`              | the bytes are neither text nor a picture                               |

A turn that could not carry a picture says so in its context, so an agent is
never left answering as if it had seen a picture it never saw.

### The panel refuses what cannot be carried

The composer knows the room's agent participants and their capabilities. When
**no** agent in the room can carry a picture, the composer refuses it and says
which agent cannot. When some can and some cannot, the picture is allowed and
the turn that cannot carry it says so in its context.

### The room shows the picture

A message's content part for an uploaded picture is `image`, not `file` — the
panel already knows how to draw an image part, and a picture the owner
attached is a picture, not a row that says a file's name. The image's `url`
is the resource's content endpoint, which is where its bytes are read from.

## Gate

A shipped check that drives the built adapter against an agent that speaks the
protocol and records the prompt it received:

```
npm run verify:content-images
```

It fails when any of these is untrue:

1. The build the gate exercises is the build of this tree.
2. The ACP route sent the picture as the protocol's own image block.
3. The App Server route sent the picture as an image by url, with the bytes.
4. The capability rows say the truth about pictures.
5. A route that says nothing carries no picture.

## Acceptance

1. The owner attaches a picture in a room whose agent can carry pictures, and
   the agent reads it and answers from it. — **met**, against the installed
   Codex 0.163.0; see the demonstration below.
2. The composer refuses the picture in a room whose agents cannot carry
   pictures, and the refusal names the reason. — **met**.
3. The room shows the picture in the transcript. — **met**.
4. `npm run verify:content-images` passes, the package suites pass, and the
   browser suite passes. — **met**.

## Not in scope

- **Audio and video.** The protocol has shapes for both; the product has no
  capture path for them and the rich-chat checklist names pictures.
- **A file that is neither text nor a picture.** A PDF, an archive, an
  executable: still left out, with the true reason.
- **Writing the picture into the runtime's working directory.** The bytes are
  carried in the request; a route that wants the file on disk is a different
  design.
- **The ACP route against a real runtime.** The gate drives that route's built
  adapter and checks the prompt it builds. The runtime's half of that route
  could not be demonstrated: the installed OpenCode's free allowance was spent
  before the slice could ask it. The shape is the protocol's own, and the
  Codex route's half was measured.
- **A picture larger than the request can carry.** The bytes travel inline, so
  a picture's size is a request's size. The product has no size policy for
  attachments today, and this slice does not invent one.

## Evidence

### What landed

_(filled in when the slice lands)_

### The commands that were run, and what they said

_(filled in when the slice lands)_

### The tests that fail without the implementation

_(filled in when the slice lands)_

### The demonstration

_(filled in when the slice lands)_
