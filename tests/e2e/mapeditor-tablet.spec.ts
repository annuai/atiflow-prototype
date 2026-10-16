import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

for (const [name, width, height] of [
  ['landscape', 1024, 768],
  ['portrait', 768, 1024],
] as const)
  test(`the Map Editor has finger-sized controls on a tablet (${name})`, async ({ browser }) => {
    const page = await (
      await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true })
    ).newPage();
    await signIn(page, 'kavin');
    await page.goto('/configurator/maps');
    await page.locator('a[href^="/configurator/maps/"]').first().click();
    await page.getByRole('button', { name: 'Edit as draft' }).first().click();
    await page.getByRole('button', { name: 'Stations', exact: true }).click();
    await expect(page.getByText('Traffic Gates', { exact: true })).toBeVisible(); // the tools carry their names: there is no hover on a tablet
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('.map-editor button, .map-editor input')]
        .map((e) => ({ n: e.getAttribute('aria-label') || e.textContent || e.tagName, h: e.getBoundingClientRect() }))
        .filter((x) => x.h.width > 0 && x.h.height < 44)
        .map((x) => `${x.n} ${Math.round(x.h.height)}`),
    );
    expect(small).toEqual([]);
  });
