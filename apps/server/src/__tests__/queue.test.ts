import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { automations, automationRuns, executions, queueJobs, tasks } from '../db/schema.js';
import { decideStaleJob } from '../queue/reconciliation.js';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

/** Age the lease on a running job, so it looks as if the worker died holding it. */
function ageTheLease(id: string): void {
  stack!.handle.db
    .update(queueJobs)
    .set({ lockedAt: new Date(Date.now() - 10 * 60_000).toISOString() })
    .where(eq(queueJobs.id, id))
    .run();
}

/** The row of a job, as it stands. */
function jobRow(id: string): typeof queueJobs.$inferSelect {
  return stack!.handle.db.select().from(queueJobs).where(eq(queueJobs.id, id)).get()!;
}

/** An execution in the state a turn is in at a given moment. */
function execution(status: string, startedAt: string | null): string {
  const id = 'exe_test';
  stack!.handle.db
    .insert(executions)
    .values({
      id,
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'conn_1',
      executionOwner: 'personal-os',
      status: status as never,
      error: null,
      committedRevision: null,
      idempotencyKey: null,
      correlationId: null,
      capabilityView: null,
      spendUnits: 0,
      startedAt,
      finishedAt: null,
      createdAt: new Date().toISOString(),
    })
    .run();
  return id;
}

describe('the SQLite queue', () => {
  it('claims a queued job exactly once', () => {
    stack = createTestStack();
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { conversationId: 'cnv_1' },
    });

    const first = stack.queue.claimNext('worker-a');
    const second = stack.queue.claimNext('worker-b');

    expect(first).not.toBeNull();
    expect(first?.status).toBe('running');
    expect(first?.lockedBy).toBe('worker-a');
    expect(second).toBeNull();
  });

  it('returns null when there is nothing to do', () => {
    stack = createTestStack();
    expect(stack.queue.claimNext('worker-a')).toBeNull();
  });

  it('does not claim a job before its run time', () => {
    stack = createTestStack();
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      runAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(stack.queue.claimNext('worker-a')).toBeNull();
  });

  it('requeues a failed job while attempts remain', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 3,
    });

    stack.queue.claimNext('worker-a');
    expect(stack.queue.fail(job.id, 'worker-a', 'boom', 0)).toBe(true);

    const requeued = stack.queue.claimNext('worker-b');
    expect(requeued?.id).toBe(job.id);
    expect(requeued?.attempts).toBe(2);
  });

  it('backs off before retrying a failed job', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 3,
    });

    stack.queue.claimNext('worker-a');
    stack.queue.fail(job.id, 'worker-a', 'boom');

    // The default retry delay keeps the job out of reach for now.
    expect(stack.queue.claimNext('worker-b')).toBeNull();
  });

  it('gives up after the last attempt', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 1,
    });

    stack.queue.claimNext('worker-a');
    stack.queue.fail(job.id, 'worker-a', 'boom');

    expect(stack.queue.claimNext('worker-b')).toBeNull();
  });

  it('lists the jobs whose worker died', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    expect(stack.queue.staleRunningJobs().map((row) => row.id)).toEqual([job!.id]);
  });

  it('keeps a job whose lease is still fresh', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    stack.queue.claimNext('worker-a');

    expect(stack.queue.staleRunningJobs()).toHaveLength(0);
  });

  it('refreshes the lease on a running job', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    stack.queue.heartbeat(job!.id, 'worker-a');

    // A refreshed lease is not stale, so the job is not listed.
    expect(stack.queue.staleRunningJobs()).toHaveLength(0);
  });
});

describe('a stale worker cannot write to a job that is not its own', () => {
  it('refuses to finish a job whose lease moved on', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');

    // The lease moves on: another worker takes the job over.
    stack.handle.db
      .update(queueJobs)
      .set({ lockedBy: 'worker-b' })
      .where(eq(queueJobs.id, job!.id))
      .run();

    expect(stack.queue.complete(job!.id, 'worker-a')).toBe(false);
    expect(jobRow(job!.id).status).toBe('running');
  });

  it('refuses to fail a job whose lease moved on', () => {
    stack = createTestStack();
    const job = stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {},
      maxAttempts: 1,
    });
    stack.queue.claimNext('worker-a');

    stack.handle.db
      .update(queueJobs)
      .set({ lockedBy: 'worker-b' })
      .where(eq(queueJobs.id, job.id))
      .run();

    expect(stack.queue.fail(job.id, 'worker-a', 'boom')).toBe(false);
    expect(jobRow(job.id).status).toBe('running');
  });

  it('refuses to hold a job whose lease moved on', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');

    stack.handle.db
      .update(queueJobs)
      .set({ lockedBy: 'worker-b' })
      .where(eq(queueJobs.id, job!.id))
      .run();

    expect(stack.queue.hold(job!.id, 'worker-a', 'The outcome could not be confirmed.')).toBe(
      false,
    );
    expect(jobRow(job!.id).status).toBe('running');
  });

  it('writes when the lease is its own', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');

    expect(stack.queue.complete(job!.id, 'worker-a')).toBe(true);
    expect(jobRow(job!.id).status).toBe('done');
  });
});

