// Self-service registration: sign up, confirm the emailed link, sign in with the address.
//
// The confirmation link is read out of the backend log. That isn't a shortcut around the
// real flow - with no SMTP server configured the backend logs the message instead of
// sending it, which is the documented offline behaviour, so this exercises exactly the
// path a real user follows.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BACKEND_LOG = process.env.E2E_BACKEND_LOG || '';
const PASSWORD = 'a-really-decent-passphrase';

function tokenFromLog(kind) {
  const log = readFileSync(BACKEND_LOG, 'utf8');
  const matches = [...log.matchAll(new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`, 'g'))];
  expect(matches.length, `no ${kind} link found in the backend log`).toBeGreaterThan(0);
  return matches[matches.length - 1][1];
}

// Unique per run and per project, so desktop and mobile don't fight over one address.
function uniqueEmail(testInfo) {
  return `e2e-${testInfo.project.name}-${Date.now()}@example.com`;
}

test.describe('registration', () => {
  test.skip(!BACKEND_LOG, 'needs E2E_BACKEND_LOG (set by helpers/e2e/run-e2e.sh)');

  test.beforeEach(async ({ page }) => {
    // The "What's New" modal auto-opens and would intercept clicks.
    await page.addInitScript(() => localStorage.setItem('lastSeenVersion', '999.0.0'));
  });

  test('sign up, confirm the email, then sign in with it', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);

    await page.goto('/register');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/Confirm password/).fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/i }).click();
    await expect(page.getByRole('alert')).toContainText(/confirmation link/i);

    // Until the address is confirmed, the credentials must not get you in.
    await page.goto('/admin');
    await page.getByPlaceholder(/Email or username/).fill(email);
    await page.getByPlaceholder(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page.locator('text=/confirm your email/i').first()).toBeVisible();

    await page.goto(`/verify-email?token=${tokenFromLog('verify-email')}`);
    await expect(page.getByRole('alert')).toContainText(/confirmed/i);

    await page.goto('/admin');
    await page.getByPlaceholder(/Email or username/).fill(email);
    await page.getByPlaceholder(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page.locator('text=/Welcome,/').first()).toBeVisible();
  });

  test('a forgotten password can be reset from the emailed link', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    const newPassword = 'an-even-better-passphrase';

    await page.goto('/register');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/Confirm password/).fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.goto('/forgot-password');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByRole('button', { name: /Send the reset link/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.goto(`/reset-password?token=${tokenFromLog('reset-password')}`);
    await page.getByLabel(/New Password/i).fill(newPassword);
    await page.getByLabel(/Confirm password/i).fill(newPassword);
    await page.getByRole('button', { name: /Set the new password/i }).click();
    await expect(page.getByRole('alert')).toContainText(/changed/i);

    // Completing a reset also confirms the address, so this account can sign straight in
    // even though its confirmation link was never opened.
    await page.goto('/admin');
    await page.getByPlaceholder(/Email or username/).fill(email);
    await page.getByPlaceholder(/^Password/).fill(newPassword);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page.locator('text=/Welcome,/').first()).toBeVisible();
  });
});
