import type { ChildProcessWithoutNullStreams } from 'node:child_process';
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
import { buildSanitizedEnv, resolveExecutable, spawnExecutable, terminateChild } from './util.js';

/**
 * OpenAI Codex, as a local command line agent.
 *
 * **Codex is not a text-on-standard-output CLI.** It writes a JSONL event
 * stream: a thread starts, a turn starts, items complete — a message, a
 * command it ran, a file it changed — and the turn reports how it ended. The
 * generic CLI adapter reads standard output as text, so Codex needs its own
 * adapter: this one reads the stream and says what it means in the product's
 * vocabulary.
 *
 * **The credential stays in Codex.** Codex signs in with its own account and
 * keeps that sign-in in its own home directory, so the supervised process
 * inherits the owner's home and nothing else, and this adapter holds no
 * secret of its own.
 *
 * The event mapping is a pure function. A mapping that could only be tested by
 * running Codex would be a mapping nobody would test, so the mapping is
 * separated from the process that produces the events.
 */

/** One item of a Codex turn: a message, a command, a change, a tool call. */
export interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  server?: string;
  tool?: string;
  arguments?: unknown;
  result?: unknown;
  changes?: unknown;
  query?: string;
}

/** One line of Codex's event stream. */
export interface CodexEnvelope {
  type?: string;
  thread_id?: string;
  item?: CodexItem;
  error?: { message?: string; code?: string };
  usage?: unknown;
}

/** The tool a Codex item stands for, in the product's vocabulary. */
export interface CodexTool {
  /** The name the trace row carries. */
  name: string;
  /** What the tool was asked to do. */
  input?: unknown;
  /** What the tool did. */
  output?: unknown;
}

/**
 * The tool a Codex item stands for, or nothing when the item is not a tool.
 *
 * An item the product has no word for is not invented into one: a plan, a
 * reasoning note and a token count are not actions, and the trace records
 * actions.
 */
export function codexToolFor(item: CodexItem | undefined): CodexTool | null {
  switch (item?.type) {
    case 'command_execution':
      return {
        name: 'command',
        input: { command: item.command ?? '' },
        output: {
          command: item.command ?? '',
          exit_code: item.exit_code ?? null,
          output: item.aggregated_output ?? '',
          status: item.status ?? 'unknown',
        },
      };
    case 'file_change':
      return {
        name: 'file_change',
        input: { changes: item.changes ?? null },
        output: { changes: item.changes ?? null },
      };
    case 'mcp_tool_call':
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
    case 'web_search':
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
 * What one Codex event means in the product's vocabulary.
 *
 * The mapping is deliberately narrow. Codex reports the turn's outcome itself
 * — `turn.completed`, `turn.failed` — and the adapter believes it. A turn
 * that ends without either is a turn whose outcome nobody can say, and the
 * adapter says so rather than calling it a success.
 */
export function mapCodexEvent(
  envelope: CodexEnvelope,
  executionId: string,
  finalText: string,
): AgentEvent[] {
  switch (envelope.type) {
    case 'item.started': {
      const tool = codexToolFor(envelope.item);
      if (!tool) return [];
      return [{ type: 'tool.started', executionId, toolName: tool.name, input: tool.input }];
    }
    case 'item.completed': {
      const item = envelope.item;
      if (item?.type === 'agent_message') {
        const text = item.text ?? '';
        if (text.length === 0) return [];
        return [{ type: 'message.delta', executionId, text }];
      }
      const tool = codexToolFor(item);
      if (!tool) return [];
      return [{ type: 'tool.completed', executionId, toolName: tool.name, output: tool.output }];
    }
    case 'turn.completed':
      return [
        { type: 'message.completed', executionId, text: finalText },
        { type: 'execution.status', executionId, status: 'completed' },
      ];
    case 'turn.failed':
      return [
        {
          type: 'execution.error',
          executionId,
          code: envelope.error?.code ?? 'runtime_failed',
          message: envelope.error?.message ?? 'The runtime reported that the turn failed.',
        },
        { type: 'execution.status', executionId, status: 'failed' },
      ];
    case 'error':
      return [
        {
          type: 'execution.error',
          executionId,
          code: envelope.error?.code ?? 'runtime_error',
          message: envelope.error?.message ?? 'The runtime reported an error.',
        },
      ];
    default:
      // A thread that started and a turn that started are the adapter's own
      // business: the turn is already running by the time Codex says so.
      return [];
  }
}

/** Read one line of the event stream. A line that is not JSON is not an event. */
export function parseCodexEnvelope(line: string): CodexEnvelope | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as CodexEnvelope;
  } catch {
    return null;
  }
}

export class CodexAdapter implements AgentAdapter {
  readonly type = 'codex' as const;

  /** Each turn brings its own runtime: the turn starts the Codex process. */
  readonly holdsRuntime = true;

