import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * The preset catalogue, served to the client, and the connection a preset
 * starts.
 *
 * The catalogue is published data: it names the credential a connection
 * needs and never a value, and it says which of its entries have been
 * demonstrated and which have not.
 */

let app: FastifyInstance;
let dataDir: string;
let sessionCookie = '';
let workspaceId = '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-agent-presets-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'agent-presets-owner-token',
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
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** The catalogue, as the client receives it. */
async function presets(query = ''): Promise<
  Array<{
    id: string;
    adapterType: string;
    name: string;
    description: string;
    config: Record<string, unknown>;
    persona: { role?: string; instructions?: string };
    requires: string[];
    credential?: string;
    verified: boolean;
    evidence?: {
      runtime: string;
      version?: string;
      demonstratedOn: string;
      observed: string;
    };
    runtime?: string;
  }>
> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/agent-presets${query}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().presets;
}

/** Create a connection, the way the client does. */
async function createConnection(payload: Record<string, unknown>): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, ...payload },
  });
  return { statusCode: response.statusCode, body: response.json() };
}

describe('the preset catalogue route', () => {
  it('refuses a caller that is not the owner', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agent-presets' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('unauthorized');
  });

  it('serves a preset for every adapter type', async () => {
    const all = await presets();
    const types = new Set(all.map((preset) => preset.adapterType));

    expect(types).toEqual(
      new Set(['cli', 'acp', 'a2a', 'http', 'model', 'echo', 'mcp', 'codex', 'codex-app-server']),
    );
  });

  it('serves only the presets of the type that was asked for', async () => {
    const cli = await presets('?adapterType=cli');

    expect(cli.length).toBeGreaterThan(0);
    for (const preset of cli) {
      expect(preset.adapterType).toBe('cli');
    }
  });

  it('refuses a type it does not know, with the shared error envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/agent-presets?adapterType=nonsense',
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it('carries no credential value in any preset', async () => {
    for (const preset of await presets()) {
      const config = JSON.stringify(preset.config);
      expect(config).not.toContain('apiKey"');
      expect(config).not.toContain('authToken"');
      expect(config).not.toContain('apiKeyRef');
      expect(config).not.toContain('authTokenRef');
    }
  });

  it('says of every runtime preset whether it has been demonstrated', async () => {
    const runtimePresets = (await presets()).filter((preset) => preset.runtime !== undefined);

    expect(runtimePresets.length).toBeGreaterThan(0);
    for (const preset of runtimePresets) {
      if (preset.verified) {
        // A claim of demonstration names what it rested on.
        expect(
          preset.evidence,
          `${preset.id} claims a demonstration and names nothing`,
        ).toBeDefined();
        expect(preset.evidence?.runtime).toBeTruthy();
        expect(preset.evidence?.observed.length ?? 0).toBeGreaterThan(0);
      } else {
        expect(preset.description.toLowerCase()).toContain('not been demonstrated');
      }
    }
  });

  it('carries no credential value in a preset’s evidence', async () => {
    // The evidence says what was observed. It never says with which secret.
    for (const preset of await presets()) {
      const evidence = JSON.stringify(preset.evidence ?? {});
      expect(evidence.toLowerCase()).not.toContain('bearer ');
      expect(evidence.toLowerCase()).not.toContain('sk-');
    }
  });
});

describe('a connection started from a preset', () => {
  it('takes the preset configuration and the preset persona', async () => {
    const created = await createConnection({
      name: 'From the echo preset',
      adapterType: 'echo',
      presetId: 'echo-local',
      config: {},
    });

    expect(created.statusCode).toBe(201);
    const agent = created.body['agent'] as {
      id: string;
      persona?: { role?: string; instructions?: string };
    };
    expect(agent.persona?.role).toBe('Echo tester');
    expect(agent.persona?.instructions?.length).toBeGreaterThan(0);

    const stored = app.services.agents.readConfig(agent.id) as {
      adapterType: string;
      reply?: string;
    };
    expect(stored.adapterType).toBe('echo');
    expect(stored.reply).toBe('pong');
  });

  it('keeps the owner’s edits over the preset', async () => {
    const created = await createConnection({
      name: 'Edited from the preset',
      adapterType: 'echo',
      presetId: 'echo-local',
      config: { reply: 'edited by the owner' },
    });

    expect(created.statusCode).toBe(201);
    const agent = created.body['agent'] as { id: string };
    const stored = app.services.agents.readConfig(agent.id) as { reply?: string };
    expect(stored.reply).toBe('edited by the owner');
  });

  it('keeps the owner’s persona over the preset’s', async () => {
    const created = await createConnection({
      name: 'Own persona',
      adapterType: 'echo',
      presetId: 'echo-local',
      config: {},
      persona: { role: 'The owner’s own role' },
    });

    const agent = created.body['agent'] as { persona?: { role?: string } };
    expect(agent.persona?.role).toBe('The owner’s own role');
  });

  it('refuses a preset that belongs to another adapter type', async () => {
    const created = await createConnection({
      name: 'Mismatched preset',
      adapterType: 'cli',
      presetId: 'echo-local',
      config: { command: 'something' },
    });

    expect(created.statusCode).toBe(422);
    expect(created.body['error'] as { code: string }).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('refuses a preset it does not have', async () => {
    const created = await createConnection({
      name: 'Unknown preset',
      adapterType: 'echo',
      presetId: 'no-such-preset',
      config: {},
    });

    expect(created.statusCode).toBe(404);
  });

  it('refuses a configuration that does not parse for the adapter type', async () => {
    const created = await createConnection({
      name: 'Broken configuration',
      adapterType: 'cli',
      presetId: 'cli-command-line',
      config: { command: '' },
    });

    expect(created.statusCode).toBe(422);
    expect((created.body['error'] as { code: string }).code).toBe('validation_failed');
  });

  it('never returns the credential it was given', async () => {
    const created = await createConnection({
      name: 'With a credential',
      adapterType: 'model',
      presetId: 'model-api',
      config: { baseUrl: 'https://api.example.com/v1', model: 'gpt-test' },
      secrets: { apiKey: 'sk-super-secret' },
    });

    expect(created.statusCode).toBe(201);
    expect(JSON.stringify(created.body)).not.toContain('sk-super-secret');

    const agent = created.body['agent'] as { id: string };
    const stored = app.services.agents.readConfig(agent.id) as {
      apiKeyRef?: string;
      apiKey?: string;
    };
    expect(stored.apiKeyRef).toBeTruthy();
    expect(stored.apiKey).toBeUndefined();
  });
});
