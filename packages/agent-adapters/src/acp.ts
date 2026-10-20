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
import { JsonRpcStdioClient } from './jsonrpc.js';
import { getByPath } from './util.js';

const PROTOCOL_VERSION = 1;

interface AcpSession {
  sessionId: string;
}

interface AcpCapabilities {
  loadSession?: boolean;
  promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
  [key: string]: unknown;
}

/**
 * Agent Client Protocol adapter.
 *
 * ACP is session oriented: the client initialises, creates a session and
 * prompts it. Streamed output arrives as `session/update` notifications.
 * Native session restoration is offered only when the agent advertises it.
 *
 * A session outlives a turn when the agent can restore it: the first turn
 * creates the session, and a turn that was suspended on an approval re-enters
 * that same session with the owner's decision as its next input.
 */
export class AcpAdapter implements AgentAdapter {
  readonly type = 'acp' as const;

  private readonly config: Extract<AdapterConfig, { adapterType: 'acp' }>;
  private readonly ctx: AdapterContext;
  /** The session each execution is in, so the worker can persist it. */
  private readonly sessions = new Map<string, string>();

  constructor(config: Extract<AdapterConfig, { adapterType: 'acp' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const client = this.spawn();
    try {
      const result = (await client.request(
        'initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: this.config.clientCapabilities,
        },
        30_000,
      )) as { agentCapabilities?: AcpCapabilities };

      const caps = result?.agentCapabilities ?? {};
      return {
        chat: true,
        streaming: true,
        persistentSessions: caps.loadSession === true,
        backgroundTasks: true,
        cancel: true,
        approvals: true,
        artifacts: true,
      };
    } finally {
      client.close();
    }
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    const client = this.spawn();
    const deltas: string[] = [];
    let finalText = '';
    // Held in an object so the type stays `Error | null` after the
    // callbacks that assign it have run.
    const outcome: { failure: Error | null } = { failure: null };

    const offNotification = client.onNotification((method, params) => {
      if (method !== 'session/update') return;
      const update = getByPath(params, 'update');
      const kind = getByPath(update, 'sessionUpdate');
      if (kind !== 'agent_message_chunk') return;
      const text = getByPath(update, 'content.text');
      if (typeof text === 'string' && text.length > 0) deltas.push(text);
    });

    // Peer-initiated requests (file access, permissions) are declined: this
    // adapter advertises no filesystem or terminal capability.
    const offRequest = client.onRequest(() => {
      throw new Error('This Personal OS adapter does not grant client-side capabilities.');
    });

    const onAbort = () => {
      try {
        client.notify('session/cancel', { sessionId: undefined });
      } catch {
        // best effort
      }
      client.close();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      yield { type: 'execution.status', executionId, status: 'running' };

      await client.request(
        'initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: this.config.clientCapabilities,
        },
        30_000,
      );

      const sessionId = input.externalSessionId
        ? await this.loadSession(client, input.externalSessionId)
        : await this.newSession(client);
      this.sessions.set(executionId, sessionId);

      const promptPromise = client.request(
        'session/prompt',
        {
          sessionId,
          prompt: [
            {
              type: 'text',
              text: `${input.message}\n\n--- context ---\n${input.context}`.trim(),
            },
          ],
        },
        this.config.timeoutSeconds * 1000,
      );

      // Drain streamed chunks while the prompt is in flight.
      let settled = false;
      promptPromise
        .then((value) => {
          settled = true;
          const stopReason = getByPath(value, 'stopReason');
          if (stopReason === 'cancelled') {
            outcome.failure = new Error('ACP session was cancelled by the agent.');
          }
        })
        .catch((error: unknown) => {
          settled = true;
          outcome.failure = error instanceof Error ? error : new Error(String(error));
        });

      while (!settled) {
        if (deltas.length > 0) {
          const text = deltas.join('');
          deltas.length = 0;
          finalText += text;
          yield { type: 'message.delta', executionId, text };
        }
        await Promise.race([promptPromise.catch(() => undefined), delay(50)]);
      }

      if (deltas.length > 0) {
        const text = deltas.join('');
        deltas.length = 0;
        finalText += text;
        yield { type: 'message.delta', executionId, text };
      }

      await promptPromise.catch(() => undefined);

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

      yield { type: 'message.completed', executionId, text: finalText };
      yield { type: 'execution.status', executionId, status: 'completed' };
    } catch (error) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'adapter_failed',
        message: error instanceof Error ? error.message : String(error),
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
    } finally {
      input.signal?.removeEventListener('abort', onAbort);
      offNotification();
      offRequest();
      client.close();
    }
  }

  /**
   * Restore a native session, when the agent supports it.
   *
   * The agent is asked to load the session it was given, and the id it
   * answers with is the session the next prompt belongs to. A turn that was
   * suspended on an approval re-enters that session, so the agent keeps the
   * conversation it was in.
   */
  async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
    const client = this.spawn();
    try {
      await client.request(
        'initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: this.config.clientCapabilities,
        },
        30_000,
      );
      return await this.loadSession(client, externalSessionId);
    } finally {
      client.close();
    }
  }

  /**
   * What this adapter knows about an execution it ran.
   *
   * The session is the execution's external reference: it is what a later
   * decision needs in order to resume the turn.
   */
  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    const sessionId = this.sessions.get(executionId);
    return {
      executionId,
      status: sessionId ? 'running' : 'queued',
      ...(sessionId ? { externalRef: sessionId } : {}),
    };
  }

  /** Create a session and return its id. */
  private async newSession(client: JsonRpcStdioClient): Promise<string> {
    const session = (await client.request('session/new', {}, 30_000)) as AcpSession;
    const sessionId = session?.sessionId;
    if (!sessionId) throw new Error('ACP agent did not return a session id.');
    return sessionId;
  }

  /** Restore a session and return the id it was restored under. */
  private async loadSession(
    client: JsonRpcStdioClient,
    externalSessionId: string,
  ): Promise<string> {
    const session = (await client.request(
      'session/load',
      {
        sessionId: externalSessionId,
        cwd: this.config.cwd,
        mcpServers: [],
      },
      30_000,
    )) as AcpSession;
    const sessionId = session?.sessionId;
    if (!sessionId) {
      throw new Error('ACP agent did not return a session id when loading the session.');
    }
    return sessionId;
  }

  private spawn(): JsonRpcStdioClient {
    const env: NodeJS.ProcessEnv = {};
    for (const key of [
      'PATH',
      'HOME',
      'USERPROFILE',
      'TEMP',
      'TMP',
      'SystemRoot',
      'ComSpec',
      'PATHEXT',
    ]) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    for (const [key, value] of Object.entries(this.config.env)) env[key] = value;

    return new JsonRpcStdioClient(this.config.command, this.config.args, {
      cwd: this.config.cwd,
      env,
    });
  }
}

export function createAcpAdapter(
  config: Extract<AdapterConfig, { adapterType: 'acp' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new AcpAdapter(config, ctx);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
