import type {
  AdapterConfig,
  AdapterContext,
  AdapterProvider,
  AdapterType,
  AgentAdapter,
} from '@personal-os/contracts';
import { adapterTypeSchema } from '@personal-os/contracts';
import type { AdapterFactories, AdapterFactory, ConfigOf } from './types.js';

/**
 * The adapter registry is the only place that knows which adapter types
 * exist. Adding a new agent must not require changes to conversation
 * storage or the factory task model.
 *
 * It implements `AdapterProvider` — the shape the domain depends on — so the
 * domain never names this class, and this package never leaks into it.
 */
export class AdapterRegistry implements AdapterProvider {
  private readonly factories = new Map<AdapterType, AdapterFactory>();

  /**
   * A registry starts out holding a factory for every adapter type the contract
   * publishes.
   *
   * The argument is a mapped type over `AdapterType`, so **the compiler refuses a
   * registry that is missing one** — a type added to the contract without a factory
   * breaks the build here rather than failing at the first run that asks for it.
   */
  constructor(factories: AdapterFactories) {
    for (const type of adapterTypeSchema.options) {
      this.factories.set(type, factories[type] as AdapterFactory);
    }
  }

  register<T extends AdapterType>(
    type: T,
    factory: (config: ConfigOf<T>, ctx: AdapterContext) => AgentAdapter,
  ): this {
    this.factories.set(type, factory as AdapterFactory);
    return this;
  }

  has(type: AdapterType): boolean {
    return this.factories.has(type);
  }

  list(): AdapterType[] {
    return [...this.factories.keys()];
  }

  create(config: AdapterConfig, ctx: AdapterContext): AgentAdapter {
    const factory = this.factories.get(config.adapterType);
    if (!factory) {
      throw new Error(`No adapter registered for adapter type "${config.adapterType}".`);
    }
    return factory(config, ctx);
  }
}
