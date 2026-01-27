import os
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.game_api import get_grid_size_and_num_phrases, router

# Set testing environment variable to disable rate limiting
os.environ["TESTING"] = "true"

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_db_connection():
    """Automatically mock the database connection for all tests"""
    with (
        patch("osmosmjerka.database.db_manager._ensure_database"),
        patch("osmosmjerka.database.db_manager.database", Mock()),
    ):
        yield


def test_game_api_router_structure():
    """Test that the game API router is properly structured"""
    assert router is not None
    assert hasattr(router, "prefix")
    assert router.prefix == "/api"
    assert hasattr(router, "routes")
    assert len(router.routes) > 0


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
def test_get_all_categories(mock_get_categories, client):
    """Test getting all categories with language set specific filtering"""
    mock_get_categories.return_value = ["A", "B", "C"]

    response = client.get("/api/categories?language_set_id=1")
    assert response.status_code == 200
    categories = response.json()
    assert sorted(categories) == ["A", "B", "C"]


@patch("osmosmjerka.database.db_manager.get_default_ignored_categories")
def test_get_default_ignored_categories(mock_get_default_ignored, client):
    """Test getting default ignored categories for a language set"""
    mock_get_default_ignored.return_value = ["X", "Y", "Z"]
    response = client.get("/api/default-ignored-categories?language_set_id=1")
    assert response.status_code == 200
    ignored = response.json()
    assert set(ignored) == {"X", "Y", "Z"}


def test_get_user_ignored_categories_no_auth(client):
    """Test getting user ignored categories without authentication returns empty list"""
    response = client.get("/api/user/ignored-categories?language_set_id=1")
    assert response.status_code == 200
    ignored = response.json()
    assert ignored == []


def test_get_scoring_rules(client):
    """Scoring rules should be exposed through a public endpoint."""
    response = client.get("/api/system/scoring-rules")
    assert response.status_code == 200

    rules = response.json()
    assert rules["base_points_per_phrase"] == 100
    assert set(rules["difficulty_multipliers"].keys()) == {"very_easy", "easy", "medium", "hard", "very_hard"}
    assert rules["completion_bonus_points"] == 200
    assert rules["hint_penalty_per_hint"] == 75
    assert "time_bonus" in rules and "target_times_seconds" in rules["time_bonus"]


def test_get_scoring_rules_with_game_type(client):
    """Scoring rules should accept game_type parameter."""
    # Test with word_search game type
    response = client.get("/api/system/scoring-rules?game_type=word_search")
    assert response.status_code == 200
    rules = response.json()
    assert rules["base_points_per_phrase"] == 100

    # Test with crossword game type - should also return valid rules
    response = client.get("/api/system/scoring-rules?game_type=crossword")
    assert response.status_code == 200
    rules = response.json()
    assert "base_points_per_phrase" in rules


def test_calculate_score_endpoint(client):
    payload = {
        "difficulty": "easy",
        "phrases_found": 5,
        "total_phrases": 7,
        "duration_seconds": 120,
        "hints_used": 1,
    }

    # Mock get_scoring_rules to return None so it falls back to hardcoded constants
    with patch("osmosmjerka.game_api.db_manager.get_scoring_rules", new_callable=AsyncMock) as mock_get_scoring:
        mock_get_scoring.return_value = None

        response = client.post("/api/system/calculate-score", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["base_score"] == 500
        assert data["difficulty_bonus"] == 0
        assert data["time_bonus"] == 0  # not all phrases found
        assert data["streak_bonus"] == 0
        assert data["hint_penalty"] == 75
    assert data["final_score"] == 425
    assert data["hint_penalty_per_hint"] == 75


def test_get_grid_size_and_num_phrases_very_easy():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "very_easy")
    assert size == 8 and num_phrases == 5


def test_get_grid_size_and_num_phrases_easy():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "easy")
    assert size == 10 and num_phrases == 7


def test_get_grid_size_and_num_phrases_medium():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 15, "medium")
    assert size == 13 and num_phrases == 10


def test_get_grid_size_and_num_phrases_hard():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 20, "hard")
    assert size == 15 and num_phrases == 12


def test_get_grid_size_and_num_phrases_very_hard():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 20, "very_hard")
    assert size == 20 and num_phrases == 16


def test_get_grid_size_and_num_phrases_invalid():
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "invalid")
    assert size == 10 and num_phrases == 7  # defaults to easy


