import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * A Codex-shaped runtime answers in the room.
 *
 * The other browser tests use the built-in echo adapter, which proves the
 * room but not a runtime. This one runs the product's own Codex adapter over
 * a runtime that speaks Codex's event stream, and checks the two things that
 * are different when a runtime is behind the turn: the answer is marked with
 * the adapter that wrote it, and the commands the runtime ran appear in the
 * trace beside its answer.
 *
 * **The runtime behind this is a fixture.** It is deterministic, so the
 * browser suite can gate it, and it says so in the fixture's own words. The
 * real `codex` binary is proved against this repository's adapter by
 * `scripts/verify-runtime.ts`, on a machine that has it installed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'fake-codex-agent.mjs');

const created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
});

test.describe('a Codex runtime in the room', () => {
  test("the runtime's answer and the commands it ran both land in the room", async ({ page }) => {
    test.setTimeout(45_000);
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Codex',
        adapterType: 'codex',
        config: {
          command: process.execPath,
          args: [fixturePath],
        },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    const agentId = (await createdAgent.json()).agent.id as string;
    created.push(agentId);

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The runtime',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await page.getByPlaceholder(/Write a message/).fill('@Codex what can you do?');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The answer arrives as the runtime's own message, marked with the
    // adapter that wrote it — not with the built-in echo.
    const answer = page.locator('article').filter({ hasText: 'Done. You asked:' });
    await expect(answer.first()).toBeVisible({ timeout: 30_000 });
    await expect(answer.first().getByText('agent', { exact: true })).toBeVisible();
    await expect(answer.first().getByText('codex', { exact: true })).toBeVisible();

    // The commands the runtime ran are in the trace, not only in its words.
    // A runtime that says what it did is the difference between a turn and an
    // answer.
    await expect(page.getByText('tool.started')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('tool.completed')).toBeVisible();
    await expect(page.getByText('message.completed')).toBeVisible();

    // The turn is over: nothing is still streaming.
    await expect(page.getByText('streaming', { exact: true })).toHaveCount(0);
  });
});
