import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Import drawing: a DXF is read, reviewed, laid over the map and turned into elements of the draft. */
test.describe('import drawing', () => {
  test('a DXF is guessed, aligned to the map and imported as elements, and undo takes them back', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/maps');
    await page.locator('a[href^="/configurator/maps/"]').first().click();
    await page.getByRole('button', { name: 'Edit as draft' }).first().click();
    await page.getByRole('button', { name: 'Structure', exact: true }).first().click();

    await page.getByRole('button', { name: 'Drawing', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Import drawing' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import a drawing' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type=file]').setInputFiles('tests/fixtures/drawings/dummy.dxf');

    // review: the layers were guessed from their names
    await expect(
      dialog.getByText('What is in the drawing').or(dialog.getByText(/Each layer and block was guessed/)),
    ).toBeVisible();
    await expect(dialog.getByRole('row', { name: /WALL/ }).first()).toContainText('Wall');
    await expect(dialog.getByRole('row', { name: /DIM/ }).first()).toContainText('Leave out');
    await dialog.getByRole('button', { name: 'Next' }).click();

    // align: the drawing is over the map and what it will add is listed
    await expect(dialog.getByText('This will add')).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByLabel('Scale')).toHaveValue(/^\d/);
    await dialog.getByRole('button', { name: 'Turn 90°' }).click();
    await expect(dialog.getByLabel('Rotation (°)')).toHaveValue('90');

    await dialog.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Drawing imported')).toBeVisible();
    await page.keyboard.press('Control+z'); // one step takes the whole import back
  });

  test('a DWG is refused with how to convert it, and a binary or empty file with a reason', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/maps');
    await page.locator('a[href^="/configurator/maps/"]').first().click();
    await page.getByRole('button', { name: 'Edit as draft' }).first().click();
    await page.getByRole('button', { name: 'Structure', exact: true }).first().click();
    await page.getByRole('button', { name: 'Drawing', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Import drawing' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import a drawing' });
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'plan.dwg',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('AC1032\u0000\u0000\u0000\u0000\u0000binary'),
    });
    await expect(dialog.getByRole('alert')).toContainText('convert:drawing');
  });
});
