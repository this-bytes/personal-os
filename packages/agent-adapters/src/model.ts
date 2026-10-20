import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import { getByPath, parseSseData, readSseEvents } from './util.js';

/**
 * Direct model sessions without an external agent harness.
 *
 * Only the OpenAI-compatible chat-completions shape is implemented in v1.
 * Streaming is used when the provider advertises it, otherwise a single
 * non-streaming response is returned.
 */
export class ModelAdapter implements AgentAdapter {
  readonly type = 'model' as const;

  private readonly config: Extract<AdapterConfig, { adapterType: 'model' }>;
  private readonly ctx: AdapterContext;

  constructor(config: Extract<AdapterConfig, { adapterType: 'model' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
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
    yield { type: 'execution.status', executionId, status: 'running' };

    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.config.apiKeyRef) {
        const key = await this.ctx.resolveSecret(this.config.apiKeyRef);
        if (key) {
          headers[this.config.apiKeyHeader.toLowerCase()] =
            `${this.config.apiKeyScheme} ${key}`.trim();
        }
      }

      const messages = [
        ...(this.config.systemPrompt
          ? [{ role: 'system', content: this.config.systemPrompt }]
          : []),
        { role: 'user', content: `${input.message}\n\n--- context ---\n${input.context}`.trim() },
      ];

      const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true,
        }),
        signal: input.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Model API returned HTTP ${response.status}. ${detail.slice(0, 500)}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      let full = '';

      if (contentType.includes('text/event-stream')) {
        for await (const event of readSseEvents(response.body)) {
          const parsed = parseSseData(event.data);
          if (parsed === undefined) continue;
          const delta = getByPath(parsed, 'choices.0.delta.content');
          if (typeof delta !== 'string' || delta.length === 0) continue;
          full += delta;
          yield { type: 'message.delta', executionId, text: delta };
        }
      } else {
        const payload = (await response.json()) as unknown;
        const text = getByPath(payload, 'choices.0.message.content');
        if (typeof text === 'string') {
          full = text;
          if (text.length > 0) yield { type: 'message.delta', executionId, text };
        }
      }

      yield { type: 'message.completed', executionId, text: full };
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

export function createModelAdapter(
  config: Extract<AdapterConfig, { adapterType: 'model' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new ModelAdapter(config, ctx);
}
