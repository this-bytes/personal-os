import {
  type AgentAdapter,
  type AgentCapabilities,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AdapterConfig,
} from '@personal-os/contracts';
import { JsonRpcStdioClient } from './jsonrpc.js';
import { AdapterLifecycle, notConnectedEvent } from './lifecycle.js';
import type { AdapterContext } from './types.js';
import { buildSanitizedEnv, interpolateJson, parseSseData, readSseEvents } from './util.js';

/**
 * An agent that is an MCP server.
 *
 * The Model Context Protocol is a published interface, and this adapter is a
 * client of it: it initializes the session, lists the server's tools, and
 * calls one of them for a turn. It is not a fork of MCP and it does not
 * reimplement one — the server's own tool names and schemas are used as they
 * are published.
 *
 * A turn is one tool call. The tool's text output is the reply. Nothing else
 * is claimed: an MCP tool call cannot be interrupted, cannot be steered, and
 * returns its result in one piece, so the adapter reports `cancel: false`,
 * `streaming: false` and `acceptsSteering: false` rather than pretending.
 *
 * The lifecycle is explicit. `connect()` starts the server and completes the
 * handshake — `initialize`, `notifications/initialized`, `tools/list` — and
 * only then is the instance usable; `send()` calls the tool; `close()`
 * releases the server. A turn on an instance that was never connected is
 * refused with a message that says so, because the failure it used to
 * report ("the server was never reached") described a symptom and left the
 * owner with nothing to act on.
 */

interface McpTool {
  name: string;
  description?: string;
}

interface McpTransport {
  request(method: string, params: unknown, timeoutMs: number): Promise<unknown>;
  notify(method: string, params: unknown): void;
  close(): void | Promise<void>;
}

interface JsonRpcResponse {
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** A JSON-RPC transport over a supervised child process. */
class McpStdioTransport implements McpTransport {
  private readonly client: JsonRpcStdioClient;

  constructor(command: string, args: string[], cwd: string | undefined, env: NodeJS.ProcessEnv) {
    this.client = new JsonRpcStdioClient(command, args, { cwd, env });
  }

  request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    return this.client.request(method, params, timeoutMs);
  }

  notify(method: string, params: unknown): void {
    this.client.notify(method, params);
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

/**
 * A JSON-RPC transport over the MCP Streamable HTTP transport.
 *
 * The server answers a request either with a JSON body or with an event
 * stream; both are handled. A session id the server hands out is carried on
 * every later request, and the protocol revision is announced after the
 * handshake, as the transport requires.
 */
class McpHttpTransport implements McpTransport {
  private nextId = 1;
  private sessionId: string | undefined;
  private readonly protocolVersion: string;

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
    protocolVersion: string,
  ) {
    this.protocolVersion = protocolVersion;
  }

  async request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const id = this.nextId++;
    const response = await this.post({ jsonrpc: '2.0', id, method, params }, timeoutMs);
    const payload = response as JsonRpcResponse;
    if (payload.error) {
      throw new Error(`${payload.error.message} (code ${payload.error.code})`);
    }
    return payload.result;
  }

  async notify(method: string, params: unknown): Promise<void> {
    await this.post({ jsonrpc: '2.0', method, params }, 30_000);
  }

  close(): void {
    // Nothing to release: the transport holds no connection of its own.
  }

