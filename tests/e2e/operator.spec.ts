import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('an operator requests a material', () => {
  test('adds a material to the cart, sends it, and finds it in the request history', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/request');
    const add = page.getByRole('button', { name: 'Add', exact: true }).first();
    await expect(add).toBeVisible();
    await add.click();
    await page.getByRole('button', { name: 'Review cart' }).click();
    await page.getByRole('button', { name: /^Request 1 material/ }).click();
    await expect(page.getByText(/requested · 1 trip/)).toBeVisible();
    await page.getByRole('radio', { name: /Request history/ }).click();
    await expect(page.getByText(/ORD-0001/).first()).toBeVisible();
  });
});
