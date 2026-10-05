import { test, expect } from '@playwright/test';
import { seedBrowser, TOKEN } from './helpers.js';

// Reported bug: the progressive-hint counter reset to its full three on every reload, so
// reloading after each hint gave an unlimited supply. Found words and the grid already
// survived a reload through localStorage; the hint counters were simply never written
// there, and came back from `useState(3)`.
//
// Desktop only: the hint button lives in the sidebar, and the mobile layout reaches it
// through the phrase-list sheet — a different interaction that isn't what this is about.
test.describe('progressive hints', () => {
  test('the used-hint count survives a reload', async ({ page, request, baseURL }) => {
    test.skip(test.info().project.name !== 'desktop', 'sidebar hint button, desktop only');

    // The global flag ships off, and without it the counter badge isn't rendered at all.
    const toggled = await request.post(`${baseURL}/admin/settings/progressive-hints-enabled`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      data: { enabled: true },
    });
    expect(toggled.ok(), 'enabling progressive hints').toBeTruthy();

    await seedBrowser(page);

    const badge = page.locator('.hint-button-container .MuiBadge-badge');
    const loadBoard = async () => {
      await page.waitForSelector('[data-grid-container="true"]', { timeout: 20_000 });
      await expect(badge).toBeVisible({ timeout: 10_000 });
    };

    await page.goto('/wordsearch', { waitUntil: 'domcontentloaded' });
    await loadBoard();
    await expect(badge).toHaveText('3');

    await page.locator('.hint-button').click();
    await expect(badge).toHaveText('2');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await loadBoard();
    await expect(badge, 'reloading must not hand out a fresh set of hints').toHaveText('2');
  });
});
