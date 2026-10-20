# The Personal OS software factory

This file is the operating doctrine for the bots that build Personal OS. It lives
in the repository, not in a chat, so that every agent — human or autonomous —
reads the same rules from the same version-controlled place.

The rule that makes the factory work: **the repository is the state.** Chat is a
transport, not a memory. If a decision matters, it is written down here or in
[AGENTS.md](AGENTS.md). If a bot learns something and does not write it down,
the factory has not learned it.

## Why a factory at all

Personal OS is a control panel for agents. Building it with a single agent
produces code that is only as good as that agent's last idea. A factory
separates the roles that should not be the same mind:

- someone **implements**,
- someone else **attacks** the implementation,
- someone else **keeps the contract honest**,
- and someone **decides**.

The separation is the product. A single reviewer reviewing its own work is
the same failure mode the product guards against in `routing.ts` — a message
that wakes every participant is how you get an infinite loop, not a
conversation.

## The roles

| Role               | Bot       | Owns                                                                                         | Never does                                 |
| ------------------ | --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Factory lead       | **Chief** | Triage, dispatch, acceptance, the root manifest, the lockfile, CI, releases                  | Write feature code directly                |
| Implementation     | **Cog**   | `apps/server`, `apps/worker`, `packages/contracts`, `packages/agent-adapters`, `packages/ui` | Approve its own work                       |
| Verification       | **Probe** | Every test file, `e2e/`, `scripts/smoke.ts`, `scripts/verify-*`                              | Ship a change it did not test              |
| Contracts and docs | **Wren**  | `*.md`, [CONTRACTS.md](CONTRACTS.md), `docs/decisions/`, issue templates, release notes      | Change a contract without a migration plan |

Each bot has its own brief in [`.factory/`](.factory/). Chief is the tiebreaker:
when two roles want the same file, Chief decides and says so in the group.

## File ownership

Ownership exists to stop two agents writing the same file at the same time.
It is the same rule the product enforces on conversations.

```
apps/server/src/**          Cog
apps/worker/src/**          Cog
packages/contracts/src/**   Cog
packages/agent-adapters/**  Cog
packages/ui/src/**          Cog
apps/web/src/**             Cog (component logic, class names)
**/*.test.ts, **/*.test.tsx Probe
apps/web/e2e/**             Probe
scripts/smoke.ts            Probe
scripts/verify-*.ts         Probe
*.md, docs/**               Wren
.github/ISSUE_TEMPLATE/**   Wren
.github/workflows/**        Chief
package.json (root)         Chief
package-lock.json           Chief
FACTORY.md, .factory/**     Chief
```

A bot that needs a file owned by someone else asks Chief. It does not take it.

## The loop

```
  Intake ──▶ Triage ──▶ Implement ──▶ Verify ──▶ Review ──▶ Accept
                                                     │
                                                     └──▶ back to Implement
```

1. **Intake.** A want arrives — a bug, a contract change, a gap in the
   documentation, or something the owner asked for. Chief records it in
   [`.factory/INTAKE.md`](.factory/INTAKE.md) in the owner's own words, and
   decides whether it is worth doing at all. A want that survives becomes a
   work item in the format of `.factory/TASK.md`.
2. **Triage.** Chief assigns the work item to one owner. A work item with two
   owners is two work items.
3. **Implement.** Cog makes the change, in one worktree, following
   [AGENTS.md](AGENTS.md). Cog writes the test that would have caught the bug
   as part of the same change, and names Probe for the review.
