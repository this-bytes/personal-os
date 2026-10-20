import { and, desc, eq, lte } from 'drizzle-orm';
import {
  type Automation,
  type AutomationAction,
  type AutomationRun,
  type AutomationTrigger,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { automationRuns, automations } from '../../db/schema.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
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
  }): Automation;
  update(
    id: string,
    patch: { title?: string; trigger?: AutomationTrigger; action?: AutomationAction },
  ): Automation;
  remove(id: string): void;
  enable(id: string): Automation;
  disable(id: string): Automation;
  listRuns(automationId: string): AutomationRun[];
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
}

export interface AutomationsServiceOptions {
  db: Database;
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
  };

  return service;
}
