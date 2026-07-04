import { test, expect } from '@playwright/test';
import { seedBrowser, capturePuzzle } from './helpers.js';

// Regular playing path for word search: load a puzzle, drag-select every word, and confirm
// all of them get marked found on the grid. Runs on desktop + mobile (mouse drag works for
// both — the grid handles mouse events regardless of touch).
test('word search: find every word', async ({ page }) => {
  await seedBrowser(page);
  const cap = capturePuzzle(page);

  await page.goto('/wordsearch', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-grid-container="true"]', { timeout: 20_000 });
  await page.waitForTimeout(600);

  expect(cap.puzzle, 'puzzle should have loaded').toBeTruthy();
  expect(cap.puzzle.phrases.length).toBeGreaterThan(0);

  await page.locator('[data-grid-container="true"]').scrollIntoViewIfNeeded();

  const centerOf = async (r, c) => {
    const box = await page.locator(`[data-row="${r}"][data-col="${c}"]`).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  const isWordFound = async (coords) => {
    for (const [r, c] of coords) {
      const cls = (await page.locator(`[data-row="${r}"][data-col="${c}"]`).getAttribute('class')) || '';
      if (!cls.split(/\s+/).includes('found')) return false;
    }
    return true;
  };

  const dragWord = async (coords) => {
    // Hover every cell of the word in turn so each throttled mouseenter registers and the
    // grid builds the full selection path before we release.
    const centers = [];
    for (const [r, c] of coords) centers.push(await centerOf(r, c));
    await page.mouse.move(centers[0].x, centers[0].y);
    await page.mouse.down();
    for (let i = 1; i < centers.length; i++) {
      await page.mouse.move(centers[i].x, centers[i].y, { steps: 4 });
      await page.waitForTimeout(30); // beat the 20ms mouseenter throttle
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
  };

  for (const phrase of cap.puzzle.phrases) {
    // Drag can occasionally miss; retry until the word registers as found.
    for (let attempt = 0; attempt < 4 && !(await isWordFound(phrase.coords)); attempt++) {
      await dragWord(phrase.coords);
    }
  }

  // The union of all word cells should now carry the `found` highlight.
  const expectedFound = new Set();
  for (const p of cap.puzzle.phrases) for (const [r, c] of p.coords) expectedFound.add(`${r},${c}`);

  await expect
    .poll(async () => page.locator('.grid-cell.found').count(), { timeout: 10_000 })
    .toBe(expectedFound.size);
});
