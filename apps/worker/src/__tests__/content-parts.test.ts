import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  agentConnections,
  conversations,
  createDatabase,
  executions,
  messages,
  participants,
  resourceFiles,
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
  AgentExecutionStatus,
  AgentTurnInput,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * A message's parts reach the turn.
 *
 * A file the owner attached is resolved by the worker, because an adapter is
 * given a reference it cannot follow. A connection that cannot carry
 * attachments is sent the text and nothing else — and the turn says so, so an
 * agent is never left answering as if it had read a file it never saw.
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

/** An agent that records what it was given. */
class RecordingAdapter implements AgentAdapter {
  readonly type = 'echo' as const;
  readonly turns: AgentTurnInput[] = [];

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return CAPABILITIES;
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    this.turns.push(input);
    yield {
      type: 'message.completed',
      executionId: input.executionId,
      text: 'I have read it.',
    };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }

  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return { executionId, status: 'completed' };
  }
}

let handle: DatabaseHandle;
let runtime: Runtime;
let context: ExecutorContext;
let adapter: RecordingAdapter;
let filePath = '';
let dataDir = '';

const NOW = '2026-01-01T00:00:00.000Z';

function seed(capabilities: AgentCapabilities): void {
  const db = handle.db;

  db.insert(conversations)
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

  db.insert(participants)
    .values({
      id: 'p_1',
      conversationId: 'cnv_1',
      type: 'agent',
      agentConnectionId: 'agt_1',
      displayName: 'The agent',
      joinedAt: NOW,
    })
    .run();

  db.insert(agentConnections)
    .values({
      id: 'agt_1',
      workspaceId: 'wsp_1',
      name: 'The agent',
      adapterType: 'echo',
      configRef: 'cfg_1',
      toolGrants: null,
      enabled: true,
      capabilities,
      status: 'unknown',
      lastError: null,
      lastConnectedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(resources)
    .values({
      id: 'res_1',
      workspaceId: 'wsp_1',
      type: 'document',
      schemaVersion: 1,
      revision: 1,
      title: 'notes.txt',
      data: { kind: 'file', filename: 'notes.txt', mimeType: 'text/plain', size: 20 },
      createdBy: 'usr_1',
      templateId: null,
      templateVersion: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(resourceFiles)
    .values({
      id: 'rfile_1',
      resourceId: 'res_1',
      path: filePath,
      mimeType: 'text/plain',
      size: 20,
      createdAt: NOW,
    })
    .run();

  db.insert(messages)
    .values({
      id: 'msg_parent',
      conversationId: 'cnv_1',
      senderId: 'p_1',
      targetParticipantIds: [],
      replyToId: null,
      kind: 'text',
      content: [
        { type: 'text', text: 'What does the attached file say?' },
        { type: 'file', resourceId: 'res_1' },
      ],
      status: 'complete',
      correlationId: 'cor_1',
      origin: null,
      executionId: null,
      createdAt: NOW,
    })
    .run();

  db.insert(executions)
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

function job(): Parameters<typeof executeJob>[1] {
  return {
    id: 'job_1',
    workspaceId: 'wsp_1',
    type: 'chat.turn',
    payload: {
      conversationId: 'cnv_1',
      agentConnectionId: 'agt_1',
      executionId: 'exe_1',
      parentMessageId: 'msg_parent',
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
  };
}

beforeEach(() => {
  handle = createDatabase(':memory:');
  runMigrations(handle.db);

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-parts-'));
  filePath = path.join(dataDir, 'notes.txt');
  fs.writeFileSync(filePath, 'the file says hello');

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
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("a message's parts", () => {
  it('reach a turn whose connection can carry them', async () => {
    seed({ ...CAPABILITIES, acceptsAttachments: true });

    await executeJob(context, job());

    const turn = adapter.turns[0];
    expect(turn?.parts).toEqual([
      {
        type: 'file',
        resourceId: 'res_1',
        filename: 'notes.txt',
        mimeType: 'text/plain',
        text: 'the file says hello',
      },
    ]);
  });

  it('do not reach a turn whose connection cannot carry them', async () => {
    seed(CAPABILITIES);

    await executeJob(context, job());

    const turn = adapter.turns[0];
    // The text is still there. The file is not, and it is not pretended to be.
    expect(turn?.message).toContain('What does the attached file say?');
    expect(turn?.parts).toBeUndefined();
    expect(turn?.context).toContain('notes.txt');
    expect(turn?.context).toContain('cannot carry attachments');
  });

  it('are resolved even when the owner also attached the file by name', async () => {
    seed({ ...CAPABILITIES, acceptsAttachments: true });

    handle.db
      .update(messages)
      .set({
        content: [
          { type: 'text', text: 'Read it' },
          {
            type: 'attachment',
            resourceId: 'res_1',
            displayName: 'the notes',
            mimeType: 'text/plain',
          },
        ],
      })
      .run();

    await executeJob(context, job());

    const file = adapter.turns[0]?.parts?.find((part) => part.type === 'file');
    expect(file).toBeDefined();
    expect(file && 'filename' in file ? file.filename : null).toBe('the notes');
    expect(file && 'text' in file ? file.text : null).toBe('the file says hello');
  });

  it('are not carried twice: the message keeps the words', async () => {
    seed({ ...CAPABILITIES, acceptsAttachments: true });

    await executeJob(context, job());

    const turn = adapter.turns[0];
    // The message is the owner's words. A part carrying them again would have
    // the runtime read the question twice, so the turn carries the file and
    // the message keeps the words.
    expect(turn?.message).toContain('What does the attached file say?');
    expect(turn?.parts).toHaveLength(1);
    expect(turn?.parts?.[0]?.type).toBe('file');
  });

  it('are left out with the true reason when the bytes are not text', async () => {
    seed({ ...CAPABILITIES, acceptsAttachments: true });
    // A file whose bytes are not text cannot be carried, and the route is not
    // the reason: a turn that says otherwise sends the agent looking for a
    // fault that is not there.
    fs.writeFileSync(filePath, 'the file says hello\u0000 and more');

    await executeJob(context, job());

    const turn = adapter.turns[0];
    expect(turn?.parts).toBeUndefined();
    expect(turn?.context).toContain('notes.txt');
    expect(turn?.context).toContain('its bytes are not text');
    expect(turn?.context).not.toContain('This route cannot carry attachments');
  });
});
