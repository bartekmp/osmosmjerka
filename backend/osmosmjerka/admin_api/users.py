"""User management endpoints for admin API"""

import bcrypt
from fastapi import APIRouter, Body, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from osmosmjerka.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    require_admin_access,
)
from osmosmjerka.database import db_manager

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    self_description: str


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
