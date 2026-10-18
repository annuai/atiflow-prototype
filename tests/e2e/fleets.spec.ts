import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('fleets', () => {
  test.beforeEach(async ({ page }) => signIn(page, 'kavin'));

  test('the Fleets page lists the fleets, opens one with its map, robots and hardware, and the map opens the Map Editor', async ({
    page,
  }) => {
    await page.goto('/configurator/fleets');
    await expect(page.getByRole('heading', { name: 'Fleets', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Line Side Fleet' })).toBeVisible();
    await page.getByRole('button', { name: /Show Assembly Fleet/ }).click();
    await expect(page.getByRole('heading', { name: 'Assigned map' })).toBeVisible();
    await page.getByRole('link', { name: /in the Map Editor/ }).click();
    await expect(page).toHaveURL(/\/configurator\/maps\//);
    await expect(page.getByText('Map Editor')).toBeVisible();
  });

  test('a fleet is renamed from its page; its address (the fleet id) does not change', async ({ page }) => {
    await page.goto('/configurator/fleets/assembly/overview');
    await page.getByRole('button', { name: 'Rename fleet' }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Night Fleet');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Night Fleet' })).toBeVisible();
    await expect(page).toHaveURL(/\/configurator\/fleets\/assembly\/overview$/);
    await expect(page.getByRole('button', { name: 'Night Fleet' })).toBeVisible(); // the sidebar follows too
  });

  test('an old address with the fleet NAME in it still opens the fleet, under its id', async ({ page }) => {
    await page.goto('/configurator/fleets/Assembly%20Fleet/materials');
    await expect(page).toHaveURL(/\/configurator\/fleets\/assembly\/materials$/);
    await expect(page.getByRole('heading', { name: 'Assembly Fleet' })).toBeVisible();
  });

  test('a fleet is deleted from the danger zone of its Settings tab, after typing its name', async ({ page }) => {
    await page.goto('/configurator/fleets/assembly/settings');
    await expect(page.getByRole('button', { name: 'Delete fleet' })).toHaveCount(0); // hidden until the danger zone is opened
    await page.getByRole('button', { name: 'Danger zone' }).click();
    await page.getByRole('button', { name: 'Delete fleet' }).click();
    const confirm = page.getByRole('button', { name: 'Delete fleet' }).last();
    await expect(confirm).toBeDisabled(); // not before the name is typed
    await page.getByRole('textbox').last().fill('Assembly Fleet');
    await confirm.click();
    await expect(page).toHaveURL(/\/configurator\/fleets$/);
    await expect(page.getByRole('heading', { name: 'Assembly Fleet' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Line Side Fleet' })).toBeVisible();
  });

  test('opening a tab never slides the page frame sideways (the sidebar keeps its left padding)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 }); // a laptop window with the sidebar open: where it showed
    const slid = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter((e) => e.scrollLeft > 0 && !e.matches('[role=tablist]'))
          .map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`),
      );
    for (const tab of ['workflows', 'settings', 'materials']) {
      await page.goto(`/configurator/fleets/line-side/${tab}`);
      await expect(page.getByRole('tab', { selected: true })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await slid(), tab).toEqual([]);
      const left = await page.locator('.sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().left));
      expect(left, `${tab}: sidebar position`).toBeGreaterThanOrEqual(8);
    }
    await page.goto('/configurator/master-data/staging-area');
    await page.waitForTimeout(400);
    expect(await slid(), 'staging area').toEqual([]);
  });
});
