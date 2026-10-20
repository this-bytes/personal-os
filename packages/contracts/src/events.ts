import { z } from 'zod';
import { isoDateSchema } from './common.js';
import { agentEventSchema, agentConnectionStatusSchema, agentCapabilitiesSchema } from './agent.js';
import { messageSchema } from './conversation.js';
import { factoryTaskSchema } from './factory.js';
import { resourceSchema } from './resource.js';
import { automationRunSchema } from './automation.js';

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
    type: z.literal('heartbeat'),
    at: isoDateSchema,
  }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type ServerEventType = ServerEvent['type'];
