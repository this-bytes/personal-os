import {
  NO_CAPABILITIES,
  type AdapterConfig,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentExecutionStatus,
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

  /**
   * Whether this turn asked the owner for a decision.
   *
   * The answer is the session the turn can be continued in, and a turn that
   * never asked cannot be continued in anything.
   */
  private asked = false;

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    return {
      ...CAPABILITIES,
      // An agent that asks the owner for a decision says so: the panel shows
      // what the agent can do, and a request is one of the things it can do.
      approvals: Boolean(this.config.ask),
      // An agent that asks can be continued after the answer. Its session is
      // the turn it asked in, so the decision can be its next input.
      persistentSessions: Boolean(this.config.ask),
    };
  }

  /**
   * The session this turn is in, when the agent asked the owner.
   *
   * The session is what a decision needs in order to continue the turn
   * instead of closing it. An agent that has no session to offer has none —
   * and a turn that did not ask has no session either.
   */
  async getStatus(executionId: string): Promise<AgentExecutionStatus> {
    if (!this.asked) return { executionId, status: 'completed' };
    return { executionId, status: 'blocked', externalRef: `echo_${executionId}` };
  }

  /** The session is the turn's own, so it is restored by being named. */
  async resumeSession(_connection: AgentConnection, sessionId: string): Promise<string> {
    return sessionId;
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

    /**
     * The agent asks the owner, and the turn stops here.
     *
     * The agent asks once. A turn that continues after the owner's decision
     * arrives in the session the request was made in, and the decision is
     * that turn's message — so the agent has nothing left to ask.
     */
    if (this.config.ask && !input.externalSessionId) {
      this.asked = true;
      yield {
        type: 'approval.requested',
        executionId: input.executionId,
        approvalId: `apr_echo_${input.executionId}`,
        summary: this.config.ask.summary,
        details: this.config.ask.details,
      };
      return;
    }

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
