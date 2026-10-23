# SPEC-R1-2 — The owner completes real work against a real, installed OpenCode runtime

**State:** open · **Owner:** implementing agent, with the owner driving the demonstration · **Verifier:** independent reviewer against this spec and the roadmap's release criteria
**Depends on:** SPEC-R0-1, SPEC-R0-3, SPEC-R0-4, and the ACP surface landing · **Adapter:** the ACP surface carried by `wi/160-opencode-acp`

## Outcome

The owner completes real work in the **same** web chat against a **real,
installed OpenCode runtime**, and the transcript of that session is the
evidence.

R1 asks for two runtimes precisely so that the interface is proven to be the
interface: not one harness with a different name, and not two interfaces
that happen to look alike. SPEC-R1-1 proves Codex; this one proves that what
was built for Codex is the product, and OpenCode is a second adapter rather
than a second product.

## The runtime is installed

Measured on this machine, not assumed:

```
opencode --version   →  1.19.4
```

As with Codex, `docs/roadmap.md`'s line that the other four approved
runtimes "are not installed here" is stale and should be corrected.

## Contract

- **The same interface.** The UI, the API and the persistence are the ones
  SPEC-R1-1 demonstrated. Nothing in the client branches on the runtime.
- **The ACP surface is a client of ACP.** The adapter speaks the protocol
  OpenCode publishes, through a maintained client where one exists — not a
  reinterpretation of it.
- **The runtime's own event stream is read, not invented.** The adapter
  emits only events it can genuinely observe.
- **Differences are stated, not smoothed over.** Where OpenCode exposes less
  than the chat baseline, the capability row says which, the panel explains
  it, and the record keeps the difference visible. The baseline is a floor,
  not a claim of parity.
- **The version is pinned and recorded.** The demonstration names the version
  it ran against.

## Acceptance

The owner, in the web chat, against OpenCode 1.19.4:

1. Connect, select a project and begin a conversation.
2. Ask for a small file or code change. Observe streaming text, native tool
   activity and an inspectable output or diff with provenance.
3. Send a follow-up during the work. Demonstrate steering where the runtime
   supports it and visible queueing where it does not.
4. Resolve a real permission request or user question in the conversation,
   or demonstrate the documented limitation and the alternative.
5. Stop a run, and show its confirmed state or the uncertain remote outcome.
6. Close and reopen the browser, and continue the same conversation and
   session. Restart the worker during a controlled run, and reconcile it or
   hold it unknown without a duplicate side effect.
7. Attach a file or image and inspect an output preview where supported.
8. Reopen the persisted history with its tool and result references intact.

And, for the product as a whole:

- Adding the OpenCode adapter changed **no** conversation storage and **no**
  task-provider logic. That is the acceptance the roadmap states for R2, and
  it is asserted by the diff, not by intent.

## Evidence

A demonstration transcript, committed with the slice, that names the runtime
and its version (`1.19.4`), the commands that were run, the output that was
produced, and the limits that remained.

The repository's gates pass on the delivered revision, and the browser suite
passes against the built client.

## Not in scope

- Changing the chat interface to suit OpenCode. The interface is the
  product; the runtime is an adapter.
- Pi, Hermes and OpenClaw. They have their own specs.
- The factory, the goals board and the dashboards.
- An externally hosted agent connection. R2 asks for one; this spec is about
  a local runtime.
