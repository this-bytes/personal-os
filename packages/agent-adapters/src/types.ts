import type { AdapterConfig, AdapterType, AgentAdapter } from '@personal-os/contracts';

export interface AdapterLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

/**
 * Context handed to every adapter factory. Secrets are resolved through the
 * server-held secret store and never travel through the browser client.
 */
export interface AdapterContext {
  resolveSecret(ref: string): Promise<string | undefined>;
  logger: AdapterLogger;
}

export type AdapterFactory = (config: AdapterConfig, ctx: AdapterContext) => AgentAdapter;

/** Adapter-specific configuration narrowed by discriminator. */
export type ConfigOf<T extends AdapterConfig['adapterType']> = Extract<
  AdapterConfig,
  { adapterType: T }
>;
