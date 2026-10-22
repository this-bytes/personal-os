# The reuse inventory

**What this is.** The record of what Personal OS's chat surface takes from
other people's code, what it keeps for itself, what it depends on, and what it
still has to build. It answers the question the owner asked: _what is reused,
what is ours, what is upstream, and what is genuinely missing?_

**How it was decided.** Discover, then evaluate, then adopt, then adapt, then
build only what is missing. Every candidate below was read at its own source —
the registry item, the published package, the licence file — before any of it
was taken. Where a claim here is not verified, it says so.

**Read with these.** [PRODUCT.md](../PRODUCT.md) says what the product owns.
[CONTRACTS.md](../CONTRACTS.md) publishes what crosses a boundary.
[AGENTS.md](../AGENTS.md) is the development contract. The licence ledger is
[dependency-licences.json](dependency-licences.json), and the test that holds
it honest is `apps/server/src/__tests__/licenceRecord.test.ts`.

---

## 1. The verdicts

| Candidate                            | Verdict                       | One sentence                                                                                                                                                                                         |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui `Trace`**                | **Adopted**                   | It is the primitive every ChatGPT-class step is built from, and Personal OS's activity record already is one.                                                                                        |
| **shadcn/ui `Code Block`**           | **Adopted**                   | It brings the copy button, the focusable panel and the diff markers, and a code block in a chat is one of the most-seen surfaces in the product.                                                     |
| **shadcn/ui AI Elements _patterns_** | **Adopted as the vocabulary** | Reasoning, Tool, Plan, Task, Queue, Subagent, Confirmation and Prompt Input are the specification for how these surfaces compose; the shapes Personal OS already publishes are checked against them. |
| **Vercel AI Elements**               | **Rejected**                  | Its own README says it is deprecated at the end of November 2026 in favour of shadcn/ui's version, and it is typed against the AI SDK's message model.                                               |
| **Vercel AI SDK (`ai`)**             | **Rejected**                  | It is the provider layer, it pulls a hosted gateway, and its closed unions cannot say `unknown`, `committed` or `lost`.                                                                              |
| **`@assistant-ui/react`**            | **Rejected**                  | It installs its own thread store, its own streaming protocol and a hosted-service client — three things this repository already has, or is forbidden from having.                                    |
| **`streamdown`**                     | **Deferred, with conditions** | It is the right answer for streaming markdown and it is not needed yet, because the renderer we have already handles the token stream.                                                               |
| **`react-markdown` + `remark-gfm`**  | **Rejected**                  | An eighteen-package pipeline in place of a zero-dependency parser, for the same streaming problem it does not solve.                                                                                 |
| **CopilotKit**                       | **Rejected**                  | Its runtime drags `ai`, `openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `graphql-yoga` and `hono` into the product core.                                                                            |

---

## 2. What was adopted

### 2.1 `Trace` — the primitive under the activity trace

**Upstream.** shadcn/ui's `Trace`, MIT licensed, fetched from the registry at
`https://ui.shadcn.com/r/styles/base-rhea/trace.json`. It is the base
primitive behind shadcn's AI Elements: the Reasoning, Tool, Plan, Task, Queue
and Subagent patterns are all compositions of it.

**Where it lives.** `packages/ui/src/trace.tsx`, owned by this repository, in
the same shape as every other primitive in `packages/ui`.

**What upstream gives that this repository did not have:**

- A named composition — `Trace`, `TraceLine`, `TraceIcon`, `TraceTitle`,
  `TraceDescription`, `TraceCollapsible`, `TraceCollapsibleTrigger`,
  `TraceCollapsibleContent` — with a documented role for each slot.
- A status vocabulary the primitive owns: `running`, `error`, `pending`, and
  nothing else. A row that has finished wears no status at all.
- The accessibility rules, which are upstream's own and are kept: the icon is
  hidden from assistive technology so the title is the accessible name; the
  status is in the title as well as in the colour, because colour alone is not
  a status; the disclosure is a real disclosure, with `aria-expanded` and a
  focus ring.
- A rule worth more than it looks: _status is shown with colour and motion, so
  put it in the title too_. Personal OS's trace had a colour and a dot and no
  word.

**What was adapted, and why:**

