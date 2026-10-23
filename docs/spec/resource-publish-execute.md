# SPEC-RESOURCE-RUN — Publishing and executing a resource stop claiming they happened

**State:** delivered · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-P0 (the audit named these two rows) · **Blocks:** SPEC-S2 batch 2

## Outcome

When the owner publishes a resource or executes one, the product says what
actually happened.

Today, for most resource kinds, it says it happened either way: the UI
reports a publish and a run, and the server performs neither. The audit
measured it and named it:

> _Publish a resource_ — broken-window — the UI says it published; for most
> kinds nothing was published.
>
> _Execute a resource_ — broken-window — the UI says it ran; for most kinds it
> did not.

A broken-window is worse than a human-only surface. A human-only surface
admits it is not there; a broken-window tells the owner it worked.

## Why it is its own spec

SPEC-S1 named the rule:

> anything the audit marks broken-window — those become their own named specs,
> not drive-by fixes.

This is the first of them. It is not parity work: the question is not "can an
agent do this" but "does the product tell the truth when the owner does".

## What the fix can be

There are three honest answers, and the slice decides which one applies per
resource kind:

1. **It works, and now it says so.** The operation is implemented for that
   kind, and the response carries the result.
2. **It does not work, and now it says so.** The operation is refused for
   that kind with a reason the owner can read, and the UI shows the refusal.
3. **It is not a capability of that kind, and the contract says so.** The
   route is published only for the kinds that support it.

What is not acceptable is the third path the code takes today: performing
nothing and reporting success.

## Contract

- **The response carries what happened.** A publish that published, an
  execute that ran, and a refusal that refused are three different, visible
  outcomes.
- **The UI believes the server.** The panel does not render a success the
  response did not claim.
- **The contract says which kinds support it.** If a kind cannot be
  published or executed, that is published in the contract rather than
  discovered by the owner.
- **The audit's row flips.** _Publish a resource_ and _execute a resource_
  move from broken-window to exposed-paired (if the owner path is fixed and
  an agent path exists), to human-only (if the owner path is fixed and no
  agent path exists yet), or to exempt with a reason.

## Gate

A shipped check that exercises publish and execute for **every** published
resource kind and asserts the response matches reality. A kind that claims a
publish without publishing one fails the gate.

The check is written against the resource kinds the contract publishes, so a
new kind cannot be added without answering the question.

## Acceptance

- Every published resource kind's publish and execute outcome is asserted by
  a test, and the response says what happened.
- The panel renders the outcome the response claimed. A refusal is visible
  as a refusal.
- The contract names the kinds that support each operation.
- The audit's two rows are re-measured and flip, and the parity gate's
  coverage table reflects the new truth.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- Adding resource kinds, or a publish pipeline for kinds that do not have
  one.
- The agent path for publish and execute. Whether an agent should be able to
  do these is SPEC-S2's question, and it is asked after the owner path tells
  the truth.
- The attachment upload, which the audit exempts: the bytes come from the
  browser, and there is no agent-side equivalent to a file picker.

## Evidence

Delivered on `feature/resource-publish-execute` at `53aa703`, based on
`origin/main` at `8f384b2`, with `origin/main` merged in at `968359a` and
`63e8b4a`.

**The answers, per kind.** The spec allows three, and the slice picks one per
kind per operation.

| Kind          | Publish                                       | Execute                                       |
| ------------- | --------------------------------------------- | --------------------------------------------- |
| `dashboard`   | **1 — it works, and now it says so.**         | **1 — it works, and now it says so.**         |
| `automation`  | **1 — it works, and now it says so.**         | **1 — it works, and now it says so.**         |
| `data-source` | **2 — it does not work, and now it says so.** | **1 — it works, and now it says so.**         |
| `document`    | **2 — it does not work, and now it says so.** | **2 — it does not work, and now it says so.** |
| `task`        | **2 — it does not work, and now it says so.** | **2 — it does not work, and now it says so.** |
| `memory`      | **2 — it does not work, and now it says so.** | **2 — it does not work, and now it says so.** |

**Answer 1 — it works, and now it says so** — for the five kind-and-operation
pairs the API already really did: a dashboard became visible, an automation
became active, an automation's run was enqueued, a data source's query ran, and
a dashboard's widgets' sources ran. Nothing about those was broken. What was
broken is that the answer said nothing, so the same `200` meant "published" and
"nothing happened". They now carry the outcome in the body.

**Answer 2 — it does not work, and now it says so** — for the seven pairs with
no act: a document has no publish pipeline and no run, a task has neither, a
memory has neither, and a data source has no publish pipeline. Building one is
the spec's own "not in scope" — _adding a publish pipeline for kinds that do
not have one_. So the route refuses the kind, with a reason the owner can read.

