"""Teacher phrase set hotlink access validation and student-facing queries."""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    phrases_table,
    teacher_group_members_table,
    teacher_phrase_set_access_table,
    teacher_phrase_set_groups_table,
    teacher_phrase_set_phrases_table,
    teacher_phrase_sets_table,
)
from osmosmjerka.database.teacher_sets import DEFAULT_CONFIG
from osmosmjerka.logging_config import get_logger
from sqlalchemy import and_, desc
from sqlalchemy.sql import func, select, update

logger = get_logger(__name__)


class TeacherSetsAccessMixin:
    """Mixin providing hotlink access validation and student puzzle queries."""

    async def get_phrase_set_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get a phrase set by its hotlink token (for public access)."""
        database = self._ensure_database()

        query = select(teacher_phrase_sets_table).where(teacher_phrase_sets_table.c.current_hotlink_token == token)

        result = await database.fetch_one(query)
        if not result:
            return None

        row_dict = dict(result)
        if isinstance(row_dict.get("config"), str):
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
            select(
                teacher_phrase_sets_table,
                phrase_count_subquery,
                accounts_table.c.username.label("creator_username"),
            )
            .join(
                accounts_table,
                teacher_phrase_sets_table.c.created_by == accounts_table.c.id,
            )
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
            if isinstance(row_dict.get("config"), str):
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

        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return []

        # Phrase ids are globally unique in the single phrases table.
        phrase_table = phrases_table

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
