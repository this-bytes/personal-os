import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  createDatabase,
  executionEvents,
  executions,
  runMigrations,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  EventsService,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The probe runs in the worker.
 *
 * The API server decides that a connection should be discovered; the worker
 * does the discovery. The ACP adapter starts the agent's process to answer,
 * and that process must be a child of the worker rather than of the API
 * server — so the probe is the adapter domain's turn, and it is queued,
 * claimed and closed like any other piece of work.
 */

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: false,
  backgroundTasks: false,
  cancel: true,
  approvals: false,
  artifacts: false,
};

const DEGRADED: AgentCapabilities = { ...CAPABILITIES, chat: false };

/** An adapter that reports what it can do. */
class ProbeAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  connected = 0;

  constructor(private readonly capabilities: AgentCapabilities) {}

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    this.connected += 1;
    return this.capabilities;
  }

  async *send(_input: AgentTurnInput): AsyncIterable<AgentEvent> {
    return;
  }
}

/** An adapter that cannot be reached. */
class BrokenAdapter extends ProbeAdapter {
  constructor() {
    super(CAPABILITIES);
  }

  override async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    this.connected += 1;
    throw new Error('The agent process exited with code 1.');
  }
}

/** An adapter that accepts the connection and then says nothing. */
class SilentAdapter extends ProbeAdapter {
  constructor() {
    super(CAPABILITIES);
  }

  override connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    this.connected += 1;
    return new Promise<AgentCapabilities>(() => undefined);
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: ProbeAdapter;

const NOW = '2026-01-01T00:00:00.000Z';

/** The stored adapter configuration, with the deadline the owner set. */
function timeoutConfig(timeoutSeconds: number): string {
  return JSON.stringify({
    adapterType: 'cli',
    config: { command: 'the-agent', timeoutSeconds },
  });
}

function job(): Parameters<typeof executeJob>[1] {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type: 'agent.probe',
    payload: { agentConnectionId: 'agt_1', executionId: 'exe_1' },
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
  };
}

function seed(): void {
  handle.db
    .insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'The agent',
      adapterType: 'cli',
      configRef: 'cfg_1',
      toolGrants: null,
      persona: null,
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
    .insert(executions)
    .values({
      id: 'exe_1',
      workspaceId: 'wsp_1',
      conversationId: null,
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

function connectionRow(): typeof agentConnections.$inferSelect {
  const row = handle.db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, 'agt_1'))
    .get();
  if (!row) throw new Error('The agent connection is missing.');
  return row;
}

function executionRow(): typeof executions.$inferSelect {
  const row = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
  if (!row) throw new Error('The execution is missing.');
  return row;
}

function statusEvents(): Array<{ type: string; payload: unknown; workspaceId: string }> {
  return handle.db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.type, 'agent.status'))
    .all()
    .map((row) => ({
      type: row.type,
      payload: row.payload,
      workspaceId: row.workspaceId,
    }));
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

  adapter = new ProbeAdapter(CAPABILITIES);

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    resolveSecret: async () => timeoutConfig(30),
    close: () => handle.close(),
  };

  context = {
    runtime,
    registry: { create: () => adapter } as unknown as ExecutorContext['registry'],
  };
});

afterEach(() => {
  handle.close();
});

describe('the probe of a connection', () => {
  it('connects the adapter and records what it can do', async () => {
    seed();

    const outcome = await executeJob(context, job());

    expect(outcome.status).toBe('completed');
    expect(adapter.connected).toBe(1);

    const row = connectionRow();
    expect(row.status).toBe('connected');
    expect(row.capabilities?.chat).toBe(true);
    expect(row.lastError).toBeNull();
    expect(row.lastConnectedAt).toBeTruthy();
  });

  it('closes the execution the server recorded', async () => {
    seed();

    await executeJob(context, job());

    const row = executionRow();
    expect(row.status).toBe('completed');
    expect(row.finishedAt).toBeTruthy();
  });

  it('publishes the answer so the client learns it', async () => {
    seed();

    await executeJob(context, job());

    const events = statusEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      type: 'agent.status',
      connectionId: 'agt_1',
      status: 'connected',
    });
    // The workspace travels with the event: an automation may trigger on an
    // agent's status, and the watcher only acts on events that name one.
    expect(events[0]?.workspaceId).toBe('wsp_1');
  });

  it('records a connection that cannot answer as degraded, not as a failure', async () => {
    seed();
    adapter = new ProbeAdapter(DEGRADED);
    context = {
      runtime,
      registry: { create: () => adapter } as unknown as ExecutorContext['registry'],
    };

    const outcome = await executeJob(context, job());

    expect(outcome.status).toBe('completed');
    const row = connectionRow();
    expect(row.status).toBe('degraded');
    expect(row.lastError).toBeTruthy();
  });

  it('records an adapter that cannot be reached as an error on the connection', async () => {
    seed();
    adapter = new BrokenAdapter();
    context = {
      runtime,
      registry: { create: () => adapter } as unknown as ExecutorContext['registry'],
    };

    const outcome = await executeJob(context, job());

    expect(outcome.status).toBe('failed');
    const row = connectionRow();
    expect(row.status).toBe('error');
    expect(row.lastError).toContain('exited with code 1');

    // The answer to "can this agent talk?" is "no", and the owner sees it on
    // the connection rather than as a failed job in the queue.
    const events = statusEvents();
    expect(events[0]?.payload).toMatchObject({ status: 'error' });
  });

  it('gives up on an agent that never answers, so the worker is not held', async () => {
    seed();
    // The deadline is the adapter's own, and it is short here so the test
    // does not have to wait for the default.
    runtime = { ...runtime, resolveSecret: async () => timeoutConfig(1) };
    adapter = new SilentAdapter();
    context = {
      runtime,
      registry: { create: () => adapter } as unknown as ExecutorContext['registry'],
    };

    const outcome = await executeJob(context, job());

    expect(outcome.status).toBe('failed');
    const row = connectionRow();
    expect(row.status).toBe('error');
    expect(row.lastError).toContain('before the deadline');
  }, 15_000);
});
