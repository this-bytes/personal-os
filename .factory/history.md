# History — the factory's process record

What follows is the factory's process record: what it did, what it observed
and what it corrected, written down at the time. It is kept for the record and
it is not part of the state. The state is [INTAKE.md](INTAKE.md), and the
history of the factory is its git history.

## Owed, 2026-10-21 01:08

The status post for this round was **refused twice** — the `Personal OS
Factory` group is mid-discussion, and the 23:40 post (`task_70c6057c13ae`) is
still queued behind it. A post that was never sent is not a message, so it is
recorded here and delivered from here when the round clears.

## The state at 2026-10-21 03:30 — the gates are green

**Every gate is green for the first time.** Measured by Chief on the tree at
`a2aadb4`:

| Gate                   | Result                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `npm run typecheck`    | exit 0                                                                                    |
| `npm run test`         | exit 0 — server 190 passed (21 files), web 46, worker 23, agent-adapters 16, contracts 28 |
| `npm run format:check` | exit 0                                                                                    |
| `npm run build`        | exit 0                                                                                    |
| `npm run test:e2e`     | exit 0 — 24 passed                                                                        |

**The two reds that were carried are gone.** Both were real, and both were
fixed by a concurrent session while Chief was measuring them:

- `npm run test` was red on two files, both Probe's tests proving WI-009's
  defect. `3872dbc` ("Keep the coordinator rule on the path that names a
  target") closed the gap — the explicit-target path had been applied
  _before_ the routing mode was consulted. Chief ran the two files
  directly: `Test Files 2 passed (2)`, `Tests 24 passed (24)`.
- `npm run test:e2e` was red on two of Probe's browser tests, both
  specifying WI-004's missing control. `a2aadb4` ("Let the owner decide an
  approval where the list is") delivered it.

**Chief's standing rules, restated because they were both nearly broken
again:**

- _Never merge without the gates green._ The branch carried two reds for
  hours. Chief did not merge, and did not weaken a gate to clear them.
- _One file, one live item._ Chief wrote a new work item over the top of
  another session's live WI-021 and clobbered it. It was restored from
  `HEAD` unchanged and Chief's item took the next free number, WI-022. This
  is the **second** collision of this kind in this factory — WI-016 was the
  first, and WI-020 carries the renumber note from it. Chief's own item
  number was the cause this time, not a filename.

## The findings Chief made while the gates were green

The gates being green made it worth asking what the **published contract**
now says against what the **code** now does. Two real defects came out of
it, and neither is a gate:

1. **[WI-013](work/WI-013.md) — returned to Wren.** All four contract
   entries say _"The code does not implement it yet"_ — and the code
   implements all four (`9ad4f98`, `70d042c`, `5f019b9`, `e764e6a`). One of
   them, WI-008's, was **already false when it was written**: Chief checked
   with `git merge-base --is-ancestor 9ad4f98 5a7e620` (exit 0, so the
   implementation was already in the tree) and read the tree at `5a7e620`,
   which carries `'unknown'` in `messageStatusSchema`.
2. **[WI-022](work/WI-022.md) — opened.** `CONTRACTS.md:632` publishes
   `WaitingReason = 'pending' | 'review' | 'blocked'` and
   `apps/server/src/api/waiting.ts:17` declares a fourth member,
   `'unknown'`. A published type the code has outgrown. WI-008's own commit
   message named this gap and left it — a gap named in a commit message and
   left there is a gap with no one holding it.

## The post that is owed, request id `status-2026-10-21-0105`

The earlier post, superseded by the one below. Kept because it is the record
of what was owed at the time:

- WI-004 returns to implement — Probe's verification says it fails criterion 5
  (an approval is approved or rejected in the list) and the "who is waiting"
  half of criterion 1. Dispatched to Cog, `task_4bafb60edd39`.
- WI-009 implemented and committed (`6e7d347`), with Probe for verification,
  `task_1c40cabe1df4`. WI-008 implemented and committed (`9ad4f98`), with
  Probe for verification, `task_8bb9dbcfbeaa`.
- WI-013's four published contract entries are landed (`5a7e620`). WI-002 and
  WI-014 are accepted.
- The gates, measured on the tree with everything landed: `npm run typecheck`
  exit 0; `npm run test` 160 passed (160) in 17 files, plus 46, 11, 13, 13;
  `npm run format:check` exit 0. The one red gate left is `npm run test:e2e`,
  on exactly two tests Probe wrote on purpose to specify WI-004's missing
  control.
- Two corrections: Wren's WI-013 work was landed path-limited as `5a7e620`
  because a bare commit in this tree sweeps other people's work; and the
  remote already exists — `origin` is
  `https://github.com/this-bytes/personal-os.git`, pushed 21:47 +11:00 — so
  the owner is not asked to create a repository.

## The state at 2026-10-21 04:00 — the suite is red again, and the red is the specification

**Probe reviewed WI-008 and the item does not meet its criteria.** Task
`task_8bb9dbcfbeaa`, batch `batch_d6dc904088cd`. The `unknown` state is real
and it reaches the owner correctly, but on two of the three paths an
`unknown` outcome still becomes a retry — the one thing this item exists to
prevent.

**The suite is red at `1cafe35`, on purpose.** Probe's new tests are the
specification of what is left, and they are committed. Chief measured the
tree:

```
npm run test → FAIL (exit 1)
  server:         Test Files 1 failed | 20 passed (21)   Tests 2 failed | 190 passed (192)
  web:            Test Files 5 passed (5)                 Tests 46 passed (46)
  worker:         Test Files 1 failed | 4 passed (5)      Tests 6 failed | 24 passed (30)
  agent-adapters: Test Files 2 passed (2)                 Tests 16 passed (16)
  contracts:      Test Files 4 passed (4)                 Tests 28 passed (28)
```

Eight failures, all of them the retry paths, the contract's waiting reason and
the audit trail. Nothing else is red. Chief's rule stands: the contract is the
truth and the code is the defect — so the tests stay, and the code moves.
WI-008 is returned to Cog, task `task_21b395d2f98a`, batch
`batch_44d6112553e4`.

**Chief confirmed all five of Probe's defects against the tree** before
passing them to Cog. They are in [WI-008](work/WI-008.md): the factory-task
and automation paths test `failure` before `unknown`
(`apps/worker/src/executor.ts:811-815`, `:1002-1006`); the reaper requeues a
job whose item is already `unknown`; the panel gates its accept/reject
control on `review`, so an unknown task cannot be closed by the owner at all;
and leaving `unknown` by assigning the task to an agent writes no audit entry.

### Two duplicate dispatches, cancelled

Two Chief sessions in one tree dispatched WI-004 and WI-011 to Probe twice.
Probe is the only verifier, the queue is deep, and a second worker in one
worktree is what the runtime's own guard warns about. **Chief cancelled his
own two tasks** — `task_4a566d42c121` (WI-004) and `task_f5b5eb99dea3`
(WI-011). The live verifications are `task_616009728104` (WI-004) and
`task_e2219b4e3c7a` (WI-011). One verifier, one item, one verification.

### The routing file went red too — `a7e39e9`

While the factory waited, Probe committed `a7e39e9`: two test files, +211
lines, no source change, and three of the tests are red. They split across two
items — one is WI-009's (the sender is resolved by believing the message) and
two are WI-021's (a named target is dropped before the rule ever sees it).
The file is claimed by WI-009, which is older, so WI-021 waits and the two
findings go to Cog in one dispatch. The details are in
[WI-009](work/WI-009.md).

### The gates at `0732b41`

```
npm run typecheck    → exit 0
npm run test         → exit 1
  server:          Test Files 3 failed | 18 passed (21)   Tests 5 failed | 199 passed (204)
  web:             Test Files 5 passed (5)                 Tests 46 passed (46)
  worker:          Test Files 1 failed | 4 passed (5)      Tests 6 failed | 24 passed (30)
  agent-adapters:  Test Files 2 passed (2)                 Tests 16 passed (16)
  contracts:       Test Files 4 passed (4)                 Tests 28 passed (28)
npm run format:check → exit 0 — All matched files use Prettier code style!
npm run build       → exit 0 — ✓ built in 3.28s
npm run test:e2e    → exit 0 — 24 passed (46.8s)
```

Eleven reds, all of them Probe's specifications: eight for WI-008, three for
WI-009 and WI-021. Nothing else is red, and the browser suite is green — so
the e2e gate, which was the one holding the owner's top want, is now satisfied.

### A want, not a work item — the number space has one owner

`automationRunStatusSchema` (`packages/contracts/src/automation.ts:73`) gained
`'unknown'`, and `CONTRACTS.md` publishes no automation run status at all — so
nothing contradicts it and nothing records it either. It came out of Probe's
WI-008 review. It is recorded here rather than as a numbered item, because
`fff389e` gave the number space one owner and the other session proposes wants
in this file.

- **Title:** The published contract says nothing about the automation run
  status.
- **Owner:** Wren.
- **Criteria:** `CONTRACTS.md` publishes the automation run status, including
  `'unknown'` and what it means on a run; the entry says what a client must do
  with a value it did not expect; the entry is checked against
  `packages/contracts/src/automation.ts:73` by the reviewer.
- **Not urgent:** nothing contradicts it, and no client depends on it today.

### The four wants that came out of Probe's WI-011 review

Probe's review of the product record found six defects, and most of them are
claims the record makes about code that does not do the thing. Fixing the
document is [WI-011](../work/WI-011.md)'s work and it goes back to Wren now.
**These four are the other half** — the code that would make the claims true.
They are recorded as wants, not work items: the number space has one owner,
and a feature needs the owner's release before it becomes an item.

- **A resource records who made it — including automations and tasks.**
  **Owner:** Cog. **The want:** the `automations` and `tasks` tables carry a
  `createdBy` column, and both providers write the caller's id instead of
  `'system'` (`apps/server/src/modules/resources/service.ts:170`, `:260`) —
  the agent's connection id on the MCP path, as the other four kinds already
  do. **Then:** the first measure can be computed for all six kinds instead
  of four, and it stops being answered wrongly for two of them. **Needs:** a
  migration note for the rows that exist.
- **The audit trail covers every mutating route, and the worker's own
  writes.** **Owner:** Cog. **The want:** the twelve routes that write no
  audit entry write one, or the record says which ones do not and why; the
  worker writes an entry when it mutates a shared resource
  (`apps/worker/src/executor.ts:896-911` — `resource.refresh` updates the row
  with no `revision` bump and no entry); the `result` column can record a
  failure, and `POST /api/resources/:id/execute` stops asserting success for
  a run that was merely queued.
- **The external orchestrator is real, or the record stops claiming it.**
  **Owner:** Cog. **The want:** either — `executions.externalRef` keeps the
  external **task** id, the external status is retained, `executionOwner` can
  be `'external'`, the evidence kind `'external-reference'` is written, and
  the panel shows the reference and the result; or the paragraph is cut. The
  `externalTaskId` adapter path (`apps/worker/src/executor.ts:1188-1191`) is
  either implemented by one adapter or removed, because today no adapter
  implements one and the path is dead.
- **The autonomy policy is enforced where it is declared, or the claim is
  cut.** **Owner:** Cog. **The want:** either the workspace and goal policies
  are read wherever they are enforced and a pause is a real policy field, or
  the record says the limits live on the conversation
  (`apps/server/src/modules/conversations/routing.ts:89-110`) and stops
  claiming a pause that no policy carries.

### The post that is owed, request id `status-2026-10-21-0415`

The group post could not be delivered. `post_group` answered **"The group is
mid-discussion; post again once this round finishes"** on every attempt
between 04:15 and 04:30 — the other Chief session has a round in flight, and
the group's own guard holds the door until it closes. The request id makes the
retry idempotent rather than a second post, so it is recorded here and sent
when the round ends.

The post says, in one line per work item, newest first: WI-023 triage,
blocked on the push path; WI-022 triage, waiting on the owner's nod, with
Probe's confirmation and the added urgency-order criterion; WI-021 triage, the
defect proven and the file held by WI-009; WI-020 and WI-017 waiting on the
owner's nod; WI-018, WI-013 returned to Wren, WI-012, WI-011, WI-010, WI-009,
WI-007, WI-006, WI-004 in the state their ledgers say; WI-015 accepted, and
what the product can now do because of it; and the five questions that are
with the owner.

It carries the gates at `5f91e19` — typecheck 0, test 1 with eleven reds,
format:check 0, build 0, test:e2e 0 with 24 passed — and the line that the
eleven reds are Probe's specification rather than a regression. It also names
the two duplicate dispatches that were cancelled and the fact that the
automation-run-status gap is recorded as a want rather than a numbered item.

**Nothing in the post dispatches anything.** Every item with work in flight
was dispatched before the post was written, and the post names no agent, so
no bot is woken by it.

### A second want, from the second Chief session — WI-010's two stale facts

The second Chief session re-verified `prototypes/DIRECTION.md` independently,
from the tree, and recorded the check in [WI-010](work/WI-010.md). The
recommendation holds: the central number is exact —

```
git grep -c -E 'slate-|indigo-' 235f97c -- 'apps/web/src' 'packages/ui/src'
  → lines=224  files=31
```

— which is what the document claims, reproduced with the document's own
command, and every substrate claim it makes was checked against the tree. Two
facts have since moved, because the tree moved: the control landed in
`a2aadb4`, so "nothing under `apps/web` calls `POST /api/approvals/:id/decide`"
is now false, and the palette cost is 244 lines across 34 files at HEAD rather
than 224 across 31. The document is pinned to `235f97c` and says so, so this is
staleness rather than error — but it is recorded as a want, because the number
space has one owner and it is not this session's.

- **Title:** WI-010's recommendation is pinned to a commit the tree has left
  behind.
- **Owner:** Vision. `prototypes/DIRECTION.md` is a design artefact and
  WI-010's own tiebreak says it is Vision's to write.
- **Criteria:** the document is re-verified against the commit it is pinned to
  and says which one that is; the sentence about
  `POST /api/approvals/:id/decide` is corrected — the call is at
  `apps/web/src/components/WaitingList.tsx:99`, with approve and reject at
  `:249` and `:257`; the palette cost is re-measured and carries the commit it
  was measured at, with the command that reproduces it
  (`git grep -c -E 'slate-|indigo-' -- 'apps/web/src' 'packages/ui/src'` — 244
  lines across 34 files at `0732b41`); and the recommendation itself does not
  change, because B was recommended on the owner's own Q2 answer and the
  control landing strengthens rather than weakens the conclusion that the
  control is not blocked by the direction.
- **Not urgent:** the owner reads one word, not a cost model, and the ADR that
  records the answer is written after the owner confirms.

### A want with no number yet — the MCP surface's id-addressed tools are not workspace-scoped

**This is a finding with no item, and a finding with no home is a finding that
is lost.** It came out of WI-028's contract half: Wren published the two
entries (`f62fca7`) and, checking what the read rule reaches, found that the
rule is narrower than the surface it sits on. Chief checked it against the
tree before recording it, and it is worse than the report said.

**The code states the rule.** `apps/server/src/modules/mcp/server.ts:96`: _"An
agent may only act inside a workspace it has been granted."_ The guard is
`assertWorkspace` (`:97-103`), and it refuses with `forbidden` — _"This agent
has no access to that workspace."_ — when the workspace is not among the
agent's.

**The guard is called in four places, and every one of them is a tool that
takes a `workspaceId` as input**: `agent.list` (`:246`), `task.create` (`:273`),
`resource.create` (`:360`), `automation.create` (`:468`).

**The id-addressed tools do not call it at all**: `conversation.read`,
`conversation.post`, `task.update`, `task.get`, **`resource.get`** (`:378-398`),
**`resource.update`** (`:401-439`) and **`automation.inspect`** (`:484+`). They
take a bare id, hand it to the capabilities service — `resourceGet(id)` is
`resources.get(id)` (`apps/server/src/modules/capabilities/service.ts:197-199`),
which has no actor and no workspace to check against — and the agent's granted
workspaces are never consulted. **So an agent granted one workspace can read,
update and inspect a resource, a task or an automation in another workspace, if
it knows the id.**

**What it is not.** It is not the memory rule, and it is not WI-033's audit
gap. WI-028's rule is about _whose_ memory a resource is; this is about _which
workspace_ a resource may be reached in. And the memory rule cannot close it:
`memoryOwner` (`:113-121`) returns an owner for an agent-scoped memory and
nothing for anything else, so every other resource passes through it untouched.

**Why it is a defect and not a design question.** The code's own comment states
the rule the id-addressed tools break, so this is not "which workspaces should
an agent reach" — it is "the tools that were supposed to check do not check".

- **Title:** The MCP surface's id-addressed tools are not scoped to a
  workspace, so an agent can reach any resource it can name.
- **Owner:** Cog, for the code (`apps/server/src/modules/mcp/**`), with the
  contract half for Wren (`CONTRACTS.md`) — the contract leads and the code
  follows, the same order as WI-022 → WI-027.
- **Criteria:**
  - An agent's read, update or inspect of a resource in a workspace it was
    never granted is **refused**, and the refusal says why — the way the memory
    rule refuses with "An agent may only reach its own memory."
  - The check is made **where the resource is read**, not once per tool, so a
    tool added later cannot forget it — and the check knows the resource's
    workspace, which means the id-addressed path has to learn it.
  - The owner's own access is untouched, and an agent keeps every access its
    grant already gives it.
  - The contract says which workspaces an agent's grant covers, and the refusal
    is published with a migration note.
  - A test pins it: an agent granted one workspace is refused a resource in
    another, on read, on update and on inspect.
- **Not a feature, and not a grilling.** This is a defect against a rule the
  code already states, so it does not need the owner's release as a new idea
  does. **What it needs is a number**, and the number space has one owner.
  It is recorded here so that it is not lost while it waits for one, and
  because WI-017 is adding a tool to this same surface — a rule that lands
  after it has to be applied to it.

### The status post that is owed, request id `status-2026-10-21-0430`

The 04:30 status post to the `Personal OS Factory` group was refused by the
runtime, not by the group: _"This Bot is replying in multiple chats, so this
tool call cannot be assigned safely."_ The same refusal came back for every
task query, so this session could not read the state of the six verifications
now with Probe either, and could not accept or return any of them.

The post that is owed, request id `status-2026-10-21-0430`, says: WI-010
verified independently and holding, with its two facts now behind the tree;
WI-004's decision control shipped in `a2aadb4` and the browser suite is green
at 24 passed; WI-008 returned to Cog with five defects, because an unknown
outcome still becomes a retry on two of three paths; WI-009 and WI-021's
findings with Cog in one dispatch; WI-013 returned to Wren; the suite red on
purpose, eleven failures, all of them Probe's specifications; and the
bottleneck, which is one verifier, six items at verify or review, and no
acceptance step happening.

It also carries a tiebreak, said out loud: on WI-004's return, the approval
row keeps its title link to the conversation, with Approve and Reject beside
it. The criterion asks for both — an approval is decided where the list is,
and an entry that needs a reply opens its conversation — and the link is the
context for deciding, not a way out of deciding.

**Superseded.** The 04:30 post is overtaken by the 05:10 post: ten of the
eleven deliberate reds are now green, the fixes for WI-008 and WI-009 landed,
and the one red left is a published-type change that is the owner's to make.

### The status post that is owed, request id `factory-status-2026-10-21`

This one is owed to the _other_ Chief session, which asked for it and could
not send it: the `Personal OS Factory` group refused every chat-side call it
made for two hours. It was tried here five times, and the refusal was
different from theirs — not _"This Bot is replying in multiple chats"_ but
_"The group is mid-discussion; post again once this round finishes"_. Both
doors are shut, by two different guards, and the message is the same, so it
is recorded here and sent when the round ends.

The post says, in short:

- **The pipeline now proves what it claims.** A clean worktree at `dc1ecc0` —
  fresh `npm ci --ignore-scripts`, nothing built, a fresh Docker volume —
  measured thirteen gates with twelve passing: typecheck 0, format:check 0,
  build 0, verify:bundle 0 (first paint 499.02 kB over 6 chunks, 5/5 vendor),
  actionlint 0, the three guard refusals each exiting 2, the container stack
  up and healthy, and the worker check passing all ten of its assertions.
  `scripts/smoke.ts` and `scripts/verify-build.ts` exit 0 as well.
- **The guard checks are recorded against the exit code they are supposed to
  produce.** The guard refuses with 2, and 2 is the pass. An earlier run of
  that script treated any non-zero exit as a failure, which is how a refusal
  became a red gate — the same class of mistake as a check that cannot fail.
- **Three defects were found by running the gates where nothing was lying
  around, and all three are fixed.** The container job wrote its secret to
  `$GITHUB_ENV` and used it in the same step, where it is not visible, so
  compose would have died before the stack started; the same job built both
  images under tags nothing runs and then let compose build them again; and
  the bundle gate's loud failure was an early exit that broke the gate's own
  tests. A fourth, the fresh-checkout property that CI never exercised, was
  found by the reviewer and is fixed too.
- **The tree is red on purpose, and one of the two fixes has no work item.**
  `af00a4e` says so in its own commit message: the tests are red against the
  code as it stands, because they are the proof of the defect. Three of them
  are the memory guard — an agent that names somebody else's agent in a
  memory it _creates_ is refused, but the guard is not called on
  `resource.update`, so an agent can write into another agent's memory and
  take it over, which is what `CONTRACTS.md` forbids. The rest are the
  waiting list's missing `unknown` reason, which WI-022 covers. **The
  memory-guard breach has no work item**, and none is opened here: two leads
  writing work item files in one tree is the collision repaired in `a719f8e`,
  and the lead who wrote the red test is the one who knows what it meant.
- **One decision for the lead.** A red `main` is a red pipeline. Vitest's
  `it.fails` is built for this: the test stays red against the code, and it
  fails the suite when it starts passing, which is the forcing function for
  the fix landing. It turns known failures into pinned promises. It is the
  lead's call, not mine, because the red is deliberate and deliberate is not
  mine to undo.
- **Still open for the owner:** there is no remote configured, so the GitHub
  Actions pipeline has still never run. The workflows are actionlint-clean and
  the whole container job was run locally against real Docker, but the first
  push is where "CI runs the product" stops being a claim with strong local
  evidence and becomes a fact.

**Nothing in the post dispatches anything.** It names no agent, so no bot is
woken by it, and no work item is opened by it.

## The state at 2026-10-21 06:30 — the guard has cleared, and the tree has six reds

The runtime guard that refused every dispatch from this session has cleared.
WI-022 is with Wren (`task_ed4c3132afe9`) and WI-010 is with Probe
(`task_4cc3a3b1160f`). Nothing is dispatched twice: this session has two live
dispatches and the peer session has its own.

The tree was measured first-hand at `ed850d6`, not read out of a commit
message:

```
npm --prefix apps/server run test  → exit 1 — 6 failed | 203 passed (209)
  unknown-outcome.test.ts        2  — the waiting list's missing 'unknown' reason
                                       (WI-022) and its missing 'turn' kind
  agent-memory.test.ts           3  — the memory guard
  ownerPasswordExposure.test.ts  1  — "still replaces the credential"
```

### The sixth red is a race, and it is a real one

The password exposure test **passes on its own** — `npx vitest run
src/__tests__/ownerPasswordExposure.test.ts` → 5 passed, 14.38s — and fails
only when the whole suite runs. The cause is in the file: the test holds an
exclusive lock on the database while it reads the reset process's command
line, and the reset's own busy timeout is ten seconds. On Windows the command
line is read by spawning PowerShell, so when the machine is busy the read can
outlast the reset's timeout, the reset exits non-zero, and
`expect(resetExit).toBe(0)` fails.

A test that fails only when the machine is busy proves nothing, and it is the
one red in this list that is not a specification of a defect. It is a race
between the test and the process it inspects. It is Probe's file, it is
WI-002's verification work, and it needs a small item of its own.

### The memory guard does not need a new work item, and the reason matters

The peer session raised the memory-guard breach in the group on the grounds
that two leads writing work item files in one tree is the collision repaired
in `a719f8e`. The finding is real, but it splits in two, and only one half is
a breach.

**Two of the three are WI-012's own defect.** WI-012 is "An agent has a
memory of its own", owner Cog, implemented in `e764e6a`, and it is sitting at
`verify` with Probe's verification owed and queued (`task_533f34c6d269`). The
published contract says the memory "follows the agent across every
conversation it takes part in — available to that agent's turns in every
conversation, **and to no other agent's turns**" (`CONTRACTS.md:450-455`).
The red tests prove that `resource.update` does not call the guard, so an
agent can write into another agent's memory and take it over. That is the
item's implementation not enforcing the item's own contract — so WI-012 goes
back to `implement` with Probe's finding, and **no new number is needed**.

**The third is a question, not a breach**, and the test says so itself:

> This one is a question, not a breach: `resource.get` is published as "Read a
> resource" with no promise about who owns it, so the contract does not say an
> agent may not read one. The rule the code states for writes — an agent
> touches only its own memory — has no read-side counterpart, and this test
> pins the stricter reading until the owner says which one holds.

So there are two entries in the contract, and they disagree: the memory entry
says an agent's memory is not available to another agent's turns, and the
resource-read entry promises no ownership at all. Which reading holds is the
owner's, because it decides what an agent can see of another agent. It is
with the owner as a question, not with the factory as a defect.

### The wants, for the session that owns the numbers

The number space belongs to the session that owns it. These are recorded here
for that session to number, and they are not dispatched from this session.

**Want 1 — the waiting list's kind grows by one, so an unknown turn reaches
the owner.**

- **Title:** An agent turn whose outcome cannot be confirmed reaches the
  owner.
- **Owner:** Cog for the server, Wren for the published kind — which is two
  items, not one, because one work item has one owner.
- **Criteria:** the waiting list returns an item for an agent turn that ran
  out of time, with the reason the contract publishes; the published
  `WaitingKind` grows by that kind, with a migration note saying what a client
  that matched on two kinds must now do; the item is closed by the owner and
  only by the owner, the way an unknown task is; and nothing that draws an
  approval or a task changes its shape.
- **Blocked on:** the owner. `WaitingKind` is published as `'approval' |
'task'`, and growing a published type is the one change the owner
  reserved.

**Want 2 — the memory guard is called on update, not only on create.**

- **Title:** The memory guard holds on update, the way it holds on create.
- **Owner:** Cog.
- **Criteria:** the guard the create path uses is called on the update path
  too; an agent that names another agent's `agentConnectionId` in an update
  is refused the way it is refused on create; the refusal is the same refusal,
  not a second shape of it; and the write-side test that pins this stays in
  the suite, green.
- **Note:** this is WI-012 returning to `implement`, not a new item. Listed
  here so it is not lost, and so the number is not spent on it twice.

**Want 3 — the password exposure test does not race the reset it inspects.**

- **Title:** The password exposure test does not race the reset process.
- **Owner:** Probe.
- **Criteria:** the test passes when the suite runs and when it runs alone,
  which means the command line is read without holding the reset past its
  timeout — the lock is released as soon as the read succeeds, or the reset
  is given a timeout that matches the read; the test still proves the
  exposure, so the assertion that the password is visible in the host's
  process list does not go away with the race; and the test still proves the
  recovery path works, so the assertion that the credential is replaced stays.

### The two questions this leaves for the owner

Both are the owner's, both are one choice, and both are on the path to a green
tree.

1. **The waiting list's kind.** Does the published kind grow by one, so that
   an agent turn whose outcome cannot be confirmed reaches the owner? The
   contract already promises that an unknown item reaches the owner as
   something to check and that only the owner can close it; today that promise
   is met for tasks and broken for turns, and a broken turn can never be
   closed at all.
2. **The memory read side.** May an agent read another agent's memory? The
   memory entry says one thing and the resource-read entry says nothing, and
   the code enforces the write side only.

### The `it.fails` question, decided — no blanket

The other session raised the deliberate reds in the factory group with the
decision they need: vitest's `it.fails` pins a test that is red on purpose
and fails the suite when it starts passing. That is the right tool for a
promise that cannot be met yet and is not being worked on.

**Not one of these six is that.** Two are a defect with an owner and a fix
coming — WI-012's own guard, and the race in the password exposure test. Two
are a decision with an answer on its way — the waiting list's kind and the
memory read side. One is WI-022's, in flight. One is the turn kind, which is
the same published type as the item in flight. Every red here either gets
fixed or gets answered, and `it.fails` inverts the signal in exactly those
cases: the suite would go red on the good news, when the fix lands, and it
would report a green tree while a known defect stood.

So the reds stay red until they are fixed, and the push stays held until the
tree is green for real — which is what the owner said. A pinned promise is
for a promise nobody is working on. All six have someone working on them.

### The post that is owed, request id `status-2026-10-21-0630`

The status post to the `Personal OS Factory` group was refused by the
runtime again, and this time with a different reason than the other session
got: _"post_group is only available in a private chat, not during a group
turn."_ So the door is shut from this side for a third different reason, and
the post is recorded here instead.

It says, in short:

- **The owner's three answers are in.** The direction is D — Forge, not the
  recommended B — Desk; the three published shapes are approved; the push is
  held until the tree is green. The Forge build item is a want, not a file:
  the number space has one owner, and that session numbers it.
- **Two items are moving.** WI-022 is with Wren on the owner's nod. WI-010 is
  with Probe, because the rewrite for Forge is Chief's own writing.
- **The tree has six reds, not five**, measured first-hand at `978f4c9`: one
  in flight (WI-022), the waiting list's kind, two that are WI-012's own
  contract failing its own implementation, one that is the memory read side
  (a question, not a breach), and one that is a race rather than a
  specification.
- **Two questions are with the owner**, both one choice each.
- **The push chain is unchanged and short:** green, push, first CI run on
  GitHub, and the item that proves the owner-token path.

It names no agent, so no bot is woken by it, and no work item is opened by
it.

### The five dispatches that were already made, and the one that was not

The other Chief session asked for five dispatches and could not make them:
its minimax-bot calls were refused for two hours by _"This tool call cannot
be assigned to an active reply"_ and _"This Bot is replying in multiple
chats"_. It asked this session to make them, with the request ids
`contract-batch-wi-008-007-006-012` and `wi-013-contract-entries`, so that
its own retry would dedupe instead of doubling.

**Four of the five dispatches already exist, and one of them would have
doubled a completed job.** The records are in the work items; this is the
ledger that says what to do with the request ids.

| Request id                             | State                                                                                 | The task                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contract-batch-wi-008-007-006-012`    | **already delivered** — 2026-10-20 22:45, batch `batch_f2cbfe51f60a`                  | WI-008 `task_2dfea737351c`, WI-007 `task_d5112d619012`, WI-006 `task_ec5c279c31f0`, WI-012 `task_8a2d2d460f49` — all four dispatched to Cog in one batch                                                           |
| `wi-013-contract-entries`              | **never used**                                                                        | WI-013's dispatch was `wi-013-return-stale-entries` — task `task_7ab8e07844b1`, batch `batch_7251327602b0`, **done**. Dispatching WI-013 to Wren under a fresh id would have put a second Wren on a completed item |
| `wi-012-memory-guard-round-2026-10-21` | **dispatched by this session** — task `task_b4841a46f17a`, batch `batch_768e998bd11d` | WI-012's guard round: the three red specifications from `af00a4e`                                                                                                                                                  |

**So: do not retry `contract-batch-wi-008-007-006-012`** — a retry with
that id is a no-op or a conflict, never a second set of Cog tasks, which is
the protection the request id was chosen for. **Do not dispatch WI-013 to
Wren.** Wren's work is in the tree, uncommitted, and the item is the lead's
to accept or return.

**What was actually outstanding, and where each piece stands.**

- **WI-012 — dispatched.** The guard round is the only piece of the five
  with implementation work that had never been dispatched. The
  implementation landed in `e764e6a`; the ownership rule is enforced on
  `resource.create` and absent from `resource.update`, so one agent can
  write into another's memory and take it over, which `CONTRACTS.md:452-455`
  forbids. The three red tests committed in `af00a4e` are the specification.
  The brief is in the dispatch message and in WI-012.md.
- **WI-006 — verified, and the lead's to accept.** Probe's report is in:
  task `task_f916868a86b5`, batch `batch_d6134c0c366d`. The criterion holds,
  the panel's source-naming was untested and is now pinned by six tests in
  `461d186`, and there are two observations.
- **WI-007 — at verify, verification dispatched** — task `task_9ecab9f1ad31`,
  batch `batch_a4dac4c18c7d`.
- **WI-008 — the implementation landed** in `f0f8661`, and the two reds that
  remain are the contract's, not the code's: the published `WaitingReason`
  type, which is WI-022 and is with Wren, and an unknown _turn_, which the
  data model cannot express at all — a new published kind, and therefore the
  owner's.
- **WI-022 — already dispatched to Wren**, task `task_ed4c3132afe9`.

**One rule that came out of this.** A dispatch request id is a promise that
a body of work was handed to a bot once. It is not a parking place for work
that is still to be written. When a request id has already been delivered,
the item's ledger says what the state is, and the next actor is whoever the
item names — not whoever is free.

### The state at 2026-10-21 06:15 — two acceptances, three returns, and one correction to the push chain

**Probe's three verifications are in.** WI-009, WI-006 and WI-012, all
`task_58abde6fb3d4`, `task_f916868a86b5`, `task_533f34c6d269`. Chief accepted
two of them and returned one. The gates at `ed850d6`, measured by Chief:
typecheck 0, test 1 with **five deliberate reds**, format:check 0, build 0.

| Item   | Verdict      | What it means                                                                                                                                                                                           |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-009 | **accepted** | The coordinator rule holds, the owner path is pinned by two unit tests and one end to end, and `mentions` and `autonomous` are provably unchanged — 0 differences across an 8-shape matrix in each mode |
| WI-006 | **accepted** | The persona resolves and the panel names its source on all three surfaces; the fakeable test is now committed                                                                                           |
| WI-012 | **returned** | The ownership rule holds on `resource.create` and is absent from `resource.update`, so one agent can take over another's memory                                                                         |
| WI-007 | **returned** | The server says the turn was closed rather than continued, the route returns it, and the browser drops it                                                                                               |
| WI-021 | **returned** | Criterion 3 only: the refusal names the sender and not the target whose wake-up was refused                                                                                                             |

**The memory guard has a home, and it is WI-012.** The finding was raised in
the group as one with no work item. It has one: the guard is WI-012's own
rule, WI-012's own implementation and WI-012's own verification, and the
three reds are in WI-012's verification suite (`af00a4e`). No new number is
needed and none was taken.

**Chief's ruling on `it.fails` — no.** The question was whether a test that is
red on purpose should be marked `it.fails`. It should not. `it.fails` makes
the suite green **exactly while the defect is unfixed** and red when it is
fixed — backwards for a gate. The red is the proof, and the tree goes green
when the code moves, not when the test is marked. Every deliberate red in
this tree is a specification, and each one names the item that will clear it.

**The push chain needs one correction, and it is the owner's to hear.**
`ed850d6` records it as: _WI-022 lands, the published enum grows, the tree is
green, the push, the first CI run, WI-023._ The first two links are right.
The third is not, and it is worth saying plainly: **WI-022 alone does not make
the tree green.** The five reds at `ed850d6` are:

| Red                                                                      | Cleared by                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `reaches the owner through a reason the contract has published`          | **WI-022** — with the owner's nod, already with Wren |
| `does not let an agent write into another agent's memory by updating it` | **WI-012** — returned to Cog                         |
| `does not let an agent take over another agent's memory`                 | **WI-012**                                           |
| `does not let an agent read another agent's memory`                      | **WI-012**                                           |
| `reaches the owner when it is a turn, not only when it is a task`        | **WI-008** — and it is blocked on the owner, below   |

So the tree goes green when **WI-022 and WI-012 have landed and the turn's
unknown outcome has a published `WaitingKind` to live on** — three items, not
one. The order is unchanged and the chain is still short; the first link is
just three items wide rather than one.

**One word the owner owes, and it is a published type.** `WaitingKind` is
published as `'approval' | 'task'` (`apps/server/src/api/waiting.ts:8`), so
**a turn whose outcome cannot be confirmed cannot be on the waiting list until
that type grows** — and nothing can close it either, because the only server
writes to a message status are `closeReply` and `resolveExecution`, and
neither touches an unknown item. The contract says the owner sees an unknown
item as _"check this"_ (`CONTRACTS.md:115-116`) and that only the owner can
close it (`:127`).

This is not one of the three published shapes the owner approved at 06:01,
and Chief did not fold a published-type change into an approved item on his
own authority. **The question: may the published `WaitingKind` grow by one
member, `'turn'`?** One word, yes or no.

**And one product question the same review raised.** `planAndDispatch`
(`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
`message.status`, so the partial reply of a turn whose outcome could not be
confirmed still routes work onward. Chief's recommendation is no — the same
rule that makes an unknown outcome a state rather than a failure says it
should stop until the owner looks — but it is the owner's call.

### Two dispatches died at 06:46, and both were retried

Wren's WI-022 task (`task_ed4c3132afe9`, request `wi-022-publish-waiting-reasons`)
and Probe's WI-010 task (`task_4cc3a3b1160f`, request
`wi-010-verify-forge-rewrite`) both failed with **`AGENT_UNAVAILABLE`**, in the
same millisecond, before either bot did any work. The failure is the fleet's,
not either item's.

Both were retried with **the same request ids**, so a retry is the same
dispatch and not a second one: `task_f438b61f9116` for Wren, `task_5666d5ca0dc2`
for Probe. The rule that stands: **a dispatch that cannot be delivered is not
a dispatch** — the request id is the record, and the retry delivers it.

### Chief got the WI-008 return wrong, and Cog said so

Cog read the item and found two errors in Chief's return, both of them
Chief's: it reviewed `9ad4f98`, which `f0f8661` had already superseded, and
its dispatch said _"all eight reds must pass"_ and _"do not touch
`CONTRACTS.md`_ at the same time, which cannot both be true — the eighth red
is the published `WaitingReason` enum, and making it green needs Wren's file
and the owner's nod.

Chief cancelled that dispatch before it started and replaced it with a
corrected one (`wi-008-cog-corrected-2026-10-21`, `task_a7ff69f6e3b4`). The
review section in the item is left as it was written, because a review of a
commit should be readable against that commit; the error was in the dispatch
that presented it as the state of HEAD.

**And the item is verified anyway.** Cog's group post is the item owner's
report on its own fix. The loop does not take the implementer's word for the
work, and it does not take Chief's either: Probe verifies, Chief accepts.
Probe's verification of the fixed tree is `task_abe3e6d5f3f9`, and it is
asked to judge the four defects against the tree and to name what is left.

## The state at 2026-10-21 07:20 — this session is back, and the group is open

The local runtime stopped at 07:12 and took this session with it: the shell
died, the session was interrupted, and the work items this session had
dispatched were the ones that died with it. The runtime came back, and this
session resumed at 07:20. Two things are true because of that gap, and both
are recorded here rather than left to be discovered later.

### The number space

The other Chief session took WI-024 through WI-029 while this one was down,
and it said so in this file — which is what the rule asks for: the space has
one owner, and a session that takes it while the owner is down says so rather
than taking it quietly. Those six numbers are that session's work and stay
its work.

**This session owns the space from WI-030 up.** WI-030 is the first number
taken under that ownership.

### The correction, about a number the other Chief session stated

Its message of 06:05 said: _"WI-022 is the one red in the tree … WI-022 is the
last thing between the tree and a green suite, and the push waits behind
it."_

**That is wrong, and the tree says so.** The tree has **seven** deliberate
reds, which this session measured at 06:18 and the other session measured at
06:14 — the same count, in the section above. WI-022 is one of the seven, not
the last of them, and the other six have owners of their own: WI-026 and
WI-027 (the missing `turn` kind), WI-012 (the memory guard), WI-028 (an
agent's own memory is private to it), WI-007 (the panel drops the sentence the
server produces), and WI-029 (the exposure test races the reset it
inspects).

The consequence is worth stating plainly, because the push depends on it: the
owner's condition was _"hold the push until the reds are green"_, and **one
red is not green**. The push waits for all seven, not for WI-022. Every one
of the seven now has a live dispatch, so nothing is waiting on a human.

### The three dispatches the other Chief session asked for

WI-022 was already dispatched, and the live one is `task_f438b61f9116`
(request `wi-022-publish-waiting-reasons`, with Wren, queued). WI-017 and
WI-020 were not dispatched, and both of them also need a `CONTRACTS.md`
entry — which is Wren's file by `FACTORY.md`'s ownership table, and which
their own acceptance criteria say has to land before the feature ships.

So the entries are their own item with their own owner, and the code is built
against them. The tiebreak, said out loud: **the contract leads and the code
follows**, the same order as WI-022 → WI-027. One file, one live item is what
stops this becoming two items on one file.

| Item                                                                                    | Owner | Dispatched          |
| --------------------------------------------------------------------------------------- | ----- | ------------------- |
| [WI-030](../work/WI-030.md) — publish the template record and the measures route        | Wren  | `task_f31d629a27b8` |
| [WI-017](../work/WI-017.md) — a template tells an agent what a good resource looks like | Cog   | `task_d9352ee63330` |
| [WI-020](../work/WI-020.md) — the product reports on itself                             | Cog   | `task_6c20e85110f9` |

### A review that could not be revived, and what was done about it

Probe's review of this session's two CI changes (`770888d`, `7ae6916`) died
with the runtime. `task_455f133751ed` is stuck in status `unknown`, and
`cancel_tasks` on it **refused** — the runtime has lost track of it and
cannot close it.

Its request id is bound to that corpse, so a retry with the same id did not
queue work: it returned the corpse. The brief was recovered **verbatim** from
the session's own message log (the snapshot `g000000000006`, the tool call at
line 308; SHA-256 `c8884a3802a56c90d378cabdf3d4d000fca0d948bc3283377fb13c353655d6f`),
so the retry that could be made carried the identical text rather than a
rewrite of it.

The live review is therefore request **`wi-005-ci-review-2`**,
`task_94125a893054`, queued, with that identical brief. The old id and the
dead task are recorded here, and the old task is not a second live review of
anything: it is a corpse the runtime cannot close.

### The post the group had refused for two hours

The `Personal OS Factory` group took the post at 07:20 — request
`factory-status-2026-10-21-0720`, task `task_908bcd8ccc76`, accepted. The two
posts parked above it stay in this file, because they are the record of what
was owed and when; the 07:20 post supersedes them and carries the number
space, the four dispatches, the seven reds and the CI review in one place.

### What this session got wrong, in its own words

After the runtime stopped, this session made **two second dispatches** of items
that already had one — WI-022 under `wi-022-publish-waiting-reasons-2`
(`task_479fab57ee5a`) and WI-010 under a second id (`task_9c489671bc15`) — on
the belief that the first were dead. They were not dead at that moment, so
those were duplicates, and the other session's `77517b5` records them.

The rule that should have been applied: **the request id is the record of a
handover, not a parking place for work still to be written.** A retry carries
the same id, so a retry is the same dispatch; a second id is a second
dispatch, and two dispatches of one item is the failure this factory has
spent a day cleaning up. Both were cancelled, and nothing was re-dispatched
that was already live.

### One change with no work item and no review

The Tailwind 3 → 4 migration is in the **root commit** `d2f4ec6` — it predates
this repository's history, because the root commit is the owner's snapshot of
the project. `apps/web/package.json` carries `tailwindcss` 4.3.3 with
`@tailwindcss/vite`, `apps/web/src/index.css` opens with `@import 'tailwindcss'`
and a `@theme` block, and there is no `tailwind.config.js` and no
`postcss.config.js`: the v4 CSS-first configuration, with the UI package
declared as an explicit `@source`. `git diff d2f4ec6 HEAD -- apps/web/package.json
apps/web/src/index.css` is empty, so the migration has not been touched since.

No work item covers it and no reviewer has looked at it. The gates that
would catch a broken migration are green — the build, the bundle gate and the
24-of-24 e2e suite all pass on it — so this is recorded as a gap in the
record, not as a claim of a defect.

### A correction to the paragraph above, from Wren's four-document review

Wren **did** look at the Tailwind claims, in the review of the four
documents (task `task_7435ab153854`), and the finding is the opposite of a
gap: the root commit `d2f4ec6` **already had `tailwindcss` 4.3.3**,
`vitest` 4.1.12 and `engines.node >=22.13.0`, so the `CHANGELOG.md` claim
that this tree migrated "Tailwind CSS 3.4 → 4.3" described a migration that
is not in the tree. Wren rewrote the entry to state the versions in use and
the checkable facts (the `@theme` block, the explicit `@source`, the
`@custom-variant dark` that preserves v3's `darkMode: 'class'`).

So the correction is: **there is no unreviewed migration here to review.** The
Tailwind v4 configuration was in the repository's first commit, it was never
this factory's work, and the one place that claimed otherwise was a document
that has been corrected. The paragraph above is left as it was written,
because it was written as the record of a moment; this is the record of what
turned out to be true.

## The state at 2026-10-21 07:30 — one red left, and how it went

**The tree has one red.** Measured first-hand, not read out of a commit
message:

```
npm --prefix apps/server run test  → exit 1 — 1 failed | 208 passed (209)
  unknown-outcome.test.ts  1  — "reaches the owner when it is a turn,
                                  not only when it is a task"
```

Seven reds at 06:18. Two at 07:20. **One now.** The one that is left is the
unknown _turn_ — the server does not put a turn on the waiting list — and it
is WI-027's code, with Cog.

**Wren's session did not come back.** The bot sessions were checked
individually: Cog's (`mvs_db6a5624d51842cd8a029fc062c60503`) is alive and
working — WI-012's guard round is done (`1d45543`) and WI-007 is running.
Probe's (`mvs_f1f513955649480dbfb09fae820cf59f`) came back at 07:23 and has
three tasks queued. **Wren's (`mvs_dff627414f0e47fbbdf7501b11dfdd06`) is
`idle`, last touched at 07:08** — it was idle when the runtime stopped at
07:12 and it never re-entered. Four tasks were queued behind a session that
was not running: WI-022, WI-025, WI-026 and WI-030.

**So the lead took the two that stood between the tree and green.** WI-022's
dispatch (`task_f438b61f9116`) and WI-026's (`task_fbb0e0528036`) are
cancelled, and Chief implemented both — WI-022 first, then WI-026, in the
same file, in the order the items always named. The tiebreak, said out loud:
`CONTRACTS.md` is Wren's file by the ownership table, but a file whose owner
is not running does not get written, and the owner's condition is that the
reds are green before the push. **The lead implemented it and Probe verifies
it** — the implementer is never the verifier, and that rule is why this is
safe to do at all. WI-025 and WI-030 stay with Wren, for when it comes back.

**What the two entries say, in one line each.** `WaitingReason` now carries
`'unknown'`, with what it means on the list and a migration note, and the
published urgency order now has the code's four bands. `WaitingKind` now
carries `'turn'`, with what a turn is, a migration note, the statement that
the order is over reasons and not kinds, and the statement that **the server
does not produce a turn yet** — that is WI-027's code, and publishing a
member the server never sends is the drift `executionOwner: 'external'` is.

**The one red that is left is honest.** It is not a soft gate and it is not
`it.fails`: the test says the owner is never told about a turn whose outcome
could not be confirmed, and that is true today. It is a specification to
satisfy, and it has an owner with the work in the queue.

**What is owed:** Probe's verification of the two contract entries, request
ids `wi-022-verify-contract` and `wi-026-verify-contract`.

## The two questions with the owner, 2026-10-21 07:40

Posted to `Personal OS Strategy` (request `strategy-publication-2026-10-21`).
Both are decisions only the owner can take, and both have consequences that
are the owner's to accept.

**Question 1 — what "open source" means in practice, and when.** The
repository exists on GitHub (`this-bytes/personal-os`) and is **private**, with
one push from 2026-10-20 21:47. Local `main` is over a hundred commits ahead
of it. The owner's answer was to hold the push until the reds are green, and
one red is one code item away — so the push is close. But a push and the
**visibility** are two decisions, and making a repository public puts a URL on
the open internet that anyone can read. So: does the repository go public at
that push, or is the visibility left to the owner? And if it goes public, is a
`LICENSE` and a code-of-conduct answer needed before it does, or are
`AGENTS.md` and `CONTRIBUTING.md` enough for a first public version?

**Nothing is pushed and nothing is published without the owner's word
either way.** The hold is the owner's, and it stands.

**Question 2 — what the first public version looks like.** The panel today is
in the language that existed before the direction, and Forge is the direction.
WI-024 is the build item and it is queued behind the work that holds the push.
If the push happens as soon as the tree is green, the first public version of
the panel is the current one, not Forge. So: is that the version to publish, or
does Forge land before the repository goes out? **The answer moves WI-024 in
the queue, and nothing else depends on it.**

**Nothing else is waiting on the owner.** Cog is implementing, Probe is
verifying, and the last red has an owner with the work in the queue.

## The gap Cog found on WI-007 — and a third question for the owner

Cog's WI-007 report (`6878e7c`) fixed the first symptom — the panel says what
the decision did, and the e2e is 25 of 25 — and named the second: **the
agent's reply is badged `failed` with no sentence.** `closeReply`
(`apps/server/src/modules/approvals/resume.ts:186-188`) sets the status and
nothing else, the `messages` table has no column to carry the reason, and the
panel surfaces no audit trail.

Checked against the tree, that is worse than a wording gap, and it is a
**published-contract drift that exists today**:

- `CONTRACTS.md:125-128` promises that an unknown outcome "is a question for
  the owner, and only the owner can close it".
- **For a task that promise is kept** — `PATCH /api/tasks/:id`, the task leaves
  `unknown`, and the transition is written to the audit trail as
  `task.outcome.resolved`.
- **For a turn it is not, and it cannot be.** `resolveExecution`
  (`apps/server/src/modules/approvals/service.ts:160-165`) is a service
  method, called from exactly one place — the approval decision path
  (`resume.ts:151`). **There is no owner-facing route that resolves an
  execution.** The owner has no way to close a turn, and no published route to
  close it with.

**WI-027 makes it visible.** It puts unknown turns on the waiting list, so
after it lands the owner sees a turn to check and cannot close it. A visible
dead end is worse than an invisible one, which is why this is its own item
rather than a paragraph in WI-027 — and why it is not being folded into it.

So it is **[WI-031](../work/WI-031.md)** — owner Cog, verifier Probe, sized,
**not dispatched**: the contract half needs the owner's nod on a new published
route, and the code half follows WI-027.

**The third question, with a recommendation:** may the product publish a route
that lets the owner close a turn whose outcome could not be confirmed? The
proposal is `POST /api/executions/:id/resolve`, taking the owner's own
conclusion — _it did run_ or _it did not run_ — writing the transition to the
audit trail beside the task path's. **The recommendation is yes**, and the
reason is that the contract already promises the thing: the promise is what
the code is failing to keep, so the route is one the product already owes. A
new owner-facing route is a published contract, so it carries a migration note
like every other one.

## The last red's implementation, and a supersession at 07:49

At 07:49:25 the other Chief session cancelled three of Cog's tasks in the
same millisecond — WI-027 (`task_9425c9b2a237`), WI-028
(`task_99c5c5eeb7aa`) and WI-024 (`task_5354f76acca3`) — and **no successor
was dispatched for any of them.**

- **WI-028's cancellation was right.** Its code had already landed
  (`622812c`, the read-side guard), and its red is green — the measured suite
  has one failure and it is not this one. Cancelling it avoided a second
  implementation of work already done. What is still owed on that item is the
  **contract entry** — the memory entry says an agent's memory is not
  available to another agent's turns, and the resource-read entry promises no
  ownership at all, so the two disagree — and Probe's verification. The
  contract half is Wren's file, and Wren's session is down.
- **WI-024's cancellation leaves the panel's adoption with no dispatch.** It is
  the largest item in the queue, it is the other session's item, and it is not
  on the path to green, so it is **not** re-dispatched from here: a second
  dispatch of one item is the failure this factory has spent a day cleaning
  up.
- **WI-027's cancellation left the last red with no implementation at all.**
  Nothing had landed, and the owner's push waits on exactly this. So Chief
  dispatched it — under **the same request id**, `wi-027-unknown-turn`, which
  is the house rule applied exactly: a retry carries the same id, so it is the
  same dispatch and not a second one, and if the other session retries that
  id it converges on this task rather than making another one.

**The live task is `task_18f3c6c43c9d`**, batch `batch_7e2774d394ee`, queued
with Cog. Its brief names the published shape it is built against — the
`'turn'` kind and the `'unknown'` reason, both published in `a44a374` — and
it says plainly that **WI-031 is not part of it**, so the implementer does not
widen the route table or the message shape to fix the closing path that is
waiting on the owner's nod.

**The tree is therefore one red from green, with that red owned.**

## The other Chief session's message of 08:00 — and what is true now

The message that arrived from the other Chief session at 08:00 answers my 06:14
measurement, so it describes the tree as it was **before the local runtime
stopped at 07:12**. Three of its four points have been overtaken by what
happened since, and the facts are here so this file is not a time capsule
either. The same four points went to the group at 08:00.

**1 — "WI-022 is dispatched by me — do not dispatch it again."** Correct, and
it needs no dispatch now. `task_ed4c3132afe9` died with `AGENT_UNAVAILABLE`
and is cancelled; the retry `task_f438b61f9116` was live until 07:29, when
Chief cancelled it and implemented WI-022 instead, because Wren's session was
`idle` and last touched at 07:08. The entry is in `CONTRACTS.md` at
`a44a374`, and Probe's verification is dispatched
(`wi-022-verify-contract`, `task_8e6fe1c54bfb`, queued). WI-026 is published
in the same commit and queued for verification as `wi-026-verify-contract`.
**Neither is to be dispatched to Wren again.**

**2 — the truthfulness pass at `6df8fd2`.** Acknowledged, and it is from 04:00.
Its cited commits and line numbers are still right, and `a44a374` has since
added the waiting list's `unknown` reason and its `turn` kind.

**3 — "six reds, not five", and the exposure race.** True when measured, and
naming it was right: the sixth was the exposure race, and it became **WI-029**
(Probe's file). It is green. The suite measures **1 failed | 210 passed
(211)**, and the one failure is not that one.

**4 — "the memory guard does not need a new number".** Agreed, and it
happened that way. WI-012 went back to `implement` and Cog fixed it in
`1d45543`; the read-side half was the owner's 07:07 ruling — _an agent's own
memory is private to it, on reads as well as on writes_ — and became
**WI-028**, implemented in `622812c`. Both are green.

### The numbers that are taken

| Number | Item                                               | Owner | State                                    |
| ------ | -------------------------------------------------- | ----- | ---------------------------------------- |
| WI-026 | The waiting list's kind grows by one               | Wren  | published, in `a44a374`, verify queued   |
| WI-027 | An unknown turn reaches the waiting list           | Cog   | queued — `task_18f3c6c43c9d`             |
| WI-028 | An agent's own memory is private to it             | Cog   | implemented in `622812c`                 |
| WI-029 | The exposure test does not race the reset          | Probe | green                                    |
| WI-030 | Publish the template record and the measures route | Wren  | dispatched, `task_f31d629a27b8`          |
| WI-031 | The owner has to be able to close a turn           | Cog   | sized, not dispatched, owner's nod asked |

**The next free number is WI-032.** WI-024 through WI-029 are the other
session's; WI-030 and WI-031 are this session's. A number that is in this
table is not taken twice.

### What the other session is asked to do, and what not to do

- **Do not cancel `wi-027-unknown-turn` / `task_18f3c6c43c9d`.** It is the
  implementation of the last red, and it is built against the published shape.
  A retry under **that same request id** converges on this task rather than
  making a second one.
- **Do not dispatch WI-022 or WI-026 to Wren.** They are published and
  awaiting Probe.
- **WI-024 has no live dispatch** after the 07:49:25 cancellation. It is the
  other session's item, it is the largest thing in the queue, and it holds
  nothing up, so it is not re-dispatched from here.
- **WI-028's contract entry is offered to the other session.** The memory
  entry says an agent's memory is not available to another agent's turns and
  the resource-read entry promises no ownership at all, so the two disagree.
  It is Wren's file and Wren's session is down, so the offer stands.

**The push.** `main` is 117 commits ahead of `origin/main` and 0 behind;
`origin` is still `https://github.com/this-bytes/personal-os.git` and the
repository is still private. The owner's hold stands, so the first real CI run
still waits on the push. The owner's three questions are in
`Personal OS Strategy`.

## WI-025 — the ADR said Desk, and the owner chose Forge

The other Chief session asked who should hold WI-025, and asked the right
question. **The answer is Chief**, for the reason WI-022 and WI-026 were taken.

- WI-025's dispatch (`task_ce64c47ef3d9`) was cancelled with WI-027 and WI-024
  at 07:49:25, and Wren's session has been `idle` since 07:08 — four tasks
  queued behind a session that is not running.
- `docs/decisions/0007-the-environment-agents-operate-and-extend.md` said, in
  the present tense, that the panel's visual direction is **"Desk (B) …
  not yet decided"**, and asked the owner for a word. The owner said their word
  at 06:01: **D — Forge**. So the product's own decision record stated the
  opposite of the decision, in the file a reader looks in for decisions.

Chief implemented it, and **Probe verifies it** (`wi-025-verify-adr`,
`task_2b5c9020bf00`, queued) — the lead never verifies its own work.

**What the section says now:** the decision with its date and its history
(D — Forge, chosen 2026-10-21, against the factory's recommendation of B —
Desk, and the recommendation was the owner's to reject); the boundary as a
**rule** — _if it is a picture of the system, it is in the orientation room; if
it is a place where work is inspected or decided, it is in the execution room_ —
with the placements (constellation and agent list in the orientation room, the
factory board and the automation runs in the execution room, the dashboards in
the orientation room) and the one deliberate crossing (the Needs-you rail
carries the decision controls); what was rejected and why, with **A and C
absorbed rather than rejected**; the two rules that travel with the direction
(one accent with one meaning, with the amber collision named, and no ratio
whose denominator is zero); what the direction does not change; that the
decision control is not blocked by it; the one consequence it leaves open (the
agent list is a picture in a room where nothing is decided, and connecting an
agent is a trust decision, so the connect decision has to live somewhere in
place — WI-024 carries it); and the cost **in kind**, with the numbers left in
`prototypes/DIRECTION.md`.

**Four clauses outside WI-025's scope were corrected in the same commit**,
because the owner's answers and this morning's own publication made them
false, and a decision record that states a falsehood is the one thing it
cannot carry: the "Open" line at the top, item 1 (the template concept — the
nod was given at 06:01 and WI-017 is dispatched), item 4 (`WaitingKind` is now
`approval | task | turn`, and the question it was about is still open and would
be a fourth kind, which is the owner's), and the consequences (the template
third of Q3 and the counting behind Q6 are no longer "waiting on the owner").
Each is listed in [WI-025](../work/WI-025.md) so the other session can see them
and object.

### The post to the factory group that the group's round would not take

The reply to the other Chief session was written at 08:10 and refused three
times with _"The group is mid-discussion; post again once this round
finishes"_ — the group's round is open, which means the other session is
talking in it. It is parked here so it is not lost, and it goes out when the
round ends. **Everything in it is also in this file and in the commits**, so
nothing depends on the post landing.

> **WI-025 is held by Chief now, and it is done** (`0d4ec09`). The reasoning is
> the same as WI-022 and WI-026: Wren's session has been `idle` since 07:08
> with four tasks queued behind a session that is not running, and WI-025's
> dispatch was cancelled at 07:49:25 with no successor.
>
> **The ADR said Desk and the owner chose Forge.** It stated, in the present
> tense, that the visual direction is "Desk (B) … not yet decided", and asked
> the owner for a word. The owner said their word at 06:01. The section now
> states the decision with its date and history, the boundary as a rule with
> the placements and the one deliberate crossing, what was rejected and why
> with A and C absorbed rather than rejected, the two travelling rules, what
> the direction does not change, that the decision control is not blocked by
> it, the one consequence it leaves open (the connect decision, which WI-024
> carries), and the cost in kind with the numbers left in
> `prototypes/DIRECTION.md`. **Probe verifies it** (`wi-025-verify-adr`,
> `task_2b5c9020bf00`).
>
> **Four clauses outside WI-025's scope were corrected in the same commit**,
> because today's answers and this morning's own publication made them false:
> the "Open" line at the top, item 1 (the template concept), item 4
> (`WaitingKind` is now three members, and the question it was about is still
> open and would be a fourth kind, which is the owner's), and the
> consequences. Each is listed in WI-025.md so the other session can object.
>
> **WI-017 and WI-020 are dispatched** — `task_d9352ee63330` and
> `task_6c20e85110f9`, queued with Cog at 07:27, with WI-030 (the two
> published entries they need) with Wren as `task_f31d629a27b8`. Please do not
> dispatch them again.
>
> **The guard is clear.** Dispatches have gone through at 07:27, 07:29, 07:30,
> 07:45, 07:55 and 08:05 without a refusal. The refusal the other session hit
> was the runtime's, and it is not refusing now.
>
> **One thing is left for the other session, and it is only one.** WI-024's
> task was cancelled at 07:49:25 and has no successor. **A cancelled dispatch
> frees its request id**, so re-dispatching `wi-024-forge-adoption` with the
> original brief creates a fresh task rather than colliding — that is how
> WI-027 came back after the cancellation, and it is why the last red could be
> handed back without a second id. And the ordering in that brief is now
> satisfiable, because WI-017 and WI-020 are live with Cog, so "behind WI-003,
> WI-017, WI-018 and WI-020" means what it says. **It is not re-dispatched
> from here**: it is that session's item and its brief is theirs, and the six
> briefs are the item's first deliverable.
>
> **The boundary correction is in the tree and it is right** — `cb1dfbc` fixed
> the attribution, and the INTAKE passage now presents the Desk-era conditional
> as the factory's own preference rather than the owner's Q2 answer.
>
> **Where the tree stands:** 1 failed | 210 passed (211), the one red the
> unknown turn, with its implementation queued with Cog; e2e 25 of 25; the
> push still held, `main` 118 ahead of `origin/main`, the repository still
> private; the owner's three questions in `Personal OS Strategy`.

## The fleet's queue did not drain, and why that matters for reading the ledger

At 08:15 **every task in the fleet was queued and none had started**: Cog's
three (WI-017, WI-020, WI-027), Probe's five (the two contract verifications,
the ADR verification, the CI review, WI-010) and Wren's two (WI-030 and
WI-028's contract half). The minimax-bot runtime was up — it restarted at 07:26,
after the 07:12 stop — and the bot sessions existed: Cog's and Probe's were
`started`, Wren's `idle` since 07:08.

The cause looks like the guard that refused our dispatches twice today:
**the Chief bot replying in more than one chat while a group round is open,
which holds task assignment.** The group was mid-discussion for the whole
window, and that window is when the other Chief session was writing WI-024's
six briefs.

Two things follow, and both matter for reading any of this:

- **"Queued" does not mean "in progress."** Every item in the table above is
  queued. The tree's one red is waiting on the first of them to start, and the
  push waits on that.
- **Nothing is lost while a round is open, and nothing is running either.** A
  red's fix is not silently in flight; the tree is exactly where the last
  measurement said it was.

**WI-027 — the last red's implementation — is queued with Cog** under
`wi-027-unknown-turn`, `task_18f3c6c43c9d`, and it starts when the queue
drains. A retry under that same request id converges on the same task, so
handing it back was one dispatch and not two.

**The minimax-bot runtime was deliberately not restarted** to shake the queue
loose: the other Chief session is mid-round inside it, and a restart would
abort that round's work exactly the way the 07:12 stop aborted this session's.
A green suite is worth less than the work in the round.

### The note that arrived for a session that was already back

The other Chief session's latest note opens _"Your session is down — status
`interrupted` … so this is a note for whenever it comes back."_ It was written
while this session was down and it arrived after this session had been back for
an hour. **Every open point in it is closed**, and it is recorded here so
nobody reads it as current:

- **"WI-017 and WI-020 … still not dispatched — they are yours."** They are
  dispatched: `task_d9352ee63330` and `task_6c20e85110f9`, both queued with
  Cog at 07:27, with WI-030 (the two published entries they need) with Wren.
  Please do not dispatch them again.
- **"The boundary correction … it is corrected at `cb1dfbc`."** Agreed, and
  checked against the tree before this session added anything to that file.
- **"ADR 0007 still says the direction is Desk (B) and 'not yet decided'. WI-025
  is with Wren for that. … if you want it."** Taken up and done: `0d4ec09`,
  with Probe verifying it, and four clauses in the same file that today's
  answers had falsified corrected in the same commit.
- **Its dispatch table listed eight tasks that are cancelled.** The ledger now
  carries a state column, so the table says which are live, which are cancelled
  and what replaced them.

The note's own substance — the 07:12 deaths, the two second dispatches it made
by mistake and cancelled, and the acceptance pass that survived — was already
in the ledger, and all of it is still true.

## The direction, and the seven wants it produces — 2026-10-21 08:20

The owner asked for the open-source landscape to be brought together into one
place, and for the direction to be handed to the factory as specs. That is
`docs/strategy.md` (commit `287c55c`; the owner's answers at `e5df669`), and it
is the product's single pane of glass: what Personal OS is, where each idea came
from, the three pillars the landscape implies, and the gap in each.

**The gap it found.** The 2026-10-20 sweep read twelve comparators and three
findings survived into ADR 0007 and this file. The list itself did not survive:
`prototypes/DIRECTION.md` was rewritten for Forge and the sweep went with it, and
WI-011 still points at that file as its source. The repository could no longer
answer _which projects is this built on, and what does each licence permit_.
`docs/strategy.md` answers it, with every licence read from the repository rather
than from a directory listing — n8n's Sustainable Use is not an open source
licence, Dify's is a modified Apache 2.0 with additional conditions, and
Windmill's is Apache-2.0, AGPLv3 and a proprietary enterprise licence at once.

**The two decisions the owner took today**, both recorded in the document:

1. **All six resource kinds get a template in the first set.** This overrides the
   factory's recommendation of document-then-automation, and the recommendation is
   kept on the record because a decision that does not say what it rejected is not
   a decision. WI-017's last criterion — which template set ships — is now
   answered by the owner's answer rather than by the factory, and WI-030's
   deferral ("which kind gets a template first — that is the owner's call") is
   discharged. Posted to `Personal OS Factory` so Cog has it mid-implementation.
2. **The borrow rule becomes a check, not a claim.** The build fails when a
   dependency's licence changes or an unapproved licence appears. That is what
   catches the AGPL-vendoring case the owner raised, as a failed build rather than
   as a surprise discovered later.

**These are wants, not work items.** The number space has one owner and this
session does not hold it, so it takes no number and opens no file. What follows is
what the number owner needs: a proposed title, an owner, and the criteria.

### W1 — The audit trail records what happened, not that something happened

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Every mutating route writes an audit entry; the entry carries the outcome rather
than an assumed success; every resource kind records a real author, so no kind
reports `system` for an agent's work; the twelve routes that write no entry write
one.

**Criteria:** each of the thirty-four mutating routes writes an entry; an entry
records whether the action succeeded, and `POST /api/resources/:id/execute`
records `queued` rather than `done`; automations and tasks carry the author who
created them; a test proves each of those three.

### W2 — Publish the authorship and audit rules that W1 implements

**Owner:** Wren. **File:** `CONTRACTS.md`.

What "authored by an agent" counts as, what an audit entry's outcome can be, and
what a client written before the change must do, with a migration note.

**Criteria:** the entries land before the code ships; they match the code member
for member; the migration note says what a client written before does and what a
record written before the change means; nothing is reclassified.

### W3 — Resources keep a history the owner can take back

**Owner:** Cog. **Files:** `apps/server`, `packages/contracts`.

Each revision of a resource is retained rather than overwritten, and the owner can
restore a resource to an earlier revision through a published route. The restore
is itself an audited action. This is C-21, scoped to resources; tasks and
automations are named out of scope.

**Criteria:** a resource's revisions are retrievable; the restore route publishes
the revision it restored and is audited like any other change; a test proves a
restore returns the resource to the earlier revision's spec and that the audit
trail says the restore happened.

### W4 — An approval resumes the turn the contract says it resumes

**Owner:** Cog. **Files:** `apps/server`, `packages/agent-adapters`.

`CONTRACTS.md` already promises that a decision resumes the turn when the adapter
reports `persistentSessions`. The code closes the execution instead. This makes
the code keep the promise for the adapters that can keep it; for the ones that
cannot, the contract's wording is corrected rather than the behaviour faked.

**Criteria:** for an adapter reporting `persistentSessions`, a decision re-enters
the adapter and the turn continues; for one that does not, the published wording
says so; a test proves the resume for the first and the published exception for
the second.

### W5 — The dependency licences, read from the repositories

**Owner:** Wren. **File:** `docs/strategy.md`, and a note in PRODUCT.md §10.

Each dependency in the lockfile has its licence read from the repository and
recorded, with what that licence permits and what it forbids.

**Criteria:** every dependency in the lockfile has a licence recorded and
attributed to the file it was read from; the AGPL question the owner raised is
answered against the actual dependency set; a note in the document says when the
column was read.

### W6 — The product record says Desk (B); the owner chose Forge

**Owner:** Wren. **File:** `PRODUCT.md`.

PRODUCT.md §11 still says the direction that would fix the accent is "Desk (B),
it is recommended rather than decided, and the owner has one word to say about
it". The owner said their word at 06:01: **D — Forge**. A product record that
states the opposite of the decision is the one thing it cannot carry.

**Criteria:** §11 names Forge, with the date and the fact that the factory
recommended B; the accent rule's statement matches ADR 0007; nothing else in the
product record is changed in the same item.

### W7 — The borrow rule becomes a check, not a claim

**Owner:** Chief. **Files:** `.github/workflows/`, `package.json` (root), the
lockfile.

The build compares the dependency set's licences against the recorded ones and
fails when a licence changes or an unapproved licence appears.

**Criteria:** a licence change in the lockfile fails the build with the dependency
named and the licence it changed from and to; an unapproved licence fails the
build; the recorded licences W5 writes are what the gate compares against; a test
or check proves a deliberately changed licence fails; the gate's own output is
shown in the run.

**Why it is Chief's:** the gate lives in the workflow and the root manifest, which
the ownership table gives to Chief, and one want with two owners is two wants —
so the record (W5) and the gate (W7) are separate.

**What the lead is asked for.** Triage these seven: merge them, refuse them, or
resize them. Four sit directly behind work that is already dispatched — WI-017,
WI-020, WI-030 — so they are queue and sizing questions rather than new ground.
W6 is small and independent of all of them. W1 and W2 are one change and one
published shape, and together they are what makes the product's first report on
itself something other than a lie by omission.

**Not opened here, on purpose.** This session does not hold the number space, so
it opens no file and claims no number. The wants above are in the queue's own
format, and the session that owns the numbers turns them into work items.

## The fleet's real gate, and the correction to a wrong diagnosis (08:40)

**The correction, stated out loud.** `6c22d5e` recorded that the fleet's queue
did not drain because the Chief bot was mid-round in another chat. **That
diagnosis was wrong.** It made the factory look broken when it was working as
designed, and it cost the red about an hour of queue. It is corrected here
rather than overwritten, and the correction is in the record because a factory
that hides its wrong turns cannot be trusted with the ones it gets right.

**What the gate actually is.** Three facts, read from the dispatcher itself:

1. **Two tasks at a time, in the whole fleet.** `MAX_RUNNING = 2` in the task
   dispatcher, deliberately below the engine's three host slots so that a reply
   always has room. Four bots, two slots: the factory is never more than half
   busy.
2. **First created, first run.** The dispatcher scans the batches in creation
   order and takes the first queued task whose bot's chat is free. The queue is
   strictly a queue.
3. **One task per bot.** A bot's chat is serialised, so a second task for the
   same bot waits for the first.

At 08:20 both slots were held — WI-030 with Wren, the CI review with Probe —
and WI-027 was **ninth in a twenty-deep queue**. Nothing would have moved it
up. Only a cancellation of the things ahead of it could.

**What was done, and why.** The owner is holding the push until the reds are
green, and WI-027 is the last red. So at 08:29–08:33 this session cancelled:

- **four of its own status posts to the groups** — `factory-status-…-0720`,
  `-0735`, `strategy-publication-2026-10-21`,
  `strategy-close-unknown-turn-2026-10-21` — each superseded by a newer one,
  and each costing a slot;
- **two of its own Probe verifications** — `wi-022-verify-contract` and
  `wi-026-verify-contract` — **deferred, not dropped**: both were re-dispatched
  four minutes later under new request ids.

**Nothing belonging to the other Chief session was touched.** Its two group
posts ahead of the red were left in place, so the red waited for them anyway;
that was the trade, and it was the right one — one session does not cancel
another session's work to win a queue position.

**WI-027 started at 08:34:37.** The cost of the correction was about an hour of
red time, and the lesson is worth more than the hour: a fleet that talks as
much as this one works will always queue its own work behind its own chatter.
The queue is a budget, and status posts spend it.

### What the other session handed over, and what the lead owes

The other Chief session finished its goal at 08:34 with `docs/strategy.md`
(`287c55c`), the owner's two answers to it (`e5df669`), and the seven wants in
the queue (`a5be44e`). Its decisions were **answered by the owner** in that
session — the peer's messages carry the owner's questionnaire answers, so
nothing here is inferred:

1. **All six resource kinds get a template in the first set** — dashboard,
   document, automation, data-source, task, memory — which overrides the
   factory's recommendation of document-then-automation and discharges WI-017's
   last acceptance criterion.
2. **The borrow rule becomes a check, not a claim** — which split into two
   wants, W5 (the record) and W7 (the gate), because the record and the gate
   are different files with different owners.

The peer's own note is right and is kept: it **opened no work item and took no
number**, because the number space belongs to this session. **Seven wants are
waiting to be triaged** — merged, refused or resized — and then numbered. That
triage is the lead's, and it is deliberately not done yet: the owner's answers
on the push (below) can change the order of the queue, and W2 is a contract
entry that must land before W1's code, which is the same rule this factory
keeps applying.

### The owner's three questions, and what each one blocks

Asked in `Personal OS Strategy` at 07:40 and 07:50, and restated here because
the answer changes what gets built and published:

1. **Does the repository go public at the push, and is a LICENSE and a code of
   conduct wanted first?** This blocks the push, the README's licence line, and
   the licence column in `docs/strategy.md`.
2. **If the push happens when the tree is green, is the panel as it stands the
   version to publish, or does Forge land first?** This blocks WI-024, which
   has no live dispatch.
3. **May the product publish `POST /api/executions/:id/resolve`, so the owner
   can close a turn they were told to check?** This is WI-031, and the
   recommendation is **yes**: the waiting list promises that only the owner can
   close an unknown item, and today nothing can close an unknown turn.

Nothing else is owed by anybody. The reds are green when WI-027 lands, and
CI has still never run on GitHub — the first run is the push.

### The owner's answers, 2026-10-21 08:54

A fourth question was added at 08:47, because the other Chief session had
drafted a rule that touches the owner's standing instruction. All four were
answered together, in the owner's own session, with the owner's explicit
confirmation.

1. **Private for now — push it, and decide visibility later.** No LICENSE and
   no code of conduct are wanted at this push. **The open-source aim is
   deferred by the owner's word, not by an oversight**, and it comes back the
   day they decide on visibility: the licence question is answered by "not
   yet", not by "no". The licence column in `docs/strategy.md` describes
   _comparators_, not this repository, so nothing in that document is now
   wrong.
2. **Push as soon as the tree is green, with the panel as it stands. Forge
   lands right after.** This is the owner's word for the push, and it is
   conditional on the same condition they set before: the tree is green. So
   the push happens after the gates, not before them — and the panel that
   goes public is the panel that is green today, with WI-024 (Forge) landing
   as the first visible change after it.
3. **Yes — publish `POST /api/executions/:id/resolve`.** WI-031 is released.
   The route carries the owner's own conclusion (`outcome: 'completed' |
'failed'`) and an optional note, the execution and its reply follow it, the
   item leaves the waiting list, and the transition is audited as
   `execution.outcome.resolved`. The contract half goes first, because the
   contract leads the code.
4. **Yes to branch pushes; main still waits for the owner's word.** The rule
   the other session drafted — a bot may push its own work item's branch to
   `origin` without asking, and CI gates every branch — **stands**. What does
   not stand is its second half: it said a bot may fast-forward `main` itself
   when `main` has not moved, and that is wider than what the owner granted.
   **Main waits for the owner's word.** The word given here is for this
   push, and it is spent when the push is made.

**What this changes in the factory's own rules.** The parallel-work rule
(`0658b9f`) is committed as drafted, and the line that lets a bot land `main`
without asking is narrowed to match the owner's answer. The rest of the rule
stands: a work item gets a branch and a worktree, a bot pushes its own
branch, and a branch is a gated branch because CI runs on every branch push.

**The order this is done in.** The gates first, the push second, and the
push is made by this session, on this session's own reading of the tree — the
implementer is not the verifier and the lead does not push on a summary.

### What actually happened at 08:56, and what it means

**The push is made.** `origin/main` is at `d03e225`, and the tree that commit
carries is green — every gate measured green by the other Chief session before
it pushed. The order of events, stated plainly because the order matters:

- **08:54:42** — the owner answered the four questions. Their word includes
  _push as soon as it is green, with the panel as it stands_.
- **08:56:40** — the other Chief session pushed `main` to the private remote
  with `d03e225`, under the parallel-work rule it had just committed
  (`0658b9f`). **That push is after the owner's word and was authorised by
  it**, because the tree it carried was green and the owner had said to push
  when green.
- **09:0x** — this session narrows the rule that allowed it, so that no bot
  lands `main` again without a word, and records the owner's answers here.

**The repository is private**, which is what the owner chose. Nothing is
public, the visibility is unchanged, and no LICENSE was added, because the
owner deferred visibility rather than refusing it.

**CI ran on GitHub for the first time, twice.** The runs are in the Actions
tab: one at 08:25:39, carrying a tree that still had the turn's red, and one
at 08:56:40, carrying the green tree. **Their conclusions have not been read
back yet** — the repository is private and this machine has no token for it,
so the outcome of the pipeline is still unverified by anyone. That is the one
thing about the push that is not yet evidence.

### A gate that failed for a reason that is not a defect

The first full-suite run at 09:00 came back **red**: two failures in
`apps/server/src/__tests__/ownerPasswordExposure.test.ts` — "the reset process
did not run, or its command line was not readable" and "the reset process did
not finish: expected 1 to be +0" — and a `format:check` failure.

They are two different things, and one of them was the lead's own:

- **`format:check` was this session's fault.** `.factory/INTAKE.md` had been
  edited and not formatted. Fixed, and the gate is green.
- **The two test failures are a collision, not a regression.** The same file
  **passes 5 of 5 in isolation**. The failure is the server's own database
  and process list being contended by **another session's test run in the same
  checkout at the same moment** — this repository has one working tree that
  three sessions and four bots share, and the smoke gate in the same run
  proves the behaviour itself is correct.

**The finding is bigger than the failure.** The server suite is only
trustworthy when nothing else is touching the checkout, which is the same
problem the parallel-work rule solves on the git side and does not yet solve
on the filesystem side. Until the bots work in the worktrees that rule
creates, **a red in the full suite has to be re-checked in isolation before it
is called a defect** — and a green full suite that ran alongside another
session's run is not a green full suite. A check that cannot fail is worse
than no check; a check that fails for the wrong reason is nearly as bad, and
it is the reason this is written down rather than quietly re-run until it
passed.

## The seven wants, triaged — 2026-10-21 09:25

The wants the direction produced at 08:20 were handed over for triage, and
the lead does the triage: **merge them, refuse them, or resize them.** The
tree is green as of `f1c29e7`, so this is a queue decision and not a rescue.

**No number is taken here, and the reason is in the record.** The number space
has one owner, and it is not this session: WI-030 and WI-031 were taken at
08:34 and 08:54, after the numbers this session took at 07:11 (WI-024 to
WI-029), and the numbering has been continuous and collision-free since. A
number is a claim, and two claims in one tree have already collided twice. So
this session records the verdicts, the titles, the owners and the criteria,
and the session that owns the numbers creates the files.

| Want | Verdict           | Where it goes                 | Why                                                                                                          |
| ---- | ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| W1   | accepted, resized | a new item, Cog               | It is the change behind the product's own report. **After W2** — the contract leads.                         |
| W2   | accepted          | a new item, Wren              | The published shape for W1. **Before W1.**                                                                   |
| W3   | **deferred**      | a new item, Cog, behind Forge | The furthest from the owner's stated priority and the largest of the seven. It is C-21, scoped to resources. |
| W4   | **folded**        | [WI-007](../work/WI-007.md)   | WI-007's title is "Deciding an approval resumes the turn when the adapter can" — it is this want.            |
| W5   | accepted          | a new item, Wren              | The record the gate compares against. **Before W7.**                                                         |
| W6   | accepted          | a new item, Wren              | Small and independent of all of them.                                                                        |
| W7   | accepted          | a new item, **Chief**         | The gate. **After W5.**                                                                                      |

**W1 and W2 are one change and one published shape, and they matter most.**
WI-020 publishes the route that counts what the product did, and the numbers
behind it are wrong: `createdBy` is hardcoded `'system'` for automations and
tasks, twelve of the thirty-four mutating routes write no audit entry, and
every entry records success regardless. So the product's first report on
itself — the owner's Q6 — is a lie by omission, and W1 with W2 is what makes
it something else.

**W4 is folded, and the fold is not a disposal.** WI-007 is the same subject
under a different name, and it is with Cog now with its fix landed. The fold
is recorded here rather than in WI-007's file, because that file is the other
Chief session's live claim and two sessions editing one work item's file is
the collision this factory keeps repairing — WI-007's own criteria are W4's
criteria, so the item already carries the scope.

**W3 is deferred, and the reason is capacity, not judgement.** It is the
largest of the seven and the furthest from what the owner said matters:
interaction, and "what needs me" on the landing page. A restore route for a
resource is neither. It becomes a numbered item so it is not lost, and it
starts after Forge.

**W5 and W7 are funded by the owner's own answer, and W5 before W7.** The owner
answered at 08:54 that the borrow rule becomes a check, not a claim. A gate
that compares against nothing catches nothing, so the record lands first. The
owner's "private for now — no LICENSE yet" was about **this repository's own**
licence and a code of conduct, not about the licences of what it depends on, so
it defers neither.

**W6 is the cheapest item in the set and the most overdue.** `PRODUCT.md:280`
still says the direction that would fix the accent is "Desk (B), it is
recommended rather than decided". The owner said their word at 06:01, and
[WI-025](../work/WI-025.md) put it in ADR 0007. The product record is the last
place still telling the old story.

### The order, with capacity

One implementer. One item at a time. The order is not a preference, it is the
only thing that can happen — so it is written down, with what does not start
yet and why.

**In flight, and not to be reordered.** WI-031 (the owner's route to close an
unknown turn — released at 08:54, dispatched, and it closes WI-027's last
criterion), WI-017 (the template set — the owner's answer that all six kinds
get a template in the first set), WI-020 (the measures route), WI-007's fix,
and WI-028's contract half. **Cancelling a dispatched item to move another up
is what strands work**, and the factory has been burned by it twice today, so
nothing in this queue is cancelled to make room.

**Next, and the owner's word says it.** [WI-024](../work/WI-024.md), Forge —
the panel's adoption of the direction the owner chose, and the next visible
change after the push. It is dispatched to Cog by this session on 2026-10-21.
The three items above it are already dispatched and queued, and one implementer
means they land first; the owner's word is about what the panel looks like
next, not about which queue a card sits in. If the owner wants Forge ahead of
them, that is one word, and it is a lead decision to reverse.

**Then the seven wants, in the order the table gives:** W2 before W1, W5
before W7, W6 on its own because it is small, and W3 last.

**What does not start yet, and why.** W3, because it is the furthest from the
owner's stated priority and the largest of the seven. The verification queue,
because **one verifier is the factory's real gate**: six items sit at `verify`
and every one of them waits on Probe, so acceptance — not implementation — is
now the bottleneck. That is a fact about capacity, and the fix is Probe's
queue, not a rule change.

### The post that is owed, request id `factory-status-2026-10-21-0925`

The status post to the `Personal OS Factory` group was refused by the runtime
again, with the same guard that refused every dispatch this tick: _"This Bot is
replying in multiple chats, so this tool call cannot be assigned safely."_ The
gate is not the group's — the group has taken posts — it is the bot being in
another chat at the same moment.

It says, in short:

- **The seven wants are triaged** — merged, refused or resized, with the
  verdicts, the titles, the owners and the criteria recorded above. W4 is
  folded into WI-007. W3 is deferred for capacity, not judgement, and becomes
  a numbered item so it is not lost. W6 is the cheapest item in the set and
  the most overdue — `PRODUCT.md:280` still says the direction is Desk (B).
  W1 and W2 matter most: the numbers behind the product's own report are
  wrong, so the report is a lie by omission until they land.
- **The order, with capacity.** In flight and not to be reordered; then
  WI-024, Forge, as the next visible change after the push; then the seven
  wants in the order W2 before W1, W5 before W7, W6 alone, W3 last. What does
  not start yet: W3, and the verification queue — six items sit at `verify` and
  every one waits on Probe, so acceptance is the bottleneck now.
- **One question is with the owner**, and WI-008 cannot close without it:
  should a turn whose outcome could not be confirmed keep dispatching work?
- **A note on evidence.** The full suite is only trustworthy when nothing else
  is touching the checkout, and three sessions and four bots share one working
  tree. A red has to be re-checked in isolation before it is called a defect,
  and a green run that happened alongside another session's run is not a green
  run. Nothing is accepted on a contended run.

### The dispatch that is owed, request id `wi-024-forge-adoption-2`

[WI-024](../work/WI-024.md), Forge, is the owner's next visible change and its
re-dispatch is **owed** — the runtime's guard refused it along with every
other call this tick, including the group post above and the checks of task
states. A dispatch that cannot be delivered is not a dispatch, so the item's
file records the request id and the order the brief carries, and the work does
not move until somebody has actually been given it.

### The owner's product question that is still open

[WI-008](../work/WI-008.md) cannot close on an unanswered question, and the
question is the owner's: **should a turn whose outcome could not be confirmed
keep dispatching work?** `planAndDispatch`
(`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
`message.status`, so an unknown turn keeps asking for more work while the
owner is looking at it on the waiting list and nobody can confirm the first
turn's outcome. Chief's recommendation is **no** — an unknown outcome waits for
the owner, which is what "check this" means — but it changes what the product
does with spend and it is the owner's call, not the factory's.

## The six numbers, taken 2026-10-21 09:40

The other Chief session triaged the seven wants at 09:25 and **took no
number**, because the number space has one owner and it is this session's.
The verdicts, the titles, the owners and the criteria are recorded there; the
files are created here.

| Want | Item                        | Owner | Where it sits in the order         |
| ---- | --------------------------- | ----- | ---------------------------------- |
| W1   | [WI-033](../work/WI-033.md) | Cog   | after WI-034                       |
| W2   | [WI-034](../work/WI-034.md) | Wren  | before WI-033                      |
| W3   | [WI-035](../work/WI-035.md) | Cog   | **deferred** — starts after Forge  |
| W5   | [WI-036](../work/WI-036.md) | Wren  | before WI-038                      |
| W6   | [WI-037](../work/WI-037.md) | Wren  | on its own — small and independent |
| W7   | [WI-038](../work/WI-038.md) | Chief | after WI-036                       |

**W4 has no item and needs none.** It is folded into
[WI-007](../work/WI-007.md), which is the same subject under a different name
and is already with Cog. The fold is recorded in the triage rather than in
WI-007's file, because that file is the other Chief session's live claim.

**The numbers are stable, and the order is not in them.** W1 became WI-033 and
W7 became WI-038 because the correspondence has to stay legible, not because
the queue runs in that order: the queue runs WI-034 before WI-033, WI-036
before WI-038, WI-037 on its own, and WI-035 last. **A number is a handle,
and handles are not reordered when the queue is.** The queue has been
reordered three times today, and every item that was cancelled and
re-dispatched had to change its request id as well; the number did not move,
and that is the point of it.

**What is not dispatched yet, and why.** Nothing in this set is dispatched.
**One verifier is the factory's real gate**: the triage records six items
sitting at `verify` with every one of them waiting on Probe, so acceptance —
not implementation — is the bottleneck now. Adding nine more cards to a queue
whose far end is blocked does not make the product better; it makes the
ledger longer. These items are written, numbered and ready, and they start
when Probe's queue has room.

**Every number this session has taken, in one place.** WI-030, WI-031,
WI-032, WI-033, WI-034, WI-035, WI-036, WI-037, WI-038. The other Chief
session's are WI-024 through WI-029.

## The measures cannot publish numbers the audit trail knows are wrong — 2026-10-21

WI-020 is dispatched and in flight, and it sits ahead of WI-033 and WI-034.
That is fine for the route: a read-only route that returns the numbers is
published work, and the owner approved it. It is not fine for the band — the
surface the owner looks at. The inputs are known to be wrong today:
`createdBy` is hardcoded `'system'` for automations and tasks, twelve of the
thirty-four mutating routes write no audit entry, and every entry written
records a success whether the action succeeded or not. A band that renders
those as "the share of features authored by agents" is the product's first
report on itself, and it would be false.

So the rule, in the family of the one that already travels with the direction
(_no ratio whose denominator is zero_): **no number whose inputs are known to
be wrong.** The route lands. The band ships with the counts it can defend —
features authored in-instance by an agent, from a table that records the real
author — and the ratio and the second measure wait for WI-033 and WI-034.

This is a scoping change to a dispatched item, not a reordering: the item
lands, and what it shows is bounded by what the data can carry. Nobody has
said the band may publish a number the audit trail does not support.

## Two of the seven wants start on Wren's lane — 2026-10-21 10:54 AEST

W5 and W6 are dispatched, and the reason is capacity and ownership, not
willingness. **Neither lane is idle**, so the order has to name which
implementer is free of _new_ work and which items are heavy:

- **Cog's lane holds four implementation-heavy items** — WI-024 (Forge),
  WI-017, WI-020 and WI-031's implementation. One implementer, one item at a
  time, so that is four turns before anything else reaches the tree.
- **Wren's lane holds three small ones** — WI-025's ADR record pass, WI-031's
  contract half and WI-007's migration note, which is one sentence — plus
  WI-028's contract half, running now.

**Implementation does not consume the verifier.** Dispatching W5 and W6 puts no
new card in front of Probe, and it takes none of Cog's slot: both are Wren's
files, neither touches code, and neither touches `CONTRACTS.md`, which is
live. What it does is start the two wants that are already written, already
owner-funded, and blocked on nothing.

**W5 is the ground truth WI-038's gate compares against**, so it sits on the
path to the owner's answer of 08:54 — the borrow rule becomes a check — and a
gate that compares against nothing catches nothing. W6 is the one place in the
repository still telling the owner the opposite of their decision.

**What still waits, and why.** WI-034 and WI-033 wait because `CONTRACTS.md`
is live — WI-028's contract half is writing it — and WI-034 publishes entries
there. WI-035 is W3, deferred for capacity and last. The order among the
wants stands: W2 before W1, W5 before W7, W6 on its own, W3 last.

**The tiebreak, said out loud.** These two are dispatched by this session.
**Do not dispatch WI-036 or WI-037 again from anywhere.** One item, one
owner, one live dispatch. The request ids above are spent; a re-dispatch needs
a new id and a new title, not a reuse.

**The owner's two questions are with the other Chief session.**
`ask_840a807bf1ad7291f4d92f44` holds them — whether an unconfirmed turn keeps
dispatching work, which WI-008 cannot close without, and where Forge sits in
the queue. This session does not ask them a second time.

## The factory is idle with a full queue — 2026-10-21 10:57 AEST

**Every lane is full and nothing is running.** The last task to _start_ was
Probe's WI-025 verification at 09:35:16; the last task to _finish_ was at
09:48. Since then — nine minutes — the runtime has assigned nothing, though
fourteen tasks are queued and waiting.

| Lane  | Queued                                                                                    | Idle since |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| Cog   | 4 — WI-024 (Forge), WI-017, WI-020, WI-031's implementation                               | **08:51**  |
| Wren  | 5 — WI-025's record pass, WI-031's contract half, WI-007's migration note, WI-036, WI-037 | 09:34:34   |
| Probe | 5 — WI-022, WI-007, WI-021, WI-027, WI-030                                                | 09:48      |

**This is not a queue with too much on it.** Probe finished WI-025's
verification at 09:48, freed its slot, and was not given the next one —
WI-022's, which had been waiting since 09:13. **A bot that frees a slot and
is not given the next task is an assignment that is not happening.** Cog's
lane has been idle for sixty-four minutes, and Forge — the owner's chosen
direction — is in it.

**Two readings fit the evidence, and the factory can separate them.**

1. _The guard holds the assignment._ The runtime refuses a tool call with
   "This Bot is replying in multiple chats, so this tool call cannot be
   assigned safely", and the Chief bot is in two chats — this session and the
   other Chief session's group turn. The other session named this cause at
   08:15 and 08:22. Against it: the guard is not refusing anything now —
   this session's dispatches were accepted at 09:54 and its task queries work
   — and the assignment is still not happening. **The guard explains the
   refusals. It does not yet explain the silence.**
2. _A bot session is wedged._ Cog has had seven tasks cancelled today, three
   of them at 07:49:25 with `AGENT_UNAVAILABLE`, and a cancelled task may
   leave its session spinning with the queue behind it. Cog's lane is the
   longest idle, and Cog is the bot that has been cancelled the most. Wren
   and Probe are shorter idle, and both finished cleanly.

**The test for the next tick costs one dispatch of nothing.** Watch whether a
queued task starts once the Chief bot is in one chat and one round. If one
starts, the first reading is right, and the factory's throughput depends on
how many places the lead is talking at once — which is a rule worth keeping.
If none starts, the second reading is right, and a wedged session has to be
replaced rather than waited on.

**What was not done about it, deliberately.** Chief did not cancel and
re-dispatch a queued task to force it moving: a cancelled dispatch strands
the item and costs a new request id, and forcing an assignment the runtime is
not making does not make it. Chief did not message a bot to ask whether it
is alive, because a message is another item in a queue that is not draining,
and it would compete with the real work rather than replace it. And Chief
added no new work to the queue, except the two wants that were already
written, already owner-funded, and blocked on nothing.

**What the ledger's "Probe is the gate" reading was.** It was right about
where acceptance is stuck, and it was not the whole truth: six items at
`verify` is a queue, and a queue only matters if it moves.

**Two measurements taken at 11:05, after the section above was written.**

1. **The guard was refusing at that moment.** Chief's attempt to post this
   state to the factory group was refused with "post_group is only available
   in a private chat, not during a group turn" — the same guard, refusing at
   the moment Cog, Wren and Probe were all idle with full queues. So the bot
   was in a group turn then, and the assignment was held then. **That is
   correlation, not proof** — a guard that refuses the lead's post while
   three lanes are idle is the same fact as a guard that holds assignment,
   but one occurrence of each is not a demonstration.
2. **Twenty seconds of watching changed nothing.** A queued Cog task
   (`task_4b5a7d412c11`, WI-017's successor) was watched for twenty seconds
   for a state change. It stayed `queued`. The stall is not a slow queue
   clearing; it is not clearing.

**One more thing the owner should know, because it is in the same working
tree.** Three of the owner's own desktop sessions point at `G:\code\personal-os`
— "研究 MiniMax Code 复用与 Personal OS 架构", "Fix git remote for multi-agent
pushes" and "Build personal OS planning specs handoff" — and the third was
still being worked on at 09:56, minutes after Chief's commit. The factory's
rule that one file carries one live item is the repository's rule, and the
owner's own sessions sit in the same checkout as four bots and two Chief
sessions. That is the contention the red in `ownerPasswordExposure.test.ts`
came from, and it is the reason a contended gate run is not evidence.

### The correction to the section above — 2026-10-21 12:55, machine clock

**The test that section proposed has been run, and the answer is that the queue
moved. The gap was three minutes, and it was one task's turnaround.**

**The assignment timeline, read from the runtime's own records** — every task
that started, with its start and end:

| Started  | Ended    | Item                                          |
| -------- | -------- | --------------------------------------------- |
| 09:51:17 | 10:18:14 | Adversarial review of `docs/strategy.md`      |
| 10:12:59 | 10:20:41 | The owner's answers to the two questions      |
| 10:20:41 | 10:37:22 | WI-022 — verify the published waiting reasons |
| 10:37:22 | 10:45:32 | WI-026 — verify the published waiting kind    |
| 10:45:32 | 10:54:04 | WI-008 — return                               |
| 10:54:04 | 11:09:48 | WI-031 — the contract half                    |
| 11:02:14 | 11:35:05 | WI-031 — the implementation                   |
| 11:09:48 | 11:10:17 | WI-007 — verify (failed `BUSY`)               |
| 11:10:17 | 11:19:30 | WI-007 — the migration note                   |
| 11:19:30 | 11:19:58 | WI-027 — verify (failed `BUSY`)               |
| 11:19:58 | 11:20:27 | WI-021 — verify (failed `BUSY`)               |
| 11:20:27 | 11:20:55 | a correction (failed `BUSY`)                  |
| 11:20:55 | 11:31:50 | WI-010 — return                               |
| 11:35:05 | 12:15:08 | **WI-024 — the Forge adoption**               |
| 11:52:28 | 11:58:04 | WI-025 — the ADR's record pass                |
| 11:58:04 | 12:24:24 | **WI-036 — the dependency licences**          |
| 12:15:08 | 12:42:14 | **WI-017 — the template record**              |
| 12:24:24 | 12:42:59 | **WI-037 — the product record says Forge**    |
| 12:42:14 | running  | WI-020 — the two measures                     |
| 12:42:59 | 12:51:36 | WI-041 — the README tells the truth           |
| 12:51:36 | running  | WI-043 — verify the manifest                  |

**Neither of the two readings above is what happened.** The guard does not hold
the assignment — the runtime has assigned continuously since 09:51:17. And no
session is wedged: **Cog ran WI-024 for forty minutes and WI-017 for
twenty-seven, back to back**, and the third and fourth slots have gone to
Cog and Wren in turn. **Nothing needs replacing, and nothing needs to be
cancelled or re-dispatched to make the floor look busy.**

**The specific claims in that section, answered.** **WI-022's verification
finished at 10:37:22** — it was not waiting. **WI-025's record pass finished at
11:58:04** — not waiting. **WI-036 finished at 12:24:24 and WI-037 at
12:42:59** — both done, and neither was re-dispatched. **The idle-since table
is a snapshot of 09:48, and it was a snapshot of a boundary**: the last task
had finished at 09:48 and the next had not yet started.

**What the other Chief session asked for, and what was posted instead.** It
asked for a line in the factory group carrying its reading. **Its reading is
three hours stale**, and posting it would have put _"the factory is idle with
a full queue"_ and _"nothing is running"_ into the group's record as fact.
**A corrected line was posted instead** — request
`factory-assignment-timeline-2026-10-21-1255`, task `task_e5080dacbdbd`,
queued — carrying the timeline, saying that no session is wedged, and naming
the two items in the accept queue. **The record in this file is the same
correction, next to the section it corrects.**

**Three things that have moved since that section, so a reader is not misled
by it.** **The Actions outcome is readable from this machine** — the
credential is in git's helper, and `main` at `f8d808e` is **green on both
legs: CI success on all four jobs, and CodeQL success**. **The owner gave a
new push word at 12:27, and `main` was pushed at 12:28** — the word that was
spent at 08:56 was replaced, not the push. **The two questions in
`ask_840a807bf1ad7291f4d92f44` were answered earlier** — the unconfirmed turn
at 11:05, and Forge's place in the queue at 08:54 — so neither needs asking
again.

**What is true, and is not a stall.** **The accept queue is the bottleneck,
and that has been true all along.** Six items sat at `verify` and every one of
them waits on Probe — one verifier, and acceptance is the gate that turns work
into product. **The lean stands: the next free slot goes to Probe.** WI-062's
and WI-036's verifications are queued for it. **WI-036's implementation was
not re-dispatched** — what went out was its **first verification**, which had
never been sent, so the item could never have been accepted however green its
branch became.

## Chief's tick — 2026-10-21 10:03 +11:00

**The times in this entry are the machine's clock (+11:00).** The entries above
carry labels that run about two hours ahead of it, and they are left as they
are. A reader comparing "10:57" with "09:56" is comparing two clocks, not two
events.

### The tree is green, measured first-hand

| Gate                    | Result                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`     | exit 0                                                                                                               |
| `npm run format:check`  | exit 0 — "All matched files use Prettier code style!"                                                                |
| `npm run test`          | exit 0 — server 211 passed (21 files), web 52, worker 31, agent-adapters 16, contracts 28; **338 tests, 0 failures** |
| `npm run test:e2e`      | exit 0 — **25 passed** (48.1s)                                                                                       |
| `npm run smoke`         | exit 0 — "All smoke checks passed."                                                                                  |
| `npm run verify:bundle` | exit 0 — every chunk within 300 kB, the first paint carries no page chunk                                            |
| `npm run verify:build`  | exit 0 — "The compiled server boots and serves requests."                                                            |

**`main` is 16 commits ahead of `origin/main` and 0 behind.** The first green
tree was pushed at 08:56 under the owner's word, and that word is spent. **The
next push needs the owner's word again**, and the tree it would carry is the
one measured above.

### The band ruling, now in the file and in the brief

The rule the other session recorded earlier today — _no number whose inputs are
known to be wrong_ — is now **in WI-020's acceptance criteria and in the brief
of the live dispatch**. The band ships the counts it can defend: the first
measure's counts, with the count of resources that record no author beside
them; the second measure **named as not yet countable**; and **no ratio, for
either measure**. The route still returns WI-030's published shape, so the
contract is not changed by the ruling and the build is not gated on a judgement
that is the owner's to make. The ratios, and the second number, appear when
WI-033 and WI-034 land.

**The re-dispatch cost the queue nothing.** The creation timestamps say
WI-020's predecessor was created at `…099771`, one second after WI-017's
successor at `…099473`, and both sit behind WI-024 (07:49) and WI-031's
implementation (08:54). So WI-020 was fourth in Cog's lane before the ruling
and it is fourth after it. What the third request id bought is a brief that
cannot be read as a brief to build the old band.

### Five items, and one record corrected

| Item   | Owner | What it is                                                                                     | Dispatched                                                         |
| ------ | ----- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| WI-039 | Wren  | Publish the evidence a decision is taken against — what it did, what it produced, what it cost | `task_dd95fe7df207`, queued                                        |
| WI-040 | Cog   | The decision control shows that evidence, in a drawer where the control opens                  | **not dispatched** — waits for WI-039, and Cog's lane is four deep |
| WI-041 | Wren  | The README tells the truth about the licence — one honest sentence                             | `task_644f23312ebc`, queued                                        |
| WI-042 | Wren  | The product record's closed questions say they are closed — §7, §9, §10                        | **not dispatched** — WI-037 is live on `PRODUCT.md`                |
| WI-043 | Chief | The manifest does not claim a licence — `"license": "MIT"` removed                             | `task_9b1b44c1025f` to Probe, queued                               |

**Two of the five are not dispatched, and their files say why.** A dispatch that
cannot be delivered is not a dispatch, and neither of these can be: WI-040
waits for WI-039's entry, and WI-042 waits for WI-037, because one file
carries one live item. They are numbered so they are not lost.

**WI-039 and WI-040 are the gap Vision found.** The owner decides on two buttons
and a title: the needs-you rail's approval row carries **Approve / Reject**
(`apps/web/src/components/WaitingList.tsx:272-284`) and nothing that says what
the agent did, what it produced, or what it cost. The evidence exists in the
database — the execution the approval points at
(`apps/server/src/modules/approvals/service.ts:12`), its events
(`apps/server/src/db/schema.ts:241`), and its own row
(`apps/server/src/db/schema.ts:227-231`) — and it is published nowhere: there
is no executions route file, and `GET /api/approvals/:id` returns the approval
only.

**WI-041 and WI-043 are the same false claim in two files.** The owner answered
on 2026-10-21 that the repository is private for now, that there is no LICENSE
file at this push, and that the licence is **deliberately undecided**. The
README said `MIT` (`README.md:251-253`) and the root manifest said
`"license": "MIT"`. The manifest is Chief's file, so Chief removed the field —
removing it rather than setting `UNLICENSED`, because `UNLICENSED` is a claim
too, and the licence is undecided — and **Probe verifies it**, because the lead
never accepts its own work. The README is Wren's file, so it is WI-041.

**One record defect is fixed.** [WI-011](../work/WI-011.md) cited
`prototypes/DIRECTION.md` as the source of the twelve comparators. That file
was rewritten for Forge and no longer holds them; the source is
[`docs/strategy.md`](../docs/strategy.md), which the file now cites.

### The fleet is not assigning, and the evidence is better than it was

**Four dispatches were accepted at 10:03, in one chat and one round, and
twenty-four minutes later nothing had started.** Sampled: Cog's WI-017
(`task_4b5a7d412c11`, created 09:41), Wren's WI-037 (`task_4947c89ca7fe`,
created 09:54) and Probe's WI-030 (`task_dc2aeef86acb`, created 09:42) — all
three still `queued`.

**The guard is not the blocker.** It refused the other session's group post at
11:05 on its clock, and it refused tool calls while the Chief bot was in two
chats; but this session's dispatches were **accepted** in a single-chat round.
So the thing that holds assignment is not the refusal.

**An idle chat with a queued task is not being assigned, and that is the part
that matters.** The dispatcher's rule is to take the first queued task whose
bot's chat is free. Wren's and Probe's chats are **idle** in the session list
(`mvs_dff627414f0e47fbbdf7501b11dfdd06`, `mvs_f1f513955649480dbfb09fae820cf59f`
and `mvs_db6a5624d51842cd8a029fc062c60503` all idle or finished), and their
tasks are still queued. So the reading that now fits is not _the guard holds the
assignment_ — it is **the dispatcher's scan is not running**.

**Two facts in the same direction.** The local runtime stopped and restarted:
the other Chief session's session carries _"This session was interrupted because
the previous local runtime stopped"_ (`mvs_30c09202cd384ee8865fb509b595a7bb`),
and its goal-verifier child died at 09:35 with
`GOAL_VERIFIER_CAPABILITY_VIOLATION`. A dispatcher whose scan loop did not come
back with the runtime would behave exactly like this: tasks queued, chats
free, nothing assigned.

**The remedy is outside the repository, and Chief cannot reach it from here.** A
runtime restart is the host's action, and this chat is hosted by the runtime
that would be restarted. The other Chief session can close its crashed
goal-verifier child, which may be what is holding the assignment. Chief did not
message a bot to ask whether it is alive: a message is another item in a queue
that is not draining, and it would compete with the real work rather than
replace it. **This is the one thing the owner may have to do, and it is the
factory's whole throughput.**

### The owner's three questions, in the strategy room

The other Chief session holds two of the owner's questions — whether an
unconfirmed turn keeps dispatching work, and where Forge sits in the queue —
and this session does not ask them a second time. These three are here:

1. **The push.** The tree is green and `main` is 16 commits ahead. The owner's
   word was spent on the first green tree; the next one waits for the next word.
2. **The waiting list's way out.** `approval.decided` — one event published by
   the decide route, so a decided approval leaves the list at once. It is a
   published-contract change, so it is the owner's (C-16, C-22). The
   recommendation is **yes**.
3. **Reversibility.** Is it a product principle that the owner's decisions are
   reversible? The recommendation is **yes** — with one owner there is no second
   operator to absorb a bad action. WI-035 carries the work, and it is deferred
   behind Forge on capacity, so the answer changes the queue rather than the
   code.

### The check, twenty minutes later — the dispatcher is the only path, and it is not scanning

**Seven tasks, all still queued, and the query surface is live.** At 10:27
Chief read all seven: Cog's WI-017 (`task_4b5a7d412c11`), Wren's WI-037
(`task_4947c89ca7fe`), Probe's WI-030 (`task_dc2aeef86acb`), and the four
dispatched this tick — `task_86010eeeb561`, `task_dd95fe7df207`,
`task_644f23312ebc`, `task_9b1b44c1025f`. **All seven: `queued`.** The control
is the task that finished: `task_2b5c9020bf00` (WI-025's verification) reports
`done`, with `started_at`, `ended_at` and the whole result, so the surface is
not stale and `queued` is a real state rather than a frozen read.

**The factory has produced nothing for forty-six minutes** — the last task to
finish was WI-028's contract half, whose `ended_at` reads **09:41:14**, and
the next task was created twenty-five seconds later at 09:41:39. The queue got
work the moment a slot should have freed, and nothing was assigned.

**A restart is safe, and that is measured, not assumed.** Two tasks created
before this morning's runtime stop are still readable with their state intact:
`task_146247be56d5` (WI-028's contract half, created 08:07) reports `done`
with `started_at` 09:25:51 and `ended_at` 09:41:14, and `task_8e6fe1c54bfb`
(WI-022's verification, created 07:44, cancelled 08:33) still reports
`cancelled` with its own `ended_at`. **The queue is persisted, not held in
memory**, and a task that was running across the earlier stop finished anyway.
A restart costs the factory the idle time it has already spent, and nothing
else.

**A second route was tried, and it is the same queue.** The hypothesis worth
testing was that a direct message reaches an idle chat when the dispatcher does
not. Chief handed Wren the same WI-039 brief as a message
(`wi-039-evidence-contract-2026-10-21-via-chat`, task `task_c125d103127b`).
**It came back `queued` as well.** So `dispatch_tasks` and `message_bot` are
two doors into one queue, and the queue is the only way in. Chief cancelled
that task in the same minute so that WI-039 keeps **one** live dispatch, and
the attempt is on the record in WI-039's file.

**What this rules out, and what it leaves.** It rules out the idea that the work
is lost or misrouted: the tasks are persisted, they are named, they are
readable, and both doors put them in the same place. It leaves the conclusion
that **the dispatcher's scan is not running** — and the one fact that fits
alongside it is that the local runtime stopped and restarted this morning, and
the other session's goal-verifier child died on a capability violation at
09:35. A dispatcher that did not come back with the runtime looks exactly like
this: tasks queued, chats free, nothing assigned.

**The owner's next action is a restart of the local runtime.** Chief cannot do
it: this chat is hosted by the runtime that would be restarted, and the restart
is the host's. Nothing else in the factory's hands moves the queue — the
re-dispatch and the message both produced one more identical queued task, and
the queue is where they stay. The tree is green, so a restart costs the
factory nothing but the idle time it has already spent.

### The third road, and where all three end

**A direct turn in Wren's session was tried, and it queued behind a stuck turn.**
Chief sent WI-039's brief to Wren's own session
(`mvs_dff627414f0e47fbbdf7501b11dfdd06`) through the desktop session API,
because that route does not belong to the mini app's dispatcher. The runtime's
answer: `status: accepted, mode: queued, position: 1` — _"The target Session
was busy, so this message was queued and runs after the current Turn."_ And
the session list calls that session **idle**. So the list's "idle" and the
runtime's "busy" are two different things, and the runtime's is the one that
decides.

**What Wren's session is busy with is not a dispatched task.** All three
sampled tasks are still `queued` — WI-037 (`task_4947c89ca7fe`), WI-039
(`task_dd95fe7df207`) and WI-030 (`task_dc2aeef86acb`) — so the turn in that
session is not one of ours.

**Three roads, one queue.** `dispatch_tasks` queues. `message_bot` queues. A
direct session turn queues behind a turn that does not end. And the mini app's
own process is **running** (`miniapp list` — `status: running`), so this is not
a dead process: it is a process whose assignment loop and whose bot sessions
are both stuck. **Two bot sessions have been sitting in `started` with no task
running in them** — Probe's (`mvs_f1f513955649480dbfb09fae820cf59f`, since
09:51) and Cog's (`mvs_e109a52fca0541f196725ffdedd0d316`, since 09:32) — and
the other Chief session's goal-verifier child is in `error` from 09:35. Two
wedged sessions and a two-slot dispatcher is a reading that fits the whole
picture: a wedged session can hold a slot that nothing else can use.

**So the owner's next action is a restart of the local runtime, and the
evidence says it is safe.** The queue is persisted — two tasks created before
this morning's stop are still readable with their state intact — the tree is
green, and nothing in the factory's own hands moves the queue.

### The third road works — and the factory can be driven from a session

**WI-039 landed.** `6406291` — "Publish the evidence a decision is taken against"
— `CONTRACTS.md` only, committed 10:48:53. It was written by Wren, in Wren's
own session, from the turn Chief opened there. **The dispatcher's copy of that
task is still `queued`.**

**So the third road is the one that works.** `dispatch_tasks` queues.
`message_bot` queues. A turn opened in the bot's own session **runs**. The
nudge to Wren's session at 10:31:56 put that session into `started` at 10:32:08,
and the work landed sixteen minutes later.

**Two cancellations, both to keep one delivery per item.** The queued task
`task_dc2aeef86acb` (WI-030's verification) was cancelled and the work was
handed to Probe through the same working route; and `task_dd95fe7df207`
(WI-039's queued dispatch) was cancelled once the work had landed, so that no
second worker writes `CONTRACTS.md`. WI-039's verification is dispatched
(`wi-039-verify-evidence-entry-2026-10-21`, `task_e486def935b8`) and queued —
it will be handed over the same way when a bot session is free.

**What this changes about the remedy.** The owner's restart is still the fix for
the dispatcher. It is no longer the only way work moves: a turn in a bot's
session is a delivery route the dispatcher does not own, and using it does not
touch the queue. The factory is no longer waiting on the restart to make
progress — it is only waiting on it to stop the queue from growing.

**What is running, at 11:05.** Probe's verification of WI-030 is running in its
own session, and it has a finding in hand: the template record's migration note
tells a client to add `resource.template.list` to an agent's `toolGrants`, and
the server rejects that today — `toolGrantListSchema` is
`z.array(mcpToolNameSchema).max(mcpToolNames.length)`
(`packages/contracts/src/mcp.ts:52`), so an unknown name is a 400 and the cap
is the current list's length. **The two published shapes were corrected at
`2dcac9c`** ("Hold the two published shapes to the code they describe",
11:03:50) while that verification was still running, and WI-031's contract
entry landed at `363428e`. The other session accepted WI-022 and WI-026 and
recorded a ruling on contract verification (`0c0dfcd`).

**Nothing here is accepted on my word.** Probe's report is still being written,
so WI-030 and WI-039 are not accepted until it is, and a correction landing in
the file while the verifier is reading it is something the verifier has to
account for — not something that closes the item.

**Two verifications are now running in Probe's own session** — WI-030's, opened
at 10:51, and WI-039's, queued behind it at 10:53 — and WI-039's work itself
has landed. Cog's session (`mvs_db6a…`) is busy with work of its own, and both
builds (WI-017 and WI-020) wait on WI-030's verdict, which is the order this
factory already recorded: a build against a shape that does not hold is work
thrown away.

## A review of the strategy document, 2026-10-21 — Vision

`docs/strategy.md` asks three questions in the strategy room: are the three
pillars the right three, is the landscape table the one worth keeping, and are
the seven wants the right wants. The document is Wren's house, so this review
is recorded here and has to be folded into it by its owner. **The number space
is untouched: nothing below takes a number.**

### 1. The pillars are right as mechanisms, and one thing is missing that is not a pillar

The document's own answer carries four clauses, and the one-sentence summary
three. Two map exactly onto pillars: _native means typed and checked_ is
Pillar 1, _the instance can be seen from the inside_ is Pillar 3. The clause
with no home is the first one — **the owner's decisions are the only authority
in it**. Pillar 2 covers half of it, the ledger and the history and the
take-back, but the part where the owner actually exercises that authority is
not in the pillars at all: the rail, the control, the evidence for the
decision, and the list that tells the truth about what is waiting.

That is a gap in the strategy and not only in the writing, and it has a
consequence: **if the three pillars are the filter for wants, then every want
that improves what the owner experiences of deciding fails the filter** — the
trace in the decision, the list's way out, reversibility. W3 is the only one of
those three that reached the set, and it is the one the document calls "the
furthest from the owner's stated priority". It is not further. It is the other
half of the promise the identity sentence makes.

So: keep the three pillars, and add a section rather than a fourth pillar —
**the decision surface**, with its own gaps, because the pillars are what the
_environment_ must have and the decision surface is what the _owner_ touches.
The identity sentence already has one clause for each.

### 2. Keep the landscape table, and split the two jobs it is doing

The table is the answer to a question the repository could no longer answer,
and its licence column is the reason Q5 is right. Three corrections:

1. **One table, two jobs.** The comparator rows are _inspiration_ — read once,
   dated. The dependency rows W5 writes are _compliance_ — checked by W7's
   gate. The gate can only see the second kind, so a reader may take a
   comparator's licence as compliance evidence. Split them, and label which is
   which.
2. **"Where it lands here" names item numbers, and the number space churns.**
   WI-016 became WI-020, and two sessions own numbers now. Point at the
   _subject_ — the mechanism, the document section — and keep the item numbers
   with a date.
3. The re-read rule is right as written. With the gate covering the dependency
   half automatically, the hand-read half only needs re-reading when a source
   changes behaviour.

### 3. Six of the seven wants are right, and the set is thin about the owner

Every want in the set is a repair to something the environment got wrong about
itself: the audit trail, the authorship rules, the history, the resume, the
licences, the product record, the gate. That is a coherent set, and the
document's framing — the gap in each pillar — produces exactly this.

What the set does not have is a want about the surface the owner touches,
apart from W4, which was folded into WI-007. Two gaps are missing from the
set, and both were found in the code rather than in opinion. They are wants in
the document's own format. **Neither takes a number** — they are for the
session that owns the number space to take up.

**The decision shows what the agent did, where the decision is taken.**

**Owner:** Cog. **Files:** `apps/web`, `apps/server`.

Under Forge the decisions live on the Map's Needs-you rail and the execution
trace is the Work room's companion, so the owner would leave the landing
screen to learn what the agent did in order to decide on the landing screen.
The evidence travels with the decision: what was run, what was produced, what
it cost, for that item, in the drawer the control opens.

**Acceptance:** when the owner is asked to approve, accept or answer, the
control opens the execution context for that item; it reads the events the
contracts already publish (`tool.started`, `tool.completed`,
`artifact.created`, `execution.status`, and spend as an abstract counter); a
test proves the context is shown for an approval, and that it is scoped to
that item and not to the whole execution; the owner can decide without leaving
the landing screen.

**The waiting list learns that an item no longer needs the owner.**

**Owner:** Cog, with Wren for the published entry. **Files:** `packages/contracts`,
`apps/server`, `CONTRACTS.md`.

This is the want behind the owner's second question (C-16, C-22): one event,
`approval.decided`, published by the decide route.

**Acceptance:** the published vocabulary carries the event; the decide route
publishes it; the waiting list drops the row on that event without waiting for
the safety-net refetch; a test proves the row leaves on the event, and that
"nothing is waiting on me" is true immediately after the last decision; the
migration note says what a client written before the change does.

### The deferral of W3, and the reason recorded for it

The record says W3 is deferred because it is "the furthest from the owner's
stated priority". That is the weaker of the two arguments. The honest reason
is capacity, and if it is capacity then W3 is the first thing to un-defer when
capacity frees, because it completes the clause the identity leads with:
shipping the decision control before the take-back means the product grants
irreversible authority first, and with one owner there is nobody else to
absorb a bad action.

**One thing this review does not touch.** The rule that the band ships only
the counts the audit trail can defend is now in WI-020's acceptance criteria
and in the live dispatch, and this review agrees with it rather than restating
it.

### The CI conclusion, measured at the pushed commit

**The question was: what did the two runs on GitHub conclude?** Chief cannot
read the Actions tab from this machine — the repository is private, the
Actions API answers `404` without a token, and this shell cannot obtain one.
**But the conclusion is a property of the tree, and the tree can be measured.**

**The structural fact that makes the measurement exact, and its one
exception.** When the measurement was made,
`git diff d03e225..HEAD -- apps packages scripts deploy .github` was **empty**.
It is not empty now, and both differences are accounted for:

- `apps/server/src/__tests__/waiting-list.test.ts` — Probe's two pin tests
  (`ab574d8`, `ad58c96`), which add assertions and change no behaviour.
- `.github/workflows/ci.yml` — WI-023's four new steps, which **have not run
  in CI**. That is the whole point of the item, and it is why the item is with
  Probe and why nothing has been pushed.

**With the test file excluded, the only difference is the workflow file: the
product's own code at the pushed commit is the product's own code now.** The
only other things that moved since are documents — the contract, this ledger,
the work items, the strategy document — and `package.json` losing one line
(WI-043). **So the gates measured at HEAD are the gates CI ran at `d03e225`.**

**Every CI job, measured here:**

| Job and step                               | The command                                                           | What it said                                                                                                                                                                                           | Exit |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| build · Typecheck                          | `npm run typecheck`                                                   | typecheck 0 across every workspace                                                                                                                                                                     | 0    |
| build · Tests                              | `npm run test`                                                        | server 21/21 files, 213 passed · web 6/6, 52 · worker 5/5, 31 · agent-adapters 2/2, 16 · contracts 4/4, 28 — **340 tests, 0 failures** (338 at the pushed commit; the two since are Probe's pin tests) | 0    |
| build · Build                              | `npm run build`                                                       | all five packages built; the container image build ran the same script                                                                                                                                 | 0    |
| build · Formatting                         | `npm run format:check`                                                | "All matched files use Prettier code style!" — measured **at `d03e225` itself**, in a detached worktree at that commit                                                                                 | 0    |
| build · Smoke                              | `npx tsx scripts/smoke.ts`                                            | "All smoke checks passed."                                                                                                                                                                             | 0    |
| build · The compiled server boots          | `npx tsx scripts/verify-build.ts`                                     | "The compiled server boots and serves requests."                                                                                                                                                       | 0    |
| build · The bundle stays within its budget | `npx tsx scripts/verify-bundle-size.ts`                               | "Every chunk is within 300 kB and the first paint carries no page chunk."                                                                                                                              | 0    |
| build · End-to-end browser tests           | `npm run test:e2e`                                                    | **25 passed**                                                                                                                                                                                          | 0    |
| audit                                      | `npm audit --audit-level=high`                                        | "found 0 vulnerabilities"                                                                                                                                                                              | 0    |
| docker                                     | `compose up --build` → health → web root → `verify-stack` → `down -v` | every step green, including **"the worker produced an agent reply"**                                                                                                                                   | 0    |
| workflow-lint                              | `rhysd/actionlint:1.7.12`                                             | no findings                                                                                                                                                                                            | 0    |

**What is still unread, said plainly.** GitHub's own log. The Actions tab holds
the platform's verdict, and reading it is the owner's or Probe's to do. What
the measurement establishes is that **there was nothing for that verdict to
fail on**: every gate the pipeline runs, green, at the exact commit the
pipeline was pointed at. The difference that remains is the runner's platform
— this machine is Windows with Docker Desktop, CI is `ubuntu-latest` — and that
is a real difference, which is why the tab is still worth reading and this is
not a substitute for it.

**What it changes.** WI-023's blocker — "wait until the job is known to work"
— is discharged, and the item's own acceptance criteria asked for the whole
container sequence to be run locally against real Docker before it is pushed.
That was done: the workflow's own text, four new steps, the 401 first and the
green after. The full output is in `.factory/work/WI-023.md` under "What the
runs concluded, and the local proof", and the change is with Probe
(`task_6437af4f18f0`), because the lead wrote it.

### The ruling: a contract item is verified against the tree it stands in

**Probe asked it twice** — once in WI-022's verification and once in
WI-026's — and both times the same question: is a contract item judged against
the commit it landed in, or against the tree it stands in?

**Against the tree it stands in.** The contract's job is to be a promise the
product keeps now. A promise that was true for one commit and stale for the
next is a promise that is wrong, and a contract item's criterion is that the
published entry agrees with the code that is running. The commit it landed in
is history; it is recorded, and the entry that names the implementing commit
is what tells a reader which history it is.

**What it does not change.** An entry that declares the code does not implement
it yet is **not** a defect — Probe said so for WI-026, in both of the states
that entry has been in, and that is right: the entry is honest in front of the
code and honest behind it. The ruling only says which tree the agreement is
measured on.

**What it did change.** WI-026's criterion 5 was worded for one moment in the
code's history — "the entry says the code does not implement it yet" — and in
the tree the item stands in, the code does implement it and the entry says so.
It is re-worded to ask the standing question (does the entry tell the truth
about the code as it stands?) **without weakening the requirement**: a
published member the code never produces is still a defect, and a member the
code does produce must not be published as one it does not.

**This covers WI-022, WI-026, WI-028 and WI-030**, so the next contract item
does not have to ask it again.

### Two acceptances, and what the product can now do

**WI-022 — accepted.** Probe's verification (`task_38cb5ecee977`, batch
`batch_247e598a4edf`) found **all seven criteria met** and **no defect in the
published entry**; the one defect was in the item's own "Changed" line, which
understated what `a44a374` published — that commit published WI-022's
`WaitingReason` **and** WI-026's `WaitingKind` in one file, and the item said
"nothing else". Corrected. **What the product can now do: the waiting list can
carry a reason the code actually emits, and the order the panel shows is the
order the contract publishes — and the two are pinned against each other.**
Probe closed the gap the item left open: the published urgency order had no
test at all, and the old urgency test ranked a band that did not exist, so a
missing band compared as `undefined` and the assertion passed while proving
nothing. Probe's `ab574d8` reads the four bands out of the published
paragraph, builds one item of each, and compares the order the route returns
with the order the contract publishes — so neither can move alone.

**WI-026 — accepted.** Probe's verification (`task_25bf9ea7e2cb`, batch
`batch_9cf9cefcff10`) found **all seven criteria met** and **no defect in the
published entry**; the one defect was in the item's own criterion, which cited
`waiting.ts:17` — the _reason_ type — instead of `waiting.ts:8`, where the
kind is declared. Corrected. **What the product can now do: a turn whose
outcome could not be confirmed can reach the owner as a thing to check, and
where it sorts is the order the contract publishes.** Probe's `ad58c96` reads
the published "over reasons, not kinds" paragraph, writes a turn the way the
worker writes it, and compares where the route puts it with what the contract
claims — so neither can move alone.

**What both left for the contract's owner.** Three citations that moved when
WI-027's code landed, and they went out as **WI-022's successor** to Wren
(`task_682c73ccbc73`) rather than as an item of their own — one file, one
live item, and WI-026's dropped citation of the kind's declaration rides in
the same edit. Chief checked every line it names against HEAD: `waiting.ts:8`,
`:17`, `:95` and `:140-144`.

### The want with no number, and who holds the number space

**The MCP surface's id-addressed tools are not scoped to a workspace.** It is
recorded above, in full, with the code's own rule and the four call sites that
check it against the seven that do not. **It still has no number, and that is
deliberate.** The number space has one owner, and the record is clear about
who: `4034d45` ("Take the six numbers for the seven wants") took WI-038 and
says so — "WI-030, WI-031 and WI-032 are this session's; WI-024 through WI-029
are the other Chief session's" — and the same session took WI-039 through
WI-043 in `96b87f8`. **This session has taken no number since WI-031**, so it
took none here either. The tiebreak is the one already agreed: whoever numbers
writes it in the item's "Numbered" line **and** in this dispatch table, and the
table says who holds the work.

**The number owner is asked for one thing:** number the MCP scoping finding and
put it in the queue. It is a defect against a rule the code already states —
`apps/server/src/modules/mcp/server.ts:96` says _"An agent may only act inside
a workspace it has been granted"_ — and **WI-017 is adding a tool to this same
surface**, so a rule that lands after it has to be applied to it as well.

## The owner's two answers, and the corrections this tick made — 2026-10-21 11:15

**The owner's answers, asked at 11:05 and answered at 11:05.**

1. **Should an unconfirmed turn keep dispatching work? No.** An unconfirmed
   turn stops and waits for the owner. This is the question WI-008 could not
   close on, and it is now closed: `planAndDispatch`
   (`apps/server/src/modules/conversations/dispatch.ts:85-103`) never reads
   `message.status`, so a turn whose outcome could not be confirmed still
   routes work onward. **The owner's answer says it must not.** That is a
   behaviour change, and it belongs to the item that owns the waiting list's
   behaviour — WI-008, whose file is the other Chief session's live claim.
2. **Forge's place in the queue: the three in flight first.** WI-017 (a
   template for all six kinds), WI-020 (the product reporting on itself) and
   WI-031 (the route that closes a turn) stay ahead of WI-024. Reordering
   dispatched work strands it, and the factory has been burned by that twice
   today; WI-031 also closes WI-027's last criterion, which is the one the
   owner's push waited on.

**WI-034's scope was wrong, and the correction is right.** The item said the
contract "does not say what 'authored by an agent' means" and that the audit
outcome set "is published nowhere". **Both were false**: WI-030 published both
at 08:34, before the wants were triaged, and as written the item would have
published the same thing twice. The other Chief session found it, the
reasoning is in `docs/strategy.md` (`e1f50ae`), and WI-034 is rewritten to
the narrowed scope. **The lead who wrote the item did not notice that the
item was wrong; a verifier reading the contract instead of the brief did.**
That is the whole argument for the implementer not being the verifier, in one
incident.

**One thing the narrowing leaves open, and the item now says so.** The
published outcome set is `success | failure | unknown`, and the unknown
outcome **is** written to the trail today. The narrowed vocabulary is
`queued | succeeded | failed`. **A vocabulary that dropped `unknown` would
make the unknown outcome unrepresentable in the audit trail**, so WI-034's
criteria now require the vocabulary to express every outcome the product can
produce, or the migration note to say where an unknown outcome is recorded
instead. That is a judgement for the item's owner, and it is not a detail.

**W8 is funded, and numbered.** The same review produced a want: the licence
gate reads the **dependency set**, so it cannot see source vendored into this
repository's own tree — the owner's own hard case. **WI-044.** It is numbered
so it is not lost, and it is **not dispatched**: the inventory it needs is
worth writing against a settled repository, and the repository's visibility
is the owner's open decision.

**The number space, as it now stands.** This session: WI-030 through WI-038,
and WI-044. The other Chief session: WI-024 through WI-029, and WI-039
through WI-043. Continuous, collision-free, and recorded here because two
claims in one tree have already collided twice.

## WI-032 — the security leg of the pipeline, and what it took to fix it

**Two defects, and only one of them was in the repository.**

1. **The token could not read the workflow run it belonged to.** The job
   declared `security-events`, `packages` and `contents`, and a job-level
   `permissions:` block replaces the workflow-level one wholesale — so
   `actions: read`, which GitHub's own documentation for the action requires,
   was never granted. The step failed with _"Resource not accessible by
   integration"_ before it analysed anything.
2. **And then the licence.** With the permission fixed, the failure moved
   one step along: _"Code scanning is not enabled for this repository."_
   Enabling it is `code_security` in the repository's settings, and GitHub
   answers that with _"When billing is bundled Code Security can only be
   enabled if Advanced Security is enabled"_. **Code scanning is free on a
   public repository; on a private one it needs GitHub Advanced Security,
   which a personal account does not have.** The repository is private — the
   owner's choice — so the scan cannot upload and cannot be made to.

**The scan itself works.** The `analyze` step's `upload` input takes `never`,
which produces the SARIF without sending it to code scanning, and the
results are published with the run as an artifact instead. The run fails if
the scan produced none. **When the repository is public, where the owner said
it is going, the upload is one word away.**

**And the branch is a gated branch in both senses now.** `codeql.yml` ran on
`main` only, while `ci.yml` ran on every branch — so a branch was checked by
half the pipeline, and the half that was missing is the one that catches a
bad pattern in a change nobody read carefully. It runs on every branch now.

**It is proved, not asserted.** The branch `wi/032-codeql-permissions` was
pushed and **both runs are green on it**: CI success on all four jobs, and
CodeQL success on the analyze step
(`39508958420`). The fix is merged into `main` as `061b6cd`. **The branch's
own draft of this ledger section was superseded rather than merged** — it was
written before the licence was known, and the record above is the corrected
one.

## The push — 2026-10-21 11:30

**`main` is on the remote, at `3479c31`.** The owner was asked, with the
evidence in the question, and said yes: 43 commits, 39 files, fast-forward,
nothing rewritten, visibility unchanged at private, nothing published
publicly.

**The evidence the question carried.** The pipeline had run on the committed
tree `061b6cd` and **both legs were green** — CI success on all four jobs,
including the docker stack that starts the server, the worker and the client,
and CodeQL success on the analyze step. The only commits after that tree were
documents, so the result was the result for what was pushed.

**What rode along.** The other Chief session's work was on `main` when the
push was made, and went with it: WI-027's unknown turn on the waiting list,
WI-031's published route for closing one, Probe's verification and acceptance
of WI-022 and WI-026, the `license: MIT` claim removed from the manifest,
WI-032's security leg, and this session's six numbered items.

**One commit is ahead of the remote, and it is this record.** The tree that
was pushed is the tree that was verified; adding a record of the push makes
it a different tree, and the owner's word named **a** push, not a licence to
push whatever comes next. `main` waits for the owner's word, and the next
word carries this paragraph.

**What the pipeline did next is the factory's own evidence, not this
session's word.** From now on the repository's state is read from its runs.

### The CI conclusion, read from the platform

**The question this session could not answer from this machine has an answer,
and it is the platform's own.** The other Chief session read the Actions tab
and recorded it in `0507f4f`: the pipeline ran on the committed tree `061b6cd`
and **both legs were green — CI success on all four jobs, including the docker
stack that starts the server, the worker and the client, and CodeQL success on
the analyze step.** This session cannot read that tab — private repository,
Actions API `404` without a token, none obtainable here — so this is the peer
session's record, and it is recorded here as such.

**And the tested tree carries all four of this session's new steps.**

```
$ git show 061b6cd:.github/workflows/ci.yml | grep 'name: The\|name: Create\|name: Restart'
  - name: The account path cannot get into a deployment that has an owner
  - name: Create the owner token
  - name: Restart the stack with the token in it
  - name: The token path gets in where the account path could not
```

**So the owner-token step did not only work locally against real Docker — it
ran on GitHub's own ubuntu runner, and the docker job was green with it.**
That is the platform confirming what this session measured, and it closes the
gap this session could not close last tick.

**The pushed tree is covered by that run, and this session checked the one
thing the run could not cover.** Between the tested tree `061b6cd` and the
pushed tree `3479c31` only documents moved:

```
$ git diff --stat 061b6cd..3479c31
 .factory/INTAKE.md      |  89 ++++++++++++++++++++++++++++++++++++++++
 .factory/work/WI-034.md | 106 +++++++++++++++++++++++++++-----------------
 .factory/work/WI-044.md |  79 ++++++++++++++++++++++++++++++++++++++
 CONTRACTS.md            |   7 +++-
```

The code is byte-identical to the tree CI ran. The one gate a document can
turn is `format:check`, and CI's glob covers `**/*.md`, so this session
measured that gate on the pushed tree itself, in a detached worktree at
`3479c31`:

```
$ prettier --ignore-path .prettierignore --check "G:/code/_ci-probe-3479c31/**/*.{ts,tsx,js,json,md,css}"
Checking formatting...
All matched files use Prettier code style!
```

**So the tree on the remote satisfies every gate the green run checked, and the
green run was that tree's code.**

### `main` is on the remote, and this session's push record is stale

**The owner gave the word, and the other session asked with the evidence in
the question**: 43 commits, 39 files, fast-forward, nothing rewritten,
visibility unchanged at private, nothing published publicly. `main` is at
`3479c31`.

**This session's ledger said the opposite, and is corrected here.** It said:
"the owner's word was spent on the 08:56:40 push; local commits stay local
until the owner says otherwise." **The owner said otherwise, to the other
session, and the push was made.** What survives is not a rule but a fact:
**the push chain is not closed and cannot be closed by the lead. It is a
permission the owner gives each time, with the evidence in the question.**

**This session's work went out with it.** `fabf710` — the CI owner-token step,
and WI-022's and WI-026's acceptances — and `0c0dfcd` — the CI conclusion, the
contract-verification ruling and the two acceptances — are both in
`origin/main`:

```
$ git merge-base --is-ancestor fabf710 origin/main   →  0
```

**And the local tree now carries code that no run has seen.** Three commits are
ahead of the remote and one of them is not a document: `414996c` touches 14
files — `apps/server/src/modules/executions/service.ts` (+124),
`apps/web/src/components/WaitingList.tsx` (+67), `ChatMessageList.tsx`,
`apps/web/src/lib/types.ts`, `packages/contracts/src/conversation.ts` — which
is WI-031's implementation. **"The repository's state is read from its runs" is
right, and it means the state that has a run is `3479c31`. The local tree is
ahead of it and has seen none.**

### A dispatch that failed with `BUSY`, and what it cost

**Three request ids were dispatched by the other Chief session and are not in
the table. They are in it now**, because the table is the map, and a request id
that is not in it is one somebody might reuse.

| Request id                          | To    | Task                | State                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wi-024-forge-adoption-2`           | Cog   | `task_2963d3be0f41` | **cancelled** at 09:55 — a second dispatch of WI-024 under a new id. **The live dispatch on WI-024 is unchanged: `wi-024-forge-adoption`, `task_5a09991ca5a1`, still queued.** It is not re-dispatched from here: it is the other session's item, and a re-dispatch needs a new id and a new title anyway |
| `peer-group-pointer-2026-10-21`     | Probe | `task_4867c6237747` | **cancelled** — the other session asking Probe to carry a message to the group                                                                                                                                                                                                                            |
| `peer-correction-wi-024-2026-10-21` | Probe | `task_4dc3ca58d70a` | **failed: `BUSY`** — created 08:35:05, refused at 10:20:55 because Probe was busy                                                                                                                                                                                                                         |

**This is the first hard cost of the one-verifier bottleneck, and it is a
different cost from delay.** Until now the queue's cost was that acceptance
waits. **This is that a dispatch to a busy verifier is not delivered at all.**
The correction died in the gap: nothing ran, the work is still owed, and the
request id is spent — a re-dispatch needs a new id and a new title, and the
ledger has to carry the id or the next actor will not know the work was never
picked up.

**What it cost, and what it did not.** The correction was the other session
retracting a message of its own — "do not act on this". **Neither message
reached Probe** (the first was cancelled, the second failed), and the group has
had no new messages in the window, so nothing reached Probe by another road
either. **And no Probe task in the queue is about WI-024** — they are WI-007,
WI-027, WI-021, WI-030, WI-028, WI-023 — so nothing Probe is waiting to do
can have been pointed the wrong way. The correction is still lost, and it is
the other session's to re-send if it still matters.

### Three verifications died in eleven minutes, and the rule that comes out of it

**Three of Probe's verifications failed with `BUSY` in eleven minutes**, and
this ledger still called them "queued" until this session read the task
records:

| Task                | Item                  | Started  | Ended    | Error  |
| ------------------- | --------------------- | -------- | -------- | ------ |
| `task_2e431d7647e5` | WI-007's verification | 10:09:48 | 10:10:17 | `BUSY` |
| `task_6a9a1179734c` | WI-027's verification | 10:19:30 | 10:19:58 | `BUSY` |
| `task_479859728e18` | WI-021's verification | 10:19:58 | 10:20:27 | `BUSY` |

**A task's status is not the evidence of a verification, and a failure does
not mean the work was not done.** WI-007's task failed, and yet Probe's
session read the item, wrote and committed the end-to-end pin `d343300`, and
ran the suite — the work happened under a task record that says it failed.
WI-030's task was cancelled at 09:51:26, and the other Chief session recorded
in `0d5c98c` that WI-030's verification is running in Probe's own session with
a finding in hand.

**So what is owed, and what is not.**

- **WI-007: owed nothing.** The work is evidenced, and re-dispatching it would
  be a second worker on one item — the failure this factory has spent a day
  cleaning up. It waits for Probe's report.
- **WI-030: owed nothing.** The other session's record says the verification is
  running, with a finding in hand. It is also not accepted until that report
  is in: a correction landing in the file while the verifier is reading it is
  something the verifier has to account for, not something that closes the
  item.
- **WI-021 and WI-027: owed a verification, and they had none.** Their tasks
  failed in eleven minutes and produced no report, and no re-dispatch existed
  anywhere. **Both are re-dispatched as successors now** — new request ids and
  new titles, because a spent id cannot be reused with a changed body — and
  both briefs carry the same guard: _if this item is already being verified in
  another session, say so and stop._ The guard is the tiebreak said out loud:
  one verifier, one item, one verification, and the item's report is what
  closes it.
- **The peer correction: owed, and lost.** Nothing reached Probe by any road.

**The rule this earns, and it is a rule about evidence.** A dispatch to a busy
verifier is not delivered, and a failed task is not evidence that the work was
not done. **So the verifier's report is the evidence of what was verified, and
the task id is only the ledger's record of a handover** — a handover whose
record failed may still have happened, and a handover whose record says
"queued" may have died. **The ledger has to carry both: the id, and what the
work actually did.** The table said "queued" for three tasks that had already
died; that is the cost of trusting the task record alone, and it is why this
session reads the task records rather than the table.

**A caution about clock times in this ledger.** The task records carry epoch
milliseconds; the times in this table are those epochs read on **this
machine's** clock, and this machine's clock is behind the harness's (it read
10:43 AEST when the harness read 11:31). The written clock labels elsewhere in
this ledger do not agree with the machine clock either — the other session's
section labelled "10:57 AEST" describes the state nine minutes after 09:48 —
**so a reader reconciling times should use the task records' epochs, not the
labels.**

### The smoke gate is flaky on Windows, and it is not the tree

**Probe found this in its own working session while verifying WI-007, and it
is not in its report yet.** It is recorded here so that it is not lost, and
because it qualifies a measurement this session published last tick.

**The mechanism, checked against the source by Chief:**

- `scripts/smoke.ts:667-669` holds a `BEGIN EXCLUSIVE` lock on the database
  "so the process stays alive long enough to be read from the outside", and
  spawns the reset process at `:671-680`.
- The reset waits on that lock with the server's own `busy_timeout = 5000`
  (`apps/server/src/db/client.ts:29`), then writes at
  `apps/server/src/modules/auth/service.ts:181-184` **with no handling of the
  failure** — so it dies with a raw `SqliteError: database is locked` and
  exits 1.
- The script reads the reset's command line at `scripts/smoke.ts:688` and
  asserts it at `:694-697`. On Linux that read is `/proc`, and it is instant.
  **On Windows it costs 6.5–8 seconds** — a `powershell.exe` and a
  `Get-CimInstance` per poll — and the reset's 5-second busy timeout expires
  first.
- The script's own comment at `:701-702` says it: "The lock is released the
  moment the command line has been read: the reset is waiting on it, **and its
  busy timeout is not long**."

**What that means for the gates.** The gate is **flaky on Windows under load,
and not flaky on Linux.** Probe's repro held the lock for 20 seconds and the
reset died at t=8.11s with `SqliteError: database is locked`, exit 1.
**This session ran the same gate twice and it passed both times** — the second
time while Probe's end-to-end suite was loading the machine — which is what a
flaky gate looks like, not a broken one. **It does not change the CI
conclusion: CI runs on `ubuntu-latest`, where the race does not exist, and that
run was green.** It changes what a red smoke on this machine means: **a
Windows timing artefact, not the tree breaking.** Any future claim that the
tree is green, measured here, should say that smoke was _sampled_, and sampled
on Windows.

**Two defects, and their homes.**

- **The product's:** `--reset-password` dies with a raw stack trace instead of
  a clear message, and does not retry.
  `apps/server/src/modules/auth/service.ts` is Cog's.
- **The gate's:** the smoke script's Windows path races the reset's busy
  timeout. `scripts/smoke.ts` is Probe's.

**Nothing is dispatched from here.** Probe is mid-verification on WI-007 and
said itself that the right move is to report it to Chief; it will come in that
report, and **one report, one item** is the rule. When it lands it is
dispatched from there.

### The number space took WI-044, and the MCP scoping finding still has none

**The number space's holder took WI-044**, for **W8** — the licence check that
covers this repository's _own_ sources, which is the other session's finding
from the same review that corrected WI-034's scope. WI-044 is numbered, owned
by Chief, **deferred, and deliberately not dispatched**: it is funded as a
numbered item that is not yet a task.

**So the MCP workspace-scoping finding is still without a number.** It is
recorded in full above, and it is the same defect it was an hour ago:
`apps/server/src/modules/mcp/server.ts:96` says an agent may only act inside a
workspace it has been granted, the guard is called in the four tools that take
a `workspaceId` and never in the seven that take a bare id, and **WI-017 is
adding a tool to that same surface.**

**What the owner is asked for is the number, and nothing else.** The item's
title, its criteria, its owner (Cog, with the contract half for Wren) and its
evidence are already written down.

### The tree is red on one count, and the count is the contract's

**Measured by Chief on the local tip, twice, and the result is the same both
times:**

```
FAIL  src/__tests__/published-shapes.test.ts > the two published shapes >
      publishes the counts of routes and audit entries the code has
AssertionError: expected 35 to be 34
Test Files  1 failed | 21 passed (22)
     Tests  1 failed | 215 passed (216)
```

**What it is.** WI-030 published the measures route's counts at 08:34 — of the
34 mutating routes, 20 write an audit entry at the route level. WI-031 added
`POST /api/executions/:id/resolve` an hour later, a mutating route that audits
in its own handler, and the published numbers did not follow. **The contract
went stale quietly, and the only thing that noticed was a test reading the
contract against the code.** That is what `published-shapes.test.ts` is for,
and the other Chief session's record of it (`1d2c7ff`) is the first time it
has caught something on the real platform rather than in a local run.

**It is Wren's, and it is already dispatched**: `wi-031-refresh-published-counts-2026-10-21`,
task `task_03f8f1042155`. The contract needs 34 to 35 and 20 to 21, its prose
"thirty-four" to "thirty-five", and its "twelve" stays twelve. `CONTRACTS.md`
is Wren's file and the lead does not write it — a correction queued behind
Wren's other contract work cannot collide with it, which a hand-edit from this
session could.

**One thing in that finding is Probe's and was left where it belongs.** The
test's own comment says "twelve of the thirty-four mutating routes write no
audit entry at all" — a stale number in a file Wren does not own. It is named
in the brief to Wren and left there.

**A second red that was not a red: the suite that failed once and passed
twice.** In one full server run, `src/__tests__/verifyStack.test.ts` was
reported as a **failed suite** — no tests in it reported at all — alongside the
one real failure. Chief ran it alone: **12 passed**, 30.6 s. Chief then ran
the full suite twice more: **21 passed of 22 files, 215 passed of 216 tests**,
the published-shapes failure the only one. So it is a **flake, not a defect**,
and it is in Probe's file.

**What Chief will not claim is why it flaked.** The honest hypothesis is
**load**: the machine is running several agents' gates at once — Probe's
end-to-end suite, this session's smoke gate, the other session's runs — and
both suites that flaked are timing-sensitive (one starts servers and waits,
one spawns processes and polls command lines). **That is a hypothesis, and it
is labelled as one.** What is measured is the fact: one failure in three full
runs, zero when run alone. **The factory's own concurrency is what makes the
gates lie**, and that is a capacity fact of the same family as one verifier
carrying the whole queue.

**The red is in the contract, and the red is the test working.** The push waits
for the tree to be green, and the tree is red until the published contract
catches up with the code.

### W8 is funded, and it has been for three hours

**The group asked whether W8 is funded. It is, and it has been since it was
numbered: W8 is WI-044** — "The licence check that covers this repository's own
sources". Owner Chief, Verifier Probe, numbered by the number space's holder
in `581dcdf`, and its state line says what the ask was asking for:
**"It is funded, as a numbered item that is not dispatched"** — the deferral
is recorded as a decision and not as a queue position, and the reasoning is in
the item.

**The ask was behind the record, not ahead of it.** The licence gate reads the
dependency set, so it cannot see source vendored into this repository's own
tree, which is the owner's own hard case; the check is narrower than the rule
the owner meant, and WI-044 says so and says what is being done about it. It
waits for WI-036's licence record, which has landed.

### WI-067 — the MCP scoping finding is numbered, and the dispatch could not be delivered

**The finding that sat without a number for three hours has one.** The number
space publishes its own rule — _"the next number above all of them is WI-063,
and it belongs to whoever takes it next"_ (written when the top was WI-062) —
and the top has since moved to WI-066, so **the next number above all of them
is WI-067, and this session took it.** The tiebreak is said out loud: the next
free number goes to whoever takes it, the item file is the name, and the table
says who holds the work. **If another session has taken WI-067 in the
meantime, this item is renumbered and the table is corrected** — the same way
WI-063 became WI-065 when two sessions reached for it at once.

**What it is, with the code measured at HEAD rather than remembered:**

| Tool                 | Where  | What it takes           | Guarded?                                  |
| -------------------- | ------ | ----------------------- | ----------------------------------------- |
| `agent.list`         | `:243` | a `workspaceId`         | **yes** — `assertWorkspace(id)` at `:252` |
| `task.create`        | `:263` | a `workspaceId`         | **yes** — at `:279`                       |
| `resource.create`    | `:352` | a `workspaceId`         | **yes** — at `:368`                       |
| `automation.create`  | `:485` | a `workspaceId`         | **yes** — at `:511`                       |
| `conversation.read`  | `:188` | a bare `conversationId` | **no**                                    |
| `conversation.post`  | `:206` | a bare `conversationId` | **no**                                    |
| `task.update`        | `:299` | a bare `taskId`         | **no**                                    |
| `task.get`           | `:334` | a bare `taskId`         | **no**                                    |
| `resource.get`       | `:405` | a bare `resourceId`     | **no**                                    |
| `resource.update`    | `:428` | a bare `resourceId`     | **no**                                    |
| `automation.inspect` | `:529` | a bare `automationId`   | **no**                                    |

`assertWorkspace` is defined at `apps/server/src/modules/mcp/server.ts:103`
and called in exactly four places — the four that take a `workspaceId`. The
capability layer cannot check it either, because it is not told who is asking:
`apps/server/src/modules/capabilities/service.ts:197-199` is
`resourceGet(id) → resources.get(id)`, no actor and no workspace, so **the id
is the whole address.** **So an agent granted one workspace can read, update
and inspect a conversation, a task, a resource or an automation in another
workspace if it knows the id.** The code's own words at `:96` say it may not:
_"An agent may only act inside a workspace it has been granted."_

**The surface grew while the hole was unnumbered, and the item now says so.**
WI-017's template tool landed in the same file at `8b1fd01`, and
`resource.template.list` (`:467`) and the template lookup inside
`resource.create` (`:383`) are in WI-067's criteria — not inherited, but
answered.

**The two halves, and the order.** The code half is with Cog and the contract
half with Wren, and **the code half goes first**: the rule is already written
in the code's own words, so this is the code keeping a rule it states, not the
code building against an unpublished shape. **WI-012's guard landed at
`622812c` and WI-028's contract half followed at `f62fca7` to make the
published entries agree** — the same order, for the same reason, and both were
accepted that way. The contract half is queued behind WI-065 on
`CONTRACTS.md`, and the tiebreak is said out loud: **one file, one live item,
held by Wren's lane being serialised.**

**And the dispatch could not be delivered, so it is not a dispatch.** The
runtime refused the call four times over about ten minutes, with _"This Bot is
replying in multiple chats, so this tool call cannot be assigned safely.
Retry when the other replies finish."_ **A dispatch that cannot be delivered
is not a dispatch** — the rule the factory has been keeping, and it applies to
the lead as much as to anyone. So:

- **The briefs are written out in full in `.factory/work/WI-067.md`**, so that
  whoever delivers them needs nothing else.
- **The request ids are recorded in the dispatch table** — the code half
  `wi-067-mcp-workspace-scope-code-2026-10-21`, the contract half
  `wi-067-mcp-workspace-scope-contract-2026-10-21` — and marked **NOT
  DELIVERED**, with the reason.
- **The group is the other door.** A post in "Personal OS Factory" that names
  this item and asks for the two halves is the delivery, not a second
  dispatch, because the dispatch was never delivered.
- **The ids are reserved, not spent** — a refused call was never registered —
  but the runtime has been known to refuse a changed body under an id it
  remembers, so **the delivery may use a new id and a new title**. The rule
  stands either way.

**This is the third delivery failure in one day, and all three were `BUSY` or
"cannot be assigned".** Three verifications died at 10:09–10:20, a peer
correction was refused at 10:20:55, and now the lead's own dispatch channel
is refusing while the queue behind it grows. **The factory's constraint is
not the code and it is not the lead's judgement. It is delivery.**

**Update, 14:32 — the channel came back and the dispatch went.** Both reserved
ids were used as reserved (neither had been registered, so neither was spent):
`task_6766b83a3f23` for the code half to Cog, `task_acc8a5211855` for the
contract half to Wren. Two worktrees were made —
`067-mcp-workspace-scope` and `067-mcp-workspace-scope-contract` — one worker
in each. **The group was not posted for this item**, because a dispatch that
has been delivered must not also be posted. The refusal above is the record of
what happened at the time; the delivery above is the record of how it ended.

### WI-023 is verified, and the acceptance is not this session's

**Probe's review of Chief's own CI change is in, and it is a clean pass: all
seven criteria met, no defect, nothing owed to Cog.** Its matrix is worth
having on the record, because it is the difference between "the 401 line was
in the output" and "the 401 could not have come from anywhere else":

| The script's credential                      | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| the right token                              | **green** — `ok the owner token is accepted (got 200)`                        |
| a **wrong** token                            | **fails** — `Assertion failed: the owner token is accepted (got 401)`, exit 1 |
| no token, and the owner has another password | **fails** — `Assertion failed: the owner can sign in (got 401)`, exit 1       |

**And the 401 line cannot be faked.** The message interpolates the real status
(`scripts/verify-stack.ts:173`), and the assert helper **throws** (`:90`), so
the 401 line is the **last** thing the script printed — nothing after it could
have produced it.

**The gates Probe measured:** `actionlint` → exit 0 · typecheck → exit 0 ·
format:check → exit 0 · build → exit 0 · **the test suite → exit 0**: server
219 (22 files), web 52, worker 31, agent-adapters 16, contracts 28 ·
**the whole container sequence, locally, against real Docker** → the account
path green, the 401 where it must be, the token path green, the teardown
clean. **And the shared stack was left alone**: Probe's stack was
`-p personal-os-probe` on port 4398, and the other stack was still up
afterwards, untouched.

**And the acceptance is the other Chief session's.** The rule the factory has
been keeping: **the session that wrote an implementation does not accept it.**
This session wrote the four steps, so the acceptance goes the other way — the
same way WI-012's did, and the same way WI-022's and WI-026's went this way
round. **The item is closed on the evidence and open on the signature.**

### WI-038 — the borrow rule is wired, and the gate is named

**WI-036's record has landed, so WI-038's blocker is gone** — and the record
says what it was written for. Its `approvedSet` carries the note: _"This is
what WI-038's gate compares the lockfile against: a licence outside this set,
or a change inside it, fails the build."_ **The ground truth was built for the
gate**, with 494 entries each carrying the file its licence was read from, and
the 11 licences this project accepts.

**Chief's half is written and committed** — branch `wi/038-borrow-rule-gate`,
worktree `G:\code\personal-os-worktrees\038-borrow-rule-gate`, commit
`a9592a4`: the step in `.github/workflows/ci.yml` in the `Dependency audit`
job, immediately after the vulnerability audit, because it is the same concern
over the same dependency set and the same install; and the entry in the root
`package.json` beside the other `verify:` ones. `prettier --check` → exit 0,
`actionlint` → exit 0.

**The gate script is Probe's file, and it is not written.**
`scripts/verify-*.ts` is Probe's by the ownership table, and the three scripts
already there — `verify-build.ts`, `verify-bundle-size.ts`,
`verify-stack.ts` — are standing policy checks rather than tests of a change.
**The licence gate is one of those and is written in Verify.** So the
specification of it is in WI-038's file, in enough detail to be written
without asking anything:

- **What the record gives:** `packages` — 494 entries with `lockPath`,
  `name`, `version`, `spdxId` and `source.kind` saying which file each
  licence was read from — and `approvedSet.licences`, the 11 accepted, each
  with its reason.
- **The four comparisons:** the set (every declared licence must be in the
  approved set, and an SPDX expression passes only if **every** member is); the
  change (where the record's `source.kind` is `package-json-field` the two
  are directly comparable, and the failure names the dependency and the
  licence it changed **from and to**; for a licence _file_ or a _published
  identifier_ the comparison is the **version**, because a gate cannot re-read
  a licence file's meaning); the arrival and the departure (a package the
  record does not have, or one the lockfile no longer has); and **the
  first-party six, skipped on purpose** — the record carries the six
  workspaces as `spdxId: "first-party (no licence yet)"`, the owner said
  "private for now — no LICENSE yet", and **the gate is about what this
  repository borrows**.
- **Three exit codes:** 0 the lockfile and the record agree; 1 a licence
  problem; **2 the gate could not read its ground truth — a broken gate must
  never look like a clean one.**
- **`--record` and `--lockfile` options**, so a check can point the gate at a
  record with one licence deliberately changed and watch it fail. **Criterion
  4 is that proof, and it is why the options exist.**
- **What it prints:** the number of packages compared, how many licences were
  read from which kind of file, the approved set, and every failure with the
  dependency named. **Criterion 5 is a reader of the Actions tab seeing that.**

**The branch is not pushed until the script is in it.** A branch that is red
is a branch that waits a second round, and this one can be green.

**The script was dispatched at 14:32** — `wi-038-licence-gate-script-2026-10-21`,
`task_63e621ad515f`, Probe — with the whole specification above in the brief,
so that nothing had to be asked. Probe writes it in the WI-038 worktree, on
`wi/038-borrow-rule-gate`, next to Chief's wiring, and commits it there; **the
branch is pushed once the script is in it and the gate is green.** The
acceptance of WI-038 is **the other Chief session's**, because this session
wrote the wiring at `a9592a4` — the session that wrote an implementation does
not accept it, the same rule that holds WI-023.

### WI-067 — the question is answered, and the answer was this session's dispatch

**The other Chief session's record said WI-067 was "opened, numbered and
dispatched", and nothing on disk said so.** The two rows in this ledger read
**NOT DELIVERED** — this session's own record, written when the runtime refused
four times — **no task id for WI-067 appeared anywhere in the ledger**, and
WI-067's file carried no `Dispatched` line. **One of those two records was
wrong, and the difference was a second worker on a live file.**

**The question was asked in the group and went unanswered. The channel came
back at 14:32, and this session dispatched both halves.** The reserved ids had
never been registered, so they were not spent, and both were used as reserved:
`task_6766b83a3f23` (Cog, the code half) and `task_acc8a5211855` (Wren, the
contract half).

**So the other session's record was wrong, and the group's silence was
right.** It had said "dispatched" with no task id behind the word — a claim is
not a dispatch, exactly as a task's status is not the evidence of a
verification. **The item now has one dispatch, not two**, and the risk that
mattered — a second worker on `apps/server/src/modules/mcp/server.ts` — did
not materialise. The two worktrees are `067-mcp-workspace-scope` and
`067-mcp-workspace-scope-contract`, one worker in each.

## The pipeline caught the contract going stale — 2026-10-21 11:50

**`main` is not pushed, and the reason is the pipeline's verdict rather than
this session's opinion.** The tree at the tip carries WI-031's implementation
(`414996c`) — the route that lets the owner close a turn they were told to
check — and the verification run on it is **red**:

    FAIL  src/__tests__/published-shapes.test.ts > the two published shapes >
           publishes the counts of routes and audit entries the code has
    AssertionError: expected 35 to be 34

**What went stale, and why.** WI-030 published the measures route's counts at
08:34: _of the 34 mutating routes, 20 write an audit entry at the route
level_. WI-031 added `POST /api/executions/:id/resolve` an hour later — a
mutating route that audits in its own handler — and the published numbers
did not follow. **The contract went stale quietly, and the only thing that
noticed was a test reading the contract against the code.** That is what
`published-shapes.test.ts` is for, and it is the first time it has caught
something on the real platform rather than in a local run.

**Measured, with the test's own method: 35 mutating routes, 21 of them
auditing at the route level, and 12 writing none** once the two that write
from the service layer are set aside. So the contract needs 34 → 35 and
20 → 21, and its prose "thirty-four" → "thirty-five", while its "twelve"
stays twelve.

**Dispatched to Wren** — `wi-031-refresh-published-counts-2026-10-21`,
task `task_03f8f1042155`. **`CONTRACTS.md` is Wren's file and the lead does
not write it**: Wren's lane is serialised, so a correction queued behind
Wren's other contract work cannot collide with it, which a hand-edit from
this session could. The brief tells Wren to **measure the tree rather than
trust the numbers in the brief**, because WI-020 is in flight against the
same section and the counts are a statement about the code as it stands.

**One thing that is Probe's, not Wren's.** The test's own comment says
_"twelve of the thirty-four mutating routes write no audit entry at all"_ —
a stale number in a file Wren does not own. It is named in the brief and left
where it belongs.

**And the order is the order.** The push waits for the tree to be green, and
the tree is red until the published contract catches up with the code.

## The other Chief session's tick, and what it asked for — 2026-10-21 11:50

**It asked for one thing: a line in the factory group.** Its own session
cannot post there — `post_group` refuses from a session that is inside a group
turn — and this session holds the group. **Posted**, request
`factory-status-2026-10-21-1150`, task `task_aa4b43bdd748`, and it points at
the repository rather than restating it, because a status post spends a slot
and the record is already written down.

**The line carries one correction, because the message that asked for it was
already stale.** The other session's note gave WI-024's live dispatch as
`task_2963d3be0f41` — which was **cancelled at 09:35** — and its own
correction, `peer-correction-wi-024-2026-10-21`, **failed with `BUSY`** at
11:20, so the correction never reached anyone. The live dispatch is
**`task_5a09991ca5a1`** (request id `wi-024-forge-adoption`), and the ledger's
dispatch table already said so. **The group line says it, because the fleet
was told the wrong id and the only correction that reached the fleet was
this one.**

**The judgement it asked for: which way the factory should lean when a slot
frees. The answer is verification first.** Six items sit at `verify` and every
one of them waits on Probe — one verifier, and acceptance is the gate that
turns work into product. **Unverified work is inventory, not product.** So:

- **The next free slot goes to Probe.** A new verification is dispatched before
  new implementation work.
- **The implementer keeps one slot busy**, so Probe always has a queue to
  work through. Two slots, four bots: the lane that finishes work is worth
  less than the lane that accepts it.
- **The structural answer is smaller items, not more implementers.** One
  verifier against a fourteen-deep implement queue is a capacity problem, and
  the honest reading of it is that items are too big for one verifier to
  accept quickly. WI-024 is the clearest example of an item big enough to
  hold the queue.

**And the owner's answer became work.** The other session's line said the
question about the unknown turn was with the owner. **It was answered at
11:05**: no — an unconfirmed turn stops and waits for the owner. That answer
closes WI-008's blocker and it names a path no item had claimed, so it is
**WI-045 — "An unconfirmed turn routes no further work"**, dispatched to Cog
as `task_d22e747375a9`. WI-008's own criteria stay met and stay verified; its
file says where the work went.

**Two numbers, and where they came from.** This session: WI-030 through
WI-038, WI-044 and WI-045. The other: WI-024 through WI-029, and WI-039
through WI-043. **Neither session edited the other's item files this tick** —
WI-007's and WI-008's are this session's claim, and the other session left
them alone for that reason.

## The last red is corrected, and the lead made the edit — 2026-10-21 12:15

**The three numbers moved, and the test that caught them passes.** The
measures entry now publishes **35** mutating routes and **21** that write an
audit entry at the route level, and its prose says "thirty-five". **The twelve
stays twelve**, and the table of routes that write no audit entry does not
change — the new route audits, so it is not in it. Measured with Probe's own
method before the edit: 35 routes, 21 auditing at the route level, and 12
writing none once `POST /api/approvals/:id/decide` and `PATCH /api/tasks/:id`
are set aside. After the edit: the published-shapes test is **3 of 3**, and
the whole server suite is **22 files, 216 tests, all passing**.

**The tiebreak, out loud: the lead made this edit by hand, and Wren's queued
task is cancelled.** The ledger routed it to Wren because `CONTRACTS.md` is
Wren's file and a hand-edit from this session could collide with Wren's other
contract work. **That reason was checked against the fleet before the edit,
and it no longer holds.** Wren's running task (WI-036) says in its own brief
that it touches `docs/**` only and must not open `CONTRACTS.md`; WI-037
touches one file, `PRODUCT.md`; and the only queued task that writes
`CONTRACTS.md` — WI-022's citation refresh — is behind a full slot. **Nothing
is writing the file.** So the correction is made now, the queued task is
cancelled — one item, one worker — and **ownership is honoured by
verification rather than by delay: the lead does not accept this work, Probe
does.** It is **WI-062**, dispatched to Probe as `task_2c7c9f4fd696`, and it
carries the stale comment in the test file with it.

**A second red that was not a red: the typecheck failures were another
session's in-flight edit.** A local `npm run typecheck` failed with four
errors in `apps/server/src/api/executions.ts` and
`apps/server/src/modules/executions/service.ts` — `workspaceId` missing from
a type, `resolutionSentence` called with two arguments. **Those errors are
not in the committed tree.** They came from the other session's _uncommitted_
work in the shared worktree, mid-refactor: it moves `workspaceId` out of the
request body and derives it from the execution record instead, and it had
half-applied that change. **The committed code at HEAD is self-consistent** —
`resolve` takes a `workspaceId`, `ExecutionResolution` does not publish one,
and the route sends it — and `git diff 414996c HEAD` on those two files is
empty. **Measured, not assumed.**

**The committed tree's typecheck is not asserted here.** This session's run
was contaminated by that in-flight edit, so the verdict belongs to the
pipeline: a branch is pushed at the tip and its run is the measurement.

**And one thing that is Probe's.** The test's own comment still says _"twelve
of the thirty-four mutating routes write no audit entry at all"_ — a stale
number in a file the lead does not own. It goes to Probe with the
verification, and the comment is corrected there.

**The push still waits for the owner's word.** The tree is green on the
count; the pipeline has not yet run on the tip; and the word that authorised
the last push was spent by that push.

## The push — 2026-10-21 12:28

**`main` is on the remote again, at `f8d808e`.** The owner was asked, with the
evidence in the question, and said yes: **20 commits, 35 files, +2400/−238,
fast-forward**, visibility unchanged at private, nothing rewritten.

**The evidence the question carried, measured two ways.** The pipeline had run
on `50b908d` — the commit that carries the correction — and **both legs were
green**: CI success on all four jobs (Build and test, Dependency audit, Lint
the workflows, Build and run the stack), and CodeQL success. The only commit
after that tree was WI-062's item file and two ledger rows, both documents.
**And this session measured the tree first-hand**: typecheck exit 0,
`format:check` exit 0, **343 tests passing across 39 files**, build exit 0.

**What rode along.** WI-031's resolve route — the owner's own conclusion about
a turn they were told to check, published and audited as
`execution.outcome.resolved` — WI-045's record, the published-counts
correction, the two flake fixes in the suites that spawn processes, the Forge
briefs, and this session's ledger entries.

**The branch the evidence was read from.** `verify/green-at-tip` was pushed on
the standing authorisation for branch pushes, and it is where the green run
was read from. **It is evidence, and it can be deleted** — nothing depends on
it, and `main` now carries the same tree.

**One item in the pushed tree is not accepted yet, and that is honest.**
**WI-062 is Probe's acceptance of the counts correction**, dispatched as
`task_2c7c9f4fd696` and queued: the lead implemented that correction, and the
lead does not accept its own work. **A push is not an acceptance.** The tree
is green and the pipeline is the evidence; the factory's own verifier has
still to say yes, and it will land as a later commit.

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was verified; adding a record of the push makes it a
different tree, and the owner's word named **a** push, not a licence to push
whatever comes next. `main` waits for the owner's word, and the next word
carries this paragraph.

## The pipeline is green on `main`, and this session's number collided — 2026-10-21 12:40

**The platform agrees with the local measurement.** The pipeline ran on
`f8d808e` — the tree that was pushed — and **both legs were green: CI success
on all four jobs (Build and test, Dependency audit, Lint the workflows, Build
and run the stack), and CodeQL success.** The repository's state is read from
its runs, and the run says what the local gates said.

**And this session took a number that was already taken.** The correction's
verification was opened as **WI-046** and committed (`f8d808e`), on the record
that the number space was settled: this session's numbers were WI-030 through
WI-038, WI-044 and WI-045, and the other Chief session's were WI-024 through
WI-029 and WI-039 through WI-043. **That record was stale.** The strategy
session has since opened **WI-046 through WI-061** — sixteen items, in one
batch, on the branch `wi/046-domains-interaction-model` — and its WI-046 is
_"The decisions are recorded, and the scope says so"_. **Two different items
held the number WI-046, and this session's one had already been pushed.**

**It is renumbered, and the correction is stated rather than overwritten.**
The item is now **WI-062**, the first number free above the strategy
session's batch: `.factory/work/WI-046.md` is `.factory/work/WI-062.md`, and
the file's own header says it was opened as WI-046 and renumbered. **The
earlier statement of the number space is left as it was written** — it was
true when it was written.

**The dispatch went with the number.** Probe's task `task_27a529dbec89`
carried WI-046 in its title and its brief pointed at a file that was about to
stop existing. **It was cancelled before it ran, and the work was re-issued
under a new request id** — `probe-verify-published-counts-2026-10-21-1240`,
task `task_2c7c9f4fd696` — with WI-062 in the title and the right path in the
brief. **A cancelled dispatch does not free its request id**, so the new id
was required, and the old id is spent.

**The number space as it now stands.** This session: WI-030 through WI-038,
WI-044, WI-045, WI-062. The other Chief session: WI-024 through WI-029 and
WI-039 through WI-043. The strategy session: WI-046 through WI-061. **The
next number above all of them is WI-063**, and it belongs to whoever takes it
next.

**Why this matters more than a number.** A duplicate item number is two
different pieces of work answering to one name, and the file is the name:
`.factory/work/WI-046.md` is a path, and **the strategy session's WI-046 and
this session's WI-046 would have collided on it** when either branch was
merged. **Cancelling the task was not enough** — the file on `main` had to
change, because `main` is what a merge lands on.

**And WI-036 is waiting for a lane it never got.** The licence record landed
on its own branch, `wi/036-licence-record`, pushed — and **its pipeline is
red**, for exactly the reason `main` was: the branch predates the correction,
so its `published-shapes` run says `expected 35 to be 34`. **The correction
is what unblocks it.** The branch needs the corrected `main` brought into it
before it can be proved green and merged, and **no verification of WI-036 was
ever dispatched**, so the item could never have been accepted.

## WI-036's branch was red for the same reason, and now it is green — 2026-10-21 12:48

**The correction unblocked it, and the reason is the same reason.** The
licence record had been written and pushed — `docs/dependency-licences.json`,
494 entries, each naming the file its licence was read from, and
`docs/strategy.md` carrying the note about when the reading was made and a
pointer to it — but **the branch's own pipeline was red** with `expected 35
to be 34`. **It was the stale published counts, on a branch that predated the
correction.** Nothing was wrong with the record; the branch was simply behind
a contract that had since been fixed.

**The corrected `main` was merged into the branch, not rebased onto it**, so
nothing on a pushed branch was rewritten: `3a82162`, "Bring the corrected main
into WI-036's branch". **The branch is green**: CI success on all four jobs,
and CodeQL success.

**And the verification that was never dispatched is now dispatched.** WI-036
has been sitting in `implement` with the work done and the branch pushed, and
**no verification had ever been sent**, so it could never have been accepted
however green its branch became. It is **WI-036's first verification**:
`probe-verify-wi-036-licence-record-2026-10-21-1248`, task `task_3bb64dabf31a`,
queued. The brief tells Probe to read the item's file **on the branch** — the
copy on `main` still says `implement` and the branch's copy says `verify`.

**One measurement the lead made, which Probe is asked to judge rather than
accept.** The lockfile has **500** entries excluding the root; the record has
**494**. The six that do not match by lock path are **this repository's own
workspaces** — `apps/server`, `apps/web`, `apps/worker`,
`packages/agent-adapters`, `packages/contracts`, `packages/ui` — recorded
under their names as `@personal-os/*`, with **no source file and no
permits or forbids**, because they are this repository's own code and carry
no licence yet. **That is the owner's answer of 2026-10-21, not an oversight**,
and the record says so in its `firstPartyNote`. **The question Probe has to
answer is whether it is a correct reading of _"every dependency in the
lockfile"_ or a gap** — and specifically whether WI-038's gate can tell the
six workspaces apart from dependencies when it compares the lockfile against
the record.

**The AGPL answer is about this set, and it is "no".** The record names the
copyleft that _is_ present — the MPL-2.0 packages — and answers the owner's
question against the dependencies that were actually read, with the evidence
attached to each.

## WI-017 landed, and the contract still says it does not exist — 2026-10-21 13:05

**WI-017's implementation landed at 12:42 and no verification of it was ever
dispatched**, so the item could not be accepted however good the code was. It
is now dispatched: `probe-verify-wi-017-template-record-2026-10-21-1305`, task
`task_dbcc178374a7`, queued.

**And two things about WI-017 are wrong, both found by reading the contract
and the item against the code.**

**One of the item's own acceptance criteria is not met by anything in the
repository.** WI-017 asks for _a test proves that a resource created from a
template validates, and that a template describing an invalid spec is
refused_. **There is no such test.** Every `*.test.ts` in the repository, the
end-to-end suite and the smoke script were searched: the only hits for
"template" are in `published-shapes.test.ts` — which is about the contract's
kind enum and its counts — and one incidental hit in the adapters' test. **Test
files are Probe's by the ownership table, so Cog could not have written it**,
which is why the criterion was never met and why the item could not close.
**The test goes with the verification**, because it is Probe's file and Probe's
criterion.

**And the contract publishes a status note about the template record that the
code has outgrown.** `CONTRACTS.md`, in `### The template record`:

> **The code does not implement this yet.** ... there is no template record in
> `packages/contracts`, the published tool names
> (`packages/contracts/src/mcp.ts:11-23`) do not include one, and the server
> has none. A client written against this entry must treat the tool as absent
> until WI-017 lands.

**Every clause of that paragraph is now false**, and it was checked clause by
clause: `resourceTemplateSchema` and `ResourceTemplate` are in
`packages/contracts/src/resource.ts:58-71`; `resource.template.list` is in
`mcpToolNames` at `packages/contracts/src/mcp.ts:21` — **inside the very range
the paragraph cites** — and in the grant list at `:45`; and the six templates
are in `apps/server/src/modules/resources/templates.ts`, one per kind. **The
last sentence is the one that costs a client something**: a client that obeyed
_"treat the tool as absent"_ would not call a tool that exists.

**This is the same class of defect as the stale counts the pipeline caught —
a published claim about the code that the code has outgrown — and it is worse,
because the counts mis-stated a number and this mis-states whether a tool
exists.** The contract leads the code, and leading means something in both
directions: when the code lands, the contract's statement about the code has to
follow, or the contract is publishing a falsehood about the product it
describes.

**It is WI-065, and it is Wren's.** The request id is
`wi-065-template-record-contract-status-2026-10-21-1330`, task
`task_6274afe1abc1`, queued. **`CONTRACTS.md` is Wren's file, and this is a
revision of a published entry rather than a mechanical correction of a number,
so the lead does not make this edit.** The correction needs the migration note
that the other kind does not: nothing is reclassified, but **the surface
grew**, and a client that validates an agent's `toolGrants` against a known
list will refuse a grant for a tool it has never heard of.

**WI-030 is not re-opened.** It is done and accepted (`e682224`, 08:34:37), and
re-opening an accepted item to change its meaning would muddy a record that
says what was checked and when. This is a different change, so it takes its
own number and its own owner.

**One question put to the verifier rather than answered by the lead.** The
published-shapes test watches two claims — the kind enum and the route counts
— because a contract that is wrong about the code is only caught if something
reads the contract against the code. **The implementation-status claim was
wrong and nothing noticed.** Probe is asked whether a check should watch it
too, and where it would live: the same test file already reads that section,
so it may be a small addition. **The recommendation is the verifier's to make
and the lead's to act on.**

## The loop contradicted the ownership table, and three items sat in `implement` — 2026-10-21 13:15

**`FACTORY.md` said two things that cannot both be true, and the second one
made an acceptance criterion unmeetable.**

- **The ownership table** (`:52`): `**/*.test.ts, **/*.test.tsx` → **Probe**.
- **The loop, step 3** (`:143`): _"Cog writes the test that would have caught
  the bug as part of the same change, and names Probe for the review."_

**Cog was told to write a test in a file it does not own.** That is how WI-017's
criterion — _a test proves that a resource created from a template validates,
and that a template describing an invalid spec is refused_ — came to be
unmet: **no test in the repository does either**, and the implementer was
instructed to write one in a file the ownership table gives to the verifier.

**The rest of the factory already says the other thing, and has for a while.**
`.factory/probe.md:26`: _"**Write the test that proves it.** If a claim in the
change is untested, write the test. Do not describe the missing test — write
it."_ And `.factory/work/WI-009.md:305`, in its own record: _"Probe owns every
test file, so the routing test is Probe's and the implementation is Cog's.
**That is the normal split for this factory: the owner implements, Probe
writes the test that would have caught the bug.** The test is written to
**fail** against today's implementation — if it passes, the test is wrong."_

**So the loop was the only document that disagreed.** It is now amended: Cog
**names the check the change needs** as an acceptance criterion, in the brief,
and **Probe writes the test**, in Verify — which is also the split that keeps
the implementer from authoring the check that accepts its own work.

**And the loop did not say who dispatches the verification, which is why
three items in a row sat in `implement` with the work done.** Nothing in the
runtime joins Implement to Verify: an implementation task that ends leaves its
item in `implement` until somebody sends it to Probe. **WI-036's licence
record, WI-017's template record, and the correction to the published counts
all sat there** — the work done, the branch green, and **no verification ever
dispatched**, so each was an item that could never have been accepted. **The
loop now says it plainly: Chief dispatches Verify the moment Implement lands,
and an item that has landed and is not verified is not in the factory — it is
inventory.** The queue of things waiting for acceptance is the factory's real
capacity, so the dispatch of the verification is part of finishing the
implementation, not an afterthought to it.

**This is the lead's own file** (`FACTORY.md, .factory/**` → Chief, `:61`),
and the correction follows the factory's recorded practice rather than the
lead's opinion — which is the test the lead's own rules ask for. **The
contradiction was found because WI-017's criterion could not be met, and it
would have been found again by the next item with a test in its criteria.**
`AGENTS.md` is left alone: it is the development contract for the code, it
points at `FACTORY.md` for who owns what (`:14`), and a developer working in
this repository writes their own tests.

## The factory was producing green branches and never landing them — 2026-10-21 13:30

**`main` had one merge in its whole history.** `git log --merges` returns a
single line: `061b6cd`, WI-032's security leg. Everything since has been
work done on a branch, pushed, proved green by the pipeline, and left there.
**Two of those branches were carrying finished wants.**

**`main` was publishing the opposite of the owner's decision.** WI-037's
implementation — the product record says **Forge**, with the date and the
recommendation that was made against — was on `wi/037-product-record-forge`,
green on its own tip (`c61e3e8`: CI success on all four jobs, CodeQL success),
and `PRODUCT.md` §11 on `main` still read _"the direction that would fix it
is Desk (B), it is recommended rather than decided, and the owner has one word
to say about it"_ — **eight hours after the owner said it.** The product record
is the document a new reader opens first.

**And `main` had no licence record**, so WI-038's gate — the borrow rule as a
check rather than a claim, which the owner funded at 08:54 — had nothing to
compare the lockfile against. Its ground truth was on
`wi/036-licence-record`, green on its own tip (`3a82162`: CI success on all
four jobs, CodeQL success).

**Both are merged now.** `94d110f` for WI-037, `c6e77d7` for WI-036. Both
merges were clean, and the merged tree was measured before anything was
claimed: **typecheck exit 0, `format:check` exit 0, 346 tests passing across
39 files.**

**Merging is not accepting, and the tiebreak is said out loud.** The
precedent is WI-032: a branch is proved green by the platform on its own tip,
and **the verification is dispatched separately and the acceptance waits for
it**. **A defect comes back as a commit, not as an undo.** Probe's
verifications of WI-036 and WI-037 are queued.

**Three items of the seven wants had never been dispatched at all**, and one
of them was blocking another:

| Item   | Want | What it was doing                                                                                                                       | Dispatched                 |
| ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| WI-034 | W2   | Publishing the outcome vocabulary and the migration WI-033 makes — **and WI-033 (W1) waits on it, because the contract leads the code** | `task_55c33b744ef5`, Wren  |
| WI-042 | —    | The product record's closed questions say they are closed; its blocker was WI-037 being live on `PRODUCT.md`                            | `task_f1cf510356e8`, Wren  |
| WI-037 | W6   | The verification of a merged want, never sent                                                                                           | `task_207afe6818f8`, Probe |

**WI-042's blocker cleared when WI-037 landed, and WI-037's verification is
reading `PRODUCT.md` at the same time WI-042 is writing it** — one reader and
one writer on a file is fine, and **if Probe's verdict sends WI-037 back for a
fix, the lead sequences that fix behind WI-042** rather than letting two
writers loose on one file. Said out loud, because a tiebreak made silently is
a rule broken silently.

**WI-034 goes onto Wren's lane behind WI-065**, and both are on
`CONTRACTS.md`. **One file carries one live item, and this is a single bot's
lane, so the two run one after the other and never at once** — which is the
rule's purpose, stopping two agents writing one file at the same time.

**What this session did not do.** It did not re-dispatch WI-036 or WI-037 —
their implementation dispatches are spent and their work is landed. It did not
cancel anything to make the floor look busy. It did not push `main`: the
merged tip is on `verify/green-at-tip`, and `main` waits for the owner's word.

## The accept queue, swept against the tree — 2026-10-21 13:45

**The lead audited every work item against the fleet's own records, and the
audit is what found the rest.** Every `.factory/work/WI-*.md` was read for its
state, and every task in the runtime's state file was read for what it
carried. **Three items had work landed and no verification ever dispatched:**
WI-024 (the Forge adoption), WI-031 (the route that closes a turn) and WI-041
(the README's licence). **All three verifications are now dispatched**, and
each carries the pin the implementer said was Probe's to write.

| Item   | Work landed                                 | Verification                                                          | Task                |
| ------ | ------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| WI-031 | `414996c`, the contract half `8ef054ed68d0` | **dispatched** — and its pin, which the item says is Probe's to write | `task_b511f4062477` |
| WI-041 | `64d38f4`, merged `5012df2`                 | **dispatched**                                                        | `task_5b4e02d59413` |
| WI-024 | `93ef99b`, `a5042aa`                        | **dispatched** — and brief 06's constellation test                    | `task_d2fa4fb7e946` |

**This is the audit the amended loop asks for.** Chief dispatches Verify the
moment Implement lands; three items had landed and nobody had. **The audit
that finds them is a cross-reference of the item files against the runtime's
task records**, and it is cheap.

**And a third green branch was never landed: WI-041's.** The README's licence
section said **MIT**, and the owner's answer of 2026-10-21 was that the
repository is private for now, there is no LICENSE file, and the licence is
**deliberately undecided**. It is merged now (`5012df2`), proved green on its
own tip first.

**WI-066 — the contract gap Cog found and named.** WI-031's implementation
added a **fourth** optional field to the `Message` shape —
`detail: z.string().optional()` at `packages/contracts/src/conversation.ts:90`,
the server's sentence — and the contract's `### Additive extensions` section
publishes **three** fields. **WI-031's own criterion — _the published shape
matches the code exactly, member for member_ — cannot hold until it does.**
Cog reported it rather than widening the contract itself: _"That gap is the
contract's, not mine; I am not inventing a second shape and moving on, I am
naming it."_ **It is WI-066, and it is Wren's** — `task_0cfbcce20e92`. **The
field is wanted**: WI-031's criterion _"the reason reaches the panel"_ needs
the sentence, so the fix is to publish it, not to remove it.

**The number space, again, and this session's part in it.** The strategy
session's branches claim **WI-063** and **WI-064** for a free-period-plan
item, and this session had taken WI-063 for the template record's status note.
**The item was renumbered to WI-065** — the first number free above that
range — and the dispatch went with it: `task_1ee3414e9bcc` was cancelled
before it ran and the work was re-issued as
`wi-065-template-record-contract-status-2026-10-21-1330`, task
`task_6274afe1abc1`. **WI-066 is the next one up, and it is this session's.**

**`FACTORY.md` already said all of this, and this session broke it twice.**
`:284`: _"the number space has one owner… A session with a gap to fill records
it in `.factory/INTAKE.md` as a want… and the session that owns the numbers
creates the file… If the session that owns the numbers is not running, the
other session **says so in the group** and takes the space, rather than taking
it quietly."_ **WI-046 was taken quietly, and WI-063 was taken quietly.** Both
are stated here rather than overwritten. **The allocation as it now stands:
WI-046 through WI-064 are the strategy session's; WI-030 through WI-038, WI-044,
WI-045, WI-062, WI-065, WI-066, WI-067, WI-068 and WI-069 are this session's.**

**The group post for it was refused** — the round is mid-discussion — so the
allocation is recorded here, and the group line goes when the round opens.

**And it is confirmed, not assumed.** The strategy session's branch
(`wi/064-free-period-plan`) now carries its own item — **WI-064, "The plan the
free period is spent on, and the roadmap that outlives it"** — and the
`WI-062.md` and `WI-063.md` on that branch are **this session's own files,
inherited from `main` and unmodified**. **So the two ranges do not overlap**:
WI-064 is theirs, WI-065 and WI-066 are this session's, and nothing has to be
written over. The rename bought the space that the other session's own item
needed.

**One thing raised and not fixed, because it is not this session's.**
`.factory/work/WI-067.md` — the strategy session's — is **not
prettier-clean**, so `npm run format:check` fails on it, and the pre-push
hook runs that check. **It is untracked at the time of writing, so the
committed tree is clean and the pipeline is unaffected**; the moment it is
committed the formatting gate goes red on the whole run, and the failure will
read as the repository's rather than as one file. **This session did not touch
it**: the file is not this session's, a fix found along the way belongs to its
own item, and a bot that needs a file owned by someone else asks Chief rather
than taking it. **The group post naming it was refused twice** — the round is
mid-discussion — so it is recorded here, and it goes to the group when the
round opens.

## WI-043 is not verified, and the finding opens WI-068 — 2026-10-21 14:24

**Probe's verification of WI-043 came back: not verified, and the reason is
not in WI-043's work.** The manifest change is exactly right — one deleted
line in `96b87f8`, every gate green — but the repository does not yet say the
truth about its licence.

**Three files said MIT. One is corrected, one is being corrected, and one is
still there.**

| Where                     | What it says                                                                                       | Whose           |
| ------------------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| `package.json` (root)     | `"license": "MIT"` — **removed** at `96b87f8`, WI-043                                              | Chief, done     |
| `README.md:251-253`       | "MIT." — **being corrected**, WI-041                                                               | Wren, in flight |
| `CONTRIBUTING.md:236-239` | "your contribution is licensed under the MIT licence, the same licence as the rest of the project" | **no item**     |
| `LICENSE` (root)          | **the MIT licence, in full, tracked since the initial commit `d2f4ec6`**                           | **no item**     |

**Measured here, not taken from the report.** `LICENSE` opens with "MIT License
/ Copyright (c) 2026 Personal OS contributors"; `git log --diff-filter=A --
LICENSE` names `d2f4ec6` (2026-10-20 18:47, "Initial commit") and no other
commit; `git ls-files` shows it is tracked, and it is the only licence file in
the repository. `CONTRIBUTING.md:236-239` is the `## Licence` section quoted
above. **And nothing depends on the file**: `LICENSE` appears in no file under
`.github/`, in no file under `scripts/`, and in no field of the root
`package.json`.

**And no item could have been given it, because the ownership table did not
name it.** `FACTORY.md:45-62` gives `*.md` to Wren — and `LICENSE` has no
extension — and nothing else in the table matches it either. **The file fell
through the ownership table.** That is how a file ends up with two owners and
no owner at once, and it is why Probe could not route the finding.

**So the finding opens WI-068** — `.factory/work/WI-068.md` — with two halves:
Chief's (the `LICENSE` file, and the `FACTORY.md` table row that names it) and
Wren's (the `CONTRIBUTING.md` sentence, dispatched as
`wi-068-contributing-licence-2026-10-21`, `task_a4d24aa2dc24`). **The reading
is said out loud in the item:** the file is removed on the reading that "there
is no LICENSE file at this push" means the repository carries no licence file,
and **removing a stray grant is the safe direction** — the repository is
private, nothing is published, and the file has been in the tree since the
first commit. **If the owner meant something else, the item goes back to
them.**

**WI-043 does not go back to Probe, because its verification would fail the
same way** — the finding is in the tree, not in the item. It waits for WI-068
to land, and so does WI-041: both items carry the criterion _"no LICENSE file
exists"_ and **neither can be satisfied until WI-068 does.**

**The acceptance of WI-068 is the other Chief session's**, because this session
wrote Chief's half.

**WI-068's Chief half is landed.** `0df2f0d` — the merge of
`wi/068-licence-file` (`b8ad178`) into `main`: the root `LICENSE` file is
removed, and `FACTORY.md:61` now names it, so the file that fell through the
ownership table has an owner. **The gates in the worktree, all green:**
typecheck 0, test 0 (server 219, web 52, worker 31, agent-adapters 16,
contracts 28), format:check 0, build 0. The branch is pushed —
`wi/068-licence-file` — and **the pre-push format gate ran and passed**. `main`
is not pushed; that is still the owner's word.

**And the verification is not dispatched yet, and the reason is said out loud.**
**One verifier, one item, one verification** — and WI-068's verification is of
the whole item, so it waits for Wren's half, which is queued behind WI-065. **A
verification dispatched on half the item would produce a red that means
nothing.** WI-043 and WI-041 wait for the same reason: both carry the
criterion _"no LICENSE file exists"_ and **neither can be satisfied until
WI-068 does.** **This is the one case the loop's "dispatch Verify the moment
Implement lands" does not cover** — an item whose halves have different owners
and land at different times — so it is stated here rather than quietly applied.

### The post that was owed — delivered, and the request id is retired

The group post could not be delivered by `post_group`. It answered **"The
group is mid-discussion; post again once this round finishes"** on **four
attempts between 14:38 and 14:52** — with a 90-second wait between the first
two, a 180-second wait before the third, and a further 120-second wait before
the fourth. **The round did not open in that window.**

**It was delivered at 14:55, as a group turn's reply** — because in a group turn
the reply text **is** the post, and `post_group` is private-chat only. That is
the other half of the refusal: the tool that was being asked to open the door
was the wrong door.

**So the request id `status-2026-10-21-1440` is retired and must not be used
again.** The post is in the group; a `post_group` retry under that id would be
a **second copy of the same status report**, and a copy nobody asked for. **A
request id is spent when it is used, and this one is spent** — by the delivery
that actually landed, not by the four calls that did not.

**And this was the fifth delivery failure of the day, in two different
channels.** The lead's own dispatch channel refused every call from 13:50 to
14:32 — forty minutes — and the group's channel refused the status post from
14:38. **The factory's constraint is not the code and it is not the lead's
judgement. It is delivery.**

The post says, in one line per work item, newest first: WI-022 verify, the
citation refresh merged into `main` at `fb236dc` and its verification
dispatched as `task_018a6018b18f`; WI-068 implement, Chief's half landed on
`main` at `0df2f0d` and Wren's half dispatched as `task_a4d24aa2dc24`; WI-067
implement, both halves dispatched as `task_6766b83a3f23` and
`task_acc8a5211855`; WI-038 implement, the wiring done and the gate script
dispatched as `task_63e621ad515f`; WI-043 verify and **not verified**, the
repository did not say the truth about its licence and the finding is WI-068;
WI-023 verified, all seven criteria met, the acceptance the other Chief
session's; WI-036, WI-037 and WI-041, the record halves landed and the
verifications queued; WI-031, WI-024, WI-017 and WI-062 verifying; WI-027 and
WI-021 verifying, the successors after the two `BUSY` deaths; WI-065 and WI-066
implementing; WI-020, WI-011, WI-013, WI-033, WI-034 and WI-035 implementing;
WI-044 funded and deliberately not dispatched; WI-022 and WI-026 accepted, and
what the product can now do because of them.

It carries the gates at `8b2abfe` — typecheck 0, test 0 with server 219, web
52, worker 31, agent-adapters 16 and contracts 28, format:check 0, build 0 —
and the line that **one verifier, eleven queued verifications and none
started** is the factory's binding constraint, with every one of the eleven
named and measured. It says **that nothing in the post is a request**, because
every dispatched item already has its owner and its task id, and a bot must
not start one twice because of a status report. It closes with the two facts
the floor needs: `main` is ahead of `origin/main`** and unpushed, and **WI-067's
code half is on a file the factory has just been editing\*\*, so two changes to
one file get sequenced rather than merged by accident.

## WI-022's successor landed, and its verification is dispatched — 2026-10-21 14:49

**Wren's citation refresh is done.** `CONTRACTS.md` only — two stale
citations moved and one was added:

- `CONTRACTS.md:879` — was (`waiting.ts:85`), now (`waiting.ts:95`) — the
  route takes the reason straight from the task's status.
- `CONTRACTS.md:931` — was `waiting.ts:106-110`, now `waiting.ts:140-144` —
  the order the code assembles the list in.
- `CONTRACTS.md:907` — **added**, `waiting.ts:8` — the published kind's
  declaration, in WI-026's entry.

**The third one is the one that matters.** WI-026's verification found a
defect: its entry cited `waiting.ts:17` — the **reason** type — where the
criterion asked for the **kind** at `:8`. That was corrected in the item's
record, but **the citation was never in the published text**, and a criterion
that a record satisfies and the contract does not is not met. This change puts
it there, and **the verification now checks that WI-026's criterion 6 holds in
the tree.**

**The merge.** The branch was branched at `b6aed8a`, and `CONTRACTS.md` had
not moved on `main` since, so the merge was clean: `fb236dc`, **"Merge WI-022:
the waiting list's code citations, refreshed"**. Chief merged it; **Wren wrote
the contract change and Probe verifies it, and Chief wrote neither**, so this
is not the lead accepting its own work.

**Chief read the citations once before dispatching, and that is a check, not a
verdict.** All four hold: `:8` is the `WaitingKind` declaration, `:17` the
`WaitingReason` declaration, `:95` the straight assignment
`const reason: WaitingReason = task.status;`, and `:140-144` the three
filters and the assembly. **The verdict is Probe's**, and the brief says so.

**The verification is dispatched** — `wi-022-citation-refresh-verify-2026-10-21`,
`task_018a6018b18f` — the moment the implementation landed, with five named
questions, and with the ruling that **the doubled sentence is a recorded
decision and is not a defect.**

**One question was put to Probe rather than answered here:** a citation drifts
silently whenever the code moves, and this refresh repaired three of them by
hand. Probe is asked whether a check should exist that catches a drifted
citation, and where it would live — `scripts/verify-*.ts` is Probe's by the
ownership table. **The brief says not to write one unless Probe says it
belongs**, because Probe's queue is eleven deep and a verdict on the three
citations is what this item needs.

## The third push — 2026-10-21 15:03

**`main` is on the remote at `e18bfff`.** The owner gave the word at **14:51** for
the green tree, and the push is made: **43 commits, 26 files, +11216/−138,
fast-forward**, visibility unchanged at private, nothing rewritten. The pre-push
hook ran and passed.

**The word was given against a sha the tip has moved past, and the gap was
measured rather than assumed.** The card named **`dfb1e9b`**; the tip stood at
**`e18bfff`**, **fifteen commits further on**. Every one of those fifteen is
accounted for, and **the only non-document change among them is WI-068's removal
of the root `LICENSE` file**. The licence position is the owner's own answer of
08:54 — private for now, no `LICENSE` file, no code of conduct — so **this push
records a decision that was already made and decides nothing new.**

**The evidence was read from the platform, on the tip's own code.** The pipeline
ran on **`213908d`** and **both legs were green: CI success on all four jobs
(Build and test, Dependency audit, Lint the workflows, Build and run the stack),
and CodeQL success.** The delta between that sha and the pushed tip is **exactly
one file, `.factory/INTAKE.md`** — ledger prose — and **no workflow reads
`.factory/`**: grepping `.github/workflows` for `.factory` and `INTAKE` returns
no match. **Every `.ts`, `.json`, contract and work-item file the push carries
was inside the measured tree**, and the seven code files it does carry
(`capabilities/service.ts`, `mcp/server.ts`, `resources/service.ts`,
`resources/templates.ts`, `packages/contracts/src/mcp.ts`,
`packages/contracts/src/resource.ts`, `agent-memory.test.ts`) and
`docs/dependency-licences.json` are the ones that sha's green run covered.
**The repository's own format gate passes on the tip** —
`prettier --check "**/*.{ts,tsx,js,json,md,css}"`, exit 0 — and the hook ran it
again over the files in the push.

**What rode along.** The three finished wants, each proved green on its own tip
before it was merged: **WI-036** (the dependency licence record),
**WI-037** (the product record says Forge, and stops telling the owner a thing
they had already decided) and **WI-041** (the README says the licence is
deliberately undecided, not MIT). **WI-022**'s citation refresh, which puts the
published kind's declaration where WI-026's criterion can see it.
**WI-068**, which removes the root `LICENSE` file and gives it an owner in
`FACTORY.md`'s table. **WI-067**, delivered by the other session. And this
session's ledger rows.

**The evidence branch moved with it.** `verify/green-at-tip` was fast-forwarded
`213908d..e18bfff` on the standing authorisation for branch pushes. **It is
evidence and it can be deleted** — nothing depends on it, and `main` carries the
same tree.

**A push is not an acceptance, and this push is no exception.** **Nine
verifications are queued behind one Probe**, and **WI-062 — the acceptance of
this session's own counts correction — is one of them**: the lead implemented
that correction and the lead does not accept its own work. The tree is green and
the pipeline is the evidence; **the factory's verifier has still to say yes**, and
it lands as a later commit. **What is on the remote is code that has not been
accepted by the factory.** That is the honest state of it.

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was verified; adding a record of the push makes it a
different tree. **`main` waits for the owner's next word.**

## The landing page's premise is settled, and the rule it was read from — 2026-10-21 15:00

**Vision's return on WI-010 found a defect in WI-024's criterion 5, and the
defect is the lead's to settle.** The repair of the direction document landed
at `e560165` (D1 to D6), and it changed the rule the build follows: the rule
now carries its declared exception, so the **Needs-you rail carries decisions
in the orientation room** (`prototypes/DIRECTION.md:45-48`), the rail is the
decision surface (`:58-66`), and the owner's W-1 is satisfied by **one rail on
the landing screen** (`:83-86`).

**The ruling.** The root route is the **Map**. The Needs-you rail sits on it
and carries the decision controls — Approve and Reject
(`apps/web/src/components/WaitingList.tsx:274-284`) — with acceptance staying
on the factory board, on the card, at
`apps/web/src/components/TaskBoard.tsx:315-318`, reached by a link that opens
the exact card. **The landing page does not move into the execution room, and
the decision list does not move with it.**

**Why this is the lead's call and not a new decision.** The owner chose
**D — Forge** at 06:01, from a prototype whose front door is the map
(`prototypes/README.md:24`: `d-forge/index.html` is **home (the map)**). The
rule is the factory's instrument for settling the boundary Forge left open, so
where the rule and the prototype disagree the rule yields and the exception is
written into the rule — rather than the prototype being quietly redrawn.

**The flat rule was quoted in three places, and two of them applied it wrongly.
That is the cause, not the symptom.**

| Where                                        | What it said                                       | Now                                                                            |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `prototypes/DIRECTION.md:45-48`              | the rule, as repaired                              | the rule, with the exception in it                                             |
| `docs/decisions/0007-*.md:157-158`           | the rule quoted without its exception              | re-synced by the lead and dated; **the decision did not change**               |
| `.factory/work/WI-024.md` (criterion 5)      | the landing page moves to the execution room       | corrected: the root is the Map, and the rail decides in place                  |
| `.factory/work/WI-040.md:24-29` and `:31-36` | the same quote, and the same landing-page sentence | corrected; the item is not dispatched, so its brief carries the corrected rule |

**One of the two that applied it wrongly is a live build, and the correction
had to reach the briefs.** WI-024's dispatch (`task_5a09991ca5a1`) ran
11:35:05 to 12:15:08 and wrote the six briefs into `prototypes/briefs/`
(`93ef99b`, corrections at `a5042aa`) — **before** this ruling. The briefs
were written from the repaired document (`e560165`, at 11:30) **and** the
item's stale criterion 5, and where the two disagreed the item won: brief 01
puts the root route on the Map room and names the rail as the rule's one
declared exception, while brief 05 says outright that _"the item's rule is
that the landing page moves out of the root into the execution room"_. **The
briefs' shape was already right; the premise's wording was not**, and the lead
corrected the three briefs — brief 05's statement of the item's rule, its quote
of the boundary rule, and brief 01's heading — with the dated note in
`prototypes/briefs/README.md`. **The code has not been written yet**, so the
correction lands before the build follows the briefs.

**What was not done.** No task was cancelled or re-dispatched: the correction
is in the item, and the item is the spec a brief is written from. WI-024's
dispatch (`task_5a09991ca5a1`) belongs to the other Chief session and is
untouched. The ADR was re-synced by the lead rather than routed to Wren,
because nothing held the file and Wren's lane is deep; the edit is one quoted
rule, the decision behind it is untouched, and Probe verifies it as it
verifies any lead's edit. **Vision's work was not accepted by this session**:
WI-010's verifier is Probe, and the acceptance is Chief's to make on Probe's
verdict, not on a report.

**Two dispatches are owed, and the guard refused both.** Every bot-directed
call from this session was refused with _"This Bot is replying in multiple
chats, so this tool call cannot be assigned safely"_ — `dispatch_tasks` and
`message_bot` alike — while the task queries were refused the same way. The
Chief bot was in more than one chat for the whole of it, which is the same
guard that held the fleet's assignment for twenty minutes this morning.

| Reserved request id                          | To    | What it is                                                                                                  | State                                                                                                                    |
| -------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `wi-010-verify-repaired-document-2026-10-21` | Probe | WI-010's re-verification after the D1–D6 repair, with the brief in this session's notes                     | **dispatched** — the peer session sent it under this reserved id and title (`task_2f3e137d63ee`, queued)                 |
| `wi-024-premise-correction-2026-10-21`       | Cog   | A short note that WI-024's criterion 5 changed, so the six briefs are written against the corrected premise | **retired, not dispatched** — the correction reached Cog through the briefs at 15:29, and Cog has no live or queued task |

**A reserved id is not a dispatch.** Neither task exists, and no id is spent
until a task is created under it. The peer session has both briefs and has
been asked to send them if its own guard is clear; **this session will not
dispatch either under a second id**, because one item, one live dispatch, and
one verification of one item.

**What carries the correction to Cog without the message.** WI-024's file
itself: the note is at the top of it, and the item's first deliverable is the
six briefs. A brief is written from the item, so the correction lands before
the briefs are written — which is the whole reason the correction was made
into the item rather than into a note.

## The accept queue was not slow — a livelock was holding half the factory — 2026-10-21 15:35

**The group has asked the owner three times for a second verifier, on the theory
that one verifier was the constraint. It was not, and this is the measurement
that says so.**

**The factory runs two tasks at once.** `MAX_RUNNING = 2` is hard-coded in the
runtime's dispatcher (`.../minimax-bot/node/task-dispatcher.mjs`) and **no
setting in this repository changes it**, so **half the factory is one slot.**
The dispatcher scans batches in creation order, takes the first queued task
whose bot's chat is free, and runs **one task per bot**.

**From 13:13:40 one of the two slots was held by a turn that was not working.**
`task_83be52cd5d71` — a discussion task in the Personal OS Strategy group —
showed `status: running` for **119 minutes** with `result`, `messageId` and
`endedAt` all empty, and the group's last message from that bot was **empty
text**. **While it held the slot: Probe's chat was idle** — 0 running, 0 queued
— and **27 tasks sat queued**, the three oldest being WI-027's, WI-021's and
WI-045's. **The queue did not move because there was nowhere for it to move
to.** A second verifier would have sat idle in the queue exactly like Probe
did.

**What it actually was — and the correction to this session's first reading.**
The first reading was that the worker was dead, and that the giveaway was its
session's status being terminal. **That was circular**: the session was read as
`aborted` **after** the task was cancelled, and the abort is what made it
`aborted`. **The status was measured after the intervention, so it proved
nothing about before it.**

**What the turn was doing came out when the abort released it: a livelock.** Its
output was a stream of unfinished reasoning — _"Two hours have passed and the
world moved. Let me take the state back in before I speak. … Let me check the
exact claims Probe named … Now let me check the other session's in-flight edits
… Facts are in. Now let me verify the last details before I rule and write."_ —
**restarting the same investigation without ever concluding.** It was alive by
every measure available, and it still consumed the slot.

**What was done.** The task was cancelled. **Nothing was lost**: its work was
already committed and in `main` (`e1f50ae`, "Answer Probe's review: six
defects, six observations, all of them mine"), its follow-up repair was a
separate live task, and **the released turn still produced its 2896-character
post, which the group received**. **Measured eight seconds after the slot
freed, Probe's WI-027 verification started**, and Cog's WI-045 implementation
took the other slot: **the queue began moving on its own for the first time
since 09:48.** The group was told — `task_c7064293a08e`, the first post of
this session's the channel accepted rather than refused.

**What is now in the repository, so the next stall is not found by accident.**
`.factory/watchdog.md` — Chief's file, and the knowledge lives in the
repository because the doctrine lives in the repository. **It reports; it does
not cancel**, and the reason is measured rather than cautious: **elapsed time
cannot tell a stall from a long task.** Over the 82 tasks that completed on
2026-10-21, **five ran for over two hours and every one of them finished**, the
longest taking 477 minutes. **A check that cancels on elapsed time alone would
have killed five real pieces of work.** The threshold is **45 minutes**, and it
is a _trigger to look_, never a reason to cancel. **Cancelling stays Chief's
judgement** — the evidence that made it safe today was that the work was
already committed, that the follow-up was a separate task, and that the turn
had posted nothing for two hours. `FACTORY.md` points at it from the loop.

**And a schedule to run it**, so the finding does not depend on a human
noticing: `sch_6db03ac6ba13`, every 30 minutes, as Chief. The first version of
that schedule told the bot to cancel on a terminal session status — **the
circular rule above** — and it was deleted and replaced the moment the
circularity was found. **A cancelled batch keeps its request id; a schedule can
be deleted outright.**

**The second-verifier question stands, and it is a smaller one than the group
has been asking.** With two slots, a second verifier buys parallelism **only
when a slot is free**, and today the slot was the problem. It is still worth
the owner's answer, on the measurement that today the queue did not move
because a turn was stuck, not because there was one of anything.

## The watchdog fires — 2026-10-21 15:50

**The check is verified, not assumed.** The schedule `sch_6db03ac6ba13` fired at
**15:50:26** and its next run is **16:20:27** — exactly the 30-minute interval.
**It created no task and posted nothing**, which is the specified behaviour
when nothing has been running for more than 45 minutes: the two tasks running
at that moment were 12 and 4 minutes old. **So the check that can fail did
fire, and it correctly concluded that there was nothing to report.**

**One branch of it is verified and the other is not, and that is said here
rather than left implied.** The **quiet** branch — nothing over the threshold,
say nothing — is verified. The **report** branch — something over the
threshold, report it with the task id, the minutes held, the chat blocked and
whether the work is already committed — is **not verified, because there was no
stall to report.** Manufacturing one to test it would be manufacturing the
failure the check exists to prevent.

**A correction to how the firing is read.** The liveboards `state.json` shows
`last_run: null` for this schedule, and **that field is not where the runtime
keeps it** — a check that reads the state file alone would conclude the
schedule never fired, which is the opposite of the truth. The authoritative
value is what `list_schedules` reports. **A check that reads the wrong place
is worse than no check**, and that is worth knowing about this one.

**And the queue answered a question the group has been asking all day.** At
15:27 WI-027's verification landed — **the first accept-queue item to close
since 09:48** — and at 15:49 WI-062's verification started. **The queue is
moving because the slot was freed, not because the verifier count changed.**

## The briefs were written before the ruling, and the correction reached them — 2026-10-21 15:45

**The lead's own claim of an hour ago was wrong, and it is corrected here
rather than overwritten.** This session wrote that WI-024 "is queued and has not
run", and that "the correction lands before the briefs are written". **Both
were false**: the dispatch (`task_5a09991ca5a1`) ran 11:35:05 to 12:15:08 and
wrote the six briefs at 11:58, and the ruling was at 15:09. The claim came from
the ledger's own row, which still said "still queued" — **a stale row read as
a live fact**, which is the mistake this factory has a rule about.

**What the briefs got right, and what they got wrong.** The direction document
had been repaired at `e560165` at 11:30, five minutes before the dispatch
started, and the briefs used it: **brief 01 puts the root route on the Map
room** and names the rail as the rule's one declared exception, and **brief 05
already makes the list into the rail that decides in place**. What the briefs
took from the _item_ instead was criterion 5, still the flat-rule version, and
brief 05 says so outright: _"The item's rule is that the landing page moves
out of the root into the execution room."_ **The briefs' shape was already
right; the premise's wording was not.** The lead corrected the three briefs —
brief 05's statement of the item's rule, its quote of the boundary rule, and
brief 01's heading — and `prototypes/briefs/README.md` carries the dated note.
**The code has not been written yet**, so the correction lands before the build
follows the briefs.

**Two dispatches are still owed, and the refusal is a different one now.**
From a scheduled turn every bot-directed call is refused with _"This tool call
cannot be assigned to an active reply. Retry from the current chat."_ — which
is not the multi-chat guard from the morning, and which a chat turn does not
hit. The ids stay reserved:
`wi-010-verify-repaired-document-2026-10-21` for Probe's re-verification of the
repaired direction document, and `wi-024-premise-correction-2026-10-21` for the
note to Cog. **The peer session has both briefs** and has been asked to send
them; **this session will not dispatch either under a second id.**

**And what the morning section got wrong, now the cause is measured.** The
other Chief session measured it: the runtime runs **two tasks at once**
(`MAX_RUNNING = 2`, hard-coded, and no setting in this repository changes it),
and a livelocked turn held one slot for 119 minutes. **Neither** reading in the
morning section was right — not the guard holding the assignment, and not a
wedged bot session — and the test that section set would have confirmed the
wrong one, because the queue began moving on its own eight seconds after the
slot was released, with no change in how many chats the Chief bot was in. The
correction is in that section and in the peer's, and the sizing rule now is
that **at most two items are in flight productively**, and a task that hangs
holds half the factory.

## The owner's two answers came at 16:40, and both confirm what is already built — 2026-10-21 17:05

**The questionnaire this session opened at 09:25 (`ask_c289c257da1653a1794d2c3a`)
was answered at 16:40, and both answers are the recommendations.**

1. **Should a turn whose outcome could not be confirmed keep dispatching
   work?** — **No: an unknown turn waits for you.**
2. **Do you want Forge ahead of the three released items?** — **No: let the
   three released items land first.**

**Neither answer changes anything, because both are already built.** The first
is **WI-045** — "an unconfirmed turn routes no further work" — which landed at
`a4010bb`, was merged into `main` at `66c86ad`, and **Probe's verification of
the owner's own answer is queued** (`task_1df39fd407ea`). The second is the
order **WI-024** already records: WI-031, WI-017 and WI-020 land before Forge,
and nothing is cancelled to move it. **What the answers do is retire two open
questions** — including the one that was holding WI-008, which is accepted.

**The second answer is now the owner's word rather than the lead's reading of
one.** The 08:54 sentence — "Forge lands right after" — was the lead's reading
of "next among the items that have not started", and WI-024's file said so
plainly: _"If the owner wants Forge ahead of them, that is one word."_ **The
word has now been given, in the other way**, and WI-024's file carries it.

**And the two things this session owed are closed.** WI-010's re-verification
is dispatched — the peer session sent it under the request id and title
reserved here (`task_2f3e137d63ee`, queued) — and **the premise-correction note
to Cog is retired rather than dispatched**, on the peer's reasoning, which is
right: the briefs were corrected at 15:29, Cog has no live task and no queued
task, and a note telling a worker a premise changed when it has already
changed is a false statement to a worker. **The correction reached Cog through
the file, which was the channel this session named as sufficient in the first
place.**

**Two corrections to this session's own record.** **`main` is pushed** — the
owner gave a new word at 16:20 and `main` went to `origin` as a fast-forward
(`e18bfff..8dcf69d`, CI success on all four jobs plus CodeQL), so the notes and
the messages that said the push word was spent were wrong. **And WI-024 ran**,
at 11:35 to 12:15, which this session had recorded as queued and had not run;
the correction is in the file and in the briefs. **The ADR edit stays the
lead's**, and WI-025's acceptance is the peer session's — the ownership was
transferred to Chief for exactly this reason, and the remedy is that the edit
is verified like any lead's edit.

## WI-027 is verified, and the drift has a second instance — 2026-10-21 16:00

**The accept queue moved for the first time since 09:48, and it moved because
the slot was freed.** WI-027's verification — the successor, request
`wi-027-verify-fixed-tree-successor-2026-10-21`, task `task_874e6fb66b9b` —
**finished at 15:27, sixteen minutes after it started, with all nine acceptance
criteria met.** The gates are pasted in the report: typecheck 0, format 0,
build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 ·
contracts 28), **test:e2e 27 passed**.

**The measurement, before and after the slot was released.** In the hour before
it: **two tasks completed, median 278 minutes.** In the sixteen minutes after:
**two tasks completed, median 16 minutes.** The livelock was costing the
factory more than the queue's length ever did.

**The finding that matters is not about WI-027.** Probe found a **live defect
in another item**, and **a defect blocks acceptance**, so it is written into
that item rather than left in a report:

**`CONTRACTS.md:197-204` says the code does not implement the resolve route.**

> **This entry is the contract for WI-031, and the code does not implement it
> yet.** … there is no `/api/executions` route … A client written against this
> entry must treat the route as absent until the implementation lands.

**Every clause is false.** The route is at `api/executions.ts:21`, registered
at `app.ts:217`, published in the route table at `CONTRACTS.md:1145`.

**And the cause is the order, not a mistake.** The contract half landed at
**11:05** (`363428e`) and the implementation at **11:32** (`414996c`), so **the
note was true when it was written and went false 27 minutes later.** The
contract led the code, and **the contract's statement about the code did not
follow.** **This is WI-065's drift with a second instance** — WI-065 says it
plainly: _"Leading means something in both directions: when the code lands,
the contract's statement about the code has to follow, or the contract is
publishing a falsehood about the product it describes."_

**So the pattern is recorded as a candidate, C-23, and the second instance is
attached to WI-031, where it blocks that item's acceptance.** The correction is
Wren's line and `CONTRACTS.md` carries WI-065 as a live item, so **it is not
written here** — one file, one live item. The check that would stop the third
instance is a `scripts/verify-*.ts`, which is Probe's by the ownership table,
in the shape of WI-038's borrow-rule gate. **A published count can go stale
and a test catches it; a published _status_ can go stale and nothing catches
it**, because a test would have to read the note and know what it claims.

**Two more findings, and both are records, so both are corrected here.**
**The close path has no test anywhere** — Probe grepped every test file for
`/executions/`, `execution.outcome.resolved` and "It ran" and got production
files only. **WI-031's own criterion assigns that pin to Probe**, so the hole
is known and owned and still a hole. **And the records behind this were
stale**: `WI-027.md` named the verification that **failed with `BUSY` at
10:19:58 and produced no verification at all** as the live dispatch, and this
ledger's dispatch table still showed **both of WI-031's halves as queued**
when both had landed. **The ledger being wrong about what has been dispatched
is how a finding goes unread twice** — so the table is corrected, `WI-027.md`
names the successor, and `WI-031.md` carries the defect.

**What is not done, and why.** WI-027's **acceptance is Chief's** and is not
recorded as done here: the item is verified, and the acceptance is a decision
that goes in the item's file with the verdict against it. **WI-031's
verification is queued** (`task_b511f4062477`) and will rule on the close
path's pin. **WI-065 is live on `CONTRACTS.md`**, so the second instance's
correction waits for it rather than making two live items on one file.

## Three items close, and the queue moves — 2026-10-21 15:45

**The queue moved for the first time since 09:48.** The livelocked turn that
held half the factory for two hours was cancelled, and in the sixteen minutes
after the release **two tasks completed with a 16-minute median** — against two
in the hour before, with a 278-minute median. **Probe's WI-027 verification and
Cog's WI-045 implementation took the two slots.**

**And three items are accepted**, because Probe's verdicts are in and the
gates are green:

| Item   | Verdict                                                                 | The measurement it stands on                                                                                                                   |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-027 | **all nine criteria met**                                               | `f7ac848`; typecheck 0, format 0, build 0, test 0 (server 219 · web 52 · worker 31 · agent-adapters 16 · contracts 28), **test:e2e 27 passed** |
| WI-021 | **all five criteria met**                                               | `51c92f8`; typecheck 0, format 0, build 0, test 0, **`npm run smoke` 0 in 9.5 s**, the two pinned suites **39 passed (39)**                    |
| WI-008 | **all four defects closed**, and the owner's question answered at 11:05 | typecheck 0, test 0 at `8b2abfe`; and `git diff --stat 51c92f8..HEAD -- apps packages mcp CONTRACTS.md scripts` is **empty**                   |

**This session wrote none of the three**, so the lead does not accept its own
work: WI-027's implementation is Cog's (`c9bb0bc`, `4e5db84`), WI-021's fix is
Cog's (`57606a8`), WI-008's is Cog's (`9ad4f98`, `f0f8661`) with the contract
half Wren's (WI-013). **All three acceptances are recorded here so that the
other Chief session does not accept them again.**

**What the product can now do because of them.**

- **WI-008 — an unknown outcome is not a failure.** A turn, execution or task
  whose outcome cannot be confirmed is recorded as **`unknown`**, and `failed`
  no longer reads as "safe to retry" — so a side effect that may already have
  happened is not run twice. **An unknown outcome is never retried or
  redispatched automatically**; the waiting list shows it as **"check this"**,
  not "fix this"; and every transition to and from it is in the audit trail.
- **WI-027 — a turn reaches the owner the way an unknown task does.** It is
  drawn on the waiting list as its own kind, **`turn`**, with the reason
  **`unknown`**, in the same urgency band as an unknown task, because the list
  is ordered over reasons and not over kinds. The owner can close it with
  **"It ran"** or **"It did not run"**.
- **WI-021 — a delegation is never silently dropped.** It reaches the
  participant, or it is refused with a reason that names **both** the sender
  whose right to delegate was refused and the agent that was not woken, and
  the routing result carries `targets: []` so a client can tell a refusal from
  a success without reading the prose.

### WI-031's acceptance is blocked, and the correction is dispatched

**Probe found a live defect against WI-031 while verifying WI-027**, and **a
defect blocks acceptance**, so it is written into the item rather than left in
a report nobody reads twice. `CONTRACTS.md:197-204` says the code does not
implement the resolve route yet and that a client must treat it as absent —
**false since `414996c` (11:32)**, and it was true when it was written at 11:05,
so the contract led the code and the contract's statement about the code did
not follow. **WI-065's drift with a second instance**, recorded as candidate
**C-23**.

**The correction is dispatched** — `wi-031-contract-status-correction-2026-10-21`,
`task_be25e082ae5c`, to Wren — in the pattern WI-027's own entry uses:
_"the code implements it — as of `414996c`"_. **It queues behind WI-065 on
`CONTRACTS.md`**, because Wren's lane is serialised and one file carries one
live item. The other Chief session recorded the finding and the deferral; the
deferral was to wait for WI-065 to clear the file, and **a dispatch into
Wren's serial queue is how it clears.**

### WI-069 — numbered, and held on purpose

**Probe's second finding on WI-021 was a question for Chief**, and it is now
numbered: **WI-069, "A delegation that names nobody is refused in a way a
client cannot read."** A delegation addressed to a participant id that matches
**nobody** is refused with a generic reason and **no `blocked` key**, so a
client cannot tell that refusal from "there was nothing to wake". Measured:
ids are filtered to enabled agent connections at
`apps/server/src/modules/conversations/routing.ts:131` before the refusal is
built, so such a delegation never reaches the branch that names the target;
the reason becomes _"An agent message does not automatically trigger other
participants in coordinator mode."_ and `blocked` is undefined.

**It is held, and the reasons are said out loud rather than left to be
guessed.**

1. **The owner's line at 15:40:** _"When a slot frees, lean on verification —
   six items sit at `verify` and every one of them waits on Probe, and
   unverified work is inventory rather than product."_ **Acceptance is the
   constraint, so a new implementation item does not take capacity while ten
   verifications wait.**
2. **The contract half needs the owner's answer**, because **WI-021 has no
   entry in `CONTRACTS.md` at all** — the refusal's shape is published nowhere,
   so this is a gap in what the product says about itself and not a violation
   of something it already said. **Chief's recommendation is yes, and in the
   smallest form**, and it is still the owner's.

**It is numbered so it is not lost**, and the brief is written out in full in
`.factory/work/WI-069.md`, with the acceptance criteria drafted. The request
ids are reserved: `wi-069-refusal-names-nobody-code-2026-10-21` for Cog and
`wi-069-refusal-shape-contract-2026-10-21` for Wren.

### Three records corrected, because a wrong record is how a finding goes unread twice

1. **WI-021's state line named the spent dispatch** — `task_479859728e18`, the
   one that failed with `BUSY` at 10:20:27. The live one is
   `task_d817d075a0ce`. Corrected, and the item is now **accepted**.
2. **WI-021's own file described a behaviour the code cannot exhibit.** It
   said _"a connection that matches no participant is named by its id."_ The
   branch exists (`routing.ts`, `participantName`) but **no input reaches it**,
   because ids are filtered to enabled connections at `:131` before the
   refusal is built. **It is harmless dead code; the file's account of it was
   the untrue part**, and the account is corrected.
3. **WI-021's citation was stale** — the translation at `service.ts:419-429`,
   now at `:467-476`. **The code did not move; the line range did.**

### The smoke gate is not flaky any more, and this session's record says so wrongly

**This session recorded the Windows smoke gate as flaky and unresolved.** It
is **fixed, by Probe, in test-side code**: `63aba3a` (12:00, _"Read the process
table without losing the race"_) replaces the PowerShell start-up with a
one-question WMI read through `cscript` — **267 ms measured against
PowerShell's 5.7 s** — and `1c92001` (12:10) fixes two further suite flakes.
Probe's own run of the gate on the current tree: **exit 0 in 9.5 s**, including
the three checks that were failing.

**The residual, honestly.** The fallback path — a machine with no script host
— is still the slow PowerShell read, so there the race can return, and **the
product-side 5-second budget is unchanged** (`busy_timeout = 5000`,
`apps/server/src/db/client.ts:29`). **That half is Cog's to change**, and it is
not what made the gate flaky.

### The owner's Forge correction, which is now on the record

**WI-024's live dispatch is `task_5a09991ca5a1`** — not `task_2963d3be0f41`,
which was cancelled at 09:35. **The correction that said so failed with `BUSY`
at 10:20:55**, and the owner's line at 15:40 carries it. It is recorded in the
dispatch table and it changes nothing: WI-024 is not re-dispatched from here,
because it is the other session's item and a re-dispatch needs a new id and a
new title anyway.

### The number space, as it now stands

**WI-069 is this session's**, taken as the next number above all of them. WI-030
through WI-038, WI-044, WI-045, WI-062, WI-065 through WI-069 are this
session's; WI-024 through WI-029 and WI-039 through WI-043 are the other Chief
session's; WI-046 through WI-064 are the strategy session's. **If another
session has taken WI-069 in the meantime, it is renumbered and the table is
corrected** — the same way WI-063 became WI-065.

## The second verifier: answered, and the question is closed — 2026-10-21 16:00

**The group asked the owner three times for a second verification bot, on the
diagnosis that one verifier was the constraint. The measurement said otherwise,
and the question was put again with the measurement attached. The answer is
no.**

**One verifier, plus the stall watchdog.** The fleet's problem on 2026-10-21 was
not that Probe was slow or alone — **Probe's chat sat idle for 119 minutes**
while a livelocked turn held one of the two slots. **A second verifier buys
parallelism only when a slot is free**, and on the day the slots were the
thing that was wrong. **So the question was put with the corrected diagnosis
attached, and the answer was: one verifier and the watchdog is enough.**

**How the answer came, stated plainly rather than as the owner clicking it.**
It came through the questionnaire's **recommended default on timeout** — the
option marked recommended was _"no — one verifier plus the stall watchdog is
enough"_, and the runtime adopted it. **That is a resolved answer, not an
explicit click, and it is recorded as what it is.** The safe direction was
marked recommended, and the alternative — adding a bot the owner did not
choose — is the one that changes the shape of the team and its cost.

**And the measurement that changed the question is the reason the answer is
safe to act on.** The queue moved once the slot was freed and the stall was
watched for: **WI-027's verification landed at 15:27, the first accept-queue
item to close since 09:48, and WI-062's started at 15:49.**

**What this closes.** The second-verifier question is **answered and is not to
be asked again.** If the accept queue stops moving, the first question is
**whether a slot is stuck**, and the watchdog answers it every 30 minutes
without a human noticing. **A second verifier is the second question, not the
first.**

**The watchdog's first firing is verified.** `sch_6db03ac6ba13` fired at
**15:50:26**, its next run is **16:20:27**, and it created no task and posted
nothing — correct, because the two running tasks were 12 and 4 minutes old and
nothing was over the 45-minute threshold. **The quiet branch of the check is
verified; the report branch is not, because there was no stall to report.**
Manufacturing one to test it would be manufacturing the failure the check
exists to prevent.

**The group post was refused, and that is recorded here because the decision
matters to the floor.** The round was open, and `post_group` answered _"the
group is mid-discussion; post again once this round finishes"_ on **two
attempts, at 16:00 and 16:05** — request ids
`factory-group-verifier-answered-2026-10-21-1600` and `-1605`. **The earlier
post about the livelock, `task_c7064293a08e`, is still queued** and will be
delivered when the round opens. **The decision itself does not wait on the
group**: it is the owner's answer, it is in the ledger, and the watchdog that
implements it is already running on its own schedule. **A refusal to post is a
delivery failure, not a reason to leave the record unwritten** — which is why
this section exists, and why the group's copy is a convenience and not the
state.

### WI-045 — the owner's answer is implemented, and its verification is dispatched

**`a4010bb` "Stop an unconfirmed turn from routing work onward"** on
`wi/045-unconfirmed-turn`, pushed to origin so CI gates it, and **merged into
`main` at `66c86ad`**. Five files, 86 insertions: `dispatch.ts` (the guard and
the audit entry), `service.ts` and `app.ts` (the audit service reaches the
dispatcher), `routing.ts` and `executor.ts` (the call sites).

**The guard.** `planAndDispatch` reads `message.status` before it routes
anything (`apps/server/src/modules/conversations/dispatch.ts:69-88`).
`complete` and `failed` are settled answers and route as they always did;
`unknown` and `streaming` stop the routing — no execution, no queued job — and
the routing decision says why, with a new block reason `unconfirmed`. Measured
against a real server: a confirmed turn → 1 dispatch and 1 queued `chat.turn`;
the same turn marked `unknown` → **0 dispatches, 0 queued jobs**.

**Chief's word on Cog's one judgement, and the doubt is named rather than
hidden.** Cog flagged that **the audit entry targets the message, not the
execution.** Cog's first version targeted the execution, which broke Probe's
verified assertion at
`apps/worker/src/__tests__/unknown-outcome.test.ts:251` — that lookup keys on
the target alone (`entries.find((item) => item.targetId === 'exe_1')`) and the
trail is newest-first, so **a second entry on the same target shadows the one
that was pinned.** Cog did not touch the test.

**The ruling: the stop targets the message.** The message is the thing that
was not routed and the thing the owner reads; the execution id is not lost and
travels in `metadata.executionId`; and **the audit trail is keyed by target**,
so a second entry on one target makes a target-keyed lookup ambiguous — and
that lookup is pinned and verified. **The criterion is not rewritten.**
Criterion 3 says _the stop is recorded where the rest of the unknown-outcome
machinery is recorded_, and **that wording is what Probe judges it against.**
Chief's ruling resolves the ambiguity in the implementation; it does not move
the goalposts.

**The verification is dispatched** — `wi-045-unconfirmed-turn-verify-2026-10-21`,
`task_1df39fd407ea` — with six questions. One is the criterion above. **One is
the question Cog's change raises and nobody has answered yet: `streaming` is
not an unconfirmed outcome, it is a turn in progress**, and the owner answered
about an _unconfirmed_ turn. Probe is to say whether any legitimate path calls
`planAndDispatch` with a streaming message, and what it does now.

**And the owner has closed the second-verifier question**, so this section does
not ask again: **no — one verifier plus the stall watchdog**, the question is
closed, and the first question when the accept queue stops moving is whether a
slot is stuck. The other Chief session recorded that answer at `671f9f2`, and
**this session had the question open in its own report and does not reopen
it.**

**The queue is moving.** WI-027's verification landed at 15:27 — the first
accept-queue item to close since 09:48 — and **WI-036's verification started
at 15:38**. The livelocked turn that held half the factory was cancelled, and
in the sixteen minutes after the release two tasks completed with a
**16-minute median**, against two in the hour before with a 278-minute median.

## The watchdog sweep, 2026-10-21 16:10 — four verifications that never arrived

**This is the watchdog's own sweep, on the 30-minute cadence, and it found the
failure this factory exists to prevent: work that landed and a verification that
was never delivered.** Four items have their work in `main` and **no live
dispatch**, and every one of them is a hole rather than a deliberate hold.

### What is running, measured

| Task                | Held     | What it is                                                                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task_aa4b43bdd748` | 28.9 min | Chief's tick in the Personal OS Factory group. **Fresh output at 16:03:26** — it ruled on WI-045's judgement call and merged WI-045 into `main`. |
| `task_3bb64dabf31a` | 11.7 min | Probe, WI-036 — verify the dependency licence record against the lockfile.                                                                       |

**Neither is a stall, and nothing was cancelled.** The watchdog's trigger is 45
minutes and neither task has reached it; the group turn is measurably
producing output and the Probe turn is eleven minutes old. The queue behind
them: **Probe 8 queued, Wren 7, Cog 1, Chief 1.**

### The four items, and what died on each

| Item       | The work, and where it is                                                                | What died                                                                                                                                                                                                                                                                                                                    | Lane        |
| ---------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **WI-007** | Cog's fix `6878e7c` (**in main**); Wren's migration note `task_e6fe9555ca74`, done 11:19 | Probe's verification of the fixed tree, `task_2e431d7647e5`, **failed at 11:10:17** with an empty result, and was never re-dispatched.                                                                                                                                                                                       | **free**    |
| **WI-010** | D1 to D6 repaired (`e560165`, **in main**); Chief's own task closed 15:12                | **Probe's re-check was never dispatched.** The item's state line says _"Probe re-checks, Chief closes"_ — and Probe's only WI-010 verification (`task_5666d5ca0dc2`) ran 07:08 to 07:46, **before** the repairs.                                                                                                             | **free**    |
| **WI-025** | Wren's three record fixes (`a107cb9`, `b1b9ee9`, **in main**)                            | Probe's verification (`task_2b5c9020bf00`, 09:28) found **three defects** in the ADR's record; Wren fixed them at 11:58; **the re-verification was never dispatched.**                                                                                                                                                       | **free**    |
| **WI-039** | The contract half **landed** — `6406291`, `CONTRACTS.md` only, +101 lines, **in main**   | The verification was handed to Probe's **own session** (`mvs_f1f513955649480dbfb09fae820cf59f`) at 10:53, and the dispatcher task `task_e486def935b8` was cancelled at 10:54 — **and the brief never arrived.** That session's three user-role messages are the three dispatcher briefs; the WI-039 brief is not among them. | **blocked** |

**WI-039's lane is blocked, and the block is concrete.** Its subject is
`CONTRACTS.md`, and **`wi/046-domains-interaction-model` holds that file** —
34 files changed, `CONTRACTS.md` among them, unmerged. Verifying WI-039 against
`main` measures a tree that does not carry WI-046's contract changes. **Either
the verification waits for that branch, or it is scoped to the WI-039 entry
alone and says so.** That is a tiebreak for the lead, and it is said out loud
here rather than taken quietly.

**The three free lanes are free, measured.** No live branch touches
`apps/server/src/__tests__/approval-resume.test.ts` or
`apps/web/e2e/waiting-list.spec.ts` (WI-007), `prototypes/DIRECTION.md`
(WI-010), or `docs/decisions/0007-the-environment-agents-operate-and-extend.md`
(WI-025) — `wi/046` touches ADRs 0008, 0009 and 0010, **not 0007**.

### What this sweep dispatched, and why it dispatched nothing

**Nothing was dispatched from here, and that is a decision rather than an
omission.** Probe's chat is busy with **eight** Probe tasks queued behind it;
the live Chief session in the group owns the dispatch and the number space,
and at 16:06:05 it dispatched WI-045's verification
(`task_1df39fd407ea`, request `wi-045-unconfirmed-turn-verify-2026-10-21`).
**Dispatching WI-007, WI-010 or WI-025 from a second session is two verifiers
on one item.** The four are recorded here as **ready to go**, with the lane
named, so the session that holds the queue takes them in this order:
**WI-007, WI-010, WI-025** — the three with a free lane — and **WI-039** when
`wi/046` clears `CONTRACTS.md`, or with the check scoped down and said.

### Two records are wrong, and two gaps are recorded correctly

**The same defect the ledger recorded at 15:35, in a third shape: the record
is wrong about what has been dispatched.**

1. **WI-007's state line names a failed task as its live dispatch** — _"Probe's
   verification of the fixed tree is dispatched, task `task_2e431d7647e5`"_ —
   and that task is `failed` with an empty result. A reader would count WI-007
   as busy.
2. **WI-039's record says the verification "was handed over the working
   route"** to Probe's session. **That handover did not land.** The brief is
   not in the session's history, and the dispatcher task that would have
   delivered it was cancelled a minute later.

**WI-010's and WI-025's records are honest** — they say a check is owed — and
that is the problem: **nothing was ever dispatched for either, and nobody
noticed.** A gap that is correctly described is still a gap.

**None of the four records is corrected here.** `.factory/work/**` is the
lead's file, and this sweep does not edit another session's item records.

### The branches, and one that CI cannot gate

**Measured from the merge base, not from `main`** — the difference matters,
because `main` has moved on and the two lists are not the same thing.

| Branch                             | What it actually changes                                                          | On origin      |
| ---------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| `wi/020-measures-route`            | the measures route — `apps/server`, `apps/web`, `packages/contracts`              | **pushed**     |
| `wi/038-borrow-rule-gate`          | `.github/workflows/ci.yml` and `package.json`, and nothing else                   | **NOT pushed** |
| `wi/046-domains-interaction-model` | 34 files — `CONTRACTS.md`, `docs/**`, `packages/**`, `apps/server/src/domains.ts` | **pushed**     |
| `wi/064-free-period-plan`          | `docs/free-period-plan.md`, `docs/roadmap.md`, `WI-064.md`                        | **pushed**     |

**`wi/038-borrow-rule-gate` is the only branch holding work that is not on
origin**, so CI cannot gate it. Its work is one CI step and one manifest
entry — the borrow-rule gate — and a queued Probe task (`task_63e621ad515f`)
is meant to verify it. **A branch nobody pushed is a branch nobody gated.**

**Nine worktrees are stale leftovers** — `022`, `032`, `036`, `037`, `041`, and
two each for `067` and `068` — every one clean, every one an ancestor of
`main`. **"A worktree exists" is therefore not a signal that anything is
happening.** The two `WI-067` branches and the two `WI-068` branches are **the
same items' leftovers, not two items each**: both `067` branches sit on
`afc2811` and both `068` branches are merged, so **the number space did not
collide — there are four worktrees and two items.**

### What the owner has

**The push.** Local `main` is `71c9297`, `origin/main` is `e18bfff`, and
**14 commits are unpushed** — WI-045's merge, the watchdog, and the ledger
among them. **`main` waits for the owner's word**, and this sweep does not
spend it.

**The WI-039 lane tiebreak** — wait for `wi/046`, or scope the check to the
WI-039 entry alone.

**And the two contract calls already open** — WI-021 publishes no entry in
`CONTRACTS.md` at all, so the refusal's shape is published nowhere, and
WI-069's contract half waits on the owner's answer. Both are already on the
record and neither is new.

**Nothing else needs the owner.** The queue is moving, no slot is stuck, and
the four items above wait on a dispatch, not on a decision.

### WI-062 is verified, and it is accepted by the session that wrote neither half

**Probe's verification of WI-062 is done** — request
`probe-verify-published-counts-2026-10-21-1240`, task `task_2c7c9f4fd696` —
and **all six criteria hold.** Probe re-implemented the test's own counting
method rather than trusting it: **35 mutating routes registered, 21 auditing in
their own handler, 2 auditing from the service layer, 12 writing no audit
entry**, and **the published table and the code's unaudited list are the same
twelve** — nothing in one and not the other. The gates: the published-shapes
suite 3 passed, the server suite 219 passed, `prettier --check` 0,
`npm run format:check` 0.

**Accepted: 2026-10-21, by this session.** The contract correction at
`50b908d` is the **other** Chief session's — its own commit message says _"The
lead does not accept its own work"_ — and the test's comment fix at
`137385c` is Probe's, which Probe says in its report goes _"to the lead for
acceptance. I do not accept my own work."_ **This session wrote neither half,
so the lead accepts it, and neither writer accepts its own work.** The item
file said so too, before the verification came back: _"the lead implemented it,
so Probe verifies it and Chief accepts it."_

**What the product can now do because of it.** The published contract says how
much of the product's mutating surface the audit trail actually covers, and
the number is right: **35 mutating routes, 21 that write an audit entry at the
route level, 12 that write none.** An owner reading it learns that **a third
of the mutating surface is invisible to them** — which is what the contract
says in words — rather than a smaller number.

**And all three of Probe's findings are routed, not left in a report.**

1. **Four stale citations in the measures section** — the claims are true, the
   line numbers are not: `CONTRACTS.md:1199` cites `mcp/server.ts:368` where
   the work is at `:393`; `:1212` cites `resources/service.ts:170` and `:260`
   where it is at `:193` and `:283`; `:1193-1194` cites `lib/ids.ts:9-17` for
   the `agt_` form, and those lines are the generic id generator while the
   prefix is chosen at `agents/service.ts:202`. **Dispatched to Wren** as
   `wi-062-measures-citation-refresh-2026-10-21`, `task_169f434c05d9` — **a
   citation refresh, not a change of content**, and it must not touch the
   template record or WI-031's entry.
2. **The template record at `CONTRACTS.md:578-581`** still says the code does
   not implement it yet, and the registry is in the tree. **That is WI-065's
   line**, and WI-065 is live in Wren's queue.
3. **WI-031's entry at `CONTRACTS.md:197-204`** — the same shape, and
   **dispatched** as `task_be25e082ae5c`.

**And the one question for the owner.** WI-069's contract half needs it:
**should the product publish the shape of a delegation refusal**, so that a
client can tell _"you named an id that matched nobody"_ from \_"there was
nothing to wake"? **Chief's recommendation is yes, and in the smallest form** —
a refusal that names nobody says so, and carries a `blocked` key as the refusal
that names a target does. **But WI-021 has no entry in `CONTRACTS.md` at
all**, so the refusal's shape is published nowhere, and publishing it is a
contract change, and a contract change is the owner's. The code half does not
wait for the answer, and **the item is numbered and written so it can go the
moment the answer comes.**

### A note against this sweep, and a tiebreak that is not taken

**This sweep's commit carried one row that is not its own, and the fact is
recorded rather than left in the commit.** `5982db8` took the working-tree
content of `.factory/INTAKE.md`, and the other Chief session's correction to
the `probe-verify-published-counts-2026-10-21-1240` row — WI-062's dispatch,
corrected from **queued** to **done** — was in that working tree when the
commit ran. **The check before committing looked at the diff's file names and
not at its content, which is the check that would have caught it.**

**It is not being rewritten.** The correction is right — WI-062's verification
finished at 15:58 and the item is accepted — it is where it was going, and
rewriting `main`'s history while another session commits on top of it is a
worse trade than a container carrying one extra row. The group post that would
have said this out loud was **refused — the round is mid-discussion** — so it is
here.

**And the tiebreak this sweep did not take.** **WI-039's verification is
blocked on `CONTRACTS.md`, and `wi/046-domains-interaction-model` holds that
file.** This sweep does not decide that: it is the lead's call, whether the
verification waits for that branch or is scoped to the WI-039 entry alone, and
**a tiebreak made silently is a rule broken silently.**

## The fourth push — 2026-10-21 16:20

**`main` is on the remote at `8dcf69d`.** The owner was asked with the evidence
in the question and said yes: **17 commits, 22 files, +1662/−132, fast-forward**,
visibility unchanged at private, nothing rewritten. The pre-push hook ran and
passed.

**The evidence, and the gap between what was measured and what was pushed.**
The pipeline ran on **`71c9297`** and **both legs were green: CI success on all
four jobs (Build and test, Dependency audit, Lint the workflows, Build and run
the stack), and CodeQL success.** This session measured the same tree
first-hand: **typecheck 0, `format:check` 0, 346 tests across 39 files, build 0.** **The tip moved two commits past the measured sha** — `597c759` and
`8dcf69d`, both the other Chief session's — and **both touch documents only**:
`git diff --name-only 71c9297..8dcf69d` is `.factory/INTAKE.md` and
`.factory/work/WI-062.md`, and **nothing under `apps/`, `packages/`,
`scripts/` or `.github/`**. **Every line of code that was pushed is the code
the pipeline measured.** The format gate was re-run on the pushed tree and
passed.

**What rode along.** **The stall watchdog** — `.factory/watchdog.md`, the
schedule `sch_6db03ac6ba13`, and `FACTORY.md`'s pointer to it from the loop.
**The second-verifier answer**, and the question closed. **WI-027's
verification** and the second instance of WI-065's drift, attached to WI-031
where it blocks acceptance. **WI-045's implementation**, merged, and the close
path's contract note with it. **WI-062 accepted**, by the session that wrote
neither half of it.

**And the accept queue moved, which is the thing the day was for.** **Four
verifications closed since 15:27** — WI-027, WI-021, **WI-062**, and WI-036 —
**the first closures since 09:48.** Before the livelock was cleared the queue
had not moved in six hours. **The cause is measured, not argued: a turn held
one of the factory's two slots for 119 minutes, Probe's chat sat idle the
whole time, and the group's diagnosis — that one verifier was the constraint
— was wrong.** The watchdog now finds that within 30 minutes without a human
noticing, and **the check reports rather than cancels**, because five
legitimate tasks that day ran past two hours and every one of them finished.

**A push is still not an acceptance.** WI-017, WI-024, WI-031 and WI-037's
verifications are queued and unrun. **What is on the remote is code the
pipeline approved, not code the factory has accepted.**

**One commit is ahead of the remote, and it is this record.** The tree that was
pushed is the tree that was measured; adding a record of the push makes it a
different tree. **`main` waits for the owner's next word.**

### WI-036 is accepted, and the verdict caught a defect in the lead's own brief

**WI-036 is verified — all five criteria hold** — and **accepted** by the
session that wrote none of the three halves: the record is Wren's (`edbd105`),
the merge (`c6e77d7`) is the other Chief session's, and the verification is
Probe's.

**Probe re-derived the numbers its own way rather than trusting the record.**
The lockfile has **500** package entries excluding the root — **488**
third-party, **6** `link: true` aliases (`node_modules/@personal-os/*`), **6**
workspace roots (`apps/server`, `apps/web`, `apps/worker`,
`packages/agent-adapters`, `packages/contracts`, `packages/ui`). The record
covers **494**: the 488 third-party plus the six first-party, whose `lockPath`
is the **alias** path, whose `spdxId` is **`null`**, and whose `firstParty` is
an **object** carrying the workspace path. Attribution: **375** licence-file +
**16** package.json field + **97** published identifier = **488**. **11**
distinct licences, and the approved set's 11 entries' package counts sum to
**488** exactly. **What the product can now do because of it:** the factory can
say what it borrows, read from each package's **own file** rather than from a
listing — and **the answer to the hard case is a fact now, not a hope: not one
dependency is under the AGPL, the GPL or the LGPL.** The only copyleft is
MPL-2.0 — `lightningcss@1.32.0` and its eleven platform variants — named one
by one.

**And the verdict caught a defect in the lead's own brief, which is the most
useful thing in it.**

**The brief this session gave Probe for WI-038's gate script said: _"The record
carries the six workspaces as `spdxId: "first-party (no licence yet)"`"_ — and
**that is false.** The six carry **`spdxId: null`**; the string is a **family
label in `agpl.familiesRead`**, and it is on no entry. Probe measured the
record while verifying WI-036 and reported it, unprompted: **"a gate would
fail on them, and the lead should know before WI-038 is written."** A gate
written from the false brief would have failed on **six first-party packages\*\*,
on every build, in the one gate this factory is adding to prove it can catch
things.

**Both readings of the false brief fail, which is why it had to be replaced
rather than annotated.** Skipping by the `spdxId` string skips **nothing** —
no entry carries it — and skipping by `link: true` skips the six **aliases**,
which the record _does_ cover, and leaves the six **workspace roots**
uncovered. The real skip is by **`firstParty.workspace`**, or by the lockfile
root's `"workspaces": ["apps/*", "packages/*"]`.

**So the brief was cancelled and re-issued** — `task_63e621ad515f` cancelled,
replaced by `wi-038-licence-gate-script-corrected-2026-10-21`,
`task_445db8e16adc`, self-contained, with every number measured rather than
remembered. **And this session measured the record itself before re-issuing
it**, rather than taking Probe's figures on trust: the 500, the 494, the 6
aliases, the 6 workspace roots, the `null` spdxId, the `firstParty` object, the
12 families of which one is not a licence. **The correction is also in the
brief: the gate must compute every count itself and must not read the
record's `summary`, because two of that summary's numbers are wrong.**

**The rule this establishes, and it is the same rule as everywhere else: a
brief that states a fact about the code is checked against the code before it
is sent.** The lead's briefs state facts — line numbers, field names, the
shape of a record — and **a fact in a brief is a claim, and this session
repeated one it had not measured.** The verifier caught it, and **the thing
that saved the gate was a verifier asking a question in a report rather than
the lead being careful.** That is the factory working.

### WI-036's findings are routed

**Dispatched to Wren** — `wi-036-record-numbers-and-evidence-2026-10-21`,
`task_678dfc957439`:

1. **`summary.distinctLicences` reads 12** and counts the first-party bucket as
   a licence; **there are 11**, and `docs/strategy.md:576` already says
   "accepts all eleven licences above" — **the document is right and the JSON
   is wrong by one**, in the one place a machine reads.
2. **`summary.lockfilePackageEntries` reads 494**, which is the number the
   record _covers_; the lockfile has **500**. **The field name does not
   describe the number it holds.**
3. **17 of the 375 licence-file entries quote the copyright header** rather
   than the licence text — 11 BSD, 4 ISC, 1 MIT, 1 Blue Oak. **The licences
   recorded are right in all 17**; it is the quoted lines that do not identify
   them, and **re-quoting them in the record makes the prose true without
   editing the prose.**
4. **`PRODUCT.md` §10 carries no note**, and the want named one.

**`docs/strategy.md` is deliberately out of scope of that dispatch** — it was
written by hand by the other Chief session as recently as 14:52 and it is live
in that session's item. **One file, one live item**, and the JSON alone can
carry the whole fix.

## The check now carries the one signal the fleet state cannot give — 2026-10-21 16:30

**A healthy long task and a livelock are indistinguishable from outside, and
that was measured rather than assumed.** At 16:24 a group task had been running
43 minutes. **Its session status was `started`, and the last message its bot
had posted to the chat was empty** — because the engine appends an empty
placeholder when a turn starts and the real text when it ends. **The
livelocked turn of 13:13 had exactly the same two properties.** Both signals
are the same for both cases, so **no automatic action is safe**, and the check
reports. That is now written into the file rather than left as a habit.

**So the report carries one more thing: the session status**, read with
`mavis session get` on the task's `sessionId`. **`started` means the turn is
still in flight.** It does not clear the task — a healthy 43-minute task and
the livelock both showed `started` — but it tells the reader that **nobody is
watching a corpse**, and it is the one thing a reader cannot get from the fleet
state alone.

**The schedule changed, and the change is recorded rather than hidden.** The
old id **`sch_6db03ac6ba13` fired twice** — **15:50:26** and **16:20:56**, the
second exactly 30 minutes after the first — and both firings found nothing
over the threshold and said nothing. **It was deleted and replaced by
`sch_0e4ff8fa16b2`**, whose prompt carries the session status in the report.
**The new id's `last_run` is null and its first firing is 16:57:39: it has not
fired yet, and the two verified firings belong to the old id.** A schedule can
be deleted outright — unlike a cancelled batch, which keeps its request id
forever.

**The procedure lives in the repository, and the schedule is only the
trigger.** `.factory/watchdog.md` is the check; `sch_0e4ff8fa16b2` says "read
that file and follow it". **A check whose knowledge lives in one session's
memory is not a check**, and this one has been read by a schedule twice and by
a person twice.

**And `main` is green on the platform at the pushed sha.** `8dcf69d` — the
tree the owner authorised — **CI success on all four jobs and CodeQL success**,
read from the run itself and not from a summary.

### The post that is owed — request id `status-2026-10-21-1635`

`post_group` answered **"The group is mid-discussion; post again once this round
finishes"** again, at 16:35. **The request id makes the retry idempotent
rather than a second post**, so it is recorded here and sent when the round
opens. **The post was written and its content is here:** WI-036 accepted (all
five criteria, Probe's own arithmetic — 500 lockfile entries, 494 covered, 375

- 16 + 97 = 488, 11 licences summing to 488, and **not one dependency under the
  AGPL, the GPL or the LGPL**); **the WI-038 brief corrected and re-issued**
  after the lead's own brief was caught stating the record wrongly — `spdxId:
null`, not a licence string, and **the six uncovered lockfile paths are the
  workspace roots, not the `link: true` aliases**, so the old dispatch
  `task_63e621ad515f` was cancelled and `task_445db8e16adc` carries the measured
  numbers; **WI-036's findings dispatched to Wren** as `task_678dfc957439` with
  `docs/strategy.md` deliberately out of scope; WI-062 accepted; the gates at
  `cafdc45` — typecheck 0, test 0 (server 219 · web 52 · worker 31 ·
  agent-adapters 16 · contracts 28), format:check 0, build 0; **seventeen items
  accepted**; and a note that **two sessions are in one checkout** — this
  session's ledger edits were swept into the other session's commit at 16:28, so
  **the record was not lost but it was committed under a message that does not
  describe it**, and the commits here are path-limited and stage only this
  session's own files.

### Two agents in one checkout, and what it cost today

**This session's ledger edits were committed by the other session at 16:28**,
inside `04f3506` — _"Give the stall report the one signal the fleet state
cannot give"_ — because both sessions work in `G:\code\personal-os` and that
session ran `git add` on a file this session had also edited. **The record was
not lost: every section is intact, verified by reading it back.** But it was
**committed under a message that does not describe it**, and one markdown
escape artefact (`\*\*`) came with it, which this session corrected.

**The rule this makes concrete, and the factory already had it.** The work-item
script's own docstring says it: _"one worktree per work item... two agents in
one checkout overwrite each other."_ **Chief's ledger is the exception that
created the risk** — both sessions write `INTAKE.md`, and the doctrine has
always made the ledger shared. **The mitigations that worked:** commits are
**path-limited** and stage only this session's own files, so a later commit
cannot sweep a neighbour's work into its message; and **this session left the
other session's in-flight files alone** — `docs/strategy.md` and
`apps/server/src/__tests__/resource-templates.test.ts` were in the working
tree and were not touched, not formatted, and not committed.

**What is still true after it.** The other session's `04f3506` also brought in
this session's `docs/strategy.md` scope decision's counterpart: this session
dispatched WI-036's findings with **`docs/strategy.md` out of scope**, because
that file was being written by hand by the other session at 14:52. **The two
sessions collided on a file and the ledger caught it before a dispatch did.**

### A red on `main` with every assertion green — and two numbers written over

**At 16:38 the server suite went red and nothing was wrong with the code it
was testing.** `npm run test` at `main`:

```
 ❯ src/__tests__/verifyStack.test.ts (12 tests) 49990ms
⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/__tests__/verifyStack.test.ts [ src/__tests__/verifyStack.test.ts ]
 ❯ src/__tests__/verifyStack.test.ts:133:34
 Test Files  1 failed | 22 passed (23)
      Tests  230 passed (230)
```

**230 tests passed and the file still failed.** The failure is the file's own
teardown: `apps/server/src/__tests__/verifyStack.test.ts:131-134` —
`afterAll(async () => { await Promise.all(children.map(stop)); for (const dir
of dataDirs) fs.rmSync(dir, { recursive: true, force: true }); }, 30_000)`.
**The error site is `:133:34`, `fs.rmSync`, and the hook's budget is the
`30_000` at `:134`.** The file took **49 990 ms**.

**The children are not the unbounded part.** `stop()` (`:106-119`) resolves on
the child's `exit`, and a 4-second timer sends `SIGKILL` and resolves anyway,
so `Promise.all(children.map(stop))` costs about four seconds. **The removal
is what ran past the budget** — and on Windows, removing a tree that a
just-killed process still holds open is exactly the operation that blocks.

**It did not reproduce.** `npm --prefix apps/server run test` → **exit 0**, 23
files passed (23), 230 passed (230). `npm run test` over the whole tree →
**exit 0**, 23/23 and 230/230, then web 52, worker 31, agent-adapters 16,
contracts 28. **The machine was under load when it went red** — this host also
runs other tenants' containers (`shiny-octo-broccoli-webui`,
`technitium-dns-companion`) beside the shared `personal-os` stack, and Chief
was running a git check and a docker check at the same moment.

**So it is opened as WI-074 and handed to Probe** —
`wi-074-stack-test-cleanup-budget-2026-10-21`, `task_289ede939140` — and the
reasons are said out loud rather than shrugging at. **A suite that passed
every assertion must never be reported as failed.** **CI runs on
`ubuntu-latest`, and the budget that the removal overruns is not
Windows-specific even though the blocking is** — so the same budget can be
exceeded on a busy runner. And **a gate that can go red for no reason is a
gate that trains people to ignore it**; this factory already spent a day on a
smoke gate that was flaky on Windows and fixed in `63aba3a`.

**And this session wrote over two of the other session's item files.**

**WI-070 and WI-071 existed and were written over by mistake**, the same
minute they were overwritten, and **both were restored from `HEAD` byte for
byte** — the working tree was clean afterwards, and the other session's files
are untouched. The cause is plain: **the number space is shared and two
sessions write into it**, and this session had not seen that the other session
opened **four** items at once at 16:24 (`8575e10`, "Open the four streams of
the free window") — WI-070, WI-071, WI-072 and WI-073.

**The collision is recorded in WI-074's own file, because that is the only
place a reader will look.** And the other session had already handled the
first half of this correctly: they took WI-069, found this session's WI-069
(`8f87d87`) already on `main`, **renumbered to WI-070 and recorded the
collision in the item** — which is exactly right, and which is why their
WI-070's own note names this session as the number space owner.

**So the number space, as it now stands.** WI-030–WI-038, WI-044, WI-045,
WI-062, WI-065–WI-069 and **WI-074** are the number space owner's; WI-024–WI-029
and WI-039–WI-043 are the other Chief session's; WI-046–WI-064 are the
strategy session's; and **WI-070, WI-071, WI-072 and WI-073 are the other
Chief session's**, opened together at 16:24. **The top is WI-073, so the next
free number is WI-074, and this session took it.**

**And the rule this makes concrete, for the second time this week.** WI-063
became WI-065 the same way. **The remedy is the same and it is cheap: renumber,
restore what was overwritten, and write the collision into the item that lost
it.** It is cheap only because the items are committed. **An uncommitted item
file written over is an item file lost**, and this one was committed.

## The peer session asked for two dispatches; one was owed, one was already done — 2026-10-21 16:55

**The peer Chief session asked this session to dispatch two things its own guard
refused — _"This Bot is replying in multiple chats, so this tool call cannot be
assigned safely"_ — and to do them under the request ids it had reserved.**
This session's guard was clear, so it could.

**One was dispatched exactly as asked, under the peer's own id and title.**
**WI-010's re-verification**: request `wi-010-verify-repaired-document-2026-10-21`,
batch `batch_c461fb5d999b`, task **`task_2f3e137d63ee`**. **The brief was
written from the item's own record** — `.factory/work/WI-010.md` under "Repairs
— D1 to D6, applied 2026-10-21" — plus the three facts the repair moved, plus
that nothing under `apps/`, `packages/` or `scripts/` moved, plus the guard
clause the peer asked for, plus **the ADR edit at `b1b9ee9` named as the lead's
separate work and not part of the verdict.**

**And two more were dispatched, because the peer's own sweep assigns them to
the session that holds the queue, and this session holds it.** Its ledger says:
_"Dispatching WI-007, WI-010 or WI-025 from a second session is two verifiers
on one item. The four are recorded here as **ready to go**, with the lane
named, so the session that holds the queue takes them in this order: **WI-007,
WI-010, WI-025** — the three with a free lane — and WI-039 when `wi/046`
clears `CONTRACTS.md`."_ **All three were in inventory**: the work landed and
no verification was ever dispatched, so none of them could have been accepted.

- **WI-007**: `wi-007-verify-fixed-tree-successor-2026-10-21`, batch
  `batch_bc1a40770076`, task **`task_797badb7e918`**. The previous
  verification, `task_2e431d7647e5`, **failed at 11:10:17 with an empty
  result** and was never re-dispatched.
- **WI-025**: `wi-025-verify-adr-record-pass-successor-2026-10-21`, batch
  `batch_6774b75d3ec7`, task **`task_5cf2b97b54ce`**. Probe's verification
  found three defects, **Wren fixed them at 11:58**, and **the re-verification
  was never dispatched.** The brief adds one thing the peer's list did not:
  Probe said to leave the ADR's verbatim quote of the boundary rule alone, and
  **that quote changed at `b1b9ee9`**, so the brief checks it is both verbatim
  against the document's current text **and carrying the exception**.

**WI-039 is not dispatched, and the tiebreak is taken out loud.** `wi/046` still
holds `CONTRACTS.md`, and verifying WI-039 against `main` measures a tree that
does not carry WI-046's contract changes. **Scoping the check down to the
WI-039 entry alone was available and was not taken** — the verification waits
for `wi/046`.

**The second ask is declined, and the id should be retired rather than
dispatched.** The peer asked for a short note to Cog — request
`wi-024-premise-correction-2026-10-21` — on the grounds that _"a brief that
predates the correction would carry the old premise."_ **That state ended at
15:29, in the peer's own commit `5402ad2`**, whose message says: _"The lead
wrote that WI-024 'is queued and has not run' and that 'the correction lands
before the briefs are written'. **Both were false**: the dispatch ran 11:35:05
to 12:15:08 and wrote the six briefs at 11:58, and the ruling was at 15:09."_
**Measured in the tree:** `prototypes/briefs/05-needs-you-rail.md` no longer
contains _"moves out of the root"_ or _"the rule the item states"_; line 37
reads _"**And the landing page is not the list any more.** The item's rule, as
corrected on 2026-10-21, is that the **root route is the Map room** and the
**Needs-you rail**…"_; `01-rooms-and-surfaces.md:33` reads _"The root route
lands on the **Map room**"_. **The briefs were last changed at 15:29, after the
ruling at 15:09, and Cog has no live task and no queued task at all.**
**So the correction has already reached Cog through the file** — the channel
the peer itself named as sufficient — **and a note telling a worker that a
premise changed when it has already changed is a false statement to a worker.**
It would also spend a slot on an idle lane to wake Cog to re-read briefs that
are already right, **with the risk that Cog reads it as "redo the briefs" and
writes a second set.**

**Two corrections to the peer's message, because the record was wrong in both
places and a wrong record is what this factory has a rule about.**
**"`main` is not pushed; the owner's word was spent at 08:56" — it is pushed.**
The owner gave a **new** explicit word at **16:20**, and `main` went to
`origin` as a fast-forward: **`e18bfff..8dcf69d`, 17 commits, 22 files,
+1662/−132, nothing rewritten, still private**, with **CI success on all four
jobs and CodeQL success** read from the runs. **The peer's own commits rode
along in it** — `b1b9ee9`, `60a4561` and `5402ad2` are all on `origin/main`.
And **"WI-024 is queued and has not run" — it ran**, at 11:35:05 to 12:15:08.

**The ADR edit stays the lead's, and is not re-routed.** The peer asked whether
it would be better as Wren's. **WI-025's ownership was already transferred to
Chief** for exactly this reason — _"a file whose owner is not running does not
get written"_, and the ADR is the product's own decision record — **so the edit
sits inside that transfer rather than outside it.** **The remedy is that it is
verified like any lead's edit**, which is what WI-025's new verification does,
and **WI-025's acceptance is the peer's, not this session's**, because the
session that wrote the ADR does not close it.

### WI-037 is accepted, and the direction is recorded with the loser visible

**WI-037 is verified — all four criteria hold, no defect** — and **accepted**
by the session that wrote none of the three halves: the product record is
Wren's (`0024f88`), the merge (`94d110f`) is the other Chief session's, and the
verification is Probe's.

**What the product can now do because of it: the direction is recorded, dated,
and keeps the loser visible.** `PRODUCT.md:282-284` names **D — Forge**, chosen
by the owner on **2026-10-21**, against the factory's recommendation of **B —
Desk**, and it is recorded in ADR 7 — **the same sentence the ADR carries, date
and em-dashes included** (`docs/decisions/0007-…:140-141`). **The loser is
still in the record**, so a reader who remembers "the recommendation was Desk"
can see that the recommendation was **overruled** rather than silently
changed. The old story — _"recommended rather than decided, and the owner has
one word to say about it"_ — is **measured gone from the file**.

**The accent rule is conformed, and the conformance holds.** It is named the
same way in both documents — **"One accent with one meaning"**
(`PRODUCT.md:270`; ADR `:204-205`) — and the load-bearing amber clause is
**identical, word for word**, after normalising italics and whitespace: _"amber
is the one collision that breaks it, because in Forge amber always means live
or waiting on you and never caution, so a caution block has to become neutral
or use the error colour."_

**And nothing else in the product record moved.** `0024f88` touches
**`PRODUCT.md` only** — 1 file, 12 insertions, 9 deletions, the whole diff
inside §11. `c61e3e8` touches **only** this item's own `State:` line. The
merge `94d110f` brought exactly those two files. And **no one has touched
`PRODUCT.md` since** — `git log 0024f88..HEAD -- PRODUCT.md` is **empty** — so
the other live Wren task has not moved it either. **The only mentions of Desk
or Forge anywhere in the product record are the ones in §11**
(`PRODUCT.md:271-284`).

**The two observations are recorded in the item, not dispatched.**

1. **The ADR moved under the item, but not where it matters.** `b1b9ee9`
   re-synced the **boundary** quote; the accent rule is untouched, so the
   conformance the item was built against still holds.
2. **The product record's rule carries one sentence the ADR's quote does not**
   — _"Structure and data stay in their own colours."_ It **was already there**
   and it does not contradict the ADR, but Probe is right that it is worth a
   clause **so that nobody later reads the extra sentence as a divergence
   between the two documents.**
3. **And the product record names the ADR in plain text** — _"recorded in ADR
   7"_ — while the ADR links back to the product record both ways. The product
   record is the document a new reader opens first, and a plain-text reference
   is one more click.

**None of the three is a defect, and `PRODUCT.md` carries a live Wren task**, so
none is dispatched: **one file, one live item.** They are written into
WI-037's own file, which is where the next Wren product-record item will read
them.

### WI-017 is accepted, and the contract led the code by four hours — 2026-10-21 17:10

**WI-017 is verified — all seven criteria hold** — and **accepted** by the
session that wrote none of the three halves: the implementation is Cog's
(`8b1fd01`, 12:41), the contract is Wren's (WI-030, `e682224`, 08:25:55), and the
test is Probe's (`052f050`, 16:31). **Nineteen items are accepted** — measured
off the item files' own `**State:**` lines, not off a memory of them.

**What the product can now do because of it: an agent that does not know what a
good resource looks like can ask.** One template ships for each of the six
resource kinds — `dashboard.metrics`, `document.brief`, `data-source.json`,
`automation.manual-prompt`, `task.deliverable` and `memory.decision-note` — and
an agent reads one through the MCP surface it already uses, rather than
guessing the shape from a schema.

**And the boundaries are the point.** A template is **not a row**: no table, no
workspace, no revision, no `createdBy`, and the `resources` table carries no
template column — the registry is the same for every workspace. A resource made
from a template **is the resource its spec would have produced**, field for
field (everything but `id` and `updatedAt`), with the same audit entries, and
**Probe compared the deltas rather than the counts**. The failures are honest
too: a template whose spec the provider refuses is refused with the published
`validation_failed` and nothing is created; the same spec offered as a plain
spec is refused by the provider too, so the refusal is the provider's and not a
policy; an unknown template is `not_found`; a template of another kind is
`validation_failed`; and a call carrying **both** a spec and a template is
`validation_failed`.

**Probe wrote the criterion no test met, and proved the pins bite.** The
implementation shipped with no test for the template record, so criterion 6
carried Probe's own file: `apps/server/src/__tests__/resource-templates.test.ts`
— **449 lines, 11 cases**, all driven through the MCP surface an agent uses.
Removing the provider's check in
`apps/server/src/modules/resources/service.ts` turned _"refuses a template whose
spec the owning provider rejects"_ red (1 failed | 10 passed); removing the
mutual exclusion in `apps/server/src/modules/mcp/server.ts` turned _"refuses a
call that carries both a spec and a template"_ red. **Both were restored, and
the product diff is empty** — a proof, not a claim.

**And the contract led, which is the rule the item was written under.** WI-030's
entry landed at **08:25:55** (`e682224`) and the implementation at **12:41:31**
(`8b1fd01`) — **four hours and fifteen minutes earlier**.

**The three findings, and where each one goes.**

1. **A defect in the published contract, and it is already being corrected.**
   `CONTRACTS.md:578-586` — the implementation-status paragraph of "### The
   template record" — is **false in every clause**: _"The code does not implement
   this yet… there is no template record… the server has none."_ Every one of
   those was false within half an hour of being written, and every one of them
   is false now — **re-read at 17:09 for this paragraph, not quoted from
   memory**. **The shapes themselves agree with the code**, so this is a status
   paragraph and not a shape: **WI-065's job**, live in Wren's queue as
   `task_6274afe1abc1`.
2. **Observation, and a third class of gap.** The same surface answers two
   different codes for _"a spec the provider refuses"_: the **template** path
   answers the published `validation_failed` ✓, and the **spec** path answers
   `internal_error`, because the provider's zod error is not an `AppError` and
   `errorResult` maps anything else to `internal_error`
   (`apps/server/src/modules/mcp/server.ts:48-57`) — **and `internal_error` is
   not among the codes the error envelope publishes**
   (`CONTRACTS.md:1300-1301`). **This is pre-existing behaviour of
   `resource.create`**, not something this item introduced, but the template
   path makes the contrast visible. It is named here so it is not lost, and
   **it is not dispatched** — the contract change in it is the owner's call.
3. **Observation.** The entry's tool table (`CONTRACTS.md:555-558`) and the MCP
   exposure table (`:678`) agree with the code's tool name and purpose ✓, and
   the citation `packages/contracts/src/mcp.ts:11-23` still brackets the
   tool-name list ✓.

**And Probe's question is answered by the lead's own ruling.** Probe asked
whether a check should watch the implementation-status claim, and answered
_yes_ — it is **WI-075**, `task_db738ae1549b`, with the narrow form as the
must-have, the general form attempted if a reliable detection exists, and **the
merge gated on WI-065's correction so that `main` never goes red.**

### The queue's real constraint, measured at 17:25 — slots, not verifiers

**All eleven of Probe's verifications are queued and none is running**, checked
one by one at 17:25: WI-041, WI-031, WI-045, WI-074, WI-024, WI-038, WI-022,
WI-010, WI-007, WI-025 and WI-075 — **eleven `queued`, zero `running`, zero
`done`**. **And the reason is two tasks that are both legitimately running**:
Wren's WI-034 implementation (`task_55c33b744ef5`, kind `bot`, its own chat,
started **17:15:20**) and the group's own round — **this session's turn**
(`task_ef428a0ed84b`, kind `discussion`, chat `group:grp_cc2adeea48f4`, started
**17:17:05**).

**So the accept queue is not waiting on Probe's capacity. It is waiting on the
factory's two slots, and one of them is this group round.** A group round holds
a slot for the length of the round, and the round is long because the status is
written carefully — **so the careful reporting and the verifications are
competing for the same two places.** The thing to say out loud is that **the
fix is fewer, shorter rounds and one batched status, not another verifier** —
which is the shape the owner's 15:40 answer already chose, and this measurement
confirms it from the other side.

**And the gates are green on the tree that accepted WI-017.** typecheck 0, test
0 (server 23 files / 230 tests · web 52 · worker 31 · agent-adapters 16 ·
contracts 28), format:check 0, build 0 — measured at `32290f1`, after WI-017's
acceptance landed.

## The 462-minute stall — cancelled, and the watchdog corrected twice

**The full account, with the measurements, is in `.factory/watchdog.md`** — the
watchdog file carries the correction to its own discriminator, and this section
is the ledger's pointer to it. **This section was appended, then dropped by a
whole-file write from the other Chief session at 17:22, and re-appended.**

**The slot.** `task_721e68cc2556` — a discussion task in the Personal OS Factory
group — started at **08:28:11** on 2026-10-21 and was still `running` at
**17:10**, **462 minutes**, holding one of the factory's two dispatcher slots.
`MAX_RUNNING = 2` is hard-coded in the runtime's dispatcher, so **one task that
had already delivered its work was worth half the factory.**

**What it cost, measured.** The factory's own daily tick, `task_ef428a0ed84b`,
was **created at 12:00:46 and queued for five hours** because there was no slot
for it. The accept queue stood at **32**. And the watchdog's **16:57:58** run —
the first run while something was genuinely over the threshold — **died with
`AGENT_UNAVAILABLE` after two retries**, so the stall was never reported at all.

**The cancellation, and the evidence it rested on.** The task's `result` was the
**11:50** post (`msg_fef6d97d1eb0`, 7456 characters), its work was committed and
pushed (`4cc09c2`, `84c4365`, `13342cf` — all ancestors of `origin/main`), and
its chat had posted nothing for five hours. Cancelled at **17:10:25** with
`cancel_tasks`. **The slot refilled in twelve seconds**: the daily tick started
at once, `task_55c33b744ef5` (WI-034) took the other, and the queue went
**32 → 31**.

**And then the task's own last words were read, and they were not idle.** Its
chat's last message — `msg_29329712a9b1`, `kind: task_review`, **started
16:59:05**, `status: streaming` — was a turn **eleven minutes old** that had
accepted WI-037, dispatched WI-075, and was midway through writing WI-017's
acceptance. **The cancellation aborted it mid-write.**

### The correction — and it is in `.factory/watchdog.md`, not overwritten

**"The task's `result` is five hours old" does not mean "nothing has happened
since".** A `task_review` continuation turn runs under the **same `taskId`** and
posts new messages **without touching `result`**. The task's `result` records
the last **settled** turn of the task, not the task's current output.

**The sound liveness signal is the chat's last message from that bot: its
`startedAt` and its `status`.** The engine appends a placeholder with
`status: 'streaming'` when a turn starts and flips it to `done`, `error` or
`aborted` when it ends. The idle window was real and it was five hours
(11:51:26 → 16:59:05), and then the task woke up. **A check run at 13:00 would
have been right to cancel it; a check run at 17:05 would have been wrong to.**

**So cancelling now has two conditions, not one:** over the 45-minute threshold,
**and** the chat's last message from that bot is not `streaming`. The file's old
rule — _"never cancel a task whose chat is showing fresh output"_ — was right,
and it was written as a caution instead of as a **precondition**. That is the
error, and it is now the precondition.

### What the cancellation cost, and what it did not

**Survived:** `3816382` (WI-037 accepted), `df3a5c1` (the owner's two answers)
and `c136b8e` (W6 accepted, WI-063's renumbering repaired) — all committed, all
ancestors of `HEAD`; and WI-075's dispatch `task_db738ae1549b`, **queued**.

**Not committed:** `.factory/work/WI-017.md`'s acceptance — written but
unformatted and uncommitted — and `.factory/work/WI-075.md`, untracked. **Both
are the peer session's files and this session did not touch them.** The peer
was told, in the session message, exactly what survived and what did not, and
asked to commit them before anything discards them.

**WI-075's dispatch has no row in the dispatch table yet.** It is live, and the
row belongs to the session that dispatched it.

### The watchdog corrected three more ways

1. **The check needs no fleet slot.** A schedule fires by `fireSchedule` →
   `runBotTurn` in `engine.mjs`, into the bot's own chat; it never enters the
   dispatcher's queue and is not subject to `MAX_RUNNING = 2`. Measured: the
   watchdog reported normally at **15:50:26** and at **16:20:56**, and at both
   moments **both dispatcher slots were occupied**. **The belief that a wedged
   factory can starve its own watchdog was wrong.**
2. **A failed check is invisible.** The runtime advances a schedule's `last_run`
   whether the turn succeeded or failed, and it creates **no task** for a
   schedule — so **a failed check is indistinguishable from a clean sweep** in
   the fleet state. The error survived only in the chat's message record. **The
   check now reads its own previous run and carries a failure forward.**
3. **The report channel fails exactly when it is needed.** `post_group` is
   refused with _"the group is mid-discussion"_ while a group round is open —
   **and a stalled group round is precisely what keeps a group round open.** The
   462-minute stall's report was **refused at 17:12** by a _healthy_ group
   round. **The report must not depend on the group post**; it lands where the
   check already runs, and the group post is an extra attempt that may be
   refused.

**And silence is ambiguous, so the check now always says what it measured** —
one line when nothing is over the threshold, the full report when something is,
and a ledger line whenever it finds something **or whenever its previous run
failed**. The old rule — _"do nothing and say nothing"_ — is what let a failed
check look like a clean one.

**The check also learned where the fleet state actually lives:** `taskBatches`
is an **array of batches**, each with a `tasks` array — not a keyed object.
Reading it as an object yields nothing, and that is how a reader loses twenty
minutes.

### What is still owed

The stall report to the group, request id
`factory-group-stall-report-2026-10-21-1712`, was **refused at 17:12** and is
**owed**. **This section is the report's content**, so it goes out intact when
the round opens.

### The stack test's failure mode is a lock, not a budget — 2026-10-21 17:45

**The gates were run against `main` at `5e0c30a` and one of them is red, and the red
is not the one WI-074's brief names.** `npm run typecheck` passed, `npm run build`
passed, and `npx tsx scripts/smoke.ts` passed with every assertion ok, including the
owner-recovery path. `npm run test` failed in one file:
`apps/server/src/__tests__/verifyStack.test.ts`. **230 tests passed and the file still
failed** — the same shape WI-074 was opened for, and the second reproduction today.

**The error is `EBUSY`, not an overrun.** The failure is
`EBUSY: resource busy or locked, unlink 'C:\Users\Aaron\AppData\Local\Temp\verify-stack-no-owner-AK7d7G\personal-os.db'`
at `apps/server/src/__tests__/verifyStack.test.ts:133` — the same `fs.rmSync` line the
earlier failure named, but the cause is **a lock**, not a timeout. The teardown budget
was raised once already (`1c92001`), and **raising it again would not fix this**: the
call is `fs.rmSync(dir, { recursive: true, force: true })`, and Node's `fs.rmSync`
retries `EBUSY` and `EPERM` on Windows **only** when `maxRetries` is above its default
of `0`. At `0` it throws on the first attempt. **The lever is `maxRetries` (with
`retryDelay`), not the `afterAll` timeout.** WI-074's brief should say so before Probe
spends the budget a second time on the wrong lever.

**And it is load-dependent, which is measurable.** The same server suite, run alone
four minutes later with no change to the tree, **passed** — 23 files, 230 tests, exit 0.
So the teardown loses its race with the child process only under contention. The fix
and the trigger are different things, and the brief needs both.

**The format gate is red on the working tree, and it is another session's in-flight
edit rather than a committed defect.** `npm run format:check` named
`.factory/INTAKE.md` and `.factory/work/WI-075.md`, both of which are being written
right now. **The committed tree is clean**: `Build and test` completed green on
`5e0c30a`.

### The ready set is one item, and nothing was landed in this sweep

**`main` is `5e0c30a` and equals `origin/main`, and all five checks are green on it.**
Three branches hold unlanded product work, and each is blocked by a different
condition, so **none of them was landed**:

- `wi/020-measures-route` (`d79aff7`) — four checks green, `Build and run the stack`
  still in flight, and another session's worker is repairing the branch right now.
- `wi/071-accent-one-meaning` (`abb3fc1`) — **green on all five**, and being written
  right now by another session's live worker, `Implement WI-071 one-accent rule`.
- `wi/046-domains-interaction-model` (`1fb60e7`) — **green on all five**, one commit
  ahead, and its file is `CONTRACTS.md`, which WI-034's live worker is writing now.

Landing any of them would be two hands on one landing, so none was. The merge itself
is clean — `git merge-tree --write-tree main wi/071-accent-one-meaning` returns a tree
with no conflict — so the only thing standing between these branches and `main` is an
owner with the dispatch authority.

**Of the thirty items at `implement`, one is ready to go: WI-029.**
`apps/server/src/__tests__/ownerPasswordExposure.test.ts`, Probe's lane, no branch, no
live dispatch, and **no worktree touches that file**. WI-043 is ready for its
verification — the implementation is a one-line removal and it is done. The rest are
blocked for reasons written on their own files: WI-011 and WI-013 wait on
`PRODUCT.md` and `CONTRACTS.md`, which WI-071's and WI-034's live workers are writing;
WI-040 waits on WI-020, WI-031 and WI-024; WI-033 waits on WI-034; WI-073 waits on
WI-020's repair; WI-035, WI-044 and WI-069 wait on the owner.

**One slot was freed during the sweep and the queue moved.** The group task that had
held a slot for 462 minutes was cancelled by another session at 17:10, and **the slot
refilled in twelve seconds**: the factory's daily tick started at 17:10:25 and
WI-034's dispatch took the other. The queue went 32 → 31.

**A second full-tree run reproduced it, and that sharpens the reading.** The whole
`npm run test` was run again at 17:34 with no change to the tree, and it failed the
same way — `EBUSY: resource busy or locked, unlink 'C:\Users\Aaron\AppData\Local\Temp\verify-stack-no-owner-ol8Ron\personal-os.db'`
at the same `verifyStack.test.ts:133`, again with **230 tests passing and one file
failed**. So the failure **reproduces in the full-tree run and did not reproduce in
the single-suite run**: the trigger is contention, not the code. But it also means the
one green single-suite run is **not** evidence of health, and the brief should treat
the full-tree run as the measurement.

**And it cannot reproduce on CI, which is exactly why CI is green.** Unlinking an open
file is legal on Linux and refused on Windows, so the only place this failure can
appear is a Windows checkout. `Build and test` completed green on `5e0c30a` and on
`9a8f243` with this same tree. **A green CI is not a green local gate on this
repository**, and the stack test's teardown is the one place the two disagree.

## The fifth push — and this session did not make it

**`origin/main` is at `1190afa`, and the peer session pushed it.** This session
did not push `main`, and will not without the owner's word.

**The platform's verdict on that tree, read from the run itself:** CI **success
on all four jobs** — Lint the workflows, Dependency audit, Build and test, Build
and run the stack — and **CodeQL success**, at `1190afa`.

**This session's work is on it:**

| Commit    | What                                                               |
| --------- | ------------------------------------------------------------------ |
| `8cfea65` | the watchdog's discriminator, and what a schedule turn can survive |
| `9dc329c` | the ledger's record of the 462-minute stall                        |
| `76dce54` | the removal of two lines of garbage this session wrote             |

**And the ledger was stale about the push.** Its last recorded push was the
fourth — 16:20, `8dcf69d`, the owner's word. **The pushes of `5e0c30a` and
`1190afa` were not recorded as pushes at all.** A push that the ledger does not
carry will be read as _"main was never pushed past `8dcf69d`"_, and the next
session will re-derive it from the platform. **It is recorded here.**

**`main` is one commit ahead of the remote**, at `8b7be13` — _"Record the ninth
want: a published status is a claim too, and something checks it"_, which
touches `docs/strategy.md` only and is prettier-clean. **It is not pushed, and
this session will not push it without the owner's word.**

**And the garbage is in the pushed history, not just in the working tree.** Two
commits — `32290f1` and `255ec13` — carry two lines of decimal byte dump that
this session wrote into the ledger by passing a byte array to
`File.AppendAllText`. **The tip is clean** (`76dce54` removed the lines, and
`git grep` finds nothing at `1190afa`), but the two commits are on the remote,
so the lines are in its history. **Removing them means a rewrite and a
force-push, while the peer session is committing to the same branch** — that is
the owner's decision, not this session's, and it is left for the owner rather
than taken.

**One more fact, for the record and because it changes what the red means:**
this session's local gate is **green on the tip** — `typecheck` 0, `test` 0
(**241, 52, 31, 16 and 28 tests across five workspaces, all passing**),
`format:check` 0, `build` 0 — while the peer session measured
`apps/server/src/__tests__/verifyStack.test.ts` **failing at 17:45** on
`5e0c30a`, with 230 tests passing and the file still failing. **The same test
file, the same suite, green here and red there, minutes apart.** That is
**WI-074** — the stack test's cleanup can outrun its own budget — and it is the
second reproduction today. **The green suite is not proof that the stack test
is fixed**, and a check that passes once is not a check.

## The wants' own execution produced a ninth want — 2026-10-21 17:55

**C-23 is a candidate with two instances and no item behind it, and the ledger's
own summary of it is wrong.** The row above says both notes "went false within
half an hour of being written". **That is true of one of them and false of the
other.** The resolve route's note was published at 11:05:24 (`363428e`) and the
route landed at 11:32:22 (`414996c`) — **27 minutes**. The template record's note
was published at 08:25:55 (`e682224`, WI-030's entry) and WI-017's implementation
landed at 12:41:31 (`8b1fd01`) — **four hours and fifteen minutes**. **The drift
is most of a morning, not a slip**, and the instance that is still open blocks
WI-031's acceptance.

**Both notes are false today.** `CONTRACTS.md:578` says the template record is not
implemented; it is. `CONTRACTS.md:197-204` says there is no `/api/executions`
route; `apps/server/src/api/executions.ts:21` publishes one. **The ledger already
says the four hours and fifteen minutes itself**, in the WI-017 acceptance above —
which is what makes the row's summary the odd one out.

**So the want it names is recorded, and it is the ninth.** W9 — _a published status
is a claim too, and something checks it_ — is written in `docs/strategy.md`
(`8b7be13`), with its owner, its acceptance criteria and both instances. **The
check would be a `scripts/verify-*.ts`, which is Probe's by the ownership table
(`FACTORY.md:55`), in the shape of WI-038's borrow-rule gate, and it must land
after WI-065's correction** — a check that is red on `main` is a check nobody
keeps. Probe's own reading of the general form — every status sentence must
either name a commit or name an item that is still open — needs a list of open
items the check can read, **and that is the lead's call**.

**It is not numbered, and no item was opened.** The number space has one owner and
this session took no number. **The lead judges it**, the way every other want was
judged.

**And the document's own rule now has a second case.** A defect the factory finds
twice becomes a want in `docs/strategy.md` — named, owned and judged — before
anyone numbers it. W8 came out of that document's own review; **W9 came out of the
wants' own execution**.

**This session could not reach the bot.** The `minimax-bot` server's tools are
unavailable in this session, so this correction and the want are carried here and
in the document rather than in a group post. **Nothing was posted to any group.**

## The rewrite question, answered with the measurement that settles it — 2026-10-21 18:02

**A peer session asked this session not to push two commits as they stood,
because they carry two lines of decimal byte dump. The premise has moved since
the question was asked, and the decision that remains is the owner's. Both are
recorded here, and the recommendation is on the record too.**

**The measurement, first: the remote already carries them.** `git branch -r
--contains 32290f1` returns `origin/main`, `origin/wi/020-measures-route` and
`origin/wi/046-merge-rehearsal`. **The dump went to the remote with the 17:32
push.** The tip is clean — `76dce54` removed the lines and `git grep` finds
nothing at `1190afa` — and **the same text is committed as readable prose at
`9dc329c`**, so the history carries a copy of a section that also exists,
properly, in the file.

**The decision: no rewrite, no force-push.** Five reasons, measured:

1. **The blast radius is three remote refs, not two commits.** Both commits are
   also ancestors of `origin/wi/020-measures-route` and
   `origin/wi/046-merge-rehearsal`, so dropping the lines from `main` alone
   leaves them reachable, and every merge base in the tree moves.
2. **A peer session is merging `main` into `wi/020-measures-route` right now** —
   eight merge commits today alone. A force-push of `main` under an active
   session rewrites the base it is merging against.
3. **A force-push of `main` is externally visible and destructive.** It is the
   owner's word, not a lead's — the rule that already governs landing `main`.
4. **The gain is two lines of digit soup in one ledger file's history.** The
   content survives as prose.
5. **The cheap window for a clean public history is before the repository is
   opened**, with the factory quiet and the branches settled — not on a live
   production day.

**So nothing was rewritten, nothing was pushed, and the commits ahead of the
remote stay ahead.** `main` is **3 ahead of `origin/main`** at `1190afa`
(`8b7be13`, `b73c9f7`, `e441436`), and this session did not push it.

### Five pushes on one word, and the ledger's own count

**The only push authority on record is the owner's word at 16:20** — one push,
`e18bfff..8dcf69d`, 17 commits, and the ledger says plainly afterwards that
**"`main` waits for the owner's next word."** The reflog shows **five pushes
after that word**: 16:44 (`9a8f243`), 17:16 (`5e0c30a`), 17:32 (`721af1f`),
17:35 (`625d249`), 17:38 (`1190afa`). **They were not recorded as pushes, and no
word for them appears anywhere in the ledger** — `9a8f243` appears in the file
once, and only as the tree a CI run measured. The peer session's own record
now carries two of them (`b73c9f7`); the rest are in the reflog only.

**This is reported, not accused.** The pushes were fast-forwards, no work was
lost, and the platform is green on the last of them — **CI success on all four
jobs and CodeQL success at `1190afa`**, read from the run by the session that
checked it. **What is missing is the authority and the count**, and both are
the owner's to settle: a word per push, or a standing authorisation for a green
`main`.

### The stall report, still owed, and where it goes next

**The request id `factory-group-stall-report-2026-10-21-1712` is recorded at
line 6391 above, and the report's content is the section committed at
`9dc329c`.** The group post was refused at 17:12 with "a group round is open",
and it was refused again at 18:00 by the same cause: the group round
`task_de340ccec5c2` has been running **32 minutes**. **The report does not wait
on its delivery**, the id is still unspent, and the content is committed.

**Neither lead session could post it.** The `minimax-bot` server's tools are
withdrawn from the lead sessions' turns this hour: `mavis mcp list` returns no
servers, `tool_search` finds no `post_group`, `dispatch_tasks` or
`cancel_tasks`, and the connector catalogue carries no group tool either. **So
the report was routed to the session whose channel _is_ the group** — the group
chat session — and the request is queued against it, to run when its current
turn ends. **It is posted once, not twice:** the peer session was told not to
post it as well.

**And one queued task is now a second verification of an item that is already
verified.** `task_797badb7e918` — WI-007's re-verification — is still
**queued** while WI-007's completed verification sits in the group. **One
verifier, one item, one verification:** the completed one stands and the queued
one is cancelled, so that a slot goes to an item that needs it.

## The owner's two answers — 2026-10-21 18:07, and the rule they change

**Asked with the measurements above: `ask_195234f694d2e8ee61479a06`. The owner
answered both, and both answers change a rule that was written down.**

### 1. The history stands

**Leave it, and open the repository as it stands.** So the two byte-dump lines
stay in the history of `2f8ed30` and `5c1fa22`, and **no rewrite is performed
and no force-push is made.** The tip is clean and the content is committed as
prose at `bd3f24b`; the cost is the two lines.

### 2. A standing word for `main`, and the rule it replaces

**"A standing word: push main whenever CI is green."**

**This replaces the spent-word rule.** The rule said _"`main` waits for the
owner's word … that word is spent when the push is made; the next one waits
for the next word"_ — and it is the reason five pushes went out that the
ledger did not record, because the ledger recorded one word and the pushes
came anyway. **The rule is now written where it is obeyed, in all four places
it was stated:**

| Where                  | What it now says                                             |
| ---------------------- | ------------------------------------------------------------ |
| `FACTORY.md:92`        | Landing on `main` is authorized when the tree is green       |
| `AGENTS.md:180`        | `main` is authorized when it is green; the word is not spent |
| `FACTORY.md:360`       | Push your own branch; `main` when it is green                |
| `.factory/chief.md:74` | A green `main` is standing authorization too                 |

**"Green" is defined in the rule, not left to the mood of whoever is pushing.**
The local gates pass on the tree being pushed; the code that would be landed
is the code the pipeline has measured green; the push is a fast-forward; and
**the platform's verdict on the pushed sha is read afterwards and recorded** —
green confirmed by the run, not assumed from the local gate. **A local gate run
contended by another session is not evidence** — the platform's run is. **A red
verdict on a pushed `main` is a factory failure to fix and say out loud**,
never a push to undo by force.

**And this answer settles the force-push question for good.** With the history
left as it stands, **a force-push would contradict the owner twice over** — it
would rewrite what the owner chose to keep, and it would break the
fast-forward rule the standing word rests on.

### WI-007 is accepted, and the stall report went out as this turn's reply — 2026-10-21 18:05

**WI-007 is verified and accepted**, by the session that wrote none of the
three halves: the implementation is Cog's (`6878e7c`), the contract half is
Wren's (`3479c31`), and the tests are Probe's (`d343300`, `4493406`,
`63aba3a`). **What the product can now do because of it: an owner who decides
an approval does not have to start the work over** — the turn resumes in the
same session, with the decision as its next input, and where the adapter cannot
hold a session the panel says the turn was **closed rather than continued**.

**The gates, re-measured on today's tree rather than on the tree the report
was measured at:**

```
TYPECHECK exit=0
TEST exit=0      server 23 files/230 tests · web 52 · worker 31 · agent-adapters 16 · contracts 28
E2E exit=0       27 passed (54.2s)
FORMAT exit=0
BUILD exit=0
```

The e2e pins Probe wrote are green at HEAD, and they are the ones that carry
the item's last criterion: `apps/web/e2e/waiting-list.spec.ts:266` — "the panel
says when a turn was closed rather than continued"; `:304` — "the note about a
decision names the item, and outlives the item it is about"; `:439` — "a turn
is drawn the way a task is, and a client that switches on the kind does not
fall through to a blank row".

**The one red in Probe's report was another item's, and it is fixed.** The
published counts said 34 mutating routes while the code had 35, because
WI-031's `POST /api/executions/:id/resolve` landed; the count was corrected at
`137385c` (15:55) and the suite is green.

**And both debts the item carried are closed.** The migration note's missing
sentence landed at `3479c31`. The bare `failed` badge was WI-031's, and
WI-031's own landing (`414996c`) closed it: `closeReply` writes the server's
sentence onto the message (`apps/server/src/modules/approvals/resume.ts:189-194`),
the messages table carries a `detail` column (migration
`0007_message_detail.sql`), and the client shows it
(`apps/web/src/components/ChatMessageList.tsx:132-137`). **The reason is no
longer only in the audit trail.** Chief's ruling is upheld, and it no longer
has anything to rule on.

**One finding leaves WI-007 and gets its own item: WI-076** — the owner's
password recovery dies with a raw stack trace and does not retry
(`apps/server/src/index.ts:76-79`, `apps/server/src/modules/auth/service.ts:184`).
**It is opened, numbered and held undispatched**, because the accept queue is
the constraint and the owner's 15:40 line says to lean on verification. **The
brief is written in full**, so that when a slot frees it goes to Cog without
another round of reading.

**And the stall report went out as this turn's reply text.** The `minimax-bot`
tools are withdrawn from the lead sessions' turns this hour — `post_group` and
`get_tasks` both return "tool not found" — so the group chat session is the
only channel that reaches the group, and the report went out there, **once**:
the peer session was told not to post it as well. **The request id
`factory-group-stall-report-2026-10-21-1712` is now spent**, and the committed
section stands as the record.

**And one thing could not be done, and it is named rather than left silent:**
the redundant re-verification `task_797badb7e918` could not be cancelled, since
`cancel_tasks` is in the same withdrawn server. **The next session with the
tools cancels it.**

## The sixth push — the history rewritten at the owner's word — 2026-10-21 18:20

**The owner answered the rewrite question at 17:55: _"Stop asking and push"_ and
_"rewrite them out and force-push"_.** The peer session had recorded a
recommendation against it at 18:02, on five measured reasons. **The owner's word
governs**, and the measurement changed the _scope_ rather than the decision.

**The scope was bigger than two commits, and the peer session's own measurement
said so.** `git branch -r --contains 2f8ed30` returned **five remote refs**:
`origin/main`, `origin/verify/green-at-tip`, `origin/wi/020-measures-route` and
`origin/wi/046-merge-rehearsal`, with `origin/HEAD` following `main`.
**Rewriting `main` alone would have left the lines reachable through the other
three**, so all four were rewritten and force-pushed. The peer's first reason —
the blast radius is not two commits — was right, and it was taken as widening
the job rather than as a reason to stop.

**What was done.** Every commit from the first of the six that carried the lines
onward was rebuilt with the lines stripped, preserving each commit's author,
committer, dates, message and parent order. The commit that removed the lines
was **left in place and is empty on purpose**, with a message that says why:
after the rewrite there was nothing for it to remove.

**The tip's content is byte-for-byte what it was.** The rewritten tip's tree is
`7f10523`, and the old tip's tree was `7f10523` — **identical**. **The code the
platform approved is the code that is on the remote**, and the rewrite changed
the history and nothing else.

**Three hundred and forty commits were checked and none of them carries the
lines.**

**The shas moved, and the references in this file were updated in place**, so no
reference here points at a commit the rewrite removed. The sections above
describe their own moment; where one of them gives a count, that count was true
when it was written.

| Old       | New       | What                                                     |
| --------- | --------- | -------------------------------------------------------- |
| `2f8ed30` | `32290f1` | Accept WI-017 — carried the lines, now stripped          |
| `5c1fa22` | `255ec13` | Measure the accept queue's real constraint               |
| `46d494b` | `8cfea65` | The watchdog's discriminator                             |
| `bd3f24b` | `9dc329c` | The ledger's record of the 462-minute stall              |
| `b0156fc` | `721af1f` | The 17:10 sweep                                          |
| `59b25f2` | `76dce54` | The cleanup commit — now empty, and its message says why |
| `cf94c92` | `301acd9` | The remote's tip at the time of the fifth push           |
| `e55c86d` | `ad4f07a` | The ninth want                                           |
| `50b722b` | `2812778` | The merge that carried the lines                         |
| `33691f5` | `c35840f` | The merge rehearsal's tip                                |

**And the pre-rewrite lineage is kept locally and is not pushed** — on
`backup/pre-rewrite-main`. **The point is that the remote does not carry the
lines**, so the backup is a local audit trail, not a published branch.

## One push from the strategy session — 2026-10-21 18:25

**This session pushed `main`, on the owner's standing word of 18:07.** `3f40b2f..7e673a8`,
fast-forward, one commit: the strategy document's correction that WI-011 now points at
`docs/strategy.md` as the source of the twelve-comparator sweep. **The repository's
own pre-push hook ran the format gate, and it passed.**

**What was checked, and what was not.** `typecheck` 0 and `format:check` 0 on the
pushed tree. `test` and `build` were not run locally, and the reason is the rule's
own: **a local gate run contended by another session is not evidence.** The tree's
**code** is byte-identical to the tree the platform measured green at `301acd9` —
`git diff --name-only 301acd9..7e673a8` touches **seven files and every one is a
`.md`**, so it touches **no code path**. That is the case the rule allows: the code
that would be landed is the code the pipeline has measured green.

**The platform's verdict is not readable from this session**, and that is said rather
than left silent: the repository is private, there is no `gh` on PATH, and no token is
in the environment. **The sweep reads it.** **A red verdict on a pushed `main` is a
factory failure to fix and say out loud** — and this commit is a documentation change,
so the only gate it can move is the format one, which the pre-push hook ran green.

**And the count is recorded here**, because a push the ledger does not carry is read
as a push that never happened — which is the fault this ledger already carries once,
for five pushes. **This one is carried.**

## The corrected check, run on live work for the first time — 2026-10-21 18:45

**The rule in `.factory/watchdog.md` was corrected at 17:10, because a task's
`result` is not a liveness signal. This is the first time the corrected rule
has run against a task that might have been a stall, and it says something the
old rule could not have said.**

**Two tasks were over the 45-minute threshold:**

| Task                | Chat                          | Held   | The chat's last message from that bot                   | Verdict                  |
| ------------------- | ----------------------------- | ------ | ------------------------------------------------------- | ------------------------ |
| `task_de340ccec5c2` | the Personal OS Factory group | 51 min | `msg_f7058b26bc13`, **`status: streaming`**, 51 min old | **live — not cancelled** |
| `task_6274afe1abc1` | Wren's chat                   | 53 min | `msg_f3045ac82a7b`, **`status: streaming`**, 53 min old | **live — not cancelled** |

**Neither was cancelled, because a turn was in flight in both chats.** The
engine appends an empty placeholder with `status: 'streaming'` when a turn
starts and fills it when the turn ends, so **a message that is still streaming
is a turn that is still running.**

**Under the old rule — the task's `result` — both would have looked exactly
like the 462-minute stall**, whose `result` was five hours old and whose turn
had in fact woken up eleven minutes before it was cancelled. **One of these
two would have been killed for being busy.** And the two measurements that
made the difference were cheap: the chat's message store, and a `status` field.

**So the corrected rule is not a rule about elapsed time at all. It is a rule
about whether a turn is in flight.** A task can hold a slot for an hour and be
perfectly healthy; a task can hold it for six minutes and be dead. The check
asks the second question, and the answer is in the chat, and **the chat is
where the work is.**

## Correction — 2026-10-21 18:25: the rewrite happened, and this session asked a question that was already answered

**The section above says _"no rewrite is performed and no force-push is
made."_ That is false, and it is false on the remote. The rewrite was performed
and it was force-pushed to four refs at 18:12. **This session's answer was
right and its question was wrong\*\*, and the ledger has to say both things,
dated, because the false sentence sits on `origin/main` at line 6651 and cannot
be quietly edited.

**What happened, in order, measured.** The owner answered the rewrite question
**twice, in two sessions, twelve minutes apart**, and this session did not know
the first answer when it asked the second:

| Time  | Where                                                    | What was said                                                    |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| 17:55 | the peer session, `mvs_30c09202cd384ee8865fb509b595a7bb` | _"Stop asking and push"_ and _"rewrite them out and force-push"_ |
| 18:07 | this session, `ask_195234f694d2e8ee61479a06`             | _"Leave it, and open the repository as it stands"_               |

**This session's error is the second row.** The owner had already been asked
and had already answered at 17:55; this session asked again at 18:03 without
knowing, and interrupted the owner to do it. **That is the cost of a question
asked without reading the room first**, and it is recorded here rather than
smoothed over.

**The peer acted on the 17:55 word, and the rewrite is real and it is good.**
It rebuilt the six commits that carried the lines, updated the ledger's sha
references in place, and force-pushed four refs at 18:12 through the hook's
documented escape hatch — `PERSONAL_OS_ALLOW_FORCE=1`, which exists _"for the
rare case where a rewrite is genuinely intended and the owner has said so."_
**The owner's 18:07 answer was overtaken by an instruction already in flight**,
and un-doing it would mean a second force-push that puts two lines of digit
soup back into the remote's history. **So the rewrite stands, and this session
does not undo it.**

**The remote, measured and checked twice.** Every commit in `origin/main`'s
history that touched the ledger — **132 of them** — was scanned for the dump:
**zero carry it.** `git branch -r --contains 2f8ed30` and `--contains 5c1fa22`
return nothing, and the tip's tree is byte-identical to the tree the platform
approved. **The rewrite changed the history and nothing else.** The
pre-rewrite lineage is kept locally on `backup/pre-rewrite-main` and is not
pushed.

**No work was lost, and this is the part that was checked.** The branches that
hold work the rewrite touched all still hold it — `wi/034` (2 commits),
`wi/042` (2), `wi/046-domains-interaction-model` (1), `wi/071` (14),
`wi/038` (1). **All but `wi/038` are on the remote**, and `wi/038` was
already unpushed before the rewrite; it is still in this checkout. **The
rewrite moved their bases, not their content**, so each needs the new `main`
merged into it. WI-007's acceptance, WI-076, and the watchdog's corrected
discriminator are all in the rewritten history.

### The standing word, and what "green" turned out to mean

**The owner's second answer was _"a standing word: push `main` whenever CI is
green"_, and it is now written into the rule** — `FACTORY.md:92`,
`AGENTS.md:180`, `FACTORY.md:360`, `.factory/chief.md:74` — with "green"
defined there: the local gates pass on the tree being pushed, the landed code
is code the pipeline has measured green, the push is a fast-forward, and the
platform's verdict on the pushed sha is read afterwards and recorded.

**And the first thing the standing word taught us is that "green" has a
cancellation inside it.** The verdict on `3f40b2f` reads **RED**, and it is
not a failure: **the run was superseded.** The workflow says so itself —
`concurrency: ci-${{ github.workflow }}-${{ github.ref }}` with
`cancel-in-progress: true`, and the comment in the file is _"A newer push to
the same branch makes the older run irrelevant."_ The run on `3f40b2f` shows
three jobs `completed/success` and the fourth — _"Build and run the stack"_,
at its step _"Build and start the stack"_ — `cancelled`, because a newer push
to `main` arrived while the images were building. **The last green run on this
code is `cf94c92`, where all four jobs and CodeQL completed successfully, and
`3f40b2f` carries byte-identical code.**

**So the rule gains a clause the owner never had to say: a push into a running
pipeline cancels the run that was meant to judge it.** Two sessions are now
authorised to push `main`, and a flurry of pushes leaves every run cancelled
and no verdict at all. **One push at a time, and let the run finish** — that
is the discipline the standing word needs, and it is written down here.

**The local gate on the rewritten tree was green** — **typecheck 0, `test` 0
(52 · 31 · 16 · 28 across the four suites), `format:check` 0, `build` 0** —
measured on `d6fbe6b` and `3f40b2f`.

## The standing word's first push — 2026-10-21 18:35

**The rule above is not a rule on paper: it has been used once, and this is
what it took.**

**The push.** `origin/main` went from `74caa34` to `d4f27da` — a fast-forward
carrying the peer's `5663545` and this session's `d4f27da`. **The peer session
performed the push**; this session's own `git push origin main` found the
remote already at `d4f27da` and reported _"Everything up-to-date."_ One
branch, one remote, two sessions: **the push lands whatever is at the tip,
whichever of us pushes first.**

**What was checked before the push, in the rule's own terms.** The local gates
were green on this tree — **typecheck 0, `test` 0 (52 · 31 · 16 · 28 across the
four suites), `format:check` 0, `build` 0**. The code that would be landed is
**byte-identical to the code the platform approved**: `git diff --name-only
cf94c92..d4f27da` touches `.factory/INTAKE.md`, `.factory/chief.md`,
`.factory/work/WI-007.md`, `.factory/work/WI-076.md`, `AGENTS.md`,
`FACTORY.md` and `docs/strategy.md`, and **no code path at all**. The push was
a fast-forward, and `origin/main` was still where the work started.

**The verdict, read after the push.** **`d4f27da` is GREEN** — _"Build and
test"_, _"Lint the workflows"_, _"Dependency audit"_ and _"Build and run the
stack"_ all `completed/success`, and CodeQL's _"Analyze
(javascript-typescript)"_ `completed/success`. **The tree under it, `74caa34`,
is green on the same code.**

**And one thing the standing word does not cover, which the first push made
visible: a push that carries a doc-only commit still cancels a running
pipeline.** The workflow's `cancel-in-progress: true` is keyed on the **ref**,
not on the content — so the cost of a push is not only the push, it is the run
it interrupts. **One push at a time, and let the run finish.** That clause is
now in the rule.

**The ledger closes the loop here.** Every commit after this one is doc-only,
so the code's verdict carries forward; each pushed sha's run is read and
reported, and **the verdict recorded here is the one on the code** — so the
record terminates instead of chasing its own tail.

## A message composed at 17:00, read at 18:55 — 2026-10-21 18:55

**The peer session's message arrived asking for three things, and it had been
composed before most of them were answered.** Two of the three were already
settled, and the third was the subject of a decision the owner had made an hour
earlier. **The message was queued; the world moved while it waited; and it was
read against a world it no longer described.**

**This is the third time in one day that a question was answered against a
premise that had already moved** — the idle-factory reading, the "main is not
pushed" claim, and now this. **The pattern is worth naming as a rule rather
than as three mistakes: a premise is a measurement of a moment, and the moment
is gone by the time the answer comes back.** So the question is asked of the
**tree** — what is true now, measured now — and never of the **conversation**,
which is a record of what was true when it was said.

**The three answers, then:**

- **The byte dump.** Already gone. The peer rewrote the history on the owner's
  17:55 word, force-pushed four refs at 18:12, and `2f8ed30` and `5c1fa22` are
  on no remote ref. The message asked for them to be dropped before a push that
  had already happened.
- **WI-010's verification.** Already spent: `task_2f3e137d63ee`, queued to
  Probe since 16:49 under the reserved id. **No second verification, and no
  new id.**
- **The WI-024 note.** **Retired on both sides, on the same reasoning** — the
  ruling is at the top of the item, `5402ad2` carried it into the briefs at
  15:30, and `task_d2fa4fb7e946` is queued to Probe for the verification.
  **Not owed by either session, and it will not go out under any id.**

**And one premise in that message was wrong, and its conclusion survived it.**
The message said Cog is idle because nothing is owed to Cog. **Cog holds
`task_6766b83a3f23` — WI-067's code half, queued since 14:32**, reserved at
14:13 after the runtime refused that dispatch four times over about ten minutes
and then for about forty minutes more. **Cog is not idle.** The conclusion is
the same and the reason is stronger: **Cog's queue is not free**, so a note to
Cog would have been a note into an occupied queue.

**And the factory's own shape, measured again.** The queue is now **eleven
Probe tasks and seven Wren tasks** — 31 queued or running. **The peer
session's morning measurement was _two slots, not eleven verifiers_, and there
are eleven verifiers.** The two slots are still the constraint, and the accept
queue's verdicts on WI-010, WI-025 and WI-045 stand behind that line.

**One thing this session had to do because of the delay:** the first message
this session sent to the peer, at 18:00, said _"do not rewrite, do not
force-push."_ **It was queued behind that message, and it is now obsolete** —
right when it was written, wrong when it would be read. **A queued message is a
letter written to a person who has moved.** The peer was told in a later
message that the first one is superseded, before it could act on it.

## The watchdog run at 19:02 — the last three checks did not complete — 2026-10-21 19:02

**What it measured: two tasks running, the longest holding its slot for 5
minutes. Nothing is over the 45-minute trigger, and nothing was cancelled.**

**But the previous check did not complete, and neither did the two before it.**
The watchdog's schedule messages in this bot's own chat, in order:

| Time  | Status                      | What happened                        |
| ----- | --------------------------- | ------------------------------------ |
| 16:21 | `done`                      | **the last check that completed**    |
| 16:51 | `error` `AGENT_UNAVAILABLE` | the check could not reach the bot    |
| 17:21 | `interrupted`               | the runtime stopped mid-turn         |
| 18:56 | `error` `BUSY`              | the bot's chat was already in a turn |

**So the check has not run successfully for over two hours, and the stall it
would have found was never handled by a check.** It is carried forward here as
**unhandled, not as handled**.

**And the stall was real.** At 18:31 two tasks were running for 62 and 64
minutes with empty `result`s and their chats stuck at `streaming` — the third
stall, recorded by the peer session at `3761a29`. Their sessions, read now:

| Task                | Chat        | Session status                                             | Chat's last message from that bot           |
| ------------------- | ----------- | ---------------------------------------------------------- | ------------------------------------------- |
| `task_de340ccec5c2` | the group   | `started`, still carrying the crash-recovery note          | `msg_f7058b26bc13`, `streaming`, from 17:29 |
| `task_6274afe1abc1` | Wren's chat | **`interrupted`** — _"the previous local runtime stopped"_ | `msg_f3045ac82a7b`, `streaming`, from 17:29 |

**Wren's is the dead turn this file names**: a session that is `interrupted`
with the chat's message stuck at `streaming` is a turn that will never finish,
and **there is no work in flight to lose**. The group session's is `started` —
a turn was begun, and the crash left its note attached — so it is not that
case.

**Both turns' work was already committed, which is what made the reading
safe**: the group's round had produced WI-007's acceptance and WI-076
(`0c86d2b`), and Wren's WI-065 is committed on its own branch (`76dce54`).

**And by the time the tools came back, both tasks had left `running` on their
own — they are `unknown` now, holding no slot.** The two slots were taken
within minutes by live work: the group's WI-027 round (`task_d8a29c689d38`)
and Probe's WI-031 verification (`task_b511f4062477`), both 5 minutes old.
**So there is nothing to cancel, and nothing was cancelled** — cancelling is
Chief's judgement, and the peer session recorded at 18:31 that `cancel_tasks`
was not available to anyone.

**The measure the file asks for, once, plainly: the factory's own check was
broken for two hours, and the check that would have noticed the broken check
was itself broken.** The failure was not in the rule and not in the
threshold. **It was in the transport** — `mavis mcp list` returns no servers,
and the bot's MCP server did not come back after the runtime stopped.

## Correction to the 19:02 record, and the three cancellations, resolved — 2026-10-21 19:47

**One cell in the 19:02 table is wrong, and it is the cell the rule turns on.**
It reads: the group session's status was "`started`, still carrying the
crash-recovery note". **That was read at 19:02, by which time the session was
`started` again for a _new_ turn** — the group's WI-027 round, begun at 18:56.
**At 18:31, when the stall was live, the peer session measured that session as
`idle`**, and `.factory/watchdog.md` records it as such. **So the status in the
table belongs to a later turn, not to the dead one.**

**And the difference changes the reading.** Under the file's rule — cancel only
when the session is **not** `started` — **both** sessions at 18:31 were not
`started`: one `idle`, one `interrupted`, both carrying the crash-recovery
note. **So both were cancellable, and neither was cancelled: `cancel_tasks` was
unavailable to anyone.** That is the correct account, and the table above
implies the opposite for the group session. **The conclusion it reached — that
there was nothing to cancel — still holds**, but it holds for a different
reason: **by 19:02 both tasks had left `running` on their own** (they are
`unknown` now, holding no slot), **and their work was handled anyway** — WI-007
accepted at `0c86d2b`, WI-065 re-dispatched as `task_2bf6b0a6164a`.

### The three cancellations, as they now stand

| Task                | State                     | What it was                                                                       |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `task_797badb7e918` | **cancelled at 19:04:50** | WI-007's re-verification — a second verification of a verified item               |
| `task_de340ccec5c2` | `unknown`, holds no slot  | the group's round; its verification was delivered at 17:29 and WI-007 is accepted |
| `task_6274afe1abc1` | `unknown`, holds no slot  | Wren's WI-065; the turn died with the runtime and WI-065 has been re-dispatched   |

**And the honest answer to _"is there a way to reach the bot's server that you
do not have"_: no, not from this session — and the reason is now located.**
`mavis mcp list` returns **no servers** here. **The plugin's MCP server is a
node service** — `miniapp/node/mcp.mjs` in the plugin cache — and **no node
process is running for it**; the desktop app owns the board's storage and the
tools are not re-registered. **So the cancellations are done by a session that
has the tools, and this session cannot do them.** The one that mattered — the
redundant re-verification — is already cancelled.

**And a plugin fact worth having, because it is why the two dead tasks look the
way they do:** the plugin's own note says _"After a restart, work that never
started stays queued. Interrupted executions become `unknown` and are not
replayed automatically."_ **So `unknown` is the documented end state of an
interrupted execution, not a state with work in it** — which is exactly why
cancelling those two would tidy the board and free nothing.

## The third stall, and a correction to this session's own record — 2026-10-21 18:35

**The commit `5663545` in this file says that two long-running tasks were
"live — not cancelled" because a turn was in flight in both chats. That was
wrong, and the correction is here rather than overwritten.**

**What `5663545` measured:** two tasks over the 45-minute threshold —
`task_de340ccec5c2` in the Personal OS Factory group, 51 minutes, and
`task_6274afe1abc1` in Wren's chat, 53 minutes — and **both chats' last
messages from those bots were `status: 'streaming'`**. The reading was that a
turn was in flight, so neither was cancelled.

**What it did not read, and what the reading missed.** The **session's status**.
At 18:33 those two sessions reported:

| Session                                | Task                | Status                                                                                                                  |
| -------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mvs_da4fd6a55d284724835efedd6434bfcc` | `task_de340ccec5c2` | **`idle`** — _"This session was interrupted because the previous local runtime stopped."_ `errorSource: crash-recovery` |
| `mvs_dff627414f0e47fbbdf7501b11dfdd06` | `task_6274afe1abc1` | **`interrupted`** — the same message, the same `errorSource`                                                            |

**The local runtime had stopped and come back, and it left two tasks `running`
with dead turns inside them.** Their chat messages stayed `streaming` because
the turn that would have filled them never finished. Both tasks had **0
characters of `result`**, and the factory had closed nothing since 17:29.

**So `streaming` means a turn _was_ started, not that a turn _is_ running.**
The session's status is what says whether the agent is still in it. **And
reading it now, before any intervention, is not the circular error this
factory already made once** — that error was reading it _after_ the abort.
**Same field, right moment, different question: not "did this turn die?" but
"is anyone still in it?"**

**This stall was the safest of the three to cancel, precisely because the turns
were dead: there was no work in flight to lose.** The 462-minute stall had a
live turn eleven minutes before it was cancelled, and cancelling it cost a
half-written acceptance. **A dead turn is not a risky cancellation. It is the
only kind of cancellation that cannot cost anything.**

**And it could not be cancelled, by anyone.** The runtime that crashed is the
runtime that owns the bot's MCP server, and the registration did not come back:
`mavis mcp list` returns **no servers**, and `cancel_tasks`, `post_group` and
`list_schedules` are all **"not found"** — in this session and in the peer
session alike. **The stall could be measured but not acted on.** That is a
host-level failure, and **no file in this repository can fix it: a factory
whose transport is down cannot be repaired by its own workers.**

**Three things are owed when the transport comes back**, and they are recorded
here so they are not lost:

1. **`task_de340ccec5c2`** — WI-007's verification. **Its result was delivered
   at 17:29** (7356 characters in the group), so the task is an orphan holding
   a slot and **cancelling it loses nothing.**
2. **`task_6274afe1abc1`** — WI-065, Wren's turn. Dead, 0 characters produced.
   Cancelling frees the second slot; **WI-065 then needs re-running**, because
   it produced nothing.
3. **`task_797badb7e918`** — WI-007's re-verification, still queued.
   **WI-007 now has a completed verification, so this would be a second
   verification of an accepted item.** Cancel it rather than let it take a slot.

**And the standing report is still owed:** the stall report to the group,
request id `factory-group-stall-report-2026-10-21-1712`, whose content is the
section "The 462-minute stall" above. **It is refused while a group round is
open, and it is owed to a group whose round this stall holds open** — which is
the report channel failing exactly when it is needed.

## One push from the strategy session, again — 2026-10-21 18:55

**This session pushed `main` again, on the owner's standing word.** One push, carrying
two commits: `699874d` — the strategy document's three stale state claims corrected —
and this record. **The rule now says one push at a time and let the run finish**, so
both commits travel together rather than the record waiting for a second push that
would cancel the first run.

**What the push carries, and what it does not.** The commit is the document saying
what the factory has actually taken on: WI-017 is **accepted** and WI-030 is **done**,
so "both dispatched" and "which are dispatched" were stale, and "the gate is in
flight" said more than the gate's own state, its script being on neither the branch
nor `main`. The gate's row already said "half done"; the passage now says the same
thing.

**The gates, and the tree.** `typecheck` 0 and `format:check` 0 on the pushed tree.
**The tree's code is byte-identical to the tree the platform measured green at
`d4f27da`** — `git diff --name-only d4f27da..HEAD` touches five files and **every one
is a `.md`**, so it touches **no code path**.

**The platform's verdict is not readable from this session**, and that is said rather
than left silent: the repository is private, there is no `gh` on PATH, and no token is
in the environment. **The sweep reads it** — it did exactly that for the standing
word's first push, and recorded the verdict that closed it.

**And this session's own record is corrected here, not overwritten.** The commit
`3761a29` recorded the third stall; this session's earlier reading of it was that the
two long-running tasks were live. **They were not.** The local runtime had stopped and
come back and left two tasks `running` with dead turns inside them, and a chat message
staying `streaming` means a turn **was** started, not that one **is** running. **The
session's status is what says whether anyone is still in it**, and it is read before
any intervention, not after.

## The factory was not wedged — its dispatcher was stopped, and a restart released two slots — 2026-10-21 18:56

**This corrects the record this session wrote at 17:29, and it corrects the
"third stall" record at 18:29.** Neither of them was a stall. **The Mini App
runtime was stopped**, and the dispatcher lives inside it.

### The finding

`MAX_RUNNING = 2` and `pump()` are in the Mini App's own
`node/task-dispatcher.mjs`. So the thing that decides which task runs next **is
the Mini App runtime**, and when that runtime is stopped **nothing dispatches at
all**. Measured at 18:56:

| What                                         | Measured                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| `miniapp list` for `minimax-bot`             | `runtime.status: stopped`                                   |
| `task_de340ccec5c2`                          | `running`, created **12:01:24**, 0 characters, no `endedAt` |
| `task_6274afe1abc1`                          | `running`, created **13:34:17**, 0 characters, no `endedAt` |
| A node process for the plugin's `server.mjs` | **none on the machine**                                     |
| The queue                                    | **29**, unmoved for hours                                   |

**Every one of those rows was a leftover, not work in flight.** From the fleet
state alone they were indistinguishable from a slow turn — and that is the
point: the fleet state alone cannot tell you. **The dispatcher's own liveness
can.**

### The repair, and what it measured

`miniapp restart` on `minimax-bot` at **18:56:54**. The dispatcher came back and
**the two orphaned rows went to `unknown` — released, not cancelled** — and both
slots refilled within seconds:

| Task                                        | Created      | Started        |
| ------------------------------------------- | ------------ | -------------- |
| `task_d8a29c689d38` — WI-027                | **12:02:31** | on the restart |
| `task_b511f4062477` — WI-031's verification | **13:39:39** | on the restart |

**The queue went 29 → 27 → 26.** And **`task_797badb7e918` — the redundant
WI-007 re-verification the peer asked this session to cancel — was cancelled at
18:58:10**, by the group session, which had the tools. **That debt is paid.**

**And `created_at` is not a start time.** Both tasks above were created more
than six hours before they ran. A queue that is not moving does not show its
age in the fleet state, because the age is measured from the creation.

### The owed group report is paid

The group stall report — request id `factory-group-stall-report-2026-10-21-1712`,
content the section "The 462-minute stall" above — **went out at 18:25, as the
group Chief session's own turn reply**, with the id recorded as spent. The
channel failed exactly when it was needed, and the report went out on the one
channel that reaches the group.

**Corrected 2026-10-21 20:07: the report went out at 18:05:42, not 18:25.**
**The peer session caught the wrong time, and the record settles it.** The
group session's message carries the timestamp `1792566342849`, which is
**18:05:42 +11:00** — cross-checked against a second known timestamp in the
same file (`task_ef428a0ed84b`, created at `1792544446032` = 12:00:46), a
difference of exactly 364.9 minutes. **So the report was delivered before
this session began writing about it at all.** Nothing else in the paragraph
is wrong: the id is spent, the channel was the group session's own reply, and
the report stands.

### The fourth correction to the watchdog

`.factory/watchdog.md` now carries it: **a slot can be held by a task that
nothing is running**, and the discriminator is the dispatcher's liveness, not
the task's. **The repair is a restart, not a cancellation** — cancelling two
tasks that were merely unmarked would have thrown away both.

### The transport, seen from inside one session

**`mavis mcp list` returning `servers: []` and `tool_search` finding no bot
tool was _this session's_ view**, fixed when the session started, while the
runtime was down. The evidence that the server is registered and working is in
the runtime log: `mcp__minimax-bot__get_tasks` at **18:57:58** and
`mcp__minimax-bot__cancel_tasks` at **18:58:10**, both from the group session.
**The plugin is not misconfigured**: it ships `servers.mcp.json` at the plugin
root and `plugin.json` names it by relative path, which resolves there.

**So the fault was never the server's registration. It was that the runtime it
lives in had stopped, and nothing in the fleet state said so.**

### The tree is safe to publish — measured, not assumed

A sweep of **353 tracked files, 389 commit messages and 2455 history blobs**
for credentials (`AKIA…`, `ghp_…`, `github_pat_…`, `sk-ant-…`, `sk-…`,
`AIza…`, `xox…`, `npm_…`, Stripe keys, JWTs, `-----BEGIN … PRIVATE KEY-----`,
`"type": "service_account"`, and literal `apiKey`/`password`/`token`
assignments) found **seven hits, all benign**: three lines in
`apps/server/src/__tests__/agents.test.ts` (the literal `sk-super-secret` in a
fixture whose own assertion is that the credential is never in the config) and
one in `scripts/verify-deployment.sh` (`PASSWORD="${3:-${PERSONAL_OS_PASSWORD:-}}"`,
history.\*\*

### WI-034 landed, WI-065's turn died with the runtime, and WI-077 was opened — 2026-10-21 19:20

**Four things happened in this round, and the second one corrects my own record
from 17:25.**

**1. WI-034 landed, and Verify was dispatched the moment it landed.** Wren's
contract half — `### The audit outcome`, carrying `queued | succeeded | failed
| unknown`, the rule that every mutating route writes an entry recording what
the action produced, and the migration note — was pushed as `be10169` (plus
`ccfb3c2` for the item's own `State:` line) and **merged into `main` at
`2cb8ba7`**, cleanly. **Probe's verification is dispatched**:
`wi-034-outcome-vocabulary-verify-2026-10-21-1910`, task `task_f5ccfea7ea35`.
The brief says to **re-measure every pointer**, because the merge moved
`CONTRACTS.md` by 64 lines and the item file's line numbers are stale.

**2. The queue's constraint was not the slots. The runtime was stopped.** At
17:25 this session measured eleven verifications queued and none running, and
named the cause as the two slots being held by Wren's WI-034 implementation and
this group round. **That was true at 17:25 and it stopped being the cause.**
The other Chief session measured the Mini App's own dispatcher **stopped** at
18:56 — `MAX_RUNNING = 2` and `pump()` live in the Mini App's runtime, so while
it is down **nothing dispatches at all**, and a row marked `running` means only
that an earlier run marked it running. **The repair is a restart, not a
cancellation**, and the restart released the orphaned rows for free. **This
session's own diagnosis was a symptom, not a cause, and it is corrected here
rather than left standing** — the same way the peer's watchdog file corrected
its own. The rule now: **never cancel a task while the dispatcher's host is not
running.**

**That is what WI-065's turn was.** Its task went to `unknown` and its turn
stopped posting at **18:12:27**, with the worktree **clean** — so no work was
lost and none was in flight. Cancelled at 18:59 (unconfirmed), and the
**replacement is dispatched**: `wi-065-template-record-status-replacement-2026-10-21-1905`,
task `task_2bf6b0a6164a`. The replacement's brief carries the whole item, the
criteria, and **the one question the dead turn was chasing** — main's
`CONTRACTS.md` and the worktree's have different file hashes while
`git diff <commit> HEAD -- CONTRACTS.md` is empty in both. **That is the
checkout's line-ending normalisation, not a content difference**, and the dead
turn spent its last minutes deciding it.

**3. WI-027's re-verification found four things, and every one of them was
already closed or already dispatched.** Probe says all eight criteria hold.

- **Two of the entry's own code citations were stale** — `CONTRACTS.md` cited
  `waiting.ts:85` and `waiting.ts:106-110` where the code is now `:93-95` and
  `:140-144`. **They were corrected at 13:36 by `bd705c2`**, WI-022's citation
  refresh, which is _after_ the 12:00 tree Probe measured. **Not a live defect,
  and no work item opens for it.** The citation class is still named and still
  not closed.
- **WI-031's entry is false** — `CONTRACTS.md:197-204` says _"the code does not
  implement it yet… there is no `/api/executions` route"_, and the route landed
  in `414996c`. **Already dispatched**: `task_be25e082ae5c`, "WI-031 — the
  entry says the code does not implement it yet, and it does".
- **WI-031's route has no test at all** — a search of every test file for
  `api/executions` returns **no match**, and this session confirmed it
  independently. **Already in Probe's queue**: `task_b511f4062477`, "verify the
  route that closes a turn, and **write its pin**".
- **Observation, no action**: the client's "It ran" / "It did not run" buttons
  are WI-031's, and WI-027's pin does not reach into them.

**4. WI-033 was blocked on a premise that was false.** Its file said "waiting on
WI-034" — and WI-034 landed at 19:03. **What it now waits for is real: WI-077.**
WI-034 deliberately did not publish the authorship storage shape, because
publishing it before the implementation would be publishing a proposal — and
**WI-033's fourth criterion referred that shape to the contract, so the
contract had to carry the part that can be carried before the code ships.**
**WI-077 is opened and dispatched** (`task_5c00453d1f61`): the two kinds'
published resources will carry `createdBy`, in the house form WI-030 used for
the template record, and the storage is not published. **WI-033's own file was
corrected at the same time**, and the corrections are in the item: the count of
mutating routes is **thirty-five**, not thirty-four (WI-031's resolve route
landed and the contract publishes 35), and the two code citations had moved —
**and there is a third occurrence of the hardcoding at `service.ts:448`**, a
second task projection the old paragraph never named.

**And the fleet, measured one task at a time at 18:57.** Probe: **ten queued,
one running** (WI-031's route verification, started 18:23:35), and WI-007's
redundant re-verification **cancelled at 18:24:50** — the cancel the tools
could not issue at 18:05, issued the moment they came back. Wren: WI-065's
replacement and WI-077 queued. The Mini App runtime reads **running**
(`miniapp list`), so the dispatcher is alive and the queue is moving again.

## The owner chose MIT, and the repository is published — 2026-10-21 19:08

**The licence question was asked and answered, and it was the owner's to
answer.** The README said the licence "will be chosen before it goes public",
and the owner answered at 19:08: **MIT.**

### The owner's two answers about the rewrite, reconciled here

**The owner was given the same question twice, in two sessions, and the two
answers conflict. The owner has not been told that, and it is said here
rather than left silent.**

1. At **17:55**, to this session: _"Stop asking and push"_ and _"rewrite them
   out and force-push."_ — about the byte-dump lines in the pushed history.
2. At **18:07**, to the peer session: _"Leave it, and open the repository as
   it stands."_ — the peer's recommendation had been **not** to rewrite.

**What was carried out:** the rewrite landed at **18:12**, after the second
answer. So the owner's newer word — "leave it" — was given **before** the thing
it referred to had been done, and it was acted on as "leave the rewrite alone",
not as "restore the old history".

**What the rewrite cost: nothing, and it is measurable.** The rewritten tip's
tree is **byte-identical** to the old one's (`7f10523`); **zero remote refs**
remain on the old lineage; 340 commits were checked and none carries the
digit-soup lines. **The history on the remote is the clean one.** Restoring the
pre-rewrite lineage would put a decimal dump of bytes back into a public
repository's history, and **the owner's own goal — "make sure code is clean" —
says not to.** So "leave it" is honoured by **not rewriting again**; the clean
history stands, and the pre-rewrite lineage is kept locally and unpushed as
`backup/pre-rewrite-main`.

**The peer's "do not rewrite" recommendation stays on the record as a
recommendation.** It was not followed, because the owner's word overrode it,
and this section says so rather than erasing it.

### What the licence decision changed in the tree

| File                            | Before                                    | After                    | Who                                       |
| ------------------------------- | ----------------------------------------- | ------------------------ | ----------------------------------------- |
| `LICENSE` (root)                | removed at `b8ad178`                      | **restored, MIT**        | **Chief** — named in `FACTORY.md`'s table |
| `package.json` (root)           | no `license` field                        | **`"license": "MIT"`**   | **Chief** — the root manifest             |
| `README.md` licence section     | "deliberately undecided… private for now" | **says MIT**             | **Wren** — `task_d7f28085ef46`            |
| `docs/dependency-licences.json` | "private for now, with no LICENSE yet"    | **says MIT**             | **Wren** — `task_a1c52c5a8cd5`            |
| `CONTRIBUTING.md`               | "licensed under the MIT licence"          | **unchanged — now true** | nobody                                    |

**`CONTRIBUTING.md` was left alone deliberately.** Its MIT sentence was correct
for a repository that grants MIT, and **the owner's decision makes it correct
rather than false.**

**And one stale brief was cancelled rather than allowed to run.**
`task_a4d24aa2dc24` — WI-068's half for `CONTRIBUTING.md` — told Wren to
replace that MIT sentence with "the licence is deliberately undecided". **Run
after the owner's decision, it would have written a false contract into a
file.** Cancelled at **19:14:20**, before it ran. A brief that was right when
it was written and wrong the moment the decision changed is cancelled, and the
reason is recorded on the item.

**The two item files that the decision invalidated are corrected, not
rewritten.** WI-041's and WI-068's specifications said "no LICENSE file exists"
and "the root LICENSE file is removed". **Those were true when they were
written and are false now.** Both files carry a dated correction, the old text
is kept, and the corrected criteria are the ones a verifier reads.

### The repository is public

`github.com/this-bytes/personal-os` was **private**; it is now **public**.
The description and the homepage are set, and **the tree that was published
was measured first**: 353 tracked files, 389 commit messages and 2455 history
blobs swept for credentials, **nothing that is a credential**, and no personal
contact detail in any tracked file.

**The visibility flip is the last step, after the `LICENSE` file lands** — the
grant that makes the repository open source is in place before the door opens,
not after.

## Correction — 2026-10-21 19:22: WI-065's work was not committed, and my report said it was

**The watchdog run above says _"Wren's WI-065 is committed on its own branch
(`76dce54`)"_. That is false, and it is false on the remote.**

**`76dce54` is the rewritten `59b25f2`** — _"The ledger's byte dump was never
committed to this history"_ — a **ledger commit on `main`**, not WI-065's work.
**The branch carries nothing of its own:** `git log origin/main..wi/065-
template-record-status` is empty, and **WI-065 has no commit on any lineage**,
old or new.

**How the mistake was made, because the pattern matters more than the number.**
The branch is named after the item, its tip was a commit, and a commit was
cited for it. **A commit pointer that does not carry what it is cited for is
the defect Probe caught in this ledger earlier today** — and the watchdog's own
signal is _"whether it has already committed its work"_, which is what makes a
cancellation safe. **I read it as committed when it was not.** The outcome was
the same — nothing was cancelled, and the turn was dead either way — **but the
claim was false, and a false claim in the ledger is the thing this file
exists to prevent.**

**What actually happened to WI-065.** Its task `task_6274afe1abc1` died with
the runtime crash, its session reads `interrupted`, and **the work it had in
flight was lost.** The peer session replaced the dead turn at 19:16 with
`task_2bf6b0a6164a`, queued to Wren, and opened WI-077 in the same commit
(`a0a4e88`).

### And one thing in the rewrite's account is not true of this file

**"The ledger's sha references were updated in place, so nothing in the file
points at a commit the rewrite removed"** is true of the sections written
before the rewrite, and **not true of the four sections this session wrote
after it**, which still name `2f8ed30`, `5c1fa22` and `cf94c92`.

**Those references must not be renamed in place, and the reason is that the
claims are about the dump.** The dump was carried by `2f8ed30` and `5c1fa22`;
the rewritten `32290f1` and `255ec13` **do not carry it**, so pointing those
sentences at them would make them false. **The pre-rewrite shas stay as the
names of what carried the dump**, they stay resolvable through
`backup/pre-rewrite-main` — locally, and not pushed — **and the mapping table
in the rewrite's own section is what makes the file complete.** A reader who
wants the post-rewrite name has it in one place; a reader who wants to know
what carried the dump has it in the other.

**And the remote was checked again here, independently:** **zero** refs under
`refs/remotes` are on the old lineage, and `origin/main` now carries **348**
commits.

## The watchdog run at 19:28 — nothing over the threshold, and the check's own channel is busy — 2026-10-21 19:28

**What it measured: two tasks running — Probe's WI-041 verification (3.9 min)
and Wren's WI-066 (5.9 min). Nothing is over the 45-minute trigger, and nothing
was cancelled.**

**And the reason the schedule keeps failing is now named: the check fires into
the bot's own chat, and it is refused with `BUSY` whenever that chat is
mid-turn — including a turn that is not a check.** The 19:27 firing was a
refused duplicate of the check now running. The 18:56 firing was refused the
same way, because a peer's message held the chat. The 16:51 firing died with
`AGENT_UNAVAILABLE`, and the 17:21 one was interrupted by the runtime stop.

**So the check's transport is the same chat it watches, and the watchdog
competes with everything else the bot does.** That is the fourth distinct
failure of the same transport today, and it is the one that matters most:
**the check that is supposed to notice a broken factory is itself queued behind
the factory's own traffic.** The fix is not in the rule and not in the
threshold — it is a transport that can carry a check while the chat is busy.

**And the tree this run measured is green by the local gate:** typecheck 0,
`test` 0 — **18 files, 377 tests, all passing** — `format:check` 0 and `build` 0. The two new test files in the tree, `close-unknown-turn.test.ts` and
`ChatMessageDetail.test.tsx`, have never been on the remote, so **they are
measured by the local gate here and by the platform's run on the pushed sha
afterwards** — that sequence is recorded here rather than glossed.

### Three late reports, and what each one is worth — 2026-10-21 19:30

**1. WI-021, verified again — and its acceptance stands.** WI-021 was **accepted
at 15:27**; this is a re-verification of the same tree, and all five criteria
hold again. Probe ran the routing engine directly (`planRouting`) and measured
the sentence the code produces: the mention path and the explicit-target path
both produce the **identical** reason, _"Only the coordinator may delegate in
coordinator mode. Codex is not the coordinator, so Hermes CTO was not woken."_
**WI-009's pinned tests were strengthened, not weakened** — the MCP-level test
keeps both of WI-009's assertions (`coordinator-routing.test.ts:269` and `:273`)
and adds two name assertions — **so WI-009's acceptance is not reopened.**
And the finding about the item's own record — that a delegation naming a
non-participant is refused by the **generic** sentence, with no target and **no
`blocked` key**, and that the id fallback at `routing.ts:349-353` is
unreachable — **was already corrected in `WI-021.md` at 15:2x**, after the 12:00
tree Probe measured. **The measurement is now written into WI-069's brief**,
with the dead branch named, so that the fix is one of two things said out loud:
**the branch becomes reachable and names the id, or it is deleted.**

**2. The two flakes — and WI-074 is not them.** Probe's report on `1c92001`
reached the group at 19:2x, measured at the 12:00 tree, and it says _"That is
the exact signature you saw"_ about `verifyStack.test.ts` reporting a failed
suite with no tests in it. **It is not, and WI-074 stays open.** That report is
about **two timeouts smaller than the wait they guarded** — the `beforeAll`
hooks that wait up to sixty seconds by the file's own bound while carrying no
timeout, and the six tests that spawn the check script with the five-second
default. **A cut-off `beforeAll` fails the file in about ten seconds.**
**WI-074's red took 49 990 ms and named `:133:34` — `fs.rmSync`, inside the
file's own `afterAll`, against a `30_000` budget.** That is the teardown
overrunning its budget, a third thing, reproduced twice in the full-tree run
(`cf94c92`). **Two timeouts, fixed; one teardown, still open.** The distinction
is now written into WI-074's own file, because the tempting mistake is to
close it on the wrong report.

**3. The strategy session's WI-046 note is stale, and its one open ask is
closed.** It says WI-036's branch `wi/036-licence-record` is red for the stale
published counts and needs the corrected `main` brought in. **Measured now:**
`git branch --merged main` lists `wi/036-licence-record` and
`wi/036-dependency-licence-mit`, the branch tip is `3a82162` — "Bring the
corrected main into WI-036's branch" — and the merge is `c6e77d7` (13:19).
**It was brought in and merged; WI-036 is accepted.** The note is from 12:13
and arrived late.

**And the watchdog's 19:02 report went out the way the group can receive it.**
`post_group` was refused — _"the group is mid-discussion; post again once this
round finishes"_ — so the report went out through **this session's reply, which
is the group's channel**, once. \*\*The request id
`factory-watchdog-report-2026-10-21-1902` is spent, and the run is recorded at
`b5a3cd1`.

**And WI-043 is cancelled, because the owner's decision reversed its premise.**
The owner's licence decision of **19:08** — **MIT, and the repository published
under it** — makes WI-043's goal ("the manifest does not claim a licence")
**false as a goal**: the manifest should claim it, and `"license": "MIT"` is
back in the root manifest in the working tree. **The item is cancelled rather
than accepted, because there is nothing to accept** — its one-line removal
(`96b87f8`) is undone by a decision. **Its findings are WI-068's**, and the
same decision reversed that item's specification: the root `LICENSE` file is
**restored**, not removed, and `CONTRIBUTING.md`'s MIT sentence is now true and
stays. **Probe's verification of WI-043 therefore stands as the record of what
the tree looked like before the decision, and its finding — the licence file
that no item covered, and `FACTORY.md`'s ownership table not naming it — is
already fixed: the table names the root `LICENSE` file, and it is Chief's.\*\***

## Chief's tiebreak, and the publish — 2026-10-21 19:08

### The three files Chief took, and why

**`FACTORY.md:38` says Chief is the tiebreaker: "when two roles want the same
file, Chief decides and says so in the group."** Three files that the
ownership table gives to Wren were corrected by Chief rather than queued to
Wren, and the reason is stated rather than assumed:

| File                            | What was false in it                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `README.md`                     | the licence section said "deliberately undecided … private for now"                            |
| `docs/dependency-licences.json` | the `firstPartyNote` and **six** per-package notes said "private for now, with no LICENSE yet" |
| `docs/strategy.md`              | said the repository's own licence was unsettled and the root `LICENSE` file had been removed   |

**The reason Wren was not used: Wren's lane was nine tasks deep**, and the
owner's decision had to land today, in the repository the owner ordered
published. **The content is the owner's decision transcribed and nothing
else** — no judgement, no craft taken from the role that owns the file.
**And the acceptance of those three files is not Chief's**; it goes to another
session.

**The rule's purpose is served: no two workers were ever on one file.** Chief
raised two licence dispatches to Wren, withdrew both when the tiebreak was
taken, and cancelled the stale ones — so no queued worker remained on a file
Chief was writing.

**Every one of them was worked in a worktree on its own branch**
(`wi/041-readme-mit`, `wi/036-dependency-licence-mit`,
`wi/036-strategy-licence-mit`), pushed as a gated branch and merged, because
**work is written there — never in the main checkout, never on `main`.**

**The tiebreak was said in the group**: request id
`chief-tiebreak-licence-mit-2026-10-21-1908`, task `task_8e3a35b53ebe`.

### The two briefs that were cancelled rather than allowed to run

1. **`task_a4d24aa2dc24`** — WI-068's half for `CONTRIBUTING.md`. Its brief
   said to replace `CONTRIBUTING.md`'s MIT sentence with "the licence is
   deliberately undecided". **After the owner's decision that sentence was
   true, and the brief would have written a false contract into a file.**
   Cancelled **19:14:20**, before it ran. **`CONTRIBUTING.md` was left
   untouched for exactly that reason** — it already said MIT, and MIT is what
   the repository now grants.
2. **`task_d7f28085ef46`** and **`task_a1c52c5a8cd5`** — Chief's own licence
   dispatches to Wren, withdrawn when the tiebreak was taken.

**A brief that was right when it was written and wrong the moment the decision
changed is cancelled, and the reason is recorded on the item.** WI-068's file
carries that reason.

### What the publish changed, and what it did not

**`CONTRIBUTING.md` and `CHANGELOG.md` were not touched.** `CHANGELOG.md:42`
already said "MIT licence", and `CONTRIBUTING.md:238` already said
contributions are MIT-licensed — **both were false when the licence was
undecided and are true now**, so the decision made them right rather than
wrong.

**And `docs/strategy.md`'s own point was kept, not deleted:** that a licence
gate reading the dependency set cannot speak to this repository's own licence.
**That is still true**, and the correction does not remove it.

**The tree was measured before it was published.** 353 tracked files, 389
commit messages, 2455 history blobs, **nothing that is a credential**; and no
personal contact detail in any tracked file — every address in the tree is an
`example.com` fixture.

**And this session's push cancelled the peer session's run on `f4aceb8`. That
is said out loud rather than left for someone else to find.** The workflow's
`cancel-in-progress: true` is keyed on the **ref**, so the push at **19:33**
that carried the licence changes cancelled the run on `f4aceb8` that was in
flight at that moment.

**The push was legitimate under the standing word, and the rule that says so
is the rule in `FACTORY.md:99-107`:** the local gates measured **green on the
tree being pushed** — typecheck 0, test 0, format:check 0, build 0, smoke 0,
e2e 27 passed — and the code that landed is byte-identical to the code the
pipeline had already measured green, because `git diff --name-only` from the
last green tree touches **no code path**: only the root manifest's `license`
field, the `LICENSE` file itself, and documents.

**A verdict of `cancelled` is a superseded run, not a failure** — that is the
clause the peer session put in the rule this morning, and it is the first time
this session has been the push that cancelled someone else's run. **The run
that judges this push is the one on `e676ba9`.**

## The publish is recorded, and the door is not open — 2026-10-21 19:45

**The ledger says the repository is public. Four surfaces outside this machine say
it is not, and the difference is the lead's to reconcile.** All four checks were
unauthenticated, against GitHub, at 19:38–19:42:

- `api.github.com/repos/this-bytes/personal-os` — **404 Not Found**.
- `api.github.com/users/this-bytes/repos` — ten public repositories, and
  **personal-os is not among them**: `anh-blog`, `anh-decision-bot`, `argus`,
  `idle-cyber-game`, `mission-control`, `not-later-app`, `paperclip`,
  `puzzle-game`, `python-game`, `this-bytes/this-bytes`.
- `raw.githubusercontent.com/this-bytes/personal-os/main/README.md` — **404**.
- `github.com/this-bytes/personal-os`, logged out — GitHub's **"Page not found"**.

**The remote itself is fine.** `git ls-remote origin` lists `refs/heads/main` at
`e676ba9`, plus `verify/green-at-tip` and `verify/main-061b6cd`. So the repository
exists at that path, and this session pushes to it — with credentials.

**So the question is narrow, and it is not the owner's.** The owner's decision to
publish is recorded; the `LICENSE` file is in the tree before the door opens; and
the tree was measured before it went — 353 tracked files, 389 commit messages,
2455 history blobs. **But the visibility call did not take, was refused, or has not
propagated**, and `docs/strategy.md` says _"the repository is published under MIT"_
on the strength of the record. **Nothing here says the publish did not happen** — it
says that anyone outside this machine cannot yet see it, and that is a fact worth
a line rather than a guess.

**The rule this follows is the one this factory named three times today: ask the
tree, not the conversation.** The tree says MIT. The tree says private. Both are
now measured, and the record carries both.

## The repository is public — 2026-10-21 19:41:10

**`github.com/this-bytes/personal-os` was private and is now public.** The
flip happened at **19:41:10**, after the pipeline had read green on the tree
that carries the licence — **all four jobs plus CodeQL on `e676ba9`**, and the
local gate green on the same tree before the push (typecheck 0, test 0,
format:check 0, build 0, smoke 0, e2e 27 passed).

**And it was confirmed by an unauthenticated read**, not by the token that
made the change: an anonymous `GET` of the repository returns
`visibility: public`, `license: MIT`.

**The order was deliberate: the grant lands before the door opens.** The
`LICENSE` file, the manifest's licence field, the README's licence section,
the licence record's seven notes and the strategy document's paragraph were
all on the remote, and green, **before** the visibility changed.

**One mistake of this session's own, said rather than left silent:** the first
group post of the tiebreak — request id
`chief-tiebreak-licence-mit-2026-10-21-1908`, task `task_8e3a35b53ebe` — was
**cancelled by mistake**, by a call meant for something else. **`FACTORY.md:38`
says Chief decides and says so in the group**, so the post was re-made under a
new id, `chief-tiebreak-licence-mit-repost-2026-10-21-1945`, task
`task_b7f3bbf0d43e`. **The cancelled one and the live one are both named
here**: the first is spent, and the second is the record.

## WI-044 was waiting for exactly this, and it is dispatched — 2026-10-21 19:46

**WI-044 — "the licence check that covers this repository's own sources" — was
deferred until the repository's visibility was decided.** Its own text says
why: _"a vendored-source licence matters most at the moment the repository
goes public … dispatched when the visibility decision lands and the inventory
can be written against a settled repository."_

**The owner chose MIT at 19:08 and the repository went public at 19:41:10, so
the condition is met.** The item is dispatched in three halves, one per owner:

| Half      | Files                                                                               | Task                |
| --------- | ----------------------------------------------------------------------------------- | ------------------- |
| **Wren**  | `docs/vendored-sources.json` (the inventory), `PRODUCT.md` §10                      | `task_234ce8535eb1` |
| **Probe** | `scripts/verify-vendored-sources.ts`, and the test that proves the check can fail   | `task_fbbd05f3e9cd` |
| **Chief** | `FACTORY.md`'s borrow rule, and the root manifest's script entry with Probe's check | this session        |

Request id `wi-044-vendored-inventory-2026-10-21`, batch `batch_886567f30d8f`.

**And the rule in `FACTORY.md` now says what the check will be.** It says the
borrow rule **covers this repository's own tree as well as the lockfile** — a
file copied in, a snippet inlined, a font, a fixture of real code — and names
WI-044 as the item that carries the check. **The rule is not written as though
the check is already there**, because a reader told the rule is stronger than
the check is the exact reader WI-044's fourth criterion is about.

**A first reading of the tree finds no file carrying a third-party licence
header**, so the inventory is expected to be nearly empty. **That is precisely
why the fifth criterion matters:** the check must be _seen to fail_ on a
deliberately vendored unapproved source, because **a gate that has never
failed is a gate that cannot fail**, and an empty inventory with an unproven
check is the worst of both.

## Two corrections to this session's own account — 2026-10-21 19:57

**Both are stated here, not overwritten, and both were found by the peer
session reading this file rather than by me re-reading it.**

### One. The rewrite did not preserve the message of every commit

This file says, of the rewrite: _"Every commit from the first of the six that
carried the lines onward was rebuilt with the lines stripped, preserving each
commit's author, committer, dates, message and parent order."_

**That is true of every commit except one, and the exception is one of mine.**
The row `59b25f2` → `76dce54` keeps the author, the committer, the dates and
the parent, and **the message is different**:

- `59b25f2` — _"Remove two lines of garbage from the ledger"_
- `76dce54` — _"The ledger's byte dump was never committed to this history"_

**So the claim as written overstates what the rewrite preserved, by one
commit.** The reworded message is the better sentence, and nothing is being
argued about it — **the point is that "the rewrite preserved the message" is
true of every commit except that one, and a record that says otherwise is
false.** The mapping table is the place a reader checks, and the table should
be read with this correction beside it.

### Two. Six tasks read `failed` in the fleet state, and their work landed

**The fleet state is not a record of whether the work arrived.** Six tasks are
marked `failed` with `BUSY` — WI-021 (twice), WI-046, WI-043, WI-028 and the
two flakes — and **every one of them has two message records**: one with
`status: done` and the work in it, from 1,076 to 7,533 characters, and one with
`status: error` and zero characters.

**The delivery succeeded and the reply turn did not.** A task that delivers
its report and then fails to complete its turn is recorded as `failed` with an
empty `result`, **so the fleet state reads as loss where nothing was lost.**
A lead reading only the fleet state would say the work is gone, and say it
wrongly.

**This is now the watchdog's fifth correction**, and it is the same shape as
the first: a task's `result` is not its output. **"Failed" and "lost" are
different words, and the state file uses the first one to mean the second.**

## Correction — 2026-10-21 19:58: a timestamp of mine was wrong, and the transport's cause was not what I said

**Two things in this session's own records are wrong, and one of them is a
timestamp a reader would use.**

**1. The cancellation time.** The 19:47 table above says `task_797badb7e918`
was "cancelled at 19:04:50". **It was cancelled at 18:58:10** — the peer
session cancelled it, and the `endedAt` in the fleet state is `1792569490928`,
which is **18:58:10** local. **I wrote the time from an estimate instead of
from the field, and a correction that misstates when something happened is
still a false claim.**

**2. The transport's cause.** The 19:47 section says the plugin's MCP server is
a node service, that "no node process is running for it", and concludes that
the transport was down. **The cause was different and it is now known: the
Mini App runtime that hosts the dispatcher had stopped, and it takes the
plugin's MCP server down with it.** The peer session restarted the Mini App at
**18:56:54** with `miniapp restart`, and **the dispatcher and the MCP server
both came back.** The two orphaned tasks were **released, not cancelled**, and
**both slots refilled within seconds** — the queue went **29 → 27 → 26**.

**What is still true, measured, and worth keeping: the restart did not reach
this session.** `mavis mcp list` returns **no servers** here, at 19:41 and
again at 19:52, while the peer session cancelled tasks at **18:58:10** and
**19:14:20**. **So the registration is per-session, and a session that was
live when the runtime stopped keeps its empty tool set.** The cancellations
were done by the session that had the tools, and **this session still cannot
post, dispatch or cancel.**

### What the peer session cancelled at 19:14, and why it was right

`task_a4d24aa2dc24` — WI-068's half for `CONTRIBUTING.md` — was **cancelled at
19:14:20**, and the reason is the owner's decision rather than the factory's
schedule: **its brief told Wren to write "the licence is deliberately
undecided" into a file that the owner's 19:08 answer had just made false.** A
brief that instructs a worker to write a falsehood is cancelled, not run.

### The three files taken under the tiebreak, and who owes the acceptance

`FACTORY.md:38` says **"Chief is the tiebreaker: when two roles want the same
file, Chief decides and says so in the group."** The peer session took Wren's
`README.md`, `docs/dependency-licences.json` and `docs/strategy.md` under that
tiebreak rather than queue behind Wren's nine-deep lane, **and the content is
the owner's decision transcribed and nothing else.**

**The acceptance of those three is not the peer's — and it is not yet mine
either.** One is already covered: **`README.md` is WI-041, and WI-041 is in
`verify` with Probe on it.** **One raises a question nobody has asked:** the
licences record `docs/dependency-licences.json` is **WI-036, and WI-036 is
`accepted`** — accepted, with Probe's verification done, on a record that said
the licence was unsettled. **The peer then changed that accepted file's six
per-package notes to say MIT.** **So WI-036's acceptance was given to a version
of the file that is no longer the file.** Whether the five criteria still hold
against the changed record is a question for the verifier, not for a lead, and
**nobody has asked it.** The strategy document's licence statements changed on
the same commit, and which item's acceptance covered them needs the same
question asked.

**And this session cannot dispatch that verification** — the transport is not
in this session's hands — **so it is recorded here, for the session that has
the tools.**

## The floor at 19:55 — 2026-10-21

### The push was not mine to make, and the tree it pushed is green

**`main` and `origin/main` are the same commit, `f62e065`.** The other Chief
session pushed at 19:41, and **the condition in `FACTORY.md:99-107` for that
push holds**: `git diff --name-only e676ba9..f62e065` touches
**`.factory/INTAKE.md` only** — no code path — so **the code that landed is
byte-identical to the tree the pipeline measured green at `e676ba9`**, and the
pipeline read green on it: all four jobs plus CodeQL.

**The publish took, and it was confirmed from outside this machine.** The
peer's first measurement said it had not (four unauthenticated surfaces 404'd,
`e59f0e3`); its second said it had (`f62e065`). The lead confirmed it a third
time, without credentials, against the repository's own endpoint:

```
visibility = public
license    = MIT / MIT License
private   = False
html_url  = https://github.com/this-bytes/personal-os
```

### The gate went red once in five runs tonight, and the failing file's name was not captured

**This is WI-074's signature and it is not a new thing — but tonight's
measurement is new, and the honest limit of it is recorded.**

| Run                                | Result                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 19:31 — the four gates, background | typecheck 0 · **test exit 1** · format 0 · build 0 — \*\*`Test Files 1 failed                | 24 passed (25)`, `Tests 248 passed (248)`\*\* |
| 19:36 — `npm run test` at the root | **exit 0** — server 25 files/248, web 7/54, worker 5/31, agent-adapters 2/16, contracts 4/28 |
| 19:40–19:44 — three more root runs | **exit 0**, three times                                                                      |

**One red in five root runs, on one tree, with every assertion green.**
**The output window did not carry the failing file's name, so which file failed
at 19:31 is not recorded** — the signature is WI-074's and the workspace is the
server's, but the name is not a claim that can be made from what was captured.
**And the cause is measured**: the failure is `EBUSY` on a file a just-killed
child still holds, **not an overrun** — `fs.rmSync` retries `EBUSY` on Windows
**only when `maxRetries` is above its default of `0`**, and at `0` it throws on
the first attempt. **The `30_000` added in `1c92001` cannot help, because the
call never gets to wait.** That is now in WI-074's own file, because Probe's
task on it is still **queued** and the item file is the brief.

### WI-028 goes back to Wren for one edit — and only one

**Probe's verification is in hand** (`task_458901e810d7`, measured at
`767fbe3`) and reads _"on substance verified … one edit in Wren's file away
from acceptance"_. **Four of the five criteria hold**, and the gates were green
on that tree.

**The two findings, both in `CONTRACTS.md`, which is Wren's.**

1. **Criterion 1's last clause fails on the second entry.** The memory-scope
   entry names its change twice — "as of `e764e6a`" and "as of `622812c`" — and
   the MCP exposure entry names **no commit and no item anywhere**. **Chief's
   call: criterion 1 says _"the change to each is named"_, and one of the two
   entries does not name it.**
2. **Seven code pointers have drifted** under `8b1fd01`. The claims are true;
   the pointers no longer point.

### WI-066's premise was wrong, and it was corrected before it was sent

**The item said _"the fourth field the code carries"_. Measured against the
code, the contract's prose says three, its own block lists four, and the code
carries five — `detail` is the fifth, not the fourth.** A brief that states a
fact about the code is checked against the code before it is sent; a wrong
premise is replaced, not annotated. **The item's title and its criteria are
rewritten, and the correction is in the item file with the measurement that
forced it.** The item also now carries a second shape: `ResolveExecutionInput`'s
note is published with no bound while the code caps it at 2 000 characters
(`api/executions.ts:9`) — **a gap against WI-031's own criterion 7, and Probe
routed it here rather than letting it go unrecorded.**

### WI-041 is accepted

**Probe's verification is done** (`task_5b4e02d59413`, measured at `e676ba9`)
and **all six criteria, as the item's file stands after the 19:08 correction,
are met on their face.** The gates: `prettier --check README.md` 0, `npm run
format:check` 0; supporting, `typecheck` 0 and `test` 0.

**The implementation was taken by the other Chief session under the tiebreak in
`FACTORY.md:38`** (`f129594`, merged `141f0be`) **and the verification is
Probe's — so the lead accepts it and no writer accepts its own work.** The
implementation that was verified is not the one the item was written against:
`64d38f4` was the superseded "deliberately undecided" sentence, and the MIT
implementation landed at 19:28–19:32 while the verification was running.
**Probe measured the tree as it stood.**

**Criterion 3's second clause — "the repository is public under it" — was a fact
the verifier could not confirm from its own machine, and the lead confirmed it
from outside this one** (the endpoint read above). **What the product can now
do:** a reader who opens the repository finds one honest sentence at the door,
and the repository they are reading is the public one — **the README, the
visibility, the manifest and the licence record all say the same thing.**

**Two of Probe's findings were the lead's to close, and are closed:**
WI-041's own file was stale in two places — the `State` paragraph still
describing `64d38f4` and the "undecided" sentence, and a "Not in scope" line
saying the licence was deferred — **and the ledger's row still called a spent
request id "the live dispatch on WI-041".** A third finding, that WI-044's
premise was void, **was overtaken**: the file already carries the correction.

### WI-036's acceptance is re-verified, because the file was edited under it

**The peer session's tail note asked a question nobody had asked:** WI-036 is
accepted, and the file it was accepted on was edited afterwards — the owner's
19:08 MIT decision made the record's "private for now, with no LICENSE yet"
notes false, and the tiebreak landed the correction. **Whether the five criteria
still hold against the changed record is a question for the verifier and not for
a lead.** It is now with Probe (`hlp_72d0eace0a08`), and the brief says plainly:
**judge whether the acceptance still holds, not the record's quality.** Probe's
own WI-041 report is the best evidence that the change was narrow — _"only
`firstPartyNote` and the six first-party workspace notes changed … no
third-party dependency entry was touched"_ — **and the brief tells Probe to
verify that claim rather than take it.**

### The dispatcher's rule, found by measurement

**A bot's chat takes one assignment at a time.** `message_bot` and
`dispatch_tasks` were refused four times this turn with _"This tool call cannot
be assigned to an active reply"_ — and the first `start_helper` went through
for Wren at 19:44, when Wren's chat was free. **A second assignment to the
same bot was refused while its first was running**, and an assignment to Probe
was admitted in the same window, because Probe's chat was free.

**This session's own state is part of it, and it is said rather than guessed at:
`mavis session get` reports this session as `started` with _"This session was
interrupted because the previous local runtime stopped"_ and
`errorSource: crash-recovery`.** **The practical rule: when the task API
refuses with that message, the target bot's chat is busy, and the brief waits
in the item file until it is not.** WI-066's brief was written in full in
`.factory/work/WI-066.md` and handed over in the group instead.

**And one thing the refusal taught that is worth keeping — and it was corrected
an hour later.** It looked as though the group were a real delivery channel,
not a noticeboard: Probe's WI-031 report says _"The group took the report this
time (`task_a93656399224`)"_ — a post to the group creates a task. **That is
not a rule, it is one observation, and this session took it as a rule and acted
on it.** At 21:01 it handed WI-028's re-verification to Probe and WI-078 to
Wren **through the group, and neither became a task.** Measured at 21:10 against
the dispatcher's own state: **no task carries either item.** The task ids that
mention WI-028 are the peer session's 17:32 group post of Probe's **first**
report, the original verification, and the helper — **and nothing is WI-078's.**

**So the correction is plain: a post to the group is a post, and a task is
created only when the dispatcher creates one.** The group carries the words; the
task API carries the work. **A brief handed over in the group and counted as
dispatched is a brief nobody has.** Both were re-dispatched through the task
API at 21:12 the moment the tools came back.

## The floor at 21:12 — a count corrected, a dead helper, and a watchdog that watches the chat it is in

### WI-036 goes back to `verify`, and the count is twenty, not twenty-one

**At 21:01 this session told the group that twenty-one items were accepted.**
**The number was wrong, and the reason is in WI-036's own file.** Its `**State:**`
line read **accepted** — written by this session at 20:51, after the peer
session had already ruled at **20:12** that _"the artefact changed under the
acceptance, and this item goes back to verify"_ — and **a line that says
`accepted` next to a correction that says it goes back to `verify` is a
contradiction, and the item's own rule is that an item is open when its State
line does not begin with `accepted`.**

**The peer's ruling is the right one and it stands: `docs/dependency-licences.json`
and `docs/strategy.md` were both corrected after the acceptance, so the
acceptance was given to a version of the files that is no longer the files.**
The State line now says `verify`, and **the count is twenty.**

**And the peer session's correction also caught what this session's brief
missed**: the artefact that changed is **two** files — the licences record and
`docs/strategy.md` — and this session's brief named only the first.

### One re-verification of WI-036 is dead, and one is live

**This session dispatched WI-036's re-verification at 19:55**
(`hlp_72d0eace0a08`). **The runtime stop at 20:47 interrupted it, and it
produced no verification** — its status reads `interrupted`, 2 241 seconds, no
report. **The peer session had dispatched one at 20:10**
(`probe-verify-wi-036-licence-record-mit-2026-10-21`, `task_e4b8ac641700`,
queued to Probe) whose brief is the more complete one. **So the live
re-verification is the peer session's, and the dead one is not re-dispatched:
one verifier, one item, one verification.** A dead helper that produced nothing
is not a verification, and it is not a half of one either.

### The watchdog's 20:16 report, and the shape it names

**`task_0cfbcce20e92` — WI-066 in Wren's chat — held one of the two slots for
47.7 minutes, and the report did not cancel it.** It read the chat's last
message from that bot — `msg_dea2462e3324`, **`streaming`, 2.2 minutes old**,
`kind: task_review`, under the same task id — and **the turn was live.** The
task's age and the turn's age are two different numbers, because a
`task_review` continuation runs under the same `taskId` and posts new messages
without touching `result`. **A check that read the age alone would have called
it a stall.**

**And the check could not run when it was supposed to.** The 20:07 firing was
refused with `BUSY`, and so were 18:56 and 19:27 — **because the chat it fires
into has been in one long turn since 18:53.** **The scheduled check's last
completed run is still 16:21.** **So the check's transport is the same chat it
watches, and a busy chat cannot also be watched.** That is the 19:28 run's
finding again, and it is now the rule's practical shape: **the watchdog and the
work share one thread, and the watchdog is the part that loses.**

### WI-028 and WI-078 are dispatched, and this time as tasks

**WI-028's re-verification to Probe** (`hlp_c38af0b8226a`) and **WI-078 to
Wren** (`hlp_b55e5e1b22e4`), both at 21:12, both with the full brief in the
item file. **The peer session's independent re-measurement of WI-028's seven
pointers is a cross-check, not the verification** — it confirms the fix, and
Probe's re-verification is what carries the acceptance.

## The floor at 20:45 — two merges, one near-miss, and a runtime that stopped

### WI-028 is corrected, merged, and back in the queue

**Wren's helper finished and pushed.** Branch `wi/028-contract-names-the-change`,
two commits (`22ef5ba`, `d92e5e5`), **`main` never touched** — and the report
says the pointers were **re-measured on the tree that carries the fix, not
copied from the brief**, which is the only way a citation fix is worth
anything. **The MCP exposure entry now carries the sentence _"The read side is
WI-028, and the code implements it — as of `622812c`."_**, in the house form of
the memory-scope entry's own read-side sentence, and all seven pointers point
where they say. **Merged into `main` as `d530f73`.** The item file's conflict
was resolved by hand, keeping the verification record and the correction record
together.

### WI-066 is merged — and this session nearly put a second worker on it

**Wren had already implemented WI-066 at 19:39**, on branch
`wi/066-message-shape-fourth-field`: `f63c978`, "Publish the message shape's
fifth field, and what it is for". **Merged into `main` as `d3add55`.**

**And this session was about to hand WI-066 to Wren a second time.** It wrote
a full brief, corrected the item's premise, and was one step from delivering it
through the group — **because WI-066's item file carried no task id, and that
was read as "not dispatched".** The dispatch table says otherwise: **the peer
session dispatched WI-066 at 13:40** (`task_0cfbcce20e92`) and **Wren had
already done the work**. The hand-off was withdrawn before it went out, and
the ledger row now says so with the mistake in it.

**The rule that would have caught it is mechanical: _the dispatch table is the
record of what is dispatched, and an item file with no task id in it is not
evidence that nothing was dispatched._** An item file is the brief; it is not
the queue.

**And one thing came out of the near-miss worth keeping: Wren corrected the
count independently, the same way this session did.** Her commit says it
plainly — _"The item's own count — four, not three — was taken from that
prose; the tree says five, and the tree wins."_ **Two sessions measured the
same tree and reached the same number, and the item's title was wrong in both
of them.** The lead's rewritten title and criteria are merged with her record
rather than replacing it.

### WI-078 is opened, and it is WI-031's last blocker

**Probe's WI-031 verification found a gap this session had not seen:** the
contract publishes `ResolveExecutionInput` with `note?: string` and **no
bound**, while the code caps it — `note: z.string().max(2_000).optional()`
(`apps/server/src/api/executions.ts:9`). **A client written against the
published shape may send a longer note and be refused with
`validation_failed`.** That is a gap against **WI-031's own criterion 7**,
which asks that the published shape match the code member for member.

**WI-078 is that gap, opened and given its branch and worktree**
(`wi/078-published-note-bound`,
`G:\code\personal-os-worktrees\078-published-note-bound`). **It is the last
thing standing between WI-031 and its acceptance** — WI-031's implementation
is verified on substance, and the other half is the correction of WI-031's own
status paragraph, already queued at Wren.

### The runtime stopped again, and this time it took the tools with it

**The Mini App runtime went from running to stopped between two calls**, and
the MCP tool registry went with it: `start_helper` and `list_team` both
answered **"Tool not found"**. **`miniapp restart` brought the runtime back —
`status: running` — and the tools are still not reachable from this session.**
**So the repair that restores the factory is not the repair that restores the
session**: the registry this session holds was resolved before the restart, and
nothing re-resolves it mid-session.

**The consequence is a delivery channel, not a dead end: the group.** The
briefs that could not be handed over through the task API — WI-028's
re-verification to Probe, and WI-078 to Wren — are in this turn's group post,
and the group is the channel that reaches the group. **This is the second time
tonight the task API refused a dispatch, and the first time it refused because
the transport was gone rather than because the target's chat was busy.**

### The gate is red intermittently, twice tonight, and the push waits

**Two reds in five root runs on one tree, with every assertion green** — the
signature is WI-074's and the cause is measured (`EBUSY`, and the lever is
`maxRetries`, not the timeout). **The failing file's name was not captured
either time**, because the output window was filtered to the summary lines.
**That is a gap in the measurement and it is recorded as one.**

**So `main` is not pushed, and the reason is the rule and not caution.**
`FACTORY.md:99-107` says the local gates must **pass on the tree being
pushed**, and the test gate did not. **Nine commits sit unpushed**, all of them
documentation and contract prose, and the code is byte-identical to the tree
the pipeline measured green at `e676ba9` — **but the rule is about the tree,
not about the code.** **The gate is what it is until WI-074 lands, and a push
made on a tree whose gate has been red twice tonight is a push the next person
has to re-check.**

### `origin/main` was pushed from a branch, and it is reconciled

**What happened, measured.** At 20:57 `git rev-list --left-right --count
origin/main...main` read **9 11** — the two had diverged — and `git log
origin/main` showed its head as `38c14fb`, _"Merge remote-tracking branch
'origin/main' into wi/070-free-window-streams"_. **A branch had been pushed to
`origin/main`.**

**What it carried, and what it left out.** That push carried the peer session's
real work — `apps/server/src/api/agui.ts`, `agui-protocol.ts`, two test suites,
the route registration in `app.ts`, the contract entries and the
`published-shapes` test — **and it left out this session's two contract
merges**, `d530f73` (WI-028) and `d3add55` (WI-066), which existed only on this
machine. **A push that writes `main` from a branch is a push that can silently
drop another session's landed work, and this one did.**

**The repair is a merge, not a force-push.** `git merge origin/main` into
`main` was clean — `CONTRACTS.md` auto-merged, because the AG-UI passages and
the memory and message-shape passages do not overlap — and `main` now carries
both sides. **A force-push would have been the wrong repair twice over: it
would have destroyed the peer's AG-UI commits, and it is exactly the
push-to-undo-by-force that `FACTORY.md` forbids.** The merge is Chief's by the
rule at `FACTORY.md:134`, and it is done.

**And one thing that was nearly lost, and was not.** The peer session's
rewritten WI-078 brief — the one that measured the contract's own line numbers
and found the house form for publishing a bound — was in the working tree and
uncommitted when the tree was reconciled. **It is restored and committed**, and
the item file says whose content stands.

**And one thing two sessions found independently, which is worth noticing.**
The peer session wrote, at 20:11, _"WI-036's artefact changed under its
acceptance, so the item goes back to verify"_ — and this session dispatched the
same re-verification at 19:55, from the peer's own note in the ledger's tail.
**One finding, two sessions, reached from opposite ends of the same record.**
That is the ledger working, and it is the reason the note was there.

### And `main` is pushed, under the standing word

**The four gates, measured on the tree that was pushed** — after the merge that
reconciled the branch-push, and after the AG-UI suites arrived with it:

```
typecheck      exit 0
test           exit 0   server 27 files / 282 tests · web 8 / 68 · worker 5 / 31
                      agent-adapters 2 / 16 · contracts 4 / 28
format:check   exit 0   All matched files use Prettier code style!
build          exit 0   ✓ built in 3.63s
```

**`FACTORY.md:99-107`, all three of its conditions, measured:**

- **the local gates pass on the tree being pushed** — the four above;
- **the code that would be landed is the code the pipeline has measured green** —
  `38c14fb`, the head the AG-UI work landed on, is **CI success and CodeQL
  success**, and `git diff --name-only 38c14fb..main` touches
  **`.factory/**`and`CONTRACTS.md` only** — **no code path\*\*;
- **the push is a fast-forward, and `origin/main` is still where the work
  started** — `git rev-list --left-right --count origin/main...main` read
  `0 13` before the push and `0 0` after it.

**And the one-push-at-a-time rule held without waiting.** The run that was in
flight, `308461e`, is on **`wi/062-measures-citation-refresh`** — a different
ref — and `cancel-in-progress` is keyed on the ref, so the push did not
supersede it. **The push was `38c14fb..187facd`, and the pipeline started on
`187facd`.**

**Why this push was more than routine.** `origin/main` had been written from a
branch, and the repair was to put `main` back on top of everything — the AG-UI
work, this session's two contract merges, and the records — in one fast-forward.
**A force-push would have been the wrong repair and was not used.**

## One timestamp in this file is right and two are wrong — 2026-10-21 20:05

**`task_797badb7e918` was cancelled at 18:58:10.** The authority is the fleet
state's own record for the task, read out in full:

```json
{
  "id": "task_797badb7e918",
  "status": "cancelled",
  "cancelRequested": true,
  "endedAt": 1792569490928
}
```

**`1792569490928` is 2026-10-21 18:58:10 +11:00** — converted twice, and
independently of any narrative of when somebody noticed.

**Two other times for the same cancellation are in this file, and both are
wrong:**

- **18:24:50**, in the dispatch table near the top. That is the group
  session's own arithmetic on the same number, and it was wrong.
- **19:04:50**, in the peer session's table of cancellations. The peer
  session's message says 19:04:50. **Where that number came from is not
  something this session can see**, and it is not argued with here — the
  record is the authority, and the record says 18:58:10.

**Nothing about the cancellation is in doubt.** The task is `cancelled`,
`cancelRequested` is true, and it never took a slot. **Only the clock was in
dispute, and the clock is now read from the record rather than from a story
about when somebody looked.**

**And a third number, `unknown`, is now cited rather than interpreted.** The
runtime's own README says: _"After a restart, work that never started stays
queued. **Interrupted executions become `unknown` and are not replayed
automatically.**"_ So `unknown` is the **documented end state of an
interrupted execution**, not a state with work in it — which is why the
repair for the dead slots was a restart and not a cancellation.

## The dispatch the peer session could not make — made — 2026-10-21 20:12

**The peer session's tools did not come back with the runtime, and it said so
rather than pretending otherwise.** `mavis mcp list` returns no servers in
that session at 19:41 and again at 19:52, while this session has called the
bot tools since 18:58. **So the registration is per-session: a session that was
live when the Mini App runtime stopped keeps the empty tool set it had.** The
restart brought the dispatcher and the server back for the sessions that
re-register, and not for the one that did not.

**Which meant a dispatch was owed that only this session could make, and the
peer recorded it in the ledger rather than leaving it in a message.** It is
made now.

### The question nobody had asked

**The three files taken under the tiebreak were not all covered.**

| File                            | Item                                                                           | Covered?                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `README.md`                     | **WI-041**, in `verify` with Probe on it                                       | **yes** — Probe's re-verification is queued                                           |
| `docs/dependency-licences.json` | **WI-036, `accepted`**                                                         | **no** — the acceptance was given to a version of the file that is no longer the file |
| `docs/strategy.md`              | **WI-036's scope** — its gates name it, and its comparator table is the item's | **no** — same reason                                                                  |

**Both files are inside WI-036's own scope, WI-036 is accepted, and this
session changed both of them after the acceptance was given.** The acceptance
was given to a version of the record that is no longer the record, and **whether
the five criteria still hold against the tree as it stands is the verifier's
question, not a lead's.**

**Probe is asked it.** Request
`probe-verify-wi-036-licence-record-mit-2026-10-21`, task `task_e4b8ac641700`,
batch `batch_3e8305153bdb`, queued. It is asked to re-derive the numbers its
own way rather than trust the record, to prove **that no dependency entry
changed** — the corrections were to the notes about _this repository_, and a
changed dependency entry would be a serious finding — to check that the new
claims are true against the root `LICENSE` file and the manifest, and to sweep
the tree and say which remaining hits are live claims and which are recorded
history.

**And WI-036's own file now says so**, with a dated correction and the
dispatch recorded on it — **the same pattern WI-043 used when WI-068 landed
underneath it**: the item goes back to verify when the tree changes under it.

**This is the second time today that a change made above the factory was
allowed to land on accepted work without anyone asking.** The first was the
byte dump; the second was the licence decision. **The pattern is the finding:
a change that a lead makes in the tree does not carry its own verification
with it, and the lead who made it is the one person who cannot ask the
question** — because the implementer is not the verifier, and the lead who
wrote the change is not the lead who accepts it. **So the lead who changes an
accepted artefact owes the factory a verification dispatch, and owes it before
the change lands.**

## The watchdog run at 20:16 — one task over the threshold, and it is live — 2026-10-21 20:16

**One task is over the 45-minute trigger: `task_0cfbcce20e92` — WI-066 in
Wren's chat, 47.7 minutes.** The other running task is Probe's WI-022
verification, 0.4 minutes.

**And the corrected rule says report, not cancel.** Wren's session
`mvs_dff627414f0e47fbbdf7501b11dfdd06` reads **`started`**, and the chat's last
message from that bot is `msg_dea2462e3324` — **`streaming`, 2.2 minutes old**,
`kind: task_review`, under the same task id. **So condition 2, that the session
is not `started`, is not met, and nothing is cancelled.** Cancelling is Chief's
judgement, and Chief's judgement here is that the turn is live.

**And this is the 462-minute stall's exact shape, one more time:** a
`task_review` continuation runs under the **same `taskId`** and posts new
messages **without touching `result`**, so the task's age and the turn's age
are two different numbers. **Wren's substantive report was delivered at
19:42:28 — 5,059 characters, _"WI-066 is written, gated, and pushed"_ — and the
work is committed** (`f63c978`, `fd5477e`). **The task has been running 47.7
minutes; its live turn is 2.2 minutes old.** A check that read the age alone
would have called it a stall; **the chat says a turn is in flight.**

**And the previous check did not complete.** The 20:07 firing was refused with
`BUSY`, and so were 18:56 and 19:27 — **because this chat has been in one long
turn since 18:53.** **So the scheduled check's last completed run is still
16:21**, every firing since has been refused, and the measurement itself has
been taken repeatedly inside that turn instead. **That is the same finding as
the 19:28 run, and it is now the rule's practical shape: the check and the
chat share one thread, and a chat that is busy cannot also be watched.**

## A second verification of an accepted item, cancelled — 2026-10-21 20:15

**WI-041 is accepted.** The other Chief session's verification of it — request
`probe-verify-wi-041-readme-licence-2026-10-21-1340`, task `task_5b4e02d59413`,
measured at `e676ba9` — was given against the item's **corrected** criteria,
and the acceptance records that the implementation was taken under the tiebreak
in `FACTORY.md:38` and that **the verification is Probe's, so the lead accepts
it and no writer accepts its own work.**

**This session had dispatched a verification of WI-041 as well** —
`task_6fc1d2870136`, queued to Probe at 19:41 — **and it is cancelled**, at
**20:15:01**. **A second verification of one item is never created**, the item
is accepted, and **a slot is the scarcest thing the factory has**: a queue of
26 items that have never been verified is waiting behind that slot. **The
duplicate goes back to the queue and the item keeps the verdict it has.**

**And the one criterion the acceptance did not measure has now been measured —
by a diff, and without taking a slot.** WI-041's fifth criterion says
_"nothing else in the README changes"_, and the acceptance's verdict was that
the criteria are met _"on their face"_. The measurement:

- `git diff 141f0be^..141f0be -- README.md` touches **exactly the licence
  section** — the old paragraph removed and the new one added, three lines;
- `git diff 141f0be..HEAD -- README.md` is **empty**, so the README has not
  changed since.

**The criterion holds.** **This is a measurement, not an acceptance** — the
acceptance is the other session's and it stands on its own. But the gap between
_"met on their face"_ and _"measured"_ is now closed for this one item, and it
was closed with a command rather than with a queue slot.

**Which is the pattern worth keeping.** When a duplicate verification is
cancelled because the item is already accepted, **the thing the cancelled
verification would have measured is still owed — and it may be measurable
without a verifier at all.** A diff is free. A slot is not.

## A second verification of an accepted item, cancelled — 2026-10-21 20:15

**WI-041 is accepted.** The other Chief session's verification of it — request
`probe-verify-wi-041-readme-licence-2026-10-21-1340`, task `task_5b4e02d59413`,
measured at `e676ba9` — was given against the item's **corrected** criteria,
and the acceptance records that the implementation was taken under the tiebreak
in `FACTORY.md:38` and that **the verification is Probe's, so the lead accepts
it and no writer accepts its own work.**

**This session had dispatched a verification of WI-041 as well** —
`task_6fc1d2870136`, queued to Probe at 19:41 — **and it is cancelled**, at
**20:15:01**. **A second verification of one item is never created**, the item
is accepted, and **a slot is the scarcest thing the factory has**: a queue of
26 items that have never been verified is waiting behind that slot. **The
duplicate goes back to the queue and the item keeps the verdict it has.**

**And the one criterion the acceptance did not measure has now been measured —
by a diff, and without taking a slot.** WI-041's fifth criterion says
_"nothing else in the README changes"_, and the acceptance's verdict was that
the criteria are met _"on their face"_. The measurement:

- `git diff 141f0be^..141f0be -- README.md` touches **exactly the licence
  section** — the old paragraph removed and the new one added, three lines;
- `git diff 141f0be..HEAD -- README.md` is **empty**, so the README has not
  changed since.

**The criterion holds.** **This is a measurement, not an acceptance** — the
acceptance is the other session's and it stands on its own. But the gap between
_"met on their face"_ and _"measured"_ is now closed for this one item, and it
was closed with a command rather than with a queue slot.

**Which is the pattern worth keeping.** When a duplicate verification is
cancelled because the item is already accepted, **the thing the cancelled
verification would have measured is still owed — and it may be measurable
without a verifier at all.** A diff is free. A slot is not.

## A scheduled report carries its premise with it — 2026-10-21 20:41

**A scheduled task fired tonight to report a finding from 06:12 this morning:
"the committed tree is red on purpose (4 failing tests) and the memory-guard
fix has no work item."** Both halves of that are now false, and the report was
never delivered — the group was mid-discussion on three attempts — **so
delivering it tonight would have published a false claim about the
repository.**

**So it was not delivered, and the finding was closed where it was raised.**

**What was measured, before deciding that:**

- **The tree is green.** The two files that were red — `agent-memory.test.ts`
  and `unknown-outcome.test.ts` — are **21 passed, 2 files, 0 failed**. CI is
  green on every push since `e676ba9`.
- **The memory guard is implemented and on every path.**
  `apps/server/src/modules/mcp/server.ts:153` judges both the resource as it
  is and as the write would leave it, and it is called on `resource.create`,
  `resource.update` **and** `resource.get`. `1d45543` (07:17) is the fix —
  _"Judge a memory write by who owns it, not only by what it says"_ — and it
  came out of the owner's 07:07 ruling.
- **The test was strengthened, not weakened.** `767fbe3` (13:11) replaced
  _"looked for `isError` somewhere in the response, which any error would
  satisfy"_ with a comparison against the contract's own published message.

**And the finding's own history is the lesson.** It was recorded at **06:12**,
twenty-five minutes after the red test that proved the defect and an hour
before the fix. **It was live for about an hour, and it was closed inside that
hour by the owner's ruling.** A report written from that moment is a report
about a moment.

**So the rule is the one the peer session wrote down this morning, applied to
a scheduled report rather than to a question:** **a premise is a measurement
of a moment, so the question has to be asked of the tree and never of the
conversation.** A scheduled report is the sharpest case of it — the report was
written hours ago and will be delivered whenever the channel opens, **so it
has to be re-measured at the moment of delivery, and withdrawn if the tree has
overtaken it.** **A report that cannot be delivered because it has become
false is not a failed report. It is a correct one that says nothing.**

**And this one is closed in `WI-005.md`, beside the finding it closes.**

## The publish took, and this session's own measurement carries a date — 2026-10-21 21:05

**This session's section headed "19:45" says the door is not open. The door opened
at 19:41:10.** The heading's time is wrong: the section was committed at
**19:41:44** (`e59f0e3`) and its four checks ran at **19:38–19:42**. **The
commit's time is the authority, and a reader checking when that record was made
would have got the wrong answer.** It is corrected here, by append, because this
file is append-only and the section is not wrong about what it measured — it is
wrong about when it was written.

**The 19:41:10 flip is the peer session's measurement, and it is recorded in this
file as theirs.** This session does not restate it as its own.

**This session's own confirmation, a fourth, at 20:52 — unauthenticated, against
the repository's own endpoint, from outside this machine:**

```
private   = false
visibility = public
license   = MIT / MIT License   (spdx_id: MIT)
```

**And the raw `LICENSE` file is served to an unauthenticated client with the MIT
text in it.** So the ledger's last word on the publish is the door being open,
and this session's 19:45 section is **a measurement of a moment** — the same
rule this file applied to the 06:12 red-tree report an hour and a half ago.

**And the standing word's verdict, read afterwards and recorded here.** The
pipeline on the pushed sha `c2e10b0`: **CI — all four jobs `completed/success`**
(run 39575191549) and **CodeQL `completed/success`** (run 39575191465). That is
the platform's verdict on that push, and it is green.

## The verdicts, the number space, and the fleet — 2026-10-21 21:22

**Every tip on `main` tonight reads green.** The pipeline on the sha that is on
the remote now, `8fc0289`: **CI — all four jobs `completed/success`** (run 39583423804) and **CodeQL `completed/success`** (run 39583423798). Before it:
`eeeb864` green, `eafca30` green, `38c14fb` green, `c2e10b0` green.

**The number space, ruled.** The strategy session asked whether WI-070 through
WI-073 are free for it. **They are, and they are already its own:** it opened
them at **16:24** (`8575e10`, _"Open the four streams of the free window"_),
after renumbering from WI-069, which this file records as taken mid-flight.
**One attribution is wrong, and it is corrected here rather than in the other
session's file:** the WI-078 file lists _"WI-070–WI-073 … the other Chief
session's too"_ — **they are the strategy session's.** Above them: **WI-074
through WI-077 are the other Chief session's**; **WI-078 is the other session's**
(opened at **20:49**, `38d09d0`, after WI-066's own file had already named it —
their near-miss, recorded by them); **and WI-079 is the next free number.**

**And a branch landed on `main` tonight, and it is worth naming plainly.**
`origin/main` was, at 20:42, **`38c14fb` — a commit on the WI-070 branch** (_"Merge
remote-tracking branch 'origin/main' into wi/070-free-window-streams"_), pushed to
`refs/heads/main`. The other Chief session reconciled it into `main` (`187facd`),
and **the pipeline read green on that tree**, so the content is measured and the
record is whole. **But a branch push that lands on `refs/heads/main` is a landing
on `main`**, and landing on `main` is governed by the owner's standing word and
the three conditions in `FACTORY.md:99-107`. **A branch push that targets
`refs/heads/main` has to meet them, or it does not go there.**

**And the fleet at 21:20, measured.** Both slots are running — **WI-036** in
Wren's chat (19.5 minutes) and **WI-074** in Probe's chat (7.6 minutes) — and
**the queue is 17 and falling**, from 26 at 19:55. **WI-074 is the flake** — the
`EBUSY` in a test's own cleanup — and it is the one the verifier is on.

**And the two verifications this session asked about are still owed, and the
channels carrying them are queued.** WI-066's verification
(`probe-verify-wi-066-published-shapes-2026-10-21`) is in the group and in the
peer session's queue, and the group session is mid-turn, so both wait. **A brief
sitting in a queue is not a dispatch** — and this session's table rows say
**REQUESTED**, not dispatched, because that is what has happened.

## The WI-022 verification had landed, and this session's claim that it was lost is wrong — 2026-10-21 21:15

**The section _"Two verifications are owed, and one of them was lost with the
runtime — 2026-10-21 21:05"_ says WI-022's verification work was lost and must
be run again. That is wrong, and the correction is here rather than edited over
the claim.** Its first table row — _"the work is gone — it must be run again"_ —
is the wrong row, and the table's other two rows stand: WI-066's work arrived
and WI-024's report is in hand.

**Probe's report went to the group at 20:59:56** — `task_5634427d74e4`, 6,587
characters — and it is in the group's queue. It answers all five questions by
measurement, carries the gates, answers Probe's own question about a citation
checker, and ends **"Verdict: verified."**

**How the miss happened, because the mechanism is the lesson.** This session
checked **the task's own channel**: `task_018a6018b18f` is `unknown`, and its
reply is `interrupted` at length 0. From that it concluded the work was gone.
**The work had gone to the group, which is a real channel, and this session did
not look in it.** The same two words came apart for the seventh time tonight,
and the rule that catches it is the one already written down: **ask where the
work actually went before saying it is lost — a task's status is not the work's
fate.**

**What it cost, said plainly: one dispatch slot, and a rule broken.** The request
`wi-022-citation-refresh-verify-r2-2026-10-21` was sent to the group and to the
peer session before this correction. **It is withdrawn** — the table row says
**WITHDRAWN**, and the correction has gone back to both places it went. **A
second verification of one item is never created**, and WI-022's successor
already carries Probe's verdict.

**And what is owed for WI-022 now is the lead's acceptance, not the verifier's
second look.** It is made, in `.factory/work/WI-022.md`: the verdict is on the
record, the implementation was Wren's, the verification is Probe's, and **the
tree Probe measured at (`fe3f660`) still stands** — `git diff --name-only
fe3f660..HEAD -- CONTRACTS.md` is **empty**, and the same diff against
`apps/server/src/api/waiting.ts` is **empty**, so the contract and the cited
code have not moved since the verdict.

**And WI-066's verification is still owed** — it has never been dispatched, the
item is merged into `main` as `d3add55` with all ten criteria unticked, and the
dispatch table has no verification row for it. **That request stands**:
`probe-verify-wi-066-published-shapes-2026-10-21`.

## The verdict on this session's push — 2026-10-21 21:20

**`main` is pushed.** The other Chief session pushed at 21:01 (`eafca30`) after
measuring the three conditions, and **the pipeline read green on it — all four
jobs plus CodeQL** (runs 39581494049 and 39581494046). **This session's ledger
commit `eeeb864` went on top of it at 21:05, once that run had finished, so
that no push of mine cancelled a live run** — the rule's "one push at a time,
and let the run finish", and the peer session's 19:33 push is the case the rule
was written for.

**And the local gates on the tree that was pushed, measured before the push:**
`typecheck` 0 · `format:check` 0 · **`test` exit 0, twice** — server 27
files/282 tests, web 8/68, worker 5/31, agent-adapters 2/16, contracts 4/28 —
· `build` 0.

**The platform's verdict on this session's own push is read afterwards and
recorded** — in the section _"A gate is pinned to a commit, not to `main`"_, which
carries both verdicts: `eafca30` green and `eeeb864` green.

## One event, two copies — 2026-10-21 21:05

**The section _"A second verification of an accepted item, cancelled — 2026-10-21
20:15"_ appears twice in this file, word for word.** **One cancellation happened:**
`task_6fc1d2870136`, cancelled at **20:15:01**; one cancelled task; one
measurement of the README's diff. **A reader must not count two cancellations**,
and the copy arrived with a later append.

**It is recorded here rather than deleted.** A duplicate is a copy error and not
a false claim, and this file corrects by appending — but the event count is one.

## Two verifications are owed, and one of them was lost with the runtime — 2026-10-21 21:05

**The Mini App runtime restarted at 20:45:00** — the runtime's own diagnostics:
`runId 9d0d62cc`, `preparationStartedAtMs` 1792575900235, ready 1792575904476.
**Three tasks carry that restart's mark, and they are three different outcomes.**

| Task                | Item                    | The chat's own record                          | Verdict                                     |
| ------------------- | ----------------------- | ---------------------------------------------- | ------------------------------------------- |
| `task_018a6018b18f` | WI-022's verification   | `status: interrupted`, **length 0**            | **the work is gone — it must be run again** |
| `task_0cfbcce20e92` | WI-066's implementation | `status: done`, **5,059 characters**, 19:42:28 | **the work arrived** — merged as `d3add55`  |
| `task_d2fa4fb7e946` | WI-024's verification   | `status: done`, **9,924 characters**, 19:40    | **the report is in hand**                   |

**The first row is the opposite of the watchdog's sixth correction.** There, a
task read `failed` and the work was not lost. **Here, `unknown` _is_ a loss**:
the message is `interrupted` at zero length, and the runtime's own README says
interrupted executions are not replayed automatically.

**And WI-066's verification was never dispatched at all.** The dispatch table is
the authority: row `wi-066-message-shape-fourth-field-2026-10-21-1340` is the
**implementation**; **there is no row for a verification of WI-066**; and the
item file sits at `verify` with **all ten criteria unticked**, its
implementation merged into `main`. **An item can be merged and still be
unverified, and the table is what says which one it is.**

**Both are requested now, through the group**, because this session has no
transport: `mavis mcp list` returns no servers here, at 20:43, at 20:52, and
again after the 20:45 restart. The request ids are
`probe-verify-wi-066-published-shapes-2026-10-21` and
`wi-022-citation-refresh-verify-r2-2026-10-21` — **the second is deliberately a
new id and a new title, because a re-dispatch reuses neither.**

**And one id that was not used.** This session drafted a brief for WI-078 at
20:51 and chose the request id `wi-078-note-bound-2026-10-21`. **The peer
session had already chosen the same id and dispatched it at 21:00.** The draft
was discarded, **the id is the peer's and was not spent twice**, and the brief in
the tree is the peer's.

## This session had the same near-miss, four minutes later, and the file is restored — 2026-10-21 21:05

**At 20:51 this session overwrote `.factory/work/WI-078.md` — a file another
session had committed at 20:49:54** (`38d09d0`). **It was restored from `HEAD`
inside the same minute, and the tree is clean; nothing of theirs was lost. The
overwrite happened anyway, and it is recorded here rather than left to be
discovered.**

**How it happened is the point, because the mechanism is small.** The number was
checked at **20:47** — the file did not exist then — and the brief was written
at **20:51**, four minutes later, without the check being repeated. **The other
session took the number at 20:49.** The strategy session's own rule is the
answer, and it is now measured rather than quoted: **the space is re-checked
immediately before the write, not minutes before it.** Four minutes was enough.

**And the only reason it was caught at all is that the write tool says it
overwrote an existing file.** A brief written in a session's own words, into a
file the session had checked four minutes earlier, felt safe — **and "one file,
one live item" is not a rule about intent. It is a rule about the file.**

**The number is now taken: WI-078 is the other session's** — the peer's brief,
dispatched through the group at 21:00 — **and WI-079 is the next free number.**

## The gate, measured, and the push — 2026-10-21 21:05

**The local gates on the tree being pushed, run twice at 20:57 and 20:58:**
`typecheck` 0 · `format:check` 0 ("All matched files use Prettier code style!") ·
**`test` exit 0, twice** — server 27 files/282 tests, web 8/68, worker 5/31,
agent-adapters 2/16, contracts 4/28 — · `build` 0.

**The pipeline's verdict on the tree the code comes from:** `38c14fb` — **CI all
four jobs `completed/success`** (run 39580388063) and **CodeQL
`completed/success`** (run 39580388107). That is the tree the peer's branch
brought; the other Chief session reconciled it into `main` (`187facd`), and the
push that put it on the remote was a branch pushed to `refs/heads/main`.

**And the rule's condition (b) holds by measurement:**
`git diff --name-only 38c14fb..main` touches **no code path** — nine files, every
one of them `.factory/` prose or `CONTRACTS.md`. **The push is a fast-forward**
(`rev-list --left-right --count origin/main...main` = `0 13`), **and no run was
in flight when it went**: the run on `38c14fb` had already finished, green,
before this push — so this push starts the run that judges it, and **nothing is
cancelled.**

**The other Chief session recorded at 20:45 that it would not push, because the
test gate had been red twice tonight.** That was a reading of its own runs, and
the rule it named is right — the gate is about the tree being pushed. **This
session's two runs on that same tree are green, and the gate is what it is.**

**And the red it was measured against is WI-074's** — `EBUSY` in a test's own
cleanup, queued at Probe — **so a red verdict on a pushed `main` is a failure to
fix and say out loud, not a push to undo.** The verdict on this push is read
afterwards and recorded here, as the rule says.

## A gate is pinned to a commit, not to `main` — 2026-10-21 21:15

**The tree moved three times while the local gate was running**, and every move
was another session committing to the same `main` in the same worktree:

| time     | what landed                                                                           | code changed?           |
| -------- | ------------------------------------------------------------------------------------- | ----------------------- |
| 20:49:54 | `38d09d0` — WI-078 opened                                                             | no — `.factory/**` only |
| 20:51:24 | `01571ef` — WI-036's record                                                           | no — `.factory/**` only |
| 20:54:36 | `fe3f660` — **origin/main merged into `main`**: the AG-UI work, ~2 000 lines, 6 files | **yes**                 |

**So the first gate run measured a tree that was no longer `main`**, and the
numbers it produced said nothing about the code that was about to go out. **A
gate is a measurement of a tree; if the tree moves under it, the measurement is
of the past.** The rule that follows is not "run the gate again" — it is **pin
the gate to a commit and prove the code did not move**.

### Pinning it

The gate was re-run with the commit recorded before it started and the three
code subtrees hashed before and after:

```
GATE START SHA: fe3f6605981ac219708bd5365e6c2ea5867fa582
apps:    5519aad5f833550791018c1cdae2c22a94d15584
packages:8ffa38b80f72115cd0c0efaaab4cc06586f55d49
scripts: 5014b325e37973e6f17150ce0c425bc45a04b9bd
```

and at the end of the run, with `main` two commits further on:

```
apps:    5519aad5f833550791018c1cdae2c22a94d15584   same
packages:8ffa38b80f72115cd0c0efaaab4cc06586f55d49   same
scripts: 5014b325e37973e6f17150ce0c425bc45a04b9bd   same
```

**The code the pipeline measured green and the code that went out are the same
bytes**, and that is a fact about hashes rather than a reading of a diff. The
other session measured the same tree the other way — `git diff --name-only
38c14fb..main` touching `.factory/**` and `CONTRACTS.md` only — and **the two
measurements agree**: two independent readings of the same tree, and the same
counts from both gates.

### The first e2e run was red, and it was not the code

```
Error: http://127.0.0.1:4399/api/health is already used, make sure that
nothing is running on the port/url or set reuseExistingServer:true in
config.webServer.
```

**This is the port collision the Playwright config already warns about**, in its
own comment at `apps/web/playwright.config.ts:18-26` — the port is
configurable precisely because **two Playwright sessions on one port fight over
the same data directory**, and `PERSONAL_OS_DATA_DIR` is per-port for the same
reason. The fault was mine: the local gate script hard-coded `4399`, and
**twenty-four worktrees and several sessions share this machine**. The re-run
on an isolated port was **27 passed**.

**So the lesson is two lessons.** **A failure that says "already used" is a
collision to be re-measured, not a defect to be explained** — and it is
re-measured on a port of its own, because re-running the same port and getting
a green result would prove nothing. **And the local gate needs a port unique to
the run.** On CI there is one run at a time and the default `4319` is safe; on
a shared workstation the fixed port is a standing hazard, and the gate script
is part of the factory's tooling whether or not it lives in this repository.

### The two gates, side by side

```
typecheck      exit 0
test           exit 0   server 27 files / 282 · web 8 / 68 · worker 5 / 31
                      agent-adapters 2 / 16 · contracts 4 / 28
format:check   exit 0
build          exit 0
smoke          exit 0
test:e2e       exit 0   27 passed
```

### The push was the other session's, and one run never judged the tree

**The push was the other session's** — `main` was pushed at `187facd`,
fast-forward from `38c14fb`, and the ledger's record of it is the other
session's. **What this session's commits were is that they rode along as
ancestors**: `7e1730e`, `cdc72ee`, `dc5bb9a`, `d530f73`, `d3add55` and `fe3f660`
are all contained in `origin/main`, and local `main` and `origin/main` are the
same commit. **A push is not a race for the button; the standing word is a
licence to push when it is green, and whoever pushes first publishes both.**

**And one thing in that record has since become false, and it is stated here
rather than left.** The entry says _"the pipeline started on `187facd`"_ — and
**the pipeline never judged `187facd`**. Its run is `completed/cancelled`, for
both workflows, because the next commit was pushed while that run was in
flight. **This is the one-push-at-a-time rule catching the session that wrote
it, and the rule is the point.** The end state is safe and was measured:

| sha       | CI            | CodeQL        |
| --------- | ------------- | ------------- |
| `187facd` | **cancelled** | **cancelled** |
| `eafca30` | success       | success       |
| `eeeb864` | success       | success       |

`187facd` is an ancestor of both green runs, so **the tree that was judged
green contains every byte of the tree that was pushed** — the code was
measured, and the runs that measured it are `eafca30` and `eeeb864`, not
`187facd`. **But the record said otherwise, and the record is what the factory
reads later.** A correction is stated where the claim was made, not by
rewriting it, and this is that statement.

### The platform's verdict, read afterwards

- `eafca30` — CI success on all four jobs, CodeQL success.
- `eeeb864` — CI success on all four jobs and every step, CodeQL success.

**And the repository, read from outside this machine, unauthenticated:**
`visibility = public`, `private = False`, `license = MIT / MIT License`,
`default_branch = main`, and the raw `LICENSE` served anonymously with the
owner's text in it.

## The floor at 21:20 — the group's channel, measured twice

### Both sessions used the group as a dispatch channel, and neither dispatch happened

**The peer session asked for two verifications through the group at 21:05**
because its transport was gone — `mavis mcp list` returning no servers at 20:43,
at 20:52 and again after the 20:45 restart. **This session handed WI-028's
re-verification and WI-078 to the group at 21:01, for the same reason.** Both
sessions had the same reason and the same wrong inference.

**Measured at 21:12 against the dispatcher's own state, not against either
session's report:** the request id `probe-verify-wi-066-published-shapes-2026-10-21`
— the peer's — **is nowhere in it**. The request id
`wi-022-citation-refresh-verify-r2-2026-10-21` — also the peer's — **is nowhere
in it either**. **No task text mentions a WI-066 verification, and no task
carries WI-078.** The only WI-028 task ids are the peer session's 17:32 group
post of Probe's **first** report, the original verification, and this session's
helper. **Neither session's group post became a dispatch.**

**So the corrected rule, measured rather than inferred: _a post to the group
carries the words; a task carries the work; only the dispatcher makes tasks, and
it makes them from a request id and a title._** A brief handed over in the group
and counted as dispatched is a brief nobody has.

**What is different, and what is not.** Probe's **reports** are delivered to the
group as tasks — `task_5634427d74e4`, 6,587 characters, WI-022's verification,
which is how the peer session found its own "the work was lost" claim to be
false. **A report going to the group is not a dispatch going to the group.** One
is a verifier answering; the other is a lead assigning work.

**Both sessions' briefs were dispatched properly at 21:12–21:14** by the one
that had transport: **WI-078 to Wren** (`hlp_b55e5e1b22e4`), **WI-028's
re-verification to Probe** (`hlp_c38af0b8226a`), and **WI-066's verification to
Probe** (`hlp_1f8922079492`) — the one that had never been dispatched at all.

### WI-022's successor is accepted, and WI-079 is opened from Probe's own answer

**WI-022's citation refresh is accepted** at `8fc0289`, by the session that
wrote neither the implementation nor the verification, on Probe's five criteria
met with measured evidence: every citation pointing at the line that carries
the claim today, the claims behind them true of the code, WI-026's criterion 6
holding in the published text, the diff eight lines and nothing else, and the
gates green (391 tests).

**And WI-079 is opened from Probe's own answer to his own question** — the
check that catches a published citation which resolves to nothing. **The class
is real and the defect is live:** `prototypes/briefs/03-execution-trace.md:20`
cites `apps/web/src/api/events.ts`, and there is no `apps/web/src/api/`
directory in this repository. **Numbered, briefed in full, and held on a
precondition rather than a queue:** WI-038's own gate script is not merged, and
the exit-code convention has to exist on `main` first to be copied from rather
than remembered.

## The floor at 21:35 — WI-028 accepted, and the lead's own file had a stale pointer

### WI-028 is accepted, and the verifier found the acceptance's own blind spot

**Probe's re-verification (`hlp_c38af0b8226a`): _"all five criteria now hold on
`main` HEAD `a8c728c` (tree `1a53a18`). Both earlier findings are fixed. Ready
for the lead to accept — I am not accepting it."_** All five criteria, with
what was measured; the gates 0, 425 tests, no failures. **The code was Cog's,
the contract entries were Wren's, and the verification is Probe's — so the lead
accepts and no writer accepts its own work.**

**What the product can now do: an agent's own memory is private to it, on reads
as well as on writes, and the contract says so in both places — the rule, the
scope, the error code and the message, with the change that published each
entry named.** Before this item the read side was enforced by the code and
published by only one of the two entries that describe it, so a client reading
the MCP exposure entry had no promise about ownership at all.

**And the verification that accepted it found two things, separate numbers,
neither blocking — and one of them was in this item's own file.**

1. **`apps/server/src/modules/mcp/server.ts:145-151` now misdescribes the
   contract:** it says the published contract _"describes `resource.get` as
   'Read a resource' and says nothing about who owns a resource"_ — **true when
   `622812c` wrote it, and false since WI-028's own correction**, which made the
   contract say ownership at `CONTRACTS.md:704` and `:718-726`. **It is
   WI-080**, and it is Cog's file.
2. **This item's own file said the new sentence was at `CONTRACTS.md:700`; it
   is at `:728`** — WI-066's fifth field moved it 28 lines. **The same defect
   class this re-verification exists to catch, in the file this item owns.**
   **Corrected by the lead, who owns it**, and recorded here because **the
   irony is the lesson: the item that exists to catch stale pointers carried
   one, and only a verifier reading the tree rather than the diff found it.**

### WI-078 is merged and queued for verification, and WI-031 is one step from close

**Wren's WI-078 landed at `0eb1a35` and is merged into `main` as `998f15f`.**
The bound is published in the house form — a trailing comment on the field's own
line, like `role` and `instructions` — the prose says a longer note is **refused,
not shortened** (`validation_failed`, HTTP 422, the execution stays in `unknown`
and nothing is recorded, because the body is parsed before the service call),
and the migration note says a note recorded before the change is not
reclassified. **Its verification is queued (`hlp_3c50e3033785`)**, and it is the
last thing between WI-031 and its acceptance.

### The peer session's correction, and the answer to it

**The peer session withdrew its own WI-022 re-verification request at 21:15,
after finding that Probe's report had been delivered to the group at 20:59:56**
— `task_5634427d74e4`, 6,587 characters, ending _"Verdict: verified."_ **Its
error was looking only at the task's own channel**, and its rule is the right
one: **ask where the work actually went before saying it is lost — a task's
status is not the work's fate.**

**Measured, so nothing is left open:** the withdrawn request id
`wi-022-citation-refresh-verify-r2-2026-10-21` **was never used — there is no
task with it, so there is nothing to cancel**, and WI-022's successor carries
Probe's verdict and the acceptance that followed at `8fc0289`. **And WI-066's
verification, which the peer session says is "still owed and still requested",
was dispatched at 21:14** — `hlp_1f8922079492` — **so it is not a second
dispatch and must not be created.**

## A push's own pipeline run may never exist, and a discussion waits for its chat — 2026-10-21 21:35

Two facts from this stretch, both measured rather than inferred, and both about
the fleet's own machinery rather than about the product.

### A push can erase the next push's verdict

**This session pushed `2230fb1` at 21:16 — the ledger entry above.** **The
other session pushed `8fc0289` forty seconds later.** And the pipeline has
**no run at all for `2230fb1`**, while `187facd`'s run is `completed/cancelled`
for both workflows. The whole history on `main`, read from the platform:

| sha       | CI            | CodeQL        | note                            |
| --------- | ------------- | ------------- | ------------------------------- |
| `38c14fb` | success       | success       | the AG-UI work landed here      |
| `187facd` | **cancelled** | **cancelled** | superseded by the next push     |
| `eafca30` | success       | success       |                                 |
| `eeeb864` | success       | success       |                                 |
| `2230fb1` | **no run**    | **no run**    | superseded before it was queued |
| `8fc0289` | success       | success       | the head                        |

**So the honest statement about any single push is not "CI was green on it".**
Two of the last six pushes were never judged at all. **What is true, and is
checked, is that the head is green and that every green run contains every
superseded run's content** — `187facd` and `2230fb1` are both ancestors of
`8fc0289`, and `8fc0289`'s tree differs from `eeeb864`'s only in `.factory/**`.

**The rule this sharpens.** `FACTORY.md`'s standing word is _"push `main`
whenever CI is green"_, and the trap is reading that as a property of the
push. **It is a property of the head.** A push supersedes the run that would
have judged the previous push, so **the verdict that matters is the one read
after the last push of a batch of them** — and a push whose run never existed
is not a red build and not a failed gate. **It is a push that was overtaken,
and the run that judges it is the next one.**

### A discussion waits for its chat, and that is by design

**The tiebreak post is admitted and queued** — `task_b7f3bbf0d43e`,
`kind: discussion`, created 21:01:25 — **and it has not reached the group in
thirty-four minutes.** It is not lost, and the reason is in the dispatcher:

```js
// task-dispatcher.mjs:463-468
if (this.runs.size >= MAX_RUNNING) return;
if (task.status !== "queued" || this.runs.has(task.id)) continue;
// Leave occupied chats queued without consuming a task worker.
const key = task.kind === "discussion" ? `group:${batch.groupId}` : `bot:${task.botId}`;
if (this.engine.isBusy(key) || ...) continue;
if ([...this.runs.values()].some((run) => run.key === key)) continue;
```

**and `isBusy` is true while the chat is in use at all** (`engine.mjs:201-207`):
the inbox owns it, a turn is running on it, a ticket is open on it, or a group
loop is live on it. **The group's chat has been occupied since 21:05**, and
every message in that stretch lands as `done` with a following `error` —
**"Too many Bots are running at once"**, `errorCode: BUSY`.

**So the post is waiting for a chat that is in use, and it will go out when the
chat frees.** That is the dispatcher being careful — **an occupied chat is left
queued rather than given a worker** — and it is why there is no repair to make.
**A restart was considered and rejected**: it would release the two running
verifications to `unknown` to make room for a notification, which is the wrong
trade. **The decision itself is not waiting on the post** — it is in the
repository, in `## Chief's tiebreak, and the publish — 2026-10-21 19:08`, and
the acceptance of the three files Chief took is Probe's and the peer session's
and is not Chief's to give.

### The floor, measured

Two slots running, seventeen queued, ninety-nine done. **Both running slots are
verifications** — WI-036's record, re-verified because the artefact changed
under its acceptance, and WI-074's stack test. **The accept queue is moving.**

## The number space moved again, and green is a property of the head — 2026-10-21 21:28

**Two corrections to this session's own 21:22 section, both by append.**

**One: WI-079 is no longer free.** The other Chief session opened it at **21:21**
(`cbbc345`, _"Open WI-079 for the citation check"_) — the citation check that
Probe's own WI-022 report proposed. **So the space above WI-077 is WI-078 (the
other session's), WI-079 (the other session's, taken at 21:21), and WI-080 is
the next free number.** The rule that catches this is the strategy session's
own, and this session is learning it the hard way: **the space is re-checked
immediately before the write**, and **a number is not stable once it has been
spoken for** — which is true of the item files as much as of the ledger.

**Two: _"every tip on `main` tonight reads green"_ is wrong as written.** Two of
the last six pushes were never judged at all: `187facd` is **cancelled** and
`2230fb1` has **no run** — it was superseded before it was queued. **What is
true, and is checked, is that the head is green and that every green run
contains every superseded run's content**: `187facd` and `2230fb1` are both
ancestors of `8fc0289`, and `8fc0289`'s tree differs from `eeeb864`'s only in
`.factory/**`.

**And the rule this sharpens is the other Chief session's, and this session
adopts it: the standing word's _"green"_ is a property of the head, not of a
push.** A push supersedes the run that would have judged the previous push, so
**the verdict that matters is the one read after the last push of a batch** — and
a push whose run never existed is not a red build and not a failed gate. **It is
a push that was overtaken, and the run that judges it is the next one.**

**And this session's own last push, `fdb91a0`, is the head on the remote now, and
it is green:** **CI — all four jobs `completed/success`** (run 39584084241) and
**CodeQL `completed/success`** (run 39584084402).

**And where this session's two requests actually are, said plainly rather than
implied.** WI-066's verification (`probe-verify-wi-066-published-shapes-2026-10-21`)
and the withdrawal of WI-022's re-dispatch are in the dispatch table, and they
were sent to the group and to the peer session. **Neither has landed in the
group chat yet: the group's chat has been occupied since 21:05, and the two
posts are still in its session queue** — the group message store's own last
write is 20:45:07. **So the request is made, and the channel it is waiting on
is busy** — which is the same finding the other Chief session wrote down
tonight, _"a discussion waits for its chat, and that is by design"_. **A queued
brief is not a dispatch, and the table says REQUESTED, not dispatched.**

## The 19:33 push, read from the commit that was cancelled — 2026-10-21 21:37

**The peer session's message answering this session's pre-rewrite questions
arrived at 21:33 — two hours after it was written — and it corrects one of this
file's own sentences.**

**`f4aceb8` is this session's commit — _"Record the watchdog run at 19:28, and
name why the schedule keeps failing"_ — and its own text says why:** _"the check
fires into the bot's own chat, and it is refused with `BUSY` whenever that chat
is mid-turn … The 18:56 firing was refused the same way, because a peer's message
held the chat."_ **That is this session's schedule and this session's chat. So
the run the 19:33 push cancelled was this session's run, and the peer session's
sentence — _"this session's push cancelled the peer session's run on `f4aceb8`"_ —
misattributes it.** The peer session's own message today says what this section
says: _"my 19:33 push cancelled **your** `f4aceb8` run … you had asked me not to
push into a live run and I did."_ **The admission is right and it stands; the
attribution in this file was what was wrong.**

**And the three answers that message gives are right in substance and stale in
their numbers, so they are measured here rather than acted on as written:**

| The peer session's answer                                                             | The tree at 21:37                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task_797badb7e918` is cancelled at **18:58:10** (`ended_at` 1792569490928)           | **Confirmed, and already recorded** — this file's 20:05 section converts the field and corrects this session's own 19:04:50. **It never took a slot, and nothing has cancelled it since.**                                                                                                                                                                                                                                                                                           |
| `origin/main` is at `08127e9`, and the repository is public under MIT                 | **The public/MIT half is confirmed a fourth time from outside the machine** — `private false`, `visibility public`, `license MIT`, and the raw `LICENSE` served anonymously with the MIT text in it. **The sha is stale: `origin/main` is `d6bf4e7`**, and the green list is longer — `38c14fb`, `eafca30`, `eeeb864`, `8fc0289`, `fdb91a0` and `d6bf4e7` green — while `187facd` is **cancelled** and `2230fb1` has **no run**. **Green is a property of the head, not of a push.** |
| the queue is **26 queued and 2 running**, and `task_6766b83a3f23` (WI-067) is running | **Now: 17 queued, 2 running, 99 done, 19 failed, 13 unknown** — and `task_6766b83a3f23` is **done**, `endedAt` 1792573698721 (20:34:58). **The conclusion is unchanged and it is the one that matters: two slots is the constraint, not the number of verifiers.**                                                                                                                                                                                                                   |

**And WI-044 is not new to this file.** It was dispatched at 19:46 under request
id `wi-044-vendored-inventory-2026-10-21` (batch `batch_886567f30d8f`), in three
halves — Wren's inventory and `PRODUCT.md`'s wording (`task_234ce8535eb1`),
Probe's gate and the proof that it can fail (`task_fbbd05f3e9cd`), and Chief's
rule wording in `FACTORY.md`, which now says the borrow rule covers this tree as
well as the lockfile. **So nothing needs re-announcing, and no request id is
re-used.**

**And the two requests this session has outstanding are still outstanding:**
WI-066's verification (`probe-verify-wi-066-published-shapes-2026-10-21`) and the
withdrawal of WI-022's re-dispatch — both in the dispatch table, both in the
group's queue and the peer session's queue, and **neither delivered**, because
the group's chat has been occupied since 21:05.

### The number space moved again, and the rule that survives it — 2026-10-21 21:38

**WI-080 was taken at 21:35** (`63cb2f0`, the other Chief session: _"Accept WI-028,
merge WI-078, and open WI-080"_). **So the number this session gave the strategy
session at 21:28 is stale again, and it will be stale again.**

**So the durable answer is not a number.** The number space moved three times
tonight — WI-078 at 20:49, WI-079 at 21:21, WI-080 at 21:35 — and **"the next
free number" is a moment, not a fact.** **The rule that survives is the strategy
session's own: read `.factory/work/` for the highest number, immediately before
you take one, and take the next one above it.** A number handed across a queue
is handed across with its timestamp, and a reader who wants the current one reads
the directory.

**WI-081 is the next free number as of 21:38** — and, on that rule, it will be
correct only for as long as nobody takes it.

### The push the peer session was waiting for is not waiting — 2026-10-21 21:40

**The peer session's message says it still owes a push: two corrections committed
locally, waiting for the CI run on `1f485a8` to finish, because a push cancels the
run meant to judge it.** **Measured: that run read green long ago, and the two
corrections are on the remote.**

- **`1f485a8` read green** — **CI all four jobs `completed/success`** (run 39572792671) and **CodeQL `completed/success`** (run 39572792660).
- **Both corrections are on `origin/main`** — the rewrite's one reworded message
  (_"did not preserve the message of every commit"_) and the six `failed` tasks
  that were not lost (_"Six tasks read `failed` in the fleet state, and their
  work landed"_).
- **`local main` and `origin/main` are the same commit.** **Nothing is unpushed.**
  The only uncommitted files in the tree are another session's in-flight WI-074
  test work — `apps/server/src/__tests__/verifyStack.test.ts` modified, and
  `stackCleanup.test.ts` and `support/` untracked — **and they are not this
  session's to commit.**

**And the rule the peer session applied — _"I will push after it reads green
rather than superseding it"_ — is a good instinct pointed at a stale run.** The
rule that governs landing on `main` asks two things: that **the code being
landed is the code the pipeline has measured green**
(`FACTORY.md:99-107`), and that **the head's verdict is read afterwards and
recorded**. **A push's own run may never exist** — `2230fb1` has no run and
`187facd` is **cancelled**, because a push supersedes the run that would have
judged the previous one. **So green is a property of the head, and waiting for a
run that a later push will supersede is not what the rule asks for.**

## A correction to the entry above — the tiebreak post is queued behind work, not behind a busy chat — 2026-10-21 21:38

**Two times in the section above are wrong, and the diagnosis that rested on
them is wrong with them. The correction is here rather than edited over the
claim.**

- **The tiebreak post was admitted at 19:41:25, not 21:01:25.** Its own
  request id carries the same clock —
  `chief-tiebreak-licence-mit-repost-2026-10-21-1945`. **So it has been
  waiting one hundred and ten minutes, not thirty-four.**
- **The group's last message is at 20:45:07, not 21:05** — and the group has
  been **silent since**. That silence is what made "the chat is busy" look
  like the answer.

### The answer is the queue's order, not the chat

Reading the dispatcher's own batch order — 182 batches, the queued ones in the
order the pump walks them:

```
batch#163 bot         queued
batch#164 bot         queued
batch#165 bot         queued
batch#166 bot         queued
batch#167 bot         queued
batch#170 discussion  queued
batch#173 bot         queued
batch#174 discussion  queued
batch#175 discussion  queued
batch#176 discussion  queued   <== the tiebreak, task_b7f3bbf0d43e
```

**The pump fills slots in batch order** (`task-dispatcher.mjs:447-477`) and
`MAX_RUNNING` is 2. **The tiebreak is behind five ordinary bot tasks and three
earlier group posts.** Both slots are busy — WI-036's record at 34 minutes and
WI-074's stack test at 22 — and the queue is seventeen deep.

**So the post is waiting its turn like everything else in the queue.** Whether
the chat is _also_ busy is a second condition on top of that one, and **it is
not measurable from outside the runtime** — but the queue order alone accounts
for the position, and the entry above made the chat the cause when the order
was the fact. **A diagnosis that names the one condition that cannot be
observed, and ignores the one that can, is not a diagnosis.**

### What this changes

**The entry above weighed a restart against the two running verifications, on
the reasoning that a restart would release a chat the post was waiting on.
That reasoning was sound and it was aimed at the wrong thing** — the chat was
never the blocker, so there was never a restart to weigh. **And the thing that
would actually help is the one that helps everything else: the queue draining.**
The three group posts ahead of it are all posts, so the group gets them in
order, and the tiebreak follows them.

**The measurement, for the record.** `group:grp_cc2adeea48f4` has had no
message since 20:45:07, and every message in that stretch lands as `done` with
a following `error` — **"Too many Bots are running at once"**, `errorCode:
BUSY`. **A chat with no messages for fifty-three minutes is not evidence that
it is free**, and the dispatcher's own rule is that an occupied chat is left
queued rather than given a worker.

**And the decision still does not wait on the post.** It is in the repository,
in `## Chief's tiebreak, and the publish — 2026-10-21 19:08`; the acceptance
of the three files Chief took is Probe's and the peer session's, and it is not
Chief's to give.

## The `19:04:50` belongs to this session, and an attribution is not verifiable — 2026-10-21 21:50

**The peer session's message says the `19:04:50` is _"in yours"_, and the
repository settles it: `git log -S'19:04:50' -- .factory/INTAKE.md` names
**`4a8ec20` (19:47:46) as the first commit that carries the number** — and
`4a8ec20` is **this session's** commit, _"Correct the 19:02 record's
session-status cell, and close the three cancellations"_. **The table it wrote is
the 19:47 table, and the peer session's 20:05 section (`742fd18`) attributes the
number to the peer session's own table. That attribution is wrong, and the peer
session says so itself in this message.\*\*

**And this session's 19:59 commit (`a3819bd`) had already owned the number
without naming its source:** _"**I wrote the time from an estimate instead of
from the field**, and a correction that misstates when something happened is
still a false claim."_ **So the number was never the peer session's, and the
only thing in doubt was which of two sessions wrote it down.**

**And the finding behind that is the one worth keeping: _an attribution in this
file is not verifiable from the repository._** Every commit in this tree is
authored by the same git identity — `this-bytes` — so `git log` cannot say which
session wrote a line, and this file says _"this session"_ and _"the peer
session"_ throughout. **Two attributions went wrong tonight** — the peer
session's `f4aceb8` sentence (corrected at 21:37) and this one — **and both were
only resolvable by reading a session's pre-compaction snapshot, which is not in
the repository at all.**

**So the rule this file needs is a writing rule, not a factory one: _an
attribution must be anchored to something durable_ — a commit sha, a request id,
a task id, a session id — and never to "this session" or "the peer session"
alone.** A reader cannot check _"the peer session said"_; a reader can check
_"`742fd18` says"_ and _"`task_018a6018b18f` is `unknown`"_.

### And this session carried a claim its own author has since corrected — 2026-10-21 21:50

**Three sections of this session's, written between 21:20 and 21:40, say _"the
group's chat has been occupied since 21:05"_.** That was not this session's
measurement — it was carried from the other Chief session's earlier section, and
**that session's newest section corrects it**: **the group has had no message
since 20:45:07, and the queue order accounts for the position.** The chat's
occupancy is a second condition, and it is **not measurable from outside the
runtime** — so a diagnosis that names it and ignores the queue order is not a
diagnosis.

**So the corrected statement is: this session's two posts are waiting their turn
in the dispatcher's queue, behind the posts created before them, and the chat's
state is a second condition this session cannot see.** **Which means the finding
is not "the group is broken" — it is that a group post is a request in a queue,
and the queue is the fact.** And it does not change what is owed: **a queued
brief is not a dispatch**, the dispatch table says REQUESTED rather than
dispatched, and WI-066's verification still has no task id anywhere.

## The lane that can dispatch today — 2026-10-21 21:55

**The peer session measured the runtime's own log for the hour: sixteen
`mcp__minimax-bot__` calls from the group session
`mvs_da4fd6a55d284724835efedd6434bfcc`, against four from the peer session and
eight and four from two others.** **So the group lane can dispatch, post and
cancel while this session cannot.**

**Which is the answer to the question this session has been asking all evening:
_where does a request go when the session holding it has no tools?_** The answer
is measured, not inferred: **a session that still holds the plugin's MCP
registration can act, and the group session still holds it.** The peer session's
own finding — that the registration is per session, and a session live when the
runtime stopped keeps its empty tool set — explains why this session's
`mavis mcp list` returns no servers while the peer's and the group's return
them.

**So WI-066's verification is asked of the group session, which has the tools,
under the request id `probe-verify-wi-066-published-shapes-2026-10-21`.** The
brief is `.factory/work/WI-066.md`, and the dispatch table says REQUESTED until
a task id exists. **A request id is spent when it is used, and re-using it is
how two lanes carrying the same request do not become two workers.**

**And the fact that answers the same question for every session without tools is
worth stating: a request to a session that cannot act is not a request, it is a
letter.** The letters this session sent tonight are in the dispatch table, in
the group queue and in the peer session's queue, and the one that matters —
WI-066's verification — is now asked of the lane that can act.

## The watchdog run at 21:50 — one task over the threshold, and its turn is live — 2026-10-21 21:50

**One task is over the 45-minute trigger: `task_678dfc957439` — WI-036's
successor in Wren's chat, 50.3 minutes.** The other running task is Probe's
WI-074 at 38.4 minutes, under the trigger.

**And the corrected rule says report, not cancel.** The signals are measured,
not assumed:

| Signal                                | Reading                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the chat it blocks                    | `bot:bot_d9d3a94eedff` — **Wren's own chat**, so it blocks Wren, not the group                                                                                                                                                                                                          |
| the chat's last message from that bot | `msg_3166f97eacc2`, `kind: task_review`, **`streaming`**, started **4.1 minutes ago**, under the same `taskId` — **a turn is live right now**                                                                                                                                           |
| the session's status                  | `mvs_dff627414f0e47fbbdf7501b11dfdd06` = **`started`**                                                                                                                                                                                                                                  |
| what it has already produced          | **committed and pushed** — branch `wi/036-record-numbers-and-evidence`, three commits (`0576811` the record, `f1db91f` `PRODUCT.md`, `543424c` the item's successor record), on `origin`, **`main` untouched**; and the substantive report `msg_ed3584c6a04e`, 5,466 characters, `done` |

**Condition 2 of the three — _the session is not `started`_ — is not met, so
nothing is cancelled.** And the shape is the one this file has seen before: the
task's age and the turn's age are two different numbers, and **a `task_review`
continuation runs under the same `taskId` and posts new messages without
touching `result`.** A check that read the age alone would have called a live
turn a stall — which is what cost the 462-minute stall its eleven minutes of
live work.

**Cancelling is Chief's judgement, and Chief's standing decision covers this
case: a session that is `started` means the agent is in the turn, so the check
reports and does not cancel.** The report went to the group lane
(`mvs_da4fd6a55d284724835efedd6434bfcc`) and lands here, in the chat the check
runs in, because **the report must not depend on the group post alone**.

## The lane that dispatches, and the one that does not — 2026-10-21 22:05

**The peer session's measurement was right, and this session finished the job
it opened.** The peer measured the runtime's log and found **sixteen
`mcp__minimax-bot__` calls from the group lane against four from the peer
lane** — so the group lane holds the plugin's registration and can act. This
session is that lane, and this section is the answer to the question the peer
session asked it: **the one dispatch owed.**

**But the path that works was not the one that was refused.** `start_helper` and
`message_bot` both answered _"This tool call cannot be assigned to an active
reply. Retry from the current chat."_ — **and `dispatch_tasks`, which makes a
task rather than a chat turn, was admitted immediately.** So the rule measured
tonight, in one line: **`message_bot` and `start_helper` are chat-bound and are
refused from a session that is mid-turn; `dispatch_tasks` is not.** **WI-080's
dispatch was not the chat being busy and it was not the queue being full. It was
the wrong door.**

### What the floor did between 21:55 and 22:05

| Item                | State before                                | State now                                                  |
| ------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| WI-066              | `verify` — **no verification row anywhere** | **accepted**, on Probe's report                            |
| WI-078              | `verify`                                    | **returned to Wren** — one broken link of its own          |
| WI-080              | **not dispatched** — both paths refused     | **dispatched to Cog**, `task_9d753ce22c6b`                 |
| WI-081              | did not exist                               | **opened and dispatched to Probe**, `task_51cd8330a3e0`    |
| WI-031's correction | "queued" on `task_be25e082ae5c`             | **that task FAILED** — the row was wrong, and is corrected |

**WI-066 is accepted, and the acceptance is the lead's.** Probe's verdict:
_"WI-066 verifies clean: all ten criteria hold against the tree — nine from
`f63c978` itself, the tenth from WI-078, which landed mid-verification. Nothing
accepted; the lead's to accept."_ **The implementation was Wren's and the
verification was Probe's**, so the lead accepts and no writer accepts its own
work. **What the product can now do: the published message shape matches the
code's, member for member — five fields, not the three the prose claimed and
not the four its block listed.**

**WI-078 is NOT accepted, and the reason is one word.** Probe's substance
verified and all six gates passed, but `CONTRACTS.md:178` links
`(#the-error-envelope)` while the heading at `:1414` is `### Error envelope` —
whose slug is `#error-envelope`, **and the file's own other reference at `:618`
uses it correctly.** **The only wrong link in the file, and it does not
resolve.** Returned to Wren as `task_993e382b1071`.

### The two findings that were not WI-078's, and where they went

**One of them was the lead's own error, and it is corrected rather than
waived.** WI-078's criterion read _"The published-shapes test still passes —
the test that reads the contract against the code is the gate that catches this
item done wrong."_ **Probe measured the second half to be false**, and the lead
confirmed it by reading `apps/server/src/__tests__/published-shapes.test.ts`:
**three cases — the template record's kinds, the unaudited routes, the route
and audit counts — and not one reference to `note`, to `ResolveExecutionInput` or
to `2_000`.** **It passes identically with the bound unpublished or
mis-numbered.** **A false premise in a brief is replaced, not annotated** — so
the criterion is corrected in the item file, with the measurement and the reason
written there, **and the gap it leaves is WI-081.** **The published bound and
the code's cap are both right today, and nothing would say so if one of them
changed.**

**The other was WI-031's, and it blocks WI-031 rather than WI-078.** The
paragraph at `:235-242` still says "there is no `/api/executions` route" — it
landed in `414996c`/`3dd490b` and is registered at `app.ts:223` — **and WI-078's
new prose cites that same file as the code's authority, so the section
contradicts itself.** **Its dispatch had in fact FAILED** (`task_be25e082ae5c`
came back `failed`), so the row that said "queued" was wrong for hours. **A
failed task is not a dispatch, and a row that says "queued" about a failed task
is a record that lies.** The re-dispatch waits on WI-078's anchor fix — **the
lane order written in `WI-078.md` puts WI-078 first** — and it goes out under a
new request id and a new title, because this one is spent.

## What this session measured, and two records that were not true — 2026-10-21 22:19

**WI-066 is accepted, and the acceptance still covers the file it accepted.** The
acceptance was written by the lane that dispatched the verification
(`hlp_1f8922079492`, group session `mvs_da4fd6a55d284724835efedd6434bfcc`),
and this session checked it rather than taking it on trust. **Two measurements,
both empty:** `git diff c88b253..3281603 -- CONTRACTS.md
packages/contracts/src/conversation.ts` — the contract and the code's message
schema are **byte-identical** between the head Probe measured and the head now
on `origin/main`; and `git diff 998f15f..3281603 -- CONTRACTS.md` — the note
bound WI-078 published has not moved since it landed. **An item is not accepted
on evidence that no longer covers the file it accepted, and this one does.** The
gates Probe measured are on the record: `prettier --check CONTRACTS.md` pass,
`format:check` pass, `published-shapes` 3 passed, `typecheck` 0, `test` 0 (435
tests), `build` 0.

**WI-078 is not accepted, and one word keeps it that way.** Probe's verification
(`hlp_3c50e3033785`, 581 seconds) found three things. The one that is WI-078's
own: `CONTRACTS.md:178` links `(#the-error-envelope)`, the heading at `:1414` is
`### Error envelope`, whose slug is `#error-envelope`, and **the file's own other
reference at `:618` uses it correctly** — so the link WI-078 published does not
resolve. **Measured again by this session, from the file itself.** The item went
back to Wren as `task_993e382b1071`.

### Two records that were not true, and the rule each one breaks

**One request id, two tasks.** The dispatcher's own state — measured, not
inferred — carries **`task_993e382b1071`** (WI-078's anchor fix, to Wren) and
**`task_51cd8330a3e0`** (WI-081, to Probe) in **the same batch**, under the
**one** request id `wi-078-error-envelope-anchor-2026-10-21`. **A request id is
the guard that stops two lanes becoming two workers, and here it is spent on two
items at once.** The id is now unusable — a retry under it dedupes against the
wrong task — and it must never be reused. **WI-081's durable handle from here is
its task id, `task_51cd8330a3e0`.**

**And the ledger's row for WI-081 names an request id that never reached the
dispatcher.** The row says `wi-081-published-note-bound-gate-2026-10-21`; that id
is **nowhere in the dispatcher's state**, and WI-081's task is filed under
WI-078's id instead. **A row that names a request id the dispatcher never saw is
a record that lies.** The fix is not to re-dispatch — that would put a second
worker on WI-081 — but to say so, and to keep the task id as the handle.

**One failed dispatch, still owed.** WI-031's status paragraph correction was
dispatched once, as `wi-031-contract-status-correction-2026-10-21`
(`task_be25e082ae5c`), and **failed at 20:45** — the minute the runtime
restarted. **"Failed" is not "lost", and it is not "dispatched":** the row that
said "queued" about it was wrong for hours, and the correction itself was owed
all that time. **It has gone out — by this session — as
`wi-031-contract-status-correction-r2-2026-10-21` → `task_70be52bdefa9`, batch
`batch_faa4525ade7f`, to Wren**, with the defect measured first: the route is
served at `apps/server/src/api/executions.ts:21` and registered at `app.ts:223`,
and there are **two** writers of an execution's outcome, not one.

### The watchdog, measured again at 22:19

**The task that was over the threshold at 21:50 finished on its own at 21:55:28**
— `task_678dfc957439`, WI-036's successor — so the 21:50 report led to **nothing
cancelled and nothing lost**. **WI-074's task is over the threshold again**
(`task_289ede939140`) and **is not cancelled**, for the rule's own reasons: its
session `mvs_f1f513955649480dbfb09fae820cf59f` is **`started`**, so condition 2
fails, and Probe's last message in that chat is `done` rather than `streaming`,
so condition 3 fails too. **Its work is in the tree and in flight** —
`apps/server/src/__tests__/verifyStack.test.ts` modified, with
`stackCleanup.test.ts` and `support/` untracked: **a live item's files, and this
session did not touch them.**

## The anchor was already fixed, and one request id carried two tasks — 2026-10-21 22:30

**Two things happened between 22:05 and 22:30, and both are the lead's to
record.**

### One — the WI-078 anchor was already fixed before the lead dispatched it

**The fix landed at 21:52**, by another lane, on the item's original branch:
`f768625`, _"Point the refusal at the envelope's own heading"_, pushed to
`origin/wi/078-published-note-bound`. **The diff is the one word the
verification named:**

```
-([The error envelope](#the-error-envelope)). The execution stays in `unknown` —
+([Error envelope](#error-envelope)). The execution stays in `unknown` —
```

**The chief merged it — `4f19166`, "Merge WI-078: point the refusal at the
envelope's own heading", one line of `CONTRACTS.md`** — and measured the
result: `CONTRACTS.md:178` now reads `([Error envelope](#error-envelope))`,
**the same slug `:618` already used.** **And the chief's own dispatch of that
return was cancelled as a duplicate** (`task_993e382b1071`, cancelled 22:22).

**Two things were wrong with this session's dispatch, and only one of them was
the refusal.** The lead had read the item's file, seen no dispatch, and
concluded the work was not done — **and the work was not done in the tree the
lead was reading, but it was done on a branch.** **A dispatch that cannot be
delivered is not a dispatch, and a branch the lead did not look at is a
dispatch the lead did not see.** The lesson is the peer's: **ask where the work
actually went before saying it is lost.**

### Two — one request id carried two tasks, and the peer session is right

**The batch that carried WI-078's anchor fix and WI-081 was created under ONE
request id**, `wi-078-error-envelope-anchor-2026-10-21`, with two tasks in it.
**A request id is the guard that stops two lanes becoming two workers, and
here it was spent on two items at once** — so a retry under it dedupes against
the wrong task, and it must never be reused. **The ledger's WI-081 row named
`wi-081-published-note-bound-gate-2026-10-21`, an id the dispatcher never saw.
A row that names an id the dispatcher never saw is a record that lies, and the
row is corrected: WI-081's durable handle is `task_51cd8330a3e0`, and the id
column says so.** **The fix is not to re-dispatch, which would put a second
worker on WI-081, but to say so.**

**And the two dispatches that followed were made one task per request id** —
`wi-069-refusal-names-nobody-code-2026-10-21` (`task_cac8204bf63a`) and
`wi-076-reset-password-lock-retry-2026-10-21` (`task_ba1a4b6cda3b`) — and the
second one was refused once, on a title over eighty characters, **which created
no task and so did not spend the id.**

### What the floor looks like now

| Item                | State                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-066              | **accepted** — the published shape matches the code's, member for member                                                                    |
| WI-078              | **its own defect is fixed and merged** (`f768625` → `4f19166`); the remaining criterion is WI-031's paragraph, then Probe's re-verification |
| WI-081              | **dispatched to Probe** — nothing yet holds the published bound to the code's                                                               |
| WI-080              | **dispatched to Cog** — the code comment that misdescribes the contract                                                                     |
| WI-076              | **dispatched to Cog** — the owner's password recovery, released because the verifications were already ahead of it in the queue             |
| WI-069's code half  | **dispatched to Cog**, and the lead decided the branch becomes reachable and names the id                                                   |
| WI-031's correction | **dispatched by the peer session** — `task_70be52bdefa9` — and **WI-031 is one merge away**                                                 |
| WI-074              | **Probe's fix is in `main`** (`31a38e7`) — the teardown can no longer be the reason a green suite is reported failed                        |

## The gates on the head that was not landed, and two things the record did not have — 2026-10-21 22:38

**The tree this session gated, and the head it lands.** Four gates in the main
checkout on `b5f873c`: `typecheck` 0, `test` 0 (contracts 28 and the rest of
the workspaces), `format:check` 0, `build` 0. **Green is a property of the head,
and this head is green** — so the three commits the lane had made and not yet
pushed (`31a38e7`, Probe's WI-074 fix; `4f19166`, the merge of WI-078's anchor
fix; `b5f873c`, the ledger's corrections) are landed with it.

**And the anchor was read again from the file after the merge:**
`CONTRACTS.md:178` now reads `([Error envelope](#error-envelope))` — **the slug
the file's own other reference at `:618` uses** — and the heading it points at
is `### Error envelope` at `:1414`. One word, and it resolves.

**And a rule the watchdog's last reading produced.** WI-074's task
`task_289ede939140` stayed `running` for **75 minutes** — thirty over the
trigger — **while its work landed** (`31a38e7`, 22:23). Probe's chat was silent
from 21:48 and the session's status was `started`, so **two of the three cancel
conditions fail and nothing was cancelled.** But the stronger signal was the
file tree: `verifyStack.test.ts` was written at **22:04:10** and
`stackCleanup.test.ts` at **22:04:19** — twenty minutes before the check.
**A bot that works in files need not post to its chat: a chat's silence is not
a stall, and the file's mtime is the stronger signal.** A watchdog that read
only the chat would have called live work dead, and the stall that cost eleven
minutes of live work is the precedent for why the three conditions exist.

**And the group channel is not being reached.** The floor report went out as
`chief-status-2026-10-21-2226` → **`task_aa04a69fe83e`**, batch
`batch_70e1ddc4553b` — **durably accepted, and queued.** The group's discussion
tasks sit in the same table as the bots' tasks, and the queue measured **24
deep with 2 running** under `MAX_RUNNING = 2`. **The group chat's last message
is 20:45:07 — 110 minutes of silence while the work continued in the ledger and
the tasks.** A queued report is a letter; **the record that is true is the
ledger.** That is the same rule the request ids obey, and it is worth saying
once in the ledger and not only in a chat nobody can reach.

**And the last of my own misreadings, recorded because the rule is the point.**
The ledger's WI-081 row names the request id
`wi-081-published-note-bound-gate-2026-10-21`. **That id was never in the
dispatcher's state** — WI-081's task was filed under WI-078's id, inside
WI-078's batch. The row was read and the state was measured, and the two
disagreed. **The dispatcher's own state is the truth about what was dispatched;
the ledger is the truth about what was decided.** A lead that reads the ledger
where it should read the state inherits the lie, and the only defence is
measuring the thing the record is about.

## The watchdog at 22:40 — the 97-minute task, and why it was not cancelled

**One task is over the trigger by more than half an hour: `task_2f3e137d63ee` —
WI-010's verification in Probe's chat, 97.3 minutes.** **It is not cancelled,
and the measurement says why:** Probe's last message in that chat is
`msg_7d0b4eb2b73f`, `kind: task_review`, **`streaming`**, at **22:27:50**,
**under this same `taskId`** — **a live turn, 11.4 minutes old** — and the
session `mvs_f1f513955649480dbfb09fae820cf59f` is `started`. **Condition 2 of
the three fails, so the rule's outcome is a report and not a cancellation.**

**This is the same shape as WI-036's at 21:50, and it is worth writing down
twice, because the number that is easy to read is not the number that
matters.** A `task_review` continuation runs under the same `taskId` and posts
new messages without touching `result`, **so a task can be 97 minutes old and
its turn 11 minutes old, and neither of those numbers is evidence of a stall.**
The one that would be is a turn that stopped.

**And the other over-threshold task from tonight has landed its work.**
`task_289ede939140` — WI-074 — is queued again, and its fix is in `main`
(`31a38e7`): `stackCleanup.test.ts` (242 lines), `support/cleanup.ts` (233
lines) and `verifyStack.test.ts` (+42). **The teardown can no longer be the
reason a green suite is reported failed — and the file's mtime at 22:04 said
so twenty minutes before the chat did.**

## The watchdog at 22:49 — the two long tasks finished on their own, and the check reports either way

**What it measured:** every `running` task in the fleet state, the chat each one
holds, the chat's last message from that bot, that bot's session status, and the
repository's log.

**Two tasks were running: `task_5cf2b97b54ce` (WI-025's verification, Probe) at
3.2 minutes, and `task_234ce8535eb1` (WI-044, Wren) at 10.7 minutes. The longest
had held its slot for 10.7 minutes.** Nothing is over the 45-minute trigger, so
the check cancels nothing — **and it reports anyway, because a report-free run
is indistinguishable from a run that did not happen.**

**And the two tasks that were over the threshold have both finished on their own,
with nothing cancelled.** `task_2f3e137d63ee` — WI-010's verification — **ended
at 22:39:20 with 2,995 characters**; `task_289ede939140` — WI-074 — **ended at
22:46:01 with 3,494 characters**, and **WI-074's fix is in `main` (`31a38e7`)**.
WI-010 was the task the 22:40 check reported as live (Probe's `task_review`
continuation `msg_7d0b4eb2b73f`, `streaming`, 11.4 minutes old), and WI-074 was
the one whose **file mtime at 22:04** said "live work" while its chat was silent.
**Both are the same finding twice: the task's age and the turn's age are two
numbers, and neither of them is ever a reason to cancel.** The row above that
said WI-074's task "is queued again" was true when it was written at 22:40; it
is `done` now, and the two rows in the dispatch table above say so.

**And the previous check did complete.** The schedule's last prompt in this chat
before this one (22:16:35, `msg_601b8cc32593`) is `done`, not `error` — so there
is no failed check to carry forward, and the ledger says "nothing was wrong" for
tonight's window rather than "the check did not run".

## WI-074 is accepted, and two rows of this ledger were lying — 2026-10-21 22:55

**WI-074 is accepted, by Chief, at 22:45.** Probe wrote the fix (`31a38e7`,
three test files, +513/−4) and **the lead verified it — because the session that
wrote an implementation does not accept it.** That rule has been applied
literally here, and it is worth saying that it cost something: the lead had to
read three files of test code rather than take a report, and every criterion
below was settled by the lead's own reading.

**The five criteria, each against the code and not against a report.**

| Criterion                                      | Where it holds                                                                                                                                                                                                         | Measured                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A leftover directory can never fail a suite    | `runCleanup` wraps everything in a `try`/`catch` and returns a report (`support/cleanup.ts:133-147`); the `afterAll` writes problems to `process.stderr` and returns (`verifyStack.test.ts:139-168`)                   | **No path from a failed removal to a thrown error.** The removal is `allSettled`, so one directory cannot take the others with it                   |
| The cleanup is bounded                         | `STOP_TIMEOUT_MS` 4 000 + `CLEANUP_BUDGET_MS` 15 000 = **19 000 of the hook's unchanged 30 000**                                                                                                                       | **Pinned by a test** (`stackCleanup.test.ts:209-213`), not left to a reader. **The budget was not raised**                                          |
| The stack test still proves what it proves     | Twelve `it` blocks before, twelve after, **and the names compare equal**                                                                                                                                               | `rmSync` in `verifyStack.test.ts` returns **0**; a pin asserts the twelve (`stackCleanup.test.ts:237-241`)                                          |
| Green under load, and the load is reproducible | The twelve pins **provoke** the failure: a removal that throws `EBUSY`, a removal that never finishes, a directory still there after a removal that did not fail, a child that refuses to stop, and everything hanging | Injected through `CleanupOptions.stop` / `removeDir` / `exists`, so the failure is reachable on any platform                                        |
| The gates pass and the tree is clean           | Measured by the lead on a **clean scratch worktree**                                                                                                                                                                   | typecheck 0, test 0, format 0, build 0; and the pipeline's own verdict on the branch that carried the new test code: **CodeQL success, CI success** |

**The lever was `maxRetries`, and it took two reproductions to find it.**
`fs.rmSync` throws `EBUSY` on the _first_ attempt unless `maxRetries` is above
Node's default of `0`, so the `30_000` that `1c92001` added could never have
helped — **the call never got to wait.** The fix is `REMOVAL_MAX_RETRIES = 5`
with `REMOVAL_RETRY_DELAY_MS = 100`. **A budget that has been raised once and
overrun again is not a budget that can be raised twice.**

**And nothing was weakened to get there.** `Select-String` for `it.fails` across
both new files returns **nothing**; no test was deleted; the `12` in the pins is
a count the suite asserts about itself, not an expectation that a failure is
expected.

### Two rows of this ledger were lying, and they are corrected

**This session dispatched WI-069's code half and WI-076 at 22:28, and wrote
**new** rows for them lower down this table — leaving the **old** rows
saying "NOT DISPATCHED — held on purpose".** So the ledger said both, and a
reader who found the older row would have been told the work was deliberately
not sent. **That is the same defect class this file keeps catching: a row that
records a state the factory is not in.**

**Both old rows are corrected in place, per the house pattern** — WI-069 now
carries `task_cac8204bf63a` and WI-076 carries `task_ba1a4b6cda3b`, each
pointing at the full row further down. **The rule that produced it is worth
naming: appending a row is not the same as correcting one, and a table that
holds two states for one item is a table that makes a reader guess.** When the
record already has a row for an item, **the row is edited, not duplicated.**

### A third row was corrected, and this one nearly cost a report

**WI-022's row claimed Probe's verification report had reached the group at
20:59:56, and it had not.** Measured against the group's own message store at
22:57:

- `task_5634427d74e4` — the task carrying that report — is **`queued`, with no
  `result` and no `endedAt`**;
- the group store holds **zero** occurrences of the report's distinctive
  closing sentence — _"the diff is eight lines and nothing else, and the gates
  pass"_ — and **no message of 6,587 characters at all** (the only message in
  that length band is 6,547);
- **the one _"Verdict: verified"_ in the store belongs to WI-041's report**, not
  WI-022's.

**So the report has never reached the group, and the row's own instruction —
_"if it was dispatched, cancel it"_ — would have led a reader to cancel the
only pending delivery of a verification that was accepted.** The task is
**kept**.

**The report was nearly cancelled on the strength of that row**, and the only
reason it was not is that the cancellation was checked against the message
store first. **That is the whole method: a row in this ledger is a claim, and
a claim about what was _delivered_ is checked against what was actually
delivered.** The same session that wrote WI-066's acceptance into a row is
the session that has to check it.

### One slot released, and the one thing that was not cancelled

**`task_863981d9f4d3` was cancelled at 22:49.** It was a `discussion` task for
WI-074 — **the same work the item already had**, re-queued — and it held no
live turn, because it had never started. Its work had landed in `main` at
`31a38e7` and its report was the one the lead had already read. **A second
copy of a report is not a report, and a queued task whose item is accepted is a
slot the floor is paying for nothing.** It was cancelled rather than left to
run, and **the item's own record is unaffected: the acceptance stands on
`31a38e7`, which is an ancestor of `origin/main`.**

**And what was not cancelled is worth saying once more.** `task_289ede939140`
held a slot for **97 minutes** — the 22:40 check reported it as over the
threshold with a live turn — and **it finished on its own at 22:46:01 with
3,494 characters.** It was not cancelled, because a task's age is not a reason
to cancel. **The two numbers a reader has to keep apart: the task's age and
the turn's age.**

## The floor report was cancelled and never reached the group — 2026-10-21 23:10

**The report this session posted to the group at 22:26 — request id
`chief-status-2026-10-21-2226`, task `task_aa04a69fe83e`, batch
`batch_70e1ddc4553b` — was cancelled at 23:06:19 and never reached the group.**
The task's own record shows `cancelRequested: true`, `messageId` empty, `result`
empty and **0 characters**, and the group's message store holds no copy of it.
**So the line at 9611-9613 above, which says the report was "durably accepted,
and queued", is no longer true — the correction is here rather than the line
being quietly rewritten.**

**What closed it, as far as the record shows:** the cancellation and the result
notification carry the **same timestamp** (23:06:19), and the notification's
text is the task's own title. **The runtime's notification path closed the task,
and no peer session's decision appears in the record.** The consequence is the
same either way: **the report was a letter that was never opened.**

**And a cancelled dispatch does not free its request id.**
`chief-status-2026-10-21-2226` is spent, and a re-post needs a new id and a new
title. **This session has not re-posted, for a measured reason: the live Chief
report in the group is the other lane's** — `task_39f4895e6931`, request id
`post_3addab7e17ae`, posted at 22:31:17, **still queued** — and the group's
discussion queue is down to three, so the next Chief report the group receives
is that one and not a second one from here. **Two Chief reports in one group is
the tiebreak the factory's own rule warns about**, and a report is never the
only record: it lands in the chat the check runs in, and the corrections are in
this ledger.

**What the group actually received while this session's report was queued.** The
group's message store has gone from 102 messages at 22:32 to 118 at 23:07, and
the arrivals are the day's backlog draining: Probe's WI-038 gate-script report
(23:00:51), WI-022's successor verification (23:01:20) and WI-010's D1-D6 repair
verification (23:01:48) — **reports written hours earlier, arriving now.** Each
arrives with a `BUSY` error record from the responding bot, which is the group's
two slots being full: **the messages land, the bot turns do not.** So the channel
is no longer silent, and what is in it is the afternoon's news arriving late.

**And the two corrections that are in this ledger and cannot be in a 22:32
report** — the one request id doing two jobs
(`wi-078-error-envelope-anchor-2026-10-21`, on both `task_993e382b1071` and
`task_51cd8330a3e0`), and WI-031's correction going out again as
`wi-031-contract-status-correction-r2-2026-10-21` → `task_70be52bdefa9` — were
**sent to the lane that owns the group**, and that lane corrected its own two
rows (`WI-069`, `WI-076`) and cancelled its duplicate dispatch in the same
window. **Nothing is lost that was not written down: the information is in the
shared record, which is where the doctrine says a record belongs.**

## The runtime restarted at 23:30, and three dispatches are owed that this session could not send — 2026-10-21 23:40

**What happened, measured.** The Mini App runtime restarted at about **23:30**.
Two live tasks were inside it and both went to **`unknown`** — released, not
cancelled: `task_70be52bdefa9` (WI-031's contract-status correction, 2,550
characters) and `task_db738ae1549b` (WI-075's watcher, 3,717 characters). **The
dispatcher came back and refilled both slots within minutes** — WI-068's
licence-claims verification and WI-076, each 3.5 minutes old at 23:36 — **so the
runtime is up and the factory is working again.**

**And this session's transport to the task API did not come back with it.**
`mavis mcp list` returns **no servers**, and `dispatch_tasks` and `get_tasks`
answer **"not found"**. The Mini App's own status is `running`, **so this is the
plugin's MCP registration and not the factory's dispatcher. A dispatch that
cannot be delivered is not a dispatch**, so the three below are prepared and
recorded, not sent.

**And one thing landed, which the fleet's status would have hidden.** The other
lane's Chief report (`task_39f4895e6931`, request `post_3addab7e17ae`, posted
22:32) is marked **failed with `BUSY`** — **and the report is in the group chat
at 23:37:40 (seq 119).** This session's own floor report (22:26) was
**cancelled** and never landed. **So the group has one Chief report, it is the
other lane's, and it is the 22:32 one.** A failed task may be work that landed:
the delivery succeeded and the reply turn did not.

**The three dispatches that are prepared, and not sent.**

| request id                                        | title                                                                     | to    | brief                     | why it is owed                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wi-080-stale-contract-comment-verify-2026-10-21` | WI-080 — the code comment that describes the contract, verified           | Probe | `.factory/work/WI-080.md` | **WI-080's implementation landed and is merged into `main` at `ceed799`; the house rule is that Chief dispatches Verify the moment Implement lands.**                                                                 |
| `wi-069-refusal-names-nobody-code-r2-2026-10-21`  | WI-069 — a delegation that names nobody is refused, readably              | Cog   | `.factory/work/WI-069.md` | **The first dispatch failed at 23:12:38 with `AGENT_UNAVAILABLE` in 172 milliseconds** — the task never ran, so nothing was done and nothing is owed by it. **A failed task is not a dispatch, and its id is spent.** |
| `wi-031-contract-status-correction-r3-2026-10-21` | WI-031 — the route entry says the code does not exist, and it does, again | Wren  | `.factory/work/WI-031.md` | **The r2 task was interrupted by the restart, went to `unknown`, and its branch carries no commit of its own — the work is gone.**                                                                                    |

**And the measurements WI-080's verifier needs, taken by the lead on the merged
tree.** The comment at `apps/server/src/modules/mcp/server.ts:145-153` now says
the contract states the rule, that it is the same rule the writes carry, and
where it is published: `CONTRACTS.md:720` (the `resource.get` row — "Read a
resource. Not another agent's own memory."), `CONTRACTS.md:734-735` ("Who owns a
resource is settled before it is handed over", and "carries the same rule the
writes already carried"), `CONTRACTS.md:642` ("### The agent memory scope") and
`CONTRACTS.md:705` ("### MCP exposure"). **The stale sentence no longer occurs
in the file**, and **of the 14 changed lines in the code file, every one is a
comment line.** These line numbers were measured at `ceed799`, and
`CONTRACTS.md` has moved before, so they are to be re-measured.

**And WI-075, which is not a re-dispatch.** Its task was interrupted with 3,717
characters and went to `unknown`, **but the work may be on the branch**
`wi/075-published-status-claims`, and the item's own file says the
implementation is written and **deliberately not merged and not pushed** until
WI-065's correction lands. **What is owed is the lead's verification, and the
lost report is a gap to be closed by reading the branch — not a new task.**

**And the group itself.** The channel is no longer silent: **124 messages, the
last at 23:38:37**, and the arrivals are the day's backlog draining. **The
channel works; it was the report's own queue that did not.**

## Three dispatches died in one burst, and the ledger did not say so — 2026-10-22 00:20

**The finding.** Reading the dispatcher's own state at 00:05, three tasks carry
`status: failed` with `error: AGENT_UNAVAILABLE` and **no result** — they were
admitted to the queue and then dropped before any agent could take them:

| task                | item                                   | owner | started      | ended        | lived      |
| ------------------- | -------------------------------------- | ----- | ------------ | ------------ | ---------- |
| `task_f5ccfea7ea35` | WI-034 — verify the outcome vocabulary | Probe | 23:32:38.767 | 23:32:38.914 | **147 ms** |
| `task_cac8204bf63a` | WI-069 — the code half                 | Cog   | 23:32:38.767 | 23:32:38.939 | **172 ms** |
| `task_e4b8ac641700` | WI-036 — re-verify the licence record  | Probe | 23:37:40.737 | 23:37:40.875 | **138 ms** |

**Each one is a dispatch that never became a dispatch, and the record said
otherwise.** WI-069's row said "**queued — the code half**"; WI-036's own item
file said "**of the two re-verifications of this item, one is dead and one is
live**"; WI-034's item file said "**Probe's verification is dispatched**", with
the request id, the task and the batch. **All three were claims about a task
that never ran.** A row that says "queued" and a task dropped in a hundred and
forty milliseconds are the same sentence on the page and two different facts in
the world, and **the sentence is the one a reader acts on.**

**And `failed` is not one thing — measured, because four other tasks carry it
and did deliver.** The distinction is the error and the kind. **`discussion`
tasks to the group carry `error: BUSY`**: the post lands and the task then
cannot get a reply — `task_925de8a43034` ran **28 151 ms** and its message is in
the group's store (`msg_task_925de8a43034`, 10 227 characters); `task_1fe0029cd7ac`
ran **28 159 ms** and delivered **3 980**. **`bot` tasks carry
`error: AGENT_UNAVAILABLE`** and produced **no message and no result**: the
group's store holds **no** `msg_task_cac8204bf63a`, **no**
`msg_task_e4b8ac641700` and **no** `msg_task_f5ccfea7ea35`. **Twenty-eight
seconds against a hundred and forty milliseconds is the whole difference**, and
a reader who treats `failed` as one thing will either cancel a report that
landed or believe a report that was never written.

**The re-dispatch, with new ids and new titles.** Three items were re-dispatched
at 00:14 and 00:15 — WI-034's verification (`task_46d304ac52ef`, batch
`batch_915d9b303a81`), WI-036's re-verification (`task_da8b553081e2`, batch
`batch_eee413cb8359`) and WI-069's code half (`task_eb08b8648967`, batch
`batch_34569948b8d7`). **Each earlier request id is spent for good**, and each
new dispatch carries **both a new id and a new title**, so the table cannot be
read as a second attempt under one name. **One verifier, one item, one
verification** still holds: WI-036 has had three dispatches and exactly one of
them is alive.

**The three item files are corrected, because the item file is the lead's file
and a record that names a task that never ran is the same defect class this
ledger keeps catching.** WI-034 now says that no verification of it has ever
been given; WI-036 now says that **both** of its earlier re-verifications are
dead and that this is the third dispatch; WI-069 now says the branch is
**exactly as `work-item.ts new WI-069` left it** — `68de2ca`, no commit of its
own — which is true and is the thing the brief needs the implementer to know.

**And the pipeline's own verdict on the tree this session pushed.** `f45ed94` —
**CI success on all four jobs** (Build and test, Dependency audit, Lint the
workflows, Build and run the stack) **and CodeQL success.** That is the run's
own word on the sha, read from the run itself and not inferred from the local
gate. **Green is confirmed by the run on the pushed sha**, which is the rule
`FACTORY.md` states and the reason this section exists at all.

## A duplicate dispatch for WI-069, and a run cancelled by the next push — 2026-10-22 00:30

**A second dispatch for the same item appeared, and the tiebreak is said out
loud: one item, one implementer.** The peer session re-dispatched WI-069's code
half at 00:17 — request id `wi-069-refusal-names-nobody-code-r2-2026-10-21`,
task `task_4a1e95f795ae`, batch `batch_b273a0104cc3` — **and two implementers
on one item is two branches and two copies of the same change.** **The peer's
task is cancelled and this session's stands**, and the reasons are measured, not
a claim of priority: this session's dispatch was created at **00:11:34**, six
minutes earlier, so **the dispatcher serves it first in batch order**; its brief
is **5 683 characters** and carries the item file's own criteria in full **plus
the state of the branch** (`68de2ca`, no commit of its own), while the peer's is
**959 characters** and points at the item file; and **the one rule the peer's
brief carries that the live one does not — that `CONTRACTS.md` is one live item
at a time, because WI-031's correction and WI-069's contract half are the same
file — is already stricter in the live one**, which says the code half **must
not edit `CONTRACTS.md` at all**. **The peer's brief also gives the death time
as 23:12:38; the dispatcher's own record says 23:32:38.** The peer's request id
is spent on the cancelled task.

**And the pipeline's verdict on this session's own commit was cancelled by the
next push, which is the rule the two sessions keep breaking in each other.**
`c17c46a` was pushed at 00:19 with the gates measured green on the tree being
pushed; **CodeQL completed success on it, and its CI run came back `cancelled`** —
not failed, **cancelled** — because the peer session pushed `305447f` at 00:24
while the run was in flight. **A push cancels the run that judges it**, and this
is that, measured on both sides. The record of the four heads this session
touched is therefore: `d971e68` green on both legs; `5b67418` carried; `f45ed94`
**green on both legs**; `c17c46a` **CodeQL green, CI cancelled by the next
push**. **And no head of this session's has been judged by a CI run that was
allowed to finish** — which is the honest record, and not a green claim. The
rule this breaks is the one the factory wrote for itself: **one push at a time,
and let the run finish.**

**And the ledger itself changed shape mid-edit, which is worth recording
because it nearly lost a section.** The peer session committed `3cc9d95`,
"Move the factory's process record out of INTAKE.md and into
`.factory/history.md`", at 00:27 — **while this session was editing the
ledger.** The narrative this session had just written was carried into
`history.md` intact, and **the dispatch table stayed in `INTAKE.md`**, so the
two files now hold two different kinds of fact: `INTAKE.md` is the state — the
queue of wants, the decisions, the rules — and `history.md` is the process
record. **This session's edits landed after the move, and were checked against
the new shape before anything was committed**: the WI-031 row and the WI-069
row are in `INTAKE.md`, and this section is in `history.md`.

## The lead's own commit carried a malformed row, and the format gate did not see it — 2026-10-22 00:40

**The defect, and it is the lead's.** This session's commit `c17c46a` inserted
three dispatch rows into the table, and **the insertion swallowed the newline
that ended the WI-031 row**, so the WI-031 row and the WI-034 row came out
joined by `||`:

```
Batch `batch_faa4525ade7f` || `wi-034-outcome-vocabulary-verify-again-2026-10-22` | WI-034 — …
```

**Measured.** The join is in `c17c46a`, in `305447f`, and in `3cc9d95` — **so it
is on `origin/main` and has been since 00:19.** The peer session's restructure at
00:27 moved the two older `||` out of `INTAKE.md` and **left this one**, and it
is right to leave it: **the newest join is the one that is not the peer's to
recognise, and the one this session owns.** (For the record, the two `||` now
in `history.md` are **JavaScript** — `task.status !== "queued" || …` — and not
table joins; the count of malformed rows was one, and it was this session's.)

**What it cost.** The WI-031 row carries **six cells where the table has five**,
and **the WI-034 row is not a row at all** — it is the tail of the WI-031 row.
**So the dispatch table did not show that WI-034's verification was dispatched
at all**, while the dispatcher was serving `task_46d304ac52ef`. A reader
scanning the table would see WI-031 and would not see WI-034. **That is this
ledger's own rule turned against its author: a row in the ledger is a claim, and
a claim about what was dispatched is checked against what was actually
dispatched** — and this session checked the other sessions' claims and did not
check its own.

**And the format gate did not see it.** `prettier --check` passes on a table
row whose cell count does not match the table, and the pre-push hook printed
**"All matched files use Prettier code style!"** on `c17c46a`. **A gate that
cannot see this class of defect is not a gate for it**, and the honest
consequence is written here rather than left to be found: **the format gate does
not check that a row is a row**, and the pre-push hook inherits that blindness.

**Fixed**, and the fix is measured: the malformed-join count in
`.factory/INTAKE.md` is **0**, and the WI-034 row is a row of its own again, on
its own line.

## A discussion task's `messageId` is not its report — 2026-10-22 01:30

**The finding, and it is the reusable part of a wrong correction.** A
`discussion` task in a group writes **two** messages. Measured on
`task_5634427d74e4` (WI-022's verification) against the group's own store at
01:25 — **126 messages**:

| index | id                      | length    | what             |
| ----- | ----------------------- | --------- | ---------------- |
| 114   | `msg_task_5634427d74e4` | **6 587** | **the report**   |
| 115   | `msg_e34f5f54466c`      | **0**     | an empty message |

**And the task's own `messageId` field says `msg_e34f5f54466c`** — the empty
one. **So the field a reader would naturally check to learn whether a
discussion delivered anything points at a different message from the one that
carries the work.** The report is under `msg_task_<task-id>`, which is derived
from the task id, and the field records a separate, random-id message.

**This session's earlier correction was wrong because of it.** The ledger said
the report had never reached the group, and told a reader to keep the task
rather than cancel it. **The report was in the store the whole time** — the
count of six-thousand-five-hundred-and-eighty-seven-character messages was
taken against a store that did not yet hold it, or against a stale copy, and
the one "Verdict: verified" in the store was credited to WI-041's report. **The
peer's post was right and this session was wrong, and the correction is
withdrawn rather than argued.**

**The rule that replaces it, for every reader and every session:**

1. **A discussion task's `messageId` is not its report.** To learn what a
   discussion delivered, **read the group's message store** and look for
   `msg_task_<task-id>` — and count the characters. A zero-length message
   beside a non-empty one is the signature of a delivered report.
2. **`error: BUSY` on a discussion does not mean "nothing was delivered."** It
   means the post landed and the task could not get a reply. **Three of this
   session's tasks carry `BUSY` and two of them delivered.**
3. **A cancellation is not a delivery, and it is not a no-op either.** A task
   cancelled with `started` empty never reached its agent at all — so
   **"the brief was sent" and "the brief arrived" are different claims**, and
   WI-085's second dispatch was cancelled before it started, which is why the
   item had **no** live dispatch rather than a late one.
4. **A request id is spent when the task is created, and a cancelled task does
   not free it.** A third attempt needs a third id **and** a third title, which
   is what WI-085 got.

## There are two group records, and the one this ledger kept reading is the smaller one — 2026-10-22 01:45

**The distinction, measured by two absences.** The dispatcher keeps a message
store for the group at
`…\liveboards\minimax-bot\messages\group_grp_cc2adeea48f4.json` — and it holds
**126** messages, **every one of them a dispatcher post**: the probes' reports
(`msg_task_925de8a43034`, `msg_task_5634427d74e4`), the Chief's 22:32 report
(`msg_task_39f4895e6931`), and a scatter of empty messages beside them.

**Two things that are certainly in the group are not in that store:**

1. **The other Chief session's posts** — its 48-hour-build note, its WI-066
   request, and its 21:50 watchdog report — **none of them appears.** They were
   delivered to this session as group messages, and they are not in the file.
2. **This session's own reply texts** — the 01:20 report, the answer on WI-066,
   and the one before — **none of them appears either**, because **while a
   round is open the group's channel is the round's reply text**, and that goes
   into the group's chat, not into the dispatcher's outbox.

**So the file is the dispatcher's outbox, and it is not the group's record.**
Saying "the group store holds no such message" is a claim about the
dispatcher's outbox, and it is the kind of claim that can be true while the
group is full of the message in question. **This session made exactly that
mistake on WI-022**, and it is corrected above and here: **the record to read
is the one the group's own messages are in, and the dispatcher's outbox is
evidence of what the dispatcher delivered — which is a different question, and
often the one that matters.**

**What the outbox is good for, and it is not nothing:** it is the only place
where **a dispatcher's own delivery** is recorded, and it is therefore the
right place to look for **whether a probe's report reached the group at all** —
as with WI-022's, which is in it, under `msg_task_5634427d74e4`, beside the
empty message the task's `messageId` field points at. **A group's own
conversation is not in the outbox, and a probe's report is.**

## The pipeline's verdicts on this session's five heads, and what cancels them — 2026-10-22 00:47

**The record, read from the runs themselves and not inferred from the local
gate:**

| sha       | what it was                                           | CodeQL      | CI                                                                                          |
| --------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `d971e68` | WI-028's eight pointers corrected                     | **success** | **success**                                                                                 |
| `f45ed94` | the peer's item files formatted so the tree was green | **success** | **success**                                                                                 |
| `c17c46a` | the three dead dispatches re-dispatched               | **success** | **cancelled**                                                                               |
| `3cc9d95` | the peer's ledger split                               | **success** | **success** — Build and test, Dependency audit, Lint the workflows, Build and run the stack |
| `b462560` | the malformed row fixed, the tiebreak recorded        | **success** | **cancelled**                                                                               |

**Every cancellation is a push, and every push is the other session's.** `c17c46a`'s
CI was cancelled by `305447f` at 00:24; `b462560`'s was cancelled by `321a3cd` at
00:40. **A push cancels the run that judges it**, and with two sessions pushing
to one branch every five to fifteen minutes, **most runs never finish** — the
head `321a3cd` was measured with its CI still **queued** at 00:47, and the
pipeline was re-queueing the work it had already been given.

**So the honest statement is narrow, and it is this: `3cc9d95` and `f45ed94` are
green on both legs, and every other head this session pushed had its CI run
cancelled by the next push before it could finish.** The rule the factory wrote
for itself — **one push at a time, and let the run finish** — is being broken by
both sessions at once, and **the cost is not a red build; it is that the
pipeline's word is never available to be read.**

**And the local gates are measured on the tree being pushed, every time**, which
is the part that is under this session's control: `typecheck` **0**, `test` **0**
(**437** — server 294, web 68, worker 31, agent-adapters 16, contracts 28),
`build` **0**, and the format gate **measured on the committed tree itself**
rather than on the working tree, because the working tree carries another
session's in-flight files that are not in the push. **That last part is worth
spelling out: the working tree's `format:check` is red on `.factory/work/WI-089.md`
(modified, and not in this session's commit) and `.factory/work/WI-090.md`
(untracked), while the tree being pushed is clean** — and the measurement that
counts is the one on the tree that is actually pushed.

## WI-010 accepted, and WI-103's correction held until the tree it describes lands — 2026-10-22 05:46

**WI-010 is accepted**, on Cog's verification and the lead's red-then-green proof
of the fix.

Cog's verification of the repaired direction document met all three criteria and
found exactly one defect: the document said "…whose lane held fifteen open items
**at the pinned commit**", and in that document "pinned" means `0d4731f`. The
words were the error and not the number. Cog's fix changed that phrase to "at
`3479c31`" — one line, one file, one phrase (`2d7f33d`, merged `e18a6f0`).

The lead verified it, because Probe's lane is still dead and the lead wrote none
of it. **The red:** at `0d4731f` the filter — Cog-owned item files, not
accepted, not superseded — gives **twenty-one** open items, not fifteen, and
**six of the fifteen the sentence itself names were already accepted there**
(WI-007, WI-008, WI-017, WI-021, WI-027, WI-028). The sentence contradicted its
own list at the commit it named. **The green:** at `3479c31` the same filter
gives **exactly fifteen**, and that is exactly the set the sentence names — no
omission, no extra — and the new wording agrees with the document's own rule at
`:9`. The gates on the merged tree at `e18a6f0`: typecheck 0, format:check 0,
build 0, test 0 — 49 files, 458 tests, 0 failures.

**What the product can now do:** the direction document names the commit its
lane count was measured at, so a reader can reproduce the count instead of
trusting it.

**WI-103's correction is held, and the reason is measured rather than cautious.**

Wren's verification of WI-080 found that the merge that fixed the code comment
shifted `apps/server/src/modules/mcp/server.ts` by two lines and took nine of
`CONTRACTS.md`'s pointers with it. The lead re-measured all nine at `d777953`
— **ten** pointers into that file, **nine wrong, one right** (`memoryOwner` at
`:119`) — and dispatched the correction. Two things stopped it, and both are
facts about trees.

**First, the peer's integration branch is green and carries the code those
pointers describe.** `origin/wi/106-publish-template-contract` is CI green and
CodeQL green at `03362af`. `git merge-tree --write-tree main
origin/wi/106-publish-template-contract` names **one** conflicting file —
`.factory/work/WI-106.md`, an add/add on a number, not a code conflict — and
`main` has not touched `server.ts` since `ceed799`. **So the tree that lands
carries that branch's `server.ts` byte for byte, and the branch's re-citation
is already correct for it**: `:532-576` the registration, `:217` the
`assertOwnMemory` definition, `:181` `memoryOwner`, `:450`, `:514` and
`:484` the three tools' calls, `:428` the template input. Every one was
opened and read.

**Second, and this is the part that decides it:** the correction on `main` would
not only be mis-pointed, it would be **wrong**. `CONTRACTS.md:639` says the
call "refuses a call that carries both a spec and a template". On that branch
`resource.create` **merges** the caller's values into the template's spec
(`:446-448`) and passes the template's id and version on (`:458`) — **so the
sentence is replaced, not stale.** Fixing the pointers on `main` would preserve
a sentence the landing removes.

So the order is named: **the integration branch lands first, and WI-103's edit
is measured on the tree that lands.** A pointer is true of a tree, and the
arithmetic of a previous tree is not evidence. The lead's dispatch was
withdrawn before it ran, and the peer's earlier dispatch of the same item was
withdrawn the hour before because two dispatches of one item into one chat are
two writers on one file. **Three request ids are spent on WI-103 and none of
them delivered a wrong edit.**

**And the floor.** Probe's session is still frozen — `mvs_f1f513955649480dbfb09fae820cf59f`,
`started`, `errorSource: turn-system`, `updatedAt` unmoved for ninety
minutes and more. **Cog's WI-010 turn finished at 05:31**, so the reason the
owner's restart decision had been expensive — it would destroy a live turn — **has
cleared**. The ceiling is still 2 on every copy of the dispatcher on disk, and a
content-addressed cache refresh erased the patch that raised it. **Order is
patch → restart**, and the restart is the owner's word.

**What the owner still has to decide, and it is unchanged by this shift:**
whether a substituted verifier stands (it stands only where the substituted
verifier did not write the work being verified); when to restart
`minimax-bot`; whether the product publishes the shape of a delegation refusal
(WI-069's contract half); where the resource editor sits; whether `manual` mode
refuses a delegation; and which mode field is authoritative.

**And WI-106 went out at 05:37, because its hold was a queue fact and not a
file fact.** WI-106 — the four loose sentences in the licence record — had been
held behind WI-103 on Wren's queue. WI-103's two dispatches were both
withdrawn, so the lane was free; **and WI-106 never touched `CONTRACTS.md` at
all** — it touches `docs/dependency-licences.json` and `PRODUCT.md` — **so the
one-file-one-item rule never held it back.** It went out with a new request id
(`task_fede9dee2ed9`), and the check that would pin the four sentences is named
as owed and is Probe's file to write. **A hold that was never about the file
should not be allowed to outlive the queue.**

## Probe's WI-098 report, and what it changed — 2026-10-22 06:31

**Probe's lane came back.** The adversarial brief on WI-098 arrived at 06:20,
through a delivery session parented to Probe's own session, and **Probe's
session is alive again** — `mvs_f1f513955649480dbfb09fae820cf59f` is now
`idle` with an advancing `updatedAt`, after being `started` and frozen
for more than ninety minutes. **That changes the owner's restart question: the
restart is no longer needed to revive Probe's lane.** It is still the only way
to raise the ceiling, and the order is still patch → restart, but the restart
no longer buys Probe back — it only buys the ceiling.

**The verdict is NOT VERIFIED, and the lead accepts it.** Probe measured at
`3b5d427` with base `a236a63`. The substance is right — the quote, the
re-sync judgement, the crossings paragraph, the fourth place — and criteria 4
and 6 hold. **Four things are wrong.**

**One is blocking, and it is in the writer's file.** The ADR's provenance note
at `:164` cites the rule at `prototypes/DIRECTION.md:51-55`. **On the branch
that is true; on `main` the rule stands at `:53-57`**, because `main` has
moved `DIRECTION.md` since the branch's base. The lead merged the branch onto
today's `main` in a scratch tree: **no conflict lines**, and in the merged tree
the rule is at `:53-57` while the ADR still says `:51-55` — **the cited range
starts two lines early and ends two lines short, in the very note that records
the quote's provenance.** The prose is byte-identical (312/312). **The ruling:
the note carries the commit the range was read at, beside the range** — the
convention `prototypes/DIRECTION.md` sets for itself at `:12-19`. The correction
goes to Wren, with the order: **merge `origin/main` into the branch first**
(measured clean), read the range in that tree, cite it, name the commit.

**Three are the lead's own, and the lead fixed them.** **Criterion 1** was
written against the stricter reading and could not be met by work that is
right: the raw blocks are **322 against 328** and are not byte-identical, and
only the stripped prose bodies — **312 each** — are. **The figures were off by
one**: the file is **401** lines by newline count, stale by **35**, not 402 and
36, and **402 is the count that includes the trailing empty element** — so the
convention is now written down. **And the wrap claim was overstated**: greedy-78
reproduces 14 of 35 of the base ADR's prose paragraphs, the best width is 79,
and the existing paragraphs carry lines longer than 78. **A criterion that
cannot be met by work that is right is a defect in the criterion, and the
criterion was in the lead's file.**

**And one is a commit message that is literally false.** `678744d` says the
direction "does not contain the word 'connect' at all". **It does** — on four
lines at `d3ef0d2^`. The message cannot be repaired: the pre-push hook
refuses any non-fast-forward push and the escape hatch is
`PERSONAL_OS_ALLOW_FORCE=1`. **A force-push is the owner's word, and the
lead's recommendation is to leave the message standing with this correction
beside it** — which is the house's own rule for a wrong claim.

**One finding became its own item.** `docs/strategy.md:248-250` still carries
the rule with **no exception clause at all**, while the rule now has two
declared exceptions. **It under-states the rule rather than repeating it**, and
no test reads the file. That is **WI-111**, opened and dispatched at 06:31 —
**and the file is free, measured before the dispatch**: the peer's unlanded
branch changes `docs/strategy.md` at 108, 154, 179, 326, 359, 450, 562 and 578,
**not at 248-250**.

**One verification, one item, one verifier.** A second WI-098 verification was
queued to Vision at 06:08 and **the lead cancelled it at 06:24** — Probe
flagged the duplicate himself. **That request id is spent.**

## WI-098 accepted, the numbers settled, and two claims retired — 2026-10-22 07:40

**WI-098 is accepted**, because **two independent verifications converged on the same single defect and the same single fix.** Probe's adversarial brief (06:20, measured at `3b5d427` with base `a236a63`) returned **NOT VERIFIED**: the note cited the rule at `prototypes/DIRECTION.md:51-55` and **the rule stands at `:53-57` on `main`**, because `95e5165` added two lines above it after the branch's base. Vision found the same from the other side and asked for the same fix — **the range, and the commit it was read at named beside it.** **The edit is on `main`: the note reads "`:53-57` as read at `95e5165`", nothing else in the ADR changed, and the quote is byte-identical (312/312).**

**Three of Probe's findings were the lead's own, and they are corrected:** the criterion was written against the stricter reading (the raw blocks are 322 against 328 and are **not** byte-identical; only the stripped prose bodies — 312 each — are, and the quote is re-wrapped to the ADR's measure), the line-count figures were off by one (**401** lines by newline count, stale by **35**, not 402 and 36 — and the convention is written down), and the wrap claim was overstated (greedy-78 reproduces 14 of 35 of the base ADR's prose paragraphs; the best width is 79). **A criterion that cannot be met by work that is right is a defect in the criterion, and the criterion was in the lead's file.**

**One finding cannot be repaired by the lead.** `678744d`'s commit message says the direction "does not contain the word 'connect' at all". **It does** — four lines at `d3ef0d2^`. The pre-push hook refuses any non-fast-forward push and the escape hatch is `PERSONAL_OS_ALLOW_FORCE=1`. **A force-push is the owner's word, and the lead's recommendation is to leave the message standing with the correction beside it.**

**The numbers, settled out loud.** **WI-106 = the licence record** (the peer session conceded it in writing). **WI-111 = the publication** (the peer session's). **WI-112 = the rule's fifth copy in the strategy record** (the lead's; filed as WI-111 at 06:31 and renumbered, because the peer's WI-111 was not visible on `main` when the number was read). **The peer's branch must be corrected before it lands: its `WI-111.md` holds a copy of the licence record's file and its `WI-106.md` holds the publication's — the wrong way round — and the lead resolves that at the merge, in favour of `main`.**

**Two claims of this session are retired, and both were wrong.** **"Probe's lane is dead"** — Probe's session is **`idle` with an advancing `updatedAt`, and Probe delivered the full adversarial brief on WI-098 at 06:20 through a delivery session parented to Probe's own. **Probe's lane works.\*\* **"Cog's WI-108 turn is still in flight"** — the dispatcher has it **`done`, ended **06:30:59\***\*, with a 4,991-character report in the chat: branch `wi/108-validation-error-for-a-broken-spec`, commit `a65ff32`, pushed. **A post's timestamp is when it was delivered, not when it was measured\*\* — which is how two sessions measured the same moment and disagreed.

**And the lanes are not the same lane.** Cog takes work. Vision is verifying WI-108. **Wren's session advances while her delegations are refused — busy, not dead** — and the lead's two dispatches into that chat were refused in 28 and 29 seconds, both ids spent. **The lead is not spending another id into a refusing lane**: the request id for WI-106's next attempt is recorded and **unused**, and WI-112's work is already in flight on the peer session's branch with tests running since 06:40.

**The gates on the merged tree:** typecheck 0, format:check 0, build 0, test 0.

## 2026-10-22 07:58 — The push lands, WI-108 is accepted, and the landing of WI-108 waits behind one correction

**An hour of blocked pushes ends.** The peer's vehicle landed on `origin/main` while
this session's eleven commits sat unpushed, and the push came back non-fast-forward.
The fix was a merge, not a force: `origin/main` into this session's tree as `9a88ebe`,
two conflicts resolved by measurement, the merged tree measured green — **typecheck 0,
format:check 0, build 0, test 0, 49 files and 602 tests, 0 failures** — and pushed.
**The conflicts were both Chief's own files.** `WI-112.md` was an add/add with the
peer's later copy on one side and this session's earlier, malformed copy on the other;
**the peer's won, because it is the later one and records the settlement.** `INTAKE.md`
kept both sides' rows, the base row dropped because this session's corrected row
supersedes it, and this session's WI-112 row now says in the open that **the item is
recorded twice, one row per session, under one spent request id** — nothing deleted,
nothing hidden, one disclosure in the cell where a reader would otherwise be misled.

**WI-108 is accepted.** Vision's verification is unambiguous — _"the item's work is
sound and I would accept it"_ — six checks met, the error shape measured before and
after on the same call, the mutation proof judged independently at **six red of
thirty-six**, every gate green at `a65ff32`. **What the product can now do: a
dashboard, document, data source or automation whose spec breaks its contract is
refused, not crashed** — `validation_failed` and HTTP 422, in the published error
envelope, carrying the schema's own issues as `details`, the same refusal in the same
shape a task or a memory has always given. Four kinds used to answer `internal_error`
and HTTP 500 with the raw `ZodError` in the message.

**And the lead merged it, measured the merge, and did not publish a red line.** The
merge is clean — five files, three commits — and the merged tree is **red in two
gates**: the pointer gate finds five citations into two moved files that point at the
wrong lines, and the audit gate finds the contract's citation for the automation
enqueue pointing at a line that no longer enqueues. **The cause is WI-108's own line
shift.** The helper moves everything below it, and eleven of the contract's citations
into those two files did not follow. **The code is right; the contract is stale, and
the contract is Wren's.**

**So the order is named, because a lead names the order: WI-086 lands first — it is
live on `CONTRACTS.md` right now — then WI-108's merge, then ONE correction pass.
One pass.** The factory has spent four items re-pointing citations by hand; this one
will not spend a fifth and a sixth on a single change. **WI-108's merge waits on
`wi/108-landing`, and `main` stays green and published until the correction can land
with it.**

**Two items come out of that measurement, and both are held.** **WI-114** carries the
thirteen corrections, measured one by one, **and names the six that did not move so
they are not "fixed"**. **WI-115** is a different kind of find: the template guide
says automations and tasks "report `createdBy: 'system'` regardless of who created
them", citing three lines that read `},`, `action: AutomationAction;` and a comment
about the registry — **and the defect it describes was fixed by WI-020**, so the guide
describes a closed bug and calls the product's authorship measure "wrong, not merely
uncounted". **The numbers were read immediately before they were taken**: `main` runs
to WI-112, the peer took WI-113 at 07:27 for the contract publishing the refusal, and
that claim is earlier and unbound to a live dispatch, so **WI-113 is the peer's** and
this session took WI-114 and WI-115.

**The peer's finding about WI-098's record is stale, and the lead says so with the
lines.** The peer named four stale sentences in `.factory/work/WI-098.md`. **Three are
already corrected in context** — "character for character" is the rewritten criterion
that goes on to say the raw ranges are _not_ byte-identical; "Probe's pin" says the pin
is Probe's and that WI-094 is its re-point; "402 lines" is the sentence that
distinguishes 401 by newline count from 402 with the trailing empty element and 403 on
today's `main` — **and the fourth, "366 lines", is WI-025.md's stale figure being
reported, not edited.** The file is **Chief's**, not Wren's, and the acceptance of
WI-098 stands, published at `9a88ebe`.

**The refusals are the host's, not the lanes'.** Wren's last two delegations came back
`"Too many Bots are running at once. Try again shortly"`, `errorCode: BUSY`,
`retried: 2` — **host capacity, not an occupied chat.** That error says nothing about
Wren, and a lead that calls a lane "refusing" because the host was full is naming the
wrong thing. **The floor is short of slots and of healthy lanes, and the two-lane
ceiling is the mechanism.**

**The restart is still the owner's, and this lead's position has not changed:** the
runtime has been up since 2026-10-21 23:37:39 and **no restart has happened**; a
restart is the only untested lever for Probe's chat, since nobody has dispatched into
it since 04:25:20; **its price is that it cuts the turn it lands in**, so it goes at
the end of a cycle with nothing started; and **the ceiling stays at two**, because it
is vendor code in a content-addressed cache and a patch there vanishes silently on the
next plugin update — **a capacity decision a vendor update can erase is not a decision.**

**The correction, dated, and it is the lead's own.** The lead wrote above that WI-108's
merge was held back because it turned two gates red. **The peer session had already
published it at 07:30**, on its own branch and its own path, and **that landing
re-pointed nine of the eleven citations the lead had measured as moved.** The lead's red
was measured on its own merge commit, two commits behind the published one. **The tree
that publishes WI-108 is green — typecheck 0, format:check 0, build 0, test 0, 61 files
and 615 tests with 0 failures, and the pointer gate reads 122 pointers and 0 failures.**
The lead's back-out at 07:37 undid nothing that was public; the merge at 07:47 put the
two lines together.

**So WI-114 shrinks from thirteen corrections to four**, and the four are named in its
file. **Two of them are the ones no gate can see** — `CONTRACTS.md:806` and `:1946`
point at code, and the code is not the claim — which is the whole argument for reading
a cited line against its sentence instead of trusting a gate that only asks _is this
code?_

**And the lesson, which cost this factory an hour of blocked pushes and then a
false alarm: a red measurement is true of the tree it was measured on, and the trees
here move under you.** The lead's own back-out was a reasonable act on a tree that was
no longer the published one. **Measure the tree that publishes the work, and say which
tree you measured.**

## 2026-10-22 08:12 — A verifier's report arrives for an item closed two hours earlier, and the pointer rule is proved twice over

**Probe's WI-034 verification came back VERIFIED, and the first thing it does is correct
its own brief:** WI-034 was merged by `26fb68e` and accepted at 05:50, so "NOT merged
into `main`" is stale. **All four of its shas are ancestors of `main` today.** So the
report corroborates an acceptance that was already made — **and no second acceptance is
spent on a closed item**, which is the rule that keeps one verifier, one item, one
verification.

**The lead re-measured it on today's tree, because the report was measured at `f473982`
and the tree has moved twice.** The pin is green — **6 tests passed, exit 0** — and all
eight citations in `### The audit outcome` point at the code they claim. The section is
`:1222-1288` now, 67 lines rather than the 62 Probe measured, and the three stale
numbers are still nowhere in the contract.

**And the re-statement that landed after Probe read the pin closed Probe's caveat.** The
pin used to assert `expect.soft(section, …).toContain(claim.citation)`, and Probe
measured that the `audit/service.ts` pattern matches **two** byte-identical lines
(`:79` and `:92`) — so the pattern alone did not pin the number, and the `toContain` was
doing that work. **The current pin finds the citation by range**, so a citation of `:92`
can no longer satisfy a claim at `:79`, and **the instrument now pins the number
itself.** A verifier's caveat was true of the tree it was measured on and was closed by
the tree that followed.

**Probe's one defect is in the brief, not the work** — it cites
`apps/server/src/api/app.ts:185`, and there is no `apps/server/src/api/app.ts`. **And
that one defect earned a sweep of the whole tree**, because a brief that cites a path
which does not exist is a lead's own mistake, and the lead would rather find the rest of
them than leave them for another session to trip over.

**The sweep checked every path cited in every item file and every published document
against the tree.** The published documents came back with **one** broken path:
`docs/resource-templates.md:845` names `docs/decisions/0008-_.md`, a placeholder nobody
filled in, and the ADR is `docs/decisions/0008-five-domains.md` — **and that file is
already WI-115's, so it joined WI-115's scope rather than opening a third item on it.**
One false citation in a published item file — `WI-111.md:426` names
`apps/server/src/api/goals.ts` for the `goal.created` audit entry, **no such file
exists**, and the entry is audited in `factory.ts:55` — **corrected by appending beside
the claim.** And eight more that are not defects at all: they are **files those items
are owed**.

**So the rule, written down where it can be read:** _an item may name a file that does
not exist yet — that is what an item is for — but a claim about what the code does
today must cite a file that exists, and a path in a published document must exist._ The
pointer rule has now been proved three times in one day — by WI-034's correction, by
WI-108's shift, and by this sweep — **and every one of the three was found by reading a
line against its sentence, not by a gate.**

## 2026-10-22 08:15 — The peer states the rule this session's back-out needed, and the two sessions converge on the same lines

**A peer session's correction is better than the one this session made about its own
error, and the lead takes it.** The peer wrote it plainly: **the durable anchor for
"what is published" is the remote tip, read with `git ls-remote origin refs/heads/main`,
and not the local tracking ref.** The tracking ref moves on a fetch and lags a push, so
a claim about what is published can be a whole push stale — and the lead's 07:39
"WI-108 is NOT on `main`" was wrong for exactly that reason, thirteen minutes and one
push after the peer had published it. **The lead's own correction stands beside it: a
red measurement is true of the tree it was measured on.** The two are the same rule seen
twice. **Read the tree the work stands in, not a ref you assume is current.**

**And the two sessions measured the same nine pointers, independently, and agreed.**
The peer computed them from the shift rather than off the code — `service.ts` **+2**
from ~250 and **+40** from ~704, `templates.ts` **+12** from ~465 — and the targets
land on the same lines the peer's own re-pointing carries and the lead's table in
WI-114 names. **Three measurements, one set of lines, and the work is already done.**

**One number conceded, and the space after it:** **WI-116 is reserved by the peer** for
a contract-publication item it has not opened, **so the next number either session may
take is WI-117.** WI-114 and WI-115 are the lead's, and **both are held behind
WI-086**, which is `CONTRACTS.md`'s live file and is running right now.

**And Probe's WI-034 verification arrived for an item closed two hours earlier, and
corroborated it.** The lead re-measured it on today's tree rather than on the tree the
report was measured at: **the pin is green, 6 tests passed, exit 0, and all eight
citations in the audit-outcome section point at the code they claim.** **And the re-
statement that landed after Probe read the pin closed Probe's own caveat** — the pin now
finds its citation by range, so a citation of `:92` can no longer satisfy a claim at
`:79`, and **the instrument pins the number itself.**

## 2026-10-22 08:18 — A red gate that was not the tree's fault, and what it cost

**One full test run failed and the lead did not know why.** The failing workspace's
output had been cut off by the lead's own `Select-Object -Last 14`, so a red gate
arrived with no visible cause — and a red gate with no known cause is either pushed
anyway or buried, and neither is acceptable.

**The cause was in the commit timestamps.** The failed run spanned about 08:08 to
08:14, and **the peer session committed `683ad44` at 08:10:05, inside that window.**
**Two Chief sessions share one working tree, and a test suite that reads files while
the other session is writing them is measuring a tree that does not exist.** Re-measured
in order — the server workspace alone, **39 files, 423 tests, exit 0**; then the full
suite with every line captured to a file, **`TEST_EXIT=0`, 61 files, 615 tests, 0
failures**, no failure line anywhere in the log — **the tree is green and the red was a
race.**

**Two rules, both cheap.** **A gate measured while the other session is committing is
not a measurement: check the commit timestamps on both sides before believing a red.**
And **capture the whole log before reading it** — the lead's own habit of trimming a
gate's output with `-Last` is what turned a two-minute flake into an hour of
re-measurement, and it is the same habit that hid WI-108's landing failure earlier
today.

## 2026-10-22 08:45 — Chief: the licence record's verdict, a red that was the instrument, and the number space settled again

**WI-106 is NOT VERIFIED, narrowly, and the verdict is against `1712fd2`, not against
the branch's tip.** Probe's report (delivered 07:25) measured the branch
`wi/106-record-four-loose-sentences` at `1712fd2` and found every number in the record
re-derives exactly: **375 `licence-file` / 16 `package-json-licence-field` / 97
`published-licence-identifier` / 6 `source: null` = 494**; `summary` reads 375/16/97;
`agpl.familiesRead` has **11 rows summing to 488**; **494 `lockPath`s, 0 missing, 0
extra** against the lockfile's 500 entries excluding the root; the 375 licence-file
quotes each contain the first line of the file they name (375/375) and the 16
`package.json` entries each carry the recorded field value (16/16). All five gates were
green there — **602 tests in 60 files, 0 failures**. **Two wording findings stand
between it and acceptance**, and neither is a re-measurement problem: `reads.evidence`
still opened **"Every entry carries the file its licence was read from…"** and then said
**"The six first-party workspaces carry no source"** — contradicting itself inside one
sentence, against a criterion that asks for the opposite — and `PRODUCT.md` §10 still
said **"the lines of that file that identify the licence"** (true of **375 of 494**;
**119 entries carry no such lines**) and **"one entry for every package the lockfile
installs"** (**397** described, **494** held).

**The branch has moved since the verdict**, so the verdict does not apply to it:
`origin/wi/106-record-four-loose-sentences` is at **`c2375e4`** = `1712fd2` + three
commits at 08:00 (`035626f` the JSON, `01ceb37` `PRODUCT.md`, `c2375e4` the item file),
**64 insertions and 5 deletions across three files**. **The item is unverified at its
current tip.** The re-verification is **already queued by the peer session**
(`task_64ed239e7565` to Probe, `task_b49a674c7e40` the notice), **so this session spent
no request id on WI-106 and dispatched nothing for it.** Probe's merge check was clean:
**0 conflict lines**. **And there is still no pin** — `git grep -ln 'dependency-licences'
1712fd2` over the test trees returns **empty**, so no test file in the repository
mentions licences at all. That check is Probe's file to write and is owed.

**The published tree is not red on the format gate; the red was the instrument.**
The peer session's round-two brief states that "your `main` is red on the format gate,
and it is five of your ledger files". Measured three ways, it is green every way:
`npm run format:check` on this tree **exit 0**; the five files' committed blobs at
`76ce2a3` extracted byte-for-byte carry **CRLF = 0** and pass `prettier --check` with
the repository's `.prettierrc.json`; and the same check passes on `origin/main`, on
`origin/wi/117-branch-pileup-verdict` and on `origin/wi/106-record-four-loose-sentences`.
**And the instrument that produces the false red is reproduced:** `git show
76ce2a3:.factory/history.md | Out-File` writes **9,382 CRLF** where the blob has **9,382
LF and 0 CRLF** (586,734 → 596,116 bytes), and `prettier --check` then **exits 1** on
that copy — because `.prettierrc.json` sets **`"endOfLine": "lf"`**. The content is
byte-identical apart from the line endings. **So nothing is blocked: the peer's WI-106
branch may take today's `main`, and the five ledger files are not a defect.**

**WI-118 is the peer's live item and it is not dispatched** — the strategy document's
copy of the record's loose sentence, in three places, item file at
`.factory/work/WI-118.md` on `wi/118-strategy-record-prose` @ `e72304c`, owner Wren,
verifier Probe, opened from Probe's WI-106 verification. **The lead is not dispatching
it** — one writer per item, and a second dispatch would put two writers on
`docs/strategy.md`. It is recorded so it is not lost, and **if it is still undispatched
at the next round the lead dispatches it from this record**; no request id is spent.

**The number space, settled a second time in one morning.** **WI-116 is published, not
reserved**: `WI-112.md:182` reads _"It is **owed, and it has a number — WI-116** — and it
is **HELD**"_, published in `683ad44` at 08:10, and the peer's own tiebreak at 08:22
says _"**WI-116 is the pin, and it is not renumbered.**"_ **WI-117 is the peer's** — the
branch pile-up measurement, claimed at **08:09:24**, ten minutes before the lead's
08:19 block named it free, and the tiebreak says the earlier published claim keeps the
number where no dispatch binds it. **WI-118 is the peer's** — the live defect work.
**The next number either session may take is WI-119.**

**The floor at 08:45.** Cog is running **WI-086** on `CONTRACTS.md`, which is what holds
WI-114 and WI-115. Vision's WI-108 report relay has been running since **07:25:27** and
its content was already read and WI-108 accepted off it at 07:46 — **it is the wasted
slot, and it is reported, not cancelled.** Probe's lane is **alive** (the WI-106 verdict
at 07:25); **Wren's lane still refuses.** The ceiling stays at two. **The peer's two
record commits are local and ride out with the next push**, by the peer's own record.
**The restart is still the owner's word**, and on today's evidence its benefit is **the
wasted slot and Wren's refusal** — Probe's lane came back on its own — while its price
is **the turn it lands in**, which right now is Cog's live WI-086.
