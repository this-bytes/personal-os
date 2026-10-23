import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import type {
  ForgeMap,
  ForgeMapAgent,
  ForgeMapCounter,
  ForgeMapPulseEntry,
  ForgeMapThread,
  ForgeMapTile,
} from '@personal-os/contracts';
import { parseQuery, requireAuth } from '../../api/helpers.js';
import { listWaiting } from '../../api/waiting.js';
import type { ServerFeature } from '../registry.js';
import { agentIdOf, conversationIdOf, describeEvent, type PulseNames } from './pulse.js';

/**
 * The Map, on the server side.
 *
 * The Map is the orientation room: it is a picture of the system — the agents,
 * the threads they are in, the things that have been built, and the pulse of
 * what has just happened. It is assembled here, in one request, for the same
 * reason the waiting list is: the browser asks for one thing instead of five
 * and joins the answers itself.
 *
 * The feature owns its own routes and its own read model. Nothing about the
 * Map is known to the runtime outside this folder.
 */

const mapQuerySchema = z.object({ workspaceId: z.string() });

/**
 * How many events the Map looks at.
 *
 * The window is what places an agent in the picture — the busiest agent is
 * nearest the core — and what fills the pulse. It is a window, not a history:
 * the Map shows what is moving now, and the event log keeps the rest.
 */
const WINDOW_SIZE = 120;

/** How many lines of the pulse the Map shows. */
const PULSE_SIZE = 12;

export const forgeMapFeature: ServerFeature = {
  manifest: {
    id: 'feat_forge_map',
    name: 'The Map',
    description:
      'The orientation room: the agents, the threads they are in, what has been built, and the pulse.',
    rooms: [{ id: 'map', label: 'Map', path: '/map', density: 'airy', order: 10 }],
    apiPrefix: '/api/features/map',
  },

  register(app: FastifyInstance): void {
    app.get('/api/features/map', { preHandler: requireAuth }, async (request) => {
      const { workspaceId } = parseQuery(mapQuerySchema, request.query);
      return buildForgeMap(app, workspaceId);
    });
  },
};

/** The whole Map, assembled. */
export function buildForgeMap(app: FastifyInstance, workspaceId: string): ForgeMap {
  const services = app.services;

  const connections = services.agents.list(workspaceId);
  const conversations = services.conversations.list(workspaceId);
  const resources = services.resources.list(workspaceId);
  const events = services.events.recent(workspaceId, WINDOW_SIZE);

  const agentNames = new Map(connections.map((agent) => [agent.id, agent.name]));
  const conversationTitles = new Map(conversations.map((thread) => [thread.id, thread.title]));

  const names: PulseNames = {
    agentName: (id) => agentNames.get(id) ?? null,
    conversationTitle: (id) => conversationTitles.get(id) ?? null,
  };

  const agentActivity = new Map<string, number>();
  const threadActivity = new Map<string, number>();

  for (const event of events) {
    const agentId = agentIdOf(event.payload);
    if (agentId) {
      agentActivity.set(agentId, (agentActivity.get(agentId) ?? 0) + 1);
    }
    const conversationId = conversationIdOf(event.payload);
    if (conversationId) {
      threadActivity.set(conversationId, (threadActivity.get(conversationId) ?? 0) + 1);
    }
  }

  const agents: ForgeMapAgent[] = connections.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    enabled: agent.enabled,
    role: agent.persona?.role ?? null,
    activity: agentActivity.get(agent.id) ?? 0,
  }));

  const threads: ForgeMapThread[] = conversations.map((thread) => ({
    id: thread.id,
    title: thread.title,
    agentIds: thread.participants
      .filter((participant) => participant.type === 'agent')
      .map((participant) => participant.agentConnectionId)
      .filter((id): id is string => id !== undefined),
    activity: threadActivity.get(thread.id) ?? 0,
  }));

  const tiles: ForgeMapTile[] = resources.map((resource) => ({
    id: resource.id,
    type: resource.type,
    title: resource.title,
    revision: resource.revision,
    updatedAt: resource.updatedAt,
  }));

  // The waiting list is assembled on the server already, and the Map counts
  // the same list rather than counting its own way: two numbers that say the
  // same thing must not be able to disagree.
  const waiting = listWaiting(app, workspaceId);

  const counters: ForgeMapCounter[] = [
    { key: 'agents', label: 'Agents', value: agents.length, tone: 'plain' },
    { key: 'threads', label: 'Threads', value: threads.length, tone: 'plain' },
    { key: 'built', label: 'Built', value: tiles.length, tone: 'data' },
    {
      key: 'waiting',
      label: 'Waiting on you',
      value: waiting.length,
      tone: waiting.length > 0 ? 'live' : 'plain',
    },
  ];

  const pulse: ForgeMapPulseEntry[] = events
    .map((event) => describeEvent(event.payload, names, event.seq, event.createdAt))
    .filter((entry): entry is ForgeMapPulseEntry => entry !== null)
    .reverse()
    .slice(0, PULSE_SIZE);

  return { workspaceId, agents, threads, counters, tiles, pulse };
}
