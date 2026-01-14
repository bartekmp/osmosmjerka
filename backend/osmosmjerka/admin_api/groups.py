"""Teacher groups API endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from osmosmjerka.auth import require_teacher_access
from osmosmjerka.database.manager import db_manager
from pydantic import BaseModel

router = APIRouter(prefix="/teacher/groups", tags=["teacher_groups"])


# =============================================================================
# Request/Response Models
# =============================================================================


class GroupCreate(BaseModel):
    name: str


class GroupInvite(BaseModel):
    usernames: List[str]  # Support bulk invite


class GroupOut(BaseModel):
    id: int
    name: str
    accepted_count: int = 0
    pending_count: int = 0


class GroupMemberOut(BaseModel):
    id: int
    username: str
    status: str
    invited_at: Optional[str] = None
    responded_at: Optional[str] = None


class InviteResult(BaseModel):
    username: str
    success: bool
    user_id: Optional[int] = None
    error: Optional[str] = None


# =============================================================================
# Teacher Group Endpoints
# =============================================================================


@router.get("", response_model=List[GroupOut])
async def get_groups(current_user: dict = Depends(require_teacher_access)):
    """List all groups for the current teacher."""
    groups = await db_manager.get_teacher_groups(current_user["id"])
    return groups


@router.post("", response_model=GroupOut)
async def create_group(group: GroupCreate, current_user: dict = Depends(require_teacher_access)):
    """Create a new group."""
    try:
        group_id = await db_manager.create_teacher_group(current_user["id"], group.name)
        return {
            "id": group_id,
            "name": group.name,
            "accepted_count": 0,
            "pending_count": 0,
        }
    except Exception as e:
        if "uq_teacher_group_name" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists") from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{group_id}")
async def get_group(group_id: int, current_user: dict = Depends(require_teacher_access)):
    """Get group details."""
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = await db_manager.get_group_members(group_id)
    accepted = sum(1 for m in members if m["status"] == "accepted")
    pending = sum(1 for m in members if m["status"] == "pending")

    return {
        "id": group["id"],
        "name": group["name"],
        "accepted_count": accepted,
        "pending_count": pending,
    }


@router.delete("/{group_id}")
async def delete_group(group_id: int, current_user: dict = Depends(require_teacher_access)):
    """Delete a group."""
    await db_manager.delete_teacher_group(group_id, current_user["id"])
    return {"status": "success"}


@router.get("/{group_id}/members", response_model=List[GroupMemberOut])
async def get_group_members(group_id: int, current_user: dict = Depends(require_teacher_access)):
    """List members of a group with status."""
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = await db_manager.get_group_members(group_id)
    return [
        {
            "id": m["id"],
            "username": m["username"],
            "status": m["status"],
            "invited_at": m["invited_at"].isoformat() if m.get("invited_at") else None,
            "responded_at": (m["responded_at"].isoformat() if m.get("responded_at") else None),
        }
        for m in members
    ]


@router.post("/{group_id}/invite", response_model=List[InviteResult])
async def invite_members(
    group_id: int,
    data: GroupInvite,
    current_user: dict = Depends(require_teacher_access),
):
    """Invite students to a group (bulk support)."""
    results = []
    for username in data.usernames:
        username = username.strip()
        if not username:
            continue
        result = await db_manager.invite_group_member(group_id, username, current_user["id"])
        results.append(
            {
                "username": username,
                "success": result["success"],
                "user_id": result.get("user_id"),
                "error": result.get("error"),
            }
        )

        # Send notification if successful
        if result["success"] and result.get("user_id"):
            group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
            await db_manager.create_notification(
                user_id=result["user_id"],
                type="group_invitation",
                title="Group Invitation",
                message=f"You have been invited to join '{group['name']}' by {current_user['username']}",
                link="/groups/invitations",
                metadata={"group_id": group_id, "teacher_id": current_user["id"]},
            )

    return results


@router.delete("/{group_id}/members/{user_id}")
async def remove_group_member(group_id: int, user_id: int, current_user: dict = Depends(require_teacher_access)):
    """Remove a student from the group."""
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    await db_manager.remove_group_member(group_id, user_id)

    # Notify student
    await db_manager.create_notification(
        user_id=user_id,
        type="removed_from_group",
        title="Removed from Group",
        message=f"You have been removed from '{group['name']}'",
    )

    return {"status": "success"}
