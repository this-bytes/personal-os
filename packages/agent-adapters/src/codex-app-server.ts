import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentExecutionStatus,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import { AdapterLifecycle, notConnectedEvent } from './lifecycle.js';
import { JsonRpcStdioClient } from './jsonrpc.js';
import { buildSanitizedEnv, resolveExecutable, spawnExecutable } from './util.js';

/**
 * OpenAI Codex, as its App Server.
 *
 * **The App Server is not the command line route.** `codex.ts` reads a JSONL
 * event stream from `codex exec`; this adapter speaks a JSON-RPC service that
 * Codex exposes over standard input and output, with threads, turns, steers and
 * approval requests of its own. The two surfaces are different protocols, so
 * they have different adapters, and this one is written against the App
 * Server's own schema — the pinned subset of it is in
 * `docs/protocols/codex-app-server/`.
 *
 * **The credential stays in Codex.** Codex signs in with its own account and
 * keeps that sign-in in its own home directory, so the supervised process
 * inherits the owner's home and nothing else, and this adapter holds no secret
 * of its own.
 *
 * The mapping is a pure function. A mapping that could only be tested by
 * running Codex would be a mapping nobody would test, so the mapping is
 * separated from the process that produces the events — the same shape
 * `codex.ts` uses.
 */

/** The item kinds the App Server reports, as far as this route reads them. */
export interface AppServerItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregatedOutput?: string;
  exitCode?: number | null;
  status?: string;
  server?: string;
  tool?: string;
  arguments?: unknown;
  result?: unknown;
  changes?: unknown;
  query?: string;
}

/** The parts of an App Server notification this adapter reads. */
export interface AppServerNotification {
  threadId?: string;
  turnId?: string;
  item?: AppServerItem;
  delta?: string;
  turn?: {
    id?: string;
    status?: string;
    error?: { message?: string } | null;
  };
}

/** The parts of an App Server approval request this adapter reads. */
export interface AppServerApprovalParams {
  approvalId?: string | null;
  command?: string[] | string | null;
  cwd?: string | null;
  reason?: string | null;
  fileChanges?: unknown;
  permissions?: unknown;
  threadId?: string;
  turnId?: string;
}

/** The tool an App Server item stands for, in the product's vocabulary. */
export interface AppServerTool {
  /** The name the trace row carries. */
  name: string;
  /** What the tool was asked to do. */
  input?: unknown;
  /** What the tool did. */
  output?: unknown;
}

/**
 * The tool an App Server item stands for, or nothing when the item is not a
 * tool.
 *
 * An item the product has no word for is not invented into one: a plan, a
 * reasoning note and a token count are not actions, and the trace records
 * actions.
 */
export function appServerToolFor(item: AppServerItem | undefined): AppServerTool | null {
  switch (item?.type) {
    case 'commandExecution':
      return {
        name: 'command',
        input: { command: item.command ?? '' },
        output: {
          command: item.command ?? '',
          exit_code: item.exitCode ?? null,
          output: item.aggregatedOutput ?? '',
          status: item.status ?? 'unknown',
        },
      };
    case 'fileChange':
      return {
        name: 'file_change',
        input: { changes: item.changes ?? null },
        output: { changes: item.changes ?? null },
      };
    case 'mcpToolCall':
      return {
        name: item.tool ? `mcp:${item.tool}` : 'mcp_tool',
        input: {
          server: item.server ?? null,
          tool: item.tool ?? null,
          arguments: item.arguments ?? null,
        },
        output: {
          server: item.server ?? null,
          tool: item.tool ?? null,
          result: item.result ?? null,
        },
      };
    case 'webSearch':
      return {
        name: 'web_search',
        input: { query: item.query ?? '' },
        output: { query: item.query ?? '' },
      };
    default:
      return null;
  }
}

/**
 * What one App Server notification means in the product's vocabulary.
 *
 * The mapping is deliberately narrow. The runtime reports the turn's outcome
 * itself — `completed`, `failed`, `interrupted` — and the adapter believes it.
 */
