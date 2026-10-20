# 3. A shared contract package instead of duplicated types

**Status:** accepted

## Context

The same shapes cross several boundaries: the HTTP API, the MCP tool surface, the
worker queue payload, the adapter event stream and the web client. Duplicating these
types in each place guarantees they drift.

## Decision

`packages/contracts` holds the authoritative schemas (zod) and types for every shape
that crosses a boundary. Every other package imports from it.

The same package also holds the shared helper functions that must behave
identically on both sides of a boundary — `extractMentionTokens`, `resolveMentions`,
`contentToText`. The web client and the server therefore agree on what "@Codex"
means.

## Consequences

- A contract change is a change in one place, and the typechecker finds every
  consumer of it.
- Contracts are published: they are documented in `CONTRACTS.md` and changing one
  requires an explicit migration story, not just a code edit.
- The package is built before the apps, which adds a build step. `npm run build` at
  the root already orders it correctly.