describe('the stale-job rule', () => {
  it('runs a job again when the run had not started', () => {
    stack = createTestStack();
    const executionId = execution('queued', null);
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    expect(decision.kind).toBe('requeue');

    expect(stack.queue.applyStaleDecision(job!, decision)).toBe(true);
    expect(jobRow(job!.id).status).toBe('queued');

    // And another worker may pick it up.
    expect(stack.queue.claimNext('worker-b')?.id).toBe(job!.id);
  });

  it('does not run a job again when the run had started', () => {
    stack = createTestStack();
    const executionId = execution('running', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    expect(decision.kind).toBe('reconcile');
  });

  it('holds a job whose outcome was already unknown', () => {
    stack = createTestStack();
    const executionId = execution('unknown', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    expect(decision.kind).toBe('hold');

    expect(stack.queue.applyStaleDecision(job!, decision)).toBe(true);
    expect(jobRow(job!.id).status).toBe('unknown');
    expect(stack.queue.claimNext('worker-b')).toBeNull();
  });

  it('finishes a job whose work was already done', () => {
    stack = createTestStack();
    const executionId = execution('completed', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    expect(decision.kind).toBe('complete');

    expect(stack.queue.applyStaleDecision(job!, decision)).toBe(true);
    expect(jobRow(job!.id).status).toBe('done');
  });

  it('holds a job whose item the product cannot read', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    expect(stack.queue.decideFor(job!).kind).toBe('hold');
  });

  it('never moves a job that is not running any more', () => {
    stack = createTestStack();
    stack.queue.enqueue({ workspaceId: 'wsp_1', type: 'chat.turn', payload: {} });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    // Somebody else settled it first.
    stack.handle.db
      .update(queueJobs)
      .set({ status: 'unknown', lockedBy: null })
      .where(eq(queueJobs.id, job!.id))
      .run();

    const decision = stack.queue.decideFor(job!);
    expect(stack.queue.applyStaleDecision(job!, decision)).toBe(false);
    expect(jobRow(job!.id).status).toBe('unknown');
  });
});

describe('the rule on its own', () => {
  it('runs the work again only when it knows the work never ran', () => {
    expect(decideStaleJob({ kind: 'not-started' }).kind).toBe('requeue');
    expect(decideStaleJob({ kind: 'started' }).kind).toBe('reconcile');
    expect(decideStaleJob({ kind: 'unknown' }).kind).toBe('hold');
    expect(decideStaleJob({ kind: 'settled' }).kind).toBe('complete');
    expect(decideStaleJob({ kind: 'none' }).kind).toBe('hold');
  });

  it('says why, in every case', () => {
    for (const item of [
      { kind: 'not-started' },
      { kind: 'started' },
      { kind: 'unknown' },
      { kind: 'settled' },
      { kind: 'none' },
    ] as const) {
      expect(decideStaleJob(item).reason.length).toBeGreaterThan(20);
    }
  });
});

describe('an automation’s run', () => {
  /** An automation the scheduler could have queued. */
  function seedAutomation(id: string): void {
    stack!.handle.db
      .insert(automations)
      .values({
        id,
        workspaceId: 'wsp_1',
        title: 'A nightly report',
        trigger: { type: 'schedule', everyMinutes: 60 },
        action: { type: 'resource.refresh', resourceId: 'res_1', method: 'GET' },
        enabled: true,
        nextRunAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
  }

  /** A run of that automation, in the state it is in. */
  function seedRun(id: string, automationId: string, status: string): void {
    stack!.handle.db
      .insert(automationRuns)
      .values({
        id,
        automationId,
        status,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        output: null,
        error: null,
      })
      .run();
  }

  it('is not run again when the run had started', () => {
    stack = createTestStack();
    seedAutomation('aut_1');
    seedRun('run_1', 'aut_1', 'running');
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1', runId: 'run_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    expect(stack.queue.decideFor(job!).kind).toBe('reconcile');
  });

  it('is run again when the run had not started', () => {
    stack = createTestStack();
    seedAutomation('aut_1');
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1', runId: 'run_never' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    expect(decision.kind).toBe('requeue');

    expect(stack.queue.applyStaleDecision(job!, decision)).toBe(true);
    expect(stack.queue.claimNext('worker-b')?.id).toBe(job!.id);
  });

  it('is held when the job does not say which run it is', () => {
    stack = createTestStack();
    seedAutomation('aut_1');
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    // Knowing nothing about the run is not a reason to run it again.
    expect(stack.queue.decideFor(job!).kind).toBe('hold');
  });

  it('is finished when its run had already finished', () => {
    stack = createTestStack();
    seedAutomation('aut_1');
    seedRun('run_1', 'aut_1', 'completed');
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1', runId: 'run_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    expect(stack.queue.decideFor(job!).kind).toBe('complete');
  });
});

describe('a task’s turn', () => {
  /** A task whose agent turn is the run the job is working on. */
  function seedTask(id: string, status: string): void {
    stack!.handle.db
      .insert(tasks)
      .values({
        id,
        workspaceId: 'wsp_1',
        goalId: null,
        title: 'A task',
        description: '',
        assigneeId: null,
        status,
        acceptanceCriteria: [],
        evidenceResourceIds: [],
        dependsOnTaskIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
  }

  /** The execution of that task's turn. */
  function seedTaskExecution(id: string, taskId: string, status: string, startedAt: string | null) {
    stack!.handle.db
      .insert(executions)
      .values({
        id,
        workspaceId: 'wsp_1',
        conversationId: null,
        taskId,
        externalRef: null,
        agentConnectionId: 'conn_1',
        executionOwner: 'personal-os',
        status: status as never,
        error: null,
        committedRevision: null,
        idempotencyKey: null,
        correlationId: null,
        capabilityView: null,
        spendUnits: 0,
        startedAt,
        finishedAt: null,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  it('is not run again when its turn had started', () => {
    stack = createTestStack();
    seedTask('tsk_1', 'open');
    seedTaskExecution('exe_task', 'tsk_1', 'running', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    // A task stays open for the whole of its turn, so the execution is what
    // says the turn had started.
    expect(stack.queue.decideFor(job!).kind).toBe('reconcile');
  });

  it('is run again when its turn had not started', () => {
    stack = createTestStack();
    seedTask('tsk_1', 'open');
    seedTaskExecution('exe_task', 'tsk_1', 'queued', null);
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    expect(stack.queue.decideFor(job!).kind).toBe('requeue');
  });
});

describe('a held job, settled by the owner', () => {
  it('is settled when the owner settles the turn', () => {
    stack = createTestStack();
    const executionId = execution('unknown', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);

    const decision = stack.queue.decideFor(job!);
    stack.queue.applyStaleDecision(job!, decision);
    expect(jobRow(job!.id).status).toBe('unknown');

    expect(stack.queue.settleHeldJob(executionId, 'The owner settled this turn.')).toBe(true);
    expect(jobRow(job!.id).status).toBe('done');
  });

  it('is not settled twice', () => {
    stack = createTestStack();
    const executionId = execution('unknown', new Date().toISOString());
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: { executionId },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);
    stack.queue.applyStaleDecision(job!, stack.queue.decideFor(job!));

    expect(stack.queue.settleHeldJob(executionId, 'The owner settled this turn.')).toBe(true);
    expect(stack.queue.settleHeldJob(executionId, 'The owner settled this turn.')).toBe(false);
  });

  it('is settled when the owner accepts the task whose turn it was', () => {
    stack = createTestStack();
    const executionId = execution('unknown', new Date().toISOString());
    // The payload is the one the product enqueues for a task's turn: the task,
    // the turn and the agent the turn is for. A job of another shape would
    // prove nothing about the branch the product takes.
    stack.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1', executionId, agentConnectionId: 'agt_1' },
    });
    const job = stack.queue.claimNext('worker-a');
    ageTheLease(job!.id);
    stack.queue.applyStaleDecision(job!, stack.queue.decideFor(job!));
    expect(jobRow(job!.id).status).toBe('unknown');

    expect(stack.queue.settleHeldJob(executionId, 'The owner settled this task.')).toBe(true);
    expect(jobRow(job!.id).status).toBe('done');
  });
});
