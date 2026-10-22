# 11. Features slot into the runtime through a seam

**Status:** accepted

## Context

The panel is built one surface at a time, and every surface was wired into the
files the runtime is made of. `apps/server/src/app.ts` called sixteen
`registerXRoutes(app)` functions, `apps/web/src/App.tsx` held seven lazy route
loaders and the route table, and `AppShell.tsx` held the navigation as an
array in the file.

That arrangement has a cost, and the cost is paid by the product rather than by
the code. A new surface needs a route, a navigation entry and usually a read
model of its own — so it needs three edits to shared files, and two people
cannot build two surfaces at once without colliding on all three. The panel
ends up with a long shelf of half-built surfaces instead of a growing set of
finished ones.

The owner asked for the opposite: features worked on in parallel, tested, then
applied to the running instance, with new work slotting in without touching
what is already there.

Two things were also already decided and were not to be re-litigated. There is
**no plugin marketplace** (PRODUCT.md §12, `docs/recovery.md`): the product is
self-hosted and first-party. And a feature is not a runtime loader for
third-party code either: that would be an extension surface nobody here
controls.

## Decision

**A feature is a folder, and the folder declares itself.**

A feature has a manifest — an id, a name, the rooms it contributes and the
prefix its own routes live under — and the manifest is a published contract, so
it is validated when the feature is registered rather than trusted.

**On the server**, a feature is a `ServerFeature`: a manifest and a `register`
function. The runtime installs every registered feature when it builds the app.
The registry is the server's `AdapterRegistry` again, in the shape the adapter
boundary already proved: the runtime asks a registry what exists and never
knows the answer in advance.

**In the client**, a feature is a `ClientFeature`: a manifest, the routes it
owns, and the navigation entry it adds. The features are found by a
**build-time glob**, so a new feature adds a folder and touches nothing else.
That is the whole answer to "two features at once": they do not share a file,
so they cannot conflict on one.

**The surfaces the panel already had are features too.** That is what makes the
seam real rather than a decoration: the route table the runtime used to
hardcode is now the union of the features' routes, and a feature is the same
kind of thing as the oldest one.

**The seam is published.** `packages/contracts/src/feature.ts` holds the
manifest, and CONTRACTS.md holds Contract 8. A feature that changes a published
contract is a change to this document, made deliberately.

## Consequences

- **Two features can be built at the same time, on two branches, and land.**
  The files they share are the ones they own: the feature's folder.
- **The runtime does not grow.** `app.ts`, `App.tsx` and the shell's navigation
  are edited once to install the seam, and then not again. The only list that
  grows is the server's feature registry — one line per feature, in one file.
- **A feature owns its read model.** The Map assembles its own picture on the
  server, in one request, for the same reason the waiting list does: the
  browser asks for one thing instead of five and joins the answers itself.
- **The client still loads one chunk per route.** The glob is eager about the
  manifests and lazy about the pages: the manifest is a few lines, the page is
  a chunk.
- **This is not a marketplace and not a plugin loader.** A feature is in this
  repository, is reviewed like the rest of it, and is named at build time. The
  owner of a self-hosted product can read every line that runs.

## Limits

- The server's registry is an explicit list, because the server is plain
  `tsc`-built Node with no build-time glob. Two features landing at once can
  conflict on that one file; the client's cannot, because the client globs.
- A feature is not a plugin: it cannot be installed from outside the
  repository, and the manifest does not describe a lifecycle, a version range
  or a dependency. If that is ever wanted, it is a different decision.
- The domain map is unchanged. A feature is an adapter over the services, at
  the same layer as the API routes: it reads the services' public interfaces,
  it reaches into no module's tables, and it adds no module and no table of
  its own.
