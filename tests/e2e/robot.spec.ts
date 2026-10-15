import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('a robot in the configurator', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/robots/AMR-004');
    await expect(page.getByRole('heading', { name: 'AMR-004' })).toBeVisible();
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
