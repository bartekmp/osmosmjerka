"""Student groups API endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from osmosmjerka.auth import get_current_user
from osmosmjerka.database.manager import db_manager
from pydantic import BaseModel

router = APIRouter(prefix="/user/groups", tags=["user_groups"])


# =============================================================================
# Response Models
# =============================================================================


class StudentGroupOut(BaseModel):
    id: int
    name: str
    joined_at: Optional[str] = None
    teacher_username: Optional[str] = None


class InvitationOut(BaseModel):
    id: int
    group_id: int
    group_name: str
    teacher_username: str
    invited_at: Optional[str] = None
    expires_at: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================


@router.get("", response_model=List[StudentGroupOut])
async def get_my_groups(current_user: dict = Depends(get_current_user)):
    """List groups the current user is a member of."""
    groups = await db_manager.get_student_groups(current_user["id"])
    return [
        {
            "id": g["id"],
            "name": g["name"],
            "joined_at": g["joined_at"].isoformat() if g.get("joined_at") else None,
            "teacher_username": g.get("teacher_username"),
        }
        for g in groups
    ]


@router.get("/invitations", response_model=List[InvitationOut])
async def get_invitations(current_user: dict = Depends(get_current_user)):
    """List pending group invitations."""
    invites = await db_manager.get_student_invitations(current_user["id"])
    return [
        {
            "id": i["id"],
            "group_id": i["group_id"],
            "group_name": i["group_name"],
            "teacher_username": i["teacher_username"],
            "invited_at": i["invited_at"].isoformat() if i.get("invited_at") else None,
            "expires_at": i["expires_at"].isoformat() if i.get("expires_at") else None,
        }
        for i in invites
    ]


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation(invitation_id: int, current_user: dict = Depends(get_current_user)):
    """Accept a group invitation."""
    result = await db_manager.respond_to_invitation(invitation_id, current_user["id"], accept=True)

    if not result["success"]:
        error_map = {
            "invitation_not_found": (404, "Invitation not found"),
            "not_your_invitation": (403, "This invitation is not for you"),
            "already_responded": (400, "You have already responded to this invitation"),
            "invitation_expired": (400, "This invitation has expired"),
            "student_group_limit_reached": (400, "You have reached your group limit"),
        }
        status, message = error_map.get(result["error"], (400, result["error"]))
        raise HTTPException(status_code=status, detail=message)

    # Notify teacher
    await db_manager.create_notification(
        user_id=result["teacher_id"],
        type="invitation_accepted",
        title="Invitation Accepted",
        message=f"{current_user['username']} has joined '{result['group_name']}'",
        link="/teacher/groups",
        metadata={"group_id": result["group_id"], "user_id": current_user["id"]},
    )

    return {"status": "success", "group_id": result["group_id"]}


@router.post("/invitations/{invitation_id}/decline")
async def decline_invitation(invitation_id: int, current_user: dict = Depends(get_current_user)):
    """Decline a group invitation."""
    result = await db_manager.respond_to_invitation(invitation_id, current_user["id"], accept=False)

    if not result["success"]:
        error_map = {
            "invitation_not_found": (404, "Invitation not found"),
            "not_your_invitation": (403, "This invitation is not for you"),
            "already_responded": (400, "You have already responded to this invitation"),
            "invitation_expired": (400, "This invitation has expired"),
        }
        status, message = error_map.get(result["error"], (400, result["error"]))
        raise HTTPException(status_code=status, detail=message)

    # Notify teacher
    await db_manager.create_notification(
        user_id=result["teacher_id"],
        type="invitation_declined",
        title="Invitation Declined",
        message=f"{current_user['username']} declined to join '{result['group_name']}'",
        metadata={"group_id": result["group_id"], "user_id": current_user["id"]},
    )

    return {"status": "success"}


@router.post("/{group_id}/leave")
async def leave_group(group_id: int, current_user: dict = Depends(get_current_user)):
    """Leave a group."""
    result = await db_manager.leave_group(group_id, current_user["id"])

    if not result["success"]:
        if result["error"] == "not_a_member":
            raise HTTPException(status_code=404, detail="You are not a member of this group")
        raise HTTPException(status_code=400, detail=result["error"])

    # Notify teacher
    await db_manager.create_notification(
        user_id=result["teacher_id"],
        type="student_left",
        title="Student Left Group",
        message=f"{current_user['username']} has left '{result['group_name']}'",
        metadata={"group_id": group_id, "user_id": current_user["id"]},
    )

    return {"status": "success"}
