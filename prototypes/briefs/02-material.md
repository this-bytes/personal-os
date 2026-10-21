# Brief 02 — The material

**Piece:** the item's piece 2, the palette pass. **Lands first.**
**Owner:** Cog. **Verifier:** Probe.

Forge's variable block — `--bg`, `--surface`, `--border`, `--text`, `--muted`,
`--faint`, `--accent`, `--live`, `--ok`, `--warn`, `--err`, `--info` — and the
neutral scale under it. The cost model says the scale **re-hues in place**, so most
call sites do not move.

## What it changes

**The `@theme` block in `apps/web/src/index.css`.** Tailwind v4 is configured in the
app's own stylesheet, so the whole palette is one file: eleven `--color-slate-*`
values, eleven `--color-indigo-*` values, and room for the new scales. This is why
the re-hue is cheap — the 311 `slate-` occurrences do not move, because they are
class names, not values.

- The **slate scale re-hues to Forge's violet-black**: `--color-slate-950` becomes
  `#07060d` and the rest of the scale follows it. The names stay; the pixels change.
- **`indigo-` becomes `violet-`**: the eleven values are replaced by the violet
  scale (`--accent: #a78bfa`), and the **34 lines across 14 files** that name
  `indigo-` are renamed. This is the one family that moves rather than re-hues, and
  the rename is mechanical.
- **`cyan-` appears**: the data colour, `--accent-2: #22d3ee`. It is new — the tree
  has no `cyan-` anywhere.
- **`red-` and `emerald-` survive** as `--err` and `--ok`. Their names do not move
  either; the semantic tokens point at them.
- **The semantic block is added**: `--bg`, `--surface`, `--border`, `--text`,
  `--muted`, `--faint`, `--accent`, `--live`, `--ok`, `--warn`, `--err`, `--info`,
  taken from the prototype's `prototypes/d-forge/theme.css:26-65`.
- **The `--agent-*` slots are declared**: the five hues the prototype carries
  (`--agent-cog`, `--agent-probe`, `--agent-wren`, `--agent-hermes`, `--agent-echo`).
  Brief 06 decides which agent wears which one and where it is drawn; this brief
  only declares the slots.

**One source for the neutrals.** The semantic tokens are derived from the re-hued
scale, not chosen beside it — `--color-surface` is a step of the same scale the 311
occurrences use. A panel with two neutrals is a panel with a seam.

**The amber pass, all ten lines.** Forge's travelling rule is _amber always means
live or waiting on you_, and ten lines across six files use amber today. Read in the
code, **eight of the ten mean caution or interruption rather than liveness**, and
the tenth is a block that carries two meanings at once. Here is every one of them,
with the words the code uses at it:

