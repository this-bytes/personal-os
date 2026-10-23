import { and, asc, eq, sql } from 'drizzle-orm';
import { turnAcceptsSteering as acceptsSteering } from '../capabilities/capability-view.js';
import { isTerminalTurnStatus, terminalTurnEvent, turnEventFor } from '@personal-os/contracts';
import type {
  AgentEvent,
  ChatActivity,
  RunControl,
  RunControlOption,
  RunState,
  ServerEvent,
  StopTurnOutcome,
  TurnCapabilityView,
  TurnStatus,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { executionEvents, executions, queueJobs } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';

/**
 * What an agent's turn did, read from the event log.
 *
 * The log is the record: the worker publishes every adapter event onto the
 * same spine the server writes to, so a trace derived from it survives a
 * browser reload. A trace that only existed in a live stream would be empty
 * when the owner came back to the room.
 *
 * The event names are the published ones — Contract 2's adapter events and
 * Contract 7's turn events — and nothing here invents a vocabulary beside
 * them. A row that is only a status carries no event name and says the
 * status instead, because `completed` and `committed` are different facts and
 * a row that claimed the wrong one would be a lie.
 */

/** One row of the event log, as the derivation reads it. */
export interface ActivitySourceEvent {
  seq: number;
  type: string;
  payload: ServerEvent;
  createdAt: string;
}

/**
 * The published event name for a turn status, when the status has one.
 *
 * The definition lives in the shared contracts, because "which event ends a
 * turn" has to be one answer and not one answer per reader. It is re-exported
 * here so the readers that already import it from this module keep working.
 */
export { turnEventFor, isTerminalTurnStatus, terminalTurnEvent };

/** The state of an activity that records a turn status. */
export function activityStatusFor(status: TurnStatus): ChatActivity['status'] {
  switch (status) {
    case 'queued':
    case 'blocked':
      return 'pending';
    case 'running':
      return 'running';
    case 'failed':
      return 'failed';
    case 'unknown':
      return 'unknown';
    default:
      return 'done';
  }
}

/** The statuses a turn can hold, in the vocabulary the contract publishes. */
const TURN_STATUSES = [
  'queued',
  'running',
  'blocked',
  'completed',
  'committed',
  'failed',
  'cancelled',
  'unknown',
  'lost',
] as const satisfies readonly TurnStatus[];

/**
 * The turn's status, in the vocabulary the contract publishes.
 *
 * A status the vocabulary does not hold is `unknown`, which is what the
 * contract means by it: started, outcome unconfirmed.
 */
export function turnStatusOf(status: string): TurnStatus {
  return (TURN_STATUSES as readonly string[]).includes(status) ? (status as TurnStatus) : 'unknown';
}

/**
 * A short account of a tool's output.
 *
 * It is a description, not a value: the owner reads one line and opens the
 * row when they want the whole thing.
 */
export function summariseToolOutput(output: unknown): string | null {
  if (output === undefined || output === null) return null;
  if (typeof output === 'string') {
    const trimmed = output.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  if (typeof output === 'number' || typeof output === 'boolean') return String(output);
  if (typeof output === 'object') {
    const record = output as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ['revision', 'rev', 'sections', 'count', 'bytes', 'status']) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'number') parts.push(`${key} ${value}`);
    }
    if (parts.length > 0) return parts.join(' · ');
    return 'output';
  }
  return null;
}

/** The event payload of an `execution.event` row, when it carries one. */
function agentEventOf(payload: ServerEvent): AgentEvent | null {
  if (payload.type !== 'execution.event') return null;
  return payload.event;
}

/**
 * Derive the activity of a turn from its event log.
 *
 * The function is pure: it takes the rows and returns the records, so the
 * rules can be tested without a database and the same rows always produce
 * the same trace.
 */
