import { expect, type Page } from '@playwright/test';

/**
 * Shared setup for the browser tests.
 *
 * The end-to-end suite runs against a clean instance, so the first test that
 * arrives creates the owner account and every later test signs in.
 */

export const OWNER = {
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
export async function signIn(page: Page): Promise<void> {
  await assertApiAnswers(page);
  await page.goto('/');

  const setup = page.getByRole('heading', { name: 'Create the owner account' });
  const login = page.getByRole('heading', { name: 'Sign in' });

  await expect(
    setup.or(login),
    'the login screen never appeared. The client is waiting on /api/auth/status, ' +
      'so the server behind this port is not answering.',
  ).toBeVisible();

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

/**
 * Check that the server behind the test port is answering.
 *
 * The suite empties its data directory when the server starts, so a second
 * Playwright session on the same port and directory deletes the database the
 * running server is using. The symptom is a client that waits forever on
 * `/api/auth/status`, which reads as a missing login screen rather than as
 * the collision that caused it.
 */
async function assertApiAnswers(page: Page): Promise<void> {
  const response = await page.request.get('/api/auth/status');
  expect(
    response.ok(),
    `the API answered /api/auth/status with HTTP ${response.status()}. The server behind ` +
      'this port is not usable — check that no other Playwright session is sharing it.',
  ).toBe(true);
}

/** The id of the first workspace of the signed-in owner. */
export async function firstWorkspaceId(page: Page): Promise<string> {
  const response = await page.request.get('/api/workspaces');
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return body.workspaces[0].id as string;
}