def test_get_grid_size_and_num_phrases_edge_cases():
    """Test edge cases for grid size calculation"""
    # Empty phrase list - defaults to easy difficulty settings
    size, num_phrases = get_grid_size_and_num_phrases([], "easy")
    assert size == 10 and num_phrases == 7

    # Single phrase - still uses difficulty settings
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "test"}], "easy")
    assert size == 10 and num_phrases == 7

    # Test unknown difficulty defaults to easy
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "test"}], "unknown")
    assert size == 10 and num_phrases == 7


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
@patch("osmosmjerka.game_api.phrases._generate_grid_with_exact_phrase_count")
def test_get_phrases_no_category_specified(mock_generate_grid, mock_get_phrases, mock_get_categories, client):
    """Test getting phrases when no category is specified"""
    mock_get_categories.return_value = ["A", "B"]
    mock_get_phrases.return_value = [{"phrase": "test", "categories": "A", "translation": "test"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"phrase": "test"}])

    response = client.get("/api/phrases")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] in ["A", "B"]
    assert "grid" in data
    assert "phrases" in data


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
@patch("osmosmjerka.game_api.phrases._generate_grid_with_exact_phrase_count")
def test_get_phrases_invalid_category(mock_generate_grid, mock_get_phrases, mock_get_categories, client):
    """Test getting phrases with invalid category falls back to random"""
    mock_get_categories.return_value = ["A", "B"]
    mock_get_phrases.return_value = [{"phrase": "test", "categories": "A", "translation": "test"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"phrase": "test"}])

    response = client.get("/api/phrases?category=INVALID")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] in ["A", "B"]  # Should pick a random valid category


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
def test_get_phrases_no_phrases_found(mock_get_phrases, mock_get_categories, client):
    """Test getting phrases when no phrases exist for category"""
    mock_get_categories.return_value = ["A"]
    mock_get_phrases.return_value = []

    response = client.get("/api/phrases?category=A")
    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "NO_PHRASES_FOUND"
    assert "category" in data


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
def test_get_phrases_not_enough_phrases(mock_get_phrases, mock_get_categories, client):
    """Test getting phrases when there aren't enough for difficulty"""
    mock_get_categories.return_value = ["A"]
    mock_get_phrases.return_value = [{"phrase": "a", "categories": "A", "translation": "a"}]  # Only 1 phrase

    response = client.get("/api/phrases?category=A&difficulty=hard")  # Needs 12 phrases
    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "NOT_ENOUGH_PHRASES_IN_CATEGORY"
    assert data["available"] == 1
    assert data["needed"] == 12
    assert data["category"] == "A"


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
@patch("osmosmjerka.game_api.phrases._generate_grid_with_exact_phrase_count")
def test_get_phrases_success(mock_generate_grid, mock_get_phrases, mock_get_categories, client):
    """Test successful phrase retrieval"""
    mock_get_categories.return_value = ["A"]
    mock_get_phrases.return_value = [{"phrase": "a", "categories": "A", "translation": "a"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"phrase": "a", "translation": "a"}])

    response = client.get("/api/phrases?category=A&difficulty=easy")
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "phrases" in data
    assert "category" in data
    assert data["category"] == "A"


@patch("osmosmjerka.database.db_manager.get_categories_for_language_set")
@patch("osmosmjerka.database.db_manager.get_phrases")
@patch("osmosmjerka.game_api.phrases.get_grid_size_and_num_phrases")
@patch("osmosmjerka.game_api.phrases._generate_grid_with_exact_phrase_count")
def test_get_phrases_all_categories(
    mock_generate_grid, mock_get_grid_size, mock_get_phrases, mock_get_categories, client
):
    """Test getting phrases with ALL category (all categories)"""
    mock_get_categories.return_value = ["A", "B", "C"]
    # Return phrases from multiple categories
    mock_get_phrases.return_value = [
        {"phrase": "a1", "categories": "A", "translation": "a1"},
        {"phrase": "b1", "categories": "B", "translation": "b1"},
        {"phrase": "c1", "categories": "C", "translation": "c1"},
    ] * 10  # 30 phrases total
    mock_get_grid_size.return_value = (10, 7)
    mock_generate_grid.return_value = ([["A"]], [{"phrase": "a1", "translation": "a1"}])

    response = client.get("/api/phrases?category=ALL&difficulty=easy")
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "phrases" in data
    assert data["category"] == "ALL"
    # Verify that get_phrases was called with None (no category filter)
    mock_get_phrases.assert_called_once()
    call_args = mock_get_phrases.call_args
    assert call_args[0][1] is None  # category parameter should be None


