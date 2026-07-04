import { test, expect } from '@playwright/test';
import { seedBrowser, capturePuzzle, crosswordInputIndex } from './helpers.js';

// Regular playing path for crossword: load a puzzle, type every answer, and confirm the
// whole board ends up solved (all cells filled and locked). Runs on desktop + mobile.
test('crossword: solve the whole puzzle', async ({ page }) => {
  await seedBrowser(page);
  const cap = capturePuzzle(page);

  await page.goto('/crosswords', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crossword-cell:not(.blank) input', { timeout: 20_000 });
  await page.waitForTimeout(600);

  expect(cap.puzzle, 'puzzle should have loaded').toBeTruthy();
  expect(cap.puzzle.phrases.length).toBeGreaterThan(0);

  const idx = crosswordInputIndex(cap.puzzle.grid);
  const inputs = await page.$$('.crossword-cell:not(.blank) input');

  for (const phrase of cap.puzzle.phrases) {
    const letters = phrase.phrase.replace(/\s/g, '').toUpperCase().split('');
    for (let i = 0; i < phrase.coords.length; i++) {
      const [r, c] = phrase.coords[i];
      const el = inputs[idx[`${r},${c}`]];
      // Skip cells already locked by an intersecting completed word.
      if (await el.evaluate((e) => e.disabled)) continue;
      await el.click();
      await page.keyboard.type(letters[i]);
    }
  }

  await page.waitForTimeout(500);

  // Every playable cell should now be filled and locked (correct + completed).
  const states = await Promise.all(inputs.map((el) => el.evaluate((e) => ({ v: e.value, d: e.disabled }))));
  const filled = states.filter((s) => s.v && s.v.length > 0).length;
  expect(filled).toBe(states.length);
  expect(states.every((s) => s.d)).toBeTruthy();
});
