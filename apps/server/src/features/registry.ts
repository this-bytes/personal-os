import type { FastifyInstance } from 'fastify';
import {
  featureManifestSchema,
  type FeatureManifest,
  type FeatureManifestInput,
} from '@personal-os/contracts';
import type { AppServices } from '../context.js';

/**
 * The feature registry.
 *
 * It is the server's answer to "where does a new feature go?". A feature
 * registers its routes here, and the runtime installs every registered
 * feature when it builds the app. Adding a feature is one line in
 * `features/index.ts` — the runtime's own files are not touched.
 *
 * The registry is deliberately not a loader for third-party code. A feature
 * here is first-party: it lives in this repository, it is reviewed like the
 * rest of it, and it is named at build time. See `docs/feature-authoring.md`.
 */

/** A feature, on the server side. */
export interface ServerFeature {
  /** What the feature declares about itself. */
  manifest: FeatureManifestInput;
  /**
   * The routes the feature owns.
   *
   * The feature is given the app and the services, so it can register routes
   * of its own under the prefix it declared.
   */
  register(app: FastifyInstance, services: AppServices): void;
}

export class FeatureRegistry {
  private readonly features = new Map<
    string,
    { manifest: FeatureManifest; register: ServerFeature['register'] }
  >();

  /**
   * Add a feature.
   *
   * The manifest is parsed here rather than trusted: a feature that ships an
   * id that is not an id, or a room with no path, fails when the tree is
   * checked instead of when the owner opens the panel.
   */
  register(feature: ServerFeature): this {
    const manifest = featureManifestSchema.parse(feature.manifest);

    if (this.features.has(manifest.id)) {
      throw new Error(`The feature "${manifest.id}" is registered twice.`);
    }

    this.features.set(manifest.id, { manifest, register: feature.register });
    return this;
  }

  has(id: string): boolean {
    return this.features.has(id);
  }

  get(id: string): FeatureManifest | undefined {
    return this.features.get(id)?.manifest;
  }

  /** What is installed, in the order it was registered. */
  list(): FeatureManifest[] {
    return [...this.features.values()].map((feature) => feature.manifest);
  }

  /** Give every feature its routes. */
  install(app: FastifyInstance, services: AppServices): void {
    for (const feature of this.features.values()) {
      feature.register(app, services);
    }
  }
}
