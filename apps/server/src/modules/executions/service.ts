import { and, desc, eq } from 'drizzle-orm';
import type {
  ActorType,
  ChatActivityReadModel,
  DelegatedTask,
  ExecutionStatus,
  RunControl,
  StopTurnResult,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { executions, messages } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import type { AuditService } from '../audit/service.js';
import type { BotsService } from '../conversations/bots.js';
import type { EventsService } from '../events/service.js';
import { publishTurnEnd } from '../events/turn-end.js';
import * as activity from './activity.js';

/**
 * The owner's conclusion about an execution whose outcome could not be
 * confirmed.
 *
 * `completed` says it did run; `failed` says it did not. The product does not
 * know which of the two it was — the worker stopped and could not confirm how
 * the turn ended — and the owner does, because the owner went and looked.
 */
export type ExecutionOutcome = 'completed' | 'failed';

export interface ExecutionResolution {
  execution: { id: string; status: string; error: string | null };
  /** The workspace the execution belongs to. The owner is its only reader. */
  workspaceId: string;
  /** The conclusion the owner reached. */
  outcome: ExecutionOutcome;
  /** The sentence the server produced about that conclusion. */
  detail: string;
}

export interface ExecutionsService {
  /**
   * Read one turn.
   *
   * A turn is an execution: its status, what it was for, and where it ran.
   */
  get(id: string): ExecutionDetail;
  /**
   * The turns of a workspace, newest first.
   *
   * A listing is scoped to a workspace and never wider: the owner of a
   * workspace sees its turns, and an agent sees the turns of the workspace it
   * was granted and nothing else.
   */
  list(input: { workspaceId: string; status?: ExecutionStatus; limit?: number }): ExecutionDetail[];
  /**
   * The turn with the activity behind it.
   *
   * The trace the panel draws is derived from the event log, so it is still
   * there when the owner comes back to the room. The delegation tree is part
   * of the turn, not a second thing to look up under another name: a turn that
   * delegated work carries that work, and a turn that was delegated work
   * carries the turn that delegated it.
   *
   * The capability view and the committed revision are absent rather than
   * empty; they are published, and they are not implemented yet.
   */
  read(id: string): ChatActivityReadModel;
  /**
   * Ask a turn to stop.
   *
   * A turn that had not started is cancelled, and the answer says so. A turn
   * that is already running can only be asked: the worker holds the live
   * session, and the API server never runs an agent, so there is no channel
   * from here to a running turn. The answer never presents the request as a
   * cancellation, and it never claims the turn stopped when only a request was
   * made.
   */
  stop(input: {
    executionId: string;
    /** The caller's own words, when they have any. */
    note?: string;
    /** Who asked for the stop. */
    actorType: ActorType;
    actorId: string;
  }): StopTurnResult;
  /**
   * Record the owner's conclusion about an execution whose outcome could not
   * be confirmed.
   *
   * The execution takes the conclusion and its reply follows it. The audit
   * entry is written here, where the action is, and it names who reached the
   * conclusion.
   */
  resolve(input: {
    executionId: string;
    outcome: ExecutionOutcome;
    /** The owner's own words, when they have any. */
    note?: string;
    /** Who reached the conclusion. */
    actorType: ActorType;
    actorId: string;
  }): ExecutionResolution;
}

/** A turn, as the owner reads it. */
export interface ExecutionDetail {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  taskId: string | null;
  agentConnectionId: string | null;
  status: string;
  error: string | null;
  spendUnits: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/**
 * The sentence the server produced about the owner's conclusion.
 *
 * The client shows it as it is given: the account of what happened is the
 * server's, and a client that reworded it would be telling the owner
 * something the server knows better. The owner's own note goes with it,
 * because the note is theirs.
 */
export function resolutionSentence(outcome: ExecutionOutcome): string {
  return outcome === 'completed'
    ? 'You checked this turn: it did run, so the reply is recorded as complete.'
    : 'You checked this turn: it did not run, so the reply is recorded as failed.';
}

/**
 * Executions whose outcome could not be confirmed.
 *
 * An execution is a run of an agent's turn. The worker records what it can
 * confirm, and when it cannot confirm how a turn ended it records `unknown`
 * rather than guessing. Closing that is the owner's decision and nobody
 * else's: the product does not know whether the work happened, and it must not
 * run it again to find out.
 */
export function createExecutionsService(options: {
  db: Database;
  audit: AuditService;
  bots: BotsService;
  events: EventsService;
}): ExecutionsService {
  const { db, audit, bots, events } = options;

  const toDetail = (row: typeof executions.$inferSelect): ExecutionDetail => ({
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    taskId: row.taskId,
    agentConnectionId: row.agentConnectionId,
    status: row.status,
    error: row.error,
    spendUnits: row.spendUnits,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  });

  /**
   * Whether the owner has already asked this turn to stop.
   *
   * The request is in the audit trail, so it survives a reload: a panel that
   * forgot the request would offer the stop button again and say nothing about
   * the one already made.
   */
  const stopWasRequested = (workspaceId: string | null, executionId: string): boolean => {
    if (!workspaceId) return false;
    return audit
      .list(workspaceId, 200)
      .some(
        (entry) => entry.action === 'execution.stop.requested' && entry.targetId === executionId,
      );
  };

  const service: ExecutionsService = {
    get(id): ExecutionDetail {
      const row = db.select().from(executions).where(eq(executions.id, id)).get();
      if (!row) throw errors.notFound('Execution');
      return toDetail(row);
    },

    list(input): ExecutionDetail[] {
      const limit = input.limit ?? 50;
      return db
        .select()
        .from(executions)
        .where(
          and(
            eq(executions.workspaceId, input.workspaceId),
            input.status ? eq(executions.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(executions.createdAt))
        .limit(limit)
        .all()
        .map(toDetail);
    },

    read(id): ChatActivityReadModel {
      const turn = activity.readTurnRow(db, id);
      if (!turn) throw errors.notFound('Execution');

      const activities = activity
        .deriveActivities(activity.readTurnEvents(db, id))
        .map((entry) => ({ ...entry, conversationId: turn.conversationId }));

      const run = activity.runControlFor({
        status: activity.turnStatusOf(turn.status),
        stopRequested: stopWasRequested(turn.workspaceId, id),
        // A turn can be steered when the capability set it was admitted with
        // can take input while it runs. The set is pinned at admission, so a
        // capability that changed after the turn started does not change the
        // turn: it takes effect on the next one.
        canSteer: activity.turnAcceptsSteering(db, turn),
      });

      const tree = bots.delegationTree(id);

      return {
        turn: {
          id: turn.id,
          conversationId: turn.conversationId,
          agentConnectionId: turn.agentConnectionId,
          status: activity.turnStatusOf(turn.status),
          error: turn.error,
          spendUnits: turn.spendUnits,
          startedAt: turn.startedAt,
          finishedAt: turn.finishedAt,
          // What the turn was admitted with. Absent rather than empty: a turn
          // recorded before the view existed has none, and an empty view would
          // say the agent had no tools.
          capabilityView: turn.capabilityView,
          // The work this turn handed over, and the work that handed over to it.
          delegatedTasks:
            tree.parent || tree.children.length > 0
              ? [tree.parent, ...tree.children].filter(
                  (task): task is DelegatedTask => task !== undefined,
                )
              : null,
          committedRevision: turn.committedRevision,
          // The correlation id the turn carries, so a reader can follow one
          // turn through the events it published.
          correlationId: turn.correlationId,
        },
        activities,
        run,
        execution: service.get(id),
        delegationTree: tree,
      };
    },

    stop(input): StopTurnResult {
      const { executionId } = input;
      const now = new Date().toISOString();

      const before = activity.readTurnRow(db, executionId);
      if (!before) throw errors.notFound('Execution');

      const result = activity.requestStop(db, executionId, now);

      // A turn that had not started is cancelled, and that is the turn's
      // ending: the one event that ends it is published here, so the log and
      // the row agree. A turn that was only *asked* to stop has not ended, and
      // the worker publishes the ending when the turn really stops.
      if (result.outcome === 'cancelled') {
        publishTurnEnd(events, before, 'cancelled');
      }

      // The request is written to the audit trail whether or not it could be
      // carried out: an ask that was recorded and did not stop the turn is
      // still something the caller did, and the trail should show it.
      audit.record({
        workspaceId: before.workspaceId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: 'execution.stop.requested',
        targetType: 'execution',
        targetId: executionId,
        metadata: {
          outcome: result.outcome,
          ...(input.note?.trim() ? { note: input.note } : {}),
        },
      });

      const after = activity.readTurnRow(db, executionId);
      const run: RunControl = activity.runControlFor({
        status: activity.turnStatusOf(after?.status ?? before.status),
        stopRequested: result.outcome === 'requested',
        canSteer: false,
      });

      return {
        executionId,
        outcome: result.outcome,
        detail: result.detail,
        run,
      };
    },

    resolve({ executionId, outcome, note, actorType, actorId }): ExecutionResolution {
      const execution = db.select().from(executions).where(eq(executions.id, executionId)).get();
      if (!execution) {
        throw errors.notFound('Execution');
      }

      // This route answers a question, and there is only a question while the
      // outcome could not be confirmed. An execution whose outcome is known is
      // not the owner's to rewrite, and rewriting it would destroy a record
      // the worker can stand behind.
      if (execution.status !== 'unknown') {
        throw errors.conflict('This execution is not waiting for a conclusion.', {
          status: execution.status,
        });
      }

      const detail = resolutionSentence(outcome);
      const now = new Date().toISOString();
      // The note is the owner's own words, and it is the reason. It goes in
      // the error column where there is an error, and in the audit entry
      // either way.
      const reason = note?.trim() ? note.trim() : null;

      db.update(executions)
        .set({
          status: outcome,
          // The error column carries a reason only where there is an error.
          // A turn that did run has none, and a turn that did not run has the
          // owner's own reason if they gave one.
          error: outcome === 'failed' ? reason : null,
          finishedAt: now,
        })
        .where(eq(executions.id, executionId))
        .run();

      // The reply follows the execution. If the turn did run, the reply
      // completed; if it did not, the reply failed. The sentence goes with
      // it, so the owner reads what happened instead of a bare badge.
      db.update(messages)
        .set({ status: outcome === 'completed' ? 'complete' : 'failed', detail })
        .where(eq(messages.executionId, executionId))
        .run();

      // Leaving the unknown state is the answer to the question the worker
      // could not answer, so it is written to the audit trail, beside the task
      // path's own answer. The entry names who reached the conclusion, because
      // a conclusion is somebody's.
      audit.record({
        workspaceId: execution.workspaceId,
        actorType,
        actorId,
        action: 'execution.outcome.resolved',
        targetType: 'execution',
        targetId: executionId,
        result: 'success',
        metadata: {
          from: 'unknown',
          to: outcome,
          ...(reason ? { note: reason } : {}),
        },
      });

      // The owner's conclusion is the turn's ending. The turn was in
      // `unknown` — a question, not an ending — so the close publishes the one
      // event that ends it, and the row and the log say the same thing.
      publishTurnEnd(events, execution, outcome);
      return {
        execution: {
          id: execution.id,
          status: outcome,
          error: outcome === 'failed' ? reason : null,
        },
        workspaceId: execution.workspaceId,
        outcome,
        detail,
      };
    },
  };

  return service;
}
