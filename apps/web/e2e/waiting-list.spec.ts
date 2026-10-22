import { expect, test, type Page } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/**
 * What is waiting on the owner.
 *
 * The owner opens the panel to find out what needs them. The list has to be
 * there, it has to say what each item is, it has to take the owner to the
 * place where the item is decided, and it has to keep itself current without
 * the owner reloading the page.
 *
 * The suite shares one instance, so every task this file creates is closed
 * again before the file ends.
 */

/**
 * How long the list may take to notice something.
 *
 * The list refetches on a fifteen second timer as a safety net, so a test
 * that allows more than that proves nothing: the timer alone would satisfy
 * it. These tests allow five seconds, which the timer cannot satisfy and the
 * event stream can, in about a quarter of a second.
 */
const NOTICE_WITHIN_MS = 5_000;

/**
 * Answer the waiting list with a list of the owner's choosing.
 *
 * There is no route that creates an approval — an agent raises one, and the
 * owner never does — so a row that only the worker can produce is put in
 * front of the client the way the server would send it. The shape is the one
 * CONTRACTS.md publishes.
 */
async function serveWaitingList(page: Page, items: unknown[]): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/waiting',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      }),
  );
}

/** One approval, in the shape CONTRACTS.md publishes. */
function approvalItem(workspaceId: string) {
  return {
    id: 'approval:apr_waiting',
    kind: 'approval',
    title: 'Delete the production database',
    detail: 'An agent is stopped and waiting for your decision.',
    reason: 'pending',
    workspaceId,
    conversationId: 'cnv_waiting',
    taskId: null,
    agentConnectionId: 'agt_waiting',
  };
}

/**
 * One capability, in the shape CONTRACTS.md publishes.
 *
 * The row names the agent that was refused and the tool it was refused, so
 * the owner can widen the grant from the row itself.
 */
function capabilityItem(workspaceId: string) {
  return {
    id: 'capability:cap_waiting',
    kind: 'capability',
    title: 'An agent cannot go on',
    detail: 'The agent was refused a tool and is waiting for you to widen its grant.',
    reason: 'pending',
    workspaceId,
    conversationId: null,
    taskId: null,
    agentConnectionId: 'agt_waiting',
    toolName: 'task.create',
  };
}

async function createTaskWaitingForReview(page: Page, workspaceId: string, title: string) {
  const created = await page.request.post('/api/tasks', {
    data: { workspaceId, title, acceptanceCriteria: [] },
  });
  expect(created.ok()).toBe(true);
  const taskId = (await created.json()).task.id as string;

  const moved = await page.request.patch(`/api/tasks/${taskId}`, { data: { status: 'review' } });
  expect(moved.ok()).toBe(true);

  return taskId;
}