export function deriveActivities(events: ActivitySourceEvent[]): ChatActivity[] {
  const activities: ChatActivity[] = [];
  /** The tool calls that have started and not yet finished. */
  const openTools: ChatActivity[] = [];
  /** The reply that is arriving, if one is. */
  let reply: ChatActivity | null = null;
  /** How many characters the reply has carried so far. */
  let replyChars = 0;

  const findOpenTool = (toolName: string): number => {
    for (let index = openTools.length - 1; index >= 0; index -= 1) {
      const activity = openTools[index];
      if (activity && activity.toolName === toolName) return index;
    }
    return -1;
  };

  for (const row of events) {
    const event = agentEventOf(row.payload);
    if (!event) continue;

    switch (event.type) {
      case 'tool.started': {
        const activity: ChatActivity = {
          id: `act_tool_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'tool',
          event: 'tool.started',
          toolName: event.toolName,
          status: 'running',
          input: event.input,
          startedAt: row.createdAt,
          endedAt: null,
          summary: null,
        };
        activities.push(activity);
        openTools.push(activity);
        break;
      }

      case 'tool.completed': {
        const index = findOpenTool(event.toolName);
        if (index >= 0) {
          const activity = openTools[index];
          openTools.splice(index, 1);
          if (!activity) break;
          activity.status = 'done';
          activity.endedAt = row.createdAt;
          activity.output = event.output;
          activity.summary = summariseToolOutput(event.output);
          break;
        }
        // The completion arrived without a start. It is still a fact, and it
        // is recorded as one: the row says when it was seen, not when the
        // tool began, because that is not known.
        activities.push({
          id: `act_tool_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'tool',
          event: 'tool.completed',
          toolName: event.toolName,
          status: 'done',
          output: event.output,
          startedAt: row.createdAt,
          endedAt: row.createdAt,
          summary: summariseToolOutput(event.output),
        });
        break;
      }

      case 'artifact.created': {
        activities.push({
          id: `act_artifact_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'artifact',
          event: 'artifact.created',
          status: 'done',
          output: { title: event.title, resourceId: event.resourceId },
          startedAt: row.createdAt,
          endedAt: row.createdAt,
          summary: event.title ?? event.resourceId ?? null,
        });
        break;
      }

      case 'message.delta': {
        replyChars += event.text.length;
        if (reply && reply.status === 'running') {
          reply.count = (reply.count ?? 1) + 1;
          reply.summary = `message.delta × ${reply.count}`;
          break;
        }
        reply = {
          id: `act_message_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'message',
          event: 'message.delta',
          status: 'running',
          startedAt: row.createdAt,
          endedAt: null,
          summary: 'message.delta × 1',
          count: 1,
        };
        activities.push(reply);
        break;
      }

      case 'message.completed': {
        if (event.text) replyChars += event.text.length;
        if (reply) {
          reply.status = 'done';
          reply.endedAt = row.createdAt;
          reply.summary = `message.completed · ${replyChars} chars`;
          break;
        }
        activities.push({
          id: `act_message_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'message',
          event: 'message.completed',
          status: 'done',
          startedAt: row.createdAt,
          endedAt: row.createdAt,
          summary: `message.completed · ${replyChars} chars`,
        });
        break;
      }

      case 'approval.requested': {
        activities.push({
          id: `act_request_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'request',
          event: 'approval.requested',
          status: 'running',
          input: event.details,
          startedAt: row.createdAt,
          endedAt: null,
          summary: event.summary,
        });
        break;
      }

      case 'execution.status': {
        const status = event.status as TurnStatus;
        activities.push({
          id: `act_status_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'status',
          event: turnEventFor(status),
          status: activityStatusFor(status),
          startedAt: row.createdAt,
          endedAt: row.createdAt,
          summary: status,
        });
        break;
      }

      case 'execution.error': {
        activities.push({
          id: `act_error_${row.seq}`,
          executionId: event.executionId,
          conversationId: null,
          kind: 'status',
          event: 'turn.failed',
          status: 'failed',
          startedAt: row.createdAt,
          endedAt: row.createdAt,
          summary: event.message,
        });
        break;
      }

      default:
        break;
    }
  }

  return activities;
}

/**
 * The state of a run, from the owner's side of the screen.
 *
 * `stopping` is a request, not a fact: it says the runtime was asked and may
 * still finish the turn. It becomes `stopped` only when the turn really
 * reaches the published `cancelled`.
 */
export function runStateFor(input: { status: TurnStatus; stopRequested: boolean }): RunState {
  if (input.status === 'unknown') return 'unknown';
  if (input.status === 'cancelled') return 'stopped';
  if (input.status === 'running') return input.stopRequested ? 'stopping' : 'running';
  return 'idle';
}

/**
 * What the owner may do with a turn.
 *
 * Every control that cannot be used says why. A control that is greyed out
 * with no explanation is a control the product is hiding, and the owner
 * cannot tell "not now" from "not ever".
 */
export function runControlFor(input: {
  status: TurnStatus;
  stopRequested: boolean;
  /** Whether the turn's captured capabilities say it can be steered. */
  canSteer: boolean;
}): RunControl {
  const state = runStateFor(input);

  const stop: RunControlOption = (() => {
    if (input.stopRequested) {
      return {
        operation: 'stop',
        available: false,
        reason: 'A stop was already requested for this turn.',
      };
    }
    switch (input.status) {
      case 'queued':
        return {
          operation: 'stop',
          available: true,
          reason: null,
        };
      case 'running':
        return {
          operation: 'stop',
          available: true,
          reason: null,
        };
      case 'blocked':
        return {
          operation: 'stop',
          available: false,
          reason:
            'The turn is waiting on an approval, so it is not running. Answer the approval to decide its fate.',
        };
      case 'unknown':
        return {
          operation: 'stop',
          available: false,
          reason: 'The outcome of this turn could not be confirmed, so there is nothing to stop.',
        };
      default:
        return {
          operation: 'stop',
          available: false,
          reason: 'The turn has already finished.',
        };
    }
  })();

  const steer: RunControlOption = (() => {
    if (input.status !== 'running') {
      return {
        operation: 'steer',
        available: false,
        reason: 'The turn is not running, so there is nothing to steer.',
      };
    }
    if (!input.canSteer) {
      return {
        operation: 'steer',
        available: false,
        reason:
          'This turn captured no steering capability, so it cannot be steered. A connection that does not report acceptsSteering cannot be steered.',
      };
    }
    return {
      operation: 'steer',
      available: true,
      reason: 'The message will be delivered into the turn that is running.',
    };
  })();

  const queue: RunControlOption = {
    operation: 'queue',
    available: true,
    reason: null,
  };

  return { state, options: [stop, steer, queue] };
}

/**
 * Whether the turn itself can take input while it runs.
 *
 * The rule is the capability module's, because it is a rule about capability
 * sets: a turn runs against the set it was admitted with. The connection's
 * own answer is only asked for a turn recorded before the view existed.
 */
export function turnAcceptsSteering(db: Database, turn: TurnRow): boolean {
  return acceptsSteering(db, turn);
}

/** The turn's own row, as the client reads it. */
export interface TurnRow {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  agentConnectionId: string | null;
  status: string;
  error: string | null;
  spendUnits: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** What the turn was admitted with, when it was admitted with a view. */
  capabilityView: TurnCapabilityView | null;
  /**
   * The revision of the canonical history the turn's output was committed to.
   *
   * Null when the output was not committed into one, which is the honest
   * answer for a turn that failed and for a turn whose output is not part of
   * a conversation's history.
   */
  committedRevision: string | null;
  /** The correlation id the turn carries. */
  correlationId: string | null;
}

/** Read a turn's row, or null when there is no such turn. */
export function readTurnRow(db: Database, executionId: string): TurnRow | null {
  const row = db.select().from(executions).where(eq(executions.id, executionId)).get();
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    agentConnectionId: row.agentConnectionId,
    status: row.status,
    error: row.error,
    spendUnits: row.spendUnits,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    capabilityView: row.capabilityView,
    committedRevision: row.committedRevision,
    correlationId: row.correlationId,
  };
}

/** Read the event log of one turn, in the order it happened. */
export function readTurnEvents(db: Database, executionId: string): ActivitySourceEvent[] {
  return db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.executionId, executionId))
    .orderBy(asc(executionEvents.seq))
    .all()
    .map((row) => ({
      seq: row.seq,
      type: row.type,
      payload: row.payload as ServerEvent,
      createdAt: row.createdAt,
    }));
}

/**
 * Cancel the queued job of one turn.
 *
 * It is the queue's own table, and the update is the queue's own vocabulary:
 * a job that has not been claimed can be cancelled, and a job that has been
 * claimed cannot. The cancellation is deliberately per turn rather than per
 * conversation — `Queue.cancelForConversation` would also cancel the other
 * turns the owner queued, which is more than they asked for.
 */
export function cancelQueuedTurnJob(db: Database, executionId: string, now: string): number {
  const result = db
    .update(queueJobs)
    .set({ status: 'cancelled', updatedAt: now })
    .where(
      and(
        eq(queueJobs.status, 'queued'),
        sql`json_extract(${queueJobs.payload}, '$.executionId') = ${executionId}`,
      ),
    )
    .run();
  return result.changes;
}

/** What a stop request did, and the sentence the owner reads. */
export interface StopOutcome {
  outcome: StopTurnOutcome;
  detail: string;
  /** Whether the turn's own row was changed. */
  changed: boolean;
}

/**
 * Ask a turn to stop.
 *
 * A turn that had not started is cancelled truthfully: its queued job is
 * cancelled and it will not run. A turn that is already running can only be
 * *asked* to stop — the worker has no channel to cancel a live adapter
 * session — and the outcome says so. A turn whose outcome could not be
 * confirmed, or one that has already finished, has nothing to stop.
 */
export function requestStop(db: Database, executionId: string, now: string): StopOutcome {
  const turn = readTurnRow(db, executionId);
  if (!turn) throw errors.notFound('Execution');

  switch (turn.status) {
    case 'queued': {
      const cancelled = cancelQueuedTurnJob(db, executionId, now);
      if (cancelled > 0) {
        db.update(executions)
          .set({ status: 'cancelled', finishedAt: now })
          .where(eq(executions.id, executionId))
          .run();
        return {
          outcome: 'cancelled',
          detail: 'The turn had not started. Its queued job was cancelled, so it will not run.',
          changed: true,
        };
      }
      return {
        outcome: 'requested',
        detail:
          'The turn had already been claimed by a worker, so it was asked to stop. The runtime may finish the current turn.',
        changed: false,
      };
    }

    case 'running':
      return {
        outcome: 'requested',
        detail: 'Stop requested. The runtime may finish the current turn.',
        changed: false,
      };

    case 'blocked':
      return {
        outcome: 'not_running',
        detail:
          'The turn is waiting on an approval, so it is not running. Answer the approval to decide its fate.',
        changed: false,
      };

    case 'unknown':
      return {
        outcome: 'not_running',
        detail: 'The outcome of this turn could not be confirmed, so there is nothing to stop.',
        changed: false,
      };

    default:
      return {
        outcome: 'not_running',
        detail: 'The turn has already finished.',
        changed: false,
      };
  }
}
