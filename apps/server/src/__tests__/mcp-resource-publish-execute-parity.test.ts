// @vitest-environment node
/**
 * The two acts a resource may have, over MCP.
 *
 * SPEC-S2 batch 2 pairs `POST /api/resources/:id/publish` and
 * `POST /api/resources/:id/execute` with the tools `resource.publish` and
 * `resource.execute`.
 *
 * This file is the proof of the four things that makes them safe:
 *
 *  1. **The grant model.** Neither act is in the default grant set, and the
 *     reason is the coverage table's own. Publishing "makes a resource visible
 *     to everyone; it is the owner's own act", and running a resource is
 *     running it *now* — an automation's run is enqueued for the worker and its
 *     action may prompt an agent, and a data source's query makes the outbound
 *     request the owner's configuration describes. Both spend an authority the
 *     owner holds, so the owner grants each of them by name. A connection that
 *     was not given one of them does not have it registered at all: the call is
 *     refused, and the refusal is recorded the way every other ungranted call
 *     is recorded, so the owner finds the agent on the waiting list.
 *
 *  2. **Workspace scoping.** Each tool names an id, so each names an *object*:
 *     the object is checked against the caller's scope before anything of it is
 *     read, and a refusal leaks nothing of it.
 *
 *  3. **The same refusal.** A kind with no publish act, and a kind with no run,
 *     are refused by the tool with the same words and the same facts the route
 *     refuses them with.
 *
 *  4. **The same capability.** The route and the tool are thin adapters over
 *     one shared capability, so they answer alike, and the trail names who
 *     acted.
 *
 * The assertions are made against the MCP surface itself, so the code and the
 * rule it states cannot drift apart quietly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { blockedCapabilities } from '../db/schema.js';
import { mcpToolNames, resourceOperationSupport } from '@personal-os/contracts';
import type { ResourceType } from '@personal-os/contracts';

let app: FastifyInstance;
let sessionCookie = '';
/** The workspace the agents are granted. */
let ownId = '';
/** The workspace the agents must not reach. */
let otherId = '';
let dataDir = '';

/** The guard's own words. The rule is one sentence, and it is this one. */
const REFUSED = 'This agent has no access to that workspace.';

/** The rows a JSON data source holds, and what running it answers with. */
const ROWS = { rows: [1, 2, 3] };

/** Every kind the contract publishes, in the contract's own order. */
const KINDS = Object.keys(resourceOperationSupport) as ResourceType[];

/**
 * The data a resource of each kind needs to satisfy its contract.
 *
 * A dashboard only shows a run when it has a widget with a data source, so the
 * dashboard's fixture creates one first.
 */
type SpecFactory = (fixture: Fixture) => Promise<Record<string, unknown>>;

interface Fixture {
  /** The workspace the resource is being made in. */
  workspaceId: string;
  /** Create a resource of a kind in the given workspace and return its id. */
  create(workspaceId: string, type: ResourceType, title: string): Promise<string>;
}

const SPECS: Record<ResourceType, SpecFactory> = {
  dashboard: async (fixture) => {
    const source = await fixture.create(fixture.workspaceId, 'data-source', 'Rows');
    return {
      widgets: [{ id: 'rows', type: 'table', title: 'Rows', dataSourceId: source }],
      refreshSeconds: 30,
    };
  },
  document: async () => ({ format: 'markdown', content: '# Runbook' }),
  automation: async () => ({
    trigger: { type: 'manual' },
    action: { type: 'agent.prompt', agentConnectionId: 'agt_gate', prompt: 'Summarise.' },
  }),
  'data-source': async () => ({ kind: 'json', payload: ROWS }),
  task: async () => ({ description: 'Do the thing.' }),
  memory: async () => ({ scope: 'workspace', key: 'greeting', value: 'hello' }),
};

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-resource-acts-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'resource-acts-owner-token',
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
  ownId = workspaces.json().workspaces[0].id as string;

  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name: 'Elsewhere', description: 'The workspace the agents were not granted.' },
  });
  expect(created.statusCode).toBe(201);
  otherId = created.json().workspace.id as string;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** The MCP surface, called the way an agent calls it. */
