import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBody, parseQuery, requireAuth } from './helpers.js';
import { decideApproval } from '../modules/approvals/resume.js';
import { errors } from '../lib/errors.js';
import {
  emptyProjectionState,
  projectServerEvent,
  type AgUiEvent,
  type AgUiProjectionState,
} from './agui-protocol.js';

const POLL_INTERVAL_MS = 250;
const HEARTBEAT_MS = 20_000;
const PRIME_LIMIT = 50;

const streamQuerySchema = z.object({
  conversationId: z.string().min(1).optional(),
});

const resumeSchema = z.object({
  resume: z
    .array(
      z.object({
        interruptId: z.string().min(1),
        status: z.enum(['resolved', 'cancelled']),
        payload: z.unknown().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1),
});

/**
 * The answer an interrupt expects. The interrupt publishes this as its
 * `responseSchema`, and the resume is held to it.
 */
const decisionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().max(2_000).optional(),
});

/**
 * AG-UI, at the API boundary.
 *
 * The panel already publishes an event stream; these routes are the same
 * stream in a published protocol's vocabulary. Nothing here changes what the
 * panel publishes, and the panel's own stream — `GET /api/events` — is not
 * touched: an external consumer that speaks AG-UI reads this route, and the
 * web client keeps reading the one it has always read.
 */
export function registerAgUiRoutes(app: FastifyInstance): void {
  /**
   * The AG-UI stream.
   *
   * One AG-UI event per SSE frame, exactly as the AG-UI HTTP+SSE binding
   * frames them: the frame's `data` is one protocol event as a JSON object,
   * and the keep-alive is an SSE comment. The stream carries no `event:` name
   * and no `id:` — AG-UI consumers ignore those fields, and the protocol has
   * no use for them.
   */
  app.get('/api/agui/events', { preHandler: requireAuth }, async (request, reply) => {
    const { conversationId } = parseQuery(streamQuerySchema, request.query);
    const events = app.services.events;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    let cursor = 0;
    let closed = false;
    let state: AgUiProjectionState = emptyProjectionState();

    const write = (event: AgUiEvent): void => {
      if (closed) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const project = (payload: Parameters<typeof projectServerEvent>[0]): void => {
      const result = projectServerEvent(payload, state);
      state = result.state;
      for (const event of result.events) write(event);
    };

    // Prime the client with the most recent events so a reconnecting
    // consumer does not miss what happened while it was away.
    const recent = events.recent(null, PRIME_LIMIT);
    for (const event of recent) {
      cursor = Math.max(cursor, event.seq);
      if (conversationId && event.conversationId !== conversationId) continue;
      project(event.payload);
    }

    const drain = (): void => {
      if (closed) return;
      const pending = events.since(cursor, 200);
      for (const event of pending) {
        cursor = Math.max(cursor, event.seq);
        if (conversationId && event.conversationId !== conversationId) continue;
        project(event.payload);
      }
    };

    const poll = setInterval(drain, POLL_INTERVAL_MS);
    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(': ping\n\n');
    }, HEARTBEAT_MS);

    const wake = events.onWake(drain);

    const stop = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      wake();
    };

    request.raw.on('close', stop);
    reply.raw.on('close', stop);
  });

  /**
   * Answer the interrupts of a run.
   *
   * An AG-UI interrupt carries the approval's own id, so a resume entry
   * naming that id resolves the same approval the panel's own approval route
   * would. The run in the path says which run the answer belongs to: the
   * interrupt has to be one that run raised.
   */
  app.post('/api/agui/runs/:runId/resume', { preHandler: requireAuth }, async (request) => {
    const { runId } = request.params as { runId: string };
    const body = parseBody(resumeSchema, request.body);

    // The first run of an execution is named after the execution, and a run
    // that continues an interrupted one is named after it with a counter.
    const executionId = runId.split(':')[0] ?? runId;

    const resumed = [];
    for (const entry of body.resume) {
      const approval = app.services.approvals.get(entry.interruptId);

      if (approval.executionId !== executionId) {
        throw errors.conflict('That interrupt belongs to a different run.', {
          runId,
          interruptId: entry.interruptId,
        });
      }

      // An abandoned interrupt is a refusal: the operation was not approved,
      // and the decision says so.
      const answer =
        entry.status === 'resolved'
          ? decisionOf(entry.payload)
          : {
              approved: false,
              reason: 'The interrupt was abandoned, so the operation was not approved.',
            };

      const decision = decideApproval({
        db: app.services.runtime.db,
        queue: app.services.queue,
        audit: app.services.audit,
        approvals: app.services.approvals,
        approvalId: entry.interruptId,
        approved: answer.approved,
        reason: answer.reason ?? '',
        decidedBy: request.user?.id ?? 'owner',
        actorType: request.actorType ?? 'human',
      });

      resumed.push({
        interruptId: entry.interruptId,
        status: entry.status,
        approval: decision.approval,
        outcome: decision.outcome,
        detail: decision.detail,
      });
    }

    return { runId, resumed };
  });
}

/** The decision an answered interrupt carries. */
function decisionOf(payload: unknown): z.infer<typeof decisionSchema> {
  const result = decisionSchema.safeParse(payload);
  if (!result.success) {
    throw errors.validation('The answer to this interrupt is invalid.', result.error.flatten());
  }
  return result.data;
}
