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

async function createAgent(
  page: import('@playwright/test').Page,
  name: string,
  config: Record<string, unknown> = { reply: 'hi' },
): Promise<string> {
  const workspaceId = await firstWorkspaceId(page);
  const createdAgent = await page.request.post('/api/agents', {
    data: {
      workspaceId,
      name,
      adapterType: 'echo',
      config,
    },
  });
  expect(createdAgent.ok()).toBe(true);
  const agentId = (await createdAgent.json()).agent.id as string;
  created.push(agentId);
  return agentId;
}

test.describe('the chat surface', () => {
  test('the owner reads Markdown, sees the trace, and stops a running turn', async ({ page }) => {
    // The case waits for a turn that is deliberately held, so it is given
    // room of its own.
    test.setTimeout(45_000);
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    // The turn is slow on purpose. **The worker runs in this suite now**, so
    // the turn starts as soon as the message is posted, and the stop has to
    // reach a turn that is in flight rather than one that is still in the
    // queue. The turn that had not started is proved by the server's own
    // test, `turn-activity.test.ts`, where the queue is under the test's
    // control.
    //
    // **The hold is fifteen seconds, and the length is the point.**
    //
    // The turn ends when the agent's hold runs out, and the panel hears
    // about it from the server: the status region and the stop button are
    // one payload, so when the turn ends the button is disabled with the
    // server's own words ("The turn has already finished."), and a click
    // asked after that waits for a button that will never be enabled again.
    //
    // So the stop has to be asked of a turn that is still running, and the
    // hold has to outlast **all** of the case's own work -- the panel's
    // refresh of the turn, and the click's own wait for the button to settle
    // -- and not merely the milliseconds between the panel saying "running"
    // and the click. The click's wait is not milliseconds when the machine is
    // loaded: the trace grows as the turn is admitted, the panel re-renders,
    // and the button is not stable, so the click retries. Five seconds was a
    // hold a loaded machine could beat, and the case failed at the stop with
    // the turn long over and the button greyed out by the server.
    //
    // The cost is the worker: it runs one turn at a time, so the worker is
    // busy until the hold runs out. The case waits for the turn to be over
    // before it ends, so the worker is free for the test that follows.
    const agentId = await createAgent(page, 'Echo', { reply: 'hi', delayMs: 15_000 });

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

    // The turn is running, and the panel says so. The stop is asked of a turn
    // that is in flight, which is what the server answers about. The panel's
    // state is a live region of its own, because the trace says "running"
    // about something else.
    await expect(page.getByRole('status')).toHaveText('running');

    // The turn was running, so it was asked to stop rather than cancelled,
    // and the panel says what the server said would happen: the runtime may
    // finish the turn it is in.
    await page.getByRole('button', { name: /stop/i }).click();
    await expect(page.getByText(/may finish the current turn/)).toBeVisible();

    // The turn is over. The runtime finished the turn it was in -- which is
    // what the server said may happen -- and the worker is free for the test
    // that follows. The panel's word for a turn that is over is its own
    // business; what this waits for is the stop no longer being pending.
    await expect(page.getByRole('status')).not.toHaveText('stop requested', {
      timeout: 20_000,
    });
  });

  test('the panel says what the turn was admitted with', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await createAgent(page, 'Wren');

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'What it was admitted with',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    // Before a turn there is no view, and the panel says there is no turn
    // rather than that the agent could do nothing.
    await expect(page.getByText(/No turn yet/)).toBeVisible();

    await page.getByPlaceholder(/Write a message/).fill('@Wren hello');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The turn was admitted, so the view is pinned, and the panel shows it.
    await expect(page.getByText('Turn capabilities')).toBeVisible();
    await expect(page.getByText(/revision \d+/)).toBeVisible();
    await expect(page.getByText('Tools granted')).toBeVisible();
    await expect(page.getByText('takes input mid-turn')).toBeVisible();

    // The limit is stated rather than implied: the token names the connection.
    await expect(page.getByText(/scoped to the connection/)).toBeVisible();
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

  test('an empty room offers prompts, and pressing one is the same as typing it', async ({
    page,
  }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const agentId = await createAgent(page, 'Echo', { reply: 'I can answer questions.' });

    const createdConversation = await page.request.post('/api/conversations', {
      data: {
        workspaceId,
        title: 'The prompts',
        routingMode: 'mentions',
        participantAgentConnectionIds: [agentId],
      },
    });
    expect(createdConversation.ok()).toBe(true);
    const conversationId = (await createdConversation.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    // An empty room offers prompts rather than only an instruction to type.
    const row = page.locator('[data-slot="suggestions"]');
    await expect(row).toBeVisible();
    // The first one names the room's own agent, because it is the room that
    // says who can be asked.
    await expect(
      row.getByRole('button', { name: '@Echo, what can you do in this room?' }),
    ).toBeVisible();

    // Pressing one is the same act as typing it: the message goes out, and it
    // goes out addressed, so the agent is the one that answers.
    await row.getByRole('button', { name: '@Echo, what can you do in this room?' }).click();
    await expect(page.getByText('I can answer questions.')).toBeVisible();

    // The room is no longer empty, so the prompts go away.
    await expect(row).toBeHidden();

    // And the prompt is in the transcript as the message it was.
    await expect(page.getByText('@Echo, what can you do in this room?')).toBeVisible();
  });
});
