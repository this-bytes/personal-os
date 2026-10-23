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
  /**
   * The acceptance decision on a task.
   *
   * It is not in the default grant set: a connection that may accept a task
   * is a connection the owner has said may accept one.
   */
  'task.accept',
  'resource.create',
  'resource.get',
  'resource.update',
  /**
   * The two acts a resource may have: publish it, or run it.
   *
   * Neither is in the default grant set, and the coverage table gives the
   * reason for each. Publishing makes a resource visible to everyone: it is
   * the act of the owner, and publishing an automation is what makes it
   * active, so an active automation runs the work of the owner. Running a
   * resource is running it now: an automation run is enqueued for the worker
   * and its action may prompt an agent, and a data source query makes the
   * outbound request that the configuration of the owner describes. Both
   * spend an authority the owner holds, so the owner grants each of them by
   * name.
   */
  'resource.publish',
  'resource.execute',
  'resource.template.list',
  'resource.template.get',
  'automation.create',
  'automation.inspect',
  /**
   * The owner's own conclusion about an automation's run whose outcome could
   * not be confirmed.
   *
   * It is not in the default grant set, for the same reason
   * `execution.resolve` is not: a connection that may close a question the
   * worker could not answer is a connection the owner has said may close one.
   */
  'automation.run.resolve',
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
   * The evidence a decision is taken against.
   *
   * It is in the default grant set: it is a read, and an agent whose turn is
   * blocked on a decision has to be able to see what it is blocked on — the
   * same ground `approval.list` is held to.
   */
  'approval.evidence',
  /**
   * The turn, the activity behind it, the stop request and the resolution.
   *
   * `execution.stop` and `execution.resolve` are not in the default grant set,
   * for the same reason `approval.decide` is not: a connection that may stop a
   * turn, or may close a turn whose outcome could not be confirmed, is a
   * connection the owner has said may do that.
   */
  'execution.list',
  'execution.get',
  'execution.stop',
  'execution.resolve',
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
 * `approval.decide`, `execution.stop`, `execution.resolve`, `task.accept`,
 * `resource.publish` and `resource.execute` are the owner's to grant, one by
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
  'approval.evidence',
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
