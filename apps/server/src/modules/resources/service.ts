import { and, desc, eq, sql } from 'drizzle-orm';
import {
  automationActionSchema,
  automationTriggerSchema,
  dashboardSpecSchema,
  dataSourceSpecSchema,
  documentSpecSchema,
  isTriggerableEventType,
  memorySpecSchema,
  taskSpecSchema,
  triggerableEventTypes,
  RESOURCE_AUTHOR_SYSTEM,
  type AutomationAction,
  type AutomationTrigger,
  type MemorySpec,
  type Resource,
  type ResourceTemplate,
  type ResourceTemplateRef,
  type ResourceType,
} from '@personal-os/contracts';
import { z } from 'zod';
import type { Database } from '../../db/client.js';
import { automations, resources as resourcesTable } from '../../db/schema.js';
import { authorOf, type Author } from '../../lib/author.js';
import { errors } from '../../lib/errors.js';
import { assertSafeUrl, assertReadableQuery } from '../../lib/guards.js';
import { AGENT_ID_FORM, newId } from '../../lib/ids.js';
import type { EventsService } from '../events/service.js';
import type { Queue } from '../../queue/client.js';
import type { FactoryService } from '../factory/service.js';
import { computeNextRun } from '../automations/cron.js';
import {
  assertTemplatesValid,
  findTemplate,
  listTemplates,
  mergeTemplateSpec,
  resourceTemplates,
  templateIssues,
} from './templates.js';

/**
 * The shared resource API.
 *
 * Humans, agents and automations all operate through this one interface,
 * so an agent can create exactly the resources a person can create.
 */

export interface ResourceInput<T = unknown> {
  workspaceId: string;
  title: string;
  data: T;
  /**
   * Who made the write. The value stored on the row is derived from it, so
   * a caller cannot name an author the request did not authenticate.
   */
  author: Author;
  /** The template this resource was made from, and the version of it. */
  templateId?: string;
  templateVersion?: number;
}

export interface ResourceUpdate<T = unknown> {
  expectedRevision: number;
  title?: string;
  data?: T;
}

export interface ResourceProvider<T = unknown> {
  readonly type: ResourceType;
  validate(data: unknown): T;
  create(input: ResourceInput<T>): Resource<T>;
  get(id: string): Resource<T>;
  update(id: string, patch: ResourceUpdate<T>): Resource<T>;
}

export interface ResourceService {
  list(workspaceId: string, type?: ResourceType): Resource[];
  get(id: string): Resource;
  create(input: {
    workspaceId: string;
    type: ResourceType;
    title: string;
    data: unknown;
    /** Who made the write. Derived into the recorded author, never taken raw. */
    author: Author;
    /**
     * The template this resource was made from.
     *
     * The template's spec is already merged into `data`: the merge belongs to
     * the provider, and the resource records where it came from.
     */
    template?: { id: string; version: number };
  }): Resource;
  update(id: string, patch: { expectedRevision: number; title?: string; data?: unknown }): Resource;
  /** Mark a resource live. Dashboards become visible, automations become active. */
  publish(id: string): Resource;
  /** Trigger the resource's own action once. */
  execute(id: string): Promise<{ output: unknown }>;
  /** Validate and describe the resource without changing it. */
  inspect(id: string): { resource: Resource; valid: boolean; issues: string[] };
  /**
   * How many of the workspace's resources record an agent as their author.
   *
   * The total is every resource in the workspace, across all six kinds. The
   * rows written before the author was recorded keep the `system` they were
   * written with, so they are counted in the total and can never be counted
   * as agent-authored. The count is therefore a lower bound, and the total is
   * the honest denominator.
   */
  authorshipCounts(workspaceId: string): { agentAuthored: number; total: number };
  /** The templates published for one kind — or for every kind. */
  templateList(type?: ResourceType): ResourceTemplate[];
  /**
   * One template, by reference.
   *
   * An unknown template is not found; a template whose spec the owning
   * provider refuses is refused.
   */
  templateGet(ref: ResourceTemplateRef): ResourceTemplate;
  /**
   * The template's spec with the caller's values merged into it.
   *
   * A template of the wrong kind is refused: the spec of a document is not a
   * dashboard. The merge itself never refuses — the owning provider judges
   * the merged spec, and the guide is the advice.
   */
  templateMerge(template: ResourceTemplate, type: ResourceType, override: unknown): unknown;
}

