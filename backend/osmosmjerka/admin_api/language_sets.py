"""Language set management endpoints for admin API"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from osmosmjerka.auth import require_admin_access
from osmosmjerka.database import db_manager

router = APIRouter()


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


@router.post("/language-sets/{language_set_id}/make-default")
async def make_default_language_set(language_set_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Mark a language set as the default one (admin access required)."""
    try:
        await db_manager.set_default_language_set(language_set_id)
        return JSONResponse({"message": "Default language set updated"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
