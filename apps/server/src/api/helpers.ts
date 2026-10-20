import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { errors } from '../lib/errors.js';

/**
 * Reject the request unless the caller is the owner.
 *
 * The owner is authenticated either by a session cookie or by the static
 * owner token. Agent tokens are deliberately *not* accepted here: they are
 * scoped to the MCP endpoint, where tool visibility and authorisation are
 * applied per connection.
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.user || request.actorType !== 'human') {
    throw errors.unauthorized('This endpoint requires an owner session.');
  }
}

/**
 * Parse a request payload against a schema.
 * Validation failures are reported with the same structured envelope as
 * every other error.
 */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw errors.validation('The request payload is invalid.', result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw errors.validation('The query parameters are invalid.', result.error.flatten());
  }
  return result.data;
}

export function notFound(what: string): never {
  throw errors.notFound(what);
}

/**
 * Record an audit entry for the current request.
 * Every entry answers who requested the action, which agent performed it,
 * and what the result was.
 */
export function audit(
  request: FastifyRequest,
  action: string,
  target: { type: string; id: string; workspaceId?: string },
  metadata?: unknown,
): void {
  request.server.services.audit.record({
    workspaceId: target.workspaceId ?? null,
    actorType: request.actorType ?? 'human',
    actorId: request.user?.id ?? 'anonymous',
    action,
    targetType: target.type,
    targetId: target.id,
    result: 'success',
    metadata,
  });
}

/** Register a JSON route with a uniform success envelope. */
export function ok(reply: FastifyReply, data: unknown): FastifyReply {
  return reply.send(data);
}

export type { FastifyInstance };
