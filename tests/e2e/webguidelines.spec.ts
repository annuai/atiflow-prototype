import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('web interface guidelines', () => {
  test('the page has a main landmark and a skip link that is the first stop of the keyboard', async ({ page }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/robots');
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0); // slid into view
  });

  test('a list search lives in the address: it survives a reload and a shared link opens it filtered', async ({
    page,
  }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/robots');
    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click();
    await page.getByRole('textbox').first().fill('AMR-004');
    await expect(page).toHaveURL(/[?&]q=AMR-004/);
    await page.reload();
    await expect(page.getByRole('textbox').first()).toHaveValue('AMR-004');
    await expect(page.getByRole('gridcell', { name: /AMR-004/ }).or(page.getByText('AMR-004').first())).toBeVisible();
  });

  test('a tab choice lives in the address', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/notifications?tab=unread');
    await expect(
      page
        .getByRole('radio', { name: /unread/i })
        .or(page.getByRole('button', { name: /unread/i }))
        .first(),
    ).toBeVisible();
    await page.goto('/supervisor/reports?range=30d');
    await expect(page.getByText(/last 30 days/i).first()).toBeVisible();
  });

  test('leaving a robot with edits that were not saved asks first', async ({ page }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/robots/AMR-004');
    await page.getByRole('button', { name: 'Edit Details' }).click();
    const key = page.getByLabel('API Key');
    await key.fill('flow_api_changed');
    await page.locator('aside').getByText('Robots', { exact: true }).click();
    await expect(page.getByText('Leave without saving?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/configurator\/robots\/AMR-004/);
    await page.locator('aside').getByText('Robots', { exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/configurator\/robots$/);
  });

  test('a failed submit puts the cursor on the first field with a problem', async ({ page }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/robots');
    await page.getByRole('button', { name: 'Add Robot' }).click();
    await page.getByLabel(/Robot Name/i).fill('');
    await page
      .getByRole('button', { name: /^Add Robot$/ })
      .last()
      .click();
    await expect(page.locator('[role=dialog] [aria-invalid="true"]').first()).toBeFocused();
  });
});
