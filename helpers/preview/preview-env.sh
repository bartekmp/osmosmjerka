#!/usr/bin/env bash
#
# preview-env.sh — spin up (or tear down) a disposable preview of the whole app for a git
# branch, backed by a throwaway clone of the PROD database. Pure Docker; no k8s/Flux.
#
# Each preview = a dedicated docker network + a throwaway Postgres sidecar (cloned from
# prod) + the app image built from the current checkout, published on a random high port.
# Everything is labelled so it can be torn down cleanly.
#
# Usage:
#   preview-env.sh up   <branch>          build + run; prints the URL and preview id
#   preview-env.sh down <preview-id>      destroy one preview
#   preview-env.sh list                   list running previews
#   preview-env.sh cleanup [max_hours]    destroy previews older than max_hours (default 24)
#
# Source DB to clone FROM (prod) — provide EITHER a URL or the discrete params:
#   SOURCE_DATABASE_URL      e.g. postgresql://user:pass@prod-host:5432/osmosmjerka
#   -- or --
#   SOURCE_DB_HOST, SOURCE_DB_PORT (default 5432), SOURCE_DB_USER, SOURCE_DB_PASSWORD,
#   SOURCE_DB_NAME
#
# App admin secrets (same names the app + the main Jenkinsfile use):
#   ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SECRET_KEY
#
# Optional:
#   PREVIEW_PG_IMAGE   postgres image for the sidecar/clone (default: postgres:18)
#   PREVIEW_HOST       hostname printed in the URL (default: localhost)
#   REPO_ROOT          path to the checked-out repo to build (default: git toplevel of CWD)
#   PREVIEW_SKIP_MIGRATIONS=1   skip `alembic upgrade head` after cloning
#
set -euo pipefail

LABEL="com.osmosmjerka.preview"
PG_IMAGE="${PREVIEW_PG_IMAGE:-postgres:18}"
DB_PASS="preview"
DB_NAME="osmosmjerka"

log()  { printf '\033[1;34m[preview]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[preview] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

sanitize() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's#[^a-z0-9]+#-#g; s#^-+|-+$##g' | cut -c1-24; }
require_env() { for v in "$@"; do [ -n "${!v:-}" ] || die "missing required env: $v"; done; }
containers_of() { docker ps -aq --filter "label=$LABEL=$1"; }

require_source() {
  [ -n "${SOURCE_DATABASE_URL:-}" ] && return 0
  for v in SOURCE_DB_HOST SOURCE_DB_USER SOURCE_DB_PASSWORD SOURCE_DB_NAME; do
    [ -n "${!v:-}" ] || die "set SOURCE_DATABASE_URL, or all of SOURCE_DB_HOST/USER/PASSWORD/NAME"
  done
}

pg_ready() {  # wait until a db container accepts connections
  local c="$1"
  for _ in $(seq 1 60); do docker exec "$c" pg_isready -U postgres >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}

