import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import type { WaitingItem, WaitingReason } from '@personal-os/contracts';
import { parseQuery, requireAuth } from './helpers.js';

/**
 * The waiting shape is the contracts package's declaration.
 *
 * The list crosses the server-to-client boundary, so the shape is published
 * once, in `@personal-os/contracts`, and the server builds its rows against
 * that declaration rather than against a copy of it. The module publishes the
 * declaration back out so the server's own importers keep one name for it.
 */
export type { WaitingItem, WaitingKind, WaitingReason } from '@personal-os/contracts';

const waitingQuerySchema = z.object({
  workspaceId: z.string(),
  /**
   * The conversation to ask about.
   *
   * A conversation can be asked what is waiting on the owner for it, so the
   * owner can answer where the request was made instead of leaving the room
   * to look for it. When it is given, the list holds only what belongs to that
   * conversation: its approvals, its turns, and the capabilities of the agents
   * taking part in it.
   */
  conversationId: z.string().optional(),
});

export function registerWaitingRoutes(app: FastifyInstance): void {
  app.get('/api/waiting', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, conversationId } = parseQuery(waitingQuerySchema, request.query);
    return { items: listWaiting(app, workspaceId, conversationId) };
  });
}

/**
 * What is waiting on the owner.
 *
 * The list is assembled on the server so the browser asks for one thing
 * instead of three and joins the answers itself. A pending approval is an
 * agent stopped mid-turn; a capability an agent was refused is an agent that
 * cannot call the tool it needs; a task in review is waiting for an
 * acceptance decision; a blocked task is waiting for the owner to unblock it;
 * a task whose outcome is unknown is waiting for the owner to check it; and a
 * turn whose outcome is unknown is waiting for the owner to check that too.
 *
 * The order is the order of urgency: an agent that cannot continue comes
 * first, then the work whose outcome could not be confirmed, then the work
 * waiting for an acceptance decision, then the work that is stuck. That order
 * is over the reasons, not the kinds: a turn and a task whose outcome could
 * not be confirmed are both something to check, so they are in the same band.
 *
 * It is exported because another surface — the Map's counters — counts the
 * same list rather than counting its own way. Two numbers that say the same
 * thing must not be able to disagree.
 */
