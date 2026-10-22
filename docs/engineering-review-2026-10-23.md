# Engineering recovery review — 2026-10-23

Review in progress on `recovery/engineering-foundation`, based on
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

## Changes under verification

The existing work-item helper now refuses pre-existing target directories,
ambiguous item IDs, unreadable statuses, unmerged/unpublished work, force deletion,
and ignored files other than generated output. Paths are based on Git's common
directory, avoiding nested worktree roots. Native npm install scripts are enabled
for SQLite. Seven temporary-repository regression tests passed.

Dependency validation now checks manifest/lock consistency and npm's complete
installed dependency tree. CI and root development commands invoke it. Manifest
changes drain the running source stack and require explicit `npm ci` and restart;
the stack never installs imports automatically.

## Validation so far

- Initial clean install: passed.
- Typecheck across all workspaces and scripts: passed before later dependency
  gate/dev watcher changes; must rerun on the final tree.
- Worktree lifecycle tests: 7 passed.
- Second clean install with repaired lockfile: passed.
- Full test/build/smoke/browser/deployment checks: still pending.
- License evidence record must be refreshed for the restored transitive packages.

## Architectural observations to finish validating

The modular monolith, worker queue, persisted events, typed contracts, resource
revisions and explicit owner acceptance are useful foundations. Worker source now
connects and closes adapters; ARCHITECTURE.md still describes the earlier MCP
initialization defect as current. Bot Mode already connects to factory tasks via
`DelegatedTaskLedger` and exposes grant-controlled `bot.dispatch` through MCP.
It is not an isolated chat implementation. Review native runtime/session support,
cancel/recovery semantics, workspace authority, and deployment recovery against
source before declaring the larger architecture complete.

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
to two workers and the full gate run is in progress; no assertions were removed.
The E2E harness also recursively removed an inherited data directory. It now
creates a fresh private temporary directory and never deletes that inherited path.

Architectural follow-ups are tracked in the active roadmap: expired leases and
side-effect replay, dispatch idempotency, native session/capability projection,
execution isolation/restore proof, and persistent Bot instruction migration. The
architecture's stale MCP lifecycle statement has been corrected against worker
source. Existing provider-neutral extension contracts and Bot-to-product tools
are preserved; no new scheduler, queue service or adapter framework was added.
