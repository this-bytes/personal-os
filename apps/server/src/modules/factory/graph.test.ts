import { describe, expect, it } from 'vitest';
import { dependencyStates, rollupGoal, wouldCreateCycle } from './graph.js';

/**
 * The dependency graph, on its own.
 *
 * These are the rules the factory keeps about the shape of the work, and
 * none of them needs a database to hold: a task that waits on itself, a
 * chain that closes on itself, what an edge is waiting for, and how a goal's
 * work counts.
 */

const CHAIN = [
  { taskId: 'tsk_a', dependsOnTaskId: 'tsk_b' },
  { taskId: 'tsk_b', dependsOnTaskId: 'tsk_c' },
];

describe('closing a loop', () => {
  it('refuses a task that waits on itself', () => {
    expect(wouldCreateCycle([], 'tsk_a', 'tsk_a')).toBe(true);
  });

  it('refuses two tasks that wait on each other', () => {
    expect(wouldCreateCycle(CHAIN, 'tsk_c', 'tsk_a')).toBe(true);
  });

  it('refuses a chain that closes on itself', () => {
    // a waits on b, b waits on c: c may not wait on a, or the three of them
    // would wait for each other and none of them would ever move.
    expect(wouldCreateCycle(CHAIN, 'tsk_c', 'tsk_a')).toBe(true);
  });

  it('refuses a loop that runs the other way round the chain', () => {
    const edges = [
      { taskId: 'tsk_b', dependsOnTaskId: 'tsk_a' },
      { taskId: 'tsk_c', dependsOnTaskId: 'tsk_b' },
    ];
    expect(wouldCreateCycle(edges, 'tsk_a', 'tsk_c')).toBe(true);
  });

  it('allows a wait that does not close a loop', () => {
    expect(wouldCreateCycle(CHAIN, 'tsk_d', 'tsk_a')).toBe(false);
    expect(wouldCreateCycle(CHAIN, 'tsk_d', 'tsk_c')).toBe(false);
    expect(wouldCreateCycle(CHAIN, 'tsk_a', 'tsk_b')).toBe(false);
  });
});

describe('what an edge is waiting for', () => {
  it('names the task it waits on, and says the wait is over when it is done', () => {
    const states = dependencyStates(
      [{ taskId: 'tsk_b', dependsOnTaskId: 'tsk_a' }],
      new Map([['tsk_a', { status: 'done', title: 'The first task' }]]),
    );

    expect(states).toEqual([
      {
        taskId: 'tsk_b',
        dependsOnTaskId: 'tsk_a',
        dependsOnTitle: 'The first task',
        dependsOnStatus: 'done',
        satisfied: true,
      },
    ]);
  });

  it('leaves the wait open while the task it waits on is under way', () => {
    const states = dependencyStates(
      [{ taskId: 'tsk_b', dependsOnTaskId: 'tsk_a' }],
      new Map([['tsk_a', { status: 'active', title: 'The first task' }]]),
    );

    expect(states[0]?.satisfied).toBe(false);
    expect(states[0]?.dependsOnStatus).toBe('active');
  });

  it('treats a cancelled task as out of the way', () => {
    const states = dependencyStates(
      [{ taskId: 'tsk_b', dependsOnTaskId: 'tsk_a' }],
      new Map([['tsk_a', { status: 'cancelled', title: 'The first task' }]]),
    );

    expect(states[0]?.satisfied).toBe(true);
  });

  it('leaves the wait open when the task it waits on cannot be found', () => {
    const states = dependencyStates([{ taskId: 'tsk_b', dependsOnTaskId: 'tsk_gone' }], new Map());

    expect(states[0]?.satisfied).toBe(false);
    expect(states[0]?.dependsOnTitle).toBe('');
  });
});

describe('counting the work under a goal', () => {
  it('counts the tasks by status, and the ones waiting on the owner apart', () => {
    const rollup = rollupGoal(
      'gol_1',
      [
        { id: 'tsk_1', status: 'open' },
        { id: 'tsk_2', status: 'review' },
        { id: 'tsk_3', status: 'done' },
        { id: 'tsk_4', status: 'unknown' },
      ],
      [],
    );

    expect(rollup.goalId).toBe('gol_1');
    expect(rollup.total).toBe(4);
    expect(rollup.byStatus.open).toBe(1);
    expect(rollup.byStatus.review).toBe(1);
    expect(rollup.byStatus.done).toBe(1);
    expect(rollup.byStatus.unknown).toBe(1);
    // A task in review waits for an acceptance decision and a task whose
    // outcome is unknown waits for the owner to say what happened.
    expect(rollup.waitingOnOwner).toBe(2);
    expect(rollup.waitingOnDependency).toBe(0);
  });

  it('counts the tasks that wait on a task that is not out of the way', () => {
    const rollup = rollupGoal(
      'gol_1',
      [
        { id: 'tsk_1', status: 'open' },
        { id: 'tsk_2', status: 'open' },
        { id: 'tsk_3', status: 'open' },
      ],
      [
        {
          taskId: 'tsk_1',
          dependsOnTaskId: 'tsk_2',
          dependsOnTitle: 'The second task',
          dependsOnStatus: 'open',
          satisfied: false,
        },
        {
          taskId: 'tsk_2',
          dependsOnTaskId: 'tsk_3',
          dependsOnTitle: 'The third task',
          dependsOnStatus: 'done',
          satisfied: true,
        },
      ],
    );

    expect(rollup.waitingOnDependency).toBe(1);
  });

  it('publishes counts, and never a ratio', () => {
    const rollup = rollupGoal('gol_1', [{ id: 'tsk_1', status: 'open' }], []);

    expect(Object.keys(rollup).sort()).toEqual([
      'byStatus',
      'goalId',
      'total',
      'waitingOnDependency',
      'waitingOnOwner',
    ]);
    for (const value of Object.values(rollup)) {
      if (typeof value === 'number') expect(Number.isInteger(value)).toBe(true);
    }
  });
});
