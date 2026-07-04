# End-to-end smoke tests

Playwright smoke tests that play the **regular path of both game modes** (word search +
crossword) on **desktop and mobile** viewports, against a fully throwaway stack.

## What runs

`helpers/e2e/run-e2e.sh` orchestrates everything and tears it all down on exit:

1. A throwaway **Postgres** container (`docker`).
2. The **backend** (from `backend/.venv`) serving the freshly-built frontend from
   `backend/static` in production mode (`DEVELOPMENT_MODE=false`).
3. **Seeds** one language set of overlapping short words via the admin API
   (`helpers/e2e/seed.py`) — enough for the crossword generator to find intersections and
   for the word-search grid.
4. Runs the **Playwright** specs in `frontend/e2e/` and passes/fails accordingly.

Tests live in `frontend/e2e/tests/`; config in `frontend/e2e/playwright.config.js`
(two projects: `desktop` and `mobile`, both Firefox — the browser that runs reliably
headless on the CD agent; "mobile" is a narrow touch viewport).

## Running locally

```bash
# prerequisites: docker, node, and the backend venv (pip install .[dev])
cd frontend && npm ci        # installs @playwright/test
helpers/e2e/run-e2e.sh       # builds, serves, seeds, runs all 4 test executions
```

Useful env overrides: `E2E_APP_PORT` (default 8099), `E2E_PG_PORT` (default 55432),
`E2E_KEEP_UP=1` (leave the stack running for debugging).

## CI

Wired into the CD `Jenkinsfile` as the **E2E Smoke (Playwright)** stage, gated to
`branch main` + `IS_NEW_RELEASE == 'true'` — it runs only for an actual release merged to
main, before the GitOps deploy stage, so a failing smoke blocks the deploy. Playwright
artifacts (traces/screenshots on failure) are archived from `frontend/e2e/test-results/`.

The stage is **locked to the main Jenkins agent** via `agent { label ... }`, taking the
label from the dedicated global env var `E2E_AGENT`. Because a
stage-level agent gets its own fresh workspace, `run-e2e.sh` re-provisions everything it
needs — it creates the backend venv (`pip install .[dev]`), installs frontend deps, builds
the frontend, and installs Firefox (`npx playwright install firefox`). The agent only needs
**docker + node + python** available.
