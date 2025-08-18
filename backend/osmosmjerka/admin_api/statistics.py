"""Statistics endpoints for admin API"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from osmosmjerka.auth import get_current_user, require_admin_access
from osmosmjerka.database import db_manager

router = APIRouter(prefix="/statistics")


@router.get("/overview")
async def get_statistics_overview(user=Depends(require_admin_access)) -> JSONResponse:
    """Get overall statistics overview for admin dashboard"""
    try:
        overview = await db_manager.get_admin_statistics_overview()
        return JSONResponse(overview)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/by-language-set")
async def get_statistics_by_language_set(
    language_set_id: int = Query(None), user=Depends(require_admin_access)
) -> JSONResponse:
    """Get statistics grouped by language set"""
    try:
        stats = await db_manager.get_statistics_by_language_set(language_set_id)
        return JSONResponse(stats)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/users")
async def get_user_statistics_list(
    language_set_id: int = Query(None), limit: int = Query(50, ge=1, le=200), user=Depends(require_admin_access)
) -> JSONResponse:
    """Get statistics for all users, optionally filtered by language set"""
    try:
        stats = await db_manager.get_user_statistics_list(language_set_id, limit)
        return JSONResponse(stats)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user/{user_id}")
async def get_user_statistics_detail(
    user_id: int, language_set_id: int = Query(None), user=Depends(require_admin_access)
) -> JSONResponse:
    """Get detailed statistics for a specific user"""
    try:
        # Get user information to include username
        user_info = await db_manager.get_account_by_id(user_id)
        if not user_info:
            return JSONResponse({"error": "User not found"}, status_code=404)

        stats = await db_manager.get_user_statistics(user_id, language_set_id)
        favorite_categories = []

        if language_set_id:
            favorite_categories = await db_manager.get_user_favorite_categories(user_id, language_set_id)
        else:
            # Get favorite categories for all language sets
            language_sets = await db_manager.get_language_sets(active_only=True)
            for lang_set in language_sets:
                cats = await db_manager.get_user_favorite_categories(user_id, lang_set["id"])
                if cats:
                    favorite_categories.append(
                        {
                            "language_set_id": lang_set["id"],
                            "language_set_name": lang_set["display_name"],
                            "categories": cats,
                        }
                    )

        return JSONResponse(
            {
                "user": {"id": user_info["id"], "username": user_info["username"], "role": user_info["role"]},
                "statistics": stats,
                "favorite_categories": favorite_categories,
            }
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/user-profile")
async def get_current_user_statistics(user=Depends(get_current_user)) -> JSONResponse:
    """Get statistics for the currently logged-in user"""
    try:
        # Get overall statistics
        overall_stats = await db_manager.get_user_statistics(user["id"])

        # Get statistics by language set
        language_sets = await db_manager.get_language_sets(active_only=True)
        language_set_stats = []

        for lang_set in language_sets:
            stats = await db_manager.get_user_statistics(user["id"], lang_set["id"])
            favorite_categories = await db_manager.get_user_favorite_categories(user["id"], lang_set["id"])

            # Only include language sets with activity
            if stats["games_started"] > 0:
                language_set_stats.append(
                    {
                        "language_set": {
                            "id": lang_set["id"],
                            "name": lang_set["name"],
                            "display_name": lang_set["display_name"],
                        },
                        "statistics": stats,
                        "favorite_categories": favorite_categories,
                    }
                )

        return JSONResponse({"overall_statistics": overall_stats, "language_set_statistics": language_set_stats})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/leaderboard")
async def get_admin_leaderboard(
    language_set_id: int = Query(None),
    category: str = Query(None),
    difficulty: str = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_admin_access)
) -> JSONResponse:
    """Get leaderboard for admin statistics dashboard"""
    try:
        leaderboard = await db_manager.get_leaderboard(language_set_id, category, difficulty, limit)
        return JSONResponse(leaderboard)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
