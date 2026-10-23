import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import {
  agentConnections,
  conversations,
  createDatabase,
  executions,
  messages,
  runMigrations,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  createDefaultRegistry,
  EventsService,
  findRepoRoot,
  loadConfig,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The worker reaches the runtime the turn runs on.
 *
 * The defect this file proves was real: the worker built an adapter and sent
 * to it without ever connecting it. A capability probe on the server reported
 * the connection as healthy, because the probe connected an instance of its
 * own — and the turn itself then failed with "The MCP server was never
 * reached", which describes a symptom rather than a cause.
 *
 * These cases drive the **real** worker path against the **real** MCP fixture
 * — an actual server process speaking the published protocol over stdio — so
 * what is asserted is the server's own answer and not a stub's.
 */

const NOW = '2026-01-01T00:00:00.000Z';

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;

function fixture(name: string): string {
  return path.join(
    findRepoRoot(),
    'packages',
    'agent-adapters',
    'src',
    '__tests__',
    'fixtures',
    name,
  );
}

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

/**
 * Seed a conversation with one agent connection whose adapter is an MCP server
 * started by the given fixture.
 */
function seed(serverFixture: string): void {
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
    .insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'The MCP agent',
      adapterType: 'mcp',
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

  // The configuration the worker reads through the secret store.
  runtime.resolveSecret = async () =>
    JSON.stringify({
      adapterType: 'mcp',
      config: {
        transport: 'stdio',
        command: process.execPath,
        args: [serverFixture],
        toolName: 'echo',
        argumentTemplate: '{"message":"{{message}}"}',
        timeoutSeconds: 30,
      },
    });
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

function executionRow(): { status: string; error: string | null } {
  const row = handle.db.select().from(executions).where(eq(executions.id, 'exe_1')).get();
  if (!row) throw new Error('The execution row is missing.');
  return { status: row.status, error: row.error };
}

/** The reply the agent's turn wrote, if there is one. */
function replyText(): string {
  const reply = handle.db.select().from(messages).where(eq(messages.executionId, 'exe_1')).get();
  if (!reply) return '';
  const content = reply.content as { type: string; text?: string }[];
  return content
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('');
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
    // The real registry, so the turn runs on the real adapter.
    registry: createDefaultRegistry(),
    events: new EventsService(handle.db),
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
    resolveSecret: async () => undefined,
    close: () => handle.close(),
  };

  context = { runtime };
});

afterEach(() => {
  handle.close();
});

describe('the worker reaches the runtime the turn runs on', () => {
  it('a turn against a real MCP server reaches the fixture tool and records its result', async () => {
    const server = fixture('mcp-server.mjs');
    expect(existsSync(server), `the MCP fixture is missing at ${server}`).toBe(true);
    seed(server);

    await executeJob(context, turn());

    const row = executionRow();
    // The reply went into the conversation's canonical history, so the turn is
    // committed rather than merely completed.
    expect(row.status, `the turn did not finish: ${row.error ?? ''}`).toBe('committed');
    expect(row.error).toBeNull();

    // The server's own answer, not the worker's.
    expect(replyText()).toContain('echo:');
  });

  it('a handshake that fails is an actionable failure, and the turn does not pretend otherwise', async () => {
    const server = fixture('mcp-refusing-server.mjs');
    expect(existsSync(server), `the refusing fixture is missing at ${server}`).toBe(true);
    seed(server);

    await executeJob(context, turn());

    const row = executionRow();
    expect(row.status).toBe('failed');
    // The failure names the cause, not a symptom somewhere else.
    expect(row.error ?? '').toMatch(/refus|initiali[sz]e|connect/i);
  });
});
