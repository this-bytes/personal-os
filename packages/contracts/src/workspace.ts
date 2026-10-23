import { z } from 'zod/v3';
import { autonomyModeSchema, autonomyPolicySchema, idSchema, isoDateSchema } from './common.js';

/**
 * A workspace is the unit of access scoping. Server-enforced: every query
 * filters by workspace and the owner has access to all of their workspaces.
 */
export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().default(''),
  autonomyMode: autonomyModeSchema,
  autonomyPolicy: autonomyPolicySchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const createWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(''),
  autonomyMode: autonomyModeSchema.default('manual'),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  createdAt: isoDateSchema,
});
export type User = z.infer<typeof userSchema>;
