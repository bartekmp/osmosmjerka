"""Game session tracking database operations."""

import time
from typing import Dict, Optional

from osmosmjerka.database.models import game_sessions_table, user_category_plays_table, user_statistics_table
from sqlalchemy.sql import func, insert, select, update


class GameSessionsMixin:
    """Mixin class providing game session tracking methods."""

    def _get_cache_key(self, prefix: str, user_id: int, language_set_id: Optional[int] = None) -> str:
        """Generate cache key for statistics."""
        if language_set_id is not None:
            return f"{prefix}:{user_id}:{language_set_id}"
        return f"{prefix}:{user_id}"

    def _is_cache_valid(self, cache_entry: Dict) -> bool:
        """Check if cache entry is still valid."""
        return time.time() - cache_entry["timestamp"] < self._statistics_cache_ttl

    def _invalidate_user_cache(self, user_id: int):
        """Invalidate all cache entries for a user."""
        keys_to_remove = [
            key for key in self._statistics_cache.keys() if f":{user_id}:" in key or key.endswith(f":{user_id}")
        ]
        for key in keys_to_remove:
            del self._statistics_cache[key]

    async def start_game_session(
        self,
        user_id: int,
        language_set_id: int,
        category: str,
        difficulty: str,
        grid_size: int,
        total_phrases: int,
        game_type: str = "word_search",
    ) -> int:
        """Start a new game session and return session ID."""
        database = self._ensure_database()

        # Insert new game session
        query = insert(game_sessions_table).values(
            user_id=user_id,
            language_set_id=language_set_id,
            category=category,
            difficulty=difficulty,
            grid_size=grid_size,
            total_phrases=total_phrases,
            phrases_found=0,
            is_completed=False,
            game_type=game_type,
        )
        session_id = await database.execute(query)

        # Update user statistics - games started
        await self._update_user_statistics(user_id, language_set_id, games_started=1)

        # Invalidate cache
        self._invalidate_user_cache(user_id)

        return session_id

    async def update_game_progress(self, session_id: int, phrases_found: int):
        """Update game progress for a session."""
        database = self._ensure_database()

        query = (
            update(game_sessions_table)
            .where(game_sessions_table.c.id == session_id)
            .values(phrases_found=phrases_found)
        )

        await database.execute(query)

    async def complete_game_session(self, session_id: int, phrases_found: int, duration_seconds: int):
        """Complete a game session and update statistics."""
        database = self._ensure_database()

        # Get session details
        session_query = select(game_sessions_table).where(game_sessions_table.c.id == session_id)
        session = await database.fetch_one(session_query)

        if not session:
            return

        user_id = session["user_id"]
        language_set_id = session["language_set_id"]
        category = session["category"]
        total_phrases = session["total_phrases"]
        is_completed = phrases_found == total_phrases

        # Update game session
        update_query = (
            update(game_sessions_table)
            .where(game_sessions_table.c.id == session_id)
            .values(
                phrases_found=phrases_found,
                is_completed=is_completed,
                end_time=func.now(),
                duration_seconds=duration_seconds,
            )
        )
        await database.execute(update_query)

        # Update user statistics
        stats_update = {"total_phrases_found": phrases_found, "total_time_played_seconds": duration_seconds}

        if is_completed:
            stats_update["games_completed"] = 1
            stats_update["puzzles_solved"] = 1

        await self._update_user_statistics(user_id, language_set_id, **stats_update)

        # Update category plays
        await self._update_category_plays(user_id, language_set_id, category, phrases_found, duration_seconds)

        # Invalidate cache
        self._invalidate_user_cache(user_id)

    async def _update_user_statistics(self, user_id: int, language_set_id: int, **kwargs):
        """Update user statistics with the provided values."""
        database = self._ensure_database()

        # Check if record exists
        check_query = select(user_statistics_table).where(
            (user_statistics_table.c.user_id == user_id) & (user_statistics_table.c.language_set_id == language_set_id)
        )
        existing = await database.fetch_one(check_query)

        if existing:
            # Update existing record
            update_values = {"updated_at": func.now()}
            for key, value in kwargs.items():
                if key in [
                    "games_started",
                    "games_completed",
                    "puzzles_solved",
                    "total_phrases_found",
                    "total_time_played_seconds",
                    "phrases_added",
                    "phrases_edited",
                ]:
                    update_values[key] = getattr(user_statistics_table.c, key) + value

            if any(k in kwargs for k in ["games_completed", "puzzles_solved"]):
                update_values["last_played"] = func.now()

            query = (
                update(user_statistics_table)
                .where(
                    (user_statistics_table.c.user_id == user_id)
                    & (user_statistics_table.c.language_set_id == language_set_id)
                )
                .values(**update_values)
            )

            await database.execute(query)
        else:
            # Insert new record
            insert_values = {
                "user_id": user_id,
                "language_set_id": language_set_id,
                "games_started": kwargs.get("games_started", 0),
                "games_completed": kwargs.get("games_completed", 0),
                "puzzles_solved": kwargs.get("puzzles_solved", 0),
                "total_phrases_found": kwargs.get("total_phrases_found", 0),
                "total_time_played_seconds": kwargs.get("total_time_played_seconds", 0),
                "phrases_added": kwargs.get("phrases_added", 0),
                "phrases_edited": kwargs.get("phrases_edited", 0),
            }

            if any(k in kwargs for k in ["games_completed", "puzzles_solved"]):
                insert_values["last_played"] = func.now()

            query = insert(user_statistics_table).values(**insert_values)
            await database.execute(query)

    async def _update_category_plays(
        self, user_id: int, language_set_id: int, category: str, phrases_found: int, duration_seconds: int
    ):
        """Update category play statistics."""
        database = self._ensure_database()

        # Check if record exists
        check_query = select(user_category_plays_table).where(
            (user_category_plays_table.c.user_id == user_id)
            & (user_category_plays_table.c.language_set_id == language_set_id)
            & (user_category_plays_table.c.category == category)
        )
        existing = await database.fetch_one(check_query)

        if existing:
            # Update existing record
            query = (
                update(user_category_plays_table)
                .where(
                    (user_category_plays_table.c.user_id == user_id)
                    & (user_category_plays_table.c.language_set_id == language_set_id)
                    & (user_category_plays_table.c.category == category)
                )
                .values(
                    plays_count=user_category_plays_table.c.plays_count + 1,
                    phrases_found=user_category_plays_table.c.phrases_found + phrases_found,
                    total_time_seconds=user_category_plays_table.c.total_time_seconds + duration_seconds,
                    last_played=func.now(),
                )
            )
            await database.execute(query)
        else:
            # Insert new record
            query = insert(user_category_plays_table).values(
                user_id=user_id,
                language_set_id=language_set_id,
                category=category,
                plays_count=1,
                phrases_found=phrases_found,
                total_time_seconds=duration_seconds,
            )
            await database.execute(query)

    async def record_phrase_operation(self, user_id: int, language_set_id: int, operation: str):
        """Record phrase add/edit operation."""
        if operation not in ["added", "edited"]:
            return

        field_name = f"phrases_{operation}"
        await self._update_user_statistics(user_id, language_set_id, **{field_name: 1})
        self._invalidate_user_cache(user_id)
