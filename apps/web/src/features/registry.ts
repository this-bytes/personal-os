/// <reference types="vite/client" />
import type { ComponentType } from 'react';
import {
  mergeFeatureRooms,
  type FeatureManifestInput,
  type FeatureRoom,
} from '@personal-os/contracts';

/**
 * The client side of the feature seam.
 *
 * A feature is a folder under `src/features/`, and the folder holds one
 * `feature.ts` that says what the feature is and what it contributes: the
 * routes it owns, the navigation entry it adds, and the room it puts the
 * owner in.
 *
 * The features are found by a glob rather than by a list, and that is the
 * whole point of the seam: **adding a feature adds a folder and touches
 * nothing else.** Two features can be built at the same time, on two
 * branches, and neither of them edits `App.tsx`, the shell, or the other.
 *
 * The glob is a build-time thing, not a runtime loader: the files are part of
 * this repository, they are reviewed like the rest of it, and the browser
 * never fetches a feature it did not ask for.
 */

/** One route a feature contributes. */
export interface FeatureRoute {
  /** The path the route answers on. */
  path: string;
  /** The page behind it, loaded on demand. */
  load: () => Promise<{ default: ComponentType }>;
}

/** One entry in the shell's navigation. */
export interface FeatureNavItem {
  /** What the owner reads. */
  label: string;
  /** Where it leads. */
  to: string;
  /** The mark beside it. */
  icon: ComponentType<{ className?: string }>;
  /** Where it sits in the list. Lower comes first. */
  order: number;
}

/** A feature, on the client side. */
export interface ClientFeature {
  /** What the feature declares about itself. */
  manifest: FeatureManifestInput;
  /** The routes the feature owns. */
  routes: FeatureRoute[];
  /** The navigation entry, when the feature wants one. */
  nav?: FeatureNavItem;
}

const modules = import.meta.glob<{ feature: ClientFeature }>('./*/feature.ts', { eager: true });

/** Every feature in the panel, in a stable order. */
export const features: ClientFeature[] = Object.values(modules)
  .map((module) => module.feature)
  .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

/** Every route in the panel, in a stable order. */
export const featureRoutes: FeatureRoute[] = features.flatMap((feature) => feature.routes);

/** The shell's navigation, in the order the features asked for. */
export const navItems: FeatureNavItem[] = features
  .flatMap((feature) => (feature.nav ? [feature.nav] : []))
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

/** The rooms of the panel, in the order the features asked for. */
export const rooms: FeatureRoom[] = mergeFeatureRooms(features.map((feature) => feature.manifest));

/**
 * The room the panel opens on.
 *
 * The first room is the landing room: the place the owner sees when they have
 * not asked for anywhere in particular. It is a room rather than a path, so
 * the landing page is whatever the first room is.
 */
export const landingRoom: FeatureRoom | undefined = rooms[0];

/** Where the panel opens. The first room, or the work room if there is none. */
export const landingPath: string = landingRoom?.path ?? '/conversations';
