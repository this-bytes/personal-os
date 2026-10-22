// @vitest-environment node
/**
 * The owner can set the autonomy policy, not only read it.
 *
 * WI-082's verdict recorded F5: the effective policy was readable everywhere
 * and writable nowhere, so every limit, every action list and every approval
 * list could only be set by editing the database. This file is the proof that
 * the write path exists, that a change merges into the policy rather than
 * replacing it, that an action the system does not know is refused out loud,
 * and that the mode still lands in both of the places it is kept.
 *
 * The assertions are made against the routes and the published shapes, not
 * against a copy of either, so the contract and the code cannot drift apart
 * quietly.
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
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-autonomy-policy-write-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'autonomy-policy-write-owner-token',
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

/** What the owner may send to a workspace. */
type WorkspacePatch = {
  name?: string;
  description?: string;
  autonomyMode?: 'manual' | 'assisted' | 'autonomous';
  autonomyPolicy?: {
    mode?: 'manual' | 'assisted' | 'autonomous';
    allowedActions?: string[];
    approvalRequired?: string[];
    maxTurns?: number;
    maxDurationSeconds?: number;
    maxSpendUnits?: number;
    dailySpendUnits?: number;
  };
};

/** The owner's own write to a workspace. */
async function patchWorkspace(payload: WorkspacePatch) {
  return app.inject({
    method: 'PATCH',
    url: `/api/workspaces/${workspaceId}`,
    headers: { cookie: sessionCookie },
    payload,
  });
}

/** The workspace as it is stored, with the policy it carries. */
async function storedWorkspace() {
  const response = await app.inject({
    method: 'GET',
    url: `/api/workspaces/${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  return response.json().workspace as {
    autonomyMode: string;
    autonomyPolicy: Record<string, unknown>;
  };
}

/** The policy in force, with the level that decided each value. */
async function effectivePolicy() {
  const response = await app.inject({
    method: 'GET',
    url: `/api/autonomy-policy?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  return response.json().policy as {
    mode: string;
    allowedActions: string[];
    maxTurns: number;
    sources: Record<string, string>;
  };
}

describe('the owner can set the autonomy policy', () => {
  it('sets the limits and the action list the policy carries', async () => {
    const response = await patchWorkspace({
      autonomyPolicy: { maxTurns: 20, allowedActions: ['message.send'] },
    });

    expect(response.statusCode).toBe(200);
    const workspace = await storedWorkspace();
    expect(workspace.autonomyPolicy.maxTurns).toBe(20);
    expect(workspace.autonomyPolicy.allowedActions).toEqual(['message.send']);

    // And the policy in force reads it back, with the workspace named as the
    // level that decided it.
    const policy = await effectivePolicy();
    expect(policy.maxTurns).toBe(20);
    expect(policy.sources.maxTurns).toBe('workspace');
    expect(policy.allowedActions).toEqual(['message.send']);
    expect(policy.sources.allowedActions).toBe('workspace');
  });

  it('merges a change into the policy rather than replacing it', async () => {
    await patchWorkspace({
      autonomyPolicy: { maxTurns: 20, allowedActions: ['message.send'] },
    });

    // A second change says what changes. The turn limit moves; the action
    // list the owner set a moment ago stays.
    await patchWorkspace({ autonomyPolicy: { maxTurns: 30 } });

    const workspace = await storedWorkspace();
    expect(workspace.autonomyPolicy.maxTurns).toBe(30);
    expect(workspace.autonomyPolicy.allowedActions).toEqual(['message.send']);
  });

  it('clears a list only when the owner says so', async () => {
    await patchWorkspace({ autonomyPolicy: { allowedActions: ['message.send'] } });
    await patchWorkspace({ autonomyPolicy: { allowedActions: [] } });

    const workspace = await storedWorkspace();
    expect(workspace.autonomyPolicy.allowedActions).toEqual([]);
  });

  it('writes the mode into both of the places it is kept', async () => {
    const response = await patchWorkspace({ autonomyPolicy: { mode: 'assisted' } });

    expect(response.statusCode).toBe(200);
    const workspace = await storedWorkspace();
    // The column the panel shows, and the policy the resolver reads. They
    // cannot disagree: the mode the owner sets is the mode that is in force.
    expect(workspace.autonomyMode).toBe('assisted');
    expect(workspace.autonomyPolicy.mode).toBe('assisted');
  });

  it('still writes the mode when only the mode is named', async () => {
    const response = await patchWorkspace({ autonomyMode: 'autonomous' });

    expect(response.statusCode).toBe(200);
    const workspace = await storedWorkspace();
    expect(workspace.autonomyMode).toBe('autonomous');
    expect(workspace.autonomyPolicy.mode).toBe('autonomous');
  });

  it('refuses an action the system does not know', async () => {
    const response = await patchWorkspace({
      autonomyPolicy: { allowedActions: ['message.snd'] },
    });

    // A policy that names an action the vocabulary does not know allows
    // nothing. A write that is refused says so out loud, rather than accepting
    // a name that would grant nothing and say so only by silence.
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');

    // And the policy is untouched: a refused change changes nothing.
    const workspace = await storedWorkspace();
    expect(workspace.autonomyPolicy.allowedActions).not.toContain('message.snd');
  });

  it('refuses a limit that is not a limit', async () => {
    const response = await patchWorkspace({ autonomyPolicy: { maxTurns: 0 } });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it('records the change in the audit trail', async () => {
    await patchWorkspace({ autonomyPolicy: { maxTurns: 25 } });

    const response = await app.inject({
      method: 'GET',
      url: `/api/audit?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const entries = response.json().entries as Array<{
      action: string;
      metadata?: { autonomyPolicy?: { maxTurns?: number } };
    }>;
    const written = entries.find(
      (entry) =>
        entry.action === 'workspace.updated' && entry.metadata?.autonomyPolicy?.maxTurns === 25,
    );
    expect(written, 'the audit trail records the policy the owner set').toBeDefined();
  });
});
