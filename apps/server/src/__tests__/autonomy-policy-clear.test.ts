// @vitest-environment node
/**
 * Clearing the allow-list widens the policy in force.
 *
 * WI-128's verification found the edge. The write path landed on 2026-10-22 and
 * it took an empty list: the stored list was cleared, and the resolver reads a
 * policy that names no action as no opinion — so the effective set became every
 * action in the vocabulary. The owner who tightened the policy got everything,
 * and nothing said so.
 *
 * WI-130 refuses the empty list and publishes what an empty one would have
 * meant. This file is the proof:
 *
 * - the write is refused out loud, and the policy in force is never the whole
 *   vocabulary;
 * - a patch that names no list still leaves the list alone;
 * - the stored list and the effective list are told apart, because a stored
 *   empty list is the absence of an opinion and not a policy that allows
 *   nothing;
 * - an action the system does not know is still refused aloud, and a refusal
 *   still changes nothing;
 * - the rule the contract publishes is the rule the code runs.
 *
 * Every case gets a workspace of its own, so no case can pass or fail on what
 * another case left behind. The assertions are made against the routes and the
 * published contract, not against a copy of either.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

let app: FastifyInstance;
let sessionCookie = '';
let dataDir = '';

/** The repository root, so the contract is read as it is published. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** The published action vocabulary, in full. */
const VOCABULARY = ['message.send', 'tool.call', 'artifact.create'];

beforeAll(async () => {
  // The throwaway database lives in a temporary directory, not in the source
  // tree.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-autonomy-policy-clear-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'autonomy-policy-clear-owner-token',
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
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** A workspace of this case's own. */
async function newWorkspace(name: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
    payload: { name },
  });
  expect(response.statusCode).toBe(201);
  return response.json().workspace.id as string;
}

/** The owner's own write to a workspace. */
async function patchWorkspace(workspaceId: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'PATCH',
    url: `/api/workspaces/${workspaceId}`,
    headers: { cookie: sessionCookie },
    payload,
  });
}

