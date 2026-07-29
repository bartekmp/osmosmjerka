import asyncio
from unittest.mock import AsyncMock

import osmosmjerka.maintenance as maintenance
import pytest
from osmosmjerka.maintenance import (
    DEFAULT_INTERVAL_SECONDS,
    get_interval_seconds,
    run_maintenance_once,
    start_maintenance,
    stop_maintenance,
)


def test_interval_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("MAINTENANCE_INTERVAL_SECONDS", raising=False)
    assert get_interval_seconds() == DEFAULT_INTERVAL_SECONDS


def test_interval_read_from_env(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_INTERVAL_SECONDS", "42")
    assert get_interval_seconds() == 42


def test_interval_falls_back_on_garbage(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_INTERVAL_SECONDS", "not-a-number")
    assert get_interval_seconds() == DEFAULT_INTERVAL_SECONDS


@pytest.mark.asyncio
async def test_run_maintenance_once_calls_both_purges(monkeypatch):
    db = AsyncMock()
    db.cleanup_expired_notifications.return_value = 3
    db.cleanup_expired_sets.return_value = 1
    monkeypatch.setattr(maintenance, "db_manager", db)

    await run_maintenance_once()

    db.cleanup_expired_notifications.assert_awaited_once()
    db.cleanup_expired_sets.assert_awaited_once()


@pytest.mark.asyncio
async def test_one_failing_purge_does_not_skip_the_other(monkeypatch):
    """A broken notifications purge must not stop phrase sets from being cleaned."""
    db = AsyncMock()
    db.cleanup_expired_notifications.side_effect = RuntimeError("boom")
    db.cleanup_expired_sets.return_value = 2
    monkeypatch.setattr(maintenance, "db_manager", db)

    await run_maintenance_once()  # must not raise

    db.cleanup_expired_sets.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_maintenance_disabled_returns_none(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_INTERVAL_SECONDS", "0")
    assert start_maintenance() is None
    await stop_maintenance(None)  # no-op, must not raise


@pytest.mark.asyncio
async def test_loop_sweeps_then_cancels_cleanly(monkeypatch):
    db = AsyncMock()
    db.cleanup_expired_notifications.return_value = 0
    db.cleanup_expired_sets.return_value = 0
    monkeypatch.setattr(maintenance, "db_manager", db)
    monkeypatch.setenv("MAINTENANCE_INTERVAL_SECONDS", "1")

    task = start_maintenance()
    assert task is not None
    await asyncio.sleep(0.05)  # let the first sweep run
    await stop_maintenance(task)

    assert task.cancelled() or task.done()
    db.cleanup_expired_notifications.assert_awaited()
