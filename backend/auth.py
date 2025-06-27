import os
import secrets

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

load_dotenv()

security = HTTPBasic()

USERNAME = os.getenv("ADMIN_USERNAME")
PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")


def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Verify the provided username and password against environment variables.
    Args:
        credentials (HTTPBasicCredentials): The credentials provided by the user.
    Raises:
        HTTPException: If the credentials are incorrect or if the server is misconfigured.
    Returns:
        str: The username if the credentials are correct.
    """
    if not USERNAME or not PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Server misconfiguration")
    correct_username = secrets.compare_digest(credentials.username, USERNAME)
    correct_password = bcrypt.checkpw(
        credentials.password.encode(), PASSWORD_HASH.encode()
    )
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials"
        )
    return credentials.username