  private async post(payload: unknown, timeoutMs: number): Promise<unknown> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...this.headers,
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    if (this.protocolVersion) headers['mcp-protocol-version'] = this.protocolVersion;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`The MCP server returned HTTP ${response.status}. ${detail.slice(0, 500)}`);
      }
      const session = response.headers.get('mcp-session-id');
      if (session) this.sessionId = session;

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream') && response.body) {
        for await (const event of readSseEvents(response.body)) {
          const parsed = parseSseData(event.data);
          if (!parsed || typeof parsed !== 'object') continue;
          const message = parsed as JsonRpcResponse;
          if (message.id === undefined || message.id === null) continue;
          return message;
        }
        throw new Error('The MCP server closed the event stream without answering.');
      }

      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class McpAdapter implements AgentAdapter {
  readonly type = 'mcp' as const;

  /** The transport is established in `connect()` and the turn runs on it. */
  readonly holdsRuntime = true;

  private readonly config: Extract<AdapterConfig, { adapterType: 'mcp' }>;
  private readonly ctx: AdapterContext;
  private readonly lifecycle = new AdapterLifecycle('MCP');
  private transport: McpTransport | null = null;
  private tools: McpTool[] = [];

  constructor(config: Extract<AdapterConfig, { adapterType: 'mcp' }>, ctx: AdapterContext) {
    this.config = config;
    this.ctx = ctx;
  }

  async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
    try {
      this.transport = await this.start();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.ctx.logger.warn('The MCP server could not be reached.', { error: reason });
      this.lifecycle.markFailed(reason);
      return this.capabilities(false);
    }

    try {
      await this.transport.request(
        'initialize',
        {
          protocolVersion: this.config.protocolVersion,
          capabilities: {},
          clientInfo: { name: 'personal-os', version: '0.1.0' },
        },
        this.timeoutMs(),
      );
      this.transport.notify('notifications/initialized', {});

      const listed = (await this.transport.request('tools/list', {}, this.timeoutMs())) as {
        tools?: McpTool[];
      };
      this.tools = Array.isArray(listed.tools) ? listed.tools : [];
      this.lifecycle.markConnected();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.ctx.logger.warn('The MCP server did not complete the handshake.', { error: reason });
      this.lifecycle.markFailed(reason);
      // A handshake that failed leaves a server process behind unless it is
      // released here: nothing else will close it.
      await this.release();
      return this.capabilities(false);
    }

    const present = this.tools.some((tool) => tool.name === this.config.toolName);
    const allowed =
      this.config.allowedTools.length === 0 ||
      this.config.allowedTools.includes(this.config.toolName);

    if (!present) {
      this.ctx.logger.warn('The MCP server does not publish the configured tool.', {
        toolName: this.config.toolName,
        published: this.tools.map((tool) => tool.name),
      });
    } else if (!allowed) {
      this.ctx.logger.warn('The configured tool is not in the connection\u2019s allow-list.', {
        toolName: this.config.toolName,
      });
    }

    return this.capabilities(present && allowed);
  }

  async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
    const { executionId } = input;
    yield { type: 'execution.status', executionId, status: 'running' };

    if (!this.lifecycle.isConnected) {
      // The instance was never connected, so the server was never started.
      // Say so, and say what to do about it.
      yield notConnectedEvent(executionId, this.lifecycle.message());
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    const transport = this.transport;
    if (!transport) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'adapter_failed',
        message: 'The MCP server was never reached.',
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    let args: unknown;
    try {
      const rendered = interpolateJson(this.config.argumentTemplate, {
        message: input.message,
        context: input.context,
        conversationId: input.conversationId,
        executionId: input.executionId,
      });
      args = JSON.parse(rendered) as unknown;
    } catch (error) {
      yield {
        type: 'execution.error',
        executionId,
        code: 'adapter_failed',
        message: `The tool's argument template is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
      yield { type: 'execution.status', executionId, status: 'failed' };
      return;
    }

    yield { type: 'tool.started', executionId, toolName: this.config.toolName, input: args };

    try {
      const result = (await transport.request(
        'tools/call',
        { name: this.config.toolName, arguments: args },
        this.timeoutMs(),
      )) as { content?: unknown; isError?: boolean; structuredContent?: unknown };

      yield {
        type: 'tool.completed',
        executionId,
        toolName: this.config.toolName,
        output: result.structuredContent ?? result.content,
      };

      if (result.isError) {
        yield {
          type: 'execution.error',
          executionId,
          code: 'adapter_failed',
          message: `The tool "${this.config.toolName}" reported an error.`,
        };
        yield { type: 'execution.status', executionId, status: 'failed' };
        return;
      }

      const text = extractText(result.content) ?? stringifyStructured(result.structuredContent);
      if (text) yield { type: 'message.delta', executionId, text };
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

  async cancel(_executionId: string): Promise<void> {
    // An MCP tool call is atomic: the protocol has no way to interrupt one.
    // The adapter reports `cancel: false`, so the worker knows not to ask.
  }

  /**
   * Release the MCP server this adapter started.
   *
   * The server is a child process; closing the adapter stops it and waits
   * for it to be gone. It is safe to call more than once, and safe to call
   * on an instance that was never connected.
   */
  async close(): Promise<void> {
    await this.release();
    this.lifecycle.markClosed();
  }

  private async start(): Promise<McpTransport> {
    if (this.config.transport === 'http') {
      if (!this.config.url) {
        throw new Error('The http transport needs a url.');
      }
      const headers: Record<string, string> = {};
      if (this.config.authTokenRef) {
        const token = await this.ctx.resolveSecret(this.config.authTokenRef);
        if (token) headers.authorization = `Bearer ${token}`;
      }
      return new McpHttpTransport(this.config.url, headers, this.config.protocolVersion);
    }

    if (!this.config.command) {
      throw new Error('The stdio transport needs a command.');
    }
    return new McpStdioTransport(
      this.config.command,
      this.config.args,
      this.config.cwd,
      buildSanitizedEnv(this.config.env),
    );
  }

  private capabilities(chat: boolean): AgentCapabilities {
    return {
      chat,
      streaming: false,
      persistentSessions: false,
      backgroundTasks: false,
      cancel: false,
      approvals: false,
      artifacts: false,
      acceptsSteering: false,
    };
  }

  private timeoutMs(): number {
    return this.config.timeoutSeconds * 1_000;
  }

  private async release(): Promise<void> {
    const transport = this.transport;
    this.transport = null;
    if (transport) await transport.close();
  }
}

/** The text of an MCP tool result, if it has any. */
function extractText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const entry = part as { type?: string; text?: unknown };
    if (entry.type === 'text' && typeof entry.text === 'string') parts.push(entry.text);
  }
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/** A tool that answered with structured content rather than text. */
function stringifyStructured(structured: unknown): string | undefined {
  if (structured === undefined || structured === null) return undefined;
  if (typeof structured === 'string') return structured;
  return JSON.stringify(structured);
}

export function createMcpAdapter(
  config: Extract<AdapterConfig, { adapterType: 'mcp' }>,
  ctx: AdapterContext,
): AgentAdapter {
  return new McpAdapter(config, ctx);
}
