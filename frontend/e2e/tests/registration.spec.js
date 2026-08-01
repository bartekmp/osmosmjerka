// The account lifecycle end to end: sign up, activate, sign in, sign out.
//
// The confirmation link is read out of the backend log. That isn't a shortcut around the
// real flow - with no SMTP server configured the backend logs the message instead of
// sending it, which is the documented offline behaviour, so this exercises exactly the
// path a real user follows.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TOKEN } from './helpers';

const BACKEND_LOG = process.env.E2E_BACKEND_LOG || '';
const PASSWORD = 'a-really-decent-passphrase';

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Pull a link out of the logged email addressed to `email`.
 *
 * Scoped to the recipient on purpose: every spec shares one backend, so "the last link in
 * the file" can hand back another test's token, which that test may already have spent.
 * The backend logs JSON, so a whole email is one line carrying both the To: header and the
 * link — matching within a single line makes the pairing unambiguous.
 *
 * Note the doubled backslash in the pattern: the newlines inside that JSON string are
 * escaped as the two characters \ and n, not real newlines, so the regex has to match a
 * literal backslash.
 *
 * Polled because the line reaches this file through a pipe and can briefly lag the HTTP
 * response that produced it.
 */
async function tokenFromLog(kind, email) {
  const wanted = new RegExp(`To: ${escapeForRegExp(email)}\\\\n.*${kind}\\?token=([A-Za-z0-9_-]+)`);
  let token = null;

  await expect
    .poll(
      () => {
        for (const line of readFileSync(BACKEND_LOG, 'utf8').split('\n').reverse()) {
          const match = line.match(wanted);
          if (match) {
            token = match[1];
            return true;
          }
        }
        return false;
      },
      { message: `no ${kind} link for ${email} appeared in the backend log`, timeout: 15_000 }
    )
    .toBe(true);

  return token;
}

// Unique per run and per project, so desktop and mobile don't fight over one address.
function uniqueEmail(testInfo) {
  return `e2e-${testInfo.project.name}-${Date.now()}@example.com`;
}

async function signUp(page, email, password = PASSWORD) {
  await page.goto('/register');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel(/Confirm password/).fill(password);
  // The bot guard drops anything submitted faster than a person could type it, and
  // Playwright fills a form in milliseconds. Waiting here keeps the guard switched on for
  // these runs, so the specs prove it lets a real user through rather than skipping it.
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Create account/i }).click();
  // Match the success wording, not merely "an alert appeared" - a refusal renders an alert
  // too, and accepting it here would surface as a baffling failure several steps later.
  await expect(page.getByRole('alert')).toContainText(/confirmation link/i);
}

async function signIn(page, identifier, password = PASSWORD) {
  await page.goto('/admin');
  await page.getByPlaceholder(/Email or username/).fill(identifier);
  await page.getByPlaceholder(/^Password/).fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
}

// The logout control is icon-only on the mobile viewport - its visible label is hidden
// with CSS - so it is found by the accessible name AdminButton supplies for exactly that
// case. (An icon selector would not work here: MUI only emits data-testid on icons in
// development builds, and E2E runs the production bundle.)
function logoutButton(page) {
  return page.getByRole('button', { name: /logout/i });
}

