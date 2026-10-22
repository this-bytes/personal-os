// @vitest-environment node
/**
 * An agent may only reach an object inside a workspace it has been granted.
 *
 * WI-067 found the rule already written in the code's own words — an agent may
 * only act inside a workspace it has been granted — and seven of the MCP
 * surface's tools not keeping it. A tool that names an id names an *object*,
 * not a workspace, so the caller's scope and the object's scope have to be
 * brought together before the object is read.
 *
 * This file is the test the item names and the implementation did not have. It
 * proves, against the surface the agent actually calls:
 *
 *  1. **a call that crosses a workspace is refused**, on every id-addressed
 *     tool, and nothing of the object comes back — not a title, not a count,
 *     not a body;
 *  2. **the same call inside the agent's own workspace still works**, so no
 *     legitimate call became an error;
 *  3. **the owner is not affected** — the owner reaches every workspace, and
 *     sees what it should see;
 *  4. **the memory rule stays its own rule**: another agent's memory is still
 *     refused with the published message, and the workspace rule does not
 *     replace it or answer for it;
 *  5. **a template is not workspace-scoped**, so the template tools are not a
 *     way around the rule.
 *
 * The assertions are made against the MCP surface itself, so the code and the
 * rule it states cannot drift apart quietly. Nothing here edits the
 * implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

let app: FastifyInstance;
let sessionCookie = '';
/** The workspace the agent is granted. */
let ownId = '';
/** The workspace the agent was not granted. */
let otherId = '';
let dataDir = '';

/** The guard's own words. The rule is one sentence, and it is this one. */
const REFUSED = 'This agent has no access to that workspace.';
/** The memory rule's own words. It is a different rule and a different line. */
const REFUSED_MEMORY = 'An agent may only reach its own memory.';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-workspace-scope-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'workspace-scope-owner-token',
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

  // A second workspace, so there is somewhere an agent must not reach.
  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name: 'Elsewhere', description: 'The workspace the agent was not granted.' },
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
 * The tool result carried by an MCP response: whether it is an error, and the
 * text the tool answered with.
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
  return {
    isError: result.isError === true,
    text: result.content?.[0]?.text ?? '',
  };
}

/** An agent connection in a workspace, and a token that speaks for it. */
async function createAgent(
  name: string,
  toolGrants: string[],
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
      toolGrants,
    },
  });
  expect(agent.statusCode).toBe(201);
  const id = agent.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'workspace-scope' },
  });
  expect(token.statusCode).toBe(201);
  return { id, token: token.json().token as string };
}

/** A conversation the owner made in a workspace. */
async function createConversation(workspaceId: string, title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json().conversation.id as string;
}

/** A task the owner made in a workspace. */
async function createTask(workspaceId: string, title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json().task.id as string;
}

/** A resource the owner made in a workspace. */
async function createResource(
  workspaceId: string,
  title: string,
  data: Record<string, unknown>,
  type: string = 'document',
): Promise<{ id: string; revision: number }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, type, title, data },
  });
  expect(response.statusCode).toBe(201);
  const resource = response.json().resource;
  return { id: resource.id as string, revision: resource.revision as number };
}

/** An automation the owner made in a workspace. */
async function createAutomation(workspaceId: string, title: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/automations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title,
      trigger: { type: 'manual' },
      action: { type: 'http.request', url: 'https://example.invalid/never', method: 'GET' },
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json().automation.id as string;
}

/**
 * The id-addressed tools, and the argument each one names its object by.
 *
 * These are the seven the item names. Each of them takes an id rather than a
 * workspace, so each of them had to learn to ask whose workspace the object is
 * in.
 */
const ID_ADDRESSED: { tool: string; idKey: string }[] = [
  { tool: 'conversation.read', idKey: 'conversationId' },
  { tool: 'conversation.post', idKey: 'conversationId' },
  { tool: 'task.get', idKey: 'taskId' },
  { tool: 'task.update', idKey: 'taskId' },
  { tool: 'resource.get', idKey: 'resourceId' },
  { tool: 'resource.update', idKey: 'resourceId' },
  { tool: 'automation.inspect', idKey: 'automationId' },
];

/** The arguments each tool needs besides the id it names its object by. */
function argumentsFor(tool: string, id: string, revision: number): Record<string, unknown> {
  switch (tool) {
    case 'conversation.post':
      return { conversationId: id, text: 'a message from the agent' };
    case 'task.update':
      return { taskId: id, title: 'renamed by the agent' };
    case 'resource.update':
      return { resourceId: id, expectedRevision: revision, title: 'renamed by the agent' };
    default:
      return tool === 'task.get'
        ? { taskId: id }
        : tool === 'resource.get'
          ? { resourceId: id }
          : tool === 'automation.inspect'
            ? { automationId: id }
            : { conversationId: id };
  }
}

