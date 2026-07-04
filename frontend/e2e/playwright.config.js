import { defineConfig } from '@playwright/test';

// E2E smoke tests for the two game modes on desktop + mobile. The stack (backend, DB,
// seeded data) is brought up by helpers/e2e/run-e2e.sh, which passes the base URL, admin
// token and language-set id through these env vars. Both projects use Firefox — it's the
// browser Playwright ships that runs reliably headless on the CD agent; "mobile" is a
// narrow touch viewport (the app's responsive layout keys off viewport width).
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // single shared backend; also stays under the /api/phrases rate limit
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    browserName: 'firefox',
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1400, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 393, height: 851 }, hasTouch: true } },
  ],
});
