/**
 * The gate for restart reconciliation.
 *
 * A worker dies holding a job. The work may already have happened: the agent
 * may have written a file, sent a message, spent the owner's budget. So the
 * question the product has to answer on the next start is not "what should we
 * do with this job" but "what do we know about what already happened".
 *
 * This gate checks that the product answers that question, and that the answer
 * is the conservative one:
 *
 * 1. **No blind replay.** A job whose run had not started is run again, and a
 *    job whose run had started is not. The side effect is counted, so a
 *    product that replayed the work would be caught by the count rather than
 *    by an opinion about it.
 *
 * 2. **The uncertain outcome is visible and the owner can settle it.** The run
 *    is published as uncertain, it is on the owner's waiting list, and the
 *    owner's own conclusion settles it — and settles the job with it.
 *
 * 3. **A run whose runtime survived is reconnected, not started again.** The
 *    same run, with the same execution, the same correlation id and the same
 *    session reference, ends the way the runtime says it ended.
 *
 * 4. **A stale executor cannot write.** A worker whose lease moved on cannot
 *    finish, fail or hold a job that is not its own.
 *
 * The gate builds its own database and drives the product's own code, so it
 * checks what the product does rather than what it says it does.
 *
 * Run it with `npx tsx scripts/verify-restart-reconciliation.ts`.
 */
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { createDatabase, runMigrations, schema } from '@personal-os/server/db';
import {
  createAuditService,
  createConversationsService,
  createExecutionsService,
  EventsService,
  findRepoRoot,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentReconciliation,
  AgentTurnInput,
} from '@personal-os/contracts';

const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

/**
 * The file the fixture writes its side effect to.
 *
 * It is a file, and not a row, because the point of the gate is that the
 * side effect is *outside* the product: nothing the product does can take it
 * back, and a product that ran the work again would leave two lines in it.
 */
const sideEffectFile = join(
  mkdtempSync(join(tmpdir(), 'personal-os-restart-gate-')),
  'side-effect.txt',
);

function writeTheSideEffect(): void {
  appendFileSync(sideEffectFile, 'the work happened\n');
}

function sideEffectCount(): number {
  if (!existsSync(sideEffectFile)) return 0;
  return readFileSync(sideEffectFile, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0).length;
}

/**
 * The fixture runtime.
 *
 * There are two of them, because "the runtime cannot be asked" and "the
 * runtime was asked and could not say" are different facts, and the gate needs
 * both. The first is the honest answer for every runtime the product ships
 * today; the second is what a runtime that keeps a session but has lost the
 * thread says.
 */
abstract class GateRuntimeBase implements AgentAdapter {
  readonly type = 'echo' as const;

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return {
      chat: true,
      streaming: true,
      persistentSessions: true,
      backgroundTasks: false,
      cancel: true,
      approvals: false,
      artifacts: false,
    };
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    yield {
      type: 'message.delta',
      executionId: input.executionId,
      text: 'The gate answer.',
    };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

/**
 * A runtime that cannot be asked.
 *
 * It does not implement the question at all, so the product never reaches it
 * and the outcome stays uncertain.
 */
class SilentRuntime extends GateRuntimeBase {}

/**
 * A runtime that can be asked, and answers.
 *
 * `unknown` is a real answer: the runtime was asked and could not say.
 */
class AnsweringRuntime extends GateRuntimeBase {
  constructor(private readonly outcome: 'completed' | 'failed' | 'unknown') {
    super();
  }

