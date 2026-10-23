import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import { parseBody, requireAuth } from './helpers.js';

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

    // It is the shared capability API that closes the turn, so the owner's
    // conclusion here and the agent's `execution.resolve` are the same path:
    // one place where the turn leaves the unknown state, the reply follows and
    // the trail is written.
    const resolution = app.services.capabilities.executionResolve({
      executionId: id,
      outcome: body.outcome,
      note: body.note,
      actorType: request.actorType ?? 'human',
      actorId: request.user?.id ?? 'owner',
    });

    // The sentence comes back with the answer, so the panel can say what the
    // decision did instead of leaving the owner to infer it.
    return {
      execution: resolution.execution,
      outcome: resolution.outcome,
      detail: resolution.detail,
    };
  });

  /**
   * The turn, with the activity behind it.
   *
   * The trace the panel draws is derived from the event log, so it is still
   * there when the owner comes back to the room. The route is the one the
   * contract publishes: the turn's status, its capability view, its
   * delegation tree and its committed revision, with the activity the turn
   * produced beside them.
   *
   * The read model is the service's, and the agent's `execution.get` reads
   * the same one: a person and an agent see the same turn.
   */
  app.get('/api/executions/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.executions.read(id);
  });

  /**
   * Ask a turn to stop.
   *
   * A turn that had not started is cancelled, and the answer says so. A turn
   * that is already running can only be asked: the worker holds the live
   * session, and the API server never runs an agent, so there is no channel
   * from here to a running turn. The answer never presents the request as a
   * cancellation.
   *
   * The request is made through the service, and the agent's `execution.stop`
   * makes the same request: one stop path, one trail, one set of words.
   */
  app.post('/api/executions/:id/stop', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const stopSchema = z.object({
      /** The owner's own words, when they have any. */
      note: z.string().max(2_000).optional(),
    });
    const body = parseBody(stopSchema, request.body ?? {});

    return app.services.executions.stop({
      executionId: id,
      note: body.note,
      actorType: request.actorType ?? 'human',
      actorId: request.user?.id ?? 'anonymous',
    });
  });
}
