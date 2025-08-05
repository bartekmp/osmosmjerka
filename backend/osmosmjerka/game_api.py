import io
import random
import re

from fastapi import APIRouter, Body, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse

from osmosmjerka.database import IGNORED_CATEGORIES, db_manager
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.utils import export_to_docx, export_to_png

router = APIRouter(prefix="/api")


@router.get("/categories")
async def get_all_categories() -> JSONResponse:
    all_categories = await db_manager.get_categories()
    filtered = [cat for cat in all_categories if cat not in IGNORED_CATEGORIES]
    return JSONResponse(sorted(filtered))


def get_grid_size_and_num_words(selected: list, difficulty: str) -> tuple:
    """Get grid size and number of words based on difficulty and available words."""
    if difficulty == "easy":
        grid_size = 10
        num_words = 7
    elif difficulty == "medium":
        grid_size = 15
        num_words = 12
    elif difficulty == "hard":
        grid_size = 20
        num_words = 16
    elif difficulty == "dynamic":
        longest_word = max(len(word["word"].replace(" ", "")) for word in selected) if selected else 10
        grid_size = longest_word
        num_words = len(selected)
    else:
        grid_size = 10
        num_words = 7

    return grid_size, num_words


@router.get("/words")
async def get_words(category: str | None = None, difficulty: str = "medium") -> JSONResponse:
    categories = await db_manager.get_categories()

    if not category or category not in categories:
        category = random.choice(categories)

    # Get all words for the category
    selected = await db_manager.get_words(category)

    if not selected:
        return JSONResponse(
            {"error": "No words found", "category": category},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    grid_size, num_words = get_grid_size_and_num_words(selected, difficulty)

    if len(selected) < num_words:
        return JSONResponse(
            {
                "error": (
                    f"Not enough words in category '{category}'. Need {num_words}, but only {len(selected)} available."
                ),
                "category": category,
                "available": len(selected),
                "needed": num_words,
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if len(selected) > num_words:
        selected = random.sample(selected, num_words)
    else:
        random.shuffle(selected)

    grid, placed_words = generate_grid(selected, grid_size)

    return JSONResponse({"grid": grid, "words": placed_words, "category": category})


@router.post("/export")
async def export_puzzle(
    category: str = Body(...), grid: list = Body(...), words: list = Body(...), format: str = Body("docx")
) -> StreamingResponse:
    """Export puzzle in specified format (docx or png)"""
    try:
        if format == "docx":
            content = export_to_docx(category, grid, words)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"
        elif format == "png":
            content = export_to_png(category, grid, words)
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


@router.get("/ignored-categories")
def get_ignored_categories() -> JSONResponse:
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))
