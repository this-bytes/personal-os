/**
 * The route split of the web client.
 *
 * Every page behind the login screen is loaded on demand. These tests look at
 * what the owner sees rather than at the bundler: every route still renders,
 * a route that is still on the wire shows a fallback instead of a blank
 * screen, and the browser does not download the pages nobody asked for.
 */

import { expect, test, type Page } from '@playwright/test';
import { firstWorkspaceId, signIn } from './support/owner';

/** The chunk the build emits for each lazily loaded page. */
const ROUTE_CHUNK =
  /^(Agents|Automations|ConversationDetail|Conversations|Factory|ForgeMap|Resources|Settings)-[\w-]+\.js$/;

/** The routes behind the login screen and the heading each one shows. */
const ROUTES = [
  { path: '/map', heading: 'Map' },
  { path: '/conversations', heading: 'Conversations' },
  { path: '/agents', heading: 'Agents' },
  { path: '/factory', heading: 'Factory' },
  { path: '/resources', heading: 'Resources' },
  { path: '/automations', heading: 'Automations' },
  { path: '/settings', heading: 'Settings' },
];

/** The JavaScript the browser asked for, by file name. */
function trackScripts(page: Page): string[] {
  const names: string[] = [];
  page.on('request', (request) => {
    const name = new URL(request.url()).pathname.split('/').pop() ?? '';
    if (name.endsWith('.js')) names.push(name);
  });
  return names;
}

test.describe('the routes of the control panel', () => {
  test('every lazy route renders its heading and keeps the shell navigation', async ({ page }) => {
    await signIn(page);

    for (const route of ROUTES) {
      await page.goto(route.path);

      // The page is rendered inside the shell, not on its own.
      await expect(page.locator('main h1')).toHaveText(route.heading);

      // The navigation is still there, so the owner can leave the page.
      await expect(page.getByRole('link', { name: 'Factory' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Conversations' })).toBeVisible();
    }
  });

  test('the conversation detail route renders the conversation it points at', async ({ page }) => {
    await signIn(page);
    const workspaceId = await firstWorkspaceId(page);

    const created = await page.request.post('/api/conversations', {
      data: { workspaceId, title: 'A conversation behind a lazy route' },
    });
    expect(created.ok()).toBe(true);
    const conversationId = (await created.json()).conversation.id as string;

    await page.goto(`/conversations/${conversationId}`);

    await expect(page.locator('main h1')).toHaveText('A conversation behind a lazy route');
    await expect(page.getByRole('link', { name: 'Factory' })).toBeVisible();
  });

  test('the navigation reaches every lazy route without reloading the page', async ({ page }) => {
    await signIn(page);

    // A marker on the window survives a client-side navigation and is wiped
    // by a full page load, so it tells the two apart.
    await page.evaluate(() => {
      (window as unknown as { __stillTheSamePage?: boolean }).__stillTheSamePage = true;
    });

    for (const route of ROUTES) {
      await page.getByRole('link', { name: route.heading, exact: true }).click();

      await expect(page.locator('main h1')).toHaveText(route.heading);
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));

      expect(
        await page.evaluate(
          () => (window as unknown as { __stillTheSamePage?: boolean }).__stillTheSamePage,
        ),
        `navigating to ${route.path} reloaded the page instead of switching routes`,
      ).toBe(true);
    }
  });
});

test.describe('a route whose chunk is still on the wire', () => {
  test('a directly opened route shows a fallback instead of a blank screen', async ({ page }) => {
    await signIn(page);

    // Hold the route chunk on the wire long enough to see the fallback.
    await page.route('**/assets/Agents-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue();
    });

    await page.goto('/agents', { waitUntil: 'commit' });

    // The fallback sits in the content area of the shell, not over it.
    await expect(page.locator('main').getByText(/Loading/)).toBeVisible();

    // The navigation is untouched, so the owner is never stuck on a blank page.
    await expect(page.getByRole('link', { name: 'Factory' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Agents' })).toBeVisible();

    // When the chunk lands, the page takes the content area over.
    await expect(page.locator('main h1')).toHaveText('Agents', { timeout: 20_000 });
  });

  test('a route reached by clicking shows a fallback while its chunk is in flight', async ({
    page,
  }) => {
    await signIn(page);

    await page.route('**/assets/Factory-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue();
    });

    await page.getByRole('link', { name: 'Factory' }).click();

    // The content area shows the fallback rather than the page it is waiting
    // for: the previous page is gone, and nothing blank is left behind.
    await expect(page.locator('main')).toContainText('Loading');
    await expect(page.locator('main')).not.toContainText('Conversations');

    // The shell is still there and the owner is never left on a blank screen.
    await expect(page.getByRole('link', { name: 'Agents' })).toBeVisible();

    // When the chunk lands, the page takes the content area over.
    await expect(page.locator('main h1')).toHaveText('Factory', { timeout: 20_000 });
  });

  test('a route that was visited once is not fetched again', async ({ page }) => {
    await signIn(page);
    const requested = trackScripts(page);

    await page.getByRole('link', { name: 'Factory' }).click();
    await expect(page.locator('main h1')).toHaveText('Factory');

    expect(requested.filter((name) => /^Factory-[\w-]+\.js$/.test(name))).toHaveLength(1);

    // Leaving and coming back reuses the chunk that is already in the cache.
    await page.getByRole('link', { name: 'Agents' }).click();
    await expect(page.locator('main h1')).toHaveText('Agents');
    await page.getByRole('link', { name: 'Factory' }).click();
    await expect(page.locator('main h1')).toHaveText('Factory');

    expect(requested.filter((name) => /^Factory-[\w-]+\.js$/.test(name))).toHaveLength(1);
  });
});

test.describe('what the browser downloads', () => {
  test('the first paint does not fetch the pages the owner did not ask for', async ({ page }) => {
    const requested = trackScripts(page);

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Sign in|Create the owner account/ }),
    ).toBeVisible();

    const routeChunks = requested.filter((name) => ROUTE_CHUNK.test(name));
    expect(
      routeChunks,
      `the login screen should not download the pages behind it, but it fetched: ${routeChunks.join(', ')}`,
    ).toEqual([]);

    // The login screen is in the entry chunk, so it paints without a second
    // round trip for a page the visitor has not asked for.
    expect(requested.length).toBeGreaterThan(0);
  });

  test('a route chunk is fetched when the owner asks for that route', async ({ page }) => {
    await signIn(page);
    const requested = trackScripts(page);

    await page.getByRole('link', { name: 'Agents' }).click();
    await expect(page.locator('main h1')).toHaveText('Agents');

    expect(requested.filter((name) => /^Agents-[\w-]+\.js$/.test(name))).toHaveLength(1);
  });

  test('no JavaScript chunk the browser downloads exceeds 300 kB', async ({ page }) => {
    const sizes = new Map<string, number>();

    page.on('response', async (response) => {
      const name = new URL(response.url()).pathname.split('/').pop() ?? '';
      if (!name.endsWith('.js')) return;
      const body = await response.body().catch(() => null);
      if (body) sizes.set(name, body.length);
    });

    await signIn(page);
    for (const route of ROUTES) {
      await page.goto(route.path);
      await expect(page.locator('main h1')).toHaveText(route.heading);
    }

    expect(sizes.size).toBeGreaterThan(0);
    for (const [name, size] of sizes) {
      // Vite measures a kilobyte as 1000 bytes, the same measure the build
      // warns against, so the budget is the same number here.
      expect(size, `${name} is ${(size / 1000).toFixed(2)} kB`).toBeLessThanOrEqual(300 * 1000);
    }
  });
});

