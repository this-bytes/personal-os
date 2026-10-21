import { z } from 'zod';
import type { ResourceTemplate, ResourceTemplateRef, ResourceType } from '@personal-os/contracts';
import { errors } from '../../lib/errors.js';

/**
 * The template registry.
 *
 * A template is a named, versioned example of one resource kind, with its
 * spec, that an agent can start from. It answers a question a schema cannot:
 * a schema is a type, and a template is an example that was written, reviewed
 * and shipped.
 *
 * Templates are authored here, in the repository, and reviewed like code.
 * There is no editor in the panel and no route or tool that creates one, and
 * the registry is the same for every workspace — a template is not scoped to
 * one.
 *
 * The set that ships is one template for each of the six resource kinds, which
 * is the owner's answer of 2026-10-21, recorded in `docs/strategy.md`.
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
  },
];

/**
 * The templates published for one kind.
 *
 * One row per template: the newest published version of each. An older
 * version is still a template an agent can name — it asks for that version by
 * number — but the list is what is current, and a list that carried every
 * version of every template would show the same template twice.
 */
export function listTemplates(
  templates: readonly ResourceTemplate[],
  type: ResourceType,
): ResourceTemplate[] {
  const newest = new Map<string, ResourceTemplate>();
  for (const template of templates) {
    if (template.type !== type) continue;
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
  return error instanceof Error ? error.message : String(error);
}
