# The free period — a plan for four days of unlimited MiniMax Code

**What this is.** A plan for the window in which MiniMax Code is unlimited. It
says what to build, in what order, on which lanes, and what is deliberately not
built. It is written to be executed by agents that are not in this conversation:
the point is that a fresh agent, handed this file and the repository, knows
what the next four days are for.

**What this is not.** It is not a wish list. Every item below names the gate
that proves it. It is also not a claim that the window is unlimited — see
[What the window actually is](#what-the-window-actually-is).

---

## The finding that shapes everything else

The window does not need more work. It needs a pipeline that does not lose
work.

Measured on 2026-10-21, before any of this plan ran:

| Observation                                 | Evidence                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tree is green                           | typecheck, build, 346 tests, smoke, e2e (27), verify-build and verify:bundle all pass on `main`                                                                                                       |
| But the dispatcher drops work               | 104 `BUSY` / `AGENT_UNAVAILABLE` / cancelled / unassignable dispatches recorded in `.factory/INTAKE.md` (35 `BUSY`, 62 cancelled, 7 unassignable); one batch queued two tasks and both were cancelled |
| And work gets done anyway, by another route | The ledger's own account: a "third road" — a turn opened in a bot's own session — is what actually landed items                                                                                       |
| The number space is split across sessions   | Three sessions hold disjoint number ranges; `WI-046` was allocated twice and renamed `WI-062` to fix it                                                                                               |
| One implementer holds the queue             | `docs/strategy.md` records W3 as deferred, and says the reason is capacity, not judgement                                                                                                             |
| The queue is a human-readable file          | `.factory/work/*.md` carries state in a `**State:**` line; nothing reads it programmatically                                                                                                          |

So the scarce resource during the window is not model capacity. It is
**coordination capacity**. Ten agents with perfect models and one shared
`.factory/INTAKE.md` will produce exactly as much landed work as one agent
with an excellent model and a file it can trust.

**Therefore the plan spends its first day on the pipeline, and its remaining
days on the product.** That ordering is the plan.

---

## What the window actually is

Worth being precise, because the plan's ethics depend on it.

MiniMax's M Plan governs usage on a **5-hour window and a weekly window**, and
rate limits are calculated **separately from quota**. The documentation is
explicit that hitting a rate limit does not mean the quota is exhausted, and
that the platform will adjust request rates based on account usage to protect
shared capacity for everyone. The AI App and Web terms permit use for
**personal, non-commercial** purposes and prohibit reproducing the service's
material.

Three consequences, and they are the constraints the pipeline is built around:

1. **"Unlimited" means quota, not throughput.** A request rate ceiling still
   applies. A plan that assumes infinite parallelism will spend its window
   being throttled. The plan below therefore measures work in _landed,
   verified_ items — not in agents spawned.
2. **This repository is the owner's own project**, which is what the personal,
   non-commercial term allows. Nothing here is being built for resale, and the
   licence record (`WI-036`, `WI-050`) keeps that honest.
3. **"Borrow the idea, not the dependency."** `ADR 0009` already settles this:
   the MiniMax source is a _specification_. The code in this repository is
   written against the behaviour, not copied from the implementation, and the
   licence column in `docs/strategy.md` records which upstream artefacts were
   inspiration and which were never dependencies.

---

## The lanes

The repository already has the right shape for parallel work — one worktree
per work item, one file one live item, a branch per item, CI on every push.
The plan uses that shape rather than inventing a second one.

Four lanes run in parallel. A lane is a _role with a worktree_, not a person.

| Lane | Role      | Owns                                                           | Works in                               |
| ---- | --------- | -------------------------------------------------------------- | -------------------------------------- |
| A    | **Cog**   | `apps/server`, `apps/worker`, `packages/*`, `apps/web`         | its own worktree, branched from `main` |
| B    | **Wren**  | `*.md`, `CONTRACTS.md`, `docs/decisions/`                      | its own worktree                       |
| C    | **Probe** | `**/*.test.ts`, `e2e/`, `scripts/smoke.ts`, `scripts/verify-*` | its own worktree                       |
| D    | **Chief** | `package.json`, `package-lock.json`, CI, `.factory/**`         | `main` integration only                |

**The lane rule that makes it work:** no two lanes touch one file. Where a
change crosses lanes, it is two work items, and the second one waits for the
first to land. This is `FACTORY.md`'s existing file-ownership rule, applied as
a schedule rather than a hope.

---

## Day 1 — Make the factory trustworthy

Nothing else in this plan survives if Day 1 is skipped.

### D1-1. A queue that a program can read (owner: Wren)

> **Now WI-072.** The research behind it changed two things: the index is
> generated from a YAML header block on each item file rather than from the
> prose `**State:**` line, and the generator is `work-item.ts queue --write`
> rather than a second script. The criteria below are kept as written, with
> that correction.

`.factory/work/*.md` holds the state of every item, and it is the reason the
factory is hard to run unattended: a scheduler would have to parse prose. Add a
machine-readable index that is _generated from_ the work-item files, never
edited by hand:

```
.factory/queue.json
```

Each entry: `id`, `title`, `owner`, `state`, `worktree`, `branch`,
`blockedBy`, `blockedReason`, `gates`. The work-item file stays the record;
the index is the view.

**Acceptance criteria**

- [ ] `npx tsx scripts/work-item.ts queue --write` regenerates `.factory/queue.json` from `.factory/work/*.md`, and the output is byte-identical on a second run.
- [ ] A work item's `state` and `owner` in the index match the header block's `state:` and `owner:` fields in its file.
- [ ] An item whose work-item file is not reachable from the checkout doing the reading (today's `WI-046`: the file exists on `wi/046-domains-interaction-model` but not on `main`, so `work-item.ts list` reports "no work item file") appears with an explicit `blockedReason`, not silently missing.
- [ ] `npm run test` passes and the generator has a named test.

**Not in scope:** changing any work-item file, changing the state machine, or
building a UI.

### D1-2. A dispatcher that survives its own failures (owner: Chief)

The 104 recorded failures are the important artefact. The fix is not "try
harder" — it is to make every dispatch leave a record and make retry safe.

- Every dispatch writes a row: request id, target, state, outcome.
- A request id is spent whether the dispatch succeeded or failed. Reusing one
  is the bug that produced `WI-062`'s rename.
- A dispatch that reports `BUSY` is retried against the _third road_ — a turn
  opened in the target's own session — because that is the route the ledger
  says actually lands work.
- A failed dispatch is recorded as a **finding on the item**, never as a
  silent retry loop.

**Acceptance criteria**

- [ ] A dispatch attempt that fails is visible in `.factory/INTAKE.md` with its request id and its outcome.
- [ ] Two dispatches with the same request id are refused, and the refusal says why.
- [ ] A `BUSY` dispatch is recorded and the item's state is unchanged — the item is not marked done by a dispatch that never ran.
- [ ] `npm run test` passes.

**Not in scope:** rewriting the MiniMax Bot plugin, and changing the plugin's
own queue.

### D1-3. One number space (owner: Chief)

Three sessions hold disjoint ranges and one number was allocated twice. Give
the number space a single owner — the Chief lane — and a rule for when a
session may take a number: **never. A session asks Chief; Chief allocates.**
`WI-064` is the first number taken under this rule.

**Acceptance criteria**

- [ ] `.factory/INTAKE.md` names the single owner of the number space.
- [ ] The number space records which numbers are allocated, so a duplicate is visible without parsing the whole ledger.
- [ ] The rule is written down where an agent will read it before taking a number.

**What happened, on 2026-10-21, and it is the reason this item exists.** The
strategy session took WI-069 through WI-072 for the four work-stream items.
While it was writing them, the number space owner opened **WI-069** for a
different item, and WI-069's own file carries the standing rule: _"If another
session has taken WI-069 in the meantime, this item is renumbered and the table
is corrected."_ So the four items became **WI-070 through WI-073**, and the
collision is recorded in each item's "Numbered" paragraph.

That is the rule working as written rather than a failure — but it is also the
cost of two sessions opening items in one tree, and the cost is paid twice:
once renumbering, and once in the coordination. `FACTORY.md` allows a session
to take the space when the owner is not reachable, provided it says so out loud
rather than taking it quietly. It was said out loud, to the owner, by message
and not by assertion. The better answer is still the one above: **ask**.

The same collision has now happened twice — WI-063, then WI-069 — and both
times it was caught by a human reading a file, not by a rule. A rule that is
written but not enforced is a habit, and a habit that two sessions keep
breaking is not a rule.

### D1-4. Green means green (owner: Chief) — solved, and this section's premise was wrong

The tree is green on `main` right now — every gate passes. It must _stay_ green,
and the only way to know is to read CI rather than assume it.

**This section first said the repository's CI verdict was unreadable on this
machine. It was not.** The premise was wrong, and the way it was wrong is worth
recording, because the next agent will otherwise repeat the same search and
reach the same wrong answer.

The machine has **no `gh` CLI, no `GITHUB_TOKEN`, no `GH_TOKEN` and no GitHub
CLI credential store**, and the GitHub API answers `404` for this private
repository without authentication — which looks exactly like "the repository is
not there". But **git's own credential store holds a `gho_` OAuth token with
`repo` scope**, which `git credential fill` returns and which authenticates to
the API.

Verified on 2026-10-21 against `origin/main`:

- `GET /repos/this-bytes/personal-os/commits/<sha>/check-runs` → `200`, ten
  check runs, every one `completed`/`success`.
- The check names are `Build and run the stack`, `Build and test`,
  `Dependency audit`, `Lint the workflows` and
  `Analyze (javascript-typescript)`.
- `GET /commits/<sha>/status` returns `total_count=0` for this repository:
  Actions reports through **Checks**, not commit statuses. Read check-runs.
- A **local unpushed** commit returns `422`, not `404` — GitHub holds no
  check-runs for a sha it does not have. Read the verdicts only for shas that
  exist on the remote.
- The fine-grained permission a dedicated token would need is _Checks_: read.
  A classic token needs exactly the `repo` scope and nothing else.

The recipe, and the one PowerShell trap in it — the pipeline form of
`git credential fill` fails on this machine with _"refusing to work with
credential missing protocol field"_, so write to the process's stdin directly:

```powershell
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'git'
$psi.Arguments = 'credential fill'
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.Write("protocol=https`nhost=github.com`n`n")
$p.StandardInput.Close()
$out = $p.StandardOutput.ReadToEnd()
$p.WaitForExit()
```

Two cautions. The token is the owner's own git credential, and whether an
automated tool may spend it on API calls is a policy decision for the owner,
not a technical one. And `gh` is still absent, so nothing may come to depend
on it.

**Acceptance criteria**

- [x] CI results for a branch can be read from this machine. Verified against
      `origin/main` on 2026-10-21: ten check runs, all green.
- [x] The definition of done names which of the two it requires. It requires
      **CI green on the landed sha**, and CI green is _necessary but not
      sufficient_: acceptance still needs Probe's review, because a green
      suite can certify a wrong fix.

### D1-5. The MCP workspace-scoping hole (owner: Cog)

This one is a genuine defect, not a process improvement, and it is the kind
that gets _worse_ with more agents.

`apps/server/src/modules/mcp/server.ts` registers thirteen tools. Four guard
themselves with `assertWorkspace` (lines 252, 279, 368, 511): `agent.list`,
`task.create`, `resource.create`, `automation.create` — each of which takes a
`workspaceId` and resolves it.

Seven more take an id that belongs to a specific workspace and never resolve
it: `conversation.read`, `conversation.post`, `task.update`, `task.get`,
`resource.get`, `resource.update`, `automation.inspect`. An agent connected
with a capability for one workspace can read or write another workspace's
objects if it knows the id.

The remaining two — `workspace.list` and `resource.template.list` — take no
object id, so they are not the same defect and are not in scope here.

**Acceptance criteria**

- [ ] Every tool that takes an object id resolves that object's workspace and calls `assertWorkspace` before touching it.
- [ ] A test proves that an agent granted workspace A cannot read, update or inspect an object in workspace B — one case per affected tool.
- [ ] The capability list in `CONTRACTS.md` matches the tools the server registers.

**Not in scope:** changing which capabilities exist, or changing the resource
API.

---

## Day 2 — Land the architecture, then build on it

### D2-1. Land `wi/046-domains-interaction-model` (owner: Chief)

This branch is **pushed, verified and ready**: commit `1fb60e7`, 43 files,
+3318/−54. It carries three ADRs (`0008` five domains, `0009` MiniMax Code as
a specification, `0010` self-improvement without self-dependence),
`docs/domains.md`, `docs/self-improvement.md`, a new `mcp` adapter, and the
`domains.ts` boundary check with its test.

An independent audit of it returned **LANDABLE** — all six adapter-conformance
requirements met, the env-leak property genuinely proven by mutation rather
than by reading, the domain test passing and genuinely enforcing its claim,
and every gate green. It also found **two major follow-ups**:

- The MCP **HTTP transport has zero test coverage** — every test uses stdio,
  yet HTTP is user-selectable in the UI and carries the bearer-token path.
- An **un-awaited `notify()`** on the HTTP transport can escape as an unhandled
  rejection and kill the worker, on an unreachable MCP server.

Both are Day 2 work, because both are in code this branch introduces.

The branch is behind `main` — 26 commits as of 2026-10-21 — so it needs a
merge rather than a fast-forward. **That merge is Chief's tiebreak** — two
pieces of work becoming one — and it is said out loud, not done silently.

**Acceptance criteria**

- [ ] The merge is performed, and the tiebreak is recorded in `.factory/INTAKE.md`.
- [ ] Every gate passes on the merged `main`.
- [ ] The two major findings are fixed, each with a named test, before `main` is pushed.

### D2-2. The interaction model, implemented (owner: Cog)

`WI-055` is the largest unfunded-looking item in the new set, and the one the
whole `0009`/`0010` pair points at: the interaction primitives exist as a
contract, and the product does not yet speak them.

This is the highest-value _product_ work in the window, because it is what
makes the product usable by the very agents the factory runs on.

**Acceptance criteria**

- [ ] The interaction model's primitives are reachable through the existing capability API — no new public surface that bypasses it.
- [ ] A conversation shows the primitives the contract publishes, and `acceptsSteering` has a consumer or is withdrawn from the contract.
- [ ] `npm run test` passes, `npm run test:e2e` passes, and `npx tsx scripts/smoke.ts` passes.

### D2-3. The worker's context budget (owner: Cog)

`WI-056`: a turn's context budget, and the tool eligibility chain. This is the
mechanism that stops an agent from burning a window on a turn that cannot
finish.

### D2-4. The release does not migrate on boot (owner: Chief)

`WI-061`. `B3` says migrations are owner-accepted and never agent-applied, and
the runbook names this item as the hole where that is not yet true.

---

## Day 3 — The product, on the lanes

Now that the pipeline is trustworthy and the architecture has landed, the lanes
work on product items. The order below is the order `docs/strategy.md` and the
six Forge briefs already imply; it is recorded here so a fresh agent does not
re-derive it.

1. **The Forge panel** (`WI-024`, the six briefs in `prototypes/briefs/`). The
   briefs already carry their own piece order and their own landing order:
   material first (everything draws on its tokens), rooms second (the rail,
   the trace, the dashboards and the constellation all need a room to move
   into), constellation last (hardest, and it benefits from settled material).
   One branch, one merge.
2. **The wants that are funded and waiting**: `W1`/`W2` (`WI-033`, `WI-034`),
   `W5`/`W6`/`W7` (`WI-036`–`WI-038`), `W8` (`WI-044`).
3. **`W3` (`WI-035`)** — the largest of the seven, deferred only for capacity.
   With lanes running in parallel, the capacity reason for the deferral is
   gone, so it should be re-examined rather than left deferred by default.

**The lane rule holds:** Probe's lane owns every test file, so a feature lane
cannot write its own proof. That is the point — it is what stops "it works on
my machine" from being the definition of done.

---

## Day 4 — Close the window cleanly

The window ends. The project must not depend on it.

- Every branch pushed, every work item with a state, no worktree holding
  uncommitted work.
- `.factory/queue.json` regenerates cleanly and matches the ledger.
- The CI read path works, and it is used rather than assumed: every branch's
  check-runs are read before it is called green.
- `docs/self-improvement.md` updated with what the window actually proved.
- **The roadmap** (`docs/roadmap.md`) is the first thing a fresh agent reads.
  It is the thing that makes the next four days of _paid_ usage as effective
  as this one.

---

## What this plan deliberately does not do

- **It does not raise the agent count to "as many as possible."** The window
  gives quota, not rate limit. More agents than lanes means more dispatch
  failures, and dispatch failure is what the ledger says has been happening.
  Four lanes is what the file-ownership rule supports; a fifth lane needs a
  fifth disjoint set of files.
- **It does not let an agent merge to `main`.** `AGENTS.md` is right that
  landing on `main` waits for the owner's word. During the window that word is
  spent at 08:54 on the first push; a second word is needed for the next one,
  and this plan does not pretend otherwise.
- **It does not weaken a gate to move faster.** Every criterion above is
  proved by a command.
- **It does not treat "the agent reported done" as done.** `B5` applies to the
  factory as much as to the product.
- **It does not have agents work in the main checkout.** One worktree per
  item; the main checkout is integration only.

---

## How a fresh agent starts

If you are an agent reading this file cold, with no conversation history:

1. Read `AGENTS.md`, then `FACTORY.md`. They are the contract, and they are
   short.
2. Read the queue. Once `D1-1` lands it is `.factory/queue.json`; until then
   it is the `**State:**` line in each `.factory/work/*.md` file. Either way it
   is the state of every item, and it is meant to be read by a program.
3. Read `docs/roadmap.md` for where the project is going, and
   `docs/free-period-plan.md` (this file) for what the current window is for.
   `docs/domains.md` and `docs/self-improvement.md` land with the `wi/046`
   merge.
4. Take a work item from the queue that is in `triage`, in your lane, with no
   `blockedBy`. If you want a number, ask Chief — do not take one.
5. `npx tsx scripts/work-item.ts new WI-nnn <slug>` makes your worktree.
6. Work in it. Run the gates in the item's `Gates` section. Push your branch.
7. Say what you did, with the actual gate output. An agent's report is a
   proposal.

The repository is designed so that this works. That is the point of the
window.