**Answer 3 was not used, and the decision is worth stating.** It would mean the
route is published only for the kinds that support it: a different route shape
per kind, or a split route table. That is a bigger contract change than the
spec's other two answers, and the spec's own wording makes the refusal the
honest default — _"It does not work, and now it says so — refused for that kind
with a reason the owner can read, and the UI shows the refusal."_ What answer 3
would have added over answer 2 is the _contract naming the kinds_, and that is
done: the contract publishes the table above, the server refuses by it, and the
panel offers by it.

**The declaration.** `resourceOperationSupport` in
`packages/contracts/src/resource.ts` is keyed by every published kind, so a
kind added to `resourceTypeSchema` does not compile until it has been answered
for. The server reads it through `canPublishResource` and `canExecuteResource`
and refuses what it does not support; the panel reads the same two and offers
only the actions that can succeed. One declaration, two readers — the pattern
the waiting list already uses.

**The three outcomes.** A publish that published answers `200` with
`{ outcome: 'published', resource }`. An execute that ran answers `200` with
`{ outcome: 'succeeded', result: { output } }`; one that was accepted but has
not finished answers `{ outcome: 'queued', result: { output } }`, because an
automation's run is enqueued for the worker and it has not happened. A refusal
answers `400 bad_request` with the shared error envelope and a message that
names the kind, the operation and the kinds that do have it: _"A document cannot
be published. A dashboard and an automation can be."_ The refusal is raised in
the service and answered by the shared error handler, so a refusal is never the
same `200` as a success that did not happen.

