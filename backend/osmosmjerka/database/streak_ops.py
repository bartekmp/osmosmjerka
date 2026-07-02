"""Daily learning streak persistence (thin layer over osmosmjerka.streak)."""

import datetime
from typing import Any, Dict, Optional

from osmosmjerka import streak as streak_logic
from osmosmjerka.database.models import user_streaks_table
from sqlalchemy import insert, select, update


class StreakMixin:
    """Mixin providing the forgiving daily streak."""

    async def get_streak(self, user_id: int) -> Dict[str, Any]:
        """Return the user's streak state (defaults if they have none yet)."""
        database = self._ensure_database()
        row = await database.fetch_one(select(user_streaks_table).where(user_streaks_table.c.user_id == user_id))
        if not row:
            return {"current": 0, "longest": 0, "last_active": None, "freezes": streak_logic.DEFAULT_FREEZES}
        return {
            "current": row["current_streak"],
            "longest": row["longest_streak"],
            "last_active": row["last_active_date"].isoformat() if row["last_active_date"] else None,
            "freezes": row["freezes"],
        }

    async def register_review_activity(self, user_id: int, today: Optional[datetime.date] = None) -> Dict[str, int]:
        """Mark today active for the user and advance/forgive the streak. Idempotent per day."""
        database = self._ensure_database()
        today = today or datetime.datetime.utcnow().date()

        row = await database.fetch_one(select(user_streaks_table).where(user_streaks_table.c.user_id == user_id))
        state = (
            streak_logic.StreakState(
                current=row["current_streak"],
                longest=row["longest_streak"],
                last_active=row["last_active_date"],
                freezes=row["freezes"],
            )
            if row
            else streak_logic.StreakState()
        )

        result = streak_logic.register_activity(state, today)
        now = datetime.datetime.utcnow()

        if row:
            await database.execute(
                update(user_streaks_table)
                .where(user_streaks_table.c.user_id == user_id)
                .values(
                    current_streak=result.current,
                    longest_streak=result.longest,
                    last_active_date=result.last_active,
                    freezes=result.freezes,
                    updated_at=now,
                )
            )
        else:
            await database.execute(
                insert(user_streaks_table).values(
                    user_id=user_id,
                    current_streak=result.current,
                    longest_streak=result.longest,
                    last_active_date=result.last_active,
                    freezes=result.freezes,
                    updated_at=now,
                )
            )

        return {"current": result.current, "longest": result.longest, "freezes": result.freezes}
