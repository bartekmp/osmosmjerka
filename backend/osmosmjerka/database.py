import os
from typing import Optional
from databases import Database
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import select, insert, update, delete, func
from dotenv import load_dotenv
import urllib.parse

# Load environment variables
load_dotenv()

# Database configuration
pg_host = os.getenv("POSTGRES_HOST")
pg_port = os.getenv("POSTGRES_PORT")
pg_user = os.getenv("POSTGRES_USER")
pg_password = urllib.parse.quote_plus(os.getenv("POSTGRES_PASSWORD", ""))
pg_database = os.getenv("POSTGRES_DATABASE")

if not pg_host or not pg_port or not pg_user or not pg_password or not pg_database:
    raise ValueError("PostgreSQL connection parameters are not set in environment variables.")

# Construct the database URL
DATABASE_URL = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"

# Get ignored categories from environment
IGNORED_CATEGORIES_STR = os.getenv("IGNORED_CATEGORIES", "")
IGNORED_CATEGORIES = set(cat.strip() for cat in IGNORED_CATEGORIES_STR.split(",") if cat.strip())

database = Database(DATABASE_URL)
metadata = MetaData()

# Define the words table
words_table = Table(
    "words",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("categories", String, nullable=False),
    Column("word", String, nullable=False),
    Column("translation", String, nullable=False),
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

# SQLAlchemy engine for table creation
engine = create_engine(DATABASE_URL)


async def connect_db():
    """Connect to the database and ensure tables exist"""
    await database.connect()
    # Ensure tables exist (uses CREATE TABLE IF NOT EXISTS under the hood)
    create_tables()


async def disconnect_db():
    """Disconnect from the database"""
    await database.disconnect()


def create_tables():
    """Create tables if they don't exist"""
    metadata.create_all(bind=engine)


# Database operations
async def get_words(category: Optional[str] = None, limit: Optional[int] = None, offset: int = 0) -> list[dict[str, str]]:
    """Get words from database with optional filtering"""
    query = select(words_table)
    if category:
        query = query.where(words_table.c.categories.like(f"%{category}%"))
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


async def get_word_count(category: Optional[str] = None) -> int:
    """Get total count of words"""
    query = select(func.count(words_table.c.id))
    if category:
        query = query.where(words_table.c.categories.like(f"%{category}%"))
    result = await database.fetch_one(query)
    return result[0] if result else 0


async def add_word(categories: str, word: str, translation: str):
    """Add a new word to the database"""
    query = insert(words_table).values(categories=categories, word=word, translation=translation)
    result = await database.execute(query)
    return result


async def update_word(word_id: int, categories: str, word: str, translation: str):
    """Update an existing word"""
    query = (
        update(words_table)
        .where(words_table.c.id == word_id)
        .values(categories=categories, word=word, translation=translation)
    )
    result = await database.execute(query)
    return result


async def delete_word(word_id: int):
    """Delete a word from the database"""
    query = delete(words_table).where(words_table.c.id == word_id)
    result = await database.execute(query)
    return result


async def clear_all_words():
    """Clear all words from the database and reset id sequence"""
    query = delete(words_table)
    await database.execute(query)
    # Reset the id sequence so new rows start from 1
    await database.execute("ALTER SEQUENCE words_id_seq RESTART WITH 1;")


async def get_categories() -> list[str]:
    """Get all unique categories"""
    query = select(words_table.c.categories)
    result = await database.fetch_all(query)
    categories = set()
    for row in result:
        cats = row["categories"].split()
        for cat in cats:
            if cat not in IGNORED_CATEGORIES:
                categories.add(cat.strip())
    return sorted(list(categories))


def fast_bulk_insert_words(words_data):
    """Fast bulk insert using SQLAlchemy engine (synchronous, for large uploads)"""
    if not words_data:
        return
    with engine.begin() as conn:
        conn.execute(insert(words_table), words_data)


# Account management operations
async def get_accounts(offset: int = 0, limit: int = 50) -> list[dict]:
    """Get all user accounts (excluding password hash)"""
    query = select(
        accounts_table.c.id,
        accounts_table.c.username,
        accounts_table.c.role,
        accounts_table.c.self_description,
        accounts_table.c.created_at,
        accounts_table.c.updated_at,
        accounts_table.c.is_active,
        accounts_table.c.last_login
    ).limit(limit).offset(offset)
    result = await database.fetch_all(query)
    return [dict(row) for row in result]


async def get_account_by_username(username: str) -> dict | None:
    """Get account by username (including password hash for authentication)"""
    query = select(accounts_table).where(accounts_table.c.username == username)
    result = await database.fetch_one(query)
    return dict(result) if result else None


async def get_account_by_id(account_id: int) -> dict | None:
    """Get account by ID (excluding password hash)"""
    query = select(
        accounts_table.c.id,
        accounts_table.c.username,
        accounts_table.c.role,
        accounts_table.c.self_description,
        accounts_table.c.created_at,
        accounts_table.c.updated_at,
        accounts_table.c.is_active,
        accounts_table.c.last_login
    ).where(accounts_table.c.id == account_id)
    result = await database.fetch_one(query)
    return dict(result) if result else None


async def create_account(username: str, password_hash: str, role: str = "regular", self_description: str = "") -> int:
    """Create a new user account"""
    query = insert(accounts_table).values(
        username=username,
        password_hash=password_hash,
        role=role,
        self_description=self_description,
        is_active=True
    )
    result = await database.execute(query)
    return result


async def update_account(account_id: int, **kwargs) -> int:
    """Update user account fields"""
    # Remove None values and ensure updated_at is set
    update_data = {k: v for k, v in kwargs.items() if v is not None}
    update_data['updated_at'] = func.now()
    
    query = update(accounts_table).where(accounts_table.c.id == account_id).values(**update_data)
    result = await database.execute(query)
    return result


async def delete_account(account_id: int) -> int:
    """Delete a user account"""
    query = delete(accounts_table).where(accounts_table.c.id == account_id)
    result = await database.execute(query)
    return result


async def update_last_login(username: str) -> None:
    """Update the last login timestamp for a user"""
    query = update(accounts_table).where(accounts_table.c.username == username).values(last_login=func.now())
    await database.execute(query)


async def get_account_count() -> int:
    """Get total count of accounts"""
    query = select(func.count(accounts_table.c.id))
    result = await database.fetch_one(query)
    return result[0] if result else 0
