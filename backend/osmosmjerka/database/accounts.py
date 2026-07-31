"""Account and user management database operations."""

from datetime import UTC, datetime, timedelta
from typing import Any

from osmosmjerka.database.models import accounts_table
from sqlalchemy import case, func
from sqlalchemy.sql import delete, insert, select, update


def _utc_now() -> datetime:
    """Naive UTC, matching the schema's TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(UTC).replace(tzinfo=None)


class AccountsMixin:
    """Mixin class providing account management methods."""

    async def get_accounts(self, offset: int = 0, limit: int = 50) -> list[dict]:
        """Get all accounts with pagination."""
        database = self._ensure_database()
        query = (
            select(
                accounts_table.c.id,
                accounts_table.c.username,
                accounts_table.c.email,
                accounts_table.c.email_verified,
                accounts_table.c.role,
                accounts_table.c.self_description,
                accounts_table.c.created_at,
                accounts_table.c.updated_at,
                accounts_table.c.is_active,
                accounts_table.c.last_login,
            )
            .limit(limit)
            .offset(offset)
        )
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def get_account_by_username(self, username: str) -> dict[str, Any] | None:
        """Get account by username."""
        database = self._ensure_database()
        query = select(accounts_table).where(accounts_table.c.username == username)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def get_account_by_email(self, email: str) -> dict[str, Any] | None:
        """Get account by email address. Matching is case-insensitive."""
        database = self._ensure_database()
        query = select(accounts_table).where(func.lower(accounts_table.c.email) == email.strip().lower())
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def get_account_by_identifier(self, identifier: str) -> dict[str, Any] | None:
        """Get account by email address, falling back to username.

        Self-registered users log in with their email; the root admin, admin-created
        accounts and the staging demo account predate email identity and log in by
        username, so both are accepted on the same field.
        """
        identifier = identifier.strip()
        if "@" in identifier:
            return await self.get_account_by_email(identifier)
        return await self.get_account_by_username(identifier)

    async def get_account_by_id(self, account_id: int) -> dict[str, Any] | None:
        """Get account by ID."""
        database = self._ensure_database()
        query = select(
            accounts_table.c.id,
            accounts_table.c.username,
            accounts_table.c.email,
            accounts_table.c.email_verified,
            accounts_table.c.role,
            accounts_table.c.self_description,
            accounts_table.c.created_at,
            accounts_table.c.updated_at,
            accounts_table.c.is_active,
            accounts_table.c.last_login,
        ).where(accounts_table.c.id == account_id)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        """Get user by username (alias for get_account_by_username)."""
        return await self.get_account_by_username(username)

    async def create_account(
        self,
        username: str,
        password_hash: str,
        role: str = "regular",
        account_tier: str = "tier1",
        self_description: str = "",
        id: int | None = None,
        email: str | None = None,
        email_verified: bool = False,
    ) -> int:
        """Create a new account.

        ``email`` is stored lowercased so the unique constraint can't be sidestepped by
        capitalisation. Admin-created accounts pass no email and log in by username.
        """
        database = self._ensure_database()
        values = {
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "account_tier": account_tier,
            "self_description": self_description,
            "is_active": True,
            "email": email.strip().lower() if email else None,
            "email_verified": email_verified,
        }
        if id is not None and role == "root_admin":
            values["id"] = id
        query = insert(accounts_table).values(**values)
        result = await database.execute(query)
        return result

    async def update_account(self, account_id: int, **kwargs) -> int:
        """Update an account."""
        database = self._ensure_database()
        # Remove None values and ensure updated_at is set
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        update_data["updated_at"] = func.now()

        query = update(accounts_table).where(accounts_table.c.id == account_id).values(**update_data)
        result = await database.execute(query)
        return result

    async def delete_account(self, account_id: int) -> int:
        """Delete an account."""
        database = self._ensure_database()
        query = delete(accounts_table).where(accounts_table.c.id == account_id)
        result = await database.execute(query)
        return result

    async def update_last_login(self, username: str) -> None:
        """Update last login timestamp for a user."""
        database = self._ensure_database()
        query = update(accounts_table).where(accounts_table.c.username == username).values(last_login=func.now())
        await database.execute(query)

    async def record_failed_login(self, account_id: int, max_attempts: int, lockout: timedelta) -> int:
        """Increment the failed-login counter, locking the account once it hits the limit.

        Returns the new attempt count. Done in a single statement so concurrent guesses
        can't interleave a read-modify-write and lose counts.
        """
        database = self._ensure_database()
        attempts = accounts_table.c.failed_login_attempts + 1
        query = (
            update(accounts_table)
            .where(accounts_table.c.id == account_id)
            .values(
                failed_login_attempts=attempts,
                locked_until=case(
                    (attempts >= max_attempts, _utc_now() + lockout),
                    else_=accounts_table.c.locked_until,
                ),
            )
            .returning(accounts_table.c.failed_login_attempts)
        )
        result = await database.fetch_one(query)
        return result[0] if result else 0

    async def clear_failed_logins(self, account_id: int) -> None:
        """Reset the lockout state after a successful login."""
        database = self._ensure_database()
        query = (
            update(accounts_table)
            .where(accounts_table.c.id == account_id)
            .values(failed_login_attempts=0, locked_until=None)
        )
        await database.execute(query)

    async def end_active_sessions(self, account_id: int) -> None:
        """Invalidate every access token issued for this account up to now.

        Called whenever the password changes or the account is disabled. Tokens are
        stateless and long-lived, so without this a reset leaves whoever else holds one
        signed in until it expires - which is precisely who the reset is meant to evict.
        """
        database = self._ensure_database()
        # Truncated to the second to match the granularity of a JWT's `iat`, which is whole
        # seconds by spec. Storing microseconds makes a token minted moments later look
        # older than the cut-off, so the user resets their password, signs in, and is
        # immediately signed out again - which is what the E2E suite caught.
        cutoff = _utc_now().replace(microsecond=0)
        query = update(accounts_table).where(accounts_table.c.id == account_id).values(sessions_valid_from=cutoff)
        await database.execute(query)

    async def get_account_count(self) -> int:
        """Get total account count."""
        database = self._ensure_database()
        query = select(func.count(accounts_table.c.id))
        result = await database.fetch_one(query)
        return result[0] if result else 0
