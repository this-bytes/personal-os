# Engineering recovery review — 2026-10-23

Review implemented on `recovery/engineering-foundation`, based on
`644d33f48d71844d49eeb728615b9f8ed10cdddc`. This is an out-of-band engineering
review, not acceptance of roadmap stages R0–R4.

## Evidence collected

- Main has unrelated changes to `scripts/contract-status.json` and an untracked
  `scripts/measure-claim-citations.ts`. They are preserved.
- The actual sibling directory is `personal-os-worktrees`, not the misspelled
  `personal-os-workstrees` in the assignment.
- Inventory: 97 registered worktrees including this review; 74 HEADs reachable
  from main, 23 not. All directories exist. Seven worktrees are dirty, including
  main and this review. There are 233 local/remote-tracking refs, 56 not reachable
  from main. These are reachability measurements, not permission to delete.
- Most registrations use Windows `G:/...` paths. Linux Git misidentifies them as
  prunable. Native Windows Git successfully inspected their statuses. Do not
  prune or repair the registrations wholesale from WSL.
- Preserve unfinished merge in `136-a-type-cannot-be-named-without-an-implementation`
  (`UU .factory/INTAKE.md` plus staged records), the detached review tests in
  `146-probe-newtip`, the untracked test in `lead-wi146-merge`, untracked resolver
  in `133-dependency-audit-once`, and edits in `146-immediacy-citation`.
- GitHub CI and CodeQL succeeded for main at the reviewed SHA. GitHub reports no
  branch protection and no repository rulesets. A green branch does not enforce
  green integration; local hooks can be bypassed.
- GitHub native `delete_branch_on_merge` was disabled and is now enabled for
  future merged PRs. Existing remote branches were not deleted. Main advanced
  independently to `631e336` during this review; the dirty main checkout was not
  switched or overwritten.
- Main now requires all seven existing CI/CodeQL check contexts, with up-to-date
  status checks and administrator enforcement. Force pushes and deletion are
  disabled. No mandatory PR review was added: the standing authorization for
  green, fast-forward integration remains usable. Verified these settings through
  GitHub's branch protection API. The local push hook now permits deletion only
  of topic commits reachable from that remote's main; main deletion is refused.
- MiniMax Bot installed source: official cache
  `sha256-tree-v1-d4fd680e8404a43d92dc469439fb611114918fa97e7a20131d24cadb8303348e`.
  Its dispatcher already has stable request IDs, asynchronous receipts, child
  result continuation and two background slots. Private chats serialize; the
  host has three shared slots. It does not manage Git worktree cleanup.
- Persisted Bot state contains 453 tasks: 207 done, 129 cancelled, 19 unknown,
  98 failed. This snapshot is not evidence of a live process or current task
  execution. No tasks or messages were sent by this review.
- Four engineering Bot instructions still enforce retired exclusive file roles
  and reference removed `.factory/{chief,cog,wren,probe}.md` briefs. Cog cannot
  edit tests/docs; Probe cannot fix production code; Wren owns all Markdown;
  Chief owns manifests and requires approval for every push. These contradict
  current FACTORY.md and AGENTS.md and cause unnecessary coordination.
- `@radix-ui/react-collapsible@1.2.1` was added to both UI manifest and lockfile
  in `9cd1d90`. It resolves after a clean install. The dev stack watches source
  but previously ignored dependency manifests. A separate `node_modules.junction`
  points at `_nm_main`; sharing installations is unsafe across trees/platforms.
- The first clean `npm ci` succeeded (402 packages), but `npm ls --all` failed:
  the lockfile omitted `@esbuild-kit/esm-loader`, required by drizzle-kit. npm
  regenerated the missing transitive closure when reinstalling the same exact
  drizzle-kit version with `--package-lock-only --save-exact`. The second clean
  install succeeded (411 packages). No package manager change is warranted.

## Remediation

The existing work-item helper now refuses pre-existing target directories,
ambiguous item IDs, unreadable statuses, unmerged/unpublished work, force deletion,
and ignored files other than generated output. Paths are based on Git's common
directory, avoiding nested worktree roots. Native npm install scripts are enabled
for SQLite. Nine temporary-repository regression tests passed.

Dependency validation now checks manifest/lock consistency and npm's complete
installed dependency tree. CI and root development commands invoke it. Manifest
changes drain the running source stack and require explicit `npm ci` and restart;
the stack never installs imports automatically.

## Verification evidence

The clean Linux checkout `/tmp/personal-os-engineering-verify-IlNZtl` tested
`b497f48`, including integration with the independently advanced main. Subsequent
`0d2317f` changes align README/source-launcher diagnostics and add the already
passing dependency check to the Docker build. The container build exercised that
Docker change. Documentation-only evidence updates follow these revisions.

- Clean `npm ci --no-audit --no-fund`: passed, 411 packages. Each checkout has
  its own installation; no borrowed dependencies or compiled output.
- `npm run gates`: all ten gates passed: dependencies, typecheck, tests, build,
  format, contract status, contract pointers, smoke, compiled boot and bundle size.
