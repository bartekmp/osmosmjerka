#!/usr/bin/env bash
#
# End-to-end smoke test runner for osmosmjerka.
#
# Spins up a fully throwaway stack — a Postgres container, the backend (from the repo's
# Python venv) serving the freshly-built frontend, seeded with one language set — and runs
# the Playwright specs (both game modes, desktop + mobile) against it. Everything is torn
# down on exit. Designed to run on the CD Jenkins agent (needs docker + node + the backend
# venv); see helpers/e2e/README.md.
#
# Env overrides: E2E_APP_PORT, E2E_PG_PORT, E2E_PG_IMAGE, E2E_KEEP_UP (leave stack running).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

APP_PORT="${E2E_APP_PORT:-8099}"
PG_PORT="${E2E_PG_PORT:-55432}"
PG_IMAGE="${E2E_PG_IMAGE:-postgres:18-alpine}"
PG_NAME="osm-e2e-pg-$$"
VENV="$ROOT/backend/.venv"
ADMIN_USER="e2e-admin"
ADMIN_PASS="e2e-pass-$$"
BASE_URL="http://127.0.0.1:${APP_PORT}"

BACKEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
  rm -rf "$ROOT/backend/static" 2>/dev/null || true
}
[ -n "${E2E_KEEP_UP:-}" ] || trap cleanup EXIT

echo "==> Preflight"
command -v docker >/dev/null || { echo "docker is required"; exit 1; }
command -v node   >/dev/null || { echo "node is required"; exit 1; }

# Self-provision the backend venv when missing (the CI E2E stage runs on its own agent with
# a fresh workspace, so it can't rely on an earlier Install Dependencies stage).
if [ ! -x "$VENV/bin/python" ]; then
  echo "==> Creating backend venv"
  PYBIN="$(command -v python3.13 || command -v python3)"
  "$PYBIN" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  ( cd "$ROOT" && "$VENV/bin/pip" install --quiet ".[dev]" )
fi

echo "==> Starting Postgres ($PG_IMAGE) on :$PG_PORT"
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=osmosmjerka \
  -p "${PG_PORT}:5432" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

echo "==> Building frontend and serving it from the backend"
# npm install (not ci): package-lock.json is git-ignored in this repo.
( cd "$ROOT/frontend" && [ -d node_modules ] || npm install )
( cd "$ROOT/frontend" && VITE_BASE_PATH=/static/ npm run build )
rm -rf "$ROOT/backend/static"
cp -r "$ROOT/frontend/build" "$ROOT/backend/static"

# Throwaway admin creds for this run (independent of any real credentials).
ADMIN_HASH="$("$VENV/bin/python" -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode())" "$ADMIN_PASS")"

echo "==> Starting backend on :$APP_PORT"
(
  cd "$ROOT/backend"
  POSTGRES_HOST=127.0.0.1 POSTGRES_PORT="$PG_PORT" POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=postgres POSTGRES_DATABASE=osmosmjerka \
  ADMIN_USERNAME="$ADMIN_USER" ADMIN_PASSWORD_HASH="$ADMIN_HASH" ADMIN_SECRET_KEY="e2e-secret-$$" \
  DEVELOPMENT_MODE=false \
  exec "$VENV/bin/python" -m uvicorn osmosmjerka.app:app --host 127.0.0.1 --port "$APP_PORT"
) &
BACKEND_PID=$!

echo "==> Seeding data"
SEED_OUT="$("$VENV/bin/python" "$ROOT/helpers/e2e/seed.py" "$BASE_URL" "$ADMIN_USER" "$ADMIN_PASS")"
E2E_ADMIN_TOKEN="$(printf '%s\n' "$SEED_OUT" | sed -n 's/^TOKEN=//p')"
E2E_LANG_SET_ID="$(printf '%s\n' "$SEED_OUT" | sed -n 's/^LANGSET=//p')"
[ -n "$E2E_ADMIN_TOKEN" ] && [ -n "$E2E_LANG_SET_ID" ] || { echo "seeding failed"; exit 1; }
echo "    language set id: $E2E_LANG_SET_ID"

echo "==> Installing Playwright browser (firefox)"
( cd "$ROOT/frontend"
  npx playwright install --with-deps firefox 2>/dev/null || npx playwright install firefox )

echo "==> Running Playwright specs (word search + crossword, desktop + mobile)"
cd "$ROOT/frontend"
E2E_BASE_URL="$BASE_URL" E2E_ADMIN_TOKEN="$E2E_ADMIN_TOKEN" E2E_LANG_SET_ID="$E2E_LANG_SET_ID" \
  npx playwright test --config e2e/playwright.config.js

echo "==> E2E passed"