/** The workspace as it is stored, with the policy it carries. */
async function storedWorkspace(workspaceId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/workspaces/${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().workspace as {
    autonomyPolicy: { allowedActions?: string[]; maxTurns?: number };
    updatedAt: string;
  };
}

/** The policy in force, with the level that decided each value. */
async function effectivePolicy(workspaceId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/autonomy-policy?workspaceId=${workspaceId}`,
    headers: { cookie: sessionCookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json().policy as {
    allowedActions: string[];
    maxTurns: number;
    sources: Record<string, string>;
  };
}

/** The message of a refusal, in the shared error envelope. */
function refusalMessage(response: { json(): unknown }): string {
  const body = response.json() as { error?: { code?: string; message?: string } };
  return String(body.error?.message ?? '');
}

describe('clearing the allow-list widens the policy in force', () => {
  it('refuses the empty list, and the policy in force is never the whole vocabulary', async () => {
    const workspaceId = await newWorkspace('Clearing is refused');
    await patchWorkspace(workspaceId, { autonomyPolicy: { allowedActions: ['message.send'] } });

    const refused = await patchWorkspace(workspaceId, { autonomyPolicy: { allowedActions: [] } });

    // The write is refused out loud, in the shared error envelope.
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation_failed');

    // And it says what to write instead, so the owner is not left guessing.
    expect(refusalMessage(refused), 'the refusal says what to write instead').toMatch(
      /name the actions|leave the list out/i,
    );

    // Nothing changed: the stored list, and the list in force.
    const stored = await storedWorkspace(workspaceId);
    expect(stored.autonomyPolicy.allowedActions).toEqual(['message.send']);

    const effective = await effectivePolicy(workspaceId);
    expect(
      effective.allowedActions,
      'clearing must never widen the policy to every action',
    ).not.toEqual(VOCABULARY);
    expect(effective.allowedActions).toEqual(['message.send']);
    expect(effective.sources.allowedActions).toBe('workspace');
  });

  it('leaves the list alone when the patch names none', async () => {
    const workspaceId = await newWorkspace('Absent is left alone');
    await patchWorkspace(workspaceId, { autonomyPolicy: { allowedActions: ['message.send'] } });

    // A change says what changes: the turn limit moves, the list stays.
    const response = await patchWorkspace(workspaceId, { autonomyPolicy: { maxTurns: 30 } });
    expect(response.statusCode).toBe(200);

    const stored = await storedWorkspace(workspaceId);
    expect(stored.autonomyPolicy.allowedActions).toEqual(['message.send']);
    expect(stored.autonomyPolicy.maxTurns).toBe(30);

    const effective = await effectivePolicy(workspaceId);
    expect(effective.allowedActions).toEqual(['message.send']);
  });

  it('tells the stored list apart from the effective list', async () => {
    // A workspace that never named an action. Its stored list is empty, and
    // the stored default is empty too — an empty list is the absence of an
    // opinion, not a policy that allows nothing.
    const neverNamed = await newWorkspace('Never named one');
    const stored = await storedWorkspace(neverNamed);
    expect(stored.autonomyPolicy.allowedActions).toEqual([]);

    const effective = await effectivePolicy(neverNamed);
    expect(effective.allowedActions).toEqual(VOCABULARY);
    expect(effective.sources.allowedActions).toBe('default');

    // A workspace that named one. The stored list is what the owner wrote,
    // and the list in force is what it resolved to.
    const named = await newWorkspace('Named one');
    await patchWorkspace(named, { autonomyPolicy: { allowedActions: ['message.send'] } });

    const namedStored = await storedWorkspace(named);
    expect(namedStored.autonomyPolicy.allowedActions).toEqual(['message.send']);

    const namedEffective = await effectivePolicy(named);
    expect(namedEffective.allowedActions).toEqual(['message.send']);
    expect(namedEffective.sources.allowedActions).toBe('workspace');

    // The two lists are told apart: what is stored is not what is in force.
    expect(stored.autonomyPolicy.allowedActions).not.toEqual(effective.allowedActions);
  });

  it('still refuses an action the system does not know, and a refusal changes nothing', async () => {
    const workspaceId = await newWorkspace('An action the system does not know');
    await patchWorkspace(workspaceId, { autonomyPolicy: { allowedActions: ['message.send'] } });
    const before = await storedWorkspace(workspaceId);

    const refused = await patchWorkspace(workspaceId, {
      autonomyPolicy: { allowedActions: ['message.snd'] },
    });

    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation_failed');

    // A refused change changes nothing: not the list, not the row.
    const after = await storedWorkspace(workspaceId);
    expect(after.autonomyPolicy.allowedActions).toEqual(['message.send']);
    expect(after.updatedAt).toBe(before.updatedAt);

    const effective = await effectivePolicy(workspaceId);
    expect(effective.allowedActions).toEqual(['message.send']);
  });

  it('runs the rule the contract publishes', async () => {
    // The contract publishes the other half of the intersection, and what the
    // write does now.
    const contract = fs
      .readFileSync(path.join(repoRoot, 'CONTRACTS.md'), 'utf8')
      .replace(/\s+/g, ' ');
    expect(
      contract,
      'the contract publishes what happens when no policy names any action',
    ).toContain(
      'When no policy names any action, the effective set is every action in the vocabulary',
    );
    expect(contract, 'the contract publishes that an empty list is refused').toContain(
      'An absent list is left alone and an empty list is refused',
    );
    expect(
      contract,
      'the contract tells a client that cleared the list what happens now',
    ).toContain('A client that cleared the list under the rule in force got every action');

    // And the code runs it: a policy that names no action restricts nothing,
    // and a write that names an empty list is refused.
    const workspaceId = await newWorkspace('The rule the contract publishes');
    const effective = await effectivePolicy(workspaceId);
    expect(effective.allowedActions).toEqual(VOCABULARY);
    expect(effective.sources.allowedActions).toBe('default');

    const refused = await patchWorkspace(workspaceId, { autonomyPolicy: { allowedActions: [] } });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation_failed');
  });
});
