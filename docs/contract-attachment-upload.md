# The attachment upload — contract notes

WI-151 gives the composer a way to attach a file that is not already a
resource. These are the notes the integration owner needs to fold into
`CONTRACTS.md`; `CONTRACTS.md` itself was not touched by this item.

## The claim that changes

The chat surface entry says, in the paragraph that states its limits:

> A file the owner attaches is carried by reference to a resource, not uploaded
> by the composer, and the composer offers the reference rather than a picker.

That sentence is now false in its first half and still true in its second. A
file the owner attaches is **uploaded** by the composer, and it is then carried
by reference to the resource the upload created — the reference is still what
the message carries, and the picker is still what the composer offers for
everything that already exists.

The replacement the owner should publish says both halves:

> A file the owner attaches is uploaded, and the message carries a reference to
> the resource the upload created. The composer also offers the resources that
> already exist, and a message may carry both.

## The routes

Both routes live in `apps/server/src/api/resources.ts` and are guarded with
`requireAuth`.

| Route                        | Method | What it does                                                                              |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/api/resources/upload`      | POST   | Stores the bytes of a file and answers with the resource that points at them.             |
| `/api/resources/:id/content` | GET    | The bytes of a resource that is a file, with the content type the file was uploaded with. |

### `POST /api/resources/upload`

The body is JSON, and the bytes travel as base64:

```ts
{
  workspaceId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
}
```

Base64 in a JSON body is deliberate: the server needs no multipart parser and
the product needs no new dependency for one. The answer is `201` with the
resource, in the same envelope every other resource write answers with:

```ts
{
  resource: Resource;
}
```

The route writes an audit entry, `resource.file.uploaded`, at the route level,
against the resource it created.

### `GET /api/resources/:id/content`

The bytes, with the content type the file was uploaded with. It answers for a
resource whose `data.kind` is `file` and for nothing else: a resource that is
not a file, a resource that has no stored bytes, and a resource that does not
exist all answer `not_found` in the shared error envelope.

## The resource shape

An uploaded file is a **`document`** resource. The resource type vocabulary is
unchanged — there is no `file` type — and the file is told apart from a text
document by the `kind` its data carries:

```ts
{
  kind: 'file';
  filename: string;
  mimeType: string;
  size: number;
}
```

The file's name in the workspace is the resource's **title**. The resource's
data carries the metadata and nothing else: **the path of the bytes on the
server is never in it**, so the browser cannot learn the server's filesystem.

The document provider judges this shape by its own contract and everything else
by the document's, so a text document is exactly what it always was. The
provider lives in `apps/server/src/modules/resources/service.ts`, and the shape
it judges is `fileDocumentSpecSchema` in the same file.

**One thing the owner may want to publish.** The shape above is not in
`packages/contracts/src/resource.ts` yet: the contracts package still publishes
`documentSpecSchema` — `{ format, content, tags }` — and the file shape is
judged by the server's own copy of it. The owner may want to publish
`fileDocumentSpecSchema` in the contracts package so the web client and the
server describe the same thing from one place. The web client reads the shape
from the resource's data, so it does not break either way.

## Where the bytes live

The `resource_files` table, which the schema already declares and nothing read
until now. One row per stored file:

| Column        | What it holds                                                |
| ------------- | ------------------------------------------------------------ |
| `resource_id` | The resource the file belongs to. Cascades on delete.        |
| `path`        | Where the bytes are, on the server. Never leaves the server. |
| `mime_type`   | The content type the file was uploaded with.                 |
| `size`        | The size of the file, in bytes.                              |

The bytes are written under the data directory, at
`<dataDir>/files/<resourceId>` — the name is the resource's id, so nothing the
owner sent reaches the path. The resource row and the `resource_files` row are
written in **one transaction**, so a resource never points at bytes that were
not stored.

## The cap

A file is at most **10 MB**. The base64 body of a file that size is about
14 MB, and the route reads no more than that.

A file over the cap is refused with the shared error envelope and a sentence
the owner can act on:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "That file is larger than the 10 MB this panel accepts."
  }
}
```

The refusal happens before the body is read when the request says how big it
is, and again after the bytes are decoded. Both answers are the same one.

## Migration

**A client that attaches by reference keeps working.** Nothing about
`POST /api/resources` changed, and the message a client sends is unchanged: a
`file` content part with a resource id, which is what it always was. A client
that picks a resource that already exists and attaches it by reference is
untouched by this change.

The `document` payload gained a second shape. A document written before this
change still parses, still validates and still stores the same bytes in the
same column: the provider sends a text document through the document contract
exactly as it always did.

## The limits that remain

- **The bytes live in the data directory of one deployment.** Two deployments
  do not share them. A file uploaded on one is not on the other, and a
  database restored on another machine has resources whose bytes are not there.
- **Nothing removes the bytes.** `resource_files` cascades on delete, so the
  **row** goes when the resource goes — but the **file on disk stays**. There
  is no route that deletes a resource today, so no delete path was built here;
  when one is built, it has to remove the file as well, or the data directory
  grows without bound.
- **A file document can exist without bytes.** `POST /api/resources` and the
  MCP `resource.create` tool accept the file shape, and a file document made
  that way has no stored bytes; the content route answers `not_found` for it.
  Only the upload route stores a file.
- **An agent cannot upload.** The upload is on the owner-facing API only; the
  MCP tool surface is unchanged.
- **The bytes are served as they were uploaded.** There is no scanning, no
  rewriting and no preview: the browser opens what the owner sent.

## The count the measures route publishes

The measures entry publishes the number of mutating routes and how many of
them write an audit entry at the route level. This item adds one mutating
route, and it writes its audit entry at the route level, so the owner should
publish:

- `Of the 40 mutating routes in apps/server/src/api/` → **41**
- `37 write an audit entry at the route level` → **38**

Until that is published,
`apps/server/src/__tests__/published-shapes.test.ts` fails on the count — the
test that holds the contract's claims about the code true, reading a number
this item is not allowed to change.