test.describe('what is waiting on the owner', () => {
  test('the panel says so plainly when nothing is waiting', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('heading', { name: 'Waiting on you' })).toBeVisible();
    await expect(page.getByText('Nothing is waiting on you')).toBeVisible();
  });

  test('an item says what it is and leads to where it is decided', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const taskId = await createTaskWaitingForReview(page, workspaceId, 'Waiting list check');

    await page.goto('/conversations');

    // The item is listed, and it says what it is.
    await expect(page.getByText('Waiting list check')).toBeVisible();
    await expect(page.getByText('In review')).toBeVisible();

    // The entry leads to the card where the acceptance decision is made.
    await page.getByRole('link', { name: /Waiting list check/ }).click();
    await expect(page).toHaveURL(new RegExp(`/factory\\?task=${taskId}$`));
    await expect(page.locator('main h1')).toHaveText('Factory');

    // The task does not stay in the list for the next test.
    await page.request.post(`/api/tasks/${taskId}/accept`, {
      data: { satisfied: true, reason: 'closed by the waiting list test' },
    });
  });

  test('an item that stops waiting disappears without the owner reloading', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    const taskId = await createTaskWaitingForReview(page, workspaceId, 'Waiting list live update');

    await page.goto('/conversations');
    await expect(page.getByText('Waiting list live update')).toBeVisible();

    // The owner accepts the task. The list has to notice on its own.
    await page.request.post(`/api/tasks/${taskId}/accept`, {
      data: { satisfied: true, reason: 'accepted while the panel was open' },
    });

    // The event stream has to carry it. The fifteen second safety net cannot
    // answer this in time, so this test fails if the event is not what makes
    // the list current.
    await expect(page.getByText('Waiting list live update')).toBeHidden({
      timeout: NOTICE_WITHIN_MS,
    });
  });

  test('the list is one request, not three lists joined in the client', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    await createTaskWaitingForReview(page, workspaceId, 'Waiting list one request');

    const calls: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) calls.push(url.pathname);
    });

    await page.goto('/conversations');
    await expect(page.getByText('Waiting list one request')).toBeVisible();

    // The waiting list is asked for once, and it is not assembled in the
    // browser from the approvals and the tasks.
    expect(calls.filter((path) => path === '/api/waiting')).toHaveLength(1);
    expect(calls).not.toContain('/api/approvals');
    expect(calls).not.toContain('/api/tasks');
  });

  test('a list that could not be loaded is not an empty list', async ({ page }) => {
    await signIn(page);

    // The list fails to load. That is not the same as there being nothing
    // waiting, and the owner has to be able to tell the two apart.
    await page.route(
      (url) => url.pathname === '/api/waiting',
      (route) => route.abort('failed'),
    );

    await page.goto('/conversations');

    await expect(page.getByText('The waiting list could not be loaded')).toBeVisible();
    await expect(page.getByText('Nothing is waiting on you')).toBeHidden();
  });

  test('the list is the first thing on the screen the panel opens at', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    await createTaskWaitingForReview(page, workspaceId, 'Waiting list first');

    await page.goto('/conversations');
    await expect(page.getByText('Waiting list first')).toBeVisible();

    // The list is above the conversation list, not below it.
    const order = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find((node) =>
        node.textContent?.includes('Waiting on you'),
      );
      const conversations = [...document.querySelectorAll('h1')].find(
        (node) => node.textContent?.trim() === 'Conversations',
      );
      if (!heading || !conversations) return null;
      return heading.compareDocumentPosition(conversations) & Node.DOCUMENT_POSITION_PRECEDING
        ? 1
        : -1;
    });

    // The heading of the list comes after the page heading but before the
    // conversation list, which is what "the first section" means.
    expect(order).not.toBeNull();
    const listBeforeConversations = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find((node) =>
        node.textContent?.includes('Waiting on you'),
      );
      const conversationList = document.querySelector('[data-conversation-list]');
      if (!heading) return false;
      if (!conversationList) return true;
      return Boolean(
        heading.compareDocumentPosition(conversationList) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
    expect(listBeforeConversations).toBe(true);
  });

  test('an approval on the list is approved or rejected where the list is', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    await serveWaitingList(page, [approvalItem(workspaceId)]);

    // The decision the owner takes is recorded as it is made.
    const decisions: Array<{ url: string; body: string }> = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/approvals/')) {
        decisions.push({ url: request.url(), body: request.postData() ?? '' });
      }
    });

    // The decision itself is answered here, so the test does not depend on an
    // approval that the server has never heard of.
    await page.route(
      (url) => url.pathname.startsWith('/api/approvals/'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ approval: { id: 'apr_waiting', status: 'approved' } }),
        }),
    );

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Delete the production database' });
    await expect(row).toBeVisible();

    const controls = row.getByRole('button');
    const count = await controls.count();

    expect(
      count,
      'the approval carries no control at all. The list only links out to the conversation, so ' +
        'the owner cannot approve or reject the approval where the list is.',
    ).toBeGreaterThan(0);

    // Take every control in turn, on a freshly loaded row, and see what each
    // one decides. The control is found by what it does rather than by what it
    // is called, so the test does not depend on the wording of the button.
    const verdicts: boolean[] = [];
    for (let index = 0; index < count; index += 1) {
      await page.goto('/conversations');
      await page
        .getByRole('listitem')
        .filter({ hasText: 'Delete the production database' })
        .getByRole('button')
        .nth(index)
        .click();

      await expect.poll(() => decisions.length).toBe(index + 1);
      const decision = decisions[index]!;
      expect(decision.url).toContain('/api/approvals/');
      expect(decision.url).toContain('/decide');
      expect(decision.url).toContain('apr_waiting');
      verdicts.push(JSON.parse(decision.body).approved === true);
    }

    // Approving and rejecting are two decisions, and the list offers both.
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });

  test('the panel says when a turn was closed rather than continued', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    await serveWaitingList(page, [approvalItem(workspaceId)]);

    // The server closed the turn rather than continuing it, and said why.
    // The contract says the panel says so — CONTRACTS.md: "otherwise → the
    // execution finishes with the decision's outcome, and the panel says the
    // turn was closed rather than continued."
    await page.route(
      (url) => url.pathname.startsWith('/api/approvals/'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            approval: { id: 'apr_waiting', status: 'approved' },
            outcome: 'closed',
            detail:
              'The turn was closed rather than continued: the agent cannot re-enter a session, so the operation was not performed.',
          }),
        }),
    );

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Delete the production database' });
    await expect(row).toBeVisible();
    await row.getByRole('button').first().click();

    // The owner is told what happened to the turn they were waiting on.
    await expect(
      page.getByText(/closed rather than continued/i),
      'the panel did not say that the turn was closed rather than continued, so the owner is left ' +
        'with a decision that looks like it continued and an operation that was never performed',
    ).toBeVisible();
  });

  test('the note about a decision names the item, and outlives the item it is about', async ({
    page,
  }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    // The list answers with the item while it waits, and with nothing once
    // the decision has been sent: a decided item leaves the list the moment
    // it is decided. The note the client leaves behind therefore has to be
    // somewhere the item is not, or the owner is left holding a decision
    // that looks the same either way.
    let decided = false;
    await page.route(
      (url) => url.pathname === '/api/waiting',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: decided ? [] : [approvalItem(workspaceId)] }),
        }),
    );

    await page.route(
      (url) => url.pathname.startsWith('/api/approvals/'),
      (route) => {
        decided = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            approval: { id: 'apr_waiting', status: 'approved' },
            outcome: 'closed',
            detail:
              'The turn was closed rather than continued: the agent cannot re-enter a session, so the operation was not performed.',
          }),
        });
      },
    );

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Delete the production database' });
    await expect(row).toBeVisible();
    await row.getByRole('button').first().click();

    // The item has left the list, and the note is still there.
    await expect(page.getByText('Nothing is waiting on you')).toBeVisible();

    const note = page.getByText(/The turn was closed rather than continued/);
    await expect(
      note,
      'the note about the decision went with the item, so the owner is left with a decision ' +
        'that looks the same whether the turn continued or closed',
    ).toBeVisible();

    // The note says which item it is about.
    await expect(note).toContainText('Delete the production database');

    // And it is not inside the row it is about: a note in the row would be
    // gone by the time the owner looked for it.
    expect(await note.evaluate((element) => element.closest('li') !== null)).toBe(false);
  });

  test('an entry says which agent is waiting', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    // An agent the owner knows by name.
    const created = await page.request.post('/api/agents', {
      data: { workspaceId, name: 'Scout', adapterType: 'echo', config: { reply: 'hi' } },
    });
    expect(created.ok()).toBe(true);
    const agentId = (await created.json()).agent.id as string;

    await serveWaitingList(page, [
      {
        id: 'task:tsk_waiting',
        kind: 'task',
        title: 'Waiting list who is waiting',
        detail: 'An agent reported this as done. It is not accepted until you say so.',
        reason: 'review',
        workspaceId,
        conversationId: null,
        taskId: 'tsk_waiting',
        agentConnectionId: agentId,
      },
    ]);

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Waiting list who is waiting' });
    await expect(row).toBeVisible();

    // "Who is waiting" is the agent: by name when the client can resolve it,
    // by its identifier when it cannot.
    const text = ((await row.innerText()) ?? '').replace(/\s+/g, ' ').trim();
    expect(
      text.includes('Scout') || text.includes(agentId),
      `the entry does not say which agent is waiting. It says: "${text}"`,
    ).toBe(true);
  });

  test('an item whose outcome is unknown asks the owner to check it', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    // Only the worker can put a task into the unknown state, so the row is
    // put in front of the client the way the server would send it.
    await serveWaitingList(page, [
      {
        id: 'task:tsk_unknown',
        kind: 'task',
        title: 'Waiting list unknown outcome',
        detail:
          'This task started and we cannot confirm how it ended. Check whether it ran before you try it again.',
        reason: 'unknown',
        workspaceId,
        conversationId: null,
        taskId: 'tsk_unknown',
        agentConnectionId: 'agt_unknown',
      },
    ]);

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Waiting list unknown outcome' });
    await expect(row).toBeVisible();

    // It asks the owner to check it. It must not read as a failure that may
    // simply be tried again.
    await expect(row.getByText('Check this')).toBeVisible();
    await expect(row.getByText('Blocked')).toHaveCount(0);
    await expect(row.getByText('In review')).toHaveCount(0);
  });

  test('a turn is drawn the way a task is, and a client that switches on the kind does not fall through to a blank row', async ({
    page,
  }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    // A turn is a kind of its own now, so the client has to draw it. Only
    // the worker can leave a turn in the unknown state, so the row is put in
    // front of the client the way the server would send it.
    await serveWaitingList(page, [
      {
        id: 'turn:exe_unknown',
        kind: 'turn',
        title: 'Turn with an unknown outcome',
        detail:
          'This turn started and we cannot confirm how it ended. Check whether it ran before you ask the agent again.',
        reason: 'unknown',
        workspaceId,
        conversationId: 'cnv_waiting',
        taskId: null,
        agentConnectionId: 'agt_waiting',
      },
    ]);

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'Turn with an unknown outcome' });
    await expect(row).toBeVisible();

    // It says what it is: something to check. A client that matched on the
    // kind and had no case for a turn would leave the row blank.
    await expect(row.getByText('Check this')).toBeVisible();
    await expect(row.getByText('Blocked')).toHaveCount(0);
    await expect(row.getByText('In review')).toHaveCount(0);

    // It is not a decision. A turn is not an approval, so nothing here
    // offers to approve or reject it.
    await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Reject' })).toHaveCount(0);

    // And it leads to where the turn happened.
    await expect(row.getByRole('link', { name: 'Turn with an unknown outcome' })).toHaveAttribute(
      'href',
      '/conversations/cnv_waiting',
    );
  });

  test('a capability row says what it is, names the tool, and widens the grant from the row', async ({
    page,
  }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);
    await serveWaitingList(page, [capabilityItem(workspaceId)]);

    // The grant the owner widens is recorded as it is made.
    const grants: Array<{ url: string; body: string }> = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/agents/')) {
        grants.push({ url: request.url(), body: request.postData() ?? '' });
      }
    });

    // The route is answered so the panel can say what it did. The point of
    // the test is the request the panel makes, not what the server does with
    // it.
    await page.route(
      (url) => url.pathname.startsWith('/api/agents/') && url.pathname.endsWith('/grants'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: { id: 'agt_waiting' } }),
        }),
    );

    await page.goto('/conversations');

    const row = page.getByRole('listitem').filter({ hasText: 'An agent cannot go on' });
    await expect(row).toBeVisible();

    // It says what it is: a grant to widen, not work that is stuck.
    await expect(row.getByText('Needs a grant')).toBeVisible();
    await expect(row.getByText('Blocked')).toHaveCount(0);

    // And it names the tool the agent was refused, so the owner does not have
    // to go and find out which tool it was.
    await expect(row).toContainText('Tool: task.create');

    // The action is on the row: it widens the grant on the published route,
    // with the row's own tool.
    await row.getByRole('button', { name: 'Grant the tool' }).click();

    await expect.poll(() => grants.length).toBe(1);
    const grant = grants[0]!;
    expect(new URL(grant.url).pathname).toBe('/api/agents/agt_waiting/grants');
    expect(JSON.parse(grant.body)).toEqual({ tool: 'task.create' });
  });
});
