"""Statistics and global settings database operations."""

import datetime
import time
from typing import Dict, List, Optional

from sqlalchemy import desc, func
from sqlalchemy.sql import delete, insert, select, update

from osmosmjerka.database.models import (
    accounts_table,
    game_sessions_table,
    global_settings_table,
    language_sets_table,
    user_category_plays_table,
    user_statistics_table,
)


class StatisticsMixin:
    """Mixin class providing statistics and global settings management methods."""

    async def get_user_statistics(self, user_id: int, language_set_id: Optional[int] = None) -> Dict:
        """Get user statistics with caching."""
        cache_key = self._get_cache_key("user_stats", user_id, language_set_id)

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        if language_set_id is not None:
            # Get statistics for specific language set
            query = select(user_statistics_table).where(
                (user_statistics_table.c.user_id == user_id)
                & (user_statistics_table.c.language_set_id == language_set_id)
            )
            stats = await database.fetch_one(query)

            if stats:
                result = dict(stats)
                result = self._serialize_datetimes(result)
            else:
                result = {
                    "user_id": user_id,
                    "language_set_id": language_set_id,
                    "games_started": 0,
                    "games_completed": 0,
                    "puzzles_solved": 0,
                    "total_phrases_found": 0,
                    "total_time_played_seconds": 0,
                    "phrases_added": 0,
                    "phrases_edited": 0,
                    "last_played": None,
                }
        else:
            # Get aggregated statistics across all language sets
            query = select(
                func.sum(user_statistics_table.c.games_started).label("games_started"),
                func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                func.sum(user_statistics_table.c.puzzles_solved).label("puzzles_solved"),
                func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
                func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played_seconds"),
                func.sum(user_statistics_table.c.phrases_added).label("phrases_added"),
                func.sum(user_statistics_table.c.phrases_edited).label("phrases_edited"),
                func.max(user_statistics_table.c.last_played).label("last_played"),
            ).where(user_statistics_table.c.user_id == user_id)

            stats = await database.fetch_one(query)

            if stats and stats["games_started"]:
                result = {
                    "user_id": user_id,
                    "games_started": stats["games_started"] or 0,
                    "games_completed": stats["games_completed"] or 0,
                    "puzzles_solved": stats["puzzles_solved"] or 0,
                    "total_phrases_found": stats["total_phrases_found"] or 0,
                    "total_time_played_seconds": stats["total_time_played_seconds"] or 0,
                    "phrases_added": stats["phrases_added"] or 0,
                    "phrases_edited": stats["phrases_edited"] or 0,
                    "last_played": stats["last_played"].isoformat() if stats["last_played"] else None,
                }
            else:
                result = {
                    "user_id": user_id,
                    "games_started": 0,
                    "games_completed": 0,
                    "puzzles_solved": 0,
                    "total_phrases_found": 0,
                    "total_time_played_seconds": 0,
                    "phrases_added": 0,
                    "phrases_edited": 0,
                    "last_played": None,
                }

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_user_favorite_categories(self, user_id: int, language_set_id: int, limit: int = 5) -> List[Dict]:
        """Get user's favorite categories for a language set."""
        cache_key = self._get_cache_key("fav_cats", user_id, language_set_id)

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        query = (
            select(
                user_category_plays_table.c.category,
                user_category_plays_table.c.plays_count,
                user_category_plays_table.c.phrases_found,
                user_category_plays_table.c.total_time_seconds,
                user_category_plays_table.c.last_played,
            )
            .where(
                (user_category_plays_table.c.user_id == user_id)
                & (user_category_plays_table.c.language_set_id == language_set_id)
            )
            .order_by(desc(user_category_plays_table.c.plays_count))
            .limit(limit)
        )

        rows = await database.fetch_all(query)
        result = [self._serialize_datetimes(dict(row)) for row in rows]

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_admin_statistics_overview(self) -> Dict:
        """Get overview statistics for admin dashboard."""
        cache_key = "admin_overview"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        # Get total users count
        users_query = select(func.count(accounts_table.c.id)).where(accounts_table.c.is_active)
        total_users = await database.fetch_val(users_query)

        # Get total games statistics
        games_query = select(
            func.sum(user_statistics_table.c.games_started).label("total_games_started"),
            func.sum(user_statistics_table.c.games_completed).label("total_games_completed"),
            func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
            func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played"),
        )
        games_stats = await database.fetch_one(games_query)

        # Get active users (played in last 30 days)
        thirty_days_ago = datetime.datetime.now() - datetime.timedelta(days=30)
        active_users_query = select(func.count(func.distinct(user_statistics_table.c.user_id))).where(
            user_statistics_table.c.last_played >= thirty_days_ago
        )
        active_users = await database.fetch_val(active_users_query)

        result = {
            "total_users": total_users or 0,
            "active_users_30d": active_users or 0,
            "total_games_started": games_stats["total_games_started"] if games_stats else 0,
            "total_games_completed": games_stats["total_games_completed"] if games_stats else 0,
            "total_phrases_found": games_stats["total_phrases_found"] if games_stats else 0,
            "total_time_played_hours": round((games_stats["total_time_played"] or 0) / 3600, 2) if games_stats else 0,
        }

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_statistics_by_language_set(self, language_set_id: Optional[int] = None) -> List[Dict]:
        """Get statistics grouped by language set."""
        cache_key = f"stats_by_langset:{language_set_id or 'all'}"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        # Join with language_sets table to get language set information
        query = (
            select(
                language_sets_table.c.id,
                language_sets_table.c.name,
                language_sets_table.c.display_name,
                func.sum(user_statistics_table.c.games_started).label("games_started"),
                func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                func.sum(user_statistics_table.c.total_phrases_found).label("phrases_found"),
                func.sum(user_statistics_table.c.total_time_played_seconds).label("time_played"),
                func.count(func.distinct(user_statistics_table.c.user_id)).label("unique_players"),
            )
            .select_from(
                language_sets_table.join(
                    user_statistics_table,
                    language_sets_table.c.id == user_statistics_table.c.language_set_id,
                    isouter=True,
                )
            )
            .group_by(language_sets_table.c.id, language_sets_table.c.name, language_sets_table.c.display_name)
        )

        if language_set_id is not None:
            query = query.where(language_sets_table.c.id == language_set_id)

        rows = await database.fetch_all(query)
        result = []

        for row in rows:
            result.append(
                {
                    "language_set_id": row["id"],
                    "language_set_name": row["name"],
                    "language_set_display_name": row["display_name"],
                    "games_started": row["games_started"] or 0,
                    "games_completed": row["games_completed"] or 0,
                    "phrases_found": row["phrases_found"] or 0,
                    "time_played_hours": round((row["time_played"] or 0) / 3600, 2),
                    "unique_players": row["unique_players"] or 0,
                }
            )

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_user_statistics_list(self, language_set_id: Optional[int] = None, limit: int = 50) -> List[Dict]:
        """Get statistics for all users, optionally filtered by language set."""
        cache_key = f"user_stats_list:{language_set_id or 'all'}:{limit}"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        if language_set_id is not None:
            # Get statistics for specific language set
            query = (
                select(
                    accounts_table.c.id,
                    accounts_table.c.username,
                    user_statistics_table.c.language_set_id,
                    user_statistics_table.c.games_started,
                    user_statistics_table.c.games_completed,
                    user_statistics_table.c.total_phrases_found,
                    user_statistics_table.c.total_time_played_seconds,
                    user_statistics_table.c.phrases_added,
                    user_statistics_table.c.phrases_edited,
                    user_statistics_table.c.last_played,
                )
                .select_from(
                    accounts_table.join(user_statistics_table, accounts_table.c.id == user_statistics_table.c.user_id)
                )
                .where((accounts_table.c.is_active) & (user_statistics_table.c.language_set_id == language_set_id))
                .order_by(desc(user_statistics_table.c.games_completed))
                .limit(limit)
            )
        else:
            # Get aggregated statistics across all language sets
            query = (
                select(
                    accounts_table.c.id,
                    accounts_table.c.username,
                    func.sum(user_statistics_table.c.games_started).label("games_started"),
                    func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                    func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
                    func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played_seconds"),
                    func.sum(user_statistics_table.c.phrases_added).label("phrases_added"),
                    func.sum(user_statistics_table.c.phrases_edited).label("phrases_edited"),
                    func.max(user_statistics_table.c.last_played).label("last_played"),
                )
                .select_from(
                    accounts_table.join(
                        user_statistics_table, accounts_table.c.id == user_statistics_table.c.user_id, isouter=True
                    )
                )
                .where(accounts_table.c.is_active)
                .group_by(accounts_table.c.id, accounts_table.c.username)
                .order_by(desc(func.sum(user_statistics_table.c.games_completed)))
                .limit(limit)
            )

        rows = await database.fetch_all(query)
        result = [self._serialize_datetimes(dict(row)) for row in rows]

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_global_setting(self, setting_key: str, default_value: Optional[str] = None) -> Optional[str]:
        """Get a global setting value by key."""
        database = self._ensure_database()

        query = select(global_settings_table.c.setting_value).where(global_settings_table.c.setting_key == setting_key)

        result = await database.fetch_one(query)
        return result["setting_value"] if result else default_value

    async def set_global_setting(
        self, setting_key: str, setting_value: str, description: Optional[str] = None, updated_by: int = 0
    ) -> None:
        """Set a global setting value."""
        database = self._ensure_database()

        # Check if setting exists
        existing = await database.fetch_one(
            select(global_settings_table.c.id).where(global_settings_table.c.setting_key == setting_key)
        )

        if existing:
            # Update existing setting
            query = (
                update(global_settings_table)
                .where(global_settings_table.c.setting_key == setting_key)
                .values(setting_value=setting_value, updated_at=func.now(), updated_by=updated_by)
            )
            if description is not None:
                query = query.values(description=description)
        else:
            # Insert new setting
            query = insert(global_settings_table).values(
                setting_key=setting_key, setting_value=setting_value, description=description, updated_by=updated_by
            )

        await database.execute(query)

    async def is_statistics_enabled(self) -> bool:
        """Check if statistics tracking is globally enabled."""
        setting = await self.get_global_setting("statistics_enabled", "true")
        return setting is not None and setting.lower() == "true"

    async def clear_all_statistics(self) -> None:
        """Clear all statistics data from all tables."""
        database = self._ensure_database()

        # Clear all statistics tables
        await database.execute(delete(game_sessions_table))
        await database.execute(delete(user_statistics_table))
        await database.execute(delete(user_category_plays_table))

        # Clear cache
        self._statistics_cache.clear()
