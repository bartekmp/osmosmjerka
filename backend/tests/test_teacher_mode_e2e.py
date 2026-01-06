"""
Integration tests for Teacher Mode end-to-end flow.

Tests the complete flow from a high level:
1. Teacher creates a phrase set
2. Teacher gets shareable link
3. Student validates access via link
4. Student starts session (with grid generation)
5. Student completes session
6. Teacher views results
"""

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
def mock_phrase_set():
    return {
        "id": 1,
        "name": "E2E Test Set",
        "description": "End-to-end test phrase set",
        "language_set_id": 1,
        "created_by": 10,
        "config": {
            "allow_hints": True,
            "show_translations": True,
            "require_translation_input": False,
            "show_timer": True,
            "strict_grid_size": False,
            "grid_size": 8,
            "time_limit_minutes": None,
            "difficulty": "medium",
        },
        "current_hotlink_token": "e2e-test-token",
        "hotlink_version": 1,
        "access_type": "public",
        "max_plays": None,
        "is_active": True,
        "expires_at": None,
        "phrase_count": 3,
    }


@pytest.fixture
def mock_phrases():
    return [
        {"id": 1, "phrase": "HELLO", "translation": "Hola"},
        {"id": 2, "phrase": "WORLD", "translation": "Mundo"},
        {"id": 3, "phrase": "TEACHER", "translation": "Profesor"},
    ]


# =============================================================================
# End-to-End Flow Tests
# =============================================================================


class TestCompleteTeacherStudentFlow:
    """Integration tests for the complete teacher-student flow."""

    def test_full_flow_create_share_play_complete(self, client, mock_teacher_user, mock_phrase_set, mock_phrases):
        """
        Test complete flow: teacher creates → student plays → teacher views results.
        """
        # Step 1: Teacher creates a phrase set
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.create_teacher_phrase_set") as mock_create:
            mock_create.return_value = {
                "id": 1,
                "name": "E2E Test Set",
                "current_hotlink_token": "e2e-test-token",
                "hotlink_version": 1,
                "phrase_count": 3,
            }
            response = client.post(
                "/admin/teacher/phrase-sets",
                json={
                    "name": "E2E Test Set",
                    "language_set_id": 1,
                    "phrase_ids": [1, 2, 3],
                    "config": {"grid_size": 8, "show_timer": True},
                },
            )

        assert response.status_code == 201
        created_set = response.json()
        assert "current_hotlink_token" in created_set
        hotlink_token = created_set["current_hotlink_token"]

        # Step 2: Student accesses puzzle via hotlink (anonymous)
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": mock_phrases}}
            response = client.get(f"/admin/teacher/set/{hotlink_token}")

        assert response.status_code == 200
        puzzle_data = response.json()
        assert "set" in puzzle_data
        assert puzzle_data["set"]["name"] == "E2E Test Set"
        assert len(puzzle_data["set"]["phrases"]) == 3

        # Step 3: Student starts session with nickname
        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": mock_phrases}}
            with patch("osmosmjerka.database.db_manager.create_session") as mock_session:
                mock_session.return_value = {
                    "id": 1,
                    "session_token": "e2e-session-123",
                    "phrase_set_id": 1,
                    "hotlink_version": 1,
                    "nickname": "TestStudent",
                    "grid_size": 8,
                }
                response = client.post(
                    f"/admin/teacher/set/{hotlink_token}/start",
                    json={"nickname": "TestStudent"},
                )

        assert response.status_code == 201
        session_data = response.json()
        assert "session_token" in session_data
        assert "grid" in session_data
        assert "phrases" in session_data
        session_token = session_data["session_token"]

        # Verify grid was generated correctly
        grid = session_data["grid"]
        assert len(grid) == 8  # Grid size from config
        assert len(grid[0]) == 8

        # Verify phrases have placement coordinates
        placed_phrases = session_data["phrases"]
        # Some phrases should have been placed (exact number depends on grid algorithm)
        assert len(placed_phrases) >= 1
        for phrase in placed_phrases:
            assert "coords" in phrase
            assert "phrase" in phrase

        # Step 4: Student completes the session
        with patch("osmosmjerka.database.db_manager.complete_session") as mock_complete:
            mock_complete.return_value = {
                "session_token": session_token,
                "phrases_found": 3,
                "total_phrases": 3,
                "duration_seconds": 180,
                "is_completed": True,
            }
            response = client.post(
                f"/admin/teacher/set/{hotlink_token}/complete",
                json={
                    "session_token": session_token,
                    "phrases_found": 3,
                    "duration_seconds": 180,
                },
            )

        assert response.status_code == 200
        completion = response.json()
        assert completion["is_completed"] is True
        assert completion["phrases_found"] == 3

        # Step 5: Teacher views session results
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
            mock_get.return_value = mock_phrase_set
            with patch("osmosmjerka.database.db_manager.get_sessions_for_set") as mock_sessions:
                mock_sessions.return_value = {
                    "sessions": [
                        {
                            "id": 1,
                            "nickname": "TestStudent",
                            "phrases_found": 3,
                            "total_phrases": 3,
                            "duration_seconds": 180,
                            "is_completed": True,
                        }
                    ],
                    "total": 1,
                    "limit": 50,
                    "offset": 0,
                    "has_more": False,
                }
                response = client.get("/admin/teacher/phrase-sets/1/sessions")

        assert response.status_code == 200
        sessions = response.json()
        assert sessions["total"] == 1
        assert sessions["sessions"][0]["nickname"] == "TestStudent"
        assert sessions["sessions"][0]["is_completed"] is True


