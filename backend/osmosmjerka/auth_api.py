"""Public self-service account endpoints: registration, email confirmation, password reset.

Design notes, since these are the endpoints an attacker probes first:

* **No account enumeration.** Registering with, resending to, or requesting a reset for an
  address answers the same way whether or not that address exists. The differing outcome
  is only ever delivered to the mailbox itself.
* **Tokens are single-use, hashed at rest and short-lived** - see
  :mod:`osmosmjerka.database.account_tokens`. Redemption is one atomic UPDATE, so a
  double-clicked link can't be redeemed twice.
* **Everything is rate limited per IP**, on top of the per-account lockout in
  :func:`osmosmjerka.auth.authenticate_user`.
* **A password reset also confirms the address** - completing it proves mailbox control,
  which is exactly what confirmation establishes.
"""

import hashlib
import os
import re
import secrets

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from osmosmjerka.cache import rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.database.account_tokens import (
    EMAIL_VERIFICATION_TTL,
    PASSWORD_RESET_TTL,
    PURPOSE_EMAIL_VERIFICATION,
    PURPOSE_PASSWORD_RESET,
)
from osmosmjerka.logging_config import get_logger
from osmosmjerka.mailer import send_password_reset_email, send_verification_email
from osmosmjerka.passwords import PasswordPolicyError, hash_password, validate_password
from pydantic import BaseModel, Field

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Registration"])

# Lets an operator run a closed instance where accounts are created by an admin only.
REGISTRATION_ENABLED = os.getenv("REGISTRATION_ENABLED", "true").lower() == "true"

# Deliberately permissive: the only authoritative test of an address is whether the
# confirmation mail arrives, and over-strict patterns reject valid addresses.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")
_USERNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{1,30}[A-Za-z0-9])$")

# Same wording for every outcome, so timing aside there is nothing to learn from the body.
_GENERIC_REGISTER_MESSAGE = "Check your inbox - if the address can be registered, a confirmation link is on its way."
_GENERIC_RESET_MESSAGE = "Check your inbox - if that address has an account, a reset link is on its way."


class RegisterRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)
    username: str | None = Field(default=None, max_length=32)


class EmailRequest(BaseModel):
    email: str = Field(max_length=320)


class TokenRequest(BaseModel):
    token: str = Field(max_length=256)


