import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@personal-os/agent-adapters';
import { createAgentService } from '../modules/agents/service.js';
import { createTestDatabase } from './helpers.js';
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
  const resolved: string[] = [];
  return {
    service: createAgentService({
      db: handle.db,
      secretKey,
      registry: createDefaultRegistry(),
      resolveSecret: async (ref) => {
        resolved.push(ref);
        return 'secret-value';
      },
    }),
    secretKey,
    resolved,
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

  it('probes capabilities and records the status', async () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Echo',
      adapterType: 'echo',
      config: {},
    });

    const probed = await service.probe(agent.id);
    expect(probed.status).toBe('connected');
    expect(probed.capabilities?.chat).toBe(true);
  });

  it('records a failure instead of throwing when the adapter cannot connect', async () => {
    const { service } = createService();
    const agent = service.create({
      workspaceId: 'wsp_1',
      name: 'Broken',
      adapterType: 'cli',
      config: { command: 'definitely-not-a-real-binary-xyz' },
    });

    const probed = await service.probe(agent.id);
    expect(probed.status).toBe('degraded');
    expect(probed.lastError).toBeTruthy();
  });
});
