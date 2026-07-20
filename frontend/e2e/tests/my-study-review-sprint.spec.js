import { test, expect } from '@playwright/test';
import { seedBrowser } from './helpers.js';

// Review Sprint used to be reachable only as its own full-page route. It's now also
// embedded as a third tab in My Study — confirm switching to it renders in place
// (no navigation to a new URL) and that it actually mounts the widget.
test('My Study: Review sprint tab embeds in place, without navigating to a new page', async ({ page }) => {
  await seedBrowser(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'My Study' }).click();
  const reviewTab = page.getByRole('tab', { name: /review sprint/i });
  await reviewTab.waitFor({ state: 'visible', timeout: 10_000 });

  const urlBeforeTabClick = page.url();
  await reviewTab.click();

  expect(page.url()).toBe(urlBeforeTabClick);
  // Stats row (Tracked/Due/Mastered) renders regardless of whether anything is due yet.
  await expect(page.getByText(/tracked:/i)).toBeVisible({ timeout: 10_000 });
});
