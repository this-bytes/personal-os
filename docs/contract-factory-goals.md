# Contract notes — goals, task dependencies and progress

**Work item:** WI-143. **Branch:** `wi/143-factory-goals`. **Status:** implemented,
awaiting integration.

These are the notes for `CONTRACTS.md`. Nothing here changes a published
contract: every existing field, status and route keeps the meaning it has, and
what follows is additive — new shapes, new reads, and one existing route that
takes one more field.

---

## 1. What the owner can now do

- Open a goal and see the work under it: its tasks, what is blocked, what is
  waiting for acceptance, and what is done.
- See that a task waits on another task, and have the board say so instead of
  calling a waiting task simply _open_.
- See the shape of a goal as counts — how many tasks, how many done, how many
  blocked, how many waiting on the owner — never as a ratio.

The acceptance rule is untouched: a task moves to `review`, never straight to
`done`. Only `POST /api/tasks/:id/accept` closes a task, and a rejection sends
the work back with the reason.

---

## 2. New published shapes

All three are in `packages/contracts/src/factory.ts` and are exported from
`@personal-os/contracts`.

### 2.1 The task carries what it waits on

`factoryTaskSchema` gains one field. It is optional, so every existing task
reads back as a task that waits on nothing — which is what the tasks that
predate the column recorded — and every existing caller is unaffected. The
server always answers with the list it holds.

```ts
export const factoryTaskSchema = z.object({
  // ...every existing field, unchanged...
  /** The tasks this task waits on. A task never waits on itself. */
  dependsOnTaskIds: z.array(idSchema).optional(),
});
```

The direction is the task that waits to the task it waits on. A task must
never wait on itself, directly or through a chain: the work would be waiting
for work that is waiting for it, and nothing would ever move again. A write
that would close such a loop is refused with `bad_request` and the graph is
left as it was.

### 2.2 The dependency edge

```ts
export const taskDependencySchema = z.object({
  /** The task that is waiting. */
  taskId: idSchema,
  /** The task it waits on. */
  dependsOnTaskId: idSchema,
  /** What the waited-on task is called, so the board can name it. */
  dependsOnTitle: z.string(),
  /** The status the waited-on task is in. */
  dependsOnStatus: taskStatusSchema,
  /**
   * Whether the waited-on task is out of the way: done, or cancelled.
   */
  satisfied: z.boolean(),
});
export type TaskDependency = z.infer<typeof taskDependencySchema>;
```

`dependsOnTitle` is carried on the edge so a board can name the task it is
waiting for without a second read. `satisfied` is true when the waited-on task
is `done` or `cancelled`: both are out of the way, so whatever waited on it
can move.

### 2.3 The goal rollup — counts, never a ratio

```ts
export const goalRollupSchema = z.object({
  goalId: idSchema,
  /** How many tasks the goal holds. */
  total: z.number().int().min(0),
  /** How many of them are waiting on the owner: in review, or unknown. */
  waitingOnOwner: z.number().int().min(0),
  /** How many of them are waiting on a task that is not out of the way yet. */
  waitingOnDependency: z.number().int().min(0),
  /** How many of them there are in each status. */
  byStatus: z.object({
    open: z.number().int().min(0),
    active: z.number().int().min(0),
    blocked: z.number().int().min(0),
    review: z.number().int().min(0),
    done: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    unknown: z.number().int().min(0),
  }),
});
export type GoalRollup = z.infer<typeof goalRollupSchema>;
```

A counter is a count and never a ratio: the band says how many, and a share is
only shown when there is something to divide by. The work waiting on the owner
is counted apart from the work merely under way — a task in `review` waits for
an acceptance decision, and a task whose outcome could not be confirmed waits
for the owner to say what happened.

### 2.4 The goal view

```ts
export const goalViewSchema = z.object({
  goal: goalSchema,
  rollup: goalRollupSchema,
  tasks: z.array(factoryTaskSchema),
  dependencies: z.array(taskDependencySchema),
});
export type GoalView = z.infer<typeof goalViewSchema>;
```

---

## 3. New routes

Three new reads. All three require the session (`requireAuth`), and all three
answer with the shared error envelope.

