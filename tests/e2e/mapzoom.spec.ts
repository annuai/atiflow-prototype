import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Zoom feel of the flat maps, in a real browser: a trackpad pinch (ctrl + small wheel deltas) and a mouse wheel must zoom quickly and smoothly, and zooming out must work as well as zooming in. */
test.describe('map zoom', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/maps/assembly-east');
    await expect(page.locator('div.touch-none > svg[viewBox]')).toBeVisible();
  });

  const zoomOf = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const svg = document.querySelector('div.touch-none > svg[viewBox]')!;
      return +svg.getAttribute('viewBox')!.split(' ')[2];
    });
  const burst = (page: import('@playwright/test').Page, n: number, deltaY: number, ctrlKey: boolean) =>
    page.evaluate(
      async ({ n, deltaY, ctrlKey }) => {
        const svg = document.querySelector('div.touch-none > svg[viewBox]')!;
        const box = svg.parentElement!;
        const r = box.getBoundingClientRect();
        for (let i = 0; i < n; i++) {
          box.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              ctrlKey,
              clientX: r.left + r.width / 2,
              clientY: r.top + r.height / 2,
              bubbles: true,
              cancelable: true,
            }),
          );
          await new Promise((res) => setTimeout(res, 16));
        }
      },
      { n, deltaY, ctrlKey },
    );

  test('a half-second trackpad pinch-out zooms in at least 3x, and pinching back returns', async ({ page }) => {
    const w0 = await zoomOf(page);
    await burst(page, 30, -4, true);
    await page.waitForTimeout(400);
    expect(w0 / (await zoomOf(page))).toBeGreaterThan(3);
    await burst(page, 30, 4, true);
    await page.waitForTimeout(500);
    expect(w0 / (await zoomOf(page))).toBeLessThan(1.3);
  });

  test('three mouse-wheel notches in one frame add up (not just the last one) and settle within half a second', async ({
    page,
  }) => {
    const w0 = await zoomOf(page);
    await burst(page, 3, -100, false);
    await page.waitForTimeout(500);
    expect(w0 / (await zoomOf(page))).toBeGreaterThan(2.5);
  });
});
