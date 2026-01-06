"""User preferences and ignored categories database operations."""

from typing import Optional

from osmosmjerka.database.models import user_ignored_categories_table, user_preferences_table
from sqlalchemy.sql import delete, func, insert, select, update


class UserPreferencesMixin:
    """Mixin class providing user preferences and ignored categories management methods."""

    async def get_user_ignored_categories(self, user_id: int, language_set_id: int) -> list[str]:
        """Get ignored categories for a user in a specific language set."""
        database = self._ensure_database()
        query = select(user_ignored_categories_table.c.category).where(
            user_ignored_categories_table.c.user_id == user_id,
            user_ignored_categories_table.c.language_set_id == language_set_id,
        )
        rows = await database.fetch_all(query)
        return [r[0] for r in rows]

    async def replace_user_ignored_categories(self, user_id: int, language_set_id: int, categories: list[str]):
        """Replace all ignored categories for a user in a specific language set."""
        database = self._ensure_database()
        async with database.transaction():
            # Delete existing
            del_query = delete(user_ignored_categories_table).where(
                user_ignored_categories_table.c.user_id == user_id,
                user_ignored_categories_table.c.language_set_id == language_set_id,
            )
            await database.execute(del_query)
            if categories:
                insert_values = [
                    {"user_id": user_id, "language_set_id": language_set_id, "category": c}
                    for c in sorted(set(categories))
                ]
                await database.execute_many(insert(user_ignored_categories_table), insert_values)

    async def get_all_user_ignored_categories(self, user_id: int) -> dict[int, list[str]]:
        """Get all ignored categories for a user across all language sets."""
        database = self._ensure_database()
        query = select(
            user_ignored_categories_table.c.language_set_id,
            user_ignored_categories_table.c.category,
        ).where(user_ignored_categories_table.c.user_id == user_id)
        rows = await database.fetch_all(query)
        result: dict[int, list[str]] = {}
        for row in rows:
            ls_id = row[0]
            cat = row[1]
            result.setdefault(ls_id, []).append(cat)
        # Sort categories
        for k in result:
            result[k] = sorted(result[k])
        return result

    async def get_user_preference(
        self, user_id: int, preference_key: str, default_value: Optional[str] = None
    ) -> Optional[str]:
        """Get a user preference value by key."""
        database = self._ensure_database()

        query = select(user_preferences_table.c.preference_value).where(
            (user_preferences_table.c.user_id == user_id) & (user_preferences_table.c.preference_key == preference_key)
        )

        result = await database.fetch_one(query)
        return result["preference_value"] if result else default_value

    async def set_user_preference(self, user_id: int, preference_key: str, preference_value: str) -> None:
        """Set a user preference value."""
        database = self._ensure_database()

        # Check if preference exists
        existing = await database.fetch_one(
            select(user_preferences_table.c.id).where(
                (user_preferences_table.c.user_id == user_id)
                & (user_preferences_table.c.preference_key == preference_key)
            )
        )

        if existing:
            # Update existing preference
            query = (
                update(user_preferences_table)
                .where(
                    (user_preferences_table.c.user_id == user_id)
                    & (user_preferences_table.c.preference_key == preference_key)
                )
                .values(preference_value=preference_value, updated_at=func.now())
            )
        else:
            # Insert new preference
            query = insert(user_preferences_table).values(
                user_id=user_id, preference_key=preference_key, preference_value=preference_value
            )

        await database.execute(query)

    async def get_user_preferences(self, user_id: int) -> dict:
        """Get all user preferences as a dictionary."""
        database = self._ensure_database()
        query = select(user_preferences_table.c.preference_key, user_preferences_table.c.preference_value).where(
            user_preferences_table.c.user_id == user_id
        )
        rows = await database.fetch_all(query)
        return {row[0]: row[1] for row in rows}
