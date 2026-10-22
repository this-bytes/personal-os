import { z } from 'zod';

/**
 * The MCP tools Personal OS publishes.
 *
 * The names are a contract: the API validates them, the MCP server exposes
 * them, and the grant editor in the web client lists them. Adding a tool
 * here makes it visible everywhere at once.
 */
export const mcpToolNames = [
  'workspace.list',
  'conversation.read',
  'conversation.post',
  /**
   * Hand a bounded piece of work to another agent and receive its result.
   *
   * It is not in the default grant set: a connection that may delegate is a
   * connection the owner has said may delegate.
   */
  'bot.dispatch',
  'agent.list',
  'task.create',
  'task.update',
  'task.get',
  'resource.create',
  'resource.get',
  'resource.update',
  'resource.template.list',
  'resource.template.get',
  'automation.create',
  'automation.inspect',
  'autonomy.read',
] as const;

export type McpToolName = (typeof mcpToolNames)[number];

export const mcpToolNameSchema = z.enum(mcpToolNames);

/**
 * The tools an agent connection may use unless the owner narrows them
 * down. An agent never gets the workspace listing: it works inside the
 * workspace it was granted, not across all of them.
 */
export const defaultAgentToolGrants: McpToolName[] = [
  'conversation.read',
  'conversation.post',
  'agent.list',
  'task.get',
  'task.create',
  'task.update',
  'resource.create',
  'resource.get',
  'resource.update',
  'resource.template.list',
  'resource.template.get',
  'automation.create',
  'automation.inspect',
  'autonomy.read',
];

/** The tools the owner may use through MCP. */
export const ownerToolGrants: McpToolName[] = [...mcpToolNames];

/** A grant list from the API: unique, known tool names only. */
export const toolGrantListSchema = z.array(mcpToolNameSchema).max(mcpToolNames.length);

export type ToolGrantList = z.infer<typeof toolGrantListSchema>;
