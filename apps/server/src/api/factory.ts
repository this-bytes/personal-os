import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit, parseBody, parseQuery, requestAuthor, requireAuth } from './helpers.js';

const workspaceQuerySchema = z.object({ workspaceId: z.string() });

const dependencyQuerySchema = z.object({
  workspaceId: z.string(),
  goalId: z.string().optional(),
});

const createGoalSchema = z.object({
  workspaceId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().default(''),
});

const createTaskSchema = z.object({
  workspaceId: z.string(),
  goalId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  assigneeId: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  /**
   * The external orchestrator's own identifier for this work — the work item
   * in the repository, when this task carries one.
   */
  externalRef: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  // `done` is not settable here: only an acceptance decision closes a task.
  status: z.enum(['open', 'active', 'blocked', 'review', 'cancelled']).optional(),
  assigneeId: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  // The tasks this task waits on. A task never waits on itself, directly or
  // through a chain, so a change that would close a loop is refused.
  dependsOnTaskIds: z.array(z.string()).optional(),
  // The revision the caller read. A task that changed in the meantime is
  // rejected instead of being overwritten.
  expectedRevision: z.number().int().min(1).optional(),
});

const assignSchema = z.object({ agentConnectionId: z.string() });

const acceptanceSchema = z.object({
  satisfied: z.boolean(),
  reason: z.string().default(''),
});

export function registerFactoryRoutes(app: FastifyInstance): void {
  app.get('/api/goals', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(workspaceQuerySchema, request.query);
    return { goals: app.services.factory.listGoals(workspaceId) };
  });

  app.post('/api/goals', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createGoalSchema, request.body);
    const goal = app.services.factory.createGoal(body);
    audit(request, 'goal.created', { type: 'goal', id: goal.id, workspaceId: body.workspaceId });
    return reply.code(201).send({ goal });
  });

  app.get('/api/goals/overview', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(workspaceQuerySchema, request.query);
    return {
      goals: app.services.factory.listGoals(workspaceId),
      rollups: app.services.factory.listGoalRollups(workspaceId),
    };
  });

  app.get('/api/goals/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { goal: app.services.factory.getGoal(id) };
  });

  app.get('/api/goals/:id/view', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.factory.goalView(id);
  });

  app.get('/api/tasks', { preHandler: requireAuth }, async (request) => {
    const { workspaceId } = parseQuery(workspaceQuerySchema, request.query);
    return { tasks: app.services.factory.listTasks(workspaceId) };
  });

  app.get('/api/tasks/dependencies', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, goalId } = parseQuery(dependencyQuerySchema, request.query);
    return {
      dependencies: app.services.factory.listDependencies(workspaceId, {
        ...(goalId !== undefined ? { goalId } : {}),
      }),
    };
  });

  app.post('/api/tasks', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createTaskSchema, request.body);
    const task = app.services.factory.createTask({ ...body, author: requestAuthor(request) });
    audit(request, 'task.created', { type: 'task', id: task.id, workspaceId: body.workspaceId });
    return reply.code(201).send({ task });
  });

  app.get('/api/tasks/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return {
      task: app.services.factory.getTask(id),
      evidence: app.services.factory.listEvidence(id),
    };
  });

  app.patch('/api/tasks/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateTaskSchema, request.body);
    return {
      task: app.services.factory.updateTask(id, {
        ...body,
        actorId: request.user?.id ?? 'owner',
      }),
    };
  });

  app.post('/api/tasks/:id/assign', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(assignSchema, request.body);
    const task = await app.services.factory.assignToAgent(id, body.agentConnectionId);
    audit(
      request,
      'task.assigned',
      { type: 'task', id, workspaceId: task.workspaceId },
      {
        agentConnectionId: body.agentConnectionId,
      },
    );
    return { task };
  });

  app.post('/api/tasks/:id/accept', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(acceptanceSchema, request.body);
    const task = app.services.factory.acceptTask(id, {
      satisfied: body.satisfied,
      reason: body.reason,
      acceptedBy: request.user?.id ?? 'owner',
    });
    audit(
      request,
      body.satisfied ? 'task.accepted' : 'task.rejected',
      { type: 'task', id, workspaceId: task.workspaceId },
      { reason: body.reason },
    );
    return { task };
  });
}
