import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { tasks } from '../db/schema.js';
import { createTestStack, type TestStack } from './helpers.js';

/**
 * The goals, the work under them, and the waits between the work.
 *
 * A goal is the organising structure of the factory: the tasks belong to it,
 * the dependencies say what the work is waiting for, and the rollup says how
 * much of it there is. These tests hold the service to that, and then hold
 * the routes to the same thing over HTTP.
 */

let stack: TestStack;
let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

/** The workspace the service tests write to. */
const SERVICE_WORKSPACE = 'ws_service';

beforeAll(async () => {
  stack = createTestStack();

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-factory-goals-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'factory-goals-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const setup = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setup.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  const body = workspaces.json().workspaces as Array<{ id: string }>;
  workspaceId = body[0]?.id ?? '';
});

afterAll(async () => {
  await app.close();
  stack.close();
});

/** A task written through the service. */
function serviceTask(title: string, goalId?: string): string {
  return stack.factory.createTask({
    workspaceId: SERVICE_WORKSPACE,
    title,
    ...(goalId ? { goalId } : {}),
    author: { kind: 'owner', userId: 'usr_1' },
  }).id;
}

describe('the factory service', () => {
  it('counts the work under a goal, and the work waiting on the owner apart', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'Ship the thing',
    });
    serviceTask('The first task', goal.id);
    const second = serviceTask('The second task', goal.id);
    stack.factory.updateTask(second, { status: 'review' });

    const rollup = stack.factory.goalRollup(goal.id);

    expect(rollup.goalId).toBe(goal.id);
    expect(rollup.total).toBe(2);
    expect(rollup.byStatus.open).toBe(1);
    expect(rollup.byStatus.review).toBe(1);
    expect(rollup.waitingOnOwner).toBe(1);
  });

  it('shows a goal with the work under it and the shape of that work', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'A goal with a shape',
    });
    const first = serviceTask('Wait for this', goal.id);
    const second = serviceTask('Wait on that', goal.id);
    stack.factory.updateTask(second, { dependsOnTaskIds: [first] });

    const view = stack.factory.goalView(goal.id);

    expect(view.goal.id).toBe(goal.id);
    expect(view.tasks.map((task) => task.id).sort()).toEqual([first, second].sort());
    expect(view.dependencies).toHaveLength(1);
    expect(view.dependencies[0]).toMatchObject({
      taskId: second,
      dependsOnTaskId: first,
      dependsOnTitle: 'Wait for this',
      dependsOnStatus: 'open',
      satisfied: false,
    });
    expect(view.rollup.total).toBe(2);
    expect(view.rollup.waitingOnDependency).toBe(1);
  });

  it('says a wait is over once the task it waits on is done', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'A goal that closes',
    });
    const first = serviceTask('The first task', goal.id);
    const second = serviceTask('The second task', goal.id);
    stack.factory.updateTask(second, { dependsOnTaskIds: [first] });
    stack.factory.acceptTask(first, { satisfied: true, acceptedBy: 'usr_1' });

    const dependencies = stack.factory.listDependencies(SERVICE_WORKSPACE);
    const dependency = dependencies.find((entry) => entry.taskId === second);

    expect(dependency?.dependsOnStatus).toBe('done');
    expect(dependency?.satisfied).toBe(true);
  });

  it('refuses a task that waits on itself', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'A goal with a loop',
    });
    const task = serviceTask('Waits on itself', goal.id);

    expect(() => stack.factory.updateTask(task, { dependsOnTaskIds: [task] })).toThrowError(
      /cannot wait on itself/,
    );
  });

  it('refuses a chain that closes on itself', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'Another goal with a loop',
    });
    const first = serviceTask('The first task', goal.id);
    const second = serviceTask('The second task', goal.id);
    const third = serviceTask('The third task', goal.id);
    stack.factory.updateTask(second, { dependsOnTaskIds: [first] });
    stack.factory.updateTask(third, { dependsOnTaskIds: [second] });

    expect(() => stack.factory.updateTask(first, { dependsOnTaskIds: [third] })).toThrowError(
      /would be a loop/,
    );
  });

  it('refuses a wait on a task that does not exist', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'A goal with a missing wait',
    });
    const task = serviceTask('Waits on nothing', goal.id);

    expect(() =>
      stack.factory.updateTask(task, { dependsOnTaskIds: ['tsk_not_there'] }),
    ).toThrowError(/not found/);
  });

  it('reads a task that predates the dependency column as one that waits on nothing', () => {
    const goal = stack.factory.createGoal({
      workspaceId: SERVICE_WORKSPACE,
      title: 'A goal from before',
    });
    const now = new Date().toISOString();

    // The row a database held before the column existed: after the
    // migration it is a row with nothing in the new column.
    stack.handle.db
      .insert(tasks)
      .values({
        id: 'tsk_before_the_column',
        workspaceId: SERVICE_WORKSPACE,
        goalId: goal.id,
        title: 'A task from before the dependency column',
        description: '',
        assigneeId: null,
        executionOwner: 'personal-os',
        status: 'open',
        revision: 1,
        acceptanceCriteria: [],
        evidenceResourceIds: [],
        createdBy: 'owner',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const task = stack.factory.getTask('tsk_before_the_column');
    expect(task.dependsOnTaskIds).toEqual([]);
    expect(task.title).toBe('A task from before the dependency column');

    const rollup = stack.factory.goalRollup(goal.id);
    expect(rollup.total).toBe(1);
    expect(rollup.waitingOnDependency).toBe(0);
  });
});

