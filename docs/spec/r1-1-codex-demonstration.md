# SPEC-R1-1 — The owner completes real work against a real, installed Codex runtime

**State:** open · **Owner:** implementing agent, with the owner driving the demonstration · **Verifier:** independent reviewer against this spec and the roadmap's release criteria
**Depends on:** SPEC-R0-1, SPEC-R0-3, SPEC-R0-4 · **Adapter:** `packages/agent-adapters/src/codex.ts`

## Outcome

The owner completes real work in the web chat against a **real, installed
Codex runtime** — the same conversation, the same panel, the same answer —
and the transcript of that session is the evidence.

This is the acceptance the chat-first recovery named, and the repository's
own record of the requirement is explicit:

> The Echo agent, `fake-codex-agent.mjs` fixtures and protocol replays are
> tests, not evidence. The evidence is a demonstration transcript naming the
> runtime version, the commands run, the output produced and the limits that
> remained. A fixture run labelled as a real-runtime proof fails review.

The fixture is a test. The demonstration is the proof.

## The runtime is installed

Measured on this machine, not assumed:

```
codex --version   →  codex-cli 0.163.0
```

`docs/roadmap.md` still says the other four approved runtimes "are not
installed here". That line is stale for Codex, OpenCode and Hermes, and it is
wrong for the stage it describes. This spec removes that excuse from the
record: Codex is here, and the demonstration runs against it.

## Contract

- **One interface, no provider branches.** The same UI, API and persistence
  flow serves Codex and OpenCode. Runtime-specific behaviour stays in the
  adapter.
- **The runtime version is pinned and recorded.** The demonstration names the
  version it ran against, and the adapter matrix records what was verified
  against it.
- **Nothing is claimed that was not observed.** Where Codex does not expose a
  capability the baseline needs — an in-conversation permission question, for
  instance — the product says so and offers the supported alternative. A
  fabricated request is not evidence of runtime support.
- **Credentials stay out of the transcript and the logs.** A shared transcript
  is Personal OS's; private native context belongs to the harness.

## Acceptance

The owner, in the web chat, against Codex 0.163.0:

1. Connect, select a project and begin a conversation.
2. Ask for a small file or code change. Observe streaming text, native tool
   activity and an inspectable output or diff with provenance.
3. Send a follow-up during the work. Demonstrate steering where the runtime
   supports it and visible queueing where it does not, and distinguish
   received input from submitted input.
4. Resolve a real permission request or user question in the conversation.
   Where Codex exposes none, demonstrate the documented limitation and the
   alternative — and say plainly which happened.
5. Stop a run, and show its confirmed state or the uncertain remote outcome.
6. Close and reopen the browser, and continue the same conversation and
   session. Restart the worker during a controlled run, and reconcile it or
   hold it unknown without a duplicate side effect.
7. Attach a file or image and inspect an output preview where supported.
   Unsupported modalities have clear UI behaviour; Codex is not presented as
   image-capable without a real demonstration.
8. Reopen the persisted history with its tool and result references intact.

## Evidence

A demonstration transcript, committed with the slice, that names:

- the runtime and its version (`codex-cli 0.163.0`),
- the commands that were run,
- the output that was produced,
- the limits that remained.

The repository's gates pass on the delivered revision, and the browser suite
passes against the built client.

## Not in scope

- The Codex adapter itself, unless the demonstration shows it is wrong. A
  defect found here is fixed by its own slice.
- Pi, Hermes and OpenClaw. They have their own specs.
- The factory, the goals board and the dashboards.
- A feature that the demonstration does not need. The baseline is the work.
