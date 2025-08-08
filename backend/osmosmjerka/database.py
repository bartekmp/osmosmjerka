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

# Define the language_sets table
language_sets_table = Table(
    "language_sets",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("name", String, nullable=False, unique=True),  # Short name like "hr-pl"
    Column("display_name", String, nullable=False),  # User-friendly name like "Croatian-Polish"
    Column("description", Text, nullable=True),
    Column("author", String, nullable=True),
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
        extend_existing=True
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

IGNORED_CATEGORIES_STR = os.getenv("IGNORED_CATEGORIES", "")
IGNORED_CATEGORIES = set(cat.strip() for cat in IGNORED_CATEGORIES_STR.split(",") if cat.strip())


class DatabaseManager:
    """Database manager class that encapsulates all database operations using hybrid approach"""

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url
        self.database = None
        self.engine = None
        self._phrase_tables_cache = {}  # Cache for dynamically created phrase tables

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

    # Language Set Management Methods
    async def get_language_sets(self, active_only: bool = True) -> list[dict]:
        """Get all language sets"""
        database = self._ensure_database()
        query = select(language_sets_table)
        if active_only:
            query = query.where(language_sets_table.c.is_active == True)
        # Default first, then by display name
        query = query.order_by(language_sets_table.c.is_default.desc(), language_sets_table.c.display_name)
        result = await database.fetch_all(query)
        return [self._serialize_datetimes(dict(row)) for row in result]

    async def get_language_set_by_id(self, language_set_id: int) -> Optional[dict]:
        """Get a specific language set by ID"""
        database = self._ensure_database()
        query = select(language_sets_table).where(language_sets_table.c.id == language_set_id)
        result = await database.fetch_one(query)
        return self._serialize_datetimes(dict(result)) if result else None

    async def create_language_set(self, name: str, display_name: str, description: Optional[str] = None, author: Optional[str] = None) -> int:
        """Create a new language set and its phrase table"""
        database = self._ensure_database()
        
        # Create language set record
        query = insert(language_sets_table).values(
            name=name,
            display_name=display_name,
            description=description,
            author=author,
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
        self, language_set_id: Optional[int] = None, category: Optional[str] = None, 
        limit: Optional[int] = None, offset: int = 0
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
        for row in result:
            row = dict(row)
            # Skip phrases shorter than 3 characters
            if len(str(row["phrase"]).strip()) < 3:
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
        
        query = insert(phrase_table).values(
            categories=categories, 
            phrase=phrase, 
            translation=translation
        )
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

    async def get_categories_for_language_set(self, language_set_id: Optional[int] = None) -> list[str]:
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
        for row in result:
            for cat in row["categories"].split():
                if cat.strip() and cat not in IGNORED_CATEGORIES:
                    categories_set.add(cat.strip())
        return sorted(list(categories_set))

    async def get_phrases_for_admin(
        self, language_set_id: Optional[int] = None, category: Optional[str] = None, 
        limit: Optional[int] = None, offset: int = 0, search_term: Optional[str] = None
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
                phrase_table.c.phrase.ilike(f"%{search_term}%") |
                phrase_table.c.translation.ilike(f"%{search_term}%") |
                phrase_table.c.categories.ilike(f"%{search_term}%")
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
                phrase_table.c.phrase.ilike(f"%{search_term}%") |
                phrase_table.c.translation.ilike(f"%{search_term}%") |
                phrase_table.c.categories.ilike(f"%{search_term}%")
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
            
            language_set = dict(result)
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
                update(language_sets_table)
                .where(language_sets_table.c.id == language_set_id)
                .values(is_default=True)
            )


# Create global database manager instance
db_manager = DatabaseManager()
