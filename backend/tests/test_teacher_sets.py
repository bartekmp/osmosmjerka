"""Tests for teacher phrase sets functionality."""

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
def mock_admin_user():
    return {"username": "admin", "role": "administrative", "id": 1, "is_active": True}


@pytest.fixture
def mock_regular_user():
    return {"username": "student", "role": "regular", "id": 20, "is_active": True}


@pytest.fixture
def mock_phrase_set():
    return {
        "id": 1,
        "name": "Test Set",
        "description": "A test phrase set",
        "language_set_id": 1,
        "created_by": 10,
        "config": {
            "allow_hints": True,
            "show_translations": True,
            "require_translation_input": False,
            "show_timer": False,
            "strict_grid_size": False,
            "grid_size": 10,
            "time_limit_minutes": None,
            "difficulty": "medium",
        },
        "current_hotlink_token": "abc12345",
        "hotlink_version": 1,
        "access_type": "public",
        "max_plays": None,
        "is_active": True,
        "expires_at": None,
        "auto_delete_at": "2026-01-18T00:00:00+00:00",
        "phrase_count": 5,
        "session_count": 0,
        "completed_count": 0,
    }


# =============================================================================
# Teacher Role Access Tests
# =============================================================================


def test_teacher_role_can_access_teacher_endpoints(client, mock_teacher_user):
    """Test that teacher role can access teacher endpoints."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_sets") as mock_get:
        mock_get.return_value = {"sets": [], "total": 0, "limit": 20, "offset": 0, "has_more": False}
        response = client.get("/admin/teacher/phrase-sets")

    assert response.status_code == 200


def test_admin_role_can_access_teacher_endpoints(client, mock_admin_user):
    """Test that admin role can access teacher endpoints."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_admin_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_sets") as mock_get:
        mock_get.return_value = {"sets": [], "total": 0, "limit": 20, "offset": 0, "has_more": False}
        response = client.get("/admin/teacher/phrase-sets")

    assert response.status_code == 200


def test_regular_user_cannot_access_teacher_endpoints(client):
    """Test that regular users are blocked from teacher endpoints."""
    # No override - should fail authentication
    response = client.get("/admin/teacher/phrase-sets")
    assert response.status_code == 401


# =============================================================================
# Phrase Set CRUD Tests
# =============================================================================


