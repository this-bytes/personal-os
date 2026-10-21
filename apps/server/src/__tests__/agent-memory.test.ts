import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * An agent's memory of its own.
 *
 * The memory belongs to the agent connection: it follows the agent into
 * every conversation it takes part in and reaches no other agent's turns.
 * The other three scopes keep their meaning exactly, and nothing is
 * reclassified — the `agent` scope applies only to what is written after
 * this.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-agent-memory-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'memory-owner-token',
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
});

afterAll(async () => {
  await app.close();
});

/** An agent connection, with an MCP token for it. */
async function createAgent(name: string): Promise<{ id: string; token: string }> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().agent.id as string;

  const token = await app.inject({
    method: 'POST',
    url: `/api/agents/${id}/tokens`,
    headers: { cookie: sessionCookie },
    payload: { label: 'test' },
  });

  return { id, token: token.json().token as string };
}

/** Write a memory resource. */
async function writeMemory(
  title: string,
  data: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, type: 'memory', title, data },
  });
  return { statusCode: response.statusCode, body: response.body };
}

/** The memories the panel shows for one agent. */
async function memoriesOf(agentId: string): Promise<{
  memories: Array<{
    id: string;
    key: string;
    value: unknown;
    updatedAt: string;
    pinned: boolean;
    inBrief: boolean;
  }>;
  budget: number;
  used: number;
  dropped: number;
}> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/agents/${agentId}/memories`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

/** Call an MCP tool with an agent's token. */
async function mcp(token: string, name: string, args: Record<string, unknown>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  return response.body;
}

/**
 * What the MCP tool answered.
 *
 * The response is an event stream, and the tool's own answer is the text
 * inside it: the resource on a good call, the error envelope on a refused
 * one. The envelope is what the contract publishes, so it is read rather
 * than searched for.
 */
function toolAnswer(body: string): { isError: boolean; payload: Record<string, unknown> } {
  const data = /data:\s*(\{.*\})/s.exec(body)?.[1];
  if (!data) throw new Error(`no tool result in the response:\n${body}`);
  const envelope = JSON.parse(data) as {
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
  };
  const text = envelope.result?.content?.[0]?.text ?? '{}';
  return {
    isError: envelope.result?.isError === true,
    payload: JSON.parse(text) as Record<string, unknown>,
  };
}

/** A resource of any kind, written by the owner. */
async function writeResource(
  type: string,
  title: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, type, title, data },
  });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json().resource as { id: string }).id;
}

describe("an agent's own memory", () => {
  it('shows what the agent remembers, and when it was written', async () => {
    const agent = await createAgent('Rememberer');
    const written = await writeMemory('The owner prefers sources', {
      scope: 'agent',
      agentConnectionId: agent.id,
      key: 'prefers',
      value: 'answer with sources',
      tags: [],
    });
    expect(written.statusCode).toBe(201);

    const response = await memoriesOf(agent.id);

    expect(response.memories).toHaveLength(1);
    expect(response.memories[0]?.key).toBe('prefers');
    expect(response.memories[0]?.value).toBe('answer with sources');
    expect(response.memories[0]?.updatedAt).toBeTruthy();
    expect(response.memories[0]?.inBrief).toBe(true);
    expect(response.budget).toBe(6_000);
  });

  it('keeps another agent’s memory out of it', async () => {
    const first = await createAgent('First');
    const second = await createAgent('Second');

    await writeMemory('The first agent knows this', {
      scope: 'agent',
      agentConnectionId: first.id,
      key: 'secret',
      value: 'the first agent only',
      tags: [],
    });

    const response = await memoriesOf(second.id);

    expect(response.memories).toHaveLength(0);
  });

  it('leaves the memories of the other scopes alone', async () => {
    const agent = await createAgent('Unscoped');

    await writeMemory('A workspace memory', {
      scope: 'workspace',
      key: 'shared',
      value: 'not this agent’s',
      tags: [],
    });

    const response = await memoriesOf(agent.id);

    expect(response.memories).toHaveLength(0);
  });

  it('refuses a memory scoped to an agent that names nobody', async () => {
    const written = await writeMemory('Nobody’s memory', {
      scope: 'agent',
      key: 'orphan',
      value: 'belongs to nobody',
      tags: [],
    });

    expect(written.statusCode).toBe(422);
  });

  it('lets the owner write into any agent’s memory', async () => {
    const agent = await createAgent('Owned');

    const written = await writeMemory('The owner says so', {
      scope: 'agent',
      agentConnectionId: agent.id,
      key: 'from-the-owner',
      value: 'written by the owner',
      tags: ['pinned'],
    });

    expect(written.statusCode).toBe(201);
    const response = await memoriesOf(agent.id);
    expect(response.memories[0]?.pinned).toBe(true);
  });

  it('does not let an agent write into another agent’s memory', async () => {
    const writer = await createAgent('Writer');
    const other = await createAgent('Other');

    const body = await mcp(writer.token, 'resource.create', {
      type: 'memory',
      title: 'Not mine',
      data: { scope: 'agent', agentConnectionId: other.id, key: 'injected', value: 'words' },
    });

    expect(body).toContain('isError');
    expect(body).toContain('its own memory');

    const response = await memoriesOf(other.id);
    expect(response.memories).toHaveLength(0);
  });

  it('lets an agent write into its own memory', async () => {
    const agent = await createAgent('Self');

    const body = await mcp(agent.token, 'resource.create', {
      type: 'memory',
      title: 'Mine',
      data: { scope: 'agent', agentConnectionId: agent.id, key: 'own', value: 'my own memory' },
    });

    expect(body).not.toContain('isError');
    const response = await memoriesOf(agent.id);
    expect(response.memories).toHaveLength(1);
    expect(response.memories[0]?.key).toBe('own');
  });
});

/**
 * The other way in.
 *
 * `resource.create` refuses a memory that names somebody else's agent, and
 * that refusal is the whole of an agent's protection: one agent writing into
 * another's memory would put words in its mouth.
 *
 * A memory that already exists is reachable through `resource.update`, which
 * takes the id of the resource it changes. The guard that refuses a foreign
 * agent is called on the way in through `resource.create`; the question here
 * is whether it is also called on the way in through `resource.update`, which
 * is the same kind of write and the same danger.
 */
describe("one agent reaching another agent's memory", () => {
  /** A memory that belongs to one agent, written by the owner. */
  async function memoryOf(
    agentId: string,
    key: string,
    value: string,
  ): Promise<{ id: string; revision: number }> {
    const written = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        type: 'memory',
        title: 'A memory of the agent',
        data: { scope: 'agent', agentConnectionId: agentId, key, value, tags: [] },
      },
    });
    expect(written.statusCode).toBe(201);
    const resource = written.json().resource as { id: string; revision: number };
    return { id: resource.id, revision: resource.revision };
  }

  it('does not let an agent write into another agent’s memory by updating it', async () => {
    const writer = await createAgent('Updater');
    const other = await createAgent('Memory owner');
    const memory = await memoryOf(other.id, 'private', 'the other agent only');

    const body = await mcp(writer.token, 'resource.update', {
      resourceId: memory.id,
      expectedRevision: memory.revision,
      data: {
        scope: 'agent',
        agentConnectionId: other.id,
        key: 'private',
        value: 'words from another agent',
        tags: [],
      },
    });

    // And the other agent still remembers what it remembered.
    const response = await memoriesOf(other.id);
    expect(response.memories[0]?.value).toBe('the other agent only');

    expect(body, 'an agent updated another agent’s memory').toContain('isError');
    expect(body).toContain('its own memory');
  });

  it('does not let an agent take over another agent’s memory', async () => {
    const writer = await createAgent('Thief');
    const other = await createAgent('Memory owner');
    const memory = await memoryOf(other.id, 'private', 'the other agent only');

    const body = await mcp(writer.token, 'resource.update', {
      resourceId: memory.id,
      expectedRevision: memory.revision,
      data: {
        scope: 'agent',
        agentConnectionId: writer.id,
        key: 'private',
        value: 'the other agent only',
        tags: [],
      },
    });

    // The other agent still owns it, and the writer did not inherit it.
    const theirs = await memoriesOf(other.id);
    expect(theirs.memories[0]?.value).toBe('the other agent only');
    const ours = await memoriesOf(writer.id);
    expect(ours.memories, 'the writer inherited the other agent’s memory').toHaveLength(0);

    expect(body, 'an agent took over another agent’s memory').toContain('isError');
  });

  it('does not let an agent read another agent’s memory', async () => {
    // The owner ruled at 07:07 that an agent's own memory is private to it,
    // on reads as well as on writes, and the contract publishes that rule:
    // `resource.get` reads a resource, "not another agent's own memory". The
    // refusal is the published one — `forbidden`, and the message the
    // contract names — so it is read out of the envelope rather than
    // searched for.
    const reader = await createAgent('Reader');
    const other = await createAgent('Memory owner');
    const memory = await memoryOf(other.id, 'private', 'the other agent only');

    const body = await mcp(reader.token, 'resource.get', { resourceId: memory.id });

    expect(body, 'an agent read another agent’s memory').not.toContain('the other agent only');

    const answer = toolAnswer(body);
    expect(answer.isError, 'the read was not refused').toBe(true);
    expect(answer.payload.code, 'the refusal is not the published one').toBe('forbidden');
    expect(answer.payload.message).toBe('An agent may only reach its own memory.');
  });

  it('lets an agent read its own memory', async () => {
    const agent = await createAgent('Owner of its own memory');
    const memory = await memoryOf(agent.id, 'own', 'my own memory');

    const answer = toolAnswer(await mcp(agent.token, 'resource.get', { resourceId: memory.id }));

    expect(answer.isError, 'an agent could not read its own memory').toBe(false);
    expect(answer.payload.id).toBe(memory.id);
    expect((answer.payload.data as { value: string }).value).toBe('my own memory');
  });

  it('leaves the shared scopes and the other resources readable', async () => {
    const agent = await createAgent('Reader of shared things');

    // The three scopes that are shared by design, and a resource that is not
    // a memory at all. The rule is about the agent scope and not about
    // memories in general.
    const shared: string[] = [];
    for (const scope of ['workspace', 'conversation', 'goal']) {
      shared.push(
        await writeResource('memory', `A ${scope} memory`, {
          scope,
          key: 'shared',
          value: 'everybody may read this',
          tags: [],
        }),
      );
    }
    shared.push(
      await writeResource('document', 'A shared document', {
        format: 'markdown',
        content: '# Everyone',
      }),
    );

    for (const resourceId of shared) {
      const answer = toolAnswer(await mcp(agent.token, 'resource.get', { resourceId }));
      expect(answer.isError, `an agent could not read ${resourceId}`).toBe(false);
    }
  });

  it('leaves the owner’s own access untouched', async () => {
    const agent = await createAgent('Owned memory');
    const memory = await memoryOf(agent.id, 'private', 'the owner may read this');

    const answer = toolAnswer(
      await mcp('memory-owner-token', 'resource.get', { resourceId: memory.id }),
    );

    expect(answer.isError, 'the owner could not read the memory').toBe(false);
    expect((answer.payload.data as { value: string }).value).toBe('the owner may read this');
  });
});
