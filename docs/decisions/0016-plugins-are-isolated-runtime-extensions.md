# 16. Plugins are isolated runtime extensions with their own storage

**Status:** accepted — owner direction, 2026-10-24. The mechanism is a spec that
does not exist yet.

## Context

The product needs to be extensible: functionality that extends it, stays
isolated, and can be spun up, developed and removed easily. The reason that is
possible at all is that the product already has the two things an extension
needs. The **first-class API** is the MCP tool surface over
`packages/contracts`, with grants and autonomy guards on every tool. The **event
engine** is the event log: a table with a monotonic sequence, a chain depth and
an allowlist of triggerable events.

What the product does not have is isolation. The roadmap records the honest
state: a CLI's `cwd` and a sanitized environment do not confine filesystem
access, and a UI workspace is not a sandbox. An extension that runs beside the
product and can reach the product's tables would not be isolated in any sense
that matters, and could not be removed without leaving rows behind.

The word _plugin_ was already in the tree, but only as an exclusion. `PRODUCT.md`
§12 and the recovery decisions both excluded "a plugin marketplace", and
[ADR 0011](0011-feature-slots.md) said a feature is "not a runtime loader for
third-party code" and has no lifecycle.

## Decision

**A plugin is a process the host starts and stops, with its own storage,
reaching the product only through the first-class API and the event engine.**

- **Own process.** The isolation is a process boundary and the plugin's own
  grant set — a claim the product can actually make, unlike the workspace
  boundary it cannot.
- **Own storage.** A plugin writes to its own file. "Removing a plugin leaves
  nothing behind" is then a fact rather than a cleanup routine, and the plugin
  cannot join the product's transaction, which it does not need.
- **First-class API and the event engine only.** The API is the only door in, so
  the surface a plugin may use is the surface the product already publishes and
  already guards. No table access, no domain services, no new core machinery.
- **Enabled and removed through the API.** Removal stops the process, deletes
  the plugin's storage and artifacts, and unregisters its tools.
- **First-party.** A plugin lives in this repository, is reviewed like the rest
  of it, is not installed from outside, and is not a distribution channel. **The
  existing exclusion of a plugin marketplace is unchanged.**

A **feature** stays what [ADR 0011](0011-feature-slots.md) made it: a build-time
surface of the panel, in this repository, with no lifecycle and no runtime
removal. Feature and plugin are different things, and
[glossary.md](../../glossary.md) says which is which.

## Consequences

- **The feature seam is untouched.** Two agents can still build two surfaces at
  once without editing a shared file, which is the property ADR 0011 exists for.
- **The plugin registry needs a table**, and every table belongs to exactly one
  domain. **Platform claims it.** The domain map stays at five.
- **Surface parity applies.** A plugin's capability is owner-facing, so
  [ADR 0013](0013-surface-parity-every-owner-capability-is-an-agent-capability.md)
  applies to it: the parity gate must see the plugin's tools, or a written
  reason why not.
- **The mechanism is a spec.** Process model, storage layout, packaging,
  discovery, the grant model and the removal semantics belong to a spec that
  does not exist yet. Until it does, the Plugins pillar is declared and its
  mechanism is unsettled — which is stated in the architecture rather than
  hidden.
- **This is not a marketplace and not third-party code.** If a plugin is ever
  to come from outside the repository, that is a different decision with a
  different threat model, and it deserves its own record rather than a sentence
  smuggled into this one.