@patch("osmosmjerka.game_api.export.export_to_docx")
def test_export_puzzle_docx(mock_export_docx, client):
    """Test exporting puzzle as DOCX"""
    mock_export_docx.return_value = b"docx_content"

    data = {"category": "Test", "grid": [["A"]], "phrases": [{"phrase": "A", "translation": "A"}], "format": "docx"}
    response = client.post("/api/export", json=data)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert "attachment; filename=wordsearch-test.docx" in response.headers["content-disposition"]


@patch("osmosmjerka.game_api.export.export_to_png")
def test_export_puzzle_png(mock_export_png, client):
    """Test exporting puzzle as PNG"""
    mock_export_png.return_value = b"png_content"

    data = {"category": "Test", "grid": [["A"]], "phrases": [{"phrase": "A", "translation": "A"}], "format": "png"}
    response = client.post("/api/export", json=data)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "attachment; filename=wordsearch-test.png" in response.headers["content-disposition"]


def test_export_puzzle_default_format(client):
    """Test exporting puzzle with default DOCX format"""
    with patch("osmosmjerka.game_api.export.export_to_docx") as mock_export:
        mock_export.return_value = b"docx_content"

        data = {
            "category": "Test",
            "grid": [["A"]],
            "phrases": [{"phrase": "A", "translation": "A"}],
            # No format specified, should default to docx
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )


def test_export_puzzle_invalid_format(client):
    """Test exporting puzzle with invalid format returns 422 (Pydantic validation)"""
    data = {
        "category": "Test",
        "grid": [["A"]],
        "phrases": [{"phrase": "A", "translation": "A"}],
        "format": "invalid",
    }
    response = client.post("/api/export", json=data)
    # Pydantic regex pattern validation returns 422
    assert response.status_code == 422


def test_export_puzzle_filename_sanitization(client):
    """Test that category names are properly sanitized in filenames"""
    with patch("osmosmjerka.game_api.export.export_to_docx") as mock_export:
        mock_export.return_value = b"docx_content"

        data = {
            "category": "Test Category with Spaces & Special!",
            "grid": [["A"]],
            "phrases": [{"phrase": "A", "translation": "A"}],
            "format": "docx",
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        # Check that filename is sanitized - actual regex replaces non-alphanumeric with single underscore
        assert "wordsearch-test_category_with_spaces_special_.docx" in response.headers["content-disposition"]


def test_export_puzzle_no_category(client):
    """Test exporting puzzle with valid category"""
    with patch("osmosmjerka.game_api.export.export_to_docx") as mock_export:
        mock_export.return_value = b"docx_content"

        data = {"category": "Test", "grid": [["A"]], "phrases": [{"phrase": "A", "translation": "A"}], "format": "docx"}
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        assert "wordsearch-test.docx" in response.headers["content-disposition"]


def test_export_puzzle_exception(client):
    """Test export puzzle when export function raises exception"""
    with patch("osmosmjerka.game_api.export.export_to_docx") as mock_export:
        mock_export.side_effect = Exception("Export failed")

        data = {"category": "Test", "grid": [["A"]], "phrases": [{"phrase": "A", "translation": "A"}], "format": "docx"}
        response = client.post("/api/export", json=data)
        assert response.status_code == 500
        assert "Export failed" in response.json()["detail"]


def test_api_endpoints_exist():
    """Test that expected API endpoints are registered with the router"""
    # Just check that the router has routes
    assert len(router.routes) > 0

    # Check that we can import the functions that should be available
    from osmosmjerka.game_api import get_grid_size_and_num_phrases

    assert callable(get_grid_size_and_num_phrases)


def test_imports_work():
    """Test that all necessary imports work correctly"""
    from osmosmjerka.database import db_manager
    from osmosmjerka.game_api import router
    from osmosmjerka.grid_generator import generate_grid
    from osmosmjerka.utils import export_to_docx, export_to_png

    # Basic sanity checks
    assert router is not None
    assert db_manager is not None
    assert callable(generate_grid)
    assert callable(export_to_docx)
    assert callable(export_to_png)


def test_game_api_integration():
    """Test that game API imports all required modules correctly"""
    from osmosmjerka.game_api import (
        db_manager,
        export_to_docx,
        export_to_png,
        generate_grid,
        get_grid_size_and_num_phrases,
        router,
    )

    assert router is not None
    assert callable(get_grid_size_and_num_phrases)
    assert callable(generate_grid)
    assert callable(export_to_docx)
    assert callable(export_to_png)
    assert db_manager is not None


def test_router_has_expected_routes():
    """Test that router has the expected number of routes"""
    # Should have routes for: categories, phrases, export, ignored-categories
    assert len(router.routes) >= 4
