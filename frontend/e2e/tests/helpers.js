// Shared helpers for the E2E specs.

export const TOKEN = process.env.E2E_ADMIN_TOKEN || '';
export const LANG = process.env.E2E_LANG_SET_ID || '1';

// Inject auth + preselected language set into localStorage before the app boots, so it
// loads a puzzle straight away for a "logged in" user.
export async function seedBrowser(page) {
  await page.addInitScript(
    ({ token, lang }) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('selectedLanguageSet', lang);
      // Suppress the "What's New" modal — it auto-opens for logged-in users on a new
      // version and would otherwise intercept clicks on the grid.
      localStorage.setItem('lastSeenVersion', '999.0.0');
      // Training defaults on for logged-in users and opens a "How well did you know
      // it?" rating dialog after every find/solve — a real feature, but it's a modal
      // that blocks further grid clicks, and these specs are testing the underlying
      // find/solve mechanic, not the rating flow. Opt this session out so the smoke
      // path stays uninterrupted (the rating dialog itself deserves its own test).
      localStorage.setItem('osmosmjerkaTrainingMode', 'false');
    },
    { token: TOKEN, lang: LANG }
  );
}

// Capture the exact puzzle the app renders (grid + phrases) by tapping the /api/phrases
// response while passing it through unchanged. Returns an object whose `.puzzle` is filled
// once the app has loaded a board.
export function capturePuzzle(page) {
  const holder = {};
  page.route('**/api/phrases**', async (route) => {
    const resp = await route.fetch();
    try {
      const json = await resp.json();
      if (Array.isArray(json.grid)) holder.puzzle = json;
    } catch {
      /* not JSON — ignore */
    }
    await route.fulfill({ response: resp });
  });
  return holder;
}

// Map "row,col" -> row-major index among non-blank cells (crossword inputs render in that
// order, and blank cells have no input).
export function crosswordInputIndex(grid) {
  const idx = {};
  let n = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        idx[`${r},${c}`] = n;
        n++;
      }
    }
  }
  return idx;
}
