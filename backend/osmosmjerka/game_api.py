import datetime
import io
import random
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from osmosmjerka.auth import get_current_user, get_current_user_optional, verify_token
from osmosmjerka.cache import cache_response, categories_cache, language_sets_cache, phrases_cache, rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)
from osmosmjerka.scoring_rules import (
    BASE_POINTS_PER_PHRASE,
    COMPLETION_BONUS_POINTS,
    DIFFICULTY_MULTIPLIERS,
    HINT_PENALTY_PER_HINT,
    MAX_TIME_BONUS_RATIO,
    TARGET_TIMES_SECONDS,
    get_scoring_rules,
)
from osmosmjerka.utils import export_to_docx, export_to_png

router = APIRouter(prefix="/api")


class ScoreCalculationRequest(BaseModel):
    difficulty: str
    phrases_found: int = Field(ge=0)
    total_phrases: int = Field(ge=0)
    duration_seconds: int = Field(ge=0)
    hints_used: int = Field(0, ge=0)


@router.get("/language-sets")
@cache_response(language_sets_cache, "language_sets")
async def get_language_sets() -> JSONResponse:
    """Get all active language sets with default first"""
    language_sets = await db_manager.get_language_sets(active_only=True)
    return JSONResponse(language_sets)


@router.get("/categories")
@rate_limit(max_requests=30, window_seconds=60)  # 30 requests per minute
@cache_response(categories_cache, "categories")
async def get_all_categories(language_set_id: int = Query(None), *, request: Request) -> JSONResponse:
    """Get categories for a specific language set, applying user-specific ignored categories if authenticated"""
    user = None
    if request:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            try:
                user = verify_token(auth.split(" ", 1)[1])
            except Exception:
                user = None
    ignored_override = None
    if user and language_set_id is not None:
        user_ignored = await db_manager.get_user_ignored_categories(user["id"], language_set_id)
        ignored_override = set(user_ignored)
    all_categories = await db_manager.get_categories_for_language_set(
        language_set_id, ignored_categories_override=ignored_override
    )
    return JSONResponse(sorted(all_categories))


def get_grid_size_and_num_phrases(selected: list, difficulty: str) -> tuple:
    """Get grid size and number of phrases based on difficulty and available phrases."""
    if difficulty == "very_easy":
        grid_size = 8
        num_phrases = 5
    elif difficulty == "easy":
        grid_size = 10
        num_phrases = 7
    elif difficulty == "medium":
        grid_size = 13
        num_phrases = 10
    elif difficulty == "hard":
        grid_size = 15
        num_phrases = 12
    elif difficulty == "very_hard":
        grid_size = 20
        num_phrases = 16
    else:
        grid_size = 10
        num_phrases = 7

    return grid_size, num_phrases