/** A goal written through the API. */
async function createGoal(title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/goals',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json().goal.id as string;
}

/** A task written through the API. */
async function createTask(title: string, goalId?: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title, ...(goalId ? { goalId } : {}) },
  });
  expect(response.statusCode).toBe(201);
  return response.json().task.id as string;
}

describe('the factory routes', () => {
  it('gives the goals and the counts of the work under them', async () => {
    const goalId = await createGoal('A goal on the board');
    await createTask('A task under the goal', goalId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/goals/overview?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      goals: Array<{ id: string }>;
      rollups: Array<{ goalId: string; total: number; waitingOnOwner: number }>;
    };
    const rollup = body.rollups.find((entry) => entry.goalId === goalId);
    expect(rollup?.total).toBe(1);
    expect(rollup?.waitingOnOwner).toBe(0);
    expect(body.goals.some((goal) => goal.id === goalId)).toBe(true);
  });

  it('gives one goal with the work under it and the shape of that work', async () => {
    const goalId = await createGoal('A goal to open');
    const first = await createTask('The work that comes first', goalId);
    const second = await createTask('The work that waits', goalId);

    const linked = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${second}`,
      headers: { cookie: sessionCookie },
      payload: { dependsOnTaskIds: [first] },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().task.dependsOnTaskIds).toEqual([first]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/goals/${goalId}/view`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      goal: { id: string };
      rollup: { total: number; waitingOnDependency: number };
      tasks: Array<{ id: string }>;
      dependencies: Array<{ taskId: string; dependsOnTaskId: string; satisfied: boolean }>;
    };
    expect(body.goal.id).toBe(goalId);
    expect(body.tasks).toHaveLength(2);
    expect(body.rollup.total).toBe(2);
    expect(body.rollup.waitingOnDependency).toBe(1);
    expect(body.dependencies[0]).toMatchObject({
      taskId: second,
      dependsOnTaskId: first,
      satisfied: false,
    });
  });

  it('gives what the tasks of the workspace wait on', async () => {
    const goalId = await createGoal('A goal with waits');
    const first = await createTask('The work that comes first', goalId);
    const second = await createTask('The work that waits', goalId);
    await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${second}`,
      headers: { cookie: sessionCookie },
      payload: { dependsOnTaskIds: [first] },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/dependencies?workspaceId=${workspaceId}&goalId=${goalId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      dependencies: Array<{ taskId: string; dependsOnTaskId: string }>;
    };
    const dependency = body.dependencies.find((entry) => entry.taskId === second);
    expect(dependency?.dependsOnTaskId).toBe(first);
  });

  it('refuses a wait that would close a loop', async () => {
    const goalId = await createGoal('A goal that may not loop');
    const first = await createTask('The first task', goalId);
    const second = await createTask('The second task', goalId);
    await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${second}`,
      headers: { cookie: sessionCookie },
      payload: { dependsOnTaskIds: [first] },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${first}`,
      headers: { cookie: sessionCookie },
      payload: { dependsOnTaskIds: [second] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/loop/);
  });

  it('keeps the acceptance decision where it was', async () => {
    const goalId = await createGoal('A goal that is accepted');
    const taskId = await createTask('The work to accept', goalId);
    await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: { cookie: sessionCookie },
      payload: { status: 'review' },
    });

    const refused = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: { cookie: sessionCookie },
      payload: { status: 'done' },
    });
    // The route refuses `done` outright, so an agent's report of completion
    // cannot close a task by an ordinary update.
    expect(refused.statusCode).toBe(422);

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskId}/accept`,
      headers: { cookie: sessionCookie },
      payload: { satisfied: true, reason: 'The work is done.' },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().task.status).toBe('done');
  });

  it('keeps the new reads behind the session', async () => {
    for (const url of [
      `/api/goals/overview?workspaceId=${workspaceId}`,
      '/api/tasks/dependencies?workspaceId=ws_1',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
    }
  });
});
