import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Every page card ends the same distance above the bottom of the page, and a table heading sits exactly above its column's content. */
test('the robot page card is as tall as the other page cards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, 'meera');
  const bottom = async (path: string, sel: string) => {
    await page.goto(path);
    await page.locator(sel).first().waitFor();
    await page.waitForTimeout(500);
    return page
      .locator(sel)
      .first()
      .evaluate((e) => Math.round(e.getBoundingClientRect().bottom));
  };
  const list = await bottom('/configurator/robots', '.builder');
  expect(await bottom('/configurator/robots/AMR-004', '[data-testid=device-detail]')).toBe(list);
  expect(await bottom('/configurator/hardware', '.builder')).toBe(list);
});

test('table headings line up with the content below them', async ({ page }) => {
  await signIn(page, 'meera');
  for (const path of ['/configurator/robots', '/configurator/hardware', '/configurator/users']) {
    await page.goto(path);
    await page.locator('table').first().waitFor();
    const lefts = await page
      .locator('table')
      .first()
      .evaluate((t) => {
        const head = t.querySelector('th span')!.getBoundingClientRect().left;
        const cell = t.querySelector('tbody td')!.firstElementChild!.getBoundingClientRect().left;
        return [Math.round(head), Math.round(cell)];
      });
    expect(lefts[0], path).toBe(lefts[1]);
  }
});
