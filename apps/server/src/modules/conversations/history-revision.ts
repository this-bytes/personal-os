import { createHash } from 'node:crypto';
import type { ContentPart } from '@personal-os/contracts';

/**
 * The revision of a conversation's canonical history.
 *
 * Canonical history is what a resumed turn reads, so it has to be checkable:
 * a reader that holds a revision must be able to tell whether the history
 * changed under it. The revision is a content hash over the messages the
 * history holds, in the order the history holds them.
 *
 * The hash covers the whole prefix, so the revision of a conversation is
 * different from the revision of the same conversation one message later. That
 * is the point: a revision names one point in the history, and the commit
 * that produced it names the point it committed to.
 */
export interface HistoryMessage {
  id: string;
  createdAt: string;
  senderId: string;
  status: string;
  correlationId: string | null;
  content: ContentPart[];
}

/**
 * The revision of a conversation's canonical history through a message.
 *
 * `throughMessageId` is the message the commit that produced the revision
 * wrote. The revision covers that message and everything before it, so the
 * revision of a commit is the revision of the history it committed.
 *
 * When no message is named, the revision covers the whole history given.
 */
export function computeHistoryRevision(
  messages: readonly HistoryMessage[],
  throughMessageId?: string,
): string {
  const ordered = [...messages].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  let included = ordered;
  if (throughMessageId !== undefined) {
    const end = ordered.findIndex((message) => message.id === throughMessageId);
    // A history that does not hold the message commits nothing: the revision
    // is of the whole history, because there is no prefix that ends there.
    included = end === -1 ? ordered : ordered.slice(0, end + 1);
  }

  const hash = createHash('sha256');
  for (const message of included) {
    hash.update(message.id);
    hash.update('\u0000');
    hash.update(message.createdAt);
    hash.update('\u0000');
    hash.update(message.senderId);
    hash.update('\u0000');
    hash.update(message.status);
    hash.update('\u0000');
    hash.update(message.correlationId ?? '');
    hash.update('\u0000');
    hash.update(JSON.stringify(message.content ?? []));
    hash.update('\u0000');
  }
  return hash.digest('hex');
}
