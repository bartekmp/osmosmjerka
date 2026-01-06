"""Student study API endpoints."""

from typing import List, Optional, Set

from fastapi import APIRouter, Depends, Query
from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.database.models import teacher_phrase_set_sessions_table
from pydantic import BaseModel
from sqlalchemy import select

router = APIRouter(prefix="/user/study", tags=["student_study"])


# =============================================================================
# Response Models
# =============================================================================


class AssignedPuzzleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_by: int
    creator_username: Optional[str] = None
    created_at: Optional[str] = None
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
    user_id = current_user["id"]
    result = await db_manager.get_student_assigned_puzzles(
        user_id=user_id,
        limit=limit,
        offset=offset,
    )

    # Get the set of completed puzzle IDs for this user
    completed_ids: Set[int] = set()
    database = db_manager._ensure_database()
    completed_query = (
        select(teacher_phrase_set_sessions_table.c.phrase_set_id)
        .where(
            teacher_phrase_set_sessions_table.c.user_id == user_id,
            teacher_phrase_set_sessions_table.c.is_completed == True,  # noqa: E712
        )
        .distinct()
    )
    completed_rows = await database.fetch_all(completed_query)
    for row in completed_rows:
        completed_ids.add(row["phrase_set_id"])

    puzzles = []
    for p in result["puzzles"]:
        puzzle_id = p["id"]
        puzzles.append(
            {
                "id": puzzle_id,
                "name": p["name"],
                "description": p["description"],
                "created_by": p["created_by"],
                "creator_username": p.get("creator_username"),
                "created_at": (
                    p["created_at"]
                    if isinstance(p.get("created_at"), str)
                    else (p["created_at"].isoformat() if p.get("created_at") else None)
                ),
                "phrase_count": p["phrase_count"],
                "completed_count": p.get("completed_count", 0),
                "total_sessions": p.get("session_count", 0),
                "is_completed": puzzle_id in completed_ids,
                "expires_at": (
                    p["expires_at"]
                    if isinstance(p.get("expires_at"), str)
                    else (p["expires_at"].isoformat() if p.get("expires_at") else None)
                ),
                "token": p["current_hotlink_token"],
            }
        )

    return {
        "puzzles": puzzles,
        "total": result["total"],
    }
