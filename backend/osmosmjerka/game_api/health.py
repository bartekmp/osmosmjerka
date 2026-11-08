"""Health endpoint for monitoring.

Deliberately NOT used by the Kubernetes probes. The deployment runs a single replica,
so failing readiness on a database problem would take the site down instead of shifting
traffic, and failing liveness would restart the app in a loop - which never fixes a
database. The kubelet probes check only that the process is serving; this endpoint is
for Prometheus, which can alert without being able to kill anything.
"""

import asyncio
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()

# The answer is cached so a burst of requests costs one query rather than one each:
# the connection pool is small (DB_POOL_SIZE, 10 by default) and this endpoint is
# reachable from the tailnet and the LAN ingress.
HEALTH_CACHE_TTL_SECONDS = 10

# A hung database must report degraded quickly instead of holding a pool connection.
HEALTH_DB_TIMEOUT_SECONDS = 2

# (monotonic timestamp, database reachable)
_cache: tuple[float, bool] | None = None


async def _database_reachable() -> bool:
    database = db_manager.database
    if database is None:
        return False
    try:
        await asyncio.wait_for(database.fetch_val("SELECT 1"), timeout=HEALTH_DB_TIMEOUT_SECONDS)
        return True
    except Exception:
        logger.warning("Health check: database is not reachable", exc_info=True)
        return False


@router.get("/health")
async def health() -> JSONResponse:
    """Report whether the app can reach its database.

    The body carries no version, hostname or error detail on purpose - there is
    nothing here worth leaking to whoever can reach the endpoint.
    """
    global _cache

    now = time.monotonic()
    if _cache is None or now - _cache[0] >= HEALTH_CACHE_TTL_SECONDS:
        _cache = (now, await _database_reachable())

    database_ok = _cache[1]
    # 503 when degraded, so a blackbox http_2xx probe fails and alerts on its own.
    return JSONResponse(
        {"status": "ok" if database_ok else "degraded", "db": database_ok},
        status_code=200 if database_ok else 503,
    )