| Upstream                                                                          | Here                                                                  | Why                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn's colour tokens (`text-muted-foreground`, `text-destructive`, `ring-ring`) | this repository's (`text-slate-400`, `text-err`, `ring-slate-400/30`) | This repository has no shadcn token layer, and adding one would be a second vocabulary that can drift from the one the accent guard protects.                                                                                                            |
| Base UI's `Collapsible` (`@base-ui/react/collapsible`, the `render` prop)         | Radix's `@radix-ui/react-collapsible`                                 | This repository's primitives are Radix, with `asChild`. A second primitive library for one disclosure costs more than it is worth. Radix is what shadcn/ui's own collapsible has always wrapped.                                                         |
| `IconPlaceholder`, shadcn's multi-icon slot                                       | `lucide-react` directly                                               | This repository already uses `lucide-react`.                                                                                                                                                                                                             |
| the shimmer utility, a stylesheet concern                                         | `apps/web/src/index.css`                                              | The utility belongs to the stylesheet, and the repository keeps every colour and every utility in one file. It is quieter than upstream's: it passes over the text rather than over a panel, and it stops for a reader who has asked for reduced motion. |

**What is product-owned and stays here.** The _meaning_ of a row. The
primitive knows three states; it does not know that `unknown` means "it started
and nobody can say how it ended", and it must not: that is Personal OS's
honesty rule, and it is published in `packages/contracts/src/chat.ts`. The
mapping lives in `apps/web/src/lib/chat.ts` as `activityTraceStatus`, beside
`activityTone`, and it is a pure function that can be tested without a
browser.

### 2.2 `Code Block` — the code surface

**Upstream.** shadcn/ui's `Code Block`, MIT licensed, fetched from
`https://ui.shadcn.com/r/styles/base-rhea/code-block.json`.

**Where it lives.** `packages/ui/src/code-block.tsx`.

**What upstream gives:** the copy button with its polite live region, the
language header, the content panel that is a focusable `pre` reading left to
right so a keyboard can scroll it, line numbers that screen readers do not
read, and the diff variants where a changed line carries a `+` or a `−` as well
as a tint.

**What was adapted:** the syntax highlighter is omitted, on upstream's own
advice — upstream says the highlighter is optional and lives in a separate
hook, and a code block that only shows plain output stays small. A code block
here shows the code as it was written. The copy button takes optional labels,
so a block inside a chat message says "Copy the code" rather than the
ambiguous "Copy".

### 2.3 The patterns, adopted as vocabulary

shadcn's AI Elements are not a component library — they are pages that
describe how to compose the base primitives, and every page is published as
Markdown so that a coding agent can take the pattern. These are the ones that
describe surfaces Personal OS already has, and the vocabulary is now the
reference for them:

| Pattern                       | Personal OS's own surface                       | What the pattern says that ours does not                                                                          |
| ----------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Reasoning**                 | the activity trace                              | the step's own state belongs in the title, not only in its colour                                                 |
| **Tool**                      | the activity trace's rows                       | the row's title names the tool; the state is one of seven, and the row is a disclosure                            |
| **Subagent**                  | the delegation tree (`delegated_tasks`, WI-144) | a delegated run is a step in the parent's trace, not a separate room the owner has to find                        |
| **Plan**, **Task**, **Queue** | the factory's goals and tasks (WI-143)          | a plan and its steps are the same shape as a turn and its activities                                              |
| **Confirmation**              | the approvals (WI-039)                          | a pending approval is a question for the owner, and it sits _outside_ the trace — it is not a step the agent took |
| **Prompt Input**              | the composer                                    | the composer is a prompt input, and the stop control is part of it rather than beside it                          |

The Confirmation pattern's placement is worth stating, because it is a rule
rather than a component: **a question for the owner is not a step the agent
took.** Personal OS already puts approvals on the waiting list and not in the
trace, and the pattern says that is right.

---

## 3. What was rejected, and on what evidence

### 3.1 `@assistant-ui/react` — rejected

MIT, React 19 compatible, and the headless primitives are genuinely headless.
But installing it pulls, as ordinary runtime dependencies:

- `zustand` and `@assistant-ui/store` — a second conversation store. This
  repository's conversation store is the canonical history in
  `packages/contracts/src/conversation.ts` and the event log behind it.
- `assistant-stream` — a second streaming framework and wire protocol.
- `assistant-cloud` — a client for a hosted service. `AGENTS.md` forbids a
  third-party hosted dependency without a demonstrated need.