- Tests: server 669, web 186, worker 99, adapters 37, contracts 48; total 1,039.
  This includes nine temporary-repository lifecycle regressions, four push-hook
  deletion cases and three dependency-gate cases.
- Chromium E2E: 35 passed against compiled output and an actual worker, using port
  24319 and private temporary data. The inherited directory's sentinel survived.
- `npm audit --audit-level=high`: passed; zero vulnerabilities at all severities.
- Source `dev:stack`: dependency preflight passed, API health and Vite returned
  200, and Vite transformed `packages/ui/src/collapsible.tsx`. A lockfile timestamp
  change drained the worker and stopped the stack with exit 0.
- Isolated Docker Compose build/start: passed with separate image tags, project,
  volume and port 24318. `verify:stack` proved actual worker dispatch/reply, beyond
  a health response. Existing deployment containers and volumes were not used.
- Git bundle verification passed; original unmerged/dirty work was preserved.
- Licence evidence refreshed for the restored transitive closure, with exact
  package coverage and regression checks retained. Deprecated esm-loader/core-utils
  come from the existing drizzle-kit version; they are not new product abstractions.

Logs are `/tmp/personal-os-linux-gates-verified.log`,
`/tmp/personal-os-browser-review.log`, `/tmp/personal-os-docker-review.log`,
`/tmp/personal-os-container-stack-review.log` and `/tmp/personal-os-dev-review.log`.
These are local fixture/echo validations, not real Codex/OpenCode acceptance or a
production database restore demonstration. CI on the published branch must judge
the final commit before landing; no earlier green commit substitutes for it.

## Architectural assessment

The modular monolith, worker queue, persisted events, typed contracts, resource
revisions and explicit owner acceptance are useful foundations. Worker source now
connects and closes adapters; ARCHITECTURE.md still describes the earlier MCP
initialization defect as current. Bot Mode already connects to factory tasks via
`DelegatedTaskLedger` and exposes grant-controlled `bot.dispatch` through MCP.
It is integrated with product capabilities. Keep the existing conversation,
execution, autonomy and resource seams within the modular monolith. Protocol-native
extensions already have a contract (`AgentAdapterExtras`); their negotiation and
projection into the product remain incomplete. Provider-specific capability details
belong there rather than in conversation or task storage.

The foundation can grow without a new service or scheduler, but current runtime
session continuity, restart semantics, capability projection and execution authority
do not yet meet the full mission. CLI cwd/environment sanitization is not a
filesystem sandbox. Worker lease expiry can replay side effects before an unknown
outcome was recorded; Bot dispatch lacks a caller idempotency key. Address these
through the active roadmap's bounded follow-ups, with real-runtime demonstrations.

## Source references

