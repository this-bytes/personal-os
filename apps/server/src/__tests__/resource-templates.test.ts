import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ResourceTemplate } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { tasks } from '../db/schema.js';
import { findTemplate, resourceTemplates } from '../modules/resources/templates.js';

/**
 * A template tells an agent what a good resource looks like.
 *
 * The contract publishes the shape in `### The template record`: a template is
 * a named, versioned example of one resource kind, with its spec and the guide
 * that says what a good one of that kind is, that an agent can start from;
 * `resource.template.list` lists the templates and `resource.template.get`
 * reads one in full; `resource.create` takes one optional `template` input and
 * merges the values it is given into the template's spec; the spec of a
 * template is validated by the owning provider exactly as a resource's spec
 * is; and a resource made from a template records where it came from.
 *
 * This file holds the behaviour to those published shapes, through the MCP
 * surface an agent actually uses.
 *
 * The refusal cases matter as much as the happy one. A check that cannot fail
 * is worse than no check, so each refusal here names the answer the contract
 * publishes — `not_found` for an unknown template, `validation_failed` for a
 * template of the wrong kind, and for a template whose spec the provider
 * refuses — and each one proves that nothing was created.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let agentToken = '';
let agentConnectionId = '';

interface ToolCall {
  isError: boolean;
  value: {
    code?: string;
    message?: string;
    details?: unknown;
    [key: string]: unknown;
  };
}

async function mcp(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method, params },
  });
  return response.body;
}

/** The result of a tool call, out of the JSON-RPC envelope. */
function toolCall(body: string): ToolCall {
  const payload = body.trimStart().startsWith('{')
    ? body
    : (/data:\s*(\{.*\})/s.exec(body)?.[1] ?? '');
  if (!payload) throw new Error(`no tool result in the response:\n${body}`);
  const envelope = JSON.parse(payload) as {
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
  };
  const text = envelope.result?.content?.[0]?.text ?? '{}';
  return { isError: envelope.result?.isError === true, value: JSON.parse(text) };
}

async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCall> {
  return toolCall(await mcp(token, 'tools/call', { name, arguments: args }));
}

async function listResources(): Promise<{ id: string; title: string; type: string }[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/resources?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  return response.json().resources as { id: string; title: string; type: string }[];
}

