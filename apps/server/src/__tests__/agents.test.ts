import { afterEach, describe, expect, it } from 'vitest';
import { createAgentService } from '../modules/agents/service.js';
import { createTestDatabase } from './helpers.js';
import { executions, queueJobs } from '../db/schema.js';
import { Queue } from '../queue/client.js';
import type { DatabaseHandle } from '../db/client.js';
import { randomBytes } from 'node:crypto';

let handle: DatabaseHandle | null = null;

afterEach(() => {
  handle?.close();
  handle = null;
});

function createService() {
  handle = createTestDatabase();
  const secretKey = randomBytes(32);
  const queue = new Queue(handle.db);
  return {
    service: createAgentService({
      db: handle.db,
      secretKey,
      queue,
    }),
    secretKey,
    queue,
  };
}

describe('agent connections', () => {
  it('stores the credential separately from the configuration', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Model agent',
      adapterType: 'model',
      config: { baseUrl: 'https://api.example.com', model: 'gpt-test' },
      secrets: { apiKey: 'sk-super-secret' },
    });

    // The configuration reference is opaque; the credential is never in it.
    const config = service.readConfig(agent.id);
    expect(config.adapterType).toBe('model');
    expect((config as { apiKeyRef?: string }).apiKeyRef).toBeTruthy();
    expect((config as { apiKey?: string }).apiKey).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain('sk-super-secret');
  });

  it('never returns a credential to a client', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Model agent',
      adapterType: 'model',
      config: { baseUrl: 'https://api.example.com', model: 'gpt-test' },
      secrets: { apiKey: 'sk-super-secret' },
    });

    const detail = service.get(agent.id);
    expect(JSON.stringify(detail)).not.toContain('sk-super-secret');
  });

  it('keeps the stored credential when the configuration is edited', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Model agent',
      adapterType: 'model',
      config: { baseUrl: 'https://api.example.com', model: 'gpt-test' },
      secrets: { apiKey: 'sk-super-secret' },
    });

    const before = service.readConfig(agent.id) as { apiKeyRef?: string };
    service.update(agent.id, { config: { model: 'gpt-updated' } });

    const after = service.readConfig(agent.id) as { apiKeyRef?: string; model: string };
    expect(after.model).toBe('gpt-updated');
    expect(after.apiKeyRef).toBe(before.apiKeyRef);
  });

  it('replaces the credential when a new one is supplied', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Model agent',
      adapterType: 'model',
      config: { baseUrl: 'https://api.example.com', model: 'gpt-test' },
      secrets: { apiKey: 'sk-first' },
    });

    const before = service.readConfig(agent.id) as { apiKeyRef?: string };
    service.update(agent.id, { secrets: { apiKey: 'sk-second' } });

    const after = service.readConfig(agent.id) as { apiKeyRef?: string };
    expect(after.apiKeyRef).toBeTruthy();
    expect(after.apiKeyRef).not.toBe(before.apiKeyRef);
  });

  it('asks the worker to probe instead of connecting itself', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Echo',
      adapterType: 'echo',
      config: {},
    });

    const requested = service.requestProbe(agent.id);

    // The server records the request; it does not run the adapter.
    expect(requested.status).toBe('unknown');
    expect(requested.capabilities).toBeNull();

    const jobs = handle!.db.select().from(queueJobs).all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.type).toBe('agent.probe');
    expect(jobs[0]?.payload).toMatchObject({ agentConnectionId: agent.id });
  });

  it('records the probe as an execution before it is queued', () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Echo',
      adapterType: 'echo',
      config: {},
    });

    service.requestProbe(agent.id);

    const rows = handle!.db.select().from(executions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.agentConnectionId).toBe(agent.id);
    expect(rows[0]?.status).toBe('queued');
    expect(rows[0]?.conversationId).toBeNull();
  });
});