The package is 1,307 files and 2.8 MB unpacked. Its message model has three
roles — `user`, `assistant`, `system` — and Personal OS's conversation is a
routed group of agents, so its identity model cannot express a room.

**What was taken instead:** the idea of an external-store adapter — the seam
where a host drives a chat runtime from its own event source. Personal OS
already has that seam: `ChatActivityReadModel` and the `/api/executions/:id`
route. The primitive does not need a runtime to be reusable, and the runtime
was the part that could not be reused.

### 3.2 The Vercel AI SDK (`ai`) — rejected

Apache-2.0, and the AI Elements are built on it. It is 704 files and 8.3 MB
unpacked, it depends on `@ai-sdk/gateway` — a hosted Vercel service — and its
message model is a closed union that cannot say what Personal OS says:

| This repository                                         | The AI SDK                                               | The cost                                                         |
| ------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `unknown` — it started and nobody can say how it ended  | no equivalent                                            | the distinction has to be smuggled as an opaque data part        |
| `committed` — the turn's output is in canonical history | no equivalent                                            | the same                                                         |
| `lost` — settled, and never re-run                      | no equivalent                                            | the same                                                         |
| `runState`: `stopping`, `stopped`, `unsupported`        | `ChatStatus`: `submitted`, `streaming`, `error`, `ready` | four of six have nowhere to go                                   |
| `runControlOperation`: `stop`, `steer`, `queue`         | nothing                                                  | steering and queue are product concepts the SDK has no notion of |

`CONTRACTS.md` publishes each of those deliberately. Mapping onto a closed
union would be a contract regression, not a mapping inconvenience.

### 3.3 Vercel's AI Elements — rejected in favour of shadcn's

Its own README says it "will be deprecated at the end of November 2026 and
replaced by AI Elements from shadcn/ui". Adopting code its authors are
deleting means migrating it twice. It is also typed against the AI SDK in five
of its files.

### 3.4 `streamdown` — deferred, with the conditions written down

Apache-2.0, provider-free, and purpose-built for the incomplete-block case.
It is the right answer _if_ Personal OS's markdown renderer stops being able to
stream. It is not needed yet: `apps/web/src/components/chat/markdownBlocks.ts`
already parses the token stream, and it has tests.

It would also change two things that are not free to change:

1. **It wants shadcn's CSS variables.** Its own README warns that without
   `--background`, `--muted`, `--primary` and the rest, "components may render
   with missing backgrounds, borders, or incorrect spacing". This repository
   has no such layer, and the inventory's §4 explains why it should not grow
   one.
2. **It changes a published behaviour.** `CONTRACTS.md` publishes that raw
   HTML is shown as the characters it is. `streamdown` parses raw HTML with
   `rehype-raw` and neutralises it with `rehype-harden` and `rehype-sanitize`,
   which is a different and defensible rule, but a different rule.

**The conditions for adopting it:** the markdown renderer can no longer keep up
with the token stream, _and_ the raw-HTML rule is deliberately changed, _and_
the token layer question in §4 is settled.

### 3.5 `react-markdown` + `remark-gfm` — rejected

MIT, and no provider coupling. But it is a twelve-package unified/rehype/mdast
pipeline with no streaming-specific handling, in place of `marked` 18.1.1,
which is a zero-dependency parser this repository already uses. It costs
eighteen dependencies and gives back the problem.

---

## 4. The token layer: a decision, not an accident

Every candidate assumes shadcn's CSS variables: `--background`, `--foreground`,
`--primary`, `--secondary`, `--muted`, `--card`, `--popover`, `--border`,
`--ring`, `--destructive`, `--radius`. This repository has none of them. Its
token layer is a raw palette plus its own semantic names — `--color-accent`,
`--color-structure`, `--color-data`, `--color-ok`, `--color-err`,
`--color-caution` — and every colour in the web client lives in
`apps/web/src/index.css` and nowhere else.

There are two ways to let an adopted component render.

1. **Add a shadcn-compatible alias block** mapped onto this repository's
   values. One CSS block; every candidate then works unmodified.
2. **Rewrite the classes** onto this repository's tokens. Every adopted file is
   edited by hand, and edited again on each upstream refresh.

