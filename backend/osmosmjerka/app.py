import io
import random
from contextlib import asynccontextmanager

import bcrypt
from fastapi import Body, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import authenticate_user, create_access_token, get_current_user, require_admin_access, require_root_admin
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
from osmosmjerka.database import (
    create_account, get_accounts, get_account_by_id, get_account_by_username, update_account, delete_account, get_account_count
)

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
def admin_status(user=Depends(require_admin_access)) -> JSONResponse:
    return JSONResponse({"status": "ok", "user": user}, status_code=status.HTTP_200_OK)


@app.get("/admin/rows")
async def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    user=Depends(require_admin_access),
) -> dict:
    rows = await db_get_words(category, limit, offset)
    total = await get_word_count(category)
    return {"rows": rows, "total": total}
    return {"rows": rows, "total": total}


@app.post("/admin/row")
async def add_row(row: dict, user=Depends(require_admin_access)) -> JSONResponse:
    await db_add_word(row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row added"}, status_code=status.HTTP_201_CREATED)


@app.put("/admin/row/{id}")
async def update_row(id: int, row: dict, user=Depends(require_admin_access)) -> JSONResponse:
    await db_update_word(id, row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row updated"}, status_code=status.HTTP_200_OK)


@app.delete("/admin/row/{id}")
async def delete_row(id: int, user=Depends(require_admin_access)) -> JSONResponse:
    await db_delete_word(id)
    return JSONResponse({"message": "Row deleted"}, status_code=status.HTTP_200_OK)


@app.delete("/admin/clear")
async def clear_db(user=Depends(require_admin_access)) -> JSONResponse:
    await clear_all_words()
    return JSONResponse({"message": "Database cleared"}, status_code=status.HTTP_200_OK)


@app.post("/admin/upload")
async def upload(file: UploadFile = File(...), user=Depends(require_admin_access)) -> JSONResponse:
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
    user = await authenticate_user(username, password)
    if user:
        token = create_access_token(data={
            "sub": user["username"],
            "role": user["role"],
            "user_id": user["id"]
        })
        return JSONResponse({
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": user["username"],
                "role": user["role"]
            }
        })
    return JSONResponse({"error": "Invalid credentials"}, status_code=status.HTTP_401_UNAUTHORIZED)


@app.get("/admin/ignored-categories")
@app.get("/api/ignored-categories")
def get_ignored_categories() -> JSONResponse:
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))


@app.get("/admin/export")
async def export_data(category: str = Query(None), user=Depends(require_admin_access)) -> StreamingResponse:
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


# User Management Endpoints (Root Admin Only)
@app.get("/admin/users")
async def get_users(
    offset: int = 0,
    limit: int = 20,
    user=Depends(require_root_admin)
) -> dict:
    """Get all user accounts (root admin only)"""
    accounts = await get_accounts(offset, limit)
    total = await get_account_count()
    return {"users": accounts, "total": total}


@app.get("/admin/users/{user_id}")
async def get_user(user_id: int, user=Depends(require_root_admin)) -> JSONResponse:
    """Get specific user account (root admin only)"""
    account = await get_account_by_id(user_id)
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    return JSONResponse(account)


@app.post("/admin/users")
async def create_user(
    username: str = Body(...),
    password: str = Body(...),
    role: str = Body("regular"),
    self_description: str = Body(""),
    user=Depends(require_root_admin)
) -> JSONResponse:
    """Create new user account (root admin only)"""
    import bcrypt
    
    # Validate role
    if role not in ["regular", "administrative"]:
        return JSONResponse({"error": "Invalid role"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    # Check if username already exists
    existing_user = await get_account_by_username(username)
    if existing_user:
        return JSONResponse({"error": "Username already exists"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    # Hash password
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    # Create account
    user_id = await create_account(username, password_hash, role, self_description)
    return JSONResponse({"message": "User created", "user_id": user_id}, status_code=status.HTTP_201_CREATED)


@app.put("/admin/users/{user_id}")
async def update_user(
    user_id: int,
    role: str = Body(None),
    self_description: str = Body(None),
    is_active: bool = Body(None),
    user=Depends(require_root_admin)
) -> JSONResponse:
    """Update user account (root admin only)"""
    # Validate role if provided
    if role and role not in ["regular", "administrative"]:
        return JSONResponse({"error": "Invalid role"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    # Check if user exists
    existing_user = await get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    
    # Update user
    update_data = {}
    if role is not None:
        update_data["role"] = role
    if self_description is not None:
        update_data["self_description"] = self_description
    if is_active is not None:
        update_data["is_active"] = is_active
    
    if update_data:
        await update_account(user_id, **update_data)
    
    return JSONResponse({"message": "User updated"}, status_code=status.HTTP_200_OK)


@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: int, user=Depends(require_root_admin)) -> JSONResponse:
    """Delete user account (root admin only)"""
    # Check if user exists
    existing_user = await get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    
    # Delete user
    await delete_account(user_id)
    return JSONResponse({"message": "User deleted"}, status_code=status.HTTP_200_OK)


@app.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str = Body(...),
    user=Depends(require_root_admin)
) -> JSONResponse:
    """Reset user password (root admin only)"""
    import bcrypt
    
    # Check if user exists
    existing_user = await get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    
    # Hash new password
    password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    # Update password
    await update_account(user_id, password_hash=password_hash)
    
    return JSONResponse({"message": "Password reset successfully"}, status_code=status.HTTP_200_OK)


# User Profile Endpoints (All authenticated users)
@app.get("/admin/profile")
async def get_profile(user=Depends(get_current_user)) -> JSONResponse:
    """Get current user's profile"""
    if user["role"] == "root_admin":
        # Root admin doesn't have a database record
        return JSONResponse({
            "username": user["username"],
            "role": user["role"],
            "self_description": "Root Administrator"
        })
    
    account = await get_account_by_id(user["id"])
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    
    return JSONResponse(account)


@app.put("/admin/profile")
async def update_profile(
    self_description: str = Body(None),
    user=Depends(get_current_user)
) -> JSONResponse:
    """Update current user's profile"""
    if user["role"] == "root_admin":
        return JSONResponse({"error": "Root admin profile cannot be updated"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    update_data = {}
    if self_description is not None:
        update_data["self_description"] = self_description
    
    if update_data:
        await update_account(user["id"], **update_data)
    
    return JSONResponse({"message": "Profile updated"}, status_code=status.HTTP_200_OK)


@app.post("/admin/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    user=Depends(get_current_user)
) -> JSONResponse:
    """Change current user's password"""
    import bcrypt
    
    if user["role"] == "root_admin":
        return JSONResponse({"error": "Root admin password cannot be changed via API"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    # Get current user account
    account = await get_account_by_username(user["username"])
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify current password
    if not bcrypt.checkpw(current_password.encode("utf-8"), account["password_hash"].encode("utf-8")):
        return JSONResponse({"error": "Current password is incorrect"}, status_code=status.HTTP_400_BAD_REQUEST)
    
    # Hash new password
    new_password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    # Update password
    await update_account(user["id"], password_hash=new_password_hash)
    
    return JSONResponse({"message": "Password changed successfully"}, status_code=status.HTTP_200_OK)

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
