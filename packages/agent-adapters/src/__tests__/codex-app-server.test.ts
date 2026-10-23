import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection, type AgentEvent } from '@personal-os/contracts';
import {
  CodexAppServerAdapter,
  appServerApprovalFor,
  appServerToolFor,
  mapAppServerNotification,
} from '../codex-app-server.js';
import type { AdapterContext } from '../types.js';

/**
 * The App Server adapter.
 *
 * The App Server is a different protocol from the command line route: it has
 * threads, turns, steers and approval requests of its own. These tests drive
 * the adapter against a double that speaks the protocol, and they check the
 * two things that matter: that the runtime's own vocabulary becomes the
 * product's, and that the session, the steer and the approval really travel.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, 'fixtures', 'fake-app-server.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

const connection: AgentConnection = {
  id: 'agt_1',
  name: 'The agent',
  adapterType: 'codex-app-server',
  configRef: 'cfg_1',
  enabled: true,
};

let storePath = '';

interface Store {
  threads: string[];
  started: Array<{ threadId: string; params: unknown }>;
  resumed: Array<{ threadId: string; params: unknown }>;
  turns: Array<{ turnId: string; threadId: string; input: unknown }>;
  steers: Array<{ params: unknown }>;
  approvals: Array<{ threadId: string; turnId: string; command: string; decision: unknown }>;
  interrupts: Array<{ params: unknown }>;
}

function store(): Store {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
}

function createAdapter(env: Record<string, string> = {}): CodexAppServerAdapter {
  const config = parseAdapterConfig({
    adapterType: 'codex-app-server',
    command: process.execPath,
    args: [serverPath],
    cwd: here,
    env: { FAKE_APP_SERVER_STORE: storePath, ...env },
    ephemeral: false,
    timeoutSeconds: 30,
  });
  return new CodexAppServerAdapter(config as never, ctx);
}

/** A channel the owner's steers arrive on. */
class SteerChannel {
  private readonly messages: string[] = [];
  private readonly waiters: Array<(value: IteratorResult<string>) => void> = [];

  push(message: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: message, done: false });
      return;
    }
    this.messages.push(message);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    for (;;) {
      const message = this.messages.shift();
      if (message !== undefined) {
        yield message;
        continue;
      }
      const next = await new Promise<IteratorResult<string>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-appserver-')), 'store.json');
  fs.writeFileSync(
    storePath,
    JSON.stringify({
      threads: [],
      started: [],
      resumed: [],
      turns: [],
      steers: [],
      approvals: [],
      interrupts: [],
    }),
  );
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('the App Server adapter', () => {
  it('answers the handshake and reports what it can do', async () => {
    const adapter = createAdapter();

    const capabilities = await adapter.connect(connection);

    expect(capabilities.chat).toBe(true);
    expect(capabilities.streaming).toBe(true);
    expect(capabilities.persistentSessions).toBe(true);
    expect(capabilities.acceptsSteering).toBe(true);
    // The App Server asks the owner for permission, and the adapter surfaces
    // the request, so the connection may be asked.
    expect(capabilities.approvals).toBe(true);
    // A file Codex changed is a file on disk, not a resource the product holds.
    expect(capabilities.artifacts).toBe(false);

    await adapter.close?.();
  });

  it('says it cannot ask for permission when the runtime may not ask', async () => {
    const config = parseAdapterConfig({
      adapterType: 'codex-app-server',
      command: process.execPath,
      args: [serverPath],
      cwd: here,
      env: { FAKE_APP_SERVER_STORE: storePath },
      approvalPolicy: 'never',
      timeoutSeconds: 30,
    });
    const adapter = new CodexAppServerAdapter(config as never, ctx);

    const capabilities = await adapter.connect(connection);

    // A connection that says it may ask is a connection that can ask.
    expect(capabilities.approvals).toBe(false);

    await adapter.close?.();
  });

  it('refuses a turn it was never connected for', async () => {
    const adapter = createAdapter();

    const events: AgentEvent[] = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }

    const failure = events.find((event) => event.type === 'execution.error');
    expect(failure?.type === 'execution.error' ? failure.code : '').toBe('adapter_not_connected');
  });

  it('turns the runtime’s events into the product’s events', async () => {
    const adapter = createAdapter();
    await adapter.connect(connection);

    const events: AgentEvent[] = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }
    await adapter.close?.();

    expect(events.some((event) => event.type === 'tool.started')).toBe(true);
    expect(
      events.some((event) => event.type === 'tool.completed' && event.toolName === 'command'),
    ).toBe(true);
    const delta = events.find((event) => event.type === 'message.delta');
    expect(delta?.type === 'message.delta' ? delta.text : '').toBe('APP-SERVER-OK');
    const completed = events.find((event) => event.type === 'message.completed');
    expect(completed?.type === 'message.completed' ? completed.text : '').toBe('APP-SERVER-OK');
    expect(
      events.some((event) => event.type === 'execution.status' && event.status === 'completed'),
    ).toBe(true);
  });

  it('keeps the thread as the session the next turn continues', async () => {
    const first = createAdapter();
    await first.connect(connection);

    for await (const event of first.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      void event;
    }

    const status = await first.getStatus('exe_1');
    const threadId = status.externalRef;
    expect(threadId).toBe(store().threads[0]);
    await first.close?.();

    // The next turn in the same conversation goes back into the same thread.
    // The worker builds a fresh adapter for it, so the thread is resumed
    // through the runtime rather than remembered by an instance.
    const second = createAdapter();
    await second.connect(connection);
    const restored = await second.resumeSession(connection, threadId ?? '');
    expect(restored).toBe(threadId);

    for await (const event of second.send({
      conversationId: 'cnv_1',
      message: 'The owner approved this operation. Continue.',
      context: '',
      executionId: 'exe_2',
      externalSessionId: threadId,
    })) {
      void event;
    }

    expect(store().resumed.map((entry) => entry.threadId)).toContain(threadId);
    // It was the same thread, not a new one.
    expect(store().threads).toHaveLength(1);
    expect(store().turns.map((entry) => entry.threadId)).toEqual([threadId, threadId]);

    await second.close?.();
  });

  it('puts the runtime back into a session it was given', async () => {
    const adapter = createAdapter();
    await adapter.connect(connection);

    const restored = await adapter.resumeSession(connection, 'thread_1');

    expect(restored).toBe('thread_1');
    expect(store().resumed.map((entry) => entry.threadId)).toContain('thread_1');

    await adapter.close?.();
  });

  it('steers the turn that is running', async () => {
    const adapter = createAdapter({ FAKE_APP_SERVER_TURN_DELAY_MS: '400' });
    await adapter.connect(connection);

    const steers = new SteerChannel();
    const run = (async () => {
      for await (const event of adapter.send({
        conversationId: 'cnv_1',
        message: 'Do the thing',
        context: '',
        executionId: 'exe_1',
        steer: steers,
      })) {
        void event;
      }
    })();

    await delay(120);
    steers.push('also say STEER-OK');
    await run;

    expect(store().steers).toHaveLength(1);
    const steer = store().steers[0]?.params as { expectedTurnId?: string; input?: unknown };
    expect(steer.expectedTurnId).toBe(store().turns[0]?.turnId);

    await adapter.close?.();
  });

  it('surfaces the runtime’s approval request and answers it', async () => {
    const adapter = createAdapter({ FAKE_APP_SERVER_APPROVAL: '1' });
    await adapter.connect(connection);

    const events: AgentEvent[] = [];
    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: '',
      executionId: 'exe_1',
    })) {
      events.push(event);
    }

    const approval = events.find((event) => event.type === 'approval.requested');
    expect(approval).toBeDefined();
    expect(approval?.type === 'approval.requested' ? approval.summary : '').toContain('npm test');
    expect(approval?.type === 'approval.requested' ? approval.approvalId : '').not.toBe('');

    // The runtime was answered: the turn is suspended the moment the owner is
    // asked, so the runtime cannot be left waiting.
    expect(store().approvals).toHaveLength(1);
    expect(store().approvals[0]?.decision).toEqual({ decision: 'cancel' });

    await adapter.close?.();
  });
});

