# SPEC-R2-1 — Pi keeps its own capabilities in the room

**State:** delivered — the product speaks Pi's own protocol, and the route is
proved against the repository's own double of Pi · **Owner:** implementing
agent, one session · **Verifier:** independent reviewer
**Depends on:** SPEC-R1-4 (the shape of a runtime's own protocol reaching the
room) · **Blocks:** nothing yet
**Evidence:** [the gate](../../scripts/verify-pi-route.ts), [the adapter's
tests](../../packages/agent-adapters/src/__tests__/pi.test.ts), [the
matrix](../adapters.md)

## The gap

**Pi's protocol was not implemented, and the product's own record said so.** The
preset the owner starts Pi from said it in its own words:

> Pi's own protocol carries more than a prompt — steering, settled execution,
> session selection — and none of that is implemented here: this template starts
> the process and writes the prompt to it.

So Pi was a target, not an integration. The runtime's capabilities — the
streaming text, the tools it ran, whether it has settled, the session it is in,
a steer that arrives while it is working — stayed in the runtime, and the room
got a prompt and some text. **Q3 asks for one cohesive conversation interface
that preserves each harness's capabilities.** A route that writes a prompt to a
process does not preserve anything.

## What Pi's protocol is

Read from Pi's own published documentation for **1.4.0**
(`packages/coding-agent/docs/rpc.md`, `rpc-commands.md`, `json.md` and
`rpc-types.ts`), because the protocol is the contract here and a route written
against a guess is a route written against nothing.

**A session, not a prompt.** Pi runs as a long-lived subprocess: commands go in
on standard input, responses and session events come out on standard output,
and every record is one JSON object on one line.

| Direction | Record                 | What it is                                   |
| --------- | ---------------------- | -------------------------------------------- |
| stdin     | `prompt`               | ask Pi a question, with images               |
| stdin     | `steer`                | give Pi something new while it is working    |
| stdin     | `follow_up`            | give Pi something for after it finishes      |
| stdin     | `abort`                | stop the run                                 |
| stdin     | `get_state`            | ask which session Pi is in                   |
| stdin     | `switch_session`       | go back into a session                       |
| stdout    | `response`             | the answer to one command, matched by its id |
| stdout    | `message_update`       | the assistant's text, as a delta             |
| stdout    | `message_end`          | the assistant's finished message             |
| stdout    | `tool_execution_start` | a tool the runtime is running                |
| stdout    | `tool_execution_end`   | that tool, finished                          |
| stdout    | `agent_settled`        | Pi will not continue by itself               |
| stdout    | `extension_ui_request` | an extension asking the user something       |

**Three things in that table decide the route's shape.**

**The prompt's answer is not the end of the work.** A successful `prompt`
response means the prompt was accepted, queued or handled — `data.disposition`
says which. Pi's own words: _"A successful `prompt` response means the prompt
was accepted, queued, or handled. It does not mean model work completed."_ The
end of the turn is `agent_settled`, not the response.

**The end of the turn is `agent_settled`.** `agent_end` closes one low-level run;
retries, compaction recovery, steering and follow-up work can still follow.
`agent_settled` means Pi will not continue automatically. So the turn ends when
Pi settles, and a prompt that Pi _handled_ — an extension command, an input
handler — ends the turn at once, because no run started and no `agent_settled`
will come.

**The framing is strict JSONL, split on LF only.** Pi's own documentation is
emphatic about it, and it is right: a record may hold the Unicode line and
paragraph separators, and a generic line reader that treats them as boundaries
splits a record in two.

## The shape

**The contract grows additively.** `adapterTypeSchema` gains `pi`, and the
configuration for it gains a row: the command, the arguments, the working
directory, the environment, the provider and the model, whether the session is
kept, and the timeout. A connection written before this existed still parses,
and no shape was reinterpreted.

**The route is a new adapter, not a new product.** It goes through the same
registry, the same worker, the same conversation storage and the same factory
task model. A new adapter type is addable without changing any of them, and
this one changed none of them.

