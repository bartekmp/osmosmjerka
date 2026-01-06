"""
Tests for Teacher Mode enhancements: Preview and Export.
"""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import require_teacher_access

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
        "name": "Test Set",
        "description": "A test phrase set",
        "language_set_id": 1,
        "created_by": 10,
        "config": {"grid_size": 10},
        "phrase_count": 3,
    }


class TestPreviewEndpoint:
    """Tests for the phrase set preview endpoint."""

    def test_preview_generates_grid_without_session(self, client, mock_teacher_user, mock_phrase_set):
        """Test that preview returns grid data."""
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
            mock_get.return_value = mock_phrase_set

            with patch("osmosmjerka.database.db_manager.get_phrase_set_phrases") as mock_phrases:
                mock_phrases.return_value = [{"id": 1, "phrase": "test", "translation": "test"}]

                # Mock grid generation to avoid complex logic in unit test
                with patch("osmosmjerka.admin_api.teacher_sets.generate_grid") as mock_grid:
                    mock_grid.return_value = (
                        [["A", "B"], ["C", "D"]],  # grid
                        [{"phrase": "test", "coords": [[0, 0]]}],  # placed phrases
                    )

                    response = client.get("/admin/teacher/phrase-sets/1/preview")

        assert response.status_code == 200
        data = response.json()
        assert "grid" in data
        assert "phrases" in data
        assert "config" in data
        assert data["config"]["grid_size"] == 10

    def test_preview_not_found(self, client, mock_teacher_user):
        """Test preview for non-existent set."""
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
            mock_get.return_value = None
            response = client.get("/admin/teacher/phrase-sets/999/preview")

        assert response.status_code == 404


class TestExportEndpoint:
    """Tests for the session export endpoint."""

    def test_export_csv(self, client, mock_teacher_user, mock_phrase_set):
        """Test exporting sessions as CSV."""
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
            mock_get.return_value = mock_phrase_set

            with patch("osmosmjerka.database.db_manager.get_sessions_for_set") as mock_sessions:
                mock_sessions.return_value = {
                    "sessions": [
                        {
                            "nickname": "Student1",
                            "phrases_found": 3,
                            "total_phrases": 5,
                            "duration_seconds": 120,
                            "is_completed": True,
                            "started_at": "2026-01-01T10:00:00",
                            "completed_at": "2026-01-01T10:02:00",
                        }
                    ]
                }

                response = client.get("/admin/teacher/phrase-sets/1/export?format=csv")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]

        content = response.text
        assert "Nickname,Phrases Found" in content
        assert "Student1,3,5,120,Yes" in content

    def test_export_json(self, client, mock_teacher_user, mock_phrase_set):
        """Test exporting sessions as JSON."""
        app.dependency_overrides[require_teacher_access] = lambda: mock_teacher_user

        with patch("osmosmjerka.database.db_manager.get_teacher_phrase_set_by_id") as mock_get:
            mock_get.return_value = mock_phrase_set

            with patch("osmosmjerka.database.db_manager.get_sessions_for_set") as mock_sessions:
                mock_sessions.return_value = {"sessions": [{"nickname": "Student1"}]}

                response = client.get("/admin/teacher/phrase-sets/1/export?format=json")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["sessions"][0]["nickname"] == "Student1"
        assert data["phrase_set"]["name"] == "Test Set"
