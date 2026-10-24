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

/**
 * The prompt, in the protocol's own blocks.
 *
 * The protocol's prompt is a list of content blocks, and a file the owner
 * attached is a `resource` block: the runtime turns it into a part the model
 * reads — `[<uri>] | <text>` — which is what "the agent sees the file" means
 * on this route.
 *
 * A picture is a different block: the protocol takes an `image` block, with
 * the bytes in it, and the runtime makes an image part of it. The bytes travel;
 * nothing points at a file on a disk the runtime may not have.
 *
 * The uri is a name and not a path: a path would be a path on the runtime's
 * machine, and this file is not on it.
 *
 * The owner's words are in one text block, with the room's context. They are
 * not carried twice: the turn's message is the words, and the parts are what
 * the words do not carry.
 */
export function acpPrompt(input: AgentTurnInput): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = [];
  const text = `${input.message}\n\n--- context ---\n${input.context}`.trim();
  if (text.length > 0) blocks.push({ type: 'text', text });

  for (const part of input.parts ?? []) {
    if (part.type === 'image') {
      blocks.push({ type: 'image', mimeType: part.mimeType, data: part.data });
      continue;
    }
    blocks.push({
      type: 'resource',
      resource: {
        uri: `personal-os://attachment/${encodeURIComponent(part.filename)}`,
        mimeType: part.mimeType,
        text: part.text,
      },
    });
  }

  return blocks;
}

/** One block of the protocol's prompt. */
interface AcpContentBlock {
  type: 'text' | 'resource' | 'image';
  text?: string;
  mimeType?: string;
  /** The picture's bytes, as base64. */
  data?: string;
  resource?: { uri: string; mimeType?: string; text: string };
}

/**
 * The tool a protocol tool call stands for, in the product's vocabulary.
 *
 * The protocol names a call by its `kind` — `read`, `edit`, `execute` — and the
 * product names the same actions on its other route (`command`, `file_change`),
 * so the two routes say the same thing in the same room.
 */
const ACP_TOOL_NAMES: Record<string, string> = {
  execute: 'command',
  edit: 'file_change',
  read: 'read',
  delete: 'file_delete',
  move: 'file_move',
  search: 'search',
  fetch: 'fetch',
};

/**
 * The kinds that are the runtime talking about itself.
 *
 * A thought and a mode change are not actions the owner asked for and cannot
 * follow, and the product has no word for either: the same rule the Codex
 * route follows — an item the product has no word for is not invented into one.
 */
const ACP_KINDS_THAT_ARE_NOT_ACTIONS = new Set(['think', 'switch_mode']);

/** A tool call, as the protocol reported it and as the product names it. */
export interface AcpToolCall {
  /** The call's id, as the runtime named it. */
  id: string;
  /** The name the trace row carries. */
  name: string;
  /** What the tool was asked to do. */
  input?: unknown;
  /** What the tool said. */
  output?: string;
  /** The runtime's own output, when it sent one. */
  raw?: unknown;
  /** The status the runtime reported. */
  status: string;
  /** Whether the call has finished. */
  finished: boolean;
}

/**
 * The tool call a `session/update` notification describes.
 *
 * A call is announced and then updated, and the updates do not all say the
 * same things: the runtime sends the kind with the first update and drops it
 * from the later ones, so a call is read together with what the turn already
 * knows about it.
 *
 * **A call that the runtime has not finished is not finished.** The runtime
 * repeats `in_progress` with more of the output each time it streams, and only
 * `completed` and `failed` end a call. A route that answered every update
 * would show one row per line of output.
 */
