/**
 * Which of two grant fields wins when a body carries both.
 *
 * A body may carry a change (`toolGrantChange` -- "apply this to the grant as
 * it is now") and a list (`toolGrants` -- "the grant is exactly this"). The
 * change is a command and the list is a state, and the list is the one of the
 * two that can take a widening back: it says what the grant was when the
 * client read it and nothing about what it is now. So the command is applied
 * and the list is not written. A body that carries only a list is still
 * written exactly as sent, because that is what the list means and that
 * published behaviour does not change.
 *
 * **This file exists because the order was wrong once.** The service branched
 * the list before the change, so a body carrying both wrote the list and the
 * change was silently ignored -- the unsafe path won over the safe one, and
 * the widening another writer had committed was taken back by a save that
 * never touched it. Put the branches back the way they were and the first two
 * cases below go red.
 *
 * The assertions are made against the route the owner uses, so the contract
 * and the code cannot drift apart quietly. Nothing here edits the
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
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-grant-precedence-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'grant-precedence-owner-token',
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
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** An agent connection with the grant it was given. */
async function createAgent(name: string, toolGrants: string[]): Promise<string> {
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
      toolGrants,
    },
  });
  expect(agent.statusCode).toBe(201);
  return agent.json().agent.id as string;
}

/** The grant an agent holds, as the owner reads it. */
async function grants(agentId: string): Promise<string[]> {
  const detail = await app.inject({
    method: 'GET',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
  });
  expect(detail.statusCode).toBe(200);
  return detail.json().agent.toolGrants as string[];
}

/** The owner saves a body that may carry both a change and a list. */
async function save(agentId: string, body: Record<string, unknown>): Promise<number> {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
    payload: body,
  });
  return response.statusCode;
}

/** The revision of the connection's capability set, as the owner reads it. */
async function revision(agentId: string): Promise<number> {
  const detail = await app.inject({
    method: 'GET',
    url: `/api/agents/${agentId}`,
    headers: { cookie: sessionCookie },
  });
  expect(detail.statusCode).toBe(200);
  return detail.json().agent.capabilitiesRevision as number;
}

describe('the precedence of the grant fields', () => {
  it('applies the change and does not write the list when a body carries both', async () => {
    const id = await createAgent('Both', ['conversation.read', 'task.get']);

    const status = await save(id, {
      toolGrants: ['conversation.read'],
      toolGrantChange: { enable: ['task.create'] },
    });

    expect(status).toBe(200);
    // The list would have left task.get out and task.create out with it. The
    // change is applied to the grant as it is now: task.get stays because the
    // owner did not turn it off, and task.create is added because the owner
    // turned it on.
    expect((await grants(id)).sort()).toEqual(['conversation.read', 'task.create', 'task.get']);
  });

  it('does not take back a widening another writer committed', async () => {
    const id = await createAgent('Widened', ['conversation.read']);

    // Another writer widens the grant after this client read it.
    const widened = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/grants`,
      headers: { cookie: sessionCookie },
      payload: { tool: 'task.get' },
    });
    expect(widened.statusCode).toBe(200);

    // The body carries the list the client read AND a change that turns
    // nothing off. The list would take the widening back.
    const status = await save(id, {
      toolGrants: ['conversation.read'],
      toolGrantChange: { enable: [] },
    });

    expect(status).toBe(200);
    expect((await grants(id)).sort()).toEqual(['conversation.read', 'task.get']);
  });

  it('writes a body that carries only a list exactly as it was sent', async () => {
    const id = await createAgent('List only', ['conversation.read']);

    const status = await save(id, { toolGrants: ['task.get'] });

    expect(status).toBe(200);
    expect(await grants(id)).toEqual(['task.get']);
  });

  it('applies a change that turns a tool off to the grant as it is now', async () => {
    const id = await createAgent('Narrowed', ['conversation.read', 'task.get']);

    const status = await save(id, { toolGrantChange: { disable: ['task.get'] } });

    expect(status).toBe(200);
    expect(await grants(id)).toEqual(['conversation.read']);
  });

  it('moves the capabilities revision when the change moves the grant', async () => {
    const id = await createAgent('Revision', ['conversation.read']);
    const before = await revision(id);

    const status = await save(id, { toolGrantChange: { enable: ['task.create'] } });

    expect(status).toBe(200);
    // The revision counts the times the capability set moved. The editor's save
    // moves the grant, so it moves the revision with it -- a save that changed
    // the grant while the revision stayed where it was would admit a later
    // turn against a set nobody had observed.
    expect(await revision(id)).toBeGreaterThan(before);
  });

  it('does not move the capabilities revision when the change moves nothing', async () => {
    const id = await createAgent('Unchanged', ['conversation.read']);
    const before = await revision(id);

    const status = await save(id, { toolGrantChange: { enable: [], disable: [] } });

    expect(status).toBe(200);
    // The revision counts the changes, not the writes.
    expect(await revision(id)).toBe(before);
  });
});
