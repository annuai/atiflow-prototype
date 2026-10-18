import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: the real production build, served by `vite preview`, driven in Chromium like a person would. `npm run test:e2e`.
 * They start from an empty browser each time (the app then uses its built-in starting data and the dummy services).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // The 3D pages draw with software rendering, which crawls when the machine is busy: three workers instead of half the cores, a longer limit, and one retry
  // (a test that only passes on its retry is listed as "flaky" in the report, so a real bug does not hide behind it).
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
