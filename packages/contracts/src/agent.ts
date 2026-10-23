import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';
import { mcpToolNameSchema } from './mcp.js';
import type { AdapterConfig } from './adapter-config.js';

/**
 * Adapter categories. A new agent type must be addable without changing
 * conversation storage or the factory task model.
 */
export const adapterTypeSchema = z.enum([
  'cli',
  'acp',
  'a2a',
  'http',
  'model',
  'echo',
  'mcp',
  'codex',
]);
export type AdapterType = z.infer<typeof adapterTypeSchema>;

export const adapterTypeLabels: Record<AdapterType, string> = {
  cli: 'CLI agent',
  acp: 'ACP session agent',
  a2a: 'A2A agent',
  http: 'Gateway / HTTP API',
  model: 'Model API (no harness)',
  echo: 'Built-in echo (local test)',
  mcp: 'MCP server',
  codex: 'Codex CLI agent',
};

/**
 * What an agent is, and how it should behave.
 *
 * The connection sets the base persona; a conversation may override it for
 * one participant. Both fields are optional, so a connection written before
 * this existed stays valid and resolves to the runtime's own default.
 */
export const personaSchema = z.object({
  /** One line, shown to the owner. */
  role: z.string().min(1).max(200).optional(),
  /** Standing instructions, shown to the agent. */
  instructions: z.string().max(8_000).optional(),
});
export type Persona = z.infer<typeof personaSchema>;

/**
 * Where the persona in force came from. The panel names it, so an overridden
 * value is never displayed as if it were the base.
 */
export const personaSourceSchema = z.enum(['conversation', 'connection', 'default']);
export type PersonaSource = z.infer<typeof personaSourceSchema>;

/** How the source is named in the panel. */
export const personaSourceLabels: Record<PersonaSource, string> = {
  conversation: 'conversation',
  connection: 'connection',
  default: 'default',
};

export interface ResolvedPersona {
  /** The persona in force. Absent when the runtime's own default framing is used. */
  persona?: Persona;
  /** Where the persona in force came from. */
  source: PersonaSource;
}

/** A persona that says nothing is no persona at all. */
function cleanPersona(persona: Persona | null | undefined): Persona | undefined {
  if (!persona) return undefined;
  const role = persona.role?.trim();
  const instructions = persona.instructions?.trim();
  const cleaned: Persona = {};
  if (role && role.length > 0) cleaned.role = role;
  if (instructions && instructions.length > 0) cleaned.instructions = instructions;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Resolve the persona in force: most specific first, whole entity.
 *
 * An override that sets a role or instructions *is* the persona — the
 * connection's base is not consulted, and is never merged field by field. A
 * half-overridden persona is a stranger. With neither, the agent runs with
 * its runtime's own default framing.
 *
 * One resolver, one truth: the server, the worker and the web client all
 * call this, so they cannot disagree about which persona is in force.
 */
export function resolvePersona(input: {
  /** The participant's override, for this conversation only. */
  override?: Persona | null;
  /** The connection's base persona. */
  base?: Persona | null;
}): ResolvedPersona {
  const override = cleanPersona(input.override);
  if (override) return { persona: override, source: 'conversation' };

  const base = cleanPersona(input.base);
  if (base) return { persona: base, source: 'connection' };

  return { source: 'default' };
}

export const agentConnectionSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  adapterType: adapterTypeSchema,
  /** Opaque reference to a server-held configuration record. Never inlined. */
  configRef: idSchema,
  enabled: z.boolean(),
  /** The base persona. A conversation may override it for one participant. */
  persona: personaSchema.optional(),
});
export type AgentConnection = z.infer<typeof agentConnectionSchema>;

export const agentCapabilitiesSchema = z.object({
  chat: z.boolean(),
  streaming: z.boolean(),
  persistentSessions: z.boolean(),
  backgroundTasks: z.boolean(),
  cancel: z.boolean(),
  approvals: z.boolean(),
  artifacts: z.boolean(),
  /**
   * Whether the agent can take input while a turn is running.
   *
   * A connection that does not report it cannot be steered: the owner's
   * message waits for the next turn instead, and says so. Absent means
   * absent, not "probably" — a connection written before this existed is an
   * agent that cannot be steered.
   */
  acceptsSteering: z.boolean().optional(),
});
export type AgentCapabilities = z.infer<typeof agentCapabilitiesSchema>;

