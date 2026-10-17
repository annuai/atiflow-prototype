import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const box = (page: Page) => page.getByRole('combobox', { name: 'Search' });
async function find(page: Page, text: string) {
  await expect(box(page)).toBeVisible();
  await expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(box(page)).toBeFocused({ timeout: 500 });
  }).toPass({ timeout: 8000 });
  await page.keyboard.type(text);
}

test.describe('Global search', () => {
  test('a supervisor finds a robot and locates it on the map; the address survives a reload', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await find(page, 'r-07'); // "R-07" means AMR-007
    const first = page.getByRole('option').first();
    await expect(first).toContainText('AMR-007');
    await expect(first).toContainText('Locate on map');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/livefloor\?focus=robot:AMR-007/);
    await expect(page.getByText('AMR-007').first()).toBeVisible({ timeout: 25_000 });
    await page.reload();
    await expect(page).toHaveURL(/focus=robot:AMR-007/);
    await expect(page.getByRole('button', { name: 'Send to charger' })).toBeVisible({ timeout: 20_000 }); // the robot window opened for it, with the new action
  });

  test('a supervisor searches a trip id on the results page and tracks it; Send to charger asks first', async ({
    page,
  }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await expect(page.getByText(/TRP-\d+/).first()).toBeVisible({ timeout: 20_000 });
    await find(page, 'trp');
    await page.getByRole('option', { name: /See all results/ }).click();
    await expect(page).toHaveURL(/\/supervisor\/search\?q=trp/);
    await page.getByRole('tab', { name: /^Trips/ }).click();
    const trip = page.locator('[data-result="trip"]').first();
    await expect(trip).toBeVisible();
    await trip.getByRole('button', { name: 'Track on map' }).first().click();
    await expect(page).toHaveURL(/livefloor\?focus=robot:AMR-/);
    // the same robot from the results page: the command asks first
    await page.goto('/supervisor/search?q=amr-001');
    await page.locator('[data-result="robot"]').first().getByRole('button', { name: 'Send to charger' }).click();
    await expect(page.getByRole('dialog').getByText(/Send AMR-001 to a charger\?/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('an operator finds a material and orders it; they never see configurator results', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await find(page, 'drive chain');
    const material = page.getByRole('option', { name: /Drive Chain Pin/ });
    await expect(material).toContainText('Order');
    await material.click();
    await expect(page).toHaveURL(/\/operator\/book\?add=/);
    await expect(page.getByRole('button', { name: 'Add', exact: true }).first()).toBeVisible();
    await page.goto('/operator/search?q=kavin');
    await expect(page.getByText(/No results for "kavin"/)).toBeVisible();
    await page.goto('/operator/search?q=users');
    await expect(page.locator('[data-result="user"]')).toHaveCount(0);
    await expect(page.locator('[data-result="integration"]')).toHaveCount(0);
  });

  test('a configurator finds a workflow and opens it in the editor', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/robots');
    await find(page, 'workflow');
    await page.getByRole('option', { name: /See all results/ }).click();
    await page.getByRole('tab', { name: /^Workflows/ }).click();
    await page.locator('[data-result="workflow"]').first().getByRole('button', { name: 'Open in editor' }).click();
    await expect(page).toHaveURL(/\/configurator\/workflows\//);
  });

  test('nothing found: a clear empty state with a hint; keyboard works through the palette', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await find(page, 'qqqzzzxx');
    await expect(page.getByText(/No results for "qqqzzzxx"/).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await find(page, 'dashboard');
    await expect(page.getByRole('option').first()).toContainText('Dashboard');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/supervisor\/dashboard/);
  });

  test('"amr" lists the robots first, not report metrics that happen to say robot', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await expect(page.getByText(/TRP-\d+/).first()).toBeVisible({ timeout: 20_000 });
    await page.goto('/supervisor/search?q=amr');
    await expect(page.getByRole('tab').nth(1)).toContainText('Robots');
    await expect(page.locator('section h2').first()).toContainText('Robots');
  });

  test('search covers the open workspace only, even for a person who can enter several', async ({ page }) => {
    await signIn(page, 'meera'); // a configurator who also holds supervisor and operator access
    await page.goto('/configurator/search?q=dashboard');
    await expect(page.getByText(/no results/i).first()).toBeVisible(); // the Dashboard is a supervisor page
    await page.goto('/supervisor/search?q=dashboard');
    await expect(page.getByText('/supervisor/dashboard').first()).toBeVisible();
    await page.goto('/supervisor/search?q=users');
    await expect(page.getByText('/configurator/users')).toHaveCount(0); // and Users is a configurator page
  });
});

test.describe('Locate on map really flies the camera to the robot', () => {
  const zoom = async (page: import('@playwright/test').Page) =>
    Number(((await page.locator('.zoom').innerText()).match(/(\d+)\s*%/) ?? [])[1]);
  test('opened from the address and from the search, the camera ends close to the robot (not at the home view)', async ({
    page,
  }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/livefloor');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(3000);
    const home = await zoom(page);
    // straight from an address (a reload: the fleet has not reported the robot yet when the scene is ready)
    await page.goto('/supervisor/livefloor?focus=robot:AMR-007');
    await expect(page.getByText('AMR-007').first()).toBeVisible({ timeout: 25_000 });
    await expect.poll(() => zoom(page), { timeout: 15_000 }).toBeGreaterThan(home + 25);
    // from the search result, inside the running app
    await page.goto('/supervisor/dashboard');
    await find(page, 'r-03'); // "R-03" means AMR-003
    await page.getByRole('option').first().click();
    await expect(page).toHaveURL(/focus=robot:AMR-003/);
    await expect(page.getByText('AMR-003').first()).toBeVisible({ timeout: 25_000 });
    await expect.poll(() => zoom(page), { timeout: 15_000 }).toBeGreaterThan(home + 25);
  });
});
