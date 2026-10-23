import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';

export const automationTriggerTypeSchema = z.enum(['schedule', 'event', 'manual']);
export type AutomationTriggerType = z.infer<typeof automationTriggerTypeSchema>;

/**
 * Events that may be used as an automation trigger.
 *
 * The list is an allowlist on purpose. `execution.event` fires for every
 * piece of adapter chatter and `heartbeat` fires constantly; letting an
 * automation listen to those would let two automations wake each other
 * forever. The chain-depth limit in the worker is the second line of
 * defence, but a trigger that is meaningless in the first place should not
 * be configurable at all.
 */
export const triggerableEventTypes = [
  'message.created',
  'message.updated',
  'task.updated',
  'resource.updated',
  'agent.status',
  'automation.run',
] as const;
export type TriggerableEventType = (typeof triggerableEventTypes)[number];

/** True when an event name may be used as an automation trigger. */
export function isTriggerableEventType(value: string): value is TriggerableEventType {
  return (triggerableEventTypes as readonly string[]).includes(value);
}

export const automationTriggerSchema = z.object({
  type: automationTriggerTypeSchema,
  /** Five-field cron expression, used when type is `schedule`. */
  cron: z.string().optional(),
  /** Event name, used when type is `event`. */
  event: z.string().optional(),
  /** Minimum minutes between runs, used when type is `schedule` without cron. */
  everyMinutes: z.number().int().min(1).max(43_200).optional(),
});
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

export const automationActionSchema = z.object({
  type: z.enum(['agent.prompt', 'resource.refresh', 'http.request']),
  /** Agent connection id for `agent.prompt`. */
  agentConnectionId: idSchema.optional(),
  /** Prompt template for `agent.prompt`. Supports {{context}} placeholders. */
  prompt: z.string().optional(),
  /** Resource id for `resource.refresh`. */
  resourceId: idSchema.optional(),
  /** Target URL for `http.request`. */
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
});
export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string().min(1).max(300),
  trigger: automationTriggerSchema,
  action: automationActionSchema,
  enabled: z.boolean(),
  /** Optimistic concurrency revision, shared with the resource API. */
  revision: z.number().int().min(1),
  lastRunAt: isoDateSchema.nullable(),
  nextRunAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Automation = z.infer<typeof automationSchema>;

export const automationRunStatusSchema = z.enum(['running', 'completed', 'failed', 'unknown']);
export type AutomationRunStatus = z.infer<typeof automationRunStatusSchema>;

export const automationRunSchema = z.object({
  id: idSchema,
  automationId: idSchema,
  status: automationRunStatusSchema,
  startedAt: isoDateSchema,
  finishedAt: isoDateSchema.nullable(),
  output: z.unknown().optional(),
  error: z.string().nullable(),
});
export type AutomationRun = z.infer<typeof automationRunSchema>;
