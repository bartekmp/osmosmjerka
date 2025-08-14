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
from osmosmjerka.database import db_manager

router = APIRouter(prefix="/admin")


# Language Set Management Endpoints
@router.get("/language-sets")
async def get_language_sets(user=Depends(require_admin_access)) -> JSONResponse:
    """Get all language sets for admin management"""
    language_sets = await db_manager.get_language_sets(active_only=False)
    return JSONResponse(language_sets)


@router.get("/language-sets/{language_set_id}/default-ignored-categories")
async def get_default_ignored_categories(language_set_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Get default ignored categories for a language set"""
    try:
        categories = await db_manager.get_default_ignored_categories(language_set_id)
        return JSONResponse(categories)
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to get default ignored categories: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.post("/language-sets")
async def create_language_set(language_set: dict, user=Depends(require_admin_access)) -> JSONResponse:
    """Create a new language set (admin access required)"""
    try:
        # Validate name format (alphanumeric, underscore, dash only)
        name = language_set["name"]
        if not name or not all(c.isalnum() or c in "_-" for c in name):
            return JSONResponse(
                {"error": "Language set name can only contain alphanumeric characters, underscore and dash"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Set created_by: None for root admin (id=0), user_id for others
        created_by = None if user["id"] == 0 else user["id"]

        # Handle default ignored categories
        default_ignored_categories = language_set.get("default_ignored_categories", [])
        if isinstance(default_ignored_categories, str):
            default_ignored_categories = [cat.strip() for cat in default_ignored_categories.split(",") if cat.strip()]

        language_set_id = await db_manager.create_language_set(
            name=name,
            display_name=language_set["display_name"],
            description=language_set.get("description"),
            author=language_set.get("author"),
            created_by=created_by,
            default_ignored_categories=default_ignored_categories,
        )
        return JSONResponse(
            {"message": "Language set created", "id": language_set_id}, status_code=status.HTTP_201_CREATED
        )
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to create language set: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.put("/language-sets/{language_set_id}")
async def update_language_set(language_set_id: int, updates: dict, user=Depends(require_admin_access)) -> JSONResponse:
    """Update language set metadata"""
    try:
        # Check if the language set is protected and user isn't root admin
        is_protected = await db_manager.is_language_set_protected(language_set_id)
        if is_protected and user["id"] != 0:
            return JSONResponse(
                {"error": "Cannot edit language set created by root admin"}, status_code=status.HTTP_403_FORBIDDEN
            )

        # Remove author from updates - it cannot be edited
        if "author" in updates:
            del updates["author"]

        # Handle default ignored categories
        if "default_ignored_categories" in updates:
            default_ignored = updates["default_ignored_categories"]
            if isinstance(default_ignored, list):
                updates["default_ignored_categories"] = ",".join(default_ignored) if default_ignored else None
            elif isinstance(default_ignored, str):
                categories = [cat.strip() for cat in default_ignored.split(",") if cat.strip()]
                updates["default_ignored_categories"] = ",".join(categories) if categories else None

        await db_manager.update_language_set(language_set_id, **updates)
        return JSONResponse({"message": "Language set updated"})
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to update language set: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.delete("/language-sets/{language_set_id}")
async def delete_language_set(language_set_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Delete a language set and all its phrases (admin access required, but protected sets cannot be deleted)"""
    try:
        # Check if the language set is protected (created by root admin)
        is_protected = await db_manager.is_language_set_protected(language_set_id)

        if is_protected and user["role"] != "root_admin":
            return JSONResponse(
                {"error": "Cannot delete language set created by root administrator"},
                status_code=status.HTTP_403_FORBIDDEN,
            )

        await db_manager.delete_language_set(language_set_id)
        return JSONResponse({"message": "Language set deleted"})
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to delete language set: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.get("/status")
def admin_status(user=Depends(require_admin_access)) -> JSONResponse:
    return JSONResponse({"status": "ok", "user": user}, status_code=status.HTTP_200_OK)


# Phrase Management Endpoints
@router.get("/rows")
async def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    search: str = Query(None),
    language_set_id: int = Query(None),
    user=Depends(require_admin_access),
) -> dict:
    """Get phrases for admin panel with language set support"""
    rows = await db_manager.get_phrases_for_admin(language_set_id, category, limit, offset, search)
    total = await db_manager.get_phrase_count_for_admin(language_set_id, category, search)
    return {"rows": rows, "total": total}


