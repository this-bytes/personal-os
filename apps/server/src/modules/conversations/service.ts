import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  contentToText,
  type ContentPart,
  type Conversation,
  type Message,
  type Participant,
  type Persona,
  type RoutingMode,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { conversations, executions, messages, participants } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { EventsService } from '../events/service.js';
import type { Queue } from '../../queue/client.js';
import type { AuditService } from '../audit/service.js';
import { planAndDispatch } from './dispatch.js';
import {
  deriveChainState,
  planRouting,
  type RoutingBlockReason,
  type RoutingDecision,
} from './routing.js';

export interface ConversationDetail extends Conversation {
  paused: boolean;
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  participants: Participant[];
}

export interface PostMessageInput {
  content: ContentPart[];
  replyToId?: string;
  targetParticipantIds?: string[];
  /** When the caller is an agent, the message is attributed to it. */
  sender?: { kind: 'agent'; agentConnectionId: string; actorId: string };
  /** Human sender display name, used when creating the participant. */
  humanDisplayName?: string;
}

export interface Dispatch {
  executionId: string;
  agentConnectionId: string;
  correlationId: string;
}

/**
 * A turn whose outcome could not be confirmed.
 *
 * A turn is identified by its execution: the execution is the run itself, and
 * the message it produced is that run's own record.
 */
export interface UnknownTurn {
  executionId: string;
  conversationId: string;
  conversationTitle: string;
  agentConnectionId: string | null;
}

export interface PostMessageResult {
  message: Message;
  dispatches: Dispatch[];
  routing: RoutingDecision;
}

export interface ConversationsService {
  list(workspaceId: string): ConversationDetail[];
  get(id: string): ConversationDetail;
  /**
   * The turns of a workspace whose outcome could not be confirmed.
   *
   * A turn that belongs to a task is not among them: that run is the task's
   * own outcome, and the task already carries it. What is left are the runs
   * that belong to a conversation alone.
   */
  listUnknownTurns(workspaceId: string): UnknownTurn[];
  create(input: {
    workspaceId: string;
    title: string;
    routingMode: RoutingMode;
    coordinatorId?: string;
    participantAgentConnectionIds?: string[];
    humanDisplayName?: string;
  }): ConversationDetail;
  update(
    id: string,
    patch: {
      title?: string;
      routingMode?: RoutingMode;
      coordinatorId?: string;
      maxTurns?: number;
      maxDurationSeconds?: number;
      maxSpendUnits?: number;
      paused?: boolean;
    },
  ): ConversationDetail;
  remove(id: string): void;
  addParticipant(
    conversationId: string,
    input: {
      type: 'human' | 'agent';
      agentConnectionId?: string;
      displayName: string;
      /** A persona that replaces the connection's base for this conversation. */
      personaOverride?: Persona;
    },
  ): Participant;
  updateParticipant(
    conversationId: string,
    participantId: string,
    patch: {
      /** A persona that replaces the connection's base. `null` clears it. */
      personaOverride?: Persona | null;
    },
  ): Participant;
  removeParticipant(conversationId: string, participantId: string): void;
  listMessages(conversationId: string, options?: { limit?: number; before?: string }): Message[];
  postMessage(conversationId: string, input: PostMessageInput): Promise<PostMessageResult>;
  buildContext(conversationId: string, limit?: number): string;
}

export interface ConversationsServiceOptions {
  db: Database;
  events: EventsService;
  queue: Queue;
  /** The audit trail, where a stopped routing is recorded. */
  audit: AuditService;
  /**
   * Resolve the display name of an agent connection. Participants are named
   * after their agent so that "@Echo" mentions work in the composer.
   */
  agentDisplayName?: (agentConnectionId: string) => string;
}

/**
 * Conversations are the centre of the product. A conversation works with
 * one agent, several agents, or with no active agent at all.
 */
