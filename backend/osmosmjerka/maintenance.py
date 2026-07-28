"""Periodic background maintenance.

Both purge routines below existed for a long time but were never called by anything,
so expired notifications and past-``auto_delete_at`` teacher phrase sets accumulated
forever. This module runs them on an interval from the app lifespan.

Sized for the current single-pod deployment. If the app is ever scaled out every pod
runs the sweep; that is harmless (the deletes are idempotent and each is a single
statement) but a leader election would avoid the redundant work.
"""

import asyncio
import os

from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

# Seconds between sweeps. 0 (or negative) disables maintenance entirely.
DEFAULT_INTERVAL_SECONDS = 6 * 60 * 60


def get_interval_seconds() -> int:
    """Read the sweep interval from the environment, falling back to the default."""
    raw = os.getenv("MAINTENANCE_INTERVAL_SECONDS", "")
    if not raw:
        return DEFAULT_INTERVAL_SECONDS
    try:
        return int(raw)
    except ValueError:
        logger.warning(
            "Invalid MAINTENANCE_INTERVAL_SECONDS; using default",
            extra={"value": raw, "default_seconds": DEFAULT_INTERVAL_SECONDS},
        )
        return DEFAULT_INTERVAL_SECONDS


async def run_maintenance_once() -> None:
    """Run one sweep. Each purge is isolated so one failure can't skip the other."""
    try:
        deleted = await db_manager.cleanup_expired_notifications()
        logger.info("Expired notifications purged", extra={"deleted_count": deleted})
    except Exception:
        logger.exception("Failed to purge expired notifications")

    try:
        deleted = await db_manager.cleanup_expired_sets()
        logger.info("Expired phrase sets purged", extra={"deleted_count": deleted})
    except Exception:
        logger.exception("Failed to purge expired phrase sets")


async def maintenance_loop(interval_seconds: int) -> None:
    """Sweep every ``interval_seconds`` until cancelled.

    The whole body is guarded so a bug here can never take down the loop — only
    cancellation ends it.
    """
    while True:
        try:
            await run_maintenance_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Maintenance sweep failed")
        await asyncio.sleep(interval_seconds)


def start_maintenance() -> asyncio.Task | None:
    """Start the background sweep, or return None when disabled."""
    interval = get_interval_seconds()
    if interval <= 0:
        logger.info("Maintenance disabled", extra={"interval_seconds": interval})
        return None
    logger.info("Maintenance scheduled", extra={"interval_seconds": interval})
    return asyncio.create_task(maintenance_loop(interval))


async def stop_maintenance(task: asyncio.Task | None) -> None:
    """Cancel and await the sweep so shutdown doesn't log a pending-task warning."""
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("Maintenance stopped")
