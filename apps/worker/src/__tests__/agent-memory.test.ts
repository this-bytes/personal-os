import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  agentConnections,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  resources,
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
 * The agent's own memory in the turn.
 *
 * The memory belongs to the connection, so it follows the agent into every
 * conversation it takes part in, and it reaches no other agent's turns. It is
 * budgeted, so it cannot crowd out the conversation.
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

/** An agent that records the turn it was given and answers it. */
class RecordingAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  readonly turns: AgentTurnInput[] = [];

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.turns.push(input);
    yield { type: 'message.delta', executionId: input.executionId, text: 'Understood.' };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: RecordingAdapter;

const NOW = '2026-01-01T00:00:00.000Z';

function job(payload: Record<string, unknown>): Parameters<typeof executeJob>[1] {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type: 'chat.turn',
    payload,
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

/** Write a memory that belongs to one agent. */
function writeMemory(
  id: string,
  agentConnectionId: string,
  key: string,
  value: string,
  updatedAt: string,
  tags: string[] = [],
): void {
  handle.db
    .insert(resources)
    .values({
      id,
      workspaceId: 'wsp_1',
      type: 'memory',
      schemaVersion: 1,
      revision: 1,
      title: key,
      data: { scope: 'agent', agentConnectionId, key, value, tags },
      createdBy: 'owner',
      createdAt: updatedAt,
      updatedAt,
    })
    .run();
}

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
      personaOverride: null,
      joinedAt: NOW,
    })
    .run();

  handle.db
    .insert(agentConnections)
    .values([
      {
        id: 'agt_1',
        workspaceId: 'wsp_1',
        name: 'The agent',
        adapterType: 'echo',
        configRef: 'cfg_1',
        toolGrants: null,
        persona: null,
        enabled: true,
        capabilities: CAPABILITIES,
        status: 'unknown',
        lastError: null,
        lastConnectedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'agt_2',
        workspaceId: 'wsp_1',
        name: 'The other agent',
        adapterType: 'echo',
        configRef: 'cfg_2',
        toolGrants: null,
        persona: null,
        enabled: true,
        capabilities: CAPABILITIES,
        status: 'unknown',
        lastError: null,
        lastConnectedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
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
      correlationId: 'cor_1',
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

function turn(): Parameters<typeof executeJob>[1] {
  return job({
    conversationId: 'cnv_1',
    parentMessageId: 'msg_parent',
    agentConnectionId: 'agt_1',
    executionId: 'exe_1',
    correlationId: 'cor_1',
    depth: 1,
  });
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

  adapter = new RecordingAdapter();

  runtime = {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    registry: {
      create: () => adapter,
    } as unknown as Runtime['registry'],
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    resolveSecret: async () =>
      JSON.stringify({ adapterType: 'echo', config: { timeoutSeconds: 30 } }),
    close: () => handle.close(),
  };

  context = { runtime };
  seed();
});

afterEach(() => {
  handle.close();
});

describe("an agent's memory in the turn", () => {
  it('reaches the adapter with the turn', async () => {
    writeMemory('res_1', 'agt_1', 'prefers', 'answer with sources', NOW);

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).toContain('prefers: answer with sources');
  });

  it('reaches no other agent’s turn', async () => {
    writeMemory('res_1', 'agt_2', 'secret', 'the other agent only', NOW);

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).not.toContain('the other agent only');
  });

  it('leaves the memories of the other scopes out of it', async () => {
    handle.db
      .insert(resources)
      .values({
        id: 'res_1',
        workspaceId: 'wsp_1',
        type: 'memory',
        schemaVersion: 1,
        revision: 1,
        title: 'shared',
        data: { scope: 'workspace', key: 'shared', value: 'a workspace memory', tags: [] },
        createdBy: 'owner',
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).not.toContain('a workspace memory');
  });

  it('reads the pinned memory first, then the most recent', async () => {
    writeMemory('res_1', 'agt_1', 'older', 'the older one', '2026-01-01T00:00:00.000Z');
    writeMemory('res_2', 'agt_1', 'newer', 'the newer one', '2026-03-01T00:00:00.000Z');
    writeMemory('res_3', 'agt_1', 'pinned', 'the pinned one', '2026-01-01T00:00:00.000Z', [
      'pinned',
    ]);

    await executeJob(context, turn());

    const sent = adapter.turns[0]?.context ?? '';
    expect(sent.indexOf('the pinned one')).toBeLessThan(sent.indexOf('the newer one'));
    expect(sent.indexOf('the newer one')).toBeLessThan(sent.indexOf('the older one'));
  });

  it('keeps the memory from crowding out the conversation', async () => {
    writeMemory('res_1', 'agt_1', 'huge', 'x'.repeat(6_000), NOW);

    await executeJob(context, turn());

    const sent = adapter.turns[0]?.context ?? '';
    // The memory did not fit, so it is left out — and the conversation is
    // still there.
    expect(sent).not.toContain('x'.repeat(100));
    expect(sent).toContain('Do the thing');
  });
});
