import io
import random
import re
import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from osmosmjerka.auth import get_current_user, get_current_user_optional, require_admin_access, verify_token
from osmosmjerka.cache import cache_response, categories_cache, language_sets_cache, phrases_cache, rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.utils import export_to_docx, export_to_png

router = APIRouter(prefix="/api")


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
    if difficulty == "easy":
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

    if len(selected) > num_phrases:
        selected = random.sample(selected, num_phrases)
    else:
        random.shuffle(selected)

    # Generate the grid using selected phrases
    result = generate_grid(selected, grid_size)
    grid, placed_phrases = result

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
            return JSONResponse(
                {"error": "Missing required fields: language_set_id, category, difficulty, grid_size, total_phrases"},
                status_code=400,
            )

        # Type validation
        if not isinstance(language_set_id, int) or not isinstance(grid_size, int) or not isinstance(total_phrases, int):
            return JSONResponse(
                {"error": "language_set_id, grid_size, and total_phrases must be integers"}, status_code=400
            )

        if not isinstance(category, str) or not isinstance(difficulty, str):
            return JSONResponse({"error": "category and difficulty must be strings"}, status_code=400)

        session_id = await db_manager.start_game_session(
            user["id"], language_set_id, category, difficulty, grid_size, total_phrases
        )

        return JSONResponse({"session_id": session_id, "message": "Game session started"})
    except Exception as e:
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
            return JSONResponse(
                {"error": "Missing required fields: session_id, phrases_found, duration_seconds"}, status_code=400
            )

        if (
            not isinstance(session_id, int)
            or not isinstance(phrases_found, int)
            or not isinstance(duration_seconds, int)
        ):
            return JSONResponse(
                {"error": "session_id, phrases_found, and duration_seconds must be integers"}, status_code=400
            )

        await db_manager.complete_game_session(session_id, phrases_found, duration_seconds)
        return JSONResponse({"message": "Game session completed and statistics updated"})
    except Exception as e:
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
            return JSONResponse(
                {"error": "Missing required fields: preference_key, preference_value"}, status_code=400
            )

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
        if (session_id is None or language_set_id is None or category is None or 
            difficulty is None or grid_size is None or total_phrases is None or 
            phrases_found is None or duration_seconds is None):
            return JSONResponse(
                {"error": "Missing required fields"}, status_code=400
            )

        # Type validation
        if (not isinstance(session_id, int) or not isinstance(language_set_id, int) or
            not isinstance(grid_size, int) or not isinstance(total_phrases, int) or
            not isinstance(phrases_found, int) or not isinstance(duration_seconds, int) or
            not isinstance(hints_used, int) or not isinstance(category, str) or
            not isinstance(difficulty, str)):
            return JSONResponse(
                {"error": "Invalid field types"}, status_code=400
            )

        # Calculate scoring
        scoring_result = calculate_game_score(
            difficulty, phrases_found, total_phrases, duration_seconds, hints_used
        )

        # Convert datetime strings to datetime objects if provided
        first_phrase_dt = None
        completion_dt = None
        if first_phrase_time:
            try:
                # Parse timezone-aware datetime and convert to naive UTC
                dt_aware = datetime.datetime.fromisoformat(first_phrase_time.replace('Z', '+00:00'))
                first_phrase_dt = dt_aware.replace(tzinfo=None)
            except ValueError:
                pass
        if completion_time:
            try:
                # Parse timezone-aware datetime and convert to naive UTC
                dt_aware = datetime.datetime.fromisoformat(completion_time.replace('Z', '+00:00'))
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
            completion_time=completion_dt
        )

        return JSONResponse({
            "score_id": score_id,
            "scoring_details": scoring_result,
            "message": "Score saved successfully"
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user/best-scores")
async def get_user_best_scores(
    language_set_id: int = Query(None),
    category: str = Query(None),
    difficulty: str = Query(None),
    limit: int = Query(10),
    user=Depends(get_current_user)
) -> JSONResponse:
    """Get user's best scores"""
    try:
        scores = await db_manager.get_user_best_scores(
            user["id"], language_set_id, category, difficulty, limit
        )
        return JSONResponse(scores)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/leaderboard")
async def get_leaderboard(
    language_set_id: int = Query(None),
    category: str = Query(None),
    difficulty: str = Query(None),
    limit: int = Query(50)
) -> JSONResponse:
    """Get global leaderboard"""
    try:
        leaderboard = await db_manager.get_leaderboard(language_set_id, category, difficulty, limit)
        return JSONResponse(leaderboard)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


def calculate_game_score(difficulty: str, phrases_found: int, total_phrases: int, 
                        duration_seconds: int, hints_used: int) -> dict:
    """Calculate game score based on various factors"""
    
    # Base score: 100 points per phrase found
    base_score = phrases_found * 100
    
    # Difficulty multipliers
    difficulty_multipliers = {
        "easy": 1.0,
        "medium": 1.2,
        "hard": 1.5,
        "very_hard": 2.0
    }
    difficulty_bonus = int(base_score * (difficulty_multipliers.get(difficulty, 1.0) - 1.0))
    
    # Time bonus (faster completion = higher bonus)
    # Maximum time bonus is 50% of base score for very fast completion
    if phrases_found == total_phrases and duration_seconds > 0:
        # Target times per difficulty (in seconds)
        target_times = {
            "easy": 300,      # 5 minutes
            "medium": 600,    # 10 minutes
            "hard": 900,      # 15 minutes
            "very_hard": 1200 # 20 minutes
        }
        target_time = target_times.get(difficulty, 600)
        
        if duration_seconds <= target_time:
            time_ratio = max(0, (target_time - duration_seconds) / target_time)
            time_bonus = int(base_score * 0.5 * time_ratio)
        else:
            time_bonus = 0
    else:
        time_bonus = 0
    
    # Streak bonus for completing all phrases
    streak_bonus = 200 if phrases_found == total_phrases else 0
    
    # Hint penalty: -50 points per hint used
    hint_penalty = hints_used * 50
    
    # Calculate final score
    final_score = max(0, base_score + difficulty_bonus + time_bonus + streak_bonus - hint_penalty)
    
    return {
        "base_score": base_score,
        "difficulty_bonus": difficulty_bonus,
        "time_bonus": time_bonus,
        "streak_bonus": streak_bonus,
        "hint_penalty": hint_penalty,
        "final_score": final_score,
        "hints_used": hints_used
    }


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
