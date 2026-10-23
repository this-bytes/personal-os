import { and, desc, eq, lte } from 'drizzle-orm';
import {
  type Automation,
  type AutomationAction,
  type AutomationRun,
  type AutomationTrigger,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { automationRuns, automations } from '../../db/schema.js';
import { authorOf, type Author } from '../../lib/author.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { AuditService } from '../audit/service.js';
import { computeNextRun } from './cron.js';
import { validateAutomationConfig } from '../resources/service.js';

export interface AutomationsService {
  list(workspaceId: string): Automation[];
  get(id: string): Automation;
  create(input: {
    workspaceId: string;
    title: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
    /** Who created the automation. Recorded on the row, not taken from a body. */
    author: Author;
  }): Automation;
  update(
    id: string,
    patch: { title?: string; trigger?: AutomationTrigger; action?: AutomationAction },
  ): Automation;
  remove(id: string): void;
  enable(id: string): Automation;
  disable(id: string): Automation;
  listRuns(automationId: string): AutomationRun[];
  /**
   * The workspace an automation's run belongs to.
   *
   * A run belongs to the automation that made it, and that belongs to a
   * workspace, so this is how a caller's reach is checked before it closes a
   * run: a run outside the workspace the caller was granted is not its run.
   */
  runWorkspace(runId: string): string;
  /** Automations whose next run is due. Used by the worker scheduler. */
  due(now: Date): Automation[];
  recordRun(input: {
    automationId: string;
    status: 'running' | 'completed' | 'failed';
    output?: unknown;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  }): AutomationRun;
  /**
   * The owner's own conclusion about a run whose outcome could not be
   * confirmed.
   *
   * An automation's run has no conversation and no execution, so this is the
   * only way the owner closes the question — and closing it settles the job
   * that was held for it, so the queue's record stops saying the outcome was
   * never confirmed.
   */
  resolveRun(input: {
    runId: string;
    /**
     * The automation the run belongs to, when the caller knows it.
     *
     * A run is closed by the owner of the automation it belongs to, so a
     * request that names an automation and a run that belongs to another one
     * is refused rather than quietly answered.
     */
    automationId?: string;
    outcome: 'completed' | 'failed';
    note?: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): AutomationRun;
}

export interface AutomationsServiceOptions {
  db: Database;
  /**
   * The queue, for settling the job that was held for an uncertain run.
   *
   * The type is the one thing this module needs from the queue, so the
   * automations module does not depend on the queue's whole surface.
   */
  queue?: { settleHeldRun(runId: string, reason: string): boolean };
  audit?: AuditService;
}

/**
 * Automations are scheduled actions. A configuration is validated before it
 * can be enabled, so an invalid automation never reaches the scheduler.
 */
export function createAutomationsService(options: AutomationsServiceOptions): AutomationsService {
  const { db } = options;

  const toAutomation = (row: typeof automations.$inferSelect): Automation => ({
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    trigger: row.trigger as AutomationTrigger,
    action: row.action as AutomationAction,
    enabled: row.enabled,
    revision: row.revision,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const service: AutomationsService = {
    list(workspaceId): Automation[] {
      return db
        .select()
        .from(automations)
        .where(eq(automations.workspaceId, workspaceId))
        .all()
        .map(toAutomation);
    },

    get(id): Automation {
      const row = db.select().from(automations).where(eq(automations.id, id)).get();
      if (!row) throw errors.notFound('Automation');
      return toAutomation(row);
    },

    create(input): Automation {
      validateAutomationConfig(input.trigger, input.action);
      const id = newId('aut');
      const now = new Date().toISOString();
      db.insert(automations)
        .values({
          id,
          workspaceId: input.workspaceId,
          title: input.title.trim(),
          trigger: input.trigger,
          action: input.action,
          revision: 1,
          enabled: false,
          lastRunAt: null,
          nextRunAt: null,
          createdBy: authorOf(input.author),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return service.get(id);
    },

    update(id, patch): Automation {
      const current = service.get(id);
      const trigger = patch.trigger ?? current.trigger;
      const action = patch.action ?? current.action;
      validateAutomationConfig(trigger, action);

      db.update(automations)
        .set({
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          trigger,
          action,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automations.id, id))
        .run();
      return service.get(id);
    },

    remove(id): void {
      service.get(id);
      db.delete(automations).where(eq(automations.id, id)).run();
    },

    enable(id): Automation {
      const current = service.get(id);
      validateAutomationConfig(current.trigger, current.action);
      const nextRunAt = computeNextRun(current.trigger, new Date());
      db.update(automations)
        .set({
          enabled: true,
          nextRunAt,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automations.id, id))
        .run();
      return service.get(id);
    },

    disable(id): Automation {
      const current = service.get(id);
      db.update(automations)
        .set({
          enabled: false,
          nextRunAt: null,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automations.id, id))
        .run();
      return service.get(id);
    },

    listRuns(automationId): AutomationRun[] {
      return db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.startedAt))
        .all()
        .map((row) => ({
          id: row.id,
          automationId: row.automationId,
          status: row.status as AutomationRun['status'],
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          output: row.output,
          error: row.error,
        }));
    },

    runWorkspace(runId): string {
      const run = db.select().from(automationRuns).where(eq(automationRuns.id, runId)).get();
      if (!run) throw errors.notFound('Automation run');
      const automation = db
        .select()
        .from(automations)
        .where(eq(automations.id, run.automationId))
        .get();
      if (!automation) throw errors.notFound('Automation');
      return automation.workspaceId;
    },

    due(now): Automation[] {
      const nowIso = now.toISOString();
      return db
        .select()
        .from(automations)
        .where(and(eq(automations.enabled, true), lte(automations.nextRunAt, nowIso)))
        .all()
        .map(toAutomation);
    },

    recordRun(input): AutomationRun {
      const id = newId('run');
      db.insert(automationRuns)
        .values({
          id,
          automationId: input.automationId,
          status: input.status,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt ?? null,
          output: input.output ?? null,
          error: input.error ?? null,
        })
        .run();

      const row = db.select().from(automationRuns).where(eq(automationRuns.id, id)).get()!;
      return {
        id: row.id,
        automationId: row.automationId,
        status: row.status as AutomationRun['status'],
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        output: row.output,
        error: row.error,
      };
    },

    resolveRun(input): AutomationRun {
      const run = db.select().from(automationRuns).where(eq(automationRuns.id, input.runId)).get();
      if (!run) throw errors.notFound('Automation run');
      // The run belongs to the automation the caller named, or the call is
      // about a different run than the one the caller thinks it is.
      if (input.automationId !== undefined && run.automationId !== input.automationId) {
        throw errors.notFound('Automation run');
      }
      // Only a run that is uncertain can be settled by a conclusion. A run
      // that has already ended has been answered.
      if (run.status !== 'unknown') {
        throw errors.conflict('That run has already ended, so there is nothing to settle.');
      }

      const finishedAt = new Date().toISOString();
      db.update(automationRuns)
        .set({ status: input.outcome, finishedAt, error: input.note ?? null })
        .where(and(eq(automationRuns.id, input.runId), eq(automationRuns.status, 'unknown')))
        .run();

      // Leaving the unknown state is the answer to the question the worker
      // could not answer, so it is written to the audit trail, beside the
      // execution path's own answer. The entry names who reached the
      // conclusion, because a conclusion is somebody's.
      const automation = db
        .select()
        .from(automations)
        .where(eq(automations.id, run.automationId))
        .get();
      options.audit?.record({
        workspaceId: automation?.workspaceId ?? '',
        actorType: input.actorType,
        actorId: input.actorId,
        action: 'automation.run.outcome.resolved',
        targetType: 'automationRun',
        targetId: input.runId,
        result: 'success',
        metadata: {
          from: 'unknown',
          to: input.outcome,
          ...(input.note ? { note: input.note } : {}),
        },
      });

      // The job that was held while this run was uncertain is settled too.
      options.queue?.settleHeldRun(
        input.runId,
        'The owner settled this run, so the work it was waiting on is accounted for.',
      );

      const updated = db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.id, input.runId))
        .get()!;
      return {
        id: updated.id,
        automationId: updated.automationId,
        status: updated.status as AutomationRun['status'],
        startedAt: updated.startedAt,
        finishedAt: updated.finishedAt,
        output: updated.output,
        error: updated.error,
      };
    },
  };

  return service;
}
