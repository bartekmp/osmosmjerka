import io
import random
from contextlib import asynccontextmanager

import bcrypt
from fastapi import Body, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import PASSWORD_HASH, USERNAME, create_access_token, get_current_user
from osmosmjerka.database import IGNORED_CATEGORIES
from osmosmjerka.database import add_word as db_add_word
from osmosmjerka.database import clear_all_words, connect_db, create_tables
from osmosmjerka.database import delete_word as db_delete_word
from osmosmjerka.database import disconnect_db, fast_bulk_insert_words
from osmosmjerka.database import get_categories as db_get_categories
from osmosmjerka.database import get_word_count
from osmosmjerka.database import get_words as db_get_words
from osmosmjerka.database import update_word as db_update_word
from osmosmjerka.grid_generator import generate_grid, normalize_word
from osmosmjerka.utils import export_to_docx, export_to_pdf, export_to_png

# List of API endpoints that should be ignored for the SPA routing
# This is used to ensure that the SPA does not interfere with API calls.
API_ENDPOINTS = ["api/", "admin/"]


# Initialize the FastAPI application
@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_db()
    create_tables()
    yield
    await disconnect_db()


app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files at /static
app.mount("/static", StaticFiles(directory="static", html=True), name="static")


@app.get("/admin/status")
def admin_status(user=Depends(get_current_user)) -> JSONResponse:
    return JSONResponse({"status": "ok"}, status_code=status.HTTP_200_OK)


@app.get("/admin/rows")
async def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    user=Depends(get_current_user),
) -> dict:
    rows = await db_get_words(category, limit, offset)
    total = await get_word_count(category)
    return {"rows": rows, "total": total}


@app.post("/admin/row")
async def add_row(row: dict, user=Depends(get_current_user)) -> JSONResponse:
    await db_add_word(row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row added"}, status_code=status.HTTP_201_CREATED)


@app.put("/admin/row/{id}")
async def update_row(id: int, row: dict, user=Depends(get_current_user)) -> JSONResponse:
    await db_update_word(id, row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row updated"}, status_code=status.HTTP_200_OK)


@app.delete("/admin/row/{id}")
async def delete_row(id: int, user=Depends(get_current_user)) -> JSONResponse:
    await db_delete_word(id)
    return JSONResponse({"message": "Row deleted"}, status_code=status.HTTP_200_OK)


@app.delete("/admin/clear")
async def clear_db(user=Depends(get_current_user)) -> JSONResponse:
    await clear_all_words()
    return JSONResponse({"message": "Database cleared"}, status_code=status.HTTP_200_OK)


@app.post("/admin/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)) -> JSONResponse:
    content = await file.read()
    content = content.decode("utf-8")

    # Parse and insert words (implement parsing logic as needed)
    # For now, assuming CSV format: categories,word,translation
    lines = content.strip().split("\n")[1:]  # Skip header
    words_data = []
    for line in lines:
        parts = line.split(",")
        if len(parts) >= 3:
            words_data.append(
                {"categories": parts[0].strip(), "word": parts[1].strip(), "translation": parts[2].strip()}
            )

    if words_data:
        # Use fast bulk insert for large uploads
        await run_in_threadpool(fast_bulk_insert_words, words_data)
        return JSONResponse({"message": f"Uploaded {len(words_data)} words"}, status_code=status.HTTP_201_CREATED)
    else:
        return JSONResponse({"message": "Upload failed"}, status_code=status.HTTP_400_BAD_REQUEST)


@app.get("/api/categories")
async def get_all_categories() -> JSONResponse:
    all_categories = await db_get_categories()
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


@app.get("/api/words")
async def get_words(category: str | None = None, difficulty: str = "medium") -> JSONResponse:
    categories = await db_get_categories()

    if not category or category not in categories:
        category = random.choice(categories)

    # Get all words for the category
    selected = await db_get_words(category)

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


@app.post("/api/export")
async def export_puzzle(
    category: str = Body(...), grid: list = Body(...), words: list = Body(...), format: str = Body("docx")
) -> StreamingResponse:
    """Export puzzle in specified format (docx, pdf, or png)"""
    try:
        if format == "pdf":
            content = export_to_pdf(category, grid, words)
            media_type = "application/pdf"
            extension = "pdf"
        elif format == "png":
            content = export_to_png(category, grid, words)
            media_type = "image/png"
            extension = "png"
        else:  # Default to docx
            content = export_to_docx(category, grid, words)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"

        import re

        safe_category = re.sub(r"[^a-z0-9]+", "_", (category or "wordsearch").lower())
        filename = f"wordsearch-{safe_category}.{extension}"

        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.post("/admin/login")
async def login(username: str = Body(...), password: str = Body(...)) -> JSONResponse:
    if username == USERNAME and bcrypt.checkpw(
        password.encode("utf-8"), PASSWORD_HASH.encode("utf-8") if isinstance(PASSWORD_HASH, str) else PASSWORD_HASH
    ):
        token = create_access_token(data={"sub": username})
        return JSONResponse({"access_token": token, "token_type": "bearer"})
    return JSONResponse({"error": "Invalid credentials"}, status_code=status.HTTP_401_UNAUTHORIZED)


@app.get("/admin/ignored-categories")
@app.get("/api/ignored-categories")
def get_ignored_categories() -> JSONResponse:
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))


@app.get("/admin/export")
async def export_data(category: str = Query(None), user=Depends(get_current_user)) -> StreamingResponse:
    rows = await db_get_words(category)

    output = io.StringIO()
    output.write("categories,word,translation\n")

    for row in rows:
        categories = row["categories"].replace(",", ";")  # Replace commas in categories to avoid CSV issues
        output.write(f"{categories},{row['word']},{row['translation']}\n")

    content = output.getvalue()
    output.close()

    filename = f"export_{category or 'all'}.txt"

    return StreamingResponse(
        io.StringIO(content),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# Serve the SPA for all non-API routes
@app.get("/{path:path}")
async def serve_spa(request: Request, path: str):
    """Serve the Single Page Application for all non-API routes."""
    # Check if the request is for an API endpoint
    if any(path.startswith(endpoint) for endpoint in API_ENDPOINTS):
        # This shouldn't happen if routing is correct, but just in case
        return JSONResponse({"error": "Not found"}, status_code=404)

    # Serve the SPA
    return FileResponse("static/index.html")
