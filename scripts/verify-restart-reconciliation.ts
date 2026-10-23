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
 * 1. **The rule is the rule.** The stale-job rule is asked about every state
 *    the product can be in, and each state has one answer. The gate asks the
 *    rule itself, not a string in a file.
 *
 * 2. **No blind replay.** A job whose run had started is not offered to
 *    another worker, and a job whose run had not started is. The side effect
 *    is counted, and the count is calibrated: on the path where running the
 *    work again is the right answer, the gate really does run it again and
 *    watches the count grow. A count that stays put on the path where it must
 *    stay put is therefore a fact and not a tautology.
 *
 * 3. **Every kind of job is probed the same way.** A chat turn, a task turn
 *    and an automation's run are all probed, because a rule that only one of
 *    them obeys is a rule that is half true.
 *
 * 4. **The uncertain outcome is visible and the owner can settle it.** The run
 *    is published as uncertain, it is on the owner's waiting list with the
 *    reason it is uncertain, and the owner's own conclusion settles it — and
 *    settles the job with it, and is written to the audit trail.
 *
 * 5. **A run whose runtime survived is reconnected, not started again.** The
 *    same run, with the same execution, the same correlation id and the same
 *    session reference, ends the way the runtime says it ended.
 *
 * 6. **A stale executor cannot write.** A worker whose lease moved on cannot
 *    finish, fail or hold a job that is not its own — and two workers looking
 *    at the same dead job end its turn once.
 *
 * The gate builds its own database and drives the product's own code, so it
 * checks what the product does rather than what it says it does.
 *
 * The gate exercises the built product. A build that is older than the tree it
 * was built from would make the gate check something else, so the gate says
 * so rather than passing quietly.
 *
 * Run it with `npx tsx scripts/verify-restart-reconciliation.ts`.
 */
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { eq } from 'drizzle-orm';
import {
  createDatabase,
  runMigrations,
  schema,
  type Database,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  createConversationsService,
  createExecutionsService,
  decideStaleJob,
  EventsService,
  findRepoRoot,
  loadConfig,
  Queue,
  type QueueJob,
  type Runtime,
  type StaleJobItem,
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

const NOW = '2026-01-01T00:00:00.000Z';
const WORKSPACE = 'wsp_gate';

/**
 * The file the fixture writes its side effect to.
 *
 * It is a file, and not a row, because the point of the gate is that the
 * side effect is *outside* the product: nothing the product does can take it
 * back, and a product that ran the work again would leave two lines in it.
 */
let sideEffectFile = '';

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
 *
 * The runtime writes the side effect when it runs, so a run of the work is
 * visible in the file rather than in an opinion about it.
 */
abstract class GateRuntimeBase implements AgentAdapter {
  readonly type = 'echo' as const;

  /** The fixture does not keep a runtime between turns. */
  readonly holdsRuntime = false;

  /**
   * What the runtime sees while it is working.
   *
   * The gate uses this to look at the product from the inside: a runtime that
   * is in the middle of a run can see whether the product has already
   * recorded that the run started.
   */
  onSend: (() => void) | null = null;

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
    this.onSend?.();
    writeTheSideEffect();
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
  /** What the runtime was asked about, so the gate can see the question. */
  readonly asked: { executionId: string; externalSessionId?: string }[] = [];

  constructor(private readonly outcome: 'completed' | 'failed' | 'unknown') {
    super();
  }

  async reconcile(
    _connection: AgentConnection,
    request: { executionId: string; externalSessionId?: string },
  ): Promise<AgentReconciliation> {
    this.asked.push(request);
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

/** Read the worker's own code, which the gate drives. */
async function loadWorker(): Promise<{
  reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
  executeJob: (context: { runtime: Runtime }, job: QueueJob) => Promise<{ status: string }>;
  Scheduler: new (runtime: Runtime) => { tick(now?: Date): Promise<number> };
}> {
  const specifier = '@personal-os/worker/dist/reconcile.js';
  try {
    const reconcile = (await import(specifier)) as {
      reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
    };
    const executor = (await import('@personal-os/worker/dist/executor.js')) as {
      executeJob: (context: { runtime: Runtime }, job: QueueJob) => Promise<{ status: string }>;
    };
    const scheduler = (await import('@personal-os/worker/dist/scheduler.js')) as {
      Scheduler: new (runtime: Runtime) => { tick(now?: Date): Promise<number> };
    };
    return {
      reconcileStaleJobs: reconcile.reconcileStaleJobs,
      executeJob: executor.executeJob,
      Scheduler: scheduler.Scheduler,
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
function readRepoFile(relativePath: string): string {
  const path = join(findRepoRoot(), relativePath);
  if (!existsSync(path)) throw new Error(`The gate needs ${relativePath}, and it is not there.`);
  return readFileSync(path, 'utf8');
}

/** Every file under a directory. */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

/**
 * The build the gate exercises has to be the build of this tree.
 *
 * The gate drives the built product, because that is what runs. A build that
 * is older than the source it was built from is a different product, and a
 * gate that quietly checks the older one proves something about the wrong
 * tree. So the gate refuses rather than passing on a stale build.
 */
function checkTheBuildIsCurrent(): void {
  const root = findRepoRoot();
  const packages = [
    { source: 'packages/contracts/src', build: 'packages/contracts/dist' },
    { source: 'apps/server/src', build: 'apps/server/dist' },
    { source: 'apps/worker/src', build: 'apps/worker/dist' },
  ];

  for (const { source, build } of packages) {
    const sourceDir = join(root, source);
    const buildDir = join(root, build);
    if (!existsSync(buildDir)) {
      fail(`${build} is not there, so the gate cannot exercise the product. Run "npm run build".`);
      continue;
    }

    for (const file of walk(sourceDir)) {
      const name = relative(sourceDir, file);
      if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
      // The tests are not part of the build, so they have no built output.
      if (name.includes(`${'__tests__'}`) || name.endsWith('.test.ts')) continue;

      const built = join(buildDir, name.replace(/\.ts$/, '.js'));
      if (!existsSync(built)) {
        fail(`${source}/${name} has no built output, so the gate would not be exercising it.`);
        continue;
      }
      if (statSync(file).mtimeMs > statSync(built).mtimeMs) {
        fail(
          `${relative(root, file)} is newer than the built ${relative(root, built)}, so the gate would be exercising an older product than the tree. Run "npm run build".`,
        );
      }
    }
  }
}

/**
 * The rule, asked about every state it can be in.
 *
 * The rule is the part that must not be guessed at, so the gate asks it
 * directly. A rule that answered "requeue" to everything would satisfy a
 * check that looked for the word `reconcile` in a file; it does not satisfy
 * this one.
 */
function checkTheRule(): void {
  const cases: { item: StaleJobItem; decision: string }[] = [
    { item: { kind: 'not-started' }, decision: 'requeue' },
    { item: { kind: 'started' }, decision: 'reconcile' },
    { item: { kind: 'unknown' }, decision: 'hold' },
    { item: { kind: 'settled' }, decision: 'complete' },
    { item: { kind: 'none' }, decision: 'hold' },
  ];

  for (const { item, decision } of cases) {
    const answer = decideStaleJob(item);
    if (answer.kind !== decision) {
      fail(
        `The stale-job rule answered "${answer.kind}" for a run that is "${item.kind}", and it should answer "${decision}".`,
      );
    }
    if (!answer.reason || answer.reason.length < 20) {
      fail(
        `The stale-job rule's answer for a run that is "${item.kind}" carries no reason the owner can read.`,
      );
    }
  }

  // The rule lives in one place, and the queue applies that one.
  const client = readRepoFile('apps/server/src/queue/client.ts');
  if (!client.includes('decideStaleJob')) {
    fail('apps/server/src/queue/client.ts does not apply the shared stale-job rule.');
  }
}

/** The fixture the scenarios share. */
interface Fixture {
  handle: DatabaseHandle;
  db: Database;
  queue: Queue;
  runtime: Runtime;
  /** Run a job the way the worker runs one. */
  run: (job: QueueJob) => Promise<{ status: string }>;
  /** Offer the next queued job to a worker and run it if there is one. */
  offerAndRun: (workerId: string) => Promise<boolean>;
}

async function withFixture(
  adapter: AgentAdapter,
  body: (fixture: Fixture) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'personal-os-restart-gate-'));
  // Every scenario counts its own side effects, so one scenario's work can
  // never be mistaken for another's.
  sideEffectFile = join(
    mkdtempSync(join(tmpdir(), 'personal-os-restart-effect-')),
    'side-effect.txt',
  );
  const handle = createDatabase(join(dir, 'gate.db'));
  runMigrations(handle.db);
  const db = handle.db;
  const queue = new Queue(db);
  const events = new EventsService(db);
  const audit = createAuditService(db);

  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dir,
    PERSONAL_OS_OWNER_TOKEN: 'gate-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);

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

  const worker = await loadWorker();

  const fixture: Fixture = {
    handle,
    db,
    queue,
    runtime,
    run: (job) => worker.executeJob({ runtime }, job),
    offerAndRun: async (workerId) => {
      const job = queue.claimNext(workerId);
      if (!job) return false;
      await worker.executeJob({ runtime }, job);
      return true;
    },
  };

  try {
    await body(fixture);
  } finally {
    handle.close();
  }
}

/**
 * A room with an agent in it.
 *
 * The gate drives the product's own turn machinery, so the fixture is a real
 * conversation with a real agent connection, a real parent message and a real
 * execution — the rows the product reads when it runs a turn.
 */
function seedRoom(db: Database, name: string): void {
  db.insert(schema.conversations)
    .values({
      id: `cnv_${name}`,
      workspaceId: WORKSPACE,
      title: 'The gate room',
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

  db.insert(schema.participants)
    .values({
      id: `p_${name}`,
      conversationId: `cnv_${name}`,
      type: 'agent',
      agentConnectionId: `agt_${name}`,
      displayName: 'The gate agent',
      joinedAt: NOW,
    })
    .run();

  db.insert(schema.agentConnections)
    .values({
      id: `agt_${name}`,
      workspaceId: WORKSPACE,
      name: 'The gate agent',
      adapterType: 'echo',
      configRef: `cfg_${name}`,
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
      lastConnectedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(schema.messages)
    .values({
      id: `msg_parent_${name}`,
      conversationId: `cnv_${name}`,
      senderId: `p_${name}`,
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
}

/** A turn the product admitted but has not started. */
function seedQueuedExecution(db: Database, name: string): void {
  db.insert(schema.executions)
    .values({
      id: `exe_${name}`,
      workspaceId: WORKSPACE,
      conversationId: `cnv_${name}`,
      taskId: null,
      externalRef: null,
      agentConnectionId: `agt_${name}`,
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      committedRevision: null,
      idempotencyKey: null,
      correlationId: `cor_${name}`,
      capabilityView: null,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();
}

/** A turn that started and that nothing recorded the ending of. */
function seedRunningExecution(db: Database, name: string): void {
  db.insert(schema.executions)
    .values({
      id: `exe_${name}`,
      workspaceId: WORKSPACE,
      conversationId: `cnv_${name}`,
      taskId: null,
      externalRef: 'gate-session',
      agentConnectionId: `agt_${name}`,
      executionOwner: 'personal-os',
      status: 'running',
      error: null,
      committedRevision: null,
      idempotencyKey: null,
      correlationId: `cor_${name}`,
      capabilityView: null,
      spendUnits: 0,
      startedAt: NOW,
      finishedAt: null,
      createdAt: NOW,
    })
    .run();

  db.insert(schema.conversationSessions)
    .values({
      id: `ses_${name}`,
      workspaceId: WORKSPACE,
      conversationId: `cnv_${name}`,
      agentConnectionId: `agt_${name}`,
      sessionId: 'gate-session',
      continuity: 'resumable',
      capabilitiesRevision: 1,
      establishedAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** The chat job the gate hands to the queue. */
function chatJobPayload(name: string): Record<string, unknown> {
  return {
    conversationId: `cnv_${name}`,
    parentMessageId: `msg_parent_${name}`,
    agentConnectionId: `agt_${name}`,
    executionId: `exe_${name}`,
    correlationId: `cor_${name}`,
    depth: 1,
  };
}

/** Pretend the worker died: the lease has not been refreshed for a long time. */
function letTheWorkerDie(db: Database, jobId: string): void {
  db.update(schema.queueJobs)
    .set({ lockedAt: '2000-01-01T00:00:00.000Z' })
    .where(eq(schema.queueJobs.id, jobId))
    .run();
}

/** How many times a turn was ended. */
function terminalEndings(db: Database, executionId: string): string[] {
  const log = db.select().from(schema.executionEvents).all();
  const statuses: string[] = [];
  for (const entry of log) {
    if (entry.executionId !== executionId) continue;
    const payload = entry.payload as { event?: { type?: string; status?: string } };
    if (payload.event?.type !== 'execution.status') continue;
    const status = payload.event.status ?? '';
    if (!['completed', 'committed', 'failed', 'cancelled'].includes(status)) continue;
    statuses.push(status);
  }
  return statuses;
}

/**
 * The runtime claims: what the product does when a worker dies.
 */
async function checkTheRecords(): Promise<void> {
  const { reconcileStaleJobs } = await loadWorker();

  // ---------------------------------------------------------------------
  // 1. A chat turn whose run had started is not run again.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue, runtime } = fixture;
    seedRoom(db, 'started');
    seedRunningExecution(db, 'started');

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: chatJobPayload('started'),
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);

    // The agent did the work; the worker died before it recorded how it ended.
    writeTheSideEffect();

    await reconcileStaleJobs(runtime);

    const settled = db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id)).get();
    if (settled?.status !== 'unknown') {
      fail(
        `The job of a run that had started is "${settled?.status}", and it should be held as uncertain.`,
      );
    }

    // The job must not be offered to another worker, and the gate runs it if
    // it is: that is what makes the count below a fact and not a tautology.
    const offered = await fixture.offerAndRun('worker_new');
    if (offered) {
      fail('The job of a run that had started was offered to another worker.');
    }
    if (sideEffectCount() !== 1) {
      fail(
        `The work ran again after the worker died: the side effect happened ${sideEffectCount()} times, and it happened once before.`,
      );
    }

    // The uncertain outcome is visible, with the reason it is uncertain.
    const execution = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_started'))
      .get();
    if (execution?.status !== 'unknown') {
      fail(
        `A run whose outcome could not be confirmed is published as "${execution?.status}", and it should be published as uncertain.`,
      );
    }

    const conversations = createConversationsService({
      db,
      events: runtime.events,
      queue,
      audit: runtime.audit,
      agentDisplayName: (agentConnectionId: string) => agentConnectionId,
    });
    const unknownTurns = conversations.listUnknownTurns(WORKSPACE);
    const turn = unknownTurns.find((item) => item.executionId === 'exe_started');
    if (!turn) {
      fail("The uncertain run is not on the owner's waiting list, so the owner cannot see it.");
    } else if (!turn.reason || turn.reason.length < 20) {
      fail('The uncertain run on the waiting list carries no reason the owner can read.');
    }

    // The owner settles it, and the settlement is recorded.
    const executions = createExecutionsService({
      db,
      audit: runtime.audit,
      bots: undefined as never,
      events: runtime.events,
      queue,
    });
    try {
      executions.resolve({
        executionId: 'exe_started',
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

    const settledExecution = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_started'))
      .get();
    if (settledExecution?.status !== 'completed') {
      fail(
        `The owner's conclusion did not settle the uncertain run: it is "${settledExecution?.status}".`,
      );
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

    const auditEntries = runtime.audit.list(WORKSPACE, 100);
    if (!auditEntries.some((entry) => entry.targetId === 'exe_started')) {
      fail("The owner's conclusion was not written to the audit trail.");
    }
  });

  // ---------------------------------------------------------------------
  // 2. A chat turn whose run had not started is run again — and the gate
  //    really does run it, so the count is known to be able to grow.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue, runtime } = fixture;
    seedRoom(db, 'notstarted');
    seedQueuedExecution(db, 'notstarted');

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: chatJobPayload('notstarted'),
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);

    await reconcileStaleJobs(runtime);

    const settled = db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id)).get();
    if (settled?.status !== 'queued') {
      fail(
        `The job of a run that had not started is "${settled?.status}", and it should be queued to run again.`,
      );
    }

    const ran = await fixture.offerAndRun('worker_new');
    if (!ran) {
      fail('The job of a run that had not started was not offered to another worker.');
    }
    if (sideEffectCount() !== 1) {
      fail(
        `The work that had not started did not happen when it was run again: the side effect happened ${sideEffectCount()} times, and it should have happened once.`,
      );
    }
  });

  // ---------------------------------------------------------------------
  // 3. A run whose runtime survived is reconnected, not started again.
  // ---------------------------------------------------------------------
  const answering = new AnsweringRuntime('completed');
  await withFixture(answering, async (fixture) => {
    const { db, queue, runtime } = fixture;
    seedRoom(db, 'survived');
    seedRunningExecution(db, 'survived');

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: chatJobPayload('survived'),
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);
    writeTheSideEffect();

    await reconcileStaleJobs(runtime);

    if (sideEffectCount() !== 1) {
      fail(
        `The work ran again when the runtime survived: the side effect happened ${sideEffectCount()} times, and it happened once before.`,
      );
    }
    const reconnected = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_survived'))
      .get();
    if (reconnected?.status !== 'completed') {
      fail(
        `The run whose runtime survived was not reconnected: it is "${reconnected?.status}", and the runtime said it had finished.`,
      );
    }
    if (reconnected?.correlationId !== 'cor_survived') {
      fail('The reconnected run lost its correlation id, so it is not the same run.');
    }
    const session = db
      .select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.id, 'ses_survived'))
      .get();
    if (session?.sessionId !== 'gate-session') {
      fail('The reconnected run lost its session reference, so it is not the same run.');
    }
    const asked = answering.asked;
    if (asked.length !== 1) {
      fail(
        `The runtime was asked ${asked.length} times what became of the run, and it should be asked once.`,
      );
    } else if (asked[0]?.externalSessionId !== 'gate-session') {
      fail(
        `The runtime was asked about the run without its session, so it could not have reconnected it. It was offered "${asked[0]?.externalSessionId ?? 'nothing'}".`,
      );
    }
    const reconnectedJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (reconnectedJob?.status !== 'done') {
      fail(`The reconnected run's job is "${reconnectedJob?.status}", and it should be finished.`);
    }
  });

  // ---------------------------------------------------------------------
  // 4. Two workers looking at the same dead job end its turn once.
  // ---------------------------------------------------------------------
  await withFixture(answering, async (fixture) => {
    const { db, queue, runtime } = fixture;
    seedRoom(db, 'twice');
    seedRunningExecution(db, 'twice');

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: chatJobPayload('twice'),
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);

    await Promise.all([reconcileStaleJobs(runtime), reconcileStaleJobs(runtime)]);

    const endings = terminalEndings(db, 'exe_twice');
    if (endings.length !== 1) {
      fail(
        `Two workers looking at the same dead job ended its turn ${endings.length} times (${endings.join(', ')}), and a turn ends once.`,
      );
    }
    const settledJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (settledJob?.status !== 'done') {
      fail(`The dead job is "${settledJob?.status}", and it should be settled once.`);
    }
  });

  // ---------------------------------------------------------------------
  // 5. A task's turn is probed the same way a chat turn is.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue, runtime } = fixture;
    seedRoom(db, 'task');
    db.insert(schema.tasks)
      .values({
        id: 'tsk_gate',
        workspaceId: WORKSPACE,
        goalId: null,
        title: 'The gate task',
        description: '',
        assigneeId: null,
        status: 'open',
        acceptanceCriteria: [],
        evidenceResourceIds: [],
        dependsOnTaskIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();
    db.insert(schema.executions)
      .values({
        id: 'exe_task',
        workspaceId: WORKSPACE,
        conversationId: null,
        taskId: 'tsk_gate',
        externalRef: null,
        agentConnectionId: 'agt_task',
        executionOwner: 'personal-os',
        status: 'running',
        error: null,
        committedRevision: null,
        idempotencyKey: null,
        correlationId: 'cor_task',
        capabilityView: null,
        spendUnits: 0,
        startedAt: NOW,
        finishedAt: null,
        createdAt: NOW,
      })
      .run();

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'factory.execute',
      payload: { taskId: 'tsk_gate' },
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);

    await reconcileStaleJobs(runtime);

    const settled = db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id)).get();
    if (settled?.status === 'queued') {
      fail('The job of a task whose turn had started was queued to run again.');
    }
    const offered = await fixture.offerAndRun('worker_new');
    if (offered) {
      fail('The job of a task whose turn had started was offered to another worker.');
    }
  });

  // ---------------------------------------------------------------------
  // 6a. The scheduler mints the run's id, and the run is recorded as
  //     started before it does anything.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue, runtime } = fixture;
    db.insert(schema.automations)
      .values({
        id: 'aut_gate',
        workspaceId: WORKSPACE,
        title: 'The gate automation',
        trigger: { type: 'schedule', everyMinutes: 60 },
        action: {
          type: 'agent.prompt',
          agentConnectionId: 'agt_automation',
          prompt: 'Do it.',
          method: 'GET',
        },
        enabled: true,
        nextRunAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    // The scheduler mints the run's id and puts it on the job, so the job
    // carries the identity of the run it is going to make.
    const worker = await loadWorker();
    const scheduler = new worker.Scheduler(runtime);
    await scheduler.tick(new Date(NOW));
    const scheduledJob = db
      .select()
      .from(schema.queueJobs)
      .all()
      .find((job) => job.type === 'automation.run');
    const scheduledRunId = (scheduledJob?.payload as { runId?: string } | undefined)?.runId;
    if (!scheduledJob || !scheduledRunId) {
      fail(
        'The scheduler queued an automation without the id of the run it is going to make, so the product could not tell afterwards whether that run had started.',
      );
      return;
    }

    // The run is recorded as started before it does anything: the runtime,
    // in the middle of the run, sees the row.
    seedRoom(db, 'automation');
    const fixtureRuntime = new SilentRuntime();
    let seenDuringTheRun: string | null = null;
    fixtureRuntime.onSend = () => {
      const row = db
        .select()
        .from(schema.automationRuns)
        .where(eq(schema.automationRuns.id, scheduledRunId))
        .get();
      seenDuringTheRun = row?.status ?? null;
    };
    const runtimeWithFixture: Runtime = {
      ...runtime,
      registry: { create: () => fixtureRuntime } as unknown as Runtime['registry'],
    };

    await worker.executeJob({ runtime: runtimeWithFixture }, {
      ...scheduledJob,
      status: 'running',
    } as QueueJob);

    if (seenDuringTheRun !== 'running') {
      fail(
        `The automation's run was not recorded as started before it did anything: while the run was in flight the product said "${seenDuringTheRun ?? 'nothing'}".`,
      );
    }
    const finishedRun = db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.id, scheduledRunId))
      .get();
    if (finishedRun?.status !== 'completed') {
      fail(
        `The automation's run ended as "${finishedRun?.status}", and it should have ended as completed.`,
      );
    }
    void queue;
  });

  // ---------------------------------------------------------------------
  // 6b. An automation's run is probed the same way as a chat turn's.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue, runtime } = fixture;
    db.insert(schema.automations)
      .values({
        id: 'aut_gate',
        workspaceId: WORKSPACE,
        title: 'The gate automation',
        trigger: { type: 'schedule', everyMinutes: 60 },
        action: { type: 'resource.refresh', resourceId: 'res_gate', method: 'GET' },
        enabled: true,
        nextRunAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    // The run had started: the row says so, and the job carries the run's id.
    db.insert(schema.automationRuns)
      .values({
        id: 'run_started',
        automationId: 'aut_gate',
        status: 'running',
        startedAt: NOW,
        finishedAt: null,
        output: null,
        error: null,
      })
      .run();

    const startedJob = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'automation.run',
      payload: { automationId: 'aut_gate', runId: 'run_started' },
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, startedJob.id);

    await reconcileStaleJobs(runtime);

    const settled = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, startedJob.id))
      .get();
    if (settled?.status === 'queued') {
      fail('The job of an automation whose run had started was queued to run again.');
    }
    const offered = await fixture.offerAndRun('worker_new');
    if (offered) {
      fail('The job of an automation whose run had started was offered to another worker.');
    }

    // A run that never began is safe to run again.
    const notStartedJob = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'automation.run',
      payload: { automationId: 'aut_gate', runId: 'run_never' },
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, notStartedJob.id);

    await reconcileStaleJobs(runtime);

    const requeued = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, notStartedJob.id))
      .get();
    if (requeued?.status !== 'queued') {
      fail(
        `The job of an automation whose run had not started is "${requeued?.status}", and it should be queued to run again.`,
      );
    }
  });

  // ---------------------------------------------------------------------
  // 7. A stale executor cannot write to a job that is not its own.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue } = fixture;
    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: { executionId: 'exe_gate' },
    });
    queue.claimNext('worker_a');
    db.update(schema.queueJobs)
      .set({ lockedBy: 'worker_b' })
      .where(eq(schema.queueJobs.id, job.id))
      .run();

    if (queue.complete(job.id, 'worker_a')) {
      fail('A stale executor finished a job whose lease had moved on.');
    }
    if (queue.fail(job.id, 'worker_a', 'The stale executor failed the job.')) {
      fail('A stale executor failed a job whose lease had moved on.');
    }
    if (queue.hold(job.id, 'worker_a', 'The stale executor held the job.')) {
      fail('A stale executor held a job whose lease had moved on.');
    }

    const untouched = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (untouched?.status !== 'running' || untouched?.lockedBy !== 'worker_b') {
      fail(
        `A stale executor changed a job whose lease had moved on: the job is "${untouched?.status}" and is held by "${untouched?.lockedBy}".`,
      );
    }
  });
}

async function main(): Promise<void> {
  checkTheBuildIsCurrent();
  checkTheRule();
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
