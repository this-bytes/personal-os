import { z } from 'zod';
import { idSchema, isoDateSchema } from './common.js';

/**
 * Routing mode controls *routing*, never agent intelligence.
 *
 * - mentions    only explicitly addressed agents receive a turn
 * - coordinator a single designated agent receives the request and may delegate
 * - autonomous  agents may initiate work inside a granted scope and limits
 */
export const routingModeSchema = z.enum(['mentions', 'coordinator', 'autonomous']);
export type RoutingMode = z.infer<typeof routingModeSchema>;

export const conversationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string().min(1).max(300),
  routingMode: routingModeSchema,
  coordinatorId: idSchema.optional(),
  createdAt: isoDateSchema,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const participantTypeSchema = z.enum(['human', 'agent']);
export type ParticipantType = z.infer<typeof participantTypeSchema>;

export const participantSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  type: participantTypeSchema,
  agentConnectionId: idSchema.optional(),
  displayName: z.string().min(1).max(200),
});
export type Participant = z.infer<typeof participantSchema>;

export const contentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('artifact'), resourceId: idSchema }),
  z.object({ type: z.literal('file'), resourceId: idSchema }),
]);
export type ContentPart = z.infer<typeof contentPartSchema>;

/**
 * `origin` records where a message came from. Together with `correlationId`
 * it prevents echo loops and duplicate processing of the same event.
 */
export const messageOriginSchema = z.object({
  kind: z.enum(['human', 'agent', 'system', 'automation']),
  actorId: idSchema,
  agentConnectionId: idSchema.optional(),
  /** Chain depth: human=0, each delegated hop increments. */
  depth: z.number().int().min(0).default(0),
});
export type MessageOrigin = z.infer<typeof messageOriginSchema>;

export const messageStatusSchema = z.enum(['streaming', 'complete', 'failed', 'unknown']);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const messageKindSchema = z.enum(['text', 'system', 'artifact', 'activity']);
export type MessageKind = z.infer<typeof messageKindSchema>;

export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
  targetParticipantIds: z.array(idSchema),
  replyToId: idSchema.optional(),
  kind: messageKindSchema,
  content: z.array(contentPartSchema),
  createdAt: isoDateSchema,
  // --- extensions required by the production implementation ---
  status: messageStatusSchema.default('complete'),
  correlationId: idSchema.optional(),
  origin: messageOriginSchema.optional(),
  executionId: idSchema.optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const createConversationInputSchema = z.object({
  workspaceId: idSchema,
  title: z.string().min(1).max(300),
  routingMode: routingModeSchema.default('mentions'),
  coordinatorId: idSchema.optional(),
  participantAgentConnectionIds: z.array(idSchema).default([]),
});
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

export const postMessageInputSchema = z.object({
  content: z.array(contentPartSchema).min(1),
  replyToId: idSchema.optional(),
  /** Explicit targets. When omitted the routing engine decides. */
  targetParticipantIds: z.array(idSchema).optional(),
});
export type PostMessageInput = z.infer<typeof postMessageInputSchema>;

/**
 * A mention is an `@` that starts a word. The look-behind keeps email
 * addresses such as `user@example.com` from being read as mentions.
 */
const MENTION_PATTERN = /(?<![\p{L}\p{N}._+-])@([\p{L}\p{N}][\p{L}\p{N}._-]{0,63})/gu;

/** Extract raw mention tokens (without the `@`) from arbitrary text. */
export function extractMentionTokens(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const token = match[1];
    if (token && !out.includes(token)) out.push(token);
  }
  return out;
}

/**
 * Resolve mention tokens against known participants.
 * Matching is case-insensitive on display name and on agent connection name.
 */
export function resolveMentions(
  text: string,
  participants: Array<{
    id: string;
    displayName: string;
    agentConnectionId?: string;
    connectionName?: string;
  }>,
): Array<{ id: string; displayName: string; agentConnectionId?: string; connectionName?: string }> {
  const tokens = extractMentionTokens(text).map((t) => t.toLowerCase());
  if (tokens.length === 0) return [];
  return participants.filter((p) => {
    const candidates = [p.displayName, p.connectionName]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map((v) => v.toLowerCase());
    return tokens.some((token) =>
      candidates.some((c) => c === token || c.split(/\s+/).includes(token)),
    );
  });
}

/** Plain-text projection of a message, used for routing, previews and prompts. */
export function contentToText(content: ContentPart[]): string {
  return content
    .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
