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
    hash_account_token,
    new_account_token,
)
from osmosmjerka.logging_config import get_logger
from osmosmjerka.mailer import is_valid_email, send_password_reset_email, send_verification_email
from osmosmjerka.passwords import (
    MIN_PASSWORD_LENGTH,
    PasswordPolicyError,
    hash_password,
    validate_password,
)
from osmosmjerka.signup_guard import HONEYPOT_FIELD, FormTokenExpired, issue_form_token, looks_automated
from pydantic import BaseModel, Field

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Registration"])

# Per-IP hourly caps. Configurable for the same reason as the login limit: these are keyed
# on the source address, and a class signing up together shares one. The per-account
# throttles below (and the single-use, expiring tokens) are what stop abuse of an
# individual mailbox, and they are unaffected by these.
SIGNUP_ATTEMPTS_PER_HOUR = int(os.getenv("SIGNUP_ATTEMPTS_PER_HOUR", "5"))
EMAIL_REQUESTS_PER_HOUR = int(os.getenv("EMAIL_REQUESTS_PER_HOUR", "5"))
TOKEN_REDEMPTIONS_PER_HOUR = int(os.getenv("TOKEN_REDEMPTIONS_PER_HOUR", "20"))

_USERNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{1,30}[A-Za-z0-9])$")

# Same wording for every outcome, so timing aside there is nothing to learn from the body.
_GENERIC_REGISTER_MESSAGE = "Check your inbox - if the address can be registered, a confirmation link is on its way."
_GENERIC_RESET_MESSAGE = "Check your inbox - if that address has an account, a reset link is on its way."
_EXPIRED_FORM_MESSAGE = "This form has been open too long. Please reload the page and try again."


class RegisterRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)
    username: str | None = Field(default=None, max_length=32)
    # Bot resistance, see osmosmjerka.signup_guard. `website` is the honeypot: it is hidden
    # from both the page and the accessibility tree, so anything in it came from a script.
    website: str | None = Field(default=None, max_length=320)
    form_token: str | None = Field(default=None, max_length=256)


class EmailRequest(BaseModel):
    email: str = Field(max_length=320)
    website: str | None = Field(default=None, max_length=320)
    form_token: str | None = Field(default=None, max_length=256)


class TokenRequest(BaseModel):
    token: str = Field(max_length=256)


class ResetPasswordRequest(BaseModel):
    token: str = Field(max_length=256)
    password: str = Field(max_length=1024)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


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


# Per-account cap on confirmation and reset emails, on top of the per-IP rate limits. The
# IP limit protects the server; this protects a specific mailbox from being buried by
# someone cycling through addresses.
MAX_EMAILS_PER_ACCOUNT = 5


async def _issue_verification(account_id: int, email: str, display_name: str) -> bool:
    """Send a confirmation link, unless this account has already had its share recently.

    Both the sign-up and the resend path go through here. They used to differ - only
    resend checked the cap - which left re-submitting the sign-up form as a way to flood
    an unconfirmed address with mail.
    """
    recent = await db_manager.count_recent_account_tokens(
        account_id, PURPOSE_EMAIL_VERIFICATION, EMAIL_VERIFICATION_TTL
    )
    if recent >= MAX_EMAILS_PER_ACCOUNT:
        logger.warning("Confirmation email throttled for this account", extra={"user_id": account_id})
        return False

    token, token_hash = new_account_token()
    await db_manager.create_account_token(account_id, PURPOSE_EMAIL_VERIFICATION, token_hash, EMAIL_VERIFICATION_TTL)
    await send_verification_email(email, token, display_name)
    return True


@router.get("/config")
async def registration_config() -> dict:
    """What the sign-up UI needs to know before showing a form."""
    return {
        "registration_enabled": await db_manager.is_registration_enabled(),
        "min_password_length": MIN_PASSWORD_LENGTH,
        "form_token": issue_form_token(),
        "honeypot_field": HONEYPOT_FIELD,
    }


