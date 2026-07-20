import { test, expect } from '@playwright/test';

// Exercises the actual login form (not a localStorage-injected token, unlike the other
// specs) against the demo account that DEMO_USERNAME/DEMO_PASSWORD_HASH self-provisions
// on backend startup — the same mechanism staging uses. Confirms it logs in as a plain
// "regular" user, not anything privileged.
const DEMO_USERNAME = process.env.E2E_DEMO_USERNAME;
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD;

test('demo account: logs in through the real form as a non-privileged regular user', async ({ page }) => {
  test.skip(!DEMO_USERNAME || !DEMO_PASSWORD, 'E2E_DEMO_USERNAME/E2E_DEMO_PASSWORD not set for this run');

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('Username').fill(DEMO_USERNAME);
  await page.getByPlaceholder('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();

  // Exact role assertion via the dashboard's own "Welcome, {{username}} ({{role}})" copy.
  await expect(page.getByText(`Welcome, ${DEMO_USERNAME} (regular)`)).toBeVisible({ timeout: 10_000 });

  // Available to every logged-in user...
  await expect(page.getByRole('button', { name: 'My Study' })).toBeVisible();
  // ...but root_admin/administrative-only tools must not appear for a regular account.
  await expect(page.getByRole('button', { name: 'Statistics Dashboard' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: /system settings/i })).not.toBeVisible();
});
