"""Teacher phrase sets database operations."""

import json
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    teacher_phrase_set_access_table,
    teacher_phrase_set_groups_table,
    teacher_phrase_set_phrases_table,
    teacher_phrase_set_sessions_table,
    teacher_phrase_sets_table,
)
from osmosmjerka.logging_config import get_logger
from sqlalchemy import Integer, and_, desc
from sqlalchemy.sql import delete, func, insert, select, update

logger = get_logger(__name__)

# Default configuration for teacher phrase sets
DEFAULT_CONFIG = {
    "allow_hints": True,
    "show_translations": True,
    "require_translation_input": False,
    "show_timer": False,
    "strict_grid_size": False,
    "grid_size": 10,
    "time_limit_minutes": None,
    "difficulty": "medium",
}


def generate_hotlink_token() -> str:
    """Generate a URL-safe 8-character token."""
    return secrets.token_urlsafe(6)[:8]


class TeacherSetsMixin:
    """Mixin class providing teacher phrase set management methods."""

    # =========================================================================
    # Phrase Set CRUD
    # =========================================================================

    async def create_teacher_phrase_set(
        self,
        name: str,
        language_set_id: int,
        created_by: int,
        phrase_ids: List[int],
        description: Optional[str] = None,
        config: Optional[Dict] = None,
        access_type: str = "public",
        max_plays: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        auto_delete_days: Optional[int] = 14,
        access_user_ids: Optional[List[int]] = None,
        access_group_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Create a new teacher phrase set with phrases and access control.

        Args:
            name: Set name
            language_set_id: ID of the language set
            created_by: User ID of the creator
            phrase_ids: List of phrase IDs to include (1-50)
            description: Optional description
            config: Game configuration options
            access_type: "public" or "private"
            max_plays: Max number of plays (None = unlimited)
            expires_at: Optional expiration date
            auto_delete_days: Days until auto-delete (None = never)
            auto_delete_days: Days until auto-delete (None = never)
            access_user_ids: User IDs for private access
            access_group_ids: Group IDs for private access

        Returns:
            Created phrase set with hotlink token

        Raises:
            ValueError: If validation fails
        """
        database = self._ensure_database()

        # Validate phrase count
        if not phrase_ids:
            raise ValueError("At least one phrase is required")
        if len(phrase_ids) > 50:
            raise ValueError("Maximum 50 phrases allowed per set")

        # Generate unique hotlink token
        hotlink_token = generate_hotlink_token()

        # Merge config with defaults
        final_config = {**DEFAULT_CONFIG, **(config or {})}

        # Calculate auto_delete_at
        auto_delete_at = None
        if auto_delete_days is not None:
            auto_delete_at = datetime.utcnow() + timedelta(days=auto_delete_days)

        # Insert the phrase set
        query = insert(teacher_phrase_sets_table).values(
            name=name,
            description=description,
            language_set_id=language_set_id,
            created_by=created_by,
            config=final_config,
            current_hotlink_token=hotlink_token,
            hotlink_version=1,
            access_type=access_type,
            max_plays=max_plays,
            is_active=True,
            expires_at=expires_at,
            auto_delete_at=auto_delete_at,
        )

        phrase_set_id = await database.execute(query)

        # Insert phrases
        phrase_values = [
            {
                "phrase_set_id": phrase_set_id,
                "phrase_id": pid,
                "language_set_id": language_set_id,
                "position": idx,
            }
            for idx, pid in enumerate(phrase_ids)
        ]
        await database.execute_many(insert(teacher_phrase_set_phrases_table), phrase_values)

        # Insert access records for private sets
        if access_type == "private" and access_user_ids:
            access_values = [
                {
                    "phrase_set_id": phrase_set_id,
                    "user_id": uid,
                    "granted_by": created_by,
                }
                for uid in access_user_ids
            ]
            await database.execute_many(insert(teacher_phrase_set_access_table), access_values)

        # Insert group access records
        if access_type == "private" and access_group_ids:
            group_values = [
                {
                    "phrase_set_id": phrase_set_id,
                    "group_id": gid,
                }
                for gid in access_group_ids
            ]
            await database.execute_many(insert(teacher_phrase_set_groups_table), group_values)

        logger.info(
            "Created teacher phrase set",
            extra={
                "phrase_set_id": phrase_set_id,
                "set_name": name,
                "phrase_count": len(phrase_ids),
                "created_by": created_by,
            },
        )

        return {
            "id": phrase_set_id,
            "name": name,
            "description": description,
            "language_set_id": language_set_id,
            "created_by": created_by,
            "config": final_config,
            "current_hotlink_token": hotlink_token,
            "hotlink_version": 1,
            "access_type": access_type,
            "max_plays": max_plays,
            "is_active": True,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "auto_delete_at": auto_delete_at.isoformat() if auto_delete_at else None,
            "phrase_count": len(phrase_ids),
        }

    async def get_teacher_phrase_sets(
        self,
        user_id: int,
        is_admin: bool = False,
        limit: int = 20,
        offset: int = 0,
        active_only: bool = True,
    ) -> Dict[str, Any]:
        """Get paginated list of teacher phrase sets.

        Args:
            user_id: User ID (for ownership filter)
            is_admin: If True, return all sets regardless of ownership
            limit: Maximum number of results
            offset: Pagination offset
            active_only: Filter for active sets only

        Returns:
            Dict with 'sets', 'total', 'limit', 'offset', 'has_more'
        """
        database = self._ensure_database()

        # Base query
        base_conditions = []
        if not is_admin:
            base_conditions.append(teacher_phrase_sets_table.c.created_by == user_id)
        if active_only:
            base_conditions.append(teacher_phrase_sets_table.c.is_active.is_(True))

        # Count query
        count_query = select(func.count(teacher_phrase_sets_table.c.id))
        if base_conditions:
            count_query = count_query.where(and_(*base_conditions))
        total = await database.fetch_val(count_query)

        # Main query with language set join
        query = (
            select(
                teacher_phrase_sets_table,
            )
            .order_by(desc(teacher_phrase_sets_table.c.created_at))
            .limit(limit)
            .offset(offset)
        )
        if base_conditions:
            query = query.where(and_(*base_conditions))

        result = await database.fetch_all(query)
        sets = []
        for row in result:
            row_dict = dict(row)
            # config is JSONB (returned as dict); tolerate legacy string rows.
            if isinstance(row_dict.get("config"), str):
                try:
                    row_dict["config"] = json.loads(row_dict["config"])
                except json.JSONDecodeError:
                    row_dict["config"] = DEFAULT_CONFIG.copy()
            sets.append(self._serialize_datetimes(row_dict))

        # Get phrase counts and session counts for all sets
        set_ids = [s["id"] for s in sets]
        if set_ids:
            phrase_counts = await self._get_phrase_set_counts(set_ids)
            session_counts = await self._get_session_counts(set_ids)
            for s in sets:
                s["phrase_count"] = phrase_counts.get(s["id"], 0)
                s["session_count"] = session_counts.get(s["id"], {}).get("total", 0)
                s["completed_count"] = session_counts.get(s["id"], {}).get("completed", 0)

        return {
            "sets": sets,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(sets) < total,
        }

    async def _get_phrase_set_counts(self, set_ids: List[int]) -> Dict[int, int]:
        """Get phrase counts for multiple sets."""
        if not set_ids:
            return {}
        database = self._ensure_database()

        query = (
            select(
                teacher_phrase_set_phrases_table.c.phrase_set_id,
                func.count(teacher_phrase_set_phrases_table.c.id).label("count"),
            )
            .where(teacher_phrase_set_phrases_table.c.phrase_set_id.in_(set_ids))
            .group_by(teacher_phrase_set_phrases_table.c.phrase_set_id)
        )

        result = await database.fetch_all(query)
        return {row["phrase_set_id"]: row["count"] for row in result}

    async def _get_session_counts(self, set_ids: List[int]) -> Dict[int, Dict[str, int]]:
        """Get session counts (total and completed) for multiple sets."""
        if not set_ids:
            return {}
        database = self._ensure_database()

        query = (
            select(
                teacher_phrase_set_sessions_table.c.phrase_set_id,
                func.count(teacher_phrase_set_sessions_table.c.id).label("total"),
                func.sum(func.cast(teacher_phrase_set_sessions_table.c.is_completed, type_=Integer)).label("completed"),
            )
            .where(teacher_phrase_set_sessions_table.c.phrase_set_id.in_(set_ids))
            .group_by(teacher_phrase_set_sessions_table.c.phrase_set_id)
        )

        result = await database.fetch_all(query)
        return {
            row["phrase_set_id"]: {
                "total": row["total"],
                "completed": row["completed"] or 0,
            }
            for row in result
        }

    async def get_teacher_phrase_set_by_id(
        self, set_id: int, user_id: Optional[int] = None, is_admin: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Get a phrase set by ID with ownership check.

        Args:
            set_id: Phrase set ID
            user_id: User ID for ownership check (None skips check)
            is_admin: If True, skip ownership check

        Returns:
            Phrase set dict or None if not found/unauthorized
        """
        database = self._ensure_database()

        query = select(teacher_phrase_sets_table).where(teacher_phrase_sets_table.c.id == set_id)
        if not is_admin and user_id is not None:
            query = query.where(teacher_phrase_sets_table.c.created_by == user_id)

        result = await database.fetch_one(query)
        if not result:
            return None

        row_dict = dict(result)
        if isinstance(row_dict.get("config"), str):
            try:
                row_dict["config"] = json.loads(row_dict["config"])
            except json.JSONDecodeError:
                row_dict["config"] = DEFAULT_CONFIG.copy()

        # Get phrase count
        phrase_counts = await self._get_phrase_set_counts([set_id])
        row_dict["phrase_count"] = phrase_counts.get(set_id, 0)

        # Get session counts
        session_counts = await self._get_session_counts([set_id])
        row_dict["session_count"] = session_counts.get(set_id, {}).get("total", 0)
        row_dict["completed_count"] = session_counts.get(set_id, {}).get("completed", 0)

        # Get access data for private sets
        if row_dict.get("access_type") == "private":
            # Users
            # Users
            users_query = (
                select(teacher_phrase_set_access_table.c.user_id, accounts_table.c.username)
                .select_from(
                    teacher_phrase_set_access_table.join(
                        accounts_table,
                        teacher_phrase_set_access_table.c.user_id == accounts_table.c.id,
                    )
                )
                .where(teacher_phrase_set_access_table.c.phrase_set_id == set_id)
            )
            users_result = await database.fetch_all(users_query)
            row_dict["access_user_ids"] = [r["user_id"] for r in users_result]
            row_dict["access_usernames"] = [r["username"] for r in users_result]

            # Groups
            groups_query = select(teacher_phrase_set_groups_table.c.group_id).where(
                teacher_phrase_set_groups_table.c.phrase_set_id == set_id
            )
            groups_result = await database.fetch_all(groups_query)
            row_dict["access_group_ids"] = [r["group_id"] for r in groups_result]

        return self._serialize_datetimes(row_dict)

    async def update_teacher_phrase_set(
        self,
        set_id: int,
        user_id: int,
        is_admin: bool = False,
        **kwargs,
    ) -> Optional[Dict[str, Any]]:
        """Update a teacher phrase set.

        Only allows updating fields that don't affect existing sessions:
        name, description, access_type, max_plays, expires_at, auto_delete_at, is_active

        For config/phrases updates, check if sessions exist first.
        """
        database = self._ensure_database()

        # Check ownership
        existing = await self.get_teacher_phrase_set_by_id(set_id, user_id, is_admin)
        if not existing:
            return None

        # Fields that can always be updated
        always_updatable = {
            "name",
            "description",
            "access_type",
            "max_plays",
            "expires_at",
            "auto_delete_at",
            "is_active",
        }

        # Fields that require no sessions
        session_locked = {"config", "language_set_id"}

        update_values = {}
        for key, value in kwargs.items():
            if key in always_updatable:
                update_values[key] = value
            elif key in session_locked:
                # Check if sessions exist
                if existing.get("session_count", 0) > 0:
                    raise ValueError(f"Cannot update {key}: set has existing sessions")  # noqa: S608
                update_values[key] = value

        if update_values:
            update_values["updated_at"] = datetime.utcnow()

            query = (
                update(teacher_phrase_sets_table)
                .where(teacher_phrase_sets_table.c.id == set_id)
                .values(**update_values)
            )
            await database.execute(query)

            logger.info(
                "Updated teacher phrase set",
                extra={
                    "phrase_set_id": set_id,
                    "updated_fields": list(update_values.keys()),
                },
            )

        # Handle access list updates
        if "access_user_ids" in kwargs:
            # Clear existing
            await database.execute(
                delete(teacher_phrase_set_access_table).where(teacher_phrase_set_access_table.c.phrase_set_id == set_id)
            )
            if kwargs["access_user_ids"]:
                values = [
                    {
                        "phrase_set_id": set_id,
                        "user_id": uid,
                        "granted_by": user_id,
                    }
                    for uid in kwargs["access_user_ids"]
                ]
                await database.execute_many(insert(teacher_phrase_set_access_table), values)

        if "access_group_ids" in kwargs:
            # Clear existing
            await database.execute(
                delete(teacher_phrase_set_groups_table).where(teacher_phrase_set_groups_table.c.phrase_set_id == set_id)
            )
            if kwargs["access_group_ids"]:
                values = [
                    {
                        "phrase_set_id": set_id,
                        "group_id": gid,
                    }
                    for gid in kwargs["access_group_ids"]
                ]
                await database.execute_many(insert(teacher_phrase_set_groups_table), values)

        return await self.get_teacher_phrase_set_by_id(set_id, user_id, is_admin)

    async def delete_teacher_phrase_set(self, set_id: int, user_id: int, is_admin: bool = False) -> bool:
        """Delete a teacher phrase set and all related data."""
        database = self._ensure_database()

        # Check ownership
        existing = await self.get_teacher_phrase_set_by_id(set_id, user_id, is_admin)
        if not existing:
            return False

        # CASCADE will handle related tables
        query = delete(teacher_phrase_sets_table).where(teacher_phrase_sets_table.c.id == set_id)
        await database.execute(query)

        logger.info(
            "Deleted teacher phrase set",
            extra={"phrase_set_id": set_id, "deleted_by": user_id},
        )

        return True

    async def regenerate_hotlink(self, set_id: int, user_id: int, is_admin: bool = False) -> Optional[Dict[str, str]]:
        """Regenerate the hotlink token and increment version."""
        database = self._ensure_database()

        # Check ownership
        existing = await self.get_teacher_phrase_set_by_id(set_id, user_id, is_admin)
        if not existing:
            return None

        new_token = generate_hotlink_token()
        new_version = existing["hotlink_version"] + 1

        query = (
            update(teacher_phrase_sets_table)
            .where(teacher_phrase_sets_table.c.id == set_id)
            .values(
                current_hotlink_token=new_token,
                hotlink_version=new_version,
                updated_at=datetime.utcnow(),
            )
        )
        await database.execute(query)

        logger.info(
            "Regenerated hotlink",
            extra={"phrase_set_id": set_id, "new_version": new_version},
        )

        return {
            "token": new_token,
            "version": new_version,
        }

    async def extend_auto_delete(
        self, set_id: int, user_id: int, days: int, is_admin: bool = False
    ) -> Optional[datetime]:
        """Extend the auto_delete_at date by specified days."""
        database = self._ensure_database()

        # Check ownership
        existing = await self.get_teacher_phrase_set_by_id(set_id, user_id, is_admin)
        if not existing:
            return None

        if existing.get("auto_delete_at") is None:
            # Already set to never delete
            return None

        # Parse existing date if string
        current_date = existing["auto_delete_at"]
        if isinstance(current_date, str):
            current_date = datetime.fromisoformat(current_date)

        new_date = current_date + timedelta(days=days)

        query = (
            update(teacher_phrase_sets_table)
            .where(teacher_phrase_sets_table.c.id == set_id)
            .values(
                auto_delete_at=new_date,
                updated_at=datetime.utcnow(),
            )
        )
        await database.execute(query)

        logger.info(
            "Extended auto-delete date",
            extra={
                "phrase_set_id": set_id,
                "days": days,
                "new_date": new_date.isoformat(),
            },
        )

        return new_date
