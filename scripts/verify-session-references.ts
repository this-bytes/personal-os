/**
 * The gate for session references, correlation and terminal events.
 *
 * A conversation holds a durable reference to the runtime session behind it,
 * and a turn carries a correlation id, a committed revision and exactly one
 * terminal event. This gate checks that the product keeps those promises:
 *
 * 1. **Every published session reference resolves.** A reference has to point
 *    at a conversation that exists, at an agent connection that exists, at a
 *    session the product can name, and it has to be published by the read
 *    model a client reads. A reference that points at nothing the product can
 *    name fails the gate.
 *
 * 2. **Every committed revision is one the product wrote.** A turn whose
 *    output is in canonical history carries the revision of that history; a
 *    turn whose output is not canonical carries none. A revision that does not
 *    match the history the turn committed to is a revision nobody wrote, and
 *    it fails the gate.
 *
 * 3. **A turn ends once.** Exactly one terminal event ends a turn, and the
 *    turn's own status agrees with it. A log with two endings fails the gate.
 *
 * 4. **A second turn continues the same session.** The gate drives two turns
 *    in one conversation and reads what the runtime was offered: the second
 *    turn has to be offered the session the first turn established. A gate
 *    that drove one turn could not tell a continuing session from a fresh one.
 *
 * 5. **`unknown` is a question, not an ending.** The turn model the contract
 *    publishes is checked against the contract itself, so a turn whose
 *    outcome could not be confirmed stays unsettled until the owner closes it
 *    — and the close, not the uncertainty, is what ends the turn.
 *
 * The gate builds its own database and drives the product's own code through
 * real chat turns, so it checks what the product does rather than what the
 * product says it does. It also reads the tree: the rule that defines a
 * terminal event has to live in one place, and the adapter matrix has to
 * record what every runtime can and cannot do.
 *
 * Run it with `npx tsx scripts/verify-session-references.ts`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { createDatabase, runMigrations, schema } from '@personal-os/server/db';
import {
  computeHistoryRevision,
  createAuditService,
  createConversationsService,
  EventsService,
  loadConfig,
  planAndDispatch,
  Queue,
  type QueueJob,
  type Runtime,
} from '@personal-os/server/runtime';
import {
  adapterTypeSchema,
  isTerminalTurnStatus,
  TERMINAL_TURN_STATUSES,
  turnEventFor,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentExecutionStatus,
  type AgentTurnInput,
  type ContentPart,
  type Participant,
} from '@personal-os/contracts';
import { findRepoRoot } from '@personal-os/server/runtime';

const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

/**
 * The one session the gate's runtime keeps.
 *
 * A runtime that keeps sessions keeps *this* one, so the second turn in the
 * conversation has something to continue.
 */
const GATE_SESSION = 'gate-session';

/**
 * A runtime that keeps a session.
 *
 * The gate needs a runtime that can be resumed, because the promise it
 * checks — a second turn continues the same session — only exists on a
 * runtime that keeps one. This one keeps one and says so.
 *
 * It keeps *one* session for the whole conversation, and it records the
 * session each turn was offered. The record is how the gate sees that the
 * second turn continued the first turn's session rather than starting a new
 * one.
 */
class GateAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  private counter = 0;
  /** The session each turn was offered, in the order the turns ran. */
  readonly offered: (string | undefined)[] = [];

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

  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return { executionId, status: 'completed', externalRef: GATE_SESSION };
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.counter += 1;
    this.offered.push(input.externalSessionId);
    yield {
      type: 'message.delta',
      executionId: input.executionId,
      text: `Gate answer ${this.counter}.`,
    };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

/**
 * Read the worker's executor.
 *
 * The specifier is held in a variable so the repository's typecheck does not
 * depend on the worker's build order. The worker is built before the gate
 * runs, and the gate says so when it is not.
 */
