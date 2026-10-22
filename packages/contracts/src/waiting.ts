/**
 * What is waiting on the owner.
 *
 * The waiting list is the one place the owner looks to find out what needs
 * them, so its shape crosses the server-to-client boundary. It is published
 * here, once: the server assembles the list against this declaration and the
 * client reads the same one, so a client cannot describe a list the server
 * does not send.
 *
 * The shapes are published as types and not as schemas because nothing parses
 * the list against them at runtime -- the server builds the rows it publishes
 * -- and a schema nothing parses is a second way of saying the same thing.
 */

/** What kind of thing is waiting on the owner. */
export type WaitingKind = 'approval' | 'task' | 'turn' | 'capability';

/**
 * Why the item is on the list.
 *
 * `unknown` is its own reason: the work started and the outcome could not be
 * confirmed. It is not a failure to fix and not a decision to make -- it is
 * something to check.
 */
export type WaitingReason = 'pending' | 'review' | 'blocked' | 'unknown';

/** One thing that is waiting on the owner. */
export interface WaitingItem {
  /** Unique across kinds, so the client can key the list. */
  id: string;
  kind: WaitingKind;
  /** What the item is. */
  title: string;
  /** Why it is waiting on the owner. */
  detail: string;
  reason: WaitingReason;
  workspaceId: string;
  /** The conversation the item came from, when there is one. */
  conversationId: string | null;
  /** The task the item belongs to, when it is about a task. */
  taskId: string | null;
  /** The agent that raised it. */
  agentConnectionId: string | null;
  /**
   * The capability the agent was refused, when it is waiting for a grant.
   *
   * The field is always on the wire: `null` means the kind is not named by a
   * tool, and a capability is the only kind on this list that is.
   *
   * A client that builds a row of its own says `toolName: null`; it does not
   * leave the field out. The route sends the field on every row and the
   * server builds its rows against this declaration, so a declaration that
   * could leave the field out would describe a row the server does not send.
   */
  toolName: string | null;
}
