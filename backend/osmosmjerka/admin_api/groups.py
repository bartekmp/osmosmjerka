from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from osmosmjerka.auth import (
    require_teacher_access,
)
from osmosmjerka.database.manager import db_manager
from pydantic import BaseModel

router = APIRouter(prefix="/teacher/groups", tags=["teacher_groups"])


class GroupCreate(BaseModel):
    name: str


class GroupMemberAdd(BaseModel):
    username: str


class GroupOut(BaseModel):
    id: int
    name: str
    member_count: Optional[int] = 0


class GroupMemberOut(BaseModel):
    id: int
    username: str
    added_at: str  # datetime serialized


@router.get("", response_model=List[GroupOut])
async def get_groups(
    current_user: dict = Depends(require_teacher_access),
):
    """List all groups for the current teacher."""
    return await db_manager.get_teacher_groups(current_user["id"])


@router.post("", response_model=GroupOut)
async def create_group(
    group: GroupCreate,
    current_user: dict = Depends(require_teacher_access),
):
    """Create a new group."""
    try:
        group_id = await db_manager.create_teacher_group(current_user["id"], group.name)
        return {"id": group_id, "name": group.name, "member_count": 0}
    except Exception as e:
        # Catch strict unique constraint violations if possible
        if "uq_teacher_group_name" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(
    group_id: int,
    current_user: dict = Depends(require_teacher_access),
):
    """Get group details."""
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Fetch member count separately or just reuse list query logic?
    # Simple way: just default 0 here, or fetch members to count.
    members = await db_manager.get_group_members(group_id)
    group["member_count"] = len(members)
    return group


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: dict = Depends(require_teacher_access),
):
    """Delete a group."""
    # Check ownership implicitly by delete logic requiring teacher_id
    await db_manager.delete_teacher_group(group_id, current_user["id"])
    return {"status": "success"}


@router.get("/{group_id}/members", response_model=List[GroupMemberOut])
async def get_group_members(
    group_id: int,
    current_user: dict = Depends(require_teacher_access),
):
    """List members of a group."""
    # verify ownership first
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = await db_manager.get_group_members(group_id)
    # Serialize datetime
    return [
        {"id": m["id"], "username": m["username"], "added_at": m["added_at"].isoformat() if m["added_at"] else None}
        for m in members
    ]


@router.post("/{group_id}/members")
async def add_group_member(
    group_id: int,
    member: GroupMemberAdd,
    current_user: dict = Depends(require_teacher_access),
):
    """Add a student to the group."""
    # verify ownership
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    user_id = await db_manager.add_group_member(group_id, member.username)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "success", "user_id": user_id}


@router.delete("/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: int,
    user_id: int,
    current_user: dict = Depends(require_teacher_access),
):
    """Remove a student from the group."""
    # verify ownership
    group = await db_manager.get_teacher_group_by_id(group_id, current_user["id"])
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    await db_manager.remove_group_member(group_id, user_id)
    return {"status": "success"}
