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
  /**
   * The echo agent takes input while a turn is running.
   *
   * It has nothing of its own to add, so a steer replaces the rest of its
   * answer with what the owner said — which is the most an echo agent can
   * honestly do.
   */
  acceptsSteering: true,
};

/** How long the echo agent waits between two chunks of its answer. */
const CHUNK_PAUSE_MS = 25;

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

    // The turn says it is running before it works. The panel shows that, and
    // the owner may steer a turn they can see running — so the delay that
    // follows is the work taking its time, not the turn failing to start.
    yield { type: 'execution.status', executionId: input.executionId, status: 'running' };

    if (this.config.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }

    // The owner's steers, read between the chunks of the answer.
    //
    // The read never gives up: a steer that has not arrived yet leaves the
    // read waiting, so the next chunk waits with it and a steer that arrives
    // in between is not lost.
    const steers = input.steer?.[Symbol.asyncIterator]();
    let pending: Promise<IteratorResult<string> | null> | null = null;

    const takeSteer = async (): Promise<string | null> => {
      if (!steers) return null;
      pending ??= steers.next();
      const settled = await Promise.race([
        pending,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 0)),
      ]);
      if (settled === null) return null;
      pending = null;
      return settled.done ? null : settled.value;
    };

    let answer = reply;
    let steered = false;

    for (const chunk of reply.match(/.{1,64}/gs) ?? []) {
      const said = await takeSteer();
      if (said !== null) {
        // The owner said something else, and the echo agent answers the last
        // thing it was told. What it had already said stays said: the answer
        // is the part that was streamed and then what the owner said.
        answer = said;
        steered = true;
        break;
      }
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
      await new Promise((resolve) => setTimeout(resolve, CHUNK_PAUSE_MS));
    }

    // The rest of the answer is what the owner last said.
    if (steered) {
      for (const chunk of answer.match(/.{1,64}/gs) ?? []) {
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
    }

    yield { type: 'message.completed', executionId: input.executionId, text: answer };
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
