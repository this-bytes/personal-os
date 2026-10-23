# Directive — Gilfoyle, CTO (2026-10-23)

**Standing:** owner direction, 2026-10-23. This team builds what this file
directs. Outcomes here are requirements, not suggestions. Questions on scope
go to the owner through him; do not widen scope locally.

## 1. Priority: R0 then R1. Nothing else.

R2–R4 are **frozen** until the R1 demonstration below passes. Work items that
take on team rooms beyond WI-158's scope, factory narratives, visual language,
bot personas or new contract surface do not merge in this window.

R0 close-out is exactly what `docs/roadmap.md` names as remaining: shared
execution ownership across the chat, task and automation callers; authorised
dispatch; session references; restart reconciliation. One bounded vertical
slice each, in that order.

## 2. R1 acceptance — real runtimes only

R1 passes when the owner completes real work in the web chat against a
**real, installed runtime**, once each for Codex and OpenCode, with:
streaming output, tool activity trace, file/image artifacts, Markdown/code,
history restore, stop/cancel, and an in-conversation permission question
answered without losing the turn.

The Echo agent, `fake-codex-agent.mjs` fixtures and protocol replays are
tests, not evidence. The evidence is a demonstration transcript naming the
runtime version, the commands run, the output produced and the limits that
remained. A fixture run labelled as a real-runtime proof fails review.

## 3. Paperclip substitution gate

The owner's stated destination is one interface that retires Paperclip. That
gate is unchanged and is this repo's definition of "ready": the conversation,
task and resource layer must hold **live ANH work records with real
attribution and acceptance for one full cycle** before any replacement is
announced or used. Until then, deliverables are features, not a migration.

## 4. Repository discipline

- No direct-to-`main` commits while an integration merge is in flight. The
  mid-merge main observed today is the failure mode this rule prevents.
- One work item, one branch, one worktree, per `FACTORY.md`. Allocate the
  number only after reading `origin/main` refs **and** `.factory/work/`;
  WI-158 is taken by the room-decisions branch — verify, don't assume.
- No documentation-only change lands unless it removes a demonstrated
  delivery blocker or accompanies an implementation in the same slice.
  Process prose that outruns shipped checks is the pattern the chat-first
  recovery already recorded; it does not get a second run.
- Every submission carries an evidence block: revision, commands actually
  run, results, runtime versions, limitations, and the independent
  reviewer's verdict. A state label (`implement`, `done`, `accepted`) is a
  report, not proof.

## 5. Review

All merges go to Gilfoyle for review against this directive and the roadmap's
release criteria. Evidence gaps go back to the author naming the exact gap.
Nothing is announced complete to the owner before that review passes on the
delivered revision.

## 6. Next work items to open

1. `R0 — shared execution ownership` — one dispatch path serving chat, task
   and automation with identical authorisation, session and lifecycle
   behaviour.
2. `R0 — authorised dispatch` — the grant/capability decision taken at
   admission is the one enforced at execution; widening requires the owner's
   turn.
3. `R0 — session references` — durable references from conversation to
   runtime session; honest resume or a stated inability.
4. `R0 — restart reconciliation` — after restart, reconnect surviving runs or
   name the outcome uncertain. No blind replay.
5. `R1 — Codex demonstration` then `R1 — OpenCode demonstration` — per §2.

Open these with the `.factory/TASK.md` template once R0's current in-flight
slices (WI-156/157/158) land; do not collide with them.
