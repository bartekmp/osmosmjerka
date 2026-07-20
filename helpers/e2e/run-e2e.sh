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

# Ports default to free/random (resolved after preflight) so parallel jobs or leftover
# containers on a shared agent don't clash; override with E2E_APP_PORT / E2E_PG_PORT.
APP_PORT="${E2E_APP_PORT:-}"
PG_PORT="${E2E_PG_PORT:-}"
PG_IMAGE="${E2E_PG_IMAGE:-postgres:18-alpine}"
PG_NAME="osm-e2e-pg-$$"
VENV="$ROOT/backend/.venv"
ADMIN_USER="e2e-admin"
ADMIN_PASS="e2e-pass-$$"
DEMO_USER="e2e-demo"
DEMO_PASS="e2e-demo-pass-$$"

BACKEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
  rm -rf "$ROOT/backend/static" 2>/dev/null || true
}
[ -n "${E2E_KEEP_UP:-}" ] || trap cleanup EXIT

echo "==> Preflight"
command -v docker  >/dev/null || { echo "docker is required"; exit 1; }
command -v node    >/dev/null || { echo "node is required"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }

# Resolve a free host port for the app unless pinned (Postgres gets one from docker below).
[ -n "$APP_PORT" ] || APP_PORT="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
BASE_URL="http://127.0.0.1:${APP_PORT}"

# Self-provision the backend venv when missing (the CI E2E stage runs on its own agent with
# a fresh workspace, so it can't rely on an earlier Install Dependencies stage).
if [ ! -x "$VENV/bin/python" ]; then
  echo "==> Creating backend venv"
  PYBIN="$(command -v python3.13 || command -v python3)"
  "$PYBIN" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  ( cd "$ROOT" && "$VENV/bin/pip" install --quiet ".[dev]" )
fi

echo "==> Starting Postgres ($PG_IMAGE)"
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
if [ -n "$PG_PORT" ]; then
  docker run -d --name "$PG_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=osmosmjerka \
    -p "127.0.0.1:${PG_PORT}:5432" "$PG_IMAGE" >/dev/null
else
  # Let docker assign a free host port, then read it back — no fixed port to clash on.
  docker run -d --name "$PG_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=osmosmjerka \
    -p "127.0.0.1:0:5432" "$PG_IMAGE" >/dev/null
  PG_PORT="$(docker port "$PG_NAME" 5432/tcp | head -1 | sed 's/.*://')"
fi
echo "    Postgres on :$PG_PORT, app will use :$APP_PORT"
for _ in $(seq 1 60); do docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

echo "==> Building frontend and serving it from the backend"
# npm ci: the E2E agent reuses its workspace between builds, so a cached node_modules
# can be stale and miss deps added since (e.g. the TTS build assets). Unlike `npm
# install`, `npm ci` always wipes node_modules and installs exactly what
# package-lock.json pins, so this can never drift from a prior build's leftovers.
( cd "$ROOT/frontend" && npm ci )
( cd "$ROOT/frontend" && VITE_BASE_PATH=/static/ npm run build )
rm -rf "$ROOT/backend/static"
cp -r "$ROOT/frontend/build" "$ROOT/backend/static"

# Throwaway admin + demo creds for this run (independent of any real credentials). The
# demo account exercises the same self-provisioning path staging uses (DEMO_USERNAME /
# DEMO_PASSWORD_HASH), so the e2e suite covers a regular-user login through the real form.
ADMIN_HASH="$("$VENV/bin/python" -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode())" "$ADMIN_PASS")"
DEMO_HASH="$("$VENV/bin/python" -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode())" "$DEMO_PASS")"

echo "==> Starting backend on :$APP_PORT"
(
  cd "$ROOT/backend"
  POSTGRES_HOST=127.0.0.1 POSTGRES_PORT="$PG_PORT" POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=postgres POSTGRES_DATABASE=osmosmjerka \
  ADMIN_USERNAME="$ADMIN_USER" ADMIN_PASSWORD_HASH="$ADMIN_HASH" ADMIN_SECRET_KEY="e2e-secret-$$" \
  DEMO_USERNAME="$DEMO_USER" DEMO_PASSWORD_HASH="$DEMO_HASH" \
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
  E2E_DEMO_USERNAME="$DEMO_USER" E2E_DEMO_PASSWORD="$DEMO_PASS" \
  npx playwright test --config e2e/playwright.config.js

echo "==> E2E passed"
