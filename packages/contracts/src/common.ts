import { z } from 'zod';

/** Opaque identifier. Stable across the system, never parsed for meaning. */
export const idSchema = z.string().min(1).max(128);
export type ID = string;

/** ISO-8601 timestamp with timezone offset. */
export const isoDateSchema = z.string().datetime({ offset: true });
export type ISODate = string;

/** Structured error envelope used by HTTP, MCP and adapter boundaries. */
export const errorEnvelopeSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const paginationResultSchema = z.object({
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});
export type PaginationResult = z.infer<typeof paginationResultSchema>;

/** Who or what performed an action. */
export const actorTypeSchema = z.enum(['human', 'agent', 'system', 'automation']);
export type ActorType = z.infer<typeof actorTypeSchema>;

/**
 * Autonomy is opt-in and always bounded. Manual is the default everywhere.
 */
export const autonomyModeSchema = z.enum(['manual', 'assisted', 'autonomous']);
export type AutonomyMode = z.infer<typeof autonomyModeSchema>;

/**
 * Bounds applied to any autonomous or semi-autonomous execution.
 * Every limit is enforced server-side; clients only ever narrow them.
 */
export const autonomyPolicySchema = z.object({
  mode: autonomyModeSchema.default('manual'),
  allowedActions: z.array(z.string()).default([]),
  approvalRequired: z.array(z.string()).default([]),
  maxTurns: z.number().int().min(1).max(1000).default(8),
  maxDurationSeconds: z.number().int().min(1).max(86_400).default(900),
  maxSpendUnits: z.number().int().min(0).default(0),
  dailySpendUnits: z.number().int().min(0).default(0),
});
export type AutonomyPolicy = z.infer<typeof autonomyPolicySchema>;

/** A budget/spend unit is an abstract cost counter, not currency. */
export const spendUnitsSchema = z.number().int().min(0);

export function nowIso(): ISODate {
  return new Date().toISOString();
}
