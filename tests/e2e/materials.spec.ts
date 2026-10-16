import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('material insights', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'arjun');
  });
  test('the Dashboard has a separate Materials view with its own KPIs', async ({ page }) => {
    await page.goto('/supervisor/dashboard');
    const view = page.locator('[aria-label="View"]');
    await expect(view).toBeVisible();
    await view.getByText('Materials').click();
    await expect(page.getByText('Requests today')).toBeVisible();
    await expect(page.getByText('On the way now')).toBeVisible();
    await expect(page.getByText('Needs attention')).toHaveCount(0); // the fleet cards are not mixed in
  });
  test('Reports has a Materials section for the chosen period', async ({ page }) => {
    await page.goto('/supervisor/reports');
    await page.locator('[aria-label="View"]').getByText('Materials').click();
    await expect(page.getByText('Material moved over time')).toBeVisible();
    await page.getByText('Last 7 days').click();
    await expect(page.getByText('Materials moved')).toBeVisible();
  });
});
