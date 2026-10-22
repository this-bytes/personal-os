import { z } from 'zod';
import { idSchema, isoDateSchema } from './common.js';

/**
 * The bot mode: a room of agents that work as a team.
 *
 * The owner talks to one agent in a room — the coordinator. The coordinator
 * hands a bounded piece of work to another agent — a worker — and gets the
 * worker's actual answer back without the owner kicking it off again. A third
 * agent can review the result.
 *
 * Nothing here names a provider. A bot is an agent connection with a role and
 * a scope, and a delegation is a visible record of work handed over.
 */

/** The part a bot plays in its room. */
export const botRoleSchema = z.enum(['coordinator', 'worker', 'reviewer']);
export type BotRole = z.infer<typeof botRoleSchema>;

/**
 * What a bot may do inside its room.
 *
 * The scope is an allowlist, never a broadcast: a bot hands work to the agents
 * it was given, and to nobody else. An empty list means nobody, so a bot that
 * was never given a team cannot wake one by accident.
 */
export const botScopeSchema = z.object({
  /** Whether the bot may delegate at all. */
  mayDispatch: z.boolean().default(false),
  /**
   * The agent connections this bot may hand work to. An empty list means
   * nobody: dispatching is a decision the owner granted, not a side effect of
   * sharing a room.
   */
  dispatchableAgentConnectionIds: z.array(idSchema).default([]),
});
export type BotScope = z.infer<typeof botScopeSchema>;

/** A bot in a room. */
export const botSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  conversationId: idSchema,
  /** The connection the bot speaks through. */
  agentConnectionId: idSchema,
  role: botRoleSchema,
  displayName: z.string().min(1).max(200),
  scope: botScopeSchema,
  createdAt: isoDateSchema,
});
export type Bot = z.infer<typeof botSchema>;

/**
 * The status of a delegated task.
 *
 * This is the published vocabulary. `succeeded` means the worker answered;
 * `lost` is settled and is never re-run; `stopping` is the state a delegation
 * is in while it is being called off.
 */
export const delegatedTaskStatusSchema = z.enum([
  'queued',
  'running',
  'stopping',
  'succeeded',
  'failed',
  'cancelled',
  'lost',
]);
export type DelegatedTaskStatus = z.infer<typeof delegatedTaskStatusSchema>;

/**
 * A piece of work a turn handed to another agent.
 *
 * The first block is the published shape, unchanged. The second block is the
 * bot mode's addition: which room the work came from, which room it ran in,
 * what it was asked for and what came back. The additions are additive — a
 * reader of the published shape still reads the same fields.
 */
export const delegatedTaskSchema = z.object({
  id: idSchema,
  /** The turn that delegated the work. */
  parentTurnId: idSchema,
  /** The agent connection that does the delegated work. */
  agentConnectionId: idSchema,
  status: delegatedTaskStatusSchema,
  /** The reference to the output: the message the worker answered with. */
  outputRef: z.string().optional(),
  /** When the result reached the parent. */
  deliveredAt: z.string().optional(),
  /** The consumption candidate, recorded when the parent read the output. */
  consumedAt: z.string().optional(),

  // --- the bot mode's additions ---

  workspaceId: idSchema,
  /** The room the delegation came from. */
  conversationId: idSchema,
  /** The room the delegated work ran in. It is not the parent's room. */
  childConversationId: idSchema,
  /** The child turn that did the work. */
  childTurnId: idSchema.optional(),
  /** The connection that delegated the work. */
  parentAgentConnectionId: idSchema,
  /** The role the delegated work was asked for. */
  role: botRoleSchema,
  /** The factory task the work is tracked as. */
  taskId: z.string().optional(),
  /** What the coordinator asked for. */
  instruction: z.string(),
  /** What came back. */
  result: z.string().optional(),
  /** The delivery message that carried the result into the parent's room. */
  deliveryMessageId: z.string().optional(),
  /** The delegation depth of the child turn. */
  depth: z.number().int().min(0),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type DelegatedTask = z.infer<typeof delegatedTaskSchema>;

/** What a coordinator asks for when it hands work to another agent. */
export const botDispatchRequestSchema = z.object({
  /** The room the work is delegated from. */
  conversationId: idSchema,
  /** The agent connection that should do the work. */
  agentConnectionId: idSchema,
  /** What it should do. */
  instruction: z.string().min(1).max(10_000),
  /** The title of the tracked task. Defaults to the first line of the instruction. */
  title: z.string().min(1).max(300).optional(),
  /** An existing tracked task to record the work as. */
  taskId: idSchema.optional(),
});
export type BotDispatchRequest = z.infer<typeof botDispatchRequestSchema>;

/** What the dispatch tool answers with. */
export const botDispatchResultSchema = z.object({
  /** The record of the handover. */
  delegatedTask: delegatedTaskSchema,
  /** The tracked task the work was recorded as. */
  taskId: z.string().optional(),
  /** The child turn that will do the work. */
  childTurnId: z.string().optional(),
});
export type BotDispatchResult = z.infer<typeof botDispatchResultSchema>;

/** A bot registration. */
export const botRegistrationSchema = z.object({
  conversationId: idSchema,
  agentConnectionId: idSchema,
  role: botRoleSchema,
  displayName: z.string().min(1).max(200).optional(),
  scope: botScopeSchema.partial().optional(),
});
export type BotRegistration = z.infer<typeof botRegistrationSchema>;
