import type {
  AdapterConfig,
  AdapterContext,
  AdapterProvider,
  AdapterType,
  AgentAdapter,
} from '@personal-os/contracts';
import type { AdapterFactory, ConfigOf } from './types.js';

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
