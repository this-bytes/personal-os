import { expect, test } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * The conversation surface, in a real browser.
 *
 * These tests cover the shape of a transcript: the owner's own words sit in a
 * bubble on their side, an agent's reply is prose on the page, the reply
 * carries its actions, and the column that holds the conversation is the one
 * that scrolls.
 */

/** Register an echo agent that answers with the given text. */
async function registerEchoAgent(
  page: import('@playwright/test').Page,
  workspaceId: string,
  reply: string,
): Promise<string> {
  const created = await page.request.post('/api/agents', {
    data: { workspaceId, name: 'Echo', adapterType: 'echo', config: { reply } },
  });
  expect(created.ok()).toBe(true);
  return (await created.json()).agent.id as string;
}

/** Open a conversation with the given agent in it. */
async function openConversation(
  page: import('@playwright/test').Page,
  workspaceId: string,
  agentId: string,
): Promise<string> {
  const created = await page.request.post('/api/conversations', {
    data: {
      workspaceId,
      title: 'Chat surface',
      routingMode: 'mentions',
      participantAgentConnectionIds: [agentId],
    },
  });
  expect(created.ok()).toBe(true);
  return (await created.json()).conversation.id as string;
}

test.describe('the conversation surface', () => {
  test("the owner's words are a bubble and an agent's reply is prose", async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await registerEchoAgent(
      page,
      workspaceId,
      'Here is a **markdown** reply, with a list:\n\n- one\n- two',
    );
    const conversationId = await openConversation(page, workspaceId, agentId);

    await page.goto(`/conversations/${conversationId}`);

    const composer = page.getByPlaceholder('Write a message. Use @Name to address an agent.');
    await expect(composer).toBeVisible();
    await composer.fill('@Echo show me a reply');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The owner's turn is on their side and is a bubble.
    const ownerTurn = page.locator('[data-slot="message"][data-align="end"]');
    await expect(ownerTurn).toBeVisible();
    await expect(ownerTurn.locator('[data-slot="bubble"]')).toBeVisible();

    // The agent's turn is on the other side, and its reply is prose rather
    // than a panel: the markdown is drawn as text.
    const agentTurn = page.locator('[data-slot="message"][data-align="start"]').last();
    await expect(agentTurn).toContainText('markdown', { timeout: 20_000 });
    await expect(agentTurn.getByRole('button', { name: 'Copy this turn' })).toBeVisible();

    // The transcript is the thing that scrolls, not the page around it.
    await expect(page.locator('[data-slot="message-scroller-viewport"]')).toBeVisible();
  });

  test('the copy action puts the words of the turn on the clipboard', async ({ page, context }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await registerEchoAgent(page, workspaceId, 'A reply worth copying.');
    const conversationId = await openConversation(page, workspaceId, agentId);

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/conversations/${conversationId}`);

    await page
      .getByPlaceholder('Write a message. Use @Name to address an agent.')
      .fill('@Echo hello');
    await page.getByRole('button', { name: 'Send message' }).click();

    const agentTurn = page.locator('[data-slot="message"][data-align="start"]').last();
    await expect(agentTurn).toContainText('A reply worth copying.', { timeout: 20_000 });

    await agentTurn.getByRole('button', { name: 'Copy this turn' }).click();
    await expect(agentTurn.getByRole('button', { name: 'Copied to the clipboard' })).toBeVisible();
  });
});