| Method | Path                      | Answers                                                    |
| ------ | ------------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/goals/overview`     | `{ goals, rollups }` — the goals and the counts under each |
| `GET`  | `/api/goals/:id/view`     | the goal view: goal, rollup, tasks and dependencies        |
| `GET`  | `/api/tasks/dependencies` | `{ dependencies }` — what the workspace's tasks wait on    |

`GET /api/goals/overview` takes `workspaceId`. `GET /api/tasks/dependencies`
takes `workspaceId` and an optional `goalId`, which narrows the edges to the
tasks under that goal — the edge still points at the task it waits on, which
may live under another goal.

These are reads, so the published count of mutating routes does not move: it
is still thirty-seven, and thirty-four of them still write an audit entry at
the route level.

---

## 4. One existing route takes one more field

`PATCH /api/tasks/:id` accepts `dependsOnTaskIds`:

```ts
const updateTaskSchema = z.object({
  // ...every existing field, unchanged...
  dependsOnTaskIds: z.array(z.string()).optional(),
});
```

The list replaces the task's dependencies. A dependency on a task that does
not exist is refused with `not_found`; a dependency that would close a loop is
refused with `bad_request`. The task's revision moves with the change, so the
existing `expectedRevision` guard applies to it as it does to every other
field.

`updateTask` in the factory service takes the same field, and `createTask`
takes none: a task waits on nothing when it is made.

---

## 5. The service, additively

`FactoryService` keeps every method it had, with the same signature and the
same behaviour, and gains:

| Method                                   | Answers                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `listTasksWhere(workspaceId, filter?)`   | the tasks, narrowed by goal, status or dependency state |
| `listDependencies(workspaceId, filter?)` | the edges, with what each one waits for                 |
| `goalRollup(goalId)`                     | the counts of one goal's work                           |
| `listGoalRollups(workspaceId)`           | the counts of every goal's work                         |
| `goalView(goalId)`                       | the goal, its work, its dependencies and its shape      |

The dependency rules and the rollup are pure functions in
`apps/server/src/modules/factory/graph.ts`, and are tested without a
database.

---

## 6. The migration

`0011_nice_leopardon.sql` adds one column and drops nothing:

```sql
ALTER TABLE `tasks` ADD `depends_on_task_ids` text;
```

The column is nullable, and the rows that predate it read back as a task that
waits on nothing — which is what they recorded, because the column did not
exist. No row is rewritten and no data is dropped. The generated snapshot is
committed with the SQL.

---

## 7. The client

- `GET /api/goals/overview` replaces `GET /api/goals` in the factory page.
- The factory page is goal-oriented: the goals are the rail on the left, and
  selecting one shows the work under it. _All work_ is still there, and it is
  what the page opens on, so the existing board is unchanged for anyone who
  does not pick a goal.
- A task that waits on a task that is not out of the way wears a caution badge
  with an icon — a notice, not a failure. A finished task wears no accent.
- The counts of the selected goal are the `CounterBand` primitive, with the
  accent only on the counter that is waiting on the owner, and only when that
  count is above zero.

---

## 8. What did not change

- The task statuses, and what they mean.
- The acceptance rule, and the routes that carry it.
- The `GET /api/goals` and `GET /api/tasks` routes, which keep their shape.
- The number of mutating routes.

## 9. The limits of this slice

Stated plainly, so that nothing here is read as more than it is.

- **Dependencies are set after the task exists.** `POST /api/tasks` does not
  take `dependsOnTaskIds`: a task is made, and then it is told what it waits
  on. The board's _Waits on_ control is where that happens.
- **The picker offers the tasks in view.** In _All work_ it offers every task
  in the workspace; in a goal's view it offers the tasks under that goal. A
  wait on a task in another goal is still shown and can still be removed — it
  just cannot be picked from inside the other goal's view.
- **The wait is a fact about the work, not a rule.** A task that waits on a
  task that is not out of the way is shown as waiting; nothing stops an agent
  from being handed it anyway. The board says what is true, and the owner
  decides.
- **The counts are of the tasks, not of the effort.** A goal's rollup counts
  tasks by status. It does not weigh them, and it never shows a share.
- **A goal's shape is read at the moment it is asked for.** There is no
  stored progress figure, so nothing can drift out of date.
- **Only the tasks under a goal are in that goal's view.** A dependency may
  point at a task under another goal; the edge is shown, and the task it
  waits on is named, but it is not counted in the other goal's total.
- **The board's wait list comes from the server's read**, not from the card's
  copy of the task, so a task patched by an event cannot quietly lose the
  waits it has.
