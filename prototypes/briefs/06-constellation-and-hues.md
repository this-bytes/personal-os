# Brief 06 — The constellation, and the hues it wears

**Piece:** the item's pieces 6 and 7. **Lands last.**
**Owner:** Cog. **Verifier:** Probe.

The hardest piece of any of the four directions, and Forge does not avoid it: it
inherits the constellation from Orbit. The prototype hand-places the nodes, so the
build needs a real layout algorithm and a legibility rule for growth.

**Why these two pieces are one brief.** The per-agent identity hues are the
constellation's own paint: the map is a graph of agents, and each agent wears a
hue. One owner holds the layout algorithm and the hue ring, because a hue assigned
by one rule and drawn by another is a map nobody can learn. If the lead wants them
split, the hues are half a brief and can become a seventh — the work is the same
either way.

## What it changes

**The constellation.** An SVG graph of the workspace's agent connections and the
threads between them: a live spoke for an agent working now, and a thread drawn as
the subgraph its agents share. The data is real — agent connections, conversations,
participants — and the panel already reads all three.

**A layout algorithm, hand-rolled.** The dependency set is not this direction's to
change, so no force library arrives with it. The layout is therefore:

- **deterministic.** The same workspace draws the same picture every time. An owner
  learns the shape of their system, and a map that jitters on every render cannot
  be learned.
- **activity-ordered.** The agents are placed by how recently they worked — the
  busiest nearest the core — and each one's angle is a stable function of its id,
  so nothing moves when a neighbour does.
- **frozen after settling.** The layout settles and stops. The only motion in the
  map is the live spoke's breathing, which is the one thing that means something.

**A legibility rule for growth.** A constellation that is legible with six agents is
not legible with sixty, and the rule has to be written down rather than discovered
by an owner squinting at it:

- below the threshold, every agent is labelled with its name and role;
- above it, the agents are grouped by role and the groups are labelled instead;
- threads are drawn only for the most recent ones, and the count of the rest is
  shown in the legend rather than dropped silently.

The numbers are tuned against real data, and the rule is the thing that is not
tuned: when the map cannot hold everything, it says what it left out.

**The agent hues, and the rule that keeps them honest.** One `--agent-*` token per
agent connection — an agent has a name, a role and now a hue, which lines up with
the persona work (WI-006). The hues are:

- **stable** — an agent wears the same hue every time the owner looks;
- **from a fixed ring** — a defined set of distinguishable hues, assigned by a
  deterministic function of the agent's id, so a new agent takes a free hue rather
  than a random one;
- **not the semantic colours.** Amber means live or waiting on the owner, emerald
  means ok, rose means err. **An agent must not wear a colour that says something
  about the work** — a green agent that failed would read as fine. The prototype's
  five (`theme.css:46-50`) include exactly those collisions, so they are a starting
  point and not the answer.

**The agent list becomes the constellation.** The flat roster on the Agents page is
replaced by the spatial version, because the map *is* the agent list and a roster
beside it would build the same information twice.

## What it preserves

- **Every agent's data.** The map draws the connections, their conversations and
  their participants. It does not summarise an agent away.
- **The conversations.** A thread in the map is a conversation; the conversation
  still opens exactly where it opened before.
- **The Agents page's route.** It keeps working, and it shows the map.
- **The persona work.** A hue is an addition to an agent's identity, not a
  replacement for its name or role.

## Acceptance criteria

- [ ] The constellation draws the workspace's agents and the threads between them,
      with a live spoke for an agent working now.
- [ ] The layout is deterministic: the same data draws the same picture, and the
      numbers are reproducible from the tree.
- [ ] The layout settles and stops; the only motion is the live spoke.
- [ ] The legibility rule is written down, and the map says what it left out when
      it leaves something out.
- [ ] Every agent's hue is stable, comes from the fixed ring, and is not one of the
      semantic colours.
- [ ] A new agent takes a free hue deterministically, and two agents never share
      one while the ring has room.
- [ ] The conversation behind a thread opens where it always opened.
- [ ] The Agents page shows the map, and the flat roster is not built twice.
- [ ] No new dependency, no server change, no contract change.

## Gates

`npm run typecheck`, `npm run test`, `npm run format:check`, `npm run build`,
`npm run test:e2e`.

## Not in scope

- **A force-directed layout library.** The dependency set is not this direction's
  to change, and a deterministic hand-rolled layout is what the legibility rule
  needs anyway.
- **The agent list's behaviour.** The map replaces the roster's *shape*, not what
  the page does.
- **A persona editor.** The hue rides along with the persona work; it does not
  change it.
