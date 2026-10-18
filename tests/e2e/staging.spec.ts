import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const open = async (page: Page) => {
  await page.goto('/configurator/master-data/staging-area');
  await expect(page.getByRole('grid')).toBeVisible();
};
const manage = (page: Page) => page.getByRole('radio', { name: 'Manage' }).click();
const pick = async (page: Page, label: string | RegExp, option: RegExp | string) => {
  await page.getByRole('dialog').getByRole('button', { name: label }).click();
  await page.getByRole('option', { name: option }).first().click();
};

test.describe('staging area cells hold materials', () => {
  test.beforeEach(async ({ page }) => signIn(page, 'kavin'));

  test('fill an empty cell with a material and a quantity, change the material, block it, empty it; it all survives a reload', async ({
    page,
  }) => {
    await open(page);
    await manage(page);
    const cell = page.getByRole('gridcell', { name: /Available/ }).first();
    const label = (await cell.getAttribute('aria-label'))!.split(':')[0]; // "Row r, column c"
    await cell.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: label.replace(/^Row/, 'Row') })).toBeVisible();
    await dialog.getByRole('radio', { name: 'Filled' }).click();
    await pick(page, 'Choose a material', /DCP-1001/);
    await dialog.getByLabel('Quantity (pieces)').fill('12');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const filled = page.getByRole('gridcell', { name: new RegExp(`${label}: Filled, DCP-1001 .*12 pieces`) });
    await expect(filled).toBeVisible();
    await expect(filled).toContainText('1001');

    await page.waitForTimeout(900); // the save is handed to storage a moment after the change
    await page.reload();
    await manage(page);
    await expect(page.getByRole('gridcell', { name: new RegExp(`${label}: Filled, DCP-1001`) })).toBeVisible();

    // change the material
    await page.getByRole('gridcell', { name: new RegExp(`${label}: Filled`) }).click();
    await pick(page, /DCP-1001/, /DCP-1003/);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('gridcell', { name: new RegExp(`${label}: Filled, DCP-1003`) })).toBeVisible();

    // block it with a reason, then empty it
    await page.getByRole('gridcell', { name: new RegExp(`${label}: Filled`) }).click();
    await page.getByRole('dialog').getByRole('radio', { name: 'Blocked' }).click();
    await page.getByRole('dialog').getByLabel('Reason').fill('wet floor');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('gridcell', { name: new RegExp(`${label}: Blocked, wet floor`) })).toBeVisible();
    await page.getByRole('gridcell', { name: new RegExp(`${label}: Blocked`) }).click();
    await page.getByRole('dialog').getByRole('radio', { name: 'Available' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('gridcell', { name: new RegExp(`${label}: Available`) })).toBeVisible();
    // the editor lists what happened to the cell
    await page.getByRole('gridcell', { name: new RegExp(`${label}: Available`) }).click();
    await expect(page.getByRole('dialog').getByRole('region', { name: 'Activity' }).getByRole('listitem')).toHaveCount(
      4,
    );
  });

  test('Shift-click selects several cells and one edit fills them all', async ({ page }) => {
    await open(page);
    await manage(page);
    const cells = page.getByRole('gridcell', { name: /Available/ });
    await cells.nth(0).click({ modifiers: ['Shift'] });
    await cells.nth(1).click({ modifiers: ['Shift'] });
    await expect(page.getByText('2 cells selected')).toBeVisible();
    await page.getByRole('button', { name: 'Edit cells' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '2 cells' })).toBeVisible();
    await pick(page, 'Choose a material', /DCP-1002/);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('gridcell', { name: /Filled, DCP-1002/ })).not.toHaveCount(0);
  });

  test('the retrieval order shows on the area, and a material filter numbers its cells in that order', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByText('Retrieval order: FIFO').first()).toBeVisible(); // SA 001
    await page.getByRole('button', { name: /SA 002/ }).click();
    await expect(page.getByText('Retrieval order: LIFO').first()).toBeVisible(); // SA 002 is last in, first out
    await page.getByRole('button', { name: 'Material' }).first().click();
    await page.getByRole('option').nth(1).click();
    await expect(page.getByText(/The numbers show the order it is given out in/)).toBeVisible();
    await expect(page.getByRole('gridcell').filter({ hasText: /^\d+$/ }).first()).toBeVisible();
  });

  test('the retrieval order is a dropdown in the Map Editor, with the rest of the staging area', async ({ page }) => {
    await page.goto('/configurator/maps/main-assembly');
    await page.getByRole('button', { name: 'Edit as draft' }).first().click();
    await page
      .getByRole('button', { name: /^Stations/ })
      .first()
      .click(); // the Stations tool opens its panel
    await page.getByRole('tab', { name: 'Staging areas' }).click();
    await page
      .getByRole('button', { name: /SA 001/ })
      .first()
      .click();
    const order = page.getByRole('button', { name: /Retrieval order/ });
    await expect(order).toContainText('FIFO');
    await order.click();
    await page.getByRole('option', { name: /LIFO/ }).click();
    await expect(order).toContainText('LIFO');
  });
});
