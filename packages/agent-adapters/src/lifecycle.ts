import { ADAPTER_NOT_CONNECTED_CODE, type AgentEvent } from '@personal-os/contracts';

/**
 * The lifecycle every adapter shares: connect, send, close.
 *
 * An adapter that holds a runtime — a supervised child process, a transport,
 * a socket — establishes it in `connect()` and releases it in `close()`. A
 * turn runs on that runtime, and a turn that is asked to run on an instance
 * that was never connected is refused with a message that names the fix.
 *
 * The refusal is the point. A turn that runs on a runtime nobody
 * established fails somewhere else, and the message it fails with describes
 * a symptom ("the server was never reached") rather than a cause. The owner
 * reads that message and cannot see the adapter's internals, so it has to
 * say what is wrong and what to do about it.
 */

/** The error an adapter raises when a turn is asked to run before `connect()`. */
export class AdapterNotConnectedError extends Error {
  readonly code = ADAPTER_NOT_CONNECTED_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'AdapterNotConnectedError';
  }
}

/**
 * The message a refused turn carries.
 *
 * `reason` is the sentence that explains why the adapter is not connected —
 * a failed handshake, a closed adapter — and it is appended to the fix, not
 * used instead of it.
 */
export function notConnectedMessage(label: string, reason?: string): string {
  const message = `This ${label} adapter was not connected. Call connect() before send().`;
  return reason ? `${message} ${reason}` : message;
}

/** The event a refused turn yields. */
export function notConnectedEvent(executionId: string, message: string): AgentEvent {
  return {
    type: 'execution.error',
    executionId,
    code: ADAPTER_NOT_CONNECTED_CODE,
    message,
  };
}

/**
 * Whether an adapter is connected, and why it is not.
 *
 * Every adapter holds one. The label is what the owner reads in the refusal
 * ("MCP", "CLI"), so it names the adapter, not a provider.
 */
export class AdapterLifecycle {
  private connected = false;
  private reason: string | undefined;

  constructor(private readonly label: string) {}

  /** The runtime is established. */
  markConnected(): void {
    this.connected = true;
    this.reason = undefined;
  }

  /** The runtime could not be established, and this is why. */
  markFailed(reason: string): void {
    this.connected = false;
    this.reason = `The last connection attempt failed: ${reason}`;
  }

  /** The runtime was released. */
  markClosed(): void {
    this.connected = false;
    this.reason = 'The adapter was closed.';
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** The message this adapter refuses a turn with. */
  message(): string {
    return notConnectedMessage(this.label, this.reason);
  }

  /** Refuse a turn that was asked to run on an unconnected instance. */
  requireConnected(): void {
    if (!this.connected) throw new AdapterNotConnectedError(this.message());
  }
}
