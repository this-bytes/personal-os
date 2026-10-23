import { z } from 'zod/v3';
import type { ResourceTemplate, ResourceTemplateRef, ResourceType } from '@personal-os/contracts';
import { errors, AppError } from '../../lib/errors.js';

/**
 * The template registry.
 *
 * A template is a named, versioned example of one resource kind, with its
 * spec and the guide that says what a good one of that kind is, that an agent
 * can start from. It answers a question a schema cannot: a schema is a type,
 * and a template is an example that was written, reviewed and shipped.
 *
 * Templates are authored here, in the repository, and reviewed like code.
 * There is no editor in the panel and no route or tool that creates one, and
 * the registry is the same for every workspace — a template is not scoped to
 * one.
 *
 * The set that ships is one template for each of the six resource kinds, which
 * remains the supported baseline; see `docs/resource-templates.md`.
 */
export const resourceTemplates: ResourceTemplate[] = [
  {
    id: 'dashboard.metrics',
    version: 1,
    type: 'dashboard',
    title: 'A dashboard of one count and one table',
    description:
      'A dashboard that reads one data source: a count on top, the records underneath, refreshed every minute. The agent adds the id of its own data source to each widget.',
    spec: {
      widgets: [
        {
          id: 'summary',
          type: 'metric',
          title: 'Records',
          binding: { kind: 'aggregate', field: 'id', aggregate: 'count' },
        },
        {
          id: 'recent',
          type: 'table',
          title: 'Recent records',
          binding: { kind: 'raw', limit: 20 },
        },
      ],
      refreshSeconds: 60,
      published: false,
    },
    guide: {
      summary:
        'A dashboard that reads one data source: a count on top, the records underneath, refreshed every minute. It is the shape to start from when the question is how much and how recent.',
      whenToUse: [
        'You have one data source and the question is a count plus the recent records.',
        'You are making a first dashboard and do not yet know the question well enough to design widgets for it.',
      ],
      whenNotToUse: [
        'The answer needs a trend over time. A metric widget is a count, not a curve; that is a chart widget.',
        'The data lives in more than one data source. This template reads one.',
      ],
      fields: [
        {
          path: 'widgets[].dataSourceId',
          what: 'The data source this widget reads. The template leaves it empty, so every widget is unbound until you set it.',
          mustSet: true,
        },
        {
          path: 'widgets[].binding.field',
          what: 'The field the count aggregates. `id` counts records; name a column to count something else.',
          mustSet: false,
        },
        {
          path: 'widgets[].binding.limit',
          what: 'How many rows the table shows. The template sets 20.',
          mustSet: false,
        },
        {
          path: 'refreshSeconds',
          what: 'How often the dashboard reloads. Sixty is fine for most.',
          mustSet: false,
        },
        {
          path: 'published',
          what: 'False, and the template keeps it false. A dashboard becomes live when it is published, which is a separate act.',
          mustSet: false,
        },
      ],
      mistakes: [
        'An unbound widget renders empty and reads as broken. Bind every widget to a data source that exists.',
        'A metric widget counts. It does not show a trend, and a table of twenty rows is not a chart.',
        'A title that says "Records" when the metric counts a different field is a lie the panel cannot catch.',
      ],
      checklist: [
        'Every widget names a data source that exists, and every one of them is bound.',
        'The metric counts the thing its title says it counts.',
        'The dashboard is not published. Publishing is a separate act.',
      ],
    },
  },
  {
    id: 'document.brief',
    version: 1,
    type: 'document',
    title: 'A brief, written in markdown',
    description:
      'A written brief: what the document is for, what good looks like, and what was decided. The agent writes its own content into the same shape.',
    spec: {
      format: 'markdown',
      content:
        '# Title\n\nWhat this document is for, in one paragraph.\n\n## What good looks like\n\n- The first thing a reader should take away.\n- The second thing.\n',
      tags: ['brief'],
    },
    guide: {
      summary:
        'A written brief: what the document is for, what good looks like, and what was decided. It is the shape to start from when the answer is prose somebody will read later, without you there to explain it.',
      whenToUse: [
        'The output is prose: a brief, a write-up, a decision record.',
        'Somebody will read this later and will not have the conversation.',
      ],
      whenNotToUse: [
        'The output is a number or a row. That is a dashboard or a data source.',
        'The reader wants only the conclusion. That is a summary, and a summary is a different thing from a brief.',
      ],
      fields: [
        {
          path: 'content',
          what: 'The document itself. The template’s headings are the shape: what this is for, what good looks like, what was decided. Replace the placeholder text and keep the headings.',
          mustSet: true,
        },
        {
          path: 'format',
          what: '`markdown`, unless the reader needs blocks.',
          mustSet: false,
        },
        {
          path: 'tags',
          what: 'How the document is found later. The template’s `brief` is an example of the label, not a rule.',
          mustSet: false,
        },
      ],
      mistakes: [
        'A brief that opens with method and closes with no conclusion costs its reader twice.',
        'An empty heading is worse than no heading. If a section has nothing under it, take the heading out.',
        'Writing it once and never reading it again is how a brief goes stale.',
      ],
      checklist: [
        'The first paragraph says what this is for, in one paragraph.',
        'Every claim under what was decided is one a reader could check.',
        'It is written for somebody who was not in the conversation.',
      ],
    },
  },
  {
    id: 'data-source.json',
    version: 1,
    type: 'data-source',
    title: 'A data source that carries its own rows',
    description:
      'A data source whose rows are an inline JSON payload: no URL, no secret, nothing to fetch. The agent replaces the payload with its own rows.',
    spec: {
      kind: 'json',
      payload: [
        { id: 'first', name: 'First record' },
        { id: 'second', name: 'Second record' },
      ],
      headers: {},
    },
    guide: {
      summary:
        'A data source whose rows are an inline JSON payload: no URL, no secret, nothing to fetch. It is the shape to start from when the data is small and yours to write.',
      whenToUse: [
        'The data is small, it is yours to write, and it should not be fetched from anywhere.',
        'You are carrying rows out of a conversation into something structured.',
      ],
      whenNotToUse: [
        'The data is large. An inline payload is read and held whole.',
        'The data is somebody else’s and changes on its own. That is an http data source.',
        'The rows contain a secret. A secret belongs in a credential, and a credential never belongs in a payload.',
      ],
      fields: [
        {
          path: 'payload',
          what: 'The rows. An array of objects, every row with the same keys. Replace the two example rows with yours.',
          mustSet: true,
        },
        {
          path: 'kind',
          what: '`json`, for an inline payload.',
          mustSet: false,
        },
        {
          path: 'headers',
          what: 'Empty, and it stays empty. A secret never goes here.',
          mustSet: false,
        },
      ],
      mistakes: [
        'Rows with different keys make a table that renders blanks. Give every row the same keys.',
        'A token in a payload is a token published to whoever can read the resource.',
        'A payload that is really a log is a data source with a leak in it.',
      ],
      checklist: [
        'Every row has the same keys.',
        'No credential, token, or personal identifier is in the payload.',
        'It is two rows or two thousand — a size the panel can render.',
      ],
    },
  },
  {
    id: 'automation.manual-prompt',
    version: 1,
    type: 'automation',
    title: 'An automation that asks an agent, on demand',
    description:
      'An automation: a trigger, an authorised action and whether it runs. This one waits for a person to trigger it and then asks an agent, so it does nothing on its own. The agent replaces the agent connection id with one of its own before it publishes the automation.',
    spec: {
      trigger: { type: 'manual' },
      action: {
        type: 'agent.prompt',
        agentConnectionId: 'agt_example',
        prompt: 'Summarise what changed since the last run.',
      },
      enabled: false,
    },
    guide: {
      summary:
        'An automation: a trigger, an authorised action, and whether it runs. This one waits for a person to trigger it and then asks an agent, so it does nothing on its own.',
      whenToUse: [
        'You want an agent to do something on a schedule, on an event, or on demand.',
        'The action is ask an agent to do X — the agent does the thinking.',
      ],
      whenNotToUse: [
        'The action is mechanical: a fetch, a write. That is an http action, not an agent prompt.',
        'You want it running unattended right now. This template is disabled and manual on purpose.',
      ],
      fields: [
        {
          path: 'action.agentConnectionId',
          what: 'Which agent connection answers the prompt. The template’s value is a placeholder and names nothing that exists; replace it with one of yours.',
          mustSet: true,
        },
        {
          path: 'action.prompt',
          what: 'What the agent is asked to do, in a sentence or two. Say what to produce, not how to think about it.',
          mustSet: true,
        },
        {
          path: 'trigger',
          what: '`manual` waits for a person. Change it to a schedule or an event only when the action is safe to run unattended.',
          mustSet: false,
        },
        {
          path: 'enabled',
          what: 'False, and the template keeps it false. Enabling an automation is a separate, deliberate act.',
          mustSet: false,
        },
      ],
      mistakes: [
        'Leaving the placeholder connection id gives you an automation that fails on its first run, quietly, because it is disabled.',
        'An event trigger that wakes another automation is how two automations keep each other awake forever.',
        'A prompt that describes a process instead of an outcome gives the agent a job rather than a result.',
      ],
      checklist: [
        'The connection id is one of yours, and that connection is enabled.',
        'The trigger matches how often you actually want this.',
        'The automation is still disabled. Enabling it is a separate, deliberate act.',
      ],
    },
  },
  {
    id: 'task.deliverable',
    version: 1,
    type: 'task',
    title: 'A task with acceptance criteria',
    description:
      'A factory task: what has to be true when it is done, stated as checks a reader can verify for themselves. The agent adds the goal and the assignee from its own workspace.',
    spec: {
      description: 'One paragraph: what has to be true when this task is done.',
      acceptanceCriteria: [
        'The first check, stated as a fact a reader can verify.',
        'The second check, stated as a fact a reader can verify.',
      ],
    },
    guide: {
      summary:
        'A factory task: what has to be true when it is done, stated as checks a reader can verify for themselves. It is the shape to start from when the work has an outcome somebody checks.',
      whenToUse: [
        'The work has an outcome, and somebody is going to check it.',
        'More than one thing has to be true before it is finished.',
      ],
      whenNotToUse: [
        'The work is a conversation. Then it is a message, not a task.',
        'Nobody is going to check it. Then it is a note, and a memory item is the right kind.',
      ],
      fields: [
        {
          path: 'acceptanceCriteria',
          what: 'What has to be true when this is done. One check per line, each one a fact a reader can verify without asking you.',
          mustSet: true,
        },
        {
          path: 'description',
          what: 'One paragraph: what has to be true when this task is done.',
          mustSet: true,
        },
        {
          path: 'goalId',
          what: 'The goal this work serves, if it serves one. Name a goal that exists in your own workspace.',
          mustSet: false,
        },
        {
          path: 'assigneeId',
          what: 'Who does the work. Name an agent connection that exists in your own workspace.',
          mustSet: false,
        },
      ],
      mistakes: [
        'A criterion nobody can check without asking the author is a wish, not a check.',
        'Works and is correct are not criteria. Name the observable thing.',
        'Reporting completion is not acceptance. The task moves to review, and a person closes it.',
      ],
      checklist: [
        'Every criterion is checkable by somebody who was not in the conversation.',
        'The task names a goal and an assignee that exist.',
        'Nothing here says it is done, because it is not until it is accepted.',
      ],
    },
  },
  {
    id: 'memory.decision-note',
    version: 1,
    type: 'memory',
    title: 'A memory that records a decision',
    description:
      'A memory: a scope, a key, the memory itself and its tags. This one is scoped to the workspace and records a decision together with the reason for it.',
    spec: {
      scope: 'workspace',
      key: 'notes.decision',
      value: { decision: '', why: '' },
      tags: ['decision'],
    },
    guide: {
      summary:
        'A memory: a scope, a key, the memory itself and its tags. This one is scoped to the workspace and records a decision together with the reason for it.',
      whenToUse: [
        'A decision was made and the reason matters more than the outcome.',
        'Something has to be true in six months and nobody will remember why.',
      ],
      whenNotToUse: [
        'The fact is a record, not a decision. That is a data source.',
        'Only one agent should ever read it. Then the scope is `agent`, not `workspace`.',
      ],
      fields: [
        {
          path: 'value.decision',
          what: 'What was decided, in one sentence, in the present tense.',
          mustSet: true,
        },
        {
          path: 'value.why',
          what: 'Why it was decided. This is the part worth keeping; the decision alone can be re-derived.',
          mustSet: true,
        },
        {
          path: 'key',
          what: 'A stable, dot-separated name. The same key means the same memory, always.',
          mustSet: true,
        },
        {
          path: 'scope',
          what: '`workspace` for a shared fact. `agent` if only one agent should read it.',
          mustSet: false,
        },
        {
          path: 'agentConnectionId',
          what: 'The agent this memory belongs to. Required the moment you set the scope to `agent`.',
          mustSet: false,
        },
        {
          path: 'tags',
          what: 'How it is found later. The template’s `decision` is an example of the label.',
          mustSet: false,
        },
      ],
      mistakes: [
        'A memory without a reason is a rule nobody can check, and it will be followed wrongly.',
        'A key that changes meaning is a new memory wearing an old name, and the old one stays.',
        'Storing a fact the product can derive is how a memory goes stale without anyone noticing.',
      ],
      checklist: [
        'The key is dot-separated and stable.',
        'The reason is written, not implied.',
        'The scope matches who should read it.',
      ],
    },
  },
];

