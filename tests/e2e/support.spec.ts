import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const widget = (page: Page) => page.getByRole('dialog', { name: 'Ati Support' });
async function start(page: Page, user = 'rohan') {
  await signIn(page, user);
  await page.goto('/operator/book?devSupport=1');
  await page.getByRole('button', { name: 'Go to Support' }).click();
  await expect(widget(page)).toBeVisible();
}
const dev = (page: Page, group: 'hours' | 'net', name: string) =>
  widget(page)
    .getByRole('region', { name: 'Demo switches' })
    .getByText(group === 'hours' ? 'Support hours' : 'Internet', { exact: true })
    .locator('xpath=..')
    .getByRole('button', { name, exact: true });
async function triage(page: Page) {
  const w = widget(page);
  await w.getByRole('button', { name: 'Chat with us' }).click();
  await w.getByRole('button', { name: 'Robot', exact: true }).click();
  await w.getByRole('button', { name: 'Blocking' }).click();
  await w.getByRole('button', { name: 'Not about a robot' }).click();
  await expect(w.getByRole('region', { name: 'Robot stuck' })).toBeVisible();
  await w.getByRole('button', { name: 'Still need help' }).click();
}

test.describe('Ati Support', () => {
  test('within hours: a common issue, triage, a ticket, and the simulated agent joins', async ({ page }) => {
    await start(page);
    await dev(page, 'hours', 'Online').click();
    const w = widget(page);
    await expect(w.getByText(/Support online/)).toBeVisible();
    await w.getByRole('button', { name: 'Robot stuck' }).click(); // the chip starts the chat with the category filled in
    await w.getByRole('button', { name: 'Blocking' }).click();
    await w.getByRole('button', { name: 'Not about a robot' }).click();
    await w.getByRole('button', { name: 'Still need help' }).click();
    await expect(w.getByText(/ATI-10\d\d created|ATI-10\d\d/).first()).toBeVisible();
    await expect(w.getByText(/this is Priya from Ati Support/)).toBeVisible({ timeout: 15_000 });
  });

  test('outside hours: a ticket is logged with the reopening time and no agent appears', async ({ page }) => {
    await start(page);
    await dev(page, 'hours', 'Offline').click();
    const w = widget(page);
    await expect(w.getByText(/Support offline · back at 9:00 AM IST/)).toBeVisible();
    await triage(page);
    await expect(w.getByText(/Our team is offline\. We've logged your ticket ATI-10\d\d/)).toBeVisible();
    await page.waitForTimeout(8000);
    await expect(w.getByText(/this is Priya/)).toHaveCount(0);
  });

  test('without internet: chat is off, the number shows, a draft is saved and sent on reconnect', async ({ page }) => {
    await start(page);
    await dev(page, 'hours', 'Online').click();
    await dev(page, 'net', 'No internet').click();
    const w = widget(page);
    await expect(
      w.getByText("This system isn't connected to the internet. Chat and calls to support are unavailable."),
    ).toBeVisible();
    await expect(w.getByRole('button', { name: /Chat with us/ })).toBeDisabled();
    await w.getByRole('button', { name: /Call support/ }).click();
    await expect(w.getByRole('link', { name: '+91 9645738621' })).toHaveAttribute('href', 'tel:+919645738621');
    await w.getByRole('button', { name: 'Back', exact: true }).click();
    await w.getByRole('button', { name: /My tickets/ }).click();
    await w.getByRole('button', { name: 'Create ticket' }).click();
    await w.getByRole('textbox', { name: 'What happened?' }).fill('Robot AMR-007 keeps stopping');
    await w.getByRole('button', { name: 'Save to send later' }).click();
    await expect(w.getByText('Will send when connected')).toBeVisible();
    await dev(page, 'net', 'Auto').click(); // back online: the draft is sent
    await expect(page.getByText(/Ticket ATI-10\d\d sent/)).toBeVisible({ timeout: 10_000 });
    await expect(w.getByText('Will send when connected')).toHaveCount(0);
  });

  test('call screen: tel link, callback request, and "Call now" is off outside hours', async ({ page }) => {
    await start(page);
    await dev(page, 'hours', 'Online').click();
    const w = widget(page);
    await w.getByRole('button', { name: /Call support/ }).click();
    await expect(w.getByRole('link', { name: 'Call now' })).toBeVisible();
    await dev(page, 'hours', 'Offline').click();
    await expect(w.getByRole('button', { name: 'Call now' })).toBeDisabled();
    await expect(w.getByText(/Support is closed\. It reopens/)).toBeVisible();
    await w.getByRole('textbox', { name: 'Your phone number' }).fill('+91 98765 43210');
    await w.getByRole('button', { name: 'Request callback' }).click();
    await expect(w.getByText(/Callback requested/).first()).toBeVisible();
  });

  test('tickets: three seeded, an unread reply, the duplicate warning, and a reply that arrives', async ({ page }) => {
    await start(page);
    await dev(page, 'hours', 'Online').click();
    const w = widget(page);
    await expect(page.locator('.tb-badge')).toHaveText('1');
    await w.getByRole('button', { name: /My tickets/ }).click();
    await expect(w.getByText('ATI-1038')).toBeVisible();
    await expect(w.getByText('ATI-1031')).toBeVisible();
    await expect(w.getByText('ATI-1019')).toBeVisible();
    await expect(w.getByText('New reply')).toBeVisible();
    await w.getByRole('button', { name: 'Create ticket' }).click();
    await w.getByRole('button', { name: 'AMR-003' }).click();
    await expect(w.getByText(/You already have an open ticket about AMR-003 \(ATI-1038\)/)).toBeVisible();
    // a scripted agent reply arrives on the open ticket and the badge goes up
    await expect(page.locator('.tb-badge')).toHaveText('2', {
      timeout: 40_000,
    });
  });

  test('the window does not collide with the Ati AI panel, and there is no floating launcher', async ({ page }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await expect(page.locator('.sup-launch')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ati AI' }).click();
    await expect(page.getByRole('complementary', { name: 'Ati AI assistant' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Go to Support' }).click();
    await expect(widget(page)).toBeVisible();
    await expect(widget(page).getByRole('button', { name: 'Minimize' })).toHaveCount(0); // only Close
    await page.waitForTimeout(500);
    const [win, ai] = await Promise.all([
      widget(page).evaluate((e) => e.getBoundingClientRect()),
      page.locator('.ai').evaluate((e) => e.getBoundingClientRect()),
    ]);
    expect(win.right).toBeLessThanOrEqual(ai.left);
    await page.getByRole('button', { name: 'Go to Support' }).click(); // the same button closes it
    await expect(widget(page)).toBeHidden();
  });

  test('"Ask support" in Ati AI opens a ticket with the conversation as a preview, and sends nothing by itself', async ({
    page,
  }) => {
    await signIn(page, 'rohan');
    await page.goto('/operator/book');
    await page.getByRole('button', { name: 'Ati AI' }).click();
    const ai = page.getByRole('complementary', { name: 'Ati AI assistant' });
    await ai.getByRole('textbox').fill('where is my robot');
    await ai.getByRole('textbox').press('Enter');
    await expect(ai.getByText(/Trip TRP-\d+|You have no trips yet/).first()).toBeVisible();
    await ai.getByRole('button', { name: 'Ask support' }).click();
    const w = widget(page);
    await expect(w.getByText('Summary from Ati AI that will be sent with this ticket')).toBeVisible();
    await expect(w.getByText(/Person: where is my robot/).first()).toBeVisible();
    await expect(w.getByRole('button', { name: 'Send ticket' })).toBeVisible(); // a ticket is only made when this is pressed
  });
});
