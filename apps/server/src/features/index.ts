import { FeatureRegistry } from './registry.js';
import { forgeMapFeature } from './map/feature.js';
import { botsFeature } from './bots/feature.js';

/**
 * The features the runtime installs.
 *
 * This is the one file a feature is named in, and it is a list of one line
 * each: two features can be built at the same time, on two branches, and
 * neither of them touches the runtime.
 */
export function createDefaultFeatureRegistry(): FeatureRegistry {
  return new FeatureRegistry().register(forgeMapFeature).register(botsFeature);
}
