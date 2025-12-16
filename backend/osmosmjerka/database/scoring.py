"""Scoring rules and game scores database operations."""

import datetime
import json
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.sql import insert, select

from osmosmjerka.database.models import accounts_table, game_scores_table, scoring_rules_table


class ScoringMixin:
    """Mixin class providing scoring rules and game scores management methods."""

    async def get_scoring_rules(self) -> Optional[Dict[str, Any]]:
        """Get current scoring rules from database."""
        database = self._ensure_database()

        query = select(scoring_rules_table).order_by(desc(scoring_rules_table.c.id)).limit(1)
        result = await database.fetch_one(query)

        if not result:
            return None

        return {
            "base_points_per_phrase": result["base_points_per_phrase"],
            "difficulty_multipliers": json.loads(result["difficulty_multipliers"]),
            "max_time_bonus_ratio": float(result["max_time_bonus_ratio"]),
            "target_times_seconds": json.loads(result["target_times_seconds"]),
            "completion_bonus_points": result["completion_bonus_points"],
            "hint_penalty_per_hint": result["hint_penalty_per_hint"],
        }

    async def update_scoring_rules(
        self,
        base_points_per_phrase: int,
        difficulty_multipliers: Dict[str, float],
        max_time_bonus_ratio: float,
        target_times_seconds: Dict[str, int],
        completion_bonus_points: int,
        hint_penalty_per_hint: int,
        updated_by: int = 0,
    ) -> None:
        """Update scoring rules by inserting a new record."""
        database = self._ensure_database()

        query = insert(scoring_rules_table).values(
            base_points_per_phrase=base_points_per_phrase,
            difficulty_multipliers=json.dumps(difficulty_multipliers),
            max_time_bonus_ratio=str(max_time_bonus_ratio),
            target_times_seconds=json.dumps(target_times_seconds),
            completion_bonus_points=completion_bonus_points,
            hint_penalty_per_hint=hint_penalty_per_hint,
            updated_by=updated_by,
        )

        await database.execute(query)

    async def initialize_default_scoring_rules(self) -> None:
        """Initialize default scoring rules if none exist."""
        existing = await self.get_scoring_rules()

        if existing is None:
            # Import default values from scoring_rules module
            from osmosmjerka.scoring_rules import (
                BASE_POINTS_PER_PHRASE,
                COMPLETION_BONUS_POINTS,
                DIFFICULTY_MULTIPLIERS,
                HINT_PENALTY_PER_HINT,
                MAX_TIME_BONUS_RATIO,
                TARGET_TIMES_SECONDS,
            )

            await self.update_scoring_rules(
                base_points_per_phrase=BASE_POINTS_PER_PHRASE,
                difficulty_multipliers=DIFFICULTY_MULTIPLIERS,
                max_time_bonus_ratio=MAX_TIME_BONUS_RATIO,
                target_times_seconds=TARGET_TIMES_SECONDS,
                completion_bonus_points=COMPLETION_BONUS_POINTS,
                hint_penalty_per_hint=HINT_PENALTY_PER_HINT,
                updated_by=0,
            )

    async def save_game_score(
        self,
        session_id: int,
        user_id: int,
        language_set_id: int,
        category: str,
        difficulty: str,
        grid_size: int,
        total_phrases: int,
        phrases_found: int,
        hints_used: int,
        base_score: int,
        time_bonus: int,
        difficulty_bonus: int,
        streak_bonus: int,
        hint_penalty: int,
        final_score: int,
        duration_seconds: int,
        first_phrase_time: Optional[datetime.datetime] = None,
        completion_time: Optional[datetime.datetime] = None,
    ) -> int:
        """Save game score and return the score ID."""
        database = self._ensure_database()

        query = insert(game_scores_table).values(
            session_id=session_id,
            user_id=user_id,
            language_set_id=language_set_id,
            category=category,
            difficulty=difficulty,
            grid_size=grid_size,
            total_phrases=total_phrases,
            phrases_found=phrases_found,
            hints_used=hints_used,
            base_score=base_score,
            time_bonus=time_bonus,
            difficulty_bonus=difficulty_bonus,
            streak_bonus=streak_bonus,
            hint_penalty=hint_penalty,
            final_score=final_score,
            duration_seconds=duration_seconds,
            first_phrase_time=first_phrase_time,
            completion_time=completion_time,
        )

        return await database.execute(query)

    async def get_user_best_scores(
        self,
        user_id: int,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get user's best scores with optional filters."""
        database = self._ensure_database()

        query = select(game_scores_table).where(game_scores_table.c.user_id == user_id)

        if language_set_id is not None:
            query = query.where(game_scores_table.c.language_set_id == language_set_id)
        if category is not None:
            query = query.where(game_scores_table.c.category == category)
        if difficulty is not None:
            query = query.where(game_scores_table.c.difficulty == difficulty)

        query = query.order_by(desc(game_scores_table.c.final_score)).limit(limit)

        rows = await database.fetch_all(query)
        return [self._serialize_datetimes(dict(row)) for row in rows]

    async def get_leaderboard(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get global leaderboard with optional filters."""
        database = self._ensure_database()

        query = (
            select(
                game_scores_table.c.user_id,
                accounts_table.c.username,
                game_scores_table.c.final_score,
                game_scores_table.c.category,
                game_scores_table.c.difficulty,
                game_scores_table.c.duration_seconds,
                game_scores_table.c.phrases_found,
                game_scores_table.c.total_phrases,
                game_scores_table.c.hints_used,
                game_scores_table.c.created_at,
            )
            .select_from(game_scores_table.join(accounts_table, game_scores_table.c.user_id == accounts_table.c.id))
            .where(accounts_table.c.is_active)
        )

        if language_set_id is not None:
            query = query.where(game_scores_table.c.language_set_id == language_set_id)
        if category is not None:
            query = query.where(game_scores_table.c.category == category)
        if difficulty is not None:
            query = query.where(game_scores_table.c.difficulty == difficulty)

        query = query.order_by(desc(game_scores_table.c.final_score)).limit(limit)

        rows = await database.fetch_all(query)
        return [self._serialize_datetimes(dict(row)) for row in rows]

    async def is_scoring_enabled_globally(self) -> bool:
        """Check if scoring system is globally enabled."""
        setting = await self.get_global_setting("scoring_enabled", "true")
        return setting is not None and setting.lower() == "true"

    async def is_scoring_enabled_for_user(self, user_id: int) -> bool:
        """Check if scoring is enabled for a specific user (user preference overrides global)."""
        global_enabled = await self.is_scoring_enabled_globally()
        user_preference = await self.get_user_preference(user_id, "scoring_enabled")

        if user_preference is not None:
            return user_preference.lower() == "true"

        return global_enabled

    async def is_progressive_hints_enabled_globally(self) -> bool:
        """Check if progressive hints are globally enabled."""
        setting = await self.get_global_setting("progressive_hints_enabled", "false")
        return setting is not None and setting.lower() == "true"

    async def is_progressive_hints_enabled_for_user(self, user_id: int) -> bool:
        """Check if progressive hints are enabled for a specific user."""
        global_enabled = await self.is_progressive_hints_enabled_globally()
        user_preference = await self.get_user_preference(user_id, "progressive_hints_enabled")

        if user_preference is not None:
            return user_preference.lower() == "true"

        return global_enabled
