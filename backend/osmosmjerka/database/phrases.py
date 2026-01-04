"""Phrase management database operations."""

from typing import Optional

from osmosmjerka.database.models import language_sets_table
from sqlalchemy import func
from sqlalchemy.sql import delete, insert, select, update


class PhrasesMixin:
    """Mixin class providing phrase management methods."""

    async def get_phrases(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        ignored_categories_override: Optional[set[str]] = None,
    ) -> list[dict[str, str]]:
        """Get phrases from specified language set using dynamic table."""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        # Get the dynamic phrase table
        phrase_table = self._get_phrase_table(language_set["name"])

        query = select(phrase_table)
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        query = query.order_by(phrase_table.c.id)
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
        """Add a new phrase to a language set using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        # Ensure phrase table exists and get it
        await self._ensure_phrase_table_exists(language_set["name"])
        phrase_table = self._get_phrase_table(language_set["name"])

        query = insert(phrase_table).values(categories=categories, phrase=phrase, translation=translation)
        return await database.execute(query)

    async def update_phrase(self, phrase_id: int, language_set_id: int, categories: str, phrase: str, translation: str):
        """Update an existing phrase using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = (
            update(phrase_table)
            .where(phrase_table.c.id == phrase_id)
            .values(categories=categories, phrase=phrase, translation=translation)
        )
        return await database.execute(query)

    async def get_phrases_by_ids(self, phrase_ids: list[int], language_set_id: int) -> list[dict]:
        """Get specific phrases by their IDs."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table).where(phrase_table.c.id.in_(phrase_ids))
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def update_phrase_categories(self, phrase_id: int, categories: str, language_set_id: int):
        """Update only the categories of a specific phrase."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = update(phrase_table).where(phrase_table.c.id == phrase_id).values(categories=categories)
        return await database.execute(query)

    async def delete_phrase(self, phrase_id: int, language_set_id: int):
        """Delete a phrase using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table).where(phrase_table.c.id == phrase_id)
        return await database.execute(query)

    async def batch_delete_phrases(self, phrase_ids: list[int], language_set_id: int) -> int:
        """Delete multiple phrases using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table).where(phrase_table.c.id.in_(phrase_ids))
        result = await database.execute(query)
        # Return the number of deleted rows or the length of phrase_ids if result is None
        return getattr(result, "rowcount", len(phrase_ids)) if result else len(phrase_ids)

    async def batch_add_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Add a category to multiple phrases using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Get current phrases that need updating
        select_query = select(phrase_table.c.id, phrase_table.c.categories).where(phrase_table.c.id.in_(phrase_ids))
        phrases = await database.fetch_all(select_query)

        affected_count = 0
        for phrase in phrases:
            current_categories = phrase["categories"] or ""
            current_cat_list = [cat.strip() for cat in current_categories.split() if cat.strip()]

            # Only update if category doesn't already exist
            if category not in current_cat_list:
                new_categories = " ".join(current_cat_list + [category])
                update_query = (
                    update(phrase_table).where(phrase_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def batch_remove_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Remove a category from multiple phrases using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Get current phrases that need updating
        select_query = select(phrase_table.c.id, phrase_table.c.categories).where(phrase_table.c.id.in_(phrase_ids))
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
                    update(phrase_table).where(phrase_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def get_categories_for_language_set(
        self, language_set_id: Optional[int] = None, ignored_categories_override: Optional[set[str]] = None
    ) -> list[str]:
        """Get categories for a specific language set using dynamic table."""
        database = self._ensure_database()

        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table.c.categories)
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

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Find phrases with duplicate text (case-insensitive)
        # First, get all phrases with their lowercase phrase text for comparison
        query = select(
            phrase_table.c.id,
            phrase_table.c.categories,
            phrase_table.c.phrase,
            phrase_table.c.translation,
            func.lower(phrase_table.c.phrase).label("phrase_lower"),
        )

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
        """Get phrases for admin panel using dynamic table - returns all phrases including ignored categories."""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table)
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrase_table.c.phrase.ilike(f"%{search_term}%")
                | phrase_table.c.translation.ilike(f"%{search_term}%")
                | phrase_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        query = query.order_by(phrase_table.c.id)
        if limit:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        row_list = []
        for row in result:
            row = dict(row)
            # Only skip phrases shorter than 3 characters - NO category filtering
            if len(str(row["phrase"]).strip()) < 3:
                continue
            row_list.append(row)
        return row_list

    async def get_phrase_count_for_admin(
        self, language_set_id: Optional[int] = None, category: Optional[str] = None, search_term: Optional[str] = None
    ) -> int:
        """Get phrase count for admin panel using dynamic table - counts all phrases including ignored categories."""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return 0
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return 0

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(func.count(phrase_table.c.id))
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrase_table.c.phrase.ilike(f"%{search_term}%")
                | phrase_table.c.translation.ilike(f"%{search_term}%")
                | phrase_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        # Only filter by minimum phrase length - NO category filtering
        query = query.where(func.length(phrase_table.c.phrase) >= 3)
        result = await database.fetch_one(query)
        return int(result[0]) if result and result[0] is not None else 0

    async def get_all_categories_for_language_set(self, language_set_id: Optional[int] = None) -> list[str]:
        """Get all categories including ignored ones for a language set using dynamic table - used for admin panel."""
        database = self._ensure_database()

        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table.c.categories)
        result = await database.fetch_all(query)
        categories_set = set()
        for row in result:
            for cat in row["categories"].split():
                if cat.strip():
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    def fast_bulk_insert_phrases(self, language_set_id: int, phrases_data):
        """Bulk insert phrases for a language set using dynamic table for performance."""
        if not phrases_data:
            return 0

        # Get language set info
        engine = self._ensure_engine()

        # We need to get the language set synchronously for the table name
        # This is a limitation of the bulk insert approach
        with engine.connect() as conn:
            result = conn.execute(
                select(language_sets_table).where(language_sets_table.c.id == language_set_id)
            ).fetchone()
            if not result:
                raise ValueError(f"Language set with ID {language_set_id} not found")

            language_set = dict(result._mapping)
            phrase_table = self._get_phrase_table(language_set["name"])

            result = conn.execute(insert(phrase_table), phrases_data)
            conn.commit()
            return result.rowcount

    async def clear_all_phrases(self, language_set_id: int):
        """Clear all phrases for a specific language set using dynamic table."""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table)
        await database.execute(query)
