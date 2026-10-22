import { expect, test } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * The agent answers.
 *
 * The other browser tests prove the room around a turn: the Markdown, the
 * trace, the stop control, who is in the room. This one proves the turn
 * itself — that a message the owner writes reaches the worker, that the
 * worker runs the adapter, and that the answer comes back into the room as a
 * message of its own.
 *
 * **This is the test that needs a worker.** The API server never runs an
 * agent: it writes an execution and enqueues a job, and the worker is what
 * picks the job up. A browser suite with no worker can prove everything around
 * a turn and cannot prove the turn, because no agent ever answers.
 */

/**
 * The agent connections these tests made.
 *
 * The suite runs against one instance, so a connection left behind would show
 * up in the next test's list.
 */
const created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const agentId of created.splice(0, created.length)) {
    await page.request.delete(`/api/agents/${agentId}`);
  }
});

test.describe('the agent answers', () => {
  test("the owner's message reaches the worker, and the reply lands in the room", async ({
    page,
  }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Wren',
        adapterType: 'echo',
        config: { reply: 'The answer is yes.' },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    const agentId = (await createdAgent.json()).agent.id as string;
    created.push(agentId);

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The answer',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await page.getByPlaceholder(/Write a message/).fill('@Wren is it ready?');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The answer arrives as a message of its own. It is marked as the agent's,
    // and it names the adapter that wrote it, so the owner can tell which
    // runtime spoke.
    const answer = page.locator('article').filter({ hasText: 'The answer is yes.' });
    await expect(answer.first().getByText('agent', { exact: true })).toBeVisible();
    await expect(answer.first().getByText('echo', { exact: true })).toBeVisible();

    // The turn finished: nothing is still streaming, and the trace says the
    // agent's message completed.
    await expect(page.getByText('streaming', { exact: true })).toHaveCount(0);
    await expect(page.getByText('message.completed')).toBeVisible();
  });

  test("the owner's steer goes into the turn that is running", async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    // The agent takes its time, so there is a turn to steer.
    const createdAgent = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Wren',
        adapterType: 'echo',
        config: { reply: 'The first answer.', delayMs: 6_000 },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    const agentId = (await createdAgent.json()).agent.id as string;
    created.push(agentId);

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The steer',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await page.getByPlaceholder(/Write a message/).fill('@Wren start');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The turn is running, and the owner may steer it.
    const steer = page.getByRole('button', { name: 'steer now' });
    await expect(steer).toBeEnabled({ timeout: 15_000 });
    await steer.click();

    await page.getByPlaceholder(/Write a message/).fill('@Wren actually, do this instead');
    await page.getByRole('button', { name: 'Send into the running turn' }).click();

    // The answer is the owner's steer, not the answer the turn began with.
    await expect(page.getByText('actually, do this instead').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('The first answer.')).toHaveCount(0);
  });
});
