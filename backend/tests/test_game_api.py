import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from osmosmjerka.game_api import router, get_grid_size_and_num_words
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    return TestClient(app)


def test_game_api_router_structure():
    """Test that the game API router is properly structured"""
    assert router is not None
    assert hasattr(router, 'prefix')
    assert router.prefix == "/api"
    assert hasattr(router, 'routes')
    assert len(router.routes) > 0


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.game_api.IGNORED_CATEGORIES', {'ignored_cat'})
def test_get_all_categories(mock_get_categories, client):
    """Test getting all categories with ignored categories filtered out"""
    mock_get_categories.return_value = ["A", "B", "ignored_cat", "C"]
    
    response = client.get("/api/categories")
    assert response.status_code == 200
    categories = response.json()
    assert sorted(categories) == ["A", "B", "C"]
    assert "ignored_cat" not in categories


def test_get_ignored_categories(client):
    """Test getting ignored categories"""
    with patch('osmosmjerka.game_api.IGNORED_CATEGORIES', {"X", "Y", "Z"}):
        response = client.get("/api/ignored-categories")
        assert response.status_code == 200
        ignored = response.json()
        assert set(ignored) == {"X", "Y", "Z"}


def test_get_grid_size_and_num_words_easy():
    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 10, "easy")
    assert size == 10 and num_words == 7


def test_get_grid_size_and_num_words_medium():
    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 15, "medium")
    assert size == 13 and num_words == 10


def test_get_grid_size_and_num_words_hard():
    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 20, "hard")
    assert size == 15 and num_words == 12


def test_get_grid_size_and_num_words_very_hard():
    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 20, "very_hard")
    assert size == 20 and num_words == 16


def test_get_grid_size_and_num_words_invalid():
    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 10, "invalid")
    assert size == 10 and num_words == 7  # defaults to easy


def test_get_grid_size_and_num_words_edge_cases():
    """Test edge cases for grid size calculation"""
    # Empty word list - defaults to easy difficulty settings
    size, num_words = get_grid_size_and_num_words([], "easy")
    assert size == 10 and num_words == 7
    
    # Single word - still uses difficulty settings
    size, num_words = get_grid_size_and_num_words([{"word": "test"}], "easy")
    assert size == 10 and num_words == 7
    
    # Test unknown difficulty defaults to easy
    size, num_words = get_grid_size_and_num_words([{"word": "test"}], "unknown")
    assert size == 10 and num_words == 7


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.database.db_manager.get_words')
@patch('osmosmjerka.game_api.generate_grid')
def test_get_words_no_category_specified(mock_generate_grid, mock_get_words, mock_get_categories, client):
    """Test getting words when no category is specified"""
    mock_get_categories.return_value = ["A", "B"]
    mock_get_words.return_value = [{"word": "test", "categories": "A", "translation": "test"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"word": "test"}])
    
    response = client.get("/api/words")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] in ["A", "B"]
    assert "grid" in data
    assert "words" in data


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.database.db_manager.get_words')
@patch('osmosmjerka.game_api.generate_grid')
def test_get_words_invalid_category(mock_generate_grid, mock_get_words, mock_get_categories, client):
    """Test getting words with invalid category falls back to random"""
    mock_get_categories.return_value = ["A", "B"]
    mock_get_words.return_value = [{"word": "test", "categories": "A", "translation": "test"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"word": "test"}])
    
    response = client.get("/api/words?category=INVALID")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] in ["A", "B"]  # Should pick a random valid category


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.database.db_manager.get_words')
def test_get_words_no_words_found(mock_get_words, mock_get_categories, client):
    """Test getting words when no words exist for category"""
    mock_get_categories.return_value = ["A"]
    mock_get_words.return_value = []
    
    response = client.get("/api/words?category=A")
    assert response.status_code == 404
    data = response.json()
    assert "No words found" in data["error"]


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.database.db_manager.get_words')
def test_get_words_not_enough_words(mock_get_words, mock_get_categories, client):
    """Test getting words when there aren't enough for difficulty"""
    mock_get_categories.return_value = ["A"]
    mock_get_words.return_value = [{"word": "a", "categories": "A", "translation": "a"}]  # Only 1 word
    
    response = client.get("/api/words?category=A&difficulty=hard")  # Needs 12 words
    assert response.status_code == 404
    data = response.json()
    assert "Not enough words" in data["error"]
    assert data["available"] == 1
    assert data["needed"] == 12


@patch('osmosmjerka.database.db_manager.get_categories')
@patch('osmosmjerka.database.db_manager.get_words')
@patch('osmosmjerka.game_api.generate_grid')
def test_get_words_success(mock_generate_grid, mock_get_words, mock_get_categories, client):
    """Test successful word retrieval"""
    mock_get_categories.return_value = ["A"]
    mock_get_words.return_value = [{"word": "a", "categories": "A", "translation": "a"}] * 20
    mock_generate_grid.return_value = ([["A"]], [{"word": "a", "translation": "a"}])
    
    response = client.get("/api/words?category=A&difficulty=easy")
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "words" in data
    assert "category" in data
    assert data["category"] == "A"


