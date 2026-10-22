import { and, eq, isNull } from 'drizzle-orm';
import { contentToText, type ContentPart, type Message } from '@personal-os/contracts';
import { messages, type Database } from '@personal-os/server/db';
import type { EventsService } from '@personal-os/server/runtime';

/**
 * The channel a running turn reads the owner's steers from.
 *
 * A steer is a message the owner sends while a turn is running, and it
 * arrives in the middle of that turn. The channel is how it gets there: the
 * turn's adapter reads from it while it runs, and the channel ends when the
 * turn does.
 *
 * **A message that arrives after the channel has closed is not this turn's.**
 * The owner sent it into a turn that is over, and the next turn takes it.
 */
export interface SteerChannel {
  /** What the adapter reads. */
  readonly messages: AsyncIterable<string>;
  /** Put one message into the channel. */
  push(text: string): void;
  /** End the channel: the turn is over and nothing more will arrive. */
  close(): void;
}

export function createSteerChannel(): SteerChannel {
  const buffered: string[] = [];
  let waiting: ((result: IteratorResult<string>) => void) | null = null;
  let closed = false;

  const stream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<string>> {
          const next = buffered.shift();
          if (next !== undefined) return { value: next, done: false };
          if (closed) return { value: undefined, done: true };
          return new Promise<IteratorResult<string>>((resolve) => {
            waiting = resolve;
          });
        },
      };
    },
  };

  return {
    messages: stream,
    push(text: string): void {
      if (closed) return;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: text, done: false });
        return;
      }
      buffered.push(text);
    },
    close(): void {
      if (closed) return;
      closed = true;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: undefined, done: true });
      }
    },
  };
}

/** How often the running turn looks for a steer the owner has sent. */
const STEER_POLL_MS = 200;

/**
 * Wait, unless the turn ends first.
 *
 * The wait ends when the turn does, so a turn that finishes does not wait for
 * the next poll before it is over.
 */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** The message as the client reads it. */
function toPublishedMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    targetParticipantIds: row.targetParticipantIds,
    replyToId: row.replyToId ?? undefined,
    kind: row.kind as Message['kind'],
    content: row.content as ContentPart[],
    status: row.status as Message['status'],
    correlationId: row.correlationId ?? undefined,
    origin: row.origin ?? undefined,
    executionId: row.executionId ?? undefined,
    delivery: row.delivery,
    detail: row.detail ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * Take the steers the owner sent while this turn was running.
 *
 * Each one is marked as taken the moment it is handed to the turn: a steer
 * nobody took is not dropped, it waits for the next turn.
 */
export async function feedSteers(options: {
  db: Database;
  events: EventsService;
  workspaceId: string;
  conversationId: string;
  /** The participant the turn runs for. A steer goes to one agent alone. */
  participantId: string;
  /** When this turn started. A steer sent before that is not this turn's. */
  since: string;
  channel: SteerChannel;
  signal: AbortSignal;
}): Promise<void> {
  while (!options.signal.aborted) {
    const pending = options.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, options.conversationId),
          eq(messages.delivery, 'steer'),
          isNull(messages.consumedAt),
        ),
      )
      .all()
      .filter((row) => row.targetParticipantIds.includes(options.participantId))
      .filter((row) => row.createdAt > options.since);

    for (const row of pending) {
      const text = contentToText(row.content as ContentPart[]).trim();
      const now = new Date().toISOString();

      options.db
        .update(messages)
        .set({ consumedAt: now, detail: 'The turn that was running took this steer.' })
        .where(eq(messages.id, row.id))
        .run();

      if (text.length > 0) options.channel.push(text);

      const taken = options.db.select().from(messages).where(eq(messages.id, row.id)).get();
      if (taken) {
        options.events.publish(
          { type: 'message.updated', message: toPublishedMessage(taken) },
          { workspaceId: options.workspaceId, conversationId: options.conversationId },
        );
      }
    }

    await delay(STEER_POLL_MS, options.signal);
  }
}

/**
 * Record the steers that arrived before this turn and were never taken.
 *
 * **An unconsumed steer is not dropped.** It stays in the room, this turn's
 * context carries it, and the message says that it was delivered late.
 */
export function recordLateSteers(options: {
  db: Database;
  conversationId: string;
  participantId: string;
  /** When this turn started. A steer sent before that was not this turn's. */
  since: string;
}): number {
  const late = options.db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, options.conversationId),
        eq(messages.delivery, 'steer'),
        isNull(messages.consumedAt),
      ),
    )
    .all()
    .filter((row) => row.targetParticipantIds.includes(options.participantId))
    .filter((row) => row.createdAt <= options.since);

  const now = new Date().toISOString();
  for (const row of late) {
    options.db
      .update(messages)
      .set({
        consumedAt: now,
        detail:
          'Delivered late: the turn that was running did not take this steer, so this turn did.',
      })
      .where(eq(messages.id, row.id))
      .run();
  }

  return late.length;
}
