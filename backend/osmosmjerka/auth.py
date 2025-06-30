import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from jose import JWTError, jwt

load_dotenv()

USERNAME = os.getenv("ADMIN_USERNAME")
PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
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
        raise HTTPException(
            status_code=500, detail="Server misconfiguration: SECRET_KEY is not set"
        )
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    """Verify the provided JWT token.
    Args:
        token (str): The JWT token to verify.
    Returns:
        str: The username if the token is valid."""
    if SECRET_KEY == "":
        raise HTTPException(
            status_code=500, detail="Server misconfiguration: SECRET_KEY is not set"
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub", "")
        if username != USERNAME:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(request: Request) -> str:
    """
    Get the current user from the request headers.
    Args:
        request (Request): The FastAPI request object.
    Returns:
        str: The username of the current user."""
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = token.split(" ", 1)[1]
    return verify_token(token)