export function mapAppServerNotification(
  method: string,
  notification: AppServerNotification,
  context: { executionId: string; finalText: string },
): AgentEvent[] {
  const { executionId, finalText } = context;

  switch (method) {
    case 'item/agentMessage/delta': {
      const text = notification.delta ?? '';
      if (text.length === 0) return [];
      return [{ type: 'message.delta', executionId, text }];
    }
    case 'item/started': {
      const tool = appServerToolFor(notification.item);
      if (!tool) return [];
      return [{ type: 'tool.started', executionId, toolName: tool.name, input: tool.input }];
    }
    case 'item/completed': {
      const tool = appServerToolFor(notification.item);
      if (!tool) return [];
      return [{ type: 'tool.completed', executionId, toolName: tool.name, output: tool.output }];
    }
    case 'turn/completed': {
      const status = notification.turn?.status ?? 'completed';
      if (status === 'failed') {
        return [
          {
            type: 'execution.error',
            executionId,
            code: 'runtime_failed',
            message:
              notification.turn?.error?.message ?? 'The App Server reported that the turn failed.',
          },
          { type: 'execution.status', executionId, status: 'failed' },
        ];
      }
      if (status === 'interrupted') {
        return [{ type: 'execution.status', executionId, status: 'cancelled' }];
      }
      return [
        { type: 'message.completed', executionId, text: finalText },
        { type: 'execution.status', executionId, status: 'completed' },
      ];
    }
    default:
      // A thread that started and a turn that started are the adapter's own
      // business: the turn is already running by the time the runtime says so.
      return [];
  }
}

/**
 * The approval the runtime asked for, and the answer this adapter gives.
 *
 * **The answer is a refusal, and that is the truth of the moment.** The product
 * suspends the turn the moment the owner is asked, and the turn's process ends
 * with it, so the runtime cannot be left waiting for an answer that arrives
 * minutes later. The owner is asked in the panel, and the owner's decision
 * comes back as the next turn in the same thread — the thread keeps the
 * request in its history, so the agent sees both the request and the decision.
 */
export interface AppServerApproval {
  /** The product's approval identifier. */
  approvalId: string;
  /** The line the owner reads in the panel. */
  summary: string;
  /** The runtime's own request, for the details pane. */
  details: unknown;
  /** The answer sent back to the runtime. */
  decision: unknown;
}

/**
 * The approval a runtime request stands for, or nothing when the request is
 * not an approval this adapter answers.
 */
export function appServerApprovalFor(
  method: string,
  params: AppServerApprovalParams,
  approvalId: string,
): AppServerApproval | null {
  switch (method) {
    case 'execCommandApproval':
      return {
        approvalId,
        summary: `Run ${describeCommand(params.command)}`,
        details: { method, request: params },
        // "Abort" is the runtime's word for "do nothing until the user's next
        // command", and the owner's decision arrives as the next command.
        decision: { decision: 'abort' },
      };
    case 'applyPatchApproval':
      return {
        approvalId,
        summary: `Change ${countChanges(params.fileChanges)} file(s)`,
        details: { method, request: params },
        decision: { decision: 'abort' },
      };
    case 'item/commandExecution/requestApproval':
      return {
        approvalId,
        summary: `Run ${describeCommand(params.command)}`,
        details: { method, request: params },
        // "Cancel" is the runtime's word for "denied, and the turn is
        // interrupted" — which is exactly what a suspended turn is.
        decision: { decision: 'cancel' },
      };
    case 'item/fileChange/requestApproval':
      return {
        approvalId,
        summary: `Change ${countChanges(params.fileChanges)} file(s)`,
        details: { method, request: params },
        decision: { decision: 'cancel' },
      };
    case 'item/permissions/requestApproval':
      return {
        approvalId,
        summary: 'Grant additional permissions',
        details: { method, request: params },
        // The permissions asked for are not granted: the owner decides, and
        // the decision comes back in the thread.
        decision: { permissions: {}, scope: 'turn' },
      };
    default:
      return null;
  }
}

/** The command an approval request names, as the owner reads it. */
function describeCommand(command: string[] | string | null | undefined): string {
  if (Array.isArray(command)) return command.join(' ') || 'a command';
  if (typeof command === 'string' && command.length > 0) return command;
  return 'a command';
}

/** How many files a change request names, when it says. */
function countChanges(changes: unknown): number {
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const keys = Object.keys(changes as Record<string, unknown>);
    if (keys.length > 0) return keys.length;
  }
  if (Array.isArray(changes)) return changes.length;
  return 1;
}

/** The status an event ends a turn with. */
function isTerminalStatus(status: string): boolean {
  return (
    status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'unknown'
  );
}

