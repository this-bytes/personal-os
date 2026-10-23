# SPEC-GRANT-EDITOR — The grant editor saves to the connection it is pointed at

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Blocks:** SPEC-R0-2 · **History:** the record was `WI-162` on a branch that is preserved in git, not in the tree

## Outcome

When the owner opens the grant editor, points it at a connection and saves,
the grant that connection receives is the one the owner edited — on **every**
path the editor can be reached by.

## The defect, measured

The panel freezes the connection id at the first render:

```ts
const agentId = agent?.id ?? '';
```

becomes

```ts
const agentId = useRef(agent?.id ?? '').current;
```

The kind of memoisation a reviewer might add to keep the mutation function
stable. **The display is untouched** — the editor still shows the other
connection's grant, and both of the display cases keep passing. The save now
patches the connection the editor was _opened_ with.

The measurement, on the tree as it stood:

```
the shipped suite, before any mutation
  Test Files  3 passed (3)
       Tests  12 passed (12)          exit 0

with the mutation applied
  Test Files  3 passed (3)
       Tests  12 passed (12)          exit 0     <-- NOTHING CATCHS IT

a probe case that saves after the editor is pointed at another connection
  FAIL  ... > patches the connection it is pointed at
  AssertionError: expected '/agents/agt_1' to be '/agents/agt_2'
```

So the suite would pass while the panel wrote one connection's grant to
another. The owner edits connection B and the server writes connection A.

## Why the shipped suite did not catch it

Every save in the suite happens on an editor that was opened once and never
closed. The save target is asserted exactly once, on that plain path.

- No shipped case saves after the editor is **reopened**.
- No shipped case saves after the editor is **pointed at another connection**.

The two paths are the ones WI-157 added display cases for. The display was
held; the write on those paths was held by nothing.

## Contract

- **The save target is the connection the editor is pointed at**, and the body
  carries the turn against **that** connection's grant.
- **The panel's request shape is unchanged** — `toolGrantChange`, the
  connection's own id. This is a defect in what is sent, not a redesign of
  what is sent.
- **The implementation is not changed to make a case pass.** If a case cannot
  be written against the branch as it stands, that is a finding, not a
  licence.

## Gate

Two shipped cases, both of which must fail against the mutation that freezes
the connection id, and both named in the evidence:

1. **Reopen** the editor — closed, the grant changed, opened again — then
   **save**, asserting the connection it patches and the body it carries.
2. **Point** the editor at another connection, then **save**, asserting the
   connection it patches is the one it is pointed at, and that the body
   carries the turn against that connection's grant.

Nothing is weakened: no test deleted, skipped or loosened; no `it.fails`,
`.skip` or `.only`; the cases WI-155 and WI-157 shipped keep passing.

## Acceptance

- Both cases are shipped and pass.
- The mutation that freezes the connection id makes **both** cases red, and
  the failure names each one.
- The panel's request shape is unchanged, and the existing cases still pass.
- The applicable repository gates pass on the delivered revision.

## Evidence

Measured on `origin/main` at `8f384b2`, on the branch
`feature/grant-editor-evidence`. That revision carries the fix and both cases;
the only thing this slice adds is the measurement and the record of it.

**The fix.** `apps/web/src/components/ToolGrantPanel.tsx` reads the connection
it is pointed at:

```ts
const agentId = agent?.id ?? '';
```

It does not freeze the id at the first render. The display is untouched: the
editor still shows the grant of the connection it is pointed at, and the
display cases still pass.

**The gate.** Two shipped cases, both in
`apps/web/src/components/__tests__/ToolGrantPanel.reseed.test.tsx`:

1. _patches the connection it was reopened for, and measures the turn against
   the grant it was reopened with_ — the editor is closed, the grant changes
   under it, it is opened again, and the save is asserted against the
   connection it was reopened for and the grant it was reopened with.
2. _patches the connection it is pointed at, and measures the turn against that
   connection's grant_ — the editor is pointed at another connection and the
   save is asserted against that connection.

**The mutation, and what it proves.** The mutation this spec names — freezing
the connection id at the first render —

```ts
const agentId = useRef(agent?.id ?? '').current;
```

— was applied to the shipped panel and the suite run. **Both cases go red, and
each failure names its own case:**

```
FAIL ... > patches the connection it was reopened for, and measures the turn against the grant it was reopened with
AssertionError: the save was sent to another connection: the owner edited one grant and the server wrote another: expected '/agents/' to be '/agents/agt_1'

FAIL ... > patches the connection it is pointed at, and measures the turn against that connection's grant
AssertionError: the save was sent to the connection the editor was opened for: the owner edited the grant in front of them and the server wrote another: expected '/agents/agt_1' to be '/agents/agt_2'
```

The other twelve cases pass with the mutation applied. That is the
measurement the spec records: the mutation does not touch the display, and
only the two write paths catch it. The mutation was then reverted and the
suite returned to green.

**The three measurements, on the shipped panel.**

| the panel                 | the suite                                                |
| ------------------------- | -------------------------------------------------------- |
| as shipped                | 3 files passed, 14 tests passed, exit 0                  |
| with the mutation applied | 1 file failed, 2 failed, 12 passed — both gate cases red |
| the mutation reverted     | 3 files passed, 14 tests passed, exit 0                  |

**The commands.** `npx vitest run` over the three `ToolGrantPanel` test files
from `apps/web`, for each of the three measurements above. The suite the
slice touches is the web package's; the other packages are untouched by a
change to a panel's save target.

**The limits.** The frozen id was never committed on any branch — `git log -S`
finds it nowhere in the tree's history. The mutation is the defect _shape_
this spec names, applied to the shipped panel to prove the gate bites; it is
not a regression that is waiting to happen. The panel's request shape is
unchanged: it still sends `toolGrantChange` and the connection's own id, and
the server's handling of a grant is untouched. What is proved here is that
the two write paths are held; what is not proved is anything about the
server, the grant model, or the editor's display beyond the cases the suite
already carried.

## Not in scope

- The grant model itself. This is about which connection a save reaches, not
  about what a grant means.
- The server's grant handling. The server's behaviour is correct here; the
  panel sends the wrong connection.
- New UI, new panels, or a redesign of the editor.
