# 5. The event log is the stream

**Status:** accepted

## Context

The client needs live updates: streaming answers, task transitions, agent status.
Updates originate in two processes — the API server publishes some directly, the
worker publishes others while running an agent.

The obvious designs were a WebSocket between the worker and the server, or an
in-memory event bus in the server.

Both break in the same way: a restarted server loses everything the worker produced
while it was down, and a worker that starts after the server has no way to catch up.

## Decision

Every event is written to a table (`execution_events`) with a monotonic sequence
number. The SSE endpoint at `/api/events` tails that table.

The server publishes events it creates and polls the table for events the worker
created. Both travel the same path to the browser.

## Consequences

- A reconnecting client converges: the endpoint replays the fifty most recent events
  on connect, so nothing is permanently missed.
- Events survive a restart of either process.
- There is exactly one mechanism, not two. A bug in event delivery has one place to
  live.
- The cost is a 250 ms poll interval. That is invisible for a personal instance but
  would not scale to many clients — noted as a known limitation in
  `ARCHITECTURE.md`. A dedicated broker or a `NOTIFY`-based wake-up is the
  natural upgrade.
