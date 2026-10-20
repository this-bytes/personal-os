import { expect, test, type Page } from '@playwright/test';
import { mcpToolNames, triggerableEventTypes } from '@personal-os/contracts';

/**
 * The control panel, in a real browser.
 *
 * These tests cover the two screens that carry the newest behaviour: the
 * per-connection MCP tool grants and the event-triggered automation.
 */

const OWNER = {
  email: 'owner@example.com',
  password: 'correct horse battery',
  displayName: 'Owner',
};

/**
 * Sign in through the login screen.
 *
 * The first test creates the owner account; every later test finds it
 * already there and signs in instead.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto('/');

  const setup = page.getByRole('heading', { name: 'Create the owner account' });
  const login = page.getByRole('heading', { name: 'Sign in' });

  await expect(setup.or(login)).toBeVisible();

  if (await setup.isVisible()) {
    await page.locator('#displayName').fill(OWNER.displayName);
    await page.locator('#email').fill(OWNER.email);
    await page.locator('#password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Create account' }).click();
  } else {
    await page.locator('#email').fill(OWNER.email);
    await page.locator('#password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }

  await expect(page).toHaveURL(/\/conversations/);
}

async function firstWorkspaceId(page: Page): Promise<string> {
  const response = await page.request.get('/api/workspaces');
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return body.workspaces[0].id as string;
}

test.describe('the MCP tool grants of an agent connection', () => {
  test('the owner narrows the tools a connection may call', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const created = await page.request.post('/api/agents', {
      data: {
        workspaceId,
        name: 'Echo',
        adapterType: 'echo',
        config: { reply: 'hi' },
      },
    });
    expect(created.ok()).toBe(true);
    const agentId = (await created.json()).agent.id as string;

    await page.goto('/agents');
    await page.getByRole('button', { name: 'Tools' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Every published tool is listed.
    for (const tool of mcpToolNames) {
      await expect(dialog.getByText(tool, { exact: true })).toBeVisible();
    }

    // The default grant set does not include the workspace listing.
    const workspaceList = dialog.getByRole('switch', { name: 'Allow workspace.list' });
    await expect(workspaceList).toHaveAttribute('aria-checked', 'false');
    await expect(dialog.getByRole('switch', { name: 'Allow task.create' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Switch one tool off and save.
    await dialog.getByRole('switch', { name: 'Allow task.create' }).click();
    await expect(dialog.getByRole('switch', { name: 'Allow task.create' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await dialog.getByRole('button', { name: 'Save grants' }).click();
    await expect(dialog).toBeHidden();

    // The server stored the narrower set.
    const detail = await page.request.get(`/api/agents/${agentId}`);
    expect(detail.ok()).toBe(true);
    const grants = (await detail.json()).agent.toolGrants as string[];
    expect(grants).not.toContain('task.create');
    expect(grants).toContain('conversation.post');

    // Re-opening the panel shows the saved state.
    await page.getByRole('button', { name: 'Tools' }).click();
    await expect(
      page.getByRole('dialog').getByRole('switch', { name: 'Allow task.create' }),
    ).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('event-triggered automations', () => {
  test('the trigger offers exactly the allowlisted events', async ({ page }) => {
    await signIn(page);

    await page.goto('/automations');
    await page.getByRole('button', { name: 'New automation' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Trigger type').selectOption('event');

    const eventSelect = dialog.locator('#automation-event');
    await expect(eventSelect).toBeVisible();

    const options = await eventSelect.locator('option').allTextContents();
    // The first option is the empty placeholder.
    expect(options.slice(1)).toEqual([...triggerableEventTypes]);
    expect(options).not.toContain('heartbeat');
    expect(options).not.toContain('execution.event');

    await eventSelect.selectOption('message.created');
  });

  test('an automation can be created with an event trigger', async ({ page }) => {
    await signIn(page);

    await page.goto('/automations');
    await page.getByRole('button', { name: 'New automation' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('#automation-title').fill('Refresh on a new message');
    await dialog.getByLabel('Trigger type').selectOption('event');
    await dialog.locator('#automation-event').selectOption('message.created');

    await dialog.getByLabel('Action type').selectOption('http.request');
    await dialog.locator('#automation-url').fill('https://example.com/hook');

    await dialog.getByRole('button', { name: 'Create automation' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Refresh on a new message')).toBeVisible();
    await expect(page.getByText('event · message.created')).toBeVisible();

    const workspaceId = await firstWorkspaceId(page);
    const listed = await page.request.get(`/api/automations?workspaceId=${workspaceId}`);
    const automations = (await listed.json()).automations as {
      title: string;
      trigger: { type: string; event?: string };
    }[];
    const created = automations.find((item) => item.title === 'Refresh on a new message');
    expect(created?.trigger.type).toBe('event');
    expect(created?.trigger.event).toBe('message.created');
  });
});
