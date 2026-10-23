import { createHash } from 'node:crypto';
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
import { AdapterLifecycle } from './lifecycle.js';
import { JsonRpcStdioClient } from './jsonrpc.js';
import { getByPath } from './util.js';

const PROTOCOL_VERSION = 1;

/** The method a runtime asks the client for permission with. */
const PERMISSION_METHOD = 'session/request_permission';

interface AcpSession {
  sessionId: string;
}

interface AcpCapabilities {
  loadSession?: boolean;
  promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
  [key: string]: unknown;
}

/** One option the runtime offers the client as an answer. */
interface AcpPermissionOption {
  optionId: string;
  name?: string;
  kind?: string;
}

/** The operation the runtime is asking about. */
interface AcpPermissionToolCall {
  toolCallId?: string;
  title?: string;
  kind?: string;
  status?: string;
  rawInput?: unknown;
}

/** A permission request, as the protocol sends it. */
interface AcpPermissionRequest {
  sessionId?: string;
  toolCall: AcpPermissionToolCall;
  options: AcpPermissionOption[];
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
 *
 * **A runtime's own permission request reaches the owner.** The runtime asks
 * the client for permission with `session/request_permission`, and the ask
 * becomes the product's approval: the turn is suspended, the owner decides,
 * and the decision answers the runtime in the turn that resumes.
 *
 * The request does not survive the suspension. The turn that asked is
 * suspended, and the agent is released with it, so the runtime is asked again
 * when the decision resumes the turn. The answer it gets then is the owner's
 * answer, and it is the answer to the same operation — a runtime that asks
 * about something else is asked about again.
 *
 * ACP sets its runtime up as part of the turn, and that is kept: a turn
 * initialises the agent, creates or restores its session and prompts it. The
 * connection is still a real handshake against a real agent — it reports
 * what the agent says it can do — but it is a probe, not a runtime the turn
 * borrows, so it releases the agent it started. `close()` releases whatever
 * the adapter is still holding, which is the agent of a turn in flight.
 */
export class AcpAdapter implements AgentAdapter {
  readonly type = 'acp' as const;

  /**
   * The ACP session is set up by the turn itself, so a turn does not need a
   * prior connection and the agent is not started twice.
   */
  readonly holdsRuntime = false;

  private readonly config: Extract<AdapterConfig, { adapterType: 'acp' }>;
  private readonly ctx: AdapterContext;
  /** The session each execution is in, so the worker can persist it. */
  private readonly sessions = new Map<string, string>();
  private readonly lifecycle = new AdapterLifecycle('ACP');
  /** The agent of the turn in flight, so `close()` can release it. */
  private client: JsonRpcStdioClient | null = null;

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
      this.lifecycle.markConnected();
      return {
        chat: true,
        streaming: true,
        persistentSessions: caps.loadSession === true,
        backgroundTasks: true,
        cancel: true,
        // The runtime's own permission request is raised as the product's
        // approval, so the owner decides it.
        approvals: true,
        // The route surfaces no artifact. The protocol's streamed updates
        // carry the agent's text and its tool calls, and the adapter turns
        // neither into a resource.
        artifacts: false,
      };
    } catch (error) {
      this.lifecycle.markFailed(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      // The probe does not keep the agent: a capability probe that leaves a
      // process behind is a leak, not a capability.
      await client.close();
    }
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    const client = this.spawn();
    this.client = client;
    const deltas: string[] = [];
    let finalText = '';
    // Held in an object so the type stays `Error | null` after the
    // callbacks that assign it have run.
    const outcome: { failure: Error | null } = { failure: null };

    /**
     * The runtime's permission request, when it makes one.
     *
     * It is a queue rather than a flag because it arrives on the transport's
     * own time, while the turn is running: the request handler and the turn
     * are two tasks, and the turn has to find what the handler put there.
     */
    const approvals: Array<Extract<AgentEvent, { type: 'approval.requested' }>> = [];
    /**
     * Settles the request the runtime is waiting on, when the turn ends.
     *
     * A request that is never answered leaves the transport waiting for an
     * answer that is not coming, and the turn that asked is released with the
     * agent. Settling it closes that wait.
     */
    const release: Array<(reason: string) => void> = [];

    const offNotification = client.onNotification((method, params) => {
      if (method !== 'session/update') return;
      const update = getByPath(params, 'update');
      const kind = getByPath(update, 'sessionUpdate');
      if (kind !== 'agent_message_chunk') return;
      const text = getByPath(update, 'content.text');
      if (typeof text === 'string' && text.length > 0) deltas.push(text);
    });

    const offRequest = client.onRequest((method, params) => {
      if (method !== PERMISSION_METHOD) {
        // Peer-initiated requests for file access or a terminal are declined:
        // this adapter advertises no filesystem or terminal capability.
        throw new Error('This Personal OS adapter does not grant client-side capabilities.');
      }

      const request = readPermissionRequest(params);
      const approvalId = permissionApprovalId(executionId, request);

      // The owner has already decided about this operation. The runtime is
      // asked again in this turn, and the answer it gets is the owner's.
      if (input.approval && input.approval.approvalId === approvalId) {
        return permissionOutcome(request, input.approval.approved);
      }

      // The owner has not decided about it. The request becomes the product's
      // approval, and the turn stops there.
      approvals.push({
        type: 'approval.requested',
        executionId,
        approvalId,
        summary: permissionSummary(request),
        details: permissionDetails(request),
      });

      // The runtime waits for an answer this turn does not give it: the turn
      // is suspended on the owner's decision, and the agent is released with
      // it. The request goes with the transport.
      return new Promise<never>((_resolve, reject) => {
        release.push((reason: string) => reject(new Error(reason)));
      });
    });

    const onAbort = () => {
      try {
        client.notify('session/cancel', { sessionId: undefined });
      } catch {
        // best effort
      }
      void client.close();
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
        const asked = approvals.shift();
        if (asked) {
          yield asked;
          // The turn is suspended on the owner's decision, and the runtime's
          // request does not survive it: the agent is released below. The
          // runtime is asked again when the decision resumes the turn.
          return;
        }
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
      if (this.client === client) this.client = null;
      await client.close();
      // A request the turn never answered is settled on the way out: the
      // runtime was waiting for an answer that is not coming, and the
      // transport has already gone.
      for (const settle of release) {
        settle("The turn was suspended on the owner's decision.");
      }
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
      await client.close();
    }
  }