test.describe('registration', () => {
  test.skip(!BACKEND_LOG, 'needs E2E_BACKEND_LOG (set by helpers/e2e/run-e2e.sh)');

  test.beforeEach(async ({ page }) => {
    // The "What's New" modal auto-opens and would intercept clicks.
    await page.addInitScript(() => localStorage.setItem('lastSeenVersion', '999.0.0'));
  });

  test('the whole lifecycle: sign up, activate, sign in, sign out', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);

    await test.step('sign up', async () => {
      await signUp(page, email);
    });

    await test.step('the account is unusable until it is activated', async () => {
      await signIn(page, email);
      await expect(page.locator('text=/confirm your email/i').first()).toBeVisible();
      // No session was created, so nothing was handed out to store.
      expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBeNull();
    });

    await test.step('activate from the emailed link', async () => {
      await page.goto(`/verify-email?token=${await tokenFromLog('verify-email', email)}`);
      await expect(page.getByRole('alert')).toContainText(/confirmed/i);
    });

    await test.step('sign in', async () => {
      await signIn(page, email);
      await expect(page.locator('text=/Welcome,/').first()).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBeTruthy();
      // A regular account, not something privileged, despite creating itself.
      await expect(page.getByRole('button', { name: /system settings/i })).not.toBeVisible();
    });

    await test.step('sign out', async () => {
      await logoutButton(page).click();

      // The session is gone three ways: the stored token, the authenticated UI, and the
      // login form coming back.
      await expect(page.getByPlaceholder(/Email or username/)).toBeVisible();
      await expect(page.locator('text=/Welcome,/')).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBeNull();
    });

    await test.step('signing out survives a reload', async () => {
      // Guards the failure where only component state was cleared: a reload would then
      // rehydrate the old token and put the user straight back in.
      await page.reload();
      await expect(page.getByPlaceholder(/Email or username/)).toBeVisible();
      await expect(page.locator('text=/Welcome,/')).toHaveCount(0);
    });

    await test.step('the same credentials still work afterwards', async () => {
      // Sign-out must end the session, not damage the account.
      await signIn(page, email);
      await expect(page.locator('text=/Welcome,/').first()).toBeVisible();
    });
  });

  test('an admin can activate an account whose email never arrived', async ({ page, request }, testInfo) => {
    test.skip(!TOKEN, 'needs E2E_ADMIN_TOKEN (set by helpers/e2e/run-e2e.sh)');
    const email = uniqueEmail(testInfo);

    await signUp(page, email);

    // The other activation route: the address is real but the mail never landed, so an
    // admin confirms it by hand instead of the user opening a link.
    const users = await (
      await request.get('/admin/users?limit=200', { headers: { Authorization: `Bearer ${TOKEN}` } })
    ).json();
    const account = users.users.find((candidate) => candidate.email === email);
    expect(account, `no account was created for ${email}`).toBeTruthy();
    expect(account.email_verified).toBe(false);

    const confirmed = await request.post(`/admin/users/${account.id}/confirm-email`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(confirmed.ok()).toBeTruthy();

    await signIn(page, email);
    await expect(page.locator('text=/Welcome,/').first()).toBeVisible();

    await logoutButton(page).click();
    await expect(page.getByPlaceholder(/Email or username/)).toBeVisible();
  });

  test('a forgotten password can be reset from the emailed link', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    const newPassword = 'an-even-better-passphrase';

    await signUp(page, email);

    await page.goto('/forgot-password');
    await page.getByLabel(/^Email/).fill(email);
    // Guarded like the sign-up form, and for the same reason: it emails an address someone
    // typed in. So it needs the same human-speed pause.
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Send the reset link/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.goto(`/reset-password?token=${await tokenFromLog('reset-password', email)}`);
    await page.getByLabel(/New Password/i).fill(newPassword);
    await page.getByLabel(/Confirm password/i).fill(newPassword);
    await page.getByRole('button', { name: /Set the new password/i }).click();
    await expect(page.getByRole('alert')).toContainText(/changed/i);

    // Completing a reset also confirms the address, so this account can sign straight in
    // even though its confirmation link was never opened.
    await signIn(page, email, newPassword);
    await expect(page.locator('text=/Welcome,/').first()).toBeVisible();
  });

  test('a submission with the honeypot filled is silently ignored', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);

    await page.goto('/register');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/Confirm password/).fill(PASSWORD);
    // What a form-filling bot does: put something in every input it can find.
    await page.locator('input[name="website"]').fill('http://spam.example', { force: true });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Create account/i }).click();

    // Indistinguishable from success, so a bot cannot tell it was caught...
    await expect(page.getByRole('alert')).toContainText(/confirmation link/i);
    // ...but no account exists, so the credentials do not work.
    await signIn(page, email);
    await expect(page.locator('text=/Invalid credentials/i').first()).toBeVisible();
  });
});
