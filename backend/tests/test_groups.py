"""Tests for teacher groups API."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import get_current_user_optional, require_teacher_access

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def mock_teacher_user():
    return {"username": "teacher", "role": "teacher", "id": 10, "is_active": True}


@pytest.fixture
def mock_group():
    return {
        "id": 1,
        "name": "Class A",
        "created_at": "2026-01-01T10:00:00",
        "accepted_count": 3,
        "pending_count": 2,
    }


def test_list_groups(client, mock_teacher_user, mock_group):
    app.dependency_overrides[get_current_user_optional] = lambda: mock_teacher_user
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_groups") as mock_get:
        mock_get.return_value = [mock_group]
        response = client.get("/admin/teacher/groups")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Class A"
    assert data[0]["accepted_count"] == 3
    assert data[0]["pending_count"] == 2


def test_create_group(client, mock_teacher_user):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.create_teacher_group") as mock_create:
        mock_create.return_value = 1
        response = client.post("/admin/teacher/groups", json={"name": "New Group"})

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["name"] == "New Group"
    assert data["accepted_count"] == 0
    assert data["pending_count"] == 0


def test_get_group_details(client, mock_teacher_user, mock_group):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_group_by_id") as mock_get:
        mock_get.return_value = mock_group
        with patch("osmosmjerka.database.db_manager.get_group_members") as mock_members:
            mock_members.return_value = [
                {
                    "id": 1,
                    "username": "student1",
                    "status": "accepted",
                    "invited_at": None,
                    "responded_at": None,
                },
                {
                    "id": 2,
                    "username": "student2",
                    "status": "pending",
                    "invited_at": None,
                    "responded_at": None,
                },
            ]
            response = client.get("/admin/teacher/groups/1")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Class A"
    assert data["accepted_count"] == 1
    assert data["pending_count"] == 1


def test_invite_members(client, mock_teacher_user, mock_group):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.invite_group_member") as mock_invite:
        mock_invite.return_value = {"success": True, "user_id": 123}
        with patch("osmosmjerka.database.db_manager.get_teacher_group_by_id") as mock_get:
            mock_get.return_value = mock_group
            with patch("osmosmjerka.database.db_manager.create_notification"):
                response = client.post("/admin/teacher/groups/1/invite", json={"usernames": ["student1"]})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["success"] is True
    assert data[0]["user_id"] == 123


def test_invite_members_user_not_found(client, mock_teacher_user, mock_group):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.invite_group_member") as mock_invite:
        mock_invite.return_value = {"success": False, "error": "user_not_found"}
        response = client.post("/admin/teacher/groups/1/invite", json={"usernames": ["nonexistent"]})

    assert response.status_code == 200
    data = response.json()
    assert data[0]["success"] is False
    assert data[0]["error"] == "user_not_found"


def test_remove_group_member(client, mock_teacher_user, mock_group):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_group_by_id") as mock_get_group:
        mock_get_group.return_value = mock_group
        with patch("osmosmjerka.database.db_manager.remove_group_member") as mock_remove:
            mock_remove.return_value = None
            with patch("osmosmjerka.database.db_manager.create_notification"):
                response = client.delete("/admin/teacher/groups/1/members/123")

    assert response.status_code == 200


def test_delete_group(client, mock_teacher_user):
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.delete_teacher_group") as mock_delete:
        mock_delete.return_value = True
        response = client.delete("/admin/teacher/groups/1")

    assert response.status_code == 200