def _generate_grid_with_exact_phrase_count(all_phrases: list, grid_size: int, target_phrase_count: int) -> tuple:
    """
    Generate a grid with exactly the target number of phrases.
    If not all phrases can be placed, try different combinations until we get the target count.
    """
    max_attempts = 50  # Limit attempts to avoid infinite loops
    attempt = 0
    best_grid = None
    best_placed_phrases = []

    # First, try with a random selection as before
    if len(all_phrases) > target_phrase_count:
        selected_phrases = random.sample(all_phrases, target_phrase_count)
    else:
        selected_phrases = all_phrases.copy()
        random.shuffle(selected_phrases)

    while attempt < max_attempts:
        grid, placed_phrases = generate_grid(selected_phrases, grid_size)

        # Keep track of the best result so far
        if len(placed_phrases) > len(best_placed_phrases):
            best_grid = grid
            best_placed_phrases = placed_phrases

        # If we got exactly the target number, we're done
        if len(placed_phrases) == target_phrase_count:
            return grid, placed_phrases

        # If we got fewer phrases than target, try with different phrases
        if len(placed_phrases) < target_phrase_count:
            # Calculate how many more phrases we need
            phrases_needed = target_phrase_count - len(placed_phrases)

            # Get phrases that weren't placed
            placed_phrase_texts = {p["phrase"] for p in placed_phrases}
            unplaced_phrases = [p for p in all_phrases if p["phrase"] not in placed_phrase_texts]

            # If we have enough unplaced phrases, try replacing some phrases
            if len(unplaced_phrases) >= phrases_needed and len(all_phrases) > target_phrase_count:
                # Remove some phrases that were placed and add some that weren't
                phrases_to_remove = min(3, len(placed_phrases))  # Remove a few placed phrases
                phrases_to_add = min(phrases_needed + phrases_to_remove, len(unplaced_phrases))

                # Create new selection by keeping most placed phrases and adding unplaced ones
                kept_phrases = random.sample(
                    [p for p in selected_phrases if p["phrase"] in placed_phrase_texts],
                    max(0, target_phrase_count - phrases_to_add),
                )
                new_phrases = random.sample(unplaced_phrases, phrases_to_add)
                selected_phrases = kept_phrases + new_phrases
            else:
                # Try with all available phrases if we don't have many options
                selected_phrases = all_phrases.copy()
                random.shuffle(selected_phrases)

        # If we got more phrases than target (shouldn't happen with current logic, but just in case)
        elif len(placed_phrases) > target_phrase_count:
            # Just trim the result to target count
            return grid, placed_phrases[:target_phrase_count]

        attempt += 1

    # If we couldn't get the exact target, return the best result we achieved
    # but ensure we don't return more than the target
    if len(best_placed_phrases) > target_phrase_count:
        best_placed_phrases = best_placed_phrases[:target_phrase_count]

    return best_grid if best_grid is not None else [], best_placed_phrases


