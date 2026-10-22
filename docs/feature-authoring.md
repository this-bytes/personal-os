# Writing a feature

A **feature** is a unit of product that slots into the runtime: a room in the
panel, a surface in the client, and — when it needs one — routes under the API.

This is the standard for writing one. It exists so that the next feature is
built the same way as the last one, without the author having to read the
runtime to find out how features fit into it.

The reasoning behind it is in
[ADR 11](decisions/0011-feature-slots.md). The contract it has to keep is in
[CONTRACTS.md](../CONTRACTS.md) (Contract 8). What the panel looks like with
the seam in it is in [the panel's rooms](panel-rooms.md). The development
workflow around a slice is in [the feature guide](feature-guide.md).

---

## The shape of a feature

A feature is a folder. On the server:

```
apps/server/src/features/<id>/
  feature.ts     the manifest and the routes the feature owns
```

In the client:

```
apps/web/src/features/<id>/
  feature.ts     the manifest, the routes and the navigation entry
  <Page>.tsx     the page behind the route, loaded on demand
```

Both `feature.ts` files are named the same on purpose: the server one and the
client one describe the same feature.

The client finds features by a **build-time glob**, so adding a feature adds a
folder and touches nothing else. That is what lets two features be built at the
same time, on two branches, and land without either of them colliding with the
other.

---

## The manifest

The manifest says what the feature is and what it contributes. It is a
published contract, so it is validated when the feature is registered: an id
that is not an id fails when the tree is checked, not when the owner opens the
panel.

```ts
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_forge_map',
    name: 'The Map',
    description: 'The orientation room: the agents, the threads they are in.',
    rooms: [{ id: 'map', label: 'Map', path: '/map', density: 'airy', order: 10 }],
  },
  routes: [
    { path: '/map', load: () => import('./ForgeMap').then((page) => ({ default: page.ForgeMap })) },
  ],
};
```

| Field         | What it is                                                        | Default |
| ------------- | ----------------------------------------------------------------- | ------- |
| `id`          | `feat_` and lower-case words. Stable for the life of the feature. | —       |
| `name`        | What the feature is called in words.                              | —       |
| `description` | One sentence on what it is for.                                   | none    |
| `rooms`       | The rooms the feature contributes to the room switch.             | `[]`    |
| `apiPrefix`   | The prefix the feature's own routes live under.                   | none    |

A room has an `id`, a `label` the owner reads, a `path`, a `density`
(`airy` or `dense`) and an `order` in the switch. **A path leads to one room**:
two features claiming the same path are refused rather than quietly resolved.

The navigation entry is optional. A feature with no `nav` is reached through
the room switch or through a link, and does not take a place in the list on the
left.

---

## The rules

**A feature does not change a published contract.** The routes the runtime
publishes are the routes it had; a feature adds its own beside them. If a
feature needs a change to a published shape, that is a change to CONTRACTS.md,
made deliberately.

**A feature is an adapter over the services, at the same layer as the API
routes.** It reads the services' public interfaces, reaches into no module's
tables, and adds no module and no table of its own. The domain map governs the
modules; a feature does not add one.

**A feature's routes live under its own prefix.** `apiPrefix` is the whole of
the feature's share of the HTTP surface: nothing else registers under it.

**The client loads one chunk per route.** The manifest is eager — it is a few
lines — and the page is lazy. A route that is never visited is never
downloaded.

**A feature brings its own tests.** A pure function is tested without a
database; a route is tested through `app.inject`; a page is tested through the
browser suite.

**A counter is a count and never a ratio.** If there is nothing to divide by,
there is no share.

---

## The server side

A server feature registers its own routes and is given the app and the
services:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from '../../api/helpers.js';
import type { ServerFeature } from '../registry.js';

const querySchema = z.object({ workspaceId: z.string() });

export const myFeature: ServerFeature = {
  manifest: {
    id: 'feat_my_feature',
    name: 'My feature',
    apiPrefix: '/api/features/my-feature',
  },
  register(app: FastifyInstance): void {
    app.get('/api/features/my-feature', { preHandler: requireAuth }, async (request) => {
      const { workspaceId } = parseQuery(querySchema, request.query);
      return { workspaceId };
    });
  },
};
```

Then it is named, once, in `apps/server/src/features/index.ts`:

```ts
export function createDefaultFeatureRegistry(): FeatureRegistry {
  return new FeatureRegistry().register(forgeMapFeature).register(myFeature);
}
```

That list is the one file two features can collide on. Everything else about a
server feature is its own.

---

## The client side

A client feature says which routes it owns and, if it wants one, what the
navigation entry says:

```ts
export const feature: ClientFeature = {
  manifest: { id: 'feat_my_feature', name: 'My feature' },
  routes: [
    {
      path: '/my-feature',
      load: () => import('./MyFeature').then((page) => ({ default: page.MyFeature })),
    },
  ],
  nav: { label: 'My feature', to: '/my-feature', icon: Compass, order: 70 },
};
```

The panel builds its routes and its navigation out of the features. `App.tsx`
and `AppShell.tsx` do not change.

---

## Reusable parts

`packages/ui` holds the parts that are not Personal OS's business: shapes,
counts and pictures. A primitive there knows nothing about agents, threads or
tasks — what it draws is passed to it.

The rules for putting something in `packages/ui`:

- **No domain knowledge.** If it needs to know what an agent is, it belongs in
  the app.
- **No colour literals.** Colours come from the token layer through CSS
  variables. `apps/web/src/index.css` is the only file that may hold a hex.
- **No router.** A primitive draws; the application decides where a click
  leads. A component that needs to be a link lives in the app.

The parts that are there now: `AuroraField`, `CounterBand` and `Constellation`.

---

## The checklist

Before a feature is ready:

- [ ] The manifest parses — the id is an id, the rooms have paths, and no two
      features claim the same path.
- [ ] The routes are under the feature's own prefix, and they ask for a
      session like every other route.
- [ ] The client loads the page on demand, and the login screen downloads no
      route chunk.
- [ ] The feature brings a test: a pure function, a route, or a page.
- [ ] The counts are counts, and no ratio is shown without a denominator.
- [ ] Nothing outside the feature's own folder was edited — except the server
      registry's one line, and CONTRACTS.md when a published shape moved.
- [ ] `npm run verify-gates` is green, and the browser suite passes.
