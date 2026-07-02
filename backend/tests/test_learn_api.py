"""Tests for the learning / SRS API endpoints (/api/learn/*)."""

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.auth import get_current_user
from osmosmjerka.game_api import router

os.environ["TESTING"] = "true"

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    mock_user = {"id": 1, "username": "testuser", "role": "regular", "is_active": True}
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_submit_review_success(client):
    updated = {
        "id": 5,
        "direction": "production",
        "ease": 2.5,
        "interval_days": 1.0,
        "reps": 1,
        "lapses": 0,
        "mastery_level": 1,
        "due_at": "2026-07-03T00:00:00",
    }
    with patch("osmosmjerka.game_api.learn.db_manager.record_review", new_callable=AsyncMock) as m:
        m.return_value = updated
        resp = client.post(
            "/api/learn/review",
            json={"language_set_id": 1, "direction": "production", "grade": "good", "phrase_id": 42},
        )
    assert resp.status_code == 200
    assert resp.json() == updated
    m.assert_awaited_once()
    kwargs = m.call_args.kwargs
    assert kwargs["phrase_id"] == 42 and kwargs["list_phrase_id"] is None
    assert kwargs["direction"] == "production" and kwargs["grade"] == "good"


def test_submit_review_custom_phrase(client):
    with patch("osmosmjerka.game_api.learn.db_manager.record_review", new_callable=AsyncMock) as m:
        m.return_value = {"id": 1, "mastery_level": 0}
        resp = client.post(
            "/api/learn/review",
            json={"language_set_id": 2, "direction": "recognition", "grade": "again", "list_phrase_id": 7},
        )
    assert resp.status_code == 200
    assert m.call_args.kwargs["list_phrase_id"] == 7


def test_submit_review_rejects_both_refs(client):
    resp = client.post(
        "/api/learn/review",
        json={"language_set_id": 1, "direction": "production", "grade": "good", "phrase_id": 1, "list_phrase_id": 2},
    )
    assert resp.status_code == 422  # pydantic validator


def test_submit_review_rejects_no_ref(client):
    resp = client.post(
        "/api/learn/review",
        json={"language_set_id": 1, "direction": "production", "grade": "good"},
    )
    assert resp.status_code == 422


def test_submit_review_rejects_bad_grade(client):
    resp = client.post(
        "/api/learn/review",
        json={"language_set_id": 1, "direction": "production", "grade": "perfect", "phrase_id": 1},
    )
    assert resp.status_code == 422


def test_submit_review_rejects_bad_direction(client):
    resp = client.post(
        "/api/learn/review",
        json={"language_set_id": 1, "direction": "sideways", "grade": "good", "phrase_id": 1},
    )
    assert resp.status_code == 422


def test_submit_review_value_error_maps_to_400(client):
    with patch("osmosmjerka.game_api.learn.db_manager.record_review", new_callable=AsyncMock) as m:
        m.side_effect = ValueError("bad")
        resp = client.post(
            "/api/learn/review",
            json={"language_set_id": 1, "direction": "production", "grade": "good", "phrase_id": 1},
        )
    assert resp.status_code == 400
    assert "bad" in resp.json()["error"]


def test_learn_stats(client):
    with patch("osmosmjerka.game_api.learn.db_manager.get_mastery_stats", new_callable=AsyncMock) as m:
        m.return_value = {"total": 10, "due": 3, "mastered": 2}
        resp = client.get("/api/learn/stats?language_set_id=1")
    assert resp.status_code == 200
    assert resp.json() == {"total": 10, "due": 3, "mastered": 2}


def test_learn_due(client):
    with patch("osmosmjerka.game_api.learn.db_manager.get_due_items", new_callable=AsyncMock) as m:
        m.return_value = [{"id": 1, "phrase_id": 5, "direction": "production"}]
        resp = client.get("/api/learn/due?limit=10")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert m.call_args[0][2] == 10  # limit passed through
