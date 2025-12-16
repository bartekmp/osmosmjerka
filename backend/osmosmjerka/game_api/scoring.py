"""Scoring endpoints for game API."""

import datetime

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger
from osmosmjerka.scoring_rules import (
    BASE_POINTS_PER_PHRASE,
    COMPLETION_BONUS_POINTS,
    DIFFICULTY_MULTIPLIERS,
    HINT_PENALTY_PER_HINT,
    MAX_TIME_BONUS_RATIO,
    TARGET_TIMES_SECONDS,
    get_scoring_rules,
)

logger = get_logger(__name__)

router = APIRouter()


class ScoreCalculationRequest(BaseModel):
    difficulty: str
    phrases_found: int = Field(ge=0)
    total_phrases: int = Field(ge=0)
    duration_seconds: int = Field(ge=0)
    hints_used: int = Field(0, ge=0)


async def calculate_game_score(
    difficulty: str, phrases_found: int, total_phrases: int, duration_seconds: int, hints_used: int
) -> dict:
    """Calculate game score based on various factors"""

    # Try to get scoring rules from database first
    db_rules = await db_manager.get_scoring_rules()

    if db_rules:
        base_points_per_phrase = db_rules["base_points_per_phrase"]
        difficulty_multipliers = db_rules["difficulty_multipliers"]
        max_time_bonus_ratio = db_rules["max_time_bonus_ratio"]
        target_times_seconds = db_rules["target_times_seconds"]
        completion_bonus_points = db_rules["completion_bonus_points"]
        hint_penalty_per_hint = db_rules["hint_penalty_per_hint"]
    else:
        # Fallback to hardcoded constants
        base_points_per_phrase = BASE_POINTS_PER_PHRASE
        difficulty_multipliers = DIFFICULTY_MULTIPLIERS
        max_time_bonus_ratio = MAX_TIME_BONUS_RATIO
        target_times_seconds = TARGET_TIMES_SECONDS
        completion_bonus_points = COMPLETION_BONUS_POINTS
        hint_penalty_per_hint = HINT_PENALTY_PER_HINT

    # Base score: constant points per phrase found
    base_score = phrases_found * base_points_per_phrase

    # Difficulty multipliers determine the size of the bonus.
    difficulty_multiplier = difficulty_multipliers.get(difficulty, difficulty_multipliers.get("easy", 1.0))
    difficulty_bonus = int(base_score * (difficulty_multiplier - 1.0))

    # Time bonus (faster completion = higher bonus).
    time_bonus = 0
    if phrases_found == total_phrases and duration_seconds > 0:
        target_time = target_times_seconds.get(difficulty, target_times_seconds.get("medium", 600))
        if target_time > 0 and duration_seconds <= target_time:
            time_ratio = max(0.0, (target_time - duration_seconds) / target_time)
            time_bonus = int(base_score * max_time_bonus_ratio * time_ratio)

    # Completion bonus for finding all phrases in the puzzle.
    streak_bonus = completion_bonus_points if phrases_found == total_phrases else 0

    # Hint penalty: fixed deduction per hint used.
    hint_penalty = hints_used * hint_penalty_per_hint

    # Calculate final score.
    final_score = max(0, base_score + difficulty_bonus + time_bonus + streak_bonus - hint_penalty)

    return {
        "base_score": base_score,
        "difficulty_bonus": difficulty_bonus,
        "time_bonus": time_bonus,
        "streak_bonus": streak_bonus,
        "hint_penalty": hint_penalty,
        "final_score": final_score,
        "hints_used": hints_used,
        "hint_penalty_per_hint": hint_penalty_per_hint,
    }


