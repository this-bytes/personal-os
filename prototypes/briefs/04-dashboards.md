# Brief 04 — The dashboards screen

**Piece:** the item's piece 4. **Lands fifth.**
**Owner:** Cog. **Verifier:** Probe.

Forge's third room: bound data sources, with the widget bindings visible. It is
the only surface in the direction that has no equivalent in the panel today, and
the contracts already carry it.

## What it changes

**A new room and a new route.** The Dashboards room (`prototypes/d-forge/dashboard.html`),
holding the owner's dashboards as grids of widgets.

**Widgets bound to a data source's payload, with the binding shown.** The contracts
carry the whole shape (`packages/contracts/src/resource.ts:49-93`):

- `dashboardSpec` — widgets, `refreshSeconds`, `published`;
- `dashboardWidget` — `id`, `type` (`metric | chart | table | text`), `title`,
  `dataSourceId`, and the binding: `kind` (`raw | series | aggregate`), `field`,
  `groupBy`, `aggregate`, `limit`;
- `dataSourceSpec` — `kind` (`json | http | sqlite`), the inline `payload` for
  `json`, `url` and `authRef` for `http`, `headers`.

**The bindings are visible, not implied.** A widget shows which data source it is
bound to and which binding it uses. A dashboard that cannot say where a number came
from is a dashboard of assertions, and the owner cannot trust a number they cannot
trace.

**Where the data comes from.** The panel already reads resources
(`GET /api/resources`, `GET /api/resources/:id`) and can ask the server to run one
(`POST /api/resources/:id/execute`, `apps/server/src/api/resources.ts:81-91`). A
data source's payload comes through those; a `sqlite` source is read by the server,
because the browser cannot. **No server change.**

**The refresh is the spec's own.** `refreshSeconds` decides how often the room
re-reads, and `0` means it does not. The room does not invent a cadence of its own.

## What it preserves

- **The resources page.** It stays where it is, in the Map room's tiles; the
  dashboards are a room of the owner's own bound data, not a replacement for the
  resource list.
- **The resource's own data.** The room reads what the resources already hold. It
  does not copy a resource's state into a second model.
- **The engineer's view of the binding.** The widget's spec is shown as it is
  given, the way every other spec in the panel is shown.
- **Everything else about the rooms.** This brief adds one; it changes none.

## Acceptance criteria

- [ ] The Dashboards room renders the owner's dashboards as widgets, and the widget
      types the contracts name are all drawn.
- [ ] Each widget shows the data source it is bound to and the binding it uses.
- [ ] The data comes from the data source's payload, read through the routes that
      already exist.
- [ ] The room refreshes on the spec's `refreshSeconds`, and a spec of `0` does
      not refresh.
- [ ] A widget whose data source is missing or unreadable says so on the widget,
      and does not show a zero that reads like a measurement.
- [ ] A dashboard with no widgets says so, in the room's own voice.
- [ ] No server change, no contract change, no new dependency.

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`.

## Not in scope

- **Building a dashboard.** The room reads the dashboards the owner has; authoring
      one is the resources page's business.
- **A new data-source kind.** `json`, `http` and `sqlite` are the three the
      contracts name.
- **The server.** The room reads through routes that already exist.