async function mcp(
  headers: Record<string, string>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  return { statusCode: response.statusCode, body: response.body };
}

/**
 * The tool result carried by an MCP response.
 *
 * The transport answers with the JSON-RPC payload on the `data:` line of the
 * event stream, and a tool that refused answers with its refusal as the text
 * of the result.
 */
function toolResult(body: string): { isError: boolean; text: string } {
  const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
  expect(dataLine, 'the MCP response carries no payload').toBeDefined();
  const payload = JSON.parse((dataLine ?? '').slice('data: '.length)) as {
    result?: { isError?: boolean; content?: { text?: string }[] };
  };
  const result = payload.result ?? {};
  return { isError: result.isError === true, text: result.content?.[0]?.text ?? '' };
}

/** The refusal envelope a tool answered with. */
function toolEnvelope(text: string): { code: string; message: string; details?: unknown } {
  return JSON.parse(text) as { code: string; message: string; details?: unknown };
}

/** The tool names in a tools/list response. */
function listedTools(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(/"name"\s*:\s*"([a-z.]+)"/g)) {
    const name = match[1];
    if (name && mcpToolNames.includes(name as never)) names.push(name);
  }
  return names;
}

/** The tool list a token sees. */
async function toolList(token: string): Promise<string[]> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });
  return listedTools(response.body);
}

/** An agent connection in a workspace, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants?: string[],
  agentWorkspaceId: string = ownId,
): Promise<{ id: string; token: string }> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId: agentWorkspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
      ...(toolGrants ? { toolGrants } : {}),
    },
  });
  expect(agent.statusCode).toBe(201);
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'resource-acts' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** Create a resource of a kind in a workspace, and return its id. */
async function createResource(
  workspaceId: string,
  type: ResourceType,
  title: string,
): Promise<string> {
  const data = await SPECS[type]({
    workspaceId,
    create: (ws, kind, kindTitle) => createResource(ws, kind, kindTitle),
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, type, title, data },
  });
  expect(response.statusCode, `the ${type} was not created`).toBe(201);
  return response.json().resource.id as string;
}

/** The refusals recorded against one connection. */
function recordedRefusals(agentConnectionId: string): string[] {
  return app.services.runtime.db
    .select()
    .from(blockedCapabilities)
    .all()
    .filter((row) => row.agentConnectionId === agentConnectionId)
    .map((row) => row.toolName);
}

/** The audit entries of a workspace. */
async function auditEntries(
  workspaceId: string,
): Promise<
  { action: string; targetId: string; actorType: string; actorId: string; metadata: unknown }[]
> {
  const audit = await app.inject({
    method: 'GET',
    url: `/api/audit?workspaceId=${workspaceId}&limit=100`,
    headers: { cookie: sessionCookie },
  });
  return audit.json().entries;
}

/** The resource as the API publishes it. */
async function readResource(id: string): Promise<Record<string, unknown>> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/resources/${id}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().resource;
}

describe('the grant model, on the two acts', () => {
  it('gives the default set neither act', async () => {
    const agent = await createAgent('Default grants');
    const tools = await toolList(agent.token);

    // Neither act is a read. Publishing is "the owner's own act", and running
    // a resource runs the owner's work — so a connection that may do either is
    // a connection the owner has said may do it.
    expect(tools).not.toContain('resource.publish');
    expect(tools).not.toContain('resource.execute');

    // The reads beside them are still there: a grant set that withholds the
    // acts is not a grant set that withholds everything.
    expect(tools).toContain('resource.get');
    expect(tools).toContain('resource.update');
  });

  it('registers an act the owner granted by name', async () => {
    const agent = await createAgent('Granted by name', ['resource.publish', 'resource.execute']);
    const tools = await toolList(agent.token);

    expect(tools).toContain('resource.publish');
    expect(tools).toContain('resource.execute');
  });

  it('narrows to the act the owner named', async () => {
    const agent = await createAgent('Granted publish only', ['resource.publish']);
    const tools = await toolList(agent.token);

    expect(tools).toContain('resource.publish');
    expect(tools).not.toContain('resource.execute');
  });

  it('refuses a publish the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No publish');
    const dashboardId = await createResource(ownId, 'dashboard', 'Unpublished by the agent');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
      resourceId: dashboardId,
    });

    // The tool was never registered, so the MCP server cannot route it.
    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');

    // The refusal is recorded, the way every other ungranted call is recorded,
    // so the owner finds the agent on the waiting list.
    expect(recordedRefusals(agent.id)).toContain('resource.publish');

    // And a refusal changed nothing: the dashboard is still unpublished.
    const resource = await readResource(dashboardId);
    expect((resource.data as { published?: boolean }).published).not.toBe(true);
  });

  it('refuses an execute the connection was not granted, and records the refusal', async () => {
    const agent = await createAgent('No execute');
    const sourceId = await createResource(ownId, 'data-source', 'Rows nobody may run');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.execute', {
      resourceId: sourceId,
    });

    expect(response.body).toContain('not found');
    expect(response.body).toContain('isError');
    expect(recordedRefusals(agent.id)).toContain('resource.execute');
  });

  it('gives the owner every tool, the two acts included', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer resource-acts-owner-token',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });

    expect(listedTools(response.body).sort()).toEqual([...mcpToolNames].sort());
  });
});

