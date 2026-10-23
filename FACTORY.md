# Building Personal OS

This is the **out-of-band development workflow**, approved in the chat-first
recovery on 2026-10-22. It builds the product; the product's factory is a feature
being built. Development, CI, release and recovery work with Personal OS stopped.

## Select an outcome

Read [AGENTS.md](AGENTS.md), the relevant product/contracts, and the active
[roadmap](docs/roadmap.md). Select one bounded vertical slice with a demonstrable
user outcome. Use [the feature guide](docs/feature-guide.md) to implement it.

The product factory, a bot host, a generated queue and a team of named roles are
not prerequisites. An agent with a repository checkout can implement and verify a
slice using existing coding tools. Documentation and coordination work must remove
a demonstrated delivery blocker or accompany an implementation.

## Working in parallel

Use one branch and worktree per item. The existing helper is available:

```bash
npx tsx scripts/work-item.ts new WI-138 chat-first-recovery
```

Read current refs and item files before allocating a number. The helper does not
provide atomic allocation or authoritative dispatch status; resolve a collision
before writing code. Record the branch, base commit, scope and actual progress in
one item. A label such as `implement` is not proof of a running agent.

MiniMax Bot already provides asynchronous dispatch, stable request IDs, bounded
background concurrency, and result delivery. Use one dispatch path per item and
reuse the request ID on retries. An admission receipt means queued, not completed;
use the plugin's task status and returned result to decide what happened. Do not
create a repository scheduler or wait for a named persona when an available agent
can own the complete slice. Actual plugin slots may queue work; independent Git
work does not need a global lock.

Persistent Bot instructions must defer to this file and AGENTS.md. Retired
exclusive ownership of tests, Markdown or manifests is invalid. A slice owner
changes its implementation, tests, dependencies and documentation together;
independent review remains separate. Do not load deleted role briefs from history
as current instructions. Configure the plugin through its supported settings/API,
not by editing a live state.json file.

## Integration and cleanup

Record the owner and exact branch/worktree in the item or PR. Refresh from remote
main before implementation and before landing. Merge updated main into the item
branch and verify the resulting tree; routine non-overlapping integration is not
a reason to block other work. Only final landing onto the shared main ref is
serialized. Prefer merge commits/fast-forwards when preserving Git ancestry for
cleanup; a squash merge needs separate evidence that the original commits are
preserved before deleting their branch.

After successful integration, the item owner releases its worktree. From another
checkout, run the existing `work:item remove` command. It automatically verifies
main and origin/main reachability, clean state, unambiguous ownership and absence
of ignored user data before using native Git removal and safe branch deletion.
Locked worktrees stay protected by Git. Never remove a tree merely because its
HEAD is old, reachable, or its Bot task says done. Preserve detached commits,
uncommitted files and interrupted merges before any cleanup.

Enable GitHub's native automatic branch deletion for merged PRs. It does not
clean direct-push branches or local worktrees. Review those explicitly after
fetching; keep unmerged references. Windows and WSL must not prune each other's
unavailable worktree paths. Native `git worktree lock` protects an intentionally
retained tree; do not bulk-rewrite registrations while either platform is active.

Shared npm junctions are a deletion hazard, not just a build hazard. Windows Git
can traverse a workspace junction into another checkout while removing a tree.
The helper scans links (including ignored dependencies and nested `.git` entries)
and refuses external targets or a linked worktree root. Do not bypass that refusal
with native recursive removal. Preserve local data, detach the shared install
without following its links, then inspect again. If native removal reports an
error, recheck both registration and disk state: it can unregister a tree while
leaving files behind. Never compensate with a recursive force deletion.

Agree file ownership for concurrent changes. Ownership belongs to the current
slice, not permanently to a bot persona. One implementer owns the production code,
tests, migrations and documentation needed to deliver that slice. Use an
independent reviewer for meaningful behavior and architectural changes. Reviewers
may add adversarial tests; implementers write their own regression tests too.

The slice owner may edit its code, tests and documentation. Independent review
checks the result. Historical exclusive file-role gates are retired; an existing
brief does not block an authorized implementation.

## Deliver and review

1. Identify the observable gap, relevant contract and smallest complete slice.
2. Implement through the existing UI, API, persistence and worker boundaries.
3. Test the actual failure or outcome, including unsupported runtime capabilities.
4. Run the applicable gates in AGENTS.md on the exact tree being delivered.
5. Obtain independent review, resolve findings and record evidence on the item.
6. Push the branch. Land only under AGENTS.md's existing green-CI and integration
   rules. Preserve the owner's standing authorization; never force-push.

An implementer remains responsible for getting the slice reviewed. A completed
implementation does not wait indefinitely for a ceremonial role handoff. If a
reviewer is unavailable, state that specific blocker and use an available
independent reviewer; do not invent acceptance or claim the item is closed.

Repository review/landing and product task acceptance are different actions.
Product tasks still require owner acceptance; a development role cannot accept an
in-product task merely by merging a branch.

## State and evidence

The repository and CI are the development record. Personal OS stores in-product
work. An optional future link may connect their identifiers, but neither record is
reconstructed from the other, and the development record is not copied into the
product as a second scheduler.

Preserve code, data and branches. Reassess prior work against the roadmap when
selected: inspect source and unmerged changes, keep useful fixes and identify
duplicates. Historical work-item narratives are available in Git, not a second
active backlog. Never relabel removed records as accepted. Build queue tooling
only for a demonstrated delivery problem.

Evidence names the tested revision, commands, results, limitations and concrete
output. Tests of prose or source-line locations do not establish product behavior.
Protocol libraries and maintained SDKs are preferred over handwritten protocol
clients. Product inspirations do not require adopting their entire application or
runtime. Check licenses for any actual reuse.

## Release and recovery

Release execution stays outside the product. Keep migrations reviewed and preserve
user data; a code rollback alone does not undo schema changes. Prove backup/restore
and restart behavior before describing recovery as guaranteed. An agent inside the
product may propose a change, while the external development and release path
implements and applies it under the owner's authority.

## Historical evidence

Retired plans, bot role briefs and process narratives are removed from the active
tree. Git preserves the original files at 507708b. Read historical evidence only to
resolve a concrete implementation question; current work follows the roadmap.
Compact work-item records remain only where contract-status checks require them.
Their historical states are not active assignments and do not determine priority.
