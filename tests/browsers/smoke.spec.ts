import { expect, test, type Page } from '@playwright/test';
import { signIn } from '../e2e/helpers';

/**
 * Does the app work in this browser? Runs in Chromium, Firefox and WebKit (`npm run test:browsers`).
 * It fails on any uncaught error in the page and checks that the 3D views really draw something (a blank canvas is the usual way a browser, GPU or driver lets us down).
 */
const problems = new WeakMap<Page, string[]>();
/** Not problems of the app: web fonts that the test machine cannot download, and requests a browser cancels when the test moves on to the next page (each browser words that differently; WebKit reports a cancelled lazy page as "Importing a module script failed"). A page that really fails to load is still caught below: the error page text, or a 3D view that is not drawn. */
const NOISE =
  /favicon|Failed to load resource|downloadable font|Load failed|Importing a module script failed|operation was aborted|NetworkError|AbortError/i;
test.beforeEach(({ page }) => {
  const list: string[] = [];
  problems.set(page, list);
  page.on('pageerror', (e) => {
    if (!NOISE.test(e.message)) list.push(`uncaught: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) list.push(`console: ${m.text()}`);
  });
});
test.afterEach(({ page }) => expect(problems.get(page), 'errors in the page').toEqual([]));

/** The canvas draws more than a flat colour: a picture of the scene is hundreds of times bigger than a blank one once compressed. */
async function expectDrawn(page: Page, what: string) {
  const canvas = page.locator('canvas').first();
  await expect(canvas, `${what}: canvas`).toBeVisible();
  await expect
    .poll(async () => (await canvas.screenshot()).length, { message: `${what} is drawn`, timeout: 30_000 })
    .toBeGreaterThan(15_000);
}

test('what this browser can do (printed in the report)', async ({ page, browserName }) => {
  await page.goto('/login');
  const caps = await page.evaluate(() => {
    const gl2 = !!document.createElement('canvas').getContext('webgl2');
    const gl1 = !!document.createElement('canvas').getContext('webgl');
    return {
      webgl2: gl2,
      webgl1: gl1,
      roundRect: typeof CanvasRenderingContext2D.prototype.roundRect === 'function',
      structuredClone: typeof structuredClone === 'function',
      arrayAt: typeof [].at === 'function',
      hasSelector: CSS.supports('selector(:has(a))'),
      inert: 'inert' in HTMLElement.prototype,
      resizeObserver: typeof ResizeObserver === 'function',
      indexedDB: typeof indexedDB !== 'undefined',
      speech: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    };
  });
  test.info().annotations.push({ type: browserName, description: JSON.stringify(caps) });
  console.log(browserName, JSON.stringify(caps));
  expect(caps.webgl2, 'WebGL 2 is needed for the 3D views').toBe(true);
});

test('sign-in page, then the supervisor pages open', async ({ page }) => {
  await signIn(page, 'arjun');
  await expect(page).toHaveURL(/\/supervisor\//);
  for (const path of ['/supervisor/dashboard', '/supervisor/reports', '/supervisor/action-center']) {
    await page.goto(path);
    await expect(page.getByText('This page could not be shown')).toHaveCount(0);
    await expect(page.locator('.topbar')).toBeVisible();
  }
});

test('the Live Floor draws the 3D scene, then the 2D plan', async ({ page }) => {
  await signIn(page, 'arjun');
  await page.goto('/supervisor/livefloor');
  await expect(page.getByText('This page could not be shown')).toHaveCount(0);
  await expectDrawn(page, 'the 3D Live Floor');
  await page.getByRole('radio', { name: '2D', exact: true }).click();
  await page.waitForTimeout(1500);
  await expectDrawn(page, 'the 2D plan');
});

test('configurator pages and the Map Editor', async ({ page }) => {
  await signIn(page, 'meera');
  for (const path of [
    '/configurator/robots',
    '/configurator/master-data/materials',
    '/configurator/users',
    '/configurator/maps',
  ]) {
    await page.goto(path);
    await expect(page.getByText('This page could not be shown')).toHaveCount(0);
    await expect(page.locator('.topbar')).toBeVisible();
  }
  await page.goto('/configurator/maps/main-assembly');
  await expect(page.getByText('This page could not be shown')).toHaveCount(0);
  await expect(page.locator('svg').first()).toBeVisible();
});

test('the workflow builder opens', async ({ page }) => {
  await signIn(page, 'meera');
  await page.goto('/configurator');
  await expect(page).toHaveURL(/\/configurator\/workflows\//);
  await expect(page.getByText('This page could not be shown')).toHaveCount(0);
});
