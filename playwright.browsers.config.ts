import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser check, ON REQUEST ONLY (`npm run test:browsers`): the same production build opened in Chromium, Firefox and WebKit (the engine of Safari).
 * It is not part of `npm run test:e2e` or of the normal CI run; GitHub has a "Browsers" workflow you start by hand.
 * First time on a machine: `npx playwright install chromium firefox webkit` (about 300 MB).
 * One browser: `npm run test:browsers -- --project=webkit`.
 */
export default defineConfig({
  testDir: 'tests/browsers',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one 3D page at a time: several GPU pages at once make the results depend on the machine
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-browsers' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
