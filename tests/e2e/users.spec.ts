import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('users', () => {
  test('the picture of a user can be changed and removed on their page', async ({ page }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/users/rohan');
    const shown = page.locator('.title-block img').first();
    const standard = await shown.getAttribute('src');
    await page.locator('input[type=file]').setInputFiles('src/fixtures/avatars/sneha.png');
    const update = page.getByRole('button', { name: 'Update' });
    await expect(update).toBeEnabled();
    await update.click();
    await expect(shown).not.toHaveAttribute('src', standard!);
    await page.reload();
    await expect(page.locator('.title-block img').first()).not.toHaveAttribute('src', standard!);
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('.title-block img').first()).toHaveAttribute('src', standard!);
  });
});