Use native Git removal and locks, not recursive directory cleanup:
[Git worktree documentation](https://git-scm.com/docs/git-worktree.html).
Use clean installs of the committed workspace lockfile:
[npm ci documentation](https://docs.npmjs.com/cli/commands/npm-ci/).

Inventory scratch evidence is `/tmp/personal-os-git-inventory.json`. A durable
snapshot is `/mnt/g/code/personal-os-recovery-2026-10-23-Vc0Mam`: verified Git bundle,
inventory, staged/unstaged patches, modified/untracked files and Git operation/index
metadata for six dirty original worktrees. The review worktree is excluded from
those dirty snapshots because it is the ongoing implementation. The detached
unmerged review commit is additionally preserved by a `refs/recovery/` ref.
Existing worktrees and branches remain intact. This is repository recovery evidence,
not a backup of the running product's database or a proven product restore.

Repository-local `gc.worktreePruneExpire=never` prevents automatic housekeeping
from discarding cross-platform registrations. Manual cleanup must use the owning
Git/platform and current reachability, dirty-state and ownership evidence.

Independent review identified two additional cleanup defects: output-directory
names nested beneath ignored user data, and unfinished Git operations with clean
porcelain status. Both now have guards and regression cases. The review also
confirmed that `npm ls` cannot detect undeclared imports satisfied by workspace
hoisting. A TypeScript AST audit of workspace source found no such imports; root
scripts did import SQLite/contracts/adapters without root declarations, now fixed
in root devDependencies. Tooling/configuration and optional-library usage remain
reasons not to delete dependencies based only on static non-use.

The first full test run failed under concurrent startup: three server timing
failures and twelve web fork-start failures. Server and web pools are now bounded
to one and two workers respectively, per checkout, while independent checkouts can
still run concurrently. A two-worker Linux server run hit one setup timeout; that
file passed all six cases in isolation and the complete one-worker run passed.
No assertions were removed and existing timeout checks remain in force.
The E2E harness also recursively removed an inherited data directory. It now
creates a fresh private temporary directory and never deletes that inherited path.

Architectural follow-ups are tracked in the active roadmap: expired leases and
side-effect replay, dispatch idempotency, native session/capability projection,
execution isolation/restore proof, and persistent Bot instruction migration. The
architecture's stale MCP lifecycle statement has been corrected against worker
source. Existing provider-neutral extension contracts and Bot-to-product tools
are preserved; no new scheduler, queue service or adapter framework was added.

The shared repository used `merge.conflictStyle=zdiff3`, which its Linux Git 2.34.1
rejects even during otherwise conflict-free merges. Changed that local setting to
`diff3`, supported by both Git installations, and integrated updated remote main in
the isolated recovery branch. Main's active checkout was left alone.

Persistent MiniMax Bot settings were inspected, not rewritten through their live
state file. No supported authenticated management connection is exposed to this
review. The roadmap records the exact stale-role migration and its acceptance
criteria. Until applied through Bot settings/API, those persistent prompts can
still recreate avoidable handoffs despite the corrected repository instructions.

Static non-use candidates include the web utility trio (`class-variance-authority`,
`clsx`, `tailwind-merge`), adapters' `zod`, worker's direct `better-sqlite3`, and four
unused Radix primitives in UI. They remain installed: source-only absence does not
prove config/export consumers have no need for them. Remove them in a separate
dependency slice after consumer/build checks, rather than combining speculative
pruning with recovery.

## Continued recovery: disposition and cleanup

The initial preservation pass was not completion of stranded-work recovery.
The subsequent pass fetched current main, inspected every registered checkout,
reviewed unique historical changes and performed actual cleanup. Detailed targets,
results and preserved local data are in the sibling recovery directory's
`resolution-inventory.json`, `cleanup-results.json`,
`historical-tree-retirement.json` and merged-ref cleanup manifests.

- Removed 93 remote topic branches whose exact tips were reachable from published
  main, through the normal pre-push safety hook. Removed 63 merged local branches.
  No unmerged remote topic was deleted or relabelled as merged.
- Retired historical physical worktrees, preserving their unmerged branches and
  ignored keys/databases. The remaining registered trees are the primary checkout
  and the current WI-146/WI-155 review/integration ownership boundary. MiniMax still
  reports running, queued and waiting work there; a clean status is not release.
- Aborted WI-136's obsolete intake merge only after preserving its original index,
  patches and merge metadata. The useful implementation is recovered separately.
- WI-146's staged review file in `146-probe-newtip` was byte-identical to published
  main; its original staged snapshot remains in the recovery archive. The lead's
  untracked test was an explicitly unlanded scratch measurement with a hard-coded
  output path. It was archived, not added to the suite as a second copy.
- Fast-forwarded the primary checkout to the foundation fixes, preserving its
  modified claim table, untracked citation measurement and junction. A clean
  `npm ci`, dependency validation and full build passed in that checkout.

Historical alternatives were adjudicated, not blindly merged:

| Work                                                                               | Disposition                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WI-071 accent, WI-086 evidence, WI-097 templates, WI-132 fixtures, WI-144 Bot Mode | Already integrated under different commits; retain newer implementation/migrations. Independent review confirmed the principal files/tests.                                                                  |
| WI-046 rehearsal, WI-042/044/062/077-author/103/106 records                        | Historical integration or documentation alternatives; preserve in refs/bundle, do not restore retired narratives or stale citations.                                                                         |
| WI-072 queue index, WI-088 ledger move, WI-116/117/119 reservations and census     | Obsolete process alternatives, rejected by the current Git/MiniMax workflow; archive rather than reintroduce a scheduler or duplicate backlog.                                                               |
| WI-092 bundle-test reliability                                                     | Recovered with an actual child-process deadline, preserving all nine assertions. A Vitest timeout alone cannot interrupt synchronous child execution.                                                        |
| WI-038 licence drift                                                               | Adapted into the existing licence-record checks: same-path version and whole licence-expression changes now fail, with adversarial cases for all evidence categories. No handwritten SPDX interpreter added. |
| WI-136 implementation coverage                                                     | Recovered exhaustive built-in adapter factories and resource providers, preserving file uploads and the extensible registry API.                                                                             |
| WI-077 worker-owned probes                                                         | Genuinely missing and not safely cherry-pickable; retained source and a concrete compatible-port item in the roadmap.                                                                                        |

### Cleanup incident and repair

Native Windows Git removal traversed shared npm workspace junctions and deleted
358 tracked files in the primary checkout. Cleanup was stopped; only newly deleted
tracked paths were restored from their original index. Every remaining registered
checkout was scanned for tracked deletions; only the primary needed restoration.
The primary's original three local changes remained intact, its tracked deletion
count returned to zero, and its clean dependency install and full build passed.
This establishes tracked-source repair, not a blanket claim that every ignored
file ever present was backed up. The root data directory remains; user deployment
containers/volumes were not removed. Generated dependencies/build output were
recreated. Keys/data found in retired trees were archived before removal.

The helper now refuses external links/junctions (including nested `.git` links)
and linked worktree roots before native removal. Regression fixtures prove that
the target outside the worktree survives. Subsequent manual retirement moved
generated install directories outside Git's removal traversal first. Windows
native deletion also left some unregistered remnants; those were moved into the
recovery directory rather than recursively force-deleted. Recovery manifests
record this explicitly. Do not delete that archive assuming it is all on main.
