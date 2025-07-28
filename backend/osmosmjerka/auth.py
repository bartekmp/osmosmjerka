import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from osmosmjerka.database import get_account_by_username, update_last_login

load_dotenv()

# Root admin credentials from environment
ROOT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ROOT_ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a JWT access token with the provided data and expiration time.
    Args:
        data (dict): The data to encode in the token.
        expires_delta (timedelta | None): The expiration time for the token.
    Returns:
        str: The encoded JWT token.
    """
    if SECRET_KEY == "":
        raise HTTPException(status_code=500, detail="Server misconfiguration: SECRET_KEY is not set")
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def authenticate_user(username: str, password: str) -> dict | None:
    """Authenticate user against database or root admin credentials"""
    # Check if it's the root admin
    if username == ROOT_ADMIN_USERNAME and ROOT_ADMIN_PASSWORD_HASH:
        if bcrypt.checkpw(password.encode("utf-8"), ROOT_ADMIN_PASSWORD_HASH.encode("utf-8")):
            return {
                "username": username,
                "role": "root_admin",
                "id": 0  # Special ID for root admin
            }
    
    # Check database users
    account = await get_account_by_username(username)
    if account and account.get("is_active", False):
        if bcrypt.checkpw(password.encode("utf-8"), account["password_hash"].encode("utf-8")):
            await update_last_login(username)
            return {
                "username": account["username"],
                "role": account["role"],
                "id": account["id"]
            }
    
    return None


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": 0, "role": "", "username": username}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(request: Request) -> dict:
    """
    Get the current user from the request headers.
    Args:
        request (Request): The FastAPI request object.
    Returns:
        dict: The user info (username, role, id)
    """
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = token.split(" ", 1)[1]
    return verify_token(token)


def require_role(required_role: str):
    """Dependency to require specific role"""
    def role_checker(user: dict = Depends(get_current_user)) -> dict:
        if required_role == "root_admin" and user["role"] != "root_admin":
            raise HTTPException(status_code=403, detail="Root admin access required")
        elif required_role == "administrative" and user["role"] not in ["root_admin", "administrative"]:
            raise HTTPException(status_code=403, detail="Administrative access required")
        return user
    return role_checker


# Convenience dependencies
require_root_admin = require_role("root_admin")
require_admin_access = require_role("administrative")
