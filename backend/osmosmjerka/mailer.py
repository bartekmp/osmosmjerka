"""Outbound transactional email (account confirmation, password reset).

Delivery is plain SMTP configured entirely from the environment, so any provider works
without a code change. When ``SMTP_HOST`` is unset - local development, tests, E2E - the
message is logged instead of sent, including the full link, so the whole registration flow
can be exercised offline.

Sending is blocking (smtplib), so it runs in a worker thread; a delivery failure is logged
and reported to the caller rather than raised, because the endpoints deliberately answer
identically whether or not a mail went out.

Environment:
    SMTP_HOST, SMTP_PORT (default 587)
    SMTP_USERNAME, SMTP_PASSWORD  - omit for an unauthenticated relay
    SMTP_SECURITY                 - starttls (default) | ssl | none
    SMTP_TIMEOUT_SECONDS          - default 15
    MAIL_FROM, MAIL_FROM_NAME     - envelope sender
    APP_BASE_URL                  - public base URL used to build links
"""

import asyncio
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv
from osmosmjerka.logging_config import get_logger

load_dotenv()

logger = get_logger(__name__)

APP_NAME = "Osmosmjerka"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def is_configured() -> bool:
    """Whether a real SMTP server is configured. When False, mail is logged instead."""
    return bool(_env("SMTP_HOST"))


def base_url() -> str:
    """Public base URL for links in emails, without a trailing slash."""
    return _env("APP_BASE_URL", "http://localhost:5173").rstrip("/")


def _sender() -> str:
    address = _env("MAIL_FROM") or _env("SMTP_USERNAME") or "no-reply@localhost"
    name = _env("MAIL_FROM_NAME", APP_NAME)
    return formataddr((name, address)) if name else address


def _build_message(to: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = _sender()
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    return message


def _send_blocking(message: EmailMessage) -> None:
    """Hand the message to the SMTP server. Raises on failure; callers handle it."""
    host = _env("SMTP_HOST")
    security = _env("SMTP_SECURITY", "starttls").lower()
    port = int(_env("SMTP_PORT") or (465 if security == "ssl" else 587))
    timeout = float(_env("SMTP_TIMEOUT_SECONDS") or 15)
    username, password = _env("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD", "")

    smtp_class = smtplib.SMTP_SSL if security == "ssl" else smtplib.SMTP
    with smtp_class(host, port, timeout=timeout) as smtp:
        if security == "starttls":
            smtp.starttls()
        if username:
            smtp.login(username, password)
        smtp.send_message(message)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email, returning whether it was handed off successfully.

    With no SMTP server configured the message is logged and this returns True - the
    caller's flow is identical either way, which is what keeps offline development and the
    E2E suite working.
    """
    if not is_configured():
        logger.info(
            "SMTP is not configured; logging email instead of sending it\n"
            "--- email ---\nTo: %s\nSubject: %s\n\n%s\n--- end email ---",
            to,
            subject,
            body,
        )
        return True

    message = _build_message(to, subject, body)
    try:
        await asyncio.to_thread(_send_blocking, message)
    except (OSError, smtplib.SMTPException):
        # Never propagate: registration must not 500 because a relay is down, and the
        # endpoints answer identically regardless of delivery.
        logger.error("Failed to send email", extra={"subject": subject}, exc_info=True)
        return False

    logger.info("Email sent", extra={"subject": subject})
    return True


def verification_link(token: str) -> str:
    return f"{base_url()}/verify-email?token={token}"


def reset_link(token: str) -> str:
    return f"{base_url()}/reset-password?token={token}"


async def send_verification_email(to: str, token: str, display_name: str = "") -> bool:
    """Email the account-confirmation link."""
    greeting = f"Hi {display_name}," if display_name else "Hi,"
    body = (
        f"{greeting}\n\n"
        f"Welcome to {APP_NAME}! Please confirm your email address to activate your account:\n\n"
        f"{verification_link(token)}\n\n"
        "The link is valid for 24 hours.\n\n"
        "If you didn't create this account, you can ignore this message - "
        "no account is usable until the address is confirmed.\n"
    )
    return await send_email(to, f"Confirm your {APP_NAME} account", body)


async def send_password_reset_email(to: str, token: str, display_name: str = "") -> bool:
    """Email the password-reset link."""
    greeting = f"Hi {display_name}," if display_name else "Hi,"
    body = (
        f"{greeting}\n\n"
        f"Someone requested a password reset for your {APP_NAME} account. "
        "Use this link to choose a new password:\n\n"
        f"{reset_link(token)}\n\n"
        "The link is valid for 1 hour and can be used once.\n\n"
        "If you didn't request this, ignore this message - your password stays unchanged.\n"
    )
    return await send_email(to, f"Reset your {APP_NAME} password", body)