def test_list_phrase_sets(client, mock_teacher_user):
    """Test listing teacher's phrase sets."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_sets") as mock_get:
        mock_get.return_value = {
            "sets": [{"id": 1, "name": "Set 1"}],
            "total": 1,
            "limit": 20,
            "offset": 0,
            "has_more": False,
        }
        response = client.get("/admin/teacher/phrase-sets")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["sets"]) == 1
    mock_get.assert_called_once()


def test_create_phrase_set(client, mock_teacher_user):
    """Test creating a new phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.create_teacher_phrase_set") as mock_create:
        mock_create.return_value = {
            "id": 1,
            "name": "New Set",
            "current_hotlink_token": "abc12345",
            "phrase_count": 3,
        }

        response = client.post(
            "/admin/teacher/phrase-sets",
            json={
                "name": "New Set",
                "language_set_id": 1,
                "phrase_ids": [1, 2, 3],
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Set"
    assert data["current_hotlink_token"] == "abc12345"
    mock_create.assert_called_once()


def test_create_phrase_set_empty_phrases_fails(client, mock_teacher_user):
    """Test that creating a set with no phrases fails validation."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    response = client.post(
        "/admin/teacher/phrase-sets",
        json={
            "name": "Empty Set",
            "language_set_id": 1,
            "phrase_ids": [],
        },
    )

    assert response.status_code == 422  # Validation error


def test_create_phrase_set_too_many_phrases_fails(client, mock_teacher_user):
    """Test that creating a set with >50 phrases fails validation."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    response = client.post(
        "/admin/teacher/phrase-sets",
        json={
            "name": "Large Set",
            "language_set_id": 1,
            "phrase_ids": list(range(1, 52)),  # 51 phrases
        },
    )

    assert response.status_code == 422  # Validation error


def test_get_phrase_set_by_id(client, mock_teacher_user, mock_phrase_set):
    """Test getting a specific phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
        mock_get.return_value = mock_phrase_set
        with patch("osmosmjerka.database.db_manager.get_phrase_set_phrases") as mock_phrases:
            mock_phrases.return_value = [{"id": 1, "phrase": "test", "translation": "test"}]
            response = client.get("/admin/teacher/phrase-sets/1")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Set"
    assert "phrases" in data


def test_get_phrase_set_not_found(client, mock_teacher_user):
    """Test getting a non-existent phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
        mock_get.return_value = None
        response = client.get("/admin/teacher/phrase-sets/999")

    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "SET_NOT_FOUND"


def test_update_phrase_set(client, mock_teacher_user, mock_phrase_set):
    """Test updating a phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.update_teacher_phrase_set") as mock_update:
        updated = {**mock_phrase_set, "name": "Updated Set"}
        mock_update.return_value = updated
        response = client.put(
            "/admin/teacher/phrase-sets/1",
            json={"name": "Updated Set"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Set"


def test_delete_phrase_set(client, mock_teacher_user):
    """Test deleting a phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.delete_teacher_phrase_set") as mock_delete:
        mock_delete.return_value = True
        response = client.delete("/admin/teacher/phrase-sets/1")

    assert response.status_code == 200
    data = response.json()
    assert "deleted" in data["message"].lower()


# =============================================================================
# Link Management Tests
# =============================================================================


def test_regenerate_hotlink(client, mock_teacher_user):
    """Test regenerating a hotlink token."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.regenerate_hotlink") as mock_regen:
        mock_regen.return_value = {"token": "newtoken1", "version": 2}
        response = client.post("/admin/teacher/phrase-sets/1/regenerate-link")

    assert response.status_code == 200
    data = response.json()
    assert data["token"] == "newtoken1"
    assert data["version"] == 2


def test_extend_auto_delete(client, mock_teacher_user):
    """Test extending auto-delete date."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    from datetime import datetime, timezone

    with patch("osmosmjerka.database.db_manager.extend_auto_delete") as mock_extend:
        new_date = datetime(2026, 2, 1, tzinfo=timezone.utc)
        mock_extend.return_value = new_date
        response = client.post(
            "/admin/teacher/phrase-sets/1/extend",
            json={"days": 14},
        )

    assert response.status_code == 200
    data = response.json()
    assert "auto_delete_at" in data


# =============================================================================
# Public Hotlink Access Tests
# =============================================================================


def test_validate_hotlink_public_access(client, mock_phrase_set):
    """Test validating a public hotlink."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": [{"id": 1, "phrase": "test"}]}}
        response = client.get("/admin/teacher/set/abc12345")

    assert response.status_code == 200
    data = response.json()
    assert "set" in data
    assert data["set"]["name"] == "Test Set"


def test_validate_hotlink_not_found(client):
    """Test validating an invalid token."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"error": {"code": "SET_NOT_FOUND", "message": "Puzzle not found"}}
        response = client.get("/admin/teacher/set/invalidtoken")

    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "SET_NOT_FOUND"


def test_validate_hotlink_expired(client):
    """Test validating an expired hotlink."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"error": {"code": "SET_EXPIRED", "message": "This puzzle has expired"}}
        response = client.get("/admin/teacher/set/expiredtoken")

    assert response.status_code == 410
    data = response.json()
    assert data["error_code"] == "SET_EXPIRED"


def test_validate_hotlink_auth_required(client):
    """Test private set requires authentication."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"error": {"code": "AUTH_REQUIRED", "message": "This puzzle requires login"}}
        response = client.get("/admin/teacher/set/privatetoken")

    assert response.status_code == 401
    data = response.json()
    assert data["error_code"] == "AUTH_REQUIRED"


# =============================================================================
# Session Management Tests
# =============================================================================


def test_start_session_anonymous(client, mock_phrase_set):
    """Test starting a session as anonymous user with nickname."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": [{"id": 1, "phrase": "test"}]}}
        with patch("osmosmjerka.database.db_manager.create_session") as mock_create:
            mock_create.return_value = {
                "id": 1,
                "session_token": "session-uuid",
                "phrase_set_id": 1,
                "hotlink_version": 1,
                "nickname": "Student1",
                "grid_size": 10,
                "difficulty": "medium",
                "total_phrases": 1,
            }
            response = client.post(
                "/admin/teacher/set/abc12345/start",
                json={"nickname": "Student1"},
            )

    assert response.status_code == 201
    data = response.json()
    assert data["session_token"] == "session-uuid"
    assert "phrases" in data


def test_start_session_anonymous_without_nickname_fails(client, mock_phrase_set):
    """Test that anonymous users must provide a nickname."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": [{"id": 1, "phrase": "test"}]}}
        response = client.post(
            "/admin/teacher/set/abc12345/start",
            json={},
        )

    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "NICKNAME_REQUIRED"