up() {
  local branch="${1:?usage: up <branch>}"
  [ "$branch" = "main" ] && die "refusing to create a preview for main"
  require_source
  require_env ADMIN_USERNAME ADMIN_PASSWORD_HASH ADMIN_SECRET_KEY

  local root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
  local id net db app img created
  id="$(sanitize "$branch")-$RANDOM"
  net="osmo-prev-net-$id"; db="osmo-prev-db-$id"; app="osmo-prev-app-$id"; img="osmo-preview:$id"
  created="$(date +%s)"

  # Best-effort cleanup if anything below fails.
  trap 'log "up failed — cleaning up $id"; down "$id" >/dev/null 2>&1 || true' ERR

  log "building app image from $root ($branch)…"
  docker build -q --build-arg VERSION="preview-$id" -t "$img" "$root" >&2

  log "creating network + throwaway postgres sidecar…"
  docker network create "$net" >/dev/null
  docker run -d --name "$db" --network "$net" -p 0:5432 \
    --label "$LABEL=$id" --label "$LABEL.created=$created" --label "$LABEL.role=db" \
    -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" "$PG_IMAGE" >/dev/null
  pg_ready "$db" || die "sidecar postgres did not become ready"
  local db_host_port; db_host_port="$(docker port "$db" 5432/tcp | head -1 | sed 's/.*://')"

  log "cloning prod DB → throwaway (via host network so Tailscale/VPN routes work)…"
  # The clone runs on the HOST network so it can reach prod exactly like the Jenkins host
  # can (incl. Tailscale), and restores into the sidecar via its published port. Source is
  # given either as a URL or via standard PG* env (no URL-encoding pitfalls with passwords).
  docker run --rm --network host \
    -e SRC_URL="${SOURCE_DATABASE_URL:-}" \
    -e PGHOST="${SOURCE_DB_HOST:-}" -e PGPORT="${SOURCE_DB_PORT:-5432}" \
    -e PGUSER="${SOURCE_DB_USER:-}" -e PGPASSWORD="${SOURCE_DB_PASSWORD:-}" -e PGDATABASE="${SOURCE_DB_NAME:-}" \
    -e DST="postgresql://postgres:$DB_PASS@127.0.0.1:$db_host_port/$DB_NAME" \
    "$PG_IMAGE" bash -lc '
      set -euo pipefail
      if [ -n "$SRC_URL" ]; then
        pg_dump --no-owner --no-acl "$SRC_URL" | psql -v ON_ERROR_STOP=1 -q "$DST"
      else
        pg_dump --no-owner --no-acl | psql -v ON_ERROR_STOP=1 -q "$DST"
      fi' >&2

  if [ "${PREVIEW_SKIP_MIGRATIONS:-0}" != "1" ]; then
    log "applying branch migrations on top of the clone (alembic upgrade head)…"
    # The clone carries prod's alembic_version, so this applies only the branch's NEW
    # migrations — the whole point of a preview.
    docker run --rm --network "$net" -w /app/backend \
      -e POSTGRES_HOST="$db" -e POSTGRES_PORT=5432 -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DATABASE="$DB_NAME" \
      "$img" alembic upgrade head >&2
  fi

  log "starting app…"
  docker run -d --name "$app" --network "$net" -p 0:8085 \
    --label "$LABEL=$id" --label "$LABEL.created=$created" --label "$LABEL.role=app" \
    -e POSTGRES_HOST="$db" -e POSTGRES_PORT=5432 -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DATABASE="$DB_NAME" \
    -e ADMIN_USERNAME="$ADMIN_USERNAME" -e ADMIN_PASSWORD_HASH="$ADMIN_PASSWORD_HASH" \
    -e ADMIN_SECRET_KEY="$ADMIN_SECRET_KEY" -e DEVELOPMENT_MODE=false \
    "$img" >/dev/null

  local port; port="$(docker port "$app" 8085/tcp | head -1 | sed 's/.*://')"
  log "waiting for the app to answer…"
  local ok=0
  for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$port/" >/dev/null 2>&1 && { ok=1; break; }; sleep 1; done
  [ "$ok" = 1 ] || log "warning: app not answering yet — check: docker logs $app"

  trap - ERR
  printf '\nPreview READY\n  id:   %s\n  url:  http://%s:%s\n  down: %s down %s\n\n' \
    "$id" "${PREVIEW_HOST:-localhost}" "$port" "$0" "$id"
}

down() {
  local id="${1:?usage: down <preview-id>}"
  log "destroying preview $id…"
  local cs; cs="$(containers_of "$id")"
  [ -n "$cs" ] && docker rm -f $cs >/dev/null 2>&1 || true
  docker network rm "osmo-prev-net-$id" >/dev/null 2>&1 || true
  docker image rm -f "osmo-preview:$id" >/dev/null 2>&1 || true
  log "preview $id destroyed"
}

list() {
  printf '%-28s %-24s %s\n' "PREVIEW ID" "URL" "CREATED"
  local c id port created
  for c in $(docker ps -q --filter "label=$LABEL.role=app"); do
    id="$(docker inspect --format "{{index .Config.Labels \"$LABEL\"}}" "$c")"
    created="$(docker inspect --format "{{index .Config.Labels \"$LABEL.created\"}}" "$c")"
    port="$(docker port "$c" 8085/tcp | head -1 | sed 's/.*://')"
    printf '%-28s %-24s %s\n' "$id" "http://${PREVIEW_HOST:-localhost}:$port" "$(date -d "@$created" 2>/dev/null || echo "$created")"
  done
}

cleanup() {
  local max_hours="${1:-24}" cutoff; cutoff=$(( $(date +%s) - max_hours * 3600 ))
  log "removing previews older than ${max_hours}h…"
  local c id created
  for c in $(docker ps -aq --filter "label=$LABEL.role=db"); do
    id="$(docker inspect --format "{{index .Config.Labels \"$LABEL\"}}" "$c")"
    created="$(docker inspect --format "{{index .Config.Labels \"$LABEL.created\"}}" "$c")"
    if [ -n "$created" ] && [ "$created" -lt "$cutoff" ]; then down "$id"; fi
  done
}

case "${1:-}" in
  up)      shift; up "$@";;
  down)    shift; down "$@";;
  list)    list;;
  cleanup) shift; cleanup "$@";;
  *) echo "usage: $0 {up <branch> | down <preview-id> | list | cleanup [max_hours]}" >&2; exit 2;;
esac
