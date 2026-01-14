from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import require_root_admin

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_root_admin_user():
    return {"username": "root", "role": "root_admin", "id": 0, "is_active": True}


@pytest.fixture
def mock_regular_user():
    return {"username": "user", "role": "regular", "id": 2, "is_active": True}


@pytest.mark.asyncio
async def test_get_statistics_enabled_root_admin(client, mock_root_admin_user):
    """Test getting statistics enabled status as root admin"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    with patch(
        "osmosmjerka.admin_api.settings.db_manager.is_statistics_enabled", new_callable=AsyncMock
    ) as mock_is_enabled:
        mock_is_enabled.return_value = True

        # Mock the auth dependency to return a root admin user
        app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user

        response = client.get("/admin/settings/statistics-enabled")
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        mock_is_enabled.assert_called_once()

        # Clean up
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_statistics_enabled_unauthorized(client):
    """Test getting statistics enabled status without authorization"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    response = client.get("/admin/settings/statistics-enabled")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_set_statistics_enabled_root_admin(client, mock_root_admin_user):
    """Test setting statistics enabled status as root admin"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    with patch(
        "osmosmjerka.admin_api.settings.db_manager.set_global_setting", new_callable=AsyncMock
    ) as mock_set_setting:
        # Mock the auth dependency to return a root admin user
        app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user

        response = client.post("/admin/settings/statistics-enabled", json={"enabled": True})
        assert response.status_code == 200
        mock_set_setting.assert_called_once_with(
            "statistics_enabled",
            "true",
            "Global flag to enable/disable statistics tracking",
            mock_root_admin_user["id"],
        )

        # Clean up
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_set_statistics_enabled_invalid_data(client, mock_root_admin_user):
    """Test setting statistics enabled with invalid data"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    with patch(
        "osmosmjerka.admin_api.settings.db_manager.set_global_setting", new_callable=AsyncMock
    ) as mock_set_setting:
        # Mock the auth dependency to return a root admin user
        app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user

        response = client.post("/admin/settings/statistics-enabled", json={"enabled": "invalid"})
        # Pydantic returns 422 Unprocessable Entity for validation errors
        assert response.status_code == 422

        response = client.post("/admin/settings/statistics-enabled", json={})
        assert response.status_code == 422

        # Ensure the database method was never called due to validation errors
        mock_set_setting.assert_not_called()

        # Clean up
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_clear_all_statistics_root_admin(client, mock_root_admin_user):
    """Test clearing all statistics as root admin"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    with patch("osmosmjerka.admin_api.settings.db_manager.clear_all_statistics", new_callable=AsyncMock) as mock_clear:
        # Mock the auth dependency to return a root admin user
        app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user

        response = client.delete("/admin/settings/clear-all-statistics")
        assert response.status_code == 200
        mock_clear.assert_called_once()

        # Clean up
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_settings_endpoints_non_root_admin(client, mock_regular_user):
    """Test that settings endpoints reject non-root admin users"""
    # Clear any existing overrides first
    app.dependency_overrides.clear()

    # Mock the auth dependency to return a regular user
    from osmosmjerka.auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_regular_user

    # These should all fail because the require_root_admin dependency will reject regular users
    # The status code could be 401 (unauthenticated) or 403 (forbidden) depending on test order
    response = client.get("/admin/settings/statistics-enabled")
    assert response.status_code in [401, 403]

    response = client.post("/admin/settings/statistics-enabled", json={"enabled": True})
    assert response.status_code in [401, 403]

    response = client.delete("/admin/settings/clear-all-statistics")
    assert response.status_code in [401, 403]

    # Clean up
    app.dependency_overrides.clear()
