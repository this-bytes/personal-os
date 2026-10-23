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
export * from './lifecycle.js';
export { AcpAdapter, createAcpAdapter } from './acp.js';
export { A2aAdapter, createA2aAdapter } from './a2a.js';
export { CliAdapter, createCliAdapter } from './cli.js';
export { EchoAdapter, createEchoAdapter } from './echo.js';
export { HttpAdapter, createHttpAdapter } from './http.js';
export { McpAdapter, createMcpAdapter } from './mcp.js';
export { ModelAdapter, createModelAdapter } from './model.js';

/**
 * The registry populated with every built-in adapter. New adapter types are
 * added here; no other module needs to change.
 */
export function createDefaultRegistry(): AdapterRegistry {
  const factories: AdapterFactories = {
    echo: createEchoAdapter,
    cli: createCliAdapter,
    acp: createAcpAdapter,
    a2a: createA2aAdapter,
    http: createHttpAdapter,
    model: createModelAdapter,
    mcp: createMcpAdapter,
  };
  return new AdapterRegistry(factories);
}

export type { AdapterConfig, AdapterProvider };
