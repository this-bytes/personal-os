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
 * The gate builds the product's own server over its own database and drives
 * it, so it checks what the product does rather than what it says it does.
 * The owner's own surfaces are the ones it drives — the waiting list and the
 * route that closes an automation's run — because a promise the owner cannot
 * act on is not a promise the product keeps.
 *
 * The gate exercises the built product. A build that is not the build of this
 * tree would make the gate check something else, so the gate rebuilds the
 * tree and compares the two builds byte for byte, and says so rather than
 * passing quietly.
 *
 * Run it with `npx tsx scripts/verify-restart-reconciliation.ts`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { schema, type Database } from '@personal-os/server/db';
import {
  createConversationsService,
  createExecutionsService,
  decideStaleJob,
  findRepoRoot,
  loadConfig,
  type AppConfig,
  type Queue,
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

/** The token the owner calls the API with. */
const OWNER_TOKEN = 'gate-token';

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

/**
 * Read the worker's own code, which the gate drives.
 *
 * The specifiers are held in variables on purpose. The scripts are typechecked
 * before the worker is built, so a literal specifier would be a module that
 * cannot be found — and the typecheck would fail for a reason that has
 * nothing to do with the code it is checking. This is the pattern the other
 * gate that drives the worker already uses.
 */
async function loadWorker(): Promise<{
  reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
  executeJob: (context: { runtime: Runtime }, job: QueueJob) => Promise<{ status: string }>;
  Scheduler: new (runtime: Runtime) => { tick(now?: Date): Promise<number> };
}> {
  const reconcileSpecifier = '@personal-os/worker/dist/reconcile.js';
  const executorSpecifier = '@personal-os/worker/dist/executor.js';
  const schedulerSpecifier = '@personal-os/worker/dist/scheduler.js';
  try {
    const reconcile = (await import(reconcileSpecifier)) as {
      reconcileStaleJobs: (runtime: Runtime, olderThanMs?: number) => Promise<number>;
    };
    const executor = (await import(executorSpecifier)) as {
      executeJob: (context: { runtime: Runtime }, job: QueueJob) => Promise<{ status: string }>;
    };
    const scheduler = (await import(schedulerSpecifier)) as {
      Scheduler: new (runtime: Runtime) => { tick(now?: Date): Promise<number> };
    };
    return {
      reconcileStaleJobs: reconcile.reconcileStaleJobs,
      executeJob: executor.executeJob,
      Scheduler: scheduler.Scheduler,
    };
  } catch (error) {
    throw new Error(
      `The gate needs the worker built (${reconcileSpecifier}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
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
 * The packages the gate exercises, and the project that builds each one.
 *
 * The agent-adapters package is in the list because the server's build reads
 * its types: a stale adapters build would make the server's own build stale
 * as well, and the gate has to be able to say so.
 */
const BUILT_PACKAGES = [
  {
    name: 'contracts',
    project: 'packages/contracts/tsconfig.json',
    build: 'packages/contracts/dist',
  },
  {
    name: 'agent-adapters',
    project: 'packages/agent-adapters/tsconfig.json',
    build: 'packages/agent-adapters/dist',
  },
  { name: 'server', project: 'apps/server/tsconfig.json', build: 'apps/server/dist' },
  { name: 'worker', project: 'apps/worker/tsconfig.json', build: 'apps/worker/dist' },
];

/**
 * The build the gate exercises has to be the build of this tree.
 *
 * The gate drives the built product, because that is what runs. A build that
 * is not the build of this tree is a different product, and a gate that
 * quietly checks the other one proves something about the wrong tree.
 *
 * So the gate rebuilds the tree into a scratch directory and compares the two
 * builds byte for byte. A modification time cannot do this: it says when a
 * file was written, not what it says. A file restored from a backup has a
 * fresh time and the content it had before, so a tree that was put back the
 * way it was would be reported as stale; and a build that was edited after it
 * was made has a fresh time and content nobody wrote, so it would be reported
 * as current. The content settles both, and only the content does.
 */
function checkTheBuildIsCurrent(): void {
  const root = findRepoRoot();
  const compiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(compiler)) {
    fail(
      'The TypeScript compiler is not installed, so the gate cannot tell whether the build it exercises is the build of this tree.',
    );
    return;
  }

  for (const pkg of BUILT_PACKAGES) {
    const buildDir = join(root, pkg.build);
    if (!existsSync(buildDir)) {
      fail(
        `${pkg.build} is not there, so the gate cannot exercise the product. Run "npm run build".`,
      );
      continue;
    }

    const scratch = mkdtempSync(join(tmpdir(), `personal-os-build-${pkg.name}-`));
    try {
      const rebuild = spawnSync(
        process.execPath,
        [compiler, '-p', pkg.project, '--outDir', scratch],
        { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      );
      if (rebuild.status !== 0) {
        fail(
          `The tree does not build, so the gate cannot tell whether the build it exercises is the build of this tree: ${firstLine(rebuild.stderr || rebuild.stdout)}`,
        );
        continue;
      }
      compareTheBuilds(pkg.name, buildDir, scratch);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}

/**
 * The outputs of a build, and what each one says.
 *
 * Only the outputs that are executed and the declarations that are read are
 * compared. The source maps are not: a map records the path from its own
 * location to the source, so the same source built into a different directory
 * produces a different map, and comparing maps would report a difference that
 * is not one.
 */
function outputsOf(directory: string): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const file of walk(directory)) {
    const name = relative(directory, file);
    if (!name.endsWith('.js') && !name.endsWith('.d.ts')) continue;
    outputs.set(name, createHash('sha256').update(readFileSync(file)).digest('hex'));
  }
  return outputs;
}

/** Compare the build the gate exercises with the build of this tree. */
function compareTheBuilds(name: string, buildDir: string, rebuiltDir: string): void {
  const built = outputsOf(buildDir);
  const rebuilt = outputsOf(rebuiltDir);

  for (const file of [...built.keys()].sort()) {
    if (!rebuilt.has(file)) {
      fail(
        `${name}'s build has ${file}, which this tree does not build, so the build the gate exercises is not the build of this tree.`,
      );
    }
  }

  for (const file of [...rebuilt.keys()].sort()) {
    if (!built.has(file)) {
      fail(
        `${name}'s build has no ${file}, but this tree builds it, so the gate would not be exercising it.`,
      );
      continue;
    }
    if (built.get(file) !== rebuilt.get(file)) {
      fail(
        `${name}'s built ${file} is not what this tree builds, so the gate would be exercising a different product than the tree. Run "npm run build".`,
      );
    }
  }
}

