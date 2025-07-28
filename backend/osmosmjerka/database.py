import os
from typing import Optional
from databases import Database
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String
from sqlalchemy.sql import select, insert, update, delete
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
    from sqlalchemy import func

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
