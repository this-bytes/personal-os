import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { personaSchema, routingModeSchema } from '@personal-os/contracts';
import { audit, parseBody, parseQuery, requireAuth } from './helpers.js';

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  before: z.string().optional(),
});

const createSchema = z.object({
  workspaceId: z.string(),
  title: z.string().min(1).max(300),
  routingMode: routingModeSchema.default('mentions'),
  coordinatorId: z.string().optional(),
  participantAgentConnectionIds: z.array(z.string()).default([]),
});

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  routingMode: routingModeSchema.optional(),
  coordinatorId: z.string().optional(),
  maxTurns: z.number().int().min(1).max(1000).optional(),
  maxDurationSeconds: z.number().int().min(1).max(86_400).optional(),
  maxSpendUnits: z.number().int().min(0).optional(),
  paused: z.boolean().optional(),
});

const participantSchema = z.object({
  type: z.enum(['human', 'agent']),
  agentConnectionId: z.string().optional(),
  displayName: z.string().min(1).max(200),
  /** A persona that replaces the connection's base for this conversation. */
  personaOverride: personaSchema.optional(),
});

const participantPatchSchema = z.object({
  /** A persona that replaces the connection's base. `null` clears it. */
  personaOverride: personaSchema.nullable().optional(),
});

const postMessageSchema = z.object({
  content: z
    .array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({ type: z.literal('artifact'), resourceId: z.string() }),
        z.object({ type: z.literal('file'), resourceId: z.string() }),
      ]),
    )
    .min(1),
  replyToId: z.string().optional(),
  targetParticipantIds: z.array(z.string()).optional(),
});

export function registerConversationRoutes(app: FastifyInstance): void {
  app.get('/api/conversations', { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(listQuerySchema, request.query);
    const conversations = query.workspaceId
      ? app.services.conversations.list(query.workspaceId)
      : app.services.workspaces
          .list()
          .flatMap((workspace) => app.services.conversations.list(workspace.id));
    return { conversations };
  });

  app.post('/api/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const conversation = app.services.conversations.create({
      ...body,
      humanDisplayName: request.user?.displayName ?? 'Owner',
    });
    audit(
      request,
      'conversation.created',
      { type: 'conversation', id: conversation.id, workspaceId: body.workspaceId },
      {
        routingMode: body.routingMode,
        participants: body.participantAgentConnectionIds.length,
      },
    );
    return reply.code(201).send({ conversation });
  });

  app.get('/api/conversations/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { conversation: app.services.conversations.get(id) };
  });

  app.patch('/api/conversations/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSchema, request.body);
    const conversation = app.services.conversations.update(id, body);
    audit(
      request,
      'conversation.updated',
      { type: 'conversation', id, workspaceId: conversation.workspaceId },
      body,
    );
    return { conversation };
  });

  app.delete('/api/conversations/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    app.services.conversations.remove(id);
    return reply.send({ ok: true });
  });

  app.get('/api/conversations/:id/messages', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const query = parseQuery(listQuerySchema, request.query);
    return {
      messages: app.services.conversations.listMessages(id, {
        limit: query.limit,
        before: query.before,
      }),
    };
  });

  app.post(
    '/api/conversations/:id/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(postMessageSchema, request.body);
      const result = await app.services.conversations.postMessage(id, {
        content: body.content,
        replyToId: body.replyToId,
        targetParticipantIds: body.targetParticipantIds,
        humanDisplayName: request.user?.displayName ?? 'Owner',
      });
      audit(
        request,
        'message.posted',
        { type: 'conversation', id, workspaceId: app.services.conversations.get(id).workspaceId },
        {
          dispatches: result.dispatches.map((dispatch) => dispatch.agentConnectionId),
          routing: result.routing.reason,
        },
      );
      return reply.code(201).send(result);
    },
  );

  app.post(
    '/api/conversations/:id/participants',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(participantSchema, request.body);
      return reply
        .code(201)
        .send({ participant: app.services.conversations.addParticipant(id, body) });
    },
  );

  app.patch(
    '/api/conversations/:id/participants/:participantId',
    { preHandler: requireAuth },
    async (request) => {
      const { id, participantId } = request.params as { id: string; participantId: string };
      const body = parseBody(participantPatchSchema, request.body ?? {});
      const participant = app.services.conversations.updateParticipant(id, participantId, body);
      audit(request, 'conversation.participant.updated', {
        type: 'conversation',
        id,
        workspaceId: app.services.conversations.get(id).workspaceId,
      });
      return { participant };
    },
  );

  app.delete(
    '/api/conversations/:id/participants/:participantId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, participantId } = request.params as { id: string; participantId: string };
      app.services.conversations.removeParticipant(id, participantId);
      return reply.send({ ok: true });
    },
  );
}
