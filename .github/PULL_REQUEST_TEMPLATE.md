## What this changes

<!-- What the product can now do that it could not before. Not a file list. -->

## Why

<!-- The problem. Link the issue or work item. -->

## Gates

<!-- Paste the actual output. "Tests pass" is a claim; the output is evidence. -->

```
npm run typecheck
npm run test
npm run build
npx tsx scripts/smoke.ts      <!-- if the server or worker changed -->
npm run test:e2e              <!-- if the web client changed -->
```

## Checklist

- [ ] The gates above are green and their output is pasted here.
- [ ] The acceptance criteria in the linked issue are met.
- [ ] The documentation that this change makes untrue has been updated.
- [ ] No published contract changed without a migration plan and a `CONTRACTS.md` update.
- [ ] No secrets, tokens or `data/` content are included.

<!--
An autonomous agent may fill this in on the author's behalf. If you are an
agent: paste the actual command output, do not summarise it, and do not mark
a gate as passed if you did not run it.
-->