class ResetPasswordRequest(BaseModel):
    token: str = Field(max_length=256)
    password: str = Field(max_length=1024)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_token(token: str) -> str:
    """SHA-256 of the token. No salt or stretching needed: it's 256 bits of entropy."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_token() -> tuple[str, str]:
    """Return (plaintext for the emailed link, hash to store)."""
    token = secrets.token_urlsafe(32)
    return token, _hash_token(token)


def _error(message: str, code: int = status.HTTP_400_BAD_REQUEST) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=code)


async def _unique_username(preferred: str | None, email: str) -> str | None:
    """Pick a free display name, derived from the address when none was supplied.

    Returns None when an explicitly requested name is taken - unlike the email address, a
    username is public, so reporting the clash is normal and lets the user pick another.
    """
    if preferred:
        return None if await db_manager.get_account_by_username(preferred) else preferred

    base = re.sub(r"[^A-Za-z0-9._-]", "", email.split("@", 1)[0])[:24] or "user"
    if len(base) < 3:
        base = f"{base}user"
    candidate = base
    for _ in range(50):
        if not await db_manager.get_account_by_username(candidate):
            return candidate
        candidate = f"{base}{secrets.randbelow(10000)}"
    return None


async def _issue_verification(account_id: int, email: str, display_name: str) -> None:
    token, token_hash = _new_token()
    await db_manager.create_account_token(account_id, PURPOSE_EMAIL_VERIFICATION, token_hash, EMAIL_VERIFICATION_TTL)
    await send_verification_email(email, token, display_name)


@router.get("/config")
async def registration_config() -> dict:
    """What the sign-up UI needs to know before showing a form."""
    from osmosmjerka.passwords import MIN_PASSWORD_LENGTH

    return {"registration_enabled": REGISTRATION_ENABLED, "min_password_length": MIN_PASSWORD_LENGTH}


@router.post("/register")
@rate_limit(max_requests=5, window_seconds=3600)
async def register(body: RegisterRequest, request: Request) -> JSONResponse:
    """Create an unconfirmed account and email a confirmation link."""
    if not REGISTRATION_ENABLED:
        return _error("Self-registration is disabled on this instance.", status.HTTP_403_FORBIDDEN)

    email = _normalize_email(body.email)
    if not _EMAIL_RE.match(email):
        return _error("Please enter a valid email address.")

    username = body.username.strip() if body.username else None
    if username and not _USERNAME_RE.match(username):
        return _error("Display name must be 3-32 characters: letters, digits, spaces, dots, dashes, underscores.")

    try:
        validate_password(body.password, email=email, username=username)
    except PasswordPolicyError as exc:
        return _error(str(exc))

    existing = await db_manager.get_account_by_email(email)
    if existing:
        # Enumeration-safe: identical response to a fresh sign-up. If the account was
        # never confirmed, re-send the link - that's the honest owner retrying. For a
        # confirmed account we send nothing, so this can't be used to spam a mailbox.
        if not existing.get("email_verified", False):
            await _issue_verification(existing["id"], email, existing.get("username", ""))
        else:
            logger.info("Registration attempted for an existing confirmed account", extra={"user_id": existing["id"]})
        return JSONResponse({"message": _GENERIC_REGISTER_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)

    resolved_username = await _unique_username(username, email)
    if resolved_username is None:
        return _error("That display name is already taken.", status.HTTP_409_CONFLICT)

    account_id = await db_manager.create_account(
        username=resolved_username,
        password_hash=hash_password(body.password),
        role="regular",
        email=email,
        email_verified=False,
    )
    await _issue_verification(account_id, email, resolved_username)
    logger.info("Account registered, awaiting email confirmation", extra={"user_id": account_id})
    return JSONResponse({"message": _GENERIC_REGISTER_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)


@router.post("/resend-verification")
@rate_limit(max_requests=5, window_seconds=3600)
async def resend_verification(body: EmailRequest, request: Request) -> JSONResponse:
    """Re-send the confirmation link, if the address has an unconfirmed account."""
    email = _normalize_email(body.email)
    account = await db_manager.get_account_by_email(email) if _EMAIL_RE.match(email) else None
    if account and not account.get("email_verified", False):
        recent = await db_manager.count_recent_account_tokens(
            account["id"], PURPOSE_EMAIL_VERIFICATION, EMAIL_VERIFICATION_TTL
        )
        # Per-account cap on top of the per-IP limit, so nobody can use this endpoint to
        # bury someone else's inbox by cycling through addresses.
        if recent < 5:
            await _issue_verification(account["id"], email, account.get("username", ""))
        else:
            logger.warning("Verification resend throttled", extra={"user_id": account["id"]})
    return JSONResponse({"message": _GENERIC_REGISTER_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)


@router.post("/verify-email")
@rate_limit(max_requests=20, window_seconds=3600)
async def verify_email(body: TokenRequest, request: Request) -> JSONResponse:
    """Redeem a confirmation token and activate the account."""
    redeemed = await db_manager.consume_account_token(_hash_token(body.token), PURPOSE_EMAIL_VERIFICATION)
    if not redeemed:
        return _error("This confirmation link is invalid or has expired. Request a new one.")

    await db_manager.update_account(redeemed["account_id"], email_verified=True)
    logger.info("Email confirmed", extra={"user_id": redeemed["account_id"]})
    return JSONResponse({"message": "Your email is confirmed - you can sign in now."})


@router.post("/forgot-password")
@rate_limit(max_requests=5, window_seconds=3600)
async def forgot_password(body: EmailRequest, request: Request) -> JSONResponse:
    """Email a password-reset link, if the address has an account."""
    email = _normalize_email(body.email)
    account = await db_manager.get_account_by_email(email) if _EMAIL_RE.match(email) else None
    if account and account.get("is_active", False):
        recent = await db_manager.count_recent_account_tokens(account["id"], PURPOSE_PASSWORD_RESET, PASSWORD_RESET_TTL)
        if recent < 5:
            token, token_hash = _new_token()
            await db_manager.create_account_token(account["id"], PURPOSE_PASSWORD_RESET, token_hash, PASSWORD_RESET_TTL)
            await send_password_reset_email(email, token, account.get("username", ""))
        else:
            logger.warning("Password reset resend throttled", extra={"user_id": account["id"]})
    return JSONResponse({"message": _GENERIC_RESET_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)


@router.post("/reset-password")
@rate_limit(max_requests=10, window_seconds=3600)
async def reset_password(body: ResetPasswordRequest, request: Request) -> JSONResponse:
    """Redeem a reset token and set a new password."""
    token_hash = _hash_token(body.token)
    # Validate the password before burning the token, so a rejected password doesn't force
    # the user to request a whole new link.
    peeked = await db_manager.get_account_token_owner(token_hash, PURPOSE_PASSWORD_RESET)
    if peeked is None:
        return _error("This reset link is invalid or has expired. Request a new one.")

    account = await db_manager.get_account_by_id(peeked["account_id"])
    try:
        validate_password(
            body.password,
            email=account.get("email") if account else None,
            username=account.get("username") if account else None,
        )
    except PasswordPolicyError as exc:
        return _error(str(exc))

    redeemed = await db_manager.consume_account_token(token_hash, PURPOSE_PASSWORD_RESET)
    if not redeemed:
        return _error("This reset link is invalid or has expired. Request a new one.")

    account_id = redeemed["account_id"]
    await db_manager.update_account(
        account_id,
        password_hash=hash_password(body.password),
        # Holding the emailed link proves mailbox control, which is what confirmation
        # establishes - so an account that reset its password is confirmed too.
        email_verified=True,
    )
    # A forgotten password is the usual reason an account got locked out; the reset clears
    # that, and any other outstanding reset link is now void.
    await db_manager.clear_failed_logins(account_id)
    await db_manager.invalidate_account_tokens(account_id, PURPOSE_PASSWORD_RESET)
    logger.info("Password reset completed", extra={"user_id": account_id})
    return JSONResponse({"message": "Your password has been changed - you can sign in now."})