/**
 * A queue the runtime's notifications write into and the turn reads from.
 *
 * The notifications arrive on the transport's own callback, and the turn is a
 * generator that yields events. The queue is the join between them.
 */
class EventQueue {
  private readonly items: AgentEvent[] = [];
  private readonly waiters: Array<(value: IteratorResult<AgentEvent>) => void> = [];
  private closed = false;

  push(event: AgentEvent): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: event, done: false });
      return;
    }
    this.items.push(event);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
    for (;;) {
      const item = this.items.shift();
      if (item) {
        yield item;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<AgentEvent>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

export class CodexAppServerAdapter implements AgentAdapter {
  readonly type = 'codex-app-server' as const;

  /** The App Server is a service: the turn runs on the one `connect()` started. */
  readonly holdsRuntime = true;

  private readonly config: Extract<AdapterConfig, { adapterType: 'codex-app-server' }>;
  private readonly ctx: AdapterContext;
  private readonly lifecycle = new AdapterLifecycle('Codex App Server');
  private client: JsonRpcStdioClient | null = null;
  /**
   * Where the command was found.
   *
   * The App Server is started from the resolved path rather than the bare name:
   * on Windows a bare name is not something a child process can start on its
   * own, because an npm-installed CLI is a `.cmd` shim.
   */
  private resolved: string | null = null;
  /** The thread the turn is in. It is the session the next turn continues. */
  private threadId: string | null = null;
  /** The turn that is running, which a steer is addressed to. */
  private turnId: string | null = null;
  /** What became of the turn, for the status the worker reads. */
  private turnStatus: AgentExecutionStatus['status'] | null = null;
  /** The assistant's text so far. */
  private finalText = '';
  /** How many approvals this adapter has raised, so their ids differ. */
  private approvalCount = 0;
  /** The queue the running turn's notifications write into. */
  private queue: EventQueue | null = null;

  constructor(
    config: Extract<AdapterConfig, { adapterType: 'codex-app-server' }>,
    ctx: AdapterContext,
  ) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const resolved = await resolveExecutable(this.config.command);
    if (!resolved) {
      const reason = `The command "${this.config.command}" was not found.`;
      this.ctx.logger.warn('Codex App Server executable not found', {
        command: this.config.command,
      });
      this.lifecycle.markFailed(reason);
      return {
        chat: false,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: false,
        approvals: false,
        artifacts: false,
      };
    }
    this.resolved = resolved;

    const client = new JsonRpcStdioClient(resolved, this.buildArgs(), {
      cwd: this.config.cwd ?? process.cwd(),
      env: buildSanitizedEnv(this.config.env),
      // The transport starts the process; the spawner that knows about a
      // platform's shims is the repository's own.
      spawn: spawnExecutable,
    });

    try {
      await client.request(
        'initialize',
        {
          clientInfo: { name: 'personal-os', title: 'Personal OS', version: '0.1.0' },
          capabilities: {},
        },
        30_000,
      );
    } catch (error) {
      const reason = `The App Server did not answer the handshake: ${describe(error)}`;
      this.ctx.logger.warn('Codex App Server handshake failed', { reason });
      this.lifecycle.markFailed(reason);
      await client.close();
      return {
        chat: false,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: false,
        approvals: false,
        artifacts: false,
      };
    }

    this.client = client;
    this.lifecycle.markConnected();

    return {
      chat: true,
      // The assistant's text arrives as the runtime produces it.
      streaming: true,
      // A thread survives only when Codex is allowed to keep it on disk.
      persistentSessions: !this.config.ephemeral,
      // A turn is a turn in the foreground.
      backgroundTasks: false,
      // A running turn can be interrupted.
      cancel: true,
      // The runtime only asks the owner for permission when it is allowed to.
      // A connection that says it may not ask reports that it may not.
      approvals: this.config.approvalPolicy !== 'never',
      // A file Codex changed is a file on disk, not a resource the product
      // holds, so there is no artifact to point at yet.
      artifacts: false,
      // The App Server takes input while a turn runs.
      acceptsSteering: true,
      // A file the owner attached is carried as text, because the protocol
      // has no item for a file with its content.
      acceptsAttachments: true,
      // A picture has an item of its own, and the route carries the bytes in
      // it.
      acceptsImages: true,
    };
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;

    if (!this.lifecycle.isConnected || !this.client) {
      yield { type: 'execution.status', executionId, status: 'running' };
      yield notConnectedEvent(executionId, this.lifecycle.message());
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    const client = this.client;
    const queue = new EventQueue();
    this.queue = queue;
    this.finalText = '';

    const detachNotification = client.onNotification((method, params) => {
      this.handleNotification(method, params, executionId, queue);
    });
    const detachRequest = client.onRequest((method, params) =>
      this.handleRequest(method, params, executionId, queue),
    );

    const onAbort = () => {
      void this.interruptTurn();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });

    const deadline = setTimeout(() => {
      queue.push({
        type: 'execution.error',
        executionId,
        code: 'adapter_timeout',
        message: `The App Server did not finish the turn within ${this.config.timeoutSeconds}s.`,
      });
      queue.push({ type: 'execution.status', executionId, status: 'failed' });
      queue.close();
      void this.interruptTurn();
    }, this.config.timeoutSeconds * 1000);

    yield { type: 'execution.status', executionId, status: 'running' };

    /** Whether the runtime said how the turn ended. */
    let ended = false;

    try {
      let threadId: string;
      try {
        threadId = input.externalSessionId
          ? await this.resumeThread(input.externalSessionId)
          : await this.startThread();
      } catch (error) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'codex_app_server_thread_failed',
          message: describe(error),
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }
      this.threadId = threadId;

      let turnId: string;
      try {
        const started = await client.request(
          'turn/start',
          {
            threadId,
            input: buildTurnInput(input),
            ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
          },
          this.config.timeoutSeconds * 1000,
        );
        turnId = readTurnId(started);
      } catch (error) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'codex_app_server_turn_failed',
          message: describe(error),
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }
      this.turnId = turnId;
      this.turnStatus = 'running';

      // The owner's steers, taken while this turn runs. The forwarding stops
      // when the turn ends, and a steer the runtime refuses is a steer that
      // did not arrive — not a failed turn.
      void this.forwardSteers(client, threadId, turnId, input);

      for await (const event of queue) {
        if (event.type === 'execution.status') {
          this.turnStatus = event.status;
          if (isTerminalStatus(event.status)) ended = true;
        }
        yield event;
      }
    } finally {
      clearTimeout(deadline);
      input.signal?.removeEventListener('abort', onAbort);
      detachNotification();
      detachRequest();
      queue.close();
      this.queue = null;
      if (!ended) await this.interruptTurn();
    }
  }

  /**
   * Put the runtime back into the session a decision continues in.
   *
   * The App Server's session is a thread, and `thread/resume` is how a thread
   * is re-entered. The thread id is what the execution carries as its external
   * reference, so the next turn in the same conversation resumes the same
   * thread.
   */
  async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
    if (!this.client) return externalSessionId;
    try {
      this.threadId = await this.resumeThread(externalSessionId);
    } catch (error) {
      this.ctx.logger.warn('The App Server did not resume the thread', {
        threadId: externalSessionId,
        reason: describe(error),
      });
      return externalSessionId;
    }
    return this.threadId;
  }

  /**
   * The session the turn is in, and what became of it.
   *
   * The thread id is the session: it is what a decision continues in, so it is
   * the execution's external reference.
   */
  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return {
      executionId,
      status: this.turnId ? 'running' : 'unknown',
      ...(this.threadId ? { externalRef: this.threadId } : {}),
    };
  }

  /** Stop the running turn. */
  async cancel(_executionId: string): Promise<void> {
    await this.interruptTurn();
  }

  /**
   * Release what this adapter holds.
   *
   * The App Server is a child process, and a turn that ends, fails or is
   * abandoned must not leave it behind.
   */
  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.lifecycle.markClosed();
    if (client) await client.close();
  }

  /**
   * The command line this adapter runs, as the owner would read it.
   *
   * The adapter builds the arguments itself, so a caller that wants to show
   * what will run asks the adapter rather than guessing.
   */
  describeCommand(): string {
    return [this.resolved ?? this.config.command, ...this.buildArgs()].join(' ');
  }

  /**
   * The command line, built from the configuration.
   *
   * `app-server` is the subcommand that speaks the protocol, and `stdio://` is
   * the transport it speaks it over.
   */
  private buildArgs(): string[] {
    return [...this.config.args, 'app-server', '--listen', 'stdio://'];
  }

  /** Start a thread and return its id. */
  private async startThread(): Promise<string> {
    const client = this.client;
    if (!client) throw new Error('The App Server is not connected.');

    const started = await client.request(
      'thread/start',
      {
        ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
        sandbox: this.config.sandbox,
        approvalPolicy: this.config.approvalPolicy,
        ephemeral: this.config.ephemeral,
        threadSource: this.config.threadSource,
        ...(this.config.model ? { model: this.config.model } : {}),
      },
      60_000,
    );

    const threadId = readThreadId(started);
    if (!threadId) throw new Error('The App Server started a thread without naming it.');
    return threadId;
  }

  /** Put the runtime back into a thread and return its id. */
  private async resumeThread(threadId: string): Promise<string> {
    const client = this.client;
    if (!client) throw new Error('The App Server is not connected.');
    if (this.threadId === threadId) return threadId;

    const resumed = await client.request(
      'thread/resume',
      {
        threadId,
        ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
        sandbox: this.config.sandbox,
        approvalPolicy: this.config.approvalPolicy,
        ...(this.config.model ? { model: this.config.model } : {}),
      },
      60_000,
    );

    this.threadId = readThreadId(resumed) ?? threadId;
    return this.threadId;
  }

  /** Interrupt the running turn, if a turn is running. */
  private async interruptTurn(): Promise<void> {
    const client = this.client;
    if (!client || !this.threadId || !this.turnId) return;
    try {
      await client.request(
        'turn/interrupt',
        { threadId: this.threadId, turnId: this.turnId },
        15_000,
      );
    } catch {
      // A runtime that will not be interrupted is a runtime that is already
      // gone, or one that is finishing on its own. Neither is a second failure
      // of the turn.
    }
  }

  /**
   * The owner's messages that arrive while the turn runs.
   *
   * A steer is the runtime's own `turn/steer`, addressed to the turn that is
   * running. A steer the runtime refuses is reported and dropped: the turn
   * carries on, and the owner's message stays in the conversation.
   */
  private async forwardSteers(
    client: JsonRpcStdioClient,
    threadId: string,
    turnId: string,
    input: AgentTurnInput,
  ): Promise<void> {
    const channel = input.steer;
    if (!channel) return;

    try {
      for await (const text of channel) {
        if (text.trim().length === 0) continue;
        try {
          await client.request(
            'turn/steer',
            { threadId, expectedTurnId: turnId, input: [{ type: 'text', text }] },
            30_000,
          );
        } catch (error) {
          this.ctx.logger.warn('The App Server did not take the steer', {
            reason: describe(error),
          });
        }
      }
    } catch {
      // The channel ended, or the turn ended first. Neither is a failure.
    }
  }

  /** Turn one notification into the product's events. */
  private handleNotification(
    method: string,
    params: unknown,
    executionId: string,
    queue: EventQueue,
  ): void {
    if (method === 'turn/started') {
      const turnId = readNotification(params).turn?.id;
      if (turnId) this.turnId = turnId;
      return;
    }

    if (method === 'item/agentMessage/delta') {
      const text = readNotification(params).delta ?? '';
      if (text.length === 0) return;
      this.finalText += text;
      queue.push({ type: 'message.delta', executionId, text });
      return;
    }

    for (const event of mapAppServerNotification(method, readNotification(params), {
      executionId,
      finalText: this.finalText,
    })) {
      queue.push(event);
      if (event.type === 'execution.status' && isTerminalStatus(event.status)) queue.close();
    }
  }

  /**
   * Answer one of the runtime's requests.
   *
   * An approval request becomes the product's own approval request, so the
   * owner's decision reaches the owner through the machinery that already
   * exists. The answer sent back is a refusal, because the turn is suspended
   * the moment the owner is asked; the owner's decision returns as the next
   * turn in the same thread.
   */
  private handleRequest(
    method: string,
    params: unknown,
    executionId: string,
    queue: EventQueue,
  ): unknown {
    const approval = appServerApprovalFor(
      method,
      readApprovalParams(params),
      this.nextApprovalId(executionId),
    );
    if (!approval) {
      throw new Error(`The App Server asked for "${method}", which this adapter does not answer.`);
    }

    queue.push({
      type: 'approval.requested',
      executionId,
      approvalId: approval.approvalId,
      summary: approval.summary,
      details: approval.details,
    });

    return approval.decision;
  }

  /** The next approval identifier, unique within the runtime's own ids. */
  private nextApprovalId(executionId: string): string {
    this.approvalCount += 1;
    const owner = this.turnId ?? this.threadId ?? executionId;
    return `apr_codex_${owner}_${this.approvalCount}`.slice(0, 128);
  }
}