export const NO_CAPABILITIES: AgentCapabilities = {
  chat: false,
  streaming: false,
  persistentSessions: false,
  backgroundTasks: false,
  cancel: false,
  approvals: false,
  artifacts: false,
};

export const agentConnectionStatusSchema = z.enum([
  'unknown',
  'connected',
  'degraded',
  'disconnected',
  'error',
]);
export type AgentConnectionStatus = z.infer<typeof agentConnectionStatusSchema>;

export const agentConnectionDetailSchema = agentConnectionSchema.extend({
  workspaceId: idSchema,
  /**
   * The MCP tools this connection may use. The owner narrows the default
   * set per connection; an empty list means the connection cannot call
   * Personal OS through MCP at all.
   */
  toolGrants: z.array(mcpToolNameSchema),
  capabilities: agentCapabilitiesSchema.nullable(),
  /**
   * The revision of this connection's capability set.
   *
   * It moves when the set moves — the tool grants change, or a probe reports
   * different capabilities — and a turn pins the revision it was admitted
   * with, so the set cannot change underneath a turn that is running.
   */
  capabilitiesRevision: z.number().int().min(1),
  status: agentConnectionStatusSchema,
  lastError: z.string().nullable(),
  lastConnectedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type AgentConnectionDetail = z.infer<typeof agentConnectionDetailSchema>;

export const executionStatusSchema = z.enum([
  'queued',
  'running',
  'blocked',
  'completed',
  /**
   * The turn's output is in canonical history, and the turn can be continued
   * from it.
   *
   * `completed` means the adapter returned. `committed` means the output was
   * written and acknowledged, which is a different fact: a turn that merely
   * returned left nothing a later turn could continue from.
   */
  'committed',
  'failed',
  'cancelled',
  'unknown',
]);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

/**
 * The common event vocabulary. Adapters emit only events they can genuinely
 * observe — missing events are never fabricated.
 */
export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.delta'),
    executionId: idSchema,
    text: z.string(),
  }),
  z.object({
    type: z.literal('message.completed'),
    executionId: idSchema,
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('tool.started'),
    executionId: idSchema,
    toolName: z.string(),
    input: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('tool.completed'),
    executionId: idSchema,
    toolName: z.string(),
    output: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('approval.requested'),
    executionId: idSchema,
    approvalId: idSchema,
    summary: z.string(),
    details: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('artifact.created'),
    executionId: idSchema,
    title: z.string().optional(),
    resourceId: idSchema.optional(),
  }),
  z.object({
    type: z.literal('execution.status'),
    executionId: idSchema,
    status: executionStatusSchema,
  }),
  z.object({
    type: z.literal('execution.error'),
    executionId: idSchema,
    code: z.string(),
    message: z.string(),
  }),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentEventType = AgentEvent['type'];

/** Input handed to an adapter for one agent turn. */
export interface AgentTurnInput {
  conversationId: string;
  externalSessionId?: string;
  message: string;
  context: string;
  executionId: string;
  signal?: AbortSignal;
  /**
   * The owner's messages that arrive while this turn is running.
   *
   * A steer is delivered into the turn that is running, and this channel is
   * how it arrives: one message at a time, in the order the owner sent them.
   * The channel ends when the turn ends, and a message that arrives after it
   * has ended is not this turn's business.
   *
   * **It is present only when the connection reports `acceptsSteering`.** A
   * connection that does not report it is never sent one, so an adapter that
   * reads from the channel is an adapter that has been told it may.
   */
  steer?: AsyncIterable<string>;
}

/**
 * The code an adapter reports when a turn is asked to run on an instance
 * whose runtime was never established.
 *
 * It is stable, because the owner reads it: the message beside it says what
 * is wrong and what to do about it.
 */
export const ADAPTER_NOT_CONNECTED_CODE = 'adapter_not_connected';

/**
 * The minimum common adapter surface. The production implementation adds
 * versioning, structured errors, deadlines, auth references and optional
 * protocol-specific methods (see `AgentAdapterExtras`).
 *
 * The lifecycle is `connect` → `send` → `close`. `connect` establishes the
 * runtime and reports the capabilities that are actually true; `send` runs a
 * turn on that runtime; `close` releases everything the adapter holds. The
 * order matters: a capability probe on one instance says nothing about a
 * later instance, so an instance that has not been connected cannot be
 * assumed to be ready.
 */
