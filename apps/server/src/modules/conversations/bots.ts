import { and, desc, eq } from 'drizzle-orm';
import type {
  Bot,
  BotRole,
  BotScope,
  DelegatedTask,
  DelegatedTaskStatus,
  McpToolName,
  Message,
  Participant,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { bots, delegatedTasks, executions, messages, participants } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { Author } from '../../lib/author.js';
import type { Queue } from '../../queue/client.js';
import type { AuditService } from '../audit/service.js';
import type { EventsService } from '../events/service.js';
import type { ConversationsService } from './service.js';
import { planAndDispatch } from './dispatch.js';
import { MAX_DELEGATION_DEPTH } from './routing.js';

/**
 * The bot seam.
 *
 * A coordinator is an external agent using an authorised product tool. This
 * service is what that tool reaches: it records the intent, creates the
 * delegated work and its tracked task, and enqueues the child turn. It never
 * decides what the worker should do and it never writes a worker's answer —
 * the worker runs the turn and comes back with the result.
 *
 * The service is a seam over the conversations, the queue and the factory
 * ledger. It adds no module of its own.
 */

/**
 * The ledger the delegated work is tracked as.
 *
 * The shape is written out rather than imported, because the conversations
 * module does not reach into the work domain: the ledger is the work domain's
 * table, and the crossing the capability API makes is the sanctioned one.
 */
export interface DelegatedTaskLedger {
  createTask(input: {
    workspaceId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    author: Author;
  }): { id: string; workspaceId: string; title: string };
  updateTask(id: string, patch: { status?: string }): { id: string; status: string };
  getTask(id: string): { id: string; workspaceId: string };
}

/** What a bot may do inside its room. */
export type DispatchScopeDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * May this bot hand work to this agent?
 *
 * The scope is an allowlist, and it is checked before anything is created: a
 * bot that may not delegate, or that was not given this agent, hands work to
 * nobody. The refusal says which of the two it was, so a caller can tell a
 * missing grant from a missing agent.
 */
export function dispatchScopeDecision(
  bot: Bot,
  targetAgentConnectionId: string,
): DispatchScopeDecision {
  if (!bot.scope.mayDispatch) {
    return {
      allowed: false,
      reason: `${bot.displayName} may not delegate. The scope of a bot decides whether it can.`,
    };
  }
  if (!bot.scope.dispatchableAgentConnectionIds.includes(targetAgentConnectionId)) {
    return {
      allowed: false,
      reason:
        `${bot.displayName} may only hand work to the agents it was given, ` +
        `and this agent is not one of them.`,
    };
  }
  return { allowed: true };
}

/**
 * The authority the delegated work would carry that the coordinator does not
 * have.
 *
 * A delegation may narrow authority and never widen it. The worker runs the
 * delegated turn on its own connection, so the worker would bring its own
 * tools with it: handing work to a more capable agent would let a
 * coordinator reach further than the owner granted it.
 */
export function authorityExcess(
  coordinatorGrants: McpToolName[],
  targetGrants: McpToolName[],
): McpToolName[] {
  const held = new Set(coordinatorGrants);
  return targetGrants.filter((grant) => !held.has(grant));
}

/** The outcome a delegated turn ended with. */
export type DelegationOutcome = 'succeeded' | 'failed' | 'cancelled' | 'lost';

/**
 * The status a delegation moves to when its turn ends.
 *
 * A settled delegation is settled: `lost` is not `failed`, and none of them
 * is ever re-run. The rule is a pure function so the state machine can be
 * checked without a database.
 */
export function nextDelegatedStatus(
  current: DelegatedTaskStatus,
  outcome: DelegationOutcome,
): DelegatedTaskStatus {
  switch (current) {
    case 'queued':
    case 'running':
    case 'stopping':
      break;
    default:
      // Already settled. A settled delegation stays settled.
      return current;
  }

  switch (outcome) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'lost':
      return 'lost';
  }
}

/**
 * The status the factory task of a delegation moves to.
 *
 * An agent reporting completion is not acceptance, so the work goes to
 * `review` and never to `done`. An outcome nobody can confirm is `unknown`,
 * which is the state the owner closes.
 */
