"""Account and user management database operations."""

from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.sql import delete, insert, select, update

from osmosmjerka.database.models import accounts_table


class AccountsMixin:
    """Mixin class providing account management methods."""

    async def get_accounts(self, offset: int = 0, limit: int = 50) -> list[dict]:
        """Get all accounts with pagination."""
        database = self._ensure_database()
        query = (
            select(
                accounts_table.c.id,
                accounts_table.c.username,
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

    async def get_account_by_username(self, username: str) -> Optional[dict[str, Any]]:
        """Get account by username."""
        database = self._ensure_database()
        query = select(accounts_table).where(accounts_table.c.username == username)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def get_account_by_id(self, account_id: int) -> Optional[dict[str, Any]]:
        """Get account by ID."""
        database = self._ensure_database()
        query = select(
            accounts_table.c.id,
            accounts_table.c.username,
            accounts_table.c.role,
            accounts_table.c.self_description,
            accounts_table.c.created_at,
            accounts_table.c.updated_at,
            accounts_table.c.is_active,
            accounts_table.c.last_login,
        ).where(accounts_table.c.id == account_id)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def get_user_by_username(self, username: str) -> Optional[dict[str, Any]]:
        """Get user by username (alias for get_account_by_username)."""
        return await self.get_account_by_username(username)

    async def create_account(
        self,
        username: str,
        password_hash: str,
        role: str = "regular",
        self_description: str = "",
        id: Optional[int] = None,
    ) -> int:
        """Create a new account."""
        database = self._ensure_database()
        values = {
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "self_description": self_description,
            "is_active": True,
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

    async def get_account_count(self) -> int:
        """Get total account count."""
        database = self._ensure_database()
        query = select(func.count(accounts_table.c.id))
        result = await database.fetch_one(query)
        return result[0] if result else 0
