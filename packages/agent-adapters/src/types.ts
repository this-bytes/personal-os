import type {
  AdapterConfig,
  AdapterContext,
  AdapterType,
  AgentAdapter,
} from '@personal-os/contracts';

/**
 * The boundary's shapes live in `@personal-os/contracts`, beside the
 * `AgentAdapter` they belong with, so that the domain can depend on them
 * without depending on this package. They are re-exported here because this
 * package is where an adapter meets them.
 */
export type { AdapterContext, AdapterLogger } from '@personal-os/contracts';

export type AdapterFactory = (config: AdapterConfig, ctx: AdapterContext) => AgentAdapter;

/**
 * A factory for every adapter type the contract publishes.
 *
 * The type is a mapped type over `AdapterType`, so **the compiler requires a factory for
 * every type the contract names.** Adding an adapter type without one breaks the build,
 * rather than leaving it to fail at the first run that asks for it.
 *
 * Each factory is checked against its own configuration: `createCliAdapter` takes
 * `Extract<AdapterConfig, { adapterType: 'cli' }>`, and `ConfigOf<'cli'>` is that.
 */
export type AdapterFactories = {
  [T in AdapterType]: (config: ConfigOf<T>, ctx: AdapterContext) => AgentAdapter;
};

/** Adapter-specific configuration narrowed by discriminator. */
export type ConfigOf<T extends AdapterConfig['adapterType']> = Extract<
  AdapterConfig,
  { adapterType: T }
>;
