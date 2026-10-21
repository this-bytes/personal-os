import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ResourceTemplate } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { resourceTemplates } from '../modules/resources/templates.js';

/**
 * A template tells an agent what a good resource looks like.
 *
 * The contract publishes the shape in `### The template record`: a template is
 * a named, versioned example of one resource kind, with its spec, that an
 * agent can start from; `resource.template.list` lists the templates for a
 * kind and `resource.create` gains one optional `template` input; the spec of
 * a template is validated by the owning provider exactly as a resource's spec
 * is; and `data` and `template` are mutually exclusive.
 *
 * This file holds the behaviour to those published shapes, through the MCP
 * surface an agent actually uses.
 *
 * The refusal cases matter as much as the happy one. A check that cannot fail
 * is worse than no check, so each refusal here names the answer the contract
 * publishes — `not_found` for an unknown template, `validation_failed` for a
 * template of the wrong kind, for a template whose spec the provider refuses,
 * and for a call that carries both a spec and a template — and each one
 * proves that nothing was created.
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

    // Everything the resource publishes, except the identity it was given.
    const without = (resource: Record<string, unknown>) => {
      const { id, updatedAt, ...rest } = resource;
      return rest;
    };
    expect(without(templateResource)).toEqual(without(specResource));
    expect(templateResource.id).not.toBe(specResource.id);
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

  it('refuses a call that carries both a spec and a template', async () => {
    const before = await listResources();

    const created = await callTool(agentToken, 'resource.create', {
      type: 'document',
      title: 'A brief twice over',
      data: { format: 'markdown', content: 'mine', tags: [] },
      template: { id: 'document.brief' },
    });

    expect(created.isError).toBe(true);
    expect(created.value.code).toBe('validation_failed');
    expect((await listResources()).length).toBe(before.length);
  });
});
