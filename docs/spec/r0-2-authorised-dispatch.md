# SPEC-R0-2 — The grant decision taken at admission is the one enforced at execution

**State:** open · **Owner:** implementing agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-R0-1 (one execution owner) · **Blocked by:** the grant editor's save (`docs/spec/grant-editor-save.md`) · ADR 0013 is the rule

## Outcome

An agent's authority is decided **once**, at the moment its turn is admitted,
and the decision that was taken is the one that is enforced while it runs. A
grant the owner widens reaches the agent's next tool call and its next turn;
it does not reach the turn that is already running, and the panel says which
of the two it is talking about.

The roadmap names this as R0's second bounded slice:

> Define explicit authorized task dispatch through the shared service and MCP.
> Task creation stays non-executing. Duplicate dispatch cannot start two runs.

## Why it is blocked

The panel's grant editor has an open defect that makes the owner's decision
**unreliable at the moment it is made**: the connection id is frozen at the
first render, so the editor can be pointed at one connection and save
another's grant. The measurement is in `docs/spec/grant-editor-save.md`.

R0-2 is about the owner's decision being enforced. Building that on a path
where the owner's decision is itself written to the wrong connection would
enforce the wrong authority. The defect is therefore fixed first, and this
spec starts when it is.

## The shape today

`docs/recovery.md` records the gap in the repository's own words:

> MCP task.create can store assigneeId without enqueueing execution; the tool
> list has no task.assign. Preserve create semantics; add an explicit
> authorized dispatch operation with idempotency rather than making creation
> silently run work.

So today a task can name an assignee and nothing runs. That is the correct
default — creation is not execution — and the missing piece is an explicit
dispatch that is authorised, idempotent and observable.

SPEC-S1 has already established the grant model this spec enforces: the
published tool set separates read verbs from the verbs that spend an
authority (`bot.dispatch`, `approval.decide`, `execution.stop` are not in the
default grant set; the owner grants them one by one). This spec uses that
model; it does not invent a second one.

## Contract

- **An explicit dispatch operation.** Creating a task stays non-executing.
  A separate, published operation dispatches it, and it is the only way a
  task starts running.
- **The admission decision is the enforcement.** The capability and grant set
  a turn is admitted against is pinned at admission and is what the turn runs
  against. A change to a capability or a grant takes effect on the **next**
  turn, not underneath the one that is running.
- **The MCP token names its connection.** A grant the owner widens reaches
  the agent's next tool call as well as its next turn. This is not a
  per-turn sandbox, and the contract says so rather than implying an
  enforcement that does not exist.
- **Duplicate dispatch cannot start two runs.** Dispatch carries an
  idempotency key, scoped to the caller. The same key with the same content
  yields one run; the same key with different content is a conflict, not a
  second run.
- **Delegation cannot widen permission.** A delegated child runs with the
  authority of its parent's grant set, intersected with its own — never a
  superset.
- **The panel says what the turn was admitted with**, and the agent's own
  card says when that set last moved.

## Gate

A shipped check that counts the writes which change a grant, so the
published "one write" is held by something that would notice it breaking.
The check runs in CI on the delivered revision.

A second gate: two identical dispatches with the same idempotency key yield
one execution row and one run. The gate fails if a second run appears.

## Acceptance

- A dispatch with the grant the owner gave runs. A dispatch without it is
  refused, and the refusal is recorded the way every ungranted call is
  recorded.
- Two simultaneous identical dispatches yield one child. Changed content
  under the same key conflicts, and the conflict is reported.
- The returned result wakes only the requesting coordinator.
- The grant the owner widens reaches the next turn and the next tool call,
  and the panel shows the turn's admitted set.
- The check that holds the published "one write" runs in CI and would fail if
  the write stopped being one.
- The applicable repository gates pass on the delivered revision.

## Not in scope

- **Changing the grant model.** Parity means exposing the model that exists.
  No new authority kinds, no second permission system.
- The resource and automation surfaces. They consume the decision; they do
  not change it.
- New UI screens beyond what the decision needs to be legible.
- The factory's goal and task rollup, and the board.
