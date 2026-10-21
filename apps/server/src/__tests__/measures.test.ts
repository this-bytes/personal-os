import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { measuresSchema } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createAuditService } from '../modules/audit/service.js';
import { createMeasuresService, type MeasuresService } from '../modules/measures/service.js';
import { createTestStack, type TestStack } from './helpers.js';

/**
 * The product's two measures of itself.
 *
 * The measures are read from the data the product already keeps, so the proof
 * is written as data: a resource that records an agent as its author, one
 * that records the owner, and the two kinds that record no author at all. A
 * number nobody can reproduce from real rows is a claim, not a measure.
 */

/** The id form of an agent connection, as it appears in `createdBy`. */
const AGENT_ID = 'agt_2f9c1d4e5a6b7c8d9e0f1a2b3c4d5e6f';
/** The id form of the owner's user record. */
const OWNER_ID = 'usr_9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

/** A measures service over a migrated, in-memory database. */
function testMeasures(): MeasuresService {
  stack = createTestStack();
  return createMeasuresService({
    resources: stack.resources,
    audit: createAuditService(stack.handle.db),
  });
}

describe('the measures service', () => {
  it('counts a resource that records an agent as its author, and does not count one the owner created', () => {
    const measures = testMeasures();
    stack!.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Written by an agent',
      data: { format: 'markdown', content: '# Agent' },
      createdBy: AGENT_ID,
    });
    stack!.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Written by the owner',
      data: { format: 'markdown', content: '# Owner' },
      createdBy: OWNER_ID,
    });

    const published = measures.measures('wsp_1');

    expect(published.agentAuthoredResources.count).toBe(1);
    expect(published.agentAuthoredResources.denominator).toBe(2);
    expect(published.agentAuthoredResources.ratio).toBe(0.5);
  });

  it('leaves the resources that record no author in the denominator and never in the count', () => {
    const measures = testMeasures();
    // An automation and a task keep no author at all: their tables have no
    // column to keep one in, so the projection says 'system' whatever the
    // caller was. They are in the denominator and can never be in the count,
    // which is what makes the first measure a floor.
    stack!.resources.create({
      workspaceId: 'wsp_1',
      type: 'automation',
      title: 'Nightly',
      data: {
        trigger: { type: 'schedule', everyMinutes: 5 },
        action: { type: 'agent.prompt', agentConnectionId: AGENT_ID },
      },
      createdBy: AGENT_ID,
    });
    stack!.resources.create({
      workspaceId: 'wsp_1',
      type: 'task',
      title: 'Ship the thing',
      data: {},
      createdBy: AGENT_ID,
    });

    const published = measures.measures('wsp_1');

    expect(published.agentAuthoredResources.count).toBe(0);
    expect(published.agentAuthoredResources.denominator).toBe(2);
    expect(published.agentAuthoredResources.ratio).toBe(0);
  });

  it('answers a count of 0 and a null ratio when there is no denominator', () => {
    const measures = testMeasures();

    const published = measures.measures('wsp_empty');

    // A share of nothing is not zero: the count is still returned, and the
    // ratio is null rather than a number over a denominator of zero.
    expect(published.agentAuthoredResources).toEqual({ count: 0, denominator: 0, ratio: null });
    expect(published.agentPerformedOperations).toEqual({ count: 0, denominator: 0, ratio: null });
  });

  it('counts the audited operations an agent performed, over every audited operation', () => {
    const measures = testMeasures();
    const audit = createAuditService(stack!.handle.db);

    audit.record({
      workspaceId: 'wsp_1',
      actorType: 'human',
      actorId: OWNER_ID,
      action: 'resource.created',
    });
    audit.record({
      workspaceId: 'wsp_1',
      actorType: 'agent',
      actorId: AGENT_ID,
      action: 'resource.created',
    });
    audit.record({
      workspaceId: 'wsp_1',
      actorType: 'system',
      actorId: 'system',
      action: 'automation.run',
    });
    // The product writes no 'failure' today, but the count does not filter on
    // the result: the denominator is the attempts, not the confirmed
    // completions.
    audit.record({
      workspaceId: 'wsp_1',
      actorType: 'human',
      actorId: OWNER_ID,
      action: 'resource.updated',
      result: 'failure',
    });

    const published = measures.measures('wsp_1');

    expect(published.agentPerformedOperations.count).toBe(1);
    expect(published.agentPerformedOperations.denominator).toBe(4);
    expect(published.agentPerformedOperations.ratio).toBe(0.25);
  });

  it('counts only the workspace it was asked about', () => {
    const measures = testMeasures();
    stack!.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Here',
      data: { format: 'markdown', content: '# Here' },
      createdBy: AGENT_ID,
    });
    stack!.resources.create({
      workspaceId: 'wsp_2',
      type: 'document',
      title: 'Elsewhere',
      data: { format: 'markdown', content: '# Elsewhere' },
      createdBy: AGENT_ID,
    });

    const published = measures.measures('wsp_1');

    expect(published.agentAuthoredResources.count).toBe(1);
    expect(published.agentAuthoredResources.denominator).toBe(1);
  });
});

