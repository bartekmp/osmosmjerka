import csv
import io

import bcrypt
from fastapi import APIRouter, Body, Depends, File, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    require_admin_access,
    require_root_admin,
)
from osmosmjerka.database import IGNORED_CATEGORIES, db_manager

router = APIRouter(prefix="/admin")


@router.get("/status")
def admin_status(user=Depends(require_admin_access)) -> JSONResponse:
    return JSONResponse({"status": "ok", "user": user}, status_code=status.HTTP_200_OK)


@router.get("/rows")
async def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    search: str = Query(None),
    user=Depends(require_admin_access),
) -> dict:
    rows = await db_manager.get_words_for_admin(category, limit, offset, search)
    total = await db_manager.get_word_count_for_admin(category, search)
    return {"rows": rows, "total": total}


@router.post("/row")
async def add_row(row: dict, user=Depends(require_admin_access)) -> JSONResponse:
    await db_manager.add_word(row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row added"}, status_code=status.HTTP_201_CREATED)


@router.put("/row/{id}")
async def update_row(id: int, row: dict, user=Depends(require_admin_access)) -> JSONResponse:
    await db_manager.update_word(id, row["categories"], row["word"], row["translation"])
    return JSONResponse({"message": "Row updated"}, status_code=status.HTTP_200_OK)


@router.delete("/row/{id}")
async def delete_row(id: int, user=Depends(require_admin_access)) -> JSONResponse:
    await db_manager.delete_word(id)
    return JSONResponse({"message": "Row deleted"}, status_code=status.HTTP_200_OK)


@router.delete("/clear")
async def clear_db(user=Depends(require_admin_access)) -> JSONResponse:
    await db_manager.clear_all_words()
    return JSONResponse({"message": "Database cleared"}, status_code=status.HTTP_200_OK)


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(require_admin_access)) -> JSONResponse:
    content = await file.read()
    content = content.decode("utf-8")

    # Use CSV reader to properly handle semicolon-separated values and preserve line breaks
    lines = content.strip().split("\n")

    # Skip header if present
    if lines and (lines[0].lower().startswith("categories") or ";" in lines[0]):
        lines = lines[1:]

    words_data = []
    for line_num, line in enumerate(lines, start=2):  # Start at 2 to account for header
        if not line.strip():
            continue

        try:
            # Use CSV reader with semicolon delimiter to properly parse fields
            csv_reader = csv.reader([line], delimiter=";", quotechar='"')
            parts = next(csv_reader)

            if len(parts) >= 3:
                categories = parts[0].strip()
                word = parts[1].strip()
                translation = parts[2].strip()

                # Preserve line breaks: normalize different line break formats
                translation = (
                    translation.replace("\\n", "\n")
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n")
                )

                words_data.append({"categories": categories, "word": word, "translation": translation})
            else:
                print(f"Warning: Line {line_num} has insufficient columns: {len(parts)}")

        except csv.Error as e:
            print(f"Error parsing line {line_num}: {e}")
            continue

    if words_data:
        await run_in_threadpool(db_manager.fast_bulk_insert_words, words_data)
        return JSONResponse({"message": f"Uploaded {len(words_data)} words"}, status_code=status.HTTP_201_CREATED)
    else:
        return JSONResponse(
            {"message": "Upload failed - no valid words found"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.post("/login")
async def login(username: str = Body(...), password: str = Body(...)) -> JSONResponse:
    user = await authenticate_user(username, password)
    if user:
        token = create_access_token(data={"sub": user["username"], "role": user["role"], "user_id": user["id"]})
        return JSONResponse(
            {
                "access_token": token,
                "token_type": "bearer",
                "user": {"username": user["username"], "role": user["role"]},
            }
        )
    return JSONResponse({"error": "Invalid credentials"}, status_code=status.HTTP_401_UNAUTHORIZED)


@router.get("/ignored-categories")
def get_ignored_categories() -> JSONResponse:
    return JSONResponse(sorted(list(IGNORED_CATEGORIES)))


@router.get("/all-categories")
async def get_all_categories(user=Depends(require_admin_access)) -> JSONResponse:
    """Get all categories including ignored ones - for admin panel"""
    categories = await db_manager.get_all_categories()
    return JSONResponse(categories)


@router.get("/export")
async def export_data(category: str = Query(None), user=Depends(require_admin_access)) -> StreamingResponse:
    rows = await db_manager.get_words(category)
    output = io.StringIO()

    # Use CSV writer to properly handle semicolon delimiter and escape special characters
    csv_writer = csv.writer(output, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL)

    # Write header
    csv_writer.writerow(["categories", "word", "translation"])

    # Write data rows
    for row in rows:
        categories = row["categories"]
        word = row["word"]
        translation = row["translation"]

        # Normalize line breaks for export (use <br> for HTML compatibility)
        translation_export = translation.replace("\n", "<br>")

        csv_writer.writerow([categories, word, translation_export])

    content = output.getvalue()
    output.close()
    filename = f"export_{category or 'all'}.csv"
    return StreamingResponse(
        io.StringIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# User Management Endpoints (Root Admin Only)
@router.get("/users")
async def get_users(offset: int = 0, limit: int = 20, user=Depends(require_root_admin)) -> dict:
    accounts = await db_manager.get_accounts(offset, limit)
    total = await db_manager.get_account_count()
    return {"users": accounts, "total": total}


@router.get("/users/{user_id}")
async def get_user(user_id: int, user=Depends(require_root_admin)) -> JSONResponse:
    account = await db_manager.get_account_by_id(user_id)
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    return JSONResponse(account)


@router.post("/users")
async def create_user(
    username: str = Body(...),
    password: str = Body(...),
    role: str = Body("regular"),
    self_description: str = Body(""),
    user=Depends(require_root_admin),
) -> JSONResponse:

    if role not in ["regular", "administrative"]:
        return JSONResponse({"error": "Invalid role"}, status_code=status.HTTP_400_BAD_REQUEST)
    existing_user = await db_manager.get_account_by_username(username)
    if existing_user:
        return JSONResponse({"error": "Username already exists"}, status_code=status.HTTP_400_BAD_REQUEST)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = await db_manager.create_account(username, password_hash, role, self_description)
    return JSONResponse({"message": "User created", "user_id": user_id}, status_code=status.HTTP_201_CREATED)


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    role: str = Body(None),
    self_description: str = Body(None),
    is_active: bool = Body(None),
    user=Depends(require_root_admin),
) -> JSONResponse:
    if user_id == 0:
        return JSONResponse(
            {"error": "Cannot update root admin via this endpoint"}, status_code=status.HTTP_400_BAD_REQUEST
        )
    if role and role not in ["regular", "administrative"]:
        return JSONResponse({"error": "Invalid role"}, status_code=status.HTTP_400_BAD_REQUEST)
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    update_data = {}
    if role is not None:
        update_data["role"] = role
    if self_description is not None:
        if not self_description.strip():
            return JSONResponse({"error": "Description cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)
        update_data["self_description"] = self_description
    if is_active is not None:
        update_data["is_active"] = is_active
    if update_data:
        await db_manager.update_account(user_id, **update_data)
    return JSONResponse({"message": "User updated"}, status_code=status.HTTP_200_OK)


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, user=Depends(require_root_admin)) -> JSONResponse:
    if user_id == 0:
        return JSONResponse({"error": "Cannot delete root admin account"}, status_code=status.HTTP_400_BAD_REQUEST)
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    await db_manager.delete_account(user_id)
    return JSONResponse({"message": "User deleted"}, status_code=status.HTTP_200_OK)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int, new_password: str = Body(...), user=Depends(require_root_admin)
) -> JSONResponse:
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db_manager.update_account(user_id, password_hash=password_hash)
    return JSONResponse({"message": "Password reset successfully"}, status_code=status.HTTP_200_OK)


# User Profile Endpoints (All authenticated users)
@router.get("/profile")
async def get_profile(user=Depends(get_current_user)) -> JSONResponse:
    """Get current user's profile"""
    if user["role"] == "root_admin":
        # Root admin doesn't have a database record
        return JSONResponse(
            {"username": user["username"], "role": user["role"], "self_description": "Root Administrator"}
        )

    account = await db_manager.get_account_by_id(user["id"])
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)

    return JSONResponse(account)


class ProfileUpdateRequest(BaseModel):
    self_description: str


@router.put("/profile")
async def update_profile(body: ProfileUpdateRequest, user=Depends(get_current_user)) -> JSONResponse:
    """Update current user's profile"""
    if user["role"] == "root_admin":
        return JSONResponse({"error": "Root admin profile cannot be updated"}, status_code=status.HTTP_400_BAD_REQUEST)

    self_description = body.self_description
    if not self_description.strip():
        return JSONResponse({"error": "Description cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)
    await db_manager.update_account(user["id"], self_description=self_description)
    return JSONResponse({"message": "Profile updated"}, status_code=status.HTTP_200_OK)


@router.post("/change-password")
async def change_password(
    current_password: str = Body(...), new_password: str = Body(...), user=Depends(get_current_user)
) -> JSONResponse:
    """Change current user's password"""
    if user["role"] == "root_admin":
        return JSONResponse(
            {"error": "Root admin password cannot be changed via API"}, status_code=status.HTTP_400_BAD_REQUEST
        )

    # Get current user account
    account = await db_manager.get_account_by_username(user["username"])
    if not account:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)

    # Verify current password
    if not bcrypt.checkpw(current_password.encode("utf-8"), account["password_hash"].encode("utf-8")):
        return JSONResponse({"error": "Current password is incorrect"}, status_code=status.HTTP_400_BAD_REQUEST)

    # Hash new password
    new_password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    # Update password
    await db_manager.update_account(user["id"], password_hash=new_password_hash)

    return JSONResponse({"message": "Password changed successfully"}, status_code=status.HTTP_200_OK)
