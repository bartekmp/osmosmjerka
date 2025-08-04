import datetime
import os
import urllib.parse
from typing import Any, Optional

from databases import Database
from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Integer, MetaData, String, Table, Text, create_engine
from sqlalchemy.sql import delete, func, insert, select, update

# Load environment variables
load_dotenv()

metadata = MetaData()

# Define the words table
words_table = Table(
    "words",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("categories", String, nullable=False),
    Column("word", String, nullable=False),
    Column("translation", Text, nullable=False),
)

# Define the accounts table for user management
accounts_table = Table(
    "accounts",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("username", String, nullable=False, unique=True),
    Column("password_hash", String, nullable=False),
    Column("role", String, nullable=False, default="regular"),  # root_admin, administrative, regular
    Column("self_description", Text),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("is_active", Boolean, nullable=False, default=True),
    Column("last_login", DateTime),
)

IGNORED_CATEGORIES_STR = os.getenv("IGNORED_CATEGORIES", "")
IGNORED_CATEGORIES = set(cat.strip() for cat in IGNORED_CATEGORIES_STR.split(",") if cat.strip())


class DatabaseManager:
    """Database manager class that encapsulates all database operations"""

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url
        self.database = None
        self.engine = None

    def _serialize_datetimes(self, dict_obj) -> dict:
        serialized_dict = {}
        for k, v in dict_obj.items():
            if isinstance(v, datetime.datetime):
                serialized_dict[k] = v.isoformat()
            else:
                serialized_dict[k] = v
        return serialized_dict

    def _ensure_database(self):
        if self.database is None:
            raise RuntimeError("Database connection is not initialized. Call connect() first.")
        return self.database

    def _ensure_engine(self):
        if self.engine is None:
            raise RuntimeError("Database engine is not initialized. Call connect() first.")
        return self.engine

    def _ensure_database_url(self):
        if self._database_url:
            return self._database_url
        pg_host = os.getenv("POSTGRES_HOST")
        pg_port = os.getenv("POSTGRES_PORT")
        pg_user = urllib.parse.quote_plus(os.getenv("POSTGRES_USER", ""))
        pg_password = urllib.parse.quote_plus(os.getenv("POSTGRES_PASSWORD", ""))
        pg_database = os.getenv("POSTGRES_DATABASE")
        if not pg_host or not pg_port or not pg_user or not pg_password or not pg_database:
            raise ValueError("PostgreSQL connection parameters are not set in environment variables.")
        return f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"

    async def connect(self):
        """Connect to the database and ensure tables exist"""
        database_url = self._ensure_database_url()
        if self.database is None:
            self.database = Database(database_url)
        if self.engine is None:
            self.engine = create_engine(database_url)
        await self.database.connect()
        self.create_tables()

    async def disconnect(self):
        """Disconnect from the database"""
        if self.database:
            await self.database.disconnect()

    def create_tables(self):
        """Create tables if they don't exist"""
        if self.engine:
            metadata.create_all(bind=self.engine)

    async def get_words(
        self, category: Optional[str] = None, limit: Optional[int] = None, offset: int = 0
    ) -> list[dict[str, str]]:
        database = self._ensure_database()
        query = select(words_table)
        if category:
            query = query.where(words_table.c.categories.like(f"%{category}%"))
        query = query.order_by(words_table.c.id)  # Always order by id ascending
        if limit:
            query = query.limit(limit).offset(offset)
        result = await database.fetch_all(query)
        row_list = []
        for row in result:
            # Convert row to dict for easier access
            row = dict(row)
            # Skip words shorter than 3 characters
            if len(str(row["word"]).strip()) < 3:
                continue
            # Remove ignored categories
            cats_set = set(row["categories"].split())
            cats_set = cats_set.difference(IGNORED_CATEGORIES)
            # Skip if no valid categories left
            if not cats_set:
                continue

            row["categories"] = " ".join(sorted(cats_set))
            row_list.append(row)
        return row_list

    async def get_word_count(self, category: Optional[str] = None) -> int:
        database = self._ensure_database()
        query = select(func.count(words_table.c.id))
        if category:
            query = query.where(words_table.c.categories.like(f"%{category}%"))
        result = await database.fetch_one(query)
        return result[0] if result else 0

    async def add_word(self, categories: str, word: str, translation: str):
        database = self._ensure_database()
        query = insert(words_table).values(categories=categories, word=word, translation=translation)
        result = await database.execute(query)
        return result

    async def update_word(self, word_id: int, categories: str, word: str, translation: str):
        database = self._ensure_database()
        query = (
            update(words_table)
            .where(words_table.c.id == word_id)
            .values(categories=categories, word=word, translation=translation)
        )
        result = await database.execute(query)
        return result

    async def delete_word(self, word_id: int):
        database = self._ensure_database()
        query = delete(words_table).where(words_table.c.id == word_id)
        result = await database.execute(query)
        return result

    async def clear_all_words(self):
        database = self._ensure_database()
        query = delete(words_table)
        await database.execute(query)
        # Reset the id sequence so new rows start from 1
        await database.execute("ALTER SEQUENCE words_id_seq RESTART WITH 1;")

    async def get_categories(self) -> list[str]:
        database = self._ensure_database()
        query = select(words_table.c.categories)
        result = await database.fetch_all(query)
        categories = set()
        for row in result:
            cats = row["categories"].split()
            for cat in cats:
                if cat not in IGNORED_CATEGORIES:
                    categories.add(cat.strip())
        return sorted(list(categories))

    def fast_bulk_insert_words(self, words_data):
        engine = self._ensure_engine()
        if not words_data:
            return
        with engine.begin() as conn:
            conn.execute(insert(words_table), words_data)

    async def get_accounts(self, offset: int = 0, limit: int = 50) -> list[dict]:
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
        database = self._ensure_database()
        query = select(accounts_table).where(accounts_table.c.username == username)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result)) if result else None

    async def get_account_by_id(self, account_id: int) -> Optional[dict[str, Any]]:
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
        return self._serialize_datetimes(dict(result)) if result else None

    async def create_account(
        self,
        username: str,
        password_hash: str,
        role: str = "regular",
        self_description: str = "",
        id: Optional[int] = None,
    ) -> int:
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
        database = self._ensure_database()
        # Remove None values and ensure updated_at is set
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        update_data["updated_at"] = func.now()

        query = update(accounts_table).where(accounts_table.c.id == account_id).values(**update_data)
        result = await database.execute(query)
        return result

    async def delete_account(self, account_id: int) -> int:
        database = self._ensure_database()
        query = delete(accounts_table).where(accounts_table.c.id == account_id)
        result = await database.execute(query)
        return result

    async def update_last_login(self, username: str) -> None:
        database = self._ensure_database()
        query = update(accounts_table).where(accounts_table.c.username == username).values(last_login=func.now())
        await database.execute(query)

    async def get_account_count(self) -> int:
        database = self._ensure_database()
        query = select(func.count(accounts_table.c.id))
        result = await database.fetch_one(query)
        return result[0] if result else 0


# Create global database manager instance
db_manager = DatabaseManager()