/** The audit trail, as `action:targetType` pairs, newest first. */
async function auditTrail(): Promise<string[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/audit?workspaceId=${workspaceId}&limit=200`,
    headers: { cookie: sessionCookie },
  });
  const entries = response.json().entries as { action: string; targetType: string | null }[];
  return entries.map((entry) => `${entry.action}:${entry.targetType ?? ''}`);
}

/** What a create added to the trail, compared with what was there before. */
function added(before: string[], after: string[]): string[] {
  const seen = new Set(before);
  return after.filter((entry) => !seen.has(entry));
}

/**
 * A template whose spec the owning provider refuses.
 *
 * The dashboard spec carries a widget of a kind that does not exist and a
 * refresh interval below zero, so the provider rejects it twice over: this
 * spec cannot be mistaken for a good one.
 */
const driftedTemplate: ResourceTemplate = {
  id: 'drifted.dashboard',
  version: 1,
  type: 'dashboard',
  title: 'A dashboard that does not satisfy the contract',
  description: 'A drifted template, published by mistake, for the refusal cases below.',
  spec: {
    widgets: [{ id: 'summary', type: 'gauge', title: 'Records' }],
    refreshSeconds: -5,
  },
  guide: {
    summary: 'A drifted template, published by mistake, for the refusal cases below.',
    whenToUse: ['Never. It is here to be refused.'],
    whenNotToUse: ['Always.'],
    fields: [],
    mistakes: [],
    checklist: [],
  },
};

/**
 * A task template whose spec breaks the task contract.
 *
 * The goal is not an id, so the task contract refuses it. The template is
 * published by mistake, for the case below.
 */
const driftedTaskTemplate: ResourceTemplate = {
  id: 'drifted.task',
  version: 1,
  type: 'task',
  title: 'A task that does not satisfy the contract',
  description: 'A drifted task template, published by mistake, for the refusal cases below.',
  spec: {
    description: 'One paragraph: what has to be true when this task is done.',
    acceptanceCriteria: ['The first check.'],
    goalId: 42,
  },
  guide: {
    summary: 'A drifted task template, published by mistake, for the refusal cases below.',
    whenToUse: ['Never. It is here to be refused.'],
    whenNotToUse: ['Always.'],
    fields: [],
    mistakes: [],
    checklist: [],
  },
};

/**
 * The one template published for a kind.
 *
 * The set that ships is one template per kind, so a kind that publishes none
 * or several is a change the tests are here to notice.
 */
function theTemplate(templates: ResourceTemplate[], kind: string): ResourceTemplate {
  expect(templates, `the ${kind} kind published no template`).toHaveLength(1);
  const [template] = templates;
  if (!template) throw new Error(`no template published for ${kind}`);
  return template;
}

async function withDriftedTemplate<T>(run: () => Promise<T>): Promise<T> {
  resourceTemplates.push(driftedTemplate);
  try {
    return await run();
  } finally {
    const index = resourceTemplates.indexOf(driftedTemplate);
    if (index !== -1) resourceTemplates.splice(index, 1);
  }
}

/**
 * A second version of a template, published beside the first.
 *
 * A version bump is a new row: the old row is never edited and never
 * removed, and a resource made from the old one is a copy rather than a
 * link.
 */
const secondVersion: ResourceTemplate = {
  ...findTemplate(resourceTemplates, { id: 'document.brief' })!,
  version: 2,
  description:
    'A written brief: what the document is for, what good looks like, and what was decided. The second version, published beside the first.',
  spec: {
    format: 'markdown',
    content: '# Title\n\nWhat this document is for, in one paragraph.\n',
    tags: ['brief', 'second'],
  },
  guide: {
    summary: 'The second version of the brief, published beside the first.',
    whenToUse: ['Never in this test. It is here to be published.'],
    whenNotToUse: ['Always in this test.'],
    fields: [],
    mistakes: [],
    checklist: [],
  },
};

async function withSecondVersion<T>(run: () => Promise<T>): Promise<T> {
  resourceTemplates.push(secondVersion);
  try {
    return await run();
  } finally {
    const index = resourceTemplates.indexOf(secondVersion);
    if (index !== -1) resourceTemplates.splice(index, 1);
  }
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-templates-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'template-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const setup = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setup.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  workspaceId = workspaces.json().workspaces[0].id as string;

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, name: 'Template reader', adapterType: 'echo', config: { reply: 'hi' } },
  });
  agentConnectionId = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${agentConnectionId}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });
  agentToken = token.json().token as string;
});

afterAll(async () => {
  await app.close();
});

describe('a template tells an agent what a good resource looks like', () => {
  it('publishes one template for each of the six resource kinds', async () => {
    const kinds = ['dashboard', 'document', 'automation', 'data-source', 'task', 'memory'];
    const published: { kind: string; id: string; version: number }[] = [];

    for (const kind of kinds) {
      const call = await callTool(agentToken, 'resource.template.list', { type: kind });
      expect(call.isError, `listing the ${kind} templates failed`).toBe(false);

      const templates = call.value as unknown as ResourceTemplate[];
      expect(templates, `the ${kind} kind published no template`).toHaveLength(1);

      const template = theTemplate(templates, kind);
      expect(template.id).toBeTruthy();
      expect(template.version).toBe(1);
      expect(template.type).toBe(kind);
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.spec).toBeTypeOf('object');

      published.push({ kind, id: template.id, version: template.version });
    }

    // The set that ships is the owner's answer: one template for each of the
    // six kinds. The names are pinned, so a template cannot quietly be
    // replaced by another.
    expect(published.map((entry) => entry.id).sort()).toEqual([
      'automation.manual-prompt',
      'dashboard.metrics',
      'data-source.json',
      'document.brief',
      'memory.decision-note',
      'task.deliverable',
    ]);
  });

  it('lists only the templates of the kind that was asked for', async () => {
    const call = await callTool(agentToken, 'resource.template.list', { type: 'document' });
    expect(call.isError).toBe(false);
    const templates = call.value as unknown as ResourceTemplate[];
    expect(templates.every((template) => template.type === 'document')).toBe(true);
  });

  it('creates a resource from a template that validates and lands as an ordinary resource', async () => {
    const listed = await callTool(agentToken, 'resource.template.list', { type: 'document' });
    const template = theTemplate(listed.value as unknown as ResourceTemplate[], 'document');

    const created = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'A brief for the review',
      template: { id: template.id },
    });
    expect(created.isError, `creating from a template failed: ${created.value.message}`).toBe(
      false,
    );

    const resource = created.value as unknown as {
      id: string;
      workspaceId: string;
      type: string;
      schemaVersion: number;
      revision: number;
      title: string;
      data: Record<string, unknown>;
      createdBy: string;
    };

    // The same fields, the same values and the same revision as any other
    // resource: a template is a starting point, not a different kind of thing.
    expect(resource.id).toBeTruthy();
    expect(resource.type).toBe('document');
    expect(resource.schemaVersion).toBe(1);
    expect(resource.revision).toBe(1);
    expect(resource.title).toBe('A brief for the review');
    expect(resource.workspaceId).toBe(workspaceId);
    expect(resource.createdBy).toBe(agentConnectionId);

    // The template's spec is the resource's data, and the provider's own
    // parsing of it, defaults and all.
    expect(resource.data.format).toBe('markdown');
    expect(resource.data.content).toBe((template.spec as { content: string }).content);
    expect(resource.data.tags).toEqual((template.spec as { tags: string[] }).tags);

    // It is an ordinary resource, so the owner sees it in the ordinary place.
    const read = await app.inject({
      method: 'GET',
      url: `/api/resources/${resource.id}`,
      headers: { cookie: sessionCookie },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().resource.id).toBe(resource.id);
    expect(read.json().resource.revision).toBe(1);

    const listed2 = await listResources();
    expect(listed2.some((entry) => entry.id === resource.id)).toBe(true);
  });

  it('creates the same resource from a template as from its spec', async () => {
    const listed = await callTool(agentToken, 'resource.template.list', { type: 'document' });
    const template = theTemplate(listed.value as unknown as ResourceTemplate[], 'document');

    const fromTemplate = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'The same brief',
      template: { id: template.id },
    });
    const fromSpec = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'The same brief',
      data: template.spec,
    });

    expect(fromTemplate.isError).toBe(false);
    expect(fromSpec.isError).toBe(false);

    const templateResource = fromTemplate.value as Record<string, unknown>;
    const specResource = fromSpec.value as Record<string, unknown>;

    // Everything the resource publishes, except the identity it was given and
    // the template it came from.
    const without = (resource: Record<string, unknown>) => {
      const { id, updatedAt, templateId, templateVersion, ...rest } = resource;
      return rest;
    };
    expect(without(templateResource)).toEqual(without(specResource));
    expect(templateResource.id).not.toBe(specResource.id);

    // The one thing that differs is where it came from.
    expect(templateResource.templateId).toBe(template.id);
    expect(templateResource.templateVersion).toBe(template.version);
    expect(specResource.templateId).toBeUndefined();
    expect(specResource.templateVersion).toBeUndefined();
  });

  it('writes the same audit trail for a template-created resource as for any other', async () => {
    const listed = await callTool(agentToken, 'resource.template.list', { type: 'document' });
    const template = theTemplate(listed.value as unknown as ResourceTemplate[], 'document');

    const before = await auditTrail();

    await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'Audited from a spec',
      data: template.spec,
    });
    const afterSpec = await auditTrail();

    await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'Audited from a template',
      template: { id: template.id },
    });
    const afterTemplate = await auditTrail();

    // The template path is audited exactly as the spec path is: the same
    // entries, and no entry of its own.
    expect(added(before, afterSpec)).toEqual(added(afterSpec, afterTemplate));
  });

  it('refuses a template whose spec the owning provider rejects', async () => {
    await withDriftedTemplate(async () => {
      const before = await listResources();

      const created = await callTool(agentToken, 'resource.create', {
        type: 'dashboard',
        title: 'A dashboard from a drifted template',
        template: { id: driftedTemplate.id },
      });

      expect(created.isError, 'a drifted template was accepted').toBe(true);
      expect(created.value.code).toBe('validation_failed');
      expect(created.value.message).toContain(driftedTemplate.id);

      const after = await listResources();
      expect(after.length).toBe(before.length);
    });
  });

  it("refuses the same spec when it arrives as a spec, so the refusal is the provider's", async () => {
    // The refusal above is worth nothing if the spec was never bad. So the
    // same spec is offered as a plain spec, and the provider refuses it too.
    await withDriftedTemplate(async () => {
      const created = await callTool(agentToken, 'resource.create', {
        type: 'dashboard',
        title: 'A dashboard from a drifted spec',
        data: driftedTemplate.spec,
      });
      expect(created.isError, 'the provider accepted a spec it should refuse').toBe(true);
    });
  });

  it('refuses to serve a template whose spec the owning provider rejects', async () => {
    // A template that drifted is a defect in the repository rather than a
    // condition of the world, so it is caught when the server starts and not
    // left to be found by an agent that reached for it.
    await withDriftedTemplate(async () => {
      const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-templates-drifted-'));
      const config = loadConfig({
        ...process.env,
        PERSONAL_OS_DATA_DIR: dataDir,
        PERSONAL_OS_OWNER_TOKEN: 'template-owner-token',
        LOG_LEVEL: 'silent',
      } as NodeJS.ProcessEnv);

      await expect(buildApp({ config })).rejects.toThrow(driftedTemplate.id);
    });
  });

  it('answers not_found for a template that does not exist', async () => {
    const before = await listResources();

    const created = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'A brief from nowhere',
      template: { id: 'no.such.template' },
    });

    expect(created.isError).toBe(true);
    expect(created.value.code).toBe('not_found');
    expect((await listResources()).length).toBe(before.length);
  });

  it('answers not_found when a template that does not exist is read', async () => {
    const read = await callTool(agentToken, 'resource.template.get', { id: 'no.such.template' });

    expect(read.isError).toBe(true);
    expect(read.value.code).toBe('not_found');
  });

  it('refuses to serve a template whose spec the owning provider rejects', async () => {
    // The same refusal, on the way to reading the template: a drifted template
    // is not published either.
    await withDriftedTemplate(async () => {
      const read = await callTool(agentToken, 'resource.template.get', {
        id: driftedTemplate.id,
      });

      expect(read.isError, 'a drifted template was served').toBe(true);
      expect(read.value.code).toBe('validation_failed');
      expect(read.value.message).toContain(driftedTemplate.id);
    });
  });

  it('refuses a template that starts another kind', async () => {
    const before = await listResources();

    const created = await callTool(agentToken, 'resource.create', {
      type: 'dashboard',
      title: 'A dashboard from a document template',
      template: { id: 'document.brief' },
    });

    expect(created.isError).toBe(true);
    expect(created.value.code).toBe('validation_failed');
    expect((await listResources()).length).toBe(before.length);
  });

  it('merges the values it is given into the template’s spec', async () => {
    // A template is a starting point, not a wall: the values the caller sends
    // are merged into the template's spec, and the values the caller does not
    // send are the template's.
    const before = await listResources();

    const created = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'A brief twice over',
      data: { content: 'mine', tags: ['mine'] },
      template: { id: 'document.brief' },
    });

    expect(created.isError, created.value.message).toBe(false);
    const resource = created.value as unknown as {
      data: Record<string, unknown>;
      templateId?: string;
      templateVersion?: number;
    };

    // The caller's values won.
    expect(resource.data.content).toBe('mine');
    expect(resource.data.tags).toEqual(['mine']);
    // The template's values that the caller did not name survived.
    expect(resource.data.format).toBe('markdown');

    // And the resource still knows where it came from.
    expect(resource.templateId).toBe('document.brief');
    expect(resource.templateVersion).toBe(1);

    expect((await listResources()).length).toBe(before.length + 1);
  });

  it('merges a dashboard’s widgets by the widget’s own id', async () => {
    const created = await callTool(agentToken, 'resource.create', {
      type: 'dashboard',
      title: 'A dashboard of my own',
      data: {
        widgets: [{ id: 'summary', dataSourceId: 'ds_1' }],
      },
      template: { id: 'dashboard.metrics' },
    });

    expect(created.isError, created.value.message).toBe(false);
    const resource = created.value as unknown as { data: { widgets: Record<string, unknown>[] } };

    // The widget the caller named is bound to its data source, and keeps the
    // rest of the template's widget.
    const summary = resource.data.widgets.find((widget) => widget.id === 'summary')!;
    expect(summary.dataSourceId).toBe('ds_1');
    expect(summary.type).toBe('metric');
    // The widget the caller did not name survived.
    expect(resource.data.widgets.some((widget) => widget.id === 'recent')).toBe(true);
  });

  it('carries the guide to the agent', async () => {
    const read = await callTool(agentToken, 'resource.template.get', { id: 'dashboard.metrics' });

    expect(read.isError, read.value.message).toBe(false);
    const template = read.value as unknown as {
      guide: {
        summary: string;
        whenToUse: string[];
        whenNotToUse: string[];
        fields: { path: string; what: string; mustSet: boolean }[];
        mistakes: string[];
        checklist: string[];
      };
    };

    // Six sections, and none of them empty: a guide that says nothing is a
    // placeholder, and a placeholder does not tell an agent what a good
    // resource looks like.
    expect(template.guide.summary.length).toBeGreaterThan(0);
    expect(template.guide.whenToUse.length).toBeGreaterThan(0);
    expect(template.guide.whenNotToUse.length).toBeGreaterThan(0);
    expect(template.guide.mistakes.length).toBeGreaterThan(0);
    expect(template.guide.checklist.length).toBeGreaterThan(0);

    // The fields the agent has to set are marked as such.
    const binding = template.guide.fields.find((field) => field.path === 'widgets[].dataSourceId');
    expect(binding?.mustSet).toBe(true);
    expect(binding?.what.length).toBeGreaterThan(0);
  });

  it('lists the templates of every kind when no kind is named', async () => {
    const listed = await callTool(agentToken, 'resource.template.list', {});

    expect(listed.isError, listed.value.message).toBe(false);
    const templates = listed.value as unknown as { type: string; guide: unknown }[];
    expect(templates).toHaveLength(6);
    expect(new Set(templates.map((template) => template.type)).size).toBe(6);
    // Every template carries a guide.
    expect(templates.every((template) => template.guide !== undefined)).toBe(true);
  });

  it('leaves a resource made from an older version untouched when a newer one is published', async () => {
    await withSecondVersion(async () => {
      // A resource made from the first version.
      const created = await callTool(agentToken, 'resource.create', {
        type: 'document',
        title: 'Made from the first version',
        template: { id: 'document.brief', version: 1 },
      });
      expect(created.isError, created.value.message).toBe(false);
      const resource = created.value as unknown as { id: string; templateVersion: number };

      // The list shows the newest version, and the older one is still
      // readable by number — which is why a resource cites the version it was
      // made from.
      const listed = await callTool(agentToken, 'resource.template.list', { type: 'document' });
      const published = (listed.value as unknown as ResourceTemplate[]).filter(
        (template) => template.id === 'document.brief',
      );
      expect(published).toHaveLength(1);
      expect(published[0]!.version).toBe(2);

      const older = await callTool(agentToken, 'resource.template.get', {
        id: 'document.brief',
        version: 1,
      });
      expect(older.isError, older.value.message).toBe(false);
      expect((older.value as unknown as ResourceTemplate).version).toBe(1);

      // The resource is a copy, not a link: the newer version did not touch it.
      const read = await app.inject({
        method: 'GET',
        url: `/api/resources/${resource.id}`,
        headers: { cookie: sessionCookie },
      });
      expect(read.statusCode).toBe(200);
      expect(read.json().resource.templateId).toBe('document.brief');
      expect(read.json().resource.templateVersion).toBe(1);
      expect(read.json().resource.data.tags).toEqual(['brief']);
    });
  });

  it('refuses a task whose spec breaks the task contract', async () => {
    // The task provider validates, like every other provider. A task whose
    // spec breaks the contract is a bad request, not a server fault.
    const created = await callTool(agentToken, 'resource.create', {
      type: 'task',
      title: 'A task that breaks the contract',
      data: { description: 'Something to do.', acceptanceCriteria: ['It is done.'], goalId: 42 },
    });

    expect(created.isError, 'a task that breaks the contract was accepted').toBe(true);
    expect(created.value.code).toBe('validation_failed');
  });

  it('reports a task that satisfies the task contract as valid', async () => {
    // The other half of the pair: an inspection that always said "invalid"
    // would prove nothing.
    const created = await callTool(agentToken, 'resource.create', {
      type: 'task',
      title: 'A task that keeps the contract',
      data: { description: 'What has to be true.', acceptanceCriteria: ['It is.'] },
    });
    expect(created.isError, created.value.message).toBe(false);
    const resource = created.value as unknown as { id: string };

    const inspected = await app.inject({
      method: 'GET',
      url: `/api/resources/${resource.id}/inspect`,
      headers: { cookie: sessionCookie },
    });

    expect(inspected.statusCode).toBe(200);
    expect(inspected.json().valid).toBe(true);
    expect(inspected.json().issues).toEqual([]);
  });

  it('reports a task that breaks the task contract as invalid', async () => {
    // A task written before the contract was enforced is still on disk. An
    // inspection says so, rather than calling it valid because nobody
    // looked.
    const id = 'tsk_broken';
    app.services.runtime.db
      .insert(tasks)
      .values({
        id,
        workspaceId,
        goalId: null,
        title: 'A task written by an older version',
        description: 'Something to do.',
        assigneeId: null,
        executionOwner: 'personal-os',
        status: 'not-a-status',
        revision: 1,
        acceptanceCriteria: [],
        evidenceResourceIds: [],
        externalRef: null,
        templateId: null,
        templateVersion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    const inspected = await app.inject({
      method: 'GET',
      url: `/api/resources/${id}/inspect`,
      headers: { cookie: sessionCookie },
    });

    expect(inspected.statusCode).toBe(200);
    expect(inspected.json().valid).toBe(false);
    expect(inspected.json().issues.length).toBeGreaterThan(0);
  });

  it('stops the server from starting when a task template breaks the task contract', async () => {
    resourceTemplates.push(driftedTaskTemplate);
    try {
      const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-templates-drifted-task-'));
      const config = loadConfig({
        ...process.env,
        PERSONAL_OS_DATA_DIR: dataDir,
        PERSONAL_OS_OWNER_TOKEN: 'template-owner-token',
        LOG_LEVEL: 'silent',
      } as NodeJS.ProcessEnv);

      await expect(buildApp({ config })).rejects.toThrow(driftedTaskTemplate.id);
    } finally {
      const index = resourceTemplates.indexOf(driftedTaskTemplate);
      if (index !== -1) resourceTemplates.splice(index, 1);
    }
  });
});
