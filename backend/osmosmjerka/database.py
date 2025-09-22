import datetime
import os
import time
import urllib.parse
from typing import Any, Dict, List, Optional

from databases import Database
from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Integer, MetaData, String, Table, Text, create_engine, desc
from sqlalchemy.sql import delete, func, insert, select, update

# Load environment variables
load_dotenv()

metadata = MetaData()

# Define the language_sets table
language_sets_table = Table(
    "language_sets",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("name", String, nullable=False, unique=True),  # Short name like "hr-pl"
    Column("display_name", String, nullable=False),  # User-friendly name like "Croatian-Polish"
    Column("description", Text, nullable=True),
    Column("author", String, nullable=True),
    Column("created_by", Integer, nullable=True),  # User ID of creator, NULL for root admin (id=0)
    Column("default_ignored_categories", Text, nullable=True),  # Comma-separated list of ignored categories
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("is_active", Boolean, nullable=False, default=True),
    Column("is_default", Boolean, nullable=False, default=False),
)


# Dynamic phrase table creation function
def create_phrase_table(table_name: str) -> Table:
    """Create a phrases table for a specific language set"""
    return Table(
        table_name,
        metadata,
        Column("id", Integer, primary_key=True, index=True),
        Column("categories", String, nullable=False),
        Column("phrase", String, nullable=False),
        Column("translation", Text, nullable=False),
        extend_existing=True,
    )


# Language sets table

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

# Define the user_ignored_categories table
user_ignored_categories_table = Table(
    "user_ignored_categories",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
)

