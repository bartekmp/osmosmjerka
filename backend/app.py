import io
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from utils import export_to_docx

from db import get_categories, get_words_by_category, init_db, insert_words
from wordsearch import generate_grid


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
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/api/categories")
async def get_all_categories():
    return JSONResponse(get_categories())


@app.get("/api/words")
async def get_words(category: str | None = None):
    categories = get_categories()
    if not category:
        category = random.choice(categories)
    words = get_words_by_category(category)
    selected = random.sample(words, min(10, max(15, len(words))))
    grid, placed_words = generate_grid(selected)
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


# Catch-all for SPA (must be last, and must not intercept /api)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if not full_path.startswith("api/"):
        return FileResponse("static/index.html")
    return JSONResponse({"detail": "Not Found"}, status_code=404)
