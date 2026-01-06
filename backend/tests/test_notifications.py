"""Tests for notification system functionality."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import get_current_user

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def mock_user():
    return {"username": "testuser", "role": "teacher", "id": 10, "is_active": True}


@pytest.fixture
def mock_notifications():
    return [
        {
            "id": 1,
            "user_id": 10,
            "type": "info",
            "title": "Welcome",
            "message": "Welcome to the system",
            "link": None,
            "is_read": True,
            "created_at": "2024-01-01T10:00:00",
            "expires_at": None,
            "metadata": None,
        },
        {
            "id": 2,
            "user_id": 10,
            "type": "alert",
            "title": "Warning",
            "message": "Something happened",
            "link": "/alert",
            "is_read": False,
            "created_at": "2024-01-02T10:00:00",
            "expires_at": None,
            "metadata": {"key": "value"},
        },
    ]


@patch("osmosmjerka.database.db_manager.get_user_notifications")
def test_get_notifications(mock_get_notifs, client, mock_user, mock_notifications):
    """Test getting notifications."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_get_notifs.return_value = mock_notifications

    response = client.get("/admin/notifications")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] == "Welcome"
    assert data[1]["is_read"] is False

    mock_get_notifs.assert_called_with(10, limit=50, unread_only=False)


@patch("osmosmjerka.database.db_manager.get_user_notifications")
def test_get_notifications_unread_only(mock_get_notifs, client, mock_user, mock_notifications):
    """Test getting unread notifications only."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_get_notifs.return_value = [mock_notifications[1]]

    response = client.get("/admin/notifications?unread_only=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Warning"

    mock_get_notifs.assert_called_with(10, limit=50, unread_only=True)


@patch("osmosmjerka.database.db_manager.get_unread_notification_count")
def test_get_unread_count(mock_get_count, client, mock_user):
    """Test getting unread count."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_get_count.return_value = 5

    response = client.get("/admin/notifications/unread-count")
    assert response.status_code == 200
    assert response.json() == {"count": 5}

    mock_get_count.assert_called_with(10)


@patch("osmosmjerka.database.db_manager.mark_notification_read")
def test_mark_read(mock_mark_read, client, mock_user):
    """Test marking notification as read."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_mark_read.return_value = True

    response = client.put("/admin/notifications/1/read")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    mock_mark_read.assert_called_with(1, 10)


@patch("osmosmjerka.database.db_manager.mark_all_notifications_read")
def test_mark_all_read(mock_mark_all, client, mock_user):
    """Test marking all notifications as read."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_mark_all.return_value = 3

    response = client.put("/admin/notifications/read-all")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    mock_mark_all.assert_called_with(10)


@patch("osmosmjerka.database.db_manager.delete_notification")
def test_delete_notification(mock_delete, client, mock_user):
    """Test deleting a notification."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_delete.return_value = True

    response = client.delete("/admin/notifications/1")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    mock_delete.assert_called_with(1, 10)


@patch("osmosmjerka.database.db_manager.delete_notification")
def test_delete_notification_not_found(mock_delete, client, mock_user):
    """Test deleting a non-existent notification."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_delete.return_value = False

    response = client.delete("/admin/notifications/999")
    assert response.status_code == 404
    assert response.json()["error"] == "Notification not found or access denied"
