# The panel's rooms

**Status:** the panel as it stands on 2026-10-22.

The panel is the owner's window on their agents. This is what it shows, what
each part means, and the rules the parts hold to.

---

## The rooms

A **room** is a place, not a picture: it is where work is looked at or decided.
The panel has two, and the switch in the header is the way between them.

| Room  | Path            | What it is for                                                   | Density |
| ----- | --------------- | ---------------------------------------------------------------- | ------- |
| Map   | `/map`          | The orientation room. The picture of the system.                  | Airy    |
| Work  | `/conversations` | The execution room. The threads the owner directs agents in.      | Dense   |

**The panel opens on the Map.** It is the room the owner sees when they have
not asked for anywhere in particular: everything at a glance, and the thing
that is waiting on them.

A new room is a new feature: it declares its label, its path, its density and
where it sits in the switch. **A path leads to one room** — two features
claiming one path are refused rather than quietly resolved.

---

## The Map

The Map is the orientation room. It holds four things, and nothing else.

### The counters

A band of counts above the picture: how many agents, how many threads, how many
things have been built, and how many are waiting on the owner.

**A counter is a count and never a ratio.** The Map says how many, and a share
is only shown when there is something to divide by. A counter that waits on the
owner wears the accent, because that is what the accent means.

### The picture

An SVG graph of the agents and the threads between them, with the owner at the
centre.

- **The picture is the same for the same data, every time.** An agent that is
  busy stays in the same place when the panel reloads, so the owner's eye
  learns the picture instead of re-reading it.
- **An agent's angle is its own.** It comes from the agent's id, so it does not
  move when the agent's work changes.
- **An agent's distance from the centre is its work.** The busiest agent is
  nearest the centre, so the picture says where the attention is without
  saying it in words.
- **A hue is an identity, never a meaning.** The accent means live or waiting
  on the owner, the green means it worked, the rose means it failed. So the
  agent hues leave those neighbourhoods alone, and a reader who cannot tell the
  hues apart still reads the shape.
- **A picture that has grown stops naming everything.** Past a point the labels
  are the noise and the shape is the information; the Map says how many agents
  it is not naming.
- **Only the busiest threads are drawn.** The rest are counted in the legend: a
  picture with everything on it is a picture with nothing on it.

Choosing an agent in the picture shows it — its role, its status, how much it
has done — and offers the way to the agents surface, where its connection is
decided.

### The rail

The needs-you rail: the list of what is waiting on the owner, and the decisions
that go with it. A pending approval can be approved or rejected from here, and
a turn that ran can be marked as one that did.

**A decision is taken where the list is.** That is why the rail lives in the
orientation room rather than in a drawer somewhere.

The rail asks for one request. The browser is not asked to join three lists
itself, and the counts on the Map and the items on the rail are the same
numbers, counted once.

### What has been built

The resources the agents have produced, with their revision and when they last
changed.

### The pulse

The last few things that happened, in one sentence each, read from the same
window of the event log the counters are read from — so a number on the map
and a line in the pulse are talking about the same moment.

---

## The rules that hold

**One request per surface.** A surface owns its read model and asks for it
once. The browser joins nothing itself.

**The server owns the sentences.** What an event means is written on the
server, once, so every surface says the same thing about the same event.

**The login screen downloads nothing it does not need.** The panel loads one
chunk per route, and the first paint carries the shell and the route that was
asked for.

**The accent means one thing.** Live, or waiting on the owner. Nothing else
wears it.

---

## Where the rooms come from

Every surface in the panel is a **feature**: a folder that declares a manifest
— its id, its rooms, its navigation entry, and the prefix its own API lives
under. The panel is built out of those, so a new surface is a new folder and
touches nothing else.

See [ADR 11](decisions/0011-feature-slots.md) for why the seam exists, and
[the feature guide](feature-authoring.md) for how a feature is written.