describe('the measures route', () => {
  let app: FastifyInstance;
  let dataDir: string;
  let sessionCookie = '';
  let workspaceId = '';
  /** A workspace of its own, so the empty reading has somewhere to be asked. */
  let emptyWorkspaceId = '';
  let agentToken = '';

  beforeAll(async () => {
    // The throwaway database lives in a temporary directory, not in the
    // source tree.
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-measures-'));
    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: dataDir,
      PERSONAL_OS_OWNER_TOKEN: 'measures-owner-token',
      PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
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

    const empty = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: sessionCookie },
      payload: { name: 'Empty' },
    });
    emptyWorkspaceId = empty.json().workspace.id as string;

    // An agent, with the one tool it needs to author a resource.
    const agent = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        name: 'Author',
        adapterType: 'echo',
        config: { reply: 'hi' },
        toolGrants: ['resource.create'],
      },
    });
    const agentId = agent.json().agent.id as string;

    const token = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/tokens`,
      headers: { cookie: sessionCookie },
      payload: { label: 'test' },
    });
    agentToken = token.json().token as string;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** The measures the route publishes for the default workspace. */
  async function measures(): Promise<{
    workspaceId: string;
    agentAuthoredResources: { count: number; denominator: number; ratio: number | null };
    agentPerformedOperations: { count: number; denominator: number; ratio: number | null };
  }> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/measures?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('answers the published shape for a workspace', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/measures?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const parsed = measuresSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(body.workspaceId).toBe(workspaceId);
  });

  it('refuses a caller with no session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/measures?workspaceId=${workspaceId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses an agent token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/measures?workspaceId=${workspaceId}`,
      headers: { authorization: `Bearer ${agentToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a request with no workspace', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/measures',
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(422);
  });

  it('answers a count of 0 and a null ratio for a workspace that holds nothing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/measures?workspaceId=${emptyWorkspaceId}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.agentAuthoredResources).toEqual({ count: 0, denominator: 0, ratio: null });
    expect(body.agentPerformedOperations).toEqual({ count: 0, denominator: 0, ratio: null });
  });

  it('counts the resource an agent created, and leaves the owner’s own out of the count', async () => {
    // The owner creates a resource of their own. It is in the denominator,
    // and it is not agent-authored.
    const own = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        type: 'document',
        title: 'The owner’s own',
        data: { format: 'markdown', content: '# Owner' },
      },
    });
    expect(own.statusCode).toBe(201);

    const afterOwner = await measures();
    expect(afterOwner.agentAuthoredResources.count).toBe(0);
    expect(afterOwner.agentAuthoredResources.denominator).toBe(1);
    expect(afterOwner.agentPerformedOperations.count).toBe(0);

    // The agent creates one through the MCP surface, which is where an
    // agent's authorship comes from.
    const authored = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'resource.create',
          arguments: {
            workspaceId,
            type: 'document',
            title: 'The agent’s',
            data: { format: 'markdown', content: '# Agent' },
          },
        },
      },
    });
    expect(authored.body).not.toContain('isError');

    const afterAgent = await measures();
    expect(afterAgent.agentAuthoredResources.count).toBe(1);
    expect(afterAgent.agentAuthoredResources.denominator).toBe(2);
    expect(afterAgent.agentAuthoredResources.ratio).toBe(0.5);
  });
});