**This repository chose (2), for the two components it adopted.** The reason is
the accent guard: `apps/web/src/__tests__/accentGuard.test.tsx` exists because
"nothing in this repository asserted a colour until now, so the rule could
erode one pull request at a time and nothing would fail". A second token
vocabulary is exactly the kind of thing that erodes. The cost is honest and
recorded here: **the two adopted files are edited by hand, and an upstream
refresh is a manual merge rather than a copy.** Two files is a bounded cost.
Twelve would not be.

The rule that follows: **adopt a component when the product needs it, and
write it in this repository's tokens.** Do not buy a component by adding a
design system.

---

## 5. Product-owned integration code

This is the code that belongs to Personal OS and that no candidate can supply.
It is listed because it is the half of the answer that is not "reused".

| File                                                | What it owns                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/chat.ts`                    | the activity record, the run control, the stop outcome, the delegation tree. The published vocabulary every surface is drawn from.                             |
| `apps/web/src/lib/chat.ts`                          | the pure rules: an activity's tone, its trace status, its label, its duration, the grouping by turn, the count of turns. No DOM, so it is testable on its own. |
| `apps/web/src/components/chat/ActivityTimeline.tsx` | what a trace row _means_ — the dot's tone, the sentence, the caution and failure markers, the run's cost at the end.                                           |
| `apps/web/src/components/chat/Markdown.tsx`         | markdown drawn as text, and the mention that wears its agent's hue.                                                                                            |
| `packages/ui/src/forge.tsx`                         | the Forge visual language: the room, the counters, the panels.                                                                                                 |
| `apps/server/src/modules/executions/activity.ts`    | the read model the trace is drawn from.                                                                                                                        |

---

## 6. Upstream dependencies

The ledger is the authority: [dependency-licences.json](dependency-licences.json),
496 entries, one for every package in the lockfile, each with the file its
licence was read from and the evidence that identifies it. It is enforced by
`apps/server/src/__tests__/licenceRecord.test.ts`, and a licence outside the
approved set, or a count that drifts, fails the build.

**Added by this work:**

| Package                             | Licence | Why                                                                                                                                                                     |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@radix-ui/react-collapsible@1.2.1` | MIT     | the disclosure under `Trace`. Every one of its eight dependencies was already installed at the exact required version, so it added exactly one package to the lockfile. |

**Already there, and load-bearing:**

| Package                                              | Licence | What it is for                                                   |
| ---------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `marked@18.1.1`                                      | MIT     | the markdown parser, with zero dependencies of its own           |
| `clsx`, `tailwind-merge`, `class-variance-authority` | MIT     | shadcn's own utility stack, already the one this repository uses |
| `lucide-react`                                       | ISC/MIT | the icons                                                        |
| `@radix-ui/react-*`                                  | MIT     | the primitives under `packages/ui`                               |
| `react@19.1.10`, `react-dom`                         | MIT     | the runtime                                                      |
| `@tanstack/react-query`                              | MIT     | the server's data                                                |
| `react-router-dom`                                   | MIT     | the navigation                                                   |

---

## 7. Genuine gaps — what still has to be built

These are the surfaces in the brief that this repository does not have, or has
only in part. Each says what is missing and what it would cost.

| Gap                              | What is missing                                                                                                                                                                                                                                                        | What it would take                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A branching conversation**     | the contract publishes `origin.depth` and the delegation tree, and the forked turn is a turn; the client has no branch view and no way back.                                                                                                                           | the `MessageBranch` idea and the canonical history the contract already publishes. The server side of a fork is WI-055's. |
| **Suggestions**                  | an empty transcript says "No events yet." and stops.                                                                                                                                                                                                                   | shadcn's `Suggestion` pattern. Small.                                                                                     |
| **A committed turn**             | `TurnStatus` publishes `committed` beside `completed`, and only `completed` is ever written.                                                                                                                                                                           | WI-055's five-step commit. The vocabulary is published; the transaction is not.                                           |
| **Five native runtimes**         | Codex, OpenCode, Pi, Hermes and OpenClaw have presets — a configuration, a leader persona, capabilities — and **no runtime has been demonstrated**. Every preset is marked `verified: false`.                                                                          | the adapters themselves. This is the largest gap in the product and it is not a chat-surface gap.                         |
| **A real runtime demonstration** | the roadmap's R1 acceptance needs one of the named runtimes running, and none has been. The browser suite proves the whole chain — server, queue, worker, adapter, event log, stream — with the built-in `echo` adapter, which is a product adapter and not a runtime. | one runtime, one deployment, one recorded round trip.                                                                     |