/** The first line of a compiler's complaint. */
function firstLine(text: string): string {
  const line = text.split('\n').find((entry) => entry.trim().length > 0) ?? '';
  return line.trim();
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
}

/**
 * The queue asks the shared rule.
 *
 * The rule is one rule and the queue applies it. A source-text check could say
 * so — but a file that mentions the rule's name is not the queue applying it,
 * and a comment would satisfy such a check. So this asks the queue instead:
 * what does it know about the item a job was working on, and what does it
 * answer?
 *
 * The job here names a turn the product cannot find. The product cannot tell
 * what the job was working on, so the item is "none" and the answer is to hold
 * the job: it may already have had its side effect, so it is never run again.
 */
async function checkTheQueueAsksTheRule(): Promise<void> {
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { db, queue } = fixture;

    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'chat.turn',
      payload: { executionId: 'exe_the_product_cannot_find' },
    });

    const item = queue.itemStateFor(job);
    if (item.kind !== 'none') {
      fail(
        `The queue says it is working on "${item.kind}" for a job whose turn it cannot find, and it should say it cannot tell.`,
      );
    }

    // The queue's answer is the shared rule's answer for the item it computed.
    const answer = queue.decideFor(job);
    const shared = decideStaleJob(item);
    if (answer.kind !== shared.kind) {
      fail(
        `The queue answered "${answer.kind}" for a job it cannot identify, and the shared rule answers "${shared.kind}".`,
      );
    }
    if (answer.kind !== 'hold') {
      fail(
        `A job whose item the product cannot identify was answered "${answer.kind}", and it should be held rather than run again.`,
      );
    }

    // And the answer is carried out: the job is held, and it is never offered
    // to another worker.
    const claimed = queue.claimNext('worker_dead');
    if (!claimed || claimed.id !== job.id) {
      fail('The gate could not claim the job it enqueued.');
      return;
    }
    letTheWorkerDie(db, job.id);
    queue.applyStaleDecision(claimed, answer);
    const settled = db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id)).get();
    if (settled?.status !== 'unknown') {
      fail(
        `A job whose item the product cannot identify is "${settled?.status}", and it should be held rather than run again.`,
      );
    }
  });
}

