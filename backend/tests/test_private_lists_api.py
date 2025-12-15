"""
Tests for user private lists API endpoints
"""

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from osmosmjerka.auth import get_current_user
from osmosmjerka.game_api import router

# Set testing environment variable to disable rate limiting
os.environ["TESTING"] = "true"

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    # Clear any existing overrides before each test
    app.dependency_overrides = {}
    # Set up default mock user
    mock_user = {"id": 1, "username": "testuser", "role": "user", "is_active": True}
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield TestClient(app)
    # Clean up after test
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user():
    return {"id": 1, "username": "testuser", "role": "user", "is_active": True}


# ===== Learn This Later Endpoints =====


@patch("osmosmjerka.game_api.db_manager.get_phrase_ids_in_private_list", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_learn_later_list", new_callable=AsyncMock)
def test_check_learn_later_phrases(mock_get_learn_later, mock_get_phrase_ids, client):
    """Test checking which phrases are in Learn This Later"""
    mock_get_learn_later.return_value = {"id": 1, "list_name": "Learn This Later"}
    mock_get_phrase_ids.return_value = [1, 3]

    response = client.post(
        "/api/user/learn-later/check",
        json={"language_set_id": 1, "phrase_ids": [1, 2, 3, 4]},
    )

    assert response.status_code == 200
    data = response.json()
    assert "in_list" in data
    assert set(data["in_list"]) == {1, 3}
    mock_get_learn_later.assert_awaited_once_with(1, 1, create_if_missing=False)
    mock_get_phrase_ids.assert_awaited_once_with(1, [1, 2, 3, 4])


@patch("osmosmjerka.game_api.db_manager.get_or_create_learn_later_list", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.bulk_add_phrases_to_private_list", new_callable=AsyncMock)
def test_bulk_add_to_learn_later(mock_bulk_add, mock_get_list, client):
    """Test bulk adding phrases to Learn This Later"""
    mock_get_list.return_value = {"id": 1, "list_name": "Learn This Later"}
    mock_bulk_add.return_value = 3

    response = client.post(
        "/api/user/learn-later/bulk",
        json={"language_set_id": 1, "phrase_ids": [1, 2, 3]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["added_count"] == 3
    assert data["skipped"] == 0


# ===== List Management Endpoints =====


@patch("osmosmjerka.game_api.db_manager.get_user_private_lists", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_phrase_counts_batch", new_callable=AsyncMock)
def test_get_user_private_lists(mock_get_counts, mock_get_lists, client):
    """Test getting user's private lists"""
    mock_get_lists.return_value = {
        "lists": [{"id": 1, "list_name": "My List", "user_id": 1}],
        "total": 1,
        "limit": 50,
        "offset": 0,
        "has_more": False,
    }
    mock_get_counts.return_value = {1: 5}

    response = client.get("/api/user/private-lists?language_set_id=1")

    assert response.status_code == 200
    data = response.json()
    assert "lists" in data
    assert len(data["lists"]) == 1
    assert data["lists"][0]["phrase_count"] == 5


@patch("osmosmjerka.game_api.db_manager.create_private_list", new_callable=AsyncMock)
def test_create_private_list(mock_create, client):
    """Test creating a new private list"""
    mock_create.return_value = 1

    response = client.post(
        "/api/user/private-lists",
        json={"list_name": "New List", "language_set_id": 1},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["list_name"] == "New List"


@patch("osmosmjerka.game_api.db_manager.create_private_list", new_callable=AsyncMock)
def test_create_private_list_duplicate(mock_create, client):
    """Test creating a list with duplicate name"""
    mock_create.side_effect = ValueError("List name already exists")

    response = client.post(
        "/api/user/private-lists",
        json={"list_name": "Duplicate", "language_set_id": 1},
    )

    assert response.status_code == 409


@patch("osmosmjerka.game_api.db_manager.get_user_private_lists", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.update_private_list_name", new_callable=AsyncMock)
def test_update_private_list_name(mock_update, mock_get, mock_get_lists, client):
    """Test renaming a private list"""
    mock_get.return_value = {
        "id": 1,
        "user_id": 1,
        "list_name": "Old Name",
        "is_system_list": False,
        "language_set_id": 1,
    }
    mock_get_lists.return_value = {"lists": [], "total": 1, "has_more": False, "limit": 50, "offset": 0}
    mock_update.return_value = True

    response = client.put(
        "/api/user/private-lists/1",
        json={"list_name": "New Name"},
    )

    assert response.status_code == 200


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.delete_private_list", new_callable=AsyncMock)
def test_delete_private_list(mock_delete, mock_get, client):
    """Test deleting a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1, "is_system_list": False}
    mock_delete.return_value = True

    response = client.delete("/api/user/private-lists/1")

    assert response.status_code == 200


# ===== Phrase Management Endpoints =====


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_private_list_entries", new_callable=AsyncMock)
def test_get_private_list_entries(mock_get_entries, mock_get_list, client):
    """Test getting entries from a private list"""
    mock_get_list.return_value = {
        "id": 1,
        "user_id": 1,
        "list_name": "My List",
        "language_set_id": 1,
        "is_system_list": False,
    }
    mock_get_entries.return_value = {
        "entries": [{"id": 1, "phrase_id": 1, "custom_phrase": None}],
        "total": 1,
        "limit": 100,
        "offset": 0,
        "has_more": False,
    }

    response = client.get("/api/user/private-lists/1/entries")

    assert response.status_code == 200
    data = response.json()
    assert "entries" in data
    assert len(data["entries"]) == 1


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.add_phrase_to_private_list", new_callable=AsyncMock)
def test_add_phrase_to_private_list(mock_add, mock_get, client):
    """Test adding a phrase to a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_add.return_value = 1

    response = client.post(
        "/api/user/private-lists/1/phrases",
        json={"phrase_id": 1},
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.add_phrase_to_private_list", new_callable=AsyncMock)
def test_add_custom_phrase_to_private_list(mock_add, mock_get, client):
    """Test adding a custom phrase to a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_add.return_value = 1

    response = client.post(
        "/api/user/private-lists/1/phrases",
        json={
            "custom_phrase": "hello",
            "custom_translation": "hola",
            "custom_categories": "Greetings",
        },
    )

    assert response.status_code == 201


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.remove_phrase_from_private_list", new_callable=AsyncMock)
def test_remove_phrase_from_private_list(mock_remove, mock_get, client):
    """Test removing a phrase from a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_remove.return_value = True

    response = client.delete("/api/user/private-lists/1/phrases/1")

    assert response.status_code == 200


# ===== Batch Import Endpoint =====


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.add_phrase_to_private_list", new_callable=AsyncMock)
def test_batch_import_phrases(mock_add_phrase, mock_get, client):
    """Test batch importing phrases"""
    mock_get.return_value = {"id": 1, "user_id": 1, "language_set_id": 1}
    mock_add_phrase.side_effect = [101, 102]  # Two added IDs

    response = client.post(
        "/api/user/private-lists/1/phrases/batch",
        json=[
            {"phrase": "hello", "translation": "hola"},
            {"phrase": "goodbye", "translation": "adiós"},
        ],
    )

    assert response.status_code == 200
    data = response.json()
    assert data["added_count"] == 2


# ===== List Sharing Endpoints =====


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_user_by_username", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.share_list", new_callable=AsyncMock)
def test_share_private_list(mock_share, mock_get_user, mock_get, client):
    """Test sharing a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_get_user.return_value = {"id": 2, "username": "otheruser"}
    mock_share.return_value = 1

    response = client.post(
        "/api/user/private-lists/1/share",
        json={"shared_with_username": "otheruser", "permission": "read"},
    )

    assert response.status_code == 201


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_list_shares", new_callable=AsyncMock)
def test_get_list_shares(mock_get_shares, mock_get, client):
    """Test getting shares for a list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_get_shares.return_value = [{"shared_with_user_id": 2, "permission": "read", "username": "otheruser"}]

    response = client.get("/api/user/private-lists/1/shares")

    assert response.status_code == 200
    data = response.json()
    assert "shares" in data
    assert len(data["shares"]) == 1


@patch("osmosmjerka.game_api.db_manager.get_private_list_by_id", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.unshare_list", new_callable=AsyncMock)
def test_unshare_private_list(mock_unshare, mock_get, client):
    """Test unsharing a private list"""
    mock_get.return_value = {"id": 1, "user_id": 1}
    mock_unshare.return_value = True

    response = client.delete("/api/user/private-lists/1/share/2")

    assert response.status_code == 200


@patch("osmosmjerka.game_api.db_manager.get_shared_with_me_lists", new_callable=AsyncMock)
def test_get_shared_lists(mock_get_shared, client):
    """Test getting lists shared with the current user"""
    mock_get_shared.return_value = [{"id": 1, "list_name": "Shared List", "owner_username": "owner"}]

    response = client.get("/api/user/shared-lists?language_set_id=1")

    assert response.status_code == 200
    data = response.json()
    assert "lists" in data
    assert len(data["lists"]) == 1


# ===== Statistics Endpoints =====


@patch("osmosmjerka.game_api.db_manager.check_list_access", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.db_manager.get_list_statistics", new_callable=AsyncMock)
def test_get_list_statistics(mock_get_stats, mock_check_access, client):
    """Test getting statistics for a list"""
    mock_check_access.return_value = {"access_type": "owner"}
    mock_get_stats.return_value = {
        "total_phrases": 10,
        "custom_phrases": 5,
        "public_phrases": 5,
    }

    response = client.get("/api/user/private-lists/1/statistics")

    assert response.status_code == 200
    data = response.json()
    assert "total_phrases" in data
    mock_check_access.assert_called_once_with(1, 1)
    mock_get_stats.assert_called_once_with(1, 1)


@patch("osmosmjerka.game_api.db_manager.get_user_list_statistics", new_callable=AsyncMock)
def test_get_user_statistics(mock_get_stats, client):
    """Test getting user aggregate statistics"""
    mock_get_stats.return_value = {
        "total_lists": 5,
        "total_phrases": 100,
        "most_used_list": {"id": 1, "name": "My List"},
    }

    response = client.get("/api/user/lists/statistics")

    assert response.status_code == 200
    data = response.json()
    assert "total_lists" in data


# ===== Private List Phrases Endpoint (Puzzle Generation) =====


@patch("osmosmjerka.database.db_manager.get_private_list_phrases", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.get_grid_size_and_num_phrases")
@patch("osmosmjerka.game_api._generate_grid_with_exact_phrase_count")
def test_get_private_list_phrases_with_category(mock_generate_grid, mock_get_grid_size, mock_get_phrases, client):
    """Test getting phrases from a private list with specific category"""
    mock_get_phrases.return_value = [
        {"id": 1, "phrase": "hello", "translation": "hola", "categories": "Greetings"}
    ] * 20
    mock_get_grid_size.return_value = (10, 7)
    mock_generate_grid.return_value = ([["H"]], [{"phrase": "hello", "translation": "hola"}])

    response = client.get("/api/user/private-lists/1/phrases?language_set_id=1&category=Greetings&difficulty=easy")

    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "phrases" in data
    assert data["category"] == "Greetings"
    assert data["source"] == "private_list"
    # Verify get_private_list_phrases was called with the category
    mock_get_phrases.assert_called_once()
    call_args = mock_get_phrases.call_args
    assert call_args[1]["category"] == "Greetings"


@patch("osmosmjerka.database.db_manager.get_private_list_phrases", new_callable=AsyncMock)
@patch("osmosmjerka.game_api.get_grid_size_and_num_phrases")
@patch("osmosmjerka.game_api._generate_grid_with_exact_phrase_count")
def test_get_private_list_phrases_all_categories(mock_generate_grid, mock_get_grid_size, mock_get_phrases, client):
    """Test getting phrases from a private list with ALL category (all categories)"""
    # Return phrases from multiple categories
    mock_get_phrases.return_value = [
        {"id": 1, "phrase": "hello", "translation": "hola", "categories": "Greetings"},
        {"id": 2, "phrase": "cat", "translation": "gato", "categories": "Animals"},
        {"id": 3, "phrase": "red", "translation": "rojo", "categories": "Colors"},
    ] * 10  # 30 phrases total
    mock_get_grid_size.return_value = (10, 7)
    mock_generate_grid.return_value = ([["H"]], [{"phrase": "hello", "translation": "hola"}])

    response = client.get("/api/user/private-lists/1/phrases?language_set_id=1&category=ALL&difficulty=easy")

    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "phrases" in data
    assert data["category"] == "ALL"
    assert data["source"] == "private_list"
    # Verify get_private_list_phrases was called with None (no category filter)
    mock_get_phrases.assert_called_once()
    call_args = mock_get_phrases.call_args
    assert call_args[1]["category"] is None


@patch("osmosmjerka.database.db_manager.get_private_list_categories", new_callable=AsyncMock)
def test_get_private_list_categories(mock_get_categories, client):
    """Test getting categories from a private list"""
    mock_get_categories.return_value = ["Greetings", "Animals", "Colors"]

    response = client.get("/api/user/private-lists/1/categories?language_set_id=1")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert "Greetings" in data
    assert "Animals" in data
    assert "Colors" in data
