import { RESOURCE_AUTHOR_OWNER, RESOURCE_AUTHOR_SYSTEM } from '@personal-os/contracts';

/**
 * Who made a change.
 *
 * Two kinds and no more: the owner, by session or by owner token, and an
 * agent connection. The id is the authenticated identity's own id, and it
 * never comes from a request body — a body can ask to be credited, and the
 * server does not take its word for it.
 */
export interface Author {
  kind: 'owner' | 'agent';
  /** The owner's user id, when the request carried one. */
  userId?: string;
  /** The agent connection's id, when the request carried one. */
  agentConnectionId?: string;
}

/**
 * The value a write records as its author.
 *
 * A closed set: an agent connection's id, the owner's user id, the literal
 * `owner` for a write by the owner when no user id is known, and the literal
 * `system` for a write with no authenticated actor behind it. The measure
 * counts the agent form by its prefix, so this is the one place the two
 * id spaces are told apart.
 */
export function authorOf(author: Author): string {
  if (author.kind === 'agent') {
    return author.agentConnectionId ?? RESOURCE_AUTHOR_SYSTEM;
  }
  return author.userId ?? RESOURCE_AUTHOR_OWNER;
}
