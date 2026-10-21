# Forge — six briefs

**Written by:** Cog, for [WI-024](../../../.factory/work/WI-024.md).
**Written against:** commit `d343300` (2026-10-21).
**Source of truth:** [`prototypes/DIRECTION.md`](../../DIRECTION.md) — the direction, the
settled boundary, and the cost model. Where the document and the tree disagree, the
tree is right, and Vision's correction of the document is the fix.

**Corrected by the lead, 2026-10-21 15:45 — the landing page's premise.** The
lead settled WI-024's criterion 5 **after** these briefs were written (the briefs
are `93ef99b`; the ruling is `60a4561`): **the root route is the Map room, and
the Needs-you rail sits on it and decides in place. The landing page does not move
into the execution room; what moves there is the Conversations page.** Brief 05's
statement of the item's rule and its quote of the boundary rule are corrected to
match, and brief 01's heading is disambiguated. **The briefs' shape did not
change** — brief 01 already put the root route on the Map room, and brief 05
already made the list into the rail that decides in place. The code has not been
written yet, so the correction lands before the build follows the briefs.

Forge lands as **one visible change**. Six briefs is how that single change is built:
the briefs are the seams the work is cut along, so that several owners can work in
sequence and no half a Forge is ever released.

**These are drafts for the lead to number.** They are written in the work-item shape
so that each becomes a numbered item with a copy, but they sit outside `.factory/`
because that is the lead's folder and numbering is the lead's call. When they are
numbered they move to `.factory/work/`.

## The briefs

| Brief                                                                     | Piece                                     | Lands | Owner |
| ------------------------------------------------------------------------- | ----------------------------------------- | ----- | ----- |
| [01 — Rooms and surfaces](01-rooms-and-surfaces.md)                       | The room switch and the three surfaces    | 2     | Cog   |
| [02 — The material](02-material.md)                                       | The palette pass                          | 1     | Cog   |
| [03 — The execution trace](03-execution-trace.md)                         | The Work room's companion gutter          | 4     | Cog   |
| [04 — The dashboards screen](04-dashboards.md)                            | The third surface, Forge-only             | 5     | Cog   |
| [05 — The Needs-you rail](05-needs-you-rail.md)                           | WI-004's control, wrapped                 | 3     | Cog   |
| [06 — The constellation and the agent hues](06-constellation-and-hues.md) | The hardest piece, and the paint it wears | 6     | Cog   |

**The numbering is the item's piece order; the landing order is a different axis.**
The rail is piece 5 in the item and lands third, because it is waiting for a room to
sit in and for WI-031's client line, which has now landed.

**The material lands first and is never released alone.** It is the one change with no
visible shape of its own, so it goes first as the base of the series and merges with
the rest of them. A palette pass on its own is a coat of paint; Forge is the coat and
the cut.

**One branch, one merge.** The six briefs are six commits on one branch. The merge to
`main` is one visible change, which is what the owner asked for.

## The rule

Every brief below is built against one rule, quoted here exactly as
[`prototypes/DIRECTION.md`](../DIRECTION.md) states it:

> _If it is a picture of the system, it is in the orientation room. If it is a place where work is inspected or decided, it is in the execution room — with two declared exceptions, the Needs-you rail and the constellation, which carry decisions in the orientation room because a decision is taken where the list is._

**The two declared exceptions are brief 05 and brief 06.** The rail carries the
approvals' decision controls in place, and the constellation carries the connect
decision in place. The second exception is the lead's ruling of 2026-10-22: the
constellation **is** the agent list, so a connect control on it is a decision
taken where the list is, and moving it to the execution room would re-create the
defect WI-004 was returned for.

## The cost, measured from the tree

`git grep -c -F '<token>' d343300 -- 'apps/web/src' 'packages/ui/src'`, and
`git grep -o -F '<token>' d343300 -- 'apps/web/src' 'packages/ui/src' | Measure-Object -Line`
for the occurrences. Lines and occurrences are different numbers and the document's
own headline figure conflated them; these are the two, apart.

| Token      | Lines | Files | Occurrences | Under Forge                                                        |
| ---------- | ----- | ----- | ----------- | ------------------------------------------------------------------ |
| `slate-`   | 217   | 34    | 311         | The neutral scale. Re-hued in place — the occurrences do not move. |
| `indigo-`  | 34    | 14    | 46          | Becomes violet (`--accent`). One bulk rename of one token family.  |
| `amber-`   | 10    | 6     | 20          | The only semantic collision. See brief 02.                         |
| `red-`     | 26    | 19    | 60          | Maps to `--err`. Survives.                                         |
| `emerald-` | 9     | 7     | 16          | Maps to `--ok`. Survives.                                          |
| `violet-`  | 0     | 0     | 0           | New.                                                               |
| `cyan-`    | 0     | 0     | 0           | New.                                                               |

The document measured the same palette at `3479c31` and found 216 lines and 310
occurrences of `slate-`; the tree has moved by one line since, which is why the
briefs name the commit they were measured at. The numbers above were measured at
`d343300` and re-measured at `a107cb9` with the same result — the tree moved, the
palette did not.

## Two things the lead has to settle

**1. The amber count is eight, not four.** The item's acceptance criterion names four
caution sites (`ConversationDetail.tsx:349` and `:504`, `ResourceEditor.tsx:263` and
`:264`). The document named four too, until Vision's repair of 2026-10-21
(`e560165`), which corrected it to eight after Probe measured the tree. The tree
says eight: reading each of the ten amber lines in the code, eight mean caution or
interruption rather than liveness. **The briefs build to eight**, and brief 02 names
every one of the ten with the words the code uses at it. The criterion's four are
stale, not the document's eight, and the briefs say so where a reader will see it.

**2. The rail cannot accept.** The direction document promises the owner that they
"never leave the landing screen to approve, reject **or accept**". The rail cannot
accept: acceptance is decided on the factory board, on the card
(`apps/web/src/components/TaskBoard.tsx:310-329`), reached from the rail by a link,
and no open item owns putting an acceptance control on the rail. **Brief 05 says
what the rail can do — approve and reject in place — and does not promise a control
that does not exist.** Building one is a separate item and it needs the owner.

## Dependency, and it is met

Brief 05's rail carries the server's own sentence on each row, which is WI-031's
fourth criterion. WI-031's implementation landed at `414996c` on 2026-10-21, so the
rail's row already has the sentence and the turn's two conclusions. Brief 05 is
unblocked; the brief that was told to wait no longer has to.
