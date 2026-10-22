import type { Bot, BotRole, DelegatedTask, DelegatedTaskStatus } from '@personal-os/contracts';

/**
 * The bot mode, on the client side.
 *
 * The shapes that cross the boundary are the contract's — the panel does not
 * redefine them. What is added here is the view the panel needs and the
 * contract does not carry: the list of rooms the owner can look into.
 */

export type { Bot, BotRole, DelegatedTask, DelegatedTaskStatus };

/** A room the owner can look into. */
export interface RoomSummary {
  id: string;
  title: string;
}

/** The team of a room, and the work it has handed over. */
export interface TeamRoomPayload {
  conversationId: string;
  bots: Bot[];
  delegatedTasks: DelegatedTask[];
}

/**
 * The state a handoff is in, as the panel reads it.
 *
 * `live` is work that is happening now, `waiting` is a result that reached
 * the room and has not been used yet, `done` is a result the room did use,
 * `failed` is work that failed, and `lost` is work whose outcome nobody can
 * confirm.
 */
export type HandoffState = 'live' | 'waiting' | 'done' | 'failed' | 'lost';

/**
 * Where a handoff is, from the record alone.
 *
 * Delivery and consumption are two moments, and they read differently: a
 * result that reached the room is not the same as a result the room used.
 */
export function handoffState(delegation: DelegatedTask): HandoffState {
  if (
    delegation.status === 'queued' ||
    delegation.status === 'running' ||
    delegation.status === 'stopping'
  ) {
    return 'live';
  }
  if (delegation.status === 'failed') return 'failed';
  if (delegation.status === 'lost' || delegation.status === 'cancelled') return 'lost';
  if (delegation.consumedAt) return 'done';
  if (delegation.deliveredAt) return 'waiting';
  return 'live';
}
