import { eq } from 'drizzle-orm';
import type { ApprovalEvidence, ArtifactEvidence, ToolCallEvidence } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { approvals, executionEvents, executions } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';

/**
 * The evidence a decision is taken against.
 *
 * The approval points at the execution that raised it, and the execution's own
 * record is the evidence: what the agent did, what it produced and what it
 * cost. Everything here is read — there is no new storage, and this read
 * records nothing.
 */

/** One row of the event log, as the log keeps it. */
export interface ExecutionEventRow {
  seq: number;
  type: string;
  payload: unknown;
  createdAt: string;
}

/**
 * An agent event, as far as the evidence needs to know one.
 *
 * Only the type and the two fields the published shapes carry are read, and
 * they are read as they are: an event that does not carry a title carries no
 * title, and the evidence says so rather than inventing one.
 */
interface AgentEventLike {
  type: string;
  toolName?: unknown;
  title?: unknown;
  resourceId?: unknown;
}

/**
 * The agent event inside one row of the event log.
 *
 * An adapter's event reaches the log inside a server event, so the row's own
 * type is `execution.event` and the agent event is inside it. A row that
 * carries an agent event directly is read as it is, because the log is
 * written by more than one hand and the read does not assume one shape.
 */
function agentEventOf(row: ExecutionEventRow): AgentEventLike | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const payload = row.payload as Record<string, unknown>;

  if (payload.type === 'execution.event') {
    const inner = payload.event;
    if (!inner || typeof inner !== 'object') return null;
    const event = inner as Record<string, unknown>;
    if (typeof event.type !== 'string') return null;
    return {
      type: event.type,
      toolName: event.toolName,
      title: event.title,
      resourceId: event.resourceId,
    };
  }

  if (typeof payload.type !== 'string') return null;
  return {
    type: payload.type,
    toolName: payload.toolName,
    title: payload.title,
    resourceId: payload.resourceId,
  };
}

/**
 * The tool calls of one execution, and how each ended.
 *
 * The events name the tool and not the call, so a completion has to be matched
 * to a call by the tool it names. It answers the most recent call of that
 * tool that nothing has answered yet — the rule the AG-UI stream already
 * uses (`apps/server/src/api/agui-protocol.ts`), so the two surfaces cannot
 * tell the owner two different stories about the same turn.
 *
 * A call nothing answered is `unfinished`, and the evidence does not say why:
 * the published vocabulary has no failure event for a tool call, and a reason
 * this read invented would be a fault it had not observed.
 */
export function toolCallsFromEvents(rows: ExecutionEventRow[]): ToolCallEvidence[] {
  const calls: ToolCallEvidence[] = [];
  /** The calls nothing has answered yet, oldest first. */
  const unanswered: { at: number; toolName: string }[] = [];

  for (const row of rows) {
    const event = agentEventOf(row);
    if (!event || typeof event.toolName !== 'string') continue;

    if (event.type === 'tool.started') {
      unanswered.push({ at: calls.length, toolName: event.toolName });
      calls.push({
        toolName: event.toolName,
        startedAt: row.createdAt,
        completedAt: null,
        outcome: 'unfinished',
      });
      continue;
    }

    if (event.type === 'tool.completed') {
      for (let index = unanswered.length - 1; index >= 0; index -= 1) {
        if (unanswered[index]!.toolName !== event.toolName) continue;
        const call = calls[unanswered[index]!.at]!;
        call.completedAt = row.createdAt;
        call.outcome = 'completed';
        unanswered.splice(index, 1);
        break;
      }
    }
  }

  return calls;
}

/**
 * The artifacts of one execution.
 *
 * Each is an `artifact.created` event, with the title it was given and the
 * resource it made, when it was given either.
 */
export function artifactsFromEvents(rows: ExecutionEventRow[]): ArtifactEvidence[] {
  const artifacts: ArtifactEvidence[] = [];

  for (const row of rows) {
    const event = agentEventOf(row);
    if (!event || event.type !== 'artifact.created') continue;
    artifacts.push({
      title: typeof event.title === 'string' ? event.title : null,
      resourceId: typeof event.resourceId === 'string' ? event.resourceId : null,
      createdAt: row.createdAt,
    });
  }

  return artifacts;
}

/**
 * The evidence for one approval.
 *
 * An approval that names no execution, and an approval whose execution is
 * gone, both answer with no execution: there was nothing to show, not an
 * empty run.
 */
export function readApprovalEvidence(db: Database, approvalId: string): ApprovalEvidence {
  const approval = db.select().from(approvals).where(eq(approvals.id, approvalId)).get();
  if (!approval) throw errors.notFound('Approval');

  const noExecution: ApprovalEvidence = {
    approvalId: approval.id,
    workspaceId: approval.workspaceId,
    execution: null,
  };
  if (!approval.executionId) return noExecution;

  const execution = db
    .select()
    .from(executions)
    .where(eq(executions.id, approval.executionId))
    .get();
  if (!execution) return noExecution;

  const rows = db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.executionId, execution.id))
    .orderBy(executionEvents.seq)
    .all();

  return {
    approvalId: approval.id,
    workspaceId: approval.workspaceId,
    execution: {
      id: execution.id,
      status: execution.status,
      // The error column carries the reason only where there is one. A
      // cancellation is a decision and not a fault, so it carries null.
      error: execution.error,
      // The spend units as they are recorded. The column is created at zero
      // and nothing writes it afterwards, so this is what is recorded and not
      // a measure of what the work was worth.
      spendUnits: execution.spendUnits,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      toolCalls: toolCallsFromEvents(rows),
      artifacts: artifactsFromEvents(rows),
    },
  };
}