@router.post("/game/score")
async def save_game_score(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Save game score and return score details"""
    try:
        session_id = body.get("session_id")
        language_set_id = body.get("language_set_id")
        category = body.get("category")
        difficulty = body.get("difficulty")
        grid_size = body.get("grid_size")
        total_phrases = body.get("total_phrases")
        phrases_found = body.get("phrases_found")
        hints_used = body.get("hints_used", 0)
        duration_seconds = body.get("duration_seconds")
        first_phrase_time = body.get("first_phrase_time")
        completion_time = body.get("completion_time")

        # Validate required fields and types
        if (
            session_id is None
            or language_set_id is None
            or category is None
            or difficulty is None
            or grid_size is None
            or total_phrases is None
            or phrases_found is None
            or duration_seconds is None
        ):
            return JSONResponse({"error": "Missing required fields"}, status_code=400)

        # Type validation
        if (
            not isinstance(session_id, int)
            or not isinstance(language_set_id, int)
            or not isinstance(grid_size, int)
            or not isinstance(total_phrases, int)
            or not isinstance(phrases_found, int)
            or not isinstance(duration_seconds, int)
            or not isinstance(hints_used, int)
            or not isinstance(category, str)
            or not isinstance(difficulty, str)
        ):
            return JSONResponse({"error": "Invalid field types"}, status_code=400)

        # Calculate scoring
        scoring_result = await calculate_game_score(
            difficulty, phrases_found, total_phrases, duration_seconds, hints_used
        )

        # Convert datetime strings to datetime objects if provided
        first_phrase_dt = None
        completion_dt = None
        if first_phrase_time:
            try:
                # Parse timezone-aware datetime and convert to naive UTC
                dt_aware = datetime.datetime.fromisoformat(first_phrase_time.replace("Z", "+00:00"))
                first_phrase_dt = dt_aware.replace(tzinfo=None)
            except ValueError:
                pass
        if completion_time:
            try:
                # Parse timezone-aware datetime and convert to naive UTC
                dt_aware = datetime.datetime.fromisoformat(completion_time.replace("Z", "+00:00"))
                completion_dt = dt_aware.replace(tzinfo=None)
            except ValueError:
                pass

        # Save score to database
        score_id = await db_manager.save_game_score(
            session_id=session_id,
            user_id=user["id"],
            language_set_id=language_set_id,
            category=category,
            difficulty=difficulty,
            grid_size=grid_size,
            total_phrases=total_phrases,
            phrases_found=phrases_found,
            hints_used=hints_used,
            base_score=scoring_result["base_score"],
            time_bonus=scoring_result["time_bonus"],
            difficulty_bonus=scoring_result["difficulty_bonus"],
            streak_bonus=scoring_result["streak_bonus"],
            hint_penalty=scoring_result["hint_penalty"],
            final_score=scoring_result["final_score"],
            duration_seconds=duration_seconds,
            first_phrase_time=first_phrase_dt,
            completion_time=completion_dt,
        )

        return JSONResponse(
            {"score_id": score_id, "scoring_details": scoring_result, "message": "Score saved successfully"}
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user/best-scores")
async def get_user_best_scores(
    language_set_id: int = Query(None),
    category: str = Query(None),
    difficulty: str = Query(None),
    limit: int = Query(10),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Get user's best scores"""
    try:
        scores = await db_manager.get_user_best_scores(user["id"], language_set_id, category, difficulty, limit)
        return JSONResponse(scores)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/leaderboard")
async def get_leaderboard(
    language_set_id: int = Query(None),
    category: str = Query(None),
    difficulty: str = Query(None),
    limit: int = Query(50),
) -> JSONResponse:
    """Get global leaderboard"""
    try:
        leaderboard = await db_manager.get_leaderboard(language_set_id, category, difficulty, limit)
        return JSONResponse(leaderboard)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/system/scoring-rules")
async def get_system_scoring_rules() -> JSONResponse:
    """Public endpoint exposing the current scoring rules."""
    try:
        # Try to get scoring rules from database first
        db_rules = await db_manager.get_scoring_rules()

        if db_rules:
            # Add difficulty_order to match the expected format
            from osmosmjerka.scoring_rules import DIFFICULTY_ORDER

            scoring_rules = {
                "base_points_per_phrase": db_rules["base_points_per_phrase"],
                "difficulty_multipliers": db_rules["difficulty_multipliers"],
                "difficulty_order": DIFFICULTY_ORDER,
                "time_bonus": {
                    "max_ratio": db_rules["max_time_bonus_ratio"],
                    "target_times_seconds": db_rules["target_times_seconds"],
                },
                "completion_bonus_points": db_rules["completion_bonus_points"],
                "hint_penalty_per_hint": db_rules["hint_penalty_per_hint"],
            }
            return JSONResponse(scoring_rules)
        else:
            # Fallback to hardcoded rules if database rules don't exist
            return JSONResponse(get_scoring_rules())
    except Exception as e:  # pragma: no cover - defensive guard
        logger.error(f"Error fetching scoring rules: {e}")
        # Fallback to hardcoded rules on error
        return JSONResponse(get_scoring_rules())


@router.post("/system/calculate-score")
async def calculate_score_endpoint(payload: ScoreCalculationRequest) -> JSONResponse:
    """Expose score calculation to ensure a single source of truth for the frontend."""

    score = await calculate_game_score(
        payload.difficulty,
        payload.phrases_found,
        payload.total_phrases,
        payload.duration_seconds,
        payload.hints_used,
    )
    return JSONResponse(score)


@router.get("/system/scoring-enabled")
async def get_system_scoring_enabled() -> JSONResponse:
    """Get system-wide scoring enabled status (public endpoint)"""
    try:
        enabled = await db_manager.is_scoring_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/system/progressive-hints-enabled")
async def get_system_progressive_hints_enabled() -> JSONResponse:
    """Get system-wide progressive hints enabled status (public endpoint)"""
    try:
        enabled = await db_manager.is_progressive_hints_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
