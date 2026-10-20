# 6. Event-triggered automations use the event log and a chain depth

**Status:** accepted

## Context

An automation can be triggered by a schedule, by an event, or by hand. The schedule
case works: the scheduler asks the database which automations are due.

The event case is harder, because an event may be produced by either process. The API
server publishes events when a person posts a message or edits a task. The worker
publishes events while running an agent. Both write to the same `execution_events`
table (see ADR 5).

The second problem is loops. If automation A reacts to `message.created` and writes a
message, and automation B reacts to `message.created`, the two can wake each other
forever. A system that can be made to consume itself is not acceptable in something
that spends money and runs commands.

## Decision

The worker owns an **event watcher**. It tails the event log and enqueues any enabled
automation whose trigger names the event that just happened. Because it reads the
log rather than subscribing in-process, an event published by the API server triggers
an automation exactly like an event published by the worker.

Two independent guards bound a chain:

1. **Only allowlisted events can be triggers.** `execution.event` fires for every
   piece of adapter chatter and `heartbeat` fires constantly; a trigger that carries
   no meaning should not be configurable at all. The allowlist lives in
   `packages/contracts` so the API, the UI and the worker agree on it.

2. **Every event carries a chain depth.** An event published at depth _d_ is stored
   with that depth. An automation started by an event at depth _d_ publishes its own
   events at depth _d + 1_, and the watcher ignores events at the maximum depth
   (3). So at most three automation hops can follow one another, whatever the
   automations are configured to do.

The depth lives in the event table rather than in memory, because the two processes
have to agree on it and a restart must not reset the count.

## Consequences

- An event-triggered automation fires within roughly half a second of the event.
  That is the watcher's poll interval, not a scheduling guarantee.
- The chain limit is a hard stop, not a rate limit: a legitimate chain that needs
  four hops does not run. Raising `MAX_CHAIN_DEPTH` is a one-line change, and the
  allowlist is the better place to widen the behaviour anyway.
- A restarted worker starts watching from the current end of the log, so it does not
  replay old events and fire every event-triggered automation at once.
- The trigger allowlist is a behavioural restriction on a trigger type that never
  worked before, so no existing automation is broken by it.
