import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** A blank workspace: the first-run flow from the welcome window to the first fleet, and the demo data never being interrupted. */
test.describe('first use of a blank workspace', () => {
  test('welcome, setup progress, first robot, first map, first fleet', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/login?profile=blank'); // chosen once, then remembered on this device
    await signIn(page, 'kavin');

    // the welcome window, once
    const welcome = page.getByRole('dialog', { name: 'Welcome to Ati Flow' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByText('Unified Interface')).toBeVisible();
    await welcome.getByRole('button', { name: 'Skip Walkthrough' }).click();
    await expect(welcome).toBeHidden();

    // nothing on the site yet: the welcome page of Fleets, the setup card at 0 of 6
    await page.goto('/configurator/fleets');
    await expect(page.getByText('Welcome to Fleets')).toBeVisible();
    const card = page.getByRole('button', { name: 'Open setup progress' });
    await expect(card).toContainText('0 of 6');
    await expect(card).toContainText('Add your first robot');

    // a fleet needs a map first: the dialog does not open, a toast says why
    await page.getByRole('button', { name: 'Make a fleet' }).click();
    await expect(page.getByText('No map available')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Add Fleet' })).toBeHidden();

    // the first robot, then its celebration
    await page.getByRole('button', { name: 'Add Your First Robot' }).first().click();
    const add = page.getByRole('dialog', { name: 'Add Robot' });
    await add.getByLabel('Hardware ID').fill('HW-0001-AA');
    await add.getByLabel('API Key').fill('flow_api_test123');
    await add.getByRole('button', { name: /^Add Robot$/ }).click();
    const robotDone = page.getByRole('dialog', { name: 'Congratulations!' });
    await expect(robotDone).toBeVisible();
    await expect(card).toContainText('1 of 6');
    await robotDone.getByRole('button', { name: 'Add your first map' }).click();

    // the first map is generated from the robot's (sample) run data; the robot added last is already chosen
    const gen = page.getByRole('dialog', { name: 'Generate New Map' });
    await expect(gen).toBeVisible();
    await expect(gen.getByText('AMR-001', { exact: true })).toBeVisible();
    await gen.getByLabel('Map Name').fill('hall_one');
    await gen.getByRole('button', { name: /Select run data/ }).click();
    await page.getByRole('option').first().click();
    await gen.getByRole('button', { name: 'Generate Map' }).click();
    const mapDone = page.getByRole('dialog', { name: 'Well done!' });
    await expect(mapDone).toBeVisible();
    await expect(mapDone.getByText('hall_one')).toBeVisible();
    await expect(card).toContainText('2 of 6');
    await mapDone.getByRole('button', { name: 'Take me to Map Editor' }).click();
    await expect(page).toHaveURL(/\/configurator\/maps\/imp-hall-one/);

    // the fleet: name, the map, the robot, in one step
    await page.goto('/configurator/fleets?new=1');
    const fleet = page.getByRole('dialog', { name: 'Add Fleet' });
    await expect(fleet).toBeVisible();
    await fleet.getByLabel('Fleet name').fill('Line Side');
    await fleet.getByRole('button', { name: /Select a map/ }).click();
    await page.getByRole('option', { name: 'hall_one' }).click();
    await fleet.getByText('AMR-001', { exact: true }).click(); // the whole row picks the robot
    await expect(fleet.getByRole('checkbox', { name: 'AMR-001' })).toBeChecked();
    await fleet.getByRole('button', { name: 'Add Fleet', exact: true }).click();
    const fleetDone = page.getByRole('dialog', { name: 'Your fleet is ready' });
    await expect(fleetDone).toBeVisible();
    await fleetDone.getByRole('button', { name: 'Skip for now' }).click();
    await expect(card).toContainText('3 of 6');

    // the panel lists every step and what is next (hardware, which can be skipped)
    await card.click();
    const panel = page.getByRole('dialog', { name: 'Set up your site' });
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await panel.getByRole('button', { name: 'I have no hardware' }).click();
    await expect(card).toContainText('4 of 6');
  });

  test('the walkthrough points at real things and leaves when closed', async ({ page }) => {
    await page.goto('/login?profile=blank');
    await signIn(page, 'kavin');
    await page
      .getByRole('dialog', { name: 'Welcome to Ati Flow' })
      .getByRole('button', { name: 'Start Walkthrough' })
      .click();
    const pop = page.locator('.driver-popover');
    await expect(pop.getByText('Start with robots')).toBeVisible();
    await pop.getByRole('button', { name: 'Next' }).click();
    await expect(pop.getByText('Add a robot')).toBeVisible();
    await pop.getByRole('button', { name: 'Next' }).click(); // another page
    await expect(page).toHaveURL(/\/configurator\/maps/);
    await expect(pop.getByText('Maps', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
  });
});

test.describe('the walkthrough reaches the Workflows page', () => {
  test('its Workflows step opens the Workflow Builder', async ({ page }) => {
    await page.goto('/login?profile=blank');
    await signIn(page, 'kavin');
    await page
      .getByRole('dialog', { name: 'Welcome to Ati Flow' })
      .getByRole('button', { name: 'Start Walkthrough' })
      .click();
    const pop = page.locator('.driver-popover');
    for (let i = 0; i < 6; i++) {
      await pop.getByRole('button', { name: 'Next' }).click(); // robots ... master data
      await expect(pop.getByText(`${i + 2} of 9`)).toBeVisible();
    }
    await expect(pop.getByText('Master data')).toBeVisible();
    await pop.getByRole('button', { name: 'Next' }).click();
    await expect(
      pop.getByRole('heading', { name: 'Workflows' }).or(pop.getByText('Workflows', { exact: true })),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/configurator\/workflows\//);
  });
});

test.describe('the demo data', () => {
  test('is not interrupted: no welcome window, no setup card, no Blank tag', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/maps');
    await expect(page.getByRole('dialog', { name: 'Welcome to Ati Flow' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open setup progress' })).toHaveCount(0);
    await expect(page.getByText('Blank', { exact: true })).toHaveCount(0);
    await expect(page.locator('a[href^="/configurator/maps/"]').first()).toBeVisible(); // the built-in maps are there
  });
});

test.describe('starting a workspace over', () => {
  test('the blank workspace can be reset from Settings; the demo workspace cannot', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/settings/general');
    await expect(page.getByRole('button', { name: 'Delete and start over' })).toHaveCount(0); // not offered for the demo data
    await page.goto('/login?profile=blank');
    await signIn(page, 'kavin');
    await page
      .getByRole('dialog', { name: 'Welcome to Ati Flow' })
      .getByRole('button', { name: 'Skip Walkthrough' })
      .click();
    await page.goto('/configurator/settings/general');
    await page.getByRole('button', { name: 'Delete and start over' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete and start over' }).click();
    await page.waitForURL(/settings/);
    await expect(
      page.getByRole('dialog', { name: 'Welcome to Ati Flow' }).or(page.getByRole('button', { name: 'Log in' })),
    ).toBeVisible(); // everything of that workspace is gone, the sign-in too
  });
});