export function acpToolCall(update: unknown, known?: AcpToolCall): AcpToolCall | null {
  const kind = getByPath(update, 'sessionUpdate');
  if (kind !== 'tool_call' && kind !== 'tool_call_update') return null;

  const id = getByPath(update, 'toolCallId');
  if (typeof id !== 'string' || id.length === 0) return null;

  const reported = getByPath(update, 'kind');
  const name = acpToolName(reported) ?? known?.name ?? null;
  // A kind that is not an action is not an action, and a call the turn has not
  // seen cannot be named.
  if (name === null) return null;

  const status = getByPath(update, 'status');
  const rawInput = getByPath(update, 'rawInput');
  const rawOutput = getByPath(update, 'rawOutput');
  const said = acpToolSaid(update);

  return {
    id,
    name,
    status: typeof status === 'string' ? status : (known?.status ?? 'pending'),
    // The runtime announces a call before it has filled the arguments in, so
    // an empty input never replaces one that says something.
    input: hasInput(rawInput) ? rawInput : known?.input,
    output: said ?? known?.output,
    raw: rawOutput !== undefined ? rawOutput : known?.raw,
    finished: status === 'completed' || status === 'failed',
  };
}

/**
 * Whether the runtime has said what the call was for.
 *
 * An empty object is not an answer: OpenCode announces a call with an empty
 * input and fills it in with the next update.
 */
function hasInput(input: unknown): boolean {
  if (input === undefined || input === null) return false;
  if (typeof input === 'object' && !Array.isArray(input)) {
    return Object.keys(input as Record<string, unknown>).length > 0;
  }
  return true;
}

/**
 * The name the trace row carries for a kind.
 *
 * A kind the protocol has not named is carried under the name the runtime
 * gave it: a tool that ran is a fact, and the room should show it.
 */
function acpToolName(kind: unknown): string | null {
  if (typeof kind !== 'string' || kind.length === 0) return null;
  if (ACP_KINDS_THAT_ARE_NOT_ACTIONS.has(kind)) return null;
  return ACP_TOOL_NAMES[kind] ?? kind;
}

/**
 * What the tool said.
 *
 * The protocol's content blocks carry the tool's answer as text, and the
 * runtime's own `rawOutput` carries the same thing in its own shape. Both are
 * kept: the text is what the owner reads, and the raw output is what the
 * runtime reported.
 */
function acpToolSaid(update: unknown): string | undefined {
  const content = getByPath(update, 'content');
  if (!Array.isArray(content)) return undefined;

  const parts: string[] = [];
  for (const block of content) {
    const text = getByPath(block, 'content.text');
    if (typeof text === 'string' && text.length > 0) parts.push(text);
  }
  return parts.length > 0 ? parts.join('') : undefined;
}

/**
 * The output a finished call carries.
 *
 * The product has no failure event for a tool call: a call that failed is a
 * call that finished, and the status says how it ended. The turn carried on,
 * so the failure belongs to the tool and not to the turn.
 */
