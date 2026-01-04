"""Batch operations endpoints for admin API"""

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import require_admin_access
from osmosmjerka.database import db_manager
from pydantic import BaseModel

router = APIRouter()


class BatchOperationRequest(BaseModel):
    row_ids: list[int]


class BatchCategoryRequest(BaseModel):
    row_ids: list[int]
    category: str


@router.post("/batch/delete")
async def batch_delete_rows(
    request: BatchOperationRequest, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Delete multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected for deletion"}, status_code=status.HTTP_400_BAD_REQUEST)

        deleted_count = await db_manager.batch_delete_phrases(request.row_ids, language_set_id)
        return JSONResponse(
            {"message": f"Successfully deleted {deleted_count} phrases", "deleted_count": deleted_count},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete phrases: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/batch/add-category")
async def batch_add_category(
    request: BatchCategoryRequest, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Add a category to multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected"}, status_code=status.HTTP_400_BAD_REQUEST)

        if not request.category.strip():
            return JSONResponse({"error": "Category name cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)

        affected_count = await db_manager.batch_add_category(request.row_ids, request.category.strip(), language_set_id)
        return JSONResponse(
            {
                "message": f"Successfully added category '{request.category}' to {affected_count} phrases",
                "affected_count": affected_count,
                "category": request.category.strip(),
            },
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        return JSONResponse({"error": f"Failed to add category: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/batch/remove-category")
async def batch_remove_category(
    request: BatchCategoryRequest, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Remove a category from multiple phrases"""
    try:
        if not request.row_ids:
            return JSONResponse({"error": "No rows selected"}, status_code=status.HTTP_400_BAD_REQUEST)

        if not request.category.strip():
            return JSONResponse({"error": "Category name cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)

        affected_count = await db_manager.batch_remove_category(
            request.row_ids, request.category.strip(), language_set_id
        )
        return JSONResponse(
            {
                "message": f"Successfully removed category '{request.category}' from {affected_count} phrases",
                "affected_count": affected_count,
                "category": request.category.strip(),
            },
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        return JSONResponse({"error": f"Failed to remove category: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)
