import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/** Phone-size checks (390 x 844, like an iPhone): nothing sticks out sideways, the tab bars swipe, the secondary search button is as big as the primary button. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Elements whose right edge is past the screen and that are not inside something that scrolls or clips them. */
async function sticksOut(page: Page, root: string) {
  return page.evaluate((sel) => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
    for (const e of document.querySelectorAll(`${sel} *`)) {
      const b = e.getBoundingClientRect();
      if (!b.width || b.right <= vw + 1) continue;
      let p = e.parentElement;
      let held = false;
      while (p && p !== document.body) {
        if (
          /(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) &&
          p.getBoundingClientRect().right <= vw + 1
        ) {
          held = true;
          break;
        }
        p = p.parentElement;
      }
      if (!held) bad.push(`${e.tagName}.${String(e.className).slice(0, 40)}`);
    }
    return { bad: bad.slice(0, 5), page: document.documentElement.scrollWidth - vw };
  }, root);
}

test.describe('configurator on a phone', () => {
  test.beforeEach(async ({ page }) => signIn(page, 'kavin'));

  test('the secondary search button is as big as the primary button next to it', async ({ page }) => {
    for (const path of ['/configurator/robots', '/configurator/users', '/configurator/fleets']) {
      await page.goto(path);
      const search = page.getByRole('button', { name: /^search/i }).first();
      const primary = page.getByRole('button', { name: /^(add|make)/i }).first();
      await expect(search).toBeVisible();
      const [a, b] = await Promise.all([search.boundingBox(), primary.boundingBox()]);
      expect(Math.abs(a!.height - b!.height), path).toBeLessThan(1.5);
    }
  });

  test('the fleets page and a fleet fit the screen, and the fleet tabs swipe', async ({ page }) => {
    await page.goto('/configurator/fleets');
    await expect(page.getByRole('heading', { name: 'Line Side Fleet' })).toBeVisible();
    expect((await sticksOut(page, '[data-page]')).bad).toEqual([]);
    await page.goto('/configurator/fleets/Line%20Side%20Fleet/overview');
    await expect(page.getByRole('heading', { name: 'Assigned map' })).toBeVisible();
    const r = await sticksOut(page, '[data-page]');
    expect(r.bad).toEqual([]);
    expect(r.page).toBeLessThanOrEqual(0);
    const tabs = page.locator('[data-tab-scroller]').first();
    const scrolls = await tabs.evaluate((el) => {
      const before = el.scrollLeft;
      el.scrollLeft = 300;
      return {
        can: el.scrollWidth > el.clientWidth,
        moved: el.scrollLeft > before,
        overflow: getComputedStyle(el).overflowX,
      };
    });
    expect(scrolls).toEqual({ can: true, moved: true, overflow: 'auto' });
  });

  test('a robot fits the screen on every tab', async ({ page }) => {
    await page.goto('/configurator/robots/AMR-001');
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click();
      await page.waitForTimeout(700);
      const r = await sticksOut(page, '[data-testid=device-detail]');
      expect(r.bad, await tab.innerText()).toEqual([]);
    }
  });
});

test('the sticky Edit Details bar on a robot page is solid and sits at the very bottom of the card (nothing scrolls visibly under it)', async ({
  page,
}) => {
  await signIn(page, 'kavin');
  await page.goto('/configurator/robots/AMR-001');
  const card = page.getByTestId('device-detail');
  await expect(card).toBeVisible();
  const r = await card.evaluate(async (el) => {
    el.scrollTop = 160; // somewhere in the middle of the fields
    await new Promise((res) => setTimeout(res, 300));
    const cb = el.getBoundingClientRect();
    const bar = [...el.querySelectorAll('button')].find((b) =>
      /edit details/i.test(b.textContent ?? ''),
    )!.parentElement!;
    const bb = bar.getBoundingClientRect();
    const under = document.elementFromPoint(cb.left + cb.width / 2, cb.bottom - 3); // a point just above the card's bottom edge
    return {
      barBottom: Math.round(bb.bottom),
      cardBottom: Math.round(cb.bottom),
      coveredByBar: !!under && bar.contains(under),
      bg: getComputedStyle(bar).backgroundColor,
    };
  });
  expect(r.coveredByBar, JSON.stringify(r)).toBe(true);
  expect(r.barBottom, JSON.stringify(r)).toBeGreaterThanOrEqual(r.cardBottom - 1);
  expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
});

test('on a phone the gap after the last control in a card header is the gap above it', async ({ page }) => {
  await signIn(page, 'kavin');
  await page.goto('/configurator');
  await page.waitForURL(/\/configurator\/workflows\//);
  const g = await page
    .locator('[data-card-header]')
    .first()
    .evaluate((bar) => {
      const b = bar.getBoundingClientRect();
      const controls = [...bar.querySelectorAll('button, [role=combobox]')].filter(
        (e) => e.getBoundingClientRect().width > 0,
      );
      const last = controls.reduce((a, c) =>
        c.getBoundingClientRect().right > a.getBoundingClientRect().right ? c : a,
      );
      const c = last.getBoundingClientRect();
      return { right: Math.round(b.right - c.right), top: Math.round(c.top - b.top) };
    });
  expect(Math.abs(g.right - g.top), JSON.stringify(g)).toBeLessThanOrEqual(1);
});
