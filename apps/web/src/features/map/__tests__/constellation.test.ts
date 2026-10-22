import { describe, expect, it } from 'vitest';
import {
  AGENT_HUES,
  buildPicture,
  hueFor,
  type PictureAgent,
  type PictureThread,
} from '../constellation';

/**
 * The picture of the system.
 *
 * The picture is the same for the same data, every time. That is the whole
 * contract: an owner who has learned the picture can look at it again and
 * find everything where they left it.
 */

const agents: PictureAgent[] = [
  { id: 'agt_busy', name: 'Busy', activity: 12 },
  { id: 'agt_quiet', name: 'Quiet', activity: 1 },
  { id: 'agt_still', name: 'Still', activity: 0 },
];

const threads: PictureThread[] = [
  { id: 'cnv_1', title: 'A thread', agentIds: ['agt_busy', 'agt_quiet'], activity: 4 },
  { id: 'cnv_2', title: 'A quiet thread', agentIds: ['agt_quiet'], activity: 0 },
];

function distanceFromCentre(node: { x: number; y: number }): number {
  return Math.hypot(node.x - 0.5, node.y - 0.5);
}

describe('the picture', () => {
  it('is the same for the same data', () => {
    expect(buildPicture(agents, threads)).toEqual(buildPicture(agents, threads));
  });

  it('puts the busiest agent nearest the centre', () => {
    const picture = buildPicture(agents, threads);
    const byId = new Map(picture.nodes.map((node) => [node.id, node]));

    const busy = byId.get('agt_busy');
    const quiet = byId.get('agt_quiet');
    const still = byId.get('agt_still');

    expect(busy).toBeDefined();
    expect(distanceFromCentre(busy!)).toBeLessThan(distanceFromCentre(quiet!));
    expect(distanceFromCentre(quiet!)).toBeLessThan(distanceFromCentre(still!));
  });

  it('keeps an agent in the same place when its work changes', () => {
    const before = buildPicture(agents, threads).nodes.find((node) => node.id === 'agt_quiet');
    const after = buildPicture(
      [
        { id: 'agt_busy', name: 'Busy', activity: 12 },
        { id: 'agt_quiet', name: 'Quiet', activity: 9 },
      ],
      threads,
    ).nodes.find((node) => node.id === 'agt_quiet');

    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after!.x).toBeCloseTo(before!.x, 10);
    expect(after!.y).toBeCloseTo(before!.y, 10);
  });

  it('never puts two agents in the same place', () => {
    const picture = buildPicture(
      Array.from({ length: 12 }, (_, index) => ({
        id: `agt_${index}`,
        name: `Agent ${index}`,
        activity: index,
      })),
      [],
    );

    const positions = picture.nodes.map((node) => `${node.x.toFixed(6)}:${node.y.toFixed(6)}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('counts the threads it leaves out instead of drawing them', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `cnv_${index}`,
      title: `Thread ${index}`,
      agentIds: ['agt_busy'],
      activity: index,
    }));

    const picture = buildPicture(agents, many);

    expect(picture.nodes.filter((node) => node.thread)).toHaveLength(6);
    expect(picture.hiddenThreads).toBe(4);
  });

  it('counts the agents it does not name', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `agt_${index}`,
      name: `Agent ${index}`,
      activity: index,
    }));

    const picture = buildPicture(many, []);

    expect(picture.unlabelledAgents).toBe(2);
  });

  it('draws a line from every agent in a thread to the thread', () => {
    const picture = buildPicture(agents, threads);
    const thread = picture.nodes.find((node) => node.id === 'cnv_1');

    expect(thread).toBeDefined();
    expect(picture.edges.filter((edge) => edge.to === 'cnv_1')).toHaveLength(2);
  });
});

describe('the hue an agent wears', () => {
  /** How far apart two hues are, the short way round the circle. */
  function distance(a: number, b: number): number {
    const difference = Math.abs(a - b) % 360;
    return difference > 180 ? 360 - difference : difference;
  }

  it('is the same every time', () => {
    expect(hueFor('agt_1')).toBe(hueFor('agt_1'));
  });

  it('leaves the colours that mean something alone', () => {
    // The accent means live or waiting on the owner, the green means it
    // worked and the rose means it failed. An agent's hue is an identity, so
    // it keeps away from all three.
    for (const hue of AGENT_HUES) {
      expect(distance(hue, 43), `hue ${hue} is too close to the accent`).toBeGreaterThan(20);
      expect(distance(hue, 158), `hue ${hue} is too close to the success colour`).toBeGreaterThan(
        20,
      );
      expect(distance(hue, 351), `hue ${hue} is too close to the error colour`).toBeGreaterThan(20);
    }
  });
});