test.describe('a route chunk that cannot be loaded', () => {
  test('a failed chunk load does not leave the owner with a blank screen', async ({ page }) => {
    await signIn(page);

    // A chunk that 404s or is cut off is a real failure mode once the client
    // is split: a page loaded before a deploy asks for a file the new build
    // renamed, and a flaky network drops the request on the floor.
    let aborted = false;
    await page.route('**/assets/Factory-*.js', async (route) => {
      await route.abort('failed');
      aborted = true;
    });

    await page.getByRole('link', { name: 'Factory' }).click();

    // Wait for the failure to reach the application, not just the network.
    // Asserting straight after the click would pass before React had a chance
    // to react to the rejection, which is exactly when the screen is still
    // showing the previous page.
    await expect.poll(() => aborted, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(2000);

    // The application is still on the screen and the owner can navigate away.
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByRole('link', { name: 'Agents' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conversations' })).toBeVisible();
  });

  test('pressing Retry loads the page when the next attempt is allowed', async ({ page }) => {
    await signIn(page);

    // Every attempt fails until the owner asks for the page again. This is
    // what a dropped request looks like to the browser, and it is the state
    // the retry has to recover from.
    let allowed = false;
    await page.route('**/assets/Factory-*.js', async (route) => {
      if (allowed) {
        await route.continue();
        return;
      }
      await route.abort('failed');
    });

    await page.getByRole('link', { name: 'Factory' }).click();

    // The first attempt failed and the route says so.
    await expect(page.locator('main')).toContainText('This page could not be loaded');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // The owner asks for the page again, and this time the request is let
    // through.
    allowed = true;
    await page.getByRole('button', { name: 'Retry' }).click();

    // The page arrives. The retry is not the error state again.
    await expect(page.locator('main h1')).toHaveText('Factory', { timeout: 20_000 });
    await expect(page.locator('main')).not.toContainText('This page could not be loaded');
  });

  test('a route opened directly shows the error state and the navigation still works', async ({
    page,
  }) => {
    await signIn(page);

    // The route is opened by typing its address, not by clicking a link, so
    // the shell is painted first and the chunk is asked for afterwards.
    await page.route('**/assets/Agents-*.js', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/agents', { waitUntil: 'commit' });

    // The error state sits in the content area of the shell.
    await expect(page.locator('main')).toContainText('This page could not be loaded');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // The shell is still there, so the owner is never stuck.
    await expect(page.getByRole('link', { name: 'Factory' })).toBeVisible();

    // And another page still works.
    await page.getByRole('link', { name: 'Factory' }).click();
    await expect(page.locator('main h1')).toHaveText('Factory');
  });
});
