# 1. Modular monolith with a separate supervised execution process

**Status:** accepted

## Context

Personal OS runs code it does not control: a CLI agent is a local program, a gateway
is a remote system, an MCP client may behave unexpectedly. At the same time, the
product must stay small enough for one person to install and understand.

Two failure modes had to be avoided:

- an agent taking down the API server,
- a growing set of network services that make installation a chore.

## Decision

Personal OS is a modular monolith (one Node.js process, one codebase, modules
separated by concern) plus a **separate worker process** that performs all agent
execution.

The API server never constructs an adapter and never spawns a process. It creates an
`executions` row and enqueues a job. The worker claims the job, runs the adapter, and
writes the result back to the shared database.

## Consequences

- A crashed or hostile agent cannot take the API server down with it.
- The server can be restarted without interrupting running work.
- Two processes must agree on the database, which constrains the persistence design
  (see ADR 2) and the event transport (see ADR 5).
- There is still no broker to deploy: the queue is a table.
