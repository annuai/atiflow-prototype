import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

async function openDraft(page: Page) {
  await signIn(page, 'kavin');
  await page.goto('/configurator/maps');
  await page.locator('a[href^="/configurator/maps/"]').first().click();
  await page.getByRole('button', { name: 'Edit as draft' }).first().click();
  await page
    .getByRole('button', { name: /Traffic Gates/ })
    .first()
    .click();
}
const width = (page: Page) => page.getByLabel('Width (m)');

test.describe('zone editing', () => {
  test('a selected zone has handles; the numbers, the handles and the keyboard edit the same rectangle, and undo takes it back', async ({
    page,
  }) => {
    await openDraft(page);
    await page
      .getByRole('button', { name: /Traffic Gate 1|Traffic Zone 1|TZ-/ })
      .first()
      .click();
    await expect(page.getByTestId('zone-handles')).toBeVisible();
    await expect(page.locator('[data-handle^="resize"]')).toHaveCount(8);
    await expect(page.locator('[data-handle="rotate"]')).toHaveCount(1);
    const before = Number(await width(page).inputValue());
    // the numbers
    await width(page).fill('11');
    await width(page).press('Enter');
    await expect(width(page)).toHaveValue('11');
    await page.keyboard.press('Control+z');
    await expect(width(page)).toHaveValue(String(before));
    // a handle: drag the east edge outwards
    const h = page.locator('[data-handle="resize:1,0"]');
    const b = (await h.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(Number(await width(page).inputValue())).toBeGreaterThan(before);
    await page.keyboard.press('Control+z');
    await expect(width(page)).toHaveValue(String(before)); // the whole drag was ONE undo step
    // the keyboard nudges
    const cx = page.getByLabel('Centre X (m)');
    const x0 = Number(await cx.inputValue());
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await cx.inputValue())).toBeCloseTo(x0 + 0.1, 1);
    // rotation in degrees
    await page.getByLabel('Rotation (°)').fill('30');
    await page.getByLabel('Rotation (°)').press('Enter');
    await expect(page.getByLabel('Rotation (°)')).toHaveValue('30');
  });

  test('a Line gate is a line with an arrow: depth is a number and the direction can be flipped', async ({ page }) => {
    await openDraft(page);
    await page.getByRole('button', { name: 'Add new gate' }).click();
    await page.getByRole('menuitem', { name: 'Line gate' }).click();
    const map = (await page.getByRole('img', { name: /map/i }).first().boundingBox())!;
    await page.mouse.click(map.x + map.width * 0.4, map.y + map.height * 0.4);
    await page.mouse.click(map.x + map.width * 0.4 + 60, map.y + map.height * 0.4);
    await expect(page.getByLabel('Depth (m)')).toHaveValue('3');
    await page.getByLabel('Depth (m)').fill('5');
    await page.getByLabel('Depth (m)').press('Enter');
    await expect(page.getByLabel('Depth (m)')).toHaveValue('5');
    await expect(page.locator('[data-handle^="end"]')).toHaveCount(2);
    await expect(page.locator('[data-handle="flip"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Flip direction' }).click();
    await page.keyboard.press('Control+z'); // the flip is one undo step
    await expect(page.getByLabel('Depth (m)')).toHaveValue('5');
  });
});

test.describe('leaving a map with unpublished edits', () => {
  test('asks first: Continue editing stays, Discard changes goes back to the map as it was opened and leaves', async ({
    page,
  }) => {
    await openDraft(page);
    await page
      .getByRole('button', { name: /Traffic Gate 1|Traffic Zone 1|TZ-/ })
      .first()
      .click();
    const before = await width(page).inputValue();
    // nothing edited yet: leaving is free
    await page.locator('.sb-item', { hasText: 'Maps' }).first().click();
    await expect(page).toHaveURL(/\/configurator\/maps$/);
    await page.locator('a[href^="/configurator/maps/"]').first().click();
    await page
      .getByRole('button', { name: /Traffic Gates/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Traffic Gate 1|Traffic Zone 1|TZ-/ })
      .first()
      .click();
    await width(page).fill('13');
    await width(page).press('Enter');
    await page.locator('.sb-item', { hasText: 'Maps' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Discard your changes?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page).toHaveURL(/\/configurator\/maps\/[^/]+$/);
    await expect(width(page)).toHaveValue('13'); // still there
    await page.goBack(); // the browser's own Back asks too
    await expect(dialog.getByText('Discard your changes?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).not.toHaveURL(/\/configurator\/maps\/[^/]+$/);
    await page.locator('a[href^="/configurator/maps/"]').first().click();
    await page
      .getByRole('button', { name: /Traffic Gates/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Traffic Gate 1|Traffic Zone 1|TZ-/ })
      .first()
      .click();
    await expect(width(page)).toHaveValue(before);
  });
  test('the rotate handle shows a rotate cursor', async ({ page }) => {
    await openDraft(page);
    await page
      .getByRole('button', { name: /Traffic Gate 1|Traffic Zone 1|TZ-/ })
      .first()
      .click();
    const cursor = await page.locator('[data-handle="rotate"]').evaluate((e) => getComputedStyle(e).cursor);
    expect(cursor).toContain('data:image/svg+xml');
  });
});