export function taskStatusForDelegation(
  outcome: DelegationOutcome,
): 'review' | 'blocked' | 'cancelled' | 'unknown' {
  switch (outcome) {
    case 'succeeded':
      return 'review';
    case 'failed':
      return 'blocked';
    case 'cancelled':
      return 'cancelled';
    case 'lost':
      return 'unknown';
  }
}

/** The bots of a conversation. */
export interface BotsService {
  /** Register a bot in a room, or change the one already there. */
  register(input: {
    conversationId: string;
    agentConnectionId: string;
    role: BotRole;
    displayName?: string;
    scope?: Partial<BotScope>;
  }): Bot;
  /** The team of a room. */
  list(conversationId: string): Bot[];
  /** One bot of a room. */
  find(conversationId: string, agentConnectionId: string): Bot | undefined;
  /** The delegated work of a room, newest first. */
  listDelegations(conversationId: string): DelegatedTask[];
  /** One delegated task. */
  getDelegation(id: string): DelegatedTask;
  /** The delegated task a child turn belongs to. */
  findDelegationByChildTurn(childTurnId: string): DelegatedTask | undefined;
  /**
   * The delegation tree of a turn: the work it handed over, and the work that
   * handed over to it.
   */
  delegationTree(turnId: string): { parent?: DelegatedTask; children: DelegatedTask[] };
  /** Hand a piece of work to another agent. */
  dispatch(input: {
    coordinatorAgentConnectionId: string;
    conversationId: string;
    agentConnectionId: string;
    instruction: string;
    title?: string;
    taskId?: string;
  }): { delegatedTask: DelegatedTask; taskId?: string; childTurnId?: string };
  /**
   * Record how the delegated work ended and deliver it to the room that
   * asked for it.
   */
  completeDelegation(input: {
    childTurnId: string;
    outcome: DelegationOutcome;
    result: string;
    outputRef?: string;
  }): DelegatedTask | undefined;
  /**
   * Record that the parent turn read the result and ended completed.
   *
   * Delivery is not consumption: a result that was delivered but not consumed
   * is still waiting, and the next continuation is reminded of it again.
   */
  consumeDelivery(deliveryMessageId: string): DelegatedTask[];
}

export interface BotsServiceOptions {
  db: Database;
  events: EventsService;
  queue: Queue;
  audit: AuditService;
  /** The factory ledger the delegated work is tracked as. */
  factory: DelegatedTaskLedger;
  /** The rooms the team works in. */
  conversations: Pick<ConversationsService, 'create' | 'get'>;
  /** The effective MCP tool grants of a connection. */
  agentToolGrants: (agentConnectionId: string) => McpToolName[];
  /** The connection itself, for its workspace and its state. */
  agentConnection: (
    agentConnectionId: string,
  ) => { id: string; workspaceId: string; enabled: boolean } | undefined;
  /** The display name of a connection. */
  agentDisplayName: (agentConnectionId: string) => string;
}

