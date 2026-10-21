import { z } from 'zod';
import { idSchema, isoDateSchema } from './common.js';

export const resourceTypeSchema = z.enum([
  'dashboard',
  'document',
  'automation',
  'data-source',
  'task',
  'memory',
]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

/**
 * A shared envelope. The payload is type-specific and validated by the
 * owning provider; storage representation is an implementation detail.
 */
export const resourceSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  type: resourceTypeSchema,
  schemaVersion: z.number().int().min(1),
  revision: z.number().int().min(1),
  title: z.string().min(1).max(300),
  data: z.unknown(),
  createdBy: idSchema,
  updatedAt: isoDateSchema,
});
export type Resource<T = unknown> = z.infer<typeof resourceSchema> & { data: T };

export const resourceOperationSchema = z.enum([
  'create',
  'read',
  'update',
  'publish',
  'execute',
  'inspect',
]);
export type ResourceOperation = z.infer<typeof resourceOperationSchema>;

/** Optimistic concurrency contract: writers present the revision they read. */
export interface ResourceProvider<T> {
  validate(data: unknown): T;
  create(input: T): Promise<Resource<T>>;
  get(id: string): Promise<Resource<T>>;
  update(id: string, expectedRevision: number, data: T): Promise<Resource<T>>;
}

/**
 * A template: a named, versioned example of one resource kind, with its spec,
 * that an agent can start from.
 *
 * A template is not a resource. It has no workspace, no revision and no
 * `createdBy`, and it is not a row in any table: templates are authored in the
 * repository and reviewed like code, so the registry is the same for every
 * workspace.
 */
export const resourceTemplateSchema = z.object({
  /** Stable across versions: a template keeps its id when its spec is revised. */
  id: idSchema,
  /** Bumped when the spec changes. Each version is a spec reviewed on its own. */
  version: z.number().int().min(1),
  /** The kind this template starts. */
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  /** What the template is for, in a sentence. */
  description: z.string().min(1).max(1_000),
  /** The example itself, validated by the owning provider for `type`. */
  spec: z.unknown(),
});
export type ResourceTemplate = z.infer<typeof resourceTemplateSchema>;

/**
 * A reference to one template.
 *
 * The version is part of a template's identity, and it is optional here:
 * omitted means the newest published version.
 */
export const resourceTemplateRefSchema = z.object({
  id: idSchema,
  version: z.number().int().min(1).optional(),
});
export type ResourceTemplateRef = z.infer<typeof resourceTemplateRefSchema>;

export const dashboardWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['metric', 'chart', 'table', 'text']),
  title: z.string().min(1).max(200),
  dataSourceId: idSchema.optional(),
  binding: z
    .object({
      kind: z.enum(['raw', 'series', 'aggregate']).default('raw'),
      field: z.string().optional(),
      groupBy: z.string().optional(),
      aggregate: z.enum(['count', 'sum', 'avg', 'min', 'max']).optional(),
      limit: z.number().int().min(1).max(10_000).default(50),
    })
    .default({ kind: 'raw', limit: 50 }),
  options: z.record(z.unknown()).default({}),
});
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export const dashboardSpecSchema = z.object({
  widgets: z.array(dashboardWidgetSchema).default([]),
  refreshSeconds: z.number().int().min(0).max(86_400).default(60),
  published: z.boolean().default(false),
});
export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;

export const documentSpecSchema = z.object({
  format: z.enum(['markdown', 'blocks']).default('markdown'),
  content: z.string().default(''),
  tags: z.array(z.string()).default([]),
});
export type DocumentSpec = z.infer<typeof documentSpecSchema>;

export const dataSourceSpecSchema = z.object({
  kind: z.enum(['json', 'http', 'sqlite']),
  /** Inline JSON payload for the `json` kind. */
  payload: z.unknown().optional(),
  /** Request URL for the `http` kind. */
  url: z.string().optional(),
  /** SQL query for the `sqlite` kind. */
  query: z.string().optional(),
  /** Secret reference for authenticated HTTP sources. */
  authRef: z.string().optional(),
  headers: z.record(z.string()).default({}),
});
export type DataSourceSpec = z.infer<typeof dataSourceSpecSchema>;

/**
 * The scopes a memory can belong to.
 *
 * `agent` is the agent's own memory. It belongs to the agent connection, so
 * it follows the agent across every conversation it takes part in and reaches
 * no other agent's turns. The other three scopes keep their meaning.
 */
