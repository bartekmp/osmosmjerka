"""List sharing endpoints for game API."""

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user
from osmosmjerka.cache import rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/user/private-lists/{list_id}/share")
@rate_limit(max_requests=20, window_seconds=60)
async def share_private_list(
    list_id: int,
    shared_with_username: str = Body(..., embed=True),
    permission: str = Body("read", embed=True),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Share a list with another user by username"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        # Find user by username
        target_user = await db_manager.get_user_by_username(shared_with_username)
        if not target_user:
            return JSONResponse(
                {"error": f"User '{shared_with_username}' not found"}, status_code=status.HTTP_404_NOT_FOUND
            )

        if target_user["id"] == user["id"]:
            return JSONResponse({"error": "Cannot share list with yourself"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Validate permission
        if permission not in ["read", "write"]:
            return JSONResponse(
                {"error": "Invalid permission. Must be 'read' or 'write'"}, status_code=status.HTTP_400_BAD_REQUEST
            )

        # Share the list
        share_id = await db_manager.share_list(
            list_id=list_id, owner_user_id=user["id"], shared_with_user_id=target_user["id"], permission=permission
        )

        return JSONResponse(
            {"share_id": share_id, "list_id": list_id, "shared_with": shared_with_username, "permission": permission},
            status_code=status.HTTP_201_CREATED,
        )

    except Exception as e:
        logger.exception(f"Failed to share list {list_id}")
        raise HTTPException(status_code=500, detail="Failed to share list") from e


@router.delete("/user/private-lists/{list_id}/share/{shared_with_user_id}")
@rate_limit(max_requests=20, window_seconds=60)
async def unshare_private_list(list_id: int, shared_with_user_id: int, user=Depends(get_current_user)) -> JSONResponse:
    """Remove sharing access for a user"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        # Remove sharing
        success = await db_manager.unshare_list(list_id, shared_with_user_id)

        if not success:
            return JSONResponse({"error": "Share not found"}, status_code=status.HTTP_404_NOT_FOUND)

        return JSONResponse({"message": "Sharing access removed"})

    except Exception as e:
        logger.exception(f"Failed to unshare list {list_id}")
        raise HTTPException(status_code=500, detail="Failed to remove sharing") from e


@router.get("/user/private-lists/{list_id}/shares")
@rate_limit(max_requests=30, window_seconds=60)
async def get_list_shares(list_id: int, user=Depends(get_current_user)) -> JSONResponse:
    """Get all shares for a specific list"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        shares = await db_manager.get_list_shares(list_id, user["id"])

        return JSONResponse({"shares": shares})

    except Exception as e:
        logger.exception(f"Failed to get shares for list {list_id}")
        raise HTTPException(status_code=500, detail="Failed to get shares") from e


@router.get("/user/shared-lists")
@rate_limit(max_requests=30, window_seconds=60)
async def get_shared_with_me_lists(language_set_id: int = Query(None), user=Depends(get_current_user)) -> JSONResponse:
    """Get all lists shared with the current user"""
    try:
        shared_lists = await db_manager.get_shared_with_me_lists(user["id"], language_set_id)

        return JSONResponse({"lists": shared_lists})

    except Exception as e:
        logger.exception("Failed to get shared lists")
        raise HTTPException(status_code=500, detail="Failed to get shared lists") from e