export function createBotsService(options: BotsServiceOptions): BotsService {
  const { db, events, queue, audit, factory, conversations } = options;

  const toBot = (row: typeof bots.$inferSelect): Bot => ({
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    agentConnectionId: row.agentConnectionId,
    role: row.role,
    displayName: row.displayName,
    scope: {
      mayDispatch: row.mayDispatch,
      dispatchableAgentConnectionIds: row.dispatchableAgentConnectionIds,
    },
    createdAt: row.createdAt,
  });

  const toDelegatedTask = (row: typeof delegatedTasks.$inferSelect): DelegatedTask => ({
    id: row.id,
    parentTurnId: row.parentTurnId,
    agentConnectionId: row.agentConnectionId,
    status: row.status,
    outputRef: row.outputRef ?? undefined,
    deliveredAt: row.deliveredAt ?? undefined,
    consumedAt: row.consumedAt ?? undefined,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    childConversationId: row.childConversationId,
    childTurnId: row.childTurnId ?? undefined,
    parentAgentConnectionId: row.parentAgentConnectionId,
    role: row.role,
    taskId: row.taskId ?? undefined,
    instruction: row.instruction,
    result: row.result ?? undefined,
    deliveryMessageId: row.deliveryMessageId ?? undefined,
    depth: row.depth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const findBotRow = (conversationId: string, agentConnectionId: string) =>
    db
      .select()
      .from(bots)
      .where(
        and(eq(bots.conversationId, conversationId), eq(bots.agentConnectionId, agentConnectionId)),
      )
      .get();

  const roomParticipants = (conversationId: string): Participant[] =>
    db
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

  /**
   * The depth of the room's own chain.
   *
   * A delegated turn is one step deeper than the turn that delegated it, so
   * the depth is read from the messages the room already holds.
   */
  const roomDepth = (conversationId: string): number =>
    db
      .select({ origin: messages.origin })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .all()
      .reduce((deepest, row) => Math.max(deepest, row.origin?.depth ?? 0), 0);

  /**
   * The turn the delegation comes from.
   *
   * The coordinator's own turn in this room: the one that is running, or the
   * one that is queued, or the last one it took. A delegation without a turn
   * behind it has no parent to hang from, so it is refused rather than
   * recorded against nothing.
   */
  const resolveParentTurn = (
    conversationId: string,
    agentConnectionId: string,
  ): string | undefined => {
    const rows = db
      .select()
      .from(executions)
      .where(
        and(
          eq(executions.conversationId, conversationId),
          eq(executions.agentConnectionId, agentConnectionId),
        ),
      )
      .orderBy(desc(executions.createdAt))
      .all();

    const running = rows.find((row) => row.status === 'running');
    if (running) return running.id;
    const queued = rows.find((row) => row.status === 'queued');
    if (queued) return queued.id;
    return rows[0]?.id;
  };

  const service: BotsService = {
    register(input) {
      const conversation = conversations.get(input.conversationId);
      const connection = options.agentConnection(input.agentConnectionId);
      if (!connection) throw errors.notFound('Agent connection');
      if (connection.workspaceId !== conversation.workspaceId) {
        throw errors.forbidden('That agent connection is not in this conversation’s workspace.');
      }

      const displayName =
        input.displayName?.trim() ||
        options.agentDisplayName(input.agentConnectionId) ||
        input.agentConnectionId;

      const existing = findBotRow(input.conversationId, input.agentConnectionId);
      const scope: BotScope = {
        mayDispatch: input.scope?.mayDispatch ?? existing?.mayDispatch ?? false,
        dispatchableAgentConnectionIds:
          input.scope?.dispatchableAgentConnectionIds ??
          existing?.dispatchableAgentConnectionIds ??
          [],
      };
      const now = new Date().toISOString();

      if (existing) {
        db.update(bots)
          .set({
            role: input.role,
            displayName,
            mayDispatch: scope.mayDispatch,
            dispatchableAgentConnectionIds: scope.dispatchableAgentConnectionIds,
          })
          .where(eq(bots.id, existing.id))
          .run();
        return toBot(db.select().from(bots).where(eq(bots.id, existing.id)).get()!);
      }

      const id = newId('bot');
      db.insert(bots)
        .values({
          id,
          workspaceId: conversation.workspaceId,
          conversationId: conversation.id,
          agentConnectionId: input.agentConnectionId,
          role: input.role,
          displayName,
          mayDispatch: scope.mayDispatch,
          dispatchableAgentConnectionIds: scope.dispatchableAgentConnectionIds,
          createdAt: now,
        })
        .run();
      return toBot(db.select().from(bots).where(eq(bots.id, id)).get()!);
    },

    list(conversationId) {
      return db
        .select()
        .from(bots)
        .where(eq(bots.conversationId, conversationId))
        .orderBy(bots.createdAt)
        .all()
        .map(toBot);
    },

    find(conversationId, agentConnectionId) {
      const row = findBotRow(conversationId, agentConnectionId);
      return row ? toBot(row) : undefined;
    },

    listDelegations(conversationId) {
      return db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.conversationId, conversationId))
        .orderBy(desc(delegatedTasks.createdAt))
        .all()
        .map(toDelegatedTask);
    },

    getDelegation(id) {
      const row = db.select().from(delegatedTasks).where(eq(delegatedTasks.id, id)).get();
      if (!row) throw errors.notFound('Delegated task');
      return toDelegatedTask(row);
    },

    findDelegationByChildTurn(childTurnId) {
      const row = db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.childTurnId, childTurnId))
        .get();
      return row ? toDelegatedTask(row) : undefined;
    },

    delegationTree(turnId) {
      const parentRow = db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.childTurnId, turnId))
        .get();
      const children = db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.parentTurnId, turnId))
        .orderBy(delegatedTasks.createdAt)
        .all()
        .map(toDelegatedTask);

      return {
        ...(parentRow ? { parent: toDelegatedTask(parentRow) } : {}),
        children,
      };
    },

    dispatch(input) {
      const conversation = conversations.get(input.conversationId);

      // The caller must be a bot of this room. A bot that was never
      // registered has no scope, so it hands work to nobody.
      const coordinatorRow = findBotRow(conversation.id, input.coordinatorAgentConnectionId);
      if (!coordinatorRow) {
        throw errors.forbidden(
          'Only a bot registered in this room may delegate. This agent is not one of them.',
        );
      }
      const coordinator = toBot(coordinatorRow);

      // The target must be a bot of this room as well.
      const targetRow = findBotRow(conversation.id, input.agentConnectionId);
      if (!targetRow) {
        throw errors.forbidden(
          'That agent is not in this room’s team. Register it before handing work to it.',
        );
      }
      const target = toBot(targetRow);

      const scope = dispatchScopeDecision(coordinator, input.agentConnectionId);
      if (!scope.allowed) throw errors.forbidden(scope.reason);

      if (target.role === 'coordinator') {
        throw errors.forbidden('A coordinator does not take delegated work.');
      }

      const connection = options.agentConnection(input.agentConnectionId);
      if (!connection) throw errors.notFound('Agent connection');
      if (!connection.enabled) {
        throw errors.forbidden('That agent connection is disabled.');
      }
      if (connection.workspaceId !== conversation.workspaceId) {
        throw errors.forbidden('That agent connection is not in this conversation’s workspace.');
      }

      // Authority may narrow, never widen.
      const excess = authorityExcess(
        options.agentToolGrants(input.coordinatorAgentConnectionId),
        options.agentToolGrants(input.agentConnectionId),
      );
      if (excess.length > 0) {
        throw errors.forbidden(
          'The delegated work would carry authority the coordinator does not have: ' +
            `${excess.join(', ')}.`,
        );
      }

      const depth = roomDepth(conversation.id) + 1;
      if (depth >= MAX_DELEGATION_DEPTH) {
        throw errors.conflict(
          `The delegation depth limit of ${MAX_DELEGATION_DEPTH} was reached in this room.`,
        );
      }

      const parentTurnId = resolveParentTurn(conversation.id, input.coordinatorAgentConnectionId);
      if (!parentTurnId) {
        throw errors.conflict(
          'The coordinator has no turn in this room to delegate from. Let it answer once first.',
        );
      }

      const title = input.title?.trim() || firstLine(input.instruction);
      const now = new Date().toISOString();

      // The work is tracked in the factory ledger, so the owner can see what
      // was asked for and what came back in one place.
      let taskId = input.taskId;
      if (taskId) {
        const task = factory.getTask(taskId);
        if (task.workspaceId !== conversation.workspaceId) {
          throw errors.forbidden('That task is not in this conversation’s workspace.');
        }
      } else {
        const task = factory.createTask({
          workspaceId: conversation.workspaceId,
          title,
          description: input.instruction,
          assigneeId: input.agentConnectionId,
          author: { kind: 'agent', agentConnectionId: input.coordinatorAgentConnectionId },
        });
        taskId = task.id;
      }
      const tracked = factory.updateTask(taskId, { status: 'active' });

      // The delegated work runs in its own room. The worker's own context
      // stays there; only the handoff crosses back.
      const child = conversations.create({
        workspaceId: conversation.workspaceId,
        title: `Delegated: ${title}`,
        routingMode: 'mentions',
        participantAgentConnectionIds: [
          input.coordinatorAgentConnectionId,
          input.agentConnectionId,
        ],
      });

      const childPeople = roomParticipants(child.id);
      const coordinatorParticipant = childPeople.find(
        (person) => person.agentConnectionId === input.coordinatorAgentConnectionId,
      );
      const workerParticipant = childPeople.find(
        (person) => person.agentConnectionId === input.agentConnectionId,
      );
      if (!coordinatorParticipant || !workerParticipant) {
        throw errors.conflict('The delegated room could not be set up.');
      }

      const id = newId('dlg');
      const correlationId = id;
      const messageId = newId('msg');
      const messageOrigin = {
        kind: 'agent' as const,
        actorId: coordinatorParticipant.id,
        agentConnectionId: input.coordinatorAgentConnectionId,
        depth: depth - 1,
      };

      db.insert(messages)
        .values({
          id: messageId,
          conversationId: child.id,
          senderId: coordinatorParticipant.id,
          targetParticipantIds: [workerParticipant.id],
          replyToId: null,
          kind: 'text',
          content: [{ type: 'text', text: input.instruction }],
          status: 'complete',
          correlationId,
          origin: messageOrigin,
          executionId: null,
          createdAt: now,
        })
        .run();

      events.publish(
        {
          type: 'message.created',
          message: {
            id: messageId,
            conversationId: child.id,
            senderId: coordinatorParticipant.id,
            targetParticipantIds: [workerParticipant.id],
            replyToId: undefined,
            kind: 'text',
            content: [{ type: 'text', text: input.instruction }],
            status: 'complete',
            correlationId,
            origin: messageOrigin,
            executionId: undefined,
            createdAt: now,
          },
        },
        { workspaceId: conversation.workspaceId, conversationId: child.id },
      );

      // The existing execution path: the child turn is queued exactly like any
      // other turn, and the worker runs it.
      const dispatched = planAndDispatch({
        db,
        events,
        queue,
        audit,
        conversationId: child.id,
        message: {
          id: messageId,
          conversationId: child.id,
          senderId: coordinatorParticipant.id,
          targetParticipantIds: [workerParticipant.id],
          replyToId: undefined,
          kind: 'text',
          content: [{ type: 'text', text: input.instruction }],
          status: 'complete',
          correlationId,
          origin: messageOrigin,
          executionId: undefined,
          createdAt: now,
        },
        participants: childPeople,
        correlationId,
        depth: depth - 1,
        explicitTargets: [input.agentConnectionId],
      });

      const childTurnId = dispatched.dispatches[0]?.executionId;
      if (!childTurnId) {
        // Nothing was queued: the worker could not be reached. The task is
        // not left running, and the delegation is recorded as lost rather
        // than as work that quietly never happened.
        factory.updateTask(tracked.id, { status: 'unknown' });
        throw errors.conflict(
          'The delegated work could not be queued: ' +
            (dispatched.routing.reason || 'the worker was not reachable.'),
        );
      }

      db.insert(delegatedTasks)
        .values({
          id,
          workspaceId: conversation.workspaceId,
          conversationId: conversation.id,
          childConversationId: child.id,
          parentTurnId,
          childTurnId,
          parentAgentConnectionId: input.coordinatorAgentConnectionId,
          agentConnectionId: input.agentConnectionId,
          role: target.role,
          status: 'queued',
          taskId: tracked.id,
          instruction: input.instruction,
          result: null,
          outputRef: null,
          deliveryMessageId: null,
          deliveredAt: null,
          consumedAt: null,
          depth,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const delegatedTask = service.getDelegation(id);
      events.publish(
        { type: 'delegation.started', delegatedTask },
        { workspaceId: conversation.workspaceId, conversationId: conversation.id },
      );

      audit.record({
        workspaceId: conversation.workspaceId,
        actorType: 'agent',
        actorId: input.coordinatorAgentConnectionId,
        action: 'delegation.started',
        targetType: 'delegated_task',
        targetId: id,
        result: 'success',
        metadata: {
          conversationId: conversation.id,
          childConversationId: child.id,
          childTurnId,
          agentConnectionId: input.agentConnectionId,
          taskId: tracked.id,
          depth,
        },
      });

      return { delegatedTask, taskId: tracked.id, childTurnId };
    },

    completeDelegation(input) {
      const row = db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.childTurnId, input.childTurnId))
        .get();
      if (!row) return undefined;

      const delegation = toDelegatedTask(row);
      const status = nextDelegatedStatus(delegation.status, input.outcome);
      const now = new Date().toISOString();

      // The result is delivered into the room that asked for it, attributed
      // to the worker, and addressed to the coordinator alone.
      const parent = conversations.get(delegation.conversationId);
      const parentPeople = roomParticipants(parent.id);
      const coordinatorParticipant = parentPeople.find(
        (person) => person.agentConnectionId === delegation.parentAgentConnectionId,
      );
      const workerParticipant = parentPeople.find(
        (person) => person.agentConnectionId === delegation.agentConnectionId,
      );

      let deliveryMessageId: string | undefined;
      if (coordinatorParticipant) {
        const senderId = workerParticipant?.id ?? delegation.agentConnectionId;
        deliveryMessageId = newId('msg');
        const origin = {
          kind: 'agent' as const,
          actorId: senderId,
          agentConnectionId: delegation.agentConnectionId,
          depth: delegation.depth,
        };
        const content = [{ type: 'text' as const, text: input.result }];

        db.insert(messages)
          .values({
            id: deliveryMessageId,
            conversationId: parent.id,
            senderId,
            targetParticipantIds: [coordinatorParticipant.id],
            replyToId: null,
            kind: 'text',
            content,
            status: 'complete',
            correlationId: delegation.id,
            origin,
            executionId: null,
            createdAt: now,
          })
          .run();

        const message: Message = {
          id: deliveryMessageId,
          conversationId: parent.id,
          senderId,
          targetParticipantIds: [coordinatorParticipant.id],
          replyToId: undefined,
          kind: 'text',
          content,
          status: 'complete',
          correlationId: delegation.id,
          origin,
          executionId: undefined,
          createdAt: now,
        };
        events.publish(
          { type: 'message.created', message },
          { workspaceId: parent.workspaceId, conversationId: parent.id },
        );

        // The delivery wakes the coordinator that asked, through the routing
        // safeguards, and it does not wake the room.
        planAndDispatch({
          db,
          events,
          queue,
          audit,
          conversationId: parent.id,
          message,
          participants: parentPeople,
          correlationId: delegation.id,
          depth: delegation.depth,
          explicitTargets: [delegation.parentAgentConnectionId],
          delegation: { id: delegation.id },
        });
      }

      db.update(delegatedTasks)
        .set({
          status,
          result: input.result,
          outputRef: input.outputRef ?? null,
          deliveryMessageId: deliveryMessageId ?? null,
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(delegatedTasks.id, delegation.id))
        .run();

      if (delegation.taskId) {
        factory.updateTask(delegation.taskId, {
          status: taskStatusForDelegation(input.outcome),
        });
      }

      const updated = service.getDelegation(delegation.id);
      events.publish(
        { type: 'delegation.delivered', delegatedTask: updated },
        { workspaceId: parent.workspaceId, conversationId: parent.id },
      );
      audit.record({
        workspaceId: parent.workspaceId,
        actorType: 'agent',
        actorId: delegation.agentConnectionId,
        action: 'delegation.delivered',
        targetType: 'delegated_task',
        targetId: delegation.id,
        result: input.outcome === 'succeeded' ? 'success' : 'failure',
        metadata: {
          conversationId: parent.id,
          childTurnId: input.childTurnId,
          deliveryMessageId: deliveryMessageId ?? null,
          outcome: input.outcome,
        },
      });

      return updated;
    },

    consumeDelivery(deliveryMessageId) {
      const rows = db
        .select()
        .from(delegatedTasks)
        .where(eq(delegatedTasks.deliveryMessageId, deliveryMessageId))
        .all();
      if (rows.length === 0) return [];

      const now = new Date().toISOString();
      const consumed: DelegatedTask[] = [];

      for (const row of rows) {
        // Delivery is not consumption. A result that was delivered but never
        // read stays unconsumed, and the next continuation is reminded of it.
        if (row.consumedAt) continue;

        db.update(delegatedTasks)
          .set({ consumedAt: now, updatedAt: now })
          .where(eq(delegatedTasks.id, row.id))
          .run();

        const updated = service.getDelegation(row.id);
        consumed.push(updated);
        events.publish(
          { type: 'delegation.consumed', delegatedTask: updated },
          { workspaceId: updated.workspaceId, conversationId: updated.conversationId },
        );
      }

      return consumed;
    },
  };

  return service;
}

/** The first line of an instruction, for the title of a task. */
function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 0 ? line.slice(0, 300) : 'Delegated work';
}
