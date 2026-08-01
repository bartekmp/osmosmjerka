"""Cheap bot resistance for the public forms that send email.

Two checks, neither of which a real user ever notices:

**A honeypot field.** The form carries an input that is hidden from view and from the
accessibility tree. A person cannot fill it in; a script that fills every field it finds
will. Anything that arrives with it filled is dropped.

**A signed form token.** ``/api/auth/config`` hands out a timestamp signed with the app
secret, and the form sends it back. That forces a would-be flooder to fetch the page
before every submission rather than POSTing in a loop, lets the server reject a form
submitted implausibly fast, and expires stale tabs.

This is deliberately not a CAPTCHA. It stops opportunistic scripted abuse at zero cost to
the user, no third-party script, and no personal data leaving the app. If a determined
attacker turns up, the next step is a self-hosted proof-of-work challenge - not an image
grid, which mostly punishes the humans.
"""

import base64
import hashlib
import hmac
import os
import time

from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

# A human needs a moment to type an address and a password twice. Anything faster came
# from a script that filled the fields programmatically.
MIN_FORM_FILL_SECONDS = float(os.getenv("MIN_FORM_FILL_SECONDS", "2"))
# Long enough that a tab left open over lunch still works.
FORM_TOKEN_TTL_SECONDS = int(os.getenv("FORM_TOKEN_TTL_SECONDS", str(6 * 60 * 60)))

# The honeypot's field name. Plausible enough that a naive bot fills it in.
HONEYPOT_FIELD = "website"


class FormTokenExpired(Exception):
    """The token was valid but is too old - the user needs to reload, not be silently dropped."""


def _secret() -> bytes:
    # Imported lazily: auth reads the key at import time and startup refuses to run without it.
    from osmosmjerka.auth import SECRET_KEY

    return SECRET_KEY.encode("utf-8")


def _sign(issued_at: str) -> str:
    return hmac.new(_secret(), issued_at.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def issue_form_token() -> str:
    """Mint a token for a form that is about to be shown."""
    issued_at = str(int(time.time()))
    raw = f"{issued_at}.{_sign(issued_at)}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def check_form_token(token: str | None) -> bool:
    """Whether this token is ours, unexpired, and old enough to have been typed into.

    Raises FormTokenExpired when it is genuinely ours but stale, so the caller can tell the
    user to reload instead of silently discarding a legitimate sign-up.
    """
    if not token:
        return False
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        issued_at, signature = raw.split(".", 1)
        age = time.time() - int(issued_at)
    except (ValueError, UnicodeDecodeError, base64.binascii.Error):
        return False

    if not hmac.compare_digest(signature, _sign(issued_at)):
        return False
    if age > FORM_TOKEN_TTL_SECONDS:
        raise FormTokenExpired
    # A negative age means a clock skew or a forged future timestamp; either way it did not
    # come from a form this server rendered a moment ago.
    return MIN_FORM_FILL_SECONDS <= age


def looks_automated(honeypot_value: str | None, form_token: str | None, context: str) -> bool:
    """Whether this submission should be quietly dropped.

    Quietly is the point: telling a bot which check it failed just tells it what to fix.
    A genuine user cannot trip either check, so there is no honest submission to lose.
    """
    if honeypot_value:
        logger.warning("Dropping submission: honeypot field was filled", extra={"form": context})
        return True
    if not check_form_token(form_token):
        logger.warning("Dropping submission: missing, forged or too-fast form token", extra={"form": context})
        return True
    return False