async function loadWorkerExecutor(): Promise<{
  executeJob: (
    context: { runtime: Runtime },
    job: QueueJob,
  ) => Promise<{ status: string; error?: string }>;
}> {
  const specifier = '@personal-os/worker/dist/executor.js';
  try {
    return (await import(specifier)) as {
      executeJob: (
        context: { runtime: Runtime },
        job: QueueJob,
      ) => Promise<{ status: string; error?: string }>;
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
 * The turn model the contract publishes.
 *
 * `unknown` is a question, not an ending. The turn started and nobody can say
 * how it ended, so the owner closes it, and the close publishes the one event
 * that ends it. A contract that made `unknown` an ending would say the turn
 * was over before anyone knew how it went — and the owner's conclusion would
 * then be a second ending.
 */
function checkTheTurnModel(): void {
  if (isTerminalTurnStatus('unknown')) {
    fail("'unknown' is published as a status that ends a turn; it is a question the owner closes.");
  }
  if (turnEventFor('unknown') !== null) {
    fail("'unknown' is published with a terminal event; an unsettled turn has no terminal event.");
  }
  if (turnEventFor('queued') !== 'turn.admitted') {
    fail("The turn's admission is not published as 'turn.admitted'.");
  }
  for (const status of ['committed', 'completed', 'failed', 'cancelled'] as const) {
    if (!isTerminalTurnStatus(status)) {
      fail(`'${status}' ends a turn, and it is not published as a status that does.`);
    }
    if (turnEventFor(status) === null) {
      fail(`'${status}' ends a turn, and it is published with no event.`);
    }
  }
}

/**
 * The static claims: the rules the tree has to keep.
 *
 * A published promise that the code has quietly stopped keeping is worse than
 * one that was never made, so the gate reads the code that carries each rule.
 */
function checkTheTree(): void {
  // The terminal-event rule lives in one place, and the readers read it from
  // there. Two definitions would be two answers to "which event ends a turn".
  const contracts = readRepoFile('packages/contracts/src/session.ts');
  if (!contracts.includes('export function turnEventFor(')) {
    fail('packages/contracts/src/session.ts does not define the terminal-event rule.');
  }
  if (!contracts.includes('export const TERMINAL_TURN_STATUSES')) {
    fail('packages/contracts/src/session.ts does not list the statuses that end a turn.');
  }

  const activity = readRepoFile('apps/server/src/modules/executions/activity.ts');
  if (/export function turnEventFor\(/.test(activity)) {
    fail(
      'apps/server/src/modules/executions/activity.ts defines its own terminal-event rule; it must read the shared one.',
    );
  }
  if (!/import\s*\{[^}]*turnEventFor[^}]*\}\s*from\s*'@personal-os\/contracts'/.test(activity)) {
    fail(
      "apps/server/src/modules/executions/activity.ts does not read the shared terminal-event rule from '@personal-os/contracts'.",
    );
  }

  // The turn view publishes the revision the row holds. A hardcoded null is
  // the promise the tree used to make and did not keep.
  const executions = readRepoFile('apps/server/src/modules/executions/service.ts');
  if (/committedRevision:\s*null/.test(executions)) {
    fail(
      'apps/server/src/modules/executions/service.ts publishes a hardcoded null revision; it must publish the revision the turn committed to.',
    );
  }
  if (!/committedRevision:\s*turn\.committedRevision/.test(executions)) {
    fail(
      'apps/server/src/modules/executions/service.ts does not publish the revision the turn committed to.',
    );
  }

  // The adapter matrix records what every runtime can and cannot do, with the
  // version each claim was verified against.
  const matrix = readRepoFile('docs/adapters.md');
  for (const type of adapterTypeSchema.options) {
    const row = matrix
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith(`| \`${type}\``));
    if (!row) {
      fail(`docs/adapters.md has no row for the "${type}" adapter type.`);
      continue;
    }
    if (!/session/i.test(row)) {
      fail(`docs/adapters.md does not record the session limit for the "${type}" adapter type.`);
    }
    if (!/\d+\.\d+/.test(row)) {
      fail(
        `docs/adapters.md does not record the version the "${type}" adapter type was verified against.`,
      );
    }
  }
}

/**
 * The runtime claims: the records the product writes.
 *
 * The gate drives a real chat turn through the product's own code and then
 * reads what it wrote.
 */
async function checkTheRecords(): Promise<void> {
  const { executeJob } = await loadWorkerExecutor();

  const dir = mkdtempSync(join(tmpdir(), 'personal-os-session-gate-'));
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

    db.insert(schema.participants)
      .values([
        {
          id: 'p_gate_human',
          conversationId: 'cnv_gate',
          type: 'human',
          agentConnectionId: null,
          displayName: 'Owner',
          personaOverride: null,
          joinedAt: now,
        },
        {
          id: 'p_gate_agent',
          conversationId: 'cnv_gate',
          type: 'agent',
          agentConnectionId: 'agt_gate',
          displayName: 'Gate agent',
          personaOverride: null,
          joinedAt: now,
        },
      ])
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
        content: [{ type: 'text', text: '@Gate agent do the work' }],
        status: 'complete',
        correlationId: 'corr_gate',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        executionId: null,
        delivery: 'queue',
        consumedAt: null,
        createdAt: now,
      })
      .run();

    const participants: Participant[] = [
      {
        id: 'p_gate_human',
        conversationId: 'cnv_gate',
        type: 'human',
        displayName: 'Owner',
      },
      {
        id: 'p_gate_agent',
        conversationId: 'cnv_gate',
        type: 'agent',
        agentConnectionId: 'agt_gate',
        displayName: 'Gate agent',
      },
    ];

    const dispatch = planAndDispatch({
      db,
      events,
      queue,
      audit,
      conversationId: 'cnv_gate',
      message: {
        id: 'msg_gate',
        conversationId: 'cnv_gate',
        senderId: 'p_gate_human',
        targetParticipantIds: [],
        kind: 'text',
        content: [{ type: 'text', text: '@Gate agent do the work' }],
        status: 'complete',
        correlationId: 'corr_gate',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        createdAt: now,
      },
      participants,
      correlationId: 'corr_gate',
      depth: 0,
    });

    if (dispatch.dispatches.length !== 1) {
      fail(`The gate's dispatch did not start a run: ${dispatch.routing.reason}`);
      return;
    }
    const executionId = dispatch.dispatches[0]!.executionId;

    // The same dispatch again: one run, one set of events.
    const repeat = planAndDispatch({
      db,
      events,
      queue,
      audit,
      conversationId: 'cnv_gate',
      message: {
        id: 'msg_gate',
        conversationId: 'cnv_gate',
        senderId: 'p_gate_human',
        targetParticipantIds: [],
        kind: 'text',
        content: [{ type: 'text', text: '@Gate agent do the work' }],
        status: 'complete',
        correlationId: 'corr_gate',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        createdAt: now,
      },
      participants,
      correlationId: 'corr_gate',
      depth: 0,
    });
    if (repeat.dispatches.length !== 0) {
      fail('A dispatch repeated with the same key started a second run.');
    }
    if (db.select().from(schema.executions).all().length !== 1) {
      fail('A dispatch repeated with the same key left more than one run behind.');
    }

    // The turn runs.
    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: dir,
      PERSONAL_OS_OWNER_TOKEN: 'gate-token',
      LOG_LEVEL: 'silent',
    } as NodeJS.ProcessEnv);

    const adapter = new GateAdapter();
    const runtime: Runtime = {
      config,
      db,
      sqlite: handle.sqlite,
      registry: { create: () => adapter } as unknown as Runtime['registry'],
      events,
      queue,
      audit,
      resolveSecret: async () =>
        JSON.stringify({ adapterType: 'echo', config: { reply: 'Gate answer.' } }),
      close: () => handle.close(),
    };

    const outcome = await executeJob({ runtime }, {
      id: 'job_gate',
      workspaceId: 'wsp_gate',
      type: 'chat.turn',
      payload: {
        conversationId: 'cnv_gate',
        agentConnectionId: 'agt_gate',
        executionId,
        parentMessageId: 'msg_gate',
        correlationId: 'corr_gate',
        depth: 0,
      },
      status: 'running',
      attempts: 1,
      maxAttempts: 3,
      priority: 0,
      runAt: now,
      lockedAt: now,
      lockedBy: 'gate',
      lastError: null,
      createdAt: now,
      updatedAt: now,
    } as QueueJob);

    if (outcome.status !== 'committed') {
      fail(
        `The gate's turn did not commit: ${outcome.status}${
          outcome.error ? ` (${outcome.error})` : ''
        }`,
      );
    }

    // The second turn continues the same session.
    //
    // This is the promise the gate exists to check, so the gate drives it: a
    // second message in the same conversation, to the same agent, and the
    // runtime is offered the session the first turn established. A gate that
    // only drove one turn could not tell a continuing session from a fresh
    // one, and would pass on a product that started a new session every time.
    //
    // The second message is stamped after the first turn's reply, because the
    // revision of the history is a hash over the history in order: a message
    // that claimed to have arrived before the reply would change the revision
    // the first turn committed to, and the first turn did not see it.
    const firstReply = db
      .select({ createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(eq(schema.messages.executionId, executionId))
      .get();
    const secondMessageAt = firstReply
      ? new Date(Date.parse(firstReply.createdAt) + 1).toISOString()
      : now;

    db.insert(schema.messages)
      .values({
        id: 'msg_gate_2',
        conversationId: 'cnv_gate',
        senderId: 'p_gate_human',
        targetParticipantIds: [],
        replyToId: null,
        kind: 'text',
        content: [{ type: 'text', text: '@Gate agent do more work' }],
        status: 'complete',
        correlationId: 'corr_gate_2',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        executionId: null,
        delivery: 'queue',
        consumedAt: null,
        createdAt: secondMessageAt,
      })
      .run();

    const second = planAndDispatch({
      db,
      events,
      queue,
      audit,
      conversationId: 'cnv_gate',
      message: {
        id: 'msg_gate_2',
        conversationId: 'cnv_gate',
        senderId: 'p_gate_human',
        targetParticipantIds: [],
        kind: 'text',
        content: [{ type: 'text', text: '@Gate agent do more work' }],
        status: 'complete',
        correlationId: 'corr_gate_2',
        origin: { kind: 'human', actorId: 'p_gate_human', depth: 0 },
        createdAt: secondMessageAt,
      },
      participants,
      correlationId: 'corr_gate_2',
      depth: 0,
    });

    if (second.dispatches.length !== 1) {
      fail(`The gate's second turn did not start a run: ${second.routing.reason}`);
    } else {
      const secondExecutionId = second.dispatches[0]!.executionId;

      const secondOutcome = await executeJob({ runtime }, {
        id: 'job_gate_2',
        workspaceId: 'wsp_gate',
        type: 'chat.turn',
        payload: {
          conversationId: 'cnv_gate',
          agentConnectionId: 'agt_gate',
          executionId: secondExecutionId,
          parentMessageId: 'msg_gate_2',
          correlationId: 'corr_gate_2',
          depth: 0,
        },
        status: 'running',
        attempts: 1,
        maxAttempts: 3,
        priority: 0,
        runAt: now,
        lockedAt: now,
        lockedBy: 'gate',
        lastError: null,
        createdAt: now,
        updatedAt: now,
      } as QueueJob);

      if (secondOutcome.status !== 'committed') {
        fail(
          `The gate's second turn did not commit: ${secondOutcome.status}${
            secondOutcome.error ? ` (${secondOutcome.error})` : ''
          }`,
        );
      }
    }

    // The runtime was offered the session on the second turn, and not on the
    // first: the first turn had none to be offered.
    if (adapter.offered.length !== 2) {
      fail(`The gate's runtime ran ${adapter.offered.length} turns; it must run two.`);
    } else {
      if (adapter.offered[0] !== undefined) {
        fail(
          `The first turn was offered the session "${adapter.offered[0]}" before any turn had established one.`,
        );
      }
      if (adapter.offered[1] !== GATE_SESSION) {
        fail(
          `The second turn was offered ${
            adapter.offered[1] === undefined ? 'no session' : `"${adapter.offered[1]}"`
          } instead of the session the first turn established ("${GATE_SESSION}").`,
        );
      }
    }

    // Every session reference resolves.
    const references = db.select().from(schema.conversationSessions).all();
    if (references.length === 0) {
      fail("The gate's turn recorded no session reference.");
    }
    const conversations = new Set(
      db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .all()
        .map((row) => row.id),
    );
    const connections = new Set(
      db
        .select({ id: schema.agentConnections.id })
        .from(schema.agentConnections)
        .all()
        .map((row) => row.id),
    );
    for (const reference of references) {
      if (!conversations.has(reference.conversationId)) {
        fail(
          `A session reference points at a conversation that does not exist: ${reference.conversationId}`,
        );
      }
      if (!connections.has(reference.agentConnectionId)) {
        fail(
          `A session reference points at an agent connection that does not exist: ${reference.agentConnectionId}`,
        );
      }
      if (reference.sessionId.trim().length === 0) {
        fail('A session reference names no session.');
      }
    }

    // The reference is published: the read model a client reads names it.
    const conversationsService = createConversationsService({
      db,
      events,
      queue,
      audit,
      agentDisplayName: (id) => id,
    });
    const published = conversationsService.get('cnv_gate');
    if (published.sessionRefs.length !== references.length) {
      fail(
        `The conversation publishes ${published.sessionRefs.length} session references and holds ${references.length}.`,
      );
    }

    // Every committed revision is one the product wrote.
    const runs = db.select().from(schema.executions).all();
    for (const run of runs) {
      if (run.status === 'committed') {
        if (!run.committedRevision) {
          fail(`A committed turn (${run.id}) carries no revision.`);
          continue;
        }
        const reply = db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.executionId, run.id))
          .get();
        if (!reply) {
          fail(`A committed turn (${run.id}) wrote no reply into the canonical history.`);
          continue;
        }
        const history = db
          .select({
            id: schema.messages.id,
            createdAt: schema.messages.createdAt,
            senderId: schema.messages.senderId,
            status: schema.messages.status,
            correlationId: schema.messages.correlationId,
            content: schema.messages.content,
          })
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, run.conversationId!))
          .all()
          .map((row) => ({ ...row, content: row.content as ContentPart[] }));
        const expected = computeHistoryRevision(history, reply.id);
        if (run.committedRevision !== expected) {
          fail(
            `A committed turn (${run.id}) carries a revision that is not the revision of the history it committed to.`,
          );
        }
      } else if (run.committedRevision !== null) {
        fail(
          `A turn that is not committed (${run.id}, ${run.status}) carries a revision nobody wrote.`,
        );
      }
    }

    // A turn ends once.
    const log = db.select().from(schema.executionEvents).all();
    const terminalStatuses = new Set<string>(TERMINAL_TURN_STATUSES);
    const endings = new Map<string, string[]>();
    for (const entry of log) {
      const payload = entry.payload as { event?: { type?: string; status?: string } };
      if (payload.event?.type !== 'execution.status') continue;
      const status = payload.event.status ?? '';
      if (!terminalStatuses.has(status)) continue;
      endings.set(entry.executionId, [...(endings.get(entry.executionId) ?? []), status]);
    }
    for (const [id, statuses] of endings) {
      if (statuses.length > 1) {
        fail(`A turn (${id}) ended more than once: ${statuses.join(', ')}.`);
      }
    }
    const turnEndings = endings.get(executionId) ?? [];
    if (turnEndings.length !== 1) {
      fail(`A turn ended ${turnEndings.length} times; it must end once.`);
    } else if (turnEndings[0] !== 'committed') {
      fail(`The turn ended as "${turnEndings[0]}" and the row says "committed".`);
    }
  } finally {
    handle.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  checkTheTree();
  checkTheTurnModel();
  try {
    await checkTheRecords();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (failures.length > 0) {
    console.error('The session reference gate failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('The session reference gate passed.');
}

await main();
