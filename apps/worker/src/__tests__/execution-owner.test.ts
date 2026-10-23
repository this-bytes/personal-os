import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import {
  agentConnections,
  automations,
  conversations,
  createDatabase,
  executionEvents,
  executions,
  messages,
  runMigrations,
  tasks,
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
 * One owner, three callers.
 *
 * These cases drive all three job types — a chat turn, a task turn and an
 * automation's run — through the **real** worker path against the **real** MCP
 * fixture: an actual server process speaking the published protocol over
 * stdio. What is asserted is therefore the server's own answer and the
 * product's own rows, not a stub's.
 *
 * The same lifecycle has to have happened for each of the three: the run was
 * admitted against a capability set, the runtime was connected before it was
 * sent to, a terminal state was recorded, and the events are the ones the
 * published vocabulary publishes.
 *
 * The last case is the gate's teeth. A caller that still owns part of the
 * lifecycle is a caller that can be made to skip the shared owner and still
 * work, so the gate fails when the executor holds any of it.
 */

const NOW = '2026-01-01T00:00:00.000Z';

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let traceFile: string;

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

function job(type: string, payload: Record<string, unknown>): Parameters<typeof executeJob>[1] {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type,
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
  } as Parameters<typeof executeJob>[1];
}

/**
 * The agent the turns run on: an MCP server started from the fixture.
 *
 * The fixture is told to record the methods it receives, so the order the
 * runtime was reached in is the server's own record and not the client's
 * account of it.
 *
 * The extra environment is how a case changes how the server behaves: a case
 * that needs a server that refuses the handshake says so here.
 */
function seedAgent(extraEnv: Record<string, string> = {}): void {
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

  agentEnvironment(extraEnv);
}

/** The environment the agent's server is started in. */
function agentEnvironment(extraEnv: Record<string, string> = {}): void {
  runtime.resolveSecret = async () =>
    JSON.stringify({
      adapterType: 'mcp',
      config: {
        transport: 'stdio',
        command: process.execPath,
        args: [fixture('mcp-server.mjs')],
        toolName: 'echo',
        argumentTemplate: '{"message":"{{message}}"}',
        timeoutSeconds: 30,
        env: { MCP_FIXTURE_TRACE_FILE: traceFile, ...extraEnv },
      },
    });
}

