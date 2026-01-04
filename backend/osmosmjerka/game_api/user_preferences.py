"""User preferences endpoints for game API."""

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user, get_current_user_optional
from osmosmjerka.database import db_manager

router = APIRouter()


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