export function createCodexAppServerAdapter(
  config: Extract<AdapterConfig, { adapterType: 'codex-app-server' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new CodexAppServerAdapter(config, ctx);
}

/** The prompt the runtime is asked, as the owner's message and the room's context. */
function buildPrompt(input: AgentTurnInput): string {
  return `${input.message}\n\n${input.context}`.trim();
}

/**
 * The turn's input, in the pinned protocol's own items.
 *
 * The protocol takes a text item, an image by url or by file id, a local image
 * by path, an audio by url, and a local audio by path. **It has no item for "a
 * file with its content",** so the content is carried as a text item that
 * names the file. That is the honest mapping: the route says it carries the
 * content, and the content is what the runtime receives.
 *
 * A picture has an item of its own, so it is carried as one: an image by url,
 * with the bytes as a data url. **Not a local image by path** — a path is a
 * path on the runtime's machine, and the rule is that the content travels.
 * Both shapes were measured against the installed runtime, and both were
 * taken; the path was not, for that reason.
 *
 * The owner's words are in the first item, with the room's context. They are
 * not carried twice: the turn's message is the words, and the parts are what
 * the words do not carry.
 */
export function buildTurnInput(input: AgentTurnInput): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [{ type: 'text', text: buildPrompt(input) }];

  for (const part of input.parts ?? []) {
    if (part.type === 'image') {
      items.push({
        type: 'image',
        url: `data:${part.mimeType};base64,${part.data}`,
      });
      continue;
    }
    items.push({
      type: 'text',
      text: `The owner attached "${part.filename}":\n\n${part.text}`,
    });
  }

  return items;
}

