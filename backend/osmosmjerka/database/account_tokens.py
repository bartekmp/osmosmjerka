"""Single-use token storage for email confirmation and password reset.

Only the SHA-256 hash of a token is ever persisted - the plaintext lives exclusively in
the emailed link. A leaked database therefore yields nothing replayable.

Timestamps are naive UTC to match the rest of the schema, whose DateTime columns are all
``TIMESTAMP WITHOUT TIME ZONE``.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from osmosmjerka.database.models import account_tokens_table
from sqlalchemy import and_, func
from sqlalchemy.sql import delete, insert, or_, select, update

# Confirmation links may sit in an inbox for a while; reset links are far more sensitive,
# so they get a short window - the industry norm for both.
EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

PURPOSE_EMAIL_VERIFICATION = "email_verification"
PURPOSE_PASSWORD_RESET = "password_reset"


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class AccountTokensMixin:
    """Mixin providing single-use account token operations."""

    async def create_account_token(self, account_id: int, purpose: str, token_hash: str, ttl: timedelta) -> int:
        """Store a hashed token, superseding any outstanding one for the same purpose.

        Issuing a new link invalidates the previous one, so a "resend" can't leave several
        live tokens lying around in old emails.
        """
        database = self._ensure_database()
        await self.invalidate_account_tokens(account_id, purpose)
        query = insert(account_tokens_table).values(
            account_id=account_id,
            purpose=purpose,
            token_hash=token_hash,
            expires_at=_now() + ttl,
        )
        return await database.execute(query)

    async def invalidate_account_tokens(self, account_id: int, purpose: str) -> None:
        """Mark every outstanding token for an account/purpose as used."""
        database = self._ensure_database()
        query = (
            update(account_tokens_table)
            .where(
                and_(
                    account_tokens_table.c.account_id == account_id,
                    account_tokens_table.c.purpose == purpose,
                    account_tokens_table.c.used_at.is_(None),
                )
            )
            .values(used_at=_now())
        )
        await database.execute(query)

    async def get_account_token_owner(self, token_hash: str, purpose: str) -> dict[str, Any] | None:
        """Look up a usable token without redeeming it.

        Lets an endpoint validate the rest of its input before burning a single-use token,
        so a rejected password doesn't cost the user their reset link. The redemption in
        :meth:`consume_account_token` re-checks everything, so this is not a TOCTOU hole.
        """
        database = self._ensure_database()
        query = select(account_tokens_table.c.id, account_tokens_table.c.account_id).where(
            and_(
                account_tokens_table.c.token_hash == token_hash,
                account_tokens_table.c.purpose == purpose,
                account_tokens_table.c.used_at.is_(None),
                account_tokens_table.c.expires_at > _now(),
            )
        )
        result = await database.fetch_one(query)
        return dict(result._mapping) if result else None

    async def consume_account_token(self, token_hash: str, purpose: str) -> dict[str, Any] | None:
        """Atomically redeem a token, returning its row - or None if it isn't usable.

        The unused/unexpired check lives in the UPDATE's WHERE clause rather than in a
        separate SELECT, so two simultaneous clicks on the same link can't both succeed.
        """
        database = self._ensure_database()
        query = (
            update(account_tokens_table)
            .where(
                and_(
                    account_tokens_table.c.token_hash == token_hash,
                    account_tokens_table.c.purpose == purpose,
                    account_tokens_table.c.used_at.is_(None),
                    account_tokens_table.c.expires_at > _now(),
                )
            )
            .values(used_at=_now())
            .returning(account_tokens_table.c.id, account_tokens_table.c.account_id)
        )
        result = await database.fetch_one(query)
        return dict(result._mapping) if result else None

    async def count_recent_account_tokens(self, account_id: int, purpose: str, within: timedelta) -> int:
        """How many tokens of this purpose were issued recently - backs resend throttling."""
        database = self._ensure_database()
        query = select(func.count(account_tokens_table.c.id)).where(
            and_(
                account_tokens_table.c.account_id == account_id,
                account_tokens_table.c.purpose == purpose,
                account_tokens_table.c.created_at > _now() - within,
            )
        )
        result = await database.fetch_one(query)
        return result[0] if result else 0

    async def cleanup_expired_account_tokens(self, retain_used_for: timedelta = timedelta(days=7)) -> int:
        """Delete tokens that are expired, or were used long enough ago to be uninteresting."""
        database = self._ensure_database()
        now = _now()
        condition = or_(
            account_tokens_table.c.expires_at < now,
            and_(
                account_tokens_table.c.used_at.is_not(None),
                account_tokens_table.c.used_at < now - retain_used_for,
            ),
        )

        # Count first: `databases.execute()` returns None for a DELETE, so counting is the
        # only way to honour the declared int return (and log a useful number).
        doomed = await database.fetch_val(select(func.count()).select_from(account_tokens_table).where(condition))
        if not doomed:
            return 0

        await database.execute(delete(account_tokens_table).where(condition))
        return int(doomed)