describe('the App Server mapping', () => {
  it('reads the tool activity the runtime reports', () => {
    const tool = appServerToolFor({
      type: 'commandExecution',
      command: 'npm test',
      aggregatedOutput: 'ok',
      exitCode: 0,
      status: 'completed',
    });

    expect(tool?.name).toBe('command');
    expect(tool?.input).toEqual({ command: 'npm test' });
  });

  it('has no word for an item that is not an action', () => {
    expect(appServerToolFor({ type: 'reasoning' })).toBeNull();
    expect(appServerToolFor({ type: 'plan' })).toBeNull();
    expect(appServerToolFor(undefined)).toBeNull();
  });

  it('turns the assistant’s text into a delta', () => {
    const events = mapAppServerNotification(
      'item/agentMessage/delta',
      { delta: 'hello' },
      { executionId: 'exe_1', finalText: '' },
    );

    expect(events).toEqual([{ type: 'message.delta', executionId: 'exe_1', text: 'hello' }]);
  });

  it('believes the runtime about how the turn ended', () => {
    const failed = mapAppServerNotification(
      'turn/completed',
      { turn: { status: 'failed', error: { message: 'the model refused' } } },
      { executionId: 'exe_1', finalText: '' },
    );
    expect(
      failed.some((event) => event.type === 'execution.status' && event.status === 'failed'),
    ).toBe(true);

    const interrupted = mapAppServerNotification(
      'turn/completed',
      { turn: { status: 'interrupted' } },
      { executionId: 'exe_1', finalText: '' },
    );
    expect(
      interrupted.some(
        (event) => event.type === 'execution.status' && event.status === 'cancelled',
      ),
    ).toBe(true);

    const completed = mapAppServerNotification(
      'turn/completed',
      { turn: { status: 'completed' } },
      { executionId: 'exe_1', finalText: 'the answer' },
    );
    expect(completed).toEqual([
      { type: 'message.completed', executionId: 'exe_1', text: 'the answer' },
      { type: 'execution.status', executionId: 'exe_1', status: 'completed' },
    ]);
  });

  it('answers the runtime’s approvals with a refusal, because the owner has not decided', () => {
    const approval = appServerApprovalFor(
      'item/commandExecution/requestApproval',
      { command: 'npm test' },
      'apr_1',
    );

    expect(approval?.approvalId).toBe('apr_1');
    expect(approval?.summary).toContain('npm test');
    expect(approval?.decision).toEqual({ decision: 'cancel' });
  });

  it('has no answer for a request it does not know', () => {
    expect(appServerApprovalFor('something/else', {}, 'apr_1')).toBeNull();
  });
});
