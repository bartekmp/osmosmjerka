"""Phrase and category endpoints for game API."""

import random

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import verify_token
from osmosmjerka.cache import cache_response, categories_cache, language_sets_cache, phrases_cache, rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.game_api.helpers import _generate_grid_with_exact_phrase_count, get_grid_size_and_num_phrases
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


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


@router.get("/phrases")
@rate_limit(max_requests=20, window_seconds=60)  # 20 requests per minute for phrase generation
@cache_response(phrases_cache, "phrases")
async def get_phrases(
    category: str | None = None,
    difficulty: str = "medium",
    language_set_id: int = Query(None),
    game_type: str = Query("word_search", description="Game type: 'word_search' or 'crossword'"),
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

    # Treat "ALL" as None to get phrases from all categories
    category_filter = None if category == "ALL" else category

    # Only auto-select a category if category was not explicitly provided (or was invalid)
    # Don't override "ALL" selection
    if category != "ALL":
        if not category_filter or (category_filter and category_filter not in categories):
            category_filter = random.choice(categories) if categories else None  # noqa: S311
        if not category_filter and not categories:
            return JSONResponse(
                {"error_code": "NO_CATEGORIES_AVAILABLE"},
                status_code=status.HTTP_404_NOT_FOUND,
            )
    elif not categories:
        # If "ALL" was selected but no categories exist, return error
        return JSONResponse(
            {"error_code": "NO_CATEGORIES_AVAILABLE"},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Get all phrases for the category from the specified language set
    # If category_filter is None, get phrases from all categories
    selected = await db_manager.get_phrases(
        language_set_id, category_filter, ignored_categories_override=ignored_override
    )

    if not selected:
        return JSONResponse(
            {"error_code": "NO_PHRASES_FOUND", "category": category},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    grid_size, num_phrases = get_grid_size_and_num_phrases(selected, difficulty)

    if len(selected) < num_phrases:
        return JSONResponse(
            {
                "error_code": "NOT_ENOUGH_PHRASES_IN_CATEGORY",
                "category": category_filter or "ALL",
                "available": len(selected),
                "needed": num_phrases,
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Try to generate grid with exactly the required number of phrases
    grid, placed_phrases = _generate_grid_with_exact_phrase_count(selected, grid_size, num_phrases, game_type)

    # Use the original category value for response (preserve "ALL" if it was selected)
    response_category = category if category == "ALL" else (category_filter or "Mixed")

    return JSONResponse(
        {
            "grid": grid,
            "phrases": placed_phrases,
            "category": response_category,
            "game_type": game_type,
        }
    )


@router.get("/default-ignored-categories")
@cache_response(categories_cache, "default_ignored")
async def get_default_ignored_categories(language_set_id: int = Query(...)) -> JSONResponse:
    """Get default ignored categories for a language set"""
    try:
        categories = await db_manager.get_default_ignored_categories(language_set_id)
        return JSONResponse(sorted(categories))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
