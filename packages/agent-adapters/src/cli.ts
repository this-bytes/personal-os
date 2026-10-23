import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import { AdapterLifecycle, notConnectedEvent } from './lifecycle.js';
import { buildSanitizedEnv, resolveExecutable, terminateChild } from './util.js';

/**
 * Local command-line agents.
 *
 * The child process is supervised: a sanitized environment, a bounded
 * working directory, a hard timeout and cooperative cancellation. The
 * process never inherits server secrets.
 *
 * The lifecycle is explicit. `connect()` checks that the command is there
 * and reports what it can honestly do; `send()` runs the command for one
 * turn; `close()` stops a command that is still running. A turn that ends,
 * fails or is abandoned releases its process, so a finished turn never owns a
 * stray agent.
 */
export class CliAdapter implements AgentAdapter {
  readonly type = 'cli' as const;

  /** The supervised process is established in `connect()` and the turn runs on it. */
  readonly holdsRuntime = true;

  private readonly config: Extract<AdapterConfig, { adapterType: 'cli' }>;
  private readonly ctx: AdapterContext;
  private readonly lifecycle = new AdapterLifecycle('CLI');
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(config: Extract<AdapterConfig, { adapterType: 'cli' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const resolved = await resolveExecutable(this.config.command);
    if (!resolved) {
      const reason = `The command "${this.config.command}" was not found.`;
      this.ctx.logger.warn('CLI executable not found', { command: this.config.command });
      this.lifecycle.markFailed(reason);
      return {
        chat: false,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: true,
        cancel: true,
        approvals: false,
        artifacts: false,
      };
    }
    this.lifecycle.markConnected();
    return {
      chat: true,
      streaming: true,
      persistentSessions: false,
      backgroundTasks: true,
      cancel: true,
      approvals: false,
      artifacts: false,
    };
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    const prompt = `${input.message}\n\n${input.context}`.trim();

    if (!this.lifecycle.isConnected) {
      yield { type: 'execution.status', executionId, status: 'running' };
      yield notConnectedEvent(executionId, this.lifecycle.message());
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    let args = [...this.config.args];
    let stdinPayload: string | undefined;
    let tempDir: string | undefined;

    try {
      if (this.config.promptMode === 'stdin') {
        stdinPayload = prompt;
      } else if (this.config.promptMode === 'arg') {
        args = [...args, this.config.promptArg, prompt];
      } else {
        tempDir = await mkdtemp(path.join(tmpdir(), 'pos-cli-'));
        const promptFile = path.join(tempDir, 'prompt.txt');
        await writeFile(promptFile, prompt, 'utf8');
        args = [...args, this.config.promptArg, promptFile];
      }

      const child = spawn(this.config.command, args, {
        cwd: this.config.cwd ?? process.cwd(),
        env: buildSanitizedEnv(this.config.env),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;

      this.running.set(executionId, child);

      // The agent may exit before it reads the prompt, and a broken pipe is
      // not a failure of the turn: it is the agent's choice to stop reading.
      child.stdin.on('error', () => undefined);

      if (stdinPayload !== undefined) {
        child.stdin.write(stdinPayload);
      }
      child.stdin.end();

      let stderr = '';
      let stdoutBuffer = '';
      const pendingDeltas: string[] = [];
      let exitCode: number | null = null;
      let exitSignal: NodeJS.Signals | null = null;
      // Held in an object so the type stays `Error | null` after the
      // callbacks that assign it have run.
      const outcome: { failure: Error | null } = { failure: null };

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim().length > 0) pendingDeltas.push(`${line}\n`);
        }
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
      });

      const closed = new Promise<void>((resolve) => {
        child.on('error', (error) => {
          outcome.failure = error;
          resolve();
        });
        child.on('close', (code, signal) => {
          exitCode = code;
          exitSignal = signal;
          resolve();
        });
      });

      const timer = setTimeout(() => {
        outcome.failure = new Error(`CLI agent timed out after ${this.config.timeoutSeconds}s.`);
        child.kill('SIGKILL');
      }, this.config.timeoutSeconds * 1000);

      const onAbort = () => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 2_000).unref?.();
      };
      input.signal?.addEventListener('abort', onAbort, { once: true });

      yield { type: 'execution.status', executionId, status: 'running' };

      try {
        // Stream stdout while the process is alive.
        while (exitCode === null && exitSignal === null && !outcome.failure) {
          if (pendingDeltas.length > 0) {
            const text = pendingDeltas.join('');
            pendingDeltas.length = 0;
            yield { type: 'message.delta', executionId, text };
          }
          await Promise.race([closed, delay(50)]);
        }

        if (pendingDeltas.length > 0) {
          const text = pendingDeltas.join('');
          pendingDeltas.length = 0;
          if (text.length > 0) yield { type: 'message.delta', executionId, text };
        }

        await closed;
      } finally {
        clearTimeout(timer);
        input.signal?.removeEventListener('abort', onAbort);
        this.running.delete(executionId);
        // A turn that ends, fails or is abandoned must not leave a child
        // process behind. The wait is what makes that true.
        await terminateChild(child);
      }

      if (outcome.failure) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'adapter_failed',
          message: outcome.failure.message,
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }

      if (exitSignal) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'cancelled',
          message: `CLI agent terminated by signal ${exitSignal}.`,
        };
        yield { type: 'execution.status', executionId, status: 'cancelled' };
        return;
      }

      if (exitCode !== 0) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'non_zero_exit',
          message: `CLI agent exited with code ${exitCode}. ${stderr.trim().slice(0, 2_000)}`,
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }

      yield { type: 'message.completed', executionId };
      yield { type: 'execution.status', executionId, status: 'completed' };
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async cancel(executionId: string): Promise<void> {
    const child = this.running.get(executionId);
    if (child) {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref?.();
    }
  }

  /**
   * Stop the commands this adapter is still running.
   *
   * A turn normally ends by itself, but an adapter that is closed while a
   * command is running must not leave it behind.
   */
  async close(): Promise<void> {
    const children = [...this.running.values()];
    this.running.clear();
    await Promise.all(children.map((child) => terminateChild(child)));
    this.lifecycle.markClosed();
  }
}

export function createCliAdapter(
  config: Extract<AdapterConfig, { adapterType: 'cli' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new CliAdapter(config, ctx);
}

/**
 * Build a minimal environment for the child process. Server secrets are
 * never inherited; only an explicit allow-list plus the configured values.
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
