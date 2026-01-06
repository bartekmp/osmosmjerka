"""Tests for student groups API."""

from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.auth import get_current_user
from osmosmjerka.game_api import router

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def mock_student_user():
    return {"username": "student1", "role": "user", "id": 20, "is_active": True}


@pytest.fixture
def mock_groups():
    return [
        {
            "id": 1,
            "name": "Class A",
            "joined_at": datetime(2026, 1, 1, 10, 0, 0),
            "teacher_username": "teacher1",
        },
        {
            "id": 2,
            "name": "Class B",
            "joined_at": datetime(2026, 1, 5, 14, 30, 0),
            "teacher_username": "teacher2",
        },
    ]


def test_get_my_groups_returns_teacher_username(client, mock_student_user, mock_groups):
    """Test that get_my_groups includes teacher_username in response."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.get_student_groups") as mock_get:
        mock_get.return_value = mock_groups
        response = client.get("/api/user/groups")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Class A"
    assert data[0]["teacher_username"] == "teacher1"
    assert data[1]["name"] == "Class B"
    assert data[1]["teacher_username"] == "teacher2"


def test_get_my_groups_empty(client, mock_student_user):
    """Test get_my_groups with no groups."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.get_student_groups") as mock_get:
        mock_get.return_value = []
        response = client.get("/api/user/groups")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_get_invitations(client, mock_student_user):
    """Test get_invitations endpoint."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    mock_invites = [
        {
            "id": 10,
            "group_id": 1,
            "group_name": "Class A",
            "teacher_username": "teacher1",
            "invited_at": datetime(2026, 1, 2, 10, 0, 0),
            "expires_at": datetime(2026, 1, 9, 10, 0, 0),
        }
    ]

    with patch("osmosmjerka.database.db_manager.get_student_invitations") as mock_get:
        mock_get.return_value = mock_invites
        response = client.get("/api/user/groups/invitations")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["group_name"] == "Class A"
    assert data[0]["teacher_username"] == "teacher1"


def test_accept_invitation(client, mock_student_user):
    """Test accept_invitation endpoint."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.respond_to_invitation") as mock_respond:
        mock_respond.return_value = {
            "success": True,
            "teacher_id": 10,
            "group_name": "Class A",
            "group_id": 1,
        }
        with patch("osmosmjerka.database.db_manager.create_notification"):
            response = client.post("/api/user/groups/invitations/10/accept")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["group_id"] == 1


def test_decline_invitation(client, mock_student_user):
    """Test decline_invitation endpoint."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.respond_to_invitation") as mock_respond:
        mock_respond.return_value = {
            "success": True,
            "teacher_id": 10,
            "group_name": "Class A",
            "group_id": 1,
        }
        with patch("osmosmjerka.database.db_manager.create_notification"):
            response = client.post("/api/user/groups/invitations/10/decline")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


def test_leave_group(client, mock_student_user):
    """Test leave_group endpoint."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.leave_group") as mock_leave:
        mock_leave.return_value = {
            "success": True,
            "teacher_id": 10,
            "group_name": "Class A",
        }
        with patch("osmosmjerka.database.db_manager.create_notification"):
            response = client.post("/api/user/groups/1/leave")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


def test_leave_group_not_member(client, mock_student_user):
    """Test leave_group when not a member."""
    app.dependency_overrides[get_current_user] = lambda: mock_student_user

    with patch("osmosmjerka.database.db_manager.leave_group") as mock_leave:
        mock_leave.return_value = {"success": False, "error": "not_a_member"}
        response = client.post("/api/user/groups/999/leave")

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]