**The mapping is a pure function.** `mapPiEvent` turns one of Pi's records into
the product's events, so the mapping can be tested without a runtime — a mapping
that could only be tested by running Pi would be a mapping nobody would test.
The process that produces the records is separate from the mapping that reads
them.

**The arguments that make Pi a session are the route's own.** A connection that
names its own `--mode` or `--no-session` is refused, rather than silently
starting a different surface than the one the route was written for.

**What the protocol says about the prompt is in the response, not in an event.**
Pi answers a command with a record that carries the id the command carried, and
the client resolves that record to the command it answers — it is not an event
the session carries, so nothing else ever sees it. The disposition that says
whether the prompt was _accepted_, _queued_ or _handled_ lives there. A route
that looks for it among the session's events never finds it, and a prompt Pi
handled itself starts no run, so no `agent_settled` ever comes: the turn does
not end, it hangs until the timeout. The gate checks that path by name.

## The gate

`npm run verify:pi-route` drives the **built** adapter against the
repository's own double of Pi, and checks:

1. The build the gate exercises is the build of this tree.
2. The turn carries the answer, the tools and the end of the turn.
3. A prompt Pi handled itself ends the turn at once.
4. The session continues: the next turn resumes it through the runtime.
5. A steer reaches the run that is going.
6. A picture crosses as bytes.
7. The preset carries the route's capabilities, and claims no demonstration it
   does not have.
8. The matrix agrees with the code.

The gate runs in the CI fast lane, because a gate that only runs on the machine
that wrote it is a habit.

## Acceptance

1. A turn on the Pi route carries the runtime's answer as it streams, and the
   finished answer when the runtime's own message ends. — **met**.
2. A turn on the Pi route carries the tools the runtime ran, one call one row.
   — **met**.
3. A turn on the Pi route ends when Pi settles, and when Pi handled the prompt
   itself. — **met**.4. The next turn in the same conversation resumes Pi's session through the
   runtime. — **met**.
4. The owner's message that arrives while Pi is working reaches the run, as
   Pi's own `steer`. — **met**.
5. A picture the owner attached crosses as bytes. — **met**.
6. The preset says what the route is, and claims no demonstration it does not
   have. — **met**.
7. `npm run verify:pi-route` passes, the adapter's tests pass, and the whole
   suite passes. — **met**.

## Evidence

### What landed

| What                                                         | What it does                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `packages/contracts/src/agent.ts`                            | The `pi` adapter type.                                                 |
| `packages/contracts/src/adapter-config.ts`                   | The configuration for it.                                              |
| `packages/contracts/src/adapter-presets.ts`                  | The capability row, and the preset the owner starts Pi from.           |
| `packages/agent-adapters/src/pi.ts`                          | The route: the client, the mapping, the session, the steer, the abort. |
| `packages/agent-adapters/src/__tests__/fixtures/fake-pi.mjs` | The double of Pi, which frames its records the way Pi frames them.     |
| `packages/agent-adapters/src/__tests__/pi.test.ts`           | The route's own tests.                                                 |
| `scripts/verify-pi-route.ts`                                 | The gate, in the fast lane.                                            |

### The tests that fail without the route

The route is new, so the proof is not "the tests fail without the fix" but
"the tests fail without the route": with the adapter's mapping stubbed out, the
turn carries no answer, no tools and no end, the session does not continue, the
steer does not arrive, and the picture does not cross. The gate says each of
those by name.

## What is not covered

- **The demonstration against an installed Pi.** Pi is not installed in this
  repository, and a double is not a runtime. The route is proved against the
  protocol Pi publishes; that it works against Pi itself is the outstanding
  evidence, and the preset says so in its own words rather than claiming a
  demonstration it does not have.
- **Pi's extension questions.** The `extension_ui_request` records an extension
  sends when it needs the user are not carried, so the capability row says the
  route cannot ask the owner for permission. Carrying them is its own work: the
  request has to reach the room, and the owner's answer has to go back as
  Pi's `extension_ui_response`.
- **Pi's compaction and retry records.** The room shows the work; a retry is
  the runtime's own business, and a compaction summary is the runtime's own
  memory.
- **The provider.** Pi's own credential and model are Pi's business, and the
  panel holds neither.
