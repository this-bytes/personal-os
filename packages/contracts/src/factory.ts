import { z } from 'zod';
import { autonomyPolicySchema, idSchema, isoDateSchema } from './common.js';
import { executionStatusSchema } from './agent.js';

/**
 * The factory foundation: goal -> task -> execution -> evidence -> acceptance.
 * A goal survives changes in agents, sessions and provider accounts.
 */

export const goalStatusSchema = z.enum(['active', 'paused', 'done', 'cancelled']);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  status: goalStatusSchema,
  autonomyPolicy: autonomyPolicySchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Goal = z.infer<typeof goalSchema>;

export const taskStatusSchema = z.enum([
  'open',
  'active',
  'blocked',
  'review',
  'done',
  'cancelled',
  'unknown',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/**
 * Who actually performs the work. `external` means an external orchestrator
 * owns the task; Personal OS stores the reference, it does not mirror it.
 */
export const executionOwnerSchema = z.enum(['personal-os', 'external', 'human']);
export type ExecutionOwner = z.infer<typeof executionOwnerSchema>;

export const factoryTaskSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  goalId: idSchema.optional(),
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  assigneeId: idSchema.optional(),
  executionOwner: executionOwnerSchema,
  status: taskStatusSchema,
  acceptanceCriteria: z.array(z.string()).default([]),
  evidenceResourceIds: z.array(idSchema).default([]),
  // --- additive extensions ---
  /** Optimistic concurrency revision, shared with the resource API. */
  revision: z.number().int().min(1),
  /** The external orchestrator's own task identifier, when it owns the work. */
  externalRef: z.string().optional(),
});
export type FactoryTask = z.infer<typeof factoryTaskSchema>;

export const executionSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  conversationId: idSchema.optional(),
  taskId: idSchema.optional(),
  /** Stable identifier of an externally owned task or session. */
  externalRef: z.string().optional(),
  executionOwner: executionOwnerSchema,
  status: executionStatusSchema,
  error: z.string().nullable(),
  startedAt: isoDateSchema.nullable(),
  finishedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});
export type Execution = z.infer<typeof executionSchema>;

export const evidenceKindSchema = z.enum([
  'artifact',
  'test',
  'observation',
  'external-reference',
  'report',
]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  executionId: idSchema.optional(),
  kind: evidenceKindSchema,
  summary: z.string(),
  resourceId: idSchema.optional(),
  payload: z.unknown().optional(),
  createdAt: isoDateSchema,
});
export type Evidence = z.infer<typeof evidenceSchema>;

/**
 * Acceptance is a separate judgement from "the agent said it is done".
 * A task only becomes `done` once acceptance criteria are satisfied.
 */
export const acceptanceSchema = z.object({
  taskId: idSchema,
  satisfied: z.boolean(),
  reason: z.string().default(''),
  acceptedBy: idSchema.optional(),
  acceptedAt: isoDateSchema.optional(),
});
export type Acceptance = z.infer<typeof acceptanceSchema>;

export const createGoalInputSchema = z.object({
  workspaceId: idSchema,
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  autonomyPolicy: autonomyPolicySchema.optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;

export const createTaskInputSchema = z.object({
  workspaceId: idSchema,
  goalId: idSchema.optional(),
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  assigneeId: idSchema.optional(),
  executionOwner: executionOwnerSchema.default('personal-os'),
  acceptanceCriteria: z.array(z.string()).default([]),
  /**
   * The external orchestrator's own task identifier, when it owns the work.
   *
   * This is the link that lets the repository record a code work item and the
   * instance record the task that carries it without either being a copy of
   * the other.
   */
  externalRef: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
