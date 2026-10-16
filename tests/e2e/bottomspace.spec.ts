import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Every page card that scrolls must keep its bottom padding at the end of the scroll (a `min-h-0` flex child that its content overflows loses it: the content touches the card's edge). */
const pages: [string, string][] = [
  ['kavin', '/configurator/robots/AMR-004'],
  ['kavin', '/configurator/master-data/materials'],
  ['kavin', '/configurator/fleets'],
  ['kavin', '/configurator/fleets/Line%20Side%20Fleet/overview'],
  ['arjun', '/supervisor/dashboard'],
  ['arjun', '/supervisor/reports'],
  ['arjun', '/supervisor/settings/alerts'],
  ['rohan', '/operator/request'],
  ['rohan', '/operator/approve'],
];
for (const [user, path] of pages)
  test(`${path} keeps its bottom padding when scrolled to the end`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 600 } });
    const page = await ctx.newPage();
    await signIn(page, user);
    await page.goto(path);
    await page.waitForTimeout(1200);
    const gaps = await page.evaluate(() =>
      ([...document.querySelectorAll('.md-body, [data-testid=device-detail]')] as HTMLElement[]).map((b) => {
        b.scrollTop = b.scrollHeight;
        const low = Math.max(
          ...[...b.querySelectorAll('*')]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.height > 0 && r.width > 0 && getComputedStyle(e).position !== 'sticky';
            })
            .map((e) => e.getBoundingClientRect().bottom),
        );
        return b.scrollHeight > b.clientHeight ? b.getBoundingClientRect().bottom - low : 99;
      }),
    );
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(19);
    await ctx.close();
  });
