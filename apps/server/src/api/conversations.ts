import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v3';
import {
  personaSchema,
  routingModeSchema,
  botRoleSchema,
  messageDeliverySchema,
} from '@personal-os/contracts';
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
  /**
   * How the message reaches an agent.
   *
   * `queue` is the default. `steer` asks for the turn that is running, and
   * the answer says what happened to it.
   */
  delivery: messageDeliverySchema.optional(),
});

const registerBotSchema = z.object({
  agentConnectionId: z.string().min(1),
  role: botRoleSchema,
  displayName: z.string().min(1).max(200).optional(),
  scope: z
    .object({
      mayDispatch: z.boolean().optional(),
      dispatchableAgentConnectionIds: z.array(z.string()).optional(),
    })
    .optional(),
});

const dispatchSchema = z.object({
  /** The bot that hands the work over. */
  coordinatorAgentConnectionId: z.string().min(1),
  /** The bot that does the work. */
  agentConnectionId: z.string().min(1),
  instruction: z.string().min(1).max(10_000),
  title: z.string().min(1).max(300).optional(),
  taskId: z.string().optional(),
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
    const conversation = app.services.conversations.get(id);
    app.services.conversations.remove(id);
    audit(request, 'conversation.removed', {
      type: 'conversation',
      id,
      workspaceId: conversation.workspaceId,
    });
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
        delivery: body.delivery,
        humanDisplayName: request.user?.displayName ?? 'Owner',
      });
      audit(
        request,
        'message.posted',
        { type: 'conversation', id, workspaceId: app.services.conversations.get(id).workspaceId },
        {
          dispatches: result.dispatches.map((dispatch) => dispatch.agentConnectionId),
          routing: result.routing.reason,
          ...(result.steer ? { steer: result.steer.delivered } : {}),
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
      const participant = app.services.conversations.addParticipant(id, body);
      audit(request, 'conversation.participant.added', {
        type: 'conversation',
        id,
        workspaceId: app.services.conversations.get(id).workspaceId,
      });
      return reply.code(201).send({ participant });
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
      const conversation = app.services.conversations.get(id);
      app.services.conversations.removeParticipant(id, participantId);
      audit(request, 'conversation.participant.removed', {
        type: 'conversation',
        id,
        workspaceId: conversation.workspaceId,
      });
      return reply.send({ ok: true });
    },
  );

  /**
   * The team of a room: who is in it, what each one may hand work to, and
   * the work that has been handed over.
   */
  app.get('/api/conversations/:id/bots', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const conversation = app.services.conversations.get(id);
    return {
      bots: app.services.bots.list(conversation.id),
      delegatedTasks: app.services.bots.listDelegations(conversation.id),
    };
  });

  app.post('/api/conversations/:id/bots', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(registerBotSchema, request.body);
    const conversation = app.services.conversations.get(id);
    const bot = app.services.bots.register({
      conversationId: conversation.id,
      agentConnectionId: body.agentConnectionId,
      role: body.role,
      displayName: body.displayName,
      scope: body.scope,
    });
    audit(
      request,
      'bot.registered',
      { type: 'conversation', id: conversation.id, workspaceId: conversation.workspaceId },
      { agentConnectionId: bot.agentConnectionId, role: bot.role },
    );
    return reply.code(201).send({ bot });
  });

  /**
   * Hand a piece of work to another agent on the owner's behalf.
   *
   * The scope of the coordinator still decides: the owner can ask for a
   * delegation the coordinator is allowed to make, and no other.
   */
  app.post(
    '/api/conversations/:id/bots/dispatch',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(dispatchSchema, request.body);
      const conversation = app.services.conversations.get(id);
      const result = app.services.bots.dispatch({
        coordinatorAgentConnectionId: body.coordinatorAgentConnectionId,
        conversationId: conversation.id,
        agentConnectionId: body.agentConnectionId,
        instruction: body.instruction,
        title: body.title,
        taskId: body.taskId,
      });
      audit(
        request,
        'bot.dispatched',
        { type: 'conversation', id: conversation.id, workspaceId: conversation.workspaceId },
        {
          coordinatorAgentConnectionId: body.coordinatorAgentConnectionId,
          agentConnectionId: body.agentConnectionId,
          delegatedTaskId: result.delegatedTask.id,
        },
      );
      return reply.code(201).send(result);
    },
  );
}
