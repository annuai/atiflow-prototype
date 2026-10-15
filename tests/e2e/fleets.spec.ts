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

  test('a fleet is renamed from its page and the address follows', async ({ page }) => {
    await page.goto('/configurator/fleets/Assembly%20Fleet/overview');
    await page.getByRole('button', { name: 'Rename fleet' }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Night Fleet');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/Night%20Fleet/);
    await expect(page.getByRole('heading', { name: 'Night Fleet' })).toBeVisible();
  });
});
