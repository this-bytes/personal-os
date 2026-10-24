import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * An ACP-shaped runtime answers in the room.
 *
 * Codex proved one runtime shape; this proves the other one the product
 * supports — the session-oriented shape, where the agent streams its words
 * back over the protocol as `session/update` notifications while the turn is
 * still in flight. The pieces have to be assembled by the room before the
 * answer reads as one message, so this test also proves that.
 *
 * **The runtime behind this is a fixture.** It is deterministic, so the
 * browser suite can gate it, and it says so in the fixture's own words. The
 * real `opencode` binary is proved against this repository's adapter by
 * `scripts/verify-runtime.ts`, on a machine that has it installed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
});

test.describe('an ACP runtime in the room', () => {
  test("the runtime's streamed answer lands in the room as one message", async ({ page }) => {
    test.setTimeout(45_000);
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'OpenCode',
        adapterType: 'acp',
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
        title: 'The session',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await page.getByPlaceholder(/Write a message/).fill('@OpenCode what can you do?');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The answer is the runtime's own message, marked with the adapter that
    // wrote it. The two chunks the runtime streamed are one message here: the
    // room assembles what the protocol delivers in pieces.
    const answer = page.locator('article').filter({ hasText: 'The ACP runtime is here.' });
    await expect(answer.first()).toBeVisible({ timeout: 30_000 });
    await expect(answer.first().getByText('agent', { exact: true })).toBeVisible();
    await expect(answer.first().getByText('acp', { exact: true })).toBeVisible();

    // The second chunk arrived in the same message, not as a second one.
    await expect(answer.first().getByText(/You asked:/)).toBeVisible();
    await expect(
      page.locator('article').filter({ hasText: 'The ACP runtime is here.' }),
    ).toHaveCount(1);

    // The turn is over: nothing is still streaming.
    await expect(page.getByText('streaming', { exact: true })).toHaveCount(0);
  });
});