@router.post("/row")
async def add_row(row: dict, language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Add a new phrase to specified language set"""
    try:
        await db_manager.add_phrase(language_set_id, row["categories"], row["phrase"], row["translation"])
        return JSONResponse({"message": "Phrase added"}, status_code=status.HTTP_201_CREATED)
    except Exception as e:
        return JSONResponse({"error": f"Failed to add phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.put("/row/{id}")
async def update_row(
    id: int, row: dict, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Update an existing phrase"""
    try:
        await db_manager.update_phrase(id, language_set_id, row["categories"], row["phrase"], row["translation"])
        return JSONResponse({"message": "Phrase updated"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to update phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/row/{id}")
async def delete_row(id: int, language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Delete a phrase"""
    try:
        await db_manager.delete_phrase(id, language_set_id)
        return JSONResponse({"message": "Phrase deleted"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/clear")
async def clear_db(language_set_id: int = Query(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Clear all phrases for a specific language set - root admin only"""
    try:
        await db_manager.clear_all_phrases(language_set_id)
        return JSONResponse({"message": "Language set phrases cleared"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to clear phrases: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/upload")
async def upload(
    file: UploadFile = File(...), language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Upload CSV file with phrases to specified language set"""
    try:
        content = (await file.read()).decode("utf-8")
        phrases_data = _parse_phrases_csv(content)
        if phrases_data:
            await run_in_threadpool(db_manager.fast_bulk_insert_phrases, language_set_id, phrases_data)
            return JSONResponse(
                {"message": f"Uploaded {len(phrases_data)} phrases"}, status_code=status.HTTP_201_CREATED
            )
        else:
            return JSONResponse(
                {"message": "Upload failed - no valid phrases found"}, status_code=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        return JSONResponse({"error": f"Upload failed: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


# Batch Operations Endpoints
class BatchOperationRequest(BaseModel):
    row_ids: list[int]


class BatchCategoryRequest(BaseModel):
    row_ids: list[int]
    category: str


@router.post("/batch/delete")
async def batch_delete_rows(
    request: BatchOperationRequest, 
    language_set_id: int = Query(...), 
    user=Depends(require_admin_access)
) -> JSONResponse:
    """Delete multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected for deletion"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        deleted_count = await db_manager.batch_delete_phrases(request.row_ids, language_set_id)
        return JSONResponse({
            "message": f"Successfully deleted {deleted_count} phrases",
            "deleted_count": deleted_count
        }, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete phrases: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/batch/add-category")
async def batch_add_category(
    request: BatchCategoryRequest, 
    language_set_id: int = Query(...), 
    user=Depends(require_admin_access)
) -> JSONResponse:
    """Add a category to multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        if not request.category.strip():
            return JSONResponse({"error": "Category name cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        affected_count = await db_manager.batch_add_category(request.row_ids, request.category.strip(), language_set_id)
        return JSONResponse({
            "message": f"Successfully added category '{request.category}' to {affected_count} phrases",
            "affected_count": affected_count,
            "category": request.category.strip()
        }, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to add category: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/batch/remove-category")
async def batch_remove_category(
    request: BatchCategoryRequest, 
    language_set_id: int = Query(...), 
    user=Depends(require_admin_access)
) -> JSONResponse:
    """Remove a category from multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        if not request.category.strip():
            return JSONResponse({"error": "Category name cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        affected_count = await db_manager.batch_remove_category(request.row_ids, request.category.strip(), language_set_id)
        return JSONResponse({
            "message": f"Successfully removed category '{request.category}' from {affected_count} phrases",
            "affected_count": affected_count,
            "category": request.category.strip()
        }, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to remove category: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


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


@router.get("/all-categories")
async def get_all_categories(language_set_id: int = Query(None), user=Depends(require_admin_access)) -> JSONResponse:
    """Get all categories including ignored ones for admin panel with language set support"""
    categories = await db_manager.get_all_categories_for_language_set(language_set_id)
    return JSONResponse(categories)


@router.get("/export")
async def export_data(
    category: str = Query(None), language_set_id: int = Query(None), user=Depends(require_admin_access)
) -> StreamingResponse:
    """Export phrases as CSV from specified language set"""
    try:
        rows = await db_manager.get_phrases(language_set_id, category)
        output = io.StringIO()

        # Use CSV writer to properly handle semicolon delimiter and escape special characters
        csv_writer = csv.writer(output, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL)

        # Write header
        csv_writer.writerow(["categories", "phrase", "translation"])

        # Write data rows
        for row in rows:
            categories = row["categories"]
            phrase = row["phrase"]
            translation = row["translation"]

            # Normalize line breaks for export (use <br> for HTML compatibility)
            translation_export = translation.replace("\n", "<br>")

            csv_writer.writerow([categories, phrase, translation_export])

        content = output.getvalue()
        output.close()

        # Get language set info for filename
        language_set = None
        if language_set_id:
            language_set = await db_manager.get_language_set_by_id(language_set_id)

        language_name = language_set["name"] if language_set else "default"
        filename = f"export_{language_name}_{category or 'all'}.csv"

        return StreamingResponse(
            io.StringIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        # For errors, we need to return a proper error response but with correct type
        error_content = f"Export failed: {str(e)}"
        return StreamingResponse(io.StringIO(error_content), media_type="text/plain", status_code=400)


# User Management Endpoints (Admin Access Required)
@router.get("/users")
async def get_users(offset: int = 0, limit: int = 20, user=Depends(require_admin_access)) -> dict:
    accounts = await db_manager.get_accounts(offset, limit)
    total = await db_manager.get_account_count()
    return {"users": accounts, "total": total}


@router.get("/users/{user_id}")
async def get_user(user_id: int, user=Depends(require_admin_access)) -> JSONResponse:
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
    user=Depends(require_admin_access),
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
    user=Depends(require_admin_access),
) -> JSONResponse:
    # Prevent administrative users from editing root admin
    if user_id == 0 and user["role"] != "root_admin":
        return JSONResponse({"error": "Cannot update root admin account"}, status_code=status.HTTP_403_FORBIDDEN)
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
async def delete_user(user_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    if user_id == 0:
        return JSONResponse({"error": "Cannot delete root admin account"}, status_code=status.HTTP_400_BAD_REQUEST)
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    await db_manager.delete_account(user_id)
    return JSONResponse({"message": "User deleted"}, status_code=status.HTTP_200_OK)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int, new_password: str = Body(...), user=Depends(require_admin_access)
) -> JSONResponse:
    # Prevent administrative users from resetting root admin password
    if user_id == 0 and user["role"] != "root_admin":
        return JSONResponse({"error": "Cannot reset root admin password"}, status_code=status.HTTP_403_FORBIDDEN)
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


def _parse_phrases_csv(content: str) -> list[dict]:
    """Parse semicolon-separated CSV content into phrase dicts with preserved line breaks."""
    # Use CSV reader to properly handle semicolon-separated values and preserve line breaks
    lines = content.strip().split("\n")

    # Skip header if present
    if lines and (lines[0].lower().startswith("categories") or ";" in lines[0]):
        lines = lines[1:]

    phrases_data: list[dict] = []
    for line_num, line in enumerate(lines, start=2):  # Start at 2 to account for header
        if not line.strip():
            continue

        try:
            # Use CSV reader with semicolon delimiter to properly parse fields
            csv_reader = csv.reader([line], delimiter=";", quotechar='"')
            parts = next(csv_reader)

            if len(parts) >= 3:
                categories = parts[0].strip()
                phrase = parts[1].strip()
                translation = parts[2].strip()

                # Preserve line breaks: normalize different line break formats
                translation = (
                    translation.replace("\\n", "\n")
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n")
                )

                phrases_data.append({"categories": categories, "phrase": phrase, "translation": translation})
            else:
                print(f"Warning: Line {line_num} has insufficient columns: {len(parts)}")

        except csv.Error as e:
            print(f"Error parsing line {line_num}: {e}")
            continue

    return phrases_data


@router.post("/language-sets/{language_set_id}/make-default")
async def make_default_language_set(language_set_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Mark a language set as the default one (admin access required)."""
    try:
        await db_manager.set_default_language_set(language_set_id)
        return JSONResponse({"message": "Default language set updated"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
