import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('a browser that cannot draw 3D (hardware acceleration off, old GPU driver)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null; // what such a browser answers
        return (get as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
      } as typeof get;
    });
  });

  test('the Live Floor says why instead of showing an error page', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/livefloor');
    await expect(page.getByText('3D view is not available in this browser')).toBeVisible();
    await expect(page.getByText(/hardware acceleration/i)).toBeVisible();
    await expect(page.getByText('This page could not be shown')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('the rest of the app works', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await expect(page.getByText('This page could not be shown')).toHaveCount(0);
    await expect(page.locator('.topbar')).toBeVisible();
  });
});
