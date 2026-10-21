import { z } from 'zod';

/**
 * Adapter configurations. Credentials are never stored here directly:
 * sensitive values are referenced by `*Ref` pointing at a server-held
 * secret record that is never returned to a client.
 */

export const cliAdapterConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  /** Additional environment variables for the supervised process. */
  env: z.record(z.string()).default({}),
  /** How the prompt reaches the agent process. */
  promptMode: z.enum(['stdin', 'arg', 'file']).default('stdin'),
  /** Argument name used when promptMode is 'arg'. */
  promptArg: z.string().default('--prompt'),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(600),
  /** Working directory the agent may write to, if restricted. */
  allowedPaths: z.array(z.string()).default([]),
});
export type CliAdapterConfig = z.infer<typeof cliAdapterConfigSchema>;

export const acpAdapterConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: z.record(z.string()).default({}),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(900),
  /** Client capabilities advertised during ACP initialize. */
  clientCapabilities: z
    .object({
      fs: z
        .object({
          readTextFile: z.boolean().default(false),
          writeTextFile: z.boolean().default(false),
        })
        .default({ readTextFile: false, writeTextFile: false }),
      terminal: z.boolean().default(false),
    })
    .default({ fs: { readTextFile: false, writeTextFile: false }, terminal: false }),
});
export type AcpAdapterConfig = z.infer<typeof acpAdapterConfigSchema>;

export const a2aAdapterConfigSchema = z.object({
  baseUrl: z.string().url(),
  /** Path to the agent card, relative to baseUrl or absolute. */
  agentCardPath: z.string().default('/.well-known/agent-card.json'),
  /** Reference to a secret holding the bearer token. */
  authTokenRef: z.string().optional(),
  /** How to obtain the message send URL from the agent card. */
  messageUrl: z.string().default('message/send'),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(600),
});
export type A2aAdapterConfig = z.infer<typeof a2aAdapterConfigSchema>;

export const httpAdapterConfigSchema = z.object({
  baseUrl: z.string().url(),
  path: z.string().default('/chat'),
  method: z.enum(['POST', 'PUT']).default('POST'),
  /** Static headers. Values that look like credentials must be refs. */
  headers: z.record(z.string()).default({}),
  /** Reference to a secret holding the bearer token. */
  authTokenRef: z.string().optional(),
  authHeader: z.string().default('Authorization'),
  authScheme: z.string().default('Bearer'),
  /** Placeholder replaced with the outgoing text: {{message}}, {{context}}. */
  bodyTemplate: z.string().default('{"message":"{{message}}","context":"{{context}}"}'),
  /** Dotted path to the reply text inside the JSON response. */
  responseTextPath: z.string().default('message'),
  /** When set, the response is treated as SSE and text is read from the stream. */
  sse: z.boolean().default(false),
  /** Dotted path to the streaming text delta in SSE `data:` payloads. */
  sseTextPath: z.string().optional(),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(600),
});
export type HttpAdapterConfig = z.infer<typeof httpAdapterConfigSchema>;

export const modelAdapterConfigSchema = z.object({
  /** Only OpenAI-compatible chat completions are implemented in v1. */
  provider: z.literal('openai-compatible').default('openai-compatible'),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  /** Reference to a secret holding the API key. */
  apiKeyRef: z.string().optional(),
  apiKeyHeader: z.string().default('Authorization'),
  apiKeyScheme: z.string().default('Bearer'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(1_000_000).default(4096),
  systemPrompt: z.string().optional(),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(600),
});
export type ModelAdapterConfig = z.infer<typeof modelAdapterConfigSchema>;

export const echoAdapterConfigSchema = z.object({
  reply: z.string().optional(),
  delayMs: z.number().int().min(0).max(60_000).default(0),
});
export type EchoAdapterConfig = z.infer<typeof echoAdapterConfigSchema>;

/**
 * An agent that is an MCP server.
 *
 * The connection is a trust decision like any other: the owner names the
 * server, the tool a turn calls, and the tools the connection may call at
 * all. Credentials are references, never values — the bearer token lives in a
 * server-held secret record.
 */
export const mcpAdapterConfigSchema = z.object({
  /** How the MCP server is reached. */
  transport: z.enum(['stdio', 'http']).default('stdio'),
  /** The command that starts an MCP server, for the stdio transport. */
  command: z.string().min(1).optional(),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  /** Additional environment variables for the supervised process. */
  env: z.record(z.string()).default({}),
  /** The MCP server's URL, for the http transport. */
  url: z.string().url().optional(),
  /** Reference to a secret holding the bearer token, for the http transport. */
  authTokenRef: z.string().optional(),
  /** The MCP protocol revision the client speaks. */
  protocolVersion: z.string().min(1).default('2025-06-18'),
  /** The tool a turn calls. */
  toolName: z.string().min(1),
  /** The tool's arguments, as a JSON template. */
  argumentTemplate: z.string().default('{"message":"{{message}}"}'),
  /** The tools this connection may call. Empty means the configured tool alone. */
  allowedTools: z.array(z.string()).default([]),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(600),
});
export type McpAdapterConfig = z.infer<typeof mcpAdapterConfigSchema>;

export const adapterConfigSchema = z.discriminatedUnion('adapterType', [
  cliAdapterConfigSchema.extend({ adapterType: z.literal('cli') }),
  acpAdapterConfigSchema.extend({ adapterType: z.literal('acp') }),
  a2aAdapterConfigSchema.extend({ adapterType: z.literal('a2a') }),
  httpAdapterConfigSchema.extend({ adapterType: z.literal('http') }),
  modelAdapterConfigSchema.extend({ adapterType: z.literal('model') }),
  echoAdapterConfigSchema.extend({ adapterType: z.literal('echo') }),
  mcpAdapterConfigSchema.extend({ adapterType: z.literal('mcp') }),
]);
export type AdapterConfig = z.infer<typeof adapterConfigSchema>;

/**
 * Parse an adapter configuration. Throws a readable error when the stored
 * record no longer matches the current schema (schema versioning).
 */
export function parseAdapterConfig(raw: unknown): AdapterConfig {
  return adapterConfigSchema.parse(raw);
}