---

## 8. What the next round should read first

The chat surface is not missing pieces. It has a message list, streaming
markdown, a tool trace, artifacts, presence, run controls, and — as of WI-144 —
a delegation tree and a bot mode. What it has is a **small amount of upstream
source that was written by hand when it could have been adopted**, and a
**published contract that says more than the code does** (committed, the five
runtimes).

The order that follows from this inventory:

1. **The runtimes.** Templates are not integrations, and the presets say so.

And one standing rule, learned from §4: **adopt a component when the product
needs it, write it in this repository's tokens, and keep the vendor's
composition intact so that a refresh is a merge rather than a rewrite.**

**And one correction, measured on 2026-10-22:** this inventory once said the
client had no attachment surface at all. It has one — the picker, the chips and
the preview in the transcript were all in the composer when the claim was
written, and only the upload path was missing. A gap list that says more than
the code has is the same defect as a false note, and it is corrected here
rather than carried forward.

**And a second correction, measured on the same day:** this inventory listed
steering as the largest gap between the published contract and the code, and an
upload path as the third. WI-152 closed the first and WI-151 the second — a
steer goes into the turn that is running, for a connection whose adapter
reported that it can take input mid-turn, and a file the owner chooses is
uploaded and becomes a resource the message points at. Both rows are struck
rather than reworded, because the rules the gaps asked for are now the rules
the code follows.

---

## 9. Sources

Every source below was opened directly.

**Adopted**

- `https://ui.shadcn.com/r/styles/base-rhea/trace.json` — the `Trace` source
  and its `data-slot` names.
- `https://ui.shadcn.com/r/styles/base-rhea/code-block.json` — the `Code Block`
  source.
- `https://ui.shadcn.com/r/styles/base-rhea/collapsible.json` — the upstream
  collapsible, and the proof that upstream's current style is Base UI.
- `https://ui.shadcn.com/docs/components/base/trace.md` — the component's own
  rules: the status vocabulary, the accessibility rules, the composition.
- `https://ui.shadcn.com/docs/components/base/code-block.md` — the highlighter
  is optional and lives in a separate hook.
- `https://ui.shadcn.com/docs/ai-elements.md` — "There is no package to
  install. Each pattern is a composition you copy into your project, and the
  code is yours." And the migration table.
- `https://ui.shadcn.com/docs/ai-elements/base/reasoning.md` and
  `…/base/tool.md` — the patterns, and the rule that a pending approval sits
  outside the trace.
- `https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md` — MIT.

**Rejected, with the evidence for the rejection**

- `https://registry.npmjs.org/@assistant-ui/react/latest` — `assistant-cloud`,
  `assistant-stream` and `zustand` as runtime dependencies; 1,307 files.
- `https://registry.npmjs.org/ai/latest` — `ai@7.0.148`, `@ai-sdk/gateway`, 8.3
  MB unpacked, `engines: node >= 22`.
- `https://registry.npmjs.org/assistant-cloud/latest` — the hosted-service
  client.
- `https://registry.npmjs.org/streamdown/latest` — Apache-2.0, and the
  dependency list including `rehype-raw`, `rehype-harden` and `rehype-sanitize`.
- `https://raw.githubusercontent.com/vercel/ai-elements/main/README.md` — the
  deprecation notice.
- `https://raw.githubusercontent.com/vercel/ai/main/packages/ai/src/ui/ui-messages.ts`
  — the closed `UIMessagePart` union.
- `https://registry.npmjs.org/react-markdown/latest` — the twelve-package
  pipeline.

**This repository**

- `apps/web/package.json`, `apps/web/src/index.css`, `packages/ui/*` — the
  styling stack, the token layer, the `cn` helper, the Radix base.
- `packages/contracts/src/chat.ts`, `packages/contracts/src/agent.ts`,
  `packages/contracts/src/conversation.ts` — the published vocabulary.
- `apps/server/src/__tests__/licenceRecord.test.ts`,
  `docs/dependency-licences.json` — the licence ledger and its gate.
- `apps/web/src/__tests__/accentGuard.test.tsx` — why the token layer was not
  added.
