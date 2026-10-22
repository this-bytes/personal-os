import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { agentConnections, executions, messages } from '../../db/schema.js';
import type { Queue } from '../../queue/client.js';
import type { AuditService } from '../audit/service.js';
import type { EventsService } from '../events/service.js';
import type { Approval, ApprovalsService } from './service.js';

/**
 * What happened to the turn when the owner decided.
 *
 * `resumed` means the turn continues in the session it was in, with the
 * decision as its next input. `closed` means the turn is over: the answer is
 * recorded, but the agent could not be continued.
 */
export type ApprovalOutcome = 'resumed' | 'closed';

export interface ApprovalDecision {
  approval: Approval;
  execution: { id: string; status: string } | null;
  outcome: ApprovalOutcome;
  /** What the owner should be told, in words. */
  detail: string;
}

/**
 * The decision, and then the turn.
 *
 * The order matters: the answer is recorded first, so it is never lost
 * because the session could not be restored. Only then is the resume
 * attempted — and if it cannot happen, the turn closes with the answer
 * still on record.
 */
export function decideApproval(input: {
  db: Database;
  queue: Queue;
  audit: AuditService;
  events: EventsService;
  approvals: ApprovalsService;
  approvalId: string;
  approved: boolean;
  reason: string;
  decidedBy: string;
  actorType: 'human' | 'agent';
}): ApprovalDecision {
  const { db, queue, audit, events, approvals } = input;

  // 1. The decision is recorded.
  const approval = approvals.decide(input.approvalId, {
    approved: input.approved,
    reason: input.reason,
    decidedBy: input.decidedBy,
  });

  audit.record({
    workspaceId: approval.workspaceId,
    actorType: input.actorType,
    actorId: input.decidedBy,
    action: input.approved ? 'approval.granted' : 'approval.rejected',
    targetType: 'approval',
    targetId: approval.id,
    metadata: { executionId: approval.executionId, reason: input.reason },
  });

  // 2. The decision is published, so a client watching the stream learns that
  //    the answer has arrived and can take the approval off its waiting list.
  //    It is published here, once, whatever the turn does next: whether it
  //    continues or closes does not change the fact that the owner decided.
  events.publish({ type: 'approval.decided', approval }, { workspaceId: approval.workspaceId });

  if (!approval.executionId) {
    return {
      approval,
      execution: null,
      outcome: 'closed',
      detail: 'The decision was recorded. There was no turn to continue.',
    };
  }

  const execution = db
    .select()
    .from(executions)
    .where(eq(executions.id, approval.executionId))
    .get();

  if (!execution) {
    return {
      approval,
      execution: null,
      outcome: 'closed',
      detail: 'The decision was recorded. The operation it referred to no longer exists.',
    };
  }

  // 2. Can the turn continue? The capability is the gate: the adapter says
  //    whether it can re-enter a session. A blocked execution with no
  //    session carries nothing to resume.
  const connection = execution.agentConnectionId
    ? db
        .select()
        .from(agentConnections)
        .where(eq(agentConnections.id, execution.agentConnectionId))
        .get()
    : undefined;
  const capabilities = (connection?.capabilities ?? null) as {
    persistentSessions?: boolean;
  } | null;
  const canResume = capabilities?.persistentSessions === true && Boolean(execution.externalRef);

  if (canResume) {
    const reply = db.select().from(messages).where(eq(messages.executionId, execution.id)).get();
    const parent = reply?.replyToId
      ? db.select().from(messages).where(eq(messages.id, reply.replyToId)).get()
      : undefined;
    const depth = (reply?.origin as { depth?: number } | null)?.depth ?? 1;

    queue.enqueue({
      workspaceId: execution.workspaceId,
      type: 'chat.turn',
      payload: {
        conversationId: execution.conversationId ?? '',
        agentConnectionId: execution.agentConnectionId,
        executionId: execution.id,
        parentMessageId: parent?.id ?? reply?.id ?? '',
        correlationId: reply?.correlationId ?? '',
        depth,
        resume: {
          decision: decisionText(input.approved, input.reason),
          externalSessionId: execution.externalRef ?? '',
        },
      },
    });

    audit.record({
      workspaceId: execution.workspaceId,
      actorType: input.actorType,
      actorId: input.decidedBy,
      action: 'approval.resumed',
      targetType: 'execution',
      targetId: execution.id,
      metadata: { approvalId: approval.id, session: execution.externalRef },
    });

    return {
      approval,
      execution: { id: execution.id, status: execution.status },
      outcome: 'resumed',
      detail: 'The decision was recorded and the turn continues in the session it was in.',
    };
  }

  // 3. The turn cannot continue, so it closes. The answer is still on
  //    record, and the owner is told the turn was closed rather than
  //    continued.
  const detail =
    'The turn was closed rather than continued: the agent cannot re-enter a session, so the operation was not performed.';
  const status = input.approved ? 'completed' : 'cancelled';

  approvals.resolveExecution(execution.id, status, detail);
  closeReply(db, execution.id, detail);

  audit.record({
    workspaceId: execution.workspaceId,
    actorType: input.actorType,
    actorId: input.decidedBy,
    action: 'approval.closed',
    targetType: 'execution',
    targetId: execution.id,
    metadata: { approvalId: approval.id, reason: detail },
  });

  return {
    approval,
    execution: { id: execution.id, status },
    outcome: 'closed',
    detail,
  };
}

/** The decision, as the next input of the resumed turn. */
function decisionText(approved: boolean, reason: string): string {
  const why = reason.trim();
  return approved
    ? `The owner approved this operation${why ? `: ${why}` : '.'} Continue.`
    : `The owner rejected this operation${why ? `: ${why}` : '.'} Do not perform it.`;
}

/**
 * Finish the reply of a turn that is closed.
 *
 * The reply is not finished — the turn was stopped — so it says so rather
 * than pretending the agent had answered. The reason goes with it: the
 * sentence the server produced is on the reply, so the owner reads what
 * happened instead of a bare badge, and the reason is not left in the audit
 * trail where the panel does not show it.
 */
function closeReply(db: Database, executionId: string, detail: string): void {
  db.update(messages)
    .set({ status: 'failed', detail })
    .where(eq(messages.executionId, executionId))
    .run();
}