export interface AgentAdapter {
  readonly type: AdapterType;
  /**
   * Whether this adapter holds a runtime between the connection and the turn.
   *
   * True when `connect()` establishes something the turn then runs on — a
   * supervised child process, a transport, a socket — and a turn asked to run
   * before that is refused. False when the turn establishes its own runtime, as
   * a protocol that sets up its session when it is asked for one does.
   *
   * It is optional, and absent means true: a caller that connects before it
   * sends is never wrong, only occasionally more work than the protocol
   * needs. An adapter whose turn brings its own runtime says so, so a caller
   * does not impose a second handshake on a protocol that already has one.
   */
  readonly holdsRuntime?: boolean;
  connect(connection: AgentConnection): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  /**
   * Release everything this adapter holds — a supervised child process, a
   * transport, a socket.
   *
   * It is optional, so an adapter that holds nothing does not have to say
   * so, and it is safe to call more than once and at any point in the
   * lifecycle. A turn that ends, fails or is abandoned must not leave a child
   * process behind: the caller closes the adapter when the turn is over.
   */
  close?(): void | Promise<void>;
  getStatus?(executionId: string): Promise<AgentExecutionStatus>;
  cancel?(executionId: string): Promise<void>;
}

export interface AgentExecutionStatus {
  executionId: string;
  status: ExecutionStatus;
  detail?: string;
  externalRef?: string;
}

/** Optional protocol-specific extension points, negotiated at connect time. */
export interface AgentAdapterExtras {
  /** Restore a native external session, when the protocol supports it. */
  resumeSession?(connection: AgentConnection, externalSessionId: string): Promise<string>;
  /**
   * What became of a run, after the worker that was running it died.
   *
   * Optional, and absent means the runtime cannot be asked: the outcome is
   * uncertain, and the owner resolves it. An adapter that can answer says
   * what happened, and an adapter that cannot says `unknown` rather than
   * guessing — a guess here would be a side effect the owner never agreed to.
   */
  reconcile?(
    connection: AgentConnection,
    request: { executionId: string; externalSessionId?: string },
  ): Promise<AgentReconciliation>;
  /** Protocol-native capabilities beyond the common vocabulary. */
  nativeCapabilities?(connection: AgentConnection): Promise<Record<string, unknown>>;
  /** Stable external task identifier when work is delegated to an orchestrator. */
  externalTaskId?(connection: AgentConnection): Promise<string | undefined>;
}

/**
 * What a runtime says about a run it was asked about.
 *
 * `unknown` is the answer of a runtime that cannot say, and it is an answer
 * rather than a failure: the product reports the run as uncertain and the
 * owner decides.
 */
export interface AgentReconciliation {
  executionId: string;
  /** What the runtime knows: `completed`, `failed`, or `unknown`. */
  outcome: 'completed' | 'failed' | 'unknown';
  /** The runtime's own words, when it has any. */
  detail?: string;
}

/**
 * The rest of the adapter boundary.
 *
 * `AgentAdapter` above is the interface an agent is reached through. These are
 * the shapes around it: what an adapter is given, and the shape of the thing
 * that hands one out.
 *
 * **They live here, and not in the package that holds the adapters, because the
 * domain must depend on the interface and never on the adapters.**
 * `packages/agent-adapters` holds the adapters themselves; the domain holds
 * these. That is what turns ADR 0004's rule — "the domain never mentions a
 * specific provider" — into something the tree can be checked against rather
 * than a convention somebody has to remember.
 */

/** What an adapter may say. */
export interface AdapterLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

/**
 * Context handed to every adapter. Secrets are resolved through the
 * server-held secret store and never travel through the browser client.
 */
export interface AdapterContext {
  resolveSecret(ref: string): Promise<string | undefined>;
  logger: AdapterLogger;
}

/**
 * A registry of adapters, as the domain needs it.
 *
 * The domain asks a registry whether it has an adapter type and asks it for
 * one. **It does not know which adapters exist**, and the class that implements
 * this lives with the adapters, not with the domain.
 */
export interface AdapterProvider {
  has(type: AdapterType): boolean;
  list(): AdapterType[];
  create(config: AdapterConfig, ctx: AdapterContext): AgentAdapter;
}
