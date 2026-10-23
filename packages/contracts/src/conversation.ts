import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';
import { personaSchema } from './agent.js';

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
  /**
   * A persona that replaces the connection's base for this conversation
   * only. It names the agent it applies to through `agentConnectionId`.
   */
  personaOverride: personaSchema.optional(),
});
export type Participant = z.infer<typeof participantSchema>;

/**
 * One piece of a message.
 *
 * The union grew additively: a message may now carry an attachment — a
 * reference to a resource, with the name and the kind of thing it is — and,
 * where the data supports it, an image. A message written before this grew
 * still parses: the three older shapes are unchanged and nothing was
 * reinterpreted.
 */
export const contentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('artifact'), resourceId: idSchema }),
  z.object({ type: z.literal('file'), resourceId: idSchema }),
  z.object({
    type: z.literal('attachment'),
    /** The resource the attachment points at. */
    resourceId: idSchema,
    /** What the owner called it. */
    displayName: z.string().min(1).max(300),
    /** What kind of thing it is, when the system knows. */
    mimeType: z.string().min(1).max(200).optional(),
  }),
  z.object({
    type: z.literal('image'),
    /** The resource the image belongs to. */
    resourceId: idSchema,
    /** What the owner called it. */
    displayName: z.string().min(1).max(300),
    /** The kind of image it is, when the system knows. */
    mimeType: z.string().min(1).max(200),
    /**
     * Where the bytes are, when the resource publishes a location.
     *
     * The client renders the image from this. It is a reference and never the
     * bytes themselves: a message row stays small, and the resource stays the
     * one place the picture lives.
     */
    url: z.string().min(1).max(2_000).optional(),
  }),
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
  /**
   * The runtime session the message came from.
   *
   * The transcript names the session: a reply that came out of session `7f3a`
   * says so, so a reader can tell one session's answer from another's. Absent
   * means the runtime keeps no session — nothing was claimed that does not
   * exist.
   */
  sessionId: z.string().min(1).optional(),
  /** Chain depth: human=0, each delegated hop increments. */
  depth: z.number().int().min(0).default(0),
});
export type MessageOrigin = z.infer<typeof messageOriginSchema>;

export const messageStatusSchema = z.enum(['streaming', 'complete', 'failed', 'unknown']);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

/**
 * How a message reaches an agent.
 *
 * `queue` is the default: the message waits for the next turn. `steer`
 * delivers it into the turn that is running, and only to that turn's agent.
 */
export const messageDeliverySchema = z.enum(['steer', 'queue']);
export type MessageDelivery = z.infer<typeof messageDeliverySchema>;

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
  /**
   * How this message was sent.
   *
   * `queue` is the default and waits for the next turn; `steer` goes into the
   * turn that is running. Absent means `queue`: a message written before this
   * existed is a queued message, exactly as it was.
   */
  delivery: messageDeliverySchema.optional(),
  /**
   * The sentence the server produced about how this message ended.
   *
   * A message that did not finish says why, in the server's words. The client
   * shows it as it is given: the account of what happened is the server's, and
   * rewording it in the client would be the client telling the owner something
   * the server knows better.
   */
  detail: z.string().optional(),
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
  /**
   * How the message reaches an agent.
   *
   * `queue` is the default and is what happens today: the message waits for
   * the next turn. `steer` delivers it into the turn that is running, and
   * only to that turn's agent. A steer can only be delivered by a runtime
   * that accepts input mid-turn; where it cannot, the degradation has to be
   * reported rather than silent.
   */
  delivery: z.enum(['steer', 'queue']).default('queue'),
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
