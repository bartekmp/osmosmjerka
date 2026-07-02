"""Per-word mastery / spaced-repetition database operations.

Thin persistence layer over the pure scheduler in :mod:`osmosmjerka.srs`. Each review
upserts the ``user_word_mastery`` row for a (user, item, direction) and advances its
SM-2-lite schedule. An item is polymorphic: a public ``phrase_id`` or a custom
``list_phrase_id`` (exactly one).
"""

import datetime
from typing import Any, Dict, List, Optional

from osmosmjerka import srs
from osmosmjerka.database.models import phrases_table, user_word_mastery_table
from sqlalchemy import and_, func, insert, select, update


class WordMasteryMixin:
    """Mixin providing per-word mastery / SRS persistence."""

    async def record_review(
        self,
        user_id: int,
        language_set_id: int,
        direction: str,
        grade: str,
        phrase_id: Optional[int] = None,
        list_phrase_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Record one self-assessed review and advance the item's SRS schedule."""
        database = self._ensure_database()

        if (phrase_id is None) == (list_phrase_id is None):
            raise ValueError("Exactly one of phrase_id or list_phrase_id must be provided")
        if direction not in ("production", "recognition"):
            raise ValueError(f"Invalid direction: {direction!r}")
        grade_enum = srs.Grade(grade)  # raises ValueError on unknown grade

        t = user_word_mastery_table
        if phrase_id is not None:
            ref_cond = and_(t.c.phrase_id == phrase_id, t.c.list_phrase_id.is_(None))
        else:
            ref_cond = and_(t.c.list_phrase_id == list_phrase_id, t.c.phrase_id.is_(None))
        cond = and_(t.c.user_id == user_id, t.c.direction == direction, ref_cond)

        existing = await database.fetch_one(select(t).where(cond))
        state = (
            srs.MasteryState(
                ease=existing["ease"],
                interval_days=existing["interval_days"],
                reps=existing["reps"],
                lapses=existing["lapses"],
            )
            if existing
            else srs.MasteryState()
        )

        result = srs.schedule(state, grade_enum)
        now = datetime.datetime.utcnow()
        due_at = now + datetime.timedelta(seconds=result.due_in_seconds)
        passed = 1 if grade_enum.passed else 0

        if existing:
            await database.execute(
                update(t)
                .where(t.c.id == existing["id"])
                .values(
                    ease=result.ease,
                    interval_days=result.interval_days,
                    due_at=due_at,
                    reps=result.reps,
                    lapses=result.lapses,
                    mastery_level=result.mastery_level,
                    total_reviews=t.c.total_reviews + 1,
                    correct_reviews=t.c.correct_reviews + passed,
                    last_reviewed_at=now,
                )
            )
            mastery_id = existing["id"]
        else:
            mastery_id = await database.execute(
                insert(t).values(
                    user_id=user_id,
                    phrase_id=phrase_id,
                    list_phrase_id=list_phrase_id,
                    language_set_id=language_set_id,
                    direction=direction,
                    ease=result.ease,
                    interval_days=result.interval_days,
                    due_at=due_at,
                    reps=result.reps,
                    lapses=result.lapses,
                    mastery_level=result.mastery_level,
                    total_reviews=1,
                    correct_reviews=passed,
                    last_reviewed_at=now,
                    created_at=now,
                )
            )

        # A review counts as activity for the forgiving daily streak (idempotent per day).
        streak = await self.register_review_activity(user_id)

        return {
            "id": mastery_id,
            "direction": direction,
            "ease": result.ease,
            "interval_days": result.interval_days,
            "reps": result.reps,
            "lapses": result.lapses,
            "mastery_level": result.mastery_level,
            "due_at": due_at.isoformat(),
            "streak": streak,
        }

    async def get_due_items(
        self, user_id: int, language_set_id: Optional[int] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Return due items (``due_at`` <= now), soonest first, enriched with the phrase
        text + translation needed to render a review flashcard.

        Only public-phrase items carry phrase/translation (via the join). Custom
        private-list items (``list_phrase_id``) have no join here yet and are skipped."""
        database = self._ensure_database()
        t = user_word_mastery_table
        p = phrases_table

        query = (
            select(
                t.c.id,
                t.c.phrase_id,
                t.c.list_phrase_id,
                t.c.language_set_id,
                t.c.direction,
                t.c.mastery_level,
                t.c.interval_days,
                t.c.due_at,
                p.c.phrase.label("phrase"),
                p.c.translation.label("translation"),
            )
            .select_from(t.outerjoin(p, t.c.phrase_id == p.c.id))
            .where(and_(t.c.user_id == user_id, t.c.due_at <= func.now()))
        )
        if language_set_id is not None:
            query = query.where(t.c.language_set_id == language_set_id)
        query = query.order_by(t.c.due_at).limit(limit)

        rows = await database.fetch_all(query)
        # Skip rows we can't render yet (custom list phrases have no phrase text here).
        return [self._serialize_datetimes(dict(row)) for row in rows if row["phrase"] is not None]

    async def get_mastery_stats(self, user_id: int, language_set_id: Optional[int] = None) -> Dict[str, int]:
        """Summary counts for the learning dashboard: tracked / due / mastered."""
        database = self._ensure_database()
        t = user_word_mastery_table

        conds = [t.c.user_id == user_id]
        if language_set_id is not None:
            conds.append(t.c.language_set_id == language_set_id)
        where = and_(*conds)

        total = await database.fetch_val(select(func.count()).select_from(t).where(where))
        due = await database.fetch_val(select(func.count()).select_from(t).where(and_(where, t.c.due_at <= func.now())))
        # mastered = interval has grown past the "mature" bucket (level >= 4)
        mastered = await database.fetch_val(
            select(func.count()).select_from(t).where(and_(where, t.c.mastery_level >= 4))
        )
        return {"total": int(total or 0), "due": int(due or 0), "mastered": int(mastered or 0)}
