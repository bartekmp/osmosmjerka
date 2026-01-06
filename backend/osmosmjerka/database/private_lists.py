"""Private lists management database operations."""

from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    user_private_list_phrases_table,
    user_private_lists_table,
)
from sqlalchemy import and_, desc
from sqlalchemy.sql import delete, func, insert, select, update


class PrivateListsMixin:
    """Mixin class providing private lists management methods."""

    async def get_learn_later_list(
        self, user_id: int, language_set_id: int, create_if_missing: bool = False
    ) -> Optional[Dict]:
        """Get user's Learn This Later list for a language set."""
        database = self._ensure_database()

        query = select(user_private_lists_table).where(
            user_private_lists_table.c.user_id == user_id,
            user_private_lists_table.c.language_set_id == language_set_id,
            user_private_lists_table.c.is_system_list.is_(True),
        )

        result = await database.fetch_one(query)

        if result:
            return dict(result)

        if create_if_missing:
            # Create the list
            return await self.create_learn_later_list(user_id, language_set_id)

        return None

    async def get_or_create_learn_later_list(self, user_id: int, language_set_id: int) -> Dict:
        """Get or create user's Learn This Later list."""
        existing = await self.get_learn_later_list(user_id, language_set_id, create_if_missing=False)

        if existing:
            return existing

        return await self.create_learn_later_list(user_id, language_set_id)

    async def create_learn_later_list(self, user_id: int, language_set_id: int) -> Dict:
        """Create Learn This Later list for user."""
        database = self._ensure_database()

        query = insert(user_private_lists_table).values(
            user_id=user_id,
            language_set_id=language_set_id,
            list_name="Learn This Later",
            description="Automatically created system list for phrases to review later",
            is_system_list=True,
        )

        list_id = await database.execute(query)

        return {
            "id": list_id,
            "user_id": user_id,
            "language_set_id": language_set_id,
            "list_name": "Learn This Later",
            "is_system_list": True,
        }

    async def get_phrase_ids_in_private_list(self, list_id: int, phrase_ids: List[int]) -> List[int]:
        """Check which phrase IDs are already in a private list."""
        database = self._ensure_database()

        query = select(user_private_list_phrases_table.c.phrase_id).where(
            user_private_list_phrases_table.c.list_id == list_id,
            user_private_list_phrases_table.c.phrase_id.in_(phrase_ids),
            user_private_list_phrases_table.c.phrase_id.isnot(None),  # Only public phrases
        )

        result = await database.fetch_all(query)
        return [row["phrase_id"] for row in result]

    async def bulk_add_phrases_to_private_list(
        self, list_id: int, phrase_ids: List[int], language_set_id: int, skip_duplicates: bool = True
    ) -> int:
        """Add multiple phrases to a private list."""
        database = self._ensure_database()

        if skip_duplicates:
            # Get existing phrase IDs in the list
            existing_ids = await self.get_phrase_ids_in_private_list(list_id, phrase_ids)
            # Filter out duplicates
            phrase_ids = [pid for pid in phrase_ids if pid not in existing_ids]

        if not phrase_ids:
            return 0

        # Bulk insert
        values = [
            {
                "list_id": list_id,
                "phrase_id": phrase_id,
                "language_set_id": language_set_id,
                "custom_phrase": None,
                "custom_translation": None,
                "custom_categories": None,
            }
            for phrase_id in phrase_ids
        ]

        query = insert(user_private_list_phrases_table).values(values)
        await database.execute(query)

        return len(phrase_ids)

    async def get_user_private_lists(
        self,
        user_id: int,
        language_set_id: Optional[int] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Get paginated private lists for a user, optionally filtered by language set.

        Returns:
            Dict with keys: 'lists', 'total', 'limit', 'offset', 'has_more'
        """
        database = self._ensure_database()

        # Base query
        base_query = select(user_private_lists_table).where(user_private_lists_table.c.user_id == user_id)

        if language_set_id is not None:
            base_query = base_query.where(user_private_lists_table.c.language_set_id == language_set_id)

        # Get total count
        count_query = select(func.count()).select_from(base_query.alias())
        total = await database.fetch_val(count_query)

        # Get paginated results
        query = base_query.order_by(
            desc(user_private_lists_table.c.is_system_list), user_private_lists_table.c.created_at
        )

        if limit is not None:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        lists = [dict(row) for row in result]

        return {
            "lists": lists,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": limit is not None and (offset + len(lists) < total) if limit else False,
        }

    async def get_private_list_by_id(self, list_id: int, user_id: int) -> Optional[Dict]:
        """Get a specific private list by ID (with user ownership check)."""
        database = self._ensure_database()

        query = select(user_private_lists_table).where(
            user_private_lists_table.c.id == list_id, user_private_lists_table.c.user_id == user_id
        )

        result = await database.fetch_one(query)
        return dict(result) if result else None

    async def delete_private_list(self, list_id: int, user_id: int) -> bool:
        """Delete a private list (only if not a system list and user owns it)."""
        database = self._ensure_database()

        # First check if it's a system list
        list_info = await self.get_private_list_by_id(list_id, user_id)
        if not list_info or list_info.get("is_system_list"):
            return False

        # Delete all phrases in the list first
        delete_phrases_query = delete(user_private_list_phrases_table).where(
            user_private_list_phrases_table.c.list_id == list_id
        )
        await database.execute(delete_phrases_query)

        # Delete the list
        delete_list_query = delete(user_private_lists_table).where(
            user_private_lists_table.c.id == list_id, user_private_lists_table.c.user_id == user_id
        )
        await database.execute(delete_list_query)

        return True

    async def get_private_list_phrase_count(self, list_id: int) -> int:
        """Get the number of phrases in a private list."""
        database = self._ensure_database()

        query = select(func.count(user_private_list_phrases_table.c.id)).where(
            user_private_list_phrases_table.c.list_id == list_id
        )

        result = await database.fetch_one(query)
        return result[0] if result else 0

    async def get_phrase_counts_batch(self, list_ids: List[int]) -> Dict[int, int]:
        """Get phrase counts for multiple lists in a single query (fixes N+1 problem).

        Args:
            list_ids: List of list IDs to get counts for

        Returns:
            Dict mapping list_id to phrase count
        """
        if not list_ids:
            return {}

        database = self._ensure_database()

        query = (
            select(
                user_private_list_phrases_table.c.list_id,
                func.count(user_private_list_phrases_table.c.id).label("count"),
            )
            .where(user_private_list_phrases_table.c.list_id.in_(list_ids))
            .group_by(user_private_list_phrases_table.c.list_id)
        )

        result = await database.fetch_all(query)
        return {row["list_id"]: row["count"] for row in result}

    async def get_private_list_entries(
        self,
        list_id: int,
        user_id: int,
        list_info: Optional[Dict] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Return paginated entries from a private list with metadata for management interfaces.

        Returns:
            Dict with keys: 'entries', 'total', 'limit', 'offset', 'has_more'
        """
        database = self._ensure_database()

        if list_info is None:
            list_info = await self.get_private_list_by_id(list_id, user_id)
        if not list_info:
            return {"entries": [], "total": 0, "limit": limit, "offset": offset, "has_more": False}

        language_set = await self.get_language_set_by_id(list_info["language_set_id"])
        if not language_set:
            return {"entries": [], "total": 0, "limit": limit, "offset": offset, "has_more": False}

        phrase_table = self._get_phrase_table(language_set["name"])

        # Base query for counting
        base_query = (
            select(user_private_list_phrases_table.c.id)
            .where(user_private_list_phrases_table.c.list_id == list_id)
            .select_from(
                user_private_list_phrases_table.outerjoin(
                    phrase_table, user_private_list_phrases_table.c.phrase_id == phrase_table.c.id
                )
            )
        )

        # Get total count
        count_query = select(func.count()).select_from(base_query.alias())
        total = await database.fetch_val(count_query)

        # Get paginated results
        query = (
            select(
                user_private_list_phrases_table.c.id.label("entry_id"),
                user_private_list_phrases_table.c.phrase_id,
                user_private_list_phrases_table.c.custom_phrase,
                user_private_list_phrases_table.c.custom_translation,
                user_private_list_phrases_table.c.custom_categories,
                user_private_list_phrases_table.c.added_at,
                phrase_table.c.id.label("public_id"),
                phrase_table.c.phrase.label("public_phrase"),
                phrase_table.c.translation.label("public_translation"),
                phrase_table.c.categories.label("public_categories"),
            )
            .select_from(
                user_private_list_phrases_table.outerjoin(
                    phrase_table, user_private_list_phrases_table.c.phrase_id == phrase_table.c.id
                )
            )
            .where(user_private_list_phrases_table.c.list_id == list_id)
            .order_by(user_private_list_phrases_table.c.added_at.desc(), user_private_list_phrases_table.c.id.desc())
        )

        if limit is not None:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        entries: List[Dict] = []

        for row in result:
            row_dict = dict(row)
            is_custom = row_dict["phrase_id"] is None
            phrase_text = row_dict["custom_phrase"] if is_custom else row_dict["public_phrase"]
            translation = row_dict["custom_translation"] if is_custom else row_dict["public_translation"]
            categories = (row_dict["custom_categories"] if is_custom else row_dict["public_categories"]) or ""

            if not phrase_text:
                continue

            entries.append(
                {
                    "entry_id": row_dict["entry_id"],
                    "phrase_id": row_dict["phrase_id"] if row_dict["phrase_id"] is not None else row_dict["public_id"],
                    "phrase": phrase_text,
                    "translation": translation or "",
                    "categories": categories,
                    "is_custom": is_custom,
                    "source": "custom" if is_custom else "public",
                    "added_at": row_dict["added_at"].isoformat() if row_dict["added_at"] else None,
                }
            )

        return {
            "entries": entries,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": limit is not None and (offset + len(entries) < total) if limit else False,
        }

    async def get_private_list_phrases(
        self, list_id: int, user_id: int, language_set_id: int, category: Optional[str] = None
    ) -> List[Dict]:
        """Get all phrases from a private list for puzzle generation, with optional category filter."""
        list_info = await self.get_private_list_by_id(list_id, user_id)
        if not list_info or list_info["language_set_id"] != language_set_id:
            return []

        # get_private_list_entries returns a dict with "entries" key, not a list directly
        entries_result = await self.get_private_list_entries(list_id, user_id, list_info=list_info, limit=None)
        entries = entries_result.get("entries", [])
        phrases: List[Dict] = []

        for entry in entries:
            phrase_text = entry["phrase"] or ""
            if len(phrase_text.strip()) < 3:
                continue

            if category:
                phrase_categories = set(entry["categories"].split()) if entry["categories"] else set()
                if category not in phrase_categories:
                    continue

            phrases.append(
                {
                    "id": entry["phrase_id"],
                    "phrase": entry["phrase"],
                    "translation": entry["translation"],
                    "categories": entry["categories"],
                }
            )

        return phrases

    async def get_private_list_categories(self, list_id: int, user_id: int, language_set_id: int) -> List[str]:
        """Get all unique categories from phrases in a private list."""
        list_info = await self.get_private_list_by_id(list_id, user_id)
        if not list_info or list_info["language_set_id"] != language_set_id:
            return []

        # get_private_list_entries returns a dict with "entries" key, not a list directly
        entries_result = await self.get_private_list_entries(list_id, user_id, list_info=list_info, limit=None)
        entries = entries_result.get("entries", [])

        categories_set = set()
        for entry in entries:
            if entry.get("categories"):
                # Categories are space-separated
                entry_categories = entry["categories"].split()
                categories_set.update(entry_categories)

        return sorted(list(categories_set))

    async def get_user_list_limit(self, user_id: int) -> int:
        """Get the list limit for a user (admins get higher limits)."""
        database = self._ensure_database()

        # Check if user is admin
        user_query = select(accounts_table.c.role).where(accounts_table.c.id == user_id)
        user_role = await database.fetch_val(user_query)

        # Get limit from global settings
        limit_setting = await self.get_global_setting("user_private_list_limit", "50")
        admin_limit_setting = await self.get_global_setting("admin_private_list_limit", "500")

        default_limit = int(limit_setting) if limit_setting else 50
        admin_limit = int(admin_limit_setting) if admin_limit_setting else 500

        if user_role in ("root_admin", "administrative"):
            return admin_limit
        return default_limit

    async def get_user_current_list_count(self, user_id: int, language_set_id: Optional[int] = None) -> int:
        """Get current number of lists for a user."""
        result = await self.get_user_private_lists(user_id, language_set_id, limit=None, offset=0)
        return result["total"]

    async def create_private_list(
        self, user_id: int, list_name: str, language_set_id: int, is_system_list: bool = False
    ) -> int:
        """Create a new private list for a user.

        Raises:
            ValueError: If list limit is reached or duplicate name exists
        """
        database = self._ensure_database()

        # Check list limit (skip for system lists)
        if not is_system_list:
            list_limit = await self.get_user_list_limit(user_id)
            current_count = await self.get_user_current_list_count(user_id, language_set_id)

            if current_count >= list_limit:
                raise ValueError(f"List limit reached ({list_limit} lists). " f"Current count: {current_count}")

        # Check for duplicate name
        check_query = select(user_private_lists_table.c.id).where(
            and_(
                user_private_lists_table.c.user_id == user_id,
                user_private_lists_table.c.language_set_id == language_set_id,
                user_private_lists_table.c.list_name == list_name,
            )
        )
        existing = await database.fetch_one(check_query)
        if existing:
            raise ValueError(f"List with name '{list_name}' already exists in this language set")

        query = insert(user_private_lists_table).values(
            user_id=user_id,
            language_set_id=language_set_id,
            list_name=list_name,
            is_system_list=is_system_list,
        )

        list_id = await database.execute(query)
        return list_id

    async def update_private_list_name(self, list_id: int, new_name: str) -> bool:
        """Update the name of a private list."""
        database = self._ensure_database()

        query = (
            update(user_private_lists_table).where(user_private_lists_table.c.id == list_id).values(list_name=new_name)
        )

        await database.execute(query)
        return True

    async def get_phrase_limit_per_list(self) -> int:
        """Get the maximum phrases allowed per list."""
        limit_setting = await self.get_global_setting("max_phrases_per_list", "10000")
        return int(limit_setting) if limit_setting else 10000

    async def add_phrase_to_private_list(
        self,
        list_id: int,
        phrase_id: Optional[int] = None,
        custom_phrase: Optional[str] = None,
        custom_translation: Optional[str] = None,
        custom_categories: Optional[str] = None,
    ) -> int:
        """Add a single phrase to a private list (either public phrase or custom phrase).

        Raises:
            ValueError: If phrase limit reached or duplicate phrase
        """
        database = self._ensure_database()

        # Check phrase limit
        phrase_limit = await self.get_phrase_limit_per_list()
        current_count = await self.get_private_list_phrase_count(list_id)

        if current_count >= phrase_limit:
            raise ValueError(f"List is full ({phrase_limit} phrases). " f"Current count: {current_count}")

        # Get the list to retrieve language_set_id
        list_query = select(user_private_lists_table.c.language_set_id).where(user_private_lists_table.c.id == list_id)
        list_result = await database.fetch_one(list_query)
        if not list_result:
            raise ValueError(f"List {list_id} not found")

        language_set_id = list_result[0]

        # Check for duplicates
        if phrase_id:
            # Check if this public phrase is already in the list
            check_query = select(user_private_list_phrases_table).where(
                and_(
                    user_private_list_phrases_table.c.list_id == list_id,
                    user_private_list_phrases_table.c.phrase_id == phrase_id,
                )
            )
            existing = await database.fetch_one(check_query)
            if existing:
                raise ValueError(f"Phrase {phrase_id} is already in this list")

        # Insert the phrase
        query = insert(user_private_list_phrases_table).values(
            list_id=list_id,
            language_set_id=language_set_id,
            phrase_id=phrase_id,
            custom_phrase=custom_phrase,
            custom_translation=custom_translation,
            custom_categories=custom_categories,
        )

        entry_id = await database.execute(query)
        return entry_id

    async def remove_phrase_from_private_list(self, list_id: int, phrase_entry_id: int) -> bool:
        """Remove a phrase entry from a private list.

        Note: This only removes the association between the phrase and the list.
        It does NOT delete the phrase itself from the database.
        """
        database = self._ensure_database()

        query = delete(user_private_list_phrases_table).where(
            and_(
                user_private_list_phrases_table.c.id == phrase_entry_id,
                user_private_list_phrases_table.c.list_id == list_id,
            )
        )

        _ = await database.execute(query)

        # The databases library may return different types. Let's verify deletion by checking if entry still exists
        # This is more reliable than trying to parse rowcount which may not be available
        check_query = select(user_private_list_phrases_table).where(
            and_(
                user_private_list_phrases_table.c.id == phrase_entry_id,
                user_private_list_phrases_table.c.list_id == list_id,
            )
        )
        check_result = await database.fetch_one(check_query)
        # If entry is gone, deletion succeeded
        return check_result is None
