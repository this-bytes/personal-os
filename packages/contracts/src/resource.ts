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
 * The author a resource records.
 *
 * A closed set, in four forms: an agent connection's id (`agt_…`), the
 * owner's user id (`usr_…`), the literal `owner` for a write by the owner
 * when no user id is known, and the literal `system` for a write with no
 * authenticated actor behind it. The measure reads the agent form by its
 * prefix and not by a lookup, so a connection that has since been removed
 * does not make what it authored owner-authored.
 */
export const RESOURCE_AUTHOR_OWNER = 'owner';
export const RESOURCE_AUTHOR_SYSTEM = 'system';
export const resourceAuthorSchema = z.union([
  z.literal(RESOURCE_AUTHOR_OWNER),
  z.literal(RESOURCE_AUTHOR_SYSTEM),
  z
    .string()
    .max(128)
    .regex(/^[a-z]{3}_[0-9a-z]+$/, 'An author is an id form, or the literal owner or system.'),
]);
export type ResourceAuthor = z.infer<typeof resourceAuthorSchema>;

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
  createdBy: resourceAuthorSchema,
  updatedAt: isoDateSchema,
  /**
   * The template this resource was made from, and the version of it.
   *
   * A resource made from a template is a copy of what that version produced,
   * not a link to it: a later version of the template does not change this
   * resource, and this resource keeps citing the version it was made from. A
   * resource made from a spec carries neither.
   */
  templateId: idSchema.optional(),
  templateVersion: z.number().int().min(1).optional(),
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

/**
 * What a kind of resource is called in a sentence.
 *
 * The name is published here because two readers need the same word for the
 * same kind: the server, whose refusal names the kind, and the panel, whose
 * line names it too. Two copies of this map are two vocabularies, and the one
 * that drifts is the one the owner reads.
 */
export const resourceTypeNames: Record<ResourceType, string> = {
  dashboard: 'dashboard',
  document: 'document',
  'data-source': 'data source',
  automation: 'automation',
  memory: 'memory',
  task: 'task',
};

/**
 * What each kind of resource supports, and what it does not.
 *
 * Publishing makes a resource live; executing runs it. Only some kinds have
 * either act. A dashboard becomes visible and an automation becomes active when
 * it is published; an automation, a data source and a dashboard can be run.
 * The rest have no such act, and saying so is the point: a kind with no publish
 * pipeline is refused with a reason the owner can read, rather than reported as
 * published.
 *
 * **The declaration is the contract.** The server refuses a kind that does not
 * support the operation, and the panel offers only the actions that can
 * succeed. Both read this one record, so neither can describe a truth the
 * other does not hold.
 *
 * The record is keyed by every published kind, so a kind added to
 * `resourceTypeSchema` does not compile until it has been answered for here.
 */
export const resourceOperationSupport: Record<
  ResourceType,
  { readonly publish: boolean; readonly execute: boolean }
> = {
  dashboard: { publish: true, execute: true },
  document: { publish: false, execute: false },
  automation: { publish: true, execute: true },
  'data-source': { publish: false, execute: true },
  task: { publish: false, execute: false },
  memory: { publish: false, execute: false },
};

/**
 * The support a kind has, or `undefined` when the kind is not a published one.
 *
 * The lookup is guarded rather than indexed: a row written before a kind was
 * removed, or a name that was never one, must not read as support.
 */
function supportOf(type: ResourceType): { publish: boolean; execute: boolean } | undefined {
  return Object.hasOwn(resourceOperationSupport, type) ? resourceOperationSupport[type] : undefined;
}

/** Whether a kind of resource can be published. */
export function canPublishResource(type: ResourceType): boolean {
  return supportOf(type)?.publish === true;
}

/** Whether a kind of resource can be executed. */
export function canExecuteResource(type: ResourceType): boolean {
  return supportOf(type)?.execute === true;
}

/**
 * What an operation on a resource actually did.
 *
 * `published` means the resource is live. `queued` means the action was
 * accepted and has not finished — the run of an automation is enqueued for the
 * worker, and it has not happened yet. `succeeded` means the action ran and
 * produced its output.
 *
 * The vocabulary is per action, not per route: one route records `queued` for
 * one kind and `succeeded` for another.
 */
export const resourceOperationOutcomeSchema = z.enum(['published', 'queued', 'succeeded']);
export type ResourceOperationOutcome = z.infer<typeof resourceOperationOutcomeSchema>;

/** The answer a publish gives when it published. */
export const resourcePublishResponseSchema = z.object({
  outcome: z.literal('published'),
  resource: resourceSchema,
});
export type ResourcePublishResponse = z.infer<typeof resourcePublishResponseSchema>;

/** The answer an execute gives when it ran, or when it was queued to run. */
export const resourceExecuteResponseSchema = z.object({
  outcome: z.enum(['queued', 'succeeded']),
  result: z.object({ output: z.unknown() }),
});
export type ResourceExecuteResponse = z.infer<typeof resourceExecuteResponseSchema>;

/** Optimistic concurrency contract: writers present the revision they read. */
export interface ResourceProvider<T> {
  validate(data: unknown): T;
  create(input: T): Promise<Resource<T>>;
  get(id: string): Promise<Resource<T>>;
  update(id: string, expectedRevision: number, data: T): Promise<Resource<T>>;
}

/**
 * The guide: what a good one of this kind is.
 *
 * A template's spec is an example. The guide is why the example is a good
 * one — what to set, what good looks like, and what a reader would get wrong.
 */
export const resourceTemplateGuideSchema = z.object({
  /** What this template is for, and what it produces. */
  summary: z.string().min(1).max(2_000),
  /** When to reach for this template. */
  whenToUse: z.array(z.string().min(1).max(400)).min(1).max(8),
  /** When not to. A template that cannot be declined is a rule, not a choice. */
  whenNotToUse: z.array(z.string().min(1).max(400)).max(8).default([]),
  /** The fields the agent fills in, and what each one is for. */
  fields: z
    .array(
      z.object({
        /** A dotted path into the spec. `widgets[].dataSourceId` means every widget's. */
        path: z.string().min(1).max(200),
        /** What this field is for. */
        what: z.string().min(1).max(400),
        /**
         * True when the template's own value is a placeholder the agent must
         * replace. False when the template's value is a good default.
         */
        mustSet: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  /** What a reader would get wrong. */
  mistakes: z.array(z.string().min(1).max(400)).max(8).default([]),
  /** What to check before calling it done. */
  checklist: z.array(z.string().min(1).max(400)).max(8).default([]),
});
export type ResourceTemplateGuide = z.infer<typeof resourceTemplateGuideSchema>;

/**
 * A template: a named, versioned example of one resource kind, with its spec
 * and the guide that says what a good one of that kind is, that an agent can
 * start from.
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
  /**
   * What a good one of this kind is.
   *
   * A guide is required: the registry is typed, so a template without one does
   * not compile. The check for a template is a pull request, so the check
   * should be the compiler.
   */
  guide: resourceTemplateGuideSchema,
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
