import io
import random
from contextlib import asynccontextmanager

from auth import verify_credentials
from fastapi import Depends, FastAPI, File, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from utils import export_to_docx

from db import (
    IGNORED_CATEGORIES,
    add_word,
    delete_all_words,
    delete_word,
    get_all_words,
    get_categories,
    get_words_by_category,
    init_db,
    insert_words,
    update_word,
)
from wordsearch import generate_grid

API_ENDPOINTS = ["api/", "admin/"]


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
def admin_status(user=Depends(verify_credentials)):
    return JSONResponse({"status": "ok"}, status_code=status.HTTP_200_OK)


@app.get("/admin/rows")
def get_all_rows(offset: int = 0, limit: int = 20, user=Depends(verify_credentials)):
    rows = get_all_words(offset, limit)
    return [
        {"id": r[0], "categories": r[1], "word": r[2], "translation": r[3]}
        for r in rows
    ]


@app.post("/admin/row")
def add_row(row: dict, user=Depends(verify_credentials)):
    add_word(row["categories"], row["word"], row["translation"])
    return {"status": "ok"}


@app.put("/admin/row/{id}")
def update_row(id: int, row: dict, user=Depends(verify_credentials)):
    update_word(id, row["categories"], row["word"], row["translation"])
    return {"status": "ok"}


@app.delete("/admin/row/{id}")
def delete_row(id: int, row: dict, user=Depends(verify_credentials)):
    delete_word(id)
    return {"status": "deleted"}


@app.delete("/admin/clear")
def clear_db(user=Depends(verify_credentials)):
    delete_all_words()
    return {"status": "cleared"}


@app.get("/api/categories")
async def get_all_categories():
    all_categories = get_categories()
    filtered = [cat for cat in all_categories if cat not in IGNORED_CATEGORIES]
    return JSONResponse(filtered)


@app.get("/api/words")
async def get_words(category: str | None = None):
    categories = get_categories()
    if not category:
        category = random.choice(categories)
    selected = get_words_by_category(category, ignored_categories=IGNORED_CATEGORIES)
    word_pairs = [(w["word"].upper(), w["translation"]) for w in selected]
    grid, placed_words = generate_grid(word_pairs)
    return JSONResponse({"grid": grid, "words": placed_words})


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8")
    insert_words(content)
    return "Uploaded"


@app.post("/api/export")
async def export(request: Request):
    data = await request.json()
    docx_bytes = export_to_docx(data["category"], data["grid"], data["words"])
    return FileResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"wordsearch-{data['category']}.docx",
    )


@app.get("/api/ignored_categories")
async def get_ignored_categories():
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if not (full_path.startswith("api/") or full_path.startswith("admin/")):
        return FileResponse("static/index.html")
    return JSONResponse({"detail": "Not Found"}, status_code=404)