export function listWaiting(
  app: FastifyInstance,
  workspaceId: string,
  conversationId?: string,
): WaitingItem[] {
  const pending = app.services.approvals.list(workspaceId, 'pending');

  const approvals: WaitingItem[] = pending.map((approval) => ({
    id: `approval:${approval.id}`,
    kind: 'approval',
    title: approval.summary,
    detail: 'An agent is stopped and waiting for your decision.',
    reason: 'pending',
    workspaceId: approval.workspaceId,
    conversationId: approval.conversationId,
    taskId: approval.taskId,
    agentConnectionId: approval.agentConnectionId,
    toolName: null,
  }));

  // One thing is one entry. A pending approval that belongs to a task is
  // that task waiting on the owner, so the task must not appear a second
  // time beside it — the owner would see the same thing twice and could not
  // tell which one to act on.
  const coveredByAnApproval = new Set(
    pending.map((approval) => approval.taskId).filter((id): id is string => id !== null),
  );

  // The same rule for a turn. An approval is a turn stopped on a decision, so
  // a turn that has one pending is that approval waiting on the owner, and it
  // must not appear beside it.
  const turnsCoveredByAnApproval = new Set(
    pending.map((approval) => approval.executionId).filter((id): id is string => id !== null),
  );

  const tasks: WaitingItem[] = app.services.factory.listTasks(workspaceId).flatMap((task) => {
    if (coveredByAnApproval.has(task.id)) return [];
    if (task.status !== 'review' && task.status !== 'blocked' && task.status !== 'unknown')
      return [];
    const reason: WaitingReason = task.status;
    return [
      {
        id: `task:${task.id}`,
        kind: 'task' as const,
        title: task.title,
        detail:
          reason === 'review'
            ? 'An agent reported this as done. It is not accepted until you say so.'
            : reason === 'blocked'
              ? 'This task is blocked and cannot move until you unblock it.'
              : 'This task started and we cannot confirm how it ended. Check whether it ran before you try it again.',
        reason,
        workspaceId: task.workspaceId,
        conversationId: null,
        taskId: task.id,
        agentConnectionId: task.assigneeId ?? null,
        toolName: null,
      },
    ];
  });

  // A turn whose outcome could not be confirmed is something to check, in
  // the same band as an unknown task. It is not blocked and it is not a
  // failure that may simply be repeated: the work started, and we cannot
  // confirm how it ended.
  const turns: WaitingItem[] = app.services.conversations
    .listUnknownTurns(workspaceId)
    .flatMap((turn) => {
      if (turnsCoveredByAnApproval.has(turn.executionId)) return [];
      return [
        {
          id: `turn:${turn.executionId}`,
          kind: 'turn' as const,
          title: turn.conversationTitle,
          detail:
            'This turn started and we cannot confirm how it ended. Check whether it ran before you ask the agent again.',
          reason: 'unknown',
          workspaceId,
          conversationId: turn.conversationId,
          taskId: null,
          agentConnectionId: turn.agentConnectionId,
          toolName: null,
        },
      ];
    });

  // A capability an agent was refused is waiting on the owner too. The agent
  // cannot act at all until the owner widens its grant, so the row sits in
  // the first band with the approvals: it is the same thing, an agent that
  // cannot go on.
  //
  // One row per agent and capability. A refusal that repeats is the same
  // thing waiting, so the list does not fill up with the noise of an agent
  // trying again.
  const capabilities: WaitingItem[] = app.services.agents
    .blockedCapabilities(workspaceId)
    .map((capability) => ({
      id: `capability:${capability.id}`,
      kind: 'capability' as const,
      title: `The agent needs the "${capability.toolName}" tool`,
      detail:
        'This agent called a tool it was not granted and cannot go on until you widen its grant.',
      reason: 'pending' as const,
      workspaceId: capability.workspaceId,
      conversationId: null,
      taskId: null,
      agentConnectionId: capability.agentConnectionId,
      toolName: capability.toolName,
    }));

  const unknown = tasks.filter((task) => task.reason === 'unknown');
  const review = tasks.filter((task) => task.reason === 'review');
  const blocked = tasks.filter((task) => task.reason === 'blocked');

  const all = [...approvals, ...capabilities, ...unknown, ...turns, ...review, ...blocked];

  if (!conversationId) return all;
  return forConversation(app, all, conversationId);
}

/**
 * The part of the list that belongs to one conversation.
 *
 * A conversation is asked what is waiting on the owner for it, so the owner can
 * answer where the request was made. Three kinds of thing qualify: a request
 * the agents in this conversation made, a turn in it whose outcome could not
 * be confirmed, and a capability one of its agents was refused.
 *
 * **A task does not qualify.** A task is decided on the factory board, where
 * the work is, and it belongs to no conversation in the first place.
 *
 * A capability has no conversation of its own — it belongs to an agent — so it
 * is matched by the agent's part in this conversation. An agent in the room
 * that cannot call the tool it needs is stuck for that room, whether or not
 * the refusal was recorded against a conversation.
 */
function forConversation(
  app: FastifyInstance,
  items: WaitingItem[],
  conversationId: string,
): WaitingItem[] {
  const participants = participantIds(app, conversationId);
  return items.filter((item) => {
    if (item.conversationId === conversationId) return true;
    if (item.kind === 'capability' && item.agentConnectionId) {
      return participants.has(item.agentConnectionId);
    }
    return false;
  });
}

/**
 * The agents taking part in a conversation.
 *
 * A conversation that cannot be read has no participants, and therefore
 * nothing waiting for the owner in it. That is the honest answer for a room
 * that is gone: the items it was waiting on are waiting on the owner
 * somewhere else, and the list they would appear in still holds them.
 */
function participantIds(app: FastifyInstance, conversationId: string): Set<string> {
  try {
    const conversation = app.services.conversations.get(conversationId);
    return new Set(
      conversation.participants
        .map((participant) => participant.agentConnectionId)
        .filter((id): id is string => typeof id === 'string'),
    );
  } catch {
    return new Set();
  }
}
