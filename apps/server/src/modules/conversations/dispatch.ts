import { and, asc, eq } from 'drizzle-orm';
import type { Message, Participant } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { conversations, executions, messages } from '../../db/schema.js';
import { newId } from '../../lib/ids.js';
import type { EventsService } from '../../modules/events/service.js';
import type { Queue } from '../../queue/client.js';
import { deriveChainState, planRouting, type RoutingDecision } from './routing.js';

/**
 * Dispatch is shared by the API server and the worker.
 *
 * Both need to answer the same question — "does this message make any agent
 * responsible for answering?" — and both must apply the same safeguards.
 * Keeping one implementation is what makes the guarantees hold.
 */

export interface Dispatch {
  executionId: string;
  agentConnectionId: string;
  correlationId: string;
}

export interface DispatchResult {
  dispatches: Dispatch[];
  routing: RoutingDecision;
}

export interface DispatchInput {
  db: Database;
  events: EventsService;
  queue: Queue;
  conversationId: string;
  /** The message that may trigger turns. */
  message: Message;
  participants: Participant[];
  correlationId: string;
  /** Delegation depth of the message being dispatched. */
  depth: number;
  /** Restrict dispatch to these agent connections. */
  explicitTargets?: string[];
}

/**
 * Decide who should receive a turn for a message, and queue those turns.
 *
 * The routing rules live in `routing.ts`; this function only turns the
 * decision into executions and queued jobs.
 */
export function planAndDispatch(input: DispatchInput): DispatchResult {
  const { db, events, queue, conversationId, message, participants, correlationId } = input;

  const conversation = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) {
    return {
      dispatches: [],
      routing: { targets: [], reason: 'The conversation no longer exists.' },
    };
  }

  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(200)
    .all()
    .map((row) => ({
      origin: row.origin ?? null,
      createdAt: row.createdAt,
    }));

  const chain = deriveChainState(history);

  const text = message.content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');

  const decision = planRouting({
    conversation: {
      id: conversation.id,
      routingMode: conversation.routingMode as never,
      coordinatorId: conversation.coordinatorId ?? undefined,
      paused: conversation.paused,
      maxTurns: conversation.maxTurns,
      maxDurationSeconds: conversation.maxDurationSeconds,
      maxSpendUnits: conversation.maxSpendUnits,
    },
    participants,
    message: {
      senderId: message.senderId,
      text,
      origin: message.origin ?? { kind: 'human', actorId: message.senderId, depth: input.depth },
    },
    chain,
    ...(input.explicitTargets ? { explicitTargets: input.explicitTargets } : {}),
  });

  if (conversation.paused) {
    return {
      dispatches: [],
      routing: { targets: [], reason: 'Conversation is paused.', blocked: 'paused' },
    };
  }

  const dispatches: Dispatch[] = [];
  const now = new Date().toISOString();

  for (const agentConnectionId of decision.targets) {
    const participant = participants.find((p) => p.agentConnectionId === agentConnectionId);
    if (!participant) continue;

    // Echo protection: never dispatch the same turn to the same agent twice.
    const duplicate = db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.correlationId, correlationId),
          eq(messages.replyToId, message.id),
          eq(messages.senderId, participant.id),
        ),
      )
      .get();
    if (duplicate) continue;

    const executionId = newId('exe');
    db.insert(executions)
      .values({
        id: executionId,
        workspaceId: conversation.workspaceId,
        conversationId,
        taskId: null,
        externalRef: null,
        agentConnectionId,
        executionOwner: 'personal-os',
        status: 'queued',
        error: null,
        spendUnits: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
      })
      .run();

    queue.enqueue({
      workspaceId: conversation.workspaceId,
      type: 'chat.turn',
      payload: {
        conversationId,
        agentConnectionId,
        executionId,
        parentMessageId: message.id,
        correlationId,
        depth: input.depth + 1,
      },
    });

    events.publish(
      {
        type: 'execution.event',
        conversationId,
        executionId,
        event: { type: 'execution.status', executionId, status: 'queued' },
      },
      { workspaceId: conversation.workspaceId, conversationId },
    );

    dispatches.push({ executionId, agentConnectionId, correlationId });
  }

  return { dispatches, routing: decision };
}
