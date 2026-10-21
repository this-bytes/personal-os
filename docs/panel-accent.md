# The panel's accent

The rule this repository keeps is in [PRODUCT.md §11](../PRODUCT.md): the panel uses
a single accent colour, and it always means the same thing — live, or waiting on
you. Structure and data stay in their own colours.

This file is the record of that rule as the panel actually implements it: the
token layer, and the inventory of every place the panel used to reach for a
colour that meant something else.

The direction is **D — Forge**, and the prototype it comes from lives under
`prototypes/`. The value of amber is `#fbbf24`, and it is the same value the
prototype calls `--live`.

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

The neutral scale (`--color-slate-*`) and the structure scale
(`--color-indigo-*`) keep their names and their values. The `amber-` scale is
declared in the same file, in hex, because Tailwind's own palette is oklch and
the panel's is hex — a family that is not declared here does not match the
rest of the file.

## The inventory

Measured on `wi/070-free-window-streams` at `c3eef9c`, before this change.
Amber appeared on **10 lines, in 6 files, as 20 occurrences**, and ten more
places reached it without ever naming a colour, through the `warning` badge
variant. Three places that mean live or waiting on you were wearing indigo.

The rows are the elements, not the lines: one element can carry the colour on
more than one line.

### The eight elements that named amber

| File                                                 | Element                                                  | Colour today                                            | Meaning today          | Meaning under Forge                                    |
| ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `packages/ui/src/card.tsx:63`                        | the `warning` badge variant                              | `border-amber-800 bg-amber-950 text-amber-300`          | caution                | neutral — the variant is split in two                  |
| `apps/web/src/components/AppShell.tsx:37`            | the stream dot for `reconnecting`                        | `bg-amber-400`                                          | interruption           | neutral, and a dashed ring                             |
| `apps/web/src/components/AppShell.tsx:170`           | the badge that reads "live updates interrupted"          | `border-amber-800 bg-amber-950 text-amber-300`          | interruption           | neutral                                                |
| `apps/web/src/components/StatusBadge.tsx:30`         | the dot for `degraded`                                   | `bg-amber-400`                                          | caution                | neutral, and a dashed ring                             |
| `apps/web/src/components/TaskBoard.tsx:293-294`      | the acceptance block, for `review` **and** for `unknown` | `border-amber-800/50 bg-amber-950/20`, `text-amber-200` | two meanings at once   | split: `review` keeps the accent, `unknown` is neutral |
| `apps/web/src/pages/ConversationDetail.tsx:349`      | the routing-blocked notice                               | `border-amber-800/70 bg-amber-950/40 text-amber-200`    | caution, but a failure | the error colour — the message was not delivered       |
| `apps/web/src/pages/ConversationDetail.tsx:504`      | the conversation-paused notice                           | `border-amber-800/60 bg-amber-950/30 text-amber-200`    | a state                | neutral, with its icon                                 |
| `apps/web/src/components/ResourceEditor.tsx:263-264` | the resource revision conflict                           | `border-amber-800/70 bg-amber-950/30`, `text-amber-200` | caution, but a failure | the error colour — the save cannot land                |

### The ten that reached amber through the `warning` variant

One line in `packages/ui/src/card.tsx` repainted all ten of them, and none of
them named a colour.

| File                                                | Element               | Meaning today  | Meaning under Forge |
| --------------------------------------------------- | --------------------- | -------------- | ------------------- |
| `apps/web/src/components/TaskBoard.tsx:204`         | "awaiting acceptance" | waiting on you | **the accent**      |
| `apps/web/src/components/StatusBadge.tsx:9`         | the `degraded` status | caution        | neutral             |
| `apps/web/src/components/TaskBoard.tsx:206`         | "outcome unknown"     | caution        | neutral             |
| `apps/web/src/components/ChatMessageList.tsx:121`   | "outcome unknown"     | caution        | neutral             |
| `apps/web/src/components/ConversationList.tsx:46`   | "paused"              | a state        | neutral             |
| `apps/web/src/pages/ConversationDetail.tsx:261`     | "paused"              | a state        | neutral             |
| `apps/web/src/components/ParticipantManager.tsx:69` | "disabled"            | a state        | neutral             |
| `apps/web/src/pages/Agents.tsx:197`                 | "disabled"            | a state        | neutral             |
| `apps/web/src/components/WaitingList.tsx:383`       | "Approval"            | waiting on you | **the accent**      |
| `apps/web/src/components/WaitingList.tsx:385`       | "Check this"          | caution        | neutral             |

### The three that meant live or waiting on you and were wearing indigo

Indigo is structure, so a live-or-waiting badge in indigo said the opposite of
what it meant.

| File                                              | Element     | Colour today | Meaning today  | Meaning under Forge |
| ------------------------------------------------- | ----------- | ------------ | -------------- | ------------------- |
| `apps/web/src/components/ChatMessageList.tsx:109` | "streaming" | indigo       | live right now | **the accent**      |
| `apps/web/src/components/ChatMessageList.tsx:152` | "streaming" | indigo       | live right now | **the accent**      |
| `apps/web/src/components/WaitingList.tsx:384`     | "In review" | indigo       | waiting on you | **the accent**      |

### One that is left alone

| File                                          | Element   | Colour today | Meaning today          | Left as it is, and why                                                               |
| --------------------------------------------- | --------- | ------------ | ---------------------- | ------------------------------------------------------------------------------------ |
| `apps/web/src/components/WaitingList.tsx:386` | "Blocked" | red          | a task that is blocked | red — two readings are defensible and the call is the owner's, not the implementer's |

## The connection states

The event stream's state is a shape, not a colour. A socket that is open says
the panel is healthy; it does not say the owner is needed, and the accent must
never mean "the socket is open" — an accent that is on screen all the time in a
healthy panel stops meaning anything.

| State                  | Colour          | Shape                              | Text                      |
| ---------------------- | --------------- | ---------------------------------- | ------------------------- |
| connected, stream open | `--ok`          | filled disc                        | "connected" / "live"      |
| degraded, connecting   | neutral         | dashed ring, with a warning icon   | "degraded" / "connecting" |
| disconnected, idle     | neutral, dimmer | hollow ring                        | "disconnected" / "idle"   |
| error, stream error    | `--err`         | filled ring, with a warning icon   | "error" / "offline"       |
| **live work**          | **accent**      | filled accent disc, with a spinner | "running" / "streaming"   |

Every one of them carries a text label, and the two that need it carry an icon,
because colour is never the only thing carrying the meaning — WCAG 2.2 SC
1.4.1 asks that it is not.

## The guard

`apps/web/src/__tests__/accentGuard.test.ts` fails if amber appears anywhere
outside the token layer, and if the token layer grows a second token for the
accent. The keep-list is one file: `apps/web/src/index.css`.

A rule that nothing checks is a rule that erodes. This is the check.

## What is not settled here

- Whether "Blocked" stays red or becomes the accent.
- Whether the whole waiting rail becomes the accent, which §11 argues for, and
  which today is three colours.
- The five agent hues, which must exclude amber, emerald, rose and violet,
  because an agent must not wear a colour that says something about the work.
- The bulk `indigo-` to `violet-` rename and the slate re-hue, which are the
  material pass and not this one.
- Light mode. The panel is dark-only by design; the tokens are written so a
  light theme could be added later.