def test_start_session_logged_in_uses_username(client, mock_phrase_set, mock_regular_user):
    """Test that logged-in users don't need nickname."""
    app.dependency_overrides[get_current_user_optional] = lambda: mock_regular_user

    with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
        mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": [{"id": 1, "phrase": "test"}]}}
        with patch("osmosmjerka.database.db_manager.create_session") as mock_create:
            mock_create.return_value = {
                "id": 1,
                "session_token": "session-uuid",
                "phrase_set_id": 1,
                "hotlink_version": 1,
                "nickname": "student",  # Uses username
                "grid_size": 10,
                "difficulty": "medium",
                "total_phrases": 1,
            }
            response = client.post(
                "/admin/teacher/set/abc12345/start",
                json={},  # No nickname needed
            )

    assert response.status_code == 201
    # Verify create_session was called with the username
    mock_create.assert_called_once()
    call_kwargs = mock_create.call_args[1]
    assert call_kwargs["nickname"] == "student"


def test_complete_session(client):
    """Test completing a session."""
    with patch("osmosmjerka.database.db_manager.complete_session") as mock_complete:
        mock_complete.return_value = {
            "session_token": "session-uuid",
            "phrases_found": 5,
            "total_phrases": 5,
            "duration_seconds": 120,
            "is_completed": True,
        }
        response = client.post(
            "/admin/teacher/set/abc12345/complete",
            json={
                "session_token": "session-uuid",
                "phrases_found": 5,
                "duration_seconds": 120,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_completed"] is True
    assert data["phrases_found"] == 5


def test_complete_session_already_completed(client):
    """Test that completing an already-completed session fails."""
    with patch("osmosmjerka.database.db_manager.complete_session") as mock_complete:
        mock_complete.return_value = {
            "error": {
                "code": "SESSION_COMPLETED",
                "message": "This session has already been completed",
            }
        }
        response = client.post(
            "/admin/teacher/set/abc12345/complete",
            json={
                "session_token": "session-uuid",
                "phrases_found": 5,
                "duration_seconds": 120,
            },
        )

    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "SESSION_COMPLETED"


def test_get_session_for_recovery(client):
    """Test getting session status for recovery."""
    with patch("osmosmjerka.database.db_manager.get_session_by_token") as mock_get:
        mock_get.return_value = {
            "id": 1,
            "session_token": "session-uuid",
            "phrases_found": 3,
            "total_phrases": 5,
            "is_completed": False,
        }
        response = client.get("/admin/teacher/session/session-uuid")

    assert response.status_code == 200
    data = response.json()
    assert data["phrases_found"] == 3
    assert data["is_completed"] is False


# =============================================================================
# Session List Tests
# =============================================================================


def test_list_sessions_for_set(client, mock_teacher_user, mock_phrase_set):
    """Test listing sessions for a phrase set."""
    app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

    with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get_set:
        mock_get_set.return_value = mock_phrase_set
        with patch("osmosmjerka.database.db_manager.get_sessions_for_set") as mock_sessions:
            mock_sessions.return_value = {
                "sessions": [
                    {"id": 1, "nickname": "Student1", "is_completed": True},
                ],
                "total": 1,
                "limit": 50,
                "offset": 0,
                "has_more": False,
            }
            response = client.get("/admin/teacher/phrase-sets/1/sessions")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["sessions"]) == 1


# =============================================================================
# Database Mixin Tests
# =============================================================================


@pytest.mark.asyncio
async def test_generate_hotlink_token():
    """Test hotlink token generation."""
    from osmosmjerka.database.teacher_sets import generate_hotlink_token

    token = generate_hotlink_token()
    assert len(token) == 8
    assert token.isalnum() or "-" in token or "_" in token  # URL-safe


@pytest.mark.asyncio
async def test_default_config():
    """Test default configuration values."""
    from osmosmjerka.database.teacher_sets import DEFAULT_CONFIG

    assert DEFAULT_CONFIG["allow_hints"] is True
    assert DEFAULT_CONFIG["show_translations"] is True
    assert DEFAULT_CONFIG["require_translation_input"] is False
    assert DEFAULT_CONFIG["grid_size"] == 10
    assert DEFAULT_CONFIG["difficulty"] == "medium"
