import { and, desc, eq } from 'drizzle-orm';
import {
  type Evidence,
  type FactoryTask,
  type Goal,
  type GoalRollup,
  type GoalStatus,
  type GoalView,
  type TaskDependency,
  type TaskStatus,
  type ExecutionOwner,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { evidence, executions, goals, tasks } from '../../db/schema.js';
import { authorOf, type Author } from '../../lib/author.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { EventsService } from '../events/service.js';
import type { AuditService } from '../audit/service.js';
import type { Queue } from '../../queue/client.js';
import { dependencyStates, rollupGoal, wouldCreateCycle, type DependencyEdge } from './graph.js';

/** How a listing of tasks can be narrowed. */
export interface TaskFilter {
  /** Only the tasks under this goal. */
  goalId?: string;
  /** Only the tasks in this status. */
  status?: TaskStatus;
  /** Only the tasks that wait on a task that is not out of the way yet. */
  waitingOnDependency?: boolean;
}

export interface FactoryService {
  listGoals(workspaceId: string): Goal[];
  getGoal(id: string): Goal;
  createGoal(input: {
    workspaceId: string;
    title: string;
    description?: string;
    autonomyPolicy?: Goal['autonomyPolicy'];
  }): Goal;
  updateGoal(
    id: string,
    patch: {
      title?: string;
      description?: string;
      status?: GoalStatus;
      autonomyPolicy?: Goal['autonomyPolicy'];
    },
  ): Goal;
  listTasks(workspaceId: string, goalId?: string): FactoryTask[];
  /** The tasks of a workspace, narrowed by goal, status or dependency state. */
  listTasksWhere(workspaceId: string, filter?: TaskFilter): FactoryTask[];
  /**
   * What the tasks of a workspace wait on, and whether that is out of the way.
   * An edge is one direction: the task that waits, and the task it waits on.
   */
  listDependencies(workspaceId: string, filter?: { goalId?: string }): TaskDependency[];
  /** The counts of a goal's work. */
  goalRollup(goalId: string): GoalRollup;
  /** The counts of every goal in a workspace. */
  listGoalRollups(workspaceId: string): GoalRollup[];
  /** A goal, the work under it, and the shape of that work. */
  goalView(goalId: string): GoalView;
  getTask(id: string): FactoryTask;
  /**
   * The author a task records, or undefined when the task is unknown.
   *
   * The author lives in the task's storage and not in the published task
   * shape, so a caller that needs it asks for it here.
   */
  taskAuthor(id: string): string | undefined;
  /**
   * The authors the workspace's tasks record, by task id.
   */
  taskAuthors(workspaceId: string): Map<string, string>;
  createTask(input: {
    workspaceId: string;
    goalId?: string;
    title: string;
    description?: string;
    assigneeId?: string;
    executionOwner?: ExecutionOwner;
    acceptanceCriteria?: string[];
    /** Who created the task. Recorded on the row, not taken from a body. */
    author: Author;
    /** The template this task was made from, and the version of it. */
    templateId?: string;
    templateVersion?: number;
    /** The external orchestrator's own identifier for this work. */
    externalRef?: string;
  }): FactoryTask;
  updateTask(
    id: string,
    patch: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      assigneeId?: string;
      executionOwner?: ExecutionOwner;
      acceptanceCriteria?: string[];
      goalId?: string;
      externalRef?: string;
      /**
       * The tasks this task waits on.
       *
       * A task never waits on itself, directly or through a chain, so a
       * change that would close a loop is refused rather than written.
       */
      dependsOnTaskIds?: string[];
      /**
       * The revision the caller read. When present, a task that changed in
       * the meantime is rejected instead of being overwritten.
       */
      expectedRevision?: number;
      /**
       * Who made the change. Recorded in the audit trail when the task
       * leaves the unknown state.
       */
      actorId?: string;
    },
  ): FactoryTask;
  /** Hand a task to an agent; the worker performs the work. */
  assignToAgent(taskId: string, agentConnectionId: string): Promise<FactoryTask>;
  addEvidence(input: {
    taskId: string;
    executionId?: string;
    kind: Evidence['kind'];
    summary: string;
    resourceId?: string;
    payload?: unknown;
  }): Evidence;
  listEvidence(taskId: string): Evidence[];
  /** Record an acceptance decision. Only a satisfied acceptance closes a task. */
  acceptTask(
    taskId: string,
    input: { satisfied: boolean; reason?: string; acceptedBy: string },
  ): FactoryTask;
}

