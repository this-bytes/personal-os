import type { AdapterConfig, AdapterProvider } from '@personal-os/contracts';
import { AdapterRegistry } from './registry.js';
import { createAcpAdapter } from './acp.js';
import { createA2aAdapter } from './a2a.js';
import { createCliAdapter } from './cli.js';
import { createEchoAdapter } from './echo.js';
import { createHttpAdapter } from './http.js';
import { createMcpAdapter } from './mcp.js';
import { createModelAdapter } from './model.js';
import type { AdapterFactories } from './types.js';

export * from './types.js';
export * from './registry.js';
export * from './util.js';
export * from './jsonrpc.js';
export { AcpAdapter, createAcpAdapter } from './acp.js';
export { A2aAdapter, createA2aAdapter } from './a2a.js';
export { CliAdapter, createCliAdapter } from './cli.js';
export { EchoAdapter, createEchoAdapter } from './echo.js';
export { HttpAdapter, createHttpAdapter } from './http.js';
export { McpAdapter, createMcpAdapter } from './mcp.js';
export { ModelAdapter, createModelAdapter } from './model.js';

/**
 * The factories for every adapter type the contract publishes.
 *
 * The type is a mapped type over `AdapterType`, so **the compiler requires a factory for
 * every type** — adding an adapter type without one breaks the build.
 */
const defaultFactories: AdapterFactories = {
  echo: createEchoAdapter,
  cli: createCliAdapter,
  acp: createAcpAdapter,
  a2a: createA2aAdapter,
  http: createHttpAdapter,
  model: createModelAdapter,
  mcp: createMcpAdapter,
};

/**
 * The registry populated with every built-in adapter. New adapter types are
 * added here; no other module needs to change.
 */
export function createDefaultRegistry(): AdapterRegistry {
  return new AdapterRegistry(defaultFactories);
}

export type { AdapterConfig, AdapterProvider };