/**
 * The owner's server, as the gate needs it.
 *
 * The gate drives the owner's real surfaces, so it needs the real server. The
 * waiting list the owner reads and the route that closes an automation's run
 * are not re-implementations here: they are the ones the product serves, so
 * what the gate proves is what the owner can do.
 *
 * The shape is the one the gate uses, not the server's whole surface. The
 * server's own types are not the gate's business, and the gate says what it
 * needs and nothing more.
 */
interface OwnerApp {
  inject(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<{ statusCode: number; body: string; json(): unknown }>;
  close(): Promise<void>;
  /** The runtime the server built over its own database. */
  services: { runtime: Runtime };
}

/** The answer the owner's API gave. */
interface OwnerAnswer {
  statusCode: number;
  body: unknown;
}

/**
 * Read the server's own build.
 *
 * The specifier is held in a variable on purpose, and the module is reached
 * through a file URL, because the server's package exports do not name the
 * application module: the gate reaches the built file the product runs
 * rather than widening the package's published surface.
 */
async function loadServerApp(): Promise<{
  buildApp: (options: { config: AppConfig }) => Promise<OwnerApp>;
}> {
  const specifier = pathToFileURL(join(findRepoRoot(), 'apps', 'server', 'dist', 'app.js')).href;
  try {
    const module = (await import(specifier)) as {
      buildApp: (options: { config: AppConfig }) => Promise<OwnerApp>;
    };
    return module;
  } catch (error) {
    throw new Error(
      `The gate needs the server built (apps/server/dist/app.js): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** The fixture the scenarios share. */
interface Fixture {
  /** The owner's own server, over the same database. */
  app: OwnerApp;
  db: Database;
  queue: Queue;
  runtime: Runtime;
  /** Run a job the way the worker runs one. */
  run: (job: QueueJob) => Promise<{ status: string }>;
  /** Offer the next queued job to a worker and run it if there is one. */
  offerAndRun: (workerId: string) => Promise<boolean>;
  /** Call the owner's API, as the owner calls it. */
  asOwner: (options: { method: string; url: string; payload?: unknown }) => Promise<OwnerAnswer>;
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

  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dir,
    PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);

  // The gate builds the product's own server over its own database, so the
  // owner's surfaces it drives are the ones that ship.
  const { buildApp } = await loadServerApp();
  const app = await buildApp({ config });

  const base = app.services.runtime;
  const db = base.db;
  const queue = base.queue;

  // The worker the gate drives is the same product, with the fixture's
  // runtime in place of a real one. Nothing else is replaced: the queue, the
  // trail and the database are the product's own.
  const runtime: Runtime = {
    ...base,
    registry: { create: () => adapter } as unknown as Runtime['registry'],
    resolveSecret: async () =>
      JSON.stringify({ adapterType: 'echo', config: { reply: 'The gate answer.' } }),
  };

  const worker = await loadWorker();

  const fixture: Fixture = {
    app,
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
    asOwner: (options) => asOwner(app, options),
  };

  try {
    await body(fixture);
  } finally {
    await app.close();
  }
}

/**
 * Call the owner's API as the owner.
 *
 * The owner is the owner because the request carries the owner's token, so
 * the gate is calling the surface the owner calls and not a wider one.
 */
async function asOwner(
  app: OwnerApp,
  options: { method: string; url: string; payload?: unknown },
): Promise<OwnerAnswer> {
  const response = await app.inject({
    method: options.method,
    url: options.url,
    headers: { authorization: `Bearer ${OWNER_TOKEN}` },
    ...(options.payload === undefined ? {} : { payload: options.payload }),
  });
  let body: unknown = null;
  if (response.body.length > 0) {
    try {
      body = response.json();
    } catch {
      body = response.body;
    }
  }
  return { statusCode: response.statusCode, body };
}

/**
 * The owner's waiting list.
 *
 * The list is the published surface: a question the owner cannot see is a
 * question the owner cannot answer, so the gate reads the list the owner
 * reads.
 */
async function ownerWaiting(fixture: Fixture): Promise<WaitingEntry[]> {
  const answer = await fixture.asOwner({
    method: 'GET',
    url: `/api/waiting?workspaceId=${WORKSPACE}`,
  });
  if (answer.statusCode !== 200) {
    fail(`The owner's waiting list answered ${answer.statusCode}, so the gate could not read it.`);
    return [];
  }
  const items = (answer.body as { items?: unknown }).items;
  // The list crosses the server-to-client boundary, so its shape is the
  // contracts package's. The gate reads the four fields it checks.
  return Array.isArray(items)
    ? (items as { id: string; kind: string; reason: string; detail: string }[])
    : [];
}

/** One entry on the owner's waiting list. */
interface WaitingEntry {
  id: string;
  kind: string;
  reason: string;
  detail: string;
}

/** The runs an automation's own page carries. */
function runsOf(body: unknown): { id: string; status: string }[] {
  const runs = (body as { runs?: unknown }).runs;
  return Array.isArray(runs) ? (runs as { id: string; status: string }[]) : [];
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
  // 5. A task's turn is probed the same way a chat turn is, and the
  //    uncertainty reaches the task the owner works with.
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
        status: 'active',
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

    // The payload is the one the product produces: the task, the turn and the
    // agent the turn is for. A payload the product never sends would prove
    // nothing about the branch the product takes, and a turn that carries an
    // execution id is the branch the product takes.
    const job = queue.enqueue({
      workspaceId: WORKSPACE,
      type: 'factory.execute',
      payload: { taskId: 'tsk_gate', executionId: 'exe_task', agentConnectionId: 'agt_task' },
    });
    queue.claimNext('worker_dead');
    letTheWorkerDie(db, job.id);

    // The agent did the work; the worker died before it recorded how it ended.
    writeTheSideEffect();

    await reconcileStaleJobs(runtime);

    // The turn is uncertain.
    const execution = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_task'))
      .get();
    if (execution?.status !== 'unknown') {
      fail(
        `A task's turn whose outcome could not be confirmed is published as "${execution?.status}", and it should be published as uncertain.`,
      );
    }

    // And so is the task, because a task that stays active is a task the
    // owner never hears about: the waiting list only shows a task that has
    // reached `review`, `blocked` or `unknown`.
    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'tsk_gate')).get();
    if (task?.status !== 'unknown') {
      fail(
        `The task whose turn could not be confirmed is "${task?.status}", and it should be published as uncertain.`,
      );
    }

