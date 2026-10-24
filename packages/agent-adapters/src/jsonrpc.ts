import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawnExecutable, terminateChild } from './util.js';

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type NotificationHandler = (method: string, params: unknown) => void;
type RequestHandler = (method: string, params: unknown) => Promise<unknown> | unknown;

/**
 * How a supervised process is started.
 *
 * A protocol that names an executable that is not on PATH as a bare name — an
 * npm shim on Windows, for instance — cannot be started by a plain spawn. The
 * caller supplies the spawner it needs, so the transport stays a transport and
 * the platform's rules stay in one place.
 */
export type SpawnProcess = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
) => ChildProcessWithoutNullStreams;

/**
 * A minimal JSON-RPC 2.0 client over a newline-delimited stdio transport.
 * Used by protocol adapters that speak JSON-RPC (ACP and A2A-over-stdio).
 */
export class JsonRpcStdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly notificationHandlers = new Set<NotificationHandler>();
  private readonly requestHandlers = new Set<RequestHandler>();
  private closed = false;

  constructor(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; spawn?: SpawnProcess },
  ) {
    const start: SpawnProcess = options.spawn ?? spawnExecutable;
    this.child = start(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env,
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.consume(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.resume();

    this.child.on('error', (error) => {
      // A command that cannot be started is a failure, not a hang: the
      // pending requests are rejected so the caller hears about it.
      this.closed = true;
      for (const [, entry] of this.pending) {
        entry.reject(error instanceof Error ? error : new Error(String(error)));
      }
      this.pending.clear();
    });

    this.child.on('close', () => {
      this.closed = true;
      for (const [, entry] of this.pending) {
        entry.reject(new Error('JSON-RPC transport closed before a response arrived.'));
      }
      this.pending.clear();
    });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  /** Handle requests initiated by the peer (for example permission prompts). */
  onRequest(handler: RequestHandler): () => void {
    this.requestHandlers.add(handler);
    return () => this.requestHandlers.delete(handler);
  }

  async request(method: string, params: unknown, timeoutMs = 120_000): Promise<unknown> {
    if (this.closed) throw new Error('JSON-RPC transport is closed.');
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request "${method}" timed out after ${timeoutMs}ms.`));
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

  notify(method: string, params: unknown): void {
    if (this.closed) return;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`, 'utf8');
  }

  /** Respond to a peer-initiated request. */
  respond(id: number | string, result: unknown): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`, 'utf8');
  }

  respondError(id: number | string, code: number, message: string): void {
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`,
      'utf8',
    );
  }

  /**
   * Stop the child and wait until it is gone.
   *
   * The wait is the point: a transport that is closed but whose child is
   * still running has not released anything.
   */
  async close(): Promise<void> {
    this.closed = true;
    await terminateChild(this.child);
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line.length === 0) continue;
      this.dispatch(line);
    }
  }

  private dispatch(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return; // ignore non-JSON chatter on stdout
    }

    if (message.method && message.id !== undefined && message.id !== null) {
      void this.handlePeerRequest(message);
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) handler(message.method, message.params);
      return;
    }

    if (message.id !== undefined && message.id !== null) {
      const entry = this.pending.get(Number(message.id));
      if (!entry) return;
      this.pending.delete(Number(message.id));
      if (message.error) {
        const summary = `${message.error.message} (code ${message.error.code})`;
        const detail = describeErrorData(message.error.data);
        entry.reject(new Error(detail ? `${summary} — ${detail}` : summary));
      } else {
        entry.resolve(message.result);
      }
    }
  }

  private async handlePeerRequest(message: JsonRpcMessage): Promise<void> {
    for (const handler of this.requestHandlers) {
      try {
        const result = await handler(message.method as string, message.params);
        this.respond(message.id as number | string, result);
        return;
      } catch (error) {
        this.respondError(
          message.id as number | string,
          -32603,
          error instanceof Error ? error.message : 'Request failed.',
        );
        return;
      }
    }
    this.respondError(
      message.id as number | string,
      -32601,
      `Method "${message.method}" is not supported by this Personal OS adapter.`,
    );
  }
}

/**
 * What an error's `data` says, in a sentence.
 *
 * An agent that refuses a request usually says why in `data`, and the reason
 * is the part the owner needs: "no provider configured" is actionable, while
 * "internal error" is not. The detail is capped, because a runtime is allowed
 * to send a large payload and a refusal message is not the place for it.
 */
function describeErrorData(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;

  if (typeof data === 'string') return cap(data);
  if (typeof data === 'number' || typeof data === 'boolean') return cap(String(data));

  if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['details', 'detail', 'message', 'reason']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) return cap(value.trim());
    }
    try {
      return cap(JSON.stringify(data));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/** A detail, no longer than a message should be. */
function cap(text: string): string {
  const limit = 400;
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}
