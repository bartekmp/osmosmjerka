"""Student study API endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from pydantic import BaseModel

router = APIRouter(prefix="/user/study", tags=["student_study"])


# =============================================================================
# Response Models
# =============================================================================


class AssignedPuzzleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_by: int
    phrase_count: int
    completed_count: int
    total_sessions: int
    is_completed: bool = False
    expires_at: Optional[str] = None
    token: str


class AssignedPuzzlesResponse(BaseModel):
    puzzles: List[AssignedPuzzleOut]
    total: int


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/puzzles", response_model=AssignedPuzzlesResponse)
async def list_assigned_puzzles(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List puzzles assigned to the current user (directly or via groups)."""
    result = await db_manager.get_student_assigned_puzzles(
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )

    # Needs to determine if completed by user?
    # The get_student_assigned_puzzles returns puzzle details.
    # We might want to check completion status efficiently.
    # For now, we will return basic info.
    # TODO: Fetch completion status per puzzle for this user.

    puzzles = []
    for p in result["puzzles"]:
        puzzles.append(
            {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "created_by": p["created_by"],
                "phrase_count": p["phrase_count"],
                "completed_count": p.get(
                    "completed_count", 0
                ),  # Total completions globally? No, teacher set dict has global stats.
                "total_sessions": p.get("session_count", 0),
                "is_completed": False,  # TODO
                "expires_at": (p["expires_at"].isoformat() if p.get("expires_at") else None),
                "token": p["current_hotlink_token"],
            }
        )

    return {
        "puzzles": puzzles,
        "total": result["total"],
    }
