# 9. MiniMax Code is a specification, not a dependency

**Status:** accepted

## Context

The owner asked for MiniMax Code's desktop experience as the foundation for
Personal OS's interaction design, and for research into what could be
legitimately reused, ported or recreated.

The licence picture is not uniform, and two facts are easy to miss:

- The **CLI and harness are open source** at `github.com/MiniMax-AI/minimax-code`.
  First-party code defaults to MIT; `third_party/sandbox-runtime` is Apache-2.0;
  the Pi-derived terminal code, the model catalog and the bundled assets retain
  their own declarations. Version 0.4.12 was the MIT release, and the harness
  implementation was handed over with it.
- The **desktop application is not published at all.** That repository hosts
  issue reporting for the desktop app. There is no UI code to copy — the same
  kind of licence fact the landscape table already records for n8n's Sustainable
  Use and Dify's modified Apache.

The harness is also, by the owner's own account, where the missing pieces are.
Personal OS has no per-turn capability pinning, no context budgeting, no
canonical-history commit, no mid-turn steering, no session fork or rewind, and
no parent-child work tree.

## Decision

**Read and reimplement against our own contracts, attribute anything carried
over, and add no runtime dependency.**

The MiniMax source is treated as a _specification_. The patterns are
reimplemented in our own types, our own schemas and our own data model, and
tested against our own gates. Where an implementation is carried over rather
than rewritten, the file carries a header naming the upstream project, the
upstream file and the upstream licence, and `docs/strategy.md` gains a
landscape row saying what was taken and where it landed.

This keeps `FACTORY.md`'s rule intact — _borrow the idea, not the dependency_ —
and keeps the sharper half of it: an interface is conformed to, never
reimplemented. Personal OS already speaks ACP, A2A and MCP; it speaks them
rather than forking a dialect of one.

**The patterns split by boundary, because they are not one thing.**

Published as contract (client-visible):

- per-turn capability pinning, and the lease that rejects a stale execution;
- the five-step canonical history commit, and the separation of in-flight
  events from canonical history;
- delivery versus consumption, and `lost` for a delegated task whose executor
  has gone;
- steer and queue;
- session fork and rewind;
- the parent-child work tree for delegated work.

Left inside the worker (not client-visible, and a separate item):

- the context budget and the result archiver;
- the tool eligibility chain.

Ignored entirely, because they are a different product or a re-implementation
of something Personal OS has or deliberately does not do: the TUI, the macOS
sandbox backend, the Pi-derived model loop, the OAuth lease protocol,
`browser-core`, and the `mcode-tools` host.

**There is no desktop application.** MiniMax Code's desktop experience
contributes interaction _primitives_; the web client renders them. The product
stays a self-hosted server, a worker and a browser.

## Consequences

- **The interaction model is published as one contract revision before any
  code** (`CONTRACTS.md`, Contract 7). A model this large is easier to get
  right whole than in halves, and a contract is cheap to change while it is
  still prose. The implementation is one work item, sequenced after the
  interaction items already in flight.
- **The reuse is auditable.** The licence record is dated, because the upstream
  boundary moves with the next release; the desktop application is recorded as
  not published, which is the fact that forbids copying anything from it.
- **The risk of accidental dependency is real.** Porting harness patterns could
  pull in a model loop or a sandbox by accident — the "another agent harness"
  failure mode. The line is: no port crosses into provider or inference code,
  and `package.json` and the lockfile gain no dependency.
- **One thing the upstream gave us for free is a vocabulary.** Its `lost`
  status and its delivery-versus-consumption rule are the same honesty the
  `unknown` state already gives Personal OS, and the same rule the ledger
  already applies to evidence: delivered is not accepted.
