import { z } from 'zod/v3';
import { isoDateSchema } from './common.js';
import { agentEventSchema, agentConnectionStatusSchema, agentCapabilitiesSchema } from './agent.js';
import { messageSchema } from './conversation.js';
import { delegatedTaskSchema } from './bot.js';
import { factoryTaskSchema } from './factory.js';
import { resourceSchema } from './resource.js';
import { automationRunSchema } from './automation.js';
import { approvalSchema } from './approvals.js';

/**
 * Server-to-client event stream. The web client subscribes once and renders
 * every mutation from this vocabulary.
 */
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.created'),
    message: messageSchema,
  }),
  z.object({
    type: z.literal('message.updated'),
    message: messageSchema,
  }),
  z.object({
    type: z.literal('execution.event'),
    conversationId: z.string().optional(),
    executionId: z.string(),
    event: agentEventSchema,
  }),
  z.object({
    type: z.literal('task.updated'),
    task: factoryTaskSchema,
  }),
  z.object({
    type: z.literal('resource.updated'),
    resource: resourceSchema,
  }),
  z.object({
    type: z.literal('agent.status'),
    connectionId: z.string(),
    status: agentConnectionStatusSchema,
    capabilities: agentCapabilitiesSchema.nullable(),
    lastError: z.string().nullable(),
  }),
  z.object({
    type: z.literal('automation.run'),
    run: automationRunSchema,
  }),
  z.object({
    type: z.literal('approval.decided'),
    approval: approvalSchema,
  }),
  /**
   * The lifecycle of a delegated task.
   *
   * `delegation.started` is when the work was handed over, `delegation.delivered`
   * is when the result reached the room that asked for it, and
   * `delegation.consumed` is when that room's turn read it and ended
   * completed. Delivery is not consumption: the two are separate moments, and
   * a result that was delivered but not consumed is still waiting.
   */
  z.object({
    type: z.literal('delegation.started'),
    delegatedTask: delegatedTaskSchema,
  }),
  z.object({
    type: z.literal('delegation.delivered'),
    delegatedTask: delegatedTaskSchema,
  }),
  z.object({
    type: z.literal('delegation.consumed'),
    delegatedTask: delegatedTaskSchema,
  }),
  z.object({
    type: z.literal('heartbeat'),
    at: isoDateSchema,
  }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type ServerEventType = ServerEvent['type'];
