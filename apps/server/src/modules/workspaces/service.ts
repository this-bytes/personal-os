import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { workspaces } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId, slugify } from '../../lib/ids.js';
import type { Workspace } from '@personal-os/contracts';

export interface WorkspaceService {
  list(): Workspace[];
  create(input: { name: string; description?: string }): Workspace;
  get(id: string): Workspace;
  update(
    id: string,
    patch: Partial<Pick<Workspace, 'name' | 'description' | 'autonomyMode' | 'autonomyPolicy'>>,
  ): Workspace;
  ensureDefault(): Workspace;
}

/**
 * Workspaces are the unit of access scoping. The server enforces the
 * boundary on every query; clients never supply their own scope.
 */
export function createWorkspaceService(db: Database): WorkspaceService {
  const toWorkspace = (row: typeof workspaces.$inferSelect): Workspace => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    autonomyMode: row.autonomyMode as Workspace['autonomyMode'],
    autonomyPolicy: row.autonomyPolicy as Workspace['autonomyPolicy'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return {
    list(): Workspace[] {
      return db.select().from(workspaces).all().map(toWorkspace);
    },

    create(input): Workspace {
      const id = newId('wsp');
      const now = new Date().toISOString();
      const baseSlug = slugify(input.name);
      const clash = db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, baseSlug))
        .get();
      const slug = clash ? `${baseSlug}-${id.slice(-4)}` : baseSlug;

      db.insert(workspaces)
        .values({
          id,
          name: input.name.trim(),
          slug,
          description: input.description?.trim() ?? '',
          autonomyMode: 'manual',
          autonomyPolicy: {
            mode: 'manual',
            allowedActions: [],
            approvalRequired: [],
            maxTurns: 8,
            maxDurationSeconds: 900,
            maxSpendUnits: 0,
            dailySpendUnits: 0,
          },
          createdAt: now,
          updatedAt: now,
        })
        .run();

      return this.get(id);
    },

    get(id: string): Workspace {
      const row = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
      if (!row) throw errors.notFound('Workspace');
      return toWorkspace(row);
    },

    update(id, patch): Workspace {
      const current = this.get(id);
      const now = new Date().toISOString();
      db.update(workspaces)
        .set({
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.autonomyMode !== undefined ? { autonomyMode: patch.autonomyMode } : {}),
          ...(patch.autonomyPolicy !== undefined ? { autonomyPolicy: patch.autonomyPolicy } : {}),
          updatedAt: now,
        })
        .where(eq(workspaces.id, current.id))
        .run();
      return this.get(id);
    },

    ensureDefault(): Workspace {
      const existing = db.select().from(workspaces).limit(1).get();
      if (existing) return toWorkspace(existing);
      return this.create({ name: 'Personal', description: 'Default workspace' });
    },
  };
}
