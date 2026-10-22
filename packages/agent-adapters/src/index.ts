import type { AdapterConfig, AdapterProvider } from '@personal-os/contracts';
import { AdapterRegistry } from './registry.js';
import { createAcpAdapter } from './acp.js';
import { createA2aAdapter } from './a2a.js';
import { createCliAdapter } from './cli.js';
import { createEchoAdapter } from './echo.js';
import { createHttpAdapter } from './http.js';
import { createMcpAdapter } from './mcp.js';
import { createModelAdapter } from './model.js';

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
 * The registry populated with every built-in adapter. New adapter types are
 * added here; no other module needs to change.
 */
export function createDefaultRegistry(): AdapterRegistry {
  return new AdapterRegistry()
    .register('echo', createEchoAdapter)
    .register('cli', createCliAdapter)
    .register('acp', createAcpAdapter)
    .register('a2a', createA2aAdapter)
    .register('http', createHttpAdapter)
    .register('model', createModelAdapter)
    .register('mcp', createMcpAdapter);
}

export type { AdapterConfig, AdapterProvider };
