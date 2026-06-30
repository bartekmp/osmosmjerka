"""Teacher phrase set session management and expired-set cleanup."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    teacher_phrase_set_sessions_table,
    teacher_phrase_sets_table,
)
from osmosmjerka.logging_config import get_logger
from sqlalchemy import and_, desc
from sqlalchemy.sql import delete, func, insert, select, update

logger = get_logger(__name__)


class TeacherSetsSessionsMixin:
    """Mixin providing teacher session tracking and expired-set cleanup."""

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
