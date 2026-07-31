"""User management endpoints for admin API"""

import os

from fastapi import APIRouter, Body, Depends, Request, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    require_admin_access,
)
from osmosmjerka.cache import rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.database.account_tokens import (
    EMAIL_VERIFICATION_TTL,
    PURPOSE_EMAIL_VERIFICATION,
    new_account_token,
)
from osmosmjerka.logging_config import get_logger
from osmosmjerka.mailer import send_verification_email
from osmosmjerka.passwords import (
    PasswordPolicyError,
    hash_password,
    validate_password,
    verify_password,
)
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter()

# Per-IP throttle on the login endpoint. Configurable because the limit is per source
# address, and a whole classroom behind one NAT is a legitimate burst of sign-ins - the
# per-account lockout in authenticate_user is the control that actually stops brute force,
# and it is unaffected by this.
LOGIN_RATE_LIMIT_ATTEMPTS = int(os.getenv("LOGIN_RATE_LIMIT_ATTEMPTS", "10"))
LOGIN_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "300"))


class ProfileUpdateRequest(BaseModel):
    self_description: str


@router.post("/login")
# Complements the per-account lockout in authenticate_user: that one stops a single account
# being ground down from many IPs, this one stops a single IP working through many accounts.
@rate_limit(max_requests=LOGIN_RATE_LIMIT_ATTEMPTS, window_seconds=LOGIN_RATE_LIMIT_WINDOW_SECONDS)
async def login(request: Request, username: str = Body(...), password: str = Body(...)) -> JSONResponse:
    """Sign in with an email address (self-registered accounts) or a username."""
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
    if role not in ["regular", "teacher", "administrative"]:
        return JSONResponse({"error": "Invalid role"}, status_code=status.HTTP_400_BAD_REQUEST)
    existing_user = await db_manager.get_account_by_username(username)
    if existing_user:
        return JSONResponse({"error": "Username already exists"}, status_code=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password, username=username)
    except PasswordPolicyError as exc:
        return JSONResponse({"error": str(exc)}, status_code=status.HTTP_400_BAD_REQUEST)
    user_id = await db_manager.create_account(username, hash_password(password), role, self_description)
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
    if role and role not in ["regular", "teacher", "administrative"]:
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
    if is_active is False:
        await db_manager.end_active_sessions(user_id)
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


@router.post("/users/{user_id}/confirm-email")
async def confirm_user_email(user_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Manually confirm an account's email address, without the emailed link.

    For the case the flow can't handle on its own: the address is real but the mail never
    arrived (bounced, spam-filtered, or an SMTP outage). Any outstanding confirmation token
    is invalidated at the same time, so a link from an old email can't be replayed later.
    """
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    if not existing_user.get("email"):
        return JSONResponse(
            {"error": "This account has no email address, so there is nothing to confirm"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if existing_user.get("email_verified"):
        return JSONResponse({"message": "Email already confirmed"}, status_code=status.HTTP_200_OK)

    await db_manager.update_account(user_id, email_verified=True)
    await db_manager.invalidate_account_tokens(user_id, PURPOSE_EMAIL_VERIFICATION)
    logger.info(
        "Email confirmed manually by an admin",
        extra={"user_id": user_id, "confirmed_by": user["id"]},
    )
    return JSONResponse({"message": "Email confirmed"}, status_code=status.HTTP_200_OK)


@router.post("/users/{user_id}/resend-verification")
async def resend_user_verification(user_id: int, user=Depends(require_admin_access)) -> JSONResponse:
    """Send the confirmation link again, for an account still awaiting confirmation."""
    existing_user = await db_manager.get_account_by_id(user_id)
    if not existing_user:
        return JSONResponse({"error": "User not found"}, status_code=status.HTTP_404_NOT_FOUND)
    email = existing_user.get("email")
    if not email:
        return JSONResponse({"error": "This account has no email address"}, status_code=status.HTTP_400_BAD_REQUEST)
    if existing_user.get("email_verified"):
        return JSONResponse({"error": "This account is already confirmed"}, status_code=status.HTTP_400_BAD_REQUEST)

    token, token_hash = new_account_token()
    await db_manager.create_account_token(user_id, PURPOSE_EMAIL_VERIFICATION, token_hash, EMAIL_VERIFICATION_TTL)
    sent = await send_verification_email(email, token, existing_user.get("username", ""))
    logger.info("Confirmation email re-sent by an admin", extra={"user_id": user_id, "sent": sent})
    return JSONResponse(
        {"message": "Confirmation email sent" if sent else "Could not send the email - check the SMTP settings"},
        status_code=status.HTTP_200_OK if sent else status.HTTP_502_BAD_GATEWAY,
    )


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
    try:
        validate_password(new_password, email=existing_user.get("email"), username=existing_user.get("username"))
    except PasswordPolicyError as exc:
        return JSONResponse({"error": str(exc)}, status_code=status.HTTP_400_BAD_REQUEST)
    await db_manager.update_account(user_id, password_hash=hash_password(new_password))
    # An admin reset is also how a locked-out user gets back in.
    await db_manager.clear_failed_logins(user_id)
    # A reset is often a response to a compromise, so it has to end whatever sessions the
    # old password left behind.
    await db_manager.end_active_sessions(user_id)
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
    if not verify_password(current_password, account["password_hash"]):
        return JSONResponse({"error": "Current password is incorrect"}, status_code=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, email=account.get("email"), username=account.get("username"))
    except PasswordPolicyError as exc:
        return JSONResponse({"error": str(exc)}, status_code=status.HTTP_400_BAD_REQUEST)

    await db_manager.update_account(user["id"], password_hash=hash_password(new_password))
    # Ends every session opened with the old password - including any an attacker holds -
    # and then re-issues one for the caller, so changing your password doesn't sign you out
    # of the tab you did it in.
    await db_manager.end_active_sessions(user["id"])
    token = create_access_token(data={"sub": user["username"], "role": user["role"], "user_id": user["id"]})

    return JSONResponse(
        {"message": "Password changed successfully", "access_token": token, "token_type": "bearer"},
        status_code=status.HTTP_200_OK,
    )
