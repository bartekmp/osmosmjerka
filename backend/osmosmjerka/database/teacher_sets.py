"""Teacher phrase sets database operations."""

import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    teacher_group_members_table,
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
            config=json.dumps(final_config),
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
            # Parse config JSON
            if row_dict.get("config"):
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
        if row_dict.get("config"):
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
                    raise ValueError(f"Cannot update {key}: set has existing sessions")
                if key == "config":
                    update_values[key] = json.dumps(value)
                else:
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

    # =========================================================================
    # Hotlink Access Validation
    # =========================================================================

    async def get_phrase_set_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get a phrase set by its hotlink token (for public access)."""
        database = self._ensure_database()

        query = select(teacher_phrase_sets_table).where(teacher_phrase_sets_table.c.current_hotlink_token == token)

        result = await database.fetch_one(query)
        if not result:
            return None

        row_dict = dict(result)
        if row_dict.get("config"):
            try:
                row_dict["config"] = json.loads(row_dict["config"])
            except json.JSONDecodeError:
                row_dict["config"] = DEFAULT_CONFIG.copy()

        return self._serialize_datetimes(row_dict)

    async def validate_hotlink_access(self, token: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Validate hotlink access and return set data or error.

        Returns:
            Dict with either:
            - "set": phrase set data and phrases
            - "error": {"code": "...", "message": "..."}
        """
        phrase_set = await self.get_phrase_set_by_token(token)

        if not phrase_set:
            return {
                "error": {
                    "code": "SET_NOT_FOUND",
                    "message": "Puzzle not found",
                }
            }

        # Check if active
        if not phrase_set.get("is_active"):
            return {
                "error": {
                    "code": "SET_INACTIVE",
                    "message": "This puzzle is no longer available",
                }
            }

        # Check expiration
        expires_at = phrase_set.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at < datetime.utcnow():
                return {
                    "error": {
                        "code": "SET_EXPIRED",
                        "message": "This puzzle has expired",
                        "details": {"expired_at": expires_at.isoformat()},
                    }
                }

        # Check auto-delete
        auto_delete_at = phrase_set.get("auto_delete_at")
        if auto_delete_at:
            if isinstance(auto_delete_at, str):
                auto_delete_at = datetime.fromisoformat(auto_delete_at)
            if auto_delete_at < datetime.utcnow():
                return {
                    "error": {
                        "code": "SET_EXPIRED",
                        "message": "This puzzle is no longer available",
                    }
                }

        # Check max plays
        max_plays = phrase_set.get("max_plays")
        if max_plays is not None:
            session_counts = await self._get_session_counts([phrase_set["id"]])
            session_count = session_counts.get(phrase_set["id"], {}).get("total", 0)
            if session_count >= max_plays:
                return {
                    "error": {
                        "code": "SET_EXHAUSTED",
                        "message": "This puzzle has reached its play limit",
                    }
                }

        # Check private access
        if phrase_set.get("access_type") == "private":
            if user_id is None:
                return {
                    "error": {
                        "code": "AUTH_REQUIRED",
                        "message": "This puzzle requires login",
                    }
                }

            has_access = await self._check_private_access(phrase_set["id"], user_id)
            if not has_access:
                return {
                    "error": {
                        "code": "ACCESS_DENIED",
                        "message": "You don't have access to this puzzle",
                    }
                }

        # Update last accessed timestamp
        await self._update_last_accessed(phrase_set["id"])

        # Get phrases
        phrases = await self.get_phrase_set_phrases(phrase_set["id"])

        return {
            "set": {
                **phrase_set,
                "phrases": phrases,
            }
        }

    async def _check_private_access(self, set_id: int, user_id: int) -> bool:
        """Check if user has access to a private set."""
        database = self._ensure_database()

        # Check if user is the owner
        owner_query = select(teacher_phrase_sets_table.c.created_by).where(teacher_phrase_sets_table.c.id == set_id)
        owner_id = await database.fetch_val(owner_query)
        if owner_id == user_id:
            return True

        # Root admin can access all private puzzles
        role_query = select(accounts_table.c.role).where(accounts_table.c.id == user_id)
        user_role = await database.fetch_val(role_query)
        if user_role == "root_admin":
            return True

        # Check access table
        access_query = select(teacher_phrase_set_access_table.c.id).where(
            and_(
                teacher_phrase_set_access_table.c.phrase_set_id == set_id,
                teacher_phrase_set_access_table.c.user_id == user_id,
            )
        )
        result = await database.fetch_one(access_query)
        if result:
            return True

        # Check group access
        group_query = (
            select(teacher_phrase_set_groups_table.c.id)
            .select_from(
                teacher_phrase_set_groups_table.join(
                    teacher_group_members_table,
                    teacher_phrase_set_groups_table.c.group_id == teacher_group_members_table.c.group_id,
                )
            )
            .where(
                and_(
                    teacher_phrase_set_groups_table.c.phrase_set_id == set_id,
                    teacher_group_members_table.c.user_id == user_id,
                    teacher_group_members_table.c.status == "accepted",
                )
            )
        )
        group_result = await database.fetch_one(group_query)
        return group_result is not None

    async def _update_last_accessed(self, set_id: int):
        """Update the last_accessed_at timestamp."""
        database = self._ensure_database()

        query = (
            update(teacher_phrase_sets_table)
            .where(teacher_phrase_sets_table.c.id == set_id)
            .values(last_accessed_at=datetime.utcnow())
        )
        await database.execute(query)

    async def get_student_assigned_puzzles(self, user_id: int, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Get puzzles assigned to a student (directly or via groups)."""
        database = self._ensure_database()

        # 1. Puzzles assigned directly
        direct_query = select(teacher_phrase_set_access_table.c.phrase_set_id).where(
            teacher_phrase_set_access_table.c.user_id == user_id
        )

        # 2. Puzzles assigned via groups
        group_query = (
            select(teacher_phrase_set_groups_table.c.phrase_set_id)
            .select_from(
                teacher_phrase_set_groups_table.join(
                    teacher_group_members_table,
                    teacher_phrase_set_groups_table.c.group_id == teacher_group_members_table.c.group_id,
                )
            )
            .where(
                and_(
                    teacher_group_members_table.c.user_id == user_id,
                    teacher_group_members_table.c.status == "accepted",
                )
            )
        )

        # Combine IDs
        direct_ids = [r["phrase_set_id"] for r in await database.fetch_all(direct_query)]
        group_ids = [r["phrase_set_id"] for r in await database.fetch_all(group_query)]
        all_ids = list(set(direct_ids + group_ids))

        if not all_ids:
            return {"puzzles": [], "total": 0}

        # Subquery for phrase count
        phrase_count_subquery = (
            select(func.count(teacher_phrase_set_phrases_table.c.phrase_id))
            .where(teacher_phrase_set_phrases_table.c.phrase_set_id == teacher_phrase_sets_table.c.id)
            .scalar_subquery()
            .label("phrase_count")
        )

        query = (
            select(teacher_phrase_sets_table, phrase_count_subquery)
            .where(
                and_(
                    teacher_phrase_sets_table.c.id.in_(all_ids),
                    teacher_phrase_sets_table.c.is_active,
                )
            )
            .order_by(desc(teacher_phrase_sets_table.c.created_at))
            .limit(limit)
            .offset(offset)
        )

        # Count total
        count_query = select(func.count(teacher_phrase_sets_table.c.id)).where(
            and_(
                teacher_phrase_sets_table.c.id.in_(all_ids),
                teacher_phrase_sets_table.c.is_active,
            )
        )
        total = await database.fetch_val(count_query)

        result = await database.fetch_all(query)
        puzzles = []
        for row in result:
            row_dict = dict(row)
            if row_dict.get("config"):
                try:
                    row_dict["config"] = json.loads(row_dict["config"])
                except json.JSONDecodeError:
                    row_dict["config"] = DEFAULT_CONFIG.copy()
            puzzles.append(self._serialize_datetimes(row_dict))

        return {
            "puzzles": puzzles,
            "total": total,
        }

    async def get_phrase_set_phrases(self, set_id: int) -> List[Dict[str, Any]]:
        """Get all phrases for a phrase set with their details."""
        database = self._ensure_database()

        # First get the language set name to access the phrase table
        set_query = select(teacher_phrase_sets_table.c.language_set_id).where(teacher_phrase_sets_table.c.id == set_id)
        language_set_id = await database.fetch_val(set_query)

        if not language_set_id:
            return []

        # Get language set name
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return []

        phrase_table = self._get_phrase_table(language_set["name"])

        # Get phrase IDs from junction table
        junction_query = (
            select(
                teacher_phrase_set_phrases_table.c.phrase_id,
                teacher_phrase_set_phrases_table.c.position,
            )
            .where(teacher_phrase_set_phrases_table.c.phrase_set_id == set_id)
            .order_by(teacher_phrase_set_phrases_table.c.position)
        )
        junction_result = await database.fetch_all(junction_query)

        if not junction_result:
            return []

        phrase_ids = [row["phrase_id"] for row in junction_result]

        # Get phrase details
        phrases_query = select(phrase_table).where(phrase_table.c.id.in_(phrase_ids))
        phrases_result = await database.fetch_all(phrases_query)

        # Create lookup and return in position order
        phrase_lookup = {row["id"]: dict(row) for row in phrases_result}
        return [phrase_lookup[pid] for pid in phrase_ids if pid in phrase_lookup]

    # =========================================================================
    # Session Management
    # =========================================================================

    async def create_session(
        self,
        set_id: int,
        nickname: str,
        grid_size: int,
        difficulty: str,
        total_phrases: int,
        hotlink_version: int,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create a new game session for a phrase set."""
        database = self._ensure_database()

        session_token = str(uuid.uuid4())

        query = insert(teacher_phrase_set_sessions_table).values(
            phrase_set_id=set_id,
            hotlink_version=hotlink_version,
            user_id=user_id,
            nickname=nickname,
            session_token=session_token,
            grid_size=grid_size,
            difficulty=difficulty,
            total_phrases=total_phrases,
            phrases_found=0,
            is_completed=False,
        )

        session_id = await database.execute(query)

        logger.info(
            "Created teacher set session",
            extra={
                "session_id": session_id,
                "phrase_set_id": set_id,
                "nickname": nickname,
                "user_id": user_id,
            },
        )

        return {
            "id": session_id,
            "session_token": session_token,
            "phrase_set_id": set_id,
            "hotlink_version": hotlink_version,
            "nickname": nickname,
            "grid_size": grid_size,
            "difficulty": difficulty,
            "total_phrases": total_phrases,
        }

    async def complete_session(
        self,
        session_token: str,
        phrases_found: int,
        duration_seconds: int,
        translation_submissions: Optional[List[Dict]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Complete a game session with results."""
        database = self._ensure_database()

        # Get session
        query = select(teacher_phrase_set_sessions_table).where(
            teacher_phrase_set_sessions_table.c.session_token == session_token
        )
        result = await database.fetch_one(query)

        if not result:
            return None

        session = dict(result)

        if session.get("is_completed"):
            return {
                "error": {
                    "code": "SESSION_COMPLETED",
                    "message": "This session has already been completed",
                }
            }

        # Update session
        update_values = {
            "phrases_found": phrases_found,
            "duration_seconds": duration_seconds,
            "completed_at": datetime.utcnow(),
            "is_completed": True,
        }

        if translation_submissions:
            update_values["translation_submissions"] = json.dumps(translation_submissions)

        update_query = (
            update(teacher_phrase_set_sessions_table)
            .where(teacher_phrase_set_sessions_table.c.session_token == session_token)
            .values(**update_values)
        )
        await database.execute(update_query)

        # Notify teacher if translations were submitted
        if translation_submissions:
            logger.info(
                "Translation submissions received, creating notification",
                extra={
                    "count": len(translation_submissions),
                    "session_token": session_token,
                },
            )
            # Fetch phrase set to get teacher ID (created_by)
            ps_query = select(teacher_phrase_sets_table.c.created_by, teacher_phrase_sets_table.c.name).where(
                teacher_phrase_sets_table.c.id == session["phrase_set_id"]
            )
            ps = await database.fetch_one(ps_query)

            if ps and ps[0] is not None:  # Ensure teacher exists (ID 0 is valid)
                teacher_id = ps[0]
                set_name = ps[1]
                nickname = session["nickname"]

                logger.info(
                    "Creating notification for teacher",
                    extra={
                        "teacher_id": teacher_id,
                        "set_name": set_name,
                        "nickname": nickname,
                    },
                )

                await self.create_notification(
                    user_id=teacher_id,
                    type="translation_review",
                    title="Translation Review Required",
                    message=f"{nickname} submitted translations for '{set_name}'",
                    link=f"/teacher-dashboard?tab=2&set_id={session['phrase_set_id']}",  # Deep link to sessions
                    metadata={
                        "session_id": session["id"],
                        "phrase_set_id": session["phrase_set_id"],
                        "nickname": nickname,
                    },
                )
            else:
                logger.warning(
                    "Could not find teacher for notification",
                    extra={"phrase_set_id": session["phrase_set_id"]},
                )

        logger.info(
            "Completed teacher set session",
            extra={
                "session_token": session_token,
                "phrases_found": phrases_found,
                "duration_seconds": duration_seconds,
            },
        )

        return {
            "session_token": session_token,
            "phrases_found": phrases_found,
            "total_phrases": session["total_phrases"],
            "duration_seconds": duration_seconds,
            "is_completed": True,
        }

    async def get_session_by_token(self, session_token: str) -> Optional[Dict[str, Any]]:
        """Get a session by its token."""
        database = self._ensure_database()

        query = select(teacher_phrase_set_sessions_table).where(
            teacher_phrase_set_sessions_table.c.session_token == session_token
        )
        result = await database.fetch_one(query)

        if not result:
            return None

        session = dict(result)
        if session.get("translation_submissions"):
            try:
                session["translation_submissions"] = json.loads(session["translation_submissions"])
            except json.JSONDecodeError:
                session["translation_submissions"] = []

        return self._serialize_datetimes(session)

    async def get_sessions_for_set(
        self,
        set_id: int,
        limit: int = 50,
        offset: int = 0,
        completed_only: bool = False,
    ) -> Dict[str, Any]:
        """Get paginated sessions for a phrase set."""
        database = self._ensure_database()

        # Base conditions
        conditions = [teacher_phrase_set_sessions_table.c.phrase_set_id == set_id]
        if completed_only:
            conditions.append(teacher_phrase_set_sessions_table.c.is_completed.is_(True))

        # Count
        count_query = select(func.count(teacher_phrase_set_sessions_table.c.id)).where(and_(*conditions))
        total = await database.fetch_val(count_query)

        # Get sessions with user info
        query = (
            select(
                teacher_phrase_set_sessions_table,
                accounts_table.c.username,
            )
            .select_from(
                teacher_phrase_set_sessions_table.outerjoin(
                    accounts_table,
                    teacher_phrase_set_sessions_table.c.user_id == accounts_table.c.id,
                )
            )
            .where(and_(*conditions))
            .order_by(desc(teacher_phrase_set_sessions_table.c.started_at))
            .limit(limit)
            .offset(offset)
        )

        result = await database.fetch_all(query)
        sessions = []
        for row in result:
            session = dict(row)
            if session.get("translation_submissions"):
                try:
                    session["translation_submissions"] = json.loads(session["translation_submissions"])
                except json.JSONDecodeError:
                    session["translation_submissions"] = []
            sessions.append(self._serialize_datetimes(session))

        return {
            "sessions": sessions,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(sessions) < total,
        }

    async def delete_session(self, session_id: int) -> bool:
        """Delete a session."""
        database = self._ensure_database()

        query = delete(teacher_phrase_set_sessions_table).where(teacher_phrase_set_sessions_table.c.id == session_id)
        await database.execute(query)

        return True

    async def delete_all_sessions_for_set(self, set_id: int) -> int:
        """Delete all sessions for a phrase set.

        Returns:
            Number of sessions deleted
        """
        database = self._ensure_database()

        # Count sessions first
        count_query = select(func.count(teacher_phrase_set_sessions_table.c.id)).where(
            teacher_phrase_set_sessions_table.c.phrase_set_id == set_id
        )
        count = await database.fetch_val(count_query)

        # Delete all sessions
        query = delete(teacher_phrase_set_sessions_table).where(
            teacher_phrase_set_sessions_table.c.phrase_set_id == set_id
        )
        await database.execute(query)

        return count or 0

    # =========================================================================
    # Cleanup
    # =========================================================================

    async def cleanup_expired_sets(self) -> int:
        """Delete phrase sets that have passed their auto_delete_at date.

        Returns:
            Number of sets deleted
        """
        database = self._ensure_database()

        now = datetime.now(timezone.utc)

        # Get sets to delete for logging
        select_query = select(
            teacher_phrase_sets_table.c.id,
            teacher_phrase_sets_table.c.name,
            teacher_phrase_sets_table.c.created_by,
        ).where(
            and_(
                teacher_phrase_sets_table.c.auto_delete_at.isnot(None),
                teacher_phrase_sets_table.c.auto_delete_at < now,
            )
        )
        sets_to_delete = await database.fetch_all(select_query)

        if not sets_to_delete:
            return 0

        for row in sets_to_delete:
            logger.info(
                "Auto-deleting expired phrase set",
                extra={
                    "phrase_set_id": row["id"],
                    "name": row["name"],
                    "created_by": row["created_by"],
                },
            )

        # Delete (CASCADE handles related tables)
        delete_query = delete(teacher_phrase_sets_table).where(
            and_(
                teacher_phrase_sets_table.c.auto_delete_at.isnot(None),
                teacher_phrase_sets_table.c.auto_delete_at < now,
            )
        )
        await database.execute(delete_query)

        logger.info(
            "Cleanup completed",
            extra={"deleted_count": len(sets_to_delete)},
        )

        return len(sets_to_delete)