describe('an agent reaching outside the workspace it was granted', () => {
  let token = '';
  let elsewhereDashboard = '';
  let elsewhereSource = '';

  beforeAll(async () => {
    const agent = await createAgent('Reaching too far', ['resource.publish', 'resource.execute']);
    token = agent.token;

    elsewhereDashboard = await createResource(otherId, 'dashboard', 'A dashboard elsewhere');
    elsewhereSource = await createResource(otherId, 'data-source', 'Rows elsewhere');
  });

  it('refuses to publish a resource in a workspace it was not granted, and changes nothing', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'resource.publish', {
      resourceId: elsewhereDashboard,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);

    // A refusal that leaks is a refusal that does not work.
    expect(result.text).not.toContain('A dashboard elsewhere');

    // And the dashboard is still not published.
    const resource = await readResource(elsewhereDashboard);
    expect((resource.data as { published?: boolean }).published).not.toBe(true);
  });

  it('refuses to execute a resource in a workspace it was not granted', async () => {
    const response = await mcp({ authorization: `Bearer ${token}` }, 'resource.execute', {
      resourceId: elsewhereSource,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
    expect(result.text).not.toContain('Rows elsewhere');
  });

  it('is not refused inside its own workspace', async () => {
    const dashboardId = await createResource(ownId, 'dashboard', 'A dashboard of its own');
    const publish = await mcp({ authorization: `Bearer ${token}` }, 'resource.publish', {
      resourceId: dashboardId,
    });
    expect(toolResult(publish.body).isError).toBe(false);

    const sourceId = await createResource(ownId, 'data-source', 'Rows of its own');
    const execute = await mcp({ authorization: `Bearer ${token}` }, 'resource.execute', {
      resourceId: sourceId,
    });
    expect(toolResult(execute.body).isError).toBe(false);
  });
});

describe('the tool refuses the kinds the route refuses', () => {
  it('refuses the same kinds for publish, with the same reason', async () => {
    const agent = await createAgent('Publisher', ['resource.publish']);

    for (const kind of KINDS) {
      const toolResource = await createResource(ownId, kind, `Tool ${kind}`);
      const routeResource = await createResource(ownId, kind, `Route ${kind}`);

      const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
        resourceId: toolResource,
      });
      const toolText = toolResult(viaTool.body);

      const viaRoute = await app.inject({
        method: 'POST',
        url: `/api/resources/${routeResource}/publish`,
        headers: { cookie: sessionCookie },
      });

      if (!resourceOperationSupport[kind].publish) {
        // The kind has no publish act. Both refuse, and they refuse the same
        // way: the same words, and the same facts behind them.
        expect(toolText.isError, `the ${kind} was published by the tool`).toBe(true);
        expect(viaRoute.statusCode, `the route published the ${kind}`).toBe(400);

        const envelope = toolEnvelope(toolText.text);
        expect(envelope.code).toBe('bad_request');
        expect(envelope.message).toBe(viaRoute.json().error.message);
        expect(envelope.details).toEqual(viaRoute.json().error.details);
      } else {
        expect(toolText.isError, `the ${kind} was refused by the tool`).toBe(false);
        expect(viaRoute.statusCode, `the route refused the ${kind}`).toBe(200);

        const toolPayload = JSON.parse(toolText.text) as { outcome: string };
        const routePayload = viaRoute.json() as { outcome: string };
        expect(toolPayload.outcome).toBe(routePayload.outcome);
        expect(toolPayload.outcome).toBe('published');
      }
    }
  });

  it('refuses the same kinds for execute, with the same reason', async () => {
    const agent = await createAgent('Runner', ['resource.execute']);

    for (const kind of KINDS) {
      const toolResource = await createResource(ownId, kind, `Tool ${kind}`);
      const routeResource = await createResource(ownId, kind, `Route ${kind}`);

      const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.execute', {
        resourceId: toolResource,
      });
      const toolText = toolResult(viaTool.body);

      const viaRoute = await app.inject({
        method: 'POST',
        url: `/api/resources/${routeResource}/execute`,
        headers: { cookie: sessionCookie },
      });

      if (!resourceOperationSupport[kind].execute) {
        expect(toolText.isError, `the ${kind} was run by the tool`).toBe(true);
        expect(viaRoute.statusCode, `the route ran the ${kind}`).toBe(400);

        const envelope = toolEnvelope(toolText.text);
        expect(envelope.code).toBe('bad_request');
        expect(envelope.message).toBe(viaRoute.json().error.message);
        expect(envelope.details).toEqual(viaRoute.json().error.details);
      } else {
        expect(toolText.isError, `the ${kind} was refused by the tool`).toBe(false);
        expect(viaRoute.statusCode, `the route refused the ${kind}`).toBe(200);

        const toolPayload = JSON.parse(toolText.text) as { outcome: string };
        const routePayload = viaRoute.json() as { outcome: string };
        expect(toolPayload.outcome).toBe(routePayload.outcome);
      }
    }
  });

  it('names the kind and the act in the refusal', async () => {
    const agent = await createAgent('Publisher', ['resource.publish']);
    const documentId = await createResource(ownId, 'document', 'A document');

    const response = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
      resourceId: documentId,
    });
    const envelope = toolEnvelope(toolResult(response.body).text);

    expect(envelope.message).toContain('document');
    expect(envelope.message).toContain('published');
    expect(envelope.details).toMatchObject({
      type: 'document',
      operation: 'publish',
      supportedTypes: ['dashboard', 'automation'],
    });
  });
});

