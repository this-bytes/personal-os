/**
 * Session references, correlation and the terminal event of a turn.
 *
 * A turn happens inside a runtime that may or may not keep a session. This
 * module holds the three things every reader needs to agree on:
 *
 * - **the session reference** — the durable name a conversation holds for the
 *   runtime session behind it, and whether that session can be re-entered;
 * - **the dispatch key** — the identity of a dispatch, so that a dispatch
 *   repeated with the same key does not start a second run;
 * - **the terminal event** — the one event that ends a turn, defined once so
 *   that the panel, the MCP tools and the audit trail cannot disagree.
 *
 * Nothing here reaches for a database or a clock. The shapes and the rules are
 * the contract; the storage and the hashing live where they belong.
 */
import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';
import { turnStatusSchema, type TurnStatus } from './chat.js';

/**
 * Whether a runtime's own session can be entered again.
 *
 * `resumable` means the next turn in the same conversation continues the same
 * native session. `fresh` means the runtime does not keep one: every turn
 * starts a new session, and the product says so rather than pretending the
 * conversation continues where it left off.
 *
 * The value is a fact about the runtime, not a hope. A runtime that cannot
 * resume is recorded as `fresh` and the transcript does not claim a continuity
 * that does not exist.
 */
export const sessionContinuitySchema = z.enum(['resumable', 'fresh']);
export type SessionContinuity = z.infer<typeof sessionContinuitySchema>;

/**
 * A conversation's durable reference to the runtime session behind it.
 *
 * The reference is published so a client can read it: a room that shows
 * "session 7f3a" is telling the truth about the run it is looking at, and a
 * second turn in that room continues that session when the runtime allows it.
 */
export const sessionReferenceSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  conversationId: idSchema,
  /** The agent connection whose runtime holds the session. */
  agentConnectionId: idSchema,
  /** The runtime's own name for the session. */
  sessionId: z.string().min(1),
  /** Whether the next turn can continue this session. */
  continuity: sessionContinuitySchema,
  /**
   * The revision of the connection's capability set when the session was
   * established. Null when the connection had never been probed.
   */
  capabilitiesRevision: z.number().int().min(0).nullable(),
  establishedAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type SessionReference = z.infer<typeof sessionReferenceSchema>;

/**
 * The identity of a dispatch.
 *
 * A dispatch is one message going to one agent in one conversation. The key is
 * derived from those three facts, so the same dispatch always produces the
 * same key — and a dispatch repeated with the same key is the same dispatch,
 * not a second run.
 */
export function dispatchIdempotencyKey(input: {
  conversationId: string;
  parentMessageId: string;
  agentConnectionId: string;
}): string {
  return `dsp:${input.conversationId}:${input.parentMessageId}:${input.agentConnectionId}`;
}

/**
 * The statuses that end a turn.
 *
 * A turn that is in one of these has ended. A turn that is `queued`,
 * `running`, `blocked` or `unknown` has not: it is admitted, working, waiting
 * for the owner, or waiting for the owner to say how it went. The list is the
 * definition of "finished", and it is read by every reader — the panel, the
 * MCP tools, the audit trail and the worker.
 *
 * `unknown` is deliberately not on the list. It is a question, not an answer:
 * the turn started and nobody can say how it ended, so the owner closes it
 * (CONTRACTS.md, "The unknown outcome"). Until it is closed it has an
 * admission and no terminal event, and the close publishes the one event that
 * ends it.
 */
export const TERMINAL_TURN_STATUSES = [
  'committed',
  'completed',
  'failed',
  'cancelled',
  'lost',
] as const;
export type TerminalTurnStatus = (typeof TERMINAL_TURN_STATUSES)[number];

/**
 * Whether a status ends a turn.
 */
export function isTerminalTurnStatus(status: TurnStatus): status is TerminalTurnStatus {
  return (TERMINAL_TURN_STATUSES as readonly string[]).includes(status);
}

/**
 * The published event name for a turn status, when the status has one.
 *
 * `queued` is the turn's admission. Every status that ends a turn has an
 * event name, because the event says how the turn ended:
 *
 * - `turn.committed` — the turn's output is in canonical history;
 * - `turn.completed` — the adapter returned and the output is not in a
 *   canonical history, so there is nothing to continue from;
 * - `turn.failed` — the turn failed;
 * - `turn.cancelled` — the turn was cancelled;
 * - `turn.lost` — delegated work whose executor is gone was settled rather
 *   than retried.
 *
 * `running`, `blocked` and `unknown` are states of a turn rather than events,
 * and the row says the state. A turn in `unknown` has an admission and no
 * terminal event: the owner closes it, and the close publishes the one event
 * that ends it.
 */
export function turnEventFor(status: TurnStatus): string | null {
  switch (status) {
    case 'queued':
      return 'turn.admitted';
    case 'committed':
      return 'turn.committed';
    case 'completed':
      return 'turn.completed';
    case 'failed':
      return 'turn.failed';
    case 'cancelled':
      return 'turn.cancelled';
    case 'unknown':
      // A question, not an ending. The owner closes the turn, and the close
      // publishes the one event that ends it.
      return null;
    case 'lost':
      return 'turn.lost';
    default:
      return null;
  }
}

/**
 * The one event that ends a turn.
 *
 * Every terminal status has an event name, so the event is never a guess.
 */
export function terminalTurnEvent(status: TurnStatus): string | null {
  return isTerminalTurnStatus(status) ? turnEventFor(status) : null;
}

/**
 * The continuity a connection's capabilities imply.
 *
 * A connection that reports persistent sessions can continue one; a connection
 * that does not, or that nobody has probed yet, cannot. The capability row
 * records the limit, and this is how the limit is read.
 */
export function continuityForCapabilities(
  capabilities: { persistentSessions: boolean } | null | undefined,
): SessionContinuity {
  return capabilities?.persistentSessions === true ? 'resumable' : 'fresh';
}