/**
 * The templates published for one kind — or for every kind.
 *
 * One row per template: the newest published version of each. An older
 * version is still a template an agent can name — it asks for that version by
 * number — but the list is what is current, and a list that carried every
 * version of every template would show the same template twice.
 */
export function listTemplates(
  templates: readonly ResourceTemplate[],
  type?: ResourceType,
): ResourceTemplate[] {
  const newest = new Map<string, ResourceTemplate>();
  for (const template of templates) {
    if (type && template.type !== type) continue;
    const current = newest.get(template.id);
    if (!current || template.version > current.version) newest.set(template.id, template);
  }
  return [...newest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * One template, by reference.
 *
 * A version names one reviewed spec of a template; without one, the newest
 * published version is meant.
 */
export function findTemplate(
  templates: readonly ResourceTemplate[],
  ref: ResourceTemplateRef,
): ResourceTemplate | undefined {
  const matches = templates.filter((template) => template.id === ref.id);
  if (ref.version === undefined) {
    return matches.reduce<ResourceTemplate | undefined>(
      (newest, template) => (!newest || template.version > newest.version ? template : newest),
      undefined,
    );
  }
  return matches.find((template) => template.version === ref.version);
}

/**
 * Check every template against the provider that owns its kind.
 *
 * The owning provider judges a template's spec exactly as it judges a
 * resource's spec, so a template cannot drift into describing something the
 * product would reject. A drifted template is a defect in the repository
 * rather than a condition of the world, so it is caught when the server
 * starts, and not left to be found by an agent that reached for it.
 */
export function assertTemplatesValid(
  templates: readonly ResourceTemplate[],
  validate: (type: ResourceType, spec: unknown) => void,
): void {
  for (const template of templates) {
    try {
      validate(template.type, template.spec);
    } catch (error) {
      throw errors.validation(
        `The template "${template.id}" (version ${template.version}) does not satisfy the ${template.type} contract.`,
        { template: template.id, version: template.version, issues: templateIssues(error) },
      );
    }
  }
}

/** What a provider said was wrong with a spec. */
export function templateIssues(error: unknown): unknown {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  }
  // A provider that refuses a broken spec reports the schema's own issues in
  // the error's details, so the refusal carries the same list whether the
  // provider threw a schema error or the product's own validation error.
  if (error instanceof AppError && Array.isArray(error.details)) {
    return error.details.map((issue) => {
      const detail = issue as { path?: unknown; message?: unknown };
      return {
        path: Array.isArray(detail.path) ? detail.path.join('.') : String(detail.path ?? ''),
        message: typeof detail.message === 'string' ? detail.message : String(detail.message),
      };
    });
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * How one kind merges a template's spec with the caller's values.
 *
 * The merge is not a judge. It merges, and the owning provider judges the
 * result exactly as it judges a spec that arrived whole.
 */
interface MergeRules {
  /**
   * The key that chooses the shape of the whole spec. When the caller's value
   * for that key differs from the template's, the spec is replaced rather
   * than merged: a data source that becomes `http` keeps no inline payload.
   */
  shapeKey?: string;
  /**
   * Paths whose value is the caller's, whole, rather than merged into the
   * template's. An object named here is replaced; a string or an array
   * named here is replaced anyway.
   */
  replace: string[];
  /**
   * Arrays that merge by a key inside each element. A dashboard's widgets
   * merge by the widget's own id, because that id is the product's key.
   */
  keyedArrays: { path: string; key: string; shapeKey?: string }[];
}

/** The merge rules, per kind. */
const mergeRules: Record<ResourceType, MergeRules> = {
  dashboard: {
    replace: [],
    keyedArrays: [{ path: 'widgets', key: 'id', shapeKey: 'type' }],
  },
  document: { replace: [], keyedArrays: [] },
  'data-source': { shapeKey: 'kind', replace: [], keyedArrays: [] },
  // A trigger and an action are chosen by their own type, and an automation
  // names both whole: the caller who names one means that one.
  automation: { replace: ['trigger', 'action'], keyedArrays: [] },
  task: { replace: [], keyedArrays: [] },
  // A memory's scope chooses its shape, and its value is the memory itself.
  memory: { shapeKey: 'scope', replace: ['value'], keyedArrays: [] },
};

/** Is this a plain object rather than an array or a null? */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The template's spec with the caller's values merged into it.
 *
 * The merge never refuses. It merges, and the provider judges the result.
 */
export function mergeTemplateSpec(
  type: ResourceType,
  templateSpec: unknown,
  override: unknown,
): unknown {
  const rules = mergeRules[type];
  if (!rules) return override;

  // A change of shape key replaces the spec rather than merging it. The
  // caller's own value of the key decides: a caller who says nothing about
  // the shape keeps the template's.
  if (rules.shapeKey && isPlainObject(templateSpec) && isPlainObject(override)) {
    if (
      Object.hasOwn(override, rules.shapeKey) &&
      templateSpec[rules.shapeKey] !== override[rules.shapeKey]
    ) {
      return override;
    }
  }

  return mergeValue(templateSpec, override, rules, '');
}

/** Merge one value into the template's value at that path. */
function mergeValue(base: unknown, override: unknown, rules: MergeRules, path: string): unknown {
  if (override === undefined) return base;
  if (rules.replace.includes(path)) return override;

  const keyed = rules.keyedArrays.find((entry) => entry.path === path);
  if (keyed && Array.isArray(base) && Array.isArray(override)) {
    return mergeKeyedArray(base, override, keyed, rules, path);
  }

  // An array is a single choice, and merging it would produce neither thing.
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeValue(base[key], value, rules, path ? `${path}.${key}` : key);
  }
  return merged;
}

/**
 * Merge an array by the key inside each element.
 *
 * An element the caller names by the same key is updated field by field; an
 * element the caller does not name survives; an element the caller adds is
 * appended after the template's.
 */
function mergeKeyedArray(
  base: unknown[],
  override: unknown[],
  entry: { key: string; shapeKey?: string },
  rules: MergeRules,
  path: string,
): unknown[] {
  const merged: unknown[] = [];
  const taken = new Set<number>();

  for (const element of base) {
    const index = override.findIndex((candidate) => sameKey(candidate, element, entry.key));
    if (index === -1) {
      merged.push(element);
      continue;
    }
    taken.add(index);
    merged.push(mergeElement(element, override[index], entry, rules, path));
  }

  for (const [index, candidate] of override.entries()) {
    if (!taken.has(index)) merged.push(candidate);
  }

  return merged;
}

/** Do these two elements carry the same value for that key? */
function sameKey(candidate: unknown, element: unknown, key: string): boolean {
  if (!isPlainObject(candidate) || !isPlainObject(element)) return false;
  if (candidate[key] === undefined || element[key] === undefined) return false;
  return candidate[key] === element[key];
}

/**
 * Merge one element of a keyed array.
 *
 * An element whose shape key changed is the caller's, whole: a widget that
 * stops being a metric is not a metric with different settings. A caller who
 * says nothing about the shape keeps the element's shape.
 */
function mergeElement(
  base: unknown,
  override: unknown,
  entry: { shapeKey?: string },
  rules: MergeRules,
  path: string,
): unknown {
  if (entry.shapeKey && isPlainObject(base) && isPlainObject(override)) {
    if (
      Object.hasOwn(override, entry.shapeKey) &&
      base[entry.shapeKey] !== override[entry.shapeKey]
    ) {
      return override;
    }
  }
  return mergeValue(base, override, rules, `${path}[]`);
}
