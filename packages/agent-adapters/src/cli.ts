import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
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
import { buildSanitizedEnv } from './util.js';

/**
 * Local command-line agents.
 *
 * The child process is supervised: a sanitized environment, a bounded
 * working directory, a hard timeout and cooperative cancellation. The
 * process never inherits server secrets.
 */
export class CliAdapter implements AgentAdapter {
  readonly type = 'cli' as const;

  private readonly config: Extract<AdapterConfig, { adapterType: 'cli' }>;
  private readonly ctx: AdapterContext;
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(config: Extract<AdapterConfig, { adapterType: 'cli' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const resolved = await resolveExecutable(this.config.command);
    if (!resolved) {
      this.ctx.logger.warn('CLI executable not found', { command: this.config.command });
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

/** Locate an executable on PATH without spawning it. */
async function resolveExecutable(command: string): Promise<string | null> {
  const hasSeparator = command.includes('/') || command.includes('\\');
  if (hasSeparator) {
    try {
      await access(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathValue = process.env['PATH'] ?? '';
  const extensions =
    process.platform === 'win32'
      ? (process.env['PATHEXT'] ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : [''];

  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, command + extension);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
