import type { ChildProcessWithoutNullStreams } from 'node:child_process';
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
import { buildSanitizedEnv, resolveExecutable, spawnExecutable, terminateChild } from './util.js';

/**
 * Pi, as its own RPC session.
 *
 * **Pi is not the command line route.** The generic `cli` adapter starts a
 * process and writes the prompt to it, and Pi's protocol carries more than a
 * prompt: the streaming text, the tools it ran, whether it has settled, the
 * session it is in, and a steer that arrives while it is working. So Pi has
 * its own adapter, written against its own protocol — the JSONL records it
 * writes to standard input and reads from standard output.
 *
 * **The protocol's own rules are the adapter's rules.** Pi frames its records
 * as strict JSONL: one object per line, split on LF only, because a record may
 * contain the Unicode line and paragraph separators that a generic line reader
 * would treat as a boundary. The mapping is a pure function, so it can be
 * tested without a runtime, and the process that produces the records is
 * separate from the mapping that reads them.
 *
 * **The credential stays in Pi.** Pi signs in with its own account and keeps
 * that sign-in in its own home directory, so this adapter holds no secret of
 * its own and the supervised process inherits the owner's home and nothing
 * else.
 */

/** A record on Pi's wire: a command, a response, or a session event. */
export interface PiRecord {
  /** The record's kind. A command names what it does; an event names what happened. */
  type?: string;
  /** The command's id, which its response repeats. */
  id?: string;
  /** The command a response answers. */
  command?: string;
  /** Whether the command succeeded. */
  success?: boolean;
  /** The command's data, or the event's payload. */
  data?: unknown;
  /** Why a command failed. */
  error?: string;
  [key: string]: unknown;
}

type PiRecordHandler = (record: PiRecord) => void;

/**
 * A client for Pi's JSONL protocol over standard input and output.
 *
 * Commands go in, responses and events come out. A response is matched to its
 * command by the id the command carried, because Pi answers commands
 * asynchronously and not in the order they were sent.
 */
