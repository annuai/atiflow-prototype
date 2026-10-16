import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('an operator requests a material', () => {
  test('adds a material to the cart, sends it, and finds it in the request history', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    const add = page.getByRole('button', { name: 'Add', exact: true }).first();
    await expect(add).toBeVisible();
    await add.click();
    await page.getByRole('button', { name: 'Review cart' }).click();
    await page.getByRole('button', { name: /^Request 1 material/ }).click();
    await expect(page.getByText(/requested · 1 trip/)).toBeVisible();
    await page.goto('/operator/history'); // requests are followed (and cancelled) in History
    await expect(page.getByRole('button', { name: 'Cancel request' }).first()).toBeVisible();
    // open the item: its status and who the approval waits for
    await page
      .getByRole('button', { name: /^Open details of/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(/Waiting for|Approval 1 of 1|Approved/).first()).toBeVisible();
    await expect(sheet.getByText('Timeline')).toBeVisible();
  });
  test('Approve has no history tab', async ({ page }) => {
    await signIn(page, 'vikram');
    await page.goto('/operator/approve');
    await expect(page.getByRole('heading', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /History/ })).toHaveCount(0);
  });
  test('a called saved trip is under Booked trips in History, not under Requests', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book?tab=trips');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await page.getByRole('button', { name: 'Review' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Call 1 robot/ })
      .click();
    await page.goto('/operator/history');
    await page.getByRole('radio', { name: /^Requests/ }).click();
    await expect(page.getByText('Booked trip', { exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: /^Booked trips/ }).click();
    await expect(page.getByText('Booked trip', { exact: true }).first()).toBeVisible();
  });
  test('Request Material and Book Trips are two tabs of one page; the old Request address still opens it', async ({
    page,
  }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/request');
    await expect(page).toHaveURL(/\/operator\/book$/);
    const tabs = page.getByRole('radiogroup', { name: /send a robot for/ });
    await expect(tabs.getByRole('radio', { name: 'Request Material' })).toBeChecked();
    await tabs.getByRole('radio', { name: 'Book Trips' }).click();
    await expect(page).toHaveURL(/tab=trips/);
    await expect(page.getByText(/Custom trip|Which robot/).first()).toBeVisible();
    await page.goto('/operator/request?tab=history');
    await expect(page).toHaveURL(/\/operator\/history$/);
  });
  test('trip cards are as big as material cards, have markers in grey with the station name in a tooltip, and a long route collapses to "+N stops"', async ({
    page,
  }) => {
    await signIn(page, 'rohan');
    const sizes = () =>
      page
        .locator('article')
        .evaluateAll((els) =>
          els.map(
            (e) => `${Math.round(e.getBoundingClientRect().height)}x${Math.round(e.getBoundingClientRect().width)}`,
          ),
        );
    await page.goto('/operator/book');
    await expect(page.locator('article').first()).toBeVisible();
    const material = await sizes();
    await page.goto('/operator/book?tab=trips');
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible();
    const trips = await sizes();
    expect(trips.length).toBeGreaterThanOrEqual(3);
    expect(new Set(trips).size).toBe(1);
    const [mh, mw] = material[0].split('x').map(Number);
    const [th, tw] = trips[0].split('x').map(Number);
    expect(th).toBe(mh); // the same height as a material card
    expect(Math.abs(tw - mw)).toBeLessThanOrEqual(16); // and the same columns (a page scrollbar may take a few px)
    const long = cards.filter({ hasText: 'Full Line Side replenishment' });
    await expect(long.getByText('+4 stops')).toBeVisible();
    await expect(long.getByText('STA-116')).toBeVisible();
    await expect(long.getByText('STA-108')).toBeVisible();
    const short = cards.filter({ hasText: 'Store run to Workstations' });
    await expect(short.getByText('STA-107')).toBeVisible(); // a short route keeps its middle stop
    await expect(short.getByText(/\+\d+ stops?/)).toHaveCount(0);
    await short.getByRole('button', { name: /STA-107/ }).hover();
    await expect(page.getByRole('tooltip')).toContainText('Assembly Workstation 1'); // the station name
    await page.mouse.move(2, 2);
    await short.getByRole('button', { name: /STA-110/ }).click(); // a tap shows it too (touch screens have no hover)
    await expect(page.getByRole('tooltip').filter({ hasText: 'STA-110' })).toBeVisible();
  });
  test('trips are added, reviewed and then called together; nothing is sent before the confirmation', async ({
    page,
  }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book?tab=trips');
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible();
    await cards.nth(0).getByRole('button', { name: 'Add', exact: true }).click();
    await cards.nth(1).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('2 robots to call')).toBeVisible();
    await expect(cards.nth(0).getByRole('button', { name: 'Remove' })).toBeVisible();
    await page.getByRole('button', { name: 'Review' }).click();
    const sheet = page.getByRole('dialog', { name: 'Call robots' });
    await expect(sheet).toContainText('Store run to Workstations');
    await expect(sheet).toContainText('1 will wait for approval · 1 will start right away');
    await sheet.getByRole('button', { name: 'Call 2 robots' }).click();
    await expect(page.getByText('2 robots called')).toBeVisible();
    await expect(page.getByText('2 robots to call')).toHaveCount(0); // the list is empty again
    await page.goto('/operator/history');
    await expect(page.getByText('Store run to Workstations').first()).toBeVisible();
  });
});
