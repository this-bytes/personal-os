import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * Two turns in one conversation.
 *
 * A conversation is more than one turn. The owner asks again, the runtime
 * answers again, and the second answer is about the second question — the room
 * is a conversation, not a series of prompts that happen to share a page.
 *
 * The runtime here is the repository's own App Server double, told to hand the
 * thread's history back: the App Server deprecated full-history hydration for
 * paginated threads, so a runtime that hydrates a long thread may replay it,
 * and the room must not show the thread's earlier answer as this turn's.
 *
 * The installed App Server 0.163.0 replays nothing, and that is measured in
 * `docs/demonstration-two-turns-2026-10-25.md`. This test is the part that
 * has to hold on every machine, on every run.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const doublePath = path.join(
  repoRoot,
  'packages',
  'agent-adapters',
  'src',
  '__tests__',
  'fixtures',
  'fake-app-server.mjs',
);

const created: string[] = [];
const stores: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
  for (const store of stores.splice(0, stores.length)) {
    fs.rmSync(path.dirname(store), { recursive: true, force: true });
  }
});

/** The double's own record of what it was asked. */
interface Store {
  threads: string[];
  resumed: Array<{ threadId: string }>;
  turns: Array<{ turnId: string; threadId: string }>;
}

/** A store for the double to write into. */
function freshStore(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-e2e-two-turns-'));
  const storePath = path.join(directory, 'store.json');
  fs.writeFileSync(
    storePath,
    JSON.stringify({
      threads: [],
      started: [],
      resumed: [],
      turns: [],
      steers: [],
      approvals: [],
      interrupts: [],
    }),
  );
  stores.push(storePath);
  return storePath;
}

function readStore(storePath: string): Store {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
}

test.describe('two turns in one conversation', () => {
  test('the second turn answers with its own words and continues the same thread', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const storePath = freshStore();

    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Codex',
        adapterType: 'codex-app-server',
        config: {
          command: process.execPath,
          args: [doublePath],
          env: {
            FAKE_APP_SERVER_STORE: storePath,
            // The runtime hands the thread's history back, in both the shapes
            // a replay takes.
            FAKE_APP_SERVER_REPLAY: 'both',
          },
        },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    const agentId = (await createdAgent.json()).agent.id as string;
    created.push(agentId);

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'Two turns',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    const composer = page.getByPlaceholder(/Write a message/);
    const send = page.getByRole('button', { name: 'Send message' });
    const answers = page.locator('article[data-align="start"]');

    await composer.fill('@Codex the first question');
    await send.click();
    await expect(answers.filter({ hasText: 'APP-SERVER-OK turn 1' })).toBeVisible({
      timeout: 30_000,
    });

    await composer.fill('@Codex the second question');
    await send.click();
    await expect(answers.filter({ hasText: 'APP-SERVER-OK turn 2' })).toBeVisible({
      timeout: 30_000,
    });

    // Two answers, one for each question.
    await expect(answers).toHaveCount(2);

    // The second answer is the second answer. The thread's earlier answer is
    // not this turn's work, and a room that showed it would answer the owner
    // with the turn's answer twice.
    const second = answers.filter({ hasText: 'APP-SERVER-OK turn 2' });
    await expect(second).not.toContainText('turn 1');

    // The trace is a record of this turn: the call the turn made is one row,
    // and the call the thread made a turn ago is not a row here.
    await expect(page.getByText('tool.started', { exact: true })).toHaveCount(1);

    // It was one conversation: one thread, and the second turn resumed it
    // through the runtime rather than starting a new one.
    const store = readStore(storePath);
    expect(store.threads).toHaveLength(1);
    expect(store.turns).toHaveLength(2);
    expect(store.turns[0]?.threadId).toBe(store.threads[0]);
    expect(store.turns[1]?.threadId).toBe(store.threads[0]);
    expect(store.resumed.map((entry) => entry.threadId)).toContain(store.threads[0]);
  });
});
