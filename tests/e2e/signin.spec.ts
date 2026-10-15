import { expect, test } from '@playwright/test';
import { expectPage, signIn } from './helpers';

test.describe('signing in', () => {
  test('a supervisor lands on the Dashboard and sees only the supervisor workspace', async ({ page }) => {
    await signIn(page, 'arjun');
    await expectPage(page, /\/supervisor\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Arjun/ })).toBeVisible();
    await expect(page.getByText('SUPERVISOR', { exact: true })).toBeVisible();
    await page.goto('/configurator/robots'); // not his area: he is sent back to his own
    await expectPage(page, /\/supervisor\//);
  });

  test('a configurator lands in the configurator and a wrong password is refused with a message', async ({ page }) => {
    await signIn(page, 'kavin', 'nope', { expectSuccess: false });
    await expect(page.getByText(/Incorrect username or password/)).toBeVisible();
    await expectPage(page, /\/login$/);
    await signIn(page, 'kavin');
    await expectPage(page, /\/configurator/);
    await expect(page.getByText('CONFIGURATOR', { exact: true })).toBeVisible();
  });

  test('the person stays signed in after a reload and can log out', async ({ page }) => {
    await signIn(page, 'kavin');
    await expectPage(page, /\/configurator/);
    await page.reload();
    await expectPage(page, /\/configurator/);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: /Log out/i }).click();
    await expectPage(page, /\/login$/);
  });
});
