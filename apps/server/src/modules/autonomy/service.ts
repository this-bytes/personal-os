import { eq } from 'drizzle-orm';
import {
  readAutonomyPolicy,
  resolveAutonomyPolicy,
  type ConversationSafeguards,
  type EffectiveAutonomyPolicy,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { conversations, goals, workspaces } from '../../db/schema.js';

/**
 * The policy in force, read from the rows that hold it.
 *
 * The resolver itself is pure and lives in the contracts; this is the one
 * place that knows which rows hold a policy and how to read them. Every
 * enforcement point asks this for the effective policy and consumes the
 * result, so no enforcement point reads a policy row itself.
 */

export interface EffectivePolicyScope {
  /** The workspace the work happens in. Its policy is the outermost one. */
  workspaceId: string;
  /** The goal the work belongs to, when it belongs to one. */
  goalId?: string;
  /** The conversation the work happens in, when it happens in one. */
  conversationId?: string;
}

export function loadEffectiveAutonomyPolicy(
  db: Database,
  scope: EffectivePolicyScope,
): EffectiveAutonomyPolicy {
  const workspace = db
    .select({ autonomyPolicy: workspaces.autonomyPolicy })
    .from(workspaces)
    .where(eq(workspaces.id, scope.workspaceId))
    .get();

  const goal =
    scope.goalId === undefined
      ? undefined
      : db
          .select({ autonomyPolicy: goals.autonomyPolicy, workspaceId: goals.workspaceId })
          .from(goals)
          .where(eq(goals.id, scope.goalId))
          .get();

  const conversation =
    scope.conversationId === undefined
      ? undefined
      : db
          .select({
            maxTurns: conversations.maxTurns,
            maxDurationSeconds: conversations.maxDurationSeconds,
            maxSpendUnits: conversations.maxSpendUnits,
            workspaceId: conversations.workspaceId,
          })
          .from(conversations)
          .where(eq(conversations.id, scope.conversationId))
          .get();

  return resolveAutonomyPolicy({
    // A goal or a conversation that belongs to another workspace has no say
    // in this one: a caller cannot reach across workspaces to loosen a
    // policy, and the policy it reads is the one of its own workspace.
    //
    // The column is read, not cast. A row that cannot be a policy is no
    // policy, and a row whose fields are broken is read one field at a time
    // by the resolver, so a broken row is ignored rather than obeyed.
    workspace: readAutonomyPolicy(workspace?.autonomyPolicy),
    goal:
      goal && goal.workspaceId === scope.workspaceId
        ? readAutonomyPolicy(goal.autonomyPolicy)
        : null,
    conversation:
      conversation && conversation.workspaceId === scope.workspaceId
        ? ({
            maxTurns: conversation.maxTurns,
            maxDurationSeconds: conversation.maxDurationSeconds,
            maxSpendUnits: conversation.maxSpendUnits,
          } satisfies ConversationSafeguards)
        : null,
  });
}
