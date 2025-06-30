import io
import random
from contextlib import asynccontextmanager

import bcrypt
from auth import PASSWORD_HASH, USERNAME, create_access_token, get_current_user
from fastapi import (Body, Depends, FastAPI, File, Query, Request, UploadFile,
                     status)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from utils import export_to_docx
from wordsearch import generate_grid

from db import (IGNORED_CATEGORIES, add_word, delete_all_words, delete_word,
                get_all_words, get_categories, get_words_by_category, init_db,
                insert_words, update_word)

# List of API endpoints that should be ignored for the SPA routing
# This is used to ensure that the SPA does not interfere with API calls.
API_ENDPOINTS = ["api/", "admin/"]


# Initialize the FastAPI application
@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


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
def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    user=Depends(get_current_user),
) -> dict:
    rows, total = get_all_words(offset, limit, category)
    return {
        "rows": [
            {"id": r[0], "categories": r[1], "word": r[2], "translation": r[3]}
            for r in rows
        ],
        "total": total,
    }


@app.post("/admin/row")
def add_row(row: dict, user=Depends(get_current_user)) -> JSONResponse:
    add_word(row["categories"], row["word"], row["translation"])
    return JSONResponse({"status": "ok"})


@app.put("/admin/row/{id}")
def update_row(id: int, row: dict, user=Depends(get_current_user)) -> JSONResponse:
    update_word(id, row["categories"], row["word"], row["translation"])
    return JSONResponse({"status": "ok"})


@app.delete("/admin/row/{id}")
def delete_row(id: int, row: dict, user=Depends(get_current_user)) -> JSONResponse:
    delete_word(id)
    return JSONResponse({"status": "deleted"})


@app.delete("/admin/clear")
def clear_db(user=Depends(get_current_user)) -> JSONResponse:
    delete_all_words()
    return JSONResponse({"status": "cleared"})


@app.post("/admin/upload")
async def upload(
    file: UploadFile = File(...), user=Depends(get_current_user)
) -> JSONResponse:
    content = (await file.read()).decode("utf-8")
    success, error = insert_words(content)
    if not success:
        return JSONResponse({"detail": error}, status_code=400)
    return JSONResponse({"status": "uploaded"})


@app.get("/api/categories")
async def get_all_categories() -> JSONResponse:
    all_categories = get_categories()
    filtered = [cat for cat in all_categories if cat not in IGNORED_CATEGORIES]
    return JSONResponse(filtered)


def get_grid_size_and_num_words(selected: list, difficulty: str) -> tuple:
    """Determine the grid size and number of words based on difficulty level.
    Args:
        selected (list): List of selected words.
        difficulty (str): Difficulty level ("easy", "medium", "hard", "dynamic").
    Returns:
        tuple: (size, num_words) where size is the grid size and num_words is the number of words to place.
    """
    if difficulty == "easy":
        return 10, 7
    elif difficulty == "medium":
        return 15, 12
    elif difficulty == "hard":
        return 20, 18
    elif difficulty == "dynamic":
        size = (
            max(len(w["word"].replace(" ", "")) for w in selected) if selected else 10
        )
        num_words = min(25, len(selected))
        return size, num_words
    else:
        return 10, 7


@app.get("/api/words")
async def get_words(
    category: str | None = None, difficulty: str = "medium"
) -> JSONResponse:
    categories = get_categories()
    if not category:
        category = random.choice(categories)
    selected = get_words_by_category(category, ignored_categories=IGNORED_CATEGORIES)
    if not selected:
        return JSONResponse({"grid": [], "words": []})

    if difficulty not in ["easy", "medium", "hard", "dynamic"]:
        return JSONResponse(
            {"detail": "Invalid difficulty level"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    size, num_words = get_grid_size_and_num_words(selected, difficulty)

    if len(selected) < num_words:
        return JSONResponse(
            {"detail": "Not enough words in the selected category"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if len(selected) > num_words:
        selected = random.sample(selected, num_words)
    else:
        random.shuffle(selected)

    grid, placed_words = generate_grid(selected, size=size)
    return JSONResponse({"grid": grid, "words": placed_words})


@app.post("/api/export")
async def export(request: Request) -> StreamingResponse:
    data = await request.json()
    docx_bytes = export_to_docx(data["category"], data["grid"], data["words"])
    file_like = io.BytesIO(docx_bytes)
    file_like.seek(0)
    return StreamingResponse(
        file_like,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="wordsearch-{data["category"]}.docx"'
        },
    )


@app.get("/api/ignored_categories")
async def get_ignored_categories() -> JSONResponse:
    """Return the list of ignored categories.
    Returns:
        JSONResponse: A sorted list of ignored categories.
    """
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))


@app.get("/admin/export")
def export_txt(category: str = Query(None), user=Depends(get_current_user)):
    # Download all words for the category
    rows, _ = get_all_words(0, None, category)

    def row_to_line(row):
        # row: (id, categories, word, translation)
        return f"{row[1]};{row[2]};{row[3]}"

    content = "\n".join(row_to_line(row) for row in rows)
    file_like = io.BytesIO(content.encode("utf-8"))
    filename = f"export_{category or 'all'}.txt"
    return StreamingResponse(
        file_like,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/admin/login")
def admin_login(data: dict = Body(...)):
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return JSONResponse({"detail": "Missing credentials"}, status_code=400)
    if username != USERNAME or not bcrypt.checkpw(
        password.encode(), PASSWORD_HASH.encode()
    ):
        return JSONResponse({"detail": "Incorrect credentials"}, status_code=401)
    token = create_access_token({"sub": username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Catch-all: Serve the SPA for any path that does not start with 'api/' or 'admin/'."""
    if not (full_path.startswith("api/") or full_path.startswith("admin/")):
        return FileResponse("static/index.html")
    return JSONResponse({"detail": "Not Found"}, status_code=404)
