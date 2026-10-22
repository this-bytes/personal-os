import { and, asc, eq } from 'drizzle-orm';
import type { Message, MessageStatus, Participant } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { conversations, executions, messages } from '../../db/schema.js';
import { newId } from '../../lib/ids.js';
import type { AuditService } from '../audit/service.js';
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
  /** The audit trail, where a stopped routing is recorded. */
  audit: AuditService;
  conversationId: string;
  /** The message that may trigger turns. */
  message: Message;
  participants: Participant[];
  correlationId: string;
  /** Delegation depth of the message being dispatched. */
  depth: number;
  /** Restrict dispatch to these agent connections. */
  explicitTargets?: string[];
  /**
   * The delegation whose result this message delivers.
   *
   * The marker is what lets a worker's report wake the coordinator that asked
   * for the work. It is set by the host, which knows the delegation, and it
   * is not something a message can claim for itself.
   */
  delegation?: { id: string };
}

/**
 * Decide who should receive a turn for a message, and queue those turns.
 *
 * The routing rules live in `routing.ts`; this function only turns the
 * decision into executions and queued jobs.
 */
export function planAndDispatch(input: DispatchInput): DispatchResult {
  const { db, events, queue, conversationId, message, participants, correlationId, audit } = input;

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

  // A turn whose outcome could not be confirmed routes no further work.
  //
  // The contract says an unknown item is never retried automatically: there is
  // no reaper, no redispatch and no reconciliation pass. That promise is held
  // by the worker's reaper, and this is the other path it covers — the one the
  // conversation itself takes when an agent's answer comes back. A reply whose
  // outcome nobody can confirm is a question for the owner, and the owner
  // closes it; the product does not carry on as if the turn had finished.
  if (!isConfirmedOutcome(message.status)) {
    recordStoppedDispatch({ audit, conversation, message });

    return {
      dispatches: [],
      routing: {
        targets: [],
        reason:
          'The turn stopped because its outcome could not be confirmed, so no further work was routed.',
        blocked: 'unconfirmed',
      },
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
    ...(input.delegation ? { delegation: input.delegation } : {}),
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

/**
 * Whether a message's status says how the turn ended.
 *
 * `complete` and `failed` are both settled answers: the turn finished, and we
 * know which way it went. `unknown` says the work started and nobody knows
 * how it ended, and `streaming` says it has not ended yet. Neither of those is
 * a confirmed outcome, and a message without one does not route work.
 */
function isConfirmedOutcome(status: MessageStatus): boolean {
  return status === 'complete' || status === 'failed';
}

/**
 * Record that the routing stopped.
 *
 * The stop is written to the audit trail beside the entry that recorded the
 * unknown outcome itself, so an owner reading the trail can see that the turn
 * stopped because nobody could confirm how it ended — and not because it
 * finished.
 *
 * The entry names the message that was not routed, because the message is what
 * the owner reads; the execution it belongs to travels with it in the
 * metadata.
 */
function recordStoppedDispatch(input: {
  audit: AuditService;
  conversation: { id: string; workspaceId: string };
  message: Message;
}): void {
  const { audit, conversation, message } = input;

  audit.record({
    workspaceId: conversation.workspaceId,
    // The turn belongs to the agent, and the trail names it the way the entry
    // beside it does: by the connection whose turn could not be confirmed.
    actorType: 'agent',
    actorId: message.origin?.agentConnectionId ?? 'unknown',
    action: 'message.dispatch.stopped',
    targetType: 'message',
    targetId: message.id,
    result: 'unknown',
    metadata: {
      reason:
        'The turn stopped because its outcome could not be confirmed, so no further work was routed.',
      messageId: message.id,
      conversationId: conversation.id,
      executionId: message.executionId ?? null,
    },
  });
}