@router.get("/phrases")
@rate_limit(max_requests=20, window_seconds=60)  # 20 requests per minute for phrase generation
@cache_response(phrases_cache, "phrases")
async def get_phrases(
    category: str | None = None,
    difficulty: str = "medium",
    language_set_id: int = Query(None),
    refresh: bool = Query(False, description="Force regeneration of puzzle, bypassing cache"),
    *,
    request: Request,
) -> JSONResponse:
    """Get phrases for puzzle generation with language set support and user-specific ignored categories"""
    user = None
    if request:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            try:
                user = verify_token(auth.split(" ", 1)[1])
            except Exception:
                user = None
    ignored_override = None
    if user and language_set_id is not None:
        user_ignored = await db_manager.get_user_ignored_categories(user["id"], language_set_id)
        ignored_override = set(user_ignored)
    categories = await db_manager.get_categories_for_language_set(
        language_set_id, ignored_categories_override=ignored_override
    )

    if not category or category not in categories:
        category = random.choice(categories) if categories else None

    if not category:
        return JSONResponse(
            {"error": "No categories available for the selected language set"},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Get all phrases for the category from the specified language set
    selected = await db_manager.get_phrases(language_set_id, category, ignored_categories_override=ignored_override)

    if not selected:
        return JSONResponse(
            {"error": "No phrases found", "category": category},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    grid_size, num_phrases = get_grid_size_and_num_phrases(selected, difficulty)

    if len(selected) < num_phrases:
        return JSONResponse(
            {
                "error": (
                    f"Not enough phrases in category '{category}'. Need {num_phrases}, but only {len(selected)} available."
                ),
                "category": category,
                "available": len(selected),
                "needed": num_phrases,
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Try to generate grid with exactly the required number of phrases
    grid, placed_phrases = _generate_grid_with_exact_phrase_count(selected, grid_size, num_phrases)

    return JSONResponse({"grid": grid, "phrases": placed_phrases, "category": category})


@router.post("/export")
@rate_limit(max_requests=5, window_seconds=60)  # 5 exports per minute
async def export_puzzle(
    category: str = Body(...), grid: list = Body(...), phrases: list = Body(...), format: str = Body("docx")
) -> StreamingResponse:
    """Export puzzle in specified format (docx or png)"""
    try:
        if format == "docx":
            content = export_to_docx(category, grid, phrases)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"
        elif format == "png":
            content = export_to_png(category, grid, phrases)
            media_type = "image/png"
            extension = "png"
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")

        safe_category = re.sub(r"[^a-z0-9]+", "_", (category or "wordsearch").lower())
        filename = f"wordsearch-{safe_category}.{extension}"

        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/default-ignored-categories")
@cache_response(categories_cache, "default_ignored")
async def get_default_ignored_categories(language_set_id: int = Query(...)) -> JSONResponse:
    """Get default ignored categories for a language set"""
    try:
        categories = await db_manager.get_default_ignored_categories(language_set_id)
        return JSONResponse(sorted(categories))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/user/ignored-categories")
async def get_user_ignored_categories(
    language_set_id: int = Query(...), user=Depends(get_current_user_optional)
) -> JSONResponse:
    if user is None:
        # For non-authenticated users, return empty list (no personal ignored categories)
        return JSONResponse([])

    cats = await db_manager.get_user_ignored_categories(user["id"], language_set_id)
    return JSONResponse(sorted(cats))


@router.put("/user/ignored-categories")
async def put_user_ignored_categories(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    language_set_id = body.get("language_set_id")
    categories = body.get("categories", [])
    if not isinstance(language_set_id, int):
        return JSONResponse({"error": "language_set_id required"}, status_code=400)
    if not isinstance(categories, list):
        return JSONResponse({"error": "categories must be a list"}, status_code=400)

    await db_manager.replace_user_ignored_categories(user["id"], language_set_id, categories)
    return JSONResponse({"message": "Ignored categories updated", "categories": sorted(categories)})


@router.get("/user/ignored-categories/all")
async def get_all_user_ignored_categories(user=Depends(get_current_user)) -> JSONResponse:
    data = await db_manager.get_all_user_ignored_categories(user["id"])
    return JSONResponse(data)


# Game session tracking endpoints


@router.post("/game/start")
async def start_game_session(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Start a new game session for statistics tracking"""
    try:
        language_set_id = body.get("language_set_id")
        category = body.get("category")
        difficulty = body.get("difficulty")
        grid_size = body.get("grid_size")
        total_phrases = body.get("total_phrases")

        if not all([language_set_id, category, difficulty, grid_size, total_phrases]):
            logger.warning(
                "Game start failed: missing required fields",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "Missing required fields: language_set_id, category, difficulty, grid_size, total_phrases"},
                status_code=400,
            )

        # Type validation
        if not isinstance(language_set_id, int) or not isinstance(grid_size, int) or not isinstance(total_phrases, int):
            logger.warning(
                "Game start failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "language_set_id, grid_size, and total_phrases must be integers"}, status_code=400
            )

        if not isinstance(category, str) or not isinstance(difficulty, str):
            logger.warning(
                "Game start failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse({"error": "category and difficulty must be strings"}, status_code=400)

        session_id = await db_manager.start_game_session(
            user["id"], language_set_id, category, difficulty, grid_size, total_phrases
        )

        logger.info(
            "Game session started",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": session_id,
                "language_set_id": language_set_id,
                "category": category,
                "difficulty": difficulty,
                "grid_size": grid_size,
                "total_phrases": total_phrases,
            },
        )

        return JSONResponse({"session_id": session_id, "message": "Game session started"})
    except Exception as e:
        logger.exception(
            "Failed to start game session",
            extra={"user_id": user["id"], "username": user["username"], "error": str(e)},
        )
        return JSONResponse({"error": str(e)}, status_code=500)


@router.put("/game/progress")
async def update_game_progress(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Update game progress (phrases found so far)"""
    try:
        session_id = body.get("session_id")
        phrases_found = body.get("phrases_found")

        if session_id is None or phrases_found is None:
            return JSONResponse({"error": "Missing required fields: session_id, phrases_found"}, status_code=400)

        if not isinstance(session_id, int) or not isinstance(phrases_found, int):
            return JSONResponse({"error": "session_id and phrases_found must be integers"}, status_code=400)

        await db_manager.update_game_progress(session_id, phrases_found)
        return JSONResponse({"message": "Game progress updated"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/game/complete")
async def complete_game_session(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Complete a game session and update statistics"""
    try:
        session_id = body.get("session_id")
        phrases_found = body.get("phrases_found")
        duration_seconds = body.get("duration_seconds")

        if session_id is None or phrases_found is None or duration_seconds is None:
            logger.warning(
                "Game complete failed: missing required fields",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "Missing required fields: session_id, phrases_found, duration_seconds"}, status_code=400
            )

        if (
            not isinstance(session_id, int)
            or not isinstance(phrases_found, int)
            or not isinstance(duration_seconds, int)
        ):
            logger.warning(
                "Game complete failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "session_id, phrases_found, and duration_seconds must be integers"}, status_code=400
            )

        await db_manager.complete_game_session(session_id, phrases_found, duration_seconds)

        logger.info(
            "Game session completed",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": session_id,
                "phrases_found": phrases_found,
                "duration_seconds": duration_seconds,
            },
        )

        return JSONResponse({"message": "Game session completed and statistics updated"})
    except Exception as e:
        logger.exception(
            "Failed to complete game session",
            extra={"user_id": user["id"], "username": user["username"], "error": str(e)},
        )
        return JSONResponse({"error": str(e)}, status_code=500)


# User preferences endpoints


@router.get("/user/preferences")
async def get_user_preferences(user=Depends(get_current_user)) -> JSONResponse:
    """Get all user preferences"""
    try:
        preferences = await db_manager.get_user_preferences(user["id"])
        return JSONResponse(preferences)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.put("/user/preferences")
async def set_user_preference(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Set a user preference"""
    try:
        preference_key = body.get("preference_key")
        preference_value = body.get("preference_value")

        if not preference_key or preference_value is None:
            return JSONResponse({"error": "Missing required fields: preference_key, preference_value"}, status_code=400)

        if not isinstance(preference_key, str) or not isinstance(preference_value, str):
            return JSONResponse({"error": "preference_key and preference_value must be strings"}, status_code=400)

        await db_manager.set_user_preference(user["id"], preference_key, preference_value)
        return JSONResponse({"message": "Preference updated successfully"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user/scoring-enabled")
async def get_user_scoring_enabled(user=Depends(get_current_user)) -> JSONResponse:
    """Get scoring enabled status for current user"""
    try:
        enabled = await db_manager.is_scoring_enabled_for_user(user["id"])
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user/progressive-hints-enabled")
async def get_user_progressive_hints_enabled(user=Depends(get_current_user)) -> JSONResponse:
    """Get progressive hints enabled status for current user"""
    try:
        enabled = await db_manager.is_progressive_hints_enabled_for_user(user["id"])
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Scoring system endpoints


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


# User Private Lists - Learn This Later endpoints
@router.post("/user/learn-later/check")
@rate_limit(max_requests=30, window_seconds=60)
async def check_phrases_in_learn_later(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Check which phrases are already in user's Learn This Later list"""
    try:
        language_set_id = body.get("language_set_id")
        phrase_ids = body.get("phrase_ids", [])

        if not language_set_id or not phrase_ids:
            return JSONResponse({"in_list": []})

        # Get "Learn This Later" list (don't create if doesn't exist)
        learn_later_list = await db_manager.get_learn_later_list(user["id"], language_set_id, create_if_missing=False)

        if not learn_later_list:
            return JSONResponse({"in_list": []})

        # Check which phrases are already in the list
        existing_phrases = await db_manager.get_phrase_ids_in_private_list(learn_later_list["id"], phrase_ids)

        return JSONResponse({"in_list": existing_phrases, "total_in_list": len(existing_phrases)})

    except Exception:
        logger.exception("Failed to check phrases in Learn This Later")
        return JSONResponse({"in_list": []}, status_code=200)  # Fail gracefully


@router.post("/user/learn-later/bulk")
@rate_limit(max_requests=20, window_seconds=60)
async def bulk_add_to_learn_later(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Add multiple phrases to user's Learn This Later list"""
    try:
        language_set_id = body.get("language_set_id")
        phrase_ids = body.get("phrase_ids", [])

        if not language_set_id or not phrase_ids:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Get or create "Learn This Later" list
        learn_later_list = await db_manager.get_or_create_learn_later_list(user["id"], language_set_id)

        # Add phrases (automatically skips duplicates)
        added_count = await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list["id"], phrase_ids, language_set_id, skip_duplicates=True
        )

        return JSONResponse(
            {
                "message": "Phrases added successfully",
                "added_count": added_count,
                "skipped": len(phrase_ids) - added_count,
                "list_id": learn_later_list["id"],
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add phrases to Learn This Later")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists")
@rate_limit(max_requests=30, window_seconds=60)
async def get_user_private_lists(language_set_id: int = Query(None), user=Depends(get_current_user)) -> JSONResponse:
    """Get all private lists for the current user, optionally filtered by language set"""
    try:
        lists = await db_manager.get_user_private_lists(user["id"], language_set_id)

        # Enrich with phrase counts
        enriched_lists = []
        for list_info in lists:
            phrase_count = await db_manager.get_private_list_phrase_count(list_info["id"])
            enriched_lists.append({**list_info, "phrase_count": phrase_count})

        return JSONResponse(enriched_lists)
    except Exception as e:
        logger.exception("Failed to get user private lists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists/{list_id}/phrases")
@rate_limit(max_requests=20, window_seconds=60)
async def get_private_list_phrases_endpoint(
    list_id: int,
    language_set_id: int = Query(...),
    category: str = Query(None),
    difficulty: str = Query("medium"),
    refresh: bool = Query(False),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Get phrases from a private list for puzzle generation, with optional category filter"""
    try:
        # Get phrases from the private list
        all_phrases = await db_manager.get_private_list_phrases(list_id, user["id"], language_set_id, category=category)

        if not all_phrases:
            return JSONResponse({"error": "No phrases found in this list"}, status_code=status.HTTP_404_NOT_FOUND)

        # Use the same grid generation logic as regular puzzles
        grid_size, num_phrases = get_grid_size_and_num_phrases(all_phrases, difficulty)

        if len(all_phrases) < num_phrases:
            return JSONResponse(
                {
                    "error": "Not enough phrases",
                    "available": len(all_phrases),
                    "required": num_phrases,
                    "grid_size": grid_size,
                },
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Generate grid with exact phrase count
        grid, selected_phrases = _generate_grid_with_exact_phrase_count(all_phrases, grid_size, num_phrases)

        response_data = {
            "grid": grid,
            "phrases": selected_phrases,
            "grid_size": grid_size,
            "difficulty": difficulty,
            "category": category or "Mixed",
            "source": "private_list",
            "list_id": list_id,
        }

        return JSONResponse(response_data)

    except Exception as e:
        logger.exception(f"Failed to get phrases from private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/private-lists")
@rate_limit(max_requests=10, window_seconds=60)
async def create_private_list(list_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Create a new private list for the current user"""
    try:
        list_name = list_data.get("list_name", "").strip()
        language_set_id = list_data.get("language_set_id")

        if not list_name:
            return JSONResponse({"error": "List name is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        if not language_set_id:
            return JSONResponse({"error": "Language set ID is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Check if user already has a list with this name in this language set
        existing_lists = await db_manager.get_user_private_lists(user["id"], language_set_id)
        if any(lst["list_name"].lower() == list_name.lower() for lst in existing_lists):
            return JSONResponse({"error": "A list with this name already exists"}, status_code=status.HTTP_409_CONFLICT)

        # Create the list
        list_id = await db_manager.create_private_list(user["id"], list_name, language_set_id, is_system_list=False)

        return JSONResponse(
            {
                "id": list_id,
                "list_name": list_name,
                "language_set_id": language_set_id,
                "is_system_list": False,
                "phrase_count": 0,
            },
            status_code=status.HTTP_201_CREATED,
        )

    except Exception as e:
        logger.exception("Failed to create private list")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/private-lists/{list_id}")
@rate_limit(max_requests=20, window_seconds=60)
async def update_private_list(list_id: int, list_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Update a private list (rename only, cannot modify system lists)"""
    try:
        new_name = list_data.get("list_name", "").strip()

        if not new_name:
            return JSONResponse({"error": "List name is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Get the list to verify ownership and check if it's a system list
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        if list_info["is_system_list"]:
            return JSONResponse({"error": "Cannot rename system lists"}, status_code=status.HTTP_403_FORBIDDEN)

        # Check for name conflicts in the same language set
        existing_lists = await db_manager.get_user_private_lists(user["id"], list_info["language_set_id"])
        if any(lst["id"] != list_id and lst["list_name"].lower() == new_name.lower() for lst in existing_lists):
            return JSONResponse({"error": "A list with this name already exists"}, status_code=status.HTTP_409_CONFLICT)

        # Update the list name
        await db_manager.update_private_list_name(list_id, new_name)

        return JSONResponse({"id": list_id, "list_name": new_name, "message": "List renamed successfully"})

    except Exception as e:
        logger.exception(f"Failed to update private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/private-lists/{list_id}")
@rate_limit(max_requests=20, window_seconds=60)
async def delete_private_list_endpoint(list_id: int, user=Depends(get_current_user)) -> JSONResponse:
    """Delete a private list (cannot delete system lists)"""
    try:
        # Get the list to verify ownership and check if it's a system list
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        if list_info["is_system_list"]:
            return JSONResponse({"error": "Cannot delete system lists"}, status_code=status.HTTP_403_FORBIDDEN)

        # Delete the list (cascade will remove all phrases)
        await db_manager.delete_private_list(list_id, user["id"])

        return JSONResponse({"message": "List deleted successfully", "id": list_id})

    except Exception as e:
        logger.exception(f"Failed to delete private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/private-lists/{list_id}/phrases")
@rate_limit(max_requests=30, window_seconds=60)
async def add_phrase_to_private_list(list_id: int, phrase_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Add a phrase to a private list (either by ID or as custom phrase)"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        phrase_id = phrase_data.get("phrase_id")
        custom_phrase = phrase_data.get("custom_phrase", "").strip()
        custom_translation = phrase_data.get("custom_translation", "").strip()
        custom_categories = phrase_data.get("custom_categories", "").strip()

        # Must provide either phrase_id OR custom phrase data
        if not phrase_id and not custom_phrase:
            return JSONResponse(
                {"error": "Must provide either phrase_id or custom_phrase"}, status_code=status.HTTP_400_BAD_REQUEST
            )

        if phrase_id and custom_phrase:
            return JSONResponse(
                {"error": "Cannot provide both phrase_id and custom_phrase"}, status_code=status.HTTP_400_BAD_REQUEST
            )

        # Add the phrase
        added_id = await db_manager.add_phrase_to_private_list(
            list_id=list_id,
            phrase_id=phrase_id,
            custom_phrase=custom_phrase if custom_phrase else None,
            custom_translation=custom_translation if custom_translation else None,
            custom_categories=custom_categories if custom_categories else None,
        )

        return JSONResponse(
            {"id": added_id, "list_id": list_id, "message": "Phrase added successfully"},
            status_code=status.HTTP_201_CREATED,
        )

    except Exception as e:
        logger.exception(f"Failed to add phrase to private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/private-lists/{list_id}/phrases/{phrase_entry_id}")
@rate_limit(max_requests=30, window_seconds=60)
async def remove_phrase_from_private_list(
    list_id: int, phrase_entry_id: int, user=Depends(get_current_user)
) -> JSONResponse:
    """Remove a phrase from a private list"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        # Remove the phrase
        success = await db_manager.remove_phrase_from_private_list(list_id, phrase_entry_id)

        if not success:
            return JSONResponse({"error": "Phrase not found in this list"}, status_code=status.HTTP_404_NOT_FOUND)

        return JSONResponse(
            {"message": "Phrase removed successfully", "list_id": list_id, "phrase_entry_id": phrase_entry_id}
        )

    except Exception as e:
        logger.exception(f"Failed to remove phrase from private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))
