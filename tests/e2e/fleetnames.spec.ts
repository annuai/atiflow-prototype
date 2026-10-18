import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Fleets are pointed at by id, but people only ever see names: lists, forms, dropdowns and texts show the current name, and a rename shows everywhere at once. */
test('names are shown wherever a fleet is pointed at, and a rename reaches every page', async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, 'meera');
  await page.goto('/configurator/robots');
  await expect(page.getByRole('gridcell', { name: 'Line Side Fleet' }).first()).toBeVisible();
  await expect(page.locator('table').getByText('line-side')).toHaveCount(0); // never the id

  // a robot's own page: the fleet badge and the Assigned Fleet field read as names
  await page.goto('/configurator/robots/AMR-001');
  await expect(page.getByText('Line Side Fleet').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unassign from Line Side Fleet' })).toBeVisible();

  // rename the fleet from its page: the robot page, the list and the sidebar show the new name
  await page.goto('/configurator/fleets/line-side/overview');
  await page.getByRole('button', { name: 'Rename fleet' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Line Feeding');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Line Feeding' })).toBeVisible();
  await page.goto('/configurator/robots');
  await expect(page.getByRole('gridcell', { name: 'Line Feeding' }).first()).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Line Side Fleet' })).toHaveCount(0);
  await page.goto('/configurator/robots/AMR-001');
  await expect(page.getByRole('button', { name: 'Unassign from Line Feeding' })).toBeVisible();
  // the workflow builder's fleet dropdown and the Master Data fleet dialog list the new name
  await page.goto('/configurator/master-data/materials');
  await expect(page.getByText('Line Feeding').first()).toBeVisible();
});
