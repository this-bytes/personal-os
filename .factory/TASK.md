# Work item

A work item is the unit of work the factory dispatches. One item, one owner,
one verifiable outcome.

```markdown
## <ID> — <title>

**Owner:** Cog | Probe | Wren
**State:** intake | triage | implement | verify | review | accepted

### Problem

What is wrong or missing, in one paragraph. State the observed behaviour and
the expected behaviour. If it is a bug, include the reproduction. If it is a
gap, name the thing that should exist.

### Why now

What this unblocks. If the answer is "it is nicer", say so honestly — that is
a valid reason, but it should be visible as one.

### Acceptance criteria

Each criterion is checkable by someone who has not read the diff.

- [ ] The stale revision update is rejected with 409 and a `revision_conflict` code.
- [ ] `npm run test` passes and the new behaviour is covered by a named test.

### Not in scope

What this item deliberately does not do. This is the section that stops scope
creep, and it is not optional.

### Gates

The commands that prove it, and the ones that do not apply.

- `npm run typecheck`
- `npm run test`
- `npx tsx scripts/smoke.ts` ← server or worker changed

### Notes

Anything the owner should know before starting: a relevant ADR, a contract
clause, a past attempt that failed.
```

## States

| State       | Meaning                 | Who moves it  |
| ----------- | ----------------------- | ------------- |
| `intake`    | Recorded, not yet sized | Chief         |
| `triage`    | Assigned to an owner    | Chief         |
| `implement` | Being changed           | Owner         |
| `verify`    | Under adversarial test  | Probe         |
| `review`    | Findings written up     | Probe → Chief |
| `accepted`  | Closed, gates green     | Chief only    |

A work item never skips `verify` or `review` on its way to `accepted`.