# Define the user_statistics table for storing game statistics
user_statistics_table = Table(
    "user_statistics",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("games_started", Integer, nullable=False, default=0),
    Column("games_completed", Integer, nullable=False, default=0),
    Column("puzzles_solved", Integer, nullable=False, default=0),
    Column("total_phrases_found", Integer, nullable=False, default=0),
    Column("total_time_played_seconds", Integer, nullable=False, default=0),
    Column("phrases_added", Integer, nullable=False, default=0),
    Column("phrases_edited", Integer, nullable=False, default=0),
    Column("last_played", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

# Define the user_category_plays table for tracking favorite categories
user_category_plays_table = Table(
    "user_category_plays",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False, index=True),
    Column("plays_count", Integer, nullable=False, default=1),
    Column("phrases_found", Integer, nullable=False, default=0),
    Column("total_time_seconds", Integer, nullable=False, default=0),
    Column("last_played", DateTime, nullable=False, server_default=func.now()),
)

# Define the game_sessions table for tracking individual game sessions
game_sessions_table = Table(
    "game_sessions",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
    Column("difficulty", String, nullable=False),
    Column("grid_size", Integer, nullable=False),
    Column("total_phrases", Integer, nullable=False),
    Column("phrases_found", Integer, nullable=False, default=0),
    Column("is_completed", Boolean, nullable=False, default=False),
    Column("start_time", DateTime, nullable=False, server_default=func.now()),
    Column("end_time", DateTime, nullable=True),
    Column("duration_seconds", Integer, nullable=True),
)

# Define the global_settings table for application-wide settings
global_settings_table = Table(
    "global_settings",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("setting_key", String, nullable=False, unique=True),
    Column("setting_value", String, nullable=False),
    Column("description", Text, nullable=True),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_by", Integer, nullable=False),  # User ID of who made the change
)

# Define the user_preferences table for user-specific settings
user_preferences_table = Table(
    "user_preferences",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("preference_key", String, nullable=False),
    Column("preference_value", String, nullable=False),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

# Define the game_scores table for storing individual game scores
game_scores_table = Table(
    "game_scores",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("session_id", Integer, nullable=False, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
    Column("difficulty", String, nullable=False),
    Column("grid_size", Integer, nullable=False),
    Column("total_phrases", Integer, nullable=False),
    Column("phrases_found", Integer, nullable=False),
    Column("hints_used", Integer, nullable=False, default=0),
    Column("base_score", Integer, nullable=False, default=0),
    Column("time_bonus", Integer, nullable=False, default=0),
    Column("difficulty_bonus", Integer, nullable=False, default=0),
    Column("streak_bonus", Integer, nullable=False, default=0),
    Column("hint_penalty", Integer, nullable=False, default=0),
    Column("final_score", Integer, nullable=False, default=0),
    Column("duration_seconds", Integer, nullable=False),
    Column("first_phrase_time", DateTime, nullable=True),
    Column("completion_time", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
)


class DatabaseManager:
    """Database manager class that encapsulates all database operations using hybrid approach"""

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url
        self.database = None
        self.engine = None
        self._phrase_tables_cache = {}  # Cache for dynamically created phrase tables
        self._statistics_cache = {}  # Cache for user statistics with TTL
        self._statistics_cache_ttl = 300  # 5 minutes cache TTL

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
        """Create base tables if they don't exist"""
        if self.engine:
            metadata.create_all(bind=self.engine)

    def _get_phrase_table_name(self, language_set_name: str) -> str:
        """Get the table name for a language set's phrases using the set's short name"""
        # Sanitize the name to ensure it's safe for SQL table names
        safe_name = language_set_name.replace("-", "_").replace(" ", "_").lower()
        return f"phrases_{safe_name}"

    def _get_phrase_table(self, language_set_name: str) -> Table:
        """Get or create a phrase table for a specific language set"""
        table_name = self._get_phrase_table_name(language_set_name)

        # Check cache first
        if table_name in self._phrase_tables_cache:
            return self._phrase_tables_cache[table_name]

        # Create new table object
        phrase_table = create_phrase_table(table_name)
        self._phrase_tables_cache[table_name] = phrase_table

        # Create the actual table in database if it doesn't exist
        if self.engine:
            phrase_table.create(bind=self.engine, checkfirst=True)

        return phrase_table

    async def _ensure_phrase_table_exists(self, language_set_name: str):
        """Ensure phrase table exists for the given language set"""
        table_name = self._get_phrase_table_name(language_set_name)
        database = self._ensure_database()

        # Check if table exists
        result = await database.fetch_one(
            f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table_name}')"
        )

        if not (result and result[0]):
            # Table doesn't exist, create it
            phrase_table = self._get_phrase_table(language_set_name)
            if self.engine:
                phrase_table.create(bind=self.engine, checkfirst=True)

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
        return self._serialize_datetimes(dict(result._mapping)) if result else None

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
        return self._serialize_datetimes(dict(result._mapping)) if result else None

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

    # Language Set Management Methods
    async def get_language_sets(self, active_only: bool = True) -> list[dict]:
        """Get all language sets with protected flag"""
        database = self._ensure_database()
        query = select(language_sets_table)
        if active_only:
            query = query.where(language_sets_table.c.is_active == True)
        # Default first, then by display name
        query = query.order_by(language_sets_table.c.is_default.desc(), language_sets_table.c.display_name)
        result = await database.fetch_all(query)

        language_sets = []
        for row in result:
            lang_set = self._serialize_datetimes(dict(row))
            # Add protected flag: protected if created_by is None or 0
            lang_set["protected"] = lang_set.get("created_by") is None or lang_set.get("created_by") == 0
            language_sets.append(lang_set)

        return language_sets

    async def get_language_set_by_id(self, language_set_id: int) -> Optional[dict]:
        """Get a specific language set by ID"""
        database = self._ensure_database()
        query = select(language_sets_table).where(language_sets_table.c.id == language_set_id)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result._mapping)) if result else None

    async def create_language_set(
        self,
        name: str,
        display_name: str,
        description: Optional[str] = None,
        author: Optional[str] = None,
        created_by: Optional[int] = None,
        default_ignored_categories: Optional[list[str]] = None,
    ) -> int:
        """Create a new language set and its phrase table"""
        database = self._ensure_database()

        # Convert default_ignored_categories list to comma-separated string
        default_ignored_str = ",".join(default_ignored_categories) if default_ignored_categories else None

        # Create language set record
        query = insert(language_sets_table).values(
            name=name,
            display_name=display_name,
            description=description,
            author=author,
            created_by=created_by,
            default_ignored_categories=default_ignored_str,
            is_active=True,
            is_default=False,
        )
        language_set_id = await database.execute(query)

        # Create the phrase table for this language set
        await self._ensure_phrase_table_exists(name)

        return language_set_id

    async def update_language_set(self, language_set_id: int, **updates) -> int:
        """Update language set metadata"""
        database = self._ensure_database()
        query = update(language_sets_table).where(language_sets_table.c.id == language_set_id).values(**updates)
        return await database.execute(query)

    async def is_language_set_protected(self, language_set_id: int) -> bool:
        """Check if a language set is protected (created by root admin)"""
        database = self._ensure_database()
        query = select(language_sets_table.c.created_by).where(language_sets_table.c.id == language_set_id)
        result = await database.fetch_one(query)
        # If created_by is None or 0, it's considered a root-admin-created set (protected)
        return result is None or result[0] is None or result[0] == 0

    async def get_default_ignored_categories(self, language_set_id: int) -> list[str]:
        """Get default ignored categories for a language set"""
        database = self._ensure_database()
        query = select(language_sets_table.c.default_ignored_categories).where(
            language_sets_table.c.id == language_set_id
        )
        result = await database.fetch_one(query)
        if result and result[0]:
            return [cat.strip() for cat in result[0].split(",") if cat.strip()]
        return []

    async def delete_language_set(self, language_set_id: int):
        """Delete a language set and its phrase table"""
        database = self._ensure_database()

        # First get the language set to find its name
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return

        # Drop the phrase table
        table_name = self._get_phrase_table_name(language_set["name"])
        await database.execute(f"DROP TABLE IF EXISTS {table_name}")

        # Remove from cache
        if table_name in self._phrase_tables_cache:
            del self._phrase_tables_cache[table_name]

        # Delete the language set
        await database.execute(delete(language_sets_table).where(language_sets_table.c.id == language_set_id))

    # Phrase Management Methods (replacing word methods with dynamic tables)
    async def get_phrases(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        ignored_categories_override: Optional[set[str]] = None,
    ) -> list[dict[str, str]]:
        """Get phrases from specified language set using dynamic table"""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        # Get the dynamic phrase table
        phrase_table = self._get_phrase_table(language_set["name"])

        query = select(phrase_table)
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        query = query.order_by(phrase_table.c.id)
        if limit:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        row_list = []

        # Use language set's default ignored categories if no override provided
        if ignored_categories_override is not None:
            effective_ignored = ignored_categories_override
        else:
            default_ignored = await self.get_default_ignored_categories(language_set["id"])
            effective_ignored = set(default_ignored)

        for row in result:
            row = dict(row)
            # Skip phrases shorter than 3 characters
            if len(str(row["phrase"]).strip()) < 3:
                continue
            # Remove ignored categories
            cats_set = set(row["categories"].split())
            cats_set = cats_set.difference(effective_ignored)
            # Skip if no valid categories left
            if not cats_set:
                continue
            row["categories"] = " ".join(sorted(cats_set))
            row_list.append(row)
        return row_list

    async def add_phrase(self, language_set_id: int, categories: str, phrase: str, translation: str):
        """Add a new phrase to a language set using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        # Ensure phrase table exists and get it
        await self._ensure_phrase_table_exists(language_set["name"])
        phrase_table = self._get_phrase_table(language_set["name"])

        query = insert(phrase_table).values(categories=categories, phrase=phrase, translation=translation)
        return await database.execute(query)

    async def update_phrase(self, phrase_id: int, language_set_id: int, categories: str, phrase: str, translation: str):
        """Update an existing phrase using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = (
            update(phrase_table)
            .where(phrase_table.c.id == phrase_id)
            .values(categories=categories, phrase=phrase, translation=translation)
        )
        return await database.execute(query)

    async def get_phrases_by_ids(self, phrase_ids: list[int], language_set_id: int) -> list[dict]:
        """Get specific phrases by their IDs"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table).where(phrase_table.c.id.in_(phrase_ids))
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def update_phrase_categories(self, phrase_id: int, categories: str, language_set_id: int):
        """Update only the categories of a specific phrase"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = update(phrase_table).where(phrase_table.c.id == phrase_id).values(categories=categories)
        return await database.execute(query)

    async def delete_phrase(self, phrase_id: int, language_set_id: int):
        """Delete a phrase using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table).where(phrase_table.c.id == phrase_id)
        return await database.execute(query)

    async def batch_delete_phrases(self, phrase_ids: list[int], language_set_id: int) -> int:
        """Delete multiple phrases using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table).where(phrase_table.c.id.in_(phrase_ids))
        result = await database.execute(query)
        # Return the number of deleted rows or the length of phrase_ids if result is None
        return getattr(result, "rowcount", len(phrase_ids)) if result else len(phrase_ids)

    async def batch_add_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Add a category to multiple phrases using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Get current phrases that need updating
        select_query = select(phrase_table.c.id, phrase_table.c.categories).where(phrase_table.c.id.in_(phrase_ids))
        phrases = await database.fetch_all(select_query)

        affected_count = 0
        for phrase in phrases:
            current_categories = phrase["categories"] or ""
            current_cat_list = [cat.strip() for cat in current_categories.split() if cat.strip()]

            # Only update if category doesn't already exist
            if category not in current_cat_list:
                new_categories = " ".join(current_cat_list + [category])
                update_query = (
                    update(phrase_table).where(phrase_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def batch_remove_category(self, phrase_ids: list[int], category: str, language_set_id: int) -> int:
        """Remove a category from multiple phrases using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Get current phrases that need updating
        select_query = select(phrase_table.c.id, phrase_table.c.categories).where(phrase_table.c.id.in_(phrase_ids))
        phrases = await database.fetch_all(select_query)

        affected_count = 0
        for phrase in phrases:
            current_categories = phrase["categories"] or ""
            current_cat_list = [cat.strip() for cat in current_categories.split() if cat.strip()]

            # Only update if category exists
            if category in current_cat_list:
                new_cat_list = [cat for cat in current_cat_list if cat != category]
                new_categories = " ".join(new_cat_list)
                update_query = (
                    update(phrase_table).where(phrase_table.c.id == phrase["id"]).values(categories=new_categories)
                )
                await database.execute(update_query)
                affected_count += 1

        return affected_count

    async def get_categories_for_language_set(
        self, language_set_id: Optional[int] = None, ignored_categories_override: Optional[set[str]] = None
    ) -> list[str]:
        """Get categories for a specific language set using dynamic table"""
        database = self._ensure_database()

        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table.c.categories)
        result = await database.fetch_all(query)
        categories_set = set()

        # Use language set's default ignored categories if no override provided
        if ignored_categories_override is not None:
            effective_ignored = ignored_categories_override
        else:
            default_ignored = await self.get_default_ignored_categories(language_set["id"])
            effective_ignored = set(default_ignored)

        for row in result:
            for cat in row["categories"].split():
                if cat.strip() and cat not in effective_ignored:
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    async def find_duplicate_phrases(self, language_set_id: int) -> list[dict]:
        """Find duplicate phrases within a language set based on phrase text (case-insensitive)

        Returns a list of duplicate groups, where each group contains phrases with the same text.
        Each group is a dict with 'phrase_text' and 'duplicates' (list of phrase records).
        """
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            raise ValueError(f"Language set with ID {language_set_id} not found")

        phrase_table = self._get_phrase_table(language_set["name"])

        # Find phrases with duplicate text (case-insensitive)
        # First, get all phrases with their lowercase phrase text for comparison
        query = select(
            phrase_table.c.id,
            phrase_table.c.categories,
            phrase_table.c.phrase,
            phrase_table.c.translation,
            func.lower(phrase_table.c.phrase).label("phrase_lower"),
        )

        all_phrases = await database.fetch_all(query)

        # Group phrases by lowercase text
        phrase_groups = {}
        for phrase in all_phrases:
            phrase_lower = phrase["phrase_lower"]
            if phrase_lower not in phrase_groups:
                phrase_groups[phrase_lower] = []
            phrase_groups[phrase_lower].append(
                {
                    "id": phrase["id"],
                    "categories": phrase["categories"],
                    "phrase": phrase["phrase"],
                    "translation": phrase["translation"],
                }
            )

        # Filter to only groups with duplicates (more than 1 phrase)
        duplicate_groups = []
        for phrase_text, phrases in phrase_groups.items():
            if len(phrases) > 1:
                duplicate_groups.append({"phrase_text": phrase_text, "count": len(phrases), "duplicates": phrases})

        # Sort by count descending, then by phrase text
        duplicate_groups.sort(key=lambda x: (-x["count"], x["phrase_text"]))

        return duplicate_groups

    async def delete_phrases_by_ids(self, phrase_ids: list[int], language_set_id: int) -> int:
        """Delete specific phrases by their IDs

        This is an alias for batch_delete_phrases for consistency with the API naming.
        """
        return await self.batch_delete_phrases(phrase_ids, language_set_id)

    async def get_phrases_for_admin(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        search_term: Optional[str] = None,
    ) -> list[dict[str, str]]:
        """Get phrases for admin panel using dynamic table - returns all phrases including ignored categories"""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table)
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrase_table.c.phrase.ilike(f"%{search_term}%")
                | phrase_table.c.translation.ilike(f"%{search_term}%")
                | phrase_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        query = query.order_by(phrase_table.c.id)
        if limit:
            query = query.limit(limit).offset(offset)

        result = await database.fetch_all(query)
        row_list = []
        for row in result:
            row = dict(row)
            # Only skip phrases shorter than 3 characters - NO category filtering
            if len(str(row["phrase"]).strip()) < 3:
                continue
            row_list.append(row)
        return row_list

    async def get_phrase_count_for_admin(
        self, language_set_id: Optional[int] = None, category: Optional[str] = None, search_term: Optional[str] = None
    ) -> int:
        """Get phrase count for admin panel using dynamic table - counts all phrases including ignored categories"""
        database = self._ensure_database()

        # If no language set specified, use the first active one
        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return 0
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return 0

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(func.count(phrase_table.c.id))
        if category:
            query = query.where(phrase_table.c.categories.like(f"%{category}%"))
        if search_term:
            # Search in phrase, translation, and categories fields
            search_filter = (
                phrase_table.c.phrase.ilike(f"%{search_term}%")
                | phrase_table.c.translation.ilike(f"%{search_term}%")
                | phrase_table.c.categories.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)
        # Only filter by minimum phrase length - NO category filtering
        query = query.where(func.length(phrase_table.c.phrase) >= 3)
        result = await database.fetch_one(query)
        return int(result[0]) if result and result[0] is not None else 0

    async def get_all_categories_for_language_set(self, language_set_id: Optional[int] = None) -> list[str]:
        """Get all categories including ignored ones for a language set using dynamic table - used for admin panel"""
        database = self._ensure_database()

        if language_set_id is None:
            sets = await self.get_language_sets(active_only=True)
            if not sets:
                return []
            language_set = sets[0]
        else:
            language_set = await self.get_language_set_by_id(language_set_id)
            if not language_set:
                return []

        phrase_table = self._get_phrase_table(language_set["name"])
        query = select(phrase_table.c.categories)
        result = await database.fetch_all(query)
        categories_set = set()
        for row in result:
            for cat in row["categories"].split():
                if cat.strip():
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    def fast_bulk_insert_phrases(self, language_set_id: int, phrases_data):
        """Bulk insert phrases for a language set using dynamic table for performance"""
        if not phrases_data:
            return 0

        # Get language set info
        engine = self._ensure_engine()

        # We need to get the language set synchronously for the table name
        # This is a limitation of the bulk insert approach
        with engine.connect() as conn:
            result = conn.execute(
                select(language_sets_table).where(language_sets_table.c.id == language_set_id)
            ).fetchone()
            if not result:
                raise ValueError(f"Language set with ID {language_set_id} not found")

            language_set = dict(result._mapping)
            phrase_table = self._get_phrase_table(language_set["name"])

            result = conn.execute(insert(phrase_table), phrases_data)
            conn.commit()
            return result.rowcount

    async def clear_all_phrases(self, language_set_id: int):
        """Clear all phrases for a specific language set using dynamic table"""
        database = self._ensure_database()

        # Get language set info
        language_set = await self.get_language_set_by_id(language_set_id)
        if not language_set:
            return

        phrase_table = self._get_phrase_table(language_set["name"])
        query = delete(phrase_table)
        await database.execute(query)

    async def set_default_language_set(self, language_set_id: int):
        """Mark the given language set as default and unset default for all others."""
        database = self._ensure_database()
        async with database.transaction():
            # Unset all
            await database.execute(update(language_sets_table).values(is_default=False))
            # Set the one
            await database.execute(
                update(language_sets_table).where(language_sets_table.c.id == language_set_id).values(is_default=True)
            )

    async def get_user_ignored_categories(self, user_id: int, language_set_id: int) -> list[str]:
        database = self._ensure_database()
        query = select(user_ignored_categories_table.c.category).where(
            user_ignored_categories_table.c.user_id == user_id,
            user_ignored_categories_table.c.language_set_id == language_set_id,
        )
        rows = await database.fetch_all(query)
        return [r[0] for r in rows]

    async def replace_user_ignored_categories(self, user_id: int, language_set_id: int, categories: list[str]):
        database = self._ensure_database()
        async with database.transaction():
            # Delete existing
            del_query = delete(user_ignored_categories_table).where(
                user_ignored_categories_table.c.user_id == user_id,
                user_ignored_categories_table.c.language_set_id == language_set_id,
            )
            await database.execute(del_query)
            if categories:
                insert_values = [
                    {"user_id": user_id, "language_set_id": language_set_id, "category": c}
                    for c in sorted(set(categories))
                ]
                await database.execute_many(insert(user_ignored_categories_table), insert_values)

    async def get_all_user_ignored_categories(self, user_id: int) -> dict[int, list[str]]:
        database = self._ensure_database()
        query = select(
            user_ignored_categories_table.c.language_set_id,
            user_ignored_categories_table.c.category,
        ).where(user_ignored_categories_table.c.user_id == user_id)
        rows = await database.fetch_all(query)
        result: dict[int, list[str]] = {}
        for row in rows:
            ls_id = row[0]
            cat = row[1]
            result.setdefault(ls_id, []).append(cat)
        # Sort categories
        for k in result:
            result[k] = sorted(result[k])
        return result

    # Statistics methods with caching

    def _get_cache_key(self, prefix: str, user_id: int, language_set_id: Optional[int] = None) -> str:
        """Generate cache key for statistics"""
        if language_set_id is not None:
            return f"{prefix}:{user_id}:{language_set_id}"
        return f"{prefix}:{user_id}"

    def _is_cache_valid(self, cache_entry: Dict) -> bool:
        """Check if cache entry is still valid"""
        return time.time() - cache_entry["timestamp"] < self._statistics_cache_ttl

    def _invalidate_user_cache(self, user_id: int):
        """Invalidate all cache entries for a user"""
        keys_to_remove = [
            key for key in self._statistics_cache.keys() if f":{user_id}:" in key or key.endswith(f":{user_id}")
        ]
        for key in keys_to_remove:
            del self._statistics_cache[key]

    async def start_game_session(
        self, user_id: int, language_set_id: int, category: str, difficulty: str, grid_size: int, total_phrases: int
    ) -> int:
        """Start a new game session and return session ID"""
        database = self._ensure_database()

        # Insert new game session
        query = insert(game_sessions_table).values(
            user_id=user_id,
            language_set_id=language_set_id,
            category=category,
            difficulty=difficulty,
            grid_size=grid_size,
            total_phrases=total_phrases,
            phrases_found=0,
            is_completed=False,
        )
        session_id = await database.execute(query)

        # Update user statistics - games started
        await self._update_user_statistics(user_id, language_set_id, games_started=1)

        # Invalidate cache
        self._invalidate_user_cache(user_id)

        return session_id

    async def update_game_progress(self, session_id: int, phrases_found: int):
        """Update game progress for a session"""
        database = self._ensure_database()

        query = (
            update(game_sessions_table)
            .where(game_sessions_table.c.id == session_id)
            .values(phrases_found=phrases_found)
        )

        await database.execute(query)

    async def complete_game_session(self, session_id: int, phrases_found: int, duration_seconds: int):
        """Complete a game session and update statistics"""
        database = self._ensure_database()

        # Get session details
        session_query = select(game_sessions_table).where(game_sessions_table.c.id == session_id)
        session = await database.fetch_one(session_query)

        if not session:
            return

        user_id = session["user_id"]
        language_set_id = session["language_set_id"]
        category = session["category"]
        total_phrases = session["total_phrases"]
        is_completed = phrases_found == total_phrases

        # Update game session
        update_query = (
            update(game_sessions_table)
            .where(game_sessions_table.c.id == session_id)
            .values(
                phrases_found=phrases_found,
                is_completed=is_completed,
                end_time=func.now(),
                duration_seconds=duration_seconds,
            )
        )
        await database.execute(update_query)

        # Update user statistics
        stats_update = {"total_phrases_found": phrases_found, "total_time_played_seconds": duration_seconds}

        if is_completed:
            stats_update["games_completed"] = 1
            stats_update["puzzles_solved"] = 1

        await self._update_user_statistics(user_id, language_set_id, **stats_update)

        # Update category plays
        await self._update_category_plays(user_id, language_set_id, category, phrases_found, duration_seconds)

        # Invalidate cache
        self._invalidate_user_cache(user_id)

    async def _update_user_statistics(self, user_id: int, language_set_id: int, **kwargs):
        """Update user statistics with the provided values"""
        database = self._ensure_database()

        # Check if record exists
        check_query = select(user_statistics_table).where(
            (user_statistics_table.c.user_id == user_id) & (user_statistics_table.c.language_set_id == language_set_id)
        )
        existing = await database.fetch_one(check_query)

        if existing:
            # Update existing record
            update_values = {"updated_at": func.now()}
            for key, value in kwargs.items():
                if key in [
                    "games_started",
                    "games_completed",
                    "puzzles_solved",
                    "total_phrases_found",
                    "total_time_played_seconds",
                    "phrases_added",
                    "phrases_edited",
                ]:
                    update_values[key] = getattr(user_statistics_table.c, key) + value

            if any(k in kwargs for k in ["games_completed", "puzzles_solved"]):
                update_values["last_played"] = func.now()

            query = (
                update(user_statistics_table)
                .where(
                    (user_statistics_table.c.user_id == user_id)
                    & (user_statistics_table.c.language_set_id == language_set_id)
                )
                .values(**update_values)
            )

            await database.execute(query)
        else:
            # Insert new record
            insert_values = {
                "user_id": user_id,
                "language_set_id": language_set_id,
                "games_started": kwargs.get("games_started", 0),
                "games_completed": kwargs.get("games_completed", 0),
                "puzzles_solved": kwargs.get("puzzles_solved", 0),
                "total_phrases_found": kwargs.get("total_phrases_found", 0),
                "total_time_played_seconds": kwargs.get("total_time_played_seconds", 0),
                "phrases_added": kwargs.get("phrases_added", 0),
                "phrases_edited": kwargs.get("phrases_edited", 0),
            }

            if any(k in kwargs for k in ["games_completed", "puzzles_solved"]):
                insert_values["last_played"] = func.now()

            query = insert(user_statistics_table).values(**insert_values)
            await database.execute(query)

    async def _update_category_plays(
        self, user_id: int, language_set_id: int, category: str, phrases_found: int, duration_seconds: int
    ):
        """Update category play statistics"""
        database = self._ensure_database()

        # Check if record exists
        check_query = select(user_category_plays_table).where(
            (user_category_plays_table.c.user_id == user_id)
            & (user_category_plays_table.c.language_set_id == language_set_id)
            & (user_category_plays_table.c.category == category)
        )
        existing = await database.fetch_one(check_query)

        if existing:
            # Update existing record
            query = (
                update(user_category_plays_table)
                .where(
                    (user_category_plays_table.c.user_id == user_id)
                    & (user_category_plays_table.c.language_set_id == language_set_id)
                    & (user_category_plays_table.c.category == category)
                )
                .values(
                    plays_count=user_category_plays_table.c.plays_count + 1,
                    phrases_found=user_category_plays_table.c.phrases_found + phrases_found,
                    total_time_seconds=user_category_plays_table.c.total_time_seconds + duration_seconds,
                    last_played=func.now(),
                )
            )
            await database.execute(query)
        else:
            # Insert new record
            query = insert(user_category_plays_table).values(
                user_id=user_id,
                language_set_id=language_set_id,
                category=category,
                plays_count=1,
                phrases_found=phrases_found,
                total_time_seconds=duration_seconds,
            )
            await database.execute(query)

    async def record_phrase_operation(self, user_id: int, language_set_id: int, operation: str):
        """Record phrase add/edit operation"""
        if operation not in ["added", "edited"]:
            return

        field_name = f"phrases_{operation}"
        await self._update_user_statistics(user_id, language_set_id, **{field_name: 1})
        self._invalidate_user_cache(user_id)

    async def get_user_statistics(self, user_id: int, language_set_id: Optional[int] = None) -> Dict:
        """Get user statistics with caching"""
        cache_key = self._get_cache_key("user_stats", user_id, language_set_id)

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        if language_set_id is not None:
            # Get statistics for specific language set
            query = select(user_statistics_table).where(
                (user_statistics_table.c.user_id == user_id)
                & (user_statistics_table.c.language_set_id == language_set_id)
            )
            stats = await database.fetch_one(query)

            if stats:
                result = dict(stats)
                result = self._serialize_datetimes(result)
            else:
                result = {
                    "user_id": user_id,
                    "language_set_id": language_set_id,
                    "games_started": 0,
                    "games_completed": 0,
                    "puzzles_solved": 0,
                    "total_phrases_found": 0,
                    "total_time_played_seconds": 0,
                    "phrases_added": 0,
                    "phrases_edited": 0,
                    "last_played": None,
                }
        else:
            # Get aggregated statistics across all language sets
            query = select(
                func.sum(user_statistics_table.c.games_started).label("games_started"),
                func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                func.sum(user_statistics_table.c.puzzles_solved).label("puzzles_solved"),
                func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
                func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played_seconds"),
                func.sum(user_statistics_table.c.phrases_added).label("phrases_added"),
                func.sum(user_statistics_table.c.phrases_edited).label("phrases_edited"),
                func.max(user_statistics_table.c.last_played).label("last_played"),
            ).where(user_statistics_table.c.user_id == user_id)

            stats = await database.fetch_one(query)

            if stats and stats["games_started"]:
                result = {
                    "user_id": user_id,
                    "games_started": stats["games_started"] or 0,
                    "games_completed": stats["games_completed"] or 0,
                    "puzzles_solved": stats["puzzles_solved"] or 0,
                    "total_phrases_found": stats["total_phrases_found"] or 0,
                    "total_time_played_seconds": stats["total_time_played_seconds"] or 0,
                    "phrases_added": stats["phrases_added"] or 0,
                    "phrases_edited": stats["phrases_edited"] or 0,
                    "last_played": stats["last_played"].isoformat() if stats["last_played"] else None,
                }
            else:
                result = {
                    "user_id": user_id,
                    "games_started": 0,
                    "games_completed": 0,
                    "puzzles_solved": 0,
                    "total_phrases_found": 0,
                    "total_time_played_seconds": 0,
                    "phrases_added": 0,
                    "phrases_edited": 0,
                    "last_played": None,
                }

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_user_favorite_categories(self, user_id: int, language_set_id: int, limit: int = 5) -> List[Dict]:
        """Get user's favorite categories for a language set"""
        cache_key = self._get_cache_key("fav_cats", user_id, language_set_id)

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        query = (
            select(
                user_category_plays_table.c.category,
                user_category_plays_table.c.plays_count,
                user_category_plays_table.c.phrases_found,
                user_category_plays_table.c.total_time_seconds,
                user_category_plays_table.c.last_played,
            )
            .where(
                (user_category_plays_table.c.user_id == user_id)
                & (user_category_plays_table.c.language_set_id == language_set_id)
            )
            .order_by(desc(user_category_plays_table.c.plays_count))
            .limit(limit)
        )

        rows = await database.fetch_all(query)
        result = [self._serialize_datetimes(dict(row)) for row in rows]

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_admin_statistics_overview(self) -> Dict:
        """Get overview statistics for admin dashboard"""
        cache_key = "admin_overview"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        # Get total users count
        users_query = select(func.count(accounts_table.c.id)).where(accounts_table.c.is_active == True)
        total_users = await database.fetch_val(users_query)

        # Get total games statistics
        games_query = select(
            func.sum(user_statistics_table.c.games_started).label("total_games_started"),
            func.sum(user_statistics_table.c.games_completed).label("total_games_completed"),
            func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
            func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played"),
        )
        games_stats = await database.fetch_one(games_query)

        # Get active users (played in last 30 days)
        thirty_days_ago = datetime.datetime.now() - datetime.timedelta(days=30)
        active_users_query = select(func.count(func.distinct(user_statistics_table.c.user_id))).where(
            user_statistics_table.c.last_played >= thirty_days_ago
        )
        active_users = await database.fetch_val(active_users_query)

        result = {
            "total_users": total_users or 0,
            "active_users_30d": active_users or 0,
            "total_games_started": games_stats["total_games_started"] if games_stats else 0,
            "total_games_completed": games_stats["total_games_completed"] if games_stats else 0,
            "total_phrases_found": games_stats["total_phrases_found"] if games_stats else 0,
            "total_time_played_hours": round((games_stats["total_time_played"] or 0) / 3600, 2) if games_stats else 0,
        }

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_statistics_by_language_set(self, language_set_id: Optional[int] = None) -> List[Dict]:
        """Get statistics grouped by language set"""
        cache_key = f"stats_by_langset:{language_set_id or 'all'}"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        # Join with language_sets table to get language set information
        query = (
            select(
                language_sets_table.c.id,
                language_sets_table.c.name,
                language_sets_table.c.display_name,
                func.sum(user_statistics_table.c.games_started).label("games_started"),
                func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                func.sum(user_statistics_table.c.total_phrases_found).label("phrases_found"),
                func.sum(user_statistics_table.c.total_time_played_seconds).label("time_played"),
                func.count(func.distinct(user_statistics_table.c.user_id)).label("unique_players"),
            )
            .select_from(
                language_sets_table.join(
                    user_statistics_table,
                    language_sets_table.c.id == user_statistics_table.c.language_set_id,
                    isouter=True,
                )
            )
            .group_by(language_sets_table.c.id, language_sets_table.c.name, language_sets_table.c.display_name)
        )

        if language_set_id is not None:
            query = query.where(language_sets_table.c.id == language_set_id)

        rows = await database.fetch_all(query)
        result = []

        for row in rows:
            result.append(
                {
                    "language_set_id": row["id"],
                    "language_set_name": row["name"],
                    "language_set_display_name": row["display_name"],
                    "games_started": row["games_started"] or 0,
                    "games_completed": row["games_completed"] or 0,
                    "phrases_found": row["phrases_found"] or 0,
                    "time_played_hours": round((row["time_played"] or 0) / 3600, 2),
                    "unique_players": row["unique_players"] or 0,
                }
            )

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    async def get_user_statistics_list(self, language_set_id: Optional[int] = None, limit: int = 50) -> List[Dict]:
        """Get statistics for all users, optionally filtered by language set"""
        cache_key = f"user_stats_list:{language_set_id or 'all'}:{limit}"

        # Check cache first
        if cache_key in self._statistics_cache and self._is_cache_valid(self._statistics_cache[cache_key]):
            return self._statistics_cache[cache_key]["data"]

        database = self._ensure_database()

        if language_set_id is not None:
            # Get statistics for specific language set
            query = (
                select(
                    accounts_table.c.id,
                    accounts_table.c.username,
                    user_statistics_table.c.language_set_id,
                    user_statistics_table.c.games_started,
                    user_statistics_table.c.games_completed,
                    user_statistics_table.c.total_phrases_found,
                    user_statistics_table.c.total_time_played_seconds,
                    user_statistics_table.c.phrases_added,
                    user_statistics_table.c.phrases_edited,
                    user_statistics_table.c.last_played,
                )
                .select_from(
                    accounts_table.join(user_statistics_table, accounts_table.c.id == user_statistics_table.c.user_id)
                )
                .where(
                    (accounts_table.c.is_active == True) & (user_statistics_table.c.language_set_id == language_set_id)
                )
                .order_by(desc(user_statistics_table.c.games_completed))
                .limit(limit)
            )
        else:
            # Get aggregated statistics across all language sets
            query = (
                select(
                    accounts_table.c.id,
                    accounts_table.c.username,
                    func.sum(user_statistics_table.c.games_started).label("games_started"),
                    func.sum(user_statistics_table.c.games_completed).label("games_completed"),
                    func.sum(user_statistics_table.c.total_phrases_found).label("total_phrases_found"),
                    func.sum(user_statistics_table.c.total_time_played_seconds).label("total_time_played_seconds"),
                    func.sum(user_statistics_table.c.phrases_added).label("phrases_added"),
                    func.sum(user_statistics_table.c.phrases_edited).label("phrases_edited"),
                    func.max(user_statistics_table.c.last_played).label("last_played"),
                )
                .select_from(
                    accounts_table.join(
                        user_statistics_table, accounts_table.c.id == user_statistics_table.c.user_id, isouter=True
                    )
                )
                .where(accounts_table.c.is_active == True)
                .group_by(accounts_table.c.id, accounts_table.c.username)
                .order_by(desc(func.sum(user_statistics_table.c.games_completed)))
                .limit(limit)
            )

        rows = await database.fetch_all(query)
        result = [self._serialize_datetimes(dict(row)) for row in rows]

        # Cache the result
        self._statistics_cache[cache_key] = {"data": result, "timestamp": time.time()}

        return result

    # Global settings management methods
    async def get_global_setting(self, setting_key: str, default_value: Optional[str] = None) -> Optional[str]:
        """Get a global setting value by key"""
        database = self._ensure_database()

        query = select(global_settings_table.c.setting_value).where(global_settings_table.c.setting_key == setting_key)

        result = await database.fetch_one(query)
        return result["setting_value"] if result else default_value

    async def set_global_setting(
        self, setting_key: str, setting_value: str, description: Optional[str] = None, updated_by: int = 0
    ) -> None:
        """Set a global setting value"""
        database = self._ensure_database()

        # Check if setting exists
        existing = await database.fetch_one(
            select(global_settings_table.c.id).where(global_settings_table.c.setting_key == setting_key)
        )

        if existing:
            # Update existing setting
            query = (
                update(global_settings_table)
                .where(global_settings_table.c.setting_key == setting_key)
                .values(setting_value=setting_value, updated_at=func.now(), updated_by=updated_by)
            )
            if description is not None:
                query = query.values(description=description)
        else:
            # Insert new setting
            query = insert(global_settings_table).values(
                setting_key=setting_key, setting_value=setting_value, description=description, updated_by=updated_by
            )

        await database.execute(query)

    async def is_statistics_enabled(self) -> bool:
        """Check if statistics tracking is globally enabled"""
        setting = await self.get_global_setting("statistics_enabled", "true")
        return setting is not None and setting.lower() == "true"

    async def clear_all_statistics(self) -> None:
        """Clear all statistics data from all tables"""
        database = self._ensure_database()

        # Clear all statistics tables
        await database.execute(delete(game_sessions_table))
        await database.execute(delete(user_statistics_table))
        await database.execute(delete(user_category_plays_table))
        await database.execute(delete(game_scores_table))

    # User preferences management methods
    async def get_user_preference(
        self, user_id: int, preference_key: str, default_value: Optional[str] = None
    ) -> Optional[str]:
        """Get a user preference value by key"""
        database = self._ensure_database()

        query = select(user_preferences_table.c.preference_value).where(
            (user_preferences_table.c.user_id == user_id) & (user_preferences_table.c.preference_key == preference_key)
        )

        result = await database.fetch_one(query)
        return result["preference_value"] if result else default_value

    async def set_user_preference(self, user_id: int, preference_key: str, preference_value: str) -> None:
        """Set a user preference value"""
        database = self._ensure_database()

        # Check if preference exists
        existing = await database.fetch_one(
            select(user_preferences_table.c.id).where(
                (user_preferences_table.c.user_id == user_id)
                & (user_preferences_table.c.preference_key == preference_key)
            )
        )

        if existing:
            # Update existing preference
            query = (
                update(user_preferences_table)
                .where(
                    (user_preferences_table.c.user_id == user_id)
                    & (user_preferences_table.c.preference_key == preference_key)
                )
                .values(preference_value=preference_value, updated_at=func.now())
            )
        else:
            # Insert new preference
            query = insert(user_preferences_table).values(
                user_id=user_id, preference_key=preference_key, preference_value=preference_value
            )

        await database.execute(query)

    async def get_user_preferences(self, user_id: int) -> dict:
        """Get all preferences for a user"""
        database = self._ensure_database()

        query = select(user_preferences_table.c.preference_key, user_preferences_table.c.preference_value).where(
            user_preferences_table.c.user_id == user_id
        )

        rows = await database.fetch_all(query)
        return {row["preference_key"]: row["preference_value"] for row in rows}

    # Scoring system methods
    async def save_game_score(
        self,
        session_id: int,
        user_id: int,
        language_set_id: int,
        category: str,
        difficulty: str,
        grid_size: int,
        total_phrases: int,
        phrases_found: int,
        hints_used: int,
        base_score: int,
        time_bonus: int,
        difficulty_bonus: int,
        streak_bonus: int,
        hint_penalty: int,
        final_score: int,
        duration_seconds: int,
        first_phrase_time: Optional[datetime.datetime] = None,
        completion_time: Optional[datetime.datetime] = None,
    ) -> int:
        """Save game score and return the score ID"""
        database = self._ensure_database()

        query = insert(game_scores_table).values(
            session_id=session_id,
            user_id=user_id,
            language_set_id=language_set_id,
            category=category,
            difficulty=difficulty,
            grid_size=grid_size,
            total_phrases=total_phrases,
            phrases_found=phrases_found,
            hints_used=hints_used,
            base_score=base_score,
            time_bonus=time_bonus,
            difficulty_bonus=difficulty_bonus,
            streak_bonus=streak_bonus,
            hint_penalty=hint_penalty,
            final_score=final_score,
            duration_seconds=duration_seconds,
            first_phrase_time=first_phrase_time,
            completion_time=completion_time,
        )

        return await database.execute(query)

    async def get_user_best_scores(
        self,
        user_id: int,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get user's best scores with optional filters"""
        database = self._ensure_database()

        query = select(game_scores_table).where(game_scores_table.c.user_id == user_id)

        if language_set_id is not None:
            query = query.where(game_scores_table.c.language_set_id == language_set_id)
        if category is not None:
            query = query.where(game_scores_table.c.category == category)
        if difficulty is not None:
            query = query.where(game_scores_table.c.difficulty == difficulty)

        query = query.order_by(desc(game_scores_table.c.final_score)).limit(limit)

        rows = await database.fetch_all(query)
        return [self._serialize_datetimes(dict(row)) for row in rows]

    async def get_leaderboard(
        self,
        language_set_id: Optional[int] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get global leaderboard with optional filters"""
        database = self._ensure_database()

        query = (
            select(
                game_scores_table.c.user_id,
                accounts_table.c.username,
                game_scores_table.c.final_score,
                game_scores_table.c.category,
                game_scores_table.c.difficulty,
                game_scores_table.c.duration_seconds,
                game_scores_table.c.phrases_found,
                game_scores_table.c.total_phrases,
                game_scores_table.c.hints_used,
                game_scores_table.c.created_at,
            )
            .select_from(game_scores_table.join(accounts_table, game_scores_table.c.user_id == accounts_table.c.id))
            .where(accounts_table.c.is_active == True)
        )

        if language_set_id is not None:
            query = query.where(game_scores_table.c.language_set_id == language_set_id)
        if category is not None:
            query = query.where(game_scores_table.c.category == category)
        if difficulty is not None:
            query = query.where(game_scores_table.c.difficulty == difficulty)

        query = query.order_by(desc(game_scores_table.c.final_score)).limit(limit)

        rows = await database.fetch_all(query)
        return [self._serialize_datetimes(dict(row)) for row in rows]

    # Scoring preferences check methods
    async def is_scoring_enabled_globally(self) -> bool:
        """Check if scoring system is globally enabled"""
        setting = await self.get_global_setting("scoring_enabled", "true")
        return setting is not None and setting.lower() == "true"

    async def is_scoring_enabled_for_user(self, user_id: int) -> bool:
        """Check if scoring is enabled for a specific user (user preference overrides global)"""
        global_enabled = await self.is_scoring_enabled_globally()
        user_preference = await self.get_user_preference(user_id, "scoring_enabled")

        if user_preference is not None:
            return user_preference.lower() == "true"

        return global_enabled

    async def is_progressive_hints_enabled_globally(self) -> bool:
        """Check if progressive hints are globally enabled"""
        setting = await self.get_global_setting("progressive_hints_enabled", "false")
        return setting is not None and setting.lower() == "true"

    async def is_progressive_hints_enabled_for_user(self, user_id: int) -> bool:
        """Check if progressive hints are enabled for a specific user"""
        global_enabled = await self.is_progressive_hints_enabled_globally()
        user_preference = await self.get_user_preference(user_id, "progressive_hints_enabled")

        if user_preference is not None:
            return user_preference.lower() == "true"

        return global_enabled


# Create global database manager instance
db_manager = DatabaseManager()
