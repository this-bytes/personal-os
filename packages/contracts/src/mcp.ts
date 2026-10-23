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
  /**
   * The approval queue, and the decision on it.
   *
   * `approval.list` is in the default grant set: an agent whose turn is
   * blocked on the owner has to be able to see what it is blocked on.
   * `approval.decide` is not. A connection that may answer an approval is a
   * connection the owner has said may answer an approval, so the owner grants
   * that one verb explicitly — the same rule `bot.dispatch` is held to.
   */
  'approval.list',
  'approval.decide',
  /**
   * The turn, the activity behind it, and the stop request.
   *
   * `execution.stop` is not in the default grant set, for the same reason
   * `approval.decide` is not: a connection that may stop a turn is a
   * connection the owner has said may stop a turn.
   */
  'execution.list',
  'execution.get',
  'execution.stop',
  /**
   * The event log and the audit trail.
   *
   * Both are read-only records of what happened in the caller's own
   * workspace, and both are in the default grant set: an agent that has just
   * acted needs to be able to read what it did.
   */
  'event.list',
  'audit.list',
] as const;

export type McpToolName = (typeof mcpToolNames)[number];

export const mcpToolNameSchema = z.enum(mcpToolNames);

/**
 * The tools an agent connection may use unless the owner narrows them
 * down. An agent never gets the workspace listing: it works inside the
 * workspace it was granted, not across all of them.
 *
 * The destructive verbs are not here either: `bot.dispatch`,
 * `approval.decide` and `execution.stop` are the owner's to grant, one by
 * one, because each of them spends an authority the owner holds.
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
  'approval.list',
  'execution.list',
  'execution.get',
  'event.list',
  'audit.list',
];

/** The tools the owner may use through MCP. */
export const ownerToolGrants: McpToolName[] = [...mcpToolNames];

/** A grant list from the API: unique, known tool names only. */
export const toolGrantListSchema = z.array(mcpToolNameSchema).max(mcpToolNames.length);

export type ToolGrantList = z.infer<typeof toolGrantListSchema>;