export function createConversationsService(
  options: ConversationsServiceOptions,
): ConversationsService {
  const { db, events, queue } = options;
  const displayNameFor = (agentConnectionId: string): string => {
    try {
      return options.agentDisplayName?.(agentConnectionId) ?? agentConnectionId;
    } catch {
      return agentConnectionId;
    }
  };

  const toConversation = (row: typeof conversations.$inferSelect): ConversationDetail => ({
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    routingMode: row.routingMode as RoutingMode,
    coordinatorId: row.coordinatorId ?? undefined,
    createdAt: row.createdAt,
    paused: row.paused,
    maxTurns: row.maxTurns,
    maxDurationSeconds: row.maxDurationSeconds,
    maxSpendUnits: row.maxSpendUnits,
    participants: listParticipants(row.id),
  });

  function listParticipants(conversationId: string): Participant[] {
    return db
      .select()
      .from(participants)
      .where(eq(participants.conversationId, conversationId))
      .all()
      .map((row) => ({
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as Participant['type'],
        agentConnectionId: row.agentConnectionId ?? undefined,
        displayName: row.displayName,
        personaOverride: row.personaOverride ?? undefined,
      }));
  }

  function toMessage(row: typeof messages.$inferSelect): Message {
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      targetParticipantIds: row.targetParticipantIds,
      replyToId: row.replyToId ?? undefined,
      kind: row.kind as Message['kind'],
      content: row.content,
      status: row.status as Message['status'],
      correlationId: row.correlationId ?? undefined,
      origin: row.origin ?? undefined,
      executionId: row.executionId ?? undefined,
      detail: row.detail ?? undefined,
      createdAt: row.createdAt,
    };
  }

  function listMessageRows(conversationId: string, limit: number, before?: string) {
    const conditions = [eq(messages.conversationId, conversationId)];
    if (before) conditions.push(eq(messages.createdAt, before));
    return db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .all();
  }

  const service: ConversationsService = {
    list(workspaceId): ConversationDetail[] {
      return db
        .select()
        .from(conversations)
        .where(eq(conversations.workspaceId, workspaceId))
        .all()
        .map(toConversation);
    },

    get(id): ConversationDetail {
      const row = db.select().from(conversations).where(eq(conversations.id, id)).get();
      if (!row) throw errors.notFound('Conversation');
      return toConversation(row);
    },

    listUnknownTurns(workspaceId): UnknownTurn[] {
      return db
        .select({
          executionId: executions.id,
          conversationId: executions.conversationId,
          conversationTitle: conversations.title,
          agentConnectionId: executions.agentConnectionId,
        })
        .from(executions)
        .innerJoin(conversations, eq(conversations.id, executions.conversationId))
        .where(
          and(
            eq(executions.workspaceId, workspaceId),
            eq(executions.status, 'unknown'),
            isNull(executions.taskId),
          ),
        )
        .all()
        .map((row) => ({
          executionId: row.executionId,
          conversationId: row.conversationId!,
          conversationTitle: row.conversationTitle,
          agentConnectionId: row.agentConnectionId,
        }));
    },

    create(input): ConversationDetail {
      const id = newId('cnv');
      const now = new Date().toISOString();

      db.insert(conversations)
        .values({
          id,
          workspaceId: input.workspaceId,
          title: input.title.trim(),
          routingMode: input.routingMode,
          coordinatorId: input.coordinatorId ?? null,
          paused: false,
          maxTurns: 8,
          maxDurationSeconds: 900,
          maxSpendUnits: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      if (input.humanDisplayName) {
        service.addParticipant(id, { type: 'human', displayName: input.humanDisplayName });
      }

      for (const connectionId of input.participantAgentConnectionIds ?? []) {
        const participant = db
          .select()
          .from(participants)
          .where(
            and(
              eq(participants.conversationId, id),
              eq(participants.agentConnectionId, connectionId),
            ),
          )
          .get();
        if (participant) continue;
        service.addParticipant(id, {
          type: 'agent',
          agentConnectionId: connectionId,
          displayName: displayNameFor(connectionId),
        });
      }

      return service.get(id);
    },

    update(id, patch): ConversationDetail {
      const current = service.get(id);

      if (patch.coordinatorId !== undefined) {
        const coordinator = listParticipants(id).find((p) => p.id === patch.coordinatorId);
        if (!coordinator || coordinator.type !== 'agent') {
          throw errors.validation(
            'The coordinator must be an agent participant of this conversation.',
          );
        }
      }

      db.update(conversations)
        .set({
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.routingMode !== undefined ? { routingMode: patch.routingMode } : {}),
          ...(patch.coordinatorId !== undefined ? { coordinatorId: patch.coordinatorId } : {}),
          ...(patch.maxTurns !== undefined ? { maxTurns: patch.maxTurns } : {}),
          ...(patch.maxDurationSeconds !== undefined
            ? { maxDurationSeconds: patch.maxDurationSeconds }
            : {}),
          ...(patch.maxSpendUnits !== undefined ? { maxSpendUnits: patch.maxSpendUnits } : {}),
          ...(patch.paused !== undefined ? { paused: patch.paused } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, id))
        .run();

      if (patch.paused === true) {
        queue.cancelForConversation(id);
      }

      return service.get(id);
    },

    remove(id): void {
      service.get(id);
      queue.cancelForConversation(id);
      db.delete(conversations).where(eq(conversations.id, id)).run();
    },

    addParticipant(conversationId, input): Participant {
      const row = {
        id: newId('prt'),
        conversationId,
        type: input.type,
        agentConnectionId: input.agentConnectionId ?? null,
        displayName: input.displayName.trim(),
        personaOverride: input.personaOverride ?? null,
        joinedAt: new Date().toISOString(),
      };
      db.insert(participants).values(row).run();
      return {
        id: row.id,
        conversationId,
        type: input.type,
        agentConnectionId: row.agentConnectionId ?? undefined,
        displayName: row.displayName,
        personaOverride: row.personaOverride ?? undefined,
      };
    },

    updateParticipant(conversationId, participantId, patch): Participant {
      const row = db
        .select()
        .from(participants)
        .where(
          and(eq(participants.conversationId, conversationId), eq(participants.id, participantId)),
        )
        .get();
      if (!row) throw errors.notFound('Participant');

      if (patch.personaOverride !== undefined) {
        db.update(participants)
          .set({ personaOverride: patch.personaOverride })
          .where(eq(participants.id, participantId))
          .run();
      }

      const override =
        patch.personaOverride !== undefined ? patch.personaOverride : row.personaOverride;

      return {
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as Participant['type'],
        agentConnectionId: row.agentConnectionId ?? undefined,
        displayName: row.displayName,
        personaOverride: override ?? undefined,
      };
    },

    removeParticipant(conversationId, participantId): void {
      db.delete(participants)
        .where(
          and(eq(participants.conversationId, conversationId), eq(participants.id, participantId)),
        )
        .run();
    },

    listMessages(conversationId, options): Message[] {
      const limit = Math.min(options?.limit ?? 200, 500);
      return listMessageRows(conversationId, limit, options?.before).map(toMessage).reverse();
    },

    async postMessage(conversationId, input): Promise<PostMessageResult> {
      const conversation = service.get(conversationId);
      const people = listParticipants(conversationId);
      const now = new Date().toISOString();

      const senderParticipant = resolveSender(conversationId, people, input);
      const text = contentToText(input.content);

      const parent = input.replyToId
        ? db.select().from(messages).where(eq(messages.id, input.replyToId)).get()
        : undefined;

      const correlationId =
        input.replyToId && parent?.correlationId
          ? parent.correlationId
          : parent
            ? parent.id
            : newId('corr');

      const origin: Message['origin'] =
        input.sender?.kind === 'agent'
          ? {
              kind: 'agent',
              actorId: input.sender.actorId,
              agentConnectionId: input.sender.agentConnectionId,
              depth: 0,
            }
          : { kind: 'human', actorId: senderParticipant.id, depth: 0 };

      const messageId = newId('msg');
      db.insert(messages)
        .values({
          id: messageId,
          conversationId,
          senderId: senderParticipant.id,
          targetParticipantIds: input.targetParticipantIds ?? [],
          replyToId: input.replyToId ?? null,
          kind: 'text',
          content: input.content,
          status: 'complete',
          correlationId,
          origin,
          executionId: null,
          createdAt: now,
        })
        .run();

      const message = toMessage(
        db.select().from(messages).where(eq(messages.id, messageId)).get()!,
      );
      events.publish(
        { type: 'message.created', message },
        { workspaceId: conversation.workspaceId, conversationId },
      );

      if (conversation.paused) {
        return {
          message,
          dispatches: [],
          routing: { targets: [], reason: 'Conversation is paused.', blocked: 'paused' },
        };
      }

      // The published API names a target by its participant id, and the
      // routing engine names an agent by its connection id. The two are
      // translated here, at the boundary where the published shape enters, so
      // a target that is named is a target that is reached — and so the
      // coordinator rule is asked about the delegation rather than answered
      // by a target that was dropped before the rule saw it.
      //
      // An id that matches no participant is carried through as it was given.
      // Dropping it here is what left a delegation that named nobody with a
      // refusal that named nobody either, and the engine cannot say that the
      // id matched nobody if the id never reaches it.
      const explicitTargets = (input.targetParticipantIds ?? [])
        .map((participantId) => {
          const person = people.find((p) => p.id === participantId);
          if (person) return person.agentConnectionId;
          // A connection id is not a participant id, and the published shape
          // asks for a participant id, so it is dropped as it always was.
          if (people.some((p) => p.agentConnectionId === participantId)) return undefined;
          return participantId;
        })
        .filter((id): id is string => typeof id === 'string');

      const { dispatches, routing } = planAndDispatch({
        db,
        events,
        queue,
        audit: options.audit,
        conversationId,
        message,
        participants: people,
        correlationId,
        depth: origin?.depth ?? 0,
        ...(explicitTargets.length > 0 ? { explicitTargets } : {}),
      });

      return { message, dispatches, routing };
    },

    buildContext(conversationId, limit = 30): string {
      const rows = listMessageRows(conversationId, limit);
      const people = listParticipants(conversationId);
      const nameOf = (participantId: string): string =>
        people.find((p) => p.id === participantId)?.displayName ?? 'unknown';

      return rows
        .map(toMessage)
        .reverse()
        .filter((message) => message.kind === 'text')
        .map((message) => {
          const who =
            message.origin?.kind === 'agent'
              ? `${nameOf(message.senderId)} (agent)`
              : nameOf(message.senderId);
          const text = contentToText(message.content).trim();
          return text.length > 0 ? `${who}: ${text}` : '';
        })
        .filter((line) => line.length > 0)
        .join('\n');
    },
  };

  function resolveSender(
    conversationId: string,
    people: Participant[],
    input: PostMessageInput,
  ): Participant {
    if (input.sender?.kind === 'agent') {
      const existing = people.find((p) => p.agentConnectionId === input.sender?.agentConnectionId);
      if (existing) return existing;
      return service.addParticipant(conversationId, {
        type: 'agent',
        agentConnectionId: input.sender.agentConnectionId,
        displayName: displayNameFor(input.sender.agentConnectionId),
      });
    }

    const human = people.find((p) => p.type === 'human');
    if (human) return human;
    return service.addParticipant(conversationId, {
      type: 'human',
      displayName: input.humanDisplayName ?? 'Owner',
    });
  }

  return service;
}

export type { RoutingBlockReason, RoutingDecision };
export { planRouting, deriveChainState };
