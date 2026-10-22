import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from './helpers.js';

const waitingQuerySchema = z.object({ workspaceId: z.string() });

/** What kind of thing is waiting on the owner. */
export type WaitingKind = 'approval' | 'task' | 'turn' | 'capability';

/**
 * Why the item is on the list.
 *
 * `unknown` is its own reason: the work started and the outcome could not be
 * confirmed. It is not a failure to fix and not a decision to make — it is
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
   * `null` on every other kind: a capability is the only thing on this list
   * that is named by a tool.
   */
  toolName: string | null;
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
 */
export function registerWaitingRoutes(app: FastifyInstance): void {
  app.get('/api/waiting', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(waitingQuerySchema, request.query);
    return { items: listWaiting(app, workspaceId) };
  });
}

function listWaiting(app: FastifyInstance, workspaceId: string): WaitingItem[] {
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

  return [...approvals, ...capabilities, ...unknown, ...turns, ...review, ...blocked];
}
