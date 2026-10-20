# 2. One SQLite database for both processes

**Status:** accepted

## Context

The server and the worker need to share state: the server enqueues work, the worker
claims it, and both write messages, executions and events that the client reads.
The obvious options were a broker (Redis, NATS) and a relational database with a
separate queue.

Both add infrastructure to a product whose whole point is being easy to install.

## Decision

Use a single SQLite database, opened by both processes, in WAL mode with a busy
timeout.

- The queue is a table (`queue_jobs`) leased with a conditional update, so two
  workers can never claim the same job.
- The event log is a table (`execution_events`) with a monotonic sequence number.
- Schema and migrations are defined once, in `apps/server/src/db/schema.ts`, and
  reused by the worker through the `@personal-os/server/db` export.

## Consequences

- Deployment is two containers and one volume. No broker, no credentials for one.
- SQLite requires a local filesystem with reliable locking. The database must **not**
  be placed on a network share; this is called out in the README and the compose
  file.
- Write contention is possible between the two processes. WAL plus a busy timeout
  absorbs it at this scale; a much larger workload would need a different database.
