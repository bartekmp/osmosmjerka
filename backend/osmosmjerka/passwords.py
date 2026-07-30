"""Password hashing and policy.

Argon2id is the hashing algorithm for anything set from now on. Existing accounts were
hashed with bcrypt, so :func:`verify_password` accepts both and
:func:`needs_rehash` tells callers when a stored hash should be upgraded - the login
path re-hashes transparently, so no user is locked out and no forced reset is needed.

Parameters follow the OWASP Password Storage Cheat Sheet's Argon2id recommendation
(19 MiB memory, 2 iterations, 1 degree of parallelism). They are deliberately encoded in
the hash string itself, so raising them later only affects newly written hashes and old
ones keep verifying.
"""

import re

import bcrypt
from argon2 import PasswordHasher
from argon2 import exceptions as argon2_exceptions
from argon2.profiles import RFC_9106_LOW_MEMORY
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

_hasher = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)

# --- policy ------------------------------------------------------------------
MIN_PASSWORD_LENGTH = 10
# Argon2id has no practical input limit, but an unbounded password is a cheap way to
# burn server CPU, so cap it well above any realistic passphrase.
MAX_PASSWORD_LENGTH = 1024

_COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password1",
        "password123",
        "12345678",
        "123456789",
        "1234567890",
        "qwertyuiop",
        "qwerty123",
        "letmein",
        "welcome",
        "welcome1",
        "iloveyou",
        "admin123",
        "administrator",
        "changeme",
        "osmosmjerka",
    }
)


class PasswordPolicyError(ValueError):
    """Raised when a password fails :func:`validate_password`."""


def validate_password(password: str, *, email: str | None = None, username: str | None = None) -> None:
    """Check a password against the policy, raising PasswordPolicyError on failure.

    Length is the dominant factor in real-world strength, so this favours a decent
    minimum length over character-class rules, which mostly push users towards
    predictable substitutions. It does reject the handful of passwords that dominate
    credential-stuffing lists, and anything containing the user's own email or username.
    """
    if not isinstance(password, str) or not password:
        raise PasswordPolicyError("Password is required")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise PasswordPolicyError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters long")
    if password.strip() == "":
        raise PasswordPolicyError("Password cannot be only whitespace")

    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS:
        raise PasswordPolicyError("This password is too common - please choose another")
    if len(set(password)) < 4:
        raise PasswordPolicyError("Password must not repeat the same few characters")

    for identifier in (email, username):
        if not identifier:
            continue
        local_part = identifier.split("@", 1)[0].lower()
        if len(local_part) >= 4 and local_part in lowered:
            raise PasswordPolicyError("Password must not contain your email address or username")


# --- hashing -----------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a password with Argon2id. Assumes validate_password() already ran."""
    return _hasher.hash(password)


def _is_bcrypt_hash(stored_hash: str) -> bool:
    return bool(re.match(r"^\$2[aby]?\$", stored_hash))


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against either an Argon2id or a legacy bcrypt hash.

    Returns False rather than raising on a malformed or unrecognised hash, so a corrupt
    row denies access instead of 500ing the login endpoint.
    """
    if not password or not stored_hash:
        return False

    if _is_bcrypt_hash(stored_hash):
        try:
            # bcrypt silently truncates at 72 bytes; only legacy hashes reach this path.
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except (ValueError, TypeError):
            logger.error("Stored bcrypt hash is malformed; denying authentication", exc_info=True)
            return False

    try:
        return _hasher.verify(stored_hash, password)
    except argon2_exceptions.VerifyMismatchError:
        return False
    except argon2_exceptions.InvalidHashError:
        logger.error("Stored password hash is not a recognised format; denying authentication")
        return False
    except argon2_exceptions.VerificationError:
        logger.error("Password verification failed unexpectedly; denying authentication", exc_info=True)
        return False


def needs_rehash(stored_hash: str) -> bool:
    """Whether a verified hash should be replaced (legacy bcrypt, or stale parameters)."""
    if not stored_hash:
        return False
    if _is_bcrypt_hash(stored_hash):
        return True
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except argon2_exceptions.InvalidHashError:
        return False
