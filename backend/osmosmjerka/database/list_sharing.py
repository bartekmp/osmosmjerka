"""List sharing and list statistics database operations."""

from typing import Optional

from sqlalchemy import Integer, and_, desc, func
from sqlalchemy.sql import delete, insert, select, update

from osmosmjerka.database.models import (
    accounts_table,
    user_list_shares_table,
    user_private_list_phrases_table,
    user_private_lists_table,
)


class ListSharingMixin:
    """Mixin class providing list sharing and list statistics methods."""

    async def share_list(
        self, list_id: int, owner_user_id: int, shared_with_user_id: int, permission: str = "read"
    ) -> int:
        """Share a list with another user."""
        database = self._ensure_database()

        # Check if already shared
        check_query = select(user_list_shares_table).where(
            and_(
                user_list_shares_table.c.list_id == list_id,
                user_list_shares_table.c.shared_with_user_id == shared_with_user_id,
            )
        )
        existing = await database.fetch_one(check_query)

        if existing:
            # Update permission if already shared
            update_query = (
                update(user_list_shares_table)
                .where(user_list_shares_table.c.id == existing["id"])
                .values(permission=permission)
            )
            await database.execute(update_query)
            return existing["id"]

        # Insert new share
        query = insert(user_list_shares_table).values(
            list_id=list_id,
            owner_user_id=owner_user_id,
            shared_with_user_id=shared_with_user_id,
            permission=permission,
        )

        share_id = await database.execute(query)
        return share_id

    async def unshare_list(self, list_id: int, shared_with_user_id: int) -> bool:
        """Remove sharing access for a user."""
        database = self._ensure_database()

        query = delete(user_list_shares_table).where(
            and_(
                user_list_shares_table.c.list_id == list_id,
                user_list_shares_table.c.shared_with_user_id == shared_with_user_id,
            )
        )

        result = await database.execute(query)
        return result > 0

    async def get_list_shares(self, list_id: int, owner_user_id: int) -> list:
        """Get all shares for a specific list."""
        database = self._ensure_database()

        query = (
            select(
                user_list_shares_table.c.id,
                user_list_shares_table.c.shared_with_user_id,
                user_list_shares_table.c.permission,
                user_list_shares_table.c.shared_at,
                accounts_table.c.username,
            )
            .select_from(
                user_list_shares_table.join(
                    accounts_table, user_list_shares_table.c.shared_with_user_id == accounts_table.c.id
                )
            )
            .where(
                and_(
                    user_list_shares_table.c.list_id == list_id,
                    user_list_shares_table.c.owner_user_id == owner_user_id,
                )
            )
        )

        rows = await database.fetch_all(query)
        return [dict(row) for row in rows]

    async def get_shared_with_me_lists(self, user_id: int, language_set_id: Optional[int] = None) -> list:
        """Get all lists shared with the current user."""
        database = self._ensure_database()

        conditions = [user_list_shares_table.c.shared_with_user_id == user_id]
        if language_set_id:
            conditions.append(user_private_lists_table.c.language_set_id == language_set_id)

        query = (
            select(
                user_private_lists_table.c.id,
                user_private_lists_table.c.list_name,
                user_private_lists_table.c.language_set_id,
                user_private_lists_table.c.is_system_list,
                user_list_shares_table.c.permission,
                user_list_shares_table.c.owner_user_id,
                accounts_table.c.username.label("owner_username"),
                func.count(user_private_list_phrases_table.c.id).label("phrase_count"),
            )
            .select_from(
                user_list_shares_table.join(
                    user_private_lists_table,
                    user_list_shares_table.c.list_id == user_private_lists_table.c.id,
                )
                .join(accounts_table, user_list_shares_table.c.owner_user_id == accounts_table.c.id)
                .outerjoin(
                    user_private_list_phrases_table,
                    user_private_lists_table.c.id == user_private_list_phrases_table.c.list_id,
                )
            )
            .where(and_(*conditions))
            .group_by(
                user_private_lists_table.c.id,
                user_list_shares_table.c.permission,
                user_list_shares_table.c.owner_user_id,
                accounts_table.c.username,
            )
        )

        rows = await database.fetch_all(query)
        return [dict(row) for row in rows]

    async def check_list_access(self, list_id: int, user_id: int) -> Optional[dict]:
        """Check if user has access to a list (owner or shared).

        Returns dict with 'access_type' ('owner' or 'shared') and 'permission' ('read' or 'write')
        """
        database = self._ensure_database()

        # Check if owner
        owner_query = select(user_private_lists_table).where(
            and_(user_private_lists_table.c.id == list_id, user_private_lists_table.c.user_id == user_id)
        )
        owner_row = await database.fetch_one(owner_query)
        if owner_row:
            return {"access_type": "owner", "permission": "write"}

        # Check if shared
        share_query = select(user_list_shares_table).where(
            and_(
                user_list_shares_table.c.list_id == list_id,
                user_list_shares_table.c.shared_with_user_id == user_id,
            )
        )
        share_row = await database.fetch_one(share_query)
        if share_row:
            return {"access_type": "shared", "permission": share_row["permission"]}

        return None

    async def get_list_statistics(self, list_id: int, user_id: int) -> Optional[dict]:
        """Get usage statistics for a specific list."""
        database = self._ensure_database()

        # Get list info
        list_query = select(user_private_lists_table).where(
            and_(user_private_lists_table.c.id == list_id, user_private_lists_table.c.user_id == user_id)
        )
        list_info = await database.fetch_one(list_query)
        if not list_info:
            return None

        # Get phrase count and breakdown
        phrases_query = select(
            func.count(user_private_list_phrases_table.c.id).label("total_phrases"),
            func.sum(func.cast((user_private_list_phrases_table.c.phrase_id.is_(None)), Integer)).label(
                "custom_phrases"
            ),
            func.sum(func.cast((user_private_list_phrases_table.c.phrase_id.isnot(None)), Integer)).label(
                "public_phrases"
            ),
        ).where(user_private_list_phrases_table.c.list_id == list_id)
        phrase_stats = await database.fetch_one(phrases_query)

        total_phrases = phrase_stats["total_phrases"] if phrase_stats else 0
        custom_phrases = phrase_stats["custom_phrases"] if phrase_stats else 0
        public_phrases = phrase_stats["public_phrases"] if phrase_stats else 0

        return {
            "list_id": list_id,
            "list_name": list_info["list_name"],
            "created_at": list_info["created_at"].isoformat() if list_info["created_at"] else None,
            "updated_at": list_info["updated_at"].isoformat() if list_info["updated_at"] else None,
            "total_phrases": total_phrases or 0,
            "custom_phrases": custom_phrases or 0,
            "public_phrases": public_phrases or 0,
            "is_system_list": list_info["is_system_list"],
        }

    async def get_user_list_statistics(self, user_id: int) -> dict:
        """Get aggregate statistics for all user lists."""
        database = self._ensure_database()

        # Get total lists count
        lists_count_query = select(func.count(user_private_lists_table.c.id)).where(
            user_private_lists_table.c.user_id == user_id
        )
        total_lists = await database.fetch_val(lists_count_query)

        # Get total phrases across all lists
        phrases_count_query = (
            select(func.count(user_private_list_phrases_table.c.id))
            .select_from(
                user_private_list_phrases_table.join(
                    user_private_lists_table,
                    user_private_list_phrases_table.c.list_id == user_private_lists_table.c.id,
                )
            )
            .where(user_private_lists_table.c.user_id == user_id)
        )
        total_phrases = await database.fetch_val(phrases_count_query)

        # Get most used lists (by phrase count)
        most_used_query = (
            select(
                user_private_lists_table.c.id,
                user_private_lists_table.c.list_name,
                func.count(user_private_list_phrases_table.c.id).label("phrase_count"),
            )
            .select_from(
                user_private_lists_table.outerjoin(
                    user_private_list_phrases_table,
                    user_private_lists_table.c.id == user_private_list_phrases_table.c.list_id,
                )
            )
            .where(user_private_lists_table.c.user_id == user_id)
            .group_by(user_private_lists_table.c.id, user_private_lists_table.c.list_name)
            .order_by(desc(func.count(user_private_list_phrases_table.c.id)))
            .limit(5)
        )
        most_used = await database.fetch_all(most_used_query)

        return {
            "total_lists": total_lists or 0,
            "total_phrases": total_phrases or 0,
            "most_used_lists": [dict(row) for row in most_used],
        }
