"""Editable transactional email templates.

The root admin can rewrite the subject and body of each email from the admin panel. Bodies
are **Markdown**, rendered to HTML at send time and sent as multipart/alternative: the
Markdown source is the text part, the rendered HTML the HTML part. That way a client that
refuses HTML still gets something readable, and the admin never has to write email HTML.

Markdown rather than raw HTML is a safety property, not just convenience. markdown-it runs
with ``html=False``, so raw tags in the source are escaped rather than passed through, and
its link validator refuses ``javascript:`` URLs (they stay inert literal text) - there is no
way to author a template that injects script into a recipient's mail client, and no
sanitiser to keep up to date.

Placeholders are plain ``{{name}}`` substitutions, deliberately not a template engine:
nothing in an admin-authored string should be evaluated. ``validate_template`` rejects
unknown placeholders and insists the link is present, so a typo can't silently ship an
email nobody can act on.
"""

from typing import Any

from markdown_it import MarkdownIt
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

# html=False is the whole safety argument and must be passed explicitly: the "commonmark"
# preset turns raw-HTML passthrough ON for spec compliance, which would let a template
# author drop a <script> straight into a recipient's mail client.
_md = MarkdownIt("commonmark", {"html": False})

VERIFICATION = "verification"
PASSWORD_RESET = "password_reset"

# Placeholders each template may use. `link` is required - an email without it is useless.
PLACEHOLDERS: dict[str, set[str]] = {
    VERIFICATION: {"name", "link", "app_name", "email", "expiry_hours"},
    PASSWORD_RESET: {"name", "link", "app_name", "email", "expiry_hours"},
}
REQUIRED_PLACEHOLDER = "link"

DEFAULTS: dict[str, dict[str, str]] = {
    VERIFICATION: {
        "subject": "Confirm your {{app_name}} account",
        "body": (
            "Hi {{name}},\n\n"
            "Welcome to **{{app_name}}**! Please confirm your email address to activate "
            "your account:\n\n"
            "[Confirm my account]({{link}})\n\n"
            "The link is valid for {{expiry_hours}} hours.\n\n"
            "If you didn't create this account, you can ignore this message - no account "
            "is usable until the address is confirmed.\n"
        ),
    },
    PASSWORD_RESET: {
        "subject": "Reset your {{app_name}} password",
        "body": (
            "Hi {{name}},\n\n"
            "Someone requested a password reset for your **{{app_name}}** account. Use "
            "this link to choose a new password:\n\n"
            "[Choose a new password]({{link}})\n\n"
            "The link is valid for {{expiry_hours}} hour(s) and can be used once.\n\n"
            "If you didn't request this, ignore this message - your password stays "
            "unchanged.\n"
        ),
    },
}

# Deliberately minimal, all inline: email clients strip <style> blocks and support almost
# no modern CSS. This only has to make the default templates look intentional.
_HTML_SHELL = """<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f1e8;">
<div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px;
font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;
line-height:1.6;color:#2b2b2b;">
{content}
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e0d0;font-size:13px;color:#7a7466;">
{app_name}</p>
</div></body></html>"""


class TemplateError(ValueError):
    """Raised when a template fails validation."""


def _setting_key(kind: str, field: str) -> str:
    return f"email_template_{kind}_{field}"


def validate_template(kind: str, subject: str, body: str) -> None:
    """Check an admin-supplied template, raising TemplateError on a problem."""
    if kind not in DEFAULTS:
        raise TemplateError(f"Unknown template: {kind}")
    if not subject.strip():
        raise TemplateError("Subject cannot be empty")
    if not body.strip():
        raise TemplateError("Body cannot be empty")
    if len(subject) > 200:
        raise TemplateError("Subject must be at most 200 characters")
    if len(body) > 20000:
        raise TemplateError("Body must be at most 20000 characters")

    allowed = PLACEHOLDERS[kind]
    used = set(_find_placeholders(subject)) | set(_find_placeholders(body))
    unknown = sorted(used - allowed)
    if unknown:
        raise TemplateError(
            f"Unknown placeholder(s): {', '.join('{{' + name + '}}' for name in unknown)}. "
            f"Available: {', '.join('{{' + name + '}}' for name in sorted(allowed))}"
        )
    if REQUIRED_PLACEHOLDER not in _find_placeholders(body):
        raise TemplateError("The body must contain {{link}} - without it the email is useless")