export interface FactoryServiceOptions {
  db: Database;
  events: EventsService;
  queue: Queue;
  /** The audit trail. A task leaving the unknown state is written to it. */
  audit: AuditService;
}

/**
 * The software factory. A goal survives changes in agents, sessions and
 * provider accounts; a task keeps its ownership even when the agent that
 * performs it is disconnected.
 */
export function createFactoryService(options: FactoryServiceOptions): FactoryService {
  const { db, events, queue, audit } = options;

  const toGoal = (row: typeof goals.$inferSelect): Goal => ({
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    status: row.status as GoalStatus,
    autonomyPolicy: row.autonomyPolicy as Goal['autonomyPolicy'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const toTask = (row: typeof tasks.$inferSelect): FactoryTask => ({
    id: row.id,
    workspaceId: row.workspaceId,
    goalId: row.goalId ?? undefined,
    title: row.title,
    description: row.description,
    assigneeId: row.assigneeId ?? undefined,
    executionOwner: row.executionOwner as ExecutionOwner,
    status: row.status as TaskStatus,
    acceptanceCriteria: row.acceptanceCriteria,
    evidenceResourceIds: row.evidenceResourceIds,
    // The rows that predate the column recorded no dependency at all, and a
    // task that waits on nothing is what they said.
    dependsOnTaskIds: row.dependsOnTaskIds ?? [],
    revision: row.revision,
    externalRef: row.externalRef ?? undefined,
    templateId: row.templateId ?? undefined,
    templateVersion: row.templateVersion ?? undefined,
  });

  const toEvidence = (row: typeof evidence.$inferSelect): Evidence => ({
    id: row.id,
    taskId: row.taskId,
    executionId: row.executionId ?? undefined,
    kind: row.kind as Evidence['kind'],
    summary: row.summary,
    resourceId: row.resourceId ?? undefined,
    payload: row.payload,
    createdAt: row.createdAt,
  });

  /**
   * The dependency edges of a workspace, without the edges of one task.
   *
   * The edges of the task being written are left out, because the list that
   * is being written replaces them.
   */
  const workspaceEdges = (
    workspaceId: string,
    exceptTaskId?: string,
  ): { edges: DependencyEdge[]; known: Set<string> } => {
    const rows = db
      .select({ id: tasks.id, dependsOnTaskIds: tasks.dependsOnTaskIds })
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .all();
    const edges: DependencyEdge[] = [];
    const known = new Set<string>();
    for (const row of rows) {
      known.add(row.id);
      if (row.id === exceptTaskId) continue;
      for (const dependencyId of row.dependsOnTaskIds ?? []) {
        edges.push({ taskId: row.id, dependsOnTaskId: dependencyId });
      }
    }
    return { edges, known };
  };

  /**
   * Refuse a dependency list that would close a loop.
   *
   * A task that waits on a task that waits on it — directly or through a
   * chain — is work waiting for itself, and a task that waits on a task
   * that does not exist is a wait on nothing.
   */
  const assertDependencies = (row: typeof tasks.$inferSelect, dependsOnTaskIds: string[]): void => {
    const { edges, known } = workspaceEdges(row.workspaceId, row.id);
    for (const dependencyId of dependsOnTaskIds) {
      if (!known.has(dependencyId)) throw errors.notFound('Task');
      if (dependencyId === row.id) {
        throw errors.badRequest('A task cannot wait on itself.');
      }
      if (wouldCreateCycle(edges, row.id, dependencyId)) {
        throw errors.badRequest(
          'A task cannot wait on a task that waits on it: that would be a loop.',
        );
      }
    }
  };

  const service: FactoryService = {
    listGoals(workspaceId): Goal[] {
      return db.select().from(goals).where(eq(goals.workspaceId, workspaceId)).all().map(toGoal);
    },

    getGoal(id): Goal {
      const row = db.select().from(goals).where(eq(goals.id, id)).get();
      if (!row) throw errors.notFound('Goal');
      return toGoal(row);
    },

    createGoal(input): Goal {
      const id = newId('gol');
      const now = new Date().toISOString();
      db.insert(goals)
        .values({
          id,
          workspaceId: input.workspaceId,
          title: input.title.trim(),
          description: input.description?.trim() ?? '',
          status: 'active',
          autonomyPolicy: input.autonomyPolicy ?? {
            mode: 'manual',
            allowedActions: [],
            approvalRequired: [],
            maxTurns: 8,
            maxDurationSeconds: 900,
            maxSpendUnits: 0,
            dailySpendUnits: 0,
          },
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return service.getGoal(id);
    },

    updateGoal(id, patch): Goal {
      const current = service.getGoal(id);
      db.update(goals)
        .set({
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.autonomyPolicy !== undefined ? { autonomyPolicy: patch.autonomyPolicy } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(goals.id, current.id))
        .run();
      return service.getGoal(id);
    },

    listTasks(workspaceId, goalId): FactoryTask[] {
      const rows = goalId
        ? db
            .select()
            .from(tasks)
            .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.goalId, goalId)))
            .all()
        : db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).all();
      return rows.map(toTask);
    },

    getTask(id): FactoryTask {
      const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
      if (!row) throw errors.notFound('Task');
      return toTask(row);
    },

    taskAuthor(id): string | undefined {
      const row = db
        .select({ createdBy: tasks.createdBy })
        .from(tasks)
        .where(eq(tasks.id, id))
        .get();
      return row?.createdBy;
    },

    taskAuthors(workspaceId): Map<string, string> {
      const rows = db
        .select({ id: tasks.id, createdBy: tasks.createdBy })
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .all();
      return new Map(rows.map((row) => [row.id, row.createdBy]));
    },

    createTask(input): FactoryTask {
      const id = newId('tsk');
      const now = new Date().toISOString();
      db.insert(tasks)
        .values({
          id,
          workspaceId: input.workspaceId,
          goalId: input.goalId ?? null,
          title: input.title.trim(),
          description: input.description?.trim() ?? '',
          assigneeId: input.assigneeId ?? null,
          executionOwner: input.executionOwner ?? 'personal-os',
          status: 'open',
          revision: 1,
          acceptanceCriteria: input.acceptanceCriteria ?? [],
          evidenceResourceIds: [],
          dependsOnTaskIds: [],
          externalRef: input.externalRef ?? null,
          createdBy: authorOf(input.author),
          templateId: input.templateId ?? null,
          templateVersion: input.templateVersion ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return service.getTask(id);
    },

    updateTask(id, patch): FactoryTask {
      const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
      if (!row) throw errors.notFound('Task');

      // Optimistic concurrency: the caller presents the revision it read, so
      // two people editing the same task cannot silently overwrite each
      // other.
      if (patch.expectedRevision !== undefined && patch.expectedRevision !== row.revision) {
        throw errors.revisionMismatch(patch.expectedRevision, row.revision, 'task');
      }

      // A task is never closed by an ordinary update. Only an explicit
      // acceptance decision may mark it done, so that "the agent says it
      // finished" and "the acceptance criteria are satisfied" stay distinct.
      if (patch.status === 'done') {
        throw errors.badRequest(
          'A task cannot be marked done directly. Record an acceptance decision instead.',
        );
      }

      // The dependencies are checked before they are written, because a task
      // that waits on itself — directly or through a chain — is work that
      // would never move again.
      const dependsOnTaskIds =
        patch.dependsOnTaskIds === undefined ? undefined : [...new Set(patch.dependsOnTaskIds)];
      if (dependsOnTaskIds !== undefined) {
        assertDependencies(row, dependsOnTaskIds);
      }

      db.update(tasks)
        .set({
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
          ...(patch.executionOwner !== undefined ? { executionOwner: patch.executionOwner } : {}),
          ...(patch.acceptanceCriteria !== undefined
            ? { acceptanceCriteria: patch.acceptanceCriteria }
            : {}),
          ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
          ...(patch.externalRef !== undefined ? { externalRef: patch.externalRef } : {}),
          ...(dependsOnTaskIds !== undefined ? { dependsOnTaskIds } : {}),
          revision: row.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, id))
        .run();

      // Leaving the unknown state is the owner's answer to the question the
      // worker could not answer, so it is written to the audit trail.
      if (row.status === 'unknown' && patch.status !== undefined && patch.status !== 'unknown') {
        audit.record({
          workspaceId: row.workspaceId,
          actorType: 'human',
          actorId: patch.actorId ?? 'owner',
          action: 'task.outcome.resolved',
          targetType: 'task',
          targetId: id,
          result: 'success',
          metadata: { from: 'unknown', to: patch.status },
        });
      }

      return service.getTask(id);
    },

    async assignToAgent(taskId, agentConnectionId): Promise<FactoryTask> {
      const task = service.getTask(taskId);
      const now = new Date().toISOString();
      const executionId = newId('exe');

      // Handing a task with an unknown outcome to an agent is the owner's
      // decision to run the work again, and it is the answer to the question
      // the worker could not answer. An audit reader has to be able to see
      // that it happened.
      if (task.status === 'unknown') {
        audit.record({
          workspaceId: task.workspaceId,
          actorType: 'human',
          actorId: 'owner',
          action: 'task.outcome.resolved',
          targetType: 'task',
          targetId: taskId,
          result: 'success',
          metadata: { from: 'unknown', to: 'active', agentConnectionId },
        });
      }

      db.update(tasks)
        .set({ assigneeId: agentConnectionId, status: 'active', updatedAt: now })
        .where(eq(tasks.id, taskId))
        .run();

      db.insert(executions)
        .values({
          id: executionId,
          workspaceId: task.workspaceId,
          taskId,
          conversationId: null,
          // The execution carries the work item's own reference, so the link
          // is visible from either side of the ledger.
          externalRef: task.externalRef ?? null,
          agentConnectionId,
          executionOwner: 'personal-os',
          status: 'queued',
          error: null,
          spendUnits: 0,
          startedAt: null,
          finishedAt: null,
          createdAt: now,
        })
        .run();

      queue.enqueue({
        workspaceId: task.workspaceId,
        type: 'factory.execute',
        payload: { taskId, executionId, agentConnectionId },
      });

      events.publish(
        {
          type: 'execution.event',
          executionId,
          event: { type: 'execution.status', executionId, status: 'queued' },
        },
        { workspaceId: task.workspaceId },
      );

      return service.getTask(taskId);
    },

    addEvidence(input): Evidence {
      const task = service.getTask(input.taskId);
      const id = newId('evd');
      db.insert(evidence)
        .values({
          id,
          workspaceId: task.workspaceId,
          taskId: input.taskId,
          executionId: input.executionId ?? null,
          kind: input.kind,
          summary: input.summary,
          resourceId: input.resourceId ?? null,
          payload: input.payload ?? null,
          createdAt: new Date().toISOString(),
        })
        .run();

      const row = db.select().from(evidence).where(eq(evidence.id, id)).get()!;
      return toEvidence(row);
    },

    listEvidence(taskId): Evidence[] {
      return db
        .select()
        .from(evidence)
        .where(eq(evidence.taskId, taskId))
        .orderBy(desc(evidence.createdAt))
        .all()
        .map(toEvidence);
    },

    acceptTask(taskId, input): FactoryTask {
      const task = service.getTask(taskId);
      const now = new Date().toISOString();

      // An agent reporting completion is not acceptance. Acceptance is an
      // explicit judgement recorded against the task.
      const status: TaskStatus = input.satisfied ? 'done' : 'open';

      db.update(tasks)
        .set({ status, revision: task.revision + 1, updatedAt: now })
        .where(eq(tasks.id, taskId))
        .run();

      service.addEvidence({
        taskId,
        kind: 'observation',
        summary: input.satisfied
          ? `Acceptance confirmed${input.reason ? `: ${input.reason}` : '.'}`
          : `Acceptance rejected${input.reason ? `: ${input.reason}` : '.'}.`,
        payload: { satisfied: input.satisfied, acceptedBy: input.acceptedBy },
      });

      // An acceptance is also how the owner answers a task whose outcome
      // could not be confirmed.
      if (task.status === 'unknown') {
        audit.record({
          workspaceId: task.workspaceId,
          actorType: 'human',
          actorId: input.acceptedBy,
          action: 'task.outcome.resolved',
          targetType: 'task',
          targetId: taskId,
          result: 'success',
          metadata: { from: 'unknown', to: status },
        });
      }

      const updated = service.getTask(taskId);
      events.publish({ type: 'task.updated', task: updated }, { workspaceId: task.workspaceId });
      return updated;
    },

    listTasksWhere(workspaceId, filter): FactoryTask[] {
      let found = service.listTasks(workspaceId);
      if (filter?.goalId !== undefined) {
        found = found.filter((task) => task.goalId === filter.goalId);
      }
      if (filter?.status !== undefined) {
        found = found.filter((task) => task.status === filter.status);
      }
      if (filter?.waitingOnDependency !== undefined) {
        const waiting = new Set(
          service
            .listDependencies(workspaceId)
            .filter((dependency) => !dependency.satisfied)
            .map((dependency) => dependency.taskId),
        );
        found = found.filter((task) =>
          filter.waitingOnDependency ? waiting.has(task.id) : !waiting.has(task.id),
        );
      }
      return found;
    },

    listDependencies(workspaceId, filter): TaskDependency[] {
      const rows = service.listTasks(workspaceId);
      const targets = new Map(
        rows.map((task) => [task.id, { status: task.status, title: task.title }]),
      );
      const edges: DependencyEdge[] = [];
      for (const task of rows) {
        for (const dependencyId of task.dependsOnTaskIds ?? []) {
          edges.push({ taskId: task.id, dependsOnTaskId: dependencyId });
        }
      }
      const dependencies = dependencyStates(edges, targets);
      if (filter?.goalId === undefined) return dependencies;
      const underGoal = new Set(
        rows.filter((task) => task.goalId === filter.goalId).map((task) => task.id),
      );
      return dependencies.filter((dependency) => underGoal.has(dependency.taskId));
    },

    goalRollup(goalId): GoalRollup {
      const goal = service.getGoal(goalId);
      const underGoal = service.listTasks(goal.workspaceId, goalId);
      const dependencies = service.listDependencies(goal.workspaceId, { goalId });
      return rollupGoal(goal.id, underGoal, dependencies);
    },

    listGoalRollups(workspaceId): GoalRollup[] {
      return service.listGoals(workspaceId).map((goal) => service.goalRollup(goal.id));
    },

    goalView(goalId): GoalView {
      const goal = service.getGoal(goalId);
      const underGoal = service.listTasks(goal.workspaceId, goalId);
      const dependencies = service.listDependencies(goal.workspaceId, { goalId });
      return {
        goal,
        rollup: rollupGoal(goal.id, underGoal, dependencies),
        tasks: underGoal,
        dependencies,
      };
    },
  };

  return service;
}
