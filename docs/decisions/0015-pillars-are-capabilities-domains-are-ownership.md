# 15. Pillars are product capabilities; domains are module ownership

**Status:** accepted — owner direction, 2026-10-24.

## Context

The repository already has an enforced ownership map. [ADR 0008](0008-five-domains.md)
puts every module and every table into one of five domains, and
`apps/server/src/domains.test.ts` fails the build on an import or a table that
nobody claimed. That map answers one question well: _who owns this file_.

It does not answer the other question that matters when several agents work at
once: _what work is this_. The roadmap's stages are capabilities — rich chat,
the five runtimes, autonomous teams, the factory — and a capability does not sit
inside one domain. Rich chat touches Interaction, Runtime and the substrate. The
result was that an agent could be given a task with no unit attached, two agents
could reach for the same area, and neither the map nor the roadmap stopped them.

The map was also going to be read by an agent who had never seen the codebase.
A document that describes a technical layout tells such a reader where the files
are and nothing about what the product is trying to become.

## Decision

**Two axes, each with a job, and neither replacing the other.**

- A **pillar** is a unit of product capability — the thing a person can be said to
  own. There are seven: Chat, Runtimes, Teams, Factory, Resources, Platform and
  Plugins. A pillar is the unit work is dispatched against.
- A **domain** is a unit of code ownership. There are still five: Interaction,
  Work, Resources, Runtime and Substrate. **The domain map is unchanged.** No
  module moves, no table changes owner, and `domains.ts` is not touched.

Each pillar names the domains it touches. The seam between two pillars is a
published contract shape or an event on the spine — never a table one pillar
writes and another reads.

The pillar map, the non-negotiables and the rules of engagement live in
[ARCHITECTURE.md](../ARCHITECTURE.md). The vocabulary lives in
[glossary.md](../../glossary.md). The relationship between the two axes is
stated in [docs/domains.md](../domains.md).

## Consequences

- **The domain map keeps its enforcement.** Nothing here weakens
  `domains.test.ts`; a pillar is an addition to the map, not a replacement for it.
- **A reader now has two maps**, and needs the sentence that relates them. That
  sentence exists in exactly one place per document — the architecture's fourth
  section, and `docs/domains.md` — so the cost of the second map is one
  paragraph rather than a second bookkeeping system.
- **A pillar's "must not change" column is the contract between pillars.** It
  names the seams another pillar is relying on. Moving one of those is a
  contract change: proposed, reviewed and landed on its own, never slipped into a
  slice that was about something else.
- **Work is dispatched against a pillar, and an agent is given one.** That is the
  sentence that was missing, and it is why two agents no longer reach for the
  same area.
- **Plugins is a pillar before it is a design.** It is declared here with its
  contract shape fixed and its mechanism outstanding, because a pillar that is
  missing from the map is a pillar two agents will build without a boundary.