describe('the tool answers what the route answers', () => {
  it('publishes the way the owner’s route publishes', async () => {
    const agent = await createAgent('Publisher', ['resource.publish']);

    const toolResource = await createResource(ownId, 'dashboard', 'Published by the agent');
    const routeResource = await createResource(ownId, 'dashboard', 'Published by the owner');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
      resourceId: toolResource,
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the publish was refused: ${toolText.text}`).toBe(false);

    const viaRoute = await app.inject({
      method: 'POST',
      url: `/api/resources/${routeResource}/publish`,
      headers: { cookie: sessionCookie },
    });
    expect(viaRoute.statusCode).toBe(200);

    // The same shape, and the same conclusion.
    const toolPayload = JSON.parse(toolText.text) as {
      outcome: string;
      resource: { type: string; data: { published?: boolean } };
    };
    const routePayload = viaRoute.json() as {
      outcome: string;
      resource: { type: string; data: { published?: boolean } };
    };

    expect(Object.keys(toolPayload).sort()).toEqual(Object.keys(routePayload).sort());
    expect(toolPayload.outcome).toBe(routePayload.outcome);
    expect(toolPayload.resource.type).toBe(routePayload.resource.type);
    expect(toolPayload.resource.data.published).toBe(true);
    expect(routePayload.resource.data.published).toBe(true);
  });

  it('runs the way the owner’s route runs', async () => {
    const agent = await createAgent('Runner', ['resource.execute']);

    const toolResource = await createResource(ownId, 'data-source', 'Run by the agent');
    const routeResource = await createResource(ownId, 'data-source', 'Run by the owner');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.execute', {
      resourceId: toolResource,
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the run was refused: ${toolText.text}`).toBe(false);

    const viaRoute = await app.inject({
      method: 'POST',
      url: `/api/resources/${routeResource}/execute`,
      headers: { cookie: sessionCookie },
    });
    expect(viaRoute.statusCode).toBe(200);

    // The same shape, and the same answer, member for member.
    const toolPayload = JSON.parse(toolText.text) as {
      outcome: string;
      result: { output: unknown };
    };
    const routePayload = viaRoute.json() as { outcome: string; result: { output: unknown } };

    expect(Object.keys(toolPayload).sort()).toEqual(Object.keys(routePayload).sort());
    expect(toolPayload.outcome).toBe(routePayload.outcome);
    expect(toolPayload.outcome).toBe('succeeded');
    expect(toolPayload.result.output).toEqual(routePayload.result.output);
    expect(toolPayload.result.output).toEqual(ROWS);
  });

  it('says a run that was enqueued was enqueued', async () => {
    const agent = await createAgent('Runner', ['resource.execute']);
    const automationId = await createResource(ownId, 'automation', 'Run by the agent');

    const viaTool = await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.execute', {
      resourceId: automationId,
    });
    const toolText = toolResult(viaTool.body);
    expect(toolText.isError, `the run was refused: ${toolText.text}`).toBe(false);

    const toolPayload = JSON.parse(toolText.text) as { outcome: string };
    expect(toolPayload.outcome).toBe('queued');
  });
});

