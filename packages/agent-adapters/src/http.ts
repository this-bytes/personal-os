import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import { asText, getByPath, interpolateJson, parseSseData, readSseEvents } from './util.js';

/**
 * Generic gateway adapter for framework-specific HTTP APIs.
 *
 * The request body is a template, the reply location is a dotted path and
 * streaming responses are read as SSE. This is the escape hatch for
 * frameworks that do not speak ACP or A2A.
 *
 * The lifecycle is explicit. `connect()` reports what the gateway can do;
 * `send()` makes the request; `close()` releases what the adapter holds —
 * which, for a gateway that is reached one request at a time, is nothing.
 */
export class HttpAdapter implements AgentAdapter {
  readonly type = 'http' as const;

  /** The request is made and answered within the turn. */
  readonly holdsRuntime = false;

  private readonly config: Extract<AdapterConfig, { adapterType: 'http' }>;
  private readonly ctx: AdapterContext;

  constructor(config: Extract<AdapterConfig, { adapterType: 'http' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return {
      chat: true,
      streaming: this.config.sse,
      persistentSessions: false,
      backgroundTasks: true,
      cancel: true,
      approvals: false,
      artifacts: false,
    };
  }

  /** Release what the adapter holds. A gateway keeps no connection open. */
  close(): void {
    // Nothing to release: the request is made and answered within the turn.
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    yield { type: 'execution.status', executionId, status: 'running' };

    try {
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/${this.config.path.replace(/^\//, '')}`;
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...this.config.headers,
      };

      if (this.config.authTokenRef) {
        const token = await this.ctx.resolveSecret(this.config.authTokenRef);
        if (token) {
          headers[this.config.authHeader.toLowerCase()] =
            `${this.config.authScheme} ${token}`.trim();
        }
      }

      const body = interpolateJson(this.config.bodyTemplate, {
        message: input.message,
        context: input.context,
        conversationId: input.conversationId,
        executionId: input.executionId,
      });

      const response = await fetch(url, {
        method: this.config.method,
        headers,
        body,
        signal: input.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Gateway returned HTTP ${response.status}. ${detail.slice(0, 500)}`);
      }

      if (this.config.sse) {
        let full = '';
        for await (const event of readSseEvents(response.body)) {
          const parsed = parseSseData(event.data);
          if (parsed === undefined) continue;
          const text = this.config.sseTextPath
            ? asText(getByPath(parsed, this.config.sseTextPath))
            : asText(parsed);
          if (!text) continue;
          full += text;
          yield { type: 'message.delta', executionId, text };
        }
        yield { type: 'message.completed', executionId, text: full };
      } else {
        const payload = (await response.json()) as unknown;
        const text = asText(getByPath(payload, this.config.responseTextPath));
        if (text) yield { type: 'message.delta', executionId, text };
        yield { type: 'message.completed', executionId, text };
      }

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
}

export function createHttpAdapter(
  config: Extract<AdapterConfig, { adapterType: 'http' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new HttpAdapter(config, ctx);
}
