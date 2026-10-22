import { expect, test } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * The chat surface, in a real browser.
 *
 * The three things this covers are the three things the owner could not do
 * before: read an agent's words as Markdown, see what the turn is doing in
 * the trace, and stop a turn with an honest answer about what the stop did.
 */

/**
 * The agent connections these tests made.
 *
 * The suite runs against one instance, so a connection left behind would show
 * up in the next test's list — and a list with three connections breaks a
 * test that expected one.
 */
const created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
});

async function createAgent(page: import('@playwright/test').Page, name: string): Promise<string> {
  const workspaceId = await firstWorkspaceId(page);
  const createdAgent = await page.request.post('/api/agents', {
    data: {
      workspaceId,
      name,
      adapterType: 'echo',
      config: { reply: 'hi' },
    },
  });
  expect(createdAgent.ok()).toBe(true);
  const agentId = (await createdAgent.json()).agent.id as string;
  created.push(agentId);
  return agentId;
}

test.describe('the chat surface', () => {
  test('the owner reads Markdown, sees the trace, and stops a queued turn', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await createAgent(page, 'Echo');

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The trace',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    // The trace gutter is part of the room.
    await expect(page.getByText('Execution trace')).toBeVisible();
    await expect(page.getByText('No events yet.')).toBeVisible();

    // The owner writes Markdown.
    await page.getByPlaceholder(/Write a message/).fill('@Echo look at **this**');
    await page.getByRole('button', { name: 'Send message' }).click();

    // It is drawn as Markdown: the emphasis is emphasis, not asterisks.
    await expect(page.locator('strong', { hasText: 'this' })).toBeVisible();

    // The turn was admitted, and the trace says so in the published
    // vocabulary.
    await expect(page.getByText('turn.admitted')).toBeVisible();

    // Steering is refused, and the refusal is explained.
    await expect(page.getByText('steering unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: /steer now/i })).toBeDisabled();

    // The turn had not started, so stopping it is a cancellation and the
    // panel says that it will not run.
    await page.getByRole('button', { name: /stop/i }).click();
    await expect(page.getByText(/will not run/)).toBeVisible();
  });

  test('the presence list says who is in the room', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await createAgent(page, 'Wren');

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'Who is here',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    const presence = page.getByRole('list', { name: 'Participants in the room' });
    await expect(presence).toBeVisible();
    await expect(presence.getByText('Wren')).toBeVisible();
    // The adapter and the state of the connection are beside the name.
    await expect(presence.getByText(/echo · /)).toBeVisible();
  });
});
