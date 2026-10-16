import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('"Send to charger" in the robot window asks first and then says what the fleet answered', async ({ page }) => {
  await signIn(page, 'arjun');
  await page.goto('/supervisor/livefloor?focus=robot:AMR-001');
  const cta = page.getByRole('button', { name: 'Send to charger' });
  await expect(cta).toBeVisible({ timeout: 25_000 });
  await cta.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Send AMR-001 to a charger?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send to charger' }).click();
  await expect(
    page
      .getByText(/AMR-001 (is heading to a charger|will go to a charger|is on a work trip|is already charging)/)
      .first(),
  ).toBeVisible();
});
