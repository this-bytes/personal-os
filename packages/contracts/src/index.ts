/**
 * Personal OS shared contracts.
 *
 * Everything that crosses a process boundary — HTTP, MCP, worker queues,
 * adapter events — is defined here so the contract has exactly one source
 * of truth. Domain modules must not redefine these shapes.
 */
export * from './common.js';
export * from './autonomy.js';
export * from './conversation.js';
export * from './chat.js';
export * from './session.js';
export * from './bot.js';
export * from './agent.js';
export * from './adapter-config.js';
export * from './adapter-presets.js';
export * from './resource.js';
export * from './factory.js';
export * from './automation.js';
export * from './workspace.js';
export * from './events.js';
export * from './mcp.js';
export * from './measures.js';
export * from './approvals.js';
export * from './feature.js';
export * from './forge-map.js';
export * from './waiting.js';
