import { z } from 'zod/v3';

/**
 * The feature seam.
 *
 * A feature is a unit of product that slots into the runtime: a room in the
 * panel, a surface in the client, and — when it needs one — routes under the
 * API. **The seam is where a feature declares itself**, so that adding a
 * feature does not mean editing the files the runtime is built from.
 *
 * This is not a plugin marketplace and not a runtime loader for third-party
 * code. A feature is first-party, in this repository, reviewed like the rest
 * of it. What the seam buys is narrower and more useful: two features can be
 * built at the same time, on two branches, and land without either of them
 * touching `app.ts`, `App.tsx` or the shell.
 *
 * The manifest is the declaration. The client reads the rooms to build the
 * room switch, and the server reads the id and the prefix to know what a
 * feature owns.
 */

/** The id a feature is known by. */
export const featureIdSchema = z
  .string()
  .max(80)
  .regex(
    /^feat_[a-z0-9]+(?:_[a-z0-9]+)*$/,
    'A feature id is "feat_" followed by lower-case words.',
  );
export type FeatureId = z.infer<typeof featureIdSchema>;

/**
 * How dense a room is.
 *
 * The orientation room is airy and the execution room is dense, and the room
 * says which it is rather than the room's own code deciding by accident.
 */
export const roomDensitySchema = z.enum(['airy', 'dense']);
export type RoomDensity = z.infer<typeof roomDensitySchema>;

/**
 * One room a feature contributes to the panel.
 *
 * A room is a place, not a picture: it is where work is looked at or decided.
 * The path is the room's address, and the label is what the owner reads in
 * the room switch.
 */
export const featureRoomSchema = z.object({
  /** Stable across renames: the room's own id. */
  id: z.string().min(1).max(60),
  /** What the owner reads in the room switch. */
  label: z.string().min(1).max(60),
  /** Where the room lives. */
  path: z.string().min(1).max(200).startsWith('/'),
  /** How dense the room is. */
  density: roomDensitySchema.default('airy'),
  /** Where the room sits in the switch. Lower comes first. */
  order: z.number().int().min(0).max(1_000).default(100),
});

/** What a feature writes for a room. The defaults are filled in for it. */
export type FeatureRoomInput = z.input<typeof featureRoomSchema>;
/** A room, with its defaults filled in. */
export type FeatureRoom = z.output<typeof featureRoomSchema>;

/**
 * What a feature declares about itself.
 *
 * The manifest is a contract, so it is validated: a feature that ships an id
 * that is not an id, or a room with no path, fails when the tree is checked
 * rather than when the owner opens the panel.
 */
export const featureManifestSchema = z.object({
  /** What the feature is called in the code and in the logs. */
  id: featureIdSchema,
  /** What the feature is called in words. */
  name: z.string().min(1).max(120),
  /** One sentence on what the feature is for. */
  description: z.string().max(600).optional(),
  /** The rooms the feature contributes. */
  rooms: z.array(featureRoomSchema).default([]),
  /**
   * The prefix the feature's own routes live under.
   *
   * A feature that has no routes of its own leaves it out. When it is there,
   * it is the whole of the feature's share of the HTTP surface — nothing else
   * registers under it.
   */
  apiPrefix: z.string().min(1).max(200).startsWith('/api/').optional(),
});

/** What a feature writes for itself. The defaults are filled in for it. */
export type FeatureManifestInput = z.input<typeof featureManifestSchema>;
/** A manifest, with its defaults filled in. */
export type FeatureManifest = z.output<typeof featureManifestSchema>;

/**
 * Merge the rooms of several features into one ordered list.
 *
 * The rooms are the panel's rooms, whoever contributed them, and the switch
 * shows them in one order. Two features claiming the same path is a mistake
 * that would send the owner to the wrong room, so the second one is refused
 * rather than quietly overwriting the first.
 */
export function mergeFeatureRooms(manifests: FeatureManifestInput[]): FeatureRoom[] {
  const rooms = new Map<string, FeatureRoom>();
  for (const manifest of manifests) {
    for (const room of manifest.rooms ?? []) {
      const parsed = featureRoomSchema.parse(room);
      const existing = rooms.get(parsed.path);
      if (existing) {
        throw new Error(
          `The room "${parsed.path}" is claimed by both "${existing.id}" and "${parsed.id}". ` +
            'A path leads to one room.',
        );
      }
      rooms.set(parsed.path, parsed);
    }
  }
  return [...rooms.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}