  private readonly config: Extract<AdapterConfig, { adapterType: 'codex' }>;
  private readonly ctx: AdapterContext;
  private readonly lifecycle = new AdapterLifecycle('Codex');
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();
  /**
   * Where the command was found.
   *
   * The turn starts the resolved path rather than the bare name: on Windows a
   * bare name is not something a child process can start on its own, because
   * an npm-installed CLI is a `.cmd` shim.
   */
  private resolved: string | null = null;

  constructor(config: Extract<AdapterConfig, { adapterType: 'codex' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const resolved = await resolveExecutable(this.config.command);
    if (!resolved) {
      const reason = `The command "${this.config.command}" was not found.`;
      this.ctx.logger.warn('Codex executable not found', { command: this.config.command });
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
    this.lifecycle.markConnected();
    return {
      chat: true,
      // The turn's output arrives as Codex produces it, item by item. A
      // message itself arrives whole: Codex reports a completed message
      // rather than the tokens it was made of.
      streaming: true,
      // A session survives only when Codex is allowed to keep it on disk.
      persistentSessions: !this.config.ephemeral,
      // `codex exec` is a turn in the foreground.
      backgroundTasks: false,
      // The process is a child, and a child can be stopped.
      cancel: true,
      // Codex in this mode cannot ask the owner for anything: it runs
      // non-interactively under a sandbox policy.
      approvals: false,
      // A file Codex changed is a file on disk, not a resource the product
      // holds, so there is no artifact to point at yet.
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

    let stderr = '';
    let stdoutBuffer = '';
    let finalText = '';
    let turnSettled = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    const outcome: { failure: Error | null } = { failure: null };
    const pending: AgentEvent[] = [];

    const child = spawnExecutable(this.resolved ?? this.config.command, this.buildArgs(), {
      cwd: this.config.cwd ?? process.cwd(),
      env: buildSanitizedEnv(this.config.env),
    });

    this.running.set(executionId, child);

    // Codex may decide not to read the prompt, and a broken pipe is the
    // agent's choice, not a failure of the turn.
    child.stdin.on('error', () => undefined);
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const envelope = parseCodexEnvelope(line);
        if (!envelope) continue;
        if (envelope.type === 'item.completed' && envelope.item?.type === 'agent_message') {
          finalText += envelope.item.text ?? '';
        }
        for (const event of mapCodexEvent(envelope, executionId, finalText)) {
          pending.push(event);
          if (
            event.type === 'execution.status' &&
            (event.status === 'completed' || event.status === 'failed')
          ) {
            turnSettled = true;
          }
        }
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
      outcome.failure = new Error(`Codex timed out after ${this.config.timeoutSeconds}s.`);
      child.kill('SIGKILL');
    }, this.config.timeoutSeconds * 1000);

    const onAbort = () => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref?.();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });

    yield { type: 'execution.status', executionId, status: 'running' };

    try {
      while (exitCode === null && exitSignal === null && !outcome.failure) {
        if (pending.length > 0) {
          for (const event of pending.splice(0, pending.length)) yield event;
        }
        await Promise.race([closed, delay(50)]);
      }

      if (pending.length > 0) {
        for (const event of pending.splice(0, pending.length)) yield event;
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
        message: `Codex terminated by signal ${exitSignal}.`,
      };
      yield { type: 'execution.status', executionId, status: 'cancelled' };
      return;
    }

    if (exitCode !== 0) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'non_zero_exit',
        message: `Codex exited with code ${exitCode}. ${stderr.trim().slice(0, 2_000)}`,
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    if (!turnSettled) {
      // Codex finished without saying how the turn ended. That is not a
      // success and it is not a failure either: it is an outcome nobody can
      // say, and the product has a word for it.
      yield {
        type: 'execution.error',
        executionId,
        code: 'unknown_outcome',
        message:
          'Codex finished without reporting how the turn ended. The turn may or may not have done its work.',
      };
      yield { type: 'execution.status', executionId, status: 'unknown' };
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
   * Stop the turns this adapter is still running.
   *
   * A turn normally ends by itself, but an adapter that is closed while a
   * turn is running must not leave the process behind.
   */
  async close(): Promise<void> {
    const children = [...this.running.values()];
    this.running.clear();
    await Promise.all(children.map((child) => terminateChild(child)));
    this.lifecycle.markClosed();
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
   * `--json` is what makes Codex a stream of events rather than a wall of
   * text, and the sandbox policy is what keeps the agent's own commands
   * inside the boundary the owner chose.
   */
  private buildArgs(): string[] {
    const args = [...this.config.args, 'exec'];
    args.push('--json');
    args.push('--sandbox', this.config.sandbox);
    if (this.config.skipGitRepoCheck) args.push('--skip-git-repo-check');
    if (this.config.ephemeral) args.push('--ephemeral');
    if (this.config.model) args.push('--model', this.config.model);
    if (this.config.cwd) args.push('--cd', this.config.cwd);
    // `-` says the prompt is on standard input, which is where the adapter
    // writes it.
    args.push('-');
    return args;
  }
}

export function createCodexAdapter(
  config: Extract<AdapterConfig, { adapterType: 'codex' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new CodexAdapter(config, ctx);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
