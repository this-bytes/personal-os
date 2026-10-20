import { z } from 'zod';
import { idSchema, isoDateSchema } from './common.js';
import { mcpToolNameSchema } from './mcp.js';

/**
 * Adapter categories. A new agent type must be addable without changing
 * conversation storage or the factory task model.
 */
export const adapterTypeSchema = z.enum(['cli', 'acp', 'a2a', 'http', 'model', 'echo']);
export type AdapterType = z.infer<typeof adapterTypeSchema>;

export const adapterTypeLabels: Record<AdapterType, string> = {
  cli: 'CLI agent',
  acp: 'ACP session agent',
  a2a: 'A2A agent',
  http: 'Gateway / HTTP API',
  model: 'Model API (no harness)',
  echo: 'Built-in echo (local test)',
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
}

/**
 * The minimum common adapter surface. The production implementation adds
 * versioning, structured errors, deadlines, auth references and optional
 * protocol-specific methods (see `AgentAdapterExtras`).
 */
export interface AgentAdapter {
  readonly type: AdapterType;
  connect(connection: AgentConnection): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
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
  /** Protocol-native capabilities beyond the common vocabulary. */
  nativeCapabilities?(connection: AgentConnection): Promise<Record<string, unknown>>;
  /** Stable external task identifier when work is delegated to an orchestrator. */
  externalTaskId?(connection: AgentConnection): Promise<string | undefined>;
}
