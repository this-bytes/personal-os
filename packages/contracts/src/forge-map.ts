import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';
import { agentConnectionStatusSchema } from './agent.js';
import { resourceTypeSchema } from './resource.js';

/**
 * The Map room's read model.
 *
 * The Map is the orientation room: it is a picture of the system — the agents,
 * the threads they are in, the things they have built, and the pulse of what
 * has just happened. It is assembled on the server, in one request, for the
 * same reason the waiting list is: the browser asks for one thing instead of
 * four and joins the answers itself.
 */

/** One agent, as the map shows it. */
export const forgeMapAgentSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  status: agentConnectionStatusSchema,
  enabled: z.boolean(),
  /** The role the agent is working as, when it has one. */
  role: z.string().max(200).nullable(),
  /**
   * How much the agent has done in the window the map looks at.
   *
   * The count is what places the agent in the picture — the busiest agent is
   * nearest the core — and it is a count, not a score.
   */
  activity: z.number().int().min(0),
});
export type ForgeMapAgent = z.infer<typeof forgeMapAgentSchema>;

/** One thread, as the map shows it. */
export const forgeMapThreadSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(300),
  /** The agents taking part in it. */
  agentIds: z.array(idSchema),
  /**
   * How much the thread has moved in the window the map looks at.
   *
   * The busiest threads are the ones drawn, and the rest are counted in the
   * legend: a picture with everything on it is a picture with nothing on it.
   */
  activity: z.number().int().min(0),
});
export type ForgeMapThread = z.infer<typeof forgeMapThreadSchema>;

/**
 * One counter on the band above the picture.
 *
 * A counter is a count and never a ratio: the map shows how many, and a share
 * is only shown when there is something to divide by.
 */
export const forgeMapCounterSchema = z.object({
  /** The machine-readable name of the counter. */
  key: z.string().min(1).max(60),
  /** What the owner reads above the number. */
  label: z.string().min(1).max(60),
  value: z.number().int().min(0),
  /**
   * What the number means when it is read.
   *
   * `live` is for work that is happening now or waiting on the owner, `data`
   * is for a number about what was produced, and `plain` is everything else.
   */
  tone: z.enum(['plain', 'live', 'data']).default('plain'),
});
export type ForgeMapCounter = z.infer<typeof forgeMapCounterSchema>;

/** One built thing. */
export const forgeMapTileSchema = z.object({
  id: idSchema,
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  revision: z.number().int().min(1),
  updatedAt: isoDateSchema,
});
export type ForgeMapTile = z.infer<typeof forgeMapTileSchema>;

/** One line of the live pulse. */
export const forgeMapPulseEntrySchema = z.object({
  seq: z.number().int().min(0),
  /** What happened, in words. */
  summary: z.string().min(1).max(300),
  /** Who did it, when the event says. */
  actor: z.string().max(200).nullable(),
  at: isoDateSchema,
});
export type ForgeMapPulseEntry = z.infer<typeof forgeMapPulseEntrySchema>;

/** The whole Map, in one payload. */
export const forgeMapSchema = z.object({
  workspaceId: idSchema,
  agents: z.array(forgeMapAgentSchema),
  threads: z.array(forgeMapThreadSchema),
  counters: z.array(forgeMapCounterSchema),
  tiles: z.array(forgeMapTileSchema),
  pulse: z.array(forgeMapPulseEntrySchema),
});
export type ForgeMap = z.infer<typeof forgeMapSchema>;