export class PiRpcClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly handlers = new Set<PiRecordHandler>();
  private readonly pending = new Map<
    string,
    { resolve: (value: PiRecord) => void; reject: (error: Error) => void }
  >();
  private buffer = '';
  private nextId = 1;
  private closed = false;

  constructor(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }) {
    this.child = spawnExecutable(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env,
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.consume(chunk));
    // Diagnostics go to stderr, and stderr is not protocol data.
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.resume();

    this.child.on('error', (error) => {
      this.closed = true;
      const failure = error instanceof Error ? error : new Error(String(error));
      for (const [, entry] of this.pending) entry.reject(failure);
      this.pending.clear();
    });

    this.child.on('close', () => {
      this.closed = true;
      for (const [, entry] of this.pending) {
        entry.reject(new Error('Pi closed its protocol before a response arrived.'));
      }
      this.pending.clear();
    });
  }

  /** Handle every record that is not a response to one of this client's commands. */
  onRecord(handler: PiRecordHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Send a command and wait for its response.
   *
   * A command that Pi refuses is a command that failed, and the refusal says
   * why. A transport that has closed is a failure too, and the caller hears
   * about it instead of waiting.
   */
  async command(record: Record<string, unknown>, timeoutMs = 120_000): Promise<PiRecord> {
    if (this.closed) throw new Error('Pi closed its protocol.');
    const id = `pos-${this.nextId++}`;
    const payload = JSON.stringify({ id, ...record });

    return new Promise<PiRecord>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Pi did not answer the "${String(record['type'])}" command within ${Math.round(timeoutMs / 1000)}s.`,
          ),
        );
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.child.stdin.write(`${payload}\n`, 'utf8');
    });
  }

  /** Stop the child and wait until it is gone. */
  async close(): Promise<void> {
    this.closed = true;
    // Pi shuts down when its standard input closes, and the wait is what makes
    // the process really gone.
    this.child.stdin.end();
    await terminateChild(this.child);
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index).replace(/\r$/, '');
      this.buffer = this.buffer.slice(index + 1);
      if (line.trim().length === 0) continue;
      this.dispatch(line);
    }
  }

  private dispatch(line: string): void {
    let record: PiRecord;
    try {
      record = JSON.parse(line) as PiRecord;
    } catch {
      return; // Anything that is not a record is chatter, and chatter is not protocol.
    }

    if (record.type === 'response' && typeof record.id === 'string') {
      const entry = this.pending.get(record.id);
      if (!entry) return;
      this.pending.delete(record.id);
      entry.resolve(record);
      return;
    }

    for (const handler of this.handlers) handler(record);
  }
}

/**
 * The events one of Pi's records produces.
 *
 * A pure function, so the mapping can be tested without a runtime — a mapping
 * that could only be tested by running Pi would be a mapping nobody would
 * test.
 */
export function mapPiEvent(
  record: PiRecord,
  context: { executionId: string; finalText: string },
): AgentEvent[] {
  const { executionId } = context;

  if (record.type === 'message_update') {
    const update = record['assistantMessageEvent'] as Record<string, unknown> | undefined;
    if (update?.['type'] !== 'text_delta') return [];
    const delta = update['delta'];
    if (typeof delta !== 'string' || delta.length === 0) return [];
    return [{ type: 'message.delta', executionId, text: delta }];
  }

  if (record.type === 'message_end') {
    const message = record['message'] as Record<string, unknown> | undefined;
    if (!message || message['role'] !== 'assistant') return [];
    // The completed message is the authoritative one, and the text it holds is
    // the answer the room shows.
    const text = textOf(message['content']) || context.finalText;
    return [{ type: 'message.completed', executionId, text }];
  }

  if (record.type === 'tool_execution_start') {
    const toolName = record['toolName'];
    if (typeof toolName !== 'string') return [];
    return [
      {
        type: 'tool.started',
        executionId,
        toolName,
        ...(record['args'] !== undefined ? { input: record['args'] } : {}),
      },
    ];
  }

  if (record.type === 'tool_execution_end') {
    const toolName = record['toolName'];
    if (typeof toolName !== 'string') return [];
    return [
      {
        type: 'tool.completed',
        executionId,
        toolName,
        ...(record['result'] !== undefined ? { output: record['result'] } : {}),
      },
    ];
  }

  return [];
}

/**
 * The text of a message's content.
 *
 * A message holds blocks, and the text is in the blocks that are text. A
 * message whose blocks are something else — a tool call, a thought — has no
 * text of its own, and the caller falls back to what was streamed.
 */
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    if (record['type'] !== 'text') continue;
    const text = record['text'];
    if (typeof text === 'string') parts.push(text);
  }
  return parts.join('');
}

/**
 * The arguments Pi's command line takes to become a session.
 *
 * The arguments that make Pi a session are the adapter's own, so a connection
 * that names its own `--mode` is refused rather than silently starting a
 * different surface.
 */
export function piArgs(config: {
  args: string[];
  ephemeral: boolean;
  provider?: string;
  model?: string;
}): string[] {
  if (config.args.includes('--mode') || config.args.includes('--no-session')) {
    throw new Error(
      'The Pi route starts Pi in RPC mode itself, so the arguments may not name "--mode" or "--no-session".',
    );
  }
  const args = [...config.args, '--mode', 'rpc'];
  if (config.ephemeral) args.push('--no-session');
  if (config.provider) args.push('--provider', config.provider);
  if (config.model) args.push('--model', config.model);
  return args;
}

/** The prompt the turn sends, in Pi's own shape. */
export function buildPiPrompt(input: AgentTurnInput): {
  message: string;
  images: Array<{ type: 'image'; data: string; mimeType: string }>;
} {
  const files = (input.parts ?? [])
    .filter((part): part is Extract<typeof part, { type: 'file' }> => part.type === 'file')
    .map((part) => `--- ${part.filename} ---\n${part.text}`);
  const pictures = (input.parts ?? [])
    .filter((part): part is Extract<typeof part, { type: 'image' }> => part.type === 'image')
    .map((part) => ({ type: 'image' as const, data: part.data, mimeType: part.mimeType }));

  const sections = [input.message, input.context, ...files].filter(
    (section) => section.trim().length > 0,
  );
  return { message: sections.join('\n\n'), images: pictures };
}

/**
 * The adapter for Pi.
 *
 * The process is supervised: a sanitized environment, a bounded working
 * directory, a hard timeout and cooperative cancellation. The process never
 * inherits server secrets.
 *
 * The lifecycle is explicit. `connect()` starts Pi and reports what it can
 * honestly do; `send()` asks Pi one question and yields the events its records
 * produce; `close()` stops a Pi that is still running.
 */
export class PiAdapter implements AgentAdapter {
  readonly type = 'pi' as const;

  /** Pi is a session: the turn runs on the one `connect()` started. */
  readonly holdsRuntime = true;

  private readonly config: Extract<AdapterConfig, { adapterType: 'pi' }>;
  private readonly ctx: AdapterContext;
  private readonly lifecycle = new AdapterLifecycle('Pi');
  private client: PiRpcClient | null = null;
  /**
   * The session the turn is in.
   *
   * Pi's session is a file it keeps, and the file is what a later turn resumes:
   * `switch_session` takes the path. So the path is the session reference the
   * product publishes, the way the App Server's thread id is.
   */
  private sessionFile: string | null = null;
  /** Pi's own id for the session, when it has one. */
  private sessionId: string | null = null;
  /** The assistant's text so far, for a message that carries none of its own. */
  private finalText = '';
  /** What became of the turn, for the status the worker reads. */
  private turnStatus: AgentExecutionStatus['status'] | null = null;

  constructor(config: Extract<AdapterConfig, { adapterType: 'pi' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const resolved = resolveExecutable(this.config.command);
    if (!resolved) {
      const reason = `The command "${this.config.command}" was not found.`;
      this.ctx.logger.warn('Pi executable not found', { command: this.config.command });
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

    let args: string[];
    try {
      args = piArgs(this.config);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.ctx.logger.warn('The Pi configuration cannot start a session', { reason });
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

    const client = new PiRpcClient(resolved, args, {
      ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
      env: buildSanitizedEnv(this.config.env),
    });
    this.client = client;

    try {
      await this.readState(client);
    } catch (error) {
      this.ctx.logger.warn('Pi did not report its state', { reason: describe(error) });
      await client.close();
      this.client = null;
      const reason = `Pi did not answer when the session was opened: ${describe(error)}`;
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

    this.lifecycle.markConnected();
    return {
      chat: true,
      streaming: true,
      persistentSessions: !this.config.ephemeral,
      backgroundTasks: true,
      cancel: true,
      // Pi's extension questions are not carried on this route yet, so the row
      // says the route cannot ask the owner for permission.
      approvals: false,
      artifacts: false,
      acceptsSteering: true,
      acceptsAttachments: true,
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
    this.finalText = '';
    this.turnStatus = 'running';

    const detach = client.onRecord((record) => {
      for (const event of mapPiEvent(record, { executionId, finalText: this.finalText })) {
        if (event.type === 'message.delta') this.finalText += event.text;
        queue.push(event);
      }

      if (record.type === 'agent_settled') {
        const aborted = record['aborted'] === true;
        queue.push({
          type: 'message.completed',
          executionId,
          ...(this.finalText ? { text: this.finalText } : {}),
        });
        queue.push({
          type: 'execution.status',
          executionId,
          status: aborted ? 'cancelled' : 'completed',
        });
        queue.close();
        return;
      }
    });

    const deadline = setTimeout(() => {
      queue.push({
        type: 'execution.error',
        executionId,
        code: 'pi_turn_timeout',
        message: `Pi did not settle within ${this.config.timeoutSeconds}s.`,
      });
      queue.push({ type: 'execution.status', executionId, status: 'failed' });
      queue.close();
    }, this.config.timeoutSeconds * 1000);

    const onAbort = () => {
      void this.abort();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const prompt = buildPiPrompt(input);
      const accepted = await client.command(
        {
          type: 'prompt',
          message: prompt.message,
          ...(prompt.images.length > 0 ? { images: prompt.images } : {}),
        },
        30_000,
      );
      if (accepted.success === false) {
        this.turnStatus = 'failed';
        yield {
          type: 'execution.error',
          executionId,
          code: 'pi_prompt_rejected',
          message: accepted.error ?? 'Pi refused the prompt.',
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }

      // A prompt that Pi handled itself starts no run, so there is no
      // `agent_settled` to wait for — the turn is over now.
      //
      // **The disposition is in the response, not in an event.** Pi answers the
      // command with a record that carries the id the command carried, and the
      // client resolves that record to the command; it is not an event the
      // session carries, so nothing else ever sees it.
      if (readDisposition(accepted) === 'handled') {
        this.turnStatus = 'completed';
        yield { type: 'message.completed', executionId };
        yield { type: 'execution.status', executionId, status: 'completed' };
        return;
      }

      // The owner's steers, taken while this turn runs.
      void this.forwardSteers(client, input);

      yield { type: 'execution.status', executionId, status: 'running' };

      for await (const event of queue) {
        if (event.type === 'execution.status') {
          this.turnStatus = event.status;
        }
        yield event;
      }
    } catch (error) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'pi_turn_failed',
        message: describe(error),
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
    } finally {
      clearTimeout(deadline);
      input.signal?.removeEventListener('abort', onAbort);
      detach();
      queue.close();
    }
  }

  /**
   * Put the runtime back into the session a decision continues in.
   *
   * Pi's session is a file it keeps, and `switch_session` is how a session is
   * re-entered. The file is what the execution carries as its external
   * reference, so the next turn in the same conversation resumes the same
   * session.
   */
  async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
    if (!this.client) return externalSessionId;
    try {
      const response = await this.client.command(
        { type: 'switch_session', sessionPath: externalSessionId },
        30_000,
      );
      if (response.success === false) {
        throw new Error(response.error ?? 'Pi refused the session.');
      }
      await this.readState(this.client);
      return this.sessionFile ?? externalSessionId;
    } catch (error) {
      this.ctx.logger.warn('Pi did not resume the session', {
        session: externalSessionId,
        reason: describe(error),
      });
      return externalSessionId;
    }
  }

  /**
   * The session the turn is in, and what became of it.
   *
   * The session file is the session: it is what a decision continues in, so it
   * is the execution's external reference.
   */
  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    return {
      executionId,
      status: this.turnStatus ?? 'unknown',
      ...(this.sessionFile ? { externalRef: this.sessionFile } : {}),
    };
  }

  /** Stop the running turn. */
  async cancel(_executionId: string): Promise<void> {
    await this.abort();
  }

  /**
   * Release what this adapter holds.
   *
   * Pi is a child process, and a turn that ends, fails or is abandoned must not
   * leave it behind.
   */
  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.lifecycle.markClosed();
    if (client) await client.close();
  }

  /**
   * The command line this adapter runs, as the owner would read it.
   */
  describeCommand(): string {
    return [this.config.command, ...piArgs(this.config)].join(' ');
  }

  /** Ask Pi what session it is in. */
  private async readState(client: PiRpcClient): Promise<void> {
    const response = await client.command({ type: 'get_state' }, 30_000);
    if (response.success === false) {
      throw new Error(response.error ?? 'Pi refused to report its state.');
    }
    const state = (response.data ?? {}) as Record<string, unknown>;
    this.sessionId = typeof state['sessionId'] === 'string' ? state['sessionId'] : null;
    this.sessionFile = typeof state['sessionFile'] === 'string' ? state['sessionFile'] : null;
  }

  /** Stop the run Pi is in. */
  private async abort(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.command({ type: 'abort' }, 30_000);
    } catch (error) {
      this.ctx.logger.warn('Pi did not accept the abort', { reason: describe(error) });
    }
  }

  /**
   * Put the owner's steers into the run that is going.
   *
   * A steer Pi refuses is a steer that did not arrive, and that is not a failed
   * turn: the turn is still Pi's.
   */
  private async forwardSteers(client: PiRpcClient, input: AgentTurnInput): Promise<void> {
    if (!input.steer) return;
    try {
      for await (const message of input.steer) {
        const response = await client.command({ type: 'steer', message }, 30_000);
        if (response.success === false) {
          this.ctx.logger.warn('Pi did not accept a steer', { reason: response.error });
        }
      }
    } catch (error) {
      this.ctx.logger.warn('The steers stopped', { reason: describe(error) });
    }
  }
}

export function createPiAdapter(
  config: Extract<AdapterConfig, { adapterType: 'pi' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new PiAdapter(config, ctx);
}

/**
 * A queue the runtime's records write into and the turn reads from.
 *
 * The records arrive on the transport's own callback, and the turn is a
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
      if (next.done === true) return;
      if (next.value) yield next.value;
    }
  }
}

/** What a prompt command's response says happened to the prompt. */
function readDisposition(record: PiRecord): string | null {
  const data = (record.data ?? {}) as Record<string, unknown>;
  const disposition = data['disposition'];
  return typeof disposition === 'string' ? disposition : null;
}

/** An error, in a sentence. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