@patch('osmosmjerka.game_api.export_to_docx')
def test_export_puzzle_docx(mock_export_docx, client):
    """Test exporting puzzle as DOCX"""
    mock_export_docx.return_value = b"docx_content"
    
    data = {
        "category": "Test", 
        "grid": [["A"]], 
        "words": [{"word": "A", "translation": "A"}],
        "format": "docx"
    }
    response = client.post("/api/export", json=data)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert "attachment; filename=wordsearch-test.docx" in response.headers["content-disposition"]


@patch('osmosmjerka.game_api.export_to_png')
def test_export_puzzle_png(mock_export_png, client):
    """Test exporting puzzle as PNG"""
    mock_export_png.return_value = b"png_content"
    
    data = {
        "category": "Test", 
        "grid": [["A"]], 
        "words": [{"word": "A", "translation": "A"}],
        "format": "png"
    }
    response = client.post("/api/export", json=data)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "attachment; filename=wordsearch-test.png" in response.headers["content-disposition"]


def test_export_puzzle_default_format(client):
    """Test exporting puzzle with default DOCX format"""
    with patch('osmosmjerka.game_api.export_to_docx') as mock_export:
        mock_export.return_value = b"docx_content"
        
        data = {
            "category": "Test",
            "grid": [["A"]],
            "words": [{"word": "A", "translation": "A"}]
            # No format specified, should default to docx
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )


def test_export_puzzle_invalid_format(client):
    """Test exporting puzzle with invalid format"""
    with patch('osmosmjerka.game_api.export_to_docx') as mock_docx, patch('osmosmjerka.game_api.export_to_png') as mock_png:
        mock_docx.return_value = b"docxbytes"
        mock_png.return_value = b"pngbytes"
        
        data = {
            "category": "Test", 
            "grid": [["A"]], 
            "words": [{"word": "A", "translation": "A"}],
            "format": "invalid"
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 500
        assert "Export failed" in response.json()["detail"]


def test_export_puzzle_filename_sanitization(client):
    """Test that category names are properly sanitized in filenames"""
    with patch('osmosmjerka.game_api.export_to_docx') as mock_export:
        mock_export.return_value = b"docx_content"
        
        data = {
            "category": "Test Category with Spaces & Special!",
            "grid": [["A"]],
            "words": [{"word": "A", "translation": "A"}],
            "format": "docx"
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        # Check that filename is sanitized - actual regex replaces non-alphanumeric with single underscore
        assert "wordsearch-test_category_with_spaces_special_.docx" in response.headers["content-disposition"]


def test_export_puzzle_no_category(client):
    """Test exporting puzzle with valid category"""
    with patch('osmosmjerka.game_api.export_to_docx') as mock_export:
        mock_export.return_value = b"docx_content"
        
        data = {
            "category": "Test", 
            "grid": [["A"]],
            "words": [{"word": "A", "translation": "A"}],
            "format": "docx"
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 200
        assert "wordsearch-test.docx" in response.headers["content-disposition"]


def test_export_puzzle_exception(client):
    """Test export puzzle when export function raises exception"""
    with patch('osmosmjerka.game_api.export_to_docx') as mock_export:
        mock_export.side_effect = Exception("Export failed")
        
        data = {
            "category": "Test", 
            "grid": [["A"]], 
            "words": [{"word": "A", "translation": "A"}],
            "format": "docx"
        }
        response = client.post("/api/export", json=data)
        assert response.status_code == 500
        assert "Export failed" in response.json()["detail"]


def test_api_endpoints_exist():
    """Test that expected API endpoints are registered with the router"""
    # Just check that the router has routes
    assert len(router.routes) > 0
    
    # Check that we can import the functions that should be available
    from osmosmjerka.game_api import get_grid_size_and_num_words
    assert callable(get_grid_size_and_num_words)


def test_imports_work():
    """Test that all necessary imports work correctly"""
    from osmosmjerka.game_api import router
    from osmosmjerka.database import IGNORED_CATEGORIES, db_manager
    from osmosmjerka.grid_generator import generate_grid
    from osmosmjerka.utils import export_to_docx, export_to_png
    
    # Basic sanity checks
    assert router is not None
    assert IGNORED_CATEGORIES is not None
    assert db_manager is not None
    assert callable(generate_grid)
    assert callable(export_to_docx)
    assert callable(export_to_png)


def test_game_api_integration():
    """Test that game API imports all required modules correctly"""
    from osmosmjerka.game_api import (
        router, 
        get_grid_size_and_num_words,
        generate_grid,
        export_to_docx,
        export_to_png,
        db_manager,
        IGNORED_CATEGORIES
    )
    
    assert router is not None
    assert callable(get_grid_size_and_num_words)
    assert callable(generate_grid)
    assert callable(export_to_docx)
    assert callable(export_to_png)
    assert db_manager is not None
    assert IGNORED_CATEGORIES is not None


def test_router_has_expected_routes():
    """Test that router has the expected number of routes"""
    # Should have routes for: categories, words, export, ignored-categories
    assert len(router.routes) >= 4
