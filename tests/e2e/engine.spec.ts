import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/** The 3D engine's camera modes: each one draws, none throws, and a drag or a wheel moves the picture. */
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (e) => list.push(e.message));
});
test.afterEach(({ page }) => expect(errors.get(page), 'errors in the page').toEqual([]));

const drawn = async (page: Page) => (await page.locator('canvas').first().screenshot()).length;

test('3D, 2D, walk and back: every mode draws and the view responds to the mouse', async ({ page }) => {
  test.setTimeout(150_000); // software rendering: a frame of the whole floor takes a while
  await signIn(page, 'arjun');
  await page.goto('/supervisor/livefloor');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => drawn(page), { timeout: 30_000 }).toBeGreaterThan(15_000);
  const box = (await canvas.boundingBox())!;
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // the picture changes when the view is dragged (orbit) and zoomed (wheel)
  const before = await canvas.screenshot();
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 120, mid.y + 40, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(600);
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);

  for (const mode of ['2D', 'Walk', '3D']) {
    await page.getByRole('radio', { name: mode, exact: true }).click();
    await page.waitForTimeout(900);
    await expect.poll(() => drawn(page), { message: mode, timeout: 20_000 }).toBeGreaterThan(8_000);
  }
  // follow needs a robot: with none selected it explains instead of throwing
  await page.getByRole('radio', { name: 'Follow', exact: true }).click();
  await expect(page.getByText('Please select a robot first to follow.')).toBeVisible();
});