@router.post("/register")
@rate_limit(max_requests=SIGNUP_ATTEMPTS_PER_HOUR, window_seconds=3600)
async def register(body: RegisterRequest, request: Request) -> JSONResponse:
    """Create an unconfirmed account and email a confirmation link."""
    # Re-checked here rather than trusted from /config: the form hiding itself is a
    # courtesy, this is the part that actually closes registration.
    if not await db_manager.is_registration_enabled():
        return _error("Self-registration is disabled on this instance.", status.HTTP_403_FORBIDDEN)

    try:
        if looks_automated(body.website, body.form_token, "register"):
            # Same body a real sign-up gets: a bot must not learn which check caught it.
            return JSONResponse({"message": _GENERIC_REGISTER_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)
    except FormTokenExpired:
        # A genuine tab left open too long. Say so rather than silently dropping it.
        return _error(_EXPIRED_FORM_MESSAGE)

    email = _normalize_email(body.email)
    if not is_valid_email(email):
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
        # never confirmed, re-send the link - that's the honest owner retrying, and the
        # per-account cap inside _issue_verification stops it being a flooding path. For a
        # confirmed account we send nothing at all.
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
@rate_limit(max_requests=EMAIL_REQUESTS_PER_HOUR, window_seconds=3600)
async def resend_verification(body: EmailRequest, request: Request) -> JSONResponse:
    """Re-send the confirmation link, if the address has an unconfirmed account."""
    email = _normalize_email(body.email)
    account = await db_manager.get_account_by_email(email) if is_valid_email(email) else None
    if account and not account.get("email_verified", False):
        await _issue_verification(account["id"], email, account.get("username", ""))
    return JSONResponse({"message": _GENERIC_REGISTER_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)


@router.post("/verify-email")
@rate_limit(max_requests=TOKEN_REDEMPTIONS_PER_HOUR, window_seconds=3600)
async def verify_email(body: TokenRequest, request: Request) -> JSONResponse:
    """Redeem a confirmation token and activate the account."""
    redeemed = await db_manager.consume_account_token(hash_account_token(body.token), PURPOSE_EMAIL_VERIFICATION)
    if not redeemed:
        return _error("This confirmation link is invalid or has expired. Request a new one.")

    await db_manager.update_account(redeemed["account_id"], email_verified=True)
    logger.info("Email confirmed", extra={"user_id": redeemed["account_id"]})
    return JSONResponse({"message": "Your email is confirmed - you can sign in now."})


@router.post("/forgot-password")
@rate_limit(max_requests=EMAIL_REQUESTS_PER_HOUR, window_seconds=3600)
async def forgot_password(body: EmailRequest, request: Request) -> JSONResponse:
    """Email a password-reset link, if the address has an account."""
    try:
        if looks_automated(body.website, body.form_token, "forgot-password"):
            return JSONResponse({"message": _GENERIC_RESET_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)
    except FormTokenExpired:
        return _error(_EXPIRED_FORM_MESSAGE)

    email = _normalize_email(body.email)
    account = await db_manager.get_account_by_email(email) if is_valid_email(email) else None
    if account and account.get("is_active", False):
        recent = await db_manager.count_recent_account_tokens(account["id"], PURPOSE_PASSWORD_RESET, PASSWORD_RESET_TTL)
        if recent < MAX_EMAILS_PER_ACCOUNT:
            token, token_hash = new_account_token()
            await db_manager.create_account_token(account["id"], PURPOSE_PASSWORD_RESET, token_hash, PASSWORD_RESET_TTL)
            await send_password_reset_email(email, token, account.get("username", ""))
        else:
            logger.warning("Password reset resend throttled", extra={"user_id": account["id"]})
    return JSONResponse({"message": _GENERIC_RESET_MESSAGE}, status_code=status.HTTP_202_ACCEPTED)


@router.post("/reset-password")
@rate_limit(max_requests=TOKEN_REDEMPTIONS_PER_HOUR, window_seconds=3600)
async def reset_password(body: ResetPasswordRequest, request: Request) -> JSONResponse:
    """Redeem a reset token and set a new password."""
    token_hash = hash_account_token(body.token)
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
    # The whole point of a reset in a compromise: whoever else was signed in is now out.
    await db_manager.end_active_sessions(account_id)
    logger.info("Password reset completed", extra={"user_id": account_id})
    return JSONResponse({"message": "Your password has been changed - you can sign in now."})
