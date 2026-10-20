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

    await expect(page.getByText('Waiting list live update')).toBeHidden({ timeout: 20_000 });
  });
});
