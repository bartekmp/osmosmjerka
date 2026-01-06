"""Notifications API endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/notifications")


class Notification(BaseModel):
    """Notification model."""

    id: int
    user_id: int
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: str
    expires_at: Optional[str] = None
    metadata: Optional[dict] = None


@router.get("", response_model=List[Notification])
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False,
    user: dict = Depends(get_current_user),
) -> List[Notification]:
    """Get notifications for the current user."""
    return await db_manager.get_user_notifications(user["id"], limit=limit, unread_only=unread_only)


@router.get("/unread-count")
async def get_unread_count(
    user: dict = Depends(get_current_user),
) -> JSONResponse:
    """Get count of unread notifications."""
    count = await db_manager.get_unread_notification_count(user["id"])
    return JSONResponse({"count": count})


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    user: dict = Depends(get_current_user),
) -> JSONResponse:
    """Mark a notification as read."""
    success = await db_manager.mark_notification_read(notification_id, user["id"])
    if not success:
        return JSONResponse(
            {"error": "Notification not found or access denied"},
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return JSONResponse({"success": True})


@router.put("/read-all")
async def mark_all_read(
    user: dict = Depends(get_current_user),
) -> JSONResponse:
    """Mark all notifications as read."""
    await db_manager.mark_all_notifications_read(user["id"])
    return JSONResponse({"success": True})


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    user: dict = Depends(get_current_user),
) -> JSONResponse:
    """Delete a notification."""
    success = await db_manager.delete_notification(notification_id, user["id"])
    if not success:
        return JSONResponse(
            {"error": "Notification not found or access denied"},
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return JSONResponse({"success": True})
