import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  automations,
  automationRuns,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  queueJobs,
  runMigrations,
  tasks,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  EventsService,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import type { AgentAdapter, AgentEvent, AgentTurnInput } from '@personal-os/contracts';
import { reconcileStaleJobs } from '../reconcile.js';
import { executeJob, type ExecutionOutcome, type ExecutorContext } from '../executor.js';

/**
 * A turn whose outcome could not be confirmed.
 *
 * The worker aborts a turn when the adapter's deadline passes. The agent may
 * already have had its side effect by then, so the turn is recorded as
 * `unknown` — not as `failed`, which reads as "safe to retry".
 */

/** An adapter that never answers, so the deadline is what ends the turn. */
class HangingAdapter implements AgentAdapter {
  readonly type = 'http' as const;

  /**
   * The request is made and answered within the turn, so there is no runtime
   * to establish before it. This is the adapter's own flag, and the worker
   * reads it: a double that stood in for an HTTP adapter and hid that fact
   * would be less faithful than the adapter it stands in for.
   */
  readonly holdsRuntime = false;

  async connect(): Promise<never> {
    throw new Error('not used');
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    // The turn is stopped by the deadline, and the adapter notices the
    // abort the way a real one would.
    await new Promise<void>((resolve) => {
      input.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    yield {
      type: 'execution.error',
      executionId: input.executionId,
      code: 'cancelled',
      message: 'The turn was stopped.',
    };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;

const NOW = '2026-01-01T00:00:00.000Z';

function seed(): void {
  handle.db
    .insert(conversations)
    .values({
      id: 'cnv_1',
      workspaceId: 'wsp_1',
      title: 'A conversation',
      routingMode: 'mentions',
      coordinatorId: null,
      paused: false,
      maxTurns: 8,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  handle.db
    .insert(participants)
    .values({
      id: 'p_1',
      conversationId: 'cnv_1',
      type: 'agent',
      agentConnectionId: 'agt_1',
      displayName: 'The agent',
      joinedAt: NOW,
    })
    .run();

  handle.db
    .insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'The agent',
      adapterType: 'http',
      configRef: 'cfg_1',
      toolGrants: null,
      enabled: true,
      capabilities: null,
      status: 'unknown',
      lastError: null,
      lastConnectedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  handle.db
    .insert(messages)
    .values({
      id: 'msg_parent',
      conversationId: 'cnv_1',
      senderId: 'p_1',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [{ type: 'text', text: 'Do the thing' }],
      status: 'complete',
      correlationId: null,
      origin: null,
      executionId: null,
      createdAt: NOW,
    })
    .run();

  handle.db
    .insert(executions)
    .values({
      id: 'exe_1',
      workspaceId: 'wsp_1',
      conversationId: 'cnv_1',
      taskId: null,
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();
}

beforeEach(() => {
  handle = createDatabase(':memory:');
  runMigrations(handle.db);

  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: '.',
    PERSONAL_OS_OWNER_TOKEN: 'worker-test-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    registry: {
      create: () => new HangingAdapter(),
    } as unknown as Runtime['registry'],
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    // The adapter's deadline is one second, so the turn is stopped quickly.
    resolveSecret: async () =>
      JSON.stringify({
        adapterType: 'http',
        config: { baseUrl: 'https://example.invalid', timeoutSeconds: 1 },
      }),
    close: () => handle.close(),
  };

  context = { runtime };
  seed();
});

afterEach(() => {
  handle.close();
});

describe('a turn that ran out of time', () => {
  it('is recorded as unknown, not as failed', async () => {
    const outcome = await executeJob(context, {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
      status: 'running',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: NOW,
      lockedAt: null,
      lockedBy: 'worker_1',
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(outcome.status).toBe('unknown');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('unknown');
    expect(execution?.error).toMatch(/may already have had its side effect/i);

    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status).toBe('unknown');
  });

  it('is written to the audit trail', async () => {
    await executeJob(context, {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
      status: 'running',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: NOW,
      lockedAt: null,
      lockedBy: 'worker_1',
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const entries = runtime.audit.list('wsp_1', 50);
    const entry = entries.find((item) => item.targetId === 'exe_1');

    expect(entry).toBeDefined();
    expect(entry?.action).toBe('execution.outcome.unknown');
    expect(entry?.result).toBe('unknown');
  });

  it('is a failure when nothing started at all', async () => {
    // No agent connection: the turn never began, so the outcome is known.
    handle.db.delete(agentConnections).where(eq(agentConnections.id, 'agt_1')).run();

    const outcome = await executeJob(context, {
      id: 'job_2',
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
      status: 'running',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: NOW,
      lockedAt: null,
      lockedBy: 'worker_1',
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(outcome.status).toBe('failed');

    const execution = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
    expect(execution?.status).toBe('failed');
  });
});

/**
 * A job whose outcome is unknown is held, not requeued.
 *
 * The published contract says an unknown item is never retried
 * automatically, and the retry is the dangerous part: running the work a
 * second time could repeat a side effect that already happened. So the
 * outcome the executor hands back has to be `unknown` — that is the word the
 * worker turns into a hold instead of a requeue.
 *
 * The dispatch below is the worker's own rule, copied from
 * `apps/worker/src/index.ts`, so that the test observes what the queue is
 * actually told rather than what the executor meant.
 */
function dispatchAsTheWorkerDoes(
  queue: Queue,
  outcome: ExecutionOutcome,
  jobId: string,
  workerId: string,
): void {
  if (outcome.status === 'completed' || outcome.status === 'cancelled') {
    queue.complete(jobId, workerId);
  } else if (outcome.status === 'unknown') {
    queue.hold(jobId, workerId, outcome.error ?? 'The outcome could not be confirmed.');
  } else {
    queue.fail(jobId, workerId, outcome.error ?? 'The job failed.');
  }
}

/** A task whose agent is still working when the deadline passes. */
function seedTask(): void {
  handle.db
    .insert(tasks)
    .values({
      id: 'tsk_1',
      workspaceId: 'wsp_1',
      goalId: null,
      title: 'A task that runs for too long',
      description: '',
      assigneeId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'active',
      revision: 1,
      acceptanceCriteria: [],
      evidenceResourceIds: [],
      externalRef: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  handle.db
    .insert(executions)
    .values({
      id: 'exe_task',
      workspaceId: 'wsp_1',
      conversationId: null,
      taskId: 'tsk_1',
      externalRef: null,
      agentConnectionId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();
}

/** An automation whose action is still running when the deadline passes. */
function seedAutomation(): void {
  handle.db
    .insert(automations)
    .values({
      id: 'aut_1',
      workspaceId: 'wsp_1',
      title: 'An automation that runs for too long',
      trigger: { type: 'manual' },
      action: {
        type: 'agent.prompt',
        agentConnectionId: 'agt_1',
        prompt: 'do the thing',
        method: 'GET',
      },
      revision: 1,
      enabled: false,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** The row the queue holds for a job. */
function jobRow(id: string) {
  return handle.db.select().from(queueJobs).where(eq(queueJobs.id, id)).get();
}

describe('a job whose outcome is unknown', () => {
  it('is held, and never run again, when a turn runs out of time', async () => {
    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
    });
    const job = runtime.queue.claimNext('worker_1');
    expect(job?.id).toBe(enqueued.id);

    const outcome = await executeJob(context, job!);
    dispatchAsTheWorkerDoes(runtime.queue, outcome, job!.id, 'worker_1');

    // The job is finished and it is not scheduled to run again.
    expect(jobRow(enqueued.id)?.status, 'the job was not held').toBe('unknown');
    expect(runtime.queue.claimNext('worker_2'), 'the held job was offered again').toBeNull();
  });

  it('is not run again when the worker dies before it holds the job', async () => {
    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      },
    });
    const job = runtime.queue.claimNext('worker_1');

    // The turn has started and the outcome could not be confirmed: the
    // message and the execution are recorded as unknown.
    const outcome = await executeJob(context, job!);
    expect(outcome.status).toBe('unknown');
    const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
    expect(reply?.status).toBe('unknown');

    // The worker dies here. It never got as far as holding the job, so the
    // job is still 'running' with a lease that will go stale.
    handle.db
      .update(queueJobs)
      .set({ lockedAt: '2000-01-01T00:00:00.000Z' })
      .where(eq(queueJobs.id, enqueued.id))
      .run();

    // The next worker settles the stale lease, and the rule keeps the job.
    await reconcileStaleJobs(runtime);

    expect(
      runtime.queue.claimNext('worker_2'),
      'the job was picked up again: an unknown outcome was retried',
    ).toBeNull();
  });

  it('is unknown, not failed, when a factory task runs out of time', async () => {
    seedTask();

    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1', executionId: 'exe_task', agentConnectionId: 'agt_1' },
    });
    const job = runtime.queue.claimNext('worker_1');

    const outcome = await executeJob(context, job!);

    // The task is recorded as unknown in the database, but the outcome the
    // worker acts on is the one that decides whether the job is retried.
    expect(handle.db.select().from(tasks).where(eq(tasks.id, 'tsk_1')).get()?.status).toBe(
      'unknown',
    );
    expect(outcome.status, 'the outcome was reported as a failure, not as unknown').toBe('unknown');
  });

  it('is held, not requeued, when a factory task runs out of time', async () => {
    seedTask();

    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1', executionId: 'exe_task', agentConnectionId: 'agt_1' },
    });
    const job = runtime.queue.claimNext('worker_1');

    const outcome = await executeJob(context, job!);
    dispatchAsTheWorkerDoes(runtime.queue, outcome, job!.id, 'worker_1');

    // The job is finished, and it is not scheduled to run again.
    expect(jobRow(enqueued.id)?.status, 'the job was not held').toBe('unknown');
  });

  it('is never run again when a factory task runs out of time', async () => {
    seedTask();

    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'factory.execute',
      payload: { taskId: 'tsk_1', executionId: 'exe_task', agentConnectionId: 'agt_1' },
    });
    const job = runtime.queue.claimNext('worker_1');

    const outcome = await executeJob(context, job!);
    dispatchAsTheWorkerDoes(runtime.queue, outcome, job!.id, 'worker_1');

    // When the retry window has passed, there is nothing left to pick up.
    await new Promise((resolve) => setTimeout(resolve, 5_200));
    expect(
      runtime.queue.claimNext('worker_2'),
      'the job was picked up again: an unknown outcome was retried',
    ).toBeNull();
  }, 20_000);

  it('is unknown, not failed, when an automation run runs out of time', async () => {
    seedAutomation();

    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1' },
    });
    const job = runtime.queue.claimNext('worker_1');

    const outcome = await executeJob(context, job!);

    const run = handle.db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, 'aut_1'))
      .get();
    expect(run?.status, 'the run was not recorded as unknown').toBe('unknown');
    expect(outcome.status, 'the outcome was reported as a failure, not as unknown').toBe('unknown');
  });

  it('is never run again when an automation run runs out of time', async () => {
    seedAutomation();

    const enqueued = runtime.queue.enqueue({
      workspaceId: 'wsp_1',
      type: 'automation.run',
      payload: { automationId: 'aut_1' },
    });
    const job = runtime.queue.claimNext('worker_1');

    const outcome = await executeJob(context, job!);
    dispatchAsTheWorkerDoes(runtime.queue, outcome, job!.id, 'worker_1');

    await new Promise((resolve) => setTimeout(resolve, 5_200));
    expect(
      runtime.queue.claimNext('worker_2'),
      'the job was picked up again: an unknown outcome was retried',
    ).toBeNull();
  }, 20_000);
});