function seedChatTurn(): void {
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
      correlationId: 'corr_1',
      origin: null,
      executionId: null,
      createdAt: NOW,
    })
    .run();

  handle.db
    .insert(executions)
    .values({
      id: 'exe_chat',
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

function seedTaskTurn(): void {
  handle.db
    .insert(tasks)
    .values({
      id: 'tsk_1',
      workspaceId: 'wsp_1',
      goalId: null,
      title: 'Do the work',
      description: '',
      assigneeId: 'agt_1',
      executionOwner: 'personal-os',
      status: 'active',
      revision: 1,
      acceptanceCriteria: ['the work is done'],
      evidenceResourceIds: [],
      dependsOnTaskIds: null,
      externalRef: null,
      createdBy: 'owner',
      templateId: null,
      templateVersion: null,
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

function seedAutomationRun(): void {
  handle.db
    .insert(automations)
    .values({
      id: 'aut_1',
      workspaceId: 'wsp_1',
      title: 'A nightly run',
      trigger: { type: 'schedule', cron: '0 3 * * *' },
      action: {
        type: 'agent.prompt',
        agentConnectionId: 'agt_1',
        prompt: 'Say hello',
        method: 'GET',
      },
      revision: 1,
      enabled: true,
      lastRunAt: null,
      nextRunAt: null,
      createdBy: 'owner',
      templateId: null,
      templateVersion: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
}

/** The execution row a run wrote. */
function executionRow(id: string): {
  status: string;
  error: string | null;
  finishedAt: string | null;
  spendUnits: number;
  capabilityView: { agentConnectionId: string } | null;
} {
  const row = handle.db.select().from(executions).where(eq(executions.id, id)).get();
  if (!row) throw new Error(`The execution row ${id} is missing.`);
  return {
    status: row.status,
    error: row.error,
    finishedAt: row.finishedAt,
    spendUnits: row.spendUnits,
    capabilityView: row.capabilityView as { agentConnectionId: string } | null,
  };
}

/**
 * The execution row an automation's run wrote.
 *
 * The row belongs to no conversation and to no task — that is what an
 * automation's turn is — and that is what tells it apart from the other two
 * rows a case may have written.
 */
function automationExecution(): {
  status: string;
  error: string | null;
  finishedAt: string | null;
  spendUnits: number;
  capabilityView: { agentConnectionId: string } | null;
} {
  const row = handle.db
    .select()
    .from(executions)
    .where(and(isNull(executions.conversationId), isNull(executions.taskId)))
    .get();
  if (!row) throw new Error('The run wrote no execution row.');
  return {
    status: row.status,
    error: row.error,
    finishedAt: row.finishedAt,
    spendUnits: row.spendUnits,
    capabilityView: row.capabilityView as { agentConnectionId: string } | null,
  };
}

/** The rows the three callers wrote, each named by the path that wrote it. */
function theThreeRows(): { path: string; row: ReturnType<typeof executionRow> }[] {
  return [
    { path: 'chat', row: executionRow('exe_chat') },
    { path: 'task', row: executionRow('exe_task') },
    { path: 'automation', row: automationExecution() },
  ];
}

/** The methods the fixture server received, in the order it received them. */
function serverTrace(): string[] {
  if (!existsSync(traceFile)) return [];
  return readFileSync(traceFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The types of the events a run published. */
function publishedEventTypes(): string[] {
  return handle.db
    .select({ type: executionEvents.type })
    .from(executionEvents)
    .all()
    .map((row) => row.type);
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

  traceFile = path.join(os.tmpdir(), `personal-os-owner-trace-${process.pid}-${Date.now()}.log`);

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
  seedAgent();
});

afterEach(() => {
  handle.close();
});

describe('the three callers go through one owner', () => {
  it('a chat turn is admitted, connected, recorded and published', async () => {
    seedChatTurn();

    await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_chat',
        correlationId: 'corr_1',
        depth: 1,
      }),
    );

    const row = executionRow('exe_chat');
    expect(row.status, `the turn did not finish: ${row.error ?? ''}`).toBe('completed');
    expect(row.error).toBeNull();
    expect(row.finishedAt).not.toBeNull();
    expect(row.spendUnits).toBe(1);

    // The run was admitted against a capability set.
    expect(row.capabilityView?.agentConnectionId).toBe('agt_1');

    // The runtime was connected before it was sent to: the server's own
    // record of the order it was reached in.
    const trace = serverTrace();
    expect(trace).toContain('initialize');
    expect(trace).toContain('tools/call');
    expect(trace.indexOf('initialize')).toBeLessThan(trace.indexOf('tools/call'));

    // The events are the ones the published vocabulary publishes.
    expect(publishedEventTypes()).toContain('execution.event');
  });

  it('a task turn is admitted, connected, recorded and published', async () => {
    seedTaskTurn();

    await executeJob(
      context,
      job('factory.execute', {
        taskId: 'tsk_1',
        executionId: 'exe_task',
        agentConnectionId: 'agt_1',
      }),
    );

    const row = executionRow('exe_task');
    expect(row.status, `the turn did not finish: ${row.error ?? ''}`).toBe('completed');
    expect(row.error).toBeNull();
    expect(row.finishedAt).not.toBeNull();
    expect(row.spendUnits).toBe(1);

    expect(row.capabilityView?.agentConnectionId).toBe('agt_1');

    const trace = serverTrace();
    expect(trace).toContain('initialize');
    expect(trace).toContain('tools/call');
    expect(trace.indexOf('initialize')).toBeLessThan(trace.indexOf('tools/call'));

    expect(publishedEventTypes()).toContain('execution.event');
  });

  it("an automation's run is admitted, connected, recorded and published", async () => {
    seedAutomationRun();

    await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

    // The run's execution row belongs to no conversation and to no task, so it
    // is the worker's own row and is found by the agent it ran on.
    const row = automationExecution();
    expect(row.status, `the run did not finish: ${row.error ?? ''}`).toBe('completed');
    expect(row.error).toBeNull();
    expect(row.finishedAt).not.toBeNull();
    expect(row.spendUnits).toBe(1);

    // The run was admitted against a capability set, even though nothing
    // admitted it before the worker did.
    expect((row.capabilityView as { agentConnectionId: string } | null)?.agentConnectionId).toBe(
      'agt_1',
    );

    const trace = serverTrace();
    expect(trace).toContain('initialize');
    expect(trace).toContain('tools/call');
    expect(trace.indexOf('initialize')).toBeLessThan(trace.indexOf('tools/call'));

    expect(publishedEventTypes()).toContain('execution.event');
  });

  it('a connection that is switched off is refused on every path', async () => {
    handle.db
      .update(agentConnections)
      .set({ enabled: false })
      .where(eq(agentConnections.id, 'agt_1'))
      .run();
    seedChatTurn();
    seedTaskTurn();
    seedAutomationRun();

    await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_chat',
        correlationId: 'corr_1',
        depth: 1,
      }),
    );
    await executeJob(
      context,
      job('factory.execute', {
        taskId: 'tsk_1',
        executionId: 'exe_task',
        agentConnectionId: 'agt_1',
      }),
    );
    await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

    for (const { path, row } of theThreeRows()) {
      expect(row.status, `the ${path} turn`).toBe('failed');
      expect(row.error, `the ${path} turn`).toMatch(/disabled/i);
      // Nothing reached the agent, so nothing was spent.
      expect(row.spendUnits, `the ${path} turn`).toBe(0);
    }
    expect(serverTrace()).toEqual([]);
  });

  it('a failed handshake blocks submission and records a failure on every path', async () => {
    // A server that refuses the handshake is a server the turn cannot be
    // submitted to. The owner has to say so, on every path, with a reason the
    // owner can act on.
    agentEnvironment({ MCP_FIXTURE_REFUSE_HANDSHAKE: '1' });
    seedChatTurn();
    seedTaskTurn();
    seedAutomationRun();

    await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_chat',
        correlationId: 'corr_1',
        depth: 1,
      }),
    );
    await executeJob(
      context,
      job('factory.execute', {
        taskId: 'tsk_1',
        executionId: 'exe_task',
        agentConnectionId: 'agt_1',
      }),
    );
    await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

    for (const { path, row } of theThreeRows()) {
      expect(row.status, `the ${path} turn did not record a failure`).toBe('failed');
      // The reason names what went wrong, so the owner knows what to do.
      expect(row.error, `the ${path} turn`).toMatch(/connect|handshake|reach/i);
      expect(row.finishedAt, `the ${path} turn`).not.toBeNull();
    }

    // The turn was never submitted: the server was never asked to do anything.
    expect(serverTrace()).not.toContain('tools/call');
  });

  it('a configuration that cannot be read fails the run on every path', async () => {
    // The configuration is read inside the turn, so a configuration that cannot
    // be read is a turn that failed. The record of the run has to say that: a
    // row still saying `running` is a run that looks like it is going when it
    // finished a second ago.
    runtime.resolveSecret = async () => undefined;
    seedChatTurn();
    seedTaskTurn();
    seedAutomationRun();

    await executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_parent',
        agentConnectionId: 'agt_1',
        executionId: 'exe_chat',
        correlationId: 'corr_1',
        depth: 1,
      }),
    );
    await executeJob(
      context,
      job('factory.execute', {
        taskId: 'tsk_1',
        executionId: 'exe_task',
        agentConnectionId: 'agt_1',
      }),
    );
    await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

    for (const { path, row } of theThreeRows()) {
      expect(row.status, `the ${path} run was left looking like it was still going`).toBe('failed');
      expect(row.error, `the ${path} run`).toMatch(/configuration/i);
      expect(row.finishedAt, `the ${path} run was left without an end`).not.toBeNull();
    }

    // A task turn and an automation's run have no message of their own, so a
    // turn that never reached the agent costs nothing. A chat turn has already
    // opened its reply, and a conversation turn is that one message — which is
    // the rule the spend has always counted by.
    expect(executionRow('exe_task').spendUnits, 'the task turn').toBe(0);
    expect(automationExecution().spendUnits, "the automation's run").toBe(0);
    expect(executionRow('exe_chat').spendUnits, 'the chat turn').toBe(1);
  });

  it('the executor holds no part of the lifecycle', () => {
    const source = readFileSync(
      path.join(findRepoRoot(), 'apps', 'worker', 'src', 'executor.ts'),
      'utf8',
    );

    // A caller that builds, connects or releases an adapter is a caller that
    // can be made to skip the owner and still work.
    for (const marker of [
      'registry.create',
      'connectForTurn',
      'releaseTurn',
      'adapterTimeout',
      'loadAdapterConfig',
      'readExternalSessionId',
      'readExternalTaskId',
    ]) {
      expect(source, `the executor still owns "${marker}"`).not.toContain(marker);
    }

    // The same holds for the lifecycle a caller could re-implement through the
    // published API instead of through the owner's helpers: connecting a
    // runtime, releasing one, or writing the end of a run.
    for (const marker of ['adapter.connect(', 'adapter.close(', 'finishedAt:']) {
      expect(source, `the executor still owns "${marker}"`).not.toContain(marker);
    }

    // The executor may write to an execution row — the external reference is
    // the adapter's to offer — but the state of the run belongs to the owner.
    const executionWrites = source.match(/update\(executions\)[^;]*?;/g) ?? [];
    for (const write of executionWrites) {
      expect(write, 'the executor writes the state of an execution row').not.toMatch(
        /status|error|spendUnits|finishedAt/,
      );
    }

    // And the owner holds all of it.
    const owner = readFileSync(
      path.join(findRepoRoot(), 'apps', 'worker', 'src', 'execution-owner.ts'),
      'utf8',
    );
    for (const marker of ['registry.create', 'connectForTurn', 'releaseTurn', 'adapterTimeout']) {
      expect(owner, `the owner does not hold "${marker}"`).toContain(marker);
    }
  });
});