  /**
   * Release the agent this adapter is holding.
   *
   * A turn in flight owns an agent process; closing the adapter stops it and
   * waits for it to be gone. It is safe to call more than once, and safe to
   * call when no turn is running.
   */
  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client) await client.close();
    this.lifecycle.markClosed();
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
    // The protocol asks for the working directory and the MCP servers of the
    // session. An agent that checks them — Hermes does — refuses a request
    // that leaves them out, and the refusal reads as "invalid params".
    const session = (await client.request(
      'session/new',
      {
        cwd: this.config.cwd ?? process.cwd(),
        mcpServers: [],
      },
      30_000,
    )) as AcpSession;
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

/** Read the permission request the runtime sent. */
function readPermissionRequest(params: unknown): AcpPermissionRequest {
  const options = getByPath(params, 'options');
  const title = getByPath(params, 'toolCall.title');
  const toolCallId = getByPath(params, 'toolCall.toolCallId');
  const kind = getByPath(params, 'toolCall.kind');
  const status = getByPath(params, 'toolCall.status');
  const rawInput = getByPath(params, 'toolCall.rawInput');
  const sessionId = getByPath(params, 'sessionId');

  return {
    ...(typeof sessionId === 'string' ? { sessionId } : {}),
    toolCall: {
      ...(typeof toolCallId === 'string' ? { toolCallId } : {}),
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof kind === 'string' ? { kind } : {}),
      ...(typeof status === 'string' ? { status } : {}),
      rawInput,
    },
    options: Array.isArray(options)
      ? options.filter(
          (option): option is AcpPermissionOption =>
            typeof (option as AcpPermissionOption | undefined)?.optionId === 'string',
        )
      : [],
  };
}

/**
 * The id of the approval a permission request raises.
 *
 * It names the operation the runtime asked about and not the request's own
 * identity, because the runtime's request does not survive the suspension:
 * when the decision resumes the turn, the runtime asks again, and it asks
 * about the same operation. A runtime that asks about something else gets a
 * different id, and the owner is asked about that instead of being answered
 * with an answer they never gave.
 */
function permissionApprovalId(executionId: string, request: AcpPermissionRequest): string {
  const digest = createHash('sha256')
    .update(`${executionId}\n${operationFingerprint(request)}`)
    .digest('hex')
    .slice(0, 32);
  return `apr_acp_${digest}`;
}

/** What the operation is, in a form that hashes the same every time. */
function operationFingerprint(request: AcpPermissionRequest): string {
  return `${request.toolCall.title ?? ''}\n${stableJson(request.toolCall.rawInput)}`;
}

/** JSON with the keys in a fixed order, so the same value hashes the same. */
function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

/**
 * The answer the runtime gets.
 *
 * The protocol's answer is one of the options the runtime offered, named by
 * its id, or a cancelled outcome. An approval is answered with the option
 * that allows the operation once — the owner approved this operation, not
 * every operation of this kind — and a refusal with the option that rejects
 * it. A runtime that offered neither is answered with the cancelled outcome,
 * which is the protocol's way of saying no.
 */
function permissionOutcome(request: AcpPermissionRequest, approved: boolean): unknown {
  const wanted = approved ? 'allow' : 'reject';
  const option =
    request.options.find((candidate) => candidate.kind === `${wanted}_once`) ??
    request.options.find((candidate) => candidate.kind?.startsWith(wanted));
  if (!option) return { outcome: { outcome: 'cancelled' } };
  return { outcome: { outcome: 'selected', optionId: option.optionId } };
}

/** What the owner is asked about, in a sentence. */
function permissionSummary(request: AcpPermissionRequest): string {
  const title = request.toolCall.title?.trim();
  const what = title ? `run ${title}` : 'run a tool';
  const input = describeInput(request.toolCall.rawInput);
  return input ? `The agent wants to ${what}: ${input}` : `The agent wants to ${what}`;
}

/**
 * What the record says about the request.
 *
 * It says plainly that the request does not survive the suspension, because
 * the owner reads this record and has to be able to tell what happened to the
 * runtime's question.
 */
function permissionDetails(request: AcpPermissionRequest): Record<string, unknown> {
  return {
    toolCall: request.toolCall,
    options: request.options,
    note: 'The runtime asked for permission inside this turn. The turn is suspended here, so the request does not survive it: the agent is released, and the runtime is asked again when the decision resumes the turn. The decision is the answer it gets then.',
  };
}

/** The operation's own words, in something the owner can read. */
function describeInput(rawInput: unknown): string {
  if (rawInput === undefined || rawInput === null) return '';
  if (typeof rawInput === 'string') return cap(rawInput.trim());
  if (typeof rawInput !== 'object') return cap(String(rawInput));
  const record = rawInput as Record<string, unknown>;
  const parts = Object.entries(record).map(([key, value]) => `${key}=${describeValue(value)}`);
  return cap(parts.join(', '));
}

function describeValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

/** A detail, no longer than a sentence should be. */
function cap(text: string, limit = 300): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
