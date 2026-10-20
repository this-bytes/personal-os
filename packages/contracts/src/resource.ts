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

export const memorySpecSchema = z.object({
  scope: z.enum(['workspace', 'conversation', 'goal']).default('workspace'),
  key: z.string().min(1).max(300),
  value: z.unknown(),
  tags: z.array(z.string()).default([]),
});
export type MemorySpec = z.infer<typeof memorySpecSchema>;

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