export interface ResourcesServiceOptions {
  db: Database;
  events: EventsService;
  queue: Queue;
  factory: FactoryService;
  /** Allow outbound requests to private and loopback addresses. */
  allowPrivateTargets?: boolean;
  /**
   * The template registry. Defaults to the templates published in the
   * repository, which are the same for every workspace.
   */
  templates?: readonly ResourceTemplate[];
}

/**
 * The resource service. Dispatch is per type so each resource keeps its
 * natural storage while exposing one stable interface.
 */
export function createResourcesService(options: ResourcesServiceOptions): ResourceService {
  const { db, events, queue, factory } = options;
  const targetOptions = { allowPrivateTargets: options.allowPrivateTargets === true };

  const toTableResource = (row: typeof resourcesTable.$inferSelect): Resource => ({
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as ResourceType,
    schemaVersion: row.schemaVersion,
    revision: row.revision,
    title: row.title,
    data: row.data,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    templateId: row.templateId ?? undefined,
    templateVersion: row.templateVersion ?? undefined,
  });

  const tableRow = (id: string) =>
    db.select().from(resourcesTable).where(eq(resourcesTable.id, id)).get();

  /** A provider backed by the generic `resources` table. */
  function tableProvider<T extends z.ZodTypeAny>(
    type: ResourceType,
    schema: T,
  ): ResourceProvider<z.infer<T>> {
    return {
      type,
      validate: (data: unknown) => parseSpec(schema, data, type),
      create(input): Resource<z.infer<T>> {
        const id = newId('res');
        const now = new Date().toISOString();
        const data = this.validate(input.data);
        db.insert(resourcesTable)
          .values({
            id,
            workspaceId: input.workspaceId,
            type,
            schemaVersion: 1,
            revision: 1,
            title: input.title,
            data,
            createdBy: authorOf(input.author),
            templateId: input.templateId ?? null,
            templateVersion: input.templateVersion ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        return toTableResource(tableRow(id)!) as Resource<z.infer<T>>;
      },
      get(id): Resource<z.infer<T>> {
        const row = tableRow(id);
        if (!row) throw errors.notFound('Resource');
        return toTableResource(row) as Resource<z.infer<T>>;
      },
      update(id, patch): Resource<z.infer<T>> {
        const row = tableRow(id);
        if (!row) throw errors.notFound('Resource');
        if (row.revision !== patch.expectedRevision) {
          throw errors.revisionMismatch(patch.expectedRevision, row.revision);
        }
        const data =
          patch.data === undefined ? (row.data as z.infer<T>) : this.validate(patch.data);
        db.update(resourcesTable)
          .set({
            title: patch.title ?? row.title,
            data,
            revision: row.revision + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(resourcesTable.id, id))
          .run();
        return this.get(id);
      },
    };
  }

  const toAutomationResource = (row: typeof automations.$inferSelect): Resource => ({
    id: row.id,
    workspaceId: row.workspaceId,
    type: 'automation',
    schemaVersion: 1,
    revision: row.revision,
    title: row.title,
    data: { trigger: row.trigger, action: row.action, enabled: row.enabled },
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    templateId: row.templateId ?? undefined,
    templateVersion: row.templateVersion ?? undefined,
  });

  function automationProvider(): ResourceProvider<{
    trigger: AutomationTrigger;
    action: AutomationAction;
    enabled: boolean;
  }> {
    const provider: ResourceProvider<{
      trigger: AutomationTrigger;
      action: AutomationAction;
      enabled: boolean;
    }> = {
      type: 'automation',
      validate(data: unknown) {
        const parsed = parseSpec(
          z.object({
            trigger: automationTriggerSchema,
            action: automationActionSchema,
            enabled: z.boolean().default(false),
          }),
          data,
          'automation',
        );
        validateAutomationConfig(parsed.trigger, parsed.action);
        return parsed;
      },
      create(input) {
        const id = newId('aut');
        const now = new Date().toISOString();
        const data = provider.validate(input.data);
        db.insert(automations)
          .values({
            id,
            workspaceId: input.workspaceId,
            title: input.title,
            trigger: data.trigger,
            action: data.action,
            revision: 1,
            enabled: false,
            lastRunAt: null,
            nextRunAt: null,
            createdBy: authorOf(input.author),
            templateId: input.templateId ?? null,
            templateVersion: input.templateVersion ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        return provider.get(id);
      },
      get(id) {
        const row = db.select().from(automations).where(eq(automations.id, id)).get();
        if (!row) throw errors.notFound('Automation');
        return toAutomationResource(row) as Resource<{
          trigger: AutomationTrigger;
          action: AutomationAction;
          enabled: boolean;
        }>;
      },
      update(id, patch) {
        const row = db.select().from(automations).where(eq(automations.id, id)).get();
        if (!row) throw errors.notFound('Automation');
        if (row.revision !== patch.expectedRevision) {
          throw errors.revisionMismatch(patch.expectedRevision, row.revision);
        }
        const current = { trigger: row.trigger, action: row.action, enabled: row.enabled };
        const next = patch.data === undefined ? current : provider.validate(patch.data);
        db.update(automations)
          .set({
            title: patch.title ?? row.title,
            trigger: next.trigger,
            action: next.action,
            enabled: next.enabled,
            revision: row.revision + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(automations.id, id))
          .run();
        return provider.get(id);
      },
    };
    return provider;
  }

  /**
   * The dashboard provider.
   *
   * A dashboard is never born live. The automation's provider writes
   * `enabled: false` on create whatever the spec asked for, and this one
   * writes `published: false` for the same reason: a dashboard becomes live
   * when it is published, which is a separate act, and the template's guide
   * says so in as many words.
   *
   * The judgment belongs to the provider because the merge is not a judge: it
   * merges, and the owning provider judges the result exactly as it judges a
   * spec that arrived whole. A spec that is not an object is passed on
   * untouched, so the schema still refuses it rather than this turning it
   * into one.
   */
  function dashboardProvider(): ResourceProvider<unknown> {
    const base = tableProvider('dashboard', dashboardSpecSchema) as ResourceProvider<unknown>;
    return {
      ...base,
      create(input) {
        return base.create({ ...input, data: asDraft(input.data) });
      },
    };
  }

  /**
   * The task provider.
   *
   * A task is judged by the task contract, like every other kind: a task
   * that breaks it is a bad request, not a server fault. The contract is the
   * one the factory already publishes, so a task template that drifts is
   * caught when the server starts, and a task resource that does not satisfy
   * the contract is reported as invalid by an inspection.
   */
  function taskProvider(): ResourceProvider<unknown> {
    const toResource = (task: ReturnType<FactoryService['getTask']>, author: string): Resource => ({
      id: task.id,
      workspaceId: task.workspaceId,
      type: 'task',
      schemaVersion: 1,
      revision: task.revision,
      title: task.title,
      data: task,
      createdBy: author,
      updatedAt: new Date().toISOString(),
      templateId: task.templateId,
      templateVersion: task.templateVersion,
    });

    /** The author the task row records. A task nobody authored says `system`. */
    const authorOfTask = (id: string): string => factory.taskAuthor(id) ?? RESOURCE_AUTHOR_SYSTEM;

    const provider: ResourceProvider<unknown> = {
      type: 'task',
      validate(data: unknown) {
        const parsed = taskSpecSchema.safeParse(data);
        if (!parsed.success) {
          throw errors.validation(
            'This task does not satisfy the task contract.',
            parsed.error.issues,
          );
        }
        return parsed.data;
      },
      create(input) {
        const data = provider.validate(input.data) as {
          goalId?: string;
          description?: string;
          assigneeId?: string;
          acceptanceCriteria?: string[];
        };
        const task = factory.createTask({
          workspaceId: input.workspaceId,
          title: input.title,
          description: data.description ?? '',
          goalId: data.goalId,
          assigneeId: data.assigneeId,
          acceptanceCriteria: data.acceptanceCriteria ?? [],
          author: input.author,
          templateId: input.templateId,
          templateVersion: input.templateVersion,
        });
        return toResource(task, authorOf(input.author));
      },
      get(id) {
        return toResource(factory.getTask(id), authorOfTask(id));
      },
      update(id, patch) {
        const current = factory.getTask(id);
        if (current.revision !== patch.expectedRevision) {
          throw errors.revisionMismatch(patch.expectedRevision, current.revision);
        }
        const data = patch.data as { status?: string; description?: string } | undefined;
        const updated = factory.updateTask(id, {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(data?.description !== undefined ? { description: data.description } : {}),
          ...(data?.status !== undefined ? { status: data.status as never } : {}),
        });
        return toResource(updated, authorOfTask(id));
      },
    };
    return provider;
  }

  /**
   * The memory provider.
   *
   * A memory that breaks the contract is a bad request, not a server fault.
   * The clearest case is a scope of 'agent' that names no agent: the memory
   * would belong to nobody, and nobody would read it.
   */
  function memoryProvider(): ResourceProvider<MemorySpec> {
    const provider = tableProvider('memory', memorySpecSchema);
    return {
      ...provider,
      validate(data: unknown): MemorySpec {
        const parsed = memorySpecSchema.safeParse(data);
        if (!parsed.success) {
          throw errors.validation(
            'This memory does not satisfy the memory contract.',
            parsed.error.issues,
          );
        }
        return parsed.data;
      },
    };
  }

  const dashboardResourceProvider = dashboardProvider();
  const documentProvider = fileAwareDocumentProvider(tableProvider('document', documentSpecSchema));
  const dataSourceProvider = tableProvider('data-source', dataSourceSpecSchema);
  const memoryResourceProvider = memoryProvider();
  const automationResourceProvider = automationProvider();
  const taskResourceProvider = taskProvider();

  const providers = new Map<ResourceType, ResourceProvider<unknown>>([
    ['dashboard', dashboardResourceProvider as ResourceProvider<unknown>],
    ['document', documentProvider as ResourceProvider<unknown>],
    ['data-source', dataSourceProvider as ResourceProvider<unknown>],
    ['memory', memoryResourceProvider as ResourceProvider<unknown>],
    ['automation', automationResourceProvider as ResourceProvider<unknown>],
    ['task', taskResourceProvider as ResourceProvider<unknown>],
  ]);

  const providerFor = (type: ResourceType): ResourceProvider<unknown> => {
    const provider = providers.get(type);
    if (!provider) throw errors.badRequest(`Unsupported resource type "${type}".`);
    return provider;
  };

  /**
   * The registry of templates.
   *
   * The registry is the same for every workspace, and it is the one written in
   * the repository unless the caller brings its own.
   */
  const templates = options.templates ?? resourceTemplates;

  /**
   * Every template is checked against the provider that owns its kind, so a
   * template cannot drift into describing something the product would reject.
   * The check runs when the service is built, so a drifted template is caught
   * at the door rather than by an agent that reached for it.
   */
  assertTemplatesValid(templates, (type, spec) => {
    providerFor(type).validate(spec);
  });

  function resolveType(id: string): ResourceType {
    const row = tableRow(id);
    if (row) return row.type as ResourceType;
    const automation = db.select().from(automations).where(eq(automations.id, id)).get();
    if (automation) return 'automation';
    try {
      factory.getTask(id);
      return 'task';
    } catch {
      throw errors.notFound('Resource');
    }
  }

  const service: ResourceService = {
    list(workspaceId, type): Resource[] {
      const rows = db
        .select()
        .from(resourcesTable)
        .where(
          type
            ? and(eq(resourcesTable.workspaceId, workspaceId), eq(resourcesTable.type, type))
            : eq(resourcesTable.workspaceId, workspaceId),
        )
        .orderBy(desc(resourcesTable.updatedAt))
        .all()
        .map(toTableResource);

      const automationRows =
        type === 'automation' || type === undefined
          ? db
              .select()
              .from(automations)
              .where(eq(automations.workspaceId, workspaceId))
              .orderBy(desc(automations.updatedAt))
              .all()
              .map(toAutomationResource)
          : [];

      const taskRows =
        type === 'task' || type === undefined
          ? (() => {
              const authors = factory.taskAuthors(workspaceId);
              return factory.listTasks(workspaceId).map((task) => ({
                id: task.id,
                workspaceId: task.workspaceId,
                type: 'task' as ResourceType,
                schemaVersion: 1,
                revision: task.revision,
                title: task.title,
                data: task,
                createdBy: authors.get(task.id) ?? RESOURCE_AUTHOR_SYSTEM,
                updatedAt: new Date().toISOString(),
              }));
            })()
          : [];

      return [...rows, ...automationRows, ...taskRows];
    },

    get(id): Resource {
      return providerFor(resolveType(id)).get(id);
    },

    create(input): Resource {
      const provider = providerFor(input.type);
      const resource = provider.create({
        workspaceId: input.workspaceId,
        title: input.title,
        data: input.data,
        author: input.author,
        ...(input.template
          ? { templateId: input.template.id, templateVersion: input.template.version }
          : {}),
      });
      events.publish({ type: 'resource.updated', resource }, { workspaceId: resource.workspaceId });
      return resource;
    },

    update(id, patch): Resource {
      const resource = providerFor(resolveType(id)).update(id, {
        expectedRevision: patch.expectedRevision,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.data !== undefined ? { data: patch.data } : {}),
      });
      events.publish({ type: 'resource.updated', resource }, { workspaceId: resource.workspaceId });
      return resource;
    },

    publish(id): Resource {
      const type = resolveType(id);
      const current = providerFor(type).get(id);

      if (type === 'dashboard') {
        const data = dashboardSpecSchema.parse(current.data);
        return service.update(id, {
          expectedRevision: current.revision,
          data: { ...data, published: true },
        });
      }

      if (type === 'automation') {
        const automation = db.select().from(automations).where(eq(automations.id, id)).get();
        if (!automation) throw errors.notFound('Automation');
        validateAutomationConfig(automation.trigger, automation.action);
        db.update(automations)
          .set({
            enabled: true,
            nextRunAt: computeNextRun(automation.trigger, new Date()),
            revision: automation.revision + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(automations.id, id))
          .run();
        const updated = service.get(id);
        events.publish(
          { type: 'resource.updated', resource: updated },
          { workspaceId: updated.workspaceId },
        );
        return updated;
      }

      return current;
    },

    async execute(id): Promise<{ output: unknown }> {
      const type = resolveType(id);
      const current = providerFor(type).get(id);

      if (type === 'automation') {
        const automation = db.select().from(automations).where(eq(automations.id, id)).get();
        if (!automation) throw errors.notFound('Automation');
        queue.enqueue({
          workspaceId: automation.workspaceId,
          type: 'automation.run',
          payload: { automationId: automation.id },
        });
        return { output: { queued: true, automationId: automation.id } };
      }

      if (type === 'data-source') {
        const spec = dataSourceSpecSchema.parse(current.data);
        return { output: await runDataSource(db, spec, targetOptions) };
      }

      if (type === 'dashboard') {
        const spec = dashboardSpecSchema.parse(current.data);
        const results: Record<string, unknown> = {};
        for (const widget of spec.widgets) {
          if (!widget.dataSourceId) continue;
          const source = providerFor('data-source').get(widget.dataSourceId);
          const sourceSpec = dataSourceSpecSchema.parse(source.data);
          results[widget.id] = await runDataSource(db, sourceSpec, targetOptions);
        }
        return { output: results };
      }

      return { output: null };
    },

    inspect(id): { resource: Resource; valid: boolean; issues: string[] } {
      const type = resolveType(id);
      const resource = providerFor(type).get(id);
      const issues: string[] = [];
      try {
        providerFor(type).validate(resource.data);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
      return { resource, valid: issues.length === 0, issues };
    },

    templateList(type): ResourceTemplate[] {
      return listTemplates(templates, type);
    },

    templateGet(ref): ResourceTemplate {
      const template = findTemplate(templates, ref);
      if (!template) throw errors.notFound('Template');

      // The owning provider judges the spec, exactly as it judges the spec of
      // a resource. A template that describes something the product would
      // refuse is refused here, and not carried into the resource.
      try {
        providerFor(template.type).validate(template.spec);
      } catch (error) {
        throw errors.validation(
          `The template "${template.id}" does not satisfy the ${template.type} contract.`,
          { template: template.id, version: template.version, issues: templateIssues(error) },
        );
      }

      return template;
    },

    templateMerge(template, type, override): unknown {
      // A template starts one kind, and the kind it starts has to be the kind
      // the caller asked for: the spec of a document is not a dashboard.
      if (template.type !== type) {
        throw errors.validation(
          `The template "${template.id}" starts a ${template.type}, not a ${type}.`,
        );
      }

      return mergeTemplateSpec(type, template.spec, override);
    },

    authorshipCounts(workspaceId): { agentAuthored: number; total: number } {
      const rows = db
        .select({ createdBy: resourcesTable.createdBy })
        .from(resourcesTable)
        .where(eq(resourcesTable.workspaceId, workspaceId))
        .all();

      // The test is the id form, not a lookup: a connection that has since
      // been removed does not make the resources it authored owner-authored.
      const isAgentAuthored = (createdBy: string): boolean => createdBy.startsWith(AGENT_ID_FORM);
      const agentAuthored = rows.filter((row) => isAgentAuthored(row.createdBy)).length;

      // Automations and tasks keep the author they were created with. The rows
      // written before the author was recorded say `system`, and they are in
      // the total and never in the count.
      const automationRows = db
        .select({ createdBy: automations.createdBy })
        .from(automations)
        .where(eq(automations.workspaceId, workspaceId))
        .all();
      const taskAuthors = factory.taskAuthors(workspaceId);

      return {
        agentAuthored:
          agentAuthored +
          automationRows.filter((row) => isAgentAuthored(row.createdBy)).length +
          [...taskAuthors.values()].filter(isAgentAuthored).length,
        total: rows.length + automationRows.length + taskAuthors.size,
      };
    },
  };

  return service;
}

/**
 * How a kind is named in a sentence.
 *
 * The contract names a kind by its published name, and a sentence needs the
 * word rather than the slug.
 */
const kindNames: Record<ResourceType, string> = {
  dashboard: 'dashboard',
  document: 'document',
  'data-source': 'data source',
  automation: 'automation',
  memory: 'memory',
  task: 'task',
};

/**
 * A dashboard's spec, made a draft.
 *
 * `published` is forced false on a spec that is an object, so a dashboard is
 * never born live however it was asked for. A spec that is not an object is
 * left exactly as it arrived, so the schema refuses it rather than this
 * quietly turning it into one.
 */
function asDraft(data: unknown): unknown {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return data;
  return { ...(data as Record<string, unknown>), published: false };
}

/**
 * Parse a spec against the contract that owns it, and refuse the way the
 * product refuses.
 *
 * A spec that breaks its contract is a bad request, not a server fault: the
 * caller sent something the contract does not allow, so the answer says so
 * and carries the schema's own issues. The task and the memory provider
 * already refuse this way, and the four that answered a broken spec with a
 * server fault are brought into line with them.
 */
function parseSpec<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  type: ResourceType,
): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw errors.validation(
      `This ${kindNames[type]} does not satisfy the ${type} contract.`,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

/** Validate an automation configuration before it can be enabled. */
export function validateAutomationConfig(
  trigger: AutomationTrigger,
  action: AutomationAction,
): void {
  if (trigger.type === 'schedule' && !trigger.cron && !trigger.everyMinutes) {
    throw errors.validation('A schedule trigger needs either a cron expression or an interval.');
  }
  if (trigger.type === 'event' && !trigger.event) {
    throw errors.validation('An event trigger needs an event name.');
  }
  if (trigger.type === 'event' && trigger.event && !isTriggerableEventType(trigger.event)) {
    throw errors.validation(
      `"${trigger.event}" cannot be used as a trigger. Allowed events: ${triggerableEventTypes.join(', ')}.`,
    );
  }
  if (action.type === 'agent.prompt' && !action.agentConnectionId) {
    throw errors.validation('An agent.prompt action needs an agent connection.');
  }
  if (action.type === 'resource.refresh' && !action.resourceId) {
    throw errors.validation('A resource.refresh action needs a resource id.');
  }
  if (action.type === 'http.request' && !action.url) {
    throw errors.validation('An http.request action needs a URL.');
  }
}

/** Execute a data source and return its rows. */
async function runDataSource(
  db: Database,
  spec: z.infer<typeof dataSourceSpecSchema>,
  options: { allowPrivateTargets?: boolean } = {},
): Promise<unknown> {
  if (spec.kind === 'json') return spec.payload ?? null;

  if (spec.kind === 'http') {
    if (!spec.url) throw errors.validation('The HTTP data source needs a URL.');
    assertSafeUrl(spec.url, { allowPrivateTargets: options.allowPrivateTargets });
    const response = await fetch(spec.url, { headers: spec.headers });
    if (!response.ok) throw errors.badRequest(`Data source returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('application/json') ? await response.json() : await response.text();
  }

  if (spec.kind === 'sqlite') {
    if (!spec.query) throw errors.validation('The SQLite data source needs a query.');
    assertReadableQuery(spec.query);
    return db.all(sql.raw(spec.query));
  }

  throw errors.badRequest('Unsupported data source kind.');
}

/**
 * A document that is a file.
 *
 * A document is normally text. A file the owner uploaded is a document whose
 * data says what the file is — its name, its content type, its size — and
 * nothing else. The bytes live on the server, and the row that points at them
 * lives in `resource_files`, so the browser never learns where they are.
 */
export const fileDocumentSpecSchema = z.object({
  kind: z.literal('file'),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().min(0),
});
export type FileDocumentSpec = z.infer<typeof fileDocumentSpecSchema>;

/** Whether a document's data describes a file rather than text. */
export function isFileDocument(data: unknown): data is FileDocumentSpec {
  return typeof data === 'object' && data !== null && (data as { kind?: unknown }).kind === 'file';
}

/**
 * The document provider, taught about files.
 *
 * A document is text, or it is a file the owner uploaded, and the two are
 * told apart by the `kind` the data carries. A file's data is judged by the
 * file's own contract, and everything else is judged by the document's, so a
 * text document is exactly what it always was.
 */
function fileAwareDocumentProvider(base: ResourceProvider<unknown>): ResourceProvider<unknown> {
  return {
    ...base,
    validate(data: unknown) {
      if (!isFileDocument(data)) return base.validate(data);

      const parsed = fileDocumentSpecSchema.safeParse(data);
      if (!parsed.success) {
        throw errors.validation(
          'This document does not satisfy the document contract.',
          parsed.error.issues,
        );
      }
      return parsed.data;
    },
  };
}
