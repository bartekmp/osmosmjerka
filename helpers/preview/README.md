# Branch preview environments

Spin up a **disposable, full-app preview** of any branch (not `main`) on the Jenkins host,
backed by a **throwaway clone of the prod database**. Pure Docker — no Kubernetes, no Flux.
Meant for a quick "build it, click around, throw it away" loop.

This is a **separate, manually-triggered** pipeline — it is *not* part of the CD
`Jenkinsfile` (which builds on GitHub-Actions success and deploys via gitops/Flux) or the
prod `Jenkinsfile.promotion`.

Each preview is:

- a dedicated docker **network**,
- a throwaway **Postgres sidecar** cloned from prod (previews never touch prod itself),
- the **app image** built from the branch, published on a **random high port**.

Everything is labelled `com.osmosmjerka.preview=<id>` so it can be torn down cleanly.

## What happens on `up`

1. `docker build` the app image from the branch checkout (the standard multi-stage `Dockerfile`).
2. Start a throwaway `postgres:18` sidecar.
3. **Clone prod → sidecar** (`pg_dump | psql`). The clone runs on the **host network** so it
   reaches prod exactly like the Jenkins host does (incl. Tailscale/VPN), and restores into
   the sidecar via its published port.
4. **`alembic upgrade head`** against the clone — applies **only the branch's new migrations**
   on top of prod's schema (this is the point: test branch migrations safely).
5. Run the app container against the sidecar, published on a random high port.
6. Print the URL + the preview id + the teardown command.

## Usage (script)

```bash
# Source DB to clone FROM (prod): a URL, or the discrete params below.
export SOURCE_DB_HOST='prod-host' SOURCE_DB_PORT='5432' SOURCE_DB_NAME='osmosmjerka'
export SOURCE_DB_USER='...' SOURCE_DB_PASSWORD='...'
# (alternatively: export SOURCE_DATABASE_URL='postgresql://user:pass@prod-host:5432/osmosmjerka')

# App admin secrets for the preview (same names the app + main Jenkinsfile use).
export ADMIN_USERNAME='root'
export ADMIN_PASSWORD_HASH='<bcrypt hash>'
export ADMIN_SECRET_KEY='<random secret>'

helpers/preview/preview-env.sh up my-feature-branch    # build + run; prints URL + id
helpers/preview/preview-env.sh list                    # list running previews
helpers/preview/preview-env.sh down <preview-id>       # destroy one preview
helpers/preview/preview-env.sh cleanup 24              # destroy previews older than 24h (TTL)
```

Generate an admin password hash:

```bash
python3 -c "import bcrypt,getpass; print(bcrypt.hashpw(getpass.getpass().encode(), bcrypt.gensalt()).decode())"
```

### Optional env

| Var | Default | Meaning |
|-----|---------|---------|
| `PREVIEW_PG_IMAGE` | `postgres:18` | Postgres image for the sidecar/clone |
| `PREVIEW_HOST` | `localhost` | Hostname printed in the URL |
| `REPO_ROOT` | git toplevel of CWD | Path to the checked-out repo to build |
| `PREVIEW_SKIP_MIGRATIONS` | `0` | Set `1` to skip `alembic upgrade head` after cloning |

## Usage (Jenkins)

Create a **Pipeline script from SCM** job pointing at `Jenkinsfile.preview`, then run
it with the `ACTION` parameter (`up` / `down` / `list` / `cleanup`).

It **reuses the same credentials/env as the CD `Jenkinsfile`** — no new secrets to create:

| Source | Used as |
|--------|---------|
| `OSMOSMJERKA_POSTGRES_HOST` / `_PORT` / `_DATABASE` (global env) | prod DB host/port/name (clone source) |
| credential `osmosmjerka-db-user` / `osmosmjerka-db-password` | prod DB user/password |
| credential `osmosmjerka-admin-username` / `-admin-password-hash` / `-admin-secret-key` | preview admin login |

For `up`, the job checks out the chosen branch into `./app` and builds from there, so the
preview tooling stays on the branch the Jenkinsfile is loaded from.

## Notes & caveats

- **Prod reachability**: the clone step uses the host network, so the Jenkins host must be
  able to reach the prod DB (Tailscale/VPN is fine — this is the same host that already runs
  the CD pipeline with those creds).
- **Read-only on prod**: the clone only runs `pg_dump` against prod (no writes); all changes
  land in the throwaway sidecar.
- **Migrations**: if the branch is *behind* prod's migration history, `alembic upgrade head`
  will fail (the DB is at a revision the branch doesn't know) — surfaced as a build failure.
- **Cleanup**: previews persist until `down`/`cleanup`. Schedule a periodic `cleanup` job (e.g.
  hourly) so stray previews don't accumulate on the host.
- **Resources**: each preview holds an image + two containers; the sidecar DB is a full prod
  clone, so watch host disk if many run at once.
