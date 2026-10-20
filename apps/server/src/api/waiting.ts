import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from './helpers.js';

const waitingQuerySchema = z.object({ workspaceId: z.string() });

/** What kind of thing is waiting on the owner. */
export type WaitingKind = 'approval' | 'task';

/** Why the item is on the list. */
export type WaitingReason = 'pending' | 'review' | 'blocked';

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
}

/**
 * What is waiting on the owner.
 *
 * The list is assembled on the server so the browser asks for one thing
 * instead of three and joins the answers itself. A pending approval is an
 * agent stopped mid-turn; a task in review is waiting for an acceptance
 * decision; a blocked task is waiting for the owner to unblock it.
 *
 * The order is the order of urgency: an agent that cannot continue comes
 * first, then the work waiting for an acceptance decision, then the work
 * that is stuck.
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
  }));

  // One thing is one entry. A pending approval that belongs to a task is
  // that task waiting on the owner, so the task must not appear a second
  // time beside it — the owner would see the same thing twice and could not
  // tell which one to act on.
  const coveredByAnApproval = new Set(
    pending.map((approval) => approval.taskId).filter((id): id is string => id !== null),
  );

  const tasks: WaitingItem[] = app.services.factory.listTasks(workspaceId).flatMap((task) => {
    if (coveredByAnApproval.has(task.id)) return [];
    if (task.status !== 'review' && task.status !== 'blocked') return [];
    const reason: WaitingReason = task.status;
    return [
      {
        id: `task:${task.id}`,
        kind: 'task' as const,
        title: task.title,
        detail:
          reason === 'review'
            ? 'An agent reported this as done. It is not accepted until you say so.'
            : 'This task is blocked and cannot move until you unblock it.',
        reason,
        workspaceId: task.workspaceId,
        conversationId: null,
        taskId: task.id,
        agentConnectionId: task.assigneeId ?? null,
      },
    ];
  });

  const review = tasks.filter((task) => task.reason === 'review');
  const blocked = tasks.filter((task) => task.reason === 'blocked');

  return [...approvals, ...review, ...blocked];
}