def _find_placeholders(text: str) -> list[str]:
    import re

    return re.findall(r"\{\{\s*([a-z_]+)\s*\}\}", text)


def _substitute(text: str, context: dict[str, Any]) -> str:
    for name, value in context.items():
        text = text.replace("{{" + name + "}}", str(value))
    return text


async def get_template(kind: str) -> dict[str, str]:
    """The stored template for ``kind``, falling back to the built-in default.

    A database problem falls back rather than propagating: an unreachable settings table
    must not stop someone confirming their account or resetting their password.
    """
    default = DEFAULTS[kind]
    try:
        subject = await db_manager.get_global_setting(_setting_key(kind, "subject"), default["subject"])
        body = await db_manager.get_global_setting(_setting_key(kind, "body"), default["body"])
    except Exception:
        logger.error(
            "Could not read the stored email template; using the built-in default",
            extra={"template": kind},
            exc_info=True,
        )
        return dict(default)
    return {"subject": subject or default["subject"], "body": body or default["body"]}


async def set_template(kind: str, subject: str, body: str, updated_by: int) -> None:
    """Store a template after validating it."""
    validate_template(kind, subject, body)
    await db_manager.set_global_setting(
        _setting_key(kind, "subject"), subject, f"Subject line of the {kind} email", updated_by
    )
    await db_manager.set_global_setting(
        _setting_key(kind, "body"), body, f"Markdown body of the {kind} email", updated_by
    )


async def reset_template(kind: str, updated_by: int) -> dict[str, str]:
    """Restore the built-in default for ``kind`` and return it."""
    default = DEFAULTS[kind]
    await set_template(kind, default["subject"], default["body"], updated_by)
    return dict(default)


def render_markdown(body: str, app_name: str) -> str:
    """Render a Markdown body into a complete, self-contained HTML email."""
    return _HTML_SHELL.format(content=_md.render(body), app_name=app_name)


async def render(kind: str, context: dict[str, Any]) -> tuple[str, str, str]:
    """Resolve a template and fill it in.

    Returns ``(subject, text_body, html_body)``. A stored template that no longer passes
    validation (placeholders renamed by a code change, say) falls back to the built-in
    default rather than sending something broken.
    """
    template = await get_template(kind)
    try:
        validate_template(kind, template["subject"], template["body"])
    except TemplateError:
        logger.error(
            "Stored email template is invalid; falling back to the built-in default",
            extra={"template": kind},
            exc_info=True,
        )
        template = dict(DEFAULTS[kind])

    subject = _substitute(template["subject"], context)
    text_body = _substitute(template["body"], context)
    html_body = render_markdown(text_body, str(context.get("app_name", "")))
    return subject, text_body, html_body


# Stand-in values for the preview and the test send. The link deliberately points at the
# app root: a preview must never mint a real token, or "preview the confirmation email"
# becomes a way to confirm an address you don't control.
def _sample_context(kind: str) -> dict[str, Any]:
    from osmosmjerka.mailer import APP_NAME, base_url

    return {
        "name": "Alex",
        "email": "player@example.com",
        "link": f"{base_url()}/verify-email?token=EXAMPLE-TOKEN"
        if kind == VERIFICATION
        else f"{base_url()}/reset-password?token=EXAMPLE-TOKEN",
        "app_name": APP_NAME,
        "expiry_hours": 24 if kind == VERIFICATION else 1,
    }


def render_preview(kind: str, subject: str, body: str) -> tuple[str, str, str]:
    """Render an unsaved draft with sample values. Same code path as a real send."""
    context = _sample_context(kind)
    filled_subject = _substitute(subject, context)
    text_body = _substitute(body, context)
    return filled_subject, text_body, render_markdown(text_body, str(context["app_name"]))


async def send_test(kind: str, to: str) -> bool:
    """Send the saved template to an address with sample values, to check SMTP."""
    from osmosmjerka.mailer import send_email

    template = await get_template(kind)
    subject, text_body, html_body = render_preview(kind, template["subject"], template["body"])
    return await send_email(to, f"[Test] {subject}", text_body, html_body)
