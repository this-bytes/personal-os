/**
 * Where everything sits in the picture.
 *
 * The picture is the same for the same data, every time. That is the whole
 * contract: an agent that is busy stays in the same place when the panel
 * reloads, so the owner's eye learns the picture instead of re-reading it.
 *
 * So the layout is a pure function of the data — no clock, no random, no
 * order that depends on how the data arrived. Two rules hold it together:
 *
 * - **An agent's angle is its own.** It comes from the agent's id, so it does
 *   not move when the agent's work changes.
 * - **An agent's distance is its work.** The busiest agent is nearest the
 *   centre, so the picture says where the attention is without saying it in
 *   words.
 */

/** An agent, as the picture needs it. */
export interface PictureAgent {
  id: string;
  name: string;
  /** How much it has done in the window the picture looks at. */
  activity: number;
}

/** A thread, as the picture needs it. */
export interface PictureThread {
  id: string;
  title: string;
  /** The agents taking part. */
  agentIds: string[];
  /** How much it has moved in the window the picture looks at. */
  activity: number;
}

/** One thing in the picture. */
export interface PictureNode {
  id: string;
  label: string;
  /** From 0 to 1 on each axis. */
  x: number;
  y: number;
  /** How big it is, as a fraction of the picture's width. */
  radius: number;
  /** The hue it wears, in degrees. */
  hue: number;
  active: boolean;
  thread: boolean;
}

/** A line between two things in the picture. */
export interface PictureEdge {
  from: string;
  to: string;
  active: boolean;
}

export interface Picture {
  nodes: PictureNode[];
  edges: PictureEdge[];
  /** How many threads the picture left out. */
  hiddenThreads: number;
  /** How many agents are drawn without a name. */
  unlabelledAgents: number;
}

/**
 * The hues an agent may wear.
 *
 * A hue is an identity, never a meaning: the accent means live or waiting on
 * the owner, the green means it worked, the rose means it failed. So the ring
 * leaves those neighbourhoods alone — no amber, no emerald, no rose — and a
 * reader who cannot tell the hues apart still reads the shape.
 */
export const AGENT_HUES = [15, 85, 125, 200, 265, 285, 310, 320] as const;

/** How many agents sit on one ring before the next ring starts. */
export const AGENTS_PER_RING = 6;

/** How many agents are named before the picture stops naming them all. */
export const LABEL_LIMIT = 8;

/** How many threads are drawn before the rest are counted instead. */
export const THREAD_LIMIT = 6;

/**
 * A stable number for a string.
 *
 * FNV-1a: the same id always gives the same number, on every machine and in
 * every run. Nothing here depends on the order the data arrived in.
 */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The angle an agent keeps. */
export function angleFor(id: string): number {
  return ((hashId(id) % 3600) / 3600) * Math.PI * 2;
}

/** The hue an agent wears. */
export function hueFor(id: string): number {
  return AGENT_HUES[hashId(id) % AGENT_HUES.length] ?? 200;
}

/** The rings, from the centre outwards, as a fraction of the picture's width. */
const RING_RADII = [0.13, 0.24, 0.35];

/** The picture is wider than it is tall, so the rings are ellipses. */
const HEIGHT_RATIO = 0.62;

/** How far past a ring the next thing sits. */
const RING_STEP = 0.1;

/** The mean of a set of angles, taking the short way round the circle. */
function meanAngle(angles: number[]): number {
  if (angles.length === 0) return 0;
  let x = 0;
  let y = 0;
  for (const angle of angles) {
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  return Math.atan2(y, x);
}

/**
 * The picture.
 *
 * The agents are ordered by how much they have done, so the busiest one is
 * nearest the centre, and the order is broken by id so that two agents with
 * the same count never swap places.
 */
export function buildPicture(
  agents: PictureAgent[],
  threads: PictureThread[],
  options: { labelLimit?: number; threadLimit?: number } = {},
): Picture {
  const labelLimit = options.labelLimit ?? LABEL_LIMIT;
  const threadLimit = options.threadLimit ?? THREAD_LIMIT;

  const ordered = [...agents].sort((a, b) => b.activity - a.activity || a.id.localeCompare(b.id));

  const nodes: PictureNode[] = [];
  const agentAngles = new Map<string, number>();

  ordered.forEach((agent, rank) => {
    const ring = Math.min(Math.floor(rank / AGENTS_PER_RING), RING_RADII.length - 1);
    const radius = RING_RADII[ring] ?? RING_RADII[RING_RADII.length - 1] ?? 0.35;
    const angle = angleFor(agent.id);
    agentAngles.set(agent.id, angle);

    nodes.push({
      id: agent.id,
      label: agent.name,
      x: 0.5 + radius * Math.cos(angle),
      y: 0.5 + radius * HEIGHT_RATIO * Math.sin(angle),
      radius: 0.016 + Math.min(agent.activity, 12) * 0.0018,
      hue: hueFor(agent.id),
      active: agent.activity > 0,
      thread: false,
    });
  });

  const agentRing = new Map<string, number>();
  ordered.forEach((agent, rank) => {
    agentRing.set(agent.id, Math.min(Math.floor(rank / AGENTS_PER_RING), RING_RADII.length - 1));
  });

  // The busiest threads are drawn and the rest are counted. A picture with
  // everything on it is a picture with nothing on it.
  const orderedThreads = [...threads].sort(
    (a, b) => b.activity - a.activity || a.id.localeCompare(b.id),
  );
  const drawn = orderedThreads.slice(0, threadLimit);
  const hiddenThreads = orderedThreads.length - drawn.length;

  const edges: PictureEdge[] = [];
  const agentIds = new Set(agents.map((agent) => agent.id));

  for (const thread of drawn) {
    const participants = thread.agentIds.filter((id) => agentIds.has(id));
    const angles = participants
      .map((id) => agentAngles.get(id))
      .filter((angle): angle is number => angle !== undefined);
    const angle = angles.length > 0 ? meanAngle(angles) : angleFor(thread.id);

    const outermost = participants.reduce((ring, id) => Math.max(ring, agentRing.get(id) ?? 0), 0);
    const radius = Math.min((RING_RADII[outermost] ?? 0.35) + RING_STEP, 0.46);

    nodes.push({
      id: thread.id,
      label: thread.title,
      x: 0.5 + radius * Math.cos(angle),
      y: 0.5 + radius * HEIGHT_RATIO * Math.sin(angle),
      radius: 0.011,
      hue: 0,
      active: thread.activity > 0,
      thread: true,
    });

    for (const participant of participants) {
      edges.push({ from: participant, to: thread.id, active: thread.activity > 0 });
    }
  }

  const unlabelledAgents = ordered.length > labelLimit ? ordered.length - labelLimit : 0;

  return { nodes, edges, hiddenThreads, unlabelledAgents };
}
