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
  /** The tasks this task waits on. A task never waits on itself. */
  dependsOnTaskIds: z.array(idSchema).optional(),
  // --- additive extensions ---
  /** Optimistic concurrency revision, shared with the resource API. */
  revision: z.number().int().min(1),
  /** The external orchestrator's own task identifier, when it owns the work. */
  externalRef: z.string().optional(),
  /** The template this task was made from, and the version of it. */
  templateId: idSchema.optional(),
  templateVersion: z.number().int().min(1).optional(),
});
export type FactoryTask = z.infer<typeof factoryTaskSchema>;

/**
 * The task contract, as a resource spec. A task resource's data is either
 * the fields a caller writes — what a template carries and what a create
 * call overrides — or the whole task the factory holds. Both are judged by
 * the same schema: the fields a caller does not write left out, and
 * nothing else allowed in.
 */
export const taskSpecSchema = factoryTaskSchema.partial().strict();
export type TaskSpec = z.infer<typeof taskSpecSchema>;

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

/**
 * A dependency between two tasks: this task waits on that task.
 *
 * The edge has one direction, because the work that waits is not the work
 * that is waited on. A task must never wait on itself, directly or through a
 * chain, so the edge is checked before it is written.
 *
 * The task's own `dependsOnTaskIds` is optional, because a task that waits on
 * nothing is the same task before and after the column that records it
 * existed. The server always answers with the list it holds.
 */
export const taskDependencySchema = z.object({
  /** The task that is waiting. */
  taskId: idSchema,
  /** The task it waits on. */
  dependsOnTaskId: idSchema,
  /** What the waited-on task is called, so the board can name it. */
  dependsOnTitle: z.string(),
  /** The status the waited-on task is in. */
  dependsOnStatus: taskStatusSchema,
  /**
   * Whether the waited-on task is out of the way: done, or cancelled.
   *
   * A task that waits on a task which is neither done nor cancelled is
   * waiting, and the board says so instead of calling it simply open.
   */
  satisfied: z.boolean(),
});
export type TaskDependency = z.infer<typeof taskDependencySchema>;

/**
 * The shape of a goal's work, as counts.
 *
 * A counter is a count and never a ratio: the band says how many, and a
 * share is only shown when there is something to divide by.
 */
export const goalRollupSchema = z.object({
  goalId: idSchema,
  /** How many tasks the goal holds. */
  total: z.number().int().min(0),
  /** How many of them are waiting on the owner: in review, or unknown. */
  waitingOnOwner: z.number().int().min(0),
  /** How many of them are waiting on a task that is not out of the way yet. */
  waitingOnDependency: z.number().int().min(0),
  /** How many of them there are in each status. */
  byStatus: z.object({
    open: z.number().int().min(0),
    active: z.number().int().min(0),
    blocked: z.number().int().min(0),
    review: z.number().int().min(0),
    done: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    unknown: z.number().int().min(0),
  }),
});
export type GoalRollup = z.infer<typeof goalRollupSchema>;

/**
 * A goal, the work under it, and the shape of that work.
 *
 * The goal is the organising structure: the tasks belong to it, the
 * dependencies say what the work is waiting for, and the rollup says how
 * much of it there is.
 */
export const goalViewSchema = z.object({
  goal: goalSchema,
  rollup: goalRollupSchema,
  tasks: z.array(factoryTaskSchema),
  dependencies: z.array(taskDependencySchema),
});
export type GoalView = z.infer<typeof goalViewSchema>;
