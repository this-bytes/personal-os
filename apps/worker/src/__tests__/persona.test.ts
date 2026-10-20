import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  agentConnections,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
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
 * The persona frames the turn.
 *
 * The resolved persona is prepended to the context the worker already
 * builds, so the owner never retypes it and the adapter sees it on the next
 * turn. It frames the turn and nothing else: it is not a second instruction
 * system, and it never replaces the runtime's own harness.
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
    yield {
      type: 'message.delta',
      executionId: input.executionId,
      text: 'Understood.',
    };
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

interface SeedOptions {
  basePersona?: { role?: string; instructions?: string } | null;
  overridePersona?: { role?: string; instructions?: string } | null;
}

function seed(options: SeedOptions): void {
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
      personaOverride: options.overridePersona ?? null,
      joinedAt: NOW,
    })
    .run();

  handle.db
    .insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'The agent',
      adapterType: 'echo',
      configRef: 'cfg_1',
      toolGrants: null,
      persona: options.basePersona ?? null,
      enabled: true,
      capabilities: CAPABILITIES,
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
});

afterEach(() => {
  handle.close();
});

describe('the persona of a turn', () => {
  it('reaches the adapter with the connection base', async () => {
    seed({
      basePersona: { role: 'Research assistant', instructions: 'Answer with sources.' },
    });

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).toContain('Research assistant');
    expect(sent?.context).toContain('Answer with sources.');
  });

  it('is the conversation override when the conversation set one', async () => {
    seed({
      basePersona: { role: 'Connection role', instructions: 'Connection instructions.' },
      overridePersona: { role: 'Conversation role' },
    });

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).toContain('Conversation role');
    // The override replaces the base whole: the connection's instructions
    // do not survive it.
    expect(sent?.context).not.toContain('Connection instructions.');
  });

  it('frames the turn and leaves the conversation in it', async () => {
    seed({ basePersona: { role: 'Research assistant' } });

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    // The persona is at the head of the context the turn already had.
    expect(sent?.context.indexOf('Research assistant')).toBeLessThan(
      sent?.context.indexOf('Do the thing') ?? -1,
    );
    expect(sent?.context).toContain('Do the thing');
  });

  it('changes nothing when the agent has no persona', async () => {
    seed({});

    await executeJob(context, turn());

    const sent = adapter.turns[0];
    expect(sent?.context).not.toContain('Persona in force');
    expect(sent?.context).toContain('Do the thing');
  });
});