/** The thread id a response names, when it names one. */
function readThreadId(response: unknown): string | undefined {
  const record = asRecord(response);
  const thread = asRecord(record?.['thread']);
  return readString(thread?.['id']) ?? readString(record?.['threadId']);
}

/** The turn id a response names, when it names one. */
function readTurnId(response: unknown): string {
  const record = asRecord(response);
  const turn = asRecord(record?.['turn']);
  const id = readString(turn?.['id']) ?? readString(record?.['turnId']);
  if (!id) throw new Error('The App Server started a turn without naming it.');
  return id;
}

/** The notification's own fields, read defensively. */
function readNotification(params: unknown): AppServerNotification {
  const record = asRecord(params) ?? {};
  return {
    ...(readString(record['threadId']) ? { threadId: readString(record['threadId']) } : {}),
    ...(readString(record['turnId']) ? { turnId: readString(record['turnId']) } : {}),
    ...(readString(record['delta']) ? { delta: readString(record['delta']) } : {}),
    ...(asRecord(record['item']) ? { item: asRecord(record['item']) as AppServerItem } : {}),
    ...(asRecord(record['turn'])
      ? { turn: asRecord(record['turn']) as AppServerNotification['turn'] }
      : {}),
  };
}

/** The approval request's own fields, read defensively. */
function readApprovalParams(params: unknown): AppServerApprovalParams {
  const record = asRecord(params) ?? {};
  const command = record['command'];
  return {
    ...(readString(record['approvalId']) ? { approvalId: readString(record['approvalId']) } : {}),
    ...(typeof command === 'string' || Array.isArray(command)
      ? { command: command as string[] | string }
      : {}),
    ...(readString(record['cwd']) ? { cwd: readString(record['cwd']) } : {}),
    ...(readString(record['reason']) ? { reason: readString(record['reason']) } : {}),
    ...(record['fileChanges'] !== undefined ? { fileChanges: record['fileChanges'] } : {}),
    ...(record['permissions'] !== undefined ? { permissions: record['permissions'] } : {}),
    ...(readString(record['threadId']) ? { threadId: readString(record['threadId']) } : {}),
    ...(readString(record['turnId']) ? { turnId: readString(record['turnId']) } : {}),
  };
}

/** A JSON value as a record, when it is one. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** A string, when the value is one. */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** An error, as a sentence. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
