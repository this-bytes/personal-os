import { expect, test } from '@playwright/test';
import { signIn } from './support/owner';

/**
 * The panel opens on the Map.
 *
 * The landing room is chosen by the order the features ask for their rooms in,
 * and nothing said which room that was: the browser suite visited every lazy
 * route by its own path, so the panel could have opened on any of them — or on
 * none of them — and every case would still have passed.
 *
 * This case says which room the owner lands on, so a feature that asks for a
 * room earlier than the Map cannot move the panel's front door without a case
 * turning red.
 */
test('the panel opens on the Map', async ({ page }) => {
  await signIn(page);

  // The root, the way the owner opens the panel.
  await page.goto('/');

  // The Map is what the owner sees...
  await expect(page.locator('main h1')).toHaveText('Map');
  // ...and the address says so, so the room can be linked to and reloaded.
  await expect(page).toHaveURL(/\/map$/);
});