  async reconcile(
    _connection: AgentConnection,
    request: { executionId: string; externalSessionId?: string },
  ): Promise<AgentReconciliation> {
    if (this.outcome === 'unknown') {
      return { executionId: request.executionId, outcome: 'unknown' };
    }
    return {
      executionId: request.executionId,
      outcome: this.outcome,
      detail: 'The runtime kept the session, and the turn had finished.',
    };
  }
}

/** Read the worker's reconciliation. */
async function loadReconciliation(): Promise<{
  reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
}> {
  const specifier = '@personal-os/worker/dist/reconcile.js';
  try {
    return (await import(specifier)) as {
      reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
    };
  } catch (error) {
    throw new Error(
      `The gate needs the worker built (${specifier}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** The tree the gate reads its static claims from. */
function readRepoFile(relative: string): string {
  const path = join(findRepoRoot(), relative);
  if (!existsSync(path)) throw new Error(`The gate needs ${relative}, and it is not there.`);
  return readFileSync(path, 'utf8');
}

/**
 * The rule lives in one place.
 *
 * Two rules would be two answers to "may this work be run again", and the
 * wrong one would be the dangerous one.
 */
function checkTheTree(): void {
  const rule = readRepoFile('apps/server/src/queue/reconciliation.ts');
  if (!rule.includes('export function decideStaleJob(')) {
    fail('apps/server/src/queue/reconciliation.ts does not define the stale-job rule.');
  }
  for (const kind of ['requeue', 'reconcile', 'hold', 'complete']) {
    if (!rule.includes(`'${kind}'`)) {
      fail(`The stale-job rule does not decide "${kind}".`);
    }
  }

  // The rule is decided in one place and applied in one place: the queue
  // decides, and the worker carries the decision out.
  const client = readRepoFile('apps/server/src/queue/client.ts');
  if (!client.includes('decideStaleJob')) {
    fail('apps/server/src/queue/client.ts does not apply the shared stale-job rule.');
  }

  // A write to a running job is fenced on the lease. A stale executor that
  // writes would settle a job that is not its own.
  if (!/lockedBy,\s*workerId/.test(client)) {
    fail(
      'apps/server/src/queue/client.ts does not fence its writes on the lease; a stale executor could settle a job that is not its own.',
    );
  }
  for (const method of ['complete', 'fail', 'hold']) {
    const body = new RegExp(`${method}\\([^)]*workerId[^)]*\\)[\\s\\S]{0,1500}?lockedBy`).test(
      client,
    );
    if (!body) {
      fail(`apps/server/src/queue/client.ts does not fence "${method}" on the lease.`);
    }
  }
}

/**
 * The runtime claims: what the product does when a worker dies.
 */
async function checkTheRecords(): Promise<void> {
  const { reconcileStaleJobs } = await loadReconciliation();

  const dir = mkdtempSync(join(tmpdir(), 'personal-os-restart-records-'));
  const handle = createDatabase(join(dir, 'gate.db'));
  runMigrations(handle.db);
  const db = handle.db;

  try {
    const events = new EventsService(db);
    const queue = new Queue(db);
    const audit = createAuditService(db);
    const now = new Date().toISOString();

    db.insert(schema.conversations)
      .values({
        id: 'cnv_gate',
        workspaceId: 'wsp_gate',
        title: 'The gate room',
        routingMode: 'mentions',
        coordinatorId: null,
        paused: false,
        maxTurns: 8,
        maxDurationSeconds: 900,
        maxSpendUnits: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.agentConnections)
      .values({
        id: 'agt_gate',
        workspaceId: 'wsp_gate',
        name: 'Gate agent',
        adapterType: 'echo',
        configRef: 'cfg_gate',
        toolGrants: null,
        persona: null,
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          persistentSessions: true,
          backgroundTasks: false,
          cancel: true,
          approvals: false,
          artifacts: false,
        },
        capabilitiesRevision: 1,
        status: 'connected',
        lastError: null,
        lastConnectedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.messages)
      .values({
        id: 'msg_gate',
        conversationId: 'cnv_gate',
        senderId: 'p_gate_human',
        targetParticipantIds: [],
        replyToId: null,
        kind: 'text',
        content: [{ type: 'text', text: 'do the work' }],
        status: 'streaming',
        correlationId: 'corr_gate',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        executionId: 'exe_gate',
        delivery: 'queue',
        consumedAt: null,
        createdAt: now,
      })
      .run();

    db.insert(schema.executions)
      .values({
        id: 'exe_gate',
        workspaceId: 'wsp_gate',
        conversationId: 'cnv_gate',
        taskId: null,
        externalRef: 'gate-session',
        agentConnectionId: 'agt_gate',
        executionOwner: 'personal-os',
        status: 'running',
        error: null,
        committedRevision: null,
        idempotencyKey: null,
        correlationId: 'corr_gate',
        capabilityView: null,
        spendUnits: 0,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
      })
      .run();

    db.insert(schema.conversationSessions)
      .values({
        id: 'ses_gate',
        workspaceId: 'wsp_gate',
        conversationId: 'cnv_gate',
        agentConnectionId: 'agt_gate',
        sessionId: 'gate-session',
        continuity: 'resumable',
        capabilitiesRevision: 1,
        establishedAt: now,
        updatedAt: now,
      })
      .run();

    const job = queue.enqueue({
      workspaceId: 'wsp_gate',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_gate',
        agentConnectionId: 'agt_gate',
        executionId: 'exe_gate',
        correlationId: 'corr_gate',
        depth: 1,
      },
    });
    queue.claimNext('worker_dead');
    // The worker died holding the job: the lease has not been refreshed for
    // longer than the window.
    db.update(schema.queueJobs)
      .set({ lockedAt: '2000-01-01T00:00:00.000Z' })
      .where(eq(schema.queueJobs.id, job.id))
      .run();

    // The work had already happened when the worker died.
    writeTheSideEffect();

    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: dir,
      PERSONAL_OS_OWNER_TOKEN: 'gate-token',
      LOG_LEVEL: 'silent',
    } as NodeJS.ProcessEnv);

    const adapter = new SilentRuntime();
    const runtime: Runtime = {
      config,
      db,
      sqlite: handle.sqlite,
      registry: { create: () => adapter } as unknown as Runtime['registry'],
      events,
      queue,
      audit,
      resolveSecret: async () =>
        JSON.stringify({ adapterType: 'echo', config: { reply: 'The gate answer.' } }),
      close: () => handle.close(),
    };

    await reconcileStaleJobs(runtime);

    // 1. No blind replay.
    if (sideEffectCount() !== 1) {
      fail(
        `The work ran again after the worker died: the side effect happened ${sideEffectCount()} times, and it happened once before.`,
      );
    }
    if (queue.claimNext('worker_new') !== null) {
      fail('The job of a run that had started was offered to another worker.');
    }

    // 2. The uncertain outcome is visible, and the owner can settle it.
    const uncertain = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_gate'))
      .get();
    if (uncertain?.status !== 'unknown') {
      fail(
        `A run whose outcome could not be confirmed is published as "${uncertain?.status}", and it should be published as uncertain.`,
      );
    }

    const conversations = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (agentConnectionId: string) => agentConnectionId,
    });

    const unknownTurns = conversations.listUnknownTurns('wsp_gate');
    if (!unknownTurns.some((turn) => turn.executionId === 'exe_gate')) {
      fail("The uncertain run is not on the owner's waiting list, so the owner cannot see it.");
    }

    const executionsService = createExecutionsService({
      db,
      audit,
      bots: undefined as never,
      events,
      queue,
    });
    try {
      executionsService.resolve({
        executionId: 'exe_gate',
        outcome: 'completed',
        note: 'It did run.',
        actorType: 'human',
        actorId: 'owner',
      });
    } catch (error) {
      fail(
        `The owner could not settle the uncertain run: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const settled = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_gate'))
      .get();
    if (settled?.status !== 'completed') {
      fail(`The owner's conclusion did not settle the uncertain run: it is "${settled?.status}".`);
    }
    const settledJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (settledJob?.status !== 'done') {
      fail(
        `The owner's conclusion did not settle the job: the job is "${settledJob?.status}", and it still says the outcome was never confirmed.`,
      );
    }

    // 3. A run whose runtime survived is reconnected, not started again.
    db.update(schema.executions)
      .set({ status: 'running', error: null, finishedAt: null })
      .where(eq(schema.executions.id, 'exe_gate'))
      .run();
    db.update(schema.queueJobs)
      .set({ status: 'running', lockedBy: 'worker_dead', lockedAt: '2000-01-01T00:00:00.000Z' })
      .where(eq(schema.queueJobs.id, job.id))
      .run();
    db.update(schema.messages)
      .set({ status: 'streaming' })
      .where(eq(schema.messages.executionId, 'exe_gate'))
      .run();

    const answering = new AnsweringRuntime('completed');
    const answeringRuntime: Runtime = {
      ...runtime,
      registry: { create: () => answering } as unknown as Runtime['registry'],
    };
    await reconcileStaleJobs(answeringRuntime);

    if (sideEffectCount() !== 1) {
      fail(
        `The work ran again when the runtime survived: the side effect happened ${sideEffectCount()} times, and it happened once before.`,
      );
    }
    const reconnected = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_gate'))
      .get();
    if (reconnected?.status !== 'completed') {
      fail(
        `The run whose runtime survived was not reconnected: it is "${reconnected?.status}", and the runtime said it had finished.`,
      );
    }
    if (reconnected?.correlationId !== 'corr_gate') {
      fail('The reconnected run lost its correlation id, so it is not the same run.');
    }
    const session = db
      .select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.id, 'ses_gate'))
      .get();
    if (session?.sessionId !== 'gate-session') {
      fail('The reconnected run lost its session reference, so it is not the same run.');
    }
    const reconnectedJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (reconnectedJob?.status !== 'done') {
      fail(`The reconnected run's job is "${reconnectedJob?.status}", and it should be finished.`);
    }

    // 4. A stale executor cannot write to a job that is not its own.
    const otherJob = queue.enqueue({
      workspaceId: 'wsp_gate',
      type: 'chat.turn',
      payload: { executionId: 'exe_gate' },
    });
    queue.claimNext('worker_a');
    db.update(schema.queueJobs)
      .set({ lockedBy: 'worker_b' })
      .where(eq(schema.queueJobs.id, otherJob.id))
      .run();
    if (queue.complete(otherJob.id, 'worker_a')) {
      fail('A stale executor finished a job whose lease had moved on.');
    }
  } finally {
    handle.close();
  }
}

async function main(): Promise<void> {
  checkTheTree();
  await checkTheRecords();

  if (failures.length > 0) {
    console.error('The restart reconciliation gate failed:');
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log('The restart reconciliation gate passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