| Site                          | What it says today                                                | Under Forge                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell.tsx:37`             | the stream dot for `reconnecting` (open is emerald, error is red) | interruption, not liveness → **loses amber**                                                                                            |
| `AppShell.tsx:170`            | the badge that reads "live updates interrupted"                   | interruption → **loses amber**                                                                                                          |
| `StatusBadge.tsx:30`          | the connection status `degraded`                                  | caution → **loses amber**                                                                                                               |
| `packages/ui/src/card.tsx:63` | the `warning` badge variant                                       | caution, on the variant's own name → **loses amber**                                                                                    |
| `TaskBoard.tsx:293-294`       | the acceptance block, rendered for `review` **and** `unknown`     | **splits**: `review` is waiting on the owner and keeps amber; `unknown` says the agent may already have run and is a caution → loses it |
| `ConversationDetail.tsx:349`  | the routing-blocked notice                                        | caution → **loses amber**                                                                                                               |
| `ConversationDetail.tsx:504`  | the conversation-paused notice                                    | caution → **loses amber**                                                                                                               |
| `ResourceEditor.tsx:263-264`  | the resource revision conflict                                    | caution → **loses amber**                                                                                                               |

**The eight that lose amber become neutral or `--err`** — there is no second amber
to move them to, because Forge's own theme sets `--live` and `--warn` to the same
value, and a second amber would break the one-meaning rule that the rule exists to
protect. Per site: the two conflict and blocked notices (`ResourceEditor.tsx:263`,
`ConversationDetail.tsx:349`) are failures and take `--err`; the paused notice
(`ConversationDetail.tsx:504`) is a state and takes the neutral scale; the stream
dot and the interrupted badge (`AppShell.tsx:37`, `:170`) take the neutral scale,
because the feed being in flux is not the owner being needed; `StatusBadge.tsx:30`
takes the neutral scale for the same reason — the connection is degraded, not
wanted; `card.tsx:63` takes `--err` for a warning that is a warning.

**The `--warn` token is not a second amber.** It is declared with the same value as
`--live` and it must not be reached for out of habit: the eight caution sites above
do not use it. If a future surface needs a caution colour, it uses `--err` or the
neutral scale, and the one meaning holds.

**This brief's number is the cost.** Measured at `d343300`:

```
git grep -c -F '<token>' d343300 -- 'apps/web/src' 'packages/ui/src'
git grep -o -F '<token>' d343300 -- 'apps/web/src' 'packages/ui/src' | Measure-Object -Line
```

| Token      | Lines | Files | Occurrences | What moves                              |
| ---------- | ----- | ----- | ----------- | --------------------------------------- |
| `slate-`   | 217   | 34    | 311         | the pixels, not the call sites          |
| `indigo-`  | 34    | 14    | 46          | **the call sites** — one bulk rename    |
| `amber-`   | 10    | 6     | 20          | eight sites re-treated, one block split |
| `red-`     | 26    | 19    | 60          | nothing                                 |
| `emerald-` | 9     | 7     | 16          | nothing                                 |
| `violet-`  | 0     | 0     | 0           | new                                     |
| `cyan-`    | 0     | 0     | 0           | new                                     |

Lines and occurrences are different numbers. The direction document's own headline
figure conflated them, and the build's counts are the ones above.

## What it preserves

- **Every call site.** The slate scale is re-hued in place: the 311 occurrences do
  not move, and the 217 lines keep their shape.
- **The component APIs in `packages/ui/src`.** The `warning` badge variant keeps its
  name — it is what it is called, not what it is coloured — and only its colour
  changes.
- **`packages/ui` ships as source** and Tailwind scans it through the app's
  `@source` directive, so the shared package takes the new palette with no change
  of its own.
- **Every behaviour.** Nothing in this brief decides anything, moves anything, or
  fetches anything.

## Acceptance criteria

- [ ] The `@theme` block carries Forge's variable block, and the slate scale is
      re-hued in place: `bg-slate-950` is `#07060d` and the 311 occurrences are
      untouched.
- [ ] `indigo-` is gone from `apps/web/src` and `packages/ui/src`: 0 lines, and
      `violet-` has taken its place with the same count of call sites.
- [ ] `cyan-` exists for data, and the panels that carry data use it.
- [ ] `red-` and `emerald-` survive as `--err` and `--ok`.
- [ ] The semantic tokens are derived from the re-hued scale — there is one neutral
      in the panel, not two.
- [ ] Amber means live or waiting on you, and nothing else. The table above is the
      check: eight sites re-treated, the acceptance block split, and `grep -c amber-`
      comes back with only the sites that keep it.
- [ ] The `--agent-*` slots are declared.
- [ ] The counters band shows counts, and a ratio only where there is a denominator
      to divide by. (The band is brief 01's; the rule is the direction's, and this
      brief is where the `--live` and `--ok` tokens it uses come from.)

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`.

## Not in scope

- **The hues themselves.** This brief declares the slots; brief 06 assigns them.
- **Any behaviour change.** A material is not a feature.
- **The server, the contracts, the data model.** None of them change.