class TestGridGenerationInSession:
    """Test grid generation functionality in session start."""

    def test_grid_has_correct_size(self, client, mock_phrase_set, mock_phrases):
        """Test that generated grid matches configured size."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": mock_phrases}}
            with patch("osmosmjerka.database.db_manager.create_session") as mock_session:
                mock_session.return_value = {
                    "id": 1,
                    "session_token": "grid-test-token",
                    "phrase_set_id": 1,
                    "hotlink_version": 1,
                    "nickname": "GridTester",
                    "grid_size": 8,
                }
                response = client.post(
                    "/admin/teacher/set/e2e-test-token/start",
                    json={"nickname": "GridTester"},
                )

        assert response.status_code == 201
        data = response.json()

        # Verify grid structure
        grid = data["grid"]
        assert len(grid) == 8  # Config specifies 8
        for row in grid:
            assert len(row) == 8
            for cell in row:
                assert isinstance(cell, str)
                assert len(cell) == 1  # Single character

    def test_phrases_have_valid_coordinates(self, client, mock_phrase_set, mock_phrases):
        """Test that placed phrases have valid coordinates within grid."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"set": {**mock_phrase_set, "phrases": mock_phrases}}
            with patch("osmosmjerka.database.db_manager.create_session") as mock_session:
                mock_session.return_value = {
                    "id": 1,
                    "session_token": "coord-test",
                    "phrase_set_id": 1,
                    "hotlink_version": 1,
                    "nickname": "CoordTester",
                    "grid_size": 8,
                }
                response = client.post(
                    "/admin/teacher/set/e2e-test-token/start",
                    json={"nickname": "CoordTester"},
                )

        assert response.status_code == 201
        data = response.json()
        grid_size = 8  # From config

        for phrase in data["phrases"]:
            if "coords" in phrase and phrase["coords"]:
                for coord in phrase["coords"]:
                    row, col = coord
                    assert 0 <= row < grid_size, f"Row {row} out of bounds"
                    assert 0 <= col < grid_size, f"Col {col} out of bounds"


class TestSessionRecovery:
    """Test session recovery for students who refresh the page."""

    def test_session_can_be_recovered(self, client):
        """Test that a session can be retrieved by token for recovery."""
        with patch("osmosmjerka.database.db_manager.get_session_by_token") as mock_get:
            mock_get.return_value = {
                "id": 1,
                "session_token": "recovery-token",
                "phrases_found": 2,
                "total_phrases": 5,
                "is_completed": False,
                "grid_size": 10,
                "nickname": "RecoveryStudent",
            }
            response = client.get("/admin/teacher/session/recovery-token")

        assert response.status_code == 200
        data = response.json()
        assert data["session_token"] == "recovery-token"
        assert data["phrases_found"] == 2
        assert data["is_completed"] is False


class TestErrorHandling:
    """Test error cases in the teacher mode flow."""

    def test_expired_puzzle_returns_410(self, client):
        """Test that expired puzzles return proper error."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"error": {"code": "SET_EXPIRED", "message": "This puzzle has expired"}}
            response = client.get("/admin/teacher/set/expired-token")

        assert response.status_code == 410
        assert response.json()["error_code"] == "SET_EXPIRED"

    def test_inactive_puzzle_returns_410(self, client):
        """Test that inactive puzzles return proper error."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {
                "error": {"code": "SET_INACTIVE", "message": "This puzzle is no longer active"}
            }
            response = client.get("/admin/teacher/set/inactive-token")

        assert response.status_code == 410
        assert response.json()["error_code"] == "SET_INACTIVE"

    def test_max_plays_exhausted_returns_410(self, client):
        """Test that exhausted puzzles return proper error."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"error": {"code": "SET_EXHAUSTED", "message": "Maximum plays reached"}}
            response = client.get("/admin/teacher/set/exhausted-token")

        assert response.status_code == 410
        assert response.json()["error_code"] == "SET_EXHAUSTED"

    def test_private_puzzle_requires_auth(self, client):
        """Test that private puzzles require authentication."""
        app.dependency_overrides[get_current_user_optional] = lambda: None

        with patch("osmosmjerka.database.db_manager.validate_hotlink_access") as mock_validate:
            mock_validate.return_value = {"error": {"code": "AUTH_REQUIRED", "message": "Login required"}}
            response = client.get("/admin/teacher/set/private-token")

        assert response.status_code == 401
        assert response.json()["error_code"] == "AUTH_REQUIRED"
