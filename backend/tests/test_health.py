"""Unit tests for the /api/health monitoring endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.game_api import health as health_module
from osmosmjerka.game_api import router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_health_cache():
    """The endpoint caches its answer, so every test must start cold."""
    health_module._cache = None
    yield
    health_module._cache = None


def _database(fetch_val):
    db = AsyncMock()
    db.fetch_val = fetch_val
    return db


class TestHealthEndpoint:
    def test_reports_ok_when_the_database_answers(self, client):
        with patch.object(health_module.db_manager, "database", _database(AsyncMock(return_value=1))):
            response = client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok", "db": True}

    def test_reports_degraded_with_503_when_the_query_fails(self, client):
        failing = AsyncMock(side_effect=RuntimeError("connection refused"))
        with patch.object(health_module.db_manager, "database", _database(failing)):
            response = client.get("/api/health")

        # 503 so a blackbox http_2xx probe fails and alerts without parsing the body.
        assert response.status_code == 503
        assert response.json() == {"status": "degraded", "db": False}

    def test_reports_degraded_when_the_database_is_not_connected(self, client):
        with patch.object(health_module.db_manager, "database", None):
            response = client.get("/api/health")

        assert response.status_code == 503
        assert response.json() == {"status": "degraded", "db": False}

    def test_leaks_nothing_beyond_status_and_db(self, client):
        """The endpoint is reachable from the tailnet and the LAN ingress, so the body
        must not carry a version, hostname or error text."""
        failing = AsyncMock(side_effect=RuntimeError("password authentication failed for user 'admin'"))
        with patch.object(health_module.db_manager, "database", _database(failing)):
            response = client.get("/api/health")

        assert set(response.json().keys()) == {"status", "db"}
        assert "password" not in response.text
        assert "admin" not in response.text

    def test_caches_so_a_burst_costs_one_query(self, client):
        fetch_val = AsyncMock(return_value=1)
        with patch.object(health_module.db_manager, "database", _database(fetch_val)):
            statuses = {client.get("/api/health").status_code for _ in range(25)}

        assert statuses == {200}
        assert fetch_val.await_count == 1

    def test_requeries_once_the_cache_has_expired(self, client):
        fetch_val = AsyncMock(return_value=1)
        with patch.object(health_module.db_manager, "database", _database(fetch_val)):
            client.get("/api/health")
            # Pretend the cached entry is older than the TTL.
            health_module._cache = (
                health_module._cache[0] - health_module.HEALTH_CACHE_TTL_SECONDS - 1,
                health_module._cache[1],
            )
            client.get("/api/health")

        assert fetch_val.await_count == 2

    def test_a_hung_database_does_not_hold_the_request_open(self, client):
        """A query that never returns must time out and report degraded."""

        async def never_returns(*args, **kwargs):
            import asyncio

            await asyncio.sleep(60)

        with patch.object(health_module, "HEALTH_DB_TIMEOUT_SECONDS", 0.05):
            with patch.object(health_module.db_manager, "database", _database(never_returns)):
                response = client.get("/api/health")

        assert response.status_code == 503
        assert response.json() == {"status": "degraded", "db": False}
