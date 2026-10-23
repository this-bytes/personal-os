# SPEC-GRANT-EDITOR — The grant editor saves to the connection it is pointed at

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
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

## Not in scope

- The grant model itself. This is about which connection a save reaches, not
  about what a grant means.
- The server's grant handling. The server's behaviour is correct here; the
  panel sends the wrong connection.
- New UI, new panels, or a redesign of the editor.