export function acpToolOutput(call: AcpToolCall): Record<string, unknown> | undefined {
  if (call.output === undefined && call.raw === undefined) return undefined;
  return {
    status: call.status,
    ...(call.output !== undefined ? { output: call.output } : {}),
    ...(call.raw !== undefined ? { raw: call.raw } : {}),
  };
}

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
        // The protocol's prompt is a list of content blocks, and a file the
        // owner attached is one of them.
        acceptsAttachments: true,
        // And so is a picture: the protocol's prompt takes an image block,
        // with the bytes in it.
        acceptsImages: true,
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
    let finalText = '';
    /**
     * The events the runtime has produced, in the order it produced them.
     *
     * One queue, so that a tool call and the text around it keep the order
     * the runtime gave them: the room's timeline is a record of what happened,
     * not a reconstruction of it.
     */
    const pending: Array<
      Extract<AgentEvent, { type: 'message.delta' | 'tool.started' | 'tool.completed' }>
    > = [];
    /**
     * The tool calls this turn has seen, keyed by the runtime's own id.
     *
     * The runtime names a call's kind with the first update and drops it from
     * the later ones, so a call is read together with what the turn already
     * knows about it. A call is also *announced* separately, because a runtime
     * may announce a call before it says what the call is for.
     */
    const calls = new Map<string, { call: AcpToolCall; announced: boolean }>();
    /**
     * Whether the turn's prompt has been sent.
     *
     * **A turn's work is what arrives after the prompt.** Loading a session
     * replays it: the runtime sends the session's messages — the owner's
     * words, the agent's answers, and the tool calls it made — as the updates
     * a client needs to restore its view of the session. That history is not
     * this turn's work, and a route that reported it would put the session's
     * earlier answers and tool calls into the turn that resumed it.
     *
     * The boundary is exact, and it was measured rather than assumed. The
     * installed runtime (OpenCode 1.19.4) replays the session *while the load
     * is still in flight* — the replay arrives before the load's own answer —
     * and a second prompt carries only the new words, not the history again.
     * So the updates that arrive before the prompt is written belong to the
     * load, and the ones that arrive after it belong to this turn.
     */
    let promptSent = false;
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
      // The session's history, replayed by the load, is not this turn's work.
      if (!promptSent) return;
      const update = getByPath(params, 'update');
      const kind = getByPath(update, 'sessionUpdate');

      if (kind === 'agent_message_chunk') {
        const text = getByPath(update, 'content.text');
        if (typeof text === 'string' && text.length > 0) {
          finalText += text;
          pending.push({ type: 'message.delta', executionId, text });
        }
        return;
      }

      if (kind !== 'tool_call' && kind !== 'tool_call_update') return;

      const id = getByPath(update, 'toolCallId');
      if (typeof id !== 'string') return;

      const known = calls.get(id);
      const call = acpToolCall(update, known?.call);
      if (!call) return;
      const entry = known ?? { call, announced: false };
      entry.call = call;
      calls.set(id, entry);

      // A call is announced when the runtime has said enough about it to be
      // worth a row: what it is, and what it was called with when the runtime
      // has said that. OpenCode announces a call with an empty input and
      // fills it in with the next update, and a row announced on the empty
      // one says nothing about what was read.
      if (!entry.announced && (hasInput(call.input) || call.finished)) {
        announce(entry);
      }

      // Only the end of a call is news after the start. The updates in between
      // are the same call saying more about itself.
      if (call.finished) {
        const output = acpToolOutput(call);
        pending.push({
          type: 'tool.completed',
          executionId,
          toolName: call.name,
          ...(output !== undefined ? { output } : {}),
        });
      }
    });

    /** Announce a call to the room. */
    function announce(entry: { call: AcpToolCall; announced: boolean }): void {
      entry.announced = true;
      pending.push({
        type: 'tool.started',
        executionId,
        toolName: entry.call.name,
        ...(entry.call.input !== undefined ? { input: entry.call.input } : {}),
      });
    }

    /**
     * Announce the calls the runtime never said enough about.
     *
     * A call that started and never finished is still a call: the room shows
     * it as one, and the product's own vocabulary has an outcome for it —
     * unfinished.
     */
    function announceTheCallsTheRuntimeLeftOpen(): void {
      for (const entry of calls.values()) {
        if (!entry.announced) announce(entry);
      }
    }

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

      // From here the runtime's updates are this turn's work. What the load
      // replayed was the session's history.
      promptSent = true;

      const promptPromise = client.request(
        'session/prompt',
        {
          sessionId,
          prompt: acpPrompt(input),
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
          // A call the runtime never said enough about is still a call, and the
          // turn that is suspended is the last chance to say so.
          announceTheCallsTheRuntimeLeftOpen();
          yield asked;
          // The turn is suspended on the owner's decision, and the runtime's
          // request does not survive it: the agent is released below. The
          // runtime is asked again when the decision resumes the turn.
          return;
        }
        while (pending.length > 0) {
          const event = pending.shift();
          if (event) yield event;
        }
        await Promise.race([promptPromise.catch(() => undefined), delay(50)]);
      }

      announceTheCallsTheRuntimeLeftOpen();

      while (pending.length > 0) {
        const event = pending.shift();
        if (event) yield event;
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
    // The response does not have to carry a session id, and OpenCode 1.19.4
    // does not: it answers with its configuration options and no id. The
    // session the client asked to load is the session it has, so the id it
    // asked with is the id that is kept. A runtime that answers with one has
    // renamed or forked the session, and that id is the one to use.
    const sessionId = session?.sessionId ?? externalSessionId;
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
