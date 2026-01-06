"""Language set management database operations."""

from typing import Optional

from osmosmjerka.database.models import language_sets_table
from sqlalchemy.sql import delete, insert, select, update


class LanguageSetsMixin:
    """Mixin class providing language set management methods."""

    async def get_language_sets(self, active_only: bool = True) -> list[dict]:
        """Get all language sets with protected flag."""
        database = self._ensure_database()
        query = select(language_sets_table)
        if active_only:
            query = query.where(language_sets_table.c.is_active)
        # Default first, then by display name
        query = query.order_by(language_sets_table.c.is_default.desc(), language_sets_table.c.display_name)
        result = await database.fetch_all(query)

        language_sets = []
        for row in result:
            lang_set = self._serialize_datetimes(dict(row))
            # Add protected flag: protected if created_by is None or 0
            lang_set["protected"] = lang_set.get("created_by") is None or lang_set.get("created_by") == 0
            language_sets.append(lang_set)

        return language_sets

    async def get_language_set_by_id(self, language_set_id: int) -> Optional[dict]:
        """Get a specific language set by ID."""
        database = self._ensure_database()
        query = select(language_sets_table).where(language_sets_table.c.id == language_set_id)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def create_language_set(
        self,
        name: str,
        display_name: str,
        description: Optional[str] = None,
        author: Optional[str] = None,
        created_by: Optional[int] = None,
        default_ignored_categories: Optional[list[str]] = None,
    ) -> int:
        """Create a new language set and its phrase table."""
        database = self._ensure_database()

        # Convert default_ignored_categories list to comma-separated string
        default_ignored_str = ",".join(default_ignored_categories) if default_ignored_categories else None

        # Create language set record
        query = insert(language_sets_table).values(
            name=name,
            display_name=display_name,
            description=description,
            author=author,
            created_by=created_by,
            default_ignored_categories=default_ignored_str,
            is_active=True,
            is_default=False,
        )
        language_set_id = await database.execute(query)

        # Create the phrase table for this language set
        await self._ensure_phrase_table_exists(name)

        return language_set_id

    async def update_language_set(self, language_set_id: int, **updates) -> int:
        """Update language set metadata."""
        database = self._ensure_database()
        query = update(language_sets_table).where(language_sets_table.c.id == language_set_id).values(**updates)
        return await database.execute(query)

    async def is_language_set_protected(self, language_set_id: int) -> bool:
        """Check if a language set is protected (created by root admin)."""
        database = self._ensure_database()
        query = select(language_sets_table.c.created_by).where(language_sets_table.c.id == language_set_id)
        result = await database.fetch_one(query)
        # If created_by is None or 0, it's considered a root-admin-created set (protected)
        return result is None or result[0] is None or result[0] == 0

    async def get_default_ignored_categories(self, language_set_id: int) -> list[str]:
        """Get default ignored categories for a language set."""
        database = self._ensure_database()
        query = select(language_sets_table.c.default_ignored_categories).where(
            language_sets_table.c.id == language_set_id
        )
        result = await database.fetch_one(query)
        if result and result[0]:
            return [cat.strip() for cat in result[0].split(",") if cat.strip()]
        return []

    async def delete_language_set(self, language_set_id: int):
        """Delete a language set and its phrase table."""
        database = self._ensure_database()

        # First get the language set to find its name
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return

        # Drop the phrase table
        table_name = self._get_phrase_table_name(language_set["name"])
        await database.execute(f"DROP TABLE IF EXISTS {table_name}")

        # Remove from cache
        if table_name in self._phrase_tables_cache:
            del self._phrase_tables_cache[table_name]

        # Delete the language set
        await database.execute(delete(language_sets_table).where(language_sets_table.c.id == language_set_id))

    async def set_default_language_set(self, language_set_id: int):
        """Set a language set as the default."""
        database = self._ensure_database()
        # First, unset all defaults
        await database.execute(
            update(language_sets_table).values(is_default=False).where(language_sets_table.c.is_default.is_(True))
        )
        # Then set the specified one as default
        await database.execute(
            update(language_sets_table).where(language_sets_table.c.id == language_set_id).values(is_default=True)
        )
