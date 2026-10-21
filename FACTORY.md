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
LICENSE (root)              Chief
FACTORY.md, .factory/**     Chief
```

A bot that needs a file owned by someone else asks Chief. It does not take it.

## Working in parallel

Several bots work in this repository at once, and the work is not
sequential. The rules below are what make that safe. None of them is a
preference: each one exists because the alternative was tried and it cost
something.

**A work item gets a branch and a worktree.**

```bash
npx tsx scripts/work-item.ts new WI-017 forge-panel
```

The branch is `wi/017-forge-panel`, and the worktree is a directory beside
the repository. Work is written there — never in the main checkout, never
on `main`. `main` is the integration branch: it is where green work lands,
not where work is written.

**Push the branch.** Standing authorization: a bot may push its own work
item's branch to `origin` without asking anyone. Work that exists only in
one machine's working tree is work that a restart, a crash or a mistaken
`git checkout` can take away, and a push that nobody was there to approve is
a push that never happens. CI runs on every branch push, so a pushed branch
is a gated branch.

**Landing on `main` needs the owner's word.** A bot may push its own work
item's branch to `origin` without asking anyone — that is the standing
authorization above, and it is enough: CI runs on every branch push, so the
work is gated where it is written. **`main` is not covered by it.** `main` is
pushed when the owner says so, and the owner said so on 2026-10-21 08:54 for
the push of the first green tree: _push as soon as it is green, with the panel
as it stands._ That word is spent when the push is made; the next one waits
for the next word.

When the owner has said so, and `origin/main` is still where your branch
started, `main` is fast-forwarded onto your branch:

```bash
git fetch origin
git merge --ff-only origin/main    # in your worktree, if main moved
git switch main
git merge --ff-only wi/017-forge-panel
git push origin main
```

**If `main` has moved, the merge is Chief's.** Two bots' work is about to
become one work, and somebody has to say how. That is the tiebreak rule,
and the tiebreak is said out loud. This is the one place the workflow puts
the owner back in the loop, and it is a decision about two pieces of work
rather than a rubber stamp on a push.

**Never force-push.** A force-push replaces what is on the remote with what
is in the local repository, so it takes every commit that another bot landed
since with it. The pre-push hook refuses any push that is not a
fast-forward, and says what to do instead. The only way past it is
`PERSONAL_OS_ALLOW_FORCE=1`, which means somebody meant it.

**A commit carries only your own work.** Read `git status` before you
commit. A file that is staged and has changed again since it was staged is
a file two hands are on; the pre-commit hook names those files, and the
staged version is what lands.

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
   [AGENTS.md](AGENTS.md). Cog **names the check the change needs** — as an
   acceptance criterion, in the brief, so Probe cannot miss it — and names
   Probe for the review. **Cog does not write the test.** Every test file
   belongs to Probe, and the implementer must not author the check that
   accepts its own work.
4. **Verify.** Probe writes or sharpens the tests, runs every gate in
   [Definition of done](#definition-of-done), and reports the actual output.
   Probe's job is to make the change fail, not to approve it. **A criterion
   that asks for a test is Probe's to write, and it is written here** — the
   implementer named the check, Probe writes it, and Probe's test is the one
   that decides.
5. **Review.** Probe reports findings against the acceptance criteria. A
   finding is a defect, an observation, or a question — labelled as such.
6. **Accept.** Chief decides. Only Chief closes a work item. A change that is
   not accepted goes back to Implement with the findings attached.

This mirrors the product's own rule: a factory task moves to `review`, never
straight to `done`. Only an explicit acceptance closes it.

**Chief dispatches Verify the moment Implement lands, and an item that has
landed and is not verified is not in the factory — it is inventory.** Nothing
in the runtime joins the two steps: an implementation task that ends leaves its
item in `implement` until somebody sends it to Probe. **Three items in a row
sat there on 2026-10-21** — WI-036's licence record, WI-017's template
record, and the correction to the published counts — each with the work done
and the branch green, and each with **no verification ever dispatched**, so
each was an item that could never have been accepted. **The queue of things
waiting for acceptance is the factory's real capacity**, so dispatching the
verification is part of finishing the implementation, not an afterthought to
it.

**The factory runs two tasks at once, and a slot can be held by a turn that is
not working.** `MAX_RUNNING = 2` is hard-coded in the runtime's dispatcher and
no setting in this repository changes it, so **half the factory is one slot**.
On 2026-10-21 a turn livelocked — restarting the same investigation without
concluding — and held a slot for **119 minutes** while the other slot ran real
work: the factory ran at half speed, **27 tasks queued**, and Probe's chat sat
**idle**. Nothing raised an error. **A stall is found by
[`.factory/watchdog.md`](.factory/watchdog.md)**, which reports it; **cancelling
it is Chief's judgement**, because elapsed time alone cannot tell a stall from a
long task — five legitimate tasks that day ran past two hours and all finished.

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
- **A settled decision has a work item behind it, or it is not a decision.**
  When the owner settles something, it is funded: it gets a work item, an
  owner and a slot in the order. A decision with nothing behind it is a
  wish, and a wish that lives in a candidate list is a promise the factory
  forgot. The queue is reviewed against the owner's decisions, not only
  against new wants — on 2026-10-20 two of the six settled decisions had no
  work item at all.

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
  other's state. Make the worktree with
  `npx tsx scripts/work-item.ts new WI-nnn <slug>`, which creates the branch
  and the worktree together. The worktree is a directory beside the
  repository and never inside it, so `git add -A` in the main checkout
  cannot sweep another agent's working tree into a commit.
- **One file, one live item.** Two Chief sessions in one tree have already
  collided: on 2026-10-20 a workflow change in WI-005 landed on top of
  another session's edit to the worker image tag. Before a session edits a
  file, it checks that no live item claims it, and a second item touching a
  claimed file waits for the first to land. The claim is the item's state and
  dispatch record. When two sessions are the lead in one tree, the older
  claim wins, the newer one waits, and the tiebreak is said out loud in the
  group.
- **One session opens work items.** Two Chief sessions in one tree have taken
  the same number twice — on 2026-10-20 and again on 2026-10-21 — and a work
  item's file was written over each time. A number is a claim, and two claims
  are a collision, so the number space has one owner: the session that leads
  implementation in a tree opens and numbers the items. A session with a gap
  to fill records it in [`.factory/INTAKE.md`](.factory/INTAKE.md) as a want
  with a proposed title, owner and criteria, and the session that owns the
  numbers creates the file. An item that was written over is re-filed at a new
  number with the collision written into it, so a number is never reused and
  the history stays readable. If the session that owns the numbers is not
  running, the other session says so in the group and takes the space, rather
  than taking it quietly.
  **The check belongs at commit time.** The rule above was written at 23:57
  on 2026-10-20 and was broken nine minutes later, so the claim is not
  enough on its own. Before a session commits, it reads `git status`. If a
  file it is committing carries an edit it did not write, it stages only its
  own hunks — `git apply --cached` against a hand-built patch — and leaves the
  rest uncommitted, and it says so in the group. A session that finds another
  session's work in its file does not commit that work, and does not
  "helpfully" finish it. On 2026-10-21 a clause in `ARCHITECTURE.md` was
  saved from being committed with another session's unrelated hunks in the
  same commit, because the session that wrote it staged its own three lines
  and nothing else.
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
  approval — publishing a release, changing the repository's visibility, or
  deleting a branch.
- **Push your own branch; ask before anything else.** An agent may push the
  branch of the work item it is working on without asking. **`main` waits for
  the owner's word** — a branch is pushed freely, `main` is pushed when the
  owner says so. Everything else external is the human's decision. A push that
  rewrites what is already on the remote is refused by the hook in
  [`.githooks/`](../.githooks/), because it takes
  every commit that landed since with it, and that is not a thing good
  intentions can prevent.

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
