import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { agentConnections } from '../db/schema.js';
import { FeatureRegistry } from '../features/registry.js';
import { forgeMapFeature } from '../features/map/feature.js';

/**
 * The feature seam, on the server.
 *
 * A feature is a unit of product that slots into the runtime. These are the
 * two things that have to be true for that to mean anything: the registry
 * refuses a feature that is not a feature, and the runtime installs the
 * features it has without knowing what they are.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-features-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'features-owner-token',
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
  expect(setup.statusCode).toBe(201);

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

describe('the feature registry', () => {
  it('refuses two features with the same id', () => {
    const registry = new FeatureRegistry().register(forgeMapFeature);

    expect(() => registry.register(forgeMapFeature)).toThrow(/registered twice/);
  });

  it('refuses a feature whose id is not an id', () => {
    const registry = new FeatureRegistry();

    expect(() =>
      registry.register({
        ...forgeMapFeature,
        manifest: { ...forgeMapFeature.manifest, id: 'not a feature id' },
      }),
    ).toThrow();
  });

  it('lists what it holds', () => {
    const registry = new FeatureRegistry().register(forgeMapFeature);

    expect(registry.has('feat_forge_map')).toBe(true);
    expect(registry.list().map((manifest) => manifest.id)).toEqual(['feat_forge_map']);
  });
});

describe('the Map, on the server', () => {
  it('is installed without the runtime knowing what it is', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/features/map?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
  });

  it('asks for a session, like every other route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/features/map?workspaceId=${workspaceId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('answers in one payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/features/map?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });

    const body = response.json() as {
      workspaceId: string;
      agents: unknown[];
      threads: unknown[];
      counters: Array<{ key: string; value: number }>;
      tiles: unknown[];
      pulse: unknown[];
    };

    expect(body.workspaceId).toBe(workspaceId);
    expect(Array.isArray(body.agents)).toBe(true);
    expect(Array.isArray(body.threads)).toBe(true);
    expect(Array.isArray(body.tiles)).toBe(true);
    expect(Array.isArray(body.pulse)).toBe(true);
  });

  it('counts what it shows, and never shows a ratio', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/features/map?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });

    const body = response.json() as {
      agents: unknown[];
      threads: unknown[];
      tiles: unknown[];
      counters: Array<{ key: string; value: number }>;
    };

    const counter = (key: string): number | undefined =>
      body.counters.find((entry) => entry.key === key)?.value;

    expect(counter('agents')).toBe(body.agents.length);
    expect(counter('threads')).toBe(body.threads.length);
    expect(counter('built')).toBe(body.tiles.length);
    expect(counter('waiting')).toBeGreaterThanOrEqual(0);
  });

  it('draws the same picture for the same data', async () => {
    // The picture has to be something: an empty workspace draws an empty
    // picture, and an empty picture cannot be the wrong one.
    const now = new Date().toISOString();
    app.services.runtime.db
      .insert(agentConnections)
      .values({
        id: 'agt_picture',
        workspaceId,
        name: 'The agent',
        adapterType: 'acp',
        configRef: 'cfg_1',
        toolGrants: null,
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          persistentSessions: false,
          backgroundTasks: false,
          cancel: true,
          approvals: true,
          artifacts: false,
        },
        status: 'connected',
        lastError: null,
        lastConnectedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const ask = async (): Promise<unknown> => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/features/map?workspaceId=${workspaceId}`,
        headers: { cookie: sessionCookie },
      });
      expect(response.statusCode).toBe(200);
      return response.json();
    };

    const first = await ask();
    const second = await ask();

    expect(
      second,
      'the Map drew a different picture for the same data: the picture is not a function of the workspace',
    ).toEqual(first);
  });
});
