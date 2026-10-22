import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Ati AI assistant' });
async function open(page: Page) {
  await page.getByRole('button', { name: 'Ati AI' }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe('Ati AI', () => {
  test('an operator books a trip with taps only, and it is a real booking', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await open(page);
    const p = panel(page);
    await p.getByRole('button', { name: 'Book a trip' }).first().click();
    await expect(p.getByText('Where should the robot pick up?')).toBeVisible();
    await p.locator('.ai-body').last().getByRole('group').getByRole('button').first().click(); // a pickup station
    await expect(p.getByText(/Where should it go\?/)).toBeVisible();
    await p.locator('.ai-body').last().getByRole('group').getByRole('button').first().click(); // a drop station
    await p.getByRole('button', { name: 'Normal' }).click();
    const card = p.getByRole('region', { name: /^Send AMR-\d+ from/ });
    await expect(card).toBeVisible();
    // nothing is booked before the confirmation
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('atiflow.bookings.v1') ?? '{"trips":[]}').trips?.length ?? 0,
      ),
    ).toBe(0);
    await card.getByRole('button', { name: 'Confirm' }).click();
    await expect(p.getByText(/^Done\. Trip TRP-\d+ is booked/)).toBeVisible();
    await page.goto('/operator/history');
    await page.getByRole('radio', { name: /^Booked trips/ }).click();
    await expect(page.getByText(/→/).first()).toBeVisible();
  });

  test('an operator asks where the robot is in plain words', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await open(page);
    const p = panel(page);
    await p.getByRole('textbox').fill('where is my robot');
    await p.getByRole('textbox').press('Enter');
    await expect(p.getByText(/Trip TRP-\d+|You have no trips yet/).first()).toBeVisible();
  });

  test('a supervisor gets KPI tiles, a chart and insights for the shift summary', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    await open(page);
    const p = panel(page);
    await p.getByRole('button', { name: "Summarize today's shift" }).first().click();
    await expect(p.getByText('Trips finished', { exact: true }).first()).toBeVisible();
    await expect(p.getByRole('img', { name: /Trips finished per hour/ })).toBeVisible();
    await expect(p.getByText(/Suggested action/)).toBeVisible();
  });

  test('a configurator describes a workflow and gets a preview with fixes', async ({ page }) => {
    await signIn(page, 'kavin');
    await page.goto('/configurator/robots');
    await open(page);
    const p = panel(page);
    await p
      .getByRole('textbox')
      .fill('When a cart arrives at Station A, wait for operator confirm, then go to Station B');
    await p.getByRole('textbox').press('Enter');
    await expect(p.getByRole('region', { name: /Workflow draft/ })).toBeVisible();
    await expect(p.getByText(/No timeout on step/)).toBeVisible();
    await p.getByRole('button', { name: 'Apply suggested fixes' }).click();
    await p.getByRole('button', { name: 'Confirm' }).click(); // a change to the draft is confirmed first
    await expect(p.getByText(/Applied every suggested fix/)).toBeVisible();
  });

  test('the panel is in the sidebar surface, pushes the page, and Ctrl+J / Esc work', async ({ page }) => {
    await signIn(page, 'arjun');
    await page.goto('/supervisor/dashboard');
    const before = await page.locator('.main').evaluate((e) => e.getBoundingClientRect().width);
    await page.keyboard.press('Control+j');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('textbox')).toBeFocused();
    const bg = await page.evaluate(() => {
      const bgOf = (sel: string) => getComputedStyle(document.querySelector(sel)!).backgroundImage;
      return [bgOf('.sidebar'), bgOf('.ai')];
    });
    expect(bg[1]).toBe(bg[0]);
    await expect
      .poll(() => page.locator('.main').evaluate((e) => e.getBoundingClientRect().width))
      .toBeLessThan(before - 300);
    await panel(page).getByRole('textbox').press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect
      .poll(() => page.locator('.main').evaluate((e) => e.getBoundingClientRect().width))
      .toBeGreaterThan(before - 5);
  });

  test('the microphone is the main button: talk, and the sentence is sent when you stop', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = '';
        interimResults = false;
        continuous = false;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          const r = (text: string, isFinal: boolean) => ({
            results: [Object.assign([{ transcript: text }], { isFinal })],
          });
          setTimeout(() => this.onresult?.(r('where is', false)), 100);
          setTimeout(() => this.onresult?.(r('where is my robot', true)), 250);
          setTimeout(() => this.onend?.(), 350);
        }
        stop() {}
        abort() {}
      }
      Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
    });
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await open(page);
    const p = panel(page);
    await p.getByRole('button', { name: 'Talk to Ati AI' }).click();
    await expect(p.getByRole('button', { name: 'Stop listening' })).toBeVisible();
    await expect(p.getByText(/Trip TRP-\d+|You have no trips yet/).first()).toBeVisible();
    await expect(p.locator('.ai-bubble').first()).toHaveText('where is my robot');
  });

  test('there is no role chip: the assistant follows the workspace of the page', async ({ page }) => {
    await signIn(page, 'meera');
    await page.goto('/configurator/robots');
    await open(page);
    const p = panel(page);
    await expect(p.getByRole('textbox', { name: /^Describe a workflow/ })).toBeVisible();
    await expect(p.getByRole('button', { name: /Operator|Supervisor|Configurator/ })).toHaveCount(0);
    await page.goto('/supervisor/dashboard');
    await expect(p.getByRole('textbox', { name: /^Ask about your fleet/ })).toBeVisible();
    const [box, button] = await Promise.all([
      p.getByRole('textbox').evaluate((e) => e.getBoundingClientRect()),
      p.locator('.ai-send').evaluate((e) => e.getBoundingClientRect()),
    ]);
    expect(Math.abs(box.top + box.height / 2 - (button.top + button.height / 2))).toBeLessThan(2); // text box centred with the button
  });
});
