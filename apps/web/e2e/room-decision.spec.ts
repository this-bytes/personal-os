import { expect, test } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * The owner answers in the room.
 *
 * An agent that needs a decision asks for one, and the request appears in
 * the conversation it was made in. The owner answers there, without leaving
 * the room to go and look for what the room is asking of them.
 */

const created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
});

test.describe('a request answered in the room', () => {
  test('the request appears in the room and the owner answers it there', async ({ page }) => {
    test.setTimeout(45_000);
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Asker',
        adapterType: 'echo',
        config: {
          reply: 'All done.',
          ask: { summary: 'May I read the project?' },
        },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    const agentId = (await createdAgent.json()).agent.id as string;
    created.push(agentId);

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The request',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await page.getByPlaceholder(/Write a message/).fill('@Asker please start');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The request shows up in the room itself, not on another page.
    const waiting = page.getByText('Waiting on you');
    await expect(waiting.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('May I read the project?')).toBeVisible();

    // The owner answers it where the request was made.
    await page.getByRole('button', { name: 'Approve' }).click();

    // And the room says what the decision did, in words.
    await expect(page.getByText(/decision was recorded/)).toBeVisible({ timeout: 20_000 });
  });
});