export const memoryScopeSchema = z.enum(['workspace', 'conversation', 'goal', 'agent']);
export type MemoryScope = z.infer<typeof memoryScopeSchema>;

export const memorySpecSchema = z
  .object({
    scope: memoryScopeSchema.default('workspace'),
    /**
     * The agent this memory belongs to. Required when the scope is 'agent':
     * a memory scoped to an agent names the agent it belongs to.
     */
    agentConnectionId: idSchema.optional(),
    key: z.string().min(1).max(300),
    value: z.unknown(),
    tags: z.array(z.string()).default([]),
  })
  .superRefine((spec, ctx) => {
    if (spec.scope === 'agent' && !spec.agentConnectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentConnectionId'],
        message: 'A memory scoped to an agent names the agent it belongs to.',
      });
    }
  });
export type MemorySpec = z.infer<typeof memorySpecSchema>;

/**
 * The agent's share of the turn context.
 *
 * The agent's memory is in the turn context, within this budget, so an
 * agent's memory cannot crowd out the conversation.
 */
export const AGENT_MEMORY_CONTEXT_BUDGET = 6_000;

/**
 * The tag that pins a memory.
 *
 * A pinned memory keeps its place at the head of the brief whatever was
 * written since. The keying is ours: no plugin's scope or tag vocabulary is
 * imported here.
 */
export const PINNED_MEMORY_TAG = 'pinned';

/** One thing an agent remembers. */
export interface AgentMemoryEntry {
  /** What the agent remembers, under this key. */
  key: string;
  /** The memory itself. */
  value: unknown;
  tags: string[];
  /** When the memory was last written. */
  updatedAt: string;
}

export interface AgentMemoryBrief<T extends AgentMemoryEntry = AgentMemoryEntry> {
  /** The memories that fit, in the order the agent sees them. */
  entries: T[];
  /** The brief as it appears in the turn context. */
  text: string;
  /** The budget, in characters. */
  budget: number;
  /** The characters the brief uses. */
  used: number;
  /** How many memories did not fit. */
  dropped: number;
}

/** Is this memory pinned? */
export function isPinnedMemory(entry: AgentMemoryEntry): boolean {
  return entry.tags.includes(PINNED_MEMORY_TAG);
}

/**
 * Order the agent's memories: pinned first, then most recent.
 *
 * The order is the same wherever the memories are shown, so the panel and
 * the agent read them the same way round.
 */
export function orderAgentMemories<T extends AgentMemoryEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const pinned = Number(isPinnedMemory(b)) - Number(isPinnedMemory(a));
    if (pinned !== 0) return pinned;
    const byTime = b.updatedAt.localeCompare(a.updatedAt);
    if (byTime !== 0) return byTime;
    return a.key.localeCompare(b.key);
  });
}

/** Render a memory value the way the agent reads it. */
function renderMemoryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const json = JSON.stringify(value);
  return json === undefined ? '' : json;
}

/**
 * Build the brief the agent reads: its own memories, pinned first and then
 * most recent, within the budget.
 *
 * A memory that does not fit is left out rather than truncated, and the rest
 * still fit, so one oversized memory cannot empty the brief.
 */
export function buildAgentMemoryBrief<T extends AgentMemoryEntry>(
  entries: T[],
  options: { budget?: number } = {},
): AgentMemoryBrief<T> {
  const budget = options.budget ?? AGENT_MEMORY_CONTEXT_BUDGET;
  const header = 'What you remember:';
  const kept: T[] = [];
  let text = '';
  let dropped = 0;

  for (const entry of orderAgentMemories(entries)) {
    const line = `- ${entry.key}: ${renderMemoryValue(entry.value)}`;
    const candidate = text.length === 0 ? `${header}\n${line}` : `${text}\n${line}`;
    if (candidate.length > budget) {
      dropped += 1;
      continue;
    }
    text = candidate;
    kept.push(entry);
  }

  return { entries: kept, text, budget, used: text.length, dropped };
}

export const createResourceInputSchema = z.object({
  workspaceId: idSchema,
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  data: z.unknown().default({}),
});
export type CreateResourceInput = z.infer<typeof createResourceInputSchema>;

export const updateResourceInputSchema = z.object({
  expectedRevision: z.number().int().min(1),
  title: z.string().min(1).max(300).optional(),
  data: z.unknown().optional(),
});
export type UpdateResourceInput = z.infer<typeof updateResourceInputSchema>;
