"""Phrase management database operations."""

from typing import Optional

from osmosmjerka.database.models import language_sets_table, phrases_table
from sqlalchemy import func
from sqlalchemy.sql import delete, insert, select, update


class PhrasesMixin:
    """Mixin class providing phrase management methods.

    All phrases live in the single `phrases` table keyed by `language_set_id`.
    """

    async def _resolve_language_set(self, language_set_id: Optional[int]):
        """Resolve a language set by id, or fall back to the first active one.

        Returns the language set dict, or None if none is available.
        """
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            return sets[0] if sets else None
        return await self.get_language_set_by_id(language_set_id)

    async def get_phrases(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        ignored_categories_override: Optional[set[str]] = None,
    ) -> list[dict[str, str]]:
        """Get phrases from a language set (applies ignored-category filtering)."""
        database = self._ensure_database()

        language_set = await self._resolve_language_set(language_set_id)
        if not language_set:
            return []

        query = select(phrases_table).where(phrases_table.c.language_set_id == language_set["id"])
        if category:
            query = query.where(phrases_table.c.categories.like(f"%{category}%"))
        query = query.order_by(phrases_table.c.id)
        if limit:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        row_list = []

        # Use language set's default ignored categories if no override provided
        if ignored_categories_override is not None:
            effective_ignored = ignored_categories_override
        else:
            default_ignored = await self.get_default_ignored_categories(language_set["id"])
            effective_ignored = set(default_ignored)

        for row in result:
            row = dict(row)
            row.pop("language_set_id", None)
            # Skip phrases shorter than 3 characters
            if len(str(row["phrase"]).strip()) < 3:
                continue
            # Remove ignored categories
            cats_set = set(row["categories"].split())
            cats_set = cats_set.difference(effective_ignored)
            # Skip if no valid categories left
            if not cats_set:
                continue
            row["categories"] = " ".join(sorted(cats_set))
            row_list.append(row)
        return row_list

    async def add_phrase(self, language_set_id: int, categories: str, phrase: str, translation: str):
        """Add a new phrase to a language set."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = insert(phrases_table).values(
            language_set_id=language_set_id, categories=categories, phrase=phrase, translation=translation
        )
        return await database.execute(query)

    async def update_phrase(self, phrase_id: int, language_set_id: int, categories: str, phrase: str, translation: str):
        """Update an existing phrase."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = (
            update(phrases_table)
            .where(phrases_table.c.id == phrase_id, phrases_table.c.language_set_id == language_set_id)
            .values(categories=categories, phrase=phrase, translation=translation)
        )
        return await database.execute(query)

    async def get_phrases_by_ids(self, phrase_ids: list[int], language_set_id: int) -> list[dict]:
        """Get specific phrases by their IDs."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = select(phrases_table).where(
            phrases_table.c.language_set_id == language_set_id, phrases_table.c.id.in_(phrase_ids)
        )
        result = await database.fetch_all(query)
        rows = []
        for row in result:
            row = dict(row)
            row.pop("language_set_id", None)
            rows.append(row)
        return rows

    async def update_phrase_categories(self, phrase_id: int, categories: str, language_set_id: int):
        """Update only the categories of a specific phrase."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = (
            update(phrases_table)
            .where(phrases_table.c.id == phrase_id, phrases_table.c.language_set_id == language_set_id)
            .values(categories=categories)
        )
        return await database.execute(query)

    async def delete_phrase(self, phrase_id: int, language_set_id: int):
        """Delete a phrase."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = delete(phrases_table).where(
            phrases_table.c.id == phrase_id, phrases_table.c.language_set_id == language_set_id
        )
        return await database.execute(query)

    async def batch_delete_phrases(self, phrase_ids: list[int], language_set_id: int) -> int:
        """Delete multiple phrases."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        query = delete(phrases_table).where(
            phrases_table.c.language_set_id == language_set_id, phrases_table.c.id.in_(phrase_ids)
        )
        result = await database.execute(query)
        # Return the number of deleted rows or the length of phrase_ids if result is None
        return getattr(result, "rowcount", len(phrase_ids)) if result else len(phrase_ids)

    async def batch_add_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Add a category to multiple phrases."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        # Get current phrases that need updating
        select_query = select(phrases_table.c.id, phrases_table.c.categories).where(
            phrases_table.c.language_set_id == language_set_id, phrases_table.c.id.in_(phrase_ids)
        )
        phrases = await database.fetch_all(select_query)

        affected_count = 0
        for phrase in phrases:
            current_categories = phrase["categories"] or ""
            current_cat_list = [cat.strip() for cat in current_categories.split() if cat.strip()]

            # Only update if category doesn't already exist
            if category not in current_cat_list:
                new_categories = " ".join(current_cat_list + [category])
                update_query = (
                    update(phrases_table).where(phrases_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def batch_remove_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Remove a category from multiple phrases."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        # Get current phrases that need updating
        select_query = select(phrases_table.c.id, phrases_table.c.categories).where(
            phrases_table.c.language_set_id == language_set_id, phrases_table.c.id.in_(phrase_ids)
        )
        phrases = await database.fetch_all(select_query)

        affected_count = 0
        for phrase in phrases:
            current_categories = phrase["categories"] or ""
            current_cat_list = [cat.strip() for cat in current_categories.split() if cat.strip()]

            # Only update if category exists
            if category in current_cat_list:
                new_cat_list = [cat for cat in current_cat_list if cat != category]
                new_categories = " ".join(new_cat_list)
                update_query = (
                    update(phrases_table).where(phrases_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def get_categories_for_language_set(
        self, language_set_id: Optional[int] = None, ignored_categories_override: Optional[set[str]] = None
    ) -> list[str]:
        """Get categories for a specific language set (applies ignored filtering)."""
        database = self._ensure_database()

        language_set = await self._resolve_language_set(language_set_id)
        if not language_set:
            return []

        query = select(phrases_table.c.categories).where(phrases_table.c.language_set_id == language_set["id"])
        result = await database.fetch_all(query)
        categories_set = set()

        # Use language set's default ignored categories if no override provided
        if ignored_categories_override is not None:
            effective_ignored = ignored_categories_override
        else:
            default_ignored = await self.get_default_ignored_categories(language_set["id"])
            effective_ignored = set(default_ignored)

        for row in result:
            for cat in row["categories"].split():
                if cat.strip() and cat not in effective_ignored:
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    async def find_duplicate_phrases(self, language_set_id: int) -> list[dict]:
        """Find duplicate phrases within a language set based on phrase text (case-insensitive).

        Returns a list of duplicate groups, where each group contains phrases with the same text.
        Each group is a dict with 'phrase_text' and 'duplicates' (list of phrase records).
        """
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        # Find phrases with duplicate text (case-insensitive)
        query = select(
            phrases_table.c.id,
            phrases_table.c.categories,
            phrases_table.c.phrase,
            phrases_table.c.translation,
            func.lower(phrases_table.c.phrase).label("phrase_lower"),
        ).where(phrases_table.c.language_set_id == language_set_id)

        all_phrases = await database.fetch_all(query)

        # Group phrases by lowercase text
        phrase_groups = {}
        for phrase in all_phrases:
            phrase_lower = phrase["phrase_lower"]
            if phrase_lower not in phrase_groups:
                phrase_groups[phrase_lower] = []
            phrase_groups[phrase_lower].append(
                {
                    "id": phrase["id"],
                    "categories": phrase["categories"],
                    "phrase": phrase["phrase"],
                    "translation": phrase["translation"],
                }
            )

        # Filter to only groups with duplicates (more than 1 phrase)
        duplicate_groups = []
        for phrase_text, phrases in phrase_groups.items():
            if len(phrases) > 1:
                duplicate_groups.append({"phrase_text": phrase_text, "count": len(phrases), "duplicates": phrases})

        # Sort by count descending, then by phrase text
        duplicate_groups.sort(key=lambda x: (-x["count"], x["phrase_text"]))

        return duplicate_groups

    async def delete_phrases_by_ids(self, phrase_ids: list[int], language_set_id: int) -> int:
        """Delete specific phrases by their IDs.

        This is an alias for batch_delete_phrases for consistency with the API naming.
        """
        return await self.batch_delete_phrases(phrase_ids, language_set_id)

    async def get_phrases_for_admin(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        search_term: Optional[str] = None,
    ) -> list[dict[str, str]]:
        """Get phrases for admin panel - returns all phrases including ignored categories."""
        database = self._ensure_database()

        language_set = await self._resolve_language_set(language_set_id)
        if not language_set:
            return []

        query = select(phrases_table).where(phrases_table.c.language_set_id == language_set["id"])
        if category:
            query = query.where(phrases_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrases_table.c.phrase.ilike(f"%{search_term}%")
                | phrases_table.c.translation.ilike(f"%{search_term}%")
                | phrases_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        query = query.order_by(phrases_table.c.id)
        if limit:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        row_list = []
        for row in result:
            row = dict(row)
            row.pop("language_set_id", None)
            # Only skip phrases shorter than 3 characters - NO category filtering
            if len(str(row["phrase"]).strip()) < 3:
                continue
            row_list.append(row)
        return row_list

    async def get_phrase_count_for_admin(
        self, language_set_id: Optional[int] = None, category: Optional[str] = None, search_term: Optional[str] = None
    ) -> int:
        """Get phrase count for admin panel - counts all phrases including ignored categories."""
        database = self._ensure_database()

        language_set = await self._resolve_language_set(language_set_id)
        if not language_set:
            return 0

        query = select(func.count(phrases_table.c.id)).where(phrases_table.c.language_set_id == language_set["id"])
        if category:
            query = query.where(phrases_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrases_table.c.phrase.ilike(f"%{search_term}%")
                | phrases_table.c.translation.ilike(f"%{search_term}%")
                | phrases_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        # Only filter by minimum phrase length - NO category filtering
        query = query.where(func.length(phrases_table.c.phrase) >= 3)
        result = await database.fetch_one(query)
        return int(result[0]) if result and result[0] is not None else 0

    async def get_all_categories_for_language_set(self, language_set_id: Optional[int] = None) -> list[str]:
        """Get all categories including ignored ones for a language set - used for admin panel."""
        database = self._ensure_database()

        language_set = await self._resolve_language_set(language_set_id)
        if not language_set:
            return []

        query = select(phrases_table.c.categories).where(phrases_table.c.language_set_id == language_set["id"])
        result = await database.fetch_all(query)
        categories_set = set()
        for row in result:
            for cat in row["categories"].split():
                if cat.strip():
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    def fast_bulk_insert_phrases(self, language_set_id: int, phrases_data):
        """Bulk insert phrases for a language set (synchronous, for performance)."""
        if not phrases_data:
            return 0

        engine = self._ensure_engine()

        with engine.connect() as conn:
            result = conn.execute(
                select(language_sets_table).where(language_sets_table.c.id == language_set_id)
            ).fetchone()
            if not result:
                raise ValueError(f"Language set with ID {language_set_id} not found")

            rows = [{**dict(row), "language_set_id": language_set_id} for row in phrases_data]
            result = conn.execute(insert(phrases_table), rows)
            conn.commit()
            return result.rowcount

    async def clear_all_phrases(self, language_set_id: int):
        """Clear all phrases for a specific language set."""
        database = self._ensure_database()

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return

        query = delete(phrases_table).where(phrases_table.c.language_set_id == language_set_id)
        await database.execute(query)
