import datetime
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio

from backend.osmosmjerka.database import DatabaseManager


@pytest_asyncio.fixture
async def db_manager():
    """Create a test database manager with mocked database"""
    manager = DatabaseManager("sqlite:///:memory:")
    manager.database = AsyncMock()
    manager.engine = Mock()

    # Mock the execute method to return session IDs
    manager.database.execute = AsyncMock(return_value=1)
    manager.database.fetch_one = AsyncMock()
    manager.database.fetch_all = AsyncMock(return_value=[])
    manager.database.fetch_val = AsyncMock(return_value=0)

    return manager


@pytest.mark.asyncio
async def test_start_game_session(db_manager):
    """Test starting a game session"""
    session_id = await db_manager.start_game_session(
        user_id=1, language_set_id=1, category="Animals", difficulty="easy", grid_size=10, total_phrases=7
    )

    assert session_id == 1
    assert db_manager.database.execute.call_count == 2  # game session + user stats update


@pytest.mark.asyncio
async def test_complete_game_session(db_manager):
    """Test completing a game session"""
    # Mock session data
    session_data = {"user_id": 1, "language_set_id": 1, "category": "Animals", "total_phrases": 7}
    db_manager.database.fetch_one.return_value = session_data

    await db_manager.complete_game_session(session_id=1, phrases_found=7, duration_seconds=120)

    # Should call execute multiple times (update session, update stats, update category plays)
    assert db_manager.database.execute.call_count >= 3


@pytest.mark.asyncio
async def test_get_user_statistics(db_manager):
    """Test getting user statistics"""
    # Mock statistics data
    stats_data = {
        "user_id": 1,
        "language_set_id": 1,
        "games_started": 5,
        "games_completed": 3,
        "total_phrases_found": 25,
        "total_time_played_seconds": 600,
        "phrases_added": 0,
        "phrases_edited": 0,
        "last_played": datetime.datetime.now(),
    }
    db_manager.database.fetch_one.return_value = stats_data

    result = await db_manager.get_user_statistics(1, 1)

    assert result["games_started"] == 5
    assert result["games_completed"] == 3
    assert result["total_phrases_found"] == 25


@pytest.mark.asyncio
async def test_get_user_favorite_categories(db_manager):
    """Test getting user's favorite categories"""
    # Mock category data
    categories_data = [
        {
            "category": "Animals",
            "plays_count": 5,
            "phrases_found": 25,
            "total_time_seconds": 300,
            "last_played": datetime.datetime.now(),
        },
        {
            "category": "Colors",
            "plays_count": 3,
            "phrases_found": 15,
            "total_time_seconds": 180,
            "last_played": datetime.datetime.now(),
        },
    ]
    db_manager.database.fetch_all.return_value = categories_data

    result = await db_manager.get_user_favorite_categories(1, 1, 5)

    assert len(result) == 2
    assert result[0]["category"] == "Animals"
    assert result[0]["plays_count"] == 5


@pytest.mark.asyncio
async def test_record_phrase_operation(db_manager):
    """Test recording phrase operations"""
    await db_manager.record_phrase_operation(1, 1, "added")

    assert db_manager.database.execute.call_count >= 1


@pytest.mark.asyncio
async def test_get_admin_statistics_overview(db_manager):
    """Test getting admin statistics overview"""
    # Mock overview data
    db_manager.database.fetch_val.side_effect = [10, 7]  # total users, active users
    db_manager.database.fetch_one.return_value = {
        "total_games_started": 50,
        "total_games_completed": 35,
        "total_phrases_found": 250,
        "total_time_played": 3600,
    }

    result = await db_manager.get_admin_statistics_overview()

    assert result["total_users"] == 10
    assert result["active_users_30d"] == 7
    assert result["total_games_started"] == 50
    assert result["total_games_completed"] == 35


@pytest.mark.asyncio
async def test_statistics_caching(db_manager):
    """Test that statistics are properly cached"""
    # Mock statistics data
    stats_data = {
        "user_id": 1,
        "language_set_id": 1,
        "games_started": 5,
        "games_completed": 3,
        "total_phrases_found": 25,
        "total_time_played_seconds": 600,
        "phrases_added": 0,
        "phrases_edited": 0,
        "last_played": datetime.datetime.now(),
    }
    db_manager.database.fetch_one.return_value = stats_data

    # First call should hit the database
    result1 = await db_manager.get_user_statistics(1, 1)

    # Second call should use cache
    result2 = await db_manager.get_user_statistics(1, 1)

    # Both results should be the same
    assert result1 == result2

    # Database should only be called once due to caching
    assert db_manager.database.fetch_one.call_count == 1


if __name__ == "__main__":
    pytest.main([__file__])