describe('an agent reaching for an object in a workspace it was not granted', () => {
  let token = '';
  /** The ids of the objects in the workspace the agent must not reach. */
  const other = {
    conversationId: '',
    taskId: '',
    resourceId: '',
    automationId: '',
    resourceRevision: 1,
    marker: 'ELSEWHERE-ONLY',
  };
  /** The ids of the same kinds of object in the agent's own workspace. */
  const own = {
    conversationId: '',
    taskId: '',
    resourceId: '',
    automationId: '',
    resourceRevision: 1,
  };

  beforeAll(async () => {
    const agent = await createAgent('Reaching too far', [
      'conversation.read',
      'conversation.post',
      'task.get',
      'task.update',
      'resource.get',
      'resource.update',
      'automation.inspect',
    ]);
    token = agent.token;

    other.conversationId = await createConversation(otherId, 'Elsewhere conversation');
    other.taskId = await createTask(otherId, 'Elsewhere task');
    const resource = await createResource(otherId, 'Elsewhere document', {
      format: 'markdown',
      content: other.marker,
    });
    other.resourceId = resource.id;
    other.resourceRevision = resource.revision;
    other.automationId = await createAutomation(otherId, 'Elsewhere automation');

    own.conversationId = await createConversation(ownId, 'Own conversation');
    own.taskId = await createTask(ownId, 'Own task');
    const ownResource = await createResource(ownId, 'Own document', {
      format: 'markdown',
      content: 'own only',
    });
    own.resourceId = ownResource.id;
    own.resourceRevision = ownResource.revision;
    own.automationId = await createAutomation(ownId, 'Own automation');
  });

  it('is refused on every id-addressed tool, and nothing of the object comes back', async () => {
    for (const { tool, idKey } of ID_ADDRESSED) {
      const id = other[idKey as keyof typeof other] as string;
      const revision = tool === 'resource.update' ? other.resourceRevision : 1;

      const response = await mcp(
        { authorization: `Bearer ${token}` },
        tool,
        argumentsFor(tool, id, revision),
      );
      const result = toolResult(response.body);

      // The refusal is the guard's own: the object is in a workspace this
      // agent was not granted.
      expect(result.isError, `${tool} answered as a success`).toBe(true);
      expect(result.text, `${tool} refused for the wrong reason`).toContain(REFUSED);

      // A refusal that leaks is a refusal that does not work. Nothing of the
      // object comes back: not its title, not its body, not its count.
      expect(result.text, `${tool} leaked the object's title`).not.toContain('Elsewhere');
      expect(result.text, `${tool} leaked the object's body`).not.toContain(other.marker);
    }
  });

  it('is not refused inside the agent’s own workspace', async () => {
    for (const { tool, idKey } of ID_ADDRESSED) {
      const id = own[idKey as keyof typeof own] as string;
      const revision = tool === 'resource.update' ? own.resourceRevision : 1;

      const response = await mcp(
        { authorization: `Bearer ${token}` },
        tool,
        argumentsFor(tool, id, revision),
      );
      const result = toolResult(response.body);

      // The same call, in a workspace the agent was granted, still works. The
      // guard the item asks for refuses what it should and nothing else.
      expect(result.isError, `${tool} was refused inside its own workspace: ${result.text}`).toBe(
        false,
      );
      expect(result.text, `${tool} was refused by the workspace rule`).not.toContain(REFUSED);
    }
  });

  it('does not stop the owner', async () => {
    for (const { tool, idKey } of ID_ADDRESSED) {
      const id = other[idKey as keyof typeof other] as string;
      const revision = tool === 'resource.update' ? other.resourceRevision : 1;

      const response = await mcp({ cookie: sessionCookie }, tool, argumentsFor(tool, id, revision));
      const result = toolResult(response.body);

      // The owner acts in every workspace, so there is nothing to refuse and
      // nothing to look up. The owner's own calls keep working.
      expect(result.isError, `${tool} refused the owner: ${result.text}`).toBe(false);
    }

    // And the owner sees the object the agent could not.
    const read = await mcp({ cookie: sessionCookie }, 'conversation.read', {
      conversationId: other.conversationId,
    });
    expect(toolResult(read.body).text).toContain('Elsewhere conversation');
  });
});

describe('the memory rule beside the workspace rule', () => {
  it('still refuses another agent’s memory, with its own message', async () => {
    const reader = await createAgent('Reading a memory', ['resource.get']);
    const owner = await createAgent('The memory’s owner', ['resource.get']);

    // A memory that belongs to the other agent, in the reader's own
    // workspace. The workspace rule has nothing to say about it.
    const memory = await createResource(
      ownId,
      'Another agent’s memory',
      {
        scope: 'agent',
        agentConnectionId: owner.id,
        key: 'private',
        value: 'ANOTHER-AGENTS-SECRET',
      },
      'memory',
    );

    const response = await mcp({ authorization: `Bearer ${reader.token}` }, 'resource.get', {
      resourceId: memory.id,
    });
    const result = toolResult(response.body);

    // The memory rule answers, in its own words. The workspace rule has not
    // replaced it.
    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED_MEMORY);
    expect(result.text).not.toContain('ANOTHER-AGENTS-SECRET');
  });

  it('refuses the agent’s own memory in another workspace, with the workspace message', async () => {
    const reader = await createAgent('Reading its own memory', ['resource.get']);

    // The reader's own memory — the memory rule is happy with it — but it
    // lives in a workspace the reader was not granted. The workspace rule
    // answers, and it answers in its own words.
    const memory = await createResource(
      otherId,
      'Its own memory, elsewhere',
      {
        scope: 'agent',
        agentConnectionId: reader.id,
        key: 'private',
        value: 'ITS-OWN-SECRET',
      },
      'memory',
    );

    const response = await mcp({ authorization: `Bearer ${reader.token}` }, 'resource.get', {
      resourceId: memory.id,
    });
    const result = toolResult(response.body);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(REFUSED);
    expect(result.text).not.toContain('ITS-OWN-SECRET');
  });
});

describe('the template tools', () => {
  it('are not scoped to a workspace, so they are not a way around the rule', async () => {
    const agent = await createAgent('Reading a template', ['resource.template.list']);

    const response = await mcp(
      { authorization: `Bearer ${agent.token}` },
      'resource.template.list',
      { type: 'document' },
    );
    const result = toolResult(response.body);

    // A template is the registry's published example of a kind: it is
    // authored in the repository and holds no workspace's data, so there is no
    // object here whose workspace could be out of the caller's reach.
    expect(result.isError, `the template list was refused: ${result.text}`).toBe(false);
  });
});
