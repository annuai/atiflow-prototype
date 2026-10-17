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

  test('a fleet is deleted from the danger zone of its Settings tab, after typing its name', async ({ page }) => {
    await page.goto('/configurator/fleets/Assembly%20Fleet/settings');
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
});
