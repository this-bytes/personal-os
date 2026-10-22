import type { GoalRollup, TaskDependency, TaskStatus } from '@personal-os/contracts';

/**
 * The dependency graph of the factory, as pure functions.
 *
 * The graph is a set of edges, and an edge points from the task that waits
 * to the task it waits on. Everything here is a function of that set: which
 * edges close a loop, what each edge is waiting for, and how a goal's work
 * counts. None of it touches the database, so it can be reasoned about on
 * its own.
 */

/** One edge of the graph: this task waits on that task. */
export interface DependencyEdge {
  /** The task that is waiting. */
  taskId: string;
  /** The task it waits on. */
  dependsOnTaskId: string;
}

/** What is known about a task an edge points at. */
export interface DependencyTarget {
  /** The status the task is in. */
  status: TaskStatus;
  /** What the task is called, so the board can name it. */
  title: string;
}

/** The tasks the edges point at, by id. */
export type DependencyTargets = ReadonlyMap<string, DependencyTarget>;

/**
 * Whether making `taskId` wait on `dependsOnTaskId` would close a loop.
 *
 * A task must never wait on itself, directly or through a chain: the work
 * would be waiting for work that is waiting for it, and nothing would ever
 * move again.
 */
export function wouldCreateCycle(
  edges: readonly DependencyEdge[],
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true;

  // The edges point from the waiting task to the task it waits on, so the
  // walk follows what a task waits on. If the task being waited on waits on
  // the waiting task — directly or through a chain — the new edge closes it.
  const waitsOn = new Map<string, string[]>();
  for (const edge of edges) {
    const list = waitsOn.get(edge.taskId);
    if (list) list.push(edge.dependsOnTaskId);
    else waitsOn.set(edge.taskId, [edge.dependsOnTaskId]);
  }

  const seen = new Set<string>();
  const stack: string[] = [dependsOnTaskId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of waitsOn.get(current) ?? []) stack.push(next);
  }
  return false;
}

/**
 * The edges, with what each one waits on and whether that is out of the way.
 *
 * A task that is done, or cancelled, is out of the way: whatever waited on
 * it can move. Anything else leaves the waiting task waiting.
 */
export function dependencyStates(
  edges: readonly DependencyEdge[],
  targets: DependencyTargets,
): TaskDependency[] {
  return edges.map((edge) => {
    const target = targets.get(edge.dependsOnTaskId);
    const status = target?.status ?? 'unknown';
    return {
      taskId: edge.taskId,
      dependsOnTaskId: edge.dependsOnTaskId,
      dependsOnTitle: target?.title ?? '',
      dependsOnStatus: status,
      satisfied: status === 'done' || status === 'cancelled',
    };
  });
}

/** A task, as the rollup counts it. */
export interface RollupTask {
  id: string;
  status: TaskStatus;
}

/**
 * The counts of a goal's work.
 *
 * A count is a count: the work is measured by how many tasks there are in
 * each status, and a share is only shown when there is something to divide
 * by. The tasks that wait on the owner are counted apart from the tasks
 * that are merely under way.
 */
export function rollupGoal(
  goalId: string,
  tasks: readonly RollupTask[],
  dependencies: readonly TaskDependency[],
): GoalRollup {
  const byStatus: GoalRollup['byStatus'] = {
    open: 0,
    active: 0,
    blocked: 0,
    review: 0,
    done: 0,
    cancelled: 0,
    unknown: 0,
  };
  for (const task of tasks) byStatus[task.status] += 1;

  const waiting = new Set<string>();
  for (const dependency of dependencies) {
    if (!dependency.satisfied) waiting.add(dependency.taskId);
  }

  return {
    goalId,
    total: tasks.length,
    // A task in review is waiting for an acceptance decision, and a task
    // whose outcome could not be confirmed is waiting for the owner to say
    // what happened. Both are the owner's to move.
    waitingOnOwner: byStatus.review + byStatus.unknown,
    waitingOnDependency: tasks.filter((task) => waiting.has(task.id)).length,
    byStatus,
  };
}
