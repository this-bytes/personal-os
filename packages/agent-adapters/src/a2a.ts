import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import { asText, getByPath } from './util.js';

interface AgentCard {
  name?: string;
  description?: string;
  url?: string;
  version?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  skills?: Array<{ id: string; name: string; description?: string }>;
}

interface A2aTaskState {
  state?: string;
  message?: { parts?: unknown[] };
}

const TERMINAL_STATES = new Set([
  'completed',
  'failed',
  'canceled',
  'cancelled',
  'rejected',
  'input-required',
]);

/**
 * Agent-to-Agent adapter.
 *
 * A2A is task oriented: the client discovers an agent card, sends a
 * message and receives either a message or a task with artifacts. Task
 * state is polled until it reaches a terminal state.
 *
 * The lifecycle is explicit. `connect()` discovers the agent card and
 * reports what the agent says it can do; `send()` sends the message and
 * polls the task; `close()` releases what the adapter holds — which, for a
 * client that holds no connection between turns, is nothing. The card the
 * connection discovered is reused by the turn, so a connected turn does not
 * ask for it twice.
 */
export class A2aAdapter implements AgentAdapter {
  readonly type = 'a2a' as const;

  /** The request is made and answered within the turn. */
  readonly holdsRuntime = false;

  private readonly config: Extract<AdapterConfig, { adapterType: 'a2a' }>;
  private readonly ctx: AdapterContext;
  /** The card the connection discovered, if it has been asked for one. */
  private card: AgentCard | null = null;
  private cardRequested = false;

  constructor(config: Extract<AdapterConfig, { adapterType: 'a2a' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    const card = await this.agentCard();
    if (!card) {
      return {
        chat: false,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: true,
        cancel: false,
        approvals: false,
        artifacts: true,
      };
    }
    return {
      chat: true,
      streaming: card.capabilities?.streaming === true,
      persistentSessions: false,
      backgroundTasks: true,
      cancel: false,
      approvals: false,
      artifacts: card.skills !== undefined,
    };
  }

  /** Release what the adapter holds. A2A keeps no connection open. */
  close(): void {
    // Nothing to release: the adapter holds no connection between turns.
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    yield { type: 'execution.status', executionId, status: 'running' };

    try {
      const card = await this.agentCard();
      const endpoint =
        card?.url ?? `${this.config.baseUrl.replace(/\/$/, '')}/${this.config.messageUrl}`;
      const headers = await this.buildHeaders();

      const body = {
        jsonrpc: '2.0',
        id: input.executionId,
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            role: 'user',
            messageId: input.executionId,
            parts: [
              {
                kind: 'text',
                text: `${input.message}\n\n--- context ---\n${input.context}`.trim(),
              },
            ],
          },
          configuration: { blocking: true },
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: input.signal,
      });

      if (!response.ok) {
        throw new Error(`A2A agent returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        result?: {
          kind?: string;
          parts?: unknown[];
          id?: string;
          status?: A2aTaskState;
          artifacts?: unknown[];
        };
        error?: { message?: string };
      };

      if (payload.error) {
        throw new Error(payload.error.message ?? 'A2A agent returned an error.');
      }

      let result = payload.result;
      let text = '';

      if (
        result?.kind === 'task' &&
        result.status?.state &&
        !TERMINAL_STATES.has(result.status.state)
      ) {
        const completed = await this.pollTask(result.id as string, headers, input.signal);
        result = completed;
      }

      if (result?.kind === 'message') {
        text = asText(result.parts);
      } else if (result?.kind === 'task') {
        const state = result.status?.state ?? 'unknown';
        text = asText(result.status?.message?.parts);
        if (state === 'failed' || state === 'rejected' || state === 'canceled') {
          yield {
            type: 'execution.error',
            executionId,
            code: 'adapter_failed',
            message: text || `A2A task ended in state "${state}".`,
          };
          yield { type: 'execution.status', executionId, status: 'failed' };
          return;
        }
        const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
        for (const artifact of artifacts) {
          yield {
            type: 'artifact.created',
            executionId,
            title: String(getByPath(artifact, 'name') ?? 'artifact'),
          };
        }
      }

      if (text.length > 0) {
        yield { type: 'message.delta', executionId, text };
      }
      yield { type: 'message.completed', executionId, text };
      yield { type: 'execution.status', executionId, status: 'completed' };
    } catch (error) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'adapter_failed',
        message: error instanceof Error ? error.message : String(error),
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
    }
  }

  private async pollTask(
    taskId: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ kind?: string; status?: A2aTaskState; parts?: unknown[]; artifacts?: unknown[] }> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, '')}/tasks/${taskId}`;
    const deadline = Date.now() + this.config.timeoutSeconds * 1000;

    for (;;) {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal,
      });
      if (!response.ok) throw new Error(`A2A task poll returned HTTP ${response.status}.`);
      const payload = (await response.json()) as {
        result?: { status?: A2aTaskState; artifacts?: unknown[] };
      };
      const state = payload.result?.status?.state;
      if (state && TERMINAL_STATES.has(state)) {
        return {
          kind: 'task',
          status: payload.result?.status,
          artifacts: payload.result?.artifacts,
        };
      }
      if (Date.now() > deadline) {
        throw new Error('A2A task did not reach a terminal state before the timeout.');
      }
      await delay(500);
    }
  }

  /** The agent card, asked for once per adapter. */
  private async agentCard(): Promise<AgentCard | null> {
    if (this.cardRequested) return this.card;
    this.cardRequested = true;
    this.card = await this.fetchAgentCard();
    return this.card;
  }

  private async fetchAgentCard(): Promise<AgentCard | null> {
    const url = this.config.agentCardPath.startsWith('http')
      ? this.config.agentCardPath
      : `${this.config.baseUrl.replace(/\/$/, '')}${this.config.agentCardPath}`;
    try {
      const response = await fetch(url, { headers: await this.buildHeaders() });
      if (!response.ok) {
        this.ctx.logger.warn('A2A agent card request failed', { url, status: response.status });
        return null;
      }
      return (await response.json()) as AgentCard;
    } catch (error) {
      this.ctx.logger.warn('A2A agent card request failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.config.authTokenRef) {
      const token = await this.ctx.resolveSecret(this.config.authTokenRef);
      if (token) headers['authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
}

export function createA2aAdapter(
  config: Extract<AdapterConfig, { adapterType: 'a2a' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new A2aAdapter(config, ctx);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
