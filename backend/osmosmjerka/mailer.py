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
import re
import smtplib
import time
from collections import deque
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv
from osmosmjerka import email_templates
from osmosmjerka.logging_config import get_logger

load_dotenv()

logger = get_logger(__name__)

APP_NAME = "Osmosmjerka"

# Deliberately permissive: the only authoritative test of an address is whether the mail
# arrives, and over-strict patterns reject valid addresses. It does exclude whitespace,
# which is what keeps a newline out of the To header.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")


def is_valid_email(email: str) -> bool:
    """Whether this looks like an address we can put in a header and try to deliver to."""
    return bool(email) and len(email) <= 320 and bool(_EMAIL_RE.match(email.strip()))


# --- outbound budget ---------------------------------------------------------
# A ceiling on how much mail this process will send in an hour, regardless of who asked.
#
# Not an anti-bot measure - the per-IP and per-account limits do that. This is the circuit
# breaker for when they are not enough: bulk sign-ups with junk addresses generate bounces,
# bounces get a sending domain blocklisted, and a blocklisted domain means real
# confirmation emails land in spam. That is the failure that takes weeks to undo, so it is
# worth refusing to send at all rather than sending your reputation away.
#
# Per process, like the rate limiter - with several replicas the real ceiling is this times
# the replica count.
MAX_OUTBOUND_EMAILS_PER_HOUR = int(os.getenv("MAX_OUTBOUND_EMAILS_PER_HOUR", "200"))
_BUDGET_WINDOW_SECONDS = 3600
_recent_sends: deque[float] = deque()


def _budget_allows() -> bool:
    """Whether the hourly outbound budget has room, counting this send if so."""
    if MAX_OUTBOUND_EMAILS_PER_HOUR <= 0:
        return True

    now = time.monotonic()
    while _recent_sends and now - _recent_sends[0] > _BUDGET_WINDOW_SECONDS:
        _recent_sends.popleft()

    if len(_recent_sends) >= MAX_OUTBOUND_EMAILS_PER_HOUR:
        return False

    _recent_sends.append(now)
    return True


def outbound_budget_remaining() -> int:
    """How many more emails this process will send this hour. Surfaced in the admin panel."""
    if MAX_OUTBOUND_EMAILS_PER_HOUR <= 0:
        return -1  # unlimited
    now = time.monotonic()
    used = sum(1 for sent_at in _recent_sends if now - sent_at <= _BUDGET_WINDOW_SECONDS)
    return max(MAX_OUTBOUND_EMAILS_PER_HOUR - used, 0)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def is_configured() -> bool:
    """Whether a real SMTP server is configured. When False, mail is logged instead."""
    return bool(_env("SMTP_HOST"))


def base_url() -> str:
    """Public base URL for links in emails, without a trailing slash."""
    return _env("APP_BASE_URL", "http://localhost:5173").rstrip("/")


def sender_address() -> str:
    """The bare From address. Shown in the admin panel so a misconfiguration is visible."""
    return _env("MAIL_FROM") or _env("SMTP_USERNAME") or "no-reply@localhost"


def _sender() -> str:
    name = _env("MAIL_FROM_NAME", APP_NAME)
    address = sender_address()
    return formataddr((name, address)) if name else address


def _build_message(to: str, subject: str, body: str, html_body: str | None = None) -> EmailMessage:
    """Build the message, as multipart/alternative when an HTML part is supplied.

    The plain-text part goes first and the HTML second, which is what the format requires:
    a client picks the last part it can render, so getting the order wrong means text-only
    clients win everywhere.
    """
    message = EmailMessage()
    message["From"] = _sender()
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
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


async def send_email(to: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """Send an email, returning whether it was handed off successfully.

    With no SMTP server configured the message is logged and this returns True - the
    caller's flow is identical either way, which is what keeps offline development and the
    E2E suite working. Only the text part is logged; the HTML says the same thing and would
    bury the link in markup.
    """
    if not is_valid_email(to):
        logger.error("Refusing to send to a malformed address")
        return False

    if is_configured() and not _budget_allows():
        logger.error(
            "Outbound email budget exhausted; refusing to send",
            extra={"subject": subject, "limit_per_hour": MAX_OUTBOUND_EMAILS_PER_HOUR},
        )
        return False

    if not is_configured():
        logger.info(
            "SMTP is not configured; logging email instead of sending it\n"
            "--- email ---\nTo: %s\nSubject: %s\n\n%s\n--- end email ---",
            to,
            subject,
            body,
        )
        return True

    try:
        # Inside the guard on purpose: Python refuses to build a message whose headers
        # contain a newline, and that ValueError would otherwise surface as a 500 on
        # whatever flow triggered the send.
        message = _build_message(to, subject, body, html_body)
        await asyncio.to_thread(_send_blocking, message)
    except (OSError, ValueError, smtplib.SMTPException):
        # Never propagate: registration must not 500 because a relay is down or a template
        # is malformed, and the endpoints answer identically regardless of delivery.
        logger.error("Failed to send email", extra={"subject": subject}, exc_info=True)
        return False

    logger.info("Email sent", extra={"subject": subject})
    return True


def verification_link(token: str) -> str:
    return f"{base_url()}/verify-email?token={token}"


def reset_link(token: str) -> str:
    return f"{base_url()}/reset-password?token={token}"


async def _send_templated(kind: str, to: str, display_name: str, link: str, expiry_hours: int) -> bool:
    """Render the admin-editable template for `kind` and send it."""
    subject, text_body, html_body = await email_templates.render(
        kind,
        {
            # "there" keeps "Hi {{name}}," reading naturally for an account with no
            # display name, rather than emitting "Hi ,".
            "name": display_name or "there",
            "email": to,
            "link": link,
            "app_name": APP_NAME,
            "expiry_hours": expiry_hours,
        },
    )
    return await send_email(to, subject, text_body, html_body)


async def send_verification_email(to: str, token: str, display_name: str = "") -> bool:
    """Email the account-confirmation link."""
    return await _send_templated(email_templates.VERIFICATION, to, display_name, verification_link(token), 24)


async def send_password_reset_email(to: str, token: str, display_name: str = "") -> bool:
    """Email the password-reset link."""
    return await _send_templated(email_templates.PASSWORD_RESET, to, display_name, reset_link(token), 1)