describe('the record names who acted', () => {
  it('names the agent that published, and the owner on the route', async () => {
    const agent = await createAgent('Publisher', ['resource.publish']);
    const toolResource = await createResource(ownId, 'dashboard', 'Published by the agent');
    const routeResource = await createResource(ownId, 'dashboard', 'Published by the owner');

    await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
      resourceId: toolResource,
    });
    await app.inject({
      method: 'POST',
      url: `/api/resources/${routeResource}/publish`,
      headers: { cookie: sessionCookie },
    });

    const entries = await auditEntries(ownId);
    const byAgent = entries.find(
      (entry) => entry.action === 'resource.published' && entry.targetId === toolResource,
    );
    const byOwner = entries.find(
      (entry) => entry.action === 'resource.published' && entry.targetId === routeResource,
    );

    expect(byAgent, 'the publish is not in the audit trail').toBeDefined();
    expect(byAgent?.actorType).toBe('agent');
    expect(byAgent?.actorId).toBe(agent.id);

    expect(byOwner, 'the owner’s publish is not in the audit trail').toBeDefined();
    expect(byOwner?.actorType).toBe('human');
  });

  it('names the agent that ran, and the owner on the route', async () => {
    const agent = await createAgent('Runner', ['resource.execute']);
    const toolResource = await createResource(ownId, 'data-source', 'Run by the agent');
    const routeResource = await createResource(ownId, 'data-source', 'Run by the owner');

    await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.execute', {
      resourceId: toolResource,
    });
    await app.inject({
      method: 'POST',
      url: `/api/resources/${routeResource}/execute`,
      headers: { cookie: sessionCookie },
    });

    const entries = await auditEntries(ownId);
    const byAgent = entries.find(
      (entry) => entry.action === 'resource.executed' && entry.targetId === toolResource,
    );
    const byOwner = entries.find(
      (entry) => entry.action === 'resource.executed' && entry.targetId === routeResource,
    );

    expect(byAgent, 'the run is not in the audit trail').toBeDefined();
    expect(byAgent?.actorType).toBe('agent');
    expect(byAgent?.actorId).toBe(agent.id);

    expect(byOwner, 'the owner’s run is not in the audit trail').toBeDefined();
    expect(byOwner?.actorType).toBe('human');
  });

  it('writes nothing to the trail for a refused act', async () => {
    const agent = await createAgent('Publisher', ['resource.publish']);
    const documentId = await createResource(ownId, 'document', 'A document');

    await mcp({ authorization: `Bearer ${agent.token}` }, 'resource.publish', {
      resourceId: documentId,
    });

    const entries = await auditEntries(ownId);
    const refused = entries.find(
      (entry) => entry.action === 'resource.published' && entry.targetId === documentId,
    );

    expect(refused, 'a refused publish is in the audit trail').toBeUndefined();
  });
});
