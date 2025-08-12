import io
import random
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from osmosmjerka.auth import get_current_user, verify_token
from osmosmjerka.database import db_manager
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.utils import export_to_docx, export_to_png

router = APIRouter(prefix="/api")


@router.get("/language-sets")
async def get_language_sets() -> JSONResponse:
    """Get all active language sets with default first"""
    language_sets = await db_manager.get_language_sets(active_only=True)
    return JSONResponse(language_sets)


@router.get("/categories")
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
async def get_phrases(
    category: str | None = None,
    difficulty: str = "medium",
    language_set_id: int = Query(None),
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
async def get_default_ignored_categories(language_set_id: int = Query(...)) -> JSONResponse:
    """Get default ignored categories for a language set"""
    try:
        categories = await db_manager.get_default_ignored_categories(language_set_id)
        return JSONResponse(sorted(categories))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/user/ignored-categories")
async def get_user_ignored_categories(
    language_set_id: int = Query(...), user=Depends(get_current_user)
) -> JSONResponse:
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
