# Personal OS — UI direction prototypes

Four deliberately different directions for the Personal OS control panel, built to settle
a design question rather than to ship. Each direction covers the same screens — the
**home control panel** and the **conversation** — with the same data, so the comparison is
apples to apples. Direction D adds a third screen, a dashboard.

Open `index.html` in a browser to see them side by side with live previews. No build step,
no server, no dependencies. Every file is plain HTML, CSS and one shared mock-data file.

```
prototypes/
├── index.html              the comparison gallery — start here
├── shared/
│   ├── base.css            structural layer only; each direction themes it
│   └── data.js             mock data, shared by all four directions
├── a-deck/                 Direction A — dark ops console
│   ├── index.html          home
│   ├── conversation.html   conversation
│   └── theme.css
├── b-desk/                 Direction B — light, calm, Today-first
├── c-orbit/                Direction C — deep aurora, agent-constellation
└── d-forge/                Direction D — the A + C hybrid
    ├── index.html          home (the map)
    ├── conversation.html   work surface (the cockpit)
    ├── dashboard.html      dashboard
    └── theme.css
```

## The four bets

### A — Deck

*Personal OS is an operations surface, so it should behave like one.*

One pane, no page hierarchy. The event stream is the spine of the app and every surface
is an inspector over it. The conversation view adds a **trace gutter** that shows the
execution alongside the transcript — the tool calls, the deltas, the artifact creation
and the spend — which is information the current UI hides entirely.

Visual language: near-black, hairline borders, monospaced data, square corners, one
signal-amber accent.

### B — Desk

*Personal OS is an operating system for one person, so its home should read like a
briefing rather than a dashboard.*

A single vertical scroll that answers three questions in order: what needs me, what is
running, what exists. The conversation view drops to a reading-width column with a
plain-language side panel for participants, safeguards and artifacts.

Visual language: warm paper, soft white cards, generous space, a serif for headings,
terracotta as the one accent.

### C — Orbit

*Personal OS is a system of agents around one person, so show the system.*

The home is a constellation: you at the centre, your agents in orbit, and each thread
drawn as the subgraph its agents share. A bright spoke means that agent is working right
now. Conversations are a focused workbench with a presence rail.

Visual language: deep indigo-black, aurora light, glass panels, a violet-to-cyan
spectrum.

### D — Forge *(the hybrid)*

*A and C were never competing for the same job, so stop making them.*

A wins where you **do the work**; C wins where you **orient**. D splits the product by
mode rather than forcing one compromise:

- **Orientation room** (map, dashboards) — C's spatial, spacious language.
- **Execution room** (conversation, trace) — A's dense, instrumented language.

What keeps them one product is the material: the same dark base, the same hairline
borders, the same violet/cyan spectrum, the same sans-for-prose / mono-for-data pairing.
Only density, spacing and ornament change. The colour rule holds across both rooms:
**violet is structure, cyan is data, amber always means live** — running now, or waiting
on you.

D is the only direction with a dashboard screen, and its numbers are derived from the
bound data source's payload rather than typed into the mock, so the widget bindings are
visible rather than implied.

## What is real, and what is not

**Real.** `shared/data.js` uses the real field names and enum values from
`packages/contracts` and `apps/server/src/db/schema.ts` — adapter types
(`cli`, `acp`, `a2a`, `http`, `model`, `echo`), routing modes
(`mentions`, `coordinator`, `autonomous`), task states, goal states, approval status,
execution status, resource types, automation triggers and actions, and the event
vocabulary from `execution_events`. Resources carry the type-specific `data` payload their
provider validates — a dashboard has widgets, bindings and `refreshSeconds`; a data source
has a `kind` and a payload; a memory item has a scope and a key. No screen shows a state
the product cannot produce.

**Not real.** These are static screens. Nothing is fetched, no buttons are wired to
anything, and the pages use mock records rather than a live workspace.

## Where each direction came out

Short version: **B is the cheapest to build** and closest to the existing stack. **A
changes how the product behaves most**, because it promotes the event stream from an
implementation detail to the primary navigation surface. **C introduces a genuinely new
component** (the constellation graph) and is the hardest to keep legible as the number of
agents and threads grows.

**D is the hybrid**, and it is the direction to build if A and C are both partly right. The
open question it does not settle is where the boundary sits: D puts the map and the
dashboards in one room and the conversation in the other, but the factory board, the agent
list and the automation runs could reasonably belong to either.

## Housekeeping

This directory is excluded from prettier (`.prettierignore`) and is not part of any
workspace build. It is a design artefact, not shipped code.
