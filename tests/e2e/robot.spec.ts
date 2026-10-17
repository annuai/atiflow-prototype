import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('a robot in the configurator', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/robots/AMR-004');
    await expect(page.getByRole('heading', { name: 'AMR-004' })).toBeVisible();
  });

  test('the browser tab is titled with the robot, the page and the product', async ({ page }) => {
    await expect(page).toHaveTitle('AMR-004 · Robots · Ati Flow');
    await page.goBack();
    await expect(page).toHaveTitle(/^(Robots|Workflows|.*) · Ati Flow$/);
  });

  test('the page card keeps its bottom padding when its content scrolls, on every tab', async ({ page }) => {
    const card = page.getByTestId('device-detail');
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click();
      // the lowest thing on the tab, after scrolling the card to its end, must still have the card's padding (24px) below it
      const gap = await card.evaluate(async (el) => {
        await new Promise((r) => setTimeout(r, 600)); // the tab content fades in
        el.scrollTop = el.scrollHeight;
        const lowest = Math.max(
          ...[...el.querySelectorAll('*')]
            .filter((e) => e.getBoundingClientRect().height > 0)
            .map((e) => e.getBoundingClientRect().bottom),
        );
        return el.getBoundingClientRect().bottom - lowest;
      });
      expect(gap).toBeGreaterThan(20);
    }
  });

  test('configuration: values are read-only, a wrong value is refused, a right one is saved and survives a reload', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Configuration' }).click();
    const field = page.getByLabel(/Max Exception Events/);
    await expect(field).toBeDisabled();
    await page.getByRole('button', { name: 'Edit Configuration' }).click();
    await field.fill('500');
    await expect(page.getByText(/Must be 100 or less/)).toBeVisible();
    await field.fill('20');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Configuration saved')).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Configuration' }).click();
    await expect(page.getByLabel(/Max Exception Events/)).toHaveValue('20');
  });

  test('restoring factory settings is hidden under Advanced Settings and needs the robot name typed', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Configuration' }).click();
    await expect(page.getByText('Restore factory settings')).toHaveCount(0);
    await page.getByRole('button', { name: 'Advanced Settings' }).click();
    await expect(page.getByText('Restore factory settings')).toHaveCount(0); // still folded away
    await page.getByRole('button', { name: 'Danger zone' }).click();
    await page.getByRole('button', { name: /Restore factory settings/ }).click();
    const restore = page.getByRole('dialog').getByRole('button', { name: 'Restore' });
    await expect(restore).toBeDisabled();
    await page.getByRole('dialog').getByPlaceholder('AMR-004').fill('AMR-004');
    await expect(restore).toBeEnabled();
  });

  test('calibration runs and says when it was done; a software update installs and the Details tab follows', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Calibration' }).click();
    await expect(page.getByText('Never calibrated')).toBeVisible();
    await page.getByRole('button', { name: 'Calibrate' }).nth(1).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Calibrate' }).click();
    await expect(page.getByText('Steering Calibration finished')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Calibrated just now')).toBeVisible();

    await page.getByRole('tab', { name: 'Software Update' }).click();
    await expect(page.getByText('Firmware Version v3.2.2')).toBeVisible();
    await page.getByRole('button', { name: 'Download to Robot' }).click();
    await expect(page.getByText('Updated to v3.2.2').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(page.getByText('v3.2.2').first()).toBeVisible();
  });
});

test.describe('adding a robot', () => {
  test('the form starts with the next AMR name, which can be changed', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/robots');
    await page.getByRole('button', { name: 'Add Robot' }).first().click();
    const name = page.getByLabel(/Robot Name/);
    await expect(name).toHaveValue(/^AMR-0\d\d$/);
    const suggested = Number((await name.inputValue()).slice(4));
    expect(suggested).toBeGreaterThan(19); // one more than the highest robot there is
    await name.fill('AMR-777');
    await expect(name).toHaveValue('AMR-777');
  });
});
