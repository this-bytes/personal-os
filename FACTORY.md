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

Agree file ownership for concurrent changes. Ownership belongs to the current
slice, not permanently to a bot persona. One implementer owns the production code,
tests, migrations and documentation needed to deliver that slice. Use an
independent reviewer for meaningful behavior and architectural changes. Reviewers
may add adversarial tests; implementers write their own regression tests too.

Chief, Cog, Probe and Wren are optional names for responsibilities. No agent needs
to dispatch to one of those names to make progress. The old exclusive test-file and
documentation ownership rules are retired. Existing briefs using those names are
historical context, not an authority to block an authorized implementation.

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

Preserve existing work-item files and branches. Reassess them against the roadmap
when selected: keep useful work, identify duplicates and inspect unmerged changes.
Do not bulk-delete or relabel old work as accepted. Build queue tooling only when a
specific delivery problem justifies it; it is not the first recovery milestone.

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

## Historical record

The [previous factory doctrine](docs/history/factory-before-chat-recovery.md)
retains the original procedures and observations. It is not an active workflow.
The owner's recovered direction takes precedence over its role gates and priorities.
