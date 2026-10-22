# Panel color semantics

Forge styling remains; conversations are the primary work surface. Accent means
live or waiting on the owner. Structure, data, caution and failures have separate
meanings. Current tokens live in apps/web/src/index.css.

## The tokens

The token layer is the `@theme` block in `apps/web/src/index.css`. Every hex in
the web client is in that one file, and every colour below is a name for a
meaning rather than a hue.

| Token                    | Value     | The one thing it means                                                  |
| ------------------------ | --------- | ----------------------------------------------------------------------- |
| `--color-accent`         | `#fbbf24` | live, or waiting on you                                                 |
| `--color-accent-surface` | `#451a03` | the accent badge and the accent block                                   |
| `--color-accent-border`  | `#92400e` | the accent badge and the accent block                                   |
| `--color-accent-text`    | `#fcd34d` | the accent badge and the accent block                                   |
| `--color-structure`      | `#6366f1` | structure and identity: nav, primary button, focus ring, agent identity |
| `--color-data`           | `#22d3ee` | data: numbers, chart series, metrics                                    |
| `--color-ok`             | `#34d399` | ok, valid, saved, dispatched                                            |
| `--color-err`            | `#fb7185` | failures, and only failures                                             |
| `--color-caution`        | `#94a3b8` | a notice that is not a failure — always with an icon beside it          |

There is no `--warn` and no `--info`. The prototype's theme declared `--warn`
with the same value as `--live`, which is the collision by the back door: a
token whose value is the accent's, and whose name promises a second meaning.
A caution is either the neutral scale or the error colour.

**An agent's hue is an identity, never a meaning.** In the Map's picture every
agent wears a hue from a fixed ring, so a reader can tell two agents apart.
The ring keeps away from the accent, the ok colour and the error colour, so a
hue never looks like live work, a success or a failure. The hues are computed
from the agent's id, so an agent keeps its colour; they are `hsl()` values
rather than hexes, which keeps the token layer the only place a hex lives. The
ring is in `apps/web/src/features/map/constellation.ts`.

The neutral scale (`--color-slate-*`) and the structure scale
(`--color-indigo-*`) keep their names and their values. The `amber-` scale is
declared in the same file, in hex, because Tailwind's own palette is oklch and
the panel's is hex — a family that is not declared here does not match the
rest of the file.

**One name means two things in Tailwind, and it is worth knowing which.** The
`accent-color` utility colours the tick of a form control, and two sites use
it: the "replace the stored configuration" checkbox and the agent picker on
the conversations page. They are `accent-indigo-500`, which is structure and
not the panel's accent — a form control's tick is not live work and not
something waiting on you. The guard test looks for the accent in the
background, text and border family, because that is where the panel's accent
actually lives.

## Verification

accentGuard.test.tsx checks the current source/token boundary and renders waiting
rows with labels. accentSemantics.test.ts retains the task-review versus uncertain
outcome and error-notice checks. These checks exercise current UI semantics rather
than historical prototype counts or copied layout prose.

The old palette inventory and prototypes remain in Git at 507708b. For work
selection use [the roadmap](roadmap.md); this page adds no layout or factory scope.
