import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from osmosmjerka.database import DatabaseManager


@pytest.fixture
def db_manager():
    # Patch the Database and engine so no real DB is used
    with (
        patch("osmosmjerka.database.Database", autospec=True) as mock_db,
        patch("osmosmjerka.database.create_engine", autospec=True) as mock_engine,
    ):
        manager = DatabaseManager(database_url="sqlite:///test.db")
        manager.database = AsyncMock()
        manager.engine = mock_engine.return_value
        yield manager


def run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def test_get_words_returns_filtered_words(db_manager):
    # Setup mock return value
    db_manager.database.fetch_all.return_value = [
        {"id": 1, "categories": "cat dog", "word": "cat", "translation": "kot"},
        {"id": 2, "categories": "dog", "word": "do", "translation": "pies"},  # too short
        {"id": 3, "categories": "cat", "word": "cat", "translation": "kot"},
    ]
    # IGNORED_CATEGORIES is empty by default
    words = run_async(db_manager.get_words())
    # Only words with length >= 3 and not ignored
    assert all(len(w["word"]) >= 3 for w in words)
    assert all("categories" in w for w in words)


def test_add_word_calls_execute(db_manager):
    db_manager.database.execute.return_value = 42
    result = run_async(db_manager.add_word("cat", "cat", "kot"))
    db_manager.database.execute.assert_called_once()
    assert result == 42


def test_delete_word_calls_execute(db_manager):
    db_manager.database.execute.return_value = 1
    result = run_async(db_manager.delete_word(1))
    db_manager.database.execute.assert_called_once()
    assert result == 1
