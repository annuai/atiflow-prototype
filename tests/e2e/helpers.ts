import { expect, type Page } from '@playwright/test';

/** Sign in through the real sign-in screen (the dummy accounts all use the password 1234). */
export async function signIn(page: Page, username: string, password = '1234', { expectSuccess = true } = {}) {
  await page.goto('/login');
  await page.getByPlaceholder(/e\.g\./i).fill(username);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  if (expectSuccess) await page.waitForURL((u) => !u.pathname.startsWith('/login')); // signed in: the session is stored
}
export async function expectPage(page: Page, path: RegExp) {
  await expect(page).toHaveURL(path);
}