**The gate.** `apps/server/src/__tests__/resource-publish-execute.test.ts`
drives publish and execute for **every** kind in `resourceTypeSchema`, over the
real HTTP routes of a real server on a real database, and asserts that the
response matches reality: a kind the contract says it can be published really
becomes live (`published: true` for a dashboard, `enabled: true` for an
automation, and its revision advances); a kind it says it can be executed
really runs (an automation's `automation.run` job is in the queue, a data
source's query answers with its rows, a dashboard's widget answers with its
source's rows); and a kind it says it cannot be **refused** — `400`, with a
reason, and with the resource left exactly as it was and nothing queued. The
per-kind tables in that file are keyed by every kind, so a kind added to the
contract does not compile until it has been answered for there, and the cases
are driven from `resourceTypeSchema` itself, so a new kind is exercised even
before the table catches it.

**The gate has teeth, and that was measured.** Flipping `document` to
`publish: true` in the declaration — the exact lie the audit measured — makes
the gate fail on two cases, one of them saying _"the contract says a document
can be published, and the gate has no liveness check for it"_. The declaration
was put back afterwards, and the gate passes.

**The panel.** `apps/web/src/__tests__/resourceOperations.test.tsx` holds the
panel to the same declaration: it offers Publish only for the kinds that can be
published and Execute only for the kinds that can be executed, it says what a
kind cannot do rather than leaving a gap, it renders the outcome the response
claimed, it does not say a queued run ran, and it shows a refusal as a refusal
— and claims no success in its place. One case reads the panel's own source and
fails if it declares the support again instead of reading the published one.

**The audit's rows.** _Publish a resource_ and _execute a resource_ were
**human-only** when this slice landed: the owner path told the truth, and no
agent path existed — `mcpToolNames` published no `resource.publish` and no
`resource.execute`. The audit's record then read **23 exposed-paired, 43
human-only, 0 broken-window, 17 exempt — 83 rows over 82 routes**, and the two
rows were re-measured in the audit with the evidence of both readings.
`scripts/mcp-parity.json` kept both routes `listed` against `SPEC-S2+`, with the
reasons restated: the route runs or publishes what the kind can do and refuses
the rest, and the agent path is SPEC-S2's question. **SPEC-S2 batch 2 has since
answered that question**: `mcpToolNames` publishes both names, the two routes
are `paired` in the coverage table, and the two rows are **exposed-paired**.

**The audit's counts and the coverage table now agree.** The audit records the
parity gate as reading **22 paired, 43 listed and 17 exempt**. That reading
comes from seven rows that move from `listed` to `exempt` in
`scripts/mcp-parity.json`: widening a tool grant, the three MCP-token routes,
the secret inventory, the file upload and the AG-UI envelope. They landed
separately, in PR #12, and `npm run verify:mcp-parity` read 22/43/17 on `main`
then. **SPEC-S2 batch 1 has since paired three more routes, and SPEC-S2 batch 2
two more, so the reading is now 27 paired, 38 listed and 17 exempt**; the two
routes this slice re-measured are `paired` with `resource.publish` and
`resource.execute`, and the agent path refuses the same kinds the route
refuses, with the same words.

**The gate readings below are the ones this slice answered on.** The table
records what each command answered on this slice's revision, before the seven
exemptions landed. The current reading is the one in the paragraph above.

**The commands, and what they answered.** The box was under load from a
background CPU load and two other agents' suites, so the timings below are the
load's, not the slice's.

| Command                                       | Result                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                        | All matched files use Prettier code style.                                                                    |
| `npm run build`                               | contracts, agent-adapters, server, worker and web all built.                                                  |
| `npm run typecheck`                           | Every workspace passes on its own. Run together, the web's `tsc` is killed for memory — see the limits below. |
| `npx vitest run` in `apps/server`             | 72 files, 735 tests. 731 passed; the four that failed are described below.                                    |
| `npx vitest run` in `apps/web`                | 27 files, 207 tests, all passed.                                                                              |
| `npx vitest run` in `packages/contracts`      | 6 files, 48 tests, all passed.                                                                                |
| `npx vitest run` in `packages/agent-adapters` | 5 files, 50 tests, all passed with `--testTimeout=120000`.                                                    |
| `npx vitest run` in `apps/worker`             | 11 files, 106 tests, all passed with `--testTimeout=120000`.                                                  |
| `npx tsx scripts/smoke.ts`                    | All smoke checks passed.                                                                                      |
| `npx tsx scripts/verify-contract-pointers.ts` | 195 pointers checked, 0 failures.                                                                             |
| `npm run verify:contracts`                    | 28 claims checked, 0 failures.                                                                                |
| `npm run verify:mcp-parity`                   | 82 routes published and registered, 23 tools, 22 paired, 50 listed, 10 exempt; 0 failures.                    |
| `npm run verify:bundle`                       | Every chunk within 300 kB and the first paint carries no page chunk.                                          |
| `npm run verify:dependencies`                 | Workspace manifests match the lockfile; npm reports a complete installed dependency tree.                     |
| `npx tsx scripts/verify-build.ts`             | The compiled server boots and serves requests.                                                                |
| `npm run verify:stack http://127.0.0.1:4333`  | A running deployment executed an agent's turn and the reply carried the adapter's output.                     |
| `npm run test:e2e`                            | 37 browser tests passed, on a port of their own — see the limits below.                                       |

**The four server failures, and what they are.** One was mine and is fixed:
`audit-outcome-vocabulary.test.ts` pins the contract's citation of the
automation run's enqueue, and my re-pointing moved it from `service.ts:619-624`
to `service.ts:653`; the pin now names the line that carries the claim, and the
file passes. The other three are the host, not the slice:
`agents.test.ts` ("records a failure instead of throwing when the adapter cannot
connect"), `prePush.test.ts` ("refuses removal of unmerged topic commits") and
`contractStatus.test.ts` all timed out at their own limits — 5 s, 5 s and 60 s
— and all three pass when the same files are run with a longer timeout. The
third is the case the repository already records: the contract-status gate runs
as a subprocess with a 60-second budget, and it took **177 seconds** on this
loaded box while passing with 0 failures when run on its own.

**The limits.**

- **The agent path did not exist when this slice landed, and that was a decision, not an
  omission.** `mcpToolNames` published no `resource.publish` and no
  `resource.execute`, so both were owner-only, and SPEC-S2 asked whether that
  should change. **It has**: SPEC-S2 batch 2 shipped both tools, and the agent
  path refuses the same kinds this slice made the route refuse, with the same
  words.
- **A publish pipeline for a document, a task or a memory does not exist.** The
  spec's "not in scope" says so, and this slice does not build one. What it
  does is stop the product claiming one happened.
- **The audit trail's own vocabulary is not changed.** The route still records
  `resource.published` and `resource.executed` with the trail's existing
  `success` result, because WI-033's vocabulary is a different slice's work.
  The route's _body_ carries the honest outcome; the trail's `result` column
  does not yet distinguish a queued run from one that ran.
- **A refused operation writes no audit entry.** The route's entry is written
  after the work, and a refusal is raised before it, so a refusal leaves no
  trace in the trail. That is the existing shape of every route that can be
  refused, and changing it is WI-033's work too.
- **The panel's refusal and the panel's failure look different on purpose.** A
  4xx is shown as _"The server refused: …"_ and anything else is shown as a
  failure, because calling a network fault a refusal would be the same kind of
  lie this slice exists to remove.
- **The whole suite was not run in one command.** `npm run test --workspaces`
  hangs on this box, so every suite was run on its own, one package at a time.
- **The browser tests need a port of their own on this box.** The first run of
  `npm run test:e2e` failed two of the thirty-seven tests, both of them
  reporting that the server behind the port was not answering. The Playwright
  config says why: several agents run the suite at once, and two sessions on
  one port empty each other's data directory. On a port of its own the whole
  suite passes — **37 tests, no failures**. The panel's own surface is not
  covered by a browser test in this slice: the editor's truth is held by
  `apps/web/src/__tests__/resourceOperations.test.tsx`, and the browser suite
  covers the surfaces it already covered.
