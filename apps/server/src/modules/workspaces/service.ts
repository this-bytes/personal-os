import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { workspaces } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId, slugify } from '../../lib/ids.js';
import type { AutonomyPolicyPatch, Workspace } from '@personal-os/contracts';

export interface WorkspaceService {
  list(): Workspace[];
  create(input: { name: string; description?: string }): Workspace;
  get(id: string): Workspace;
  update(
    id: string,
    patch: Partial<
      Pick<Workspace, 'name' | 'description' | 'autonomyMode'> & {
        autonomyPolicy?: AutonomyPolicyPatch;
      }
    >,
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

      // A list that names no action is refused, not written.
      //
      // An empty list is not a tighter policy — it is the absence of one. The
      // resolver reads a policy that names no action as no opinion, and the
      // effective set is then every action in the vocabulary, which is what
      // the stored autonomy defaults mean. So writing an empty list would
      // widen the policy to everything while looking like a tightening, and
      // there is no "no action is allowed" state for the owner to write yet.
      //
      // So the write is refused, and it says what to write instead. The
      // refusal is loud because it is the only signal the owner gets: a write
      // that was refused says so, rather than accepting a value that grants
      // everything and saying so only by silence.
      if (patch.autonomyPolicy?.allowedActions?.length === 0) {
        throw errors.validation(
          'An empty allowedActions list cannot be written: it names no action, and a policy that names no action does not restrict the actions, so the effective set would be every action in the vocabulary. Name the actions the agent may take, or leave the list out to keep the one the policy already carries.',
        );
      }

      // The mode the owner sets is the mode that is in force.
      //
      // A workspace carries the mode twice: the column the panel shows, and
      // the policy the resolver reads. A setting that lands in one of them and
      // not the other tells the owner something false about what the agent is
      // permitted to do — the panel says "autonomous" and the policy in force
      // says "manual". So the two are written together and cannot disagree.
      //
      // This says nothing about what the mode *means*. The mode is still
      // enforced nowhere — `manual` does not gate delegation, because the mode
      // is consulted by nothing. This is about the setting being honest rather
      // than about the mode being in force.
      //
      // A policy change says what changes. The owner sets the turn limit and
      // the action list they set earlier stays, so a patch is merged into the
      // policy the workspace already carries rather than written over it. An
      // absent field is left alone. An explicit empty list never reaches this
      // line: it is refused above, because clearing a list would widen the
      // policy rather than tighten it.
      const policy =
        patch.autonomyPolicy !== undefined
          ? { ...current.autonomyPolicy, ...patch.autonomyPolicy }
          : patch.autonomyMode !== undefined
            ? { ...current.autonomyPolicy, mode: patch.autonomyMode }
            : undefined;
      const mode = policy?.mode ?? patch.autonomyMode;

      db.update(workspaces)
        .set({
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(mode !== undefined ? { autonomyMode: mode } : {}),
          ...(policy !== undefined ? { autonomyPolicy: policy } : {}),
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