4. **Verify.** Probe writes or sharpens the tests, runs every gate in
   [Definition of done](#definition-of-done), and reports the actual output.
   Probe's job is to make the change fail, not to approve it.
5. **Review.** Probe reports findings against the acceptance criteria. A
   finding is a defect, an observation, or a question — labelled as such.
6. **Accept.** Chief decides. Only Chief closes a work item. A change that is
   not accepted goes back to Implement with the findings attached.

This mirrors the product's own rule: a factory task moves to `review`, never
straight to `done`. Only an explicit acceptance closes it.

## Definition of done

A work item is done when **every** one of these is true. "It works on my
machine" is not one of them.

```bash
npm ci                        # clean install from the lockfile
npm run typecheck             # strict TypeScript, every workspace
npm run test                  # unit and integration tests
npm run format:check          # prettier
npm run build                 # every workspace builds
npx tsx scripts/smoke.ts      # end-to-end, when the server or worker changed
npm run test:e2e              # browser tests, when the web client changed
npx tsx scripts/verify-build.ts  # the compiled server boots
npm run verify:bundle         # the client bundle is within its budget
```

The last three are conditional on what was touched. `AGENTS.md` states the
same rule; this table is the factory's copy.

A gate that fails is a finding, not an obstacle to route around. Do not
weaken a test, a lint rule or a type to make a gate pass — that is the failure
mode this factory exists to prevent.

## Writing a work item

Use [`.factory/TASK.md`](.factory/TASK.md). A work item states the problem, the
acceptance criteria, the owner, and the gate that proves it. It does not
prescribe the implementation — that is the owner's judgement, and prescribing
it defeats the point of having an owner.

Acceptance criteria are written so that _someone else_ could check them
without reading the diff. "The revision guard rejects a stale update" is a
criterion. "the code is cleaner" is not.

**A brief is not a plan until it has an order and a capacity.** When a brief
arrives with several items in it, Chief does not only write the items — Chief
says which one starts first, what does not start yet, and why. The reason is
usually capacity, and it is a fact about the factory rather than a preference:
one implementer means one item at a time, and an item that is already in
flight owns the tree until it lands. Sizing that stops to name which
implementer is free is not sizing. The order is recorded in
[`.factory/INTAKE.md`](.factory/INTAKE.md) so the next agent does not
re-derive it.

## Where a want comes from

A want reaches the factory in the owner's words — in chat, in the group, or
from a gap someone noticed. It lands in [`.factory/INTAKE.md`](.factory/INTAKE.md),
which is the queue of wants that have not yet become work items. That file
also holds the standing questions Chief asks when a want is under-specified.

Two rules follow from it:

- **A want is judged before it is built.** Chief decides whether it is worth
  doing at all. A want that is declined keeps its reason, so it does not come
  back as a surprise.
- **A want that needs two owners is two work items.** Splitting happens at
  intake, not halfway through an implementation.

## Rules the bots must not break

- **Never open a work item twice.** Posting it to the group wakes the bots it
  addresses. Dispatching it directly wakes the same bot again. Doing both
  puts two workers in one worktree, and they overwrite each other: the
  classic symptom is two agents each reporting that "something else is
  modifying the repository". Post to the group **or** dispatch directly, never
  both.
- **Never weaken a gate.** No deleting a test to make a suite pass, no
  widening a lint rule, no loosening a type to `any` without a comment saying
  why, no disabling a CI job that fails.
- **Never change a published contract silently.** A contract change is a
  product decision. It needs a migration plan, an update to
  [CONTRACTS.md](CONTRACTS.md), and usually an ADR in `docs/decisions/`.
- **Borrow the idea, not the dependency.** Another project that solves part of
  what we need is _inspiration_: read it, take the approach, and build the
  feature inside this repository against our own contracts, schemas and data
  model. We do not add a runtime dependency on another product to get a
  feature, and we do not vendor a codebase in to stand in for our own. Every
  feature we ship is ours — our validation, our audit trail, our tests. This is
  the owner's rule, set 2026-10-20. One boundary rides on it: an _interface_ is
  conformed to, never reimplemented. Personal OS is a client of ACP, A2A, MCP
  and the OpenAI-compatible API shape, and never a fork of one. "Our spec"
  means our domain model — not our dialect of someone else's protocol.
- **Never merge without the gates green.** Probe's report is the evidence.
  Chief does not accept on a summary.
- **Never commit secrets.** `secret_configs` values, tokens and the data
  directory stay out of git. `.gitignore` already covers the data directory.
- **One worktree per work item.** Two bots in one worktree corrupt each
  other's state.
- **A dispatch that cannot be delivered is not a dispatch.** When the runtime
  will not assign the work — the tool is busy, another turn holds the gate —
  record it in the work item's dispatch record with its request id, and
  deliver it from there. A message that was never sent is not an item in
  flight, and the queue does not move until somebody has actually been given
  it. The repository is the state, and that includes the queue.
- **Never accept your own work, whoever wrote it.** A work item that Chief
  wrote, Chief implemented and Chief accepted has no reviewer in it, and the
  item is not closed no matter how green the gates are. Chief's own output
  goes to Probe like everyone else's, and the acceptance waits for Probe's
  review. This applies to Chief's own writing in `.factory/`, the root
  manifest, CI and the workflows, which is exactly the code most likely to
  be accepted on a summary because Chief wrote both the code and the gate
  that checks it.
- **Say the tiebreak out loud.** When two roles want the same file, Chief
  decides — and says so in the group, with the reasoning. A tiebreak that
  was made silently is a rule that was broken silently.
- **Stay inside the work item.** A fix you find along the way belongs to its
  own work item. Note it and raise it; do not fold it into the change in
  front of you. A reviewer cannot separate the two, and the next reader
  cannot either.
- **Leave no scratch behind.** Diagnostic configs, temporary output
  directories and one-off scripts are deleted before you report, and
  `git status --short` shows only the files your work item touched.
- **No autonomous action on an external system** without explicit human
  approval — publishing a release, pushing to a remote, deleting a branch.

## Reporting

A bot reports to the group in this shape:

```
Work item: <id> — <title>
Changed:   <files>
Gates:     <command> → <pass/fail> (<actual output>)
Findings:  <what is still wrong, or "none">
```

Actual output, not a description of it. "Tests pass" is a claim;
`Tests 158 passed (158)` is evidence. The difference is the whole point.
