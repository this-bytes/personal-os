import {
  NO_CAPABILITIES,
  type AdapterConfig,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
} from '@personal-os/contracts';
import type { AdapterContext } from './types.js';
import type { EchoAdapterConfig } from '@personal-os/contracts';

const CAPABILITIES: AgentCapabilities = {
  chat: true,
  streaming: true,
  persistentSessions: false,
  backgroundTasks: false,
  cancel: true,
  approvals: false,
  artifacts: false,
};

/**
 * A deterministic local agent. It exists so the product is usable (and
 * testable) before any external agent is configured.
 *
 * The lifecycle is explicit. `connect()` reports what the echo agent can do;
 * `send()` answers; `close()` releases what the adapter holds — which, for
 * an agent that holds nothing, is nothing. It has no runtime to be missing,
 * so a turn does not need a connection first.
 */
export class EchoAdapter implements AgentAdapter {
  readonly type = 'echo' as const;

  /** The echo agent has no runtime to establish. */
  readonly holdsRuntime = false;

  constructor(
    private readonly config: EchoAdapterConfig,
    private readonly ctx: AdapterContext,
  ) {}

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return { ...CAPABILITIES };
  }

  /** Release what the adapter holds. The echo agent holds nothing. */
  close(): void {
    // Nothing to release.
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const reply =
      this.config.reply ??
      `Echo agent received ${input.message.length} characters of context. ` +
        `This connection works end to end without an external agent.`;

    if (this.config.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }

    yield { type: 'execution.status', executionId: input.executionId, status: 'running' };

    for (const chunk of reply.match(/.{1,64}/gs) ?? []) {
      if (input.signal?.aborted) {
        yield {
          type: 'execution.error',
          executionId: input.executionId,
          code: 'cancelled',
          message: 'Execution cancelled.',
        };
        return;
      }
      yield { type: 'message.delta', executionId: input.executionId, text: chunk };
    }

    yield { type: 'message.completed', executionId: input.executionId, text: reply };
    yield { type: 'execution.status', executionId: input.executionId, status: 'completed' };
  }
}

export function createEchoAdapter(
  config: Extract<AdapterConfig, { adapterType: 'echo' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new EchoAdapter(config, ctx);
}

export { NO_CAPABILITIES };
