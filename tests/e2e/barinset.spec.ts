import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/**
 * The bar at the top of a page card (Live Floor, Workflow Builder, Map Editor) gives its controls the same room on every side: the gap after the last control at the right edge is the
 * gap above it (`--bar-inset`). A bigger right padding looked like a stray gap after the button or dropdown.
 */
async function gaps(page: Page, header: string) {
  return page
    .locator(header)
    .first()
    .evaluate((bar) => {
      const b = bar.getBoundingClientRect();
      const controls = [...bar.querySelectorAll('button, [role=combobox], select')].filter(
        (e) => e.getBoundingClientRect().width > 0,
      );
      const last = controls.reduce((a, c) =>
        c.getBoundingClientRect().right > a.getBoundingClientRect().right ? c : a,
      );
      const c = last.getBoundingClientRect();
      return { right: Math.round(b.right - c.right), top: Math.round(c.top - b.top) };
    });
}

test('the gap after the last control equals the gap above it, in every page card header', async ({ page }) => {
  await signIn(page, 'meera');
  await page.goto('/supervisor/livefloor');
  await expect(page.locator('[data-card-header]').first()).toBeVisible();
  let g = await gaps(page, '[data-card-header]');
  expect(Math.abs(g.right - g.top), `Live Floor ${JSON.stringify(g)}`).toBeLessThanOrEqual(1);

  await page.goto('/configurator');
  await page.waitForURL(/\/configurator\/workflows\//);
  await expect(page.locator('[data-card-header]').first()).toBeVisible();
  g = await gaps(page, '[data-card-header]');
  expect(Math.abs(g.right - g.top), `Workflow Builder ${JSON.stringify(g)}`).toBeLessThanOrEqual(1);

  await page.goto('/configurator/maps/main-assembly');
  await expect(page.locator('[data-card-header]').first()).toBeVisible();
  g = await gaps(page, '[data-card-header]');
  expect(Math.abs(g.right - g.top), `Map Editor ${JSON.stringify(g)}`).toBeLessThanOrEqual(1);
});
