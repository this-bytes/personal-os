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

/** Built-in coverage is exhaustive; each factory keeps its narrowed config. */
export type AdapterFactories = {
  [T in AdapterType]: (config: ConfigOf<T>, ctx: AdapterContext) => AgentAdapter;
};

/** Adapter-specific configuration narrowed by discriminator. */
export type ConfigOf<T extends AdapterConfig['adapterType']> = Extract<
  AdapterConfig,
  { adapterType: T }
>;