    // The task is on the owner's waiting list, which is where the owner
    // looks for something to check.
    const waiting = await ownerWaiting(fixture);
    const item = waiting.find((entry) => entry.id === 'task:tsk_gate');
    if (!item) {
      fail(
        "The task whose turn could not be confirmed is not on the owner's waiting list, so the owner cannot see it.",
      );
    } else if (item.reason !== 'unknown') {
      fail(
        `The task on the owner's waiting list says "${item.reason}", and it should say that its outcome could not be confirmed.`,
      );
    }

    // The work is not run again.
    const settled = db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id)).get();
    if (settled?.status === 'queued') {
      fail('The job of a task whose turn had started was queued to run again.');
    }
    const offered = await fixture.offerAndRun('worker_new');
    if (offered) {
      fail('The job of a task whose turn had started was offered to another worker.');
    }
    if (sideEffectCount() !== 1) {
      fail(
        `The work ran again after the worker died: the side effect happened ${sideEffectCount()} times, and it happened once before.`,
      );
    }

    // The owner settles the task, on the task's own surface. An acceptance is
    // how the owner answers a task whose outcome could not be confirmed.
    const closed = await fixture.asOwner({
      method: 'POST',
      url: '/api/tasks/tsk_gate/accept',
      payload: { satisfied: true, reason: 'It did run.' },
    });
    if (closed.statusCode !== 200) {
      fail(
        `The owner could not settle the task whose turn could not be confirmed: the route answered ${closed.statusCode}.`,
      );
    }
    const settledTask = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'tsk_gate')).get();
    if (settledTask?.status !== 'done') {
      fail(
        `The owner's conclusion did not settle the task: the task is "${settledTask?.status}", and it still says its outcome could not be confirmed.`,
      );
    }

    // The turn is closed with the task, and the job that was held for it is
    // settled with it. The owner's conclusion is the outcome, so neither the
    // run nor the queue's record goes on saying that the outcome was never
    // confirmed.
    const settledTurn = db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.id, 'exe_task'))
      .get();
    if (settledTurn?.status !== 'completed') {
      fail(
        `The owner's conclusion did not settle the uncertain turn of the task: the turn is "${settledTurn?.status}".`,
      );
    }
    const settledHeldJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))
      .get();
    if (settledHeldJob?.status !== 'done') {
      fail(
        `The owner's conclusion did not settle the job that was held for the task: the job is "${settledHeldJob?.status}", and it still says the outcome was never confirmed.`,
      );
    }

    // The turn ended once, and the ending is on the one event log.
    const endings = terminalEndings(db, 'exe_task');
    if (endings.length !== 1 || endings[0] !== 'completed') {
      fail(
        `The owner's conclusion ended the task's turn ${endings.length} times (${endings.join(', ') || 'never'}), and a turn ends once.`,
      );
    }
    const after = await ownerWaiting(fixture);
    if (after.some((entry) => entry.id === 'task:tsk_gate')) {
      fail("The task is still on the owner's waiting list after the owner settled it.");
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
  // 6b. An automation's run is probed the same way as a chat turn's, and
  //     the owner can close it.
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

    // The run is uncertain. A run that stayed `running` would be an
    // automation that says it is still going for ever.
    const uncertain = db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.id, 'run_started'))
      .get();
    if (uncertain?.status !== 'unknown') {
      fail(
        `An automation's run whose outcome could not be confirmed is "${uncertain?.status}", and it should be published as uncertain.`,
      );
    }

    // The owner reads it with the automation's other runs, because an
    // automation's run has no conversation and no turn of its own.
    const listed = await fixture.asOwner({
      method: 'GET',
      url: '/api/automations/aut_gate',
    });
    if (listed.statusCode !== 200) {
      fail(
        `The owner's automation page answered ${listed.statusCode}, so the gate could not read it.`,
      );
    }
    const shown = runsOf(listed.body).find((run) => run.id === 'run_started');
    if (!shown) {
      fail("The uncertain run is not among the automation's runs, so the owner cannot see it.");
    } else if (shown.status !== 'unknown') {
      fail(
        `The run on the owner's automation page says "${shown.status}", and it should say that its outcome could not be confirmed.`,
      );
    }

    // The job is not offered to another worker.
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

    // The owner closes it, and the job that was held for it is settled with
    // it: the owner's conclusion is the outcome.
    const closed = await fixture.asOwner({
      method: 'POST',
      url: '/api/automations/aut_gate/runs/run_started/resolve',
      payload: { outcome: 'completed', note: 'It did run.' },
    });
    if (closed.statusCode !== 200) {
      fail(
        `The owner could not close an automation's run whose outcome could not be confirmed: the route answered ${closed.statusCode}.`,
      );
    }
    const settledRun = db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.id, 'run_started'))
      .get();
    if (settledRun?.status !== 'completed') {
      fail(
        `The owner's conclusion did not settle the automation's run: the run is "${settledRun?.status}", and it still says its outcome could not be confirmed.`,
      );
    }
    const settledJob = db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, startedJob.id))
      .get();
    if (settledJob?.status !== 'done') {
      fail(
        `The owner's conclusion did not settle the job that was held for the run: the job is "${settledJob?.status}", and it still says the outcome was never confirmed.`,
      );
    }
    const entries = runtime.audit.list(WORKSPACE, 100);
    if (
      !entries.some(
        (entry) =>
          entry.action === 'automation.run.outcome.resolved' && entry.targetId === 'run_started',
      )
    ) {
      fail("The owner's conclusion about an automation's run was not written to the audit trail.");
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

  // ---------------------------------------------------------------------
  // 8. The agent's tool is bounded: a connection granted the tool in one
  //    workspace cannot close a run in another.
  // ---------------------------------------------------------------------
  await withFixture(new SilentRuntime(), async (fixture) => {
    const { app, db } = fixture;

    // A workspace the gate's agent may not reach, and an automation in it
    // with a run whose outcome could not be confirmed.
    const other = await fixture.asOwner({
      method: 'POST',
      url: '/api/workspaces',
      payload: { name: 'Elsewhere', description: 'The workspace the agent may not reach.' },
    });
    if (other.statusCode !== 201) {
      fail(
        `The gate could not create the second workspace: the route answered ${other.statusCode}.`,
      );
      return;
    }
    const otherWorkspaceId = (other.body as { workspace: { id: string } }).workspace.id;

    const automation = await fixture.asOwner({
      method: 'POST',
      url: '/api/automations',
      payload: {
        workspaceId: otherWorkspaceId,
        title: "The other workspace's automation",
        trigger: { type: 'schedule', everyMinutes: 60 },
        action: { type: 'resource.refresh', resourceId: 'res_gate', method: 'GET' },
      },
    });
    if (automation.statusCode !== 201) {
      fail(
        `The gate could not create the automation: the route answered ${automation.statusCode}.`,
      );
      return;
    }
    const automationId = (automation.body as { automation: { id: string } }).automation.id;

    const now = new Date().toISOString();
    db.insert(schema.automationRuns)
      .values({
        id: 'run_elsewhere',
        automationId,
        status: 'unknown',
        startedAt: now,
        finishedAt: null,
        output: null,
        error: 'The worker stopped before it recorded how the run ended.',
      })
      .run();

    // An agent in the gate's own workspace, with the tool granted to it.
    const agent = await fixture.asOwner({
      method: 'POST',
      url: '/api/agents',
      payload: {
        workspaceId: WORKSPACE,
        name: 'The gate agent',
        adapterType: 'echo',
        config: { reply: 'hi' },
        toolGrants: ['automation.run.resolve'],
      },
    });
    if (agent.statusCode !== 201) {
      fail(`The gate could not create the agent: the route answered ${agent.statusCode}.`);
      return;
    }
    const agentId = (agent.body as { agent: { id: string } }).agent.id;
    const token = await fixture.asOwner({
      method: 'POST',
      url: `/api/agents/${agentId}/tokens`,
      payload: { label: 'gate' },
    });
    if (token.statusCode !== 201) {
      fail(`The gate could not mint the agent's token: the route answered ${token.statusCode}.`);
      return;
    }
    const agentToken = (token.body as { token: string }).token;

    // The agent calls the tool, pointing at the run in the other workspace.
    // This is the surface the agent has, so the gate drives it: a tool that
    // only the owner's route respects is not a bounded tool.
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'automation.run.resolve',
          arguments: { runId: 'run_elsewhere', outcome: 'completed', note: 'It did run.' },
        },
      },
    });

    const dataLine = response.body.split('\n').find((line) => line.startsWith('data: '));
    if (!dataLine) {
      fail(`The agent's tool answered without a payload: ${response.body.slice(0, 200)}`);
      return;
    }
    const payload = JSON.parse(dataLine.slice('data: '.length)) as {
      result?: { isError?: boolean; content?: { text?: string }[] };
    };
    if (payload.result?.isError !== true) {
      fail(
        'An agent granted the tool in one workspace closed a run in another workspace: the tool answered without refusing.',
      );
    }

    // And the run is untouched: it still says its outcome could not be
    // confirmed, and the job that was held for it is still held.
    const run = db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.id, 'run_elsewhere'))
      .get();
    if (run?.status !== 'unknown') {
      fail(
        `An agent granted the tool in one workspace closed a run in another workspace: the run is "${run?.status}".`,
      );
    }
  });
}

async function main(): Promise<void> {
  checkTheBuildIsCurrent();
  checkTheRule();
  await checkTheQueueAsksTheRule();
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
