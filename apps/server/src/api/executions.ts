import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChatActivityReadModel, RunControl, StopTurnResult } from '@personal-os/contracts';
import { audit, notFound, parseBody, requireAuth } from './helpers.js';
import * as activity from '../modules/executions/activity.js';

const resolveSchema = z.object({
  /** The owner's own conclusion: it did run, or it did not. */
  outcome: z.enum(['completed', 'failed']),
  /** The owner's own words, when they have any. */
  note: z.string().max(2_000).optional(),
});

/**
 * Executions: the turn, what it did, and the stop request the owner may make.
 *
 * A turn whose outcome could not be confirmed is a question for the owner and
 * only for the owner: the worker stopped and could not say how the turn ended.
 */
export function registerExecutionRoutes(app: FastifyInstance): void {
  app.post('/api/executions/:id/resolve', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(resolveSchema, request.body);

    const resolution = app.services.executions.resolve({
      executionId: id,
      outcome: body.outcome,
      note: body.note,
    });

    // Leaving the unknown state is the owner's answer to the question the
    // worker could not answer, so it is written to the audit trail, beside
    // the task path's own answer. The entry names the owner, because it is
    // the owner's answer and nobody else's.
    audit(
      request,
      'execution.outcome.resolved',
      { type: 'execution', id, workspaceId: resolution.workspaceId },
      { from: 'unknown', to: body.outcome, ...(body.note?.trim() ? { note: body.note } : {}) },
    );

    // The sentence comes back with the answer, so the panel can say what the
    // decision did instead of leaving the owner to infer it.
    return {
      execution: resolution.execution,
      outcome: resolution.outcome,
      detail: resolution.detail,
    };
  });

  /**
   * Whether the owner has already asked this turn to stop.
   *
   * The request is in the audit trail, so it survives a reload: a panel that
   * forgot the request would offer the stop button again and say nothing about
   * the one already made.
   */
  function stopWasRequested(workspaceId: string | null, executionId: string): boolean {
    if (!workspaceId) return false;
    return app.services.audit
      .list(workspaceId, 200)
      .some(
        (entry) => entry.action === 'execution.stop.requested' && entry.targetId === executionId,
      );
  }

  /**
   * The turn, with the activity behind it.
   *
   * The trace the panel draws is derived from the event log, so it is still
   * there when the owner comes back to the room. The route is the one the
   * contract publishes: the turn's status, its capability view, its
   * delegation tree and its committed revision, with the activity the turn
   * produced beside them.
   */
  app.get('/api/executions/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const db = app.services.runtime.db;

    const turn = activity.readTurnRow(db, id);
    if (!turn) notFound('Execution');

    const activities = activity
      .deriveActivities(activity.readTurnEvents(db, id))
      .map((entry) => ({ ...entry, conversationId: turn.conversationId }));

    const run = activity.runControlFor({
      status: activity.turnStatusOf(turn.status),
      stopRequested: stopWasRequested(turn.workspaceId, id),
      // A turn recorded before the capability view existed has none, and a
      // turn without a view is a turn that cannot be steered: absent means
      // absent.
      canSteer: false,
    });

    const readModel: ChatActivityReadModel = {
      turn: {
        id: turn.id,
        conversationId: turn.conversationId,
        agentConnectionId: turn.agentConnectionId,
        status: activity.turnStatusOf(turn.status),
        error: turn.error,
        spendUnits: turn.spendUnits,
        startedAt: turn.startedAt,
        finishedAt: turn.finishedAt,
        // The capability view and the delegation tree are reported as absent
        // rather than as empty. An empty view would say the agent had no
        // tools, which is a different claim.
        capabilityView: null,
        delegatedTasks: null,
        committedRevision: null,
      },
      activities,
      run,
    };

    return readModel;
  });

  /**
   * Ask a turn to stop.
   *
   * A turn that had not started is cancelled, and the answer says so. A turn
   * that is already running can only be asked: the worker holds the live
   * session, and the API server never runs an agent, so there is no channel
   * from here to a running turn. The answer never presents the request as a
   * cancellation.
   */
  app.post('/api/executions/:id/stop', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const stopSchema = z.object({
      /** The owner's own words, when they have any. */
      note: z.string().max(2_000).optional(),
    });
    const body = parseBody(stopSchema, request.body ?? {});
    const db = app.services.runtime.db;
    const now = new Date().toISOString();

    const before = activity.readTurnRow(db, id);
    if (!before) notFound('Execution');

    const result = activity.requestStop(db, id, now);

    // The request is written to the audit trail whether or not it could be
    // carried out: an ask that was recorded and did not stop the turn is
    // still something the owner did, and the trail should show it.
    audit(
      request,
      'execution.stop.requested',
      { type: 'execution', id, workspaceId: before.workspaceId },
      {
        outcome: result.outcome,
        ...(body.note?.trim() ? { note: body.note } : {}),
      },
    );

    const after = activity.readTurnRow(db, id);
    const run: RunControl = activity.runControlFor({
      status: activity.turnStatusOf(after?.status ?? before.status),
      stopRequested: result.outcome === 'requested',
      canSteer: false,
    });

    const response: StopTurnResult = {
      executionId: id,
      outcome: result.outcome,
      detail: result.detail,
      run,
    };
    return response;
  });
}
