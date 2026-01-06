from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.auth import get_current_user
from osmosmjerka.game_api.student_study import router

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_user():
    return {"username": "student1", "role": "regular", "id": 101, "is_active": True}


@pytest.fixture
def mock_db_manager():
    with patch("osmosmjerka.game_api.student_study.db_manager") as mock:
        # Mock database object for fetch_all
        mock_db = AsyncMock()
        mock._ensure_database.return_value = mock_db
        yield mock


def test_list_assigned_puzzles(client, mock_user, mock_db_manager):
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock get_student_assigned_puzzles response
    mock_db_manager.get_student_assigned_puzzles = AsyncMock()
    mock_db_manager.get_student_assigned_puzzles.return_value = {
        "puzzles": [
            {
                "id": 1,
                "name": "Puzzle 1",
                "description": "Desc 1",
                "created_by": 99,
                "creator_username": "teacher1",
                "created_at": datetime(2023, 1, 1, 12, 0, 0),
                "phrase_count": 5,
                "completed_count": 0,
                "session_count": 1,
                "expires_at": None,
                "current_hotlink_token": "token1",
            },
            {
                "id": 2,
                "name": "Puzzle 2",
                "description": "Desc 2",
                "created_by": 99,
                "creator_username": "teacher1",
                "created_at": "2023-01-02T12:00:00",  # Already string case
                "phrase_count": 3,
                "completed_count": 0,
                "session_count": 0,
                "expires_at": None,
                "current_hotlink_token": "token2",
            },
        ],
        "total": 2,
    }

    # Mock completed sessions (Puzzle 1 is completed)
    mock_db = mock_db_manager._ensure_database.return_value
    mock_db.fetch_all.return_value = [{"phrase_set_id": 1}]

    response = client.get("/user/study/puzzles")

    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 2
    puzzles = data["puzzles"]
    assert len(puzzles) == 2

    # Verify Puzzle 1
    p1 = puzzles[0]
    assert p1["id"] == 1
    assert p1["is_completed"] is True
    assert p1["creator_username"] == "teacher1"
    assert "2023-01-01" in p1["created_at"]

    # Verify Puzzle 2
    p2 = puzzles[1]
    assert p2["id"] == 2
    assert p2["is_completed"] is False
    assert p2["created_at"] == "2023-01-02T12:00:00"
